// auth.js (HAYEK SPOT) — Supabase auth using app_users + device lock
(() => {
  const LS_DEVICE = "HAYEK_DEVICE_ID_V1";
  const LS_SESSION = "HAYEK_SESSION_V1";

  const TABLE_USERS = "app_users";

  function uuid() {
    return (crypto?.randomUUID?.() || ("dev_" + Math.random().toString(16).slice(2) + Date.now()));
  }

  function getOrCreateDeviceId() {
    let id = localStorage.getItem(LS_DEVICE);
    if (!id) {
      id = uuid();
      localStorage.setItem(LS_DEVICE, id);
    }
    return id;
  }

  function getConfig() {
    const cfg = window.APP_CONFIG || {};
    return {
      url: cfg.SUPABASE_URL,
      key: cfg.SUPABASE_ANON_KEY,
    };
  }

  function getClient() {
    const { url, key } = getConfig();
    if (!url || !key) throw new Error("Missing SUPABASE config");
    if (!window.supabase) throw new Error("supabase-js not loaded");
    return window.supabase.createClient(url, key);
  }

  function setSession(s) {
    localStorage.setItem(LS_SESSION, JSON.stringify(s));
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(LS_SESSION) || "null"); }
    catch { return null; }
  }

  function clearSession() {
    localStorage.removeItem(LS_SESSION);
  }

  async function login(username, pass) {
    username = String(username || "").trim();
    pass = String(pass || "").trim();
    if (!username || !pass) return { ok: false, msg: "أدخل اسم المستخدم وكلمة السر" };

    const sb = getClient();
    const deviceId = getOrCreateDeviceId();

    // IMPORTANT: table is app_users (not users)
    const { data, error } = await sb
      .from(TABLE_USERS)
      .select("id, username, pass, device_id, is_admin, blocked")
      .eq("username", username)
      .maybeSingle();

    if (error) return { ok: false, msg: "خطأ في الاتصال بالسيرفر" };
    if (!data) return { ok: false, msg: "المستخدم غير موجود" };
    if (data.blocked) return { ok: false, msg: "هذا الحساب محظور" };
    if (String(data.pass || "") !== pass) return { ok: false, msg: "كلمة السر غير صحيحة" };

    // Device lock:
    // - إذا أول مرة: نخزن device_id في جدول app_users
    // - إذا كان موجود ومختلف: نمنع الدخول
    const storedDevice = String(data.device_id || "").trim();
    if (storedDevice && storedDevice !== deviceId) {
      return { ok: false, msg: "هذا الحساب مربوط بجهاز آخر" };
    }

    if (!storedDevice) {
      const { error: upErr } = await sb
        .from(TABLE_USERS)
        .update({ device_id: deviceId })
        .eq("id", data.id);
      if (upErr) return { ok: false, msg: "تعذر ربط الحساب بالجهاز" };
    }

    const session = {
      username: data.username,
      deviceId,
      isAdmin: !!data.is_admin,
      ts: Date.now()
    };

    setSession(session);
    return { ok: true, session };
  }

  function logout() {
    clearSession();
  }

  function isAuthed() {
    const s = getSession();
    if (!s || !s.username || !s.deviceId) return false;
    // لازم نفس الجهاز
    const deviceId = getOrCreateDeviceId();
    return s.deviceId === deviceId;
  }

  function getUser() {
    return getSession() || null;
  }

  function resetDevice() {
    // يمسح ربط هذا المتصفح (لا يغير في السيرفر)
    localStorage.removeItem(LS_DEVICE);
    clearSession();
  }

  window.HAYEK_AUTH = {
    login,
    logout,
    isAuthed,
    getUser,
    getOrCreateDeviceId,
    resetDevice,
  };

  window.__HAYEK_AUTH_LOADED__ = true;
  console.log("HAYEK AUTH loaded ✓");
})();
