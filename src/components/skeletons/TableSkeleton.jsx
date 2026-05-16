import { SkeletonTableRows } from "./Skeleton";

export default function TableSkeleton({ rows = 5, columns = 6, widths = [], className = "" }) {
  return (
    <div className={["skeleton-table", className].filter(Boolean).join(" ")}>
      <table>
        <thead>
          <tr>
            {Array.from({ length: Math.max(1, Number(columns) || 1) }).map((_, index) => (
              <th key={index}>
                <div className="skeleton-header-cell" />
              </th>
            ))}
          </tr>
        </thead>
        <SkeletonTableRows rows={rows} columns={columns} widths={widths} />
      </table>
    </div>
  );
}
