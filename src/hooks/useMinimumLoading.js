import { useEffect, useRef, useState } from "react";

export default function useMinimumLoading(loading, minimumMs = 350) {
  const [visibleLoading, setVisibleLoading] = useState(Boolean(loading));
  const startRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (loading) {
      startRef.current = Date.now();
      setVisibleLoading(true);
      return undefined;
    }

    if (!visibleLoading) {
      return undefined;
    }

    const elapsed = Date.now() - (startRef.current || Date.now());
    const remaining = Math.max(0, Number(minimumMs) || 0, 0) - elapsed;

    if (remaining <= 0) {
      setVisibleLoading(false);
      return undefined;
    }

    timerRef.current = window.setTimeout(() => {
      setVisibleLoading(false);
      timerRef.current = null;
    }, remaining);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loading, minimumMs, visibleLoading]);

  return visibleLoading;
}
