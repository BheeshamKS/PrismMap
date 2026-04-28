import re

_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "in", "of", "to",
    "for", "and", "or", "if", "pls", "please", "let", "me", "know",
    "find", "any",
}


def build_prompt(
    bug_description: str,
    top_files: list[dict],
    total_file_count: int,
    repo_url: str,
    max_chars: int,
) -> tuple[str, int]:
    file_sections = []
    total_chars = 0

    for f in top_files:
        content = f.get("content", "[could not read file]")
        header = f"\n### {f['path']} (relevance: {f['score']:.2f})\n"
        section = f"{header}```\n{content}\n```\n"

        if total_chars + len(section) > max_chars:
            remaining = max_chars - total_chars - len(header) - 20
            if remaining > 100:
                section = f"{header}```\n{content[:remaining]}\n... [truncated]\n```\n"
                file_sections.append(section)
            break

        file_sections.append(section)
        total_chars += len(section)

    files_str = "".join(file_sections)
    shown = len(file_sections)

    bug_tokens = set(re.findall(r"[a-z]+", bug_description.lower())) - _STOPWORDS
    is_audit = len(bug_tokens) < 4

    if is_audit:
        closing = (
            "Review these files for bugs, security issues, edge cases, "
            "and code quality problems. List each issue with the file, "
            "line number, severity (low/medium/high), and a concrete fix."
        )
    else:
        closing = (
            "Identify the root cause, cite the specific file and line number, "
            "and provide a concrete code fix."
        )

    prompt = (
        "You are a senior engineer helping debug the following issue.\n\n"
        f"Repository: {repo_url}\n"
        f"Bug: {bug_description}\n\n"
        f"Below are the {shown} most relevant files (of {total_file_count} total), "
        "ranked by relevance score:\n"
        f"{files_str}\n"
        f"{closing}"
    )

    token_estimate = len(prompt) // 4
    return prompt, token_estimate
