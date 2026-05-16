function joinClassNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function SkeletonBlock({
  className = "",
  style = {},
  width,
  height = 20,
  radius = 16,
  ...props
}) {
  return (
    <div
      aria-hidden="true"
      className={joinClassNames("skeleton", "skeleton-pulse", className)}
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className = "", lineHeight = 20, gap = 12 }) {
  const rowCount = Math.max(1, Number(lines) || 1);

  return (
    <div className={joinClassNames("skeleton-text", className)} style={{ display: "grid", gap }}>
      {Array.from({ length: rowCount }).map((_, index) => {
        const width = index === rowCount - 1 && rowCount > 1 ? "72%" : `${100 - index * 8}%`;
        return <SkeletonBlock key={index} className="skeleton-line" width={width} height={lineHeight} />;
      })}
    </div>
  );
}

export function SkeletonCard({ lines = 4, className = "", style = {} }) {
  return (
    <div className={joinClassNames("skeleton-card", className)} style={style}>
      <SkeletonBlock className="skeleton-line" width="48%" height={24} style={{ marginBottom: 18 }} />
      <SkeletonText lines={lines} lineHeight={18} gap={14} />
    </div>
  );
}

export function SkeletonTableRows({ rows = 5, columns = 6, className = "", widths = [] }) {
  const rowCount = Math.max(1, Number(rows) || 1);
  const columnCount = Math.max(1, Number(columns) || 1);

  return (
    <tbody className={joinClassNames("skeleton-table-body", className)}>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columnCount }).map((__, columnIndex) => {
            const width =
              widths[columnIndex] ||
              (columnIndex === 0 ? "38%" : columnIndex === columnCount - 1 ? "54%" : "72%");

            return (
              <td key={columnIndex}>
                <SkeletonBlock
                  className="skeleton-line"
                  width={width}
                  height={18}
                  radius={999}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}
