import "../styles/main.css";

function normalizeColumns(columns) {
  if (typeof columns === "number") {
    return {
      base: columns,
      md: columns,
      lg: columns,
    };
  }

  return {
    base: columns?.base ?? 1,
    md: columns?.md ?? columns?.base ?? 1,
    lg: columns?.lg ?? columns?.md ?? columns?.base ?? 1,
  };
}

function resolveGap(gap) {
  if (gap === "none") return "0";
  if (gap === "xs") return "6px";
  if (gap === "md") return "12px";
  if (gap === "lg") return "14px";
  return "10px";
}

export default function MobileGrid({ children, columns = 1, gap = "sm", className = "" }) {
  const normalizedColumns = normalizeColumns(columns);

  return (
    <div
      className={`mobile-grid ${className}`.trim()}
      style={{
        "--mobile-grid-columns": normalizedColumns.base,
        "--mobile-grid-columns-md": normalizedColumns.md,
        "--mobile-grid-columns-lg": normalizedColumns.lg,
        "--mobile-grid-gap": resolveGap(gap),
      }}
    >
      {children}
    </div>
  );
}
