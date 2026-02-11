// auth.js (FULL) — HAYEK SPOT
// يعتمد على Supabase + جدول app_users
// تسجيل مرة واحدة لكل جهاز (device_id يُثبت لأول تسجيل)

(function () {
  "use strict";

  window.__HAYEK_AUTH_LOADED__ = true;

  const LS_KEY = "HAYEK_AUTH_SESSION_V2";
  const DEVICE_KEY = "HAYEK_DEVICE_ID_V1";

  function jparse(s, fb) { try { return JSON.parse(s) ?? fb; } catch { return fb; } }
  function jset(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  function getCfg() { return window.APP_CONFIG || {}; }

  function getOrCreateDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() || ("dev_" + Math.random().toString(16).slice(2) + Date.now()));
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  async function getSupabase() {
    const cfg = getCfg();
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return null;

    // إذا supabase-js مش موجود حمّلو من CDN (حل جذري)
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    return window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  function saveSession(sess) { jset(LS_KEY, sess); }
  function getSession() { return jparse(localStorage.getItem(LS_KEY), null); }
  function clearSession() { localStorage.removeItem(LS_KEY); }

  async function login(username, pass) {
    username = (username || "").trim();
    pass = (pass || "").trim();
    if (!username || !pass) throw new Error("EMPTY");

    const sb = await getSupabase();
    if (!sb) throw new Error("NO_SUPABASE");

    const deviceId = getOrCreateDeviceId();

    // ✅ جدولك الحقيقي: app_users
    const { data, error } = await sb
      .from("app_users")
      .select("id, username, pass, is_admin, blocked, device_id")
      .eq("username", username)
      .maybeSingle();

    if (error) throw new Error("DB");
    if (!data) throw new Error("NOT_FOUND");
    if (data.blocked) throw new Error("BLOCKED");
    if ((data.pass || "") !== pass) throw new Error("BAD_PASS");

    // ✅ تثبيت الجهاز لأول مرة
    if (data.device_id && data.device_id !== deviceId) {
      throw new Error("DEVICE_LOCK");
    }
    if (!data.device_id) {
      const { error: upErr } = await sb
        .from("app_users")
        .update({ device_id: deviceId })
        .eq("id", data.id);
      if (upErr) throw new Error("DEVICE_BIND_FAIL");
    }

    const sess = {
      username: data.username,
      role: data.is_admin ? "admin" : "user",
      deviceId,
      ts: Date.now()
    };
    saveSession(sess);
    return sess;
  }

  const HAYEK_AUTH = {
    isAuthed() {
      const s = getSession();
      return !!(s && s.username && s.deviceId);
    },
    getUser() {
      return getSession();
    },
    getOrCreateDeviceId,
    async login(username, pass) {
      return login(username, pass);
    },
    logout() {
      clearSession();
    },
    resetDeviceData() {
      clearSession();
      localStorage.removeItem(DEVICE_KEY);
    }
  };

  window.HAYEK_AUTH = HAYEK_AUTH;

  console.log("HAYEK AUTH loaded ✓");
})();
