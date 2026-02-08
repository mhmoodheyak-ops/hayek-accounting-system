/* =========================================================
   HAYEK SPOT — auth.js
   تسجيل دخول بسيط عبر جدول app_users في Supabase
   - يمنع الدخول إذا الحساب غير مفعّل
   - يحفظ جلسة في localStorage باسم: hayek_session
   - يحمي صفحة admin.html: لازم is_admin = true
   Build: v2026.02.08
   ========================================================= */

(() => {
  "use strict";

  // لا يشتغل إلا إذا كان في صفحة فيها تسجيل دخول أو صفحة أدمن
  const isAdminPage =
    document.querySelector("[data-hayek-page='admin']") ||
    document.getElementById("usersTbody") ||
    document.getElementById("usersBody") ||
    document.getElementById("btnSaveUser");

  const hasLoginUI =
    document.getElementById("btnLogin") ||
    document.getElementById("loginBtn") ||
    document.getElementById("username") ||
    document.getElementById("password") ||
    document.getElementById("loginUser") ||
    document.getElementById("loginPass");

  if (!isAdminPage && !hasLoginUI) return;

  /* =======================
     CONFIG
     ======================= */
  window.HAYEK_CONFIG = window.HAYEK_CONFIG || {};
  const SUPABASE_URL =
    window.HAYEK_CONFIG.SUPABASE_URL ||
    "https://itidwqvyrjydmegjzuvn.supabase.co";
  const SUPABASE_KEY =
    window.HAYEK_CONFIG.SUPABASE_KEY ||
    "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";

  /* =======================
     Helpers
     ======================= */
  const $ = (id) => document.getElementById(id);

  function setMsg(text, ok = false) {
    const el = $("loginMsg") || $("msg") || $("message");
    if (!el) return;
    el.textContent = text || "";
    el.style.opacity = text ? "1" : "0";
    el.style.color = ok ? "#2ecc71" : "#ff5a6b";
  }

  function safeStr(x) {
    return String(x ?? "").trim();
  }

  function getSession() {
    try {
      const raw = localStorage.getItem("hayek_session");
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.username) return null;
      return s;
    } catch {
      return null;
    }
  }

  function setSession(sess) {
    const s = {
      username: safeStr(sess?.username),
      is_admin: !!sess?.is_admin,
      ts: Date.now(),
    };
    localStorage.setItem("hayek_session", JSON.stringify(s));
    return s;
  }

  function clearSession() {
    localStorage.removeItem("hayek_session");
  }

  function pageName() {
    const p = (location.pathname || "").split("/").pop() || "";
    return p.toLowerCase();
  }

  function go(url) {
    try {
      location.href = url;
    } catch {
      // ignore
    }
  }

  /* =======================
     Supabase client
     ======================= */
  function getSupabase() {
    const sb =
      (window.supabase && window.supabase.createClient)
        ? window.supabase
        : (typeof supabase !== "undefined" ? supabase : null);

    if (!sb || !sb.createClient) return null;
    try {
      return sb.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch {
      return null;
    }
  }

  const client = getSupabase();

  /* =======================
     Guard: Admin page requires admin session
     ======================= */
  async function guardAdmin() {
    if (!isAdminPage) return;

    const sess = getSession();
    if (!sess || !sess.username) {
      // لا توجد جلسة
      go("index.html");
      return;
    }
    if (!sess.is_admin) {
      // ليس أدمن
      alert("هذه الصفحة مخصصة للأدمن فقط.");
      go("index.html");
      return;
    }

    // لو بدك تحقق من حالة الحساب من السيرفر (مفعّل/غير مفعّل)
    if (client) {
      const { data, error } = await client
        .from("app_users")
        .select("username, is_admin, blocked")
        .eq("username", sess.username)
        .maybeSingle();

      if (error) {
        console.warn(error);
        return; // ما نمنع فتح الصفحة بسبب خطأ مؤقت
      }

      if (!data) {
        clearSession();
        go("index.html");
        return;
      }

      if (data.blocked) {
        clearSession();
        alert("هذا الحساب غير مفعّل حالياً.");
        go("index.html");
        return;
      }

      if (!data.is_admin) {
        clearSession();
        alert("هذه الصفحة مخصصة للأدمن فقط.");
        go("index.html");
        return;
      }
    }
  }

  /* =======================
     Login
     ======================= */
  async function doLogin() {
    const u =
      safeStr(getValueAny(["username", "loginUser", "user", "u"])) ||
      safeStr(($("username") || $("loginUser"))?.value);

    const p =
      safeStr(getValueAny(["password", "loginPass", "pass", "p"])) ||
      safeStr(($("password") || $("loginPass"))?.value);

    if (!u || !p) {
      setMsg("اكتب اسم المستخدم وكلمة السر");
      alert("اكتب اسم المستخدم وكلمة السر");
      return;
    }

    if (!client) {
      setMsg("خطأ: Supabase غير جاهز (تحقق من تحميل المكتبة)", false);
      alert("Supabase غير جاهز. تأكد من تحميل ملفات الصفحة.");
      return;
    }

    setMsg("جارٍ التحقق…", true);

    const { data, error } = await client
      .from("app_users")
      .select("username, pass, is_admin, blocked")
      .eq("username", u)
      .maybeSingle();

    if (error) {
      console.error(error);
      setMsg("خطأ اتصال. جرّب مرة ثانية.", false);
      alert("خطأ اتصال: " + error.message);
      return;
    }

    if (!data) {
      setMsg("اسم المستخدم غير موجود", false);
      alert("اسم المستخدم غير موجود");
      return;
    }

    if (String(data.pass) !== String(p)) {
      setMsg("كلمة السر غير صحيحة", false);
      alert("كلمة السر غير صحيحة");
      return;
    }

    if (data.blocked) {
      // بدون كلمة "محظور"
      setMsg("هذا الحساب غير مفعّل حالياً.", false);
      alert("هذا الحساب غير مفعّل حالياً.");
      return;
    }

    // Success
    const sess = setSession({ username: data.username, is_admin: data.is_admin });
    setMsg("✅ تم تسجيل الدخول", true);

    // لو دخل من صفحة الأدمن → روح للأدمن، وإلا خليه بنفس الصفحة أو روح للـ index
    const pName = pageName();
    if (pName === "admin.html") {
      // هو أصلاً هنا
      return;
    }

    // إذا الحساب أدمن ومحب يروح للأدمن:
    // (اختياري) إذا في زر/رابط
    // حالياً نرجع لـ index.html دائماً بعد الدخول
    go("index.html");
  }

  function getValueAny(ids) {
    for (const id of ids) {
      const el = $(id);
      if (el && "value" in el) return el.value;
    }
    return "";
  }

  function wireLoginUI() {
    const btn = $("btnLogin") || $("loginBtn");
    if (btn) btn.addEventListener("click", doLogin);

    // Enter على كلمة السر
    const passEl = $("password") || $("loginPass");
    if (passEl) {
      passEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doLogin();
        }
      });
    }

    // زر تسجيل خروج إن وجد
    const logoutBtn = $("btnLogout") || $("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        clearSession();
        go("index.html");
      });
    }
  }

  /* =======================
     Public API (اختياري)
     ======================= */
  window.HAYEK_AUTH = {
    getSession,
    setSession,
    clearSession,
    login: doLogin,
    logout: () => {
      clearSession();
      go("index.html");
    },
  };

  // Init
  wireLoginUI();
  guardAdmin();
})();
