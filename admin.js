
/* HAYEK SPOT — Admin (robust) */
(function () {
  const $ = (id) => document.getElementById(id);

  // UI
  const lock = $("lock");
  const goLogin = $("goLogin");
  const onlineDot = $("onlineDot");
  const adminInfo = $("adminInfo");
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
  const closeAddModal = $("closeAddModal");
  const addUserBtn = $("addUserBtn");
  const newUsername = $("newUsername");
  const newPass = $("newPass");
  const newIsAdmin = $("newIsAdmin");
  const saveUserBtn = $("saveUserBtn");
  const addUserMsg = $("addUserMsg");

  // Invoices modal
  const invModalBack = $("invModalBack");
  const closeInvModal = $("closeInvModal");
  const invModalTitle = $("invModalTitle");
  const invSearch = $("invSearch");
  const invTbody = $("invTbody");
  const reloadInvBtn = $("reloadInvBtn");

  // Helpers
  function setOnlineDot() {
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
    return null; // all
  }

  function vibrateTiny() {
    try { navigator.vibrate && navigator.vibrate(15); } catch {}
  }

  // Auth guard
  function hardLock() {
    lock.style.display = "flex";
    goLogin.onclick = () => (location.href = "index.html?v=" + Date.now());
  }

  if (!window.HAYEK_AUTH || !window.__HAYEK_AUTH_LOADED__ || !window.HAYEK_AUTH.isAuthed()) {
    hardLock();
    return;
  }

  const session = window.HAYEK_AUTH.getUser() || {};
  // لازم يكون أدمن
  if (session.role !== "admin") {
    hardLock();
    return;
  }

  // Unlock
  lock.style.display = "none";
  adminInfo.textContent = `أدمن: ${session.username || "—"} — متصل`;

  logoutBtn.onclick = () => {
    window.HAYEK_AUTH.logout();
    location.href = "index.html?v=" + Date.now();
  };

  // Supabase client
  function getSB() {
    // إذا عندك في config.js: window.HAYEK_CONFIG = { supabaseUrl, supabaseKey, tables:{users,invoices,operations} }
    const cfg = window.HAYEK_CONFIG || window.APP_CONFIG || {};
    const supabaseUrl = (cfg.supabaseUrl || cfg.SUPABASE_URL || "").trim();
    const supabaseKey = (cfg.supabaseKey || cfg.SUPABASE_KEY || cfg.anonKey || "").trim();

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("config.js ناقص: supabaseUrl / supabaseKey");
    }

    // supabase.js (محلي) أو global from CDN
    const createClient =
      (window.supabase && window.supabase.createClient) ||
      (window.Supabase && window.Supabase.createClient) ||
      null;

    if (!createClient) {
      throw new Error("مكتبة Supabase غير محمّلة (supabase.js)");
    }

    return {
      sb: createClient(supabaseUrl, supabaseKey),
      tables: {
        users: (cfg.tables && (cfg.tables.users || cfg.tables.app_users)) || "app_users",
        invoices: (cfg.tables && (cfg.tables.invoices || cfg.tables.app_invoices)) || "app_invoices",
        operations: (cfg.tables && (cfg.tables.operations || cfg.tables.app_operations)) || "app_operations",
      },
    };
  }

  let SB;
  try {
    SB = getSB();
  } catch (e) {
    console.error(e);
    alert("خطأ إعدادات config.js أو تحميل supabase.js.\n" + e.message);
    return;
  }

  // Data state
  let users = [];
  let invoiceCounts = new Map(); // key: username or user_id -> count
  let currentUserForInvoices = null;
  let invoicesForUser = [];

  // --- Robust count helper (tries user_id then username) ---
  async function countInvoicesForUsers(sinceISO) {
    const { sb } = SB;
    const invoicesTable = SB.tables.invoices;

    // We'll attempt:
    // 1) select user_id, count
    // 2) select username, count
    // Note: Supabase JS doesn't support group+count directly in a single call nicely without RPC,
    // so we fetch minimal rows within range and count client-side (safe for small/medium usage).
    // Later يمكن عمل View/RPC إذا صار الحمل كبير.

    invoiceCounts = new Map();

    // Fetch minimal fields
    let q = sb.from(invoicesTable).select("id,created_at,user_id,username,user_username,customer,total,grand_total,amount");
    if (sinceISO) q = q.gte("created_at", sinceISO);

    const { data, error } = await q.limit(5000); // سقف حماية
    if (error) {
      console.warn("countInvoicesForUsers error:", error);
      return { totalInvoices: 0 };
    }

    let totalInvoices = 0;
    for (const inv of data || []) {
      totalInvoices++;
      const key =
        inv.user_id ??
        inv.username ??
        inv.user_username ??
        inv.user ??
        inv.userId ??
        null;

      if (key == null) continue;
      invoiceCounts.set(String(key), (invoiceCounts.get(String(key)) || 0) + 1);
    }

    return { totalInvoices };
  }

  async function fetchUsers() {
    const { sb } = SB;
    const usersTable = SB.tables.users;

    // Try select columns that likely exist
    const { data, error } = await sb
      .from(usersTable)
      .select("id,username,is_admin,blocked,created_at,device_id,last_seen")
      .order("id", { ascending: true })
      .limit(2000);

    if (error) throw error;
    return data || [];
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

  function badgeRole(u) {
    if (u.is_admin) return `<span class="badge blue">أدمن</span>`;
    return `<span class="badge">مستخدم</span>`;
  }
  function badgeStatus(u) {
    if (u.blocked) return `<span class="badge red">محظور</span>`;
    return `<span class="badge green">نشط</span>`;
  }

  function renderUsers() {
    const term = (searchUser.value || "").trim().toLowerCase();

    const list = users
      .filter((u) => (u.username || "").toLowerCase().includes(term))
      .map((u) => {
        const invCount =
          invoiceCounts.get(String(u.id)) ??
          invoiceCounts.get(String(u.username)) ??
          0;

        const last = timeAgo(u.last_seen);
        const dev = u.device_id ? escapeHtml(String(u.device_id)) : "—";

        return `
          <tr>
            <td><b style="color:#9fd0ff">${escapeHtml(u.username || "")}</b></td>
            <td>${badgeRole(u)}</td>
            <td>${badgeStatus(u)}</td>
            <td><span class="badge amber">${invCount}</span></td>
            <td>${escapeHtml(last)}</td>
            <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">${dev}</td>
            <td>
              <div class="actions">
                <button class="mini ghost" data-act="invoices" data-id="${u.id}">الفواتير</button>

                ${u.blocked
                  ? `<button class="mini green" data-act="unblock" data-id="${u.id}">فك حظر</button>`
                  : `<button class="mini red" data-act="block" data-id="${u.id}">حظر</button>`}

                <button class="mini ghost" data-act="resetDevice" data-id="${u.id}">مسح الجهاز</button>

                ${u.is_admin
                  ? `<button class="mini ghost" data-act="rmAdmin" data-id="${u.id}">إلغاء أدمن</button>`
                  : `<button class="mini blue" data-act="mkAdmin" data-id="${u.id}">جعله أدمن</button>`}

                <button class="mini red" data-act="delete" data-id="${u.id}">حذف</button>
              </div>
            </td>
          </tr>
        `;
      });

    usersTbody.innerHTML = list.join("") || `<tr><td colspan="7" class="mut">لا يوجد نتائج</td></tr>`;
  }

  async function refreshAll() {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "…";
    try {
      const sinceISO = rangeToSince(rangeSel.value);

      users = await fetchUsers();
      stUsers.textContent = String(users.length);

      const active = await computeActiveUsers24h(users);
      stActive.textContent = String(active);

      const { totalInvoices } = await countInvoicesForUsers(sinceISO);
      stInvoices.textContent = String(totalInvoices);

      renderUsers();
    } catch (e) {
      console.error(e);
      alert("خطأ أثناء تحميل بيانات الأدمن:\n" + (e.message || e));
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "تحديث";
    }
  }

  rangeSel.onchange = () => { vibrateTiny(); refreshAll(); };
  searchUser.oninput = () => renderUsers();
  refreshBtn.onclick = () => { vibrateTiny(); refreshAll(); };

  // --- User actions ---
  usersTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const act = btn.getAttribute("data-act");
    const userId = btn.getAttribute("data-id");
    const u = users.find((x) => String(x.id) === String(userId));
    if (!u) return;

    try {
      if (act === "block") {
        if (!confirm(`حظر المستخدم: ${u.username} ؟`)) return;
        await updateUser(u.id, { blocked: true });
      }
      if (act === "unblock") {
        if (!confirm(`فك الحظر عن: ${u.username} ؟`)) return;
        await updateUser(u.id, { blocked: false });
      }
      if (act === "resetDevice") {
        if (!confirm(`مسح ربط الجهاز للمستخدم: ${u.username} ؟`)) return;
        await updateUser(u.id, { device_id: null });
      }
      if (act === "mkAdmin") {
        if (!confirm(`جعل المستخدم أدمن: ${u.username} ؟`)) return;
        await updateUser(u.id, { is_admin: true });
      }
      if (act === "rmAdmin") {
        if (!confirm(`إلغاء أدمن عن: ${u.username} ؟`)) return;
        await updateUser(u.id, { is_admin: false });
      }
      if (act === "delete") {
        if (!confirm(`⚠️ حذف المستخدم نهائيًا: ${u.username} ؟`)) return;
        await deleteUser(u.id);
      }
      if (act === "invoices") {
        await openInvoicesModal(u);
      }

      await refreshAll();
    } catch (err) {
      console.error(err);
      alert("فشل تنفيذ العملية:\n" + (err.message || JSON.stringify(err)));
    }
  });

  async function updateUser(id, patch) {
    const { sb } = SB;
    const usersTable = SB.tables.users;
    const { error } = await sb.from(usersTable).update(patch).eq("id", id);
    if (error) throw error;
  }

  async function deleteUser(id) {
    const { sb } = SB;
    const usersTable = SB.tables.users;
    const { error } = await sb.from(usersTable).delete().eq("id", id);
    if (error) throw error;
  }

  // --- Add user ---
  function openAddModal() {
    addUserMsg.textContent = "";
    newUsername.value = "";
    newPass.value = "";
    newIsAdmin.checked = false;
    addModalBack.style.display = "flex";
    newUsername.focus();
  }
  function closeAdd() {
    addModalBack.style.display = "none";
  }

  addUserBtn.onclick = () => { vibrateTiny(); openAddModal(); };
  closeAddModal.onclick = () => closeAdd();
  addModalBack.addEventListener("click", (e) => {
    if (e.target === addModalBack) closeAdd();
  });

  saveUserBtn.onclick = async () => {
    vibrateTiny();
    addUserMsg.textContent = "";
    const username = (newUsername.value || "").trim();
    const pass = (newPass.value || "").trim();
    const is_admin = !!newIsAdmin.checked;
    if (!username || !pass) {
      addUserMsg.textContent = "أدخل اسم المستخدم وكلمة السر.";
      return;
    }

    try {
      const { sb } = SB;
      const usersTable = SB.tables.users;

      // Insert
      const payload = { username, pass, is_admin, blocked: false };
      const { error } = await sb.from(usersTable).insert(payload);
      if (error) throw error;

      addUserMsg.textContent = "✅ تم إضافة المستخدم.";
      setTimeout(() => closeAdd(), 450);
      await refreshAll();
    } catch (e) {
      console.error(e);
      addUserMsg.textContent = "❌ فشل: " + (e.message || e);
    }
  };

  // --- Invoices modal ---
  function openInvModal() {
    invSearch.value = "";
    invTbody.innerHTML = "";
    invModalBack.style.display = "flex";
  }
  function closeInvModal() {
    invModalBack.style.display = "none";
    currentUserForInvoices = null;
    invoicesForUser = [];
  }
  closeInvModal.onclick = () => closeInvModal();
  invModalBack.addEventListener("click", (e) => {
    if (e.target === invModalBack) closeInvModal();
  });

  async function openInvoicesModal(user) {
    currentUserForInvoices = user;
    invModalTitle.textContent = `المستخدم: ${user.username}`;
    openInvModal();
    await loadInvoicesForCurrentUser();
  }

  async function loadInvoicesForCurrentUser() {
    if (!currentUserForInvoices) return;
    const { sb } = SB;
    const invTable = SB.tables.invoices;

    const sinceISO = rangeToSince(rangeSel.value);

    // Robust: try match by user_id then username
    let q = sb.from(invTable).select("*").order("created_at", { ascending: false }).limit(200);
    if (sinceISO) q = q.gte("created_at", sinceISO);

    // Try user_id
    let res = await q.eq("user_id", currentUserForInvoices.id);
    if (res.error) {
      // Try username
      res = await q.eq("username", currentUserForInvoices.username);
    }

    if (res.error) {
      console.error(res.error);
      invTbody.innerHTML = `<tr><td colspan="5" class="mut">تعذر تحميل الفواتير (${escapeHtml(res.error.message)})</td></tr>`;
      return;
    }

    invoicesForUser = res.data || [];
    renderInvoices();
  }

  function pickField(inv, candidates) {
    for (const c of candidates) {
      if (inv && inv[c] != null) return inv[c];
    }
    return null;
  }

  function renderInvoices() {
    const term = (invSearch.value || "").trim().toLowerCase();

    const filtered = invoicesForUser.filter((inv) => {
      const c = String(pickField(inv, ["customer", "customer_name", "client", "name"]) || "").toLowerCase();
      const id = String(pickField(inv, ["invoice_no", "inv_id", "code", "id"]) || "").toLowerCase();
      const dt = String(pickField(inv, ["created_at", "date"]) || "").toLowerCase();
      return (c + " " + id + " " + dt).includes(term);
    });

    invTbody.innerHTML =
      filtered
        .map((inv) => {
          const created = pickField(inv, ["created_at", "date"]) || "";
          const cust = pickField(inv, ["customer", "customer_name", "client", "name"]) || "—";
          const total = pickField(inv, ["total", "grand_total", "amount", "sum"]) ?? "—";
          const code = pickField(inv, ["invoice_no", "inv_id", "code", "id"]) ?? "—";

          return `
            <tr>
              <td>${escapeHtml(new Date(created).toLocaleString() || String(created))}</td>
              <td>${escapeHtml(cust)}</td>
              <td><b>${escapeHtml(total)}</b></td>
              <td>${escapeHtml(code)}</td>
              <td>
                <div class="actions">
                  <button class="mini ghost" data-act="viewJson" data-id="${escapeHtml(inv.id)}">عرض</button>
                  <button class="mini blue" data-act="pdf" data-id="${escapeHtml(inv.id)}">PDF</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("") || `<tr><td colspan="5" class="mut">لا يوجد فواتير</td></tr>`;
  }

  invSearch.oninput = () => renderInvoices();
  reloadInvBtn.onclick = async () => { vibrateTiny(); await loadInvoicesForCurrentUser(); };

  invTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");

    const inv = invoicesForUser.find((x) => String(x.id) === String(id));
    if (!inv) return;

    if (act === "viewJson") {
      alert(JSON.stringify(inv, null, 2));
      return;
    }
    if (act === "pdf") {
      try {
        await downloadInvoicePdf(inv, currentUserForInvoices);
      } catch (err) {
        console.error(err);
        alert("تعذر إنشاء PDF لهذه الفاتورة.\n" + (err.message || err));
      }
    }
  });

  // --- PDF builder for invoice (Arabic as image) ---
  function buildInvoiceHtmlFromRow(inv, user) {
    const cust = pickField(inv, ["customer", "customer_name", "client", "name"]) || "—";
    const total = pickField(inv, ["total", "grand_total", "amount", "sum"]) ?? "—";
    const code = pickField(inv, ["invoice_no", "inv_id", "code", "id"]) ?? "—";
    const created = pickField(inv, ["created_at", "date"]) || new Date().toISOString();

    // rows/items
    const rows =
      pickField(inv, ["rows", "items", "lines", "operations"]) ||
      [];

    let arr = rows;
    try {
      if (typeof rows === "string") arr = JSON.parse(rows);
    } catch {}

    if (!Array.isArray(arr)) arr = [];

    const rowsHtml = arr.map((r, i) => {
      const t = r.t || r.time || r.created_at || "—";
      const text = r.text || r.note || r.title || r.desc || "عملية";
      const expr = r.expr || r.expression || r.op || "—";
      const result = r.result ?? r.value ?? "—";

      return `
        <tr>
          <td style="border:1px solid #111;padding:8px;text-align:center">${i + 1}</td>
          <td style="border:1px solid #111;padding:8px;text-align:center">${escapeHtml(String(t))}</td>
          <td style="border:1px solid #111;padding:8px;text-align:center">${escapeHtml(String(text))}</td>
          <td style="border:1px solid #111;padding:8px;text-align:center">${escapeHtml(String(expr))}</td>
          <td style="border:1px solid #111;padding:8px;text-align:center">${escapeHtml(String(result))}</td>
        </tr>
      `;
    }).join("");

    return `
      <div style="direction:rtl;font-family:Arial,system-ui; background:#fff; color:#111; padding:18px;">
        <div style="border:2px solid #111;border-radius:14px;padding:16px;">
          <div style="text-align:center;font-weight:800;font-size:22px;margin-bottom:6px;">شركة الحايك</div>
          <div style="text-align:center;font-weight:900;font-size:20px;color:#0a7c3a;margin-bottom:10px;">HAYEK SPOT</div>

          <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;margin-bottom:10px;flex-wrap:wrap">
            <div>اسم الزبون: <b>${escapeHtml(cust)}</b></div>
            <div>اسم المستخدم: <b>${escapeHtml(user?.username || "—")}</b></div>
            <div>رقم: <b>${escapeHtml(String(code))}</b></div>
            <div>التاريخ: <b>${escapeHtml(new Date(created).toLocaleString())}</b></div>
          </div>

          <div style="border-top:1px solid #111;margin:10px 0"></div>

          <div style="font-weight:800;margin:6px 0 8px;">سجل العمليات</div>

          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr>
                <th style="border:1px solid #111;padding:8px;text-align:center;">#</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">الوقت</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">البيان</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">العملية</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">النتيجة</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `
                <tr>
                  <td colspan="5" style="border:1px solid #111;padding:10px;text-align:center;color:#777">لا يوجد تفاصيل محفوظة داخل الفاتورة</td>
                </tr>
              `}
            </tbody>
          </table>

          <div style="margin-top:12px;border:2px dashed #111;border-radius:12px;padding:10px;display:flex;justify-content:space-between;font-weight:800">
            <span>إجمالي الكشف:</span>
            <span>${escapeHtml(String(total))}</span>
          </div>

          <div style="margin-top:12px;border:2px solid #111;border-radius:14px;padding:12px;text-align:center;font-size:12px;line-height:1.8">
            تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك<br/>
            شركة الحايك / تجارة عامة / توزيع جملة / دعاية و اعلان / طباعة / حلول رقمية<br/>
            <span style="display:inline-block;margin-top:8px;border:2px solid #0a7c3a;color:#0a7c3a;border-radius:12px;padding:8px 16px;font-weight:900;font-size:16px;">05510217646</span>
          </div>
        </div>
      </div>
    `;
  }

  async function downloadInvoicePdf(inv, user) {
    const html = buildInvoiceHtmlFromRow(inv, user);

    const tmp = document.createElement("div");
    tmp.style.position = "fixed";
    tmp.style.left = "-99999px";
    tmp.style.top = "0";
    tmp.style.width = "794px"; // A4 @ 96dpi
    tmp.innerHTML = html;
    document.body.appendChild(tmp);

    const canvas = await html2canvas(tmp, { scale: 2, backgroundColor: "#ffffff" });
    tmp.remove();

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "pt", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgW = pageW;
    const imgH = canvas.height * (imgW / canvas.width);

    let y = 0;
    let remaining = imgH;

    while (remaining > 0) {
      pdf.addImage(imgData, "JPEG", 0, y, imgW, imgH);
      remaining -= pageH;
      if (remaining > 0) {
        pdf.addPage();
        y -= pageH;
      }
    }

    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HAYEK_INV_${user?.username || "user"}_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // Init
  refreshAll();
})();
