/* service-worker.js - HAYEK SPOT offline cache
   - Caches user page assets so it opens without internet.
*/
const CACHE = "hayek-user-v1";

const ASSETS = [
  "./user.html",
  "./user.js",
  "./service-worker.js",
  "./config.js",
  "./auth.js",
  "./jspdf.umd.min.js",
  "./amiri-font.js",
  "./style.css",
  "./"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Network-first for html, cache-first for others
  if (req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match("./user.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(req, copy));
      return res;
    }).catch(() => cached))
  );
});
