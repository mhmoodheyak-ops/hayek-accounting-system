/* =========================
   HAYEK SPOT — Admin Panel (Invoices v2)
   - Users CRUD + block/unblock
   - Per-user invoices list (app_invoices)
   - Open selected invoice -> operations where invoice_id
   - Delete selected invoice (cascade deletes ops via FK)
   - Legacy view: operations with invoice_id IS NULL
   ========================= */

const SUPABASE_URL = "PUT_YOUR_SUPABASE_URL_HERE";
const SUPABASE_KEY = "PUT_YOUR_SB_PUBLISHABLE_KEY_HERE";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const exists = (id) => !!document.getElementById(id);

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

/* =========================
   Users (CRUD + block/unblock)
   ========================= */

function genPassword(){
  if(!exists("newPass")) return;
  const p = Math.floor(100000 + Math.random()*900000);
  $("newPass").value = String(p);
}

async function addUser(){
  const username = exists("newUsername") ? ($("newUsername").value || "").trim() : "";
  const pass = exists("newPass") ? ($("newPass").value || "").trim() : "";
  const is_admin = exists("newIsAdmin") ? ($("newIsAdmin").value === "true") : false;

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

  if(exists("newUsername")) $("newUsername").value = "";
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
      if(exists("userSelect")) $("userSelect").value = u.username;
      state.currentUser = u.username;
      await loadInvoicesForUser(); // ✅ حدّث الفواتير فورًا
      // سكرول لطيف إذا حابب
      if(exists("userSelect")){
        window.scrollTo({ top: $("userSelect").getBoundingClientRect().top + window.scrollY - 80, behavior:"smooth" });
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
  const options = (users || []).map(u => `<option value="${u.username}">${u.username}</option>`).join("");
  sel.innerHTML = base + options;

  if(current) sel.value = current;
}

async function loadUsers(){
  const q = exists("searchUser") ? ($("searchUser").value || "").trim() : "";

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

  const current = sel.value;

  const base = `<option value="">— اختر فاتورة —</option>`;
  const options = (invoices || []).map(inv =>
    `<option value="${inv.id}">${invoiceLabel(inv)}</option>`
  ).join("");

  sel.innerHTML = base + options;

  // إذا ما عاد موجود، نمسح الاختيار
  if(current && (invoices || []).some(x => x.id === current)){
    sel.value = current;
  }else{
    sel.value = "";
    state.currentInvoiceId = null;
  }
}

async function loadInvoicesForUser(){
  const username = exists("userSelect") ? $("userSelect").value : "";
  if(!username){
    // نظف القائمة إذا ما في مستخدم
    if(exists("invoiceSelect")) $("invoiceSelect").innerHTML = `<option value="">— اختر فاتورة —</option>`;
    state.invoices = [];
    state.currentInvoiceId = null;
    return;
  }
  state.currentUser = username;

  const { fromISO, toISO } = getDateRangeFilter();

  let query = client
    .from("app_invoices")
    .select("id, username, total, created_at")
    .eq("username", username)
    .order("created_at", { ascending: false });

  if(fromISO) query = query.gte("created_at", fromISO);
  if(toISO) query = query.lte("created_at", toISO);

  const { data, error } = await query;

  if(error){
    console.error(error);
    alert("خطأ تحميل قائمة الفواتير: " + error.message);
    return;
  }

  state.invoices = data || [];
  fillInvoiceSelect(state.invoices);
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

async function loadLegacyOps(){
  const username = state.currentUser || (exists("userSelect") ? $("userSelect").value : "");
  if(!username){
    alert("اختر المستخدم أولاً");
    return;
  }

  const { fromISO, toISO } = getDateRangeFilter();

  let query = client
    .from("app_operations")
    .select("id, username, invoice_id, label, operation, result, created_at")
    .eq("username", username)
    .is("invoice_id", null)
    .order("created_at", { ascending: true });

  if(fromISO) query = query.gte("created_at", fromISO);
  if(toISO) query = query.lte("created_at", toISO);

  const { data, error } = await query;
  if(error){
    console.error(error);
    alert("خطأ تحميل العمليات القديمة: " + error.message);
    return;
  }

  state.currentOps = data || [];
  renderOps();
}

function renderOps(){
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

  if(!confirm("تأكيد حذف الفاتورة المختارة؟ سيتم حذف عملياتها تلقائيًا.")) return;

  const { error } = await client
    .from("app_invoices")
    .delete()
    .eq("id", invId)
    .eq("username", username);

  if(error){
    console.error(error);
    alert("خطأ حذف الفاتورة: " + error.message);
    return;
  }

  // نظف العرض
  state.currentInvoiceId = null;
  state.currentOps = [];
  renderOps();

  await loadInvoicesForUser();
  alert("تم حذف الفاتورة ✅");
}

function printInvoice(){
  window.print();
}

/* =========================
   Legacy cleanup (old button)
   ========================= */

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

  if(!confirm(`تأكيد حذف كل عمليات المستخدم القديمة (invoice_id فارغ)؟`)) return;

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

  if(exists("confirmName")) $("confirmName").value = "";
  await loadLegacyOps();
  alert("تم حذف العمليات القديمة ✅");
}

/* =========================
   UI events
   ========================= */

function wire(){
  // Users
  if(exists("genPass")) $("genPass").onclick = genPassword;
  if(exists("addUser")) $("addUser").onclick = addUser;

  if(exists("refreshUsers")) $("refreshUsers").onclick = async () => {
    state.usersPage = 0;
    await loadUsers();
  };

  if(exists("searchUser")){
    $("searchUser").addEventListener("input", async () => {
      state.usersPage = 0;
      await loadUsers();
    });
  }

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
    state.currentInvoiceId = null;
    await loadLegacyOps();
    if(exists("invoiceCard")) $("invoiceCard").scrollIntoView({ behavior:"smooth", block:"start" });
  };

  if(exists("deleteUserOps")) $("deleteUserOps").onclick = async () => {
    await deleteOpsForUserLegacy();
  };

  if(exists("scrollToInvoice")) $("scrollToInvoice").onclick = () => {
    if(exists("invoiceCard")) $("invoiceCard").scrollIntoView({ behavior:"smooth", block:"start" });
  };
}

async function boot(){
  try{
    wire();
    await loadUsers();
    setPill(true, "مفتوح");
  }catch(e){
    console.error(e);
    setPill(false, "مغلق");
  }
}

boot();
