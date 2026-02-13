// auth.js (FINAL bridge)
// يعتمد على Supabase Auth الرسمي + يوفّر window.HAYEK_AUTH للصفحات الحالية

import { supabase } from "./config.js";

let _session = null;

// تحميل الجلسة مرة واحدة عند بدء الصفحة (Module)
async function initSession() {
  try {
    const { data } = await supabase.auth.getSession();
    _session = data?.session || null;
  } catch {
    _session = null;
  }
}
await initSession();

// تحديث الجلسة تلقائياً عند أي تغيير
supabase.auth.onAuthStateChange((_event, session) => {
  _session = session || null;
});

// استخراج username من إيميل hayek.local
function usernameFromEmail(email) {
  const s = String(email || "");
  if (!s.includes("@")) return s;
  return s.split("@")[0];
}

// (مؤقت وعملي) تحديد الأدمن: إذا username = admin
function roleFromUsername(u) {
  return String(u || "").toLowerCase() === "admin" ? "admin" : "user";
}

export async function login(username, password) {
  const u = String(username || "").trim().replace(/^mailto:/i, "");
  const email = `${u}@hayek.local`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data?.user) {
    // نخلي الرسالة واضحة للمستخدم
    throw new Error("فشل تسجيل الدخول: بيانات غير صحيحة");
  }

  return data.user;
}

export async function logout() {
  await supabase.auth.signOut();
}

export function isAuthed() {
  return !!_session?.user;
}

export function getUser() {
  if (!_session?.user) return null;

  const email = _session.user.email || "";
  const username = usernameFromEmail(email);

  return {
    username,
    role: roleFromUsername(username),
    email
  };
}

// Device ID ثابت (لربط الجهاز لاحقاً)
export function getOrCreateDeviceId() {
  const KEY = "HAYEK_DEVICE_ID_V1";
  let v = localStorage.getItem(KEY);
  if (!v) {
    v = (crypto?.randomUUID?.() || ("dev_" + Math.random().toString(16).slice(2) + Date.now()));
    localStorage.setItem(KEY, v);
  }
  return v;
}

// ======= توافق مع الصفحات القديمة (invoice/admin) =======
window.__HAYEK_AUTH_LOADED__ = true;

window.HAYEK_AUTH = {
  login,
  logout,
  isAuthed,
  getUser,
  getOrCreateDeviceId
};

console.log("HAYEK AUTH loaded (Supabase bridge)");
