const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";
const SUPABASE_KEY = "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";

console.log("admin.js loaded: invoices-v2 build 99");

// helper
const $ = (id) => document.getElementById(id);

// ✅ trim لحماية أي مسافات/أسطر مخفية
const client = supabase.createClient(SUPABASE_URL.trim(), SUPABASE_KEY.trim());

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
  try{ return new Date(ts).toLocaleString("ar-EG",{hour12:true}); }
  catch{ return String(ts||""); }
}

/* ========= Users ========= */

function genPassword(){
  $("newPass").value = String(Math.floor(100000 + Math.random()*900000));
}

async function addUser(){
  const username = ($("newUsername").value || "").trim();
  const pass = ($("newPass").value || "").trim();
  const is_admin = $("newIsAdmin").value === "true";
  if(!username || !pass){ alert("اكتب اسم المستخدم وكلمة السر"); return; }

  const { error } = await client.from("app_users").insert({
    username, pass, is_admin, blocked: false
  });

  if(error){ alert("خطأ بالحفظ: " + error.message); return; }
  $("newUsername").value = "";
  await loadUsers();
  alert("تم حفظ المستخدم ✅");
}

async function setBlocked(username, blocked){
  const { error } = await client.from("app_users").update({ blocked }).eq("username", username);
  if(error){ alert("خطأ: " + error.message); return; }
  await loadUsers();
}

async function deleteUser(username){
  if(!confirm(`تأكيد حذف المستخدم "${username}" ؟`)) return;
  const { error } = await client.from("app_users").delete().eq("username", username);
  if(error){ alert("خطأ: " + error.message); return; }
  await loadUsers();
}

function renderUsersTable(users){
  const tb = $("usersTbody");
  tb.innerHTML = "";
  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.username}</td>
      <td class="num">${u.pass}</td>
      <td>${u.is_admin ? `<span class="badge g">YES</span>` : `<span class="badge">NO</span>`}</td>
      <td>${u.blocked ? `<span class="badge r">محظور</span>` : `<span class="badge g">مفعّل</span>`}</td>
      <td></td>
    `;
    const tdAct = tr.children[4];
    tdAct.style.display="flex";
    tdAct.style.gap="8px";
    tdAct.style.flexWrap="wrap";

    const btnPick = document.createElement("button");
    btnPick.className="btn gray";
    btnPick.textContent="اختيار";
    btnPick.onclick = async () => {
      $("userSelect").value = u.username;
      state.currentUser = u.username;
      await loadInvoicesForUser();
      window.scrollTo({top:0,behavior:"smooth"});
    };

    const btnToggle = document.createElement("button");
    btnToggle.className="btn yellow";
    btnToggle.textContent = u.blocked ? "فك الحظر" : "حظر";
    btnToggle.onclick = () => setBlocked(u.username, !u.blocked);

    const btnDel = document.createElement("button");
    btnDel.className="btn red";
    btnDel.textContent="حذف";
    btnDel.onclick = () => deleteUser(u.username);

    tdAct.appendChild(btnPick);
    tdAct.appendChild(btnToggle);
    tdAct.appendChild(btnDel);

    tb.appendChild(tr);
  });
}

async function loadUsers(){
  const q = ($("searchUser").value || "").trim();

  let query = client
    .from("app_users")
    .select("id, username, pass, is_admin, blocked, created_at")
    .order("created_at", { ascending: false })
    .range(state.usersPage*state.pageSize, state.usersPage*state.pageSize + state.pageSize - 1);

  if(q) query = query.ilike("username", `%${q}%`);

  const { data, error } = await query;
  if(error){
    setPill(false, "مغلق");
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
  const current = sel.value;
  sel.innerHTML = `<option value="">— اختر المستخدم —</option>` +
    (users||[]).map(u => `<option value="${u.username}">${u.username}</option>`).join("");
  if(current) sel.value = current;
}

/* ========= Invoices ========= */

function getDateRangeFilter(){
  const from = $("fromDate").value;
  const to   = $("toDate").value;
  const fromISO = from ? new Date(from + "T00:00:00").toISOString() : null;
  const toISO   = to   ? new Date(to   + "T23:59:59").toISOString() : null;
  return { fromISO, toISO };
}

async function loadInvoicesForUser(){
  const username = $("userSelect").value;
  if(!username){
    $("invoiceSelect").innerHTML = `<option value="">— اختر فاتورة —</option>`;
    return;
  }
  state.currentUser = username;

  const { fromISO, toISO } = getDateRangeFilter();

  let q = client
    .from("app_invoices")
    .select("id, username, total, created_at")
    .eq("username", username)
    .order("created_at", { ascending:false });

  if(fromISO) q = q.gte("created_at", fromISO);
  if(toISO) q = q.lte("created_at", toISO);

  const { data, error } = await q;
  if(error){ alert("خطأ تحميل قائمة الفواتير: " + error.message); return; }

  state.invoices = data || [];
  renderInvoiceSelect();
}

function renderInvoiceSelect(){
  const sel = $("invoiceSelect");
  const current = sel.value;
  sel.innerHTML = `<option value="">— اختر فاتورة —</option>` +
    (state.invoices||[]).map(inv => {
      const t = fmtDateTime(inv.created_at);
      const total = safeNum(inv.total);
      return `<option value="${inv.id}">${t} — مجموع: ${total}</option>`;
    }).join("");
  if(current) sel.value = current;
}

async function openSelectedInvoice(){
  const username = $("userSelect").value;
  const invoiceId = $("invoiceSelect").value;

  if(!username){ alert("اختر المستخدم أولاً"); return; }
  if(!invoiceId){ alert("اختر فاتورة أولاً"); return; }

  state.currentUser = username;
  state.currentInvoiceId = invoiceId;

  const { data, error } = await client
    .from("app_operations")
    .select("id, username, label, operation, result, created_at, invoice_id")
    .eq("username", username)
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending:true });

  if(error){ alert("خطأ تحميل عمليات الفاتورة: " + error.message); return; }

  state.currentOps = data || [];
  renderInvoiceDetails();
}

function renderInvoiceDetails(){
  const tb = $("opsTbody");
  tb.innerHTML = "";

  let grand = 0;
  const sums = {};

  state.currentOps.forEach(op => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDateTime(op.created_at)}</td>
      <td>${op.label || "عملية"}</td>
      <td>${op.operation || ""}</td>
      <td class="num">${op.result ?? ""}</td>
    `;
    tb.appendChild(tr);

    const r = safeNum(op.result);
    grand += r;
    const key = (op.label || "عملية").trim();
    sums[key] = (sums[key] || 0) + r;
  });

  $("grandTotal").value = String(grand);

  const meta = $("invoiceMeta");
  const inv = (state.invoices||[]).find(x => x.id === state.currentInvoiceId);
  meta.innerHTML = `
    <span class="badge g">العميل: ${state.currentUser || "—"}</span>
    <span class="badge">فاتورة: ${inv ? fmtDateTime(inv.created_at) : "—"}</span>
    <span class="badge">عدد العمليات: ${state.currentOps.length}</span>
  `;

  const box = $("totalsByLabel");
  box.innerHTML = "";
  Object.keys(sums).sort().forEach(k => {
    const v = sums[k];
    const div = document.createElement("div");
    div.className = "row";
    div.style.justifyContent="space-between";
    div.style.border="1px solid rgba(255,255,255,.08)";
    div.style.borderRadius="999px";
    div.style.padding="10px 12px";
    div.style.background="rgba(0,0,0,.22)";
    div.innerHTML = `<span>إجمالي (${k}):</span><span class="num">${v}</span>`;
    box.appendChild(div);
  });
}

async function deleteSelectedInvoice(){
  const username = $("userSelect").value;
  const invoiceId = $("invoiceSelect").value;
  if(!username){ alert("اختر المستخدم أولاً"); return; }
  if(!invoiceId){ alert("اختر فاتورة أولاً"); return; }

  if(!confirm("تأكيد حذف الفاتورة؟ (سيتم حذف عملياتها أيضاً)")) return;

  const { error } = await client
    .from("app_invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("username", username);

  if(error){ alert("خطأ حذف الفاتورة: " + error.message); return; }

  state.currentInvoiceId = null;
  state.currentOps = [];
  $("opsTbody").innerHTML = "";
  $("grandTotal").value = "0";
  $("invoiceMeta").innerHTML = "";
  $("totalsByLabel").innerHTML = "";

  await loadInvoicesForUser();
  alert("تم حذف الفاتورة ✅");
}

function printCurrentInvoice(){
  if(!state.currentInvoiceId || !state.currentUser){ alert("افتح فاتورة أولاً"); return; }

  const inv = (state.invoices||[]).find(x => x.id === state.currentInvoiceId);
  const invTime = inv ? fmtDateTime(inv.created_at) : "—";
  const total = $("grandTotal").value || "0";

  $("printMeta").textContent = `العميل: ${state.currentUser} — تاريخ الفاتورة: ${invTime}`;
  $("printTotal").textContent = `المجموع العام: ${total}`;

  const pb = $("printBody");
  pb.innerHTML = "";
  state.currentOps.forEach(op => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDateTime(op.created_at)}</td>
      <td>${(op.label || "عملية")}</td>
      <td>${(op.operation || "")}</td>
      <td style="direction:ltr">${(op.result ?? "")}</td>
    `;
    pb.appendChild(tr);
  });

  window.print();
}

/* ========= Wire + Boot ========= */

function wire(){
  $("genPass").onclick = genPassword;
  $("addUser").onclick = addUser;

  $("refreshUsers").onclick = async () => { state.usersPage=0; await loadUsers(); };
  $("searchUser").addEventListener("input", async () => { state.usersPage=0; await loadUsers(); });
  $("prevUsers").onclick = async () => { if(state.usersPage>0) state.usersPage--; await loadUsers(); };
  $("nextUsers").onclick = async () => { state.usersPage++; await loadUsers(); };

  $("quickToday").onclick = () => { const t=nowISODate(); $("fromDate").value=t; $("toDate").value=t; };
  $("quick7").onclick = () => { $("fromDate").value=daysAgoISO(7); $("toDate").value=nowISODate(); };
  $("clearDates").onclick = () => { $("fromDate").value=""; $("toDate").value=""; };

  $("userSelect").addEventListener("change", async () => {
    state.currentUser = $("userSelect").value || null;
    state.currentInvoiceId = null;
    state.currentOps = [];
    $("invoiceMeta").innerHTML="";
    $("totalsByLabel").innerHTML="";
    $("opsTbody").innerHTML="";
    $("grandTotal").value="0";
    await loadInvoicesForUser();
  });

  $("refreshInvoices").onclick = loadInvoicesForUser;
  $("openInvoice").onclick = openSelectedInvoice;
  $("deleteInvoice").onclick = deleteSelectedInvoice;
  $("printInvoice").onclick = printCurrentInvoice;
}

async function boot(){
  try{
    wire();
    $("fromDate").value = daysAgoISO(7);
    $("toDate").value = nowISODate();
    await loadUsers();
    setPill(true,"مفتوح");
  }catch(e){
    console.error(e);
    setPill(false,"مغلق");
  }
}
boot();
