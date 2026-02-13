
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// بياناتك كما أرسلتها
const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j4ubd1htJvuMVOWUKC9w7g_mwVQzHb_";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helpers
const $ = (id) => document.getElementById(id);

function setSys(msg){ const el=$("sysMsg"); if(el) el.textContent = msg; }
function setUsersStatus(msg){ const el=$("usersStatus"); if(el) el.textContent = msg; }
function vibrate(){ if(navigator.vibrate) navigator.vibrate(15); }

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function fmtDate(iso){
  if(!iso) return "—";
  try{
    const d = new Date(iso);
    return d.toLocaleString("tr-TR");
  }catch{ return "—"; }
}
function boolText(v){ return v ? "نعم" : "لا"; }

function getAdminSession(){
  try{ return JSON.parse(localStorage.getItem("HAYEK_ADMIN_SESSION") || "null"); }
  catch{ return null; }
}
function requireAdmin(){
  const s = getAdminSession();
  if(!s){
    location.href = "./index.html";
    return null;
  }
  const info = $("sessionInfo");
  if(info) info.textContent = `أدمن: ${s.username}`;
  return s;
}

// Logout
$("btnLogout")?.addEventListener("click", ()=>{
  vibrate();
  localStorage.removeItem("HAYEK_ADMIN_SESSION");
  location.href = "./index.html";
});

// Refresh
$("btnRefresh")?.addEventListener("click", async ()=>{
  vibrate();
  await refreshSummary();
  await loadUsers(true);
});

// Tabs (lazy)
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
    if(tab === "users") loadUsers(true);
  });
});

// Users state
let usersPage = 1;
let usersPageSize = 25;
let usersLastBatchCount = 0;
let usersTotalKnown = null;
let usersLoading = false;
let usersQueryTimer = null;

$("pageSizeUsers")?.addEventListener("change", ()=>{
  usersPageSize = Number($("pageSizeUsers").value || 25);
  usersPage = 1;
  loadUsers(true);
});
$("qUsers")?.addEventListener("input", ()=>{
  clearTimeout(usersQueryTimer);
  usersQueryTimer = setTimeout(()=>{
    usersPage = 1;
    loadUsers(true);
  }, 300);
});
$("prevUsers")?.addEventListener("click", ()=>{
  if(usersPage > 1){
    usersPage--;
    loadUsers(false);
  }
});
$("nextUsers")?.addEventListener("click", ()=>{
  if(usersLastBatchCount === usersPageSize){
    usersPage++;
    loadUsers(false);
  }
});

// Load users from public.app_users
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
      .from("app_users")
      .select("id,username,is_admin,blocked,created_at,device_id,last_seen", { count: "exact" })
      .order("id", { ascending: true })
      .range(from, to);

    if(q){
      query = query.or(`username.ilike.%${q}%,device_id.ilike.%${q}%`);
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>لوحة الأدمن - HAYEK</title>

  <style>
    :root{
      --bg:#0b0f14; --card:#121823; --txt:#e8eefc; --muted:#9aa7bd;
      --line:#243044; --accent:#4da3ff; --danger:#ff4d4d; --ok:#35d07f;
      --btn:#1a2433; --btn2:#223149; --radius:16px;
    }
    *{ box-sizing:border-box; }
    body{
      margin:0; font-family:system-ui, -apple-system, "Segoe UI", Tahoma, Arial;
      background:linear-gradient(180deg,#070a10,#0b0f14 40%);
      color:var(--txt); min-height:100vh; padding:14px;
    }
    .wrap{ max-width:1100px; margin:0 auto; }
    .topbar{
      display:flex; gap:10px; align-items:center; justify-content:space-between;
      padding:14px 16px; border:1px solid var(--line); border-radius:var(--radius);
      background: rgba(18,24,35,.75); backdrop-filter: blur(8px);
      position: sticky; top: 10px; z-index: 50;
    }
    .brand{ display:flex; flex-direction:column; gap:2px; }
    .brand b{ font-size:16px; }
    .brand span{ font-size:12px; color:var(--muted); }

    .actions{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    button{
      border:1px solid var(--line); background:var(--btn); color:var(--txt);
      padding:10px 12px; border-radius:12px; cursor:pointer; font-weight:700;
    }
    button:hover{ background:var(--btn2); }
    button.danger{ border-color: rgba(255,77,77,.4); }
    button.danger:hover{ background: rgba(255,77,77,.12); }
    button.primary{ border-color: rgba(77,163,255,.45); }
    button.primary:hover{ background: rgba(77,163,255,.12); }

    .grid{
      display:grid; gap:12px;
      grid-template-columns: 1fr;
      margin-top:12px;
    }
    @media(min-width: 900px){
      .grid{ grid-template-columns: 1.1fr .9fr; }
    }
    .card{
      border:1px solid var(--line); background:rgba(18,24,35,.65);
      border-radius:var(--radius); padding:14px;
      backdrop-filter: blur(8px);
    }

    const { data, error, count } = await query;
    if(error) throw error;

    usersLastBatchCount = (data || []).length;
    usersTotalKnown = count ?? null;

    $("usersPageInfo").textContent = `صفحة ${usersPage}`;
    $("usersCountInfo").textContent = usersTotalKnown != null ? `النتائج: ${usersTotalKnown}` : `النتائج: —`;

    renderUsers(data || []);
    setUsersStatus("تم ✅");
  }catch(e){
    console.error(e);
    setUsersStatus("خطأ ❌");
    $("usersTbody").innerHTML = `<tr><td colspan="6" style="color:rgba(255,77,77,.95);">فشل تحميل المستخدمين: ${escapeHtml(e.message || e)}</td></tr>`;
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
    const isBlocked = !!u.blocked;
    const pillClass = isBlocked ? "bad" : "ok";
    const pillText = isBlocked ? "محظور" : "نشط";
    const last = u.last_seen || u.created_at;

    return `
      <tr>
        <td>${escapeHtml(u.username || "—")}</td>
        <td title="${escapeHtml(u.device_id || "")}">${escapeHtml(u.device_id || "—")}</td>
        <td>${boolText(!!u.is_admin)}</td>
        <td><span class="pill ${pillClass}">${pillText}</span></td>
        <td>${fmtDate(last)}</td>
        <td>
          <button class="primary" data-act="toggle" data-id="${u.id}" data-blocked="${u.blocked ? "1":"0"}" data-admin="${u.is_admin ? "1":"0"}">
            ${isBlocked ? "فك الحظر" : "حظر"}
          </button>
        </td>
      </tr>
    `;
  }).join("");

  $("usersTbody").innerHTML = html;
    .tabs{ display:flex; gap:8px; flex-wrap:wrap; }
    .tab{
      padding:10px 12px; border-radius:12px; border:1px solid var(--line);
      background:transparent; cursor:pointer; font-weight:800; color:var(--muted);
    }
    .tab.active{ color:var(--txt); border-color: rgba(77,163,255,.45); background: rgba(77,163,255,.10); }

  $("usersTbody").querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      vibrate();
      const id = btn.dataset.id;
      const blocked = btn.dataset.blocked === "1";
      const isAdmin = btn.dataset.admin === "1";
    .row{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:12px; }
    input, select{
      width:100%;
      border:1px solid var(--line); background:#0f1622; color:var(--txt);
      padding:12px 12px; border-radius:12px; outline:none;
    }
    .w-60{ flex: 1 1 420px; }
    .w-20{ flex: 1 1 160px; }
    .hint{ font-size:12px; color:var(--muted); margin-top:8px; line-height:1.6; }

      // منع حظر الأدمن
      if(isAdmin){
        setSys("لا يمكن حظر الأدمن ❌");
        return;
      }
    .status{ font-size:12px; color:var(--muted); margin-top:10px; }

      await setBlocked(id, !blocked);
    });
  });
}
    .tableWrap{
      width:100%; overflow:auto;
      border:1px solid var(--line);
      border-radius:14px;
      margin-top:12px;
    }
    table{ width:100%; border-collapse:collapse; min-width: 900px; }
    th, td{
      padding:12px 10px;
      border-bottom:1px solid rgba(36,48,68,.65);
      text-align:right;
      font-size:14px;
      white-space:nowrap;
    }
    th{ color:var(--muted); font-size:12px; letter-spacing:.3px; }
    tr:hover td{ background: rgba(77,163,255,.06); }

    .pill{
      display:inline-flex; align-items:center; gap:8px;
      padding:6px 10px; border-radius:999px;
      border:1px solid rgba(154,167,189,.25);
      font-size:12px; color:var(--muted);
    }

async function setBlocked(id, nextBlocked){
  try{
    setSys("تحديث حالة الحظر...");
    const { error } = await supabase
      .from("app_users")
      .update({
        blocked: nextBlocked
      })
      .eq("id", id);
    /* ✅ شاشة قفل بدون تقليب */
    #lock{
      position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,.82);
      display:none; align-items:center; justify-content:center;
      padding:16px;
    }
    #lock .box{
      width:min(520px,100%);
      background:#0b1820;
      border:1px solid rgba(255,255,255,.12);
      border-radius:20px;
      padding:18px;
      text-align:center;
    }
    #lock h3{ margin:0 0 8px; }
    #lock p{ margin:0 0 12px; color:#b9cde0; line-height:1.7; }
  </style>
</head>
<body>

  <div id="lock">
    <div class="box">
      <h3 id="lockTitle">تسجيل الدخول مطلوب</h3>
      <p id="lockMsg">غير مسموح تصفح الصفحة بدون تسجيل دخول.</p>
      <button class="primary" id="goLogin">الذهاب لتسجيل الدخول</button>
    </div>
  </div>

  <div class="wrap">
    <div class="topbar">
      <div class="brand">
        <b>لوحة الأدمن — HAYEK</b>
        <span id="sessionInfo">جاري التحقق…</span>
      </div>
      <div class="actions">
        <button class="primary" id="btnRefresh">تحديث</button>
        <button class="danger" id="btnLogout">تسجيل خروج</button>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="tabs">
          <button class="tab active" data-tab="users">المستخدمين</button>
          <button class="tab" data-tab="invoices">الفواتير</button>
          <button class="tab" data-tab="reports">التقارير</button>
        </div>

        <div id="usersPanel">
          <div class="row">
            <div class="w-60">
              <input id="qUsers" placeholder="بحث: username أو device_id" />
              <div class="hint">يتم جلب 25 فقط، والباقي بالصفحات لسرعة أعلى.</div>
            </div>
            <div class="w-20">
              <select id="pageSizeUsers">
                <option value="25" selected>25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          <div class="status" id="usersStatus">جاهز</div>

          <div class="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Device ID</th>
                  <th>Admin</th>
                  <th>الحالة</th>
                  <th>آخر ظهور</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody id="usersTbody"></tbody>
            </table>
          </div>

          <div class="pager" style="display:flex;justify-content:space-between;gap:10px;margin-top:12px;">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <button id="prevUsers">السابق</button>
              <button id="nextUsers">التالي</button>
              <span style="font-size:12px;color:var(--muted);" id="usersPageInfo">صفحة 1</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <span style="font-size:12px;color:var(--muted);" id="usersCountInfo">—</span>
            </div>
          </div>
        </div>

        <div id="invoicesPanel" style="display:none;">
          <div class="hint">سيتم تفعيل هذا التبويب بعد ما تكتب "تم".</div>
        </div>

        <div id="reportsPanel" style="display:none;">
          <div class="hint">التقارير خطوة لاحقة.</div>
        </div>
      </div>

      <div class="card">
        <b>ملخص سريع</b>
        <div class="hint">استعلامات خفيفة فقط لتسريع الأدمن.</div>
        <div class="row" style="margin-top:10px;">
          <span class="pill" id="pillUsers">Users: —</span>
          <span class="pill" id="pillInvoices">Invoices: —</span>
        </div>
        <div class="hint" id="sysMsg" style="margin-top:12px;">—</div>
      </div>
    </div>
  </div>

  <!-- ✅ Gate نهائي: Supabase Auth فقط + بدون تقليب -->
  <script type="module">
    import { supabase } from "./config.js";

    const $ = (id)=>document.getElementById(id);
    const lock = $("lock");

    function showLock(title, msg){
      $("lockTitle").textContent = title;
      $("lockMsg").textContent = msg;
      lock.style.display = "flex";
    }

    if(error) throw error;
    function emailUserName(email){
      const s = String(email||"");
      return s.includes("@") ? s.split("@")[0].toLowerCase() : s.toLowerCase();
    }

    setSys(nextBlocked ? "تم الحظر ✅" : "تم فك الحظر ✅");
    await loadUsers(false);
    await refreshSummary();
  }catch(e){
    console.error(e);
    setSys("فشل التحديث: " + (e.message || e));
  }
}
    $("goLogin").onclick = () => location.href = "index.html?v=" + Date.now();

// Summary
async function refreshSummary(){
  try{
    const { count: usersCount, error: e1 } = await supabase
      .from("app_users")
      .select("id", { count: "exact", head: true });
    $("btnRefresh").onclick = () => location.reload();
    $("btnLogout").onclick = async () => {
      try{ await supabase.auth.signOut(); }catch{}
      location.href = "index.html?v=" + Date.now();
    };

    if(e1) throw e1;
    // ✅ تحقق جلسة
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user;

    const u = $("pillUsers");
    if(u){
      u.textContent = `Users: ${usersCount ?? "—"}`;
      u.classList.add("ok");
    if(!user){
      $("sessionInfo").textContent = "غير مسجّل";
      showLock("تسجيل الدخول مطلوب", "الرجاء تسجيل الدخول أولاً.");
      throw new Error("NO_SESSION");
    }

    const { count: invCount, error: e2 } = await supabase
      .from("app_invoices")
      .select("id", { count: "exact", head: true });
    const uname = emailUserName(user.email);
    $("sessionInfo").textContent = "مسجّل: " + uname;

    const inv = $("pillInvoices");
    if(inv){
      inv.textContent = `Invoices: ${e2 ? "—" : (invCount ?? "—")}`;
      if(!e2) inv.classList.add("ok");
    // ✅ شرط الأدمن الجذري (حالياً): admin@hayek.local فقط
    if(uname !== "admin"){
      showLock("غير مصرح", "هذه الصفحة للأدمن فقط. افتح صفحة المستخدم (invoice).");
      throw new Error("NOT_ADMIN");
    }
  }catch(e){
    console.error(e);
    setSys("ملخص: تعذر الجلب (" + (e.message || e) + ")");
  }
}

// Init
(async function init(){
  setSys("تشغيل الأدمن...");
  const admin = requireAdmin();
  if(!admin) return;

  await refreshSummary();
  await loadUsers(true);

  setSys("جاهز ✅");
})();
    // ✅ حمّل admin.js فقط بعد نجاح التحقق (حتى لا يسبب loop)
    await import("./admin.js");
  </script>
</body>
</html>
