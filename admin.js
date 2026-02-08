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

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("admin.js loaded: invoices-v2 build 99");

// helper
const $ = (id) => document.getElementById(id);
const exists = (id) => !!document.getElementById(id);

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
  if(!pill) return;
  pill.textContent = msg || (ok ? "مفتوح" : "مغلق");
  pill.style.background = ok ? "var(--green)" : "var(--red)";
  pill.style.color = ok ? "var(--dark)" : "var(--text)";
@@ -42,7 +33,6 @@ function nowISODate(){
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function daysAgoISO(n){
  const d = new Date();
  d.setDate(d.getDate()-n);
@@ -51,594 +41,341 @@ function daysAgoISO(n){
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
  try{ return new Date(ts).toLocaleString("ar-EG",{hour12:true}); }
  catch{ return String(ts||""); }
}

/* =========================
   Users (CRUD + block/unblock)
   ========================= */
/* ========= Users ========= */

function genPassword(){
  if(!exists("newPass")) return;
  const p = Math.floor(100000 + Math.random()*900000);
  $("newPass").value = String(p);
  $("newPass").value = String(Math.floor(100000 + Math.random()*900000));
}

async function addUser(){
  const username = exists("newUsername") ? ($("newUsername").value || "").trim() : "";
  const pass = exists("newPass") ? ($("newPass").value || "").trim() : "";
  const is_admin = exists("newIsAdmin") ? ($("newIsAdmin").value === "true") : false;

  if(!username || !pass){
    alert("اكتب اسم المستخدم وكلمة السر");
    return;
  }
  const username = ($("newUsername").value || "").trim();
  const pass = ($("newPass").value || "").trim();
  const is_admin = $("newIsAdmin").value === "true";
  if(!username || !pass){ alert("اكتب اسم المستخدم وكلمة السر"); return; }

  const { error } = await client.from("app_users").insert({
    username, pass, is_admin, blocked: false
  });

  if(error){
    alert("خطأ بالحفظ: " + error.message);
    return;
  }

  if(exists("newUsername")) $("newUsername").value = "";
  if(error){ alert("خطأ بالحفظ: " + error.message); return; }
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
  const { error } = await client.from("app_users").update({ blocked }).eq("username", username);
  if(error){ alert("خطأ: " + error.message); return; }
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
  const { error } = await client.from("app_users").delete().eq("username", username);
  if(error){ alert("خطأ: " + error.message); return; }
  await loadUsers();
}

function renderUsersTable(users){
  const tb = $("usersTbody");
  if(!tb) return;
  tb.innerHTML = "";

  (users || []).forEach(u => {
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
    btnPick.className = "btn gray";
    btnPick.textContent = "اختيار";
    btnPick.className="btn gray";
    btnPick.textContent="اختيار";
    btnPick.onclick = async () => {
      if(exists("userSelect")) $("userSelect").value = u.username;
      $("userSelect").value = u.username;
      state.currentUser = u.username;
      await loadInvoicesForUser(); // ✅ حدّث الفواتير فورًا
      // سكرول لطيف إذا حابب
      if(exists("userSelect")){
        window.scrollTo({ top: $("userSelect").getBoundingClientRect().top + window.scrollY - 80, behavior:"smooth" });
      }
      await loadInvoicesForUser();
      window.scrollTo({top:0,behavior:"smooth"});
    };

    const btnToggle = document.createElement("button");
    btnToggle.className = "btn yellow";
    btnToggle.className="btn yellow";
    btnToggle.textContent = u.blocked ? "فك الحظر" : "حظر";
    btnToggle.onclick = () => setBlocked(u.username, !u.blocked);

    const btnDel = document.createElement("button");
    btnDel.className = "btn red";
    btnDel.textContent = "حذف";
    btnDel.className="btn red";
    btnDel.textContent="حذف";
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
  const options = (users || []).map(u => `<option value="${u.username}">${u.username}</option>`).join("");
  sel.innerHTML = base + options;

  if(current) sel.value = current;
}

async function loadUsers(){
  const q = exists("searchUser") ? ($("searchUser").value || "").trim() : "";
  const q = ($("searchUser").value || "").trim();

  let query = client
    .from("app_users")
    .select("id, username, pass, is_admin, blocked, created_at")
    .order("created_at", { ascending: false })
    .range(state.usersPage * state.pageSize, state.usersPage * state.pageSize + state.pageSize - 1);
    .range(state.usersPage*state.pageSize, state.usersPage*state.pageSize + state.pageSize - 1);

  if(q){
    query = query.ilike("username", `%${q}%`);
  }
  if(q) query = query.ilike("username", `%${q}%`);

  const { data, error } = await query;

  if(error){
    setPill(false, "خطأ اتصال");
    console.error(error);
    setPill(false, "مغلق");
    alert("خطأ تحميل المستخدمين: " + error.message);
    return;
  }

  setPill(true, "مفتوح");
  state.lastUsers = data || [];
  renderUsersTable(state.lastUsers);
  fillUserSelect(state.lastUsers);
}

/* =========================
   Invoices list (per user)
   ========================= */

function invoiceLabel(inv){
  // شكل لطيف داخل القائمة
  const total = safeNum(inv.total);
  return `${fmtDateTime(inv.created_at)}  |  الإجمالي: ${total}`;
}

function fillInvoiceSelect(invoices){
  const sel = $("invoiceSelect");
  if(!sel) return;

function fillUserSelect(users){
  const sel = $("userSelect");
  const current = sel.value;
  sel.innerHTML = `<option value="">— اختر المستخدم —</option>` +
    (users||[]).map(u => `<option value="${u.username}">${u.username}</option>`).join("");
  if(current) sel.value = current;
}

  const base = `<option value="">— اختر فاتورة —</option>`;
  const options = (invoices || []).map(inv =>
    `<option value="${inv.id}">${invoiceLabel(inv)}</option>`
  ).join("");

  sel.innerHTML = base + options;
/* ========= Invoices ========= */

  // إذا ما عاد موجود، نمسح الاختيار
  if(current && (invoices || []).some(x => x.id === current)){
    sel.value = current;
  }else{
    sel.value = "";
    state.currentInvoiceId = null;
  }
function getDateRangeFilter(){
  const from = $("fromDate").value;
  const to   = $("toDate").value;
  const fromISO = from ? new Date(from + "T00:00:00").toISOString() : null;
  const toISO   = to   ? new Date(to   + "T23:59:59").toISOString() : null;
  return { fromISO, toISO };
}

async function loadInvoicesForUser(){
  const username = exists("userSelect") ? $("userSelect").value : "";
  const username = $("userSelect").value;
  if(!username){
    // نظف القائمة إذا ما في مستخدم
    if(exists("invoiceSelect")) $("invoiceSelect").innerHTML = `<option value="">— اختر فاتورة —</option>`;
    state.invoices = [];
    state.currentInvoiceId = null;
    $("invoiceSelect").innerHTML = `<option value="">— اختر فاتورة —</option>`;
    return;
  }
  state.currentUser = username;

  const { fromISO, toISO } = getDateRangeFilter();

  let query = client
  let q = client
    .from("app_invoices")
    .select("id, username, total, created_at")
    .eq("username", username)
    .order("created_at", { ascending: false });

  if(fromISO) query = query.gte("created_at", fromISO);
  if(toISO) query = query.lte("created_at", toISO);
    .order("created_at", { ascending:false });

  const { data, error } = await query;
  if(fromISO) q = q.gte("created_at", fromISO);
  if(toISO) q = q.lte("created_at", toISO);

  if(error){
    console.error(error);
    alert("خطأ تحميل قائمة الفواتير: " + error.message);
    return;
  }
  const { data, error } = await q;
  if(error){ alert("خطأ تحميل قائمة الفواتير: " + error.message); return; }

  state.invoices = data || [];
  fillInvoiceSelect(state.invoices);
  renderInvoiceSelect();
}

/* =========================
   Operations view (invoice or legacy)
   ========================= */

function getDateRangeFilter(){
  const from = exists("fromDate") ? $("fromDate").value : "";
  const to = exists("toDate") ? $("toDate").value : "";

  const fromISO = from ? new Date(from + "T00:00:00").toISOString() : null;
  const toISO = to ? new Date(to + "T23:59:59").toISOString() : null;

  return { fromISO, toISO, from, to };
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

async function loadOpsForInvoice(invoiceId){
  const username = state.currentUser || (exists("userSelect") ? $("userSelect").value : "");
  if(!username){
    alert("اختر المستخدم أولاً");
    return;
  }

  let query = client
    .from("app_operations")
    .select("id, username, invoice_id, label, operation, result, created_at")
    .eq("username", username)
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  const { data, error } = await query;
  if(error){
    console.error(error);
    alert("خطأ تحميل الفاتورة: " + error.message);
    return;
  }

  state.currentOps = data || [];
  renderOps();
}
async function openSelectedInvoice(){
  const username = $("userSelect").value;
  const invoiceId = $("invoiceSelect").value;

async function loadLegacyOps(){
  const username = state.currentUser || (exists("userSelect") ? $("userSelect").value : "");
  if(!username){
    alert("اختر المستخدم أولاً");
    return;
  }
  if(!username){ alert("اختر المستخدم أولاً"); return; }
  if(!invoiceId){ alert("اختر فاتورة أولاً"); return; }

  const { fromISO, toISO } = getDateRangeFilter();
  state.currentUser = username;
  state.currentInvoiceId = invoiceId;

  let query = client
  const { data, error } = await client
    .from("app_operations")
    .select("id, username, invoice_id, label, operation, result, created_at")
    .select("id, username, label, operation, result, created_at, invoice_id")
    .eq("username", username)
    .is("invoice_id", null)
    .order("created_at", { ascending: true });

  if(fromISO) query = query.gte("created_at", fromISO);
  if(toISO) query = query.lte("created_at", toISO);
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending:true });

  const { data, error } = await query;
  if(error){
    console.error(error);
    alert("خطأ تحميل العمليات القديمة: " + error.message);
    return;
  }
  if(error){ alert("خطأ تحميل عمليات الفاتورة: " + error.message); return; }

  state.currentOps = data || [];
  renderOps();
  renderInvoiceDetails();
}

function renderOps(){
function renderInvoiceDetails(){
  const tb = $("opsTbody");
  if(!tb) return;

  tb.innerHTML = "";

  let grand = 0;
  const sums = {};

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

    tr.appendChild(tdTime);
    tr.appendChild(tdLabel);
    tr.appendChild(tdOp);
    tr.appendChild(tdRes);
    tb.appendChild(tr);
  });

  if(exists("grandTotal")) $("grandTotal").textContent = String(grand);
  $("grandTotal").value = String(grand);

  // Meta chips
  const meta = $("invoiceMeta");
  if(meta){
    const username = state.currentUser || "—";
    const count = state.currentOps.length;
    let fromTxt = "—";
    let toTxt = "—";
    if(count){
      fromTxt = fmtDateTime(state.currentOps[0].created_at);
      toTxt = fmtDateTime(state.currentOps[count-1].created_at);
    }

    const invId = state.currentInvoiceId ? String(state.currentInvoiceId).slice(0,8) : "—";
    meta.innerHTML = `
      <div class="chip">العميل: ${username}</div>
      <div class="chip">عدد العمليات: ${count}</div>
      <div class="chip">فاتورة: ${invId}</div>
      <div class="chip">من: ${fromTxt}</div>
      <div class="chip">إلى: ${toTxt}</div>
    `;
  }
  const inv = (state.invoices||[]).find(x => x.id === state.currentInvoiceId);
  meta.innerHTML = `
    <span class="badge g">العميل: ${state.currentUser || "—"}</span>
    <span class="badge">فاتورة: ${inv ? fmtDateTime(inv.created_at) : "—"}</span>
    <span class="badge">عدد العمليات: ${state.currentOps.length}</span>
  `;

  // Totals by label (اختياري إذا عندك صندوق)
  const box = $("totalsByLabel");
  if(box){
    box.innerHTML = "";
    Object.keys(sums).sort().forEach(k => {
      const v = sums[k];
      const div = document.createElement("div");
      div.className = "total";
      div.innerHTML = `<span>إجمالي (${k}):</span><span style="direction:ltr">${v}</span>`;
      box.appendChild(div);
    });
  }
}

/* =========================
   Actions: open/delete invoice + print
   ========================= */

async function openSelectedInvoice(){
  const invId = exists("invoiceSelect") ? $("invoiceSelect").value : "";
  if(!invId){
    alert("اختر فاتورة أولاً");
    return;
  }
  state.currentInvoiceId = invId;
  await loadOpsForInvoice(invId);
  if(exists("invoiceCard")) $("invoiceCard").scrollIntoView({ behavior:"smooth", block:"start" });
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
  const username = state.currentUser || (exists("userSelect") ? $("userSelect").value : "");
  if(!username){
    alert("اختر المستخدم أولاً");
    return;
  }
  const invId = exists("invoiceSelect") ? $("invoiceSelect").value : "";
  if(!invId){
    alert("اختر فاتورة أولاً");
    return;
  }
  const username = $("userSelect").value;
  const invoiceId = $("invoiceSelect").value;
  if(!username){ alert("اختر المستخدم أولاً"); return; }
  if(!invoiceId){ alert("اختر فاتورة أولاً"); return; }

  if(!confirm("تأكيد حذف الفاتورة المختارة؟ سيتم حذف عملياتها تلقائيًا.")) return;
  if(!confirm("تأكيد حذف الفاتورة؟ (سيتم حذف عملياتها أيضاً)")) return;

  const { error } = await client
    .from("app_invoices")
    .delete()
    .eq("id", invId)
    .eq("id", invoiceId)
    .eq("username", username);

  if(error){
    console.error(error);
    alert("خطأ حذف الفاتورة: " + error.message);
    return;
  }
  if(error){ alert("خطأ حذف الفاتورة: " + error.message); return; }

  // نظف العرض
  state.currentInvoiceId = null;
  state.currentOps = [];
  renderOps();
  $("opsTbody").innerHTML = "";
  $("grandTotal").value = "0";
  $("invoiceMeta").innerHTML = "";
  $("totalsByLabel").innerHTML = "";

  await loadInvoicesForUser();
  alert("تم حذف الفاتورة ✅");
}

function printInvoice(){
  window.print();
}

/* =========================
   Legacy cleanup (old button)
   ========================= */
function printCurrentInvoice(){
  if(!state.currentInvoiceId || !state.currentUser){ alert("افتح فاتورة أولاً"); return; }

async function deleteOpsForUserLegacy(){
  const username = state.currentUser || (exists("userSelect") ? $("userSelect").value : "");
  if(!username){
    alert("اختر المستخدم أولاً");
    return;
  }
  const confirmName = exists("confirmName") ? ($("confirmName").value || "").trim() : "";
  if(confirmName !== username){
    alert("اكتب اسم المستخدم حرفيًا للتأكيد");
    return;
  }
  const inv = (state.invoices||[]).find(x => x.id === state.currentInvoiceId);
  const invTime = inv ? fmtDateTime(inv.created_at) : "—";
  const total = $("grandTotal").value || "0";

  if(!confirm(`تأكيد حذف كل عمليات المستخدم القديمة (invoice_id فارغ)؟`)) return;
  $("printMeta").textContent = `العميل: ${state.currentUser} — تاريخ الفاتورة: ${invTime}`;
  $("printTotal").textContent = `المجموع العام: ${total}`;

  const { error } = await client
    .from("app_operations")
    .delete()
    .eq("username", username)
    .is("invoice_id", null);

  if(error){
    console.error(error);
    alert("خطأ بالحذف: " + error.message);
    return;
  }
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

  if(exists("confirmName")) $("confirmName").value = "";
  await loadLegacyOps();
  alert("تم حذف العمليات القديمة ✅");
  window.print();
}

/* =========================
   UI events
   ========================= */
/* ========= Wire + Boot ========= */

function wire(){
  // Users
  if(exists("genPass")) $("genPass").onclick = genPassword;
  if(exists("addUser")) $("addUser").onclick = addUser;
  $("genPass").onclick = genPassword;
  $("addUser").onclick = addUser;

  if(exists("refreshUsers")) $("refreshUsers").onclick = async () => {
    state.usersPage = 0;
    await loadUsers();
  };
  $("refreshUsers").onclick = async () => { state.usersPage=0; await loadUsers(); };
  $("searchUser").addEventListener("input", async () => { state.usersPage=0; await loadUsers(); });
  $("prevUsers").onclick = async () => { if(state.usersPage>0) state.usersPage--; await loadUsers(); };
  $("nextUsers").onclick = async () => { state.usersPage++; await loadUsers(); };

  if(exists("searchUser")){
    $("searchUser").addEventListener("input", async () => {
      state.usersPage = 0;
      await loadUsers();
    });
  }
  $("quickToday").onclick = () => { const t=nowISODate(); $("fromDate").value=t; $("toDate").value=t; };
  $("quick7").onclick = () => { $("fromDate").value=daysAgoISO(7); $("toDate").value=nowISODate(); };
  $("clearDates").onclick = () => { $("fromDate").value=""; $("toDate").value=""; };

  if(exists("prevUsers")) $("prevUsers").onclick = async () => {
    if(state.usersPage > 0) state.usersPage--;
    await loadUsers();
  };

  if(exists("nextUsers")) $("nextUsers").onclick = async () => {
    state.usersPage++;
    await loadUsers();
  };

  if(exists("userSelect")){
    $("userSelect").addEventListener("change", async () => {
      const u = $("userSelect").value;
      state.currentUser = u || null;

      // كل ما تغيّر المستخدم: حدّث قائمة الفواتير وافرغ الجدول
      state.currentInvoiceId = null;
      state.currentOps = [];
      renderOps();
      await loadInvoicesForUser();
    });
  }

  // Quick dates
  if(exists("quickToday")) $("quickToday").onclick = () => {
    const today = nowISODate();
    if(exists("fromDate")) $("fromDate").value = today;
    if(exists("toDate")) $("toDate").value = today;
  };

  if(exists("quick7")) $("quick7").onclick = () => {
    if(exists("fromDate")) $("fromDate").value = daysAgoISO(7);
    if(exists("toDate")) $("toDate").value = nowISODate();
  };

  if(exists("clearDates")) $("clearDates").onclick = () => {
    if(exists("fromDate")) $("fromDate").value = "";
    if(exists("toDate")) $("toDate").value = "";
  };

  // Invoices list
  if(exists("refreshInvoices")) $("refreshInvoices").onclick = async () => {
    await loadInvoicesForUser();
  };

  if(exists("invoiceSelect")){
    $("invoiceSelect").addEventListener("change", () => {
      state.currentInvoiceId = $("invoiceSelect").value || null;
    });
  }

  if(exists("openInvoice")) $("openInvoice").onclick = async () => {
    await openSelectedInvoice();
  };

  if(exists("deleteInvoice")) $("deleteInvoice").onclick = async () => {
    await deleteSelectedInvoice();
  };

  if(exists("printInvoice")) $("printInvoice").onclick = () => {
    printInvoice();
  };

  if(exists("viewLegacy")) $("viewLegacy").onclick = async () => {
  $("userSelect").addEventListener("change", async () => {
    state.currentUser = $("userSelect").value || null;
    state.currentInvoiceId = null;
    await loadLegacyOps();
    if(exists("invoiceCard")) $("invoiceCard").scrollIntoView({ behavior:"smooth", block:"start" });
  };

  if(exists("deleteUserOps")) $("deleteUserOps").onclick = async () => {
    await deleteOpsForUserLegacy();
  };
    state.currentOps = [];
    $("invoiceMeta").innerHTML="";
    $("totalsByLabel").innerHTML="";
    $("opsTbody").innerHTML="";
    $("grandTotal").value="0";
    await loadInvoicesForUser();
  });

  if(exists("scrollToInvoice")) $("scrollToInvoice").onclick = () => {
    if(exists("invoiceCard")) $("invoiceCard").scrollIntoView({ behavior:"smooth", block:"start" });
  };
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
    setPill(true, "مفتوح");
    setPill(true,"مفتوح");
  }catch(e){
    console.error(e);
    setPill(false, "مغلق");
    setPill(false,"مغلق");
  }
}

boot();
