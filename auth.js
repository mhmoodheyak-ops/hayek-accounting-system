// auth.js (بدون import)
(function () {
  const LS = {
    SESSION: "HS_SESSION",
    DEVICE: "HS_DEVICE_ID",
  };

  function uuid() {
    // UUID بسيط كفاية للـ device_id
    return "dev_" + ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
    );
  }

  window.HSAuth = {
    LS,
    getDeviceId() {
      let d = localStorage.getItem(LS.DEVICE);
      if (!d) {
        d = uuid();
        localStorage.setItem(LS.DEVICE, d);
      }
      return d;
    },
    getSession() {
      try { return JSON.parse(localStorage.getItem(LS.SESSION) || "null"); } catch { return null; }
    },
    setSession(sess) {
      localStorage.setItem(LS.SESSION, JSON.stringify(sess));
    },
    clearSession() {
      localStorage.removeItem(LS.SESSION);
    }
  };
})();
