// config.js (FINAL - Singleton Hard Lock)
// ==================================================
// Supabase configuration (Front-end)
// يمنع إنشاء أكثر من Client في نفس المتصفح حتى لو تم استيراد الملف أكثر من مرة
// ==================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// 🔐 Project URL (ثابت – نهائي)
export const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";

// 🔐 Publishable Key فقط — ممنوع secret
export const SUPABASE_ANON_KEY =
  "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_"; // ضع المفتاح كاملاً كما هو عندك

// ==================================================
// Singleton (على مستوى المتصفح) — حتى مع تعدد الاستيراد أو اختلاف ?v=
// ==================================================
const GLOBAL_KEY = "__HAYEK_SUPABASE_SINGLETON__";

function assertConfig() {
  if (!SUPABASE_URL || !SUPABASE_URL.includes(".supabase.co")) {
    throw new Error("❌ SUPABASE_URL غير صحيح");
  }
  if (!SUPABASE_ANON_KEY || !SUPABASE_ANON_KEY.startsWith("sb_publishable_")) {
    throw new Error("❌ يجب استخدام publishable key فقط");
  }
}

assertConfig();

const g = globalThis;

if (!g[GLOBAL_KEY]) {
  g[GLOBAL_KEY] = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,

      // ✅ مفتاح تخزين ثابت لتجنب تضارب بين نسخ متعددة
      storageKey: "HAYEK_SPOT_AUTH"
    }
  });
}

// ✅ هذا هو العميل الوحيد الذي يجب استخدامه بكل الصفحات
export const supabase = g[GLOBAL_KEY];
