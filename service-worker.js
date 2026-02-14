/* service-worker.js (OFFLINE + SAFE + CDN CACHE)
   - Offline للصفحات + ملفات المشروع
   - Cache لمكتبات CDN الضرورية (Supabase + html2canvas + jsPDF)
   - بدون “ترقيع” على ملفاتك الداخلية
*/

const CACHE_NAME = "hayek-cache-v10";
const RUNTIME = "hayek-runtime-v10";

const OFFLINE_FALLBACK = "./index.html";

// صفحات/ملفات محلية نثبتها
const PRECACHE = [
  "./",
  "./index.html",
  "./invoice.html",
  "./admin.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// مسموح نكاشنه من CDN (ضروري للأوفلاين)
const CDN_ALLOW = [
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME && k !== RUNTIME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

function isCDN(url) {
  return CDN_ALLOW.includes(url.hostname);
}

/**
 * CDN: Cache-first (حتى يشتغل Offline)
 */
async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const fresh = await fetch(request);
  cache.put(request, fresh.clone());
  return fresh;
}

/**
 * Pages (navigate): Network-first مع fallback
 */
async function networkFirstNavigate(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    return (await cache.match(request)) || (await cache.match(OFFLINE_FALLBACK));
  }
}

/**
 * Same-origin assets: Stale-while-revalidate خفيف وآمن
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((fresh) => {
      cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // صفحات التنقل
  if (req.mode === "navigate") {
    event.respondWith(networkFirstNavigate(req));
    return;
  }

  // CDN الضروري للأوفلاين
  if (isCDN(url)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // ملفات نفس الموقع
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // غير ذلك: مرّر
  return;
});
