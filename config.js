// config.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// 1) ضع رابط مشروعك
const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";

// 2) ضع المفتاح كاملاً (sb_publishable...) كما هو من Supabase
const SUPABASE_ANON_KEY = "PASTE_YOUR_SB_PUBLISHABLE_KEY_HERE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const HAYEK = { SUPABASE_URL };
