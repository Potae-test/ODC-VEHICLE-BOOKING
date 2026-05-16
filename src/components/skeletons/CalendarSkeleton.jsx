import { SkeletonBlock } from "./Skeleton";

const WEEKDAY_LABELS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

export default function CalendarSkeleton() {
  return (
    <div className="skeleton-page skeleton-calendar" aria-hidden="true">
      <div className="skeleton-card skeleton-calendar-card">
        <div className="skeleton-calendar-topbar">
          <SkeletonBlock width="30%" height={30} />
          <div className="skeleton-calendar-controls">
            <SkeletonBlock width={104} height={42} />
            <SkeletonBlock width={104} height={42} />
            <SkeletonBlock width={104} height={42} />
          </div>
        </div>

        <div className="skeleton-calendar-weekdays">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="skeleton-calendar-weekday">
              <SkeletonBlock width="72%" height={16} radius={999} />
            </div>
          ))}
        </div>

        <div className="skeleton-calendar-grid">
          {Array.from({ length: 42 }).map((_, index) => (
            <div className="skeleton-calendar-cell" key={index}>
              <SkeletonBlock width="22%" height={14} radius={999} />
              <SkeletonBlock width="100%" height={12} radius={999} />
              <SkeletonBlock width="84%" height={12} radius={999} />
              <SkeletonBlock width="60%" height={12} radius={999} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
