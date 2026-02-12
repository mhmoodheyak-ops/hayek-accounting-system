// auth.js — إدارة الجلسة + ربط الجهاز (نسخة مستقرة)
(() => {
  const LS_SESSION = "HAYEK_AUTH_SESSION_V2";
  const LS_DEVICE  = "HAYEK_DEVICE_ID_V1";

  function jparse(s, fallback){ try { return JSON.parse(s) ?? fallback; } catch { return fallback; } }
  function jset(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  function nowIso(){ return new Date().toISOString(); }

  function uuid(){
    return (crypto?.randomUUID?.() || ("dev_" + Math.random().toString(16).slice(2) + Date.now()));
  }

  function getOrCreateDeviceId(){
    let id = localStorage.getItem(LS_DEVICE);
    if (!id) { id = uuid(); localStorage.setItem(LS_DEVICE, id); }
    return id;
  }

  function getSession(){
    return jparse(localStorage.getItem(LS_SESSION), null);
  }

  function setSession(sess){
    // توحيد الحقول
    const fixed = {
      id: sess?.id ?? null,
      username: sess?.username ?? null,
      role: sess?.role ?? "user",
      deviceId: sess?.deviceId || sess?.device_id || getOrCreateDeviceId(),
      created_at: sess?.created_at || nowIso()
    };
    jset(LS_SESSION, fixed);
  }

  function clearSession(){
    localStorage.removeItem(LS_SESSION);
  }

  function isAuthed(){
    const s = getSession();
    return !!(s && s.username && s.role);
  }

  function getUser(){
    return getSession();
  }

  function logout(){
    clearSession();
  }

  // Expose API
  window.HAYEK_AUTH = {
    nowIso,
    uuid,
    getOrCreateDeviceId,
    isAuthed,
    getUser,
    setSession,
    logout,
    clearSession,
  };

  window.__HAYEK_AUTH_LOADED__ = true;
  console.log("HAYEK AUTH loaded ✓");
})();
