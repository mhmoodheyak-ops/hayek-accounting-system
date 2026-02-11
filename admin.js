/* HAYEK SPOT — Admin (safe null checks + full table rendering) */
(function () {
  const $ = (id) => document.getElementById(id);

  // UI elements with safe access
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

  const addModalBack = $("addModalBack");
  const closeAddModalBtn = $("closeAddModal");
  const addUserBtn = $("addUserBtn");
  const newUsername = $("newUsername");
  const newPass = $("newPass");
  const newIsAdmin = $("newIsAdmin");
  const saveUserBtn = $("saveUserBtn");
  const addUserMsg = $("addUserMsg");

  const invModalBack = $("invModalBack");
  const closeInvModalBtn = $("closeInvModal");
  const invModalTitle = $("invModalTitle");
  const invSearch = $("invSearch");
  const invTbody = $("invTbody");
  const reloadInvBtn = $("reloadInvBtn");

  // Helpers
  function setOnlineDot() {
    if (onlineDot) {
      const on = navigator.onLine;
      onlineDot.style.background = on ? "#49e39a" : "#ff6b6b";
      onlineDot.style.boxShadow = on ? "0 0 0 6px rgba(73,227,154,.12)" : "0 0 0 6px rgba(255,107,107,.12)";
    }
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
  if (adminInfo) adminInfo.textContent = `أدمن: ${session.username || "—"} — متصل`;

  if (logoutBtn) {
    logoutBtn.onclick = () => {
      window.HAYEK_AUTH.logout();
      location.href = "index.html?v=" + Date.now();
    };
  }

  // Supabase client
  function getSB() {
    const cfg = window.HAYEK_CONFIG || {};
    const supabaseUrl = cfg.supabaseUrl || "";
    const supabaseKey = cfg.supabaseKey || "";

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("config.js ناقص: supabaseUrl أو supabaseKey");
    }

    const sb = supabase.createClient(supabaseUrl, supabaseKey);

    return {
      sb,
      tables: {
        users: cfg.tables?.users || "app_users",
        invoices: cfg.tables?.invoices || "app_invoices",
        operations: cfg.tables?.operations || "app_operations"
      }
    };
  }

  let SB;
  try {
    SB = getSB();
  } catch (e) {
    console.error("خطأ في getSB:", e);
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
    if (!usersTbody) {
      console.warn("usersTbody غير موجود في الصفحة - الجدول لن يظهر");
      return;
    }
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
            <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">${dev}</td>
            <td>
              <div class="actions">
                <button class="mini ghost" data-act="invoices" data-id="${u.username}">الفواتير</button>
                ${u.blocked
                  ? `<button class="mini green" data-act="unblock" data-id="${u.username}">فك حظر</button>`
                  : `<button class="mini red" data-act="block" data-id="${u.username}">حظر</button>`}
                <button class="mini ghost" data-act="resetDevice" data-id="${u.username}">مسح الجهاز</button>
                ${u.is_admin
                  ? `<button class="mini ghost" data-act="rmAdmin" data-id="${u.username}">إلغاء أدمن</button>`
                  : `<button class="mini blue" data-act="mkAdmin" data-id="${u.username}">جعله أدمن</button>`}
                <button class="mini red" data-act="delete" data-id="${u.username}">حذف</button>
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

  // Add user modal
  if (addUserBtn) addUserBtn.onclick = () => { if (addModalBack) addModalBack.style.display = "flex"; };
  if (closeAddModalBtn) closeAddModalBtn.onclick = () => { if (addModalBack) addModalBack.style.display = "none"; };
  if (addModalBack) addModalBack.onclick = (e) => { if (e.target === addModalBack) addModalBack.style.display = "none"; };

  if (saveUserBtn) {
    saveUserBtn.onclick = async () => {
      const username = newUsername?.value.trim();
      const pass = newPass?.value.trim();
      const is_admin = newIsAdmin?.checked;

      if (!username || !pass) {
        if (addUserMsg) addUserMsg.textContent = "املأ الاسم وكلمة السر";
        return;
      }

      try {
        const { error } = await SB.sb.from(SB.tables.users).insert({ username, pass, is_admin, blocked: false });
        if (error) throw error;
        if (addUserMsg) addUserMsg.textContent = "تم الإضافة!";
        setTimeout(() => { if (addModalBack) addModalBack.style.display = "none"; }, 800);
        await refreshAll();
      } catch (e) {
        if (addUserMsg) addUserMsg.textContent = "فشل: " + e.message;
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
      const fields = [inv.customer, inv.customer_name, inv.client, inv.name, inv.invoice_no, inv.code, inv.created_at];
      return fields.some(f => String(f || "").toLowerCase().includes(term));
    });

    invTbody.innerHTML = filtered.map(inv => {
      const date = inv.created_at ? new Date(inv.created_at).toLocaleString() : "—";
      const cust = inv.customer || inv.customer_name || inv.client || inv.name || "—";
      const total = inv.total || inv.grand_total || inv.amount || "—";
      const code = inv.invoice_no || inv.code || inv.id || "—";

      return `
        <tr>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(cust)}</td>
          <td><b>${escapeHtml(total)}</b></td>
          <td>${escapeHtml(code)}</td>
          <td>
            <button class="mini ghost" data-act="viewJson" data-id="${inv.id}">عرض</button>
            <button class="mini blue" data-act="pdf" data-id="${inv.id}">PDF</button>
          </td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="5" class="mut">لا فواتير</td></tr>`;
  }

  if (invSearch) invSearch.oninput = renderInvoices;
  if (reloadInvBtn) reloadInvBtn.onclick = loadInvoicesForCurrentUser;

  if (invTbody) {
    invTbody.addEventListener("click", e => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      const inv = invoicesForUser.find(i => i.id === id);
      if (!inv) return;

      if (act === "viewJson") {
        alert(JSON.stringify(inv, null, 2));
      }

      if (act === "pdf") {
        console.log("بدء PDF:", id);
        try {
          const html = `
            <div style="direction:rtl; font-family:Arial, sans-serif; padding:40px 30px; background:#fff; text-align:right; max-width:794px; margin:0 auto; border:2px solid #0a7c3a; border-radius:14px;">
              <div style="text-align:center; font-weight:900; font-size:32px; color:#071820; margin-bottom:8px;">شركة الحايك</div>
              <div style="text-align:center; font-weight:900; font-size:28px; color:#0a7c3a; margin-bottom:30px;">HAYEK SPOT</div>
              
              <div style="display:flex; justify-content:space-between; gap:20px; flex-wrap:wrap; font-size:15px; margin-bottom:25px; line-height:1.6;">
                <div><b>اسم المستخدم:</b> ${escapeHtml(currentUserForInvoices.username)}</div>
                <div><b>رقم الفاتورة:</b> ${escapeHtml(inv.invoice_no || inv.code || inv.id || "غير متوفر")}</div>
                <div><b>اسم الزبون:</b> ${escapeHtml(inv.customer || inv.customer_name || "غير محدد")}</div>
                <div><b>التاريخ:</b> ${escapeHtml(new Date(inv.created_at).toLocaleString('ar-EG'))}</div>
                <div><b>الحالة:</b> ${escapeHtml(inv.status || "مفتوحة")}</div>
              </div>
              
              <hr style="border:1px solid #0a7c3a; margin:25px 0;">
              
              <div style="font-weight:800; font-size:20px; margin-bottom:15px; color:#071820;">سجل العمليات</div>
              
              <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:30px;">
                <thead>
                  <tr style="background:#f8f9fa;">
                    <th style="border:1px solid #111; padding:12px; text-align:center;">#</th>
                    <th style="border:1px solid #111; padding:12px; text-align:center;">الوقت</th>
                    <th style="border:1px solid #111; padding:12px; text-align:center;">البيان</th>
                    <th style="border:1px solid #111; padding:12px; text-align:center;">العملية</th>
                    <th style="border:1px solid #111; padding:12px; text-align:center;">النتيجة</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colspan="5" style="border:1px solid #111; padding:20px; text-align:center; color:#555; font-style:italic;">
                      لا توجد تفاصيل عمليات محفوظة في هذه الفاتورة
                    </td>
                  </tr>
                </tbody>
              </table>
              
              <div style="margin-top:30px; padding:20px; border:2px dashed #0a7c3a; border-radius:12px; background:#f8fff8; text-align:center; font-weight:900; font-size:22px;">
                إجمالي الكشف: <span style="color:#0a7c3a;">${escapeHtml(inv.total || inv.grand_total || inv.amount || "—")}</span>
              </div>
              
              <div style="margin-top:40px; text-align:center; font-size:13px; line-height:1.8; color:#333;">
                تم تطوير هذه الحاسبة الاحترافية من قبل <b>شركة الحايك</b><br/>
                تجارة عامة - توزيع جملة - دعاية وإعلان - طباعة - حلول رقمية<br/>
                <span style="display:inline-block; margin-top:20px; border:3px solid #0a7c3a; color:#0a7c3a; border-radius:16px; padding:12px 30px; font-weight:900; font-size:20px; background:#e8fff0;">
                  05510217646
                </span>
              </div>
            </div>
          `;

          const tmp = document.createElement("div");
          tmp.innerHTML = html;
          tmp.style.position = "absolute";
          tmp.style.left = "-9999px";
          tmp.style.top = "0";
          tmp.style.width = "794px";
          document.body.appendChild(tmp);

          html2canvas(tmp, { scale: 2, backgroundColor: "#ffffff" }).then(canvas => {
            const imgData = canvas.toDataURL("image/jpeg", 0.95);
            const { jsPDF } = window.jspdf;
            if (!jsPDF) {
              console.error("jsPDF غير متوفر");
              alert("مكتبة PDF غير محملة، تأكد من الإنترنت");
              tmp.remove();
              return;
            }
            const pdf = new jsPDF("p", "pt", "a4");
            pdf.addImage(imgData, "JPEG", 0, 0, pdf.internal.pageSize.getWidth(), canvas.height * (pdf.internal.pageSize.getWidth() / canvas.width));
            pdf.save(`فاتورة_${currentUserForInvoices.username}_${Date.now()}.pdf`);
            tmp.remove();
            console.log("PDF تم إنشاؤه بنجاح");
          }).catch(err => {
            console.error("html2canvas خطأ:", err);
            alert("فشل تحويل الفاتورة إلى صورة");
            tmp.remove();
          });
        } catch (err) {
          console.error("PDF خطأ عام:", err);
          alert("فشل إنشاء PDF");
        }
      }
    });
  }

  // Init - call refreshAll safely
  refreshAll();
})();
