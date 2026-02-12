/* HAYEK SPOT — Admin (Users + Invoices + Operations + PDF) */
/* admin.js — لوحة الإدارة (فواتير + مستخدمين + PDF بنفس تنسيق المستخدم) */
(() => {
  const $ = (id) => document.getElementById(id);

  // ===== Elements =====
  const lock = $("lock");
  const goLogin = $("goLogin");
  const onlineDot = $("onlineDot");
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
  const closeAddModalBtn = $("closeAddModal");
  const addUserBtn = $("addUserBtn");
  const newUsername = $("newUsername");
  const newPass = $("newPass");
  const newIsAdmin = $("newIsAdmin");
  const saveUserBtn = $("saveUserBtn");
  const addUserMsg = $("addUserMsg");

  // Invoices modal
  const invModalBack = $("invModalBack");
  const closeInvModalBtn = $("closeInvModal");
  const invModalTitle = $("invModalTitle");
  const invSearch = $("invSearch");
  const invTbody = $("invTbody");
  const reloadInvBtn = $("reloadInvBtn");
  // ===== AUTH Gate =====
  if (!window.HAYEK_AUTH || !window.__HAYEK_AUTH_LOADED__ || !window.HAYEK_AUTH.isAuthed()) {
    location.href = "index.html?v=" + Date.now();
    return;
  }
  const session = window.HAYEK_AUTH.getUser() || {};
  if (session.role !== "admin") {
    location.href = "invoice.html?v=" + Date.now();
    return;
  }

  // Operations modal
  const opsModalBack = $("opsModalBack");
  const closeOpsModalBtn = $("closeOpsModal");
  const opsModalTitle = $("opsModalTitle");
  const opsMeta = $("opsMeta");
  const opsTbody = $("opsTbody");
  const exportPdfBtn = $("exportPdfBtn");
  // ===== Net dot =====
  const netDot = $("netDot");
  function updateNet() {
    const on = navigator.onLine;
    netDot.classList.toggle("online", on);
    netDot.classList.toggle("offline", !on);
    netDot.title = on ? "متصل" : "غير متصل";
  }
  window.addEventListener("online", updateNet);
  window.addEventListener("offline", updateNet);

  // ===== Toast =====
  function toast(elId, msg, bad = false) {
    const el = $(elId);
    el.style.display = "block";
    el.textContent = msg;
    el.style.borderColor = bad ? "#ff5a6b88" : "#27d17f66";
    el.style.background = bad ? "#7a1f2a66" : "#07131a66";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.style.display = "none"), 2400);
  }

  // ===== Helpers =====
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
@@ -51,628 +44,543 @@
      .replaceAll("'", "&#039;");
  }

  function setOnlineDot() {
    if (!onlineDot) return;
    const on = navigator.onLine;
    onlineDot.style.background = on ? "#49e39a" : "#ff6b6b";
    onlineDot.style.boxShadow = on
      ? "0 0 0 6px rgba(73,227,154,.12)"
      : "0 0 0 6px rgba(255,107,107,.12)";
  }
  window.addEventListener("online", setOnlineDot);
  window.addEventListener("offline", setOnlineDot);
  setOnlineDot();

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

  // ===== Auth guard =====
  function hardLock() {
    if (lock) lock.style.display = "flex";
    if (goLogin) goLogin.onclick = () => (location.href = "index.html?v=" + Date.now());
  function fmtDT(d) {
    if (!d) return "—";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return `${hh}:${mm} ${y}/${m}/${day}`;
  }

  if (!window.HAYEK_AUTH || !window.__HAYEK_AUTH_LOADED__ || !window.HAYEK_AUTH.isAuthed()) {
    hardLock();
    return;
  function num(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0";
    return String(Math.round(x * 1000000) / 1000000);
  }

  const session = window.HAYEK_AUTH.getUser() || {};
  if (session.role !== "admin") {
    hardLock();
  // ===== Supabase =====
  const CFG = window.HAYEK_CONFIG || {};
  const hasDB = !!(window.supabase && CFG.supabaseUrl && CFG.supabaseKey);
  if (!hasDB) {
    alert("Supabase غير جاهز (config.js).");
    return;
  }
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);

  if (lock) lock.style.display = "none";
  const T_USERS = (CFG.tables && CFG.tables.users) || "app_users";
  const T_INV = (CFG.tables && CFG.tables.invoices) || "app_invoices";
  const T_OPS = (CFG.tables && CFG.tables.operations) || "app_operations";

  if (logoutBtn) {
    logoutBtn.onclick = () => {
      window.HAYEK_AUTH.logout();
      location.href = "index.html?v=" + Date.now();
    };
  }

  // ===== Supabase client + table names =====
  function getConfig() {
    const A = window.HAYEK_CONFIG || {};
    const B = window.APP_CONFIG || {};
  // ===== UI refs =====
  $("adminName").textContent = session.username || "admin";

    const supabaseUrl = A.supabaseUrl || A.SUPABASE_URL || B.SUPABASE_URL || "";
    const supabaseKey = A.supabaseKey || A.SUPABASE_ANON_KEY || B.SUPABASE_ANON_KEY || "";
  const invTbody = $("invTbody");
  const usersTbody = $("usersTbody");

    const tables = {
      users: (A.tables && A.tables.users) || B.TABLE_USERS || "app_users",
      invoices: (A.tables && A.tables.invoices) || B.TABLE_INVOICES || "app_invoices",
      operations: (A.tables && A.tables.operations) || B.TABLE_OPERATIONS || "app_operations",
    };
  const dInvId = $("dInvId");
  const dUser = $("dUser");
  const dCust = $("dCust");
  const dTotal = $("dTotal");
  const dStatus = $("dStatus");

    return { supabaseUrl, supabaseKey, tables };
  }
  const btnViewOps = $("btnViewOps");
  const btnPDF = $("btnPDF");

  let SB;
  try {
    const cfg = getConfig();
    if (!cfg.supabaseUrl || !cfg.supabaseKey) {
      throw new Error("config.js ناقص: supabaseUrl/supabaseKey");
    }
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("مكتبة supabase-js غير محملة");
    }
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    SB = { sb, tables: cfg.tables };
  } catch (e) {
    console.error("Supabase init error:", e);
    alert("خطأ إعداد Supabase:\n" + e.message);
    return;
  }
  const opsModalBack = $("opsModalBack");
  const opsTbody = $("opsTbody");
  const opsMeta = $("opsMeta");
  const opsTotal = $("opsTotal");
  const pdfStage = $("pdfStage");

  // ===== State =====
  let users = [];
  let invoiceCounts = new Map();
  let currentUserForInvoices = null;
  let invoicesForUser = [];
  let currentInvoiceForOps = null;
  let operationsForInvoice = [];

  // ===== Data functions =====
  async function fetchUsers() {
    const { sb } = SB;
    const T = SB.tables.users;
    const { data, error } = await sb
      .from(T)
      .select("id,username,is_admin,blocked,created_at,device_id,last_seen")
      .order("username", { ascending: true });
    if (error) {
      console.error("fetchUsers error:", error);
      return [];
    }
    return data || [];
  }

  async function computeActiveUsers24h(list) {
    const since = Date.now() - 24 * 3600 * 1000;
    let n = 0;
    for (const u of list) {
      if (!u.last_seen) continue;
      const t = new Date(u.last_seen).getTime();
      if (Number.isFinite(t) && t >= since) n++;
    }
    return n;
  }

  async function countInvoicesForUsers(sinceISO) {
    const { sb } = SB;
    const T = SB.tables.invoices;
    invoiceCounts = new Map();

    let q = sb.from(T).select("id,created_at,username");
    if (sinceISO) q = q.gte("created_at", sinceISO);

    const { data, error } = await q;
    if (error) {
      console.warn("countInvoices error:", error);
      return { totalInvoices: 0 };
    }

    let totalInvoices = 0;
    for (const inv of data || []) {
      totalInvoices++;
      const key = inv.username ?? null;
      if (key) invoiceCounts.set(String(key), (invoiceCounts.get(String(key)) || 0) + 1);
    }
    return { totalInvoices };
  let invoices = [];
  let selectedInvoice = null;
  let selectedOps = [];

  // ===== Tabs =====
  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      const tab = b.dataset.tab;
      document.querySelectorAll(".tabpane").forEach((p) => p.classList.add("hidden"));
      $("tab-" + tab).classList.remove("hidden");
    });
  });

  // ===== Buttons top =====
  $("btnLogout").onclick = () => {
    window.HAYEK_AUTH.logout();
    location.href = "index.html?v=" + Date.now();
  };
  $("btnRefresh").onclick = async () => {
    updateNet();
    await loadInvoices();
    await loadUsers();
    toast("toastSide", "تم التحديث.");
  };

  // ===== Invoices =====
  function setSelectedInvoice(inv) {
    selectedInvoice = inv;
    dInvId.value = inv?.id ?? "";
    dUser.value = inv?.username ?? "";
    dCust.value = inv?.customer_name ?? "";
    dTotal.value = num(inv?.total ?? 0);
    dStatus.value = inv?.status ?? "";

    btnViewOps.disabled = !inv;
    btnPDF.disabled = !inv;
  }

  // ===== UI render =====
  function badgeRole(u) {
    return u.is_admin
      ? `<span class="badge blue">أدمن</span>`
      : `<span class="badge">مستخدم</span>`;
  function kpiUpdate() {
    $("kpiInvoices").textContent = String(invoices.length);
    const sum = invoices.reduce((a, r) => a + Number(r.total || 0), 0);
    $("kpiTotal").textContent = num(sum);
  }

  function badgeStatus(u) {
    return u.blocked
      ? `<span class="badge red">محظور</span>`
      : `<span class="badge green">نشط</span>`;
  function filterInvoices(list, q) {
    const s = (q || "").trim().toLowerCase();
    if (!s) return list;

    return list.filter((r) => {
      const id6 = String(r.id || "").slice(-6);
      return (
        String(r.username || "").toLowerCase().includes(s) ||
        String(r.customer_name || "").toLowerCase().includes(s) ||
        id6.includes(s) ||
        String(r.id || "").toLowerCase().includes(s)
      );
    });
  }

  function renderUsers() {
    if (!usersTbody) return;

    const term = (searchUser?.value || "").trim().toLowerCase();

    const html = users
      .filter((u) => (u.username || "").toLowerCase().includes(term))
      .map((u) => {
        const invCount = invoiceCounts.get(String(u.username)) ?? 0;
        const last = timeAgo(u.last_seen);
  function renderInvoices() {
    const q = $("qInvoices").value;
    const list = filterInvoices(invoices, q);

    invTbody.innerHTML = list
      .map((r) => {
        const id6 = String(r.id || "").slice(-6);
        const status = r.status || "—";
        return `
          <tr>
            <td>${escapeHtml(fmtDT(r.created_at || r.closed_at))}</td>
            <td>${escapeHtml(r.username || "—")}</td>
            <td>${escapeHtml(r.customer_name || "—")}</td>
            <td class="num">${escapeHtml(num(r.total || 0))}</td>
            <td>${escapeHtml(status)}</td>
            <td>${escapeHtml(id6)}</td>
            <td>
              <b style="color:#9fd0ff">${escapeHtml(u.username || "")}</b>
              <span class="badge amber" style="margin-inline-start:8px">(${invCount})</span>
            </td>
            <td>${badgeRole(u)}</td>
            <td>${badgeStatus(u)}</td>
            <td>${escapeHtml(last)}</td>
            <td>
              <div class="actions">
                <button class="mini" data-act="invoices" data-id="${escapeHtml(u.username)}">الفواتير</button>
                ${u.blocked
                  ? `<button class="mini green" data-act="unblock" data-id="${escapeHtml(u.username)}">فك حظر</button>`
                  : `<button class="mini red" data-act="block" data-id="${escapeHtml(u.username)}">حظر</button>`}
                ${u.is_admin
                  ? `<button class="mini" data-act="rmAdmin" data-id="${escapeHtml(u.username)}">إلغاء أدمن</button>`
                  : `<button class="mini blue" data-act="mkAdmin" data-id="${escapeHtml(u.username)}">جعله أدمن</button>`}
                <button class="mini red" data-act="delete" data-id="${escapeHtml(u.username)}">حذف</button>
              <div class="rowBtns">
                <button class="btn" data-act="select" data-id="${escapeHtml(String(r.id))}">تحديد</button>
                <button class="btn primary" data-act="ops" data-id="${escapeHtml(String(r.id))}">العمليات</button>
                <button class="btn" data-act="pdf" data-id="${escapeHtml(String(r.id))}">PDF</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    usersTbody.innerHTML = html || `<tr><td colspan="5" style="color:#a7bdd0">لا يوجد نتائج</td></tr>`;
    kpiUpdate();
  }

  // ===== Refresh =====
  async function refreshAll() {
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "…";
    }
  async function loadInvoices() {
    try {
      const sinceISO = rangeToSince(rangeSel?.value);
      users = await fetchUsers();

      if (stUsers) stUsers.textContent = String(users.length);
      const active = await computeActiveUsers24h(users);
      if (stActive) stActive.textContent = String(active);

      const { totalInvoices } = await countInvoicesForUsers(sinceISO);
      if (stInvoices) stInvoices.textContent = String(totalInvoices);

      renderUsers();
    } catch (e) {
      console.error("refreshAll error:", e);
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = "تحديث";
      const { data, error } = await sb
        .from(T_INV)
        .select("id, username, customer_name, total, status, created_at, closed_at, device_id")
        .order("created_at", { ascending: false });

      if (error) throw error;
      invoices = data || [];
      renderInvoices();

      if (selectedInvoice) {
        const keep = invoices.find((x) => String(x.id) === String(selectedInvoice.id));
        if (keep) setSelectedInvoice(keep);
      }
      toast("toastInv", "تم تحميل الفواتير.");
    } catch (e) {
      console.error(e);
      toast("toastInv", "فشل تحميل الفواتير: " + (e.message || e), true);
    }
  }

  if (rangeSel) rangeSel.onchange = refreshAll;
  if (searchUser) searchUser.oninput = renderUsers;
  if (refreshBtn) refreshBtn.onclick = refreshAll;
  $("btnLoadInvoices").onclick = loadInvoices;
  $("qInvoices").addEventListener("input", renderInvoices);

  // ===== Users actions =====
  if (usersTbody) {
    usersTbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
  invTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    const inv = invoices.find((x) => String(x.id) === String(id));
    if (!inv) return;

      const act = btn.getAttribute("data-act");
      const username = btn.getAttribute("data-id");
      const u = users.find((x) => x.username === username);
      if (!u) return;
    if (act === "select") {
      setSelectedInvoice(inv);
      toast("toastSide", "تم تحديد الفاتورة.");
      return;
    }
    if (act === "ops") {
      setSelectedInvoice(inv);
      await openOpsModal(inv);
      return;
    }
    if (act === "pdf") {
      setSelectedInvoice(inv);
      await exportInvoicePDF(inv);
      return;
    }
  });

  // ===== Operations (حل مشكلة الملف الفارغ) =====
  function mapOpRow(r) {
    // نحاول نقرأ حسب أي أسماء أعمدة عندك
    const t =
      r.t ||
      r.time ||
      (r.created_at ? fmtDT(r.created_at) : "") ||
      "";

    const text = r.text ?? r.label ?? r.note ?? r.lineText ?? "عملية";
    const expr = r.expr ?? r.operation ?? r.op ?? "";
    const result = r.result ?? r.res ?? r.value ?? "";

    return { t, text, expr, result };
  }

      if (act === "invoices") {
        openInvoicesModal(u);
        return;
      }
  async function fetchOpsForInvoice(invoiceId) {
    // نجرب أعمدة الربط المختلفة حتى ما يرجع فاضي
    const candidates = ["invoiceId", "invoice_id", "invoiceID", "inv_id"];
    let lastErr = null;

    for (const col of candidates) {
      try {
        if (act === "block") {
          if (!confirm(`حظر ${u.username}؟`)) return;
          await SB.sb.from(SB.tables.users).update({ blocked: true }).eq("id", u.id);
        }
        if (act === "unblock") {
          if (!confirm(`فك حظر ${u.username}؟`)) return;
          await SB.sb.from(SB.tables.users).update({ blocked: false }).eq("id", u.id);
        }
        if (act === "mkAdmin") {
          if (!confirm(`جعل ${u.username} أدمن؟`)) return;
          await SB.sb.from(SB.tables.users).update({ is_admin: true }).eq("id", u.id);
        }
        if (act === "rmAdmin") {
          if (!confirm(`إلغاء أدمن عن ${u.username}؟`)) return;
          await SB.sb.from(SB.tables.users).update({ is_admin: false }).eq("id", u.id);
        }
        if (act === "delete") {
          if (!confirm(`حذف ${u.username} نهائيًا؟`)) return;
          await SB.sb.from(SB.tables.users).delete().eq("id", u.id);
        }
      } catch (err) {
        console.error("User action error:", err);
        alert("خطأ أثناء العملية:\n" + (err?.message || err));
      }

      await refreshAll();
    });
  }

  // ===== Add user modal =====
  if (addUserBtn) addUserBtn.onclick = () => { if (addModalBack) addModalBack.style.display = "flex"; };
  if (closeAddModalBtn) closeAddModalBtn.onclick = () => { if (addModalBack) addModalBack.style.display = "none"; };
  if (addModalBack) addModalBack.onclick = (e) => { if (e.target === addModalBack) addModalBack.style.display = "none"; };
        // لا تستخدم order(line_no) لأنه غير موجود ويسبب 400
        let q = sb.from(T_OPS).select("*").eq(col, invoiceId);

  if (saveUserBtn) {
    saveUserBtn.onclick = async () => {
      const username = (newUsername?.value || "").trim();
      const pass = (newPass?.value || "").trim();
      const is_admin = !!newIsAdmin?.checked;
        // إن كان created_at موجود رتّب به
        q = q.order("created_at", { ascending: true });

      if (!username || !pass) {
        if (addUserMsg) addUserMsg.textContent = "املأ الاسم وكلمة السر";
        return;
        const { data, error } = await q;
        if (!error) return { data: data || [], usedCol: col };
        lastErr = error;
      } catch (e) {
        lastErr = e;
      }
    }

    // fallback بدون order
    for (const col of candidates) {
      try {
        const { error } = await SB.sb.from(SB.tables.users).insert({ username, pass, is_admin, blocked: false });
        if (error) throw error;
        if (addUserMsg) addUserMsg.textContent = "تم الإضافة ✅";
        setTimeout(() => { if (addModalBack) addModalBack.style.display = "none"; }, 650);
        await refreshAll();
        const { data, error } = await sb.from(T_OPS).select("*").eq(col, invoiceId);
        if (!error) return { data: data || [], usedCol: col };
        lastErr = error;
      } catch (e) {
        console.error(e);
        if (addUserMsg) addUserMsg.textContent = "فشل: " + (e.message || e);
        lastErr = e;
      }
    };
  }

  // ===== Invoices modal =====
  function openInvoicesModal(user) {
    currentUserForInvoices = user;
    invoicesForUser = [];
    if (invModalTitle) invModalTitle.textContent = `فواتير: ${user.username}`;
    if (invSearch) invSearch.value = "";
    if (invTbody) invTbody.innerHTML = "";
    if (invModalBack) invModalBack.style.display = "flex";
    loadInvoicesForCurrentUser();
  }

  function closeInvModal() {
    if (invModalBack) invModalBack.style.display = "none";
    currentUserForInvoices = null;
    invoicesForUser = [];
  }

  if (closeInvModalBtn) closeInvModalBtn.onclick = closeInvModal;
  if (invModalBack) invModalBack.addEventListener("click", (e) => { if (e.target === invModalBack) closeInvModal(); });

  async function loadInvoicesForCurrentUser() {
    if (!currentUserForInvoices) return;

    const { sb } = SB;
    const T = SB.tables.invoices;
    const sinceISO = rangeToSince(rangeSel?.value);

    let q = sb.from(T).select("*").order("created_at", { ascending: false }).limit(300);
    if (sinceISO) q = q.gte("created_at", sinceISO);

    const { data, error } = await q.eq("username", currentUserForInvoices.username);

    if (error) {
      console.error(error);
      if (invTbody) invTbody.innerHTML = `<tr><td colspan="5">خطأ: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }

    invoicesForUser = data || [];
    renderInvoices();
    throw lastErr || new Error("فشل جلب العمليات");
  }

  function renderInvoices() {
    if (!invTbody) return;

    const term = (invSearch?.value || "").trim().toLowerCase();
    const filtered = invoicesForUser.filter(inv => {
      const fields = [inv.customer_name, inv.customer, inv.invoice_no, inv.code, inv.id, inv.created_at];
      return fields.some(f => String(f || "").toLowerCase().includes(term));
    });
  function renderOpsTable(rows) {
    opsTbody.innerHTML = rows
      .map((r, i) => {
        return `
          <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(r.t || "")}</td>
            <td>${escapeHtml(r.text || "—")}</td>
            <td>${escapeHtml(r.expr || "")}</td>
            <td class="num">${escapeHtml(String(r.result ?? ""))}</td>
          </tr>
        `;
      })
      .join("");

    invTbody.innerHTML = filtered.map(inv => {
      const date = inv.created_at ? new Date(inv.created_at).toLocaleString("ar-EG") : "—";
      const cust = inv.customer_name || inv.customer || "—";
      const total = inv.total ?? inv.grand_total ?? inv.amount ?? "—";
      const code = inv.invoice_no || inv.code || String(inv.id || "").slice(-6) || "—";

      return `
        <tr>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(cust)}</td>
          <td><b>${escapeHtml(String(total))}</b></td>
          <td>${escapeHtml(String(code))}</td>
          <td>
            <button class="mini blue" data-act="ops" data-id="${escapeHtml(inv.id)}">العمليات</button>
            <button class="mini" data-act="viewJson" data-id="${escapeHtml(inv.id)}">عرض</button>
          </td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="5" style="color:#a7bdd0">لا فواتير</td></tr>`;
    const total = rows.reduce((a, x) => a + Number(x.result || 0), 0);
    opsTotal.textContent = num(total);
  }

  if (invSearch) invSearch.oninput = renderInvoices;
  if (reloadInvBtn) reloadInvBtn.onclick = loadInvoicesForCurrentUser;

  if (invTbody) {
    invTbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
  async function openOpsModal(inv) {
    try {
      opsModalBack.style.display = "flex";
      opsTbody.innerHTML = `<tr><td colspan="5">جارِ التحميل...</td></tr>`;
      opsMeta.textContent = `فاتورة: ${String(inv.id).slice(-6)} — المستخدم: ${inv.username || "—"} — الزبون: ${inv.customer_name || "—"}`;

      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      const inv = invoicesForUser.find(i => String(i.id) === String(id));
      if (!inv) return;
      const { data, usedCol } = await fetchOpsForInvoice(inv.id);
      selectedOps = (data || []).map(mapOpRow);

      if (act === "viewJson") {
        alert(JSON.stringify(inv, null, 2));
        return;
      }
      renderOpsTable(selectedOps);

      if (act === "ops") {
        openOperationsModal(inv);
        return;
      if (!selectedOps.length) {
        toast("toastOps", "لا توجد عمليات لهذه الفاتورة (تحقق من عمود الربط).", true);
        console.warn("No ops returned. Used column:", usedCol);
      } else {
        toast("toastOps", `تم جلب العمليات (${selectedOps.length}) ✓`);
      }
    });
  }

  // ===== Operations modal =====
  function openOperationsModal(inv) {
    currentInvoiceForOps = inv;
    operationsForInvoice = [];
    if (opsModalTitle) opsModalTitle.textContent = `عمليات الفاتورة: ${String(inv.id).slice(-6)}`;

    if (opsMeta) {
      const cust = inv.customer_name || inv.customer || "—";
      const total = inv.total ?? "—";
      const date = inv.created_at ? new Date(inv.created_at).toLocaleString("ar-EG") : "—";
      opsMeta.innerHTML = `
        <div style="color:#a7bdd0;font-size:13px;display:flex;gap:10px;flex-wrap:wrap">
          <span>المستخدم: <b style="color:#eaf4ff">${escapeHtml(inv.username || currentUserForInvoices?.username || "—")}</b></span>
          <span>الزبون: <b style="color:#eaf4ff">${escapeHtml(cust)}</b></span>
          <span>التاريخ: <b style="color:#eaf4ff">${escapeHtml(date)}</b></span>
          <span>الإجمالي: <b style="color:#49e39a">${escapeHtml(String(total))}</b></span>
        </div>
      `;
    }

    if (opsTbody) opsTbody.innerHTML = `<tr><td colspan="5" style="color:#a7bdd0">... جاري التحميل</td></tr>`;
    if (opsModalBack) opsModalBack.style.display = "flex";
    loadOperationsForInvoice(inv);
  }

  function closeOpsModal() {
    if (opsModalBack) opsModalBack.style.display = "none";
    currentInvoiceForOps = null;
    operationsForInvoice = [];
  }

  if (closeOpsModalBtn) closeOpsModalBtn.onclick = closeOpsModal;
  if (opsModalBack) opsModalBack.addEventListener("click", (e) => { if (e.target === opsModalBack) closeOpsModal(); });

  // ✅ أهم تعديل: نبحث بـ invoiceId (الموجود عندك) + بدون order(line_no)
  async function loadOperationsForInvoice(inv) {
    const { sb } = SB;
    const T = SB.tables.operations;

    // جرّب invoiceId أولاً (لأنه موجود عندك)
    let { data, error } = await sb
      .from(T)
      .select("*")
      .eq("invoiceId", inv.id)
      .order("created_at", { ascending: true });

    // fallback قديم إذا عندك ناسخة ثانية
    if (error) {
      console.warn("ops eq invoiceId failed:", error);
      const r1 = await sb.from(T).select("*").eq("invoice_id", inv.id).order("created_at", { ascending: true });
      data = r1.data; error = r1.error;
    }
    if (error) {
      console.warn("ops eq invoice_id failed:", error);
      const r2 = await sb.from(T).select("*").eq("inv_id", inv.id).order("created_at", { ascending: true });
      data = r2.data; error = r2.error;
    }

    if (error) {
      console.error("loadOperations error:", error);
      if (opsTbody) opsTbody.innerHTML = `<tr><td colspan="5">خطأ: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }

    operationsForInvoice = data || [];
    renderOperations();
  }

  function renderOperations() {
    if (!opsTbody) return;

    if (!operationsForInvoice.length) {
      opsTbody.innerHTML = `<tr><td colspan="5" style="color:#a7bdd0">لا توجد عمليات لهذه الفاتورة</td></tr>`;
      return;
    } catch (e) {
      console.error(e);
      opsTbody.innerHTML = `<tr><td colspan="5">فشل جلب العمليات: ${escapeHtml(e.message || String(e))}</td></tr>`;
      toast("toastOps", "فشل جلب العمليات.", true);
    }

    opsTbody.innerHTML = operationsForInvoice.map((r, idx) => {
      const t = r.t || r.time || r.created_time || r.created_at || "";
      const text = r.text || r.line_text || r.note || r.label || "";
      const expr = r.expr || r.operation || r.op || "";
      const result = r.result ?? r.value ?? "";
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(String(t))}</td>
          <td>${escapeHtml(String(text || "—"))}</td>
          <td>${escapeHtml(String(expr || "—"))}</td>
          <td><b>${escapeHtml(String(result))}</b></td>
        </tr>
      `;
    }).join("");
  }

  // ===== PDF export (كما هو) =====
  function buildOpsHtml(inv, ops) {
    const cust = inv.customer_name || inv.customer || "—";
    const total = inv.total ?? "—";
    const date = inv.created_at ? new Date(inv.created_at).toLocaleString("ar-EG") : "—";
    const uname = inv.username || currentUserForInvoices?.username || "—";
    const invNo = inv.invoice_no || inv.code || String(inv.id).slice(-6);

    const rows = (ops || []).map((r, i) => {
      const t = r.t || r.time || "";
      const text = r.text || r.line_text || r.note || r.label || "";
      const expr = r.expr || r.operation || "";
      const result = r.result ?? r.value ?? "";
      return `
        <tr>
          <td style="border:1px solid #111;padding:8px;text-align:center">${i + 1}</td>
          <td style="border:1px solid #111;padding:8px;text-align:center">${escapeHtml(String(t))}</td>
          <td style="border:1px solid #111;padding:8px;text-align:right">${escapeHtml(String(text || "—"))}</td>
          <td style="border:1px solid #111;padding:8px;text-align:center">${escapeHtml(String(expr || "—"))}</td>
          <td style="border:1px solid #111;padding:8px;text-align:center;font-weight:900">${escapeHtml(String(result))}</td>
        </tr>
      `;
    }).join("");
  $("btnCloseOps").onclick = () => (opsModalBack.style.display = "none");
  opsModalBack.addEventListener("click", (e) => {
    if (e.target === opsModalBack) opsModalBack.style.display = "none";
  });

  btnViewOps.onclick = async () => {
    if (!selectedInvoice) return;
    await openOpsModal(selectedInvoice);
  };

  // ===== PDF Template (نفس ملف المستخدم) =====
  function buildInvoiceHtmlLikeUser(inv, opsRows) {
    const rowsHtml = (opsRows || []).map((r, i) => `
      <tr>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:10%">${i + 1}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:16%">${escapeHtml(r.t || "")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:right;width:34%">${escapeHtml(r.text || "عملية")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:20%">${escapeHtml(r.expr || "")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:20%;font-weight:900">${escapeHtml(String(r.result ?? ""))}</td>
      </tr>
    `).join("");

    const invNo = String(inv.id || "").slice(-6);
    const total = num(inv.total ?? opsRows.reduce((a, x) => a + Number(x.result || 0), 0));

    return `
      <div style="direction:rtl;font-family:Arial,system-ui;background:#fff;color:#111;padding:18px">
        <div style="border:2px solid #111;border-radius:14px;padding:14px">
          <div style="text-align:center;font-weight:900;font-size:24px;margin-bottom:4px">شركة الحايك</div>
          <div style="text-align:center;font-weight:900;font-size:20px;color:#0a7c3a;margin-bottom:10px">HAYEK SPOT</div>

          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;line-height:1.8;margin-bottom:8px">
            <div>اسم المستخدم: <b>${escapeHtml(uname)}</b></div>
            <div>رقم الفاتورة: <b>${escapeHtml(String(invNo))}</b></div>
            <div>اسم الزبون: <b>${escapeHtml(cust)}</b></div>
            <div>التاريخ: <b>${escapeHtml(date)}</b></div>
      <div style="direction:rtl;font-family:Arial,system-ui; background:#fff; color:#111; padding:18px;">
        <div style="border:2px solid #111;border-radius:14px;padding:16px;">
          <!-- أعلى الملف -->
          <div style="text-align:center;font-weight:900;font-size:24px;margin-bottom:4px;">شركة الحايك</div>
          <div style="text-align:center;font-weight:900;font-size:20px;color:#0a7c3a;margin-bottom:10px;">HAYEK SPOT</div>

          <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;margin-bottom:10px;flex-wrap:wrap">
            <div>اسم الزبون: <b>${escapeHtml(inv.customer_name || "-")}</b></div>
            <div>اسم المستخدم: <b>${escapeHtml(inv.username || "-")}</b></div>
            <div>رقم الفاتورة: <b>${escapeHtml(invNo)}</b></div>
            <div>التاريخ: <b>${new Date().toLocaleString("ar")}</b></div>
          </div>

          <div style="border-top:1px solid #111;margin:10px 0"></div>

          <div style="font-weight:900;margin:6px 0 10px">جدول العمليات</div>
          <div style="font-weight:900;margin:6px 0 10px;">تفاصيل العمليات</div>

          <table style="width:100%;border-collapse:collapse;font-size:13px">
          <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff">
            <thead>
              <tr style="background:#f3f3f3">
                <th style="border:1px solid #111;padding:8px;text-align:center">#</th>
                <th style="border:1px solid #111;padding:8px;text-align:center">الوقت</th>
                <th style="border:1px solid #111;padding:8px;text-align:center">البيان</th>
                <th style="border:1px solid #111;padding:8px;text-align:center">العملية</th>
                <th style="border:1px solid #111;padding:8px;text-align:center">النتيجة</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">#</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">الوقت</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">البيان</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">العملية</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">النتيجة</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="5" style="border:1px solid #111;padding:14px;text-align:center;color:#666">لا يوجد عمليات</td></tr>`}
              ${rowsHtml || `<tr><td colspan="5" style="border:1px solid #111;padding:14px;text-align:center;color:#666">لا يوجد عمليات</td></tr>`}
            </tbody>
          </table>

          <div style="margin-top:12px;border:2px dashed #111;border-radius:12px;padding:10px;display:flex;justify-content:space-between;font-weight:900">
            <span>إجمالي الكشف:</span>
            <span>${escapeHtml(String(total))}</span>
            <span>${escapeHtml(total)}</span>
          </div>

          <!-- أسفل الملف -->
          <div style="margin-top:12px;border:2px solid #111;border-radius:14px;padding:12px;text-align:center;font-size:12px;line-height:1.8">
            تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك<br/>
            شركة الحايك / تجارة عامة / توزيع جملة / دعاية و اعلان / طباعة / حلول رقمية<br/>
            <span style="display:inline-block;margin-top:8px;border:2px solid #0a7c3a;color:#0a7c3a;border-radius:12px;padding:8px 16px;font-weight:900;font-size:16px;">05510217646</span>
          </div>
        </div>
      </div>
    `;
  }

  async function exportOpsPdf() {
    if (!currentInvoiceForOps) return;
    try {
      const tmp = document.createElement("div");
      tmp.style.position = "fixed";
      tmp.style.left = "-99999px";
      tmp.style.top = "0";
      tmp.style.width = "794px";
      tmp.innerHTML = buildOpsHtml(currentInvoiceForOps, operationsForInvoice);
      document.body.appendChild(tmp);

      const canvas = await html2canvas(tmp, { scale: 2, backgroundColor: "#ffffff" });
      tmp.remove();

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) throw new Error("jsPDF not loaded");

      const pdf = new jsPDF("p", "pt", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const imgW = pageW;
      const imgH = canvas.height * (imgW / canvas.width);

      let y = 0;
      let remaining = imgH;

      while (remaining > 0) {
        pdf.addImage(imgData, "JPEG", 0, y, imgW, imgH);
        remaining -= pageH;
        if (remaining > 0) {
          pdf.addPage();
          y -= pageH;
        }
  async function exportAsPdfFromHtml(html, filename) {
    // نستخدم pdfStage (موجود بالصفحة) لضمان عدم اختفاء الجدول
    pdfStage.innerHTML = html;

    const canvas = await html2canvas(pdfStage, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "pt", "a4");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = canvas.height * (imgW / canvas.width);

    let y = 0;
    let remaining = imgH;

    while (remaining > 0) {
      pdf.addImage(imgData, "JPEG", 0, y, imgW, imgH);
      remaining -= pageH;
      if (remaining > 0) {
        pdf.addPage();
        y -= pageH;
      }
    }

    pdf.save(filename);
    pdfStage.innerHTML = "";
  }

  async function exportInvoicePDF(inv) {
    try {
      toast("toastSide", "جارِ تجهيز PDF...");

      // لازم نجيب العمليات من DB حتى لا يطلع فاضي
      const { data } = await fetchOpsForInvoice(inv.id);
      const opsRows = (data || []).map(mapOpRow);

      const html = buildInvoiceHtmlLikeUser(inv, opsRows);
      const cust = (inv.customer_name || "invoice").trim().replace(/\s+/g, "_");
      const invNo = String(inv.id || "").slice(-6);
      await exportAsPdfFromHtml(html, `HAYEK_${cust}_${invNo}.pdf`);

      const uname = currentInvoiceForOps.username || currentUserForInvoices?.username || "user";
      const id6 = String(currentInvoiceForOps.id || "").slice(-6);
      pdf.save(`OPS_${uname}_${id6}_${Date.now()}.pdf`);
      toast("toastSide", "تم تصدير PDF ✓");
    } catch (e) {
      console.error("PDF export error:", e);
      alert("فشل تصدير PDF");
      console.error(e);
      toast("toastSide", "فشل تصدير PDF: " + (e.message || e), true);
    }
  }

  if (exportPdfBtn) exportPdfBtn.onclick = exportOpsPdf;
  btnPDF.onclick = async () => {
    if (!selectedInvoice) return;
    await exportInvoicePDF(selectedInvoice);
  };

  // ===== Init =====
  refreshAll();
  $("btnOpsPDF").onclick = async () => {
    if (!selectedInvoice) {
      toast("toastOps", "حدد فاتورة أولاً.", true);
      return;
    }
    await exportInvoicePDF(selectedInvoice);
  };

  // ===== Users management =====
  function filterUsers(list, q) {
    const s = (q || "").trim().toLowerCase();
    if (!s) return list;
    return list.filter((u) => String(u.username || "").toLowerCase().includes(s));
  }

  let users = [];

  function renderUsers() {
    const q = $("qUsers").value;
    const list = filterUsers(users, q);

    usersTbody.innerHTML = list
      .map((u) => {
        return `
          <tr>
            <td>${escapeHtml(String(u.id ?? ""))}</td>
            <td>${escapeHtml(u.username || "")}</td>
            <td>${u.is_admin ? "TRUE" : "FALSE"}</td>
            <td>${u.blocked ? "TRUE" : "FALSE"}</td>
            <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(u.device_id || "")}</td>
            <td>${escapeHtml(fmtDT(u.last_seen || u.created_at))}</td>
            <td>
              <div class="rowBtns">
                <button class="btn" data-act="clearDevice" data-id="${escapeHtml(String(u.id))}">مسح الجهاز</button>
                <button class="btn ${u.blocked ? "primary" : "danger"}" data-act="toggleBlock" data-id="${escapeHtml(String(u.id))}">
                  ${u.blocked ? "فك الحظر" : "حظر"}
                </button>
                <button class="btn danger" data-act="delete" data-id="${escapeHtml(String(u.id))}">حذف</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadUsers() {
    try {
      const { data, error } = await sb
        .from(T_USERS)
        .select("id, username, pass, is_admin, blocked, created_at, device_id, last_seen")
        .order("id", { ascending: true });

      if (error) throw error;
      users = data || [];
      renderUsers();
      toast("toastUsers", "تم تحميل المستخدمين.");
    } catch (e) {
      console.error(e);
      toast("toastUsers", "فشل تحميل المستخدمين: " + (e.message || e), true);
    }
  }

  $("btnLoadUsers").onclick = loadUsers;
  $("qUsers").addEventListener("input", renderUsers);

  usersTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    const user = users.find((x) => String(x.id) === String(id));
    if (!user) return;

    if (act === "clearDevice") {
      if (!confirm(`مسح device_id للمستخدم: ${user.username} ؟`)) return;
      try {
        await sb.from(T_USERS).update({ device_id: null }).eq("id", user.id);
        toast("toastUsers", "تم مسح الجهاز ✓");
        await loadUsers();
      } catch (err) {
        toast("toastUsers", "فشل مسح الجهاز", true);
      }
      return;
    }

    if (act === "toggleBlock") {
      const next = !user.blocked;
      if (!confirm(`${next ? "حظر" : "فك حظر"} المستخدم: ${user.username} ؟`)) return;
      try {
        await sb.from(T_USERS).update({ blocked: next }).eq("id", user.id);
        toast("toastUsers", "تم التنفيذ ✓");
        await loadUsers();
      } catch (err) {
        toast("toastUsers", "فشل التنفيذ", true);
      }
      return;
    }

    if (act === "delete") {
      if (!confirm(`حذف المستخدم نهائياً: ${user.username} ؟`)) return;
      try {
        await sb.from(T_USERS).delete().eq("id", user.id);
        toast("toastUsers", "تم حذف المستخدم ✓");
        await loadUsers();
      } catch (err) {
        toast("toastUsers", "فشل حذف المستخدم", true);
      }
      return;
    }
  });

  // ===== Boot =====
  async function boot() {
    updateNet();
    setSelectedInvoice(null);
    await loadInvoices();
    await loadUsers();
  }
  boot();
})();
