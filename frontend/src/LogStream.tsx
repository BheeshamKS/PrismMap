interface Props {
  logs: string[];
  loading: boolean;
}

export default function LogStream({ logs, loading }: Props) {
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
