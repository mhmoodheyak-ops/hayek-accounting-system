// admin.js
// ❗ ممنوع تعريف const client أو supabase هنا

(() => {
  const $ = (id) => document.getElementById(id);

  /* =======================
     عناصر الواجهة
  ======================= */
  const authState = $("authState");
  const statusEl = $("status");

  const adminUser = $("adminUser");
  const adminPass = $("adminPass");
  const btnLogin  = $("btnLogin");
  const btnLogout = $("btnLogout");

  const userSelect = $("userSelect");
  const fromDate   = $("fromDate");
  const toDate     = $("toDate");

  const btnRefreshUsers = $("btnRefreshUsers");
  const btnFetchInvoices = $("btnFetchInvoices");
  const btnExportPdf = $("btnExportPdf");
  const btnClearFilters = $("btnClearFilters");

  const invTbody = $("invTbody");
  const countInvoices = $("countInvoices");

  /* =======================
     Supabase – instance واحدة فقط
  ======================= */
  const cfg = window.HAYEK || {};

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.error("❌ مفاتيح Supabase غير موجودة في config.js");
  }

  // 🔴 المهم: نستخدم window.supabaseClient فقط
  if (!window.supabaseClient && window.supabase) {
    window.supabaseClient = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY
    );
  }

  const db = window.supabaseClient;

  /* =======================
     تسجيل دخول الأدمن (محلي)
  ======================= */
  const AUTH_KEY = "HAYEK_ADMIN_LOGGED_IN";

  function isLogged() {
    return localStorage.getItem(AUTH_KEY) === "1";
  }

  function setLogged(v) {
    localStorage.setItem(AUTH_KEY, v ? "1" : "0");
    renderAuth();
  }

  function renderAuth() {
    const ok = isLogged();
    authState.textContent = ok ? "مسجّل" : "غير مسجّل";
    authState.style.color = ok ? "#8ff0c8" : "#ffb3b3";

    [
      userSelect, fromDate, toDate,
      btnRefreshUsers, btnFetchInvoices,
      btnExportPdf, btnClearFilters
    ].forEach(el => el.disabled = !ok);
  }

  function setStatus(msg, err=false) {
    statusEl.textContent = msg;
    statusEl.style.color = err ? "#ffb3b3" : "#8ff0c8";
  }

  /* =======================
     أسماء الجداول (عدّلها فقط إذا لزم)
  ======================= */
  const USERS_TABLE    = "users";
  const INVOICES_TABLE = "invoices";

  /* =======================
     تحميل المستخدمين
  ======================= */
  async function loadUsers() {
    if (!db) return;

    setStatus("تحميل المستخدمين...");
    userSelect.innerHTML = `<option value="">— اختر المستخدم —</option>`;

    const { data, error } = await db
      .from(USERS_TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setStatus("خطأ تحميل المستخدمين", true);
      return;
    }

    data.forEach(u => {
      const id = u.id || u.user_id;
      const name = u.name || u.username || u.email || id;
      if (!id) return;

      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      userSelect.appendChild(opt);
    });

    setStatus("جاهز");
  }

  /* =======================
     تحميل الفواتير
  ======================= */
  async function loadInvoices() {
    if (!db) return;

    const uid = userSelect.value;
    if (!uid) {
      setStatus("اختر مستخدم", true);
      return;
    }

    setStatus("جلب الفواتير...");
    invTbody.innerHTML =
      `<tr><td colspan="5" style="text-align:center">جاري التحميل...</td></tr>`;

    let q = db
      .from(INVOICES_TABLE)
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (fromDate.value) q = q.gte("created_at", fromDate.value);
    if (toDate.value)   q = q.lte("created_at", toDate.value + "T23:59:59");

    const { data, error } = await q;

    if (error) {
      console.error(error);
      setStatus("خطأ جلب الفواتير", true);
      return;
    }

    countInvoices.textContent = data.length;
    invTbody.innerHTML = "";

    if (!data.length) {
      invTbody.innerHTML =
        `<tr><td colspan="5" style="text-align:center">لا يوجد فواتير</td></tr>`;
      setStatus("جاهز");
      return;
    }

    data.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${r.user_name || r.user_id}</td>
        <td>${r.total || 0}</td>
        <td>${new Date(r.created_at).toLocaleString("ar")}</td>
        <td>—</td>
      `;
      invTbody.appendChild(tr);
    });

    setStatus("جاهز");
  }

  function clearFilters() {
    userSelect.value = "";
    fromDate.value = "";
    toDate.value = "";
    invTbody.innerHTML =
      `<tr><td colspan="5" style="text-align:center">لا يوجد بيانات</td></tr>`;
    countInvoices.textContent = "0";
  }

  /* =======================
     الأحداث
  ======================= */
  btnLogin.onclick = () => {
    if (
      adminUser.value === cfg.ADMIN_USER &&
      adminPass.value === cfg.ADMIN_PASS
    ) {
      setLogged(true);
      setStatus("تم تسجيل الدخول ✅");
      loadUsers();
    } else {
      setStatus("بيانات خاطئة", true);
    }
  };

  btnLogout.onclick = () => {
    setLogged(false);
    setStatus("تم تسجيل الخروج");
  };

  btnRefreshUsers.onclick = loadUsers;
  btnFetchInvoices.onclick = loadInvoices;
  btnClearFilters.onclick = clearFilters;
  btnExportPdf.onclick = () => alert("PDF من الأدمن — جاهز لاحقًا");

  /* =======================
     بدء
  ======================= */
  renderAuth();
  setStatus("جاهز");

  if (isLogged()) loadUsers();
})();
