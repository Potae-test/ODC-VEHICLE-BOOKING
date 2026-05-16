import { SkeletonCard } from "./Skeleton";

export default function CardSkeleton({ lines = 4, className = "", style = {} }) {
  return <SkeletonCard lines={lines} className={className} style={style} />;
}
