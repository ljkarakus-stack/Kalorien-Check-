// Offline cache for the app shell.
const VERSION = "kc-v3";
const SHELL = [
  "./", "index.html", "app.css", "app.js", "foods.js", "manifest.webmanifest",
  "fonts/Baloo2.ttf", "fonts/CaveatBrush.ttf", "vendor/zxing-browser.min.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Product lookups always go to the network
  if (url.origin !== location.origin || e.request.method !== "GET") return;
  // Network first so updates show up right away; the cache is only the offline fallback
  e.respondWith(fetch(e.request)
    .then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
