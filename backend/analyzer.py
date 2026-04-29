import ast
import asyncio
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from prompt_builder import build_prompt, _STOPWORDS

SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", "__pycache__",
    ".venv", "venv", ".next", "coverage", ".pytest_cache",
    "vendor", "target", ".cache", "tmp", "temp", ".tox",
    "eggs", ".eggs", "htmlcov",
}

SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".mp4", ".mp3", ".wav", ".ogg", ".webm",
    ".pdf", ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z",
    ".lock", ".sum", ".bin", ".exe", ".dll", ".so", ".dylib",
    ".pyc", ".pyo", ".class", ".o", ".a",
    ".min.js", ".min.css",
}

SKIP_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "poetry.lock", "Pipfile.lock", "composer.lock",
    "Gemfile.lock", "cargo.lock",
}

# Docs and config files that almost never contain logic relevant to a bug.
# Matched case-insensitively against the bare filename.
LOW_VALUE_EXTENSIONS = {".css", ".scss", ".sass", ".less", ".styl"}

SKIP_NAMES = {
    # documentation
    "readme.md", "readme.rst", "readme.txt", "readme",
    "changelog.md", "changelog.rst", "changelog.txt", "changelog",
    "changes.md", "history.md", "news.md", "releases.md",
    "contributing.md", "contributors.md", "contributors.txt",
    "code_of_conduct.md", "security.md", "support.md",
    "license", "license.md", "license.txt", "license.rst",
    "notice", "notice.md", "notice.txt",
    "authors", "authors.md", "authors.txt",
    "copying", "patents",
    # project config / manifests that don't contain logic
    ".gitignore", ".gitattributes", ".gitmodules", ".editorconfig",
    ".prettierrc", ".prettierignore", ".eslintignore",
    ".npmignore", ".npmrc", ".nvmrc", ".node-version",
    ".python-version", ".ruby-version",
    "makefile", "dockerfile", "docker-compose.yml", "docker-compose.yaml",
    ".env.example", ".env.sample", ".env.template",
    "package.json", "tsconfig.json", "jsconfig.json",
    "babel.config.js", "babel.config.json",
    "jest.config.js", "jest.config.ts", "jest.config.json",
    "vitest.config.js", "vitest.config.ts",
    "webpack.config.js", "rollup.config.js", "esbuild.config.js",
    "vite.config.js", "vite.config.ts",
    "index.html", ".htaccess",
    "setup.cfg", "setup.py", "pyproject.toml", "manifest.in",
    "tox.ini", "pytest.ini", ".flake8", ".pylintrc", "mypy.ini",
    "gemfile", "rakefile", "guardfile",
    "cargo.toml",
}

MAX_FILE_LINES = 500
MAX_TOTAL_CHARS = 40_000


def _is_local_path(url: str) -> bool:
    return not url.startswith(("http://", "https://", "git://", "ssh://", "git@"))


async def analyze_uploaded(file_data: list[tuple[str, bytes]], bug_description: str):
    tmpdir = tempfile.mkdtemp(prefix="prismmap_upload_")
    try:
        yield {"type": "log", "message": "reading uploaded files..."}

        for rel_path, content in file_data:
            dest = os.path.join(tmpdir, rel_path)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as fh:
                fh.write(content)

        files = await asyncio.to_thread(collect_files, tmpdir)

        if not files:
            yield {"type": "error", "message": "No readable source files found in the uploaded folder."}
            return

        vague_warning = _check_vague(bug_description)
        if vague_warning:
            yield {"type": "warning", "message": vague_warning}

        yield {"type": "log", "message": f"scoring relevance across {len(files)} files..."}
        scored = await asyncio.to_thread(score_files, files, bug_description, tmpdir)

        yield {"type": "log", "message": "building prompt..."}
        top = sorted(scored, key=lambda x: x["score"], reverse=True)[:10]
        prompt, token_estimate = await asyncio.to_thread(
            build_prompt, bug_description, top, len(scored), "local folder", MAX_TOTAL_CHARS
        )

        selected = [
            {"path": f["path"], "score": round(f["score"], 3), "reason": f["reason"]}
            for f in top
        ]
        yield {
            "type": "result",
            "selected_files": selected,
            "prompt": prompt,
            "token_estimate": token_estimate,
        }

    except Exception as e:
        yield {"type": "error", "message": str(e)}
    finally:
        await asyncio.to_thread(shutil.rmtree, tmpdir, ignore_errors=True)


async def analyze_repo(repo_url: str, bug_description: str):
    is_local = _is_local_path(repo_url)
    tmpdir = None

    if is_local:
        repo_dir = str(Path(repo_url).expanduser().resolve())
    else:
        tmpdir = tempfile.mkdtemp(prefix="prismmap_")
        repo_dir = os.path.join(tmpdir, "repo")

    try:
        if is_local:
            if not Path(repo_dir).is_dir():
                yield {"type": "error", "message": f"Path not found or not a directory: {repo_dir}"}
                return
            yield {"type": "log", "message": f"reading local repository..."}
        else:
            yield {"type": "log", "message": "cloning repository..."}
            clone_result = await asyncio.to_thread(
                subprocess.run,
                ["git", "clone", "--depth=1", repo_url, repo_dir],
                capture_output=True,
                text=True,
                timeout=120,
            )
            if clone_result.returncode != 0:
                msg = clone_result.stderr.strip().splitlines()[-1] if clone_result.stderr.strip() else "unknown error"
                yield {"type": "error", "message": f"Clone failed: {msg}"}
                return

        yield {"type": "log", "message": "walking file tree..."}
        files = await asyncio.to_thread(collect_files, repo_dir)

        if not files:
            yield {"type": "error", "message": "No readable source files found in repository."}
            return

        vague_warning = _check_vague(bug_description)
        if vague_warning:
            yield {"type": "warning", "message": vague_warning}

        yield {"type": "log", "message": f"scoring relevance across {len(files)} files..."}
        scored_files = await asyncio.to_thread(score_files, files, bug_description, repo_dir)

        yield {"type": "log", "message": "building prompt..."}
        top_files = sorted(scored_files, key=lambda x: x["score"], reverse=True)[:10]
        prompt, token_estimate = await asyncio.to_thread(
            build_prompt, bug_description, top_files, len(scored_files), repo_url, MAX_TOTAL_CHARS
        )

        selected = [
            {
                "path": f["path"],
                "score": round(f["score"], 3),
                "reason": f["reason"],
            }
            for f in top_files
        ]

        yield {
            "type": "result",
            "selected_files": selected,
            "prompt": prompt,
            "token_estimate": token_estimate,
        }

    except subprocess.TimeoutExpired:
        yield {"type": "error", "message": "Clone timed out — repository may be too large."}
    except Exception as e:
        yield {"type": "error", "message": str(e)}
    finally:
        if tmpdir:
            await asyncio.to_thread(shutil.rmtree, tmpdir, ignore_errors=True)


def collect_files(root: str) -> list[dict]:
    files = []
    root_path = Path(root)

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]

        dir_path = Path(dirpath)
        for filename in filenames:
            name_lower = filename.lower()
            if filename in SKIP_FILES or name_lower in SKIP_NAMES:
                continue

            filepath = dir_path / filename
            suffix = filepath.suffix.lower()

            if suffix in SKIP_EXTENSIONS:
                continue
            if filename.endswith(".min.js") or filename.endswith(".min.css"):
                continue

            try:
                rel = filepath.relative_to(root_path)
            except ValueError:
                continue

            files.append({"path": str(rel), "abs_path": str(filepath)})

    return files


def score_files(files: list[dict], bug_description: str, repo_root: str) -> list[dict]:
    # Read file contents (capped at MAX_FILE_LINES)
    for f in files:
        try:
            with open(f["abs_path"], "r", encoding="utf-8", errors="ignore") as fh:
                lines = fh.readlines()
            f["content"] = "".join(lines[:MAX_FILE_LINES])
        except OSError:
            f["content"] = ""

    # Signal 1: TF-IDF keyword similarity (weight 0.40)
    tfidf_scores = _compute_tfidf(files, bug_description)

    # Signal 2: filename/path heuristic (weight 0.25)
    bug_tokens = _tokenize(bug_description)
    filename_scores = []
    for f in files:
        path_tokens = _tokenize(f["path"])
        filename_scores.append(1.0 if bug_tokens & path_tokens else 0.0)

    # Signal 4: recency bonus (+0.10)
    recent_files = _get_recent_files(repo_root)

    # Combine base scores
    for i, f in enumerate(files):
        recency = 0.10 if f["path"] in recent_files else 0.0
        type_mul = 0.3 if Path(f["path"]).suffix.lower() in LOW_VALUE_EXTENSIONS else 1.0
        f["score"] = ((tfidf_scores[i] * 0.40) + (filename_scores[i] * 0.25) + recency) * type_mul

        reasons = []
        if tfidf_scores[i] > 0.25:
            reasons.append("keyword overlap")
        if filename_scores[i]:
            reasons.append("filename match")
        if recency:
            reasons.append("recently modified")
        if type_mul < 1.0:
            reasons.append("style file penalty")
        f["reason"] = " + ".join(reasons) if reasons else "low relevance"

    # Signal 3: import graph bonus (+0.15) — applied to files imported by top scorers
    sorted_by_score = sorted(files, key=lambda x: x["score"], reverse=True)
    top_count = max(1, len(sorted_by_score) // 5)
    top_scorers = sorted_by_score[:top_count]

    imported_rel_paths: set[str] = set()
    for f in top_scorers:
        imported_rel_paths.update(_extract_imports(f["abs_path"], f["content"], repo_root))

    for f in files:
        if f["path"] in imported_rel_paths:
            f["score"] += 0.15
            if "imported" not in f["reason"]:
                f["reason"] = (f["reason"] + " + imported by high-scorer").lstrip(" + ")

    return files


def _check_vague(bug_description: str) -> str | None:
    text = bug_description.strip()

    if len(text) < 20:
        return (
            "Bug description is very short — relevance scores may be unreliable. "
            "Consider describing what fails, under what conditions, and where in the UI or API."
        )

    words = re.findall(r"[a-z]+", text.lower())
    meaningful = [w for w in words if w not in _STOPWORDS and len(w) > 2]

    if len(set(meaningful)) < 2:
        return (
            "Bug description contains mostly generic terms — relevance scores may be unreliable. "
            "Try including specific function names, error messages, or affected endpoints."
        )

    return None


def _compute_tfidf(files: list[dict], query: str) -> np.ndarray:
    docs = [f["content"] for f in files]
    non_empty = any(d.strip() for d in docs)
    if not non_empty:
        return np.zeros(len(files))

    try:
        vectorizer = TfidfVectorizer(stop_words="english", max_features=20_000)
        matrix = vectorizer.fit_transform(docs + [query])
        sims = cosine_similarity(matrix[-1], matrix[:-1])[0]
        max_sim = sims.max()
        return sims / max_sim if max_sim > 0 else sims
    except Exception:
        return np.zeros(len(files))


def _tokenize(text: str) -> set[str]:
    tokens = set(re.findall(r"[a-z]+", text.lower()))
    return tokens - _STOPWORDS


def _get_recent_files(repo_root: str) -> set[str]:
    try:
        result = subprocess.run(
            ["git", "log", "--since=90 days ago", "--name-only", "--pretty=format:"],
            capture_output=True,
            text=True,
            cwd=repo_root,
            timeout=30,
        )
        paths: set[str] = set()
        for line in result.stdout.splitlines():
            line = line.strip()
            if line:
                # Normalize to forward slashes
                paths.add(line.replace("\\", "/"))
        return paths
    except Exception:
        return set()


def _extract_imports(abs_path: str, content: str, repo_root: str) -> set[str]:
    imports: set[str] = set()
    ext = Path(abs_path).suffix.lower()

    if ext == ".py":
        try:
            tree = ast.parse(content)
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.module:
                    module_path = node.module.replace(".", "/")
                    for candidate in (f"{module_path}.py", f"{module_path}/__init__.py"):
                        full = os.path.join(repo_root, candidate)
                        if os.path.exists(full):
                            try:
                                imports.add(str(Path(full).relative_to(repo_root)))
                            except ValueError:
                                pass
        except SyntaxError:
            pass

    elif ext in {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}:
        pattern = r"""(?:import|require)\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)?\s*(?:from\s+)?['"](\.[^'"]+)['"]"""
        for match in re.findall(pattern, content):
            base_dir = os.path.dirname(abs_path)
            for try_ext in (".js", ".jsx", ".ts", ".tsx", "/index.js", "/index.ts", "/index.jsx", "/index.tsx"):
                candidate = os.path.normpath(os.path.join(base_dir, match + try_ext))
                if os.path.exists(candidate):
                    try:
                        imports.add(str(Path(candidate).relative_to(repo_root)))
                    except ValueError:
                        pass
                    break

    return imports
