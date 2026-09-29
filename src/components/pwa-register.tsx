"use client";

import { useEffect } from "react";

/** Register service worker untuk installability PWA workshop. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Hanya register di path admin (scope manifest)
    if (!window.location.pathname.startsWith("/admin")) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore — insecure origin / blocked */
    });
  }, []);
  return null;
}
