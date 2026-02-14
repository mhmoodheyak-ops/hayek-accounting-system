// auth.js (FINAL - Device Lock enforced ALWAYS + Single Tab)
// - يثبت device_id في public.app_users تلقائياً عند وجود Session
// - يمنع تسجيل الدخول من جهاز ثاني
// - يمنع فتح الحساب في تبويبين (بدون logout للتبويب الثاني)

import { supabase } from "./config.js";

let _session = null;
let _appUser = null;

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

// ===== Tab ID ثابت للتبويب (sessionStorage) =====
function getOrCreateTabId() {
  const KEY = "HAYEK_TAB_ID_V1";
  let v = sessionStorage.getItem(KEY);
  if (!v) {
    v = (crypto?.randomUUID?.() || ("tab_" + Math.random().toString(16).slice(2) + Date.now()));
    sessionStorage.setItem(KEY, v);
  }
  return v;
}

// استخراج username من إيميل hayek.local
function usernameFromEmail(email) {
  const s = String(email || "");
  if (!s.includes("@")) return s;
  return s.split("@")[0];
}

// ===== تحميل app_user حسب username =====
async function loadAppUserByUsername(username) {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, full_name, phone, device_id, is_admin, is_blocked, created_at")
    .eq("username", username)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

// ===== قفل جهاز واحد (حل جذري) =====
// ملاحظة: نثبت device_id عن طريق username مباشرة (أوضح وأضمن)
async function enforceDeviceLock(username) {
  const deviceId = getOrCreateDeviceId();

  // 1) اقرأ صف المستخدم
  let row = await loadAppUserByUsername(username);
  if (!row) throw new Error("هذا المستخدم غير موجود بقاعدة البيانات. اطلب من الأدمن إضافته.");
  if (row.is_blocked) throw new Error("هذا الحساب محظور. تواصل مع الأدمن.");

  // 2) إذا أول مرة (device_id = NULL) ثبّته
  if (!row.device_id) {
    // نحاول تحديث فقط إذا ما زال NULL حتى لا يصير سباق بين جهازين
    const { error: uerr } = await supabase
      .from("app_users")
      .update({ device_id: deviceId })
      .eq("username", username)
      .is("device_id", null);

    if (uerr) throw uerr;

    // أعد القراءة: إذا جهاز آخر سبقك وثبّت device_id رح يظهر الآن
    row = await loadAppUserByUsername(username);
    if (!row?.device_id) {
      // لو بقي NULL فهذا يعني التحديث لم ينجح فعلياً
      throw new Error("تعذر تثبيت device_id على قاعدة البيانات (تحقق من صلاحيات الجدول app_users).");
    }
  }

  // 3) إذا صار في قاعدة البيانات device_id مختلف -> امنع هذا الجهاز
  if (row.device_id !== deviceId) {
    throw new Error("هذا الحساب مسجّل على جهاز آخر. تواصل مع الأدمن لإعادة تعيين الجهاز.");
  }

  return row;
}

// ===================================================================
// ===== قفل تبويب واحد (Single Tab) بدون logout للتبويب الثاني =====
// ===================================================================
let _tabBlocked = false;
let _tabOwner = false;
let _tabTimer = null;
let _tabBC = null;
let _tabUsername = null;

function lockKeyFor(username) {
  return `HAYEK_ACTIVE_TAB_LOCK::${username}`;
}
function nowMs() { return Date.now(); }

function readLock(username) {
  try {
    const raw = localStorage.getItem(lockKeyFor(username));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return obj;
  } catch {
    return null;
  }
}
function writeLock(username, objOrNull) {
  try {
    if (!objOrNull) localStorage.removeItem(lockKeyFor(username));
    else localStorage.setItem(lockKeyFor(username), JSON.stringify(objOrNull));
  } catch {}
}

function startSingleTabGuard(username) {
  stopSingleTabGuard();
  _tabUsername = username;

  const tabId = getOrCreateTabId();
  const TTL = 12000;
  const HEARTBEAT = 4000;

  const bcName = `HAYEK_TAB_BC::${username}`;
  try {
    _tabBC = new BroadcastChannel(bcName);
    _tabBC.onmessage = (ev) => {
      const msg = ev?.data || {};
      if (msg?.type === "LOCK_RELEASED") tryAcquire();
    };
  } catch {
    _tabBC = null;
  }

  function isStale(lock) {
    if (!lock?.ts) return true;
    return (nowMs() - Number(lock.ts)) > TTL;
  }

  function tryAcquire() {
    const lock = readLock(username);

    if (!lock || isStale(lock) || lock.tabId === tabId) {
      writeLock(username, { tabId, ts: nowMs() });
      _tabOwner = true;
      _tabBlocked = false;
      return true;
    }

    _tabOwner = false;
    _tabBlocked = true;

    if (!sessionStorage.getItem(`HAYEK_TAB_BLOCKED_SHOWN::${username}`)) {
      sessionStorage.setItem(`HAYEK_TAB_BLOCKED_SHOWN::${username}`, "1");
      alert("❌ هذا الحساب مفتوح بالفعل في تبويب آخر. أغلق التبويب الآخر للمتابعة.");
    }
    return false;
  }

  tryAcquire();

  _tabTimer = setInterval(() => {
    if (!_tabUsername) return;

    const lock = readLock(username);
    const tabIdNow = getOrCreateTabId();

    if (_tabOwner && lock && lock.tabId === tabIdNow) {
      writeLock(username, { tabId: tabIdNow, ts: nowMs() });
      return;
    }

    if (!_tabOwner) tryAcquire();
  }, HEARTBEAT);

  window.addEventListener("beforeunload", () => {
    try {
      const tabIdNow = getOrCreateTabId();
      const lock = readLock(username);
      if (lock && lock.tabId === tabIdNow) {
        writeLock(username, null);
        try { _tabBC?.postMessage({ type: "LOCK_RELEASED" }); } catch {}
      }
    } catch {}
  });
}

function stopSingleTabGuard() {
  if (_tabTimer) clearInterval(_tabTimer);
  _tabTimer = null;

  try { _tabBC?.close?.(); } catch {}
  _tabBC = null;

  _tabBlocked = false;
  _tabOwner = false;
  _tabUsername = null;
}

// ============================================================
// ===== فرض القفل تلقائياً عند وجود Session (جذري) =====
// ============================================================
async function enforceAllGuardsFromSession() {
  if (!_session?.user?.email) {
    _appUser = null;
    stopSingleTabGuard();
    return;
  }

  const username = usernameFromEmail(_session.user.email);

  // 1) Device lock
  try {
    _appUser = await enforceDeviceLock(username);
  } catch (e) {
    // هنا لازم نطلع هذا الجهاز فقط (signOut لهذا الجهاز طبيعي)
    try { await supabase.auth.signOut(); } catch {}
    _session = null;
    _appUser = null;
    stopSingleTabGuard();
    alert(e?.message || "تم منع الدخول");
    return;
  }

  // 2) Single tab guard
  startSingleTabGuard(username);
}

async function initSession() {
  try {
    const { data } = await supabase.auth.getSession();
    _session = data?.session || null;
    await enforceAllGuardsFromSession();
  } catch {
    _session = null;
    _appUser = null;
    stopSingleTabGuard();
  }
}
await initSession();

supabase.auth.onAuthStateChange(async (_event, session) => {
  _session = session || null;
  await enforceAllGuardsFromSession();
});

// ====== API العامة ======
export async function login(username, password) {
  const u = String(username || "").trim().replace(/^mailto:/i, "");
  const email = `${u}@hayek.local`;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user) throw new Error("فشل تسجيل الدخول: بيانات غير صحيحة");

  // بعد login، فرض القفل مباشرة
  await initSession();

  // لو صار التبويب محجوب، امنع استخدامه (بدون logout)
  if (_tabBlocked) throw new Error("هذا الحساب مفتوح في تبويب آخر.");

  return data.user;
}

export async function logout() {
  stopSingleTabGuard();
  await supabase.auth.signOut();
  _session = null;
  _appUser = null;
}

export function isAuthed() {
  return !!_session?.user && !_tabBlocked;
}

export function getUser() {
  if (!_session?.user || _tabBlocked) return null;

  const email = _session.user.email || "";
  const username = usernameFromEmail(email);

  return {
    id: _appUser?.id || null,
    username,
    role: _appUser?.is_admin ? "admin" : "user",
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

console.log("HAYEK AUTH loaded (Device Lock ALWAYS + Single Tab)");
