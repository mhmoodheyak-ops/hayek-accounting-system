/* =========================
   HAYEK SPOT — Admin Panel (Invoices v2)
   Users CRUD + block/unblock
   Per-user invoices list (app_invoices)
   Open selected invoice -> operations by invoice_id
   Delete selected invoice (cascade deletes ops via FK)
   Print / PDF
   ========================= */

const SUPABASE_URL = "PUT_YOUR_SUPABASE_URL_HERE";
const SUPABASE_KEY = "PUT_YOUR_SB_PUBLISHABLE_KEY_HERE";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const $any = (...ids) => {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
};

const state = {
  usersPage: 0,
  pageSize: 15,
  lastUsers: [],
  currentUser: null,

  // invoice mode
  invoices: [],
  currentInvoiceId: null,
  currentOps: [],
};

function setPill(ok, msg) {
  const pill = $any("pill");
  if (!pill) return;
  pill.textContent = msg || (ok ? "مفتوح" : "مغلق");
  pill.style.background = ok ? "var(--green)" : "var(--red)";
  pill.style.color = ok ? "var(--dark)" : "var(--text)";
}

function nowISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function fmtDateTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString("ar-EG", { hour12: true });
  } catch {
    return String(ts || "");
  }
}

function getDateRangeFilter() {
  const fromEl = $any("fromDate");
  const toEl = $any("toDate");
  const from = fromEl ? fromEl.value : "";
  const to = toEl ? toEl.value : "";

  const fromISO = from ? new Date(from + "T00:00:00").toISOString() : null;
  const toISO = to ? new Date(to + "T23:59:59").toISOString() : null;
  return { from, to, fromISO, toISO };
}

function shortId(id) {
  if (!id) return "";
  const s = String(id);
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

/* =========================
   Users (CRUD + block/unblock)
   ========================= */

function genPassword() {
  const p = Math.floor(100000 + Math.random() * 900000);
  const passEl = $any("newPass");
  if (passEl) passEl.value = String(p);
}

async function addUser() {
  const username = (($any("newUsername")?.value) || "").trim();
  const pass = (($any("newPass")?.value) || "").trim();
  const is_admin = ($any("newIsAdmin")?.value || "false") === "true";

  if (!username || !pass) {
    alert("اكتب اسم المستخدم وكلمة السر");
    return;
  }

  const { error } = await client.from("app_users").insert({
    username,
    pass,
    is_admin,
    blocked: false,
  });

  if (error) {
    alert("خطأ بالحفظ: " + error.message);
    return;
  }

  if ($any("newUsername")) $any("newUsername").value = "";
  await loadUsers();
  alert("تم حفظ المستخدم ✅");
}

async function setBlocked(username, blocked) {
  const { error } = await client.from("app_users").update({ blocked }).eq("username", username);
  if (error) {
    alert("خطأ: " + error.message);
    return;
  }
  await loadUsers();
}

async function deleteUser(username) {
  if (!confirm(`تأكيد حذف المستخدم "${username}" ؟`)) return;

  const { error } = await client.from("app_users").delete().eq("username", username);
  if (error) {
    alert("خطأ: " + error.message);
    return;
  }
  await loadUsers();
}

function renderUsersTable(users) {
  const tb = $any("usersTbody");
  if (!tb) return;
  tb.innerHTML = "";

  users.forEach((u) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = u.username;

    const tdPass = document.createElement("td");
    tdPass.className = "num";
    tdPass.textContent = u.pass;

    const tdAdmin = document.createElement("td");
    tdAdmin.innerHTML = u.is_admin ? `<span class="badge g">YES</span>` : `<span class="badge">NO</span>`;

    const tdState = document.createElement("td");
    tdState.innerHTML = u.blocked ? `<span class="badge r">محظور</span>` : `<span class="badge g">مفعّل</span>`;

    const tdAct = document.createElement("td");
    tdAct.style.display = "flex";
    tdAct.style.gap = "8px";
    tdAct.style.flexWrap = "wrap";

    const btnToggle = document.createElement("button");
    btnToggle.className = "btn yellow";
    btnToggle.textContent = u.blocked ? "فك الحظر" : "حظر";
    btnToggle.onclick = () => setBlocked(u.username, !u.blocked);

    const btnDel = document.createElement("button");
    btnDel.className = "btn red";
    btnDel.textContent = "حذف";
    btnDel.onclick = () => deleteUser(u.username);

    const btnPick = document.createElement("button");
    btnPick.className = "btn gray";
    btnPick.textContent = "اختيار";
    btnPick.onclick = async () => {
      const sel = $any("userSelect");
      if (sel) sel.value = u.username;
      state.currentUser = u.username;
      await loadInvoicesForUser(); // ✅ مهم للفواتير
      window.scrollTo({
        top: (sel?.getBoundingClientRect().top || 0) + window.scrollY - 80,
        behavior: "smooth",
      });
    };

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

async function loadUsers() {
  const q = (($any("searchUser")?.value) || "").trim();

  let query = client
    .from("app_users")
    .select("id, username, pass, is_admin, blocked, created_at")
    .order("created_at", { ascending: false })
    .range(state.usersPage * state.pageSize, state.usersPage * state.pageSize + state.pageSize - 1);

  if (q) query = query.ilike("username", `%${q}%`);

  const { data, error } = await query;

  if (error) {
    setPill(false, "خطأ اتصال");
    alert("خطأ تحميل المستخدمين: " + error.message);
    return;
  }

  setPill(true, "مفتوح");
  state.lastUsers = data || [];
  renderUsersTable(state.lastUsers);
  fillUserSelect(state.lastUsers);
}

function fillUserSelect(users) {
  const sel = $any("userSelect");
  if (!sel) return;

  const current = sel.value;
  const base = `<option value="">— اختر المستخدم —</option>`;
  const options = (users || []).map((u) => `<option value="${u.username}">${u.username}</option>`).join("");
  sel.innerHTML = base + options;

  if (current) sel.value = current;
}

/* =========================
   Invoices list (per user)
   ========================= */

function getSelectedUser() {
  return (($any("userSelect")?.value) || "").trim();
}

function getInvoiceSelectEl() {
  return $any("invoiceSelect", "invoicesSelect", "invoice_id_select", "invoiceSelectEl");
}

function setInvoiceHint(text) {
  const el = $any("invoiceHint", "invoiceStatus", "invoiceNote");
  if (el) el.textContent = text || "";
}

function renderInvoicesDropdown() {
  const sel = getInvoiceSelectEl();
  if (!sel) return;

  const base = `<option value="">— اختر فاتورة —</option>`;
  const opts = (state.invoices || [])
    .map((inv) => {
      const when = fmtDateTime(inv.created_at);
      const totalTxt = (inv.total ?? 0);
      const label = `${when} — ${totalTxt} — ${shortId(inv.id)}`;
      return `<option value="${inv.id}">${label}</option>`;
    })
    .join("");

  sel.innerHTML = base + opts;

  // preserve selection if exists
  if (state.currentInvoiceId) sel.value = state.currentInvoiceId;
}

async function loadInvoicesForUser() {
  const username = getSelectedUser();
  if (!username) {
    state.invoices = [];
    state.currentInvoiceId = null;
    renderInvoicesDropdown();
    setInvoiceHint("اختر المستخدم أولاً");
    return;
  }

  state.currentUser = username;
  const { fromISO, toISO } = getDateRangeFilter();

  let q = client
    .from("app_invoices")
    .select("id, username, total, created_at")
    .eq("username", username)
    .order("created_at", { ascending: false });

  if (fromISO) q = q.gte("created_at", fromISO);
  if (toISO) q = q.lte("created_at", toISO);

  const { data, error } = await q;
  if (error) {
    alert("خطأ تحميل الفواتير: " + error.message);
    return;
  }

  state.invoices = data || [];
  // إذا ما في تحديد، خلّيها فاضية
  if (state.invoices.length === 0) {
    state.currentInvoiceId = null;
    setInvoiceHint("لا توجد فواتير ضمن هذا التاريخ");
  } else {
    setInvoiceHint(`تم تحميل ${state.invoices.length} فاتورة ✅`);
  }
  renderInvoicesDropdown();
}

/* =========================
   Operations by invoice
   ========================= */

async function loadOpsForInvoice(invoiceId) {
  if (!invoiceId) return [];

  const { data, error } = await client
    .from("app_operations")
    .select("id, username, invoice_id, label, operation, result, created_at")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  if (error) {
    alert("خطأ تحميل عمليات الفاتورة: " + error.message);
    return [];
  }
  return data || [];
}

function renderInvoiceOps(ops) {
  const tb = $any("opsTbody");
  if (!tb) return;
  tb.innerHTML = "";

  let grand = 0;
  const sums = {};

  (ops || []).forEach((op) => {
    const tr = document.createElement("tr");

    const tdTime = document.createElement("td");
    tdTime.textContent = fmtDateTime(op.created_at);

    const tdLabel = document.createElement("td");
    tdLabel.textContent = op.label || "عملية";

    const tdOp = document.createElement("td");
    tdOp.textContent = op.operation || "";

    const tdRes = document.createElement("td");
    tdRes.className = "num";
    tdRes.textContent = op.result ?? "";

    const r = safeNum(op.result);
    grand += r;
    const key = (op.label || "عملية").trim();
    sums[key] = (sums[key] || 0) + r;

    tr.appendChild(tdTime);
    tr.appendChild(tdLabel);
    tr.appendChild(tdOp);
    tr.appendChild(tdRes);
    tb.appendChild(tr);
  });

  if ($any("grandTotal")) $any("grandTotal").textContent = String(grand);

  // meta chips
  const meta = $any("invoiceMeta");
  if (meta) {
    const username = state.currentUser || "—";
    const count = (ops || []).length;
    let fromTxt = "—";
    let toTxt = "—";
    if (count) {
      fromTxt = fmtDateTime(ops[0].created_at);
      toTxt = fmtDateTime(ops[count - 1].created_at);
    }
    meta.innerHTML = `
      <div class="chip">العميل: ${username}</div>
      <div class="chip">عدد العمليات: ${count}</div>
      <div class="chip">من: ${fromTxt}</div>
      <div class="chip">إلى: ${toTxt}</div>
      <div class="chip">فاتورة: ${shortId(state.currentInvoiceId)}</div>
    `;
  }

  // totals by label
  const box = $any("totalsByLabel");
  if (box) {
    box.innerHTML = "";
    Object.keys(sums)
      .sort()
      .forEach((k) => {
        const div = document.createElement("div");
        div.className = "total";
        div.innerHTML = `<span>إجمالي (${k}):</span><span style="direction:ltr">${sums[k]}</span>`;
        box.appendChild(div);
      });
  }
}

async function openSelectedInvoice() {
  const sel = getInvoiceSelectEl();
  const invoiceId = (sel?.value || "").trim();

  if (!getSelectedUser()) {
    alert("اختر المستخدم أولاً");
    return;
  }
  if (!invoiceId) {
    alert("اختر فاتورة من القائمة");
    return;
  }

  state.currentInvoiceId = invoiceId;
  const ops = await loadOpsForInvoice(invoiceId);
  state.currentOps = ops;
  renderInvoiceOps(ops);

  const card = $any("invoiceCard");
  if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
}

function printInvoice() {
  window.print();
}

/* =========================
   Delete selected invoice (cascade)
   ========================= */

function getConfirmNameValue() {
  return (($any("confirmName")?.value) || "").trim();
}

async function deleteSelectedInvoice() {
  const username = getSelectedUser();
  if (!username) {
    alert("اختر المستخدم أولاً");
    return;
  }

  const sel = getInvoiceSelectEl();
  const invoiceId = (sel?.value || "").trim();
  if (!invoiceId) {
    alert("اختر فاتورة أولاً");
    return;
  }

  const confirmName = getConfirmNameValue();
  if (confirmName !== username) {
    alert("اكتب اسم المستخدم حرفيًا للتأكيد");
    return;
  }

  if (!confirm(`تأكيد حذف الفاتورة المختارة؟\nسيتم حذف عملياتها تلقائياً (CASCADE).`)) return;

  const { error } = await client.from("app_invoices").delete().eq("id", invoiceId);
  if (error) {
    alert("خطأ بالحذف: " + error.message);
    return;
  }

  // reset view
  state.currentInvoiceId = null;
  state.currentOps = [];
  renderInvoiceOps([]);
  if ($any("confirmName")) $any("confirmName").value = "";

  await loadInvoicesForUser();
  alert("تم حذف الفاتورة ✅");
}

async function archiveThenDeleteSelectedInvoice() {
  // تأكد فاتورة مفتوحة/معروضة
  await openSelectedInvoice();
  // اطبع/احفظ PDF
  printInvoice();
  // بعدها احذف
  setTimeout(async () => {
    await deleteSelectedInvoice();
  }, 800);
}

/* =========================
   (قديم) حذف كل عمليات المستخدم — تنظيف
   ========================= */
async function deleteAllOpsForUserLegacy() {
  const username = getSelectedUser();
  if (!username) {
    alert("اختر المستخدم أولاً");
    return;
  }
  const confirmName = getConfirmNameValue();
  if (confirmName !== username) {
    alert("اكتب اسم المستخدم حرفيًا للتأكيد");
    return;
  }

  if (!confirm(`تأكيد حذف كل عمليات المستخدم "${username}" (تنظيف قديم)؟`)) return;

  const { error } = await client.from("app_operations").delete().eq("username", username);
  if (error) {
    alert("خطأ بالحذف: " + error.message);
    return;
  }

  if ($any("confirmName")) $any("confirmName").value = "";
  alert("تم حذف كل عمليات المستخدم ✅");
}

/* =========================
   UI events
   ========================= */

function wire() {
  // users
  $any("genPass") && ($any("genPass").onclick = genPassword);
  $any("addUser") && ($any("addUser").onclick = addUser);

  $any("refreshUsers") &&
    ($any("refreshUsers").onclick = async () => {
      state.usersPage = 0;
      await loadUsers();
    });

  $any("searchUser") &&
    $any("searchUser").addEventListener("input", async () => {
      state.usersPage = 0;
      await loadUsers();
    });

  $any("prevUsers") &&
    ($any("prevUsers").onclick = async () => {
      if (state.usersPage > 0) state.usersPage--;
      await loadUsers();
    });

  $any("nextUsers") &&
    ($any("nextUsers").onclick = async () => {
      state.usersPage++;
      await loadUsers();
    });

  // user select -> load invoices immediately
  $any("userSelect") &&
    $any("userSelect").addEventListener("change", async () => {
      state.currentUser = getSelectedUser() || null;
      state.currentInvoiceId = null;
      await loadInvoicesForUser();
    });

  // quick dates
  $any("quickToday") &&
    ($any("quickToday").onclick = () => {
      const today = nowISODate();
      $any("fromDate") && ($any("fromDate").value = today);
      $any("toDate") && ($any("toDate").value = today);
    });

  $any("quick7") &&
    ($any("quick7").onclick = () => {
      $any("fromDate") && ($any("fromDate").value = daysAgoISO(7));
      $any("toDate") && ($any("toDate").value = nowISODate());
    });

  $any("clearDates") &&
    ($any("clearDates").onclick = () => {
      $any("fromDate") && ($any("fromDate").value = "");
      $any("toDate") && ($any("toDate").value = "");
    });

  // invoices list actions
  $any("refreshInvoices", "refreshInvoicesBtn", "refreshInvoicesList", "updateInvoices") &&
    ($any("refreshInvoices", "refreshInvoicesBtn", "refreshInvoicesList", "updateInvoices").onclick = async () => {
      await loadInvoicesForUser();
    });

  // when invoice dropdown changes -> remember selection
  const invSel = getInvoiceSelectEl();
  invSel &&
    invSel.addEventListener("change", () => {
      state.currentInvoiceId = (invSel.value || "").trim() || null;
    });

  // open selected invoice
  $any("openInvoice", "openSelectedInvoice", "viewInvoice", "openInvoiceBtn") &&
    ($any("openInvoice", "openSelectedInvoice", "viewInvoice", "openInvoiceBtn").onclick = async () => {
      await openSelectedInvoice();
    });

  // print
  $any("printInvoice") &&
    ($any("printInvoice").onclick = () => {
      printInvoice();
    });

  // delete selected invoice
  $any("deleteInvoice", "deleteSelectedInvoice", "deleteInvoiceBtn") &&
    ($any("deleteInvoice", "deleteSelectedInvoice", "deleteInvoiceBtn").onclick = async () => {
      await deleteSelectedInvoice();
    });

  // archive + delete selected invoice
  $any("archiveAndDelete", "archiveDeleteInvoice", "archiveThenDelete", "archiveAndDeleteBtn") &&
    ($any("archiveAndDelete", "archiveDeleteInvoice", "archiveThenDelete", "archiveAndDeleteBtn").onclick = async () => {
      await archiveThenDeleteSelectedInvoice();
    });

  // legacy delete all ops
  $any("deleteUserOps", "deleteAllOps", "deleteAllOpsBtn") &&
    ($any("deleteUserOps", "deleteAllOps", "deleteAllOpsBtn").onclick = async () => {
      await deleteAllOpsForUserLegacy();
    });

  // scroll to invoice
  $any("scrollToInvoice") &&
    ($any("scrollToInvoice").onclick = () => {
      $any("invoiceCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
}

async function boot() {
  try {
    wire();
    await loadUsers();
    await loadInvoicesForUser(); // إذا كان في user مختار مسبقاً
    setPill(true, "مفتوح");
  } catch (e) {
    console.error(e);
    setPill(false, "مغلق");
  }
}

boot();
