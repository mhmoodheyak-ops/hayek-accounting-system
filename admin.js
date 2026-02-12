(() => {
  const $ = (id) => document.getElementById(id);

  // عناصر الصفحة
  const lock = $("lock");
  const goLogin = $("goLogin");
  const onlineDot = $("onlineDot");
  const logoutBtn = $("logoutBtn");
  const addUserBtn = $("addUserBtn");
  const refreshBtn = $("refreshBtn");
  const searchUser = $("searchUser");
  const rangeSel = $("range");

  const stUsers = $("stUsers");
  const stInvoices = $("stInvoices");
  const stActive = $("stActive");
  const usersTbody = $("usersTbody");

  // مودال إضافة مستخدم
  const addModalBack = $("addModalBack");
  const closeAddModal = $("closeAddModal");
  const newUsername = $("newUsername");
  const newPass = $("newPass");
  const newIsAdmin = $("newIsAdmin");
  const saveUserBtn = $("saveUserBtn");
  const addUserMsg = $("addUserMsg");

  // مودال الفواتير
  const invModalBack = $("invModalBack");
  const closeInvModal = $("closeInvModal");
  const invModalTitle = $("invModalTitle");
  const invSearch = $("invSearch");
  const reloadInvBtn = $("reloadInvBtn");
  const invTbody = $("invTbody");

  // ====== أدوات مساعدة ======
  const jparse = (s, f) => { try { return JSON.parse(s) ?? f; } catch { return f; } };
  const escapeHtml = (s) => String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  function refreshOnline(){
    const ok = navigator.onLine;
    if (!onlineDot) return;
    onlineDot.style.background = ok ? "#49e39a" : "#ffb1b1";
    onlineDot.style.boxShadow = ok ? "0 0 0 6px rgba(73,227,154,.12)" : "0 0 0 6px rgba(255,107,107,.12)";
  }
  window.addEventListener("online", refreshOnline);
  window.addEventListener("offline", refreshOnline);
  refreshOnline();

  // ====== AUTH Gate ======
  $("goLogin").onclick = () => location.href = "index.html?v=" + Date.now();

  if (!window.HAYEK_AUTH || !window.__HAYEK_AUTH_LOADED__ || !window.HAYEK_AUTH.isAuthed()) {
    lock.style.display = "flex";
    return;
  }

  const session = window.HAYEK_AUTH.getUser() || {};
  if (session.role !== "admin") {
    // لو دخل مستخدم عادي بالغلط
    location.href = "invoice.html?v=" + Date.now();
    return;
  }

  // افتح الصفحة للأدمن
  lock.style.display = "none";

  // Logout
  logoutBtn.onclick = () => {
    window.HAYEK_AUTH.logout();
    location.href = "index.html?v=" + Date.now();
  };

  // ====== Supabase Client ======
  function getSB(){
    const cfg = window.APP_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return null;
    if (!window.supabase) return null;
    return window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  // أسماء الجداول (من config.js إن وُجدت)
  const CFG = window.APP_CONFIG || {};
  const T_USERS    = CFG.TABLE_USERS || "app_users";
  const T_INVOICES = CFG.TABLE_INVOICES || "app_invoices";
  const T_OPS      = CFG.TABLE_OPERATIONS || "app_operations";

  // ====== State ======
  let USERS = [];
  let CURRENT_INV_USER = null;   // username
  let CURRENT_INV_ROWS = [];     // invoices list for that username (cached)

  // ====== Helpers: time window filter ======
  function dateFromRange(range){
    const now = new Date();
    if (range === "today") {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    }
    if (range === "7d") {
      const d = new Date(now.getTime() - 7*24*60*60*1000);
      return d.toISOString();
    }
    if (range === "30d") {
      const d = new Date(now.getTime() - 30*24*60*60*1000);
      return d.toISOString();
    }
    return null;
  }

  // ====== UI: Modals ======
  function openAddModal(){
    addUserMsg.textContent = "";
    newUsername.value = "";
    newPass.value = "";
    newIsAdmin.checked = false;
    addModalBack.style.display = "flex";
  }
  function closeAdd(){
    addModalBack.style.display = "none";
  }

  function openInvModal(username){
    CURRENT_INV_USER = username;
    invModalTitle.textContent = `فواتير المستخدم: ${username}`;
    invSearch.value = "";
    invTbody.innerHTML = "";
    invModalBack.style.display = "flex";
    loadInvoicesForUser(username);
  }
  function closeInv(){
    invModalBack.style.display = "none";
  }

  addUserBtn.onclick = openAddModal;
  closeAddModal.onclick = closeAdd;
  closeInvModal.onclick = closeInv;

  // اغلاق مودال عند ضغط خلفية (اختياري)
  addModalBack.addEventListener("click", (e) => {
    if (e.target === addModalBack) closeAdd();
  });
  invModalBack.addEventListener("click", (e) => {
    if (e.target === invModalBack) closeInv();
  });

  // ====== إضافة مستخدم ======
  async function addUser(){
    const sb = getSB();
    if (!sb) { addUserMsg.textContent = "Supabase غير جاهز"; return; }

    const u = (newUsername.value || "").trim();
    const p = (newPass.value || "").trim();
    const role = newIsAdmin.checked ? "admin" : "user";

    if (!u || !p) { addUserMsg.textContent = "أدخل اسم المستخدم وكلمة السر"; return; }

    addUserMsg.textContent = "جارٍ الحفظ...";
    try{
      // نخزن كلمة المرور كـ hash بسيط؟ (حالياً مشروعك يستخدم auth.js محلي/سوبابيس)
      // نحن نضعها كما يعتمد مشروعك (عادة: password plain أو hash حسب auth.js)
      // إن كان auth.js عندك يستخدم password مباشرةً، هذا مناسب.
      const payload = {
        username: u,
        password: p,
        role,
        status: "active",
        device_id: null,
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const { error } = await sb.from(T_USERS).insert([payload]);
      if (error) {
        addUserMsg.textContent = "فشل الحفظ: " + (error.message || "");
        return;
      }
      addUserMsg.textContent = "تم إضافة المستخدم ✅";
      await loadAll();
      setTimeout(closeAdd, 500);
    }catch{
      addUserMsg.textContent = "فشل غير متوقع";
    }
  }
  saveUserBtn.onclick = addUser;

  // ====== تحميل المستخدمين ======
  async function loadUsers(){
    const sb = getSB();
    if (!sb) return [];

    const since = dateFromRange(rangeSel.value);

    // نجيب كل المستخدمين
    let q = sb.from(T_USERS).select("*").order("created_at", { ascending:false });

    // فلتر زمني حسب last_seen إذا موجود
    if (since) q = q.gte("last_seen", since);

    const { data, error } = await q;
    if (error) return [];
    return Array.isArray(data) ? data : [];
  }

  async function countInvoices(){
    const sb = getSB();
    if (!sb) return 0;

    const since = dateFromRange(rangeSel.value);

    let q = sb.from(T_INVOICES).select("id", { count:"exact", head:true });
    if (since) q = q.gte("closed_at", since);

    const { count } = await q;
    return Number(count || 0);
  }

  function calcActive24(users){
    const now = Date.now();
    const day = 24*60*60*1000;
    return (users || []).filter(u => {
      const t = u.last_seen ? Date.parse(u.last_seen) : 0;
      return t && (now - t) <= day;
    }).length;
  }

  // ====== Render Users Table ======
  function statusBadge(u){
    const st = (u.status || "active").toLowerCase();
    if (st === "blocked") return `<span class="badge red">محظور</span>`;
    return `<span class="badge green">نشط</span>`;
  }
  function roleBadge(u){
    const r = (u.role || "user").toLowerCase();
    if (r === "admin") return `<span class="badge amber">أدمن</span>`;
    return `<span class="badge blue">مستخدم</span>`;
  }

  function fmtLastSeen(u){
    const v = u.last_seen || u.updated_at || u.created_at;
    if (!v) return "—";
    try{
      const d = new Date(v);
      return d.toLocaleString();
    }catch{
      return "—";
    }
  }

  function renderUsersTable(){
    const q = (searchUser.value || "").trim().toLowerCase();

    const list = USERS.filter(u => {
      if (!q) return true;
      return String(u.username || "").toLowerCase().includes(q);
    });

    usersTbody.innerHTML = list.map(u => {
      const uname = escapeHtml(u.username || "");
      const device = escapeHtml(u.device_id || "—");

      return `
        <tr>
          <td><b>${uname}</b></td>
          <td>${roleBadge(u)}</td>
          <td>${statusBadge(u)}</td>
          <td>
            <div class="actions">
              <button class="mini blue" data-act="invoices" data-user="${uname}">الفواتير</button>
            </div>
          </td>
          <td>${escapeHtml(fmtLastSeen(u))}</td>
          <td>${device}</td>
          <td>
            <div class="actions">
              <button class="mini green" data-act="unblock" data-user="${uname}">فك</button>
              <button class="mini red" data-act="block" data-user="${uname}">حظر</button>
              <button class="mini ghost" data-act="delete" data-user="${uname}">حذف</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  // ====== Actions: block/unblock/delete ======
  async function setUserStatus(username, status){
    const sb = getSB();
    if (!sb) return false;
    try{
      const { error } = await sb.from(T_USERS).update({ status }).eq("username", username);
      return !error;
    }catch{
      return false;
    }
  }
  async function deleteUser(username){
    const sb = getSB();
    if (!sb) return false;
    try{
      const { error } = await sb.from(T_USERS).delete().eq("username", username);
      return !error;
    }catch{
      return false;
    }
  }

  usersTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    const user = btn.getAttribute("data-user");
    if (!act || !user) return;

    if (act === "invoices") {
      openInvModal(user);
      return;
    }
    if (act === "block") {
      await setUserStatus(user, "blocked");
      await loadAll();
      return;
    }
    if (act === "unblock") {
      await setUserStatus(user, "active");
      await loadAll();
      return;
    }
    if (act === "delete") {
      // حذف صامت (بدون confirm) حسب طلبك، لكن إذا بتحب نضيف تأكيد لاحقاً
      await deleteUser(user);
      await loadAll();
      return;
    }
  });

  searchUser.addEventListener("input", renderUsersTable);

  // ====== Invoices: load + render ======
  async function loadInvoicesForUser(username){
    const sb = getSB();
    if (!sb) return;

    invTbody.innerHTML = `<tr><td colspan="5" style="color:#b9cde0;padding:14px">جارٍ التحميل...</td></tr>`;

    try{
      let q = sb
        .from(T_INVOICES)
        .select("*")
        .eq("username", username)
        .order("closed_at", { ascending:false });

      const since = dateFromRange(rangeSel.value);
      if (since) q = q.gte("closed_at", since);

      const { data, error } = await q;
      if (error) {
        invTbody.innerHTML = `<tr><td colspan="5" style="color:#ffb1b1;padding:14px">خطأ تحميل الفواتير</td></tr>`;
        return;
      }

      CURRENT_INV_ROWS = Array.isArray(data) ? data : [];
      renderInvoicesTable();
    }catch{
      invTbody.innerHTML = `<tr><td colspan="5" style="color:#ffb1b1;padding:14px">خطأ غير متوقع</td></tr>`;
    }
  }

  function renderInvoicesTable(){
    const q = (invSearch.value || "").trim().toLowerCase();
    const list = (CURRENT_INV_ROWS || []).filter(inv => {
      if (!q) return true;
      return (
        String(inv.customer_name || "").toLowerCase().includes(q) ||
        String(inv.id || "").toLowerCase().includes(q) ||
        String(inv.total || "").toLowerCase().includes(q)
      );
    });

    if (!list.length){
      invTbody.innerHTML = `<tr><td colspan="5" style="color:#b9cde0;padding:14px">لا يوجد فواتير</td></tr>`;
      return;
    }

    invTbody.innerHTML = list.map(inv => {
      const date = inv.closed_at || inv.created_at || "";
      const dTxt = date ? (()=>{ try{return new Date(date).toLocaleString();}catch{return "—";} })() : "—";
      const cust = escapeHtml(inv.customer_name || "—");
      const total = escapeHtml(String(inv.total ?? 0));
      const id6 = escapeHtml(String(inv.id || "").slice(-6) || "—");
      const fullId = escapeHtml(String(inv.id || ""));

      return `
        <tr>
          <td>${escapeHtml(dTxt)}</td>
          <td><b>${cust}</b></td>
          <td>${total}</td>
          <td title="${fullId}">${id6}</td>
          <td>
            <div class="actions">
              <button class="mini blue" data-inv="open" data-id="${fullId}">فتح</button>
              <button class="mini green" data-inv="pdf" data-id="${fullId}">تصدير PDF</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  invSearch.addEventListener("input", renderInvoicesTable);
  reloadInvBtn.addEventListener("click", () => {
    if (CURRENT_INV_USER) loadInvoicesForUser(CURRENT_INV_USER);
  });

  // ====== Invoice action click ======
  invTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const act = btn.getAttribute("data-inv");
    const id = btn.getAttribute("data-id");
    if (!act || !id) return;

    const inv = (CURRENT_INV_ROWS || []).find(x => String(x.id) === String(id));
    if (!inv) return;

    if (act === "open") {
      // فتح الفاتورة = عرض العمليات ضمن نافذة بسيطة
      await openInvoiceDetails(inv);
      return;
    }

    if (act === "pdf") {
      await exportInvoicePdf(inv);
      return;
    }
  });

  // ====== Open invoice details (operations) ======
  async function fetchOpsForInvoice(invoiceId){
    const sb = getSB();
    if (!sb) return [];

    // نحاول أعمدة متعددة لأنك قد تكون غيرت أسماء الأعمدة
    // (في invoice.html النسخة الجديدة: invoice_id)
    try{
      // أولاً: invoice_id
      let { data, error } = await sb
        .from(T_OPS)
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("line_no", { ascending:true });

      if (!error && Array.isArray(data) && data.length) return data;

      // ثانياً: invoiceId
      ({ data, error } = await sb
        .from(T_OPS)
        .select("*")
        .eq("invoiceId", invoiceId)
        .order("line_no", { ascending:true }));
      if (!error && Array.isArray(data) && data.length) return data;

      // ثالثاً: invoice (احتياط)
      ({ data, error } = await sb
        .from(T_OPS)
        .select("*")
        .eq("invoice", invoiceId));
      if (!error && Array.isArray(data) && data.length) return data;

      return [];
    }catch{
      return [];
    }
  }

  async function openInvoiceDetails(inv){
    // نفتح Modal الفواتير نفسه ونبدّل الجدول إلى "تفاصيل" بشكل مبسّط
    const ops = await fetchOpsForInvoice(inv.id);

    // إن ما في عمليات (لأن بعض الفواتير القديمة ما رفعت ops)، نعرض ملخص
    const rows = Array.isArray(ops) ? ops : [];
    const dTxt = (()=>{ try{return new Date(inv.closed_at || inv.created_at).toLocaleString();}catch{return "—";} })();

    invModalTitle.textContent = `تفاصيل فاتورة: ${String(inv.id).slice(-6)} — ${inv.customer_name || ""}`;

    const backBtn = `<button class="btn" id="backToInvList">رجوع</button>`;
    reloadInvBtn.style.display = "none";
    // نضع زر رجوع داخل الهيدر
    // (لو ما تبي تغييرات كثيرة، نحقنه داخل العنوان)
    invModalTitle.insertAdjacentHTML("afterend", backBtn);

    const backEl = $("backToInvList");
    backEl.onclick = () => {
      // إعادة الهيدر كما كان
      backEl.remove();
      invModalTitle.textContent = `فواتير المستخدم: ${CURRENT_INV_USER}`;
      reloadInvBtn.style.display = "";
      renderInvoicesTable();
    };

    // جدول التفاصيل
    const detailsHtml = `
      <tr>
        <td colspan="5" style="padding:0">
          <div style="padding:14px">
            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center">
              <div class="mut">الزبون: <b style="color:#fff">${escapeHtml(inv.customer_name || "-")}</b></div>
              <div class="mut">التاريخ: <b style="color:#fff">${escapeHtml(dTxt)}</b></div>
              <div class="mut">الإجمالي: <b style="color:#fff">${escapeHtml(String(inv.total ?? 0))}</b></div>
            </div>

            <div style="height:10px"></div>

            <div class="tableWrap" style="border:1px solid rgba(255,255,255,.12)">
              <table style="min-width:860px;background:rgba(0,0,0,.10)">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الوقت</th>
                    <th>البيان</th>
                    <th>العملية</th>
                    <th>النتيجة</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    rows.length
                    ? rows.map((r, i) => `
                      <tr>
                        <td>${i+1}</td>
                        <td>${escapeHtml(r.t || r.time || "")}</td>
                        <td>${escapeHtml(r.text || "")}</td>
                        <td>${escapeHtml(r.expr || "")}</td>
                        <td>${escapeHtml(String(r.result ?? ""))}</td>
                      </tr>
                    `).join("")
                    : `<tr><td colspan="5" style="color:#b9cde0;padding:14px">لا يوجد تفاصيل عمليات محفوظة لهذه الفاتورة</td></tr>`
                  }
                </tbody>
              </table>
            </div>

            <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn primary" id="pdfThisInv">تصدير PDF</button>
            </div>
          </div>
        </td>
      </tr>
    `;

    invTbody.innerHTML = detailsHtml;

    $("pdfThisInv").onclick = async () => {
      await exportInvoicePdf(inv);
    };
  }

  // ====== PDF Export (Arabic safe via html2canvas) ======
  function buildInvoiceHtml(inv, opsRows){
    const rows = (opsRows || []).map((r, i) => `
      <tr>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:8%">${i+1}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:14%">${escapeHtml(r.t || r.time || "")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:right;width:38%">${escapeHtml(r.text || "—")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:20%">${escapeHtml(r.expr || "")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:20%">${escapeHtml(String(r.result ?? ""))}</td>
      </tr>
    `).join("");

    const date = (()=>{ try{return new Date(inv.closed_at || inv.created_at).toLocaleString();}catch{return "—";} })();

    return `
      <div style="direction:rtl;font-family:Arial,system-ui; background:#fff; color:#111; padding:18px;">
        <div style="border:2px solid #111;border-radius:14px;padding:16px;">
          <div style="text-align:center;font-weight:900;font-size:24px;margin-bottom:4px;">شركة الحايك</div>
          <div style="text-align:center;font-weight:900;font-size:20px;color:#0a7c3a;margin-bottom:10px;">HAYEK SPOT</div>

          <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;margin-bottom:10px;flex-wrap:wrap">
            <div>اسم الزبون: <b>${escapeHtml(inv.customer_name||"-")}</b></div>
            <div>اسم المستخدم: <b>${escapeHtml(inv.username||"-")}</b></div>
            <div>رقم: <b>${escapeHtml(String(inv.id).slice(-6))}</b></div>
            <div>التاريخ: <b>${escapeHtml(date)}</b></div>
          </div>

          <div style="border-top:1px solid #111;margin:10px 0"></div>

          <div style="font-weight:900;margin:6px 0 10px;">سجل العمليات</div>

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
              ${rows || `<tr><td colspan="5" style="border:1px solid #111;padding:12px;text-align:center">لا يوجد بيانات</td></tr>`}
            </tbody>
          </table>

          <div style="margin-top:12px;border:2px dashed #111;border-radius:12px;padding:10px;display:flex;justify-content:space-between;font-weight:900">
            <span>إجمالي الكشف:</span>
            <span>${escapeHtml(String(inv.total ?? 0))}</span>
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

  async function buildPdfBlobFromHtml(html){
    const tmp = document.createElement("div");
    tmp.style.position = "fixed";
    tmp.style.left = "-99999px";
    tmp.style.top = "0";
    tmp.style.width = "794px"; // A4-ish
    tmp.innerHTML = html;
    document.body.appendChild(tmp);

    const canvas = await html2canvas(tmp, { scale: 2, backgroundColor: "#ffffff" });
    tmp.remove();

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p","pt","a4");

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
    return pdf.output("blob");
  }

  async function exportInvoicePdf(inv){
    try{
      const ops = await fetchOpsForInvoice(inv.id);
      const html = buildInvoiceHtml(inv, ops);
      const blob = await buildPdfBlobFromHtml(html);

      const cust = (inv.customer_name || "invoice").trim().replace(/\s+/g,"_");
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `HAYEK_${cust}_${String(inv.id).slice(-6)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(()=>URL.revokeObjectURL(url), 2500);
    }catch(e){
      console.log("PDF error", e);
      // صامت قدر الإمكان
    }
  }

  // ====== Load all ======
  async function loadAll(){
    USERS = await loadUsers();
    renderUsersTable();

    // stats
    stUsers.textContent = String(USERS.length || 0);

    const invCount = await countInvoices();
    stInvoices.textContent = String(invCount);

    stActive.textContent = String(calcActive24(USERS));
  }

  refreshBtn.onclick = loadAll;
  rangeSel.addEventListener("change", loadAll);

  // ====== Start ======
  loadAll();
})();
