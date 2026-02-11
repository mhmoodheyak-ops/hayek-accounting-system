/* auth.js — HAYEK AUTH (Device-bound, one-time login)
   - Exposes: window.HAYEK_AUTH
   - Uses Supabase from config.js: window.APP_CONFIG
   - Table expected: users { username, password, role, device_id, blocked }
*/

(() => {
  const STORAGE_KEY = "HAYEK_AUTH_SESSION_V1";
  const DEVICE_KEY  = "HAYEK_DEVICE_ID_V1";

  function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }
  function nowTs() { return Date.now(); }

  // Simple stable device id
  function getOrCreateDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (id) return id;
    id = "dev_" + Math.random().toString(16).slice(2) + "_" + Math.random().toString(16).slice(2);
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  }

  function getSession() {
    return safeJsonParse(localStorage.getItem(STORAGE_KEY));
  }

  function setSession(sess) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  async function makeSupabase() {
    const cfg = window.APP_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return null;

    // Load supabase if not present
    if (!window.supabase) {
      throw new Error("Supabase library not loaded");
    }
    return window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  async function login(username, password) {
    username = (username || "").trim();
    password = (password || "").trim();

    if (!username || !password) {
      return { ok: false, message: "يرجى إدخال اسم المستخدم وكلمة السر." };
    }

    const deviceId = getOrCreateDeviceId();

    // If offline: only allow if we already have a session for same user/device
    if (!navigator.onLine) {
      const s = getSession();
      if (s && s.username === username && s.deviceId === deviceId) {
        return { ok: true, message: "تم تسجيل الدخول (أوفلاين)." , session: s };
      }
      return { ok: false, message: "لا يمكن تسجيل الدخول بدون إنترنت لأول مرة على هذا الجهاز." };
    }

    let sb;
    try {
      sb = await makeSupabase();
      if (!sb) return { ok: false, message: "إعدادات السيرفر غير جاهزة (config.js)." };
    } catch (e) {
      return { ok: false, message: "مكتبة Supabase غير جاهزة." };
    }

    // Fetch user
    const { data, error } = await sb
      .from("users")
      .select("username,password,role,device_id,blocked")
      .eq("username", username)
      .limit(1)
      .maybeSingle();

    if (error) return { ok: false, message: "خطأ في الاتصال بالسيرفر." };
    if (!data) return { ok: false, message: "اسم المستخدم غير موجود." };

    if (data.blocked === true) {
      return { ok: false, message: "هذا المستخدم محظور." };
    }

    // Password check (plain for now, matching your current simple system)
    if ((data.password || "") !== password) {
      return { ok: false, message: "كلمة السر غير صحيحة." };
    }

    // Device binding: if device_id empty => bind it, else must match
    const serverDevice = (data.device_id || "").trim();
    if (!serverDevice) {
      const { error: upErr } = await sb
        .from("users")
        .update({ device_id: deviceId })
        .eq("username", username);

      if (upErr) return { ok: false, message: "فشل تثبيت الجهاز. حاول مرة أخرى." };
    } else if (serverDevice !== deviceId) {
      return { ok: false, message: "هذا الحساب مربوط بجهاز آخر." };
    }

    const session = {
      username,
      role: (data.role || "user"),
      deviceId,
      ts: nowTs()
    };

    setSession(session);
    return { ok: true, message: "تم تسجيل الدخول بنجاح.", session };
  }

  function logout() {
    clearSession();
    return true;
  }

  function isAuthed() {
    const s = getSession();
    if (!s) return false;
    const deviceId = getOrCreateDeviceId();
    return s.deviceId === deviceId && !!s.username;
  }

  function getUser() {
    return getSession();
  }

  // Hard guard: if not authed => go to index.html
  function requireAuth({ role } = {}) {
    if (!isAuthed()) {
      window.location.href = "index.html?v=" + Date.now();
      return false;
    }
    const s = getSession();
    if (role && s && s.role !== role) {
      window.location.href = "index.html?v=" + Date.now();
      return false;
    }
    return true;
  }

  function resetDevice() {
    localStorage.removeItem(DEVICE_KEY);
    clearSession();
  }

  window.HAYEK_AUTH = {
    login,
    logout,
    isAuthed,
    getUser,
    requireAuth,
    resetDevice,
    getOrCreateDeviceId
  };

  // Flag for index.html to stop showing the false alert
  window.__HAYEK_AUTH_LOADED__ = true;

  console.log("HAYEK AUTH loaded ✓");
})();
