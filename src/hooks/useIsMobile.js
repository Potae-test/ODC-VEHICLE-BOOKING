import { useEffect, useState } from "react";

function getCurrentIsMobile(breakpoint) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.innerWidth <= breakpoint;
}

export default function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => getCurrentIsMobile(breakpoint));

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setIsMobile(window.innerWidth <= breakpoint);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [breakpoint]);

  return isMobile;
}
