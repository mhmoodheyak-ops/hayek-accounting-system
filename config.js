// config.js
// ✅ HAYEK SPOT — Supabase Config (PRODUCTION)

(function () {
  // مهم جداً: بدون فراغات وبدون / في آخر الرابط
  const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";
  const SUPABASE_ANON_KEY =
    "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";

  // أسماء الجداول عندك (حسب صور Supabase)
  const TABLE_USERS = "app_users";
  const TABLE_INVOICES = "app_invoices";
  const TABLE_OPERATIONS = "app_operations";

  // إعدادات عامة
  const APP_NAME = "HAYEK SPOT";
  const WHATSAPP_NUMBER = "00905510217646";

  // تصدير كـ global
  window.HAYEK_CONFIG = {
    APP_NAME,
    WHATSAPP_NUMBER,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    TABLE_USERS,
    TABLE_INVOICES,
    TABLE_OPERATIONS,
  };
})();
