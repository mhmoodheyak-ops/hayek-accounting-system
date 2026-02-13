import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================
// 1) ضع بيانات Supabase
// =====================
const SUPABASE_URL = "PASTE_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_SUPABASE_ANON_KEY_HERE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================
// Helpers
// =====================
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function setSys(msg){ $("sysMsg").textContent = msg; }
function setUsersStatus(msg){ $("usersStatus").textContent = msg; }

function fmtDate(iso){
  if(!iso) return "—";
  try{
    const d = new Date(iso);
    return d.toLocaleString("tr-TR");
  }catch{ return "—"; }
}

function vibrate(){
  if (navigator.vibrate) navigator.vibrate(20);
}

function pill(el, kind){
  el.classList.remove("ok","bad");
  if(kind) el.classList.add(kind);
}

// =====================
// 2) Tabs
// =====================
const panels = {
  users: $("usersPanel"),
  invoices: $("invoicesPanel"),
  reports: $("reportsPanel")
};

document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    Object.keys(panels).forEach(k => panels[k].style.display = (k===tab ? "" : "none"));

    // Lazy loading: فقط users الآن
    if(tab === "users"){
      loadUsers(true);
    }
  });
});

// =====================
// 3) Session / Auth
// =====================
async function ensureAdminSession(){
  const { data: { session } } = await supabase.auth.getSession();

  if(!session){
    // لا تدخل التفاصيل - فقط تحويل
    location.href = "./index.html";
    return null;
  }

  // إظهار البريد
  $("sessionInfo").textContent = `مسجّل: ${session.user?.email || "—"}`;

  // ملاحظة مهمة:
  // منع فتح الأدمن لازم يكون عبر RLS + تحقق role داخل DB.
  return session;
}

$("btnLogout").addEventListener("click", async ()=>{
  vibrate();
  await supabase.auth.signOut();
  location.href = "./index.html";
});

$("btnRefresh").addEventListener("click", async ()=>{
  vibrate();
  await refreshSummary();
  await loadUsers(true);
});

// =====================
// 4) Users (Pagination + Search)
// =====================
let usersPage = 1;
let usersPageSize = 25;
let usersLastBatchCount = 0;
let usersTotalKnown = null; // optional
let usersLoading = false;
let usersQueryTimer = null;

$("pageSizeUsers").addEventListener("change", ()=>{
  usersPageSize = Number($("pageSizeUsers").value || 25);
  usersPage = 1;
  loadUsers(true);
});

$("qUsers").addEventListener("input", ()=>{
  clearTimeout(usersQueryTimer);
  usersQueryTimer = setTimeout(()=>{
    usersPage = 1;
    loadUsers(true);
  }, 300);
});

$("prevUsers").addEventListener("click", ()=>{
  if(usersPage > 1){
    usersPage--;
    loadUsers(false);
  }
});
$("nextUsers").addEventListener("click", ()=>{
  // إذا رجعت أقل من pageSize → يعني غالباً آخر صفحة
  if(usersLastBatchCount === usersPageSize){
    usersPage++;
    loadUsers(false);
  }
});

// =====================
// IMPORTANT:
// افترض جدول اسمُه "users" فيه الأعمدة التالية:
// id (uuid) | name | phone | email | plan | status | updated_at
// إذا أسماء أعمدتك مختلفة، بس غيرها هون.
// =====================
async function loadUsers(force=false){
  if(usersLoading) return;
  usersLoading = true;
  setUsersStatus("جارٍ التحميل...");
  $("usersTbody").innerHTML = "";

  try{
    const q = ($("qUsers").value || "").trim();
    const from = (usersPage - 1) * usersPageSize;
    const to = from + usersPageSize - 1;

    let query = supabase
      .from("users")
      .select("id,name,phone,email,plan,status,updated_at", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(from, to);

    // بحث بسيط (ilike)
    if(q){
      // يبحث في name OR phone OR email
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data, error, count } = await query;
    if(error) throw error;

    usersLastBatchCount = (data || []).length;
    usersTotalKnown = count ?? null;

    $("usersPageInfo").textContent = `صفحة ${usersPage}`;
    $("usersCountInfo").textContent = usersTotalKnown != null
      ? `النتائج: ${usersTotalKnown}`
      : `النتائج: —`;

    renderUsers(data || []);
    setUsersStatus("تم");
  }catch(e){
    console.error(e);
    setUsersStatus("خطأ في التحميل");
    $("usersTbody").innerHTML = `<tr><td colspan="6" style="color:rgba(255,77,77,.95);">فشل تحميل المستخدمين: ${e.message || e}</td></tr>`;
  }finally{
    usersLoading = false;
  }
}

function renderUsers(rows){
  if(!rows.length){
    $("usersTbody").innerHTML = `<tr><td colspan="6" style="color:var(--muted);">لا يوجد نتائج</td></tr>`;
    return;
  }

  const html = rows.map(u=>{
    const contact = u.phone || u.email || "—";
    const plan = u.plan || "free";
    const isBlocked = (u.status === "blocked");
    const pillClass = isBlocked ? "bad" : "ok";
    const pillTxt = isBlocked ? "محظور" : "نشط";

    return `
      <tr>
        <td>${escapeHtml(u.name || "—")}</td>
        <td>${escapeHtml(contact)}</td>
        <td>${escapeHtml(plan)}</td>
        <td><span class="pill ${pillClass}">${pillTxt}</span></td>
        <td>${fmtDate(u.updated_at)}</td>
        <td>
          <button class="primary" data-act="toggle" data-id="${u.id}" data-st="${u.status}">${isBlocked ? "فك الحظر" : "حظر"}</button>
          <button class="danger" data-act="delete" data-id="${u.id}">حذف</button>
        </td>
      </tr>
    `;
  }).join("");

  $("usersTbody").innerHTML = html;

  // bind actions
  $("usersTbody").querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      vibrate();

      if(act === "toggle"){
        const cur = btn.dataset.st;
        const next = (cur === "blocked") ? "active" : "blocked";
        await updateUserStatus(id, next);
      }

      if(act === "delete"){
        const ok = confirm("تأكيد حذف المستخدم؟");
        if(ok) await deleteUser(id);
      }
    });
  });
}

async function updateUserStatus(id, status){
  try{
    setSys("تحديث حالة المستخدم...");
    const { error } = await supabase
      .from("users")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if(error) throw error;
    setSys("تم تحديث الحالة ✅");
    await loadUsers(false);
    await refreshSummary();
  }catch(e){
    console.error(e);
    setSys(`فشل تحديث الحالة: ${e.message || e}`);
  }
}

async function deleteUser(id){
  try{
    setSys("حذف المستخدم...");
    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", id);

    if(error) throw error;
    setSys("تم الحذف ✅");
    await loadUsers(true);
    await refreshSummary();
  }catch(e){
    console.error(e);
    setSys(`فشل الحذف: ${e.message || e}`);
  }
}

// =====================
// 5) Add user modal (insert row)
// =====================
$("btnAddUser").addEventListener("click", ()=>{
  openModal();
});

$("btnCloseModal").addEventListener("click", closeModal);
$("overlay").addEventListener("click", (e)=>{
  if(e.target.id === "overlay") closeModal();
});

$("btnSaveModal").addEventListener("click", async ()=>{
  await saveModalUser();
});

function openModal(){
  $("modalErr").textContent = "";
  $("mName").value = "";
  $("mPhone").value = "";
  $("mEmail").value = "";
  $("mPlan").value = "free";
  $("mStatus").value = "active";
  $("overlay").style.display = "flex";
}

function closeModal(){
  $("overlay").style.display = "none";
}

async function saveModalUser(){
  try{
    $("modalErr").textContent = "";
    const name = ($("mName").value || "").trim();
    const phone = ($("mPhone").value || "").trim();
    const email = ($("mEmail").value || "").trim();
    const plan = $("mPlan").value || "free";
    const status = $("mStatus").value || "active";

    if(!name) throw new Error("الاسم مطلوب");

    setSys("إضافة مستخدم...");
    const payload = {
      name,
      phone: phone || null,
      email: email || null,
      plan,
      status,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("users").insert(payload);
    if(error) throw error;

    closeModal();
    setSys("تمت الإضافة ✅");
    usersPage = 1;
    await loadUsers(true);
    await refreshSummary();
  }catch(e){
    console.error(e);
    $("modalErr").textContent = e.message || String(e);
  }
}

// =====================
// 6) Summary (light queries)
// =====================
async function refreshSummary(){
  try{
    // Count Users
    const { count: usersCount, error: e1 } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    if(e1) throw e1;

    // Count Invoices (optional table)
    const { count: invCount, error: e2 } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true });

    // invoices table قد لا تكون موجودة الآن
    const invoicesSafe = e2 ? null : invCount;

    $("pillUsers").textContent = `Users: ${usersCount ?? "—"}`;
    pill($("pillUsers"), "ok");

    $("pillInvoices").textContent = `Invoices: ${invoicesSafe ?? "—"}`;
    pill($("pillInvoices"), invoicesSafe == null ? "" : "ok");
  }catch(e){
    console.error(e);
    setSys(`ملخص: تعذر الجلب (${e.message || e})`);
  }
}

// =====================
// Utils
// =====================
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// =====================
// Init
// =====================
(async function init(){
  setSys("تشغيل الأدمن...");
  const session = await ensureAdminSession();
  if(!session) return;

  // تحميل الملخص أولاً (خفيف)
  await refreshSummary();

  // ثم تحميل Users (أول صفحة فقط)
  await sleep(50);
  await loadUsers(true);

  setSys("جاهز ✅");
})();
