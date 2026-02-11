// auth.js (FULL) — HAYEK SPOT
(() => {
  "use strict";

  const LS_SESSION = "HAYEK_AUTH_SESSION_V1";
  const LS_DEVICE  = "HAYEK_AUTH_DEVICE_ID_V1";

  const USERS_TABLE = "app_users"; // ✅ جدولك الحقيقي

  function jparse(s, fallback){ try { return JSON.parse(s) ?? fallback; } catch { return fallback; } }
  function jset(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  function uuid(){
    return (crypto?.randomUUID?.() || ("dev_" + Math.random().toString(16).slice(2) + Date.now()));
  }

  function getOrCreateDeviceId(){
    let d = localStorage.getItem(LS_DEVICE);
    if (!d) { d = uuid(); localStorage.setItem(LS_DEVICE, d); }
    return d;
  }

  function getCfg(){
    const cfg = window.APP_CONFIG || {};
    return {
      url: cfg.SUPABASE_URL || "",
      key: cfg.SUPABASE_ANON_KEY || ""
    };
  }

  function getClient(){
    try{
      const { url, key } = getCfg();
      if (!url || !key) return null;
      if (!window.supabase) return null;
      return window.supabase.createClient(url, key);
    }catch{
      return null;
    }
  }

  function getSession(){
    return jparse(localStorage.getItem(LS_SESSION), null);
  }

  function setSession(sess){
    jset(LS_SESSION, sess);
  }

  function clearSession(){
    localStorage.removeItem(LS_SESSION);
  }

  function isAuthed(){
    const s = getSession();
    return !!(s && s.username && s.deviceId && (s.isAdmin === true || s.isAdmin === false));
  }

  function getUser(){
    return getSession();
  }

  async function login(username, pass){
    const sb = getClient();
    if (!sb) return { ok:false, msg:"Supabase غير جاهز. تأكد من config.js و supabase." };

    const u = String(username || "").trim();
    const p = String(pass || "").trim();
    if (!u || !p) return { ok:false, msg:"الرجاء إدخال اسم المستخدم وكلمة السر." };

    const deviceId = getOrCreateDeviceId();

    // اقرأ المستخدم
    let row = null;
    try{
      const { data, error } = await sb
        .from(USERS_TABLE)
        .select("id, username, pass, is_admin, blocked, device_id")
        .eq("username", u)
        .limit(1)
        .maybeSingle();

      if (error) return { ok:false, msg:"خطأ في الاتصال بالسيرفر." };
      row = data;
    }catch{
      return { ok:false, msg:"خطأ في الاتصال بالسيرفر." };
    }

    if (!row) return { ok:false, msg:"اسم المستخدم غير موجود." };
    if (row.blocked) return { ok:false, msg:"هذا الحساب محظور." };

    // تحقق كلمة السر (حسب تصميم جدولك)
    if (String(row.pass || "") !== p) return { ok:false, msg:"كلمة السر غير صحيحة." };

    // ✅ جهاز واحد فقط:
    // - أول تسجيل دخول: إذا device_id فاضي => نثبّت الجهاز الحالي
    // - إذا موجود ومختلف => نرفض الدخول
    const dbDevice = (row.device_id || "").trim();

    if (!dbDevice) {
      // ثبّت الجهاز لأول مرة
      try{
        const { error } = await sb
          .from(USERS_TABLE)
          .update({ device_id: deviceId })
          .eq("id", row.id);

        if (error) {
          return { ok:false, msg:"تعذّر تثبيت الجهاز. حاول مجدداً." };
        }
      }catch{
        return { ok:false, msg:"تعذّر تثبيت الجهاز. حاول مجدداً." };
      }
    } else if (dbDevice !== deviceId) {
      return { ok:false, msg:"هذا الحساب مربوط بجهاز آخر." };
    }

    // احفظ جلسة محلية (مرة واحدة وبعدها دخول تلقائي على نفس الجهاز)
    const sess = {
      username: row.username,
      isAdmin: !!row.is_admin,
      deviceId
    };
    setSession(sess);

    return { ok:true, user:sess };
  }

  function logout(){
    clearSession();
  }

  // Export
  window.HAYEK_AUTH = {
    login,
    logout,
    isAuthed,
    getUser,
    getOrCreateDeviceId
  };

  // Flag used by pages
  window.__HAYEK_AUTH_LOADED__ = true;
  console.log("HAYEK AUTH loaded ✓");
})();
