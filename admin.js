/* =========================
   HAYEK SPOT — Admin Panel (Invoices + Users)
   Works with Supabase REST (no supabase-js needed)
   ========================= */

(() => {
  // =========================
  // ✅ Supabase
  // =========================
  const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";
  const SUPABASE_KEY = "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";
  const REST = `${SUPABASE_URL}/rest/v1`;

  const $ = (id) => document.getElementById(id);

  // =========================
  // ✅ State
  // =========================
  const state = {
    usersPage: 0,
    pageSize: 15,
    lastUsers: [],
    currentUser: null,
    invoices: [],
    currentInvoiceId: null,
    currentOps: [],
    admin: null,
  };

  // =========================
  // ✅ UI Helpers
  // =========================
  function toast(msg) {
    const d = document.createElement("div");
    d.textContent = msg;
    Object.assign(d.style, {
      position: "fixed",
      bottom: "18px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(17,19,21,.88)",
      color: "#fff",
      padding: "10px 14px",
      borderRadius: "14px",
      fontWeight: "1000",
      zIndex: 99999,
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,.18)",
      maxWidth: "92vw",
      textAlign: "center",
    });
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1800);
  }

  function setPill(ok, msg) {
    const pill = $("pill");
    pill.textContent = msg || (ok ? "مفتوح" : "مغلق");
    pill.style.background = ok ? "var(--green)" : "var(--yellow)";
    pill.style.color = ok ? "#111315" : "#111315";
  }

  function fmtDateTime(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString("ar-EG", { hour12: true });
    } catch {
      return String(ts || "");
    }
  }

  function fmtDate(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString("ar-EG");
    } catch {
      return String(ts || "");
    }
  }

  function safeNum(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }

  function formatNumber(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0";
    const s = x.toString();
    return s.includes(".")
      ? x.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")
      : s;
  }

  // =========================
  // ✅ REST Helper
  // =========================
  async function apiFetch(path, options = {}) {
    const res = await fetch(`${REST}${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${t || res.statusText}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // =========================
  // ✅ Admin Session
  // =========================
  const K_ADMIN = "hs_admin_session_v1";
  const saveAdmin = (obj) => localStorage.setItem(K_ADMIN, JSON.stringify(obj));
  const loadAdmin = () => {
    try {
      return JSON.parse(localStorage.getItem(K_ADMIN) || "null");
    } catch {
      return null;
    }
  };
  const clearAdmin = () => {
    try {
      localStorage.removeItem(K_ADMIN);
    } catch {}
  };

  function showAdminApp(show) {
    $("adminLoginCard").style.display = show ? "none" : "block";
    $("adminApp").style.display = show ? "grid" : "none";
    setPill(show, show ? "مفتوح" : "مغلق");
  }

  async function adminLogin(username, pass) {
    const u = (username || "").trim();
    const p = (pass || "").trim();
    if (!u || !p) return toast("اكتب اسم الأدمن وكلمة السر");

    const q =
      `?select=id,username,pass,is_admin,blocked,created_at` +
      `&username=eq.${encodeURIComponent(u)}` +
      `&pass=eq.${encodeURIComponent(p)}` +
      `&limit=1`;

    const rows = await apiFetch(`/app_users${q}`, { method: "GET" });
    const user = Array.isArray(rows) ? rows[0] : null;

    if (!user) return toast("بيانات الدخول غير صحيحة");
    if (user.blocked) return toast("يوجد خطأ بالنظام جاري المعالجة");
    if (!user.is_admin) return toast("غير مصرح");

    state.admin = { id: user.id, username: user.username, ts: Date.now() };
    saveAdmin(state.admin);
    showAdminApp(true);

    await loadUsers();
    toast("تم دخول الأدمن ✅");
  }

  async function adminGuardTick() {
    const a = loadAdmin();
    if (!a?.id) return;

    try {
      const q = `?select=id,is_admin,blocked&limit=1&id=eq.${encodeURIComponent(a.id)}`;
      const rows = await apiFetch(`/app_users${q}`, { method: "GET" });
      const user = Array.isArray(rows) ? rows[0] : null;

      if (!user || !user.is_admin || user.blocked) {
        clearAdmin();
        showAdminApp(false);
        toast("تم تسجيل الخروج");
      }
    } catch {
      // ignore
    }
  }

  let guardTimer = null;
  function startAdminGuard() {
    if (guardTimer) clearInterval(guardTimer);
    guardTimer = setInterval(adminGuardTick, 12000);
    adminGuardTick();
  }

  // =========================
  // ✅ Users (CRUD + Block)
  // =========================
  function genPassword() {
    const p = Math.floor(100000 + Math.random() * 900000);
    $("newPass").value = String(p);
  }

  async function addUser() {
    const username = ($("newUsername").value || "").trim();
    const pass = ($("newPass").value || "").trim();
    const is_admin = $("newIsAdmin").value === "true";

    if (!username || !pass) return toast("اكتب اسم المستخدم وكلمة السر");

    try {
      const { error } = { error: null };
      await apiFetch(`/app_users`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          username,
          pass,
          is_admin,
          blocked: false,
        }),
      });

      $("newUsername").value = "";
      await loadUsers();
      toast("تم حفظ المستخدم ✅");
    } catch (e) {
      console.error(e);
      toast("خطأ بالحفظ");
    }
  }

  async function setBlocked(username, blocked) {
    try {
      await apiFetch(`/app_users?username=eq.${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ blocked }),
      });
      await loadUsers();
      toast(blocked ? "تم الحظر ✅" : "تم فك الحظر ✅");
    } catch (e) {
      console.error(e);
      toast("خطأ بالتحديث");
    }
  }

  async function deleteUser(username) {
    if (!confirm(`تأكيد حذف المستخدم "${username}" ؟`)) return;
    try {
      await apiFetch(`/app_users?username=eq.${encodeURIComponent(username)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      await loadUsers();
      toast("تم الحذف ✅");
    } catch (e) {
      console.error(e);
      toast("خطأ بالحذف");
    }
  }

  function renderUsersTable(users) {
    const tb = $("usersTbody");
    tb.innerHTML = "";

    users.forEach((u) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = u.username || "";

      const tdPass = document.createElement("td");
      tdPass.className = "num";
      tdPass.textContent = u.pass || "";

      const tdAdmin = document.createElement("td");
      tdAdmin.innerHTML = u.is_admin
        ? `<span class="badge g">YES</span>`
        : `<span class="badge">NO</span>`;

      const tdState = document.createElement("td");
      tdState.innerHTML = u.blocked
        ? `<span class="badge r">محظور</span>`
        : `<span class="badge g">مفعّل</span>`;

      const tdAct = document.createElement("td");
      tdAct.style.display = "flex";
      tdAct.style.gap = "8px";
      tdAct.style.flexWrap = "wrap";

      const btnPick = document.createElement("button");
      btnPick.className = "btn gray";
      btnPick.textContent = "اختيار";
      btnPick.onclick = () => {
        $("userSelect").value = u.username;
        state.currentUser = u.username;
        state.currentInvoiceId = null;
        $("confirmInvoiceId").value = "";
        renderInvoicesTable([]);
        clearInvoiceDetailsUI();
        toast(`تم اختيار: ${u.username}`);
      };

      const btnToggle = document.createElement("button");
      btnToggle.className = "btn yellow";
      btnToggle.textContent = u.blocked ? "فك الحظر" : "حظر";
      btnToggle.onclick = () => setBlocked(u.username, !u.blocked);

      const btnDel = document.createElement("button");
      btnDel.className = "btn red";
      btnDel.textContent = "حذف";
      btnDel.onclick = () => deleteUser(u.username);

      tdAct.appendChild(btnPick);
      tdAct.appendChild(btnToggle);
      tdAct.appendChild(btnDel);

      tr.appendChild(tdName);
      tr.appendChild(tdPass);
      tr.appendChild(tdAdmin);
      tr.appendChild(tdState);
      tr.appendChild(tdAct);

      tb.appendChild(tr);
    });
  }

  function fillUserSelect(users) {
    const sel = $("userSelect");
    const current = sel.value;

    const base = `<option value="">— اختر المستخدم —</option>`;
    const options = (users || [])
      .filter((u) => !u.is_admin) // لا نعرض الأدمن ضمن قائمة العملاء افتراضياً
      .map((u) => `<option value="${u.username}">${u.username}</option>`)
      .join("");
    sel.innerHTML = base + options;

    if (current) sel.value = current;
  }

  async function loadUsers() {
    const q = ($("searchUser").value || "").trim();
    const limit = state.pageSize;
    const offset = state.usersPage * state.pageSize;

    try {
      let url =
        `/app_users?select=id,username,pass,is_admin,blocked,created_at` +
        `&order=created_at.desc&limit=${limit}&offset=${offset}`;

      if (q) {
        // ilike.*text*
        url += `&username=ilike.*${encodeURIComponent(q)}*`;
      }

      const data = await apiFetch(url, { method: "GET" });
      state.lastUsers = Array.isArray(data) ? data : [];
      renderUsersTable(state.lastUsers);
      fillUserSelect(state.lastUsers);
      setPill(true, "مفتوح");
    } catch (e) {
      console.error(e);
      setPill(false, "مغلق");
      toast("خطأ تحميل المستخدمين");
    }
  }

  // =========================
  // ✅ Invoices (List + Pick)
  // =========================
  function getDateRangeFilter() {
    const from = $("fromDate").value;
    const to = $("toDate").value;

    // build ISO range inclusive end-of-day in local time
    const fromISO = from ? new Date(from + "T00:00:00").toISOString() : null;
    const toISO = to ? new Date(to + "T23:59:59").toISOString() : null;
    return { fromISO, toISO };
  }

  function renderInvoicesTable(invoices) {
    const tb = $("invoicesTbody");
    tb.innerHTML = "";

    invoices.forEach((inv) => {
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      tdDate.textContent = fmtDateTime(inv.created_at);

      const tdCust = document.createElement("td");
      tdCust.textContent = inv.customer_name || "—";

      const tdTotal = document.createElement("td");
      tdTotal.className = "num";
      tdTotal.textContent = formatNumber(inv.total ?? 0);

      const tdStatus = document.createElement("td");
      const st = (inv.status || "").toLowerCase();
      tdStatus.innerHTML =
        st === "closed"
          ? `<span class="badge g">مغلقة</span>`
          : `<span class="badge y">مفتوحة</span>`;

      const tdAct = document.createElement("td");

      const btn = document.createElement("button");
      btn.className = "btn gray";
      btn.textContent = "فتح";
      btn.style.padding = "10px 12px";
      btn.onclick = () => pickInvoice(inv.id);

      tdAct.appendChild(btn);

      tr.appendChild(tdDate);
      tr.appendChild(tdCust);
      tr.appendChild(tdTotal);
      tr.appendChild(tdStatus);
      tr.appendChild(tdAct);

      tb.appendChild(tr);
    });

    if (!invoices.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.style.color = "rgba(255,255,255,.78)";
      td.style.fontWeight = "1000";
      td.textContent = "لا توجد فواتير ضمن هذا النطاق.";
      tr.appendChild(td);
      tb.appendChild(tr);
    }
  }

  async function loadInvoicesForUser() {
    const username = $("userSelect").value;
    if (!username) return toast("اختر المستخدم أولاً");
    state.currentUser = username;
    state.currentInvoiceId = null;
    clearInvoiceDetailsUI();

    const { fromISO, toISO } = getDateRangeFilter();

    try {
      let url =
        `/app_invoices?select=id,username,customer_name,status,total,created_at,closed_at` +
        `&username=eq.${encodeURIComponent(username)}` +
        `&order=created_at.desc&limit=300`;

      if (fromISO) url += `&created_at=gte.${encodeURIComponent(fromISO)}`;
      if (toISO) url += `&created_at=lte.${encodeURIComponent(toISO)}`;

      const rows = await apiFetch(url, { method: "GET" });
      state.invoices = Array.isArray(rows) ? rows : [];
      renderInvoicesTable(state.invoices);

      toast("تم تحميل الفواتير ✅");
    } catch (e) {
      console.error(e);
      toast("خطأ تحميل الفواتير");
    }
  }

  function clearInvoiceDetailsUI() {
    state.currentOps = [];
    $("opsTbody").innerHTML = "";
    $("invoiceMeta").innerHTML = "";
    $("grandTotal").textContent = "0";
    $("totalsByLabel").innerHTML = "";
    $("printInvoiceBtn").disabled = true;
    $("deleteInvoiceBtn").disabled = true;
    $("archiveDeleteBtn").disabled = true;
  }

  function buildMetaChips(inv, countOps) {
    const meta = $("invoiceMeta");
    meta.innerHTML = "";

    const chips = [
      `Invoice: <span style="direction:ltr">${inv.id}</span>`,
      `العميل: ${inv.customer_name || "—"}`,
      `الحالة: ${String(inv.status || "—")}`,
      `تاريخ: ${fmtDateTime(inv.created_at)}`,
      `عدد السطور: ${countOps}`,
      `إجمالي: <span style="direction:ltr">${formatNumber(inv.total ?? 0)}</span>`,
    ];

    chips.forEach((t) => {
      const d = document.createElement("div");
      d.className = "badge";
      d.style.background = "rgba(255,255,255,.10)";
      d.style.borderColor = "rgba(255,255,255,.18)";
      d.innerHTML = t;
      meta.appendChild(d);
    });
  }

  async function pickInvoice(invoiceId) {
    state.currentInvoiceId = invoiceId;
    $("confirmInvoiceId").value = "";
    $("printInvoiceBtn").disabled = false;
    $("deleteInvoiceBtn").disabled = false;
    $("archiveDeleteBtn").disabled = false;

    try {
      // find invoice info from cache
      const inv = state.invoices.find((x) => x.id === invoiceId);
      if (!inv) {
        toast("لم يتم العثور على الفاتورة");
        return;
      }

      // load operations for that invoice
      const rows = await apiFetch(
        `/app_operations?select=created_at,label,operation,result&invoice_id=eq.${encodeURIComponent(
          invoiceId
        )}&order=created_at.asc&limit=2000`,
        { method: "GET" }
      );
      state.currentOps = Array.isArray(rows) ? rows : [];

      renderInvoiceDetails(inv, state.currentOps);
      toast("تم فتح الفاتورة ✅");
    } catch (e) {
      console.error(e);
      toast("خطأ فتح الفاتورة");
    }
  }

  function renderInvoiceDetails(inv, ops) {
    // operations table
    const tb = $("opsTbody");
    tb.innerHTML = "";

    let grand = 0;
    const sums = {}; // label => total

    ops.forEach((op) => {
      const tr = document.createElement("tr");

      const tdTime = document.createElement("td");
      tdTime.textContent = fmtDateTime(op.created_at);

      const tdLabel = document.createElement("td");
      tdLabel.textContent = op.label || "عملية";

      const tdOp = document.createElement("td");
      tdOp.className = "num";
      tdOp.textContent = op.operation || "";

      const tdRes = document.createElement("td");
      tdRes.className = "num";
      tdRes.textContent = op.result ?? "";

      tr.appendChild(tdTime);
      tr.appendChild(tdLabel);
      tr.appendChild(tdOp);
      tr.appendChild(tdRes);
      tb.appendChild(tr);

      const r = safeNum(op.result);
      grand += r;

      const key = (op.label || "عملية").trim();
      sums[key] = (sums[key] || 0) + r;
    });

    // totals
    $("grandTotal").textContent = formatNumber(grand);

    const box = $("totalsByLabel");
    box.innerHTML = "";
    Object.keys(sums)
      .sort()
      .forEach((k) => {
        const div = document.createElement("div");
        div.className = "totalLine";
        div.innerHTML = `<span>إجمالي (${k}):</span><span style="direction:ltr">${formatNumber(
          sums[k]
        )}</span>`;
        box.appendChild(div);
      });

    buildMetaChips(inv, ops.length);
  }

  // =========================
  // ✅ Print / PDF (Clean)
  // =========================
  function openInvoicePrint() {
    const id = state.currentInvoiceId;
    if (!id) return toast("اختر فاتورة أولاً");

    // ✅ print from invoice.html (not admin page)
    const url = `./invoice.html?invoice_id=${encodeURIComponent(id)}&print=1`;
    window.open(url, "_blank");
  }

  // =========================
  // ✅ Delete Invoice
  // =========================
  async function deleteInvoiceNow() {
    const id = state.currentInvoiceId;
    if (!id) return toast("اختر فاتورة أولاً");

    const confirmId = ($("confirmInvoiceId").value || "").trim();
    if (confirmId !== id) return toast("اكتب Invoice ID حرفياً للتأكيد");

    if (!confirm("تأكيد حذف الفاتورة وكل عملياتها؟")) return;

    try {
      // delete ops first (FK safe)
      await apiFetch(`/app_operations?invoice_id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });

      // delete invoice
      await apiFetch(`/app_invoices?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });

      toast("تم حذف الفاتورة ✅");

      // refresh list
      state.currentInvoiceId = null;
      clearInvoiceDetailsUI();
      await loadInvoicesForUser();
    } catch (e) {
      console.error(e);
      toast("فشل الحذف");
    }
  }

  async function archiveThenDelete() {
    const id = state.currentInvoiceId;
    if (!id) return toast("اختر فاتورة أولاً");

    const confirmId = ($("confirmInvoiceId").value || "").trim();
    if (confirmId !== id) return toast("اكتب Invoice ID حرفياً للتأكيد");

    if (!confirm("سيتم فتح PDF للطباعة ثم حذف الفاتورة. متابعة؟")) return;

    openInvoicePrint();

    // best-effort delete after short delay
    setTimeout(() => {
      deleteInvoiceNow().catch(() => {});
    }, 1400);
  }

  // =========================
  // ✅ Delete ALL user invoices
  // =========================
  async function deleteAllUserInvoices() {
    const username = $("userSelect").value;
    if (!username) return toast("اختر المستخدم أولاً");

    if (
      !confirm(
        `⚠️ هذا سيحذف كل فواتير المستخدم "${username}" وعملياتها. متابعة؟`
      )
    )
      return;

    try {
      // delete ops by username
      await apiFetch(`/app_operations?username=eq.${encodeURIComponent(username)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });

      // delete invoices by username
      await apiFetch(`/app_invoices?username=eq.${encodeURIComponent(username)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });

      toast("تم حذف بيانات المستخدم ✅");
      state.currentInvoiceId = null;
      clearInvoiceDetailsUI();
      await loadInvoicesForUser();
    } catch (e) {
      console.error(e);
      toast("فشل حذف بيانات المستخدم");
    }
  }

  // =========================
  // ✅ Wire UI
  // =========================
  function wire() {
    // login
    $("adminLoginBtn").onclick = () =>
      adminLogin($("adminUser").value, $("adminPass").value);
    $("goIndexBtn").onclick = () => (location.href = "./index.html?v=999");

    // users
    $("genPass").onclick = genPassword;
    $("addUser").onclick = addUser;
    $("refreshUsers").onclick = async () => {
      state.usersPage = 0;
      await loadUsers();
    };
    $("searchUser").addEventListener("input", async () => {
      state.usersPage = 0;
      await loadUsers();
    });
    $("prevUsers").onclick = async () => {
      if (state.usersPage > 0) state.usersPage--;
      await loadUsers();
    };
    $("nextUsers").onclick = async () => {
      state.usersPage++;
      await loadUsers();
    };

    // invoices
    $("loadInvoicesBtn").onclick = loadInvoicesForUser;

    $("quickToday").onclick = () => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const today = `${y}-${m}-${day}`;
      $("fromDate").value = today;
      $("toDate").value = today;
    };

    $("quick7").onclick = () => {
      const d = new Date();
      const d2 = new Date();
      d2.setDate(d.getDate() - 7);
      const f = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d2.getDate()).padStart(2, "0")}`;
      const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      $("fromDate").value = f;
      $("toDate").value = t;
    };

    $("clearDates").onclick = () => {
      $("fromDate").value = "";
      $("toDate").value = "";
    };

    $("userSelect").addEventListener("change", () => {
      state.currentUser = $("userSelect").value || null;
      state.currentInvoiceId = null;
      clearInvoiceDetailsUI();
    });

    // invoice actions
    $("printInvoiceBtn").onclick = openInvoicePrint;
    $("deleteInvoiceBtn").onclick = () => deleteInvoiceNow();
    $("archiveDeleteBtn").onclick = () => archiveThenDelete();
    $("deleteAllUserOpsBtn").onclick = () => deleteAllUserInvoices();
  }

  // =========================
  // ✅ Boot
  // =========================
  async function boot() {
    wire();

    const a = loadAdmin();
    if (a?.id) {
      state.admin = a;
      showAdminApp(true);
      startAdminGuard();
      await loadUsers();
    } else {
      showAdminApp(false);
      setPill(false, "مغلق");
    }

    clearInvoiceDetailsUI();
  }

  boot().catch((e) => {
    console.error(e);
    toast("خطأ تشغيل الأدمن");
    showAdminApp(false);
  });

  // ✅ Minimal exposure to console
  window.__HS_ADMIN__ = {
    reloadUsers: loadUsers,
    reloadInvoices: loadInvoicesForUser,
  };
})();
