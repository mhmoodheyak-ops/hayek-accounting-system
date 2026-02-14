// auth.js (FINAL - Single Device Lock)
// يعتمد على Supabase Auth الرسمي + يربط الحساب بجدول public.app_users.device_id
// ويمنع تسجيل الدخول من جهاز ثاني لنفس username

import { supabase } from "./config.js";

let _session = null;
let _appUser = null; // بيانات المستخدم من جدول app_users

// ===== Device ID ثابت للجهاز =====
export function getOrCreateDeviceId() {
  const KEY = "HAYEK_DEVICE_ID_V1";
  let v = localStorage.getItem(KEY);
  if (!v) {
    v = (crypto?.randomUUID?.() || ("dev_" + Math.random().toString(16).slice(2) + Date.now()));
    localStorage.setItem(KEY, v);
  }
  return v;
}

// استخراج username من إيميل hayek.local
function usernameFromEmail(email) {
  const s = String(email || "");
  if (!s.includes("@")) return s;
  return s.split("@")[0];
}

// تحميل app_user حسب username
async function loadAppUserByUsername(username) {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, full_name, phone, device_id, is_admin, is_blocked, created_at")
    .eq("username", username)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

// قفل جهاز واحد: أول دخول يثبت device_id، وأي جهاز آخر يُرفض
async function enforceSingleDeviceFor(username) {
  const deviceId = getOrCreateDeviceId();

  const row = await loadAppUserByUsername(username);
  if (!row) {
    // لا نعمل إنشاء تلقائي لتجنب فوضى صلاحيات/بيانات — الأدمن ينشئ المستخدم
    throw new Error("هذا المستخدم غير موجود بقاعدة البيانات. اطلب من الأدمن إضافته.");
  }

  if (row.is_blocked) {
    throw new Error("هذا الحساب محظور. تواصل مع الأدمن.");
  }

  // أول جهاز: ثبت الـ device_id
  if (!row.device_id) {
    const { error: uerr } = await supabase
      .from("app_users")
      .update({ device_id: deviceId })
      .eq("id", row.id);

    if (uerr) throw uerr;

    // أعد تحميل المستخدم بعد التحديث
    const updated = await loadAppUserByUsername(username);
    return updated;
  }

  // جهاز مختلف: رفض
  if (row.device_id !== deviceId) {
    throw new Error("هذا الحساب مسجّل على جهاز آخر. تواصل مع الأدمن لإعادة تعيين الجهاز.");
  }

  // نفس الجهاز: مسموح
  return row;
}

// ===== Session bootstrap =====
async function initSession() {
  try {
    const { data } = await supabase.auth.getSession();
    _session = data?.session || null;

    // إذا في جلسة، حاول حمّل app_users
    if (_session?.user?.email) {
      const username = usernameFromEmail(_session.user.email);
      try {
        _appUser = await loadAppUserByUsername(username);
      } catch {
        _appUser = null;
      }
    } else {
      _appUser = null;
    }
  } catch {
    _session = null;
    _appUser = null;
  }
}
await initSession();

// تحديث الجلسة تلقائياً عند أي تغيير
supabase.auth.onAuthStateChange(async (_event, session) => {
  _session = session || null;

  if (_session?.user?.email) {
    const username = usernameFromEmail(_session.user.email);
    try {
      _appUser = await loadAppUserByUsername(username);
    } catch {
      _appUser = null;
    }
  } else {
    _appUser = null;
  }
});

// ====== API العامة ======
export async function login(username, password) {
  const u = String(username || "").trim().replace(/^mailto:/i, "");
  const email = `${u}@hayek.local`;

  // 1) تسجيل دخول عبر Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.user) {
    throw new Error("فشل تسجيل الدخول: بيانات غير صحيحة");
  }

  // 2) فرض جهاز واحد عبر app_users
  try {
    _appUser = await enforceSingleDeviceFor(u);
  } catch (e) {
    // إذا فشل قفل الجهاز -> سجل خروج فوراً
    await supabase.auth.signOut();
    _session = null;
    _appUser = null;
    throw e;
  }

  return data.user;
}

export async function logout() {
  await supabase.auth.signOut();
  _session = null;
  _appUser = null;
}

export function isAuthed() {
  return !!_session?.user;
}

export function getUser() {
  if (!_session?.user) return null;

  const email = _session.user.email || "";
  const username = usernameFromEmail(email);

  // الدور من جدول app_users (is_admin)
  const isAdmin = !!_appUser?.is_admin;

  return {
    id: _appUser?.id || null,
    username,
    role: isAdmin ? "admin" : "user",
    email,
    full_name: _appUser?.full_name || null,
    phone: _appUser?.phone || null
  };
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

console.log("HAYEK AUTH loaded (Single Device Lock via app_users)");
