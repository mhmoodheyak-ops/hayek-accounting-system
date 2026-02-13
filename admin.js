import { supabase } from "./config.js";

const $ = (id) => document.getElementById(id);

function setSys(msg){ const el=$("sysMsg"); if(el) el.textContent = msg; }
function setUsersStatus(msg){ const el=$("usersStatus"); if(el) el.textContent = msg; }
function vibrate(){ try{ navigator.vibrate && navigator.vibrate(15); }catch{} }

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
  try{ return new Date(iso).toLocaleString("tr-TR"); }catch{ return "—"; }
}
function boolText(v){ return v ? "نعم" : "لا"; }

// ===== Gate (بدون تقليب) =====
const lock = $("lock");
$("goLogin").onclick = () => location.href = "index.html?v=" + Date.now();

function showLock(title, msg){
  $("lockTitle").textContent = title;
  $("lockMsg").textContent = msg;
  lock.style.display = "flex";
}

function emailUserName(email){
  const s = String(email||"");
  return s.includes("@") ? s.split("@")[0].toLowerCase() : s.toLowerCase();
}

async function gateAdmin(){
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;

  if(!user){
    $("sessionInfo").textContent = "غير مسجّل";
    showLock("تسجيل الدخول مطلوب", "الرجاء تسجيل الدخول أولاً.");
    throw new Error("NO_SESSION");
  }

  const uname = emailUserName(user.email);
  $("sessionInfo").textContent = "مسجّل: " + uname;

  // ✅ شرط الأدمن الجذري الآن: admin@hayek.local فقط
  if(uname !== "admin"){
    showLock("غير مصرح", "هذه الصفحة للأدمن فقط.");
    throw new Error("NOT_ADMIN");
  }
}

// ===== Buttons =====
$("btnLogout")?.addEventListener("click", async ()=>{
  vibrate();
  try{ await supabase.auth.signOut(); }catch{}
  location.href = "index.html?v=" + Date.now();
});

$("btnRefresh")?.addEventListener("click", async ()=>{
  vibrate();
  await refreshSummary();
  await loadUsers(true);
});

// Tabs
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

// ===== Users state =====
let usersPage = 1;
let usersPageSize = 25;
let usersLastBatchCount = 0;
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

// ===== Load users =====
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

    $("usersPageInfo").textContent = `صفحة ${usersPage}`;
    $("usersCountInfo").textContent = (count != null) ? `النتائج: ${count}` : `النتائج: —`;

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
      .update({ blocked: nextBlocked })
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

// ===== Summary =====
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

// ===== Init =====
(async function init(){
  setSys("تشغيل الأدمن...");
  try{
    await gateAdmin();
  }catch{
    return; // قفل الصفحة
  }

  await refreshSummary();
  await loadUsers(true);
  setSys("جاهز ✅");
})();
