const CACHE = "jetwise-shell-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(["/manifest.webmanifest"]).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("jetwise-shell-") && k !== CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Document navigations must not be fulfilled by the SW with redirect responses —
  // middleware redirects (e.g. / → /login) trigger Safari error:
  // "Response served by service worker has redirections".
  if (req.mode === "navigate") {
    return;
  }

  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
