/* service-worker.js (HAYEK OFFLINE SAFE V11)
   - صفحات navigate: Network-first + fallback
   - نفس الدومين: Cache-first
   - CDN scripts الأساسية: Cache-first (no-cors) حتى تعمل Offline
   - لا يتدخل مع Supabase API (origin مختلف)
*/

const CACHE_NAME = "hayek-cache-v11";
const OFFLINE_FALLBACK = "./index.html";

const PRECACHE = [
  "./",
  "./index.html",
  "./invoice.html",
  "./admin.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// CDN scripts (UMD) — نخزنها للـ Offline
const CDN_CACHE_LIST = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"
];

function isCdnTarget(url) {
  return CDN_CACHE_LIST.includes(url.href);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE);

    // Best effort: خزّن ملفات CDN
    for (const u of CDN_CACHE_LIST) {
      try {
        const req = new Request(u, { mode: "no-cors" });
        const res = await fetch(req);
        await cache.put(req, res);
      } catch (e) {}
    }

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) صفحات التنقل
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(req)) || (await cache.match(OFFLINE_FALLBACK)) || Response.error();
      }
    })());
    return;
  }

  // 2) CDN scripts الأساسية (UMD)
  if (isCdnTarget(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const key = new Request(url.href, { mode: "no-cors" });
      const cached = await cache.match(key);
      if (cached) return cached;

      try {
        const res = await fetch(key);
        await cache.put(key, res.clone());
        return res;
      } catch (e) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // 3) نفس الدومين (ملفاتنا)
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // 4) أي origin خارجي (Supabase API وغيره): لا تدخل
});
