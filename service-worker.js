/* service-worker.js (OFFLINE-FIRST V10)
   - يدعم Offline للصفحات + مكتبات CDN الأساسية (html2canvas / jsPDF / supabase esm)
   - لا يتدخل مع أي طلبات أخرى غير ضرورية
*/

const CACHE_NAME = "hayek-cache-v10";

// صفحات + ملفات محلية آمنة
const PRECACHE_LOCAL = [
  "./",
  "./index.html",
  "./invoice.html",
  "./admin.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// مكتبات لازم تكون متاحة Offline
const PRECACHE_CDN = [
  "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
];

function isCdnWeNeed(url) {
  return PRECACHE_CDN.some((x) => url.href === x);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // 1) خزّن المحلي
    await cache.addAll(PRECACHE_LOCAL);

    // 2) خزّن الـ CDN (Best effort) حتى لو opaque
    for (const u of PRECACHE_CDN) {
      try {
        // no-cors لتخزين الـ CDN حتى بدون CORS
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

  // ✅ 1) صفحات التنقل: Network أولاً ثم Cache fallback
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(req)) || (await cache.match("./invoice.html")) || (await cache.match("./index.html"));
      }
    })());
    return;
  }

  // ✅ 2) CDN الضروري: Cache-first (حتى يشتغل Offline)
  if (isCdnWeNeed(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(new Request(url.href, { mode: "no-cors" }));
      if (cached) return cached;
      try {
        const res = await fetch(new Request(url.href, { mode: "no-cors" }));
        await cache.put(new Request(url.href, { mode: "no-cors" }), res.clone());
        return res;
      } catch (e) {
        // آخر حل: ارجع cached لو موجود
        return cached;
      }
    })());
    return;
  }

  // ✅ 3) نفس الدومين للملفات المحلية: Cache-first
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
        return cached;
      }
    })());
    return;
  }

  // ✅ غير ذلك: اتركه طبيعي
});
