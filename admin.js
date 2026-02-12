// admin.js — HAYEK SPOT (نسخة مستقرة ومنظمة)
(() => {
  const $ = (id) => document.getElementById(id);

  // ========= Auth Guard =========
  const lock = $("lock");
  const goLogin = $("goLogin");

  function hardLock(){
    if (lock) lock.style.display = "flex";
    if (goLogin) goLogin.onclick = () => location.href = "index.html?v=" + Date.now();
  }

  if (!window.HAYEK_AUTH || !window.__HAYEK_AUTH_LOADED__ || !window.HAYEK_AUTH.isAuthed()) {
    hardLock(); return;
  }

  const session = window.HAYEK_AUTH.getUser();
  if (!session || session.role !== "admin") {
    hardLock(); return;
  }

  if (lock) lock.style.display = "none";

  // ========= UI =========
  const onlineDot   = $("onlineDot");
  const adminInfo   = $("adminInfo");
  const logoutBtn   = $("logoutBtn");
  const addUserBtn  = $("addUserBtn");
  const searchUser  = $("searchUser");
  const usersTbody  = $("usersTbody");

  const stUsers     = $("stUsers");
  const stInvoices  = $("stInvoices");
  const stActive    = $("stActive");

  const addModalBack = $("addModalBack");
  const closeAddModal= $("closeAddModal");
  const saveUserBtn  = $("saveUserBtn");
  const newUsername  = $("newUsername");
  const newPass      = $("newPass");
  const newIsAdmin   = $("newIsAdmin");
  const addUserMsg   = $("addUserMsg");

  if (adminInfo) adminInfo.textContent = `أدمن: ${session.username}`;

  // ========= Online Dot =========
  function refreshOnline(){
    if (!onlineDot) return;
    const on = navigator.onLine;
    onlineDot.classList.toggle("online", on);
    onlineDot.classList.toggle("offline", !on);
  }
  window.addEventListener("online", refreshOnline);
  window.addEventListener("offline", refreshOnline);
  refreshOnline();

  // ========= Logout =========
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      window.HAYEK_AUTH.logout();
      location.href = "index.html?v=" + Date.now();
    };
  }

  // ========= Supabase =========
  function getSB(){
    const cfg = window.HAYEK_CONFIG;
    if (!cfg?.supabaseUrl || !cfg?.supabaseKey) {
      throw new Error("config.js غير محمّل");
    }
    return {
      sb: supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey),
      T_USERS: cfg.tables.users,
      T_INVOICES: cfg.tables.invoices
    };
  }

  let SB;
  try { SB = getSB(); }
  catch(e){ alert(e.message); return; }

  // ========= Helpers =========
  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function timeAgo(ts){
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    const m = Math.floor((Date.now() - d.getTime()) / 60000);
    if (m < 1) return "الآن";
    if (m < 60) return `منذ ${m} د`;
    const h = Math.floor(m / 60);
    if (h < 24) return `منذ ${h} س`;
    return `منذ ${Math.floor(h/24)} يوم`;
  }

  // ========= State =========
  let users = [];

  // ========= Fetch =========
  async function fetchUsers(){
    const { data, error } = await SB.sb
      .from(SB.T_USERS)
      .select("id,username,is_admin,blocked,device_id,last_seen")
      .order("username",{ascending:true});
    if (error) return [];
    return data || [];
  }

  async function countInvoices(){
    const { data, error } = await SB.sb
      .from(SB.T_INVOICES)
      .select("id", { count:"exact", head:true });
    if (error) return 0;
    return data?.length ?? 0;
  }

  function countActive24h(list){
    const since = Date.now() - 24*3600*1000;
    return list.filter(u => {
      if (!u.last_seen) return false;
      const t = new Date(u.last_seen).getTime();
      return Number.isFinite(t) && t >= since;
    }).length;
  }

  // ========= Render =========
  function render(){
    const term = (searchUser?.value || "").toLowerCase();

    const rows = users
      .filter(u => (u.username||"").toLowerCase().includes(term))
      .map(u => `
        <tr>
          <td><b>${esc(u.username)}</b></td>
          <td>${u.is_admin ? "أدمن" : "مستخدم"}</td>
          <td>${u.blocked ? "محظور" : "نشط"}</td>
          <td>${u.device_id ? esc(u.device_id) : "—"}</td>
          <td>${timeAgo(u.last_seen)}</td>
          <td>
            ${u.blocked
              ? `<button class="mini green" data-a="unblock" data-id="${u.id}">فك</button>`
              : `<button class="mini red" data-a="block" data-id="${u.id}">حظر</button>`}
            <button class="mini ghost" data-a="reset" data-id="${u.id}">مسح جهاز</button>
            ${u.is_admin
              ? `<button class="mini ghost" data-a="rmadmin" data-id="${u.id}">إلغاء أدمن</button>`
              : `<button class="mini blue" data-a="mkadmin" data-id="${u.id}">أدمن</button>`}
            <button class="mini red" data-a="delete" data-id="${u.id}">حذف</button>
          </td>
        </tr>
      `).join("");

    usersTbody.innerHTML = rows || `<tr><td colspan="6">لا نتائج</td></tr>`;
  }

  // ========= Refresh =========
  async function refresh(){
    users = await fetchUsers();
    stUsers.textContent = users.length;
    stActive.textContent = countActive24h(users);
    stInvoices.textContent = await countInvoices();
    render();
  }

  if (searchUser) searchUser.oninput = render;

  // ========= Actions =========
  usersTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const act = btn.dataset.a;
    const id  = btn.dataset.id;
    const u   = users.find(x => x.id === id);
    if (!u) return;

    if (act === "block")
      await SB.sb.from(SB.T_USERS).update({ blocked:true }).eq("id",id);

    if (act === "unblock")
      await SB.sb.from(SB.T_USERS).update({ blocked:false }).eq("id",id);

    if (act === "reset")
      await SB.sb.from(SB.T_USERS).update({ device_id:null }).eq("id",id);

    if (act === "mkadmin")
      await SB.sb.from(SB.T_USERS).update({ is_admin:true }).eq("id",id);

    if (act === "rmadmin")
      await SB.sb.from(SB.T_USERS).update({ is_admin:false }).eq("id",id);

    if (act === "delete"){
      if (!confirm(`حذف ${u.username} نهائياً؟`)) return;
      await SB.sb.from(SB.T_USERS).delete().eq("id",id);
    }

    refresh();
  });

  // ========= Add User =========
  addUserBtn.onclick = () => addModalBack.style.display = "flex";
  closeAddModal.onclick = () => addModalBack.style.display = "none";
  addModalBack.onclick = (e) => { if (e.target === addModalBack) addModalBack.style.display = "none"; };

  saveUserBtn.onclick = async () => {
    const username = newUsername.value.trim();
    const pass = newPass.value.trim();
    const is_admin = newIsAdmin.checked;

    if (!username || !pass) {
      addUserMsg.textContent = "املأ جميع الحقول";
      return;
    }

    const { error } = await SB.sb.from(SB.T_USERS).insert({
      username, pass, is_admin, blocked:false
    });

    if (error) {
      addUserMsg.textContent = "فشل: " + error.message;
      return;
    }

    addUserMsg.textContent = "تمت الإضافة ✓";
    newUsername.value = "";
    newPass.value = "";
    newIsAdmin.checked = false;

    setTimeout(() => addModalBack.style.display = "none", 600);
    refresh();
  };

  // ========= Init =========
  refresh();
})();
