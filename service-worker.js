/* service-worker.js (FINAL SAFE)
   - لا يلمس ملفات JS/CSS/Modules أبداً (Network only)
   - يحافظ على Offline لصفحات التنقل فقط (navigate)
*/

const CACHE_NAME = "hayek-cache-v9";
const OFFLINE_FALLBACK = "./index.html";

// ملفات نسمح بتخزينها (خفيف وآمن)
const PRECACHE = [
  "./",
  "./index.html",
  "./invoice.html",
  "./admin.html",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
      await self.clients.claim();
    })()
  );
});

// ✅ أهم نقطة: أي شيء مو "navigate" => fetch مباشر (خصوصاً JS)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // لا تتدخل مع supabase/cdn أو أي origin خارجي
  if (url.origin !== self.location.origin) return;

  // ✅ لا تتدخل مع: js/css/json/svg/ttf… إلخ (خاصة admin.js)
  if (req.mode !== "navigate") {
    event.respondWith(fetch(req));
    return;
  }

  // ✅ للصفحات فقط: جرّب network، وإذا فشل رجّع fallback من الكاش
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(req)) || (await cache.match(OFFLINE_FALLBACK));
      }
    })()
  );
});
