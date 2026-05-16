import CardSkeleton from "./CardSkeleton";
import TableSkeleton from "./TableSkeleton";

export default function PageSkeleton() {
  return (
    <div className="skeleton-page" aria-hidden="true">
      <div className="skeleton-grid">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={4} />
      </div>

      <CardSkeleton lines={2} />

      <div className="skeleton-card">
        <TableSkeleton rows={4} columns={6} />
      </div>
    </div>
  );
}
