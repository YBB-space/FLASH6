const CACHE_NAME = "flash6-shell-v211";
const SHELL_URL = "/flash6.html";
const APP_SHELL = [
  "/",
  "/index.html",
  "/flash6.html",
  "/flash6.js",
  "/flash6.js?v=20260404-005",
  "/manifest.webmanifest",
  "/img/Flash_logo.svg",
  "/img/Flash_logo_plain.svg",
  "/img/hanwool_logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (!res || !res.ok) {
            return caches.match(SHELL_URL);
          }
          const cloned = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, cloned));
          return res;
        })
        .catch(() => caches.match(SHELL_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (!res || res.status !== 200 || res.type !== "basic") return res;
        const cloned = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned));
        return res;
      });
    })
  );
});
