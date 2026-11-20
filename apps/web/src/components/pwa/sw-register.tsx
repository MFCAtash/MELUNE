"use client";

import { useEffect } from "react";

/**
 * Registers sw.js (see public/sw.js). Production-only and best-effort:
 * a failed registration (unsupported browser, blocked by an extension,
 * whatever) just means no offline fallback — never something to
 * surface to the user or retry aggressively.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return null;
}
