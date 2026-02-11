/* HAYEK SPOT — Admin (robust) */
(function () {
  const $ = (id) => document.getElementById(id);

  // UI
  const lock = $("lock");
  const goLogin = $("goLogin");
  const onlineDot = $("onlineDot");
  const adminInfo = $("adminInfo");
  const logoutBtn = $("logoutBtn");
  const refreshBtn = $("refreshBtn");
  const rangeSel = $("range");
  const searchUser = $("searchUser");
  const stInvoices = $("stInvoices");
  const stUsers = $("stUsers");
  const stActive = $("stActive");
  const usersTbody = $("usersTbody");

  // Add user modal
  const addModalBack = $("addModalBack");
  const closeAddModal = $("closeAddModal");
  const addUserBtn = $("addUserBtn");
  const newUsername = $("newUsername");
  const newPass = $("newPass");
  const newIsAdmin = $("newIsAdmin");
  const saveUserBtn = $("saveUserBtn");
  const addUserMsg = $("addUserMsg");

  // Invoices modal
  const invModalBack = $("invModalBack");
  const closeInvModalBtn = $("closeInvModal"); // اسم جديد لتجنب التكرار
  const invModalTitle = $("invModalTitle");
  const invSearch = $("invSearch");
  const invTbody = $("invTbody");
  const reloadInvBtn = $("reloadInvBtn");

  // Helpers (بدون تغيير)
  function setOnlineDot() {
    const on = navigator.onLine;
    onlineDot.style.background = on ? "#49e39a" : "#ff6b6b";
    onlineDot.style.boxShadow = on ? "0 0 0 6px rgba(73,227,154,.12)" : "0 0 0 6px rgba(255,107,107,.12)";
  }
  window.addEventListener("online", setOnlineDot);
  window.addEventListener("offline", setOnlineDot);
  setOnlineDot();

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function timeAgo(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "الآن";
    if (m < 60) return `منذ ${m} د`;
    const h = Math.floor(m / 60);
    if (h < 24) return `منذ ${h} س`;
    const days = Math.floor(h / 24);
    return `منذ ${days} يوم`;
  }

  function rangeToSince(range) {
    if (range === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    if (range === "7d") return new Date(Date.now() - 7 * 864e5).toISOString();
    if (range === "30d") return new Date(Date.now() - 30 * 864e5).toISOString();
    return null;
  }

  function vibrateTiny() {
    try { navigator.vibrate && navigator.vibrate(15); } catch {}
  }

  // Auth guard
  function hardLock() {
    lock.style.display = "flex";
    goLogin.onclick = () => (location.href = "index.html?v=" + Date.now());
  }

  if (!window.HAYEK_AUTH || !window.__HAYEK_AUTH_LOADED__ || !window.HAYEK_AUTH.isAuthed()) {
    hardLock();
    return;
  }

  const session = window.HAYEK_AUTH.getUser() || {};

  if (session.role !== "admin") {
    hardLock();
    return;
  }

  lock.style.display = "none";
  adminInfo.textContent = `أدمن: ${session.username || "—"} — متصل`;

  logoutBtn.onclick = () => {
    window.HAYEK_AUTH.logout();
    location.href = "index.html?v=" + Date.now();
  };

  // Supabase client (بعد إضافة CDN)
  function getSB() {
    const cfg = window.HAYEK_CONFIG || {};
    const supabaseUrl = cfg.supabaseUrl || "";
    const supabaseKey = cfg.supabaseKey || "";

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("config.js ناقص: supabaseUrl / supabaseKey");
    }

    const sb = supabase.createClient(supabaseUrl, supabaseKey);

    return {
      sb,
      tables: {
        users: cfg.tables?.users || "app_users",
        invoices: cfg.tables?.invoices || "app_invoices",
        operations: cfg.tables?.operations || "app_operations"
      }
    };
  }

  let SB;
  try {
    SB = getSB();
  } catch (e) {
    console.error(e);
    alert("خطأ إعداد Supabase:\n" + e.message);
    return;
  }

  // باقي الكود (users, countInvoicesForUsers, fetchUsers, ... إلخ) بدون تغيير
  let users = [];
  let invoiceCounts = new Map();
  let currentUserForInvoices = null;
  let invoicesForUser = [];

  async function countInvoicesForUsers(sinceISO) {
    const { sb } = SB;
    const invoicesTable = SB.tables.invoices;

    invoiceCounts = new Map();
    let q = sb.from(invoicesTable).select("id,created_at,user_id,username,user_username,customer,total,grand_total,amount");
    if (sinceISO) q = q.gte("created_at", sinceISO);

    const { data, error } = await q.limit(5000);
    if (error) {
      console.warn("countInvoices error:", error);
      return { totalInvoices: 0 };
    }

    let totalInvoices = 0;
    for (const inv of data || []) {
      totalInvoices++;
      const key = inv.user_id ?? inv.username ?? inv.user_username ?? null;
      if (key) invoiceCounts.set(String(key), (invoiceCounts.get(String(key)) || 0) + 1);
    }
    return { totalInvoices };
  }

  // ... (باقي الدوال: fetchUsers, computeActiveUsers24h, badgeRole, badgeStatus, renderUsers, refreshAll, إلخ) تبقى كما هي

  // تعديل مهم للمودال (لإصلاح التكرار):
  function openInvModal() {
    invSearch.value = "";
    invTbody.innerHTML = "";
    invModalBack.style.display = "flex";
  }

  function closeInvModalFunc() {
    invModalBack.style.display = "none";
    currentUserForInvoices = null;
    invoicesForUser = [];
  }

  closeInvModalBtn.onclick = closeInvModalFunc;
  invModalBack.addEventListener("click", (e) => {
    if (e.target === invModalBack) closeInvModalFunc();
  });

  // ... باقي الكود (openInvoicesModal, loadInvoicesForCurrentUser, renderInvoices, downloadInvoicePdf, refreshAll();)

  // Init
  refreshAll();
})();
