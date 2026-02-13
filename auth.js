// auth.js
(function () {
  const cfg = window.HAYEK_CONFIG;
  if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    console.error("HAYEK_CONFIG missing in config.js");
    window.HAYEK_AUTH = null;
    return;
  }

  // Supabase client via CDN (loaded in index.html before this file)
  const { createClient } = window.supabase;
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const DEVICE_KEY = "HAYEK_DEVICE_ID";

  function getOrCreateDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() || ("dev_" + Math.random().toString(16).slice(2) + Date.now()));
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function normalizeUsername(input) {
    const s = String(input || "").trim();
    // إزالة mailto: إذا لصقها بالغلط
    return s.replace(/^mailto:/i, "").trim();
  }

  function internalEmailFromUsername(username) {
    const u = normalizeUsername(username)
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_\-\.]/g, ""); // تنظيف
    return `${u}@hayek.local`;
  }

  async function signInWithUsernamePin(username, pin) {
    const email = internalEmailFromUsername(username);
    const password = String(pin || "").trim();

    if (!email || !password) throw new Error("missing_credentials");

    // 1) تسجيل دخول Auth
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // 2) جلب profile
    const uid = data.user.id;
    let { data: profile, error: pErr } = await sb
      .from("profiles")
      .select("id,username,is_admin,blocked,device_id,last_seen")
      .eq("id", uid)
      .single();

    if (pErr) throw pErr;

    // 3) منع المستخدم المحظور
    if (profile.blocked) {
      await sb.auth.signOut();
      throw new Error("blocked");
    }

    // 4) ربط الجهاز
    const deviceId = getOrCreateDeviceId();

    if (profile.device_id && profile.device_id !== deviceId) {
      await sb.auth.signOut();
      throw new Error("device_mismatch");
    }

    // إذا أول مرة: ثبّت الجهاز + حدث last_seen
    if (!profile.device_id) {
      const { error: uErr } = await sb
        .from("profiles")
        .update({ device_id: deviceId, last_seen: new Date().toISOString() })
        .eq("id", uid);

      if (uErr) throw uErr;

      profile.device_id = deviceId;
    } else {
      await sb.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", uid);
    }

    return { user: data.user, profile, deviceId };
  }

  async function signUpUserByAdmin(newUsername, pin) {
    // هذا يستخدم signUp (لا يحتاج secret) بشرط Email confirmations OFF
    const email = internalEmailFromUsername(newUsername);
    const password = String(pin || "").trim();
    const meta = { username: normalizeUsername(newUsername) };

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: meta }
    });
    if (error) throw error;
    return data;
  }

  async function getSession() {
    const { data } = await sb.auth.getSession();
    return data.session || null;
  }

  async function signOut() {
    await sb.auth.signOut();
  }

  window.HAYEK_AUTH = {
    sb,
    getOrCreateDeviceId,
    normalizeUsername,
    internalEmailFromUsername,
    signInWithUsernamePin,
    signUpUserByAdmin,
    getSession,
    signOut
  };

  console.log("HAYEK_AUTH ready");
})();
