/* =========================
   HAYEK SPOT — Admin Panel (Invoices List + Multi Invoices)
   ========================= */
const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";
const SUPABASE_KEY = "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);

const state = {
  usersPage: 0,
  pageSize: 15,
  lastUsers: [],
  currentUser: null,

  invoices: [],
  currentInvoiceId: null,

  currentOps: [],
};

function setPill(ok, msg){
  const pill = $("pill");
  if(!pill) return;
  pill.textContent = msg || (ok ? "مفتوح" : "مغلق");
  pill.style.background = ok ? "var(--green)" : "var(--red)";
  pill.style.color = ok ? "var(--dark)" : "var(--text)";
}

function nowISODate(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function daysAgoISO(n){
  const d = new Date();
  d.setDate(d.getDate()-n);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function safeNum(x){
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function fmtDateTime(ts){
  try{
    const d = new Date(ts);
    return d.toLocaleString("ar-EG", { hour12: true });
  }catch{ return String(ts || ""); }
}

function must(id){
  const el = $(id);
  if(!el) console.warn("Missing element id:", id);
  return el;
}

/* =========================
   Users (CRUD + block/unblock)
   ========================= */

function genPassword(){
  const p = Math.floor(100000 + Math.random()*900000);
  if($("newPass")) $("newPass").value = String(p);
}

async function addUser(){
  const username = ($("newUsername")?.value || "").trim();
  const pass = ($("newPass")?.value || "").trim();
  const is_admin = ($("newIsAdmin")?.value || "false") === "true";

  if(!username || !pass){
    alert("اكتب اسم المستخدم وكلمة السر");
    return;
  }

  const { error } = await client.from("app_users").insert({
    username, pass, is_admin, blocked: false
  });

  if(error){
    alert("خطأ بالحفظ: " + error.message);
    return;
  }

  $("newUsername").value = "";
  await loadUsers();
  alert("تم حفظ المستخدم ✅");
}

async function setBlocked(username, blocked){
  const { error } = await client
    .from("app_users")
    .update({ blocked })
    .eq("username", username);

  if(error){
    alert("خطأ: " + error.message);
    return;
  }
  await loadUsers();
}

async function deleteUser(username){
  if(!confirm(`تأكيد حذف المستخدم "${username}" ؟`)) return;

  const { error } = await client
    .from("app_users")
    .delete()
    .eq("username", username);

  if(error){
    alert("خطأ: " + error.message);
    return;
  }
  await loadUsers();
}

function renderUsersTable(users){
  const tb = $("usersTbody");
  if(!tb) return;
  tb.innerHTML = "";

  users.forEach(u => {
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
      $("userSelect").value = u.username;
      state.currentUser = u.username;
      state.currentInvoiceId = null;
      clearInvoicePreview();
      await loadInvoicesList();
      window.scrollTo({ top: $("userSelect").getBoundingClientRect().top + window.scrollY - 80, behavior:"smooth" });
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

async function loadUsers(){
  const q = ($("searchUser")?.value || "").trim();

  let query = client
    .from("app_users")
    .select("id, username, pass, is_admin, blocked, created_at")
    .order("created_at", { ascending: false })
    .range(state.usersPage * state.pageSize, state.usersPage * state.pageSize + state.pageSize - 1);

  if(q){
    query = query.ilike("username", `%${q}%`);
  }

  const { data, error } = await query;

  if(error){
    setPill(false, "خطأ اتصال");
    alert("خطأ تحميل المستخدمين: " + error.message);
    return;
  }

  setPill(true, "مفتوح");
  state.lastUsers = data || [];
  renderUsersTable(state.lastUsers);
  fillUserSelect(state.lastUsers);
}

function fillUserSelect(users){
  const sel = $("userSelect");
  if(!sel) return;

  const current = sel.value;
  const base = `<option value="">— اختر المستخدم —</option>`;
  const options = (users || []).map(u => `<option value="${u.username}">${u.username}</option>`).join("");
  sel.innerHTML = base + options;

  if(current) sel.value = current;
}

/* =========================
   Invoices List (per user) + date filters
   ========================= */

function getDateRangeFilter(){
  const from = $("fromDate")?.value;
  const to = $("toDate")?.value;

  // inclusive to end of day
  const fromISO = from ? new Date(from + "T00:00:00").toISOString() : null;
  const toISO = to ? new Date(to + "T23:59:59").toISOString() : null;

  return { fromISO, toISO, from, to };
}

function fillInvoiceSelect(invoices){
  const sel = $("invoiceSelect");
  if(!sel) return;

  const base = `<option value="">— اختر فاتورة —</option>`;
  const options = (invoices || []).map(inv => {
    const dt = fmtDateTime(inv.created_at);
    const total = safeNum(inv.total);
    return `<option value="${inv.id}">فاتورة: ${dt} — الإجمالي: ${total}</option>`;
  }).join("");

  sel.innerHTML = base + options;

  // حاول ترجع الاختيار إن كان موجود
  if(state.currentInvoiceId){
    sel.value = state.currentInvoiceId;
  }
}

async function loadInvoicesList(){
  const username = $("userSelect")?.value;
  if(!username){
    fillInvoiceSelect([]);
    return;
  }
  state.currentUser = username;

  const { fromISO, toISO } = getDateRangeFilter();

  let query = client
    .from("app_invoices")
    .select("id, username, total, created_at, device_id")
    .eq("username", username)
    .order("created_at", { ascending: false });

  if(fromISO) query = query.gte("created_at", fromISO);
  if(toISO) query = query.lte("created_at", toISO);

  const { data, error } = await query;

  if(error){
    alert("خطأ تحميل قائمة الفواتير: " + error.message);
    return;
  }

  state.invoices = data || [];
  fillInvoiceSelect(state.invoices);
}

/* =========================
   Open invoice -> operations + totals + meta
   ========================= */

async function openSelectedInvoice(){
  const username = $("userSelect")?.value;
  const invoiceId = $("invoiceSelect")?.value;

  if(!username){
    alert("اختر المستخدم أولاً");
    return;
  }
  if(!invoiceId){
    alert("اختر فاتورة أولاً");
    return;
  }

  state.currentUser = username;
  state.currentInvoiceId = invoiceId;

  // 1) جلب العمليات لهذه الفاتورة فقط
  const { data, error } = await client
    .from("app_operations")
    .select("id, username, label, operation, result, created_at, invoice_id")
    .eq("username", username)
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  if(error){
    alert("خطأ تحميل الفاتورة: " + error.message);
    return;
  }

  state.currentOps = data || [];
  renderInvoicePreview();
}

function clearInvoicePreview(){
  state.currentOps = [];
  state.currentInvoiceId = null;

  const tb = $("opsTbody");
  if(tb) tb.innerHTML = "";

  const meta = $("invoiceMeta");
  if(meta) meta.innerHTML = "";

  const totals = $("totalsByLabel");
  if(totals) totals.innerHTML = "";

  const grand = $("grandTotal");
  if(grand) grand.textContent = "0";
}

function renderInvoicePreview(){
  const tb = $("opsTbody");
  if(!tb) return;
  tb.innerHTML = "";

  let grand = 0;
  const sums = {}; // label => total

  state.currentOps.forEach(op => {
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

  $("grandTotal").textContent = String(grand);

  // Meta chips
  const meta = $("invoiceMeta");
  const username = state.currentUser || "—";
  const count = state.currentOps.length;

  let fromTxt = "—";
  let toTxt = "—";
  if(count){
    fromTxt = fmtDateTime(state.currentOps[0].created_at);
    toTxt = fmtDateTime(state.currentOps[count-1].created_at);
  }

  meta.innerHTML = `
    <div class="chip">العميل: ${username}</div>
    <div class="chip">رقم الفاتورة: ${state.currentInvoiceId || "—"}</div>
    <div class="chip">عدد العمليات: ${count}</div>
    <div class="chip">من: ${fromTxt}</div>
    <div class="chip">إلى: ${toTxt}</div>
  `;

  // Totals by label
  const box = $("totalsByLabel");
  box.innerHTML = "";
  Object.keys(sums).sort().forEach(k => {
    const v = sums[k];
    const div = document.createElement("div");
    div.className = "total";
    div.innerHTML = `<span>إجمالي (${k}):</span><span style="direction:ltr">${v}</span>`;
    box.appendChild(div);
  });

  // نزّل للمعاينة
  $("invoiceCard")?.scrollIntoView({ behavior:"smooth", block:"start" });
}

function printInvoice(){
  // فقط يفتح نافذة الطباعة
  window.print();
}

/* =========================
   Delete: invoice only (recommended) + old delete all ops (legacy)
   ========================= */

async function deleteSelectedInvoice(){
  const username = $("userSelect")?.value;
  const invoiceId = $("invoiceSelect")?.value;

  if(!username){
    alert("اختر المستخدم أولاً");
    return;
  }
  if(!invoiceId){
    alert("اختر فاتورة أولاً");
    return;
  }

  const confirmName = ($("confirmName")?.value || "").trim();
  if(confirmName !== username){
    alert("اكتب اسم المستخدم حرفيًا للتأكيد");
    return;
  }

  if(!confirm(`تأكيد حذف الفاتورة المختارة؟\nسيتم حذف عملياتها أيضًا تلقائيًا.`)) return;

  // حذف الفاتورة — وبسبب FK ON DELETE CASCADE سيتم حذف عملياتها تلقائيًا (إذا كان FK مفعّل عندك)
  const { error } = await client
    .from("app_invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("username", username);

  if(error){
    alert("خطأ بالحذف: " + error.message);
    return;
  }

  $("confirmName").value = "";

  // تحديث القائمة + تنظيف المعاينة
  clearInvoicePreview();
  await loadInvoicesList();
  alert("تم حذف الفاتورة ✅");
}

// خيار قديم: حذف كل عمليات المستخدم (تنظيف شامل)
async function deleteOpsForUser(){
  const username = $("userSelect")?.value;
  if(!username){
    alert("اختر المستخدم أولاً");
    return;
  }
  const confirmName = ($("confirmName")?.value || "").trim();
  if(confirmName !== username){
    alert("اكتب اسم المستخدم حرفيًا للتأكيد");
    return;
  }

  if(!confirm(`تأكيد حذف كل عمليات المستخدم "${username}" من جدول app_operations ؟`)) return;

  const { error } = await client
    .from("app_operations")
    .delete()
    .eq("username", username);

  if(error){
    alert("خطأ بالحذف: " + error.message);
    return;
  }

  $("confirmName").value = "";
  clearInvoicePreview();
  await loadInvoicesList();
  alert("تم حذف عمليات المستخدم ✅");
}

// أرشفة PDF ثم حذف كل عمليات المستخدم (قديم)
async function archiveAndDelete(){
  const username = $("userSelect")?.value;
  if(!username){
    alert("اختر المستخدم أولاً");
    return;
  }
  const confirmName = ($("confirmName")?.value || "").trim();
  if(confirmName !== username){
    alert("اكتب اسم المستخدم حرفيًا للتأكيد قبل الأرشفة/الحذف");
    return;
  }

  // اطبع (PDF)
  window.print();

  // بعد الطباعة: حذف شامل عمليات المستخدم
  setTimeout(async () => {
    await deleteOpsForUser();
  }, 800);
}

/* =========================
   UI events
   ========================= */

function wire(){
  // Users
  must("genPass").onclick = genPassword;
  must("addUser").onclick = addUser;

  must("refreshUsers").onclick = async () => {
    state.usersPage = 0;
    await loadUsers();
  };

  must("searchUser").addEventListener("input", async () => {
    state.usersPage = 0;
    await loadUsers();
  });

  must("prevUsers").onclick = async () => {
    if(state.usersPage > 0) state.usersPage--;
    await loadUsers();
  };

  must("nextUsers").onclick = async () => {
    state.usersPage++;
    await loadUsers();
  };

  // User select
  must("userSelect").addEventListener("change", async () => {
    state.currentUser = $("userSelect").value || null;
    state.currentInvoiceId = null;
    clearInvoicePreview();
    await loadInvoicesList();
  });

  // Date quick filters
  must("quickToday").onclick = () => {
    const today = nowISODate();
    $("fromDate").value = today;
    $("toDate").value = today;
  };

  must("quick7").onclick = () => {
    $("fromDate").value = daysAgoISO(7);
    $("toDate").value = nowISODate();
  };

  must("clearDates").onclick = () => {
    $("fromDate").value = "";
    $("toDate").value = "";
  };

  // Invoices list actions
  must("loadInvoices").onclick = async () => {
    await loadInvoicesList();
    alert("تم تحديث قائمة الفواتير ✅");
  };

  must("openInvoice").onclick = async () => {
    await openSelectedInvoice();
  };

  must("deleteInvoice").onclick = async () => {
    await deleteSelectedInvoice();
  };

  // Old button in users card (kept): viewInvoice = openSelectedInvoice (uses selected invoice)
  // If no invoice selected, it will warn.
  must("viewInvoice").onclick = async () => {
    await openSelectedInvoice();
  };

  // Print
  must("printInvoice").onclick = () => {
    printInvoice();
  };

  // Legacy clean buttons
  must("deleteUserOps").onclick = async () => {
    await deleteOpsForUser();
  };

  must("archiveAndDelete").onclick = async () => {
    await archiveAndDelete();
  };

  // Scrolls
  must("scrollToInvoice").onclick = () => {
    $("invoiceCard")?.scrollIntoView({ behavior:"smooth", block:"start" });
  };
  must("scrollToInvoice2").onclick = () => {
    $("invoiceCard")?.scrollIntoView({ behavior:"smooth", block:"start" });
  };

  // When invoice selection changes: just set state
  must("invoiceSelect").addEventListener("change", () => {
    state.currentInvoiceId = $("invoiceSelect").value || null;
  });
}

async function boot(){
  try{
    wire();
    await loadUsers();
    await loadInvoicesList(); // إذا كان في مستخدم مختار
    setPill(true, "مفتوح");
  }catch(e){
    console.error(e);
    setPill(false, "مغلق");
  }
}

boot();
