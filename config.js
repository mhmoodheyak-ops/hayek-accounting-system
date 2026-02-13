// config.js
// ==================================================
// Supabase FINAL configuration
// يُستخدم في كامل المشروع (Front-end)
// ==================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// 🔐 Project URL (ثابت – نهائي)
export const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";

// 🔐 Publishable (Anon) Key فقط — ممنوع secret
export const SUPABASE_ANON_KEY =
  "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_"; // ضع المفتاح كاملاً كما هو عندك

// ==================================================
// إنشاء عميل Supabase واحد فقط (Singleton)
// ==================================================
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);

// ==================================================
// فحص أمان (اختياري – أثناء التطوير فقط)
// ==================================================
(function checkConfig() {
  if (!SUPABASE_URL || !SUPABASE_URL.includes(".supabase.co")) {
    throw new Error("❌ SUPABASE_URL غير صحيح");
  }
  if (
    !SUPABASE_ANON_KEY ||
    !SUPABASE_ANON_KEY.startsWith("sb_publishable_")
  ) {
    throw new Error("❌ يجب استخدام publishable key فقط");
  }
})();
