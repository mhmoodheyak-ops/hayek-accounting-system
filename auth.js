/* =========================================================
   HAYEK SPOT — AUTH SYSTEM
   - تسجيل دخول مرة واحدة
   - مربوط بجهاز واحد فقط
   - بدون module
   - يعمل Online / Offline
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "HAYEK_AUTH_DEVICE";
  const DEVICE_KEY  = "HAYEK_DEVICE_ID";

  // توليد Device ID ثابت للجهاز
  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "dev-" + crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  // حفظ جلسة الدخول
  function saveSession(username) {
    const payload = {
      user: username,
      device: getDeviceId(),
      at: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  // قراءة الجلسة
  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // حذف الجلسة
  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // تحقق هل مسجّل دخول
  function isLoggedIn() {
    const s = loadSession();
    if (!s) return false;
    return s.device === getDeviceId();
  }

  // تسجيل الدخول
  function login(username, password) {
    // ⛔️ حالياً تحقق بسيط (تجريبي)
    // لاحقاً ممكن ربطه بالسيرفر بدون ما يعرف المستخدم
    if (!username || !password) return false;

    saveSession(username);
    return true;
  }

  // تسجيل خروج
  function logout() {
    clearSession();
    location.href = "index.html";
  }

  // حماية الصفحات (user.html)
  function requireAuth() {
    if (!isLoggedIn()) {
      location.href = "index.html";
    }
  }

  // كشف الجاهزية
  console.log("HAYEK AUTH loaded ✔");

  // التصدير إلى window (مهم جداً)
  window.HAYEK_AUTH = {
    login,
    logout,
    isLoggedIn,
    requireAuth,
    deviceId: getDeviceId
  };

})();
