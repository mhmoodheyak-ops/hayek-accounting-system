/* HAYEK SPOT — Admin (Mobile hide device col + invoice count near username + PDF export) */
(function () {
  const $ = (id) => document.getElementById(id);

  // UI elements (safe)
  const lock = $("lock");
  const goLogin = $("goLogin");
  const onlineDot = $("onlineDot");
  const adminInfo = $("adminInfo") || $("adminName"); // support both
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

  // ---- Inject mobile CSS: hide "device" column (6th) on small screens ----
  (function injectMobileCss() {
    const css = `
      @media (max-width: 820px){
        table{min-width:0 !important;}
        th:nth-child(6), td:nth-child(6){display:none !important;} /* الجهاز */
      }
    `;
    const style = document.createElement("style");
    style.setAttribute("data-hayek-admin-mobile", "1");
    style.textContent = css;
    document.head.appendChild(style);
  })();

  // Helpers
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

  // Auth guard
  function hardLock() {
    if (lock) lock.style.display = "flex";
    if (goLogin) goLogin.onclick = () => (location.href = "index.html?v=" + Date.now());
  }

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
  if (adminInfo) {
    // adminInfo could be a span in header
    if (adminInfo.id === "adminName") adminInfo.textContent = session.username || "—";
    else adminInfo.textContent = `أدمن: ${session.username || "—"} — متصل`;
  }

  if (logoutBtn) {
    logoutBtn.onclick = () => {
      window.HAYEK_AUTH.logout();
      location.href = "index.html?v=" + Date.now();
    };
  }

  // Supabase client
  function getSB() {
    // supports both configs used in your files
    const cfgA = window.HAYEK_CONFIG || {};
    const cfgB = window.APP_CONFIG || {};

    const supabaseUrl =
      cfgA.supabaseUrl ||
      cfgB.SUPABASE_URL ||
      "";
    const supabaseKey =
      cfgA.supabaseKey ||
      cfgB.SUPABASE_ANON_KEY ||
      "";

    if (!supabaseUrl || !supabaseKey) throw new Error("config.js ناقص: SUPABASE_URL / KEY");

    const sb = supabase.createClient(supabaseUrl, supabaseKey);

    const tables = {
      users: cfgA.tables?.users || cfgB.TABLE_USERS || "app_users",
      invoices: cfgA.tables?.invoices || cfgB.TABLE_INVOICES || "app_invoices",
      operations: cfgA.tables?.operations || cfgB.TABLE_OPERATIONS || "app_operations",
    };

    return { sb, tables };
  }

  let SB;
  try {
    SB = getSB();
  } catch (e) {
    console.error("Supabase config error:", e);
    alert("خطأ إعداد Supabase:\n" + e.message);
    return;
  }

  // Data state
  let users = [];
  let invoiceCounts = new Map();
  let currentUserForInvoices = null;
  let invoicesForUser = [];

  async function countInvoicesForUsers(sinceISO) {
    const { sb } = SB;
    const invoicesTable = SB.tables.invoices;

    invoiceCounts = new Map();
    let q = sb.from(invoicesTable).select("id,created_at,username");
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

  async function fetchUsers() {
    const { sb } = SB;
    const usersTable = SB.tables.users;

    const { data, error } = await sb
      .from(usersTable)
      .select("id,username,is_admin,blocked,created_at,device_id,last_seen")
      .order("username", { ascending: true });

    if (error) {
      console.error("fetchUsers error:", error);
      return [];
    }
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
    return u.is_admin ? `<span class="badge blue">أدمن</span>` : `<span class="badge">مستخدم</span>`;
  }
  function badgeStatus(u) {
    return u.blocked ? `<span class="badge red">محظور</span>` : `<span class="badge green">نشط</span>`;
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

        // ✅ count badge beside username
        const userCell = `
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <b style="color:#9fd0ff">${escapeHtml(u.username || "")}</b>
            <span class="badge amber" title="عدد الفواتير">${invCount}</span>
          </div>
        `;

        return `
          <tr>
            <td>${userCell}</td>
            <td>${badgeRole(u)}</td>
            <td>${badgeStatus(u)}</td>
            <td><span class="badge amber">${invCount}</span></td>
            <td>${escapeHtml(last)}</td>
            <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">${dev}</td>
            <td>
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
            </td>
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

  // User actions
  if (usersTbody) {
    usersTbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;

      const act = btn.getAttribute("data-act");
      const username = btn.getAttribute("data-id");
      const u = users.find((x) => String(x.username) === String(username));
      if (!u) return;

      if (act === "invoices") {
        openInvoicesModal(u);
        return;
      }

      try {
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
      } catch (err) {
        console.error("Action error:", err);
        alert("حدث خطأ أثناء التنفيذ.");
      }

      await refreshAll();
    });
  }

  // Add user modal
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
        setTimeout(() => { if (addModalBack) addModalBack.style.display = "none"; }, 700);
        await refreshAll();
      } catch (e) {
        console.error(e);
        if (addUserMsg) addUserMsg.textContent = "فشل: " + (e.message || "خطأ");
      }
    };
  }

  // Invoices modal
  function openInvoicesModal(user) {
    currentUserForInvoices = user;
    if (invModalTitle) invModalTitle.textContent = `فواتير: ${user.username}`;
    if (invSearch) invSearch.value = "";
    if (invTbody) invTbody.innerHTML = "";
    if (invModalBack) invModalBack.style.display = "flex";
    loadInvoicesForCurrentUser();
  }

  function closeInvModalFunc() {
    if (invModalBack) invModalBack.style.display = "none";
    currentUserForInvoices = null;
    invoicesForUser = [];
  }

  if (closeInvModalBtn) closeInvModalBtn.onclick = closeInvModalFunc;
  if (invModalBack) {
    invModalBack.addEventListener("click", (e) => {
      if (e.target === invModalBack) closeInvModalFunc();
    });
  }

  async function loadInvoicesForCurrentUser() {
    if (!currentUserForInvoices) return;

    const { sb } = SB;
    const invTable = SB.tables.invoices;
    const sinceISO = rangeToSince(rangeSel?.value);

    let q = sb.from(invTable).select("*").order("created_at", { ascending: false }).limit(200);
    if (sinceISO) q = q.gte("created_at", sinceISO);

    const { data, error } = await q.eq("username", currentUserForInvoices.username);

    if (error) {
      console.error(error);
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
      const fields = [inv.customer, inv.customer_name, inv.client, inv.name, inv.invoice_no, inv.code, inv.created_at, inv.id];
      return fields.some(f => String(f || "").toLowerCase().includes(term));
    });

    invTbody.innerHTML = filtered.map(inv => {
      const date = inv.created_at ? new Date(inv.created_at).toLocaleString("ar-EG") : "—";
      const cust = inv.customer || inv.customer_name || inv.client || inv.name || "—";
      const total = inv.total || inv.grand_total || inv.amount || "—";
      const code = inv.invoice_no || inv.code || String(inv.id || "").slice(-6) || "—";

      return `
        <tr>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(cust)}</td>
          <td><b>${escapeHtml(total)}</b></td>
          <td>${escapeHtml(code)}</td>
          <td style="white-space:nowrap">
            <button class="mini ghost" data-act="viewJson" data-id="${escapeHtml(inv.id)}">عرض</button>
            <button class="mini blue" data-act="pdf" data-id="${escapeHtml(inv.id)}">تصدير PDF</button>
          </td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="5" class="mut">لا فواتير</td></tr>`;
  }

  if (invSearch) invSearch.oninput = renderInvoices;
  if (reloadInvBtn) reloadInvBtn.onclick = loadInvoicesForCurrentUser;

  async function fetchOps(invoiceId) {
    const { sb } = SB;
    const opsTable = SB.tables.operations;
    try {
      const { data, error } = await sb
        .from(opsTable)
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("line_no", { ascending: true })
        .limit(600);
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  }

  function buildPdfHtml(inv, ops) {
    const rowsHtml = (ops && ops.length)
      ? ops.map((r, i) => `
          <tr>
            <td style="border:1px solid #111;padding:8px;text-align:center">${i + 1}</td>
            <td style="border:1px solid #111;padding:8px;text-align:center">${escapeHtml(r.t || r.time || "")}</td>
            <td style="border:1px solid #111;padding:8px;text-align:right">${escapeHtml(r.text || r.note || "")}</td>
            <td style="border:1px solid #111;padding:8px;text-align:center">${escapeHtml(r.expr || r.operation || "")}</td>
            <td style="border:1px solid #111;padding:8px;text-align:center">${escapeHtml(String(r.result ?? r.value ?? ""))}</td>
          </tr>
        `).join("")
      : `
        <tr>
          <td colspan="5" style="border:1px solid #111;padding:16px;text-align:center;color:#555">
            لا توجد تفاصيل عمليات محفوظة لهذه الفاتورة
          </td>
        </tr>
      `;

    const cust = inv.customer || inv.customer_name || "—";
    const total = inv.total || inv.grand_total || inv.amount || "—";
    const code = inv.invoice_no || inv.code || String(inv.id || "").slice(-6) || "—";
    const date = inv.created_at ? new Date(inv.created_at).toLocaleString("ar-EG") : "—";

    return `
      <div style="direction:rtl;font-family:Arial,system-ui;background:#fff;color:#111;padding:18px;">
        <div style="border:2px solid #0a7c3a;border-radius:14px;padding:16px;">
          <div style="text-align:center;font-weight:900;font-size:26px;margin-bottom:4px;">شركة الحايك</div>
          <div style="text-align:center;font-weight:900;font-size:20px;color:#0a7c3a;margin-bottom:14px;">HAYEK SPOT</div>

          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;line-height:1.7;margin-bottom:10px;">
            <div><b>اسم المستخدم:</b> ${escapeHtml(currentUserForInvoices?.username || inv.username || "—")}</div>
            <div><b>رقم الفاتورة:</b> ${escapeHtml(code)}</div>
            <div><b>اسم الزبون:</b> ${escapeHtml(cust)}</div>
            <div><b>التاريخ:</b> ${escapeHtml(date)}</div>
          </div>

          <hr style="border:1px solid #0a7c3a;margin:12px 0;">

          <div style="font-weight:900;margin:6px 0 10px;">سجل العمليات</div>

          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#f5f6f7">
                <th style="border:1px solid #111;padding:8px;text-align:center">#</th>
                <th style="border:1px solid #111;padding:8px;text-align:center">الوقت</th>
                <th style="border:1px solid #111;padding:8px;text-align:center">البيان</th>
                <th style="border:1px solid #111;padding:8px;text-align:center">العملية</th>
                <th style="border:1px solid #111;padding:8px;text-align:center">النتيجة</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div style="margin-top:12px;border:2px dashed #0a7c3a;border-radius:12px;padding:10px;display:flex;justify-content:space-between;font-weight:900">
            <span>إجمالي الكشف:</span>
            <span style="color:#0a7c3a">${escapeHtml(total)}</span>
          </div>

          <div style="margin-top:12px;text-align:center;font-size:12px;line-height:1.8;color:#333">
            تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك<br/>
            تجارة عامة - توزيع جملة - دعاية وإعلان - طباعة - حلول رقمية<br/>
            <span style="display:inline-block;margin-top:8px;border:2px solid #0a7c3a;color:#0a7c3a;border-radius:12px;padding:8px 16px;font-weight:900;font-size:16px;">05510217646</span>
          </div>
        </div>
      </div>
    `;
  }

  async function exportInvoicePdf(inv) {
    // Ensure libs exist
    if (!window.html2canvas) { alert("html2canvas غير محمل"); return; }
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) { alert("jsPDF غير محمل"); return; }

    const ops = await fetchOps(inv.id);

    const html = buildPdfHtml(inv, ops);

    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    tmp.style.position = "fixed";
    tmp.style.left = "-99999px";
    tmp.style.top = "0";
    tmp.style.width = "794px"; // A4-ish
    document.body.appendChild(tmp);

    try {
      const canvas = await html2canvas(tmp, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

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

      const code = (inv.invoice_no || inv.code || String(inv.id || "").slice(-6) || "INV");
      pdf.save(`فاتورة_${currentUserForInvoices?.username || inv.username || "user"}_${code}.pdf`);
    } catch (e) {
      console.error("PDF export error:", e);
      alert("فشل إنشاء PDF");
    } finally {
      tmp.remove();
    }
  }

  if (invTbody) {
    invTbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;

      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      const inv = invoicesForUser.find(i => String(i.id) === String(id));
      if (!inv) return;

      if (act === "viewJson") alert(JSON.stringify(inv, null, 2));
      if (act === "pdf") await exportInvoicePdf(inv);
    });
  }

  // Init
  refreshAll();
})();
