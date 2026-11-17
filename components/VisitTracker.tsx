"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Tells /api/track about each page shown on the public site, for the
 * visitor statistics in /admin/statistics. No cookies or storage are
 * used: the first page of a visit is recognised by the visitor arriving
 * from another website (or none), not by remembering them.
 */
export default function VisitTracker() {
  const pathname = usePathname();
  const firstPage = useRef(true);

  useEffect(() => {
    // Skip automated browsers (test tools, screenshot scripts).
    if (navigator.webdriver) return;

    let entry = false;
    if (firstPage.current) {
      firstPage.current = false;
      try {
        entry = !document.referrer || new URL(document.referrer).host !== location.host;
      } catch {
        entry = true;
      }
    }

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
