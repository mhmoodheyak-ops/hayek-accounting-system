/* HAYEK SPOT — Admin (Users + Invoices + Operations + PDF) */
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

  // Operations modal
  const opsModalBack = $("opsModalBack");
  const closeOpsModalBtn = $("closeOpsModal");
  const opsModalTitle = $("opsModalTitle");
  const opsMeta = $("opsMeta");
  const opsTbody = $("opsTbody");
  const exportPdfBtn = $("exportPdfBtn");

  // ===== Helpers =====
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
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

  if (lock) lock.style.display = "none";

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

    const supabaseUrl = A.supabaseUrl || A.SUPABASE_URL || B.SUPABASE_URL || "";
    const supabaseKey = A.supabaseKey || A.SUPABASE_ANON_KEY || B.SUPABASE_ANON_KEY || "";

    const tables = {
      users: (A.tables && A.tables.users) || B.TABLE_USERS || "app_users",
      invoices: (A.tables && A.tables.invoices) || B.TABLE_INVOICES || "app_invoices",
      operations: (A.tables && A.tables.operations) || B.TABLE_OPERATIONS || "app_operations",
    };

    return { supabaseUrl, supabaseKey, tables };
  }

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
  }

  // ===== UI render =====
  function badgeRole(u) {
    return u.is_admin
      ? `<span class="badge blue">أدمن</span>`
      : `<span class="badge">مستخدم</span>`;
  }

  function badgeStatus(u) {
    return u.blocked
      ? `<span class="badge red">محظور</span>`
      : `<span class="badge green">نشط</span>`;
  }

  function renderUsers() {
    if (!usersTbody) return;

    const term = (searchUser?.value || "").trim().toLowerCase();

    const html = users
      .filter((u) => (u.username || "").toLowerCase().includes(term))
      .map((u) => {
        const invCount = invoiceCounts.get(String(u.username)) ?? 0;
        const last = timeAgo(u.last_seen);

        return `
          <tr>
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
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    usersTbody.innerHTML = html || `<tr><td colspan="5" style="color:#a7bdd0">لا يوجد نتائج</td></tr>`;
  }

  // ===== Refresh =====
  async function refreshAll() {
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "…";
    }
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
      }
    }
  }

  if (rangeSel) rangeSel.onchange = refreshAll;
  if (searchUser) searchUser.oninput = renderUsers;
  if (refreshBtn) refreshBtn.onclick = refreshAll;

  // ===== Users actions =====
  if (usersTbody) {
    usersTbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const act = btn.getAttribute("data-act");
      const username = btn.getAttribute("data-id");
      const u = users.find((x) => x.username === username);
      if (!u) return;

      if (act === "invoices") {
        openInvoicesModal(u);
        return;
      }

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

  if (saveUserBtn) {
    saveUserBtn.onclick = async () => {
      const username = (newUsername?.value || "").trim();
      const pass = (newPass?.value || "").trim();
      const is_admin = !!newIsAdmin?.checked;

      if (!username || !pass) {
        if (addUserMsg) addUserMsg.textContent = "املأ الاسم وكلمة السر";
        return;
      }

      try {
        const { error } = await SB.sb.from(SB.tables.users).insert({ username, pass, is_admin, blocked: false });
        if (error) throw error;
        if (addUserMsg) addUserMsg.textContent = "تم الإضافة ✅";
        setTimeout(() => { if (addModalBack) addModalBack.style.display = "none"; }, 650);
        await refreshAll();
      } catch (e) {
        console.error(e);
        if (addUserMsg) addUserMsg.textContent = "فشل: " + (e.message || e);
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
  }

  function renderInvoices() {
    if (!invTbody) return;

    const term = (invSearch?.value || "").trim().toLowerCase();
    const filtered = invoicesForUser.filter(inv => {
      const fields = [inv.customer_name, inv.customer, inv.invoice_no, inv.code, inv.id, inv.created_at];
      return fields.some(f => String(f || "").toLowerCase().includes(term));
    });

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
  }

  if (invSearch) invSearch.oninput = renderInvoices;
  if (reloadInvBtn) reloadInvBtn.onclick = loadInvoicesForCurrentUser;

  if (invTbody) {
    invTbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      const inv = invoicesForUser.find(i => String(i.id) === String(id));
      if (!inv) return;

      if (act === "viewJson") {
        alert(JSON.stringify(inv, null, 2));
        return;
      }

      if (act === "ops") {
        openOperationsModal(inv);
        return;
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
          </div>

          <div style="border-top:1px solid #111;margin:10px 0"></div>

          <div style="font-weight:900;margin:6px 0 10px">جدول العمليات</div>

          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#f3f3f3">
                <th style="border:1px solid #111;padding:8px;text-align:center">#</th>
                <th style="border:1px solid #111;padding:8px;text-align:center">الوقت</th>
                <th style="border:1px solid #111;padding:8px;text-align:center">البيان</th>
                <th style="border:1px solid #111;padding:8px;text-align:center">العملية</th>
                <th style="border:1px solid #111;padding:8px;text-align:center">النتيجة</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="5" style="border:1px solid #111;padding:14px;text-align:center;color:#666">لا يوجد عمليات</td></tr>`}
            </tbody>
          </table>

          <div style="margin-top:12px;border:2px dashed #111;border-radius:12px;padding:10px;display:flex;justify-content:space-between;font-weight:900">
            <span>إجمالي الكشف:</span>
            <span>${escapeHtml(String(total))}</span>
          </div>

          <div style="margin-top:12px;border:2px solid #111;border-radius:14px;padding:12px;text-align:center;font-size:12px;line-height:1.8">
            تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك<br/>
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
      }

      const uname = currentInvoiceForOps.username || currentUserForInvoices?.username || "user";
      const id6 = String(currentInvoiceForOps.id || "").slice(-6);
      pdf.save(`OPS_${uname}_${id6}_${Date.now()}.pdf`);
    } catch (e) {
      console.error("PDF export error:", e);
      alert("فشل تصدير PDF");
    }
  }

  if (exportPdfBtn) exportPdfBtn.onclick = exportOpsPdf;

  // ===== Init =====
  refreshAll();
})();
