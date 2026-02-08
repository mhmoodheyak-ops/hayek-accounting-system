/* =========================
   HAYEK SPOT — Admin Panel
   ========================= */

/* === Supabase keys (READY) === */
const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";
const SUPABASE_KEY = "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";

/* ========================= */

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

const state = {
  usersPage: 0,
  pageSize: 15,
  lastUsers: [],
  currentUser: null,
  currentOps: [],
};

/* =========================
   Helpers
   ========================= */

function setPill(ok, msg){
  const pill = $("pill");
  if(!pill) return;
  pill.textContent = msg || (ok ? "مفتوح" : "مغلق");
  pill.style.background = ok ? "var(--green)" : "var(--red)";
  pill.style.color = ok ? "var(--dark)" : "var(--text)";
}

function nowISODate(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function daysAgoISO(n){
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0,10);
}

function safeNum(x){
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function fmtDateTime(ts){
  try{
    return new Date(ts).toLocaleString("ar-EG",{hour12:true});
  }catch{
    return ts || "";
  }
}

/* =========================
   Users (Add / Block / Delete)
   ========================= */

function genPassword(){
  $("newPass").value = String(Math.floor(100000 + Math.random()*900000));
}

async function addUser(){
  const username = $("newUsername").value.trim();
  const pass = $("newPass").value.trim();
  const is_admin = $("newIsAdmin").value === "true";

  if(!username || !pass){
    alert("اكتب اسم المستخدم وكلمة السر");
    return;
  }

  const { error } = await client
    .from("app_users")
    .insert({ username, pass, is_admin, blocked:false });

  if(error){
    alert(error.message);
    return;
  }

  $("newUsername").value = "";
  await loadUsers();
  alert("تمت إضافة المستخدم ✅");
}

async function setBlocked(username, blocked){
  const { error } = await client
    .from("app_users")
    .update({ blocked })
    .eq("username", username);

  if(error){ alert(error.message); return; }
  await loadUsers();
}

async function deleteUser(username){
  if(!confirm(`حذف المستخدم ${username} ؟`)) return;

  const { error } = await client
    .from("app_users")
    .delete()
    .eq("username", username);

  if(error){ alert(error.message); return; }
  await loadUsers();
}

function renderUsersTable(users){
  const tb = $("usersTbody");
  tb.innerHTML = "";

  users.forEach(u=>{
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${u.username}</td>
      <td class="num">${u.pass}</td>
      <td>${u.is_admin ? '<span class="badge g">YES</span>' : '<span class="badge">NO</span>'}</td>
      <td>${u.blocked ? '<span class="badge r">محظور</span>' : '<span class="badge g">مفعّل</span>'}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn gray">اختيار</button>
        <button class="btn yellow">${u.blocked ? "فك الحظر" : "حظر"}</button>
        <button class="btn red">حذف</button>
      </td>
    `;

    const [pickBtn, blockBtn, delBtn] = tr.querySelectorAll("button");

    pickBtn.onclick = ()=>{
      $("userSelect").value = u.username;
      state.currentUser = u.username;
    };

    blockBtn.onclick = ()=> setBlocked(u.username, !u.blocked);
    delBtn.onclick = ()=> deleteUser(u.username);

    tb.appendChild(tr);
  });
}

async function loadUsers(){
  const q = $("searchUser").value.trim();

  let query = client
    .from("app_users")
    .select("*")
    .order("created_at",{ascending:false})
    .range(
      state.usersPage * state.pageSize,
      state.usersPage * state.pageSize + state.pageSize - 1
    );

  if(q) query = query.ilike("username", `%${q}%`);

  const { data, error } = await query;
  if(error){
    setPill(false,"خطأ");
    alert(error.message);
    return;
  }

  setPill(true,"مفتوح");
  state.lastUsers = data || [];
  renderUsersTable(state.lastUsers);
  fillUserSelect(state.lastUsers);
}

function fillUserSelect(users){
  const sel = $("userSelect");
  const cur = sel.value;
  sel.innerHTML = `<option value="">— اختر المستخدم —</option>` +
    users.map(u=>`<option value="${u.username}">${u.username}</option>`).join("");
  if(cur) sel.value = cur;
}

/* =========================
   Operations / Invoice
   ========================= */

function getDateRange(){
  const f = $("fromDate").value;
  const t = $("toDate").value;
  return {
    from: f ? new Date(f+"T00:00:00").toISOString() : null,
    to: t ? new Date(t+"T23:59:59").toISOString() : null
  };
}

async function loadInvoice(){
  const username = $("userSelect").value;
  if(!username){ alert("اختر مستخدم"); return; }

  state.currentUser = username;
  const { from, to } = getDateRange();

  let q = client
    .from("app_operations")
    .select("*")
    .eq("username", username)
    .order("created_at",{ascending:true});

  if(from) q = q.gte("created_at", from);
  if(to) q = q.lte("created_at", to);

  const { data, error } = await q;
  if(error){ alert(error.message); return; }

  state.currentOps = data || [];
  renderInvoice();
}

function renderInvoice(){
  const tb = $("opsTbody");
  tb.innerHTML = "";

  let grand = 0;
  const sums = {};

  state.currentOps.forEach(op=>{
    grand += safeNum(op.result);
    const key = op.label || "عملية";
    sums[key] = (sums[key]||0) + safeNum(op.result);

    tb.insertAdjacentHTML("beforeend",`
      <tr>
        <td>${fmtDateTime(op.created_at)}</td>
        <td>${key}</td>
        <td>${op.operation||""}</td>
        <td class="num">${op.result}</td>
      </tr>
    `);
  });

  $("grandTotal").textContent = grand;

  $("invoiceMeta").innerHTML = `
    <div class="chip">العميل: ${state.currentUser}</div>
    <div class="chip">عدد العمليات: ${state.currentOps.length}</div>
  `;

  const box = $("totalsByLabel");
  box.innerHTML = "";
  Object.keys(sums).forEach(k=>{
    box.insertAdjacentHTML("beforeend",
      `<div class="total"><span>${k}</span><span class="num">${sums[k]}</span></div>`
    );
  });
}

/* =========================
   Delete / Archive
   ========================= */

async function deleteOpsForUser(){
  const username = $("userSelect").value;
  if($("confirmName").value.trim() !== username){
    alert("اكتب اسم المستخدم حرفياً");
    return;
  }

  if(!confirm("تأكيد الحذف؟")) return;

  const { error } = await client
    .from("app_operations")
    .delete()
    .eq("username", username);

  if(error){ alert(error.message); return; }

  alert("تم حذف العمليات ✅");
  loadInvoice();
}

function archiveAndDelete(){
  window.print();
  setTimeout(deleteOpsForUser, 800);
}

/* =========================
   Events
   ========================= */

function wire(){
  $("genPass").onclick = genPassword;
  $("addUser").onclick = addUser;
  $("refreshUsers").onclick = loadUsers;
  $("searchUser").oninput = loadUsers;

  $("prevUsers").onclick = ()=>{ if(state.usersPage>0){state.usersPage--; loadUsers();} };
  $("nextUsers").onclick = ()=>{ state.usersPage++; loadUsers(); };

  $("viewInvoice").onclick = loadInvoice;
  $("printInvoice").onclick = ()=>window.print();
  $("deleteUserOps").onclick = deleteOpsForUser;
  $("archiveAndDelete").onclick = archiveAndDelete;

  $("quickToday").onclick = ()=>{
    $("fromDate").value = nowISODate();
    $("toDate").value = nowISODate();
  };
  $("quick7").onclick = ()=>{
    $("fromDate").value = daysAgoISO(7);
    $("toDate").value = nowISODate();
  };
  $("clearDates").onclick = ()=>{
    $("fromDate").value = "";
    $("toDate").value = "";
  };
}

async function boot(){
  wire();
  await loadUsers();
  setPill(true,"مفتوح");
}

boot();
