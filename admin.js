/* HAYEK SPOT — Admin (Users + Invoices + Operations + PDF) */
(function () {
  const $ = (id) => document.getElementById(id);

  // ===== UI =====
  const lock = $("lock");
  const goLogin = $("goLogin");

  const onlineDot = $("onlineDot");
  const adminName = $("adminName");
  const logoutBtn = $("logoutBtn");
  const addUserBtn = $("addUserBtn");

  const refreshBtn = $("refreshBtn");
  const rangeSel = $("range");
  const searchUser = $("searchUser");

  const stUsers = $("stUsers");
  const stInvoices = $("stInvoices");
  const stActive = $("stActive");

  const usersTbody = $("usersTbody");

  // Add user modal
  const addModalBack = $("addModalBack");
  const closeAddModal = $("closeAddModal");
  const newUsername = $("newUsername");
  const newPass = $("newPass");
  const newIsAdmin = $("newIsAdmin");
  const saveUserBtn = $("saveUserBtn");
  const addUserMsg = $("addUserMsg");

  // Invoices list modal
  const invModalBack = $("invModalBack");
  const closeInvModal = $("closeInvModal");
  const invModalTitle = $("invModalTitle");
  const invSearch = $("invSearch");
  const reloadInvBtn = $("reloadInvBtn");
  const invTbody = $("invTbody");

  // Operations modal
  const opsModalBack = $("opsModalBack");
  const closeOpsModal = $("closeOpsModal");
  const opsModalTitle = $("opsModalTitle");
  const opsMeta = $("opsMeta");
  const opsTbody = $("opsTbody");
  const exportPdfBtn = $("exportPdfBtn");

  // ===== helpers =====
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

  // ===== auth guard =====
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
  if (adminName) adminName.textContent = session.username || "admin";

  if (logoutBtn) {
    logoutBtn.onclick = () => {
      window.HAYEK_AUTH.logout();
      location.href = "index.html?v=" + Date.now();
    };
  }

  // ===== supabase =====
  function getSB() {
    const cfg = window.HAYEK_CONFIG || {};
    const supabaseUrl = cfg.supabaseUrl || "";
    const supabaseKey = cfg.supabaseKey || "";
    if (!supabaseUrl || !supabaseKey) throw new Error("config.js غير محمّل أو ناقص supabaseUrl/supabaseKey");

    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("مكتبة Supabase غير محمّلة");
    }

    const sb = window.supabase.createClient(supabaseUrl, supabaseKey);
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
    console.error(e);
    alert("خطأ إعداد Supabase:\n" + e.message);
    return;
  }

  // ===== state =====
  let users = [];
  let invoiceCounts = new Map();
  let currentUserForInvoices = null;

  let invoicesForUser = [];
  let currentInvoice = null;
  let currentOps = [];

  // ===== queries =====
  async function fetchUsers() {
    const { sb } = SB;
    const { data, error } = await sb
      .from(SB.tables.users)
      .select("id,username,is_admin,blocked,created_at,last_seen")
      .order("username", { ascending: true });

    if (error) {
      console.error("fetchUsers:", error);
      return [];
    }
    return data || [];
  }

  async function countInvoicesForUsers(sinceISO) {
    const { sb } = SB;
    invoiceCounts = new Map();

    let q = sb.from(SB.tables.invoices).select("id,username,created_at");
    if (sinceISO) q = q.gte("created_at", sinceISO);

    const { data, error } = await q;
    if (error) {
      console.warn("countInvoices:", error);
      return { totalInvoices: 0 };
    }

    let totalInvoices = 0;
    for (const inv of data || []) {
      totalInvoices++;
      const u = inv.username ? String(inv.username) : "";
      if (u) invoiceCounts.set(u, (invoiceCounts.get(u) || 0) + 1);
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

  // ===== render users =====
  function badgeRole(u) {
    return u.is_admin
      ? `<span class="badge blue">أدمن</span>`
      : `<span class="badge">مستخدم</span>`;
  }
  function badgeStatus(u) {
    return u.blocked
      ? `<span class="badge red">محظور</span>`
      : `<span class="badge green">نشط</span>`;
  }

  function renderUsers() {
    if (!usersTbody) return;

    const term = (searchUser?.value || "").trim().toLowerCase();

    const html = users
      .filter((u) => (u.username || "").toLowerCase().includes(term))
      .map((u) => {
        const invCount = invoiceCounts.get(String(u.username)) ?? 0;

        return `
          <tr>
            <td>
              <b style="color:#9fd0ff">${escapeHtml(u.username || "")}</b>
              <span class="badge amber" style="margin-inline-start:8px">${invCount}</span>
            </td>
            <td>${badgeRole(u)}</td>
            <td>${badgeStatus(u)}</td>
            <td>${escapeHtml(timeAgo(u.last_seen))}</td>
            <td>
              <div class="actions">
                <button class="mini ghost" data-act="invoices" data-id="${escapeHtml(u.username)}">الفواتير</button>
                ${
                  u.blocked
                    ? `<button class="mini green" data-act="unblock" data-id="${escapeHtml(u.username)}">فك حظر</button>`
                    : `<button class="mini red" data-act="block" data-id="${escapeHtml(u.username)}">حظر</button>`
                }
                ${
                  u.is_admin
                    ? `<button class="mini ghost" data-act="rmAdmin" data-id="${escapeHtml(u.username)}">إلغاء أدمن</button>`
                    : `<button class="mini blue" data-act="mkAdmin" data-id="${escapeHtml(u.username)}">جعله أدمن</button>`
                }
                <button class="mini red" data-act="delete" data-id="${escapeHtml(u.username)}">حذف</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    usersTbody.innerHTML = html || `<tr><td colspan="5" class="mut">لا يوجد نتائج</td></tr>`;
  }

  // ===== refresh =====
  async function refreshAll() {
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "…";
    }
    try {
      const sinceISO = rangeToSince(rangeSel?.value);
      users = await fetchUsers();

      const { totalInvoices } = await countInvoicesForUsers(sinceISO);
      const active = await computeActiveUsers24h(users);

      if (stUsers) stUsers.textContent = String(users.length);
      if (stInvoices) stInvoices.textContent = String(totalInvoices);
      if (stActive) stActive.textContent = String(active);

      renderUsers();
    } catch (e) {
      console.error("refreshAll:", e);
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

  // ===== users actions =====
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

      try {
        if (act === "block") {
          if (!confirm(`حظر ${u.username}؟`)) return;
          await SB.sb.from(SB.tables.users).update({ blocked: true }).eq("id", u.id);
        }
        if (act === "unblock") {
          if (!confirm(`فك حظر ${u.username}؟`)) return;
          await SB.sb.from(SB.tables.users).update({ blocked: false }).eq("id", u.id);
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
        console.error(err);
        alert("فشل العملية");
      }

      await refreshAll();
    });
  }

  // ===== add user modal =====
  if (addUserBtn) addUserBtn.onclick = () => { if (addModalBack) addModalBack.style.display = "flex"; };
  if (closeAddModal) closeAddModal.onclick = () => { if (addModalBack) addModalBack.style.display = "none"; };
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

        if (addUserMsg) addUserMsg.textContent = "تمت الإضافة ✅";
        setTimeout(() => { if (addModalBack) addModalBack.style.display = "none"; }, 700);
        await refreshAll();
      } catch (e) {
        console.error(e);
        if (addUserMsg) addUserMsg.textContent = "فشل: " + (e.message || "خطأ");
      }
    };
  }

  // ===== invoices modal =====
  function closeInvoicesModal() {
    if (invModalBack) invModalBack.style.display = "none";
    currentUserForInvoices = null;
    invoicesForUser = [];
  }
  if (closeInvModal) closeInvModal.onclick = closeInvoicesModal;
  if (invModalBack) invModalBack.onclick = (e) => { if (e.target === invModalBack) closeInvoicesModal(); };

  function openInvoicesModal(user) {
    currentUserForInvoices = user;
    if (invModalTitle) invModalTitle.textContent = `فواتير: ${user.username}`;
    if (invSearch) invSearch.value = "";
    if (invTbody) invTbody.innerHTML = "";
    if (invModalBack) invModalBack.style.display = "flex";
    loadInvoicesForCurrentUser();
  }

  async function loadInvoicesForCurrentUser() {
    if (!currentUserForInvoices) return;

    const sinceISO = rangeToSince(rangeSel?.value);
    let q = SB.sb
      .from(SB.tables.invoices)
      .select("id,created_at,customer_name,total,username,status,closed_at")
      .eq("username", currentUserForInvoices.username)
      .order("created_at", { ascending: false })
      .limit(300);

    if (sinceISO) q = q.gte("created_at", sinceISO);

    const { data, error } = await q;

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
    const filtered = invoicesForUser.filter((inv) => {
      const fields = [inv.customer_name, inv.id, inv.created_at, inv.total];
      return fields.some((f) => String(f || "").toLowerCase().includes(term));
    });

    invTbody.innerHTML =
      filtered
        .map((inv) => {
          const date = inv.created_at ? new Date(inv.created_at).toLocaleString("ar-EG") : "—";
          const cust = inv.customer_name || "—";
          const total = (inv.total ?? "—");
          const code = String(inv.id || "—").slice(-6);

          return `
            <tr>
              <td>${escapeHtml(date)}</td>
              <td>${escapeHtml(cust)}</td>
              <td><b>${escapeHtml(total)}</b></td>
              <td>${escapeHtml(code)}</td>
              <td>
                <button class="mini ghost" data-act="openInv" data-id="${escapeHtml(inv.id)}">فتح</button>
              </td>
            </tr>
          `;
        })
        .join("") || `<tr><td colspan="5" class="mut">لا فواتير</td></tr>`;
  }

  if (invSearch) invSearch.oninput = renderInvoices;
  if (reloadInvBtn) reloadInvBtn.onclick = loadInvoicesForCurrentUser;

  if (invTbody) {
    invTbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      const inv = invoicesForUser.find((x) => String(x.id) === String(id));
      if (!inv) return;

      if (act === "openInv") {
        await openInvoiceOperations(inv);
      }
    });
  }

  // ===== operations modal =====
  function closeOps() {
    if (opsModalBack) opsModalBack.style.display = "none";
    currentInvoice = null;
    currentOps = [];
    if (opsTbody) opsTbody.innerHTML = "";
  }
  if (closeOpsModal) closeOpsModal.onclick = closeOps;
  if (opsModalBack) opsModalBack.onclick = (e) => { if (e.target === opsModalBack) closeOps(); };

  async function openInvoiceOperations(inv) {
    currentInvoice = inv;
    if (opsModalTitle) opsModalTitle.textContent = `عمليات الفاتورة: ${String(inv.id).slice(-6)}`;
    if (opsMeta) {
      opsMeta.innerHTML = `
        <span class="badge">${escapeHtml(inv.username || "")}</span>
        <span class="badge">${escapeHtml(inv.customer_name || "")}</span>
        <span class="badge amber">الإجمالي: ${escapeHtml(inv.total)}</span>
      `;
    }

    if (opsTbody) opsTbody.innerHTML = `<tr><td colspan="5" class="mut">تحميل...</td></tr>`;
    if (opsModalBack) opsModalBack.style.display = "flex";

    const { data, error } = await SB.sb
      .from(SB.tables.operations)
      .select("id,invoice_id,line_no,t,text,expr,result,created_at")
      .eq("invoice_id", inv.id)
      .order("line_no", { ascending: true });

    if (error) {
      console.error(error);
      if (opsTbody) opsTbody.innerHTML = `<tr><td colspan="5">خطأ: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }

    currentOps = data || [];
    renderOps();
  }

  function renderOps() {
    if (!opsTbody) return;

    if (!currentOps.length) {
      opsTbody.innerHTML = `<tr><td colspan="5" class="mut">لا توجد عمليات محفوظة لهذه الفاتورة</td></tr>`;
      return;
    }

    opsTbody.innerHTML = currentOps.map((r, i) => `
      <tr>
        <td>${escapeHtml(String(r.line_no || (i + 1)))}</td>
        <td>${escapeHtml(r.t || "")}</td>
        <td>${escapeHtml(r.text || "")}</td>
        <td>${escapeHtml(r.expr || "")}</td>
        <td><b>${escapeHtml(String(r.result ?? ""))}</b></td>
      </tr>
    `).join("");
  }

  // ===== PDF export =====
  function buildPdfHtml(inv, ops) {
    const rowsHtml = (ops || []).map((r, idx) => `
      <tr>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:8%">${idx + 1}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:14%">${escapeHtml(r.t || "")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:right;width:38%">${escapeHtml(r.text || "")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:20%">${escapeHtml(r.expr || "")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:20%">${escapeHtml(String(r.result ?? ""))}</td>
      </tr>
    `).join("");

    return `
      <div style="direction:rtl;font-family:Arial,system-ui;background:#fff;color:#111;padding:18px;">
        <div style="border:2px solid #111;border-radius:14px;padding:16px;">
          <div style="text-align:center;font-weight:900;font-size:24px;margin-bottom:4px;">شركة الحايك</div>
          <div style="text-align:center;font-weight:900;font-size:18px;color:#0a7c3a;margin-bottom:10px;">HAYEK SPOT</div>

          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;margin-bottom:10px;">
            <div>المستخدم: <b>${escapeHtml(inv.username || "-")}</b></div>
            <div>الزبون: <b>${escapeHtml(inv.customer_name || "-")}</b></div>
            <div>رقم: <b>${escapeHtml(String(inv.id).slice(-6))}</b></div>
            <div>التاريخ: <b>${escapeHtml(new Date(inv.created_at || Date.now()).toLocaleString("ar-EG"))}</b></div>
          </div>

          <div style="border-top:1px solid #111;margin:10px 0;"></div>

          <div style="font-weight:900;margin:6px 0 10px;">جدول العمليات</div>

          <table style="width:100%;border-collapse:collapse;font-size:12px;">
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
              ${rowsHtml || `<tr><td colspan="5" style="border:1px solid #111;padding:14px;text-align:center;color:#666">لا توجد عمليات</td></tr>`}
            </tbody>
          </table>

          <div style="margin-top:12px;border:2px dashed #111;border-radius:12px;padding:10px;display:flex;justify-content:space-between;font-weight:900;">
            <span>إجمالي الكشف:</span>
            <span>${escapeHtml(String(inv.total ?? "0"))}</span>
          </div>

          <div style="margin-top:12px;text-align:center;font-size:11px;line-height:1.8">
            تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك<br/>
            <b>05510217646</b>
          </div>
        </div>
      </div>
    `;
  }

  async function exportPdfCurrentInvoice() {
    if (!currentInvoice) return;
    if (!window.html2canvas) { alert("html2canvas غير محمّلة"); return; }
    if (!window.jspdf || !window.jspdf.jsPDF) { alert("jsPDF غير محمّلة"); return; }

    const html = buildPdfHtml(currentInvoice, currentOps);

    const tmp = document.createElement("div");
    tmp.style.position = "fixed";
    tmp.style.left = "-99999px";
    tmp.style.top = "0";
    tmp.style.width = "794px"; // A4-ish
    tmp.innerHTML = html;
    document.body.appendChild(tmp);

    try {
      const canvas = await window.html2canvas(tmp, { scale: 2, backgroundColor: "#ffffff" });
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

      const name = `فاتورة_${escapeHtml(currentInvoice.username || "user")}_${String(currentInvoice.id).slice(-6)}.pdf`;
      pdf.save(name);
    } catch (e) {
      console.error(e);
      alert("فشل تصدير PDF");
    } finally {
      tmp.remove();
    }
  }

  if (exportPdfBtn) exportPdfBtn.onclick = exportPdfCurrentInvoice;

  // ===== init =====
  refreshAll();
})();
