// auth.js (FINAL - Single Device + Single Tab)
// - جهاز واحد: عبر app_users.device_id
// - تبويب واحد: قفل تبويب واحد لكل مستخدم بنفس المتصفح (بدون logout حتى لا يطرد التبويب الأساسي)

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

// ===== قفل جهاز واحد =====
async function enforceSingleDeviceFor(username) {
  const deviceId = getOrCreateDeviceId();

  const row = await loadAppUserByUsername(username);
  if (!row) throw new Error("هذا المستخدم غير موجود بقاعدة البيانات. اطلب من الأدمن إضافته.");
  if (row.is_blocked) throw new Error("هذا الحساب محظور. تواصل مع الأدمن.");

  if (!row.device_id) {
    const { error: uerr } = await supabase
      .from("app_users")
      .update({ device_id: deviceId })
      .eq("id", row.id);
    if (uerr) throw uerr;
    return await loadAppUserByUsername(username);
  }

  if (row.device_id !== deviceId) {
    throw new Error("هذا الحساب مسجّل على جهاز آخر. تواصل مع الأدمن لإعادة تعيين الجهاز.");
  }

  return row;
}

// ===================================================================
// ===== قفل تبويب واحد (Single Tab) بدون logout (حتى لا يطرد الأساسي) =====
// ===================================================================
let _tabBlocked = false;
let _tabOwner = false;
let _tabTimer = null;
let _tabBC = null;
let _tabUsername = null;

function lockKeyFor(username) {
  return `HAYEK_ACTIVE_TAB_LOCK::${username}`;
}

function nowMs() {
  return Date.now();
}

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
  stopSingleTabGuard(); // تأكد ما في قفل قديم
  _tabUsername = username;

  const tabId = getOrCreateTabId();
  const TTL = 12000;      // إذا التبويب مات/انغلق بدون clean-up، بعد 12 ثانية يعتبر غير نشط
  const HEARTBEAT = 4000; // تحديث كل 4 ثواني

  const bcName = `HAYEK_TAB_BC::${username}`;
  try {
    _tabBC = new BroadcastChannel(bcName);
    _tabBC.onmessage = (ev) => {
      const msg = ev?.data || {};
      // لو التبويب الأساسي أغلق وحرر القفل، خلّي التبويب الثاني يحاول يقتنص القفل مباشرة
      if (msg?.type === "LOCK_RELEASED") {
        tryAcquire();
      }
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

    // لا يوجد قفل / القفل قديم / نفس التبويب
    if (!lock || isStale(lock) || lock.tabId === tabId) {
      writeLock(username, { tabId, ts: nowMs() });
      _tabOwner = true;
      _tabBlocked = false;
      return true;
    }

    // يوجد تبويب آخر نشط
    _tabOwner = false;
    _tabBlocked = true;

    // تنبيه مرة واحدة فقط (أول ما يصير بلوك)
    if (!sessionStorage.getItem(`HAYEK_TAB_BLOCKED_SHOWN::${username}`)) {
      sessionStorage.setItem(`HAYEK_TAB_BLOCKED_SHOWN::${username}`, "1");
      alert("❌ هذا الحساب مفتوح بالفعل في تبويب آخر. أغلق التبويب الآخر للمتابعة.");
    }

    return false;
  }

  // أول محاولة
  tryAcquire();

  // heartbeat: فقط المالك يحدّث القفل
  _tabTimer = setInterval(() => {
    if (!_tabUsername) return;

    const lock = readLock(username);
    const tabIdNow = getOrCreateTabId();

    // إذا نحن المالك، حدّث
    if (_tabOwner && lock && lock.tabId === tabIdNow) {
      writeLock(username, { tabId: tabIdNow, ts: nowMs() });
      return;
    }

    // إذا لم نعد مالك (أو القفل تغير)، جرّب تكتسب عند الحاجة
    if (!_tabOwner) {
      tryAcquire();
    }
  }, HEARTBEAT);

  // عند إغلاق التبويب: إذا نحن المالك، حرّر القفل
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

// ===== Session bootstrap =====
async function initSession() {
  try {
    const { data } = await supabase.auth.getSession();
    _session = data?.session || null;

    if (_session?.user?.email) {
      const username = usernameFromEmail(_session.user.email);
      try {
        _appUser = await loadAppUserByUsername(username);
      } catch {
        _appUser = null;
      }

      // شغّل قفل التبويب فقط إذا عندنا جلسة
      startSingleTabGuard(username);
    } else {
      _appUser = null;
      stopSingleTabGuard();
    }
  } catch {
    _session = null;
    _appUser = null;
    stopSingleTabGuard();
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

    startSingleTabGuard(username);
  } else {
    _appUser = null;
    stopSingleTabGuard();
  }
});

// ====== API العامة ======
export async function login(username, password) {
  const u = String(username || "").trim().replace(/^mailto:/i, "");
  const email = `${u}@hayek.local`;

  // 1) Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user) throw new Error("فشل تسجيل الدخول: بيانات غير صحيحة");

  // 2) جهاز واحد
  try {
    _appUser = await enforceSingleDeviceFor(u);
  } catch (e) {
    // هنا مسموح نعمل signOut لأننا لسه داخلين الآن (ولا يوجد تبويب أساسي)
    await supabase.auth.signOut();
    _session = null;
    _appUser = null;
    stopSingleTabGuard();
    throw e;
  }

  // 3) تبويب واحد
  startSingleTabGuard(u);
  if (_tabBlocked) {
    // لا نعمل signOut (حتى لا نطرد تبويب آخر)
    throw new Error("هذا الحساب مفتوح في تبويب آخر.");
  }

  return data.user;
}

export async function logout() {
  stopSingleTabGuard();
  await supabase.auth.signOut();
  _session = null;
  _appUser = null;
}

// ✅ أهم نقطة: إذا التبويب محجوب، اعتبره غير مسجل
export function isAuthed() {
  return !!_session?.user && !_tabBlocked;
}

export function getUser() {
  if (!_session?.user || _tabBlocked) return null;

  const email = _session.user.email || "";
  const username = usernameFromEmail(email);
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

console.log("HAYEK AUTH loaded (Single Device + Single Tab)");
