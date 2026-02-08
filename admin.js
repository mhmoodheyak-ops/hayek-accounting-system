/* =========================================================
   HAYEK SPOT — admin.js (Clean Rebuild)
   - Users CRUD (app_users)
   - Invoices list/open/delete (app_invoices / app_operations)
   - PDF export via html2pdf
   ========================================================= */

(() => {
  "use strict";

  /* ====== CONFIG ====== */
  const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";
  const SUPABASE_KEY = "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";
  const SESSION_KEY = "HAYEK_SPOT_SESSION_V1";

  const T_USERS = "app_users";
  const T_INVOICES = "app_invoices";
  const T_OPS = "app_operations";

  /* ====== Helpers ====== */
  const $ = (id) => document.getElementById(id);

  function vibrate(ms = 15) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
  }

  function safeNum(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }

  function ymd(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function nowISODate() {
    return ymd(new Date());
  }

  function daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return ymd(d);
  }

  function fmtDateTime(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString("ar-EG", { hour12: true });
    } catch (_) {
      return String(ts ?? "");
    }
  }

  function pickField(row, names) {
    for (const n of names) {
      if (row && row[n] !== undefined && row[n] !== null) return row[n];
    }
    return "";
  }

  function logDbg(...args) {
    const box = $("debugBox");
    if (!box) return;
    const s = args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
      .join("\n");
    box.textContent = s;
  }

  function setPill(ok, msg) {
    const pill = $("pill");
    if (!pill) return;
    pill.textContent = msg || (ok ? "مفتوح" : "مغلق");
    pill.classList.toggle("open", !!ok);
    pill.classList.toggle("closed", !ok);
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function setSession(sessionObj) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionObj));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function show(el, on) {
    if (!el) return;
    el.style.display = on ? "" : "none";
  }

  function showView(which) {
    // Optional IDs in admin.html (لو موجودين)
    // - adminLoginView: صندوق تسجيل دخول الأدمن
    // - adminPanelView: لوحة الأدمن
    const loginView = $("adminLoginView");
    const panelView = $("adminPanelView");
    if (!loginView && !panelView) return; // الصفحة يمكن تكون قديمة/مختلفة
    show(loginView, which === "login");
    show(panelView, which === "panel");
  }

  /* ====== Supabase client ====== */
  let client = null;

  function initClient() {
    if (!window.supabase || !window.supabase.createClient) {
      setPill(false, "مغلق");
      logDbg("خطأ: مكتبة Supabase لم تُحمّل.");
      return null;
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    setPill(true, "مفتوح");
    return client;
  }

  /* ====== State ====== */
  const state = {
    usersPage: 0,
    pageSize: 15,
    usersCount: 0,
    lastUsers: [],
    currentUser: "",
    invoices: [],
    currentInvoiceId: "",
    ops: [],
  };

  /* =========================================================
     ADMIN LOGIN (لو admin.html فيه فورم تسجيل دخول)
     ========================================================= */
  async function verifyAdmin(username, pass) {
    const { data, error } = await client
      .from(T_USERS)
      .select("username, is_admin, blocked")
      .eq("username", username)
      .eq("pass", pass)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: false, msg: "بيانات الدخول غير صحيحة." };
    if (data.blocked) return { ok: false, msg: "هذا الحساب موقوف." };
    if (!data.is_admin) return { ok: false, msg: "هذا الحساب ليس أدمن." };
    return { ok: true, user: data };
  }

  async function handleAdminLogin() {
    const uEl = $("adminUser") || $("loginUser") || $("username") || $("adminUsername");
    const pEl = $("adminPass") || $("loginPass") || $("password") || $("adminPassword");
    const msgEl = $("loginMsg");

    const username = (uEl?.value || "").trim();
    const pass = (pEl?.value || "").trim();

    if (!username || !pass) {
      alert("اكتب اسم الأدمن وكلمة السر");
      return;
    }

    try {
      const res = await verifyAdmin(username, pass);
      if (!res.ok) {
        if (msgEl) msgEl.textContent = res.msg;
        alert(res.msg);
        return;
      }

      setSession({
        username,
        is_admin: true,
        ts: Date.now(),
      });

      if (msgEl) msgEl.textContent = "✅ تم تسجيل الدخول";
      vibrate(20);

      showView("panel");
      await afterLoginBoot();
    } catch (e) {
      console.error(e);
      alert("خطأ تسجيل الدخول: " + (e?.message || e));
      logDbg("خطأ تسجيل الدخول:", e);
    }
  }

  function handleLogout() {
    clearSession();
    vibrate(15);
    // ارجع لصفحة الدخول (index) إذا موجودة
    try {
      location.href = "index.html?v=" + Date.now();
    } catch (_) {
      location.reload();
    }
  }

  /* =========================================================
     USERS CRUD
     ========================================================= */
  function genPassword() {
    const p = Math.floor(100000 + Math.random() * 900000);
    const el = $("newPass");
    if (el) el.value = String(p);
    vibrate(10);
  }

  async function loadUsers() {
    if (!client) return;

    const search = ($("searchUser")?.value || "").trim();
    const from = state.usersPage * state.pageSize;
    const to = from + state.pageSize - 1;

    let q = client
      .from(T_USERS)
      .select("id, username, pass, is_admin, blocked, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) q = q.ilike("username", `%${search}%`);

    const { data, error, count } = await q;

    if (error) {
      console.error(error);
      setPill(false, "مغلق");
      alert("خطأ تحميل المستخدمين: " + error.message);
      logDbg("خطأ تحميل المستخدمين:", error);
      return;
    }

    setPill(true, "مفتوح");
    state.lastUsers = data || [];
    state.usersCount = count || 0;

    renderUsersTable(state.lastUsers);
    await fillUserSelect(); // سحب كل الأسماء (بدون الاعتماد على الصفحة الحالية)
    updateUsersPagerUI();
  }

  function updateUsersPagerUI() {
    const info = $("usersPageInfo");
    if (!info) return;
    const totalPages = Math.max(1, Math.ceil(state.usersCount / state.pageSize));
    info.textContent = `صفحة ${state.usersPage + 1} / ${totalPages}`;
  }

  function renderUsersTable(users) {
    const tb = $("usersTbody") || $("usersBody");
    if (!tb) return;

    tb.innerHTML = "";

    (users || []).forEach((u) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = u.username ?? "";

      const tdPass = document.createElement("td");
      tdPass.textContent = u.pass ?? "";

      const tdAdmin = document.createElement("td");
      tdAdmin.textContent = u.is_admin ? "YES" : "NO";

      const tdState = document.createElement("td");
      tdState.textContent = u.blocked ? "محظور" : "مفعل";

      const tdAct = document.createElement("td");
      tdAct.className = "actions";

      // اختيار المستخدم
      const btnPick = document.createElement("button");
      btnPick.className = "btn";
      btnPick.textContent = "اختيار";
      btnPick.onclick = async () => {
        const sel = $("userSelect");
        if (sel) sel.value = u.username || "";
        state.currentUser = u.username || "";
        await loadInvoicesForUser();
        vibrate(15);
      };

      // حظر / فك
      const btnToggle = document.createElement("button");
      btnToggle.className = "btn yellow";
      btnToggle.textContent = u.blocked ? "فك الحظر" : "حظر";
      btnToggle.onclick = async () => {
        if (!confirm(u.blocked ? "تأكيد فك الحظر؟" : "تأكيد حظر المستخدم؟")) return;
        const { error } = await client
          .from(T_USERS)
          .update({ blocked: !u.blocked })
          .eq("username", u.username);
        if (error) {
          alert("خطأ: " + error.message);
          return;
        }
        vibrate(15);
        await loadUsers();
      };

      // حذف
      const btnDel = document.createElement("button");
      btnDel.className = "btn red";
      btnDel.textContent = "حذف";
      btnDel.onclick = async () => {
        if (!confirm(`تأكيد حذف المستخدم "${u.username}" ؟`)) return;
        const { error } = await client.from(T_USERS).delete().eq("username", u.username);
        if (error) {
          alert("خطأ: " + error.message);
          return;
        }
        vibrate(20);
        await loadUsers();
      };

      tdAct.append(btnPick, btnToggle, btnDel);
      tr.append(tdName, tdPass, tdAdmin, tdState, tdAct);
      tb.appendChild(tr);
    });
  }

  async function fillUserSelect() {
    const sel = $("userSelect");
    if (!sel) return;

    const current = sel.value;

    // نجيب كل المستخدمين للاختيار (أسماء فقط)
    const { data, error } = await client
      .from(T_USERS)
      .select("username")
      .order("username", { ascending: true });

    if (error) {
      console.error(error);
      logDbg("خطأ تحميل قائمة المستخدمين:", error);
      return;
    }

    const names = Array.from(new Set((data || []).map((r) => r.username).filter(Boolean)));

    sel.innerHTML = `<option value="">— اختر المستخدم —</option>`;
    names.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });

    if (current) sel.value = current;
  }

  async function addUser() {
    const username = ($("newUsername")?.value || "").trim();
    const pass = ($("newPass")?.value || "").trim();
    const is_admin = ($("newIsAdmin")?.value || "false") === "true";

    if (!username || !pass) {
      alert("اكتب اسم المستخدم وكلمة السر");
      return;
    }

    const { error } = await client.from(T_USERS).insert({
      username,
      pass,
      is_admin,
      blocked: false,
    });

    if (error) {
      alert("خطأ بالحفظ: " + error.message);
      return;
    }

    if ($("newUsername")) $("newUsername").value = "";
    if ($("newPass")) $("newPass").value = "";
    vibrate(20);
    alert("✅ تم حفظ المستخدم");
    await loadUsers();
  }

  /* =========================================================
     INVOICES
     ========================================================= */
  function requireUser() {
    const u = ($("userSelect")?.value || "").trim();
    if (!u) {
      alert("اختر مستخدم أولاً");
      return null;
    }
    return u;
  }

  function requireInvoice() {
    const id = ($("invoiceSelect")?.value || "").trim();
    if (!id) {
      alert("اختر فاتورة أولاً");
      return null;
    }
    return id;
  }

  function invoiceLabel(inv) {
    const dt = fmtDateTime(inv.created_at);
    const total = safeNum(inv.total).toFixed(2);
    const shortId = String(inv.id || "").slice(-6);
    return `${dt} — مجموع: ${total} — #${shortId}`;
  }

  async function loadInvoicesForUser() {
    const username = requireUser();
    if (!username) return;

    state.currentUser = username;
    state.currentInvoiceId = "";
    state.ops = [];
    state.invoices = [];

    const selInv = $("invoiceSelect");
    if (selInv) selInv.innerHTML = `<option value="">— اختر فاتورة —</option>`;

    const opsTb = $("opsTbody") || $("opsBody");
    if (opsTb) opsTb.innerHTML = "";

    const totalBadge = $("totalBadge");
    if (totalBadge) totalBadge.textContent = "المجموع العام: 0";

    const invMeta = $("invMeta");
    if (invMeta) invMeta.textContent = "—";

    const from = ($("fromDate")?.value || "").trim();
    const to = ($("toDate")?.value || "").trim();

    let q = client
      .from(T_INVOICES)
      .select("id, username, total, created_at")
      .eq("username", username)
      .order("created_at", { ascending: false });

    // فلترة (اختياري)
    if (from) q = q.gte("created_at", from + "T00:00:00Z");
    if (to) q = q.lte("created_at", to + "T23:59:59Z");

    const { data, error } = await q;

    if (error) {
      alert("خطأ تحميل الفواتير: " + error.message);
      logDbg("خطأ تحميل الفواتير:", error);
      return;
    }

    state.invoices = data || [];
    if (selInv) {
      selInv.innerHTML = `<option value="">— اختر فاتورة —</option>`;
      state.invoices.forEach((inv) => {
        const opt = document.createElement("option");
        opt.value = inv.id;
        opt.textContent = invoiceLabel(inv);
        selInv.appendChild(opt);
      });
    }

    vibrate(10);
    logDbg(`تم تحميل ${state.invoices.length} فاتورة للمستخدم: ${username}`);
  }

  function calcOpsTotal(ops) {
    let sum = 0;
    (ops || []).forEach((r) => {
      const v = pickField(r, ["result", "amount", "total", "value"]);
      sum += safeNum(v);
    });
    return sum;
  }

  function renderOps(ops) {
    const tb = $("opsTbody") || $("opsBody");
    if (!tb) return;

    tb.innerHTML = "";

    (ops || []).forEach((r) => {
      const tr = document.createElement("tr");

      const tdTime = document.createElement("td");
      tdTime.textContent = fmtDateTime(pickField(r, ["created_at", "time", "ts"]));

      const tdStmt = document.createElement("td");
      tdStmt.textContent = String(pickField(r, ["statement", "desc", "description", "label", "note", "text"]) || "");

      const tdOp = document.createElement("td");
      tdOp.textContent = String(pickField(r, ["operation", "op", "expr", "expression", "type"]) || "");

      const tdRes = document.createElement("td");
      const v = pickField(r, ["result", "amount", "value", "total"]);
      tdRes.textContent = v === "" ? "" : String(v);

      tr.append(tdTime, tdStmt, tdOp, tdRes);
      tb.appendChild(tr);
    });
  }

  async function openSelectedInvoice() {
    const username = requireUser();
    if (!username) return;

    const invoiceId = requireInvoice();
    if (!invoiceId) return;

    state.currentInvoiceId = invoiceId;

    const { data, error } = await client
      .from(T_OPS)
      .select("*")
      .eq("username", username)
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true });

    if (error) {
      alert("خطأ فتح الفاتورة: " + error.message);
      logDbg("خطأ تحميل عمليات الفاتورة:", error);
      return;
    }

    state.ops = data || [];
    renderOps(state.ops);

    // total
    const inv = state.invoices.find((x) => x.id === invoiceId);
    const invTotal = inv ? safeNum(inv.total) : calcOpsTotal(state.ops);

    if ($("totalBadge")) $("totalBadge").textContent = "المجموع العام: " + invTotal.toFixed(2);
    if ($("invMeta")) $("invMeta").textContent = inv ? ("فاتورة: " + fmtDateTime(inv.created_at)) : "فاتورة";

    vibrate(15);

    if (state.ops.length === 0) {
      logDbg(
        "⚠️ لا توجد عمليات بهذه الفاتورة.",
        "إذا عندك عمليات قديمة بدون invoice_id فهذا طبيعي (Legacy)."
      );
    } else {
      logDbg(`تم فتح الفاتورة: ${invoiceId}`, `عدد العمليات: ${state.ops.length}`);
    }
  }

  async function deleteSelectedInvoice() {
    const username = requireUser();
    if (!username) return;

    const invoiceId = requireInvoice();
    if (!invoiceId) return;

    if (!confirm("تأكيد حذف الفاتورة المختارة؟ سيتم حذف عملياتها أيضاً.")) return;

    // احذف العمليات أولاً (حتى لو ما في FK cascade)
    const delOps = await client
      .from(T_OPS)
      .delete()
      .eq("username", username)
      .eq("invoice_id", invoiceId);

    if (delOps.error) {
      alert("خطأ حذف عمليات الفاتورة: " + delOps.error.message);
      return;
    }

    const delInv = await client
      .from(T_INVOICES)
      .delete()
      .eq("id", invoiceId)
      .eq("username", username);

    if (delInv.error) {
      alert("خطأ حذف الفاتورة: " + delInv.error.message);
      return;
    }

    alert("✅ تم حذف الفاتورة");
    vibrate(25);

    // reset
    if ($("invoiceSelect")) $("invoiceSelect").value = "";
    renderOps([]);
    if ($("totalBadge")) $("totalBadge").textContent = "المجموع العام: 0";
    if ($("invMeta")) $("invMeta").textContent = "—";

    await loadInvoicesForUser();
  }

  async function exportPdf() {
    if (!window.html2pdf) {
      alert("مكتبة PDF غير محملة (html2pdf).");
      return;
    }

    const username = ($("userSelect")?.value || "").trim();
    const invoiceText = $("invoiceSelect")?.selectedOptions?.[0]?.textContent || "";
    const totalText = $("totalBadge")?.textContent || "";

    const area = $("printable-area");
    if (!area) {
      alert("عنصر الطباعة غير موجود: printable-area");
      return;
    }

    // Build printable content
    if ($("printMeta")) $("printMeta").textContent = `المستخدم: ${username} | ${invoiceText}`;
    if ($("printTotal")) $("printTotal").textContent = totalText;

    const rows = Array.from(($("opsTbody") || $("opsBody"))?.querySelectorAll("tr") || []);
    const htmlTable = `
      <table style="width:100%; border-collapse:collapse">
        <thead>
          <tr>
            <th style="border:1px solid #ddd; padding:8px; text-align:right">الوقت</th>
            <th style="border:1px solid #ddd; padding:8px; text-align:right">البيان</th>
            <th style="border:1px solid #ddd; padding:8px; text-align:right">العملية</th>
            <th style="border:1px solid #ddd; padding:8px; text-align:right">النتيجة</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((tr) => {
              const tds = tr.querySelectorAll("td");
              return `<tr>
                <td style="border:1px solid #ddd; padding:8px">${tds[0]?.textContent || ""}</td>
                <td style="border:1px solid #ddd; padding:8px">${tds[1]?.textContent || ""}</td>
                <td style="border:1px solid #ddd; padding:8px">${tds[2]?.textContent || ""}</td>
                <td style="border:1px solid #ddd; padding:8px">${tds[3]?.textContent || ""}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    `;
    if ($("printTable")) $("printTable").innerHTML = htmlTable;

    area.style.display = "block";

    try {
      const opt = {
        margin: 10,
        filename: `invoice_${username || "user"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };
      await window.html2pdf().set(opt).from(area).save();
    } catch (e) {
      console.error(e);
      alert("فشل تصدير PDF.");
    } finally {
      area.style.display = "none";
    }
  }

  /* =========================================================
     Events Wiring
     ========================================================= */
  function wireEvents() {
    // Login (لو موجود)
    const btnLogin =
      $("btnAdminLogin") || $("btnLoginAdmin") || $("btnLogin") || $("adminLoginBtn");
    if (btnLogin) btnLogin.onclick = handleAdminLogin;

    const btnLogout =
      $("btnLogoutAdmin") || $("btnLogout") || $("adminLogoutBtn");
    if (btnLogout) btnLogout.onclick = handleLogout;

    // Users
    if ($("btnGenPass")) $("btnGenPass").onclick = genPassword;
    if ($("btnSaveUser")) $("btnSaveUser").onclick = addUser;

    if ($("btnRefreshUsers")) $("btnRefreshUsers").onclick = () => {
      state.usersPage = 0;
      loadUsers();
    };

    if ($("btnReloadUsers")) $("btnReloadUsers").onclick = () => {
      state.usersPage = 0;
      loadUsers();
    };

    if ($("btnPrevUsers")) $("btnPrevUsers").onclick = () => {
      state.usersPage = Math.max(0, state.usersPage - 1);
      loadUsers();
    };

    if ($("btnNextUsers")) $("btnNextUsers").onclick = () => {
      state.usersPage += 1;
      loadUsers();
    };

    if ($("searchUser")) {
      $("searchUser").addEventListener("input", () => {
        state.usersPage = 0;
        loadUsers();
      });
    }

    // Invoices
    if ($("userSelect")) {
      $("userSelect").addEventListener("change", async () => {
        if ($("invoiceSelect")) $("invoiceSelect").innerHTML = `<option value="">— اختر فاتورة —</option>`;
        renderOps([]);
        if ($("totalBadge")) $("totalBadge").textContent = "المجموع العام: 0";
        if ($("invMeta")) $("invMeta").textContent = "—";
        if ($("userSelect").value) await loadInvoicesForUser();
      });
    }

    if ($("btnInvoicesRefresh")) $("btnInvoicesRefresh").onclick = loadInvoicesForUser;

    if ($("btnToday")) {
      $("btnToday").onclick = () => {
        if ($("fromDate")) $("fromDate").value = nowISODate();
        if ($("toDate")) $("toDate").value = nowISODate();
        loadInvoicesForUser();
      };
    }

    if ($("btnLast7")) {
      $("btnLast7").onclick = () => {
        if ($("fromDate")) $("fromDate").value = daysAgoISO(7);
        if ($("toDate")) $("toDate").value = nowISODate();
        loadInvoicesForUser();
      };
    }

    if ($("btnClearDates")) {
      $("btnClearDates").onclick = () => {
        if ($("fromDate")) $("fromDate").value = "";
        if ($("toDate")) $("toDate").value = "";
        loadInvoicesForUser();
      };
    }

    if ($("btnLoadInvoices")) $("btnLoadInvoices").onclick = loadInvoicesForUser;

    if ($("btnOpenInvoice")) $("btnOpenInvoice").onclick = openSelectedInvoice;
    if ($("btnDeleteInvoice")) $("btnDeleteInvoice").onclick = deleteSelectedInvoice;

    if ($("btnPrintPdf")) $("btnPrintPdf").onclick = exportPdf;
    if ($("btnPDF")) $("btnPDF").onclick = exportPdf;
  }

  async function afterLoginBoot() {
    // تأكد أن عناصر اللوحة موجودة قبل التحميل
    await loadUsers();
    logDbg("✅ تم تشغيل لوحة الأدمن (admin.js clean).");
  }

  /* =========================================================
     Boot
     ========================================================= */
  (async function boot() {
    initClient();
    if (!client) return;

    wireEvents();

    const s = getSession();

    // إذا الصفحة فيها panel/login views:
    // - إذا عندك جلسة أدمن -> افتح panel
    // - إذا ما عندك -> افتح login
    if (s?.is_admin) {
      showView("panel");
      await afterLoginBoot();
    } else {
      showView("login");
      // إذا ما في login view أصلاً، لا تعمل شيء (يمكن يعتمد على index.html)
      logDbg("جاهز… (لا يوجد Session أدمن حالياً)");
    }
  })();
})();
