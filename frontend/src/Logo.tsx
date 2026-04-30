const LOGO_ROWS: { prism: string; map: string }[] = [
  { prism: "████  ██ █ ████ ███ ██ ", map: "███ ██  ████ ████" },
  { prism: "█  █ █     █    █  █  █", map: "█  █  █    █ █  █" },
  { prism: "█  █ █   █ ████ █  █  █", map: "█  █  █ ████ █  █" },
  { prism: "█  █ █   █    █ █  █  █", map: "█  █  █ █  █ █  █" },
  { prism: "████ █   █ ████ █  █  █", map: "█  █  █ ████ ████" },
  { prism: "█                      ", map: "             █   " },
];

const PX = 22;

export default function Logo() {
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
