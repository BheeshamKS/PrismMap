import { useState } from "react";
import { AnalysisResult, SelectedFile } from "./types";

function ScoreTable({ files }: { files: SelectedFile[] }) {
  const [threshold, setThreshold] = useState(0);
  const visible = files.filter((f) => f.score >= threshold);

  return (
    <div className="border border-zinc-800">
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

function PromptBlock({ prompt, tokenEstimate }: { prompt: string; tokenEstimate: number }) {
  const [copied, setCopied] = useState(false);
  const [claudeOpened, setClaudeOpened] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenClaude = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setClaudeOpened(true);
      setTimeout(() => {
        window.open("https://claude.ai/new", "_blank", "noopener,noreferrer");
        setTimeout(() => setClaudeOpened(false), 6000);
      }, 1000);
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
            {claudeOpened ? "✓ now paste with Ctrl+V" : "Open in Claude ↗"}
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

export default function ResultsPanel({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-3 animate-fade-in">
      <ScoreTable files={result.selected_files} />
      <PromptBlock
        prompt={result.prompt}
        tokenEstimate={result.token_estimate}
      />
    </div>
  );
}
