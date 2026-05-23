import { useEffect, useRef, useState } from "react";

export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.location.hostname === "localhost") return; // skip on dev
    navigator.serviceWorker.register("/sw.js").catch(() => { /* ignore */ });
  }, []);
}

export function useWakeLock(active: boolean) {
  const lockRef = useRef<any>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav: any = navigator;
    if (!nav.wakeLock) return;

    let cancelled = false;

    async function acquire() {
      try {
        const lock = await nav.wakeLock.request("screen");
        if (cancelled) { lock.release(); return; }
        lockRef.current = lock;
        setHeld(true);
        lock.addEventListener("release", () => setHeld(false));
      } catch {
        setHeld(false);
      }
    }

    async function release() {
      try {
        await lockRef.current?.release();
      } catch { /* ignore */ }
      lockRef.current = null;
      setHeld(false);
    }

    if (active) {
      acquire();
      const onVis = () => { if (document.visibilityState === "visible" && active) acquire(); };
      document.addEventListener("visibilitychange", onVis);
      return () => {
        cancelled = true;
        document.removeEventListener("visibilitychange", onVis);
        release();
      };
    } else {
      release();
    }
  }, [active]);

  return held;
}
