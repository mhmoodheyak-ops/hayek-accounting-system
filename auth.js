// auth.js
(function () {
  const STORAGE_KEY = "HAYEK_AUTH_DEVICE";

  function getDeviceId() {
    let id = localStorage.getItem("HAYEK_DEVICE_ID");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("HAYEK_DEVICE_ID", id);
    }
    return id;
  }

  function isLoggedIn() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    try {
      const data = JSON.parse(saved);
      return data.deviceId === getDeviceId();
    } catch {
      return false;
    }
  }

  function login(username, password) {
    if (!username || !password) return false;

    // تسجيل دخول محلي (لاحقاً نربطه بسيرفر)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        username,
        deviceId: getDeviceId(),
        at: Date.now()
      })
    );
    return true;
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  // حماية الصفحة
  document.addEventListener("DOMContentLoaded", () => {
    if (!isLoggedIn()) {
      if (!location.pathname.endsWith("index.html")) {
        location.href = "index.html";
      }
    }
  });

  // إتاحة الدوال
  window.HAYEK_AUTH = {
    login,
    logout,
    isLoggedIn
  };
})();

