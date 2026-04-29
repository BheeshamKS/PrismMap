import { useState, useCallback, useRef, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

// Each '█' in the string maps to one square pixel block.
// Spaces are transparent gaps of the same size — no font, no line-height.
const LOGO_ROWS = [
  { prism: "████  ██ █ ████ ███ ██ ", map: "███ ██  ████ ████" },
  { prism: "█  █ █     █    █  █  █", map: "█  █  █    █ █  █" },
  { prism: "█  █ █   █ ████ █  █  █", map: "█  █  █ ████ █  █" },
  { prism: "█  █ █   █    █ █  █  █", map: "█  █  █ █  █ █  █" },
  { prism: "████ █   █ ████ █  █  █", map: "█  █  █ ████ ████" },
  { prism: "█                      ", map: "             █   " },
];

const PX = 14; // each pixel block is PX×PX — perfectly square, zero gap

function Logo() {
  return (
    <h1
      aria-label="prism map"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
        margin: 0,
      }}
    >
      {LOGO_ROWS.map(({ prism, map }, rowIdx) => (
        <div key={rowIdx} style={{ display: "flex", height: PX }}>
          {[...prism].map((ch, i) => (
            <span
              key={`p${i}`}
              style={{
                width: PX,
                height: PX,
                flexShrink: 0,
                backgroundColor: ch === "█" ? "#505050" : "transparent",
              }}
            />
          ))}
          {/* word gap — 2 empty pixels */}
          <span style={{ width: PX * 2, height: PX, flexShrink: 0 }} />
          {[...map].map((ch, i) => (
            <span
              key={`m${i}`}
              style={{
                width: PX,
                height: PX,
                flexShrink: 0,
                backgroundColor: ch === "█" ? "#efefef" : "transparent",
              }}
            />
          ))}
        </div>
      ))}
    </h1>
  );
}

function LogPanel({ logs, loading }) {
  if (!loading && logs.length === 0) return null;

  return (
    <div className="border border-zinc-800 bg-zinc-950 px-4 py-3 space-y-1.5">
      {logs.map((msg, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 font-mono text-sm animate-fade-in"
        >
          <span className="text-zinc-600 select-none">→</span>
          <span className="text-zinc-300">{msg}</span>
        </div>
      ))}
      {loading && (
        <div className="font-mono text-sm text-zinc-600 pl-0.5">
          <span className="animate-blink">█</span>
        </div>
      )}
    </div>
  );
}

function ScoreTable({ files }) {
  const [threshold, setThreshold] = useState(0);
  const visible = files.filter((f) => f.score >= threshold);

  return (
    <div className="border border-zinc-800">
      {/* Threshold slider */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800">
        <span className="font-mono text-xs text-zinc-600 shrink-0">
          min score
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          className="flex-1 h-px appearance-none bg-zinc-700 cursor-pointer"
          style={{ accentColor: "#888" }}
        />
        <span className="font-mono text-xs text-zinc-400 tabular-nums w-10 text-right shrink-0">
          {threshold.toFixed(2)}
        </span>
        <span className="font-mono text-xs text-zinc-600 shrink-0">
          {visible.length}/{files.length}
        </span>
      </div>

      <div className="grid grid-cols-12 font-mono text-xs text-zinc-600 px-3 py-2 border-b border-zinc-800 uppercase tracking-widest">
        <div className="col-span-5">file</div>
        <div className="col-span-2 text-right">score</div>
        <div className="col-span-5 pl-3">reason</div>
      </div>
      {visible.length === 0 ? (
        <div className="px-3 py-3 font-mono text-xs text-zinc-600">
          no files above threshold
        </div>
      ) : (
        visible.map((file, i) => (
          <div
            key={file.path}
            className={`grid grid-cols-12 font-mono text-xs px-3 py-2 ${
              i % 2 === 0 ? "bg-black" : "bg-zinc-950"
            }`}
          >
            <div className="col-span-5 text-zinc-200 truncate pr-2" title={file.path}>
              {file.path}
            </div>
            <div className="col-span-2 text-right tabular-nums text-zinc-400">
              {file.score.toFixed(2)}
            </div>
            <div className="col-span-5 pl-3 text-zinc-500 truncate" title={file.reason}>
              {file.reason}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PromptBlock({ prompt, tokenEstimate }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenClaude = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      window.open("https://claude.ai/new", "_blank", "noopener,noreferrer");
    });
  };

  return (
    <div className="border border-zinc-800">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-zinc-500">prompt.txt</span>
          <span className="font-mono text-xs text-zinc-700 border border-zinc-800 px-1.5 py-0.5">
            ~{tokenEstimate.toLocaleString()} tokens
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenClaude}
            className="font-mono text-xs border border-zinc-800 px-2.5 py-1 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
          >
            Open in Claude ↗
          </button>
          <button
            onClick={handleCopy}
            className="font-mono text-xs border border-zinc-800 px-2.5 py-1 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
          >
            {copied ? "✓ copied" : "Copy Prompt"}
          </button>
        </div>
      </div>
      <div className="p-4 max-h-96 overflow-y-auto">
        <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
          {prompt}
        </pre>
      </div>
    </div>
  );
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
          const formData = new FormData();
          formData.append("bug_description", bugDescription);
          for (const file of pickedFiles) {
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
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => {
                if (pickedFiles) {
                  setPickedFiles(null);
                  if (dirInputRef.current) dirInputRef.current.value = "";
                }
                setRepoUrl(e.target.value);
              }}
              placeholder="https://github.com/user/repo  —  or select a local folder →"
              className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 text-white font-mono text-sm px-3 py-2.5 focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700 transition-colors disabled:opacity-40"
              required={!pickedFiles}
              disabled={status === "loading"}
              readOnly={!!pickedFiles}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <button
              type="button"
              onClick={pickedFiles ? handleClearFolder : () => dirInputRef.current?.click()}
              disabled={status === "loading"}
              className="border border-l-0 border-zinc-800 px-3 text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors disabled:opacity-40 shrink-0"
              title={pickedFiles ? "Clear selection" : "Open local folder"}
            >
              {pickedFiles ? (
                <span className="font-mono text-sm leading-none">×</span>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              )}
            </button>
            <input
              ref={dirInputRef}
              type="file"
              className="hidden"
              onChange={handleFolderPick}
              multiple
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
        <LogPanel logs={logs} loading={status === "loading"} />

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
          <div className="space-y-3 animate-fade-in">
            <ScoreTable files={result.selected_files} />
            <PromptBlock
              prompt={result.prompt}
              tokenEstimate={result.token_estimate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
