/* =========================================================
   HAYEK SPOT — auth.js
   تسجيل دخول بسيط عبر جدول app_users في Supabase
   - يمنع الدخول إذا الحساب غير مفعّل
   - يحفظ جلسة في localStorage باسم: hayek_session
   - يحمي صفحة admin.html: لازم is_admin = true
   Build: v2026.02.08
   ========================================================= */

(() => {
    const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";
    const SESSION_KEY = "hayek_auth_session_v1";

    const overlay = document.getElementById("auth-overlay");
    const userEl = document.getElementById("auth-email");
    const passEl = document.getElementById("auth-pass");
    const msgEl  = document.getElementById("auth-msg");
    const btnLogin = document.getElementById("btn-login");

    async function handleLogin() {
        const u = userEl.value.trim();
        const p = passEl.value.trim();

        if (!u || !p) {
            msgEl.innerText = "الرجاء إدخال اسم المستخدم وكلمة المرور";
            msgEl.style.color = "#ff4d4d";
            return;
        }
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

        btnLogin.disabled = true;
        msgEl.innerText = "جاري الاتصال بقاعدة البيانات...";
        msgEl.style.color = "#d4af37";

        try {
            const query = `${SUPABASE_URL}/rest/v1/app_users?username=eq.${encodeURIComponent(u)}&pass=eq.${encodeURIComponent(p)}&select=*`;
            const response = await fetch(query, {
                headers: { 
                    "apikey": SUPABASE_ANON_KEY, 
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}` 
                }
            });
            const users = await response.json();

            if (users && users.length > 0) {
                const user = users[0];
                if (user.blocked) {
                    msgEl.innerText = "تم حظر هذا الحساب. راجع الإدارة.";
                    msgEl.style.color = "red";
                } else {
                    localStorage.setItem(SESSION_KEY, JSON.stringify({
                        username: user.username,
                        is_admin: user.is_admin,
                        loginTime: new Date().toISOString()
                    }));
                    msgEl.innerText = "تم التحقق.. جاري الدخول ✅";
                    setTimeout(() => location.reload(), 800);
                }
            } else {
                msgEl.innerText = "بيانات الدخول غير صحيحة";
                msgEl.style.color = "red";
            }
        } catch (e) {
            msgEl.innerText = "خطأ في الاتصال. تأكد من الإنترنت.";
        } finally {
            btnLogin.disabled = false;
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

    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
        overlay.style.display = "none";
        const data = JSON.parse(session);
        document.getElementById("welcomeUser").innerText = "أهلاً، " + data.username;
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

    btnLogin.addEventListener("click", handleLogin);
    window.logout = () => { localStorage.removeItem(SESSION_KEY); location.reload(); };
  // Init
  wireLoginUI();
  guardAdmin();
})();
