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

  $("usersTbody").querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      vibrate();
      const id = btn.dataset.id;
      const blocked = btn.dataset.blocked === "1";
      const isAdmin = btn.dataset.admin === "1";

      // منع حظر الأدمن
      if(isAdmin){
        setSys("لا يمكن حظر الأدمن ❌");
        return;
      }

      await setBlocked(id, !blocked);
    });
  });
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

    if(error) throw error;

    setSys(nextBlocked ? "تم الحظر ✅" : "تم فك الحظر ✅");
    await loadUsers(false);
    await refreshSummary();
  }catch(e){
    console.error(e);
    setSys("فشل التحديث: " + (e.message || e));
  }
}

// Summary
async function refreshSummary(){
  try{
    const { count: usersCount, error: e1 } = await supabase
      .from("app_users")
      .select("id", { count: "exact", head: true });

    if(e1) throw e1;

    const u = $("pillUsers");
    if(u){
      u.textContent = `Users: ${usersCount ?? "—"}`;
      u.classList.add("ok");
    }

    const { count: invCount, error: e2 } = await supabase
      .from("app_invoices")
      .select("id", { count: "exact", head: true });

    const inv = $("pillInvoices");
    if(inv){
      inv.textContent = `Invoices: ${e2 ? "—" : (invCount ?? "—")}`;
      if(!e2) inv.classList.add("ok");
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
