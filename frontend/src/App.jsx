import { useState, useCallback, useRef, useEffect } from "react";
import Logo from "./Logo";
import UrlForm from "./UrlForm";
import UploadForm from "./UploadForm";
import LogStream from "./LogStream";
import ResultsPanel from "./ResultsPanel";

const _rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:8001";
const API_URL = _rawApiUrl.startsWith("http") ? _rawApiUrl : `https://${_rawApiUrl}`;

const UPLOAD_SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "__pycache__",
  ".venv", "venv", ".next", "coverage", ".pytest_cache",
  "vendor", "target", ".cache", "tmp", "temp", ".tox",
  "eggs", ".eggs", "htmlcov",
  ".parcel-cache", ".turbo", ".nuxt", ".output", ".vercel",
  ".netlify", ".svelte-kit", ".angular", "storybook-static",
  ".yarn", ".pnp",
]);

const UPLOAD_SKIP_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".mp4", ".mp3", ".wav", ".ogg", ".webm",
  ".pdf", ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z",
  ".lock", ".sum", ".bin", ".exe", ".dll", ".so", ".dylib",
  ".pyc", ".pyo", ".class", ".o", ".a",
  ".map", ".mdb", ".db", ".sqlite", ".sqlite3",
]);

const UPLOAD_SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "poetry.lock", "pipfile.lock", "composer.lock",
  "gemfile.lock", "cargo.lock",
]);

const MAX_FILE_BYTES = 100 * 1024;       // 100 KB per file
const MAX_TOTAL_BYTES = 3.5 * 1024 * 1024; // 3.5 MB total

function fileExt(filename) {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}

function shouldUpload(file) {
  const relPath = file.webkitRelativePath || file.name;
  const parts = relPath.split("/");
  const filename = parts[parts.length - 1];

  if (parts.some((seg) => UPLOAD_SKIP_DIRS.has(seg))) return false;
  if (UPLOAD_SKIP_FILES.has(filename.toLowerCase())) return false;
  if (UPLOAD_SKIP_EXTENSIONS.has(fileExt(filename))) return false;
  if (filename.endsWith(".min.js") || filename.endsWith(".min.css")) return false;
  if (file.size > MAX_FILE_BYTES) return false;

  return true;
}

export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [status, setStatus] = useState("idle");
  const [logs, setLogs] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [pickedFiles, setPickedFiles] = useState(null);

  const dirInputRef = useRef(null);

  useEffect(() => {
    if (dirInputRef.current) dirInputRef.current.setAttribute("webkitdirectory", "");
  }, []);

  const handleFolderPick = (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setPickedFiles(files);
    setRepoUrl(files[0].webkitRelativePath.split("/")[0]);
  };

  const handleClearFolder = () => {
    setPickedFiles(null);
    setRepoUrl("");
    if (dirInputRef.current) dirInputRef.current.value = "";
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      setStatus("loading");
      setLogs([]);
      setWarnings([]);
      setResult(null);
      setErrorMsg("");

      let gotResult = false;
      let gotError = false;

      try {
        let response;
        if (pickedFiles) {
          const filesToUpload = Array.from(pickedFiles).filter(shouldUpload);
          const totalBytes = filesToUpload.reduce((sum, f) => sum + f.size, 0);

          if (totalBytes > MAX_TOTAL_BYTES) {
            setErrorMsg(
              `Upload is ${(totalBytes / 1024 / 1024).toFixed(1)} MB after filtering — exceeds the 3.5 MB server limit. ` +
              "Use a GitHub URL instead, or select a smaller folder."
            );
            setStatus("error");
            return;
          }

          if (filesToUpload.length === 0) {
            setErrorMsg("No uploadable source files found in the selected folder.");
            setStatus("error");
            return;
          }

          const formData = new FormData();
          formData.append("bug_description", bugDescription);
          for (const file of filesToUpload) {
            formData.append("files", file, file.webkitRelativePath || file.name);
          }
          response = await fetch(`${API_URL}/analyze-upload`, {
            method: "POST",
            body: formData,
          });
        } else {
          response = await fetch(`${API_URL}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              repo_url: repoUrl,
              bug_description: bugDescription,
            }),
          });
        }

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Server error ${response.status}: ${text}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const dataLine = event
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!dataLine) continue;

            try {
              const data = JSON.parse(dataLine.slice(6));

              if (data.type === "log") {
                setLogs((prev) => [...prev, data.message]);
              } else if (data.type === "warning") {
                setWarnings((prev) => [...prev, data.message]);
              } else if (data.type === "result") {
                gotResult = true;
                setResult(data);
                setStatus("done");
              } else if (data.type === "error") {
                gotError = true;
                setErrorMsg(data.message);
                setStatus("error");
              }
            } catch {
              // Skip malformed event
            }
          }
        }

        if (!gotResult && !gotError) {
          setStatus("error");
          setErrorMsg("Stream ended without a result — check backend logs.");
        }
      } catch (err) {
        setErrorMsg(err.message);
        setStatus("error");
      }
    },
    [pickedFiles, repoUrl, bugDescription],
  );

  const canSubmit =
    (pickedFiles != null || repoUrl.trim()) && bugDescription.trim() && status !== "loading";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <Logo />
          <p className="font-mono text-sm text-zinc-600 text-center">
            context-aware prompt builder
          </p>
        </div>

        {/* Input Panel */}
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex">
            <UrlForm
              repoUrl={repoUrl}
              setRepoUrl={setRepoUrl}
              pickedFiles={pickedFiles}
              setPickedFiles={setPickedFiles}
              dirInputRef={dirInputRef}
              disabled={status === "loading"}
            />
            <UploadForm
              dirInputRef={dirInputRef}
              pickedFiles={pickedFiles}
              onFolderPick={handleFolderPick}
              onClearFolder={handleClearFolder}
              disabled={status === "loading"}
            />
          </div>
          <textarea
            value={bugDescription}
            onChange={(e) => setBugDescription(e.target.value)}
            placeholder="describe the bug or issue..."
            rows={4}
            className="w-full bg-zinc-950 border border-zinc-800 text-white font-mono text-sm px-3 py-2.5 focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700 transition-colors resize-none disabled:opacity-40"
            required
            disabled={status === "loading"}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-white text-black font-mono text-sm py-2.5 font-medium hover:bg-zinc-100 active:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {status === "loading" ? "analyzing..." : "Analyze →"}
          </button>
        </form>

        {/* Log Stream */}
        <LogStream logs={logs} loading={status === "loading"} />

        {/* Vague-input warnings — non-blocking, shown once stream starts */}
        {warnings.map((msg, i) => (
          <div
            key={i}
            className="border border-zinc-700 bg-zinc-950 px-4 py-3 animate-fade-in"
          >
            <p className="font-mono text-xs text-amber-500">
              <span className="select-none">⚠ </span>
              {msg}
            </p>
          </div>
        ))}

        {/* Error */}
        {status === "error" && (
          <div className="border border-zinc-800 bg-zinc-950 px-4 py-3 animate-fade-in">
            <p className="font-mono text-sm text-red-400">error: {errorMsg}</p>
          </div>
        )}

        {/* Results */}
        {status === "done" && result && (
          <ResultsPanel result={result} />
        )}
      </div>
    </div>
  );
}
