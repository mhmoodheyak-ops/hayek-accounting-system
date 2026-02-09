/* service-worker.js */
const CACHE_NAME = "hayekspot-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./auth.js",
  "./config.js",
  "./amiri-font.js",
  "./Amiri-Regular.ttf",
  "./jspdf.umd.min.js",
  "./invoice.html",
  "./admin.html",
  "./admin.js"
];

// install
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// activate
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null))))
      .then(() => self.clients.claim())
  );
});

// fetch (cache-first للواجهة + ملفات ثابتة)
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // فقط نفس الدومين
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        // خزّن الملفات الثابتة
        const isStatic =
          url.pathname.endsWith(".js") ||
          url.pathname.endsWith(".css") ||
          url.pathname.endsWith(".html") ||
          url.pathname.endsWith(".ttf") ||
          url.pathname.endsWith(".json");

        if (isStatic) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(()=>{});
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
