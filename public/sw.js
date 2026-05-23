// FleetGuard service worker — minimal install/activate so the app is PWA-installable.
// No aggressive caching to avoid serving stale realtime UI.

const VERSION = "fleetguard-sw-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", () => {
  // Pass-through. Network-first behavior — we don't intercept.
});
