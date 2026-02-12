/* HAYEK SPOT — Admin (Force invoices button + safe UI) */
(function () {
  const $ = (id) => document.getElementById(id);

  // ===== UI =====
  const lock = $("lock");
  const goLogin = $("goLogin");
  const onlineDot = $("onlineDot");
  const adminInfo = $("adminInfo");
  const adminName = $("adminName");

  const logoutBtn = $("logoutBtn");
  const refreshBtn = $("refreshBtn");
  const rangeSel = $("range");
  const searchUser = $("searchUser");
  const stInvoices = $("stInvoices");
  const stUsers = $("stUsers");
  const stActive = $("stActive");
  const usersTbody = $("usersTbody");

  // Add user modal
  const addModalBack = $("addModalBack");
  const closeAddModalBtn = $("closeAddModal");
  const addUserBtn = $("addUserBtn");
  const newUsername = $("newUsername");
  const newPass = $("newPass");
  const newIsAdmin = $("newIsAdmin");
  const saveUserBtn = $("saveUserBtn");
  const addUserMsg = $("addUserMsg");

  // Invoices modal
  const invModalBack = $("invModalBack");
  const closeInvModalBtn = $("closeInvModal");
  const invModalTitle = $("invModalTitle");
  const invSearch = $("invSearch");
  const invTbody = $("invTbody");
  const reloadInvBtn = $("reloadInvBtn");

  // ===== Helpers =====
  function setOnlineDot() {
    if (!onlineDot) return;
    const on = navigator.onLine;
    onlineDot.style.background = on ? "#49e39a" : "#ff6b6b";
    onlineDot.style.boxShadow = on
      ? "0 0 0 6px rgba(73,227,154,.12)"
      : "0 0 0 6px rgba(255,107,107,.12)";
  }
  window.addEventListener("online", setOnlineDot);
  window.addEventListener("offline", setOnlineDot);
  setOnlineDot();

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function timeAgo(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "الآن";
    if (m < 60) return `منذ ${m} د`;
    const h = Math.floor(m / 60);
    if (h < 24) return `منذ ${h} س`;
    const days = Math.floor(h / 24);
    return `منذ ${days} يوم`;
  }

  function rangeToSince(range) {
    if (range === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    if (range === "7d") return new Date(Date.now() - 7 * 864e5).toISOString();
    if (range === "30d") return new Date(Date.now() - 30 * 864e5).toISOString();
    return null;
  }

  function hardLock() {
    if (lock) lock.style.display = "flex";
    if (goLogin) goLogin.onclick = () => (location.href = "index.html?v=" + Date.now());
  }

  // ===== Auth guard =====
  if (!window.HAYEK_AUTH || !window.__HAYEK_AUTH_LOADED__ || !window.HAYEK_AUTH.isAuthed()) {
    hardLock();
    return;
  }
  const session = window.HAYEK_AUTH.getUser() || {};
  if (session.role !== "admin") {
    hardLock();
    return;
  }
  if (lock) lock.style.display = "none";
  if (adminInfo) adminInfo.textContent = `أدمن: ${session.username || "—"} — متصل`;
  if (adminName) adminName.textContent = session.username || "—";

  if (logoutBtn) {
    logoutBtn.onclick = () => {
      window.HAYEK_AUTH.logout();
      location.href = "index.html?v=" + Date.now();
    };
  }

  // ===== Supabase =====
  function getSB() {
    const cfg = window.HAYEK_CONFIG || {};
    const supabaseUrl = cfg.supabaseUrl || "";
    const supabaseKey = cfg.supabaseKey || "";
    if (!supabaseUrl || !supabaseKey) throw new Error("config.js ناقص: supabaseUrl أو supabaseKey");
    const sb = supabase.createClient(supabaseUrl, supabaseKey);
    return {
      sb,
      tables: {
        users: cfg.tables?.users || "app_users",
        invoices: cfg.tables?.invoices || "app_invoices",
        operations: cfg.tables?.operations || "app_operations",
      },
    };
  }

  let SB;
  try {
    SB = getSB();
  } catch (e) {
    console.error("Supabase config error:", e);
    alert("خطأ إعداد Supabase:\n" + e.message);
    return;
  }

  // ===== Data state =====
  let users = [];
  let invoiceCounts = new Map();
  let invoicesForUser = [];
  let currentUserForInvoices = null;

  // ===== Badges =====
  function badgeRole(u) {
    return u.is_admin ? `<span class="badge blue">أدمن</span>` : `<span class="badge">مستخدم</span>`;
  }
  function badgeStatus(u) {
    return u.blocked ? `<span class="badge red">محظور</span>` : `<span class="badge green">نشط</span>`;
  }

  // ===== Fetch =====
  async function fetchUsers() {
    const { sb } = SB;
    const t = SB.tables.users;
    const { data, error } = await sb
      .from(t)
      .select("id,username,is_admin,blocked,created_at,device_id,last_seen")
      .order("username", { ascending: true });

    if (error) {
      console.error("fetchUsers error:", error);
      return [];
    }
    return data || [];
  }

  async function countInvoicesForUsers(sinceISO) {
    const { sb } = SB;
    const t = SB.tables.invoices;

    invoiceCounts = new Map();
    let q = sb.from(t).select("id,created_at,username");
    if (sinceISO) q = q.gte("created_at", sinceISO);

    const { data, error } = await q;
    if (error) {
      console.warn("countInvoices error:", error);
      return { totalInvoices: 0 };
    }

    let totalInvoices = 0;
    for (const inv of data || []) {
      totalInvoices++;
      const key = inv.username ?? null;
      if (key) invoiceCounts.set(String(key), (invoiceCounts.get(String(key)) || 0) + 1);
    }
    return { totalInvoices };
  }

  async function computeActiveUsers24h(usersList) {
    const since = Date.now() - 24 * 3600 * 1000;
    let n = 0;
    for (const u of usersList) {
      if (!u.last_seen) continue;
      const t = new Date(u.last_seen).getTime();
      if (Number.isFinite(t) && t >= since) n++;
    }
    return n;
  }

  // ✅ زر الفواتير (مضمون دائماً)
  function buildActionsHtml(u) {
    return `
      <div class="actions">
        <button class="mini ghost" data-act="invoices" data-id="${escapeHtml(u.username)}">الفواتير</button>
        ${u.blocked
          ? `<button class="mini green" data-act="unblock" data-id="${escapeHtml(u.username)}">فك حظر</button>`
          : `<button class="mini red" data-act="block" data-id="${escapeHtml(u.username)}">حظر</button>`}
        <button class="mini ghost" data-act="resetDevice" data-id="${escapeHtml(u.username)}">مسح الجهاز</button>
        ${u.is_admin
          ? `<button class="mini ghost" data-act="rmAdmin" data-id="${escapeHtml(u.username)}">إلغاء أدمن</button>`
          : `<button class="mini blue" data-act="mkAdmin" data-id="${escapeHtml(u.username)}">جعله أدمن</button>`}
        <button class="mini red" data-act="delete" data-id="${escapeHtml(u.username)}">حذف</button>
      </div>
    `;
  }

  function renderUsers() {
    if (!usersTbody) return;

    const term = (searchUser?.value || "").trim().toLowerCase();
    const list = users
      .filter((u) => (u.username || "").toLowerCase().includes(term))
      .map((u) => {
        const invCount = invoiceCounts.get(String(u.username)) ?? 0;
        const last = timeAgo(u.last_seen);
        const dev = u.device_id ? escapeHtml(String(u.device_id)) : "—";

        return `
          <tr>
            <td><b style="color:#9fd0ff">${escapeHtml(u.username || "")}</b></td>
            <td>${badgeRole(u)}</td>
            <td>${badgeStatus(u)}</td>
            <td><span class="badge amber">${invCount}</span></td>
            <td>${escapeHtml(last)}</td>
            <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis">${dev}</td>
            <td>${buildActionsHtml(u)}</td>
          </tr>
        `;
      });

    usersTbody.innerHTML = list.join("") || `<tr><td colspan="7" class="mut">لا يوجد نتائج</td></tr>`;
  }

  async function refreshAll() {
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "…";
    }
    try {
      const sinceISO = rangeToSince(rangeSel?.value);
      users = await fetchUsers();
      if (stUsers) stUsers.textContent = String(users.length);

      const active = await computeActiveUsers24h(users);
      if (stActive) stActive.textContent = String(active);

      const { totalInvoices } = await countInvoicesForUsers(sinceISO);
      if (stInvoices) stInvoices.textContent = String(totalInvoices);

      renderUsers();
    } catch (e) {
      console.error("refreshAll error:", e);
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = "تحديث";
      }
    }
  }

  if (rangeSel) rangeSel.onchange = refreshAll;
  if (searchUser) searchUser.oninput = renderUsers;
  if (refreshBtn) refreshBtn.onclick = refreshAll;

  // ===== Actions click =====
  if (usersTbody) {
    usersTbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const act = btn.getAttribute("data-act");
      const username = btn.getAttribute("data-id");
      const u = users.find((x) => x.username === username);
      if (!u) return;

      if (act === "invoices") {
        openInvoicesModal(u);
        return;
      }

      if (act === "block") {
        if (!confirm(`حظر ${u.username}؟`)) return;
        await SB.sb.from(SB.tables.users).update({ blocked: true }).eq("id", u.id);
      }
      if (act === "unblock") {
        if (!confirm(`فك حظر ${u.username}؟`)) return;
        await SB.sb.from(SB.tables.users).update({ blocked: false }).eq("id", u.id);
      }
      if (act === "resetDevice") {
        if (!confirm(`مسح جهاز ${u.username}؟`)) return;
        await SB.sb.from(SB.tables.users).update({ device_id: null }).eq("id", u.id);
      }
      if (act === "mkAdmin") {
        if (!confirm(`جعل ${u.username} أدمن؟`)) return;
        await SB.sb.from(SB.tables.users).update({ is_admin: true }).eq("id", u.id);
      }
      if (act === "rmAdmin") {
        if (!confirm(`إلغاء أدمن عن ${u.username}؟`)) return;
        await SB.sb.from(SB.tables.users).update({ is_admin: false }).eq("id", u.id);
      }
      if (act === "delete") {
        if (!confirm(`حذف ${u.username} نهائيًا؟`)) return;
        await SB.sb.from(SB.tables.users).delete().eq("id", u.id);
      }

      await refreshAll();
    });
  }

  // ===== Add User modal =====
  if (addUserBtn) addUserBtn.onclick = () => { if (addModalBack) addModalBack.style.display = "flex"; };
  if (closeAddModalBtn) closeAddModalBtn.onclick = () => { if (addModalBack) addModalBack.style.display = "none"; };
  if (addModalBack) addModalBack.onclick = (e) => { if (e.target === addModalBack) addModalBack.style.display = "none"; };

  if (saveUserBtn) {
    saveUserBtn.onclick = async () => {
      const username = (newUsername?.value || "").trim();
      const pass = (newPass?.value || "").trim();
      const is_admin = !!newIsAdmin?.checked;

      if (!username || !pass) {
        if (addUserMsg) addUserMsg.textContent = "املأ الاسم وكلمة السر";
        return;
      }

      try {
        const { error } = await SB.sb.from(SB.tables.users).insert({ username, pass, is_admin, blocked: false });
        if (error) throw error;

        if (addUserMsg) addUserMsg.textContent = "تم الإضافة!";
        setTimeout(() => {
          if (addModalBack) addModalBack.style.display = "none";
          if (addUserMsg) addUserMsg.textContent = "";
          if (newUsername) newUsername.value = "";
          if (newPass) newPass.value = "";
          if (newIsAdmin) newIsAdmin.checked = false;
        }, 600);

        await refreshAll();
      } catch (e) {
        if (addUserMsg) addUserMsg.textContent = "فشل: " + (e?.message || "Unknown");
      }
    };
  }

  // ===== Invoices modal =====
  function openInvoicesModal(user) {
    currentUserForInvoices = user;
    if (invModalTitle) invModalTitle.textContent = `فواتير: ${user.username}`;
    if (invSearch) invSearch.value = "";
    if (invTbody) invTbody.innerHTML = `<tr><td colspan="5">جاري التحميل...</td></tr>`;
    if (invModalBack) invModalBack.style.display = "flex";
    loadInvoicesForCurrentUser();
  }

  function closeInvModal() {
    if (invModalBack) invModalBack.style.display = "none";
    currentUserForInvoices = null;
    invoicesForUser = [];
  }

  if (closeInvModalBtn) closeInvModalBtn.onclick = closeInvModal;
  if (invModalBack) invModalBack.addEventListener("click", (e) => { if (e.target === invModalBack) closeInvModal(); });

  async function loadInvoicesForCurrentUser() {
    if (!currentUserForInvoices) return;

    const { sb } = SB;
    const t = SB.tables.invoices;
    const sinceISO = rangeToSince(rangeSel?.value);

    let q = sb.from(t).select("*").order("created_at", { ascending: false }).limit(250);
    if (sinceISO) q = q.gte("created_at", sinceISO);

    const { data, error } = await q.eq("username", currentUserForInvoices.username);

    if (error) {
      console.error("loadInvoices error:", error);
      if (invTbody) invTbody.innerHTML = `<tr><td colspan="5">خطأ: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }

    invoicesForUser = data || [];
    renderInvoices();
  }

  function renderInvoices() {
    if (!invTbody) return;
    const term = (invSearch?.value || "").trim().toLowerCase();

    const filtered = invoicesForUser.filter(inv => {
      const fields = [inv.customer_name, inv.customer, inv.client, inv.name, inv.invoice_no, inv.code, inv.id, inv.created_at];
      return fields.some(f => String(f || "").toLowerCase().includes(term));
    });

    invTbody.innerHTML = filtered.map(inv => {
      const date = inv.created_at ? new Date(inv.created_at).toLocaleString("ar-EG") : "—";
      const cust = inv.customer_name || inv.customer || inv.client || inv.name || "—";
      const total = inv.total ?? inv.grand_total ?? inv.amount ?? "—";
      const code = inv.invoice_no || inv.code || String(inv.id || "—").slice(-6);

      return `
        <tr>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(cust)}</td>
          <td><b>${escapeHtml(String(total))}</b></td>
          <td>${escapeHtml(String(code))}</td>
          <td><button class="mini ghost" data-act="view" data-id="${escapeHtml(inv.id)}">عرض</button></td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="5" class="mut">لا فواتير</td></tr>`;
  }

  if (invSearch) invSearch.oninput = renderInvoices;
  if (reloadInvBtn) reloadInvBtn.onclick = loadInvoicesForCurrentUser;

  if (invTbody) {
    invTbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      const inv = invoicesForUser.find(x => String(x.id) === String(id));
      if (!inv) return;

      if (act === "view") {
        alert(JSON.stringify(inv, null, 2));
      }
    });
  }

  // ===== Init =====
  refreshAll();
})();
