/* admin.js — HAYEK SPOT (Stable) — fixes ops column mismatch + PDF export
   - لا يغير ستايل الصفحة
   - يصلّح 400 Bad Request عبر اكتشاف أعمدة app_operations تلقائياً
*/

(() => {
  const $ = (id) => document.getElementById(id);

  // ========= Auth Guard =========
  function hardLock() {
    // لو عندك overlay في admin.html اسمه lock استعمله، وإلا رجّع لصفحة الدخول
    const lock = $("lock");
    if (lock) lock.style.display = "flex";
    else location.href = "index.html?v=" + Date.now();
  }

  if (!window.HAYEK_AUTH || !window.__HAYEK_AUTH_LOADED__ || !window.HAYEK_AUTH.isAuthed()) {
    hardLock();
    return;
  }
  const session = window.HAYEK_AUTH.getUser() || {};
  if (session.role !== "admin") {
    // ممنوع أدمن لغير الأدمن
    location.href = "invoice.html?v=" + Date.now();
    return;
  }

  // ========= Supabase Init =========
  function getConfig() {
    // دعم HAYEK_CONFIG + APP_CONFIG (توافق)
    const A = window.HAYEK_CONFIG || {};
    const B = window.APP_CONFIG || {};
    return {
      supabaseUrl: A.supabaseUrl || B.SUPABASE_URL,
      supabaseKey: A.supabaseKey || B.SUPABASE_ANON_KEY,
      tables: {
        users: (A.tables && A.tables.users) || B.TABLE_USERS || "app_users",
        invoices: (A.tables && A.tables.invoices) || B.TABLE_INVOICES || "app_invoices",
        operations: (A.tables && A.tables.operations) || B.TABLE_OPERATIONS || "app_operations",
      },
    };
  }

  const CFG = getConfig();
  if (!window.supabase || !CFG.supabaseUrl || !CFG.supabaseKey) {
    console.error("Supabase/config missing");
    alert("Supabase جاهز؟ تأكد من تحميل config.js");
    return;
  }

  const SB = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
  const T_USERS = CFG.tables.users;
  const T_INV = CFG.tables.invoices;
  const T_OPS = CFG.tables.operations;

  // ========= UI refs (لا نعتمد على ستايل، فقط على IDs إن كانت موجودة) =========
  // أزرار/عناصر شائعة عندك (لو بعضهم غير موجود لا مشكلة)
  const btnRefresh = $("refreshBtn") || $("btnRefresh") || $("reloadBtn");
  const btnLogout = $("logoutBtn") || $("btnLogout");
  const adminName = $("adminName");
  if (adminName) adminName.textContent = session.username || "admin";

  if (btnLogout) {
    btnLogout.onclick = () => {
      window.HAYEK_AUTH.logout();
      location.href = "index.html?v=" + Date.now();
    };
  }

  // ========= Helpers =========
  function nowIso() { return new Date().toISOString(); }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDT(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    // نفس شكل شاشتك تقريباً
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  }

  function timeAgo(iso) {
    if (!iso) return "—";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "—";
    const diff = Date.now() - t;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "الآن";
    if (m < 60) return `منذ ${m} دق`;
    const h = Math.floor(m / 60);
    if (h < 24) return `منذ ${h} س`;
    const d = Math.floor(h / 24);
    return `منذ ${d} يوم`;
  }

  // ========= Detect Operations Schema =========
  // الهدف: نعرف اسم عمود ربط الفاتورة + عمود النص + عمود العملية + عمود النتيجة + عمود التاريخ
  let OPS_KEYS = null;

  async function detectOpsKeys() {
    if (OPS_KEYS) return OPS_KEYS;

    // جرّب نجيب صف واحد فقط (حتى لو الجدول فاضي، نعمل fallback)
    try {
      const { data, error } = await SB.from(T_OPS).select("*").limit(1);
      if (!error && Array.isArray(data) && data[0]) {
        const k = Object.keys(data[0]);

        const pick = (...names) => names.find(n => k.includes(n)) || null;

        OPS_KEYS = {
          invoiceKey: pick("invoiceId", "invoice_id", "invoiceID", "invoice", "invoiceid"),
          textKey: pick("text", "note", "item", "line_text", "statement", "desc", "description", "title"),
          exprKey: pick("expr", "equation", "operation", "op", "calc"),
          resultKey: pick("result", "value", "amount", "total", "res"),
          createdKey: pick("created_at", "createdAt", "time", "ts", "date"),
          usernameKey: pick("username", "user", "owner"),
          deviceKey: pick("device_id", "deviceId"),
        };
        return OPS_KEYS;
      }
    } catch (e) {
      console.warn("detectOpsKeys failed:", e?.message || e);
    }

    // fallback (حسب كود invoice.html عندك)
    OPS_KEYS = {
      invoiceKey: "invoiceId",
      textKey: "text",
      exprKey: "expr",
      resultKey: "result",
      createdKey: "created_at",
      usernameKey: "username",
      deviceKey: "device_id",
    };
    return OPS_KEYS;
  }

  // ========= Fetch Data =========
  async function fetchUsers() {
    const { data, error } = await SB
      .from(T_USERS)
      .select("id,username,is_admin,blocked,created_at,device_id,last_seen")
      .order("username", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function fetchInvoices({ username = null, fromIso = null, toIso = null, preset = null } = {}) {
    // preset: "today" | "7d" | "all"
    let q = SB.from(T_INV).select("*").order("created_at", { ascending: false });

    if (username && username !== "ALL") q = q.eq("username", username);

    // إن كان عندك أزرار 1 يوم / 7 أيام / الكل
    if (preset === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      q = q.gte("created_at", d.toISOString());
    } else if (preset === "7d") {
      const d = new Date(Date.now() - 7 * 864e5);
      q = q.gte("created_at", d.toISOString());
    } else if (fromIso) {
      q = q.gte("created_at", fromIso);
    }
    if (toIso) q = q.lte("created_at", toIso);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function fetchOpsForInvoice(invoiceId) {
    const keys = await detectOpsKeys();
    const invKey = keys.invoiceKey;

    // إذا المفتاح غير موجود بالجدول، نرجّع فاضي بدون ما نكسر الصفحة
    if (!invKey) return [];

    let q = SB.from(T_OPS).select("*").eq(invKey, invoiceId).order(keys.createdKey || "created_at", { ascending: true });

    const { data, error } = await q;
    if (error) {
      // لا نكسر الواجهة
      console.warn("fetchOpsForInvoice error:", error);
      return [];
    }
    return data || [];
  }

  // ========= Render (لا تغيّر ستايل: فقط املأ tbody الموجود) =========
  const usersBody = $("usersBody") || $("usersTbody") || $("usersTBody");
  const invBody = $("invBody") || $("invoicesBody") || $("invTbody") || $("invoicesTbody");
  const opsBody = $("opsBody") || $("opsTbody") || $("opsTableBody"); // مودال العمليات إن وجد

  const kUsers = $("kUsers");
  const kInvCount = $("kInvCount") || $("kCount");
  const kInvTotal = $("kInvTotal") || $("kTotal");

  let CACHE_USERS = [];
  let CACHE_INVS = [];
  let CURRENT_INV = null;

  function renderUsers(users) {
    if (!usersBody) return;

    // ملاحظة: عمود عداد الفواتير إن كان عندك مكانه بالجدول رح نملأه
    // نحسب عدد الفواتير لكل مستخدم من CACHE_INVS (إن كانت محمّلة)
    const invCountMap = new Map();
    for (const inv of CACHE_INVS) {
      invCountMap.set(inv.username, (invCountMap.get(inv.username) || 0) + 1);
    }

    usersBody.innerHTML = users.map(u => {
      const count = invCountMap.get(u.username) || 0;
      const isAdmin = !!u.is_admin;
      const blocked = !!u.blocked;

      // لو أزرارك هي نفسها: delete/ban/unban/clearDevice/makeAdmin … الخ
      // نحن نضع data- attributes لتلتقطها listeners بدون ستايل
      return `
        <tr>
          <td>${escapeHtml(u.username)}</td>
          <td>${count}</td>
          <td>${blocked ? "محظور" : "نشط"} (${timeAgo(u.last_seen)})</td>
          <td>
            <button class="btn" data-act="inv" data-user="${escapeHtml(u.username)}">الفواتير</button>
            <button class="btn" data-act="clearDevice" data-id="${u.id}">مسح الجهاز</button>
            <button class="btn" data-act="toggleBlock" data-id="${u.id}" data-blocked="${blocked ? "1" : "0"}">
              ${blocked ? "فك" : "حظر"}
            </button>
            <button class="btn" data-act="deleteUser" data-id="${u.id}">حذف</button>
            <button class="btn" data-act="toggleAdmin" data-id="${u.id}" data-admin="${isAdmin ? "1" : "0"}">
              ${isAdmin ? "جعله مستخدم" : "جعله أدمن"}
            </button>
          </td>
        </tr>
      `;
    }).join("");

    if (kUsers) kUsers.textContent = String(users.length);
  }

  function renderInvoices(invs) {
    if (!invBody) return;

    const totalSum = invs.reduce((a, x) => a + Number(x.total || 0), 0);

    invBody.innerHTML = invs.map(inv => {
      const idShort = String(inv.id).slice(-6);
      const st = String(inv.status || "open");
      return `
        <tr>
          <td>${fmtDT(inv.created_at)}</td>
          <td>${escapeHtml(inv.username || "-")}</td>
          <td>${escapeHtml(inv.customer_name || "-")}</td>
          <td>${escapeHtml(String(inv.total || 0))}</td>
          <td>${escapeHtml(st)}</td>
          <td>${escapeHtml(idShort)}</td>
          <td>
            <button class="btn" data-act="viewInv" data-id="${inv.id}">عرض</button>
            <button class="btn" data-act="ops" data-id="${inv.id}">العمليات</button>
            <button class="btn" data-act="pdf" data-id="${inv.id}">PDF</button>
          </td>
        </tr>
      `;
    }).join("");

    if (kInvCount) kInvCount.textContent = String(invs.length);
    if (kInvTotal) kInvTotal.textContent = String(Math.round(totalSum));
  }

  function renderOpsTable(ops) {
    if (!opsBody) return;
    // استعمل الأعمدة الفعلية
    const keys = OPS_KEYS || {};
    const textK = keys.textKey || "text";
    const exprK = keys.exprKey || "expr";
    const resK = keys.resultKey || "result";
    const timeK = keys.createdKey || "created_at";

    opsBody.innerHTML = ops.map((o, i) => {
      const t = o[timeK] ? fmtDT(o[timeK]) : (o.t || "—");
      const text = o[textK] ?? o.note ?? o.item ?? "—";
      const expr = o[exprK] ?? "—";
      const res = o[resK] ?? "—";
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(t)}</td>
          <td>${escapeHtml(text)}</td>
          <td>${escapeHtml(expr)}</td>
          <td>${escapeHtml(String(res))}</td>
        </tr>
      `;
    }).join("");
  }

  // ========= Actions (Users) =========
  async function toggleBlock(userId, currentlyBlocked) {
    await SB.from(T_USERS).update({ blocked: !currentlyBlocked }).eq("id", userId);
  }
  async function clearDevice(userId) {
    await SB.from(T_USERS).update({ device_id: null }).eq("id", userId);
  }
  async function deleteUser(userId) {
    await SB.from(T_USERS).delete().eq("id", userId);
  }
  async function toggleAdmin(userId, currentlyAdmin) {
    await SB.from(T_USERS).update({ is_admin: !currentlyAdmin }).eq("id", userId);
  }

  // ========= PDF Export for Invoice (Admin) =========
  // يعتمد على html2canvas + jsPDF (نفس طريقة المستخدم)
  async function exportInvoicePDF(inv) {
    if (!inv) return;

    // اجلب العمليات من السيرفر (حتى لو المستخدم PDF عنده مشكل)
    const ops = await fetchOpsForInvoice(inv.id);
    const keys = await detectOpsKeys();
    const textK = keys.textKey || "text";
    const exprK = keys.exprKey || "expr";
    const resK = keys.resultKey || "result";
    const timeK = keys.createdKey || "created_at";

    const rowsHtml = (ops || []).map((o, i) => {
      const t = o[timeK] ? fmtDT(o[timeK]) : (o.t || "—");
      const text = o[textK] ?? o.note ?? o.item ?? "—";
      const expr = o[exprK] ?? "—";
      const res = o[resK] ?? "—";
      return `
        <tr>
          <td style="border:1px solid #111;padding:8px;text-align:center;width:8%">${i + 1}</td>
          <td style="border:1px solid #111;padding:8px;text-align:center;width:18%">${escapeHtml(t)}</td>
          <td style="border:1px solid #111;padding:8px;text-align:right;width:34%">${escapeHtml(text)}</td>
          <td style="border:1px solid #111;padding:8px;text-align:center;width:20%">${escapeHtml(expr)}</td>
          <td style="border:1px solid #111;padding:8px;text-align:center;width:20%;font-weight:900">${escapeHtml(String(res))}</td>
        </tr>
      `;
    }).join("");

    const invNo = String(inv.id || "").slice(-6);
    const total = Number(inv.total || 0);

    const html = `
      <div style="direction:rtl;font-family:Arial,system-ui;background:#fff;color:#111;padding:18px;">
        <div style="border:2px solid #111;border-radius:14px;padding:16px;">
          <div style="text-align:center;font-weight:900;font-size:24px;margin-bottom:4px;">شركة الحايك</div>
          <div style="text-align:center;font-weight:900;font-size:20px;color:#0a7c3a;margin-bottom:10px;">HAYEK SPOT</div>

          <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;margin-bottom:10px;flex-wrap:wrap">
            <div>اسم الزبون: <b>${escapeHtml(inv.customer_name || "-")}</b></div>
            <div>اسم المستخدم: <b>${escapeHtml(inv.username || "-")}</b></div>
            <div>رقم الفاتورة: <b>${escapeHtml(invNo)}</b></div>
            <div>التاريخ: <b>${escapeHtml(fmtDT(inv.created_at))}</b></div>
          </div>

          <div style="border-top:1px solid #111;margin:10px 0"></div>
          <div style="font-weight:900;margin:6px 0 10px;">تفاصيل العمليات</div>

          <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff">
            <thead>
              <tr style="background:#f3f3f3">
                <th style="border:1px solid #111;padding:8px;text-align:center;">#</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">الوقت</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">البيان</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">العملية</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">النتيجة</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="5" style="border:1px solid #111;padding:14px;text-align:center;color:#666">لا يوجد عمليات</td></tr>`}
            </tbody>
          </table>

          <div style="margin-top:12px;border:2px dashed #111;border-radius:12px;padding:10px;display:flex;justify-content:space-between;font-weight:900">
            <span>إجمالي الكشف:</span>
            <span>${escapeHtml(String(total))}</span>
          </div>

          <div style="margin-top:12px;border:2px solid #111;border-radius:14px;padding:12px;text-align:center;font-size:12px;line-height:1.8">
            تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك<br/>
            <span style="display:inline-block;margin-top:8px;border:2px solid #0a7c3a;color:#0a7c3a;border-radius:12px;padding:8px 16px;font-weight:900;font-size:16px;">05510217646</span>
          </div>
        </div>
      </div>
    `;

    // نحتاج html2canvas + jsPDF موجودين داخل admin.html
    if (!window.html2canvas || !window.jspdf) {
      alert("مكتبات PDF غير محمّلة داخل admin.html");
      return;
    }

    const stage = document.createElement("div");
    stage.style.position = "fixed";
    stage.style.left = "-99999px";
    stage.style.top = "0";
    stage.style.width = "794px"; // A4 تقريباً
    stage.innerHTML = html;
    document.body.appendChild(stage);

    const canvas = await window.html2canvas(stage, { scale: 2, backgroundColor: "#ffffff" });
    stage.remove();

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
      if (remaining > 0) { pdf.addPage(); y -= pageH; }
    }

    const cust = (inv.customer_name || "invoice").trim().replace(/\s+/g, "_");
    pdf.save(`HAYEK_${cust}_${invNo}.pdf`);
  }

  // ========= Bind Table Clicks =========
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    if (!act) return;

    try {
      // Users actions
      if (act === "toggleBlock") {
        const id = Number(btn.getAttribute("data-id"));
        const blocked = btn.getAttribute("data-blocked") === "1";
        if (confirm(blocked ? "فك الحظر؟" : "حظر المستخدم؟")) {
          await toggleBlock(id, blocked);
          await fullRefresh();
        }
      }

      if (act === "clearDevice") {
        const id = Number(btn.getAttribute("data-id"));
        if (confirm("مسح ربط الجهاز لهذا المستخدم؟")) {
          await clearDevice(id);
          await fullRefresh();
        }
      }

      if (act === "deleteUser") {
        const id = Number(btn.getAttribute("data-id"));
        if (confirm("حذف المستخدم نهائياً؟")) {
          await deleteUser(id);
          await fullRefresh();
        }
      }

      if (act === "toggleAdmin") {
        const id = Number(btn.getAttribute("data-id"));
        const isAdmin = btn.getAttribute("data-admin") === "1";
        if (confirm(isAdmin ? "تحويله لمستخدم عادي؟" : "تحويله لأدمن؟")) {
          await toggleAdmin(id, isAdmin);
          await fullRefresh();
        }
      }

      if (act === "inv") {
        const username = btn.getAttribute("data-user");
        // إذا عندك select مستخدمين بالفلترة، عبيه
        const sel = $("userFilter") || $("usersFilter") || $("selUser");
        if (sel) {
          sel.value = username;
        }
        // جرّب زر عرض الفواتير إن وجد
        const showBtn = $("showInvBtn") || $("btnShowInv") || $("viewInvoicesBtn");
        if (showBtn) showBtn.click();
        else {
          CACHE_INVS = await fetchInvoices({ username });
          renderInvoices(CACHE_INVS);
        }
      }

      // Invoices actions
      if (act === "viewInv") {
        const id = btn.getAttribute("data-id");
        CURRENT_INV = CACHE_INVS.find(x => String(x.id) === String(id)) || null;
        // إذا عندك لوحة تفاصيل (id مثل dInvId/dUser/dCust/dTotal/dStatus)
        if (CURRENT_INV) {
          const dInvId = $("dInvId"); if (dInvId) dInvId.textContent = String(CURRENT_INV.id).slice(-6);
          const dUser  = $("dUser");  if (dUser)  dUser.textContent  = CURRENT_INV.username || "-";
          const dCust  = $("dCust");  if (dCust)  dCust.textContent  = CURRENT_INV.customer_name || "-";
          const dTotal = $("dTotal"); if (dTotal) dTotal.textContent = String(CURRENT_INV.total || 0);
          const dStatus= $("dStatus");if (dStatus)dStatus.textContent= CURRENT_INV.status || "-";
        }
      }

      if (act === "ops") {
        const id = btn.getAttribute("data-id");
        const ops = await fetchOpsForInvoice(id);
        renderOpsTable(ops);
        // إذا عندك مودال للعمليات افتحه
        const m = $("opsModal") || $("modalOps");
        if (m) m.style.display = "block";
      }

      if (act === "pdf") {
        const id = btn.getAttribute("data-id");
        const inv = CACHE_INVS.find(x => String(x.id) === String(id));
        if (!inv) return alert("الفاتورة غير موجودة في القائمة");
        await exportInvoicePDF(inv);
      }
    } catch (err) {
      console.error("Action error:", err);
      alert("حدث خطأ: " + (err?.message || "غير معروف"));
    }
  });

  // ========= Filters (إن وُجدت) =========
  const selUser = $("userFilter") || $("usersFilter") || $("selUser");
  const dateFrom = $("dateFrom") || $("fromDate");
  const dateTo = $("dateTo") || $("toDate");
  const btnToday = $("btnToday") || $("todayBtn");
  const btn7d = $("btn7d") || $("weekBtn");
  const btnAll = $("btnAll") || $("allBtn");
  const btnShowInv = $("showInvBtn") || $("btnShowInv") || $("viewInvoicesBtn");

  if (btnShowInv) {
    btnShowInv.onclick = async () => {
      const u = selUser ? selUser.value : null;

      // لو عندك preset buttons (1 يوم / 7 أيام / الكل) فهي تتحكم بالمتحول
      const preset = btnShowInv.getAttribute("data-preset") || null;

      let fromIso = null;
      let toIso = null;
      if (dateFrom && dateFrom.value) fromIso = new Date(dateFrom.value + "T00:00:00").toISOString();
      if (dateTo && dateTo.value) toIso = new Date(dateTo.value + "T23:59:59").toISOString();

      CACHE_INVS = await fetchInvoices({ username: u, fromIso, toIso, preset });
      renderInvoices(CACHE_INVS);
    };
  }

  if (btnToday && btnShowInv) btnToday.onclick = () => { btnShowInv.setAttribute("data-preset", "today"); btnShowInv.click(); };
  if (btn7d && btnShowInv) btn7d.onclick = () => { btnShowInv.setAttribute("data-preset", "7d"); btnShowInv.click(); };
  if (btnAll && btnShowInv) btnAll.onclick = () => { btnShowInv.setAttribute("data-preset", "all"); btnShowInv.click(); };

  // ========= Full Refresh =========
  async function fullRefresh() {
    // touch admin last_seen (اختياري)
    try { await SB.from(T_USERS).update({ last_seen: nowIso() }).eq("username", session.username); } catch {}

    // 1) users
    CACHE_USERS = await fetchUsers();

    // عبّي dropdown إن وجد
    if (selUser) {
      const cur = selUser.value;
      selUser.innerHTML = `<option value="ALL">كل المستخدمين</option>` + CACHE_USERS
        .filter(u => !u.is_admin)
        .map(u => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.username)}</option>`)
        .join("");
      if (cur) selUser.value = cur;
    }

    // 2) invoices (افتراضي الكل أو حسب الفلاتر الموجودة)
    const chosenUser = selUser ? selUser.value : null;
    CACHE_INVS = await fetchInvoices({ username: chosenUser && chosenUser !== "ALL" ? chosenUser : null, preset: "all" });

    // render
    renderInvoices(CACHE_INVS);
    renderUsers(CACHE_USERS);

    // detect ops keys once (حتى تختفي أخطاء 400)
    await detectOpsKeys();
  }

  if (btnRefresh) btnRefresh.onclick = () => fullRefresh();

  // ========= Close ops modal if exists =========
  const opsClose = $("opsClose") || $("closeOpsModal");
  if (opsClose) opsClose.onclick = () => {
    const m = $("opsModal") || $("modalOps");
    if (m) m.style.display = "none";
  };

  // Start
  fullRefresh().catch((e) => {
    console.error("Init error:", e);
    alert("فشل تحميل بيانات الأدمن: " + (e?.message || "غير معروف"));
  });

})();
