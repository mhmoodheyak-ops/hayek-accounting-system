// config.js
// ضع مفاتيحك هنا فقط مرة واحدة

(function () {
  const SUPABASE_URL_RAW = "https://itidwqvyrjydmegjzuvn.supabase.co";   // مثال: https://xxxx.supabase.co
  const SUPABASE_ANON_KEY = "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";      // يبدأ عادة بـ sb_publishable_...

  function normalizeUrl(u) {
    u = String(u || "").trim();
    if (!u) return u;
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    return "https://" + u; // إذا نسيت https
  }

  window.HAYEK = {
    SUPABASE_URL: normalizeUrl(SUPABASE_URL_RAW),
    SUPABASE_ANON_KEY: String(SUPABASE_ANON_KEY || "").trim(),
  };
})();
