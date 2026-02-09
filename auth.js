/* auth.js
   - Login مرة واحدة (يحفظ جلسة محليًا)
   - كل حساب مسموح لجهاز واحد فقط (device_id)
   - يعتمد على Supabase من config.js: window.APP_CONFIG
   - بدون module / import
*/

(function () {
  "use strict";

  const LS_KEY = "HAYEK_USER_SESSION_V1";
  const DEV_KEY = "HAYEK_DEVICE_ID_V1";

  function uuidLike() {
    // UUID بسيط (كفاية لمعرف جهاز محلي)
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getDeviceId() {
    let id = localStorage.getItem(DEV_KEY);
    if (!id) {
      id = "dev_" + uuidLike();
      localStorage.setItem(DEV_KEY, id);
    }
    return id;
  }

  function getConfig() {
    return (window.APP_CONFIG || {});
  }

  function getSupabaseClient() {
    // لازم يكون supabase-js محمّل بالصفحة قبل auth.js
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase SDK غير محمّل. تأكد أن ملف supabase-js موجود قبل auth.js");
    }
    const cfg = getConfig();
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      throw new Error("config.js ناقص: SUPABASE_URL / SUPABASE_ANON_KEY");
    }
    // Singleton
    if (!window.__HAYEK_SUPABASE__) {
      window.__HAYEK_SUPABASE__ = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }
    return window.__HAYEK_SUPABASE__;
  }

  function saveSession(session) {
    localStorage.setItem(LS_KEY, JSON.stringify(session));
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.username || !s.device_id) return null;
      return s;
    } catch {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(LS_KEY);
  }

  async function login(username, password) {
    username = (username || "").trim();
    password = (password || "").trim();
    if (!username || !password) {
      return { ok: false, message: "اسم المستخدم وكلمة السر مطلوبين." };
    }

    const device_id = getDeviceId();
    const sb = getSupabaseClient();

    // 1) جلب المستخدم
    const { data: user, error } = await sb
      .from("app_users")
      .select("id, username, pass, is_admin, blocked, device_id")
      .eq("username", username)
      .limit(1)
      .maybeSingle();

    if (error) return { ok: false, message: "خطأ اتصال بالسيرفر." };
    if (!user) return { ok: false, message: "اسم المستخدم غير صحيح." };

    // 2) تحقق كلمة السر
    if (String(user.pass || "") !== String(password)) {
      return { ok: false, message: "كلمة السر غير صحيحة." };
    }

    // 3) محظور؟
    if (user.blocked === true) {
      return { ok: false, message: "هذا الحساب محظور." };
    }

    // 4) ربط الجهاز: إذا الحساب مربوط لجهاز آخر -> رفض
    const dbDev = (user.device_id || "").trim();
    if (dbDev && dbDev !== device_id) {
      return { ok: false, message: "هذا الحساب مستخدم على جهاز آخر (مقفل على جهاز واحد)." };
    }

    // 5) أول تسجيل: خزّن device_id في قاعدة البيانات
    if (!dbDev) {
      const { error: upErr } = await sb
        .from("app_users")
        .update({ device_id })
        .eq("id", user.id);

      if (upErr) {
        return { ok: false, message: "تعذّر ربط الحساب بالجهاز. أعد المحاولة." };
      }
    }

    // 6) حفظ جلسة محليًا (مرة واحدة)
    const session = {
      user_id: user.id,
      username: user.username,
      is_admin: !!user.is_admin,
      device_id,
      login_at: new Date().toISOString()
    };
    saveSession(session);

    return { ok: true, session };
  }

  function isLoggedIn() {
    return !!readSession();
  }

  function getSession() {
    return readSession();
  }

  function logout() {
    clearSession();
  }

  // حماية صفحة: لو ما في جلسة -> رجّع false
  function requireLogin() {
    const s = readSession();
    return !!s;
  }

  // واجهة عامة للتعامل من باقي الملفات
  window.HAYEK_AUTH = {
    login,
    logout,
    isLoggedIn,
    getSession,
    getDeviceId,
    requireLogin
  };

})();

