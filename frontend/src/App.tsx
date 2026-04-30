import { useState, useCallback, useRef, useEffect } from "react";
import Logo from "./Logo";
import UrlForm from "./UrlForm";
import UploadForm from "./UploadForm";
import LogStream from "./LogStream";
import ResultsPanel from "./ResultsPanel";
import { AnalysisResult, SseEvent } from "./types";

const _rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:8001";
const API_URL = _rawApiUrl.startsWith("http")
  ? _rawApiUrl
  : `https://${_rawApiUrl}`;

const UPLOAD_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "__pycache__",
  ".venv",
  "venv",
  ".next",
  "coverage",
  ".pytest_cache",
  "vendor",
  "target",
  ".cache",
  "tmp",
  "temp",
  ".tox",
  "eggs",
  ".eggs",
  "htmlcov",
  ".parcel-cache",
  ".turbo",
  ".nuxt",
  ".output",
  ".vercel",
  ".netlify",
  ".svelte-kit",
  ".angular",
  "storybook-static",
  ".yarn",
  ".pnp",
]);

const UPLOAD_SKIP_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".mp4",
  ".mp3",
  ".wav",
  ".ogg",
  ".webm",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".7z",
  ".lock",
  ".sum",
  ".bin",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".pyc",
  ".pyo",
  ".class",
  ".o",
  ".a",
  ".map",
  ".mdb",
  ".db",
  ".sqlite",
  ".sqlite3",
]);

const UPLOAD_SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "poetry.lock",
  "pipfile.lock",
  "composer.lock",
  "gemfile.lock",
  "cargo.lock",
]);

const MAX_FILE_BYTES = 100 * 1024;
const MAX_TOTAL_BYTES = 3.5 * 1024 * 1024;

function fileExt(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}

function shouldUpload(file: File): boolean {
  const relPath = file.webkitRelativePath || file.name;
  const parts = relPath.split("/");
  const filename = parts[parts.length - 1];

  if (parts.some((seg) => UPLOAD_SKIP_DIRS.has(seg))) return false;
  if (UPLOAD_SKIP_FILES.has(filename.toLowerCase())) return false;
  if (UPLOAD_SKIP_EXTENSIONS.has(fileExt(filename))) return false;
  if (filename.endsWith(".min.js") || filename.endsWith(".min.css"))
    return false;
  if (file.size > MAX_FILE_BYTES) return false;

  return true;
}

const EXAMPLE_PROMPTS = [
  "login button does nothing on mobile safari",
  "uploaded images appear rotated 90° on android devices",
  "search results flicker and reset scroll position on filter change",
  "dark mode toggle resets to light after page refresh",
  "api is not calling to the backend find the located",
];

type Status = "idle" | "loading" | "done" | "error";

export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [pickedFiles, setPickedFiles] = useState<FileList | null>(null);

  const dirInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dirInputRef.current)
      dirInputRef.current.setAttribute("webkitdirectory", "");
  }, []);

  const handleFolderPick = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      setStatus("loading");
      setLogs([]);
      setWarnings([]);
      setResult(null);
      setErrorMsg("");

      let gotResult = false;
      let gotError = false;

      try {
        let response: Response;
        if (pickedFiles) {
          const filesToUpload = Array.from(pickedFiles).filter(shouldUpload);
          const totalBytes = filesToUpload.reduce((sum, f) => sum + f.size, 0);

          if (totalBytes > MAX_TOTAL_BYTES) {
            setErrorMsg(
              `Upload is ${(totalBytes / 1024 / 1024).toFixed(1)} MB after filtering — exceeds the 3.5 MB server limit. ` +
                "Use a GitHub URL instead, or select a smaller folder.",
            );
            setStatus("error");
            return;
          }

          if (filesToUpload.length === 0) {
            setErrorMsg(
              "No uploadable source files found in the selected folder.",
            );
            setStatus("error");
            return;
          }

          const formData = new FormData();
          formData.append("bug_description", bugDescription);
          for (const file of filesToUpload) {
            formData.append(
              "files",
              file,
              file.webkitRelativePath || file.name,
            );
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

        if (!response.body) throw new Error("No response body");

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
              const data = JSON.parse(dataLine.slice(6)) as SseEvent;

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
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    [pickedFiles, repoUrl, bugDescription],
  );

  const canSubmit =
    (pickedFiles != null || repoUrl.trim()) &&
    bugDescription.trim() &&
    status !== "loading";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-10 py-16 space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <Logo />
          <p className="font-mono text-base text-zinc-600 text-center">
            paste the right files, not all of them
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
            rows={8}
            className="w-full bg-zinc-950 border border-zinc-800 text-white font-mono text-base px-4 py-3 focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700 transition-colors resize-none disabled:opacity-40"
            required
            disabled={status === "loading"}
          />
          {status === "idle" && (
            <div className="space-y-1.5">
              <p className="font-mono text-sm text-zinc-700">
                try an example →
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setBugDescription(prompt)}
                    className="font-mono text-sm border border-zinc-800 px-3 py-1.5 text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-white text-black font-mono text-base py-3 font-medium hover:bg-zinc-100 active:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
        {status === "done" && result && <ResultsPanel result={result} />}
      </div>
    </div>
  );
}
