// Offline cache for the app shell.
const VERSION = "kc-v24";
const SHELL = [
  "./", "index.html", "app.css", "app.js", "journal.js", "trends.js", "recipes.js", "share.js", "profile.js", "main.js", "feedback.js", "config.js", "foods.js", "manifest.webmanifest",
  "datenschutz.html", "impressum.html",
  "ideen/skyr-bowl.jpg", "ideen/haehnchen-reis-bowl.jpg", "ideen/apfel-mandeln.jpg", "ideen/ofenkartoffeln.jpg",
  "ideen/protein-doener.jpg", "ideen/tag-1600.jpg",
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
  // no-cache: always ask the server whether the file changed, so a stale browser cache can never mix versions
  e.respondWith(fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" })
    .then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
