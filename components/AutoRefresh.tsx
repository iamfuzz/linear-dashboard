"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { hasPendingEdits } from "./pendingEdits";

/**
 * Re-renders the page from the server every `intervalMs` while the tab is visible.
 * Uses router.refresh(), which keeps client state and reuses the server's ~60s cache.
 * Paused while the tab is hidden; refreshes right away on return if a tick was missed.
 * Skips a tick while an issue edit is in flight (that action refreshes the page itself).
 */
export default function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      last = Date.now();
      router.refresh();
    };
    // Small slack so timer jitter doesn't skip a tick.
    const due = () =>
      document.visibilityState === "visible" &&
      !hasPendingEdits() &&
      Date.now() - last >= intervalMs - 1_000;
    const id = window.setInterval(() => {
      if (due()) tick();
    }, intervalMs);
    const onVisibility = () => {
      if (due()) tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
