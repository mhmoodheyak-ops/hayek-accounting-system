/* =========================
   HAYEK SPOT — Admin Panel (Invoices v2)
   - Users CRUD + block/unblock
   - Per-user invoices list (app_invoices)
   - Open selected invoice -> operations where invoice_id
   - Delete selected invoice (cascade deletes ops via FK)
   - Legacy view: operations with invoice_id IS NULL
   ========================= */

const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";
const SUPABASE_KEY = "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";

const $ = (id) => document.getElementById(id);

const state = {
  usersPage: 0,
  pageSize: 15,
  lastUsers: [],
  currentUser: null,

  invoices: [],
  currentInvoiceId: null, // uuid or "__legacy__"
  currentOps: [],
};

function setPill(ok, msg){
  const pill = $("pill");
  if(!pill) return;
  pill.textContent = msg || (ok ? "مفتوح" : "مغلق");
  pill.style.background = ok ? "var(--green)" : "var(--red)";
  pill.style.color = ok ? "#0b0f14" : "var(--text)";
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

function getDateRangeFilter(){
  const from = $("fromDate")?.value || "";
  const to = $("toDate")?.value || "";

  const fromISO = from ? new Date(from + "T00:00:00").toISOString() : null;
  const toISO = to ? new Date(to + "T23:59:59").toISOString() : null;
  return { fromISO, toISO, from, to };
}

/* =========================
   Supabase client
   ========================= */
let client = null;

function ensureClient(){
  if(client) return true;
  if(!window.supabase || !window.supabase.createClient){
    setPill(false, "مغلق");
    console.error("Supabase library not loaded. Check <script src='@supabase/supabase-js@2'> before admin.js");
    return false;
  }
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return true;
}

/* =========================
   Users (CRUD + block/unblock)
   ========================= */

function genPassword(){
  const p = Math.floor(100000 + Math.random()*900000);
  if($("newPass")) $("newPass").value = String(p);
}

async function addUser(){
  if(!ensureClient()) return;

  const username = ($("newUsername")?.value || "").trim();
  const pass = ($("newPass")?.value || "").trim();
  const is_admin = ($("newIsAdmin")?.value === "true");

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

  if($("newUsername")) $("newUsername").value = "";
  await loadUsers();
  alert("تم حفظ المستخدم ✅");
}

async function setBlocked(username, blocked){
  if(!ensureClient()) return;

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
  if(!ensureClient()) return;

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

  (users || []).forEach(u => {
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

    const btnPick = document.createElement("button");
    btnPick.className = "btn gray";
    btnPick.textContent = "اختيار";
    btnPick.onclick = async () => {
      const sel = $("userSelect");
      if(sel){
        sel.value = u.username;
        state.currentUser = u.username;
        await loadInvoicesForUser(); // تحديث قائمة الفواتير فورًا
      }
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

function fillUserSelect(users){
  const sel = $("userSelect");
  if(!sel) return;

  const current = sel.value;
  const base = `<option value="">— اختر المستخدم —</option>`;
  const options = (users || [])
    .map(u => `<option value="${u.username}">${u.username}</option>`)
    .join("");
  sel.innerHTML = base + options;
  if(current) sel.value = current;
}

async function loadUsers(){
  if(!ensureClient()) return;

  const q = ($("searchUser")?.value || "").trim();

  let query = client
    .from("app_users")
    .select("id, username, pass, is_admin, blocked, created_at")
    .order("created_at", { ascending: false })
    .range(state.usersPage * state.pageSize, state.usersPage * state.pageSize + state.pageSize - 1);

  if(q) query = query.ilike("username", `%${q}%`);

  const { data, error } = await query;
  if(error){
    setPill(false, "خطأ اتصال");
    console.error(error);
    alert("خطأ تحميل المستخدمين: " + error.message);
    return;
  }

  setPill(true, "مفتوح");
  state.lastUsers = data || [];
  renderUsersTable(state.lastUsers);
  fillUserSelect(state.lastUsers);
}

/* =========================
   Invoices list + Open invoice
   ========================= */

function fillInvoiceSelect(){
  const sel = $("invoiceSelect");
  if(!sel) return;

  const base = `<option value="">— اختر فاتورة —</option>`;
  const legacy = `<option value="__legacy__">فاتورة قديمة (عمليات بدون invoice_id)</option>`;

  const opts = (state.invoices || []).map((inv, idx) => {
    const dt = fmtDateTime(inv.created_at);
    const total = safeNum(inv.total);
    const label = `فاتورة ${idx+1} — ${dt} — مجموع: ${total}`;
    return `<option value="${inv.id}">${label}</option>`;
  }).join("");

  sel.innerHTML = base + legacy + opts;
}

async function loadInvoicesForUser(){
  if(!ensureClient()) return;

  const username = $("userSelect")?.value || "";
  if(!username){
    state.currentUser = null;
    state.invoices = [];
    state.currentInvoiceId = null;
    fillInvoiceSelect();
    clearInvoiceView();
    return;
  }
  state.currentUser = username;

  const { fromISO, toISO } = getDateRangeFilter();

  let q = client
    .from("app_invoices")
    .select("id, username, total, created_at, device_id")
    .eq("username", username)
    .order("created_at", { ascending: false });

  if(fromISO) q = q.gte("created_at", fromISO);
  if(toISO) q = q.lte("created_at", toISO);

  const { data, error } = await q;
  if(error){
    console.error(error);
    alert("خطأ تحميل قائمة الفواتير: " + error.message);
    return;
  }

  state.invoices = data || [];
  fillInvoiceSelect();

  // اختياري: إذا ما في اختيار حالي، خلّيه فاضي
  state.currentInvoiceId = $("invoiceSelect")?.value || null;
}

function clearInvoiceView(){
  state.currentOps = [];
  const tb = $("opsTbody");
  if(tb) tb.innerHTML = "";
  if($("grandTotal")) $("grandTotal").textContent = "0";
  if($("invoiceMeta")) $("invoiceMeta").innerHTML = "";
  if($("totalsByLabel")) $("totalsByLabel").innerHTML = "";
}

async function updateInvoiceTotal(invoiceId){
  if(!ensureClient()) return;
  if(!invoiceId || invoiceId === "__legacy__") return;

  const username = state.currentUser;
  if(!username) return;

  // Sum results for this invoice
  const { data, error } = await client
    .from("app_operations")
    .select("result")
    .eq("username", username)
    .eq("invoice_id", invoiceId);

  if(error){
    console.warn("Could not sum invoice total:", error.message);
    return;
  }

  const total = (data || []).reduce((acc, r) => acc + safeNum(r.result), 0);

  const up = await client
    .from("app_invoices")
    .update({ total })
    .eq("id", invoiceId)
    .eq("username", username);

  if(up.error){
    console.warn("Could not update invoice total:", up.error.message);
  }else{
    // حدّث النسخة داخل الذاكرة
    state.invoices = (state.invoices || []).map(x => x.id === invoiceId ? ({...x, total}) : x);
    fillInvoiceSelect();
    // رجّع الاختيار
    const sel = $("invoiceSelect");
    if(sel) sel.value = invoiceId;
  }
}

async function openSelectedInvoice(){
  if(!ensureClient()) return;

  const username = $("userSelect")?.value || "";
  if(!username){
    alert("اختر المستخدم أولاً");
    return;
  }

  const invoiceId = $("invoiceSelect")?.value || "";
  if(!invoiceId){
    alert("اختر فاتورة أولاً");
    return;
  }

  state.currentUser = username;
  state.currentInvoiceId = invoiceId;

  const { fromISO, toISO } = getDateRangeFilter();

  let q = client
    .from("app_operations")
    .select("id, username, label, operation, result, created_at, invoice_id")
    .eq("username", username)
    .order("created_at", { ascending: true });

  if(invoiceId === "__legacy__"){
    q = q.is("invoice_id", null);
    if(fromISO) q = q.gte("created_at", fromISO);
    if(toISO) q = q.lte("created_at", toISO);
  }else{
    q = q.eq("invoice_id", invoiceId);
  }

  const { data, error } = await q;
  if(error){
    console.error(error);
    alert("خطأ فتح الفاتورة: " + error.message);
    return;
  }

  state.currentOps = data || [];
  renderInvoice();

  // حدّث مجموع الفاتورة الجديدة
  if(invoiceId !== "__legacy__"){
    await updateInvoiceTotal(invoiceId);
  }

  $("invoiceCard")?.scrollIntoView({ behavior:"smooth", block:"start" });
}

function renderInvoice(){
  const tb = $("opsTbody");
  if(!tb) return;
  tb.innerHTML = "";

  let grand = 0;
  const sums = {};

  (state.currentOps || []).forEach(op => {
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

  if($("grandTotal")) $("grandTotal").textContent = String(grand);

  // Meta chips
  const meta = $("invoiceMeta");
  if(meta){
    const username = state.currentUser || "—";
    const count = (state.currentOps || []).length;

    let fromTxt = "—";
    let toTxt = "—";
    if(count){
      fromTxt = fmtDateTime(state.currentOps[0].created_at);
      toTxt = fmtDateTime(state.currentOps[count-1].created_at);
    }

    const invTxt = state.currentInvoiceId === "__legacy__"
      ? "فاتورة قديمة"
      : (state.currentInvoiceId ? "فاتورة جديدة" : "—");

    meta.innerHTML = `
      <div class="chip">العميل: ${username}</div>
      <div class="chip">نوع: ${invTxt}</div>
      <div class="chip">عدد العمليات: ${count}</div>
      <div class="chip">من: ${fromTxt}</div>
      <div class="chip">إلى: ${toTxt}</div>
    `;
  }

  // Totals by label
  const box = $("totalsByLabel");
  if(box){
    box.innerHTML = "";
    Object.keys(sums).sort().forEach(k => {
      const v = sums[k];
      const div = document.createElement("div");
      div.className = "total";
      div.innerHTML = `<span>إجمالي (${k}):</span><span class="num">${v}</span>`;
      box.appendChild(div);
    });
  }
}

/* =========================
   Delete invoice / Delete all ops (legacy)
   ========================= */

async function deleteSelectedInvoice(){
  if(!ensureClient()) return;

  const username = $("userSelect")?.value || "";
  if(!username){
    alert("اختر المستخدم أولاً");
    return;
  }

  const invoiceId = $("invoiceSelect")?.value || "";
  if(!invoiceId){
    alert("اختر فاتورة أولاً");
    return;
  }

  if(invoiceId === "__legacy__"){
    alert("هذه فاتورة قديمة (invoice_id = null). للحذف استخدم زر: حذف كل عمليات المستخدم (تنظيف قديم).");
    return;
  }

  const confirmName = ($("confirmName")?.value || "").trim();
  if(confirmName !== username){
    alert("اكتب اسم المستخدم حرفيًا للتأكيد قبل الحذف");
    return;
  }

  if(!confirm("تأكيد حذف الفاتورة المختارة؟ سيتم حذف عملياتها تلقائيًا (cascade) إذا كان الربط موجود.")) return;

  // Delete invoice row (FK cascade should remove ops)
  const del = await client
    .from("app_invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("username", username);

  if(del.error){
    console.error(del.error);
    alert("خطأ حذف الفاتورة: " + del.error.message);
    return;
  }

  // احتياط: إذا لم يكن FK فعّال، احذف العمليات يدويًا
  await client
    .from("app_operations")
    .delete()
    .eq("username", username)
    .eq("invoice_id", invoiceId);

  if($("confirmName")) $("confirmName").value = "";

  // Refresh
  await loadInvoicesForUser();
  clearInvoiceView();
  alert("تم حذف الفاتورة ✅");
}

async function deleteOpsForUserLegacy(){
  if(!ensureClient()) return;

  const username = $("userSelect")?.value || "";
  if(!username){
    alert("اختر المستخدم أولاً");
    return;
  }

  const confirmName = ($("confirmName")?.value || "").trim();
  if(confirmName !== username){
    alert("اكتب اسم المستخدم حرفيًا للتأكيد");
    return;
  }

  if(!confirm(`تأكيد حذف كل عمليات المستخدم "${username}" من app_operations ؟`)) return;

  const { error } = await client
    .from("app_operations")
    .delete()
    .eq("username", username);

  if(error){
    console.error(error);
    alert("خطأ بالحذف: " + error.message);
    return;
  }

  if($("confirmName")) $("confirmName").value = "";
  clearInvoiceView();
  await loadInvoicesForUser();
  alert("تم حذف كل عمليات المستخدم ✅");
}

function printInvoice(){
  window.print();
}

/* =========================
   UI events
   ========================= */

function wire(){
  // Users
  $("genPass") && ($("genPass").onclick = genPassword);
  $("addUser") && ($("addUser").onclick = addUser);

  $("refreshUsers") && ($("refreshUsers").onclick = async () => {
    state.usersPage = 0;
    await loadUsers();
  });

  $("searchUser") && $("searchUser").addEventListener("input", async () => {
    state.usersPage = 0;
    await loadUsers();
  });

  $("prevUsers") && ($("prevUsers").onclick = async () => {
    if(state.usersPage > 0) state.usersPage--;
    await loadUsers();
  });

  $("nextUsers") && ($("nextUsers").onclick = async () => {
    state.usersPage++;
    await loadUsers();
  });

  // Invoices
  $("userSelect") && $("userSelect").addEventListener("change", async () => {
    state.currentUser = $("userSelect").value || null;
    state.currentInvoiceId = null;
    clearInvoiceView();
    await loadInvoicesForUser();
  });

  $("invoiceSelect") && $("invoiceSelect").addEventListener("change", () => {
    state.currentInvoiceId = $("invoiceSelect").value || null;
  });

  $("quickToday") && ($("quickToday").onclick = () => {
    const today = nowISODate();
    if($("fromDate")) $("fromDate").value = today;
    if($("toDate")) $("toDate").value = today;
  });

  $("quick7") && ($("quick7").onclick = () => {
    if($("fromDate")) $("fromDate").value = daysAgoISO(7);
    if($("toDate")) $("toDate").value = nowISODate();
  });

  $("clearDates") && ($("clearDates").onclick = () => {
    if($("fromDate")) $("fromDate").value = "";
    if($("toDate")) $("toDate").value = "";
  });

  $("refreshInvoices") && ($("refreshInvoices").onclick = async () => {
    await loadInvoicesForUser();
  });

  $("openInvoice") && ($("openInvoice").onclick = async () => {
    await openSelectedInvoice();
  });

  $("printInvoice") && ($("printInvoice").onclick = () => {
    printInvoice();
  });

  $("deleteInvoice") && ($("deleteInvoice").onclick = async () => {
    await deleteSelectedInvoice();
  });

  // Legacy cleanup button
  $("deleteUserOps") && ($("deleteUserOps").onclick = async () => {
    await deleteOpsForUserLegacy();
  });
}

async function boot(){
  try{
    wire();
    if(!ensureClient()){
      setPill(false, "مغلق");
      return;
    }
    await loadUsers();
    await loadInvoicesForUser(); // إذا في مستخدم محدد مسبقًا
    setPill(true, "مفتوح");
  }catch(e){
    console.error(e);
    setPill(false, "مغلق");
  }
}

boot();
