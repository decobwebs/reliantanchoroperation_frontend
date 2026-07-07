"use client";

import { useEffect, useState } from "react";

/**
 * True below the Tailwind `md` breakpoint (<768px). SSR-safe: returns false on
 * the server / first paint, then syncs on mount to avoid hydration mismatches.
 */
export function useIsMobile(breakpointPx = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [breakpointPx]);

  return isMobile;
}
