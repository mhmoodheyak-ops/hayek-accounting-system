// config.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// رابط مشروع Supabase
const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";

// المفتاح الصحيح (sb_publishable) — لا تغيّر أي حرف
const SUPABASE_ANON_KEY =
  "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";

// إنشاء العميل
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ثابت عام إذا احتجته لاحقًا
export const HAYEK = {
  SUPABASE_URL,
};
