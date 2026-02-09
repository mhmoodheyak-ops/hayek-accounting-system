// admin.js
(() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG || {};
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    alert("config.js غير مضبوط (SUPABASE_URL / SUPABASE_ANON_KEY)");
    return;
  }

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Helpers
  const el = (id) => document.getElementById(id);
  const statusLine = el("statusLine");
  const adminStatePill = el("adminStatePill");

  const adminUser = el("adminUser");
  const adminPass = el("adminPass");
  const btnAdminLogin = el("btnAdminLogin");
  const btnAdminLogout = el("btnAdminLogout");

  const newUsername = el("newUsername");
  const newPassword = el("newPassword");
  const newRole = el("newRole");
  const btnAddUser = el("btnAddUser");
  const btnRefreshUsers = el("btnRefreshUsers");
  const usersCount = el("usersCount");
  const usersList = el("usersList");

  const pickUser = el("pickUser");
  const pickStatus = el("pickStatus");
  const fromDate = el("fromDate");
  const toDate = el("toDate");
  const btnToday = el("btnToday");
  const btnLast7 = el("btnLast7");
  const btnLoadInvoices = el("btnLoadInvoices");
  const invCount = el("invCount");

  const invoiceSelect = el("invoiceSelect");
  const btnOpenInvoice = el("btnOpenInvoice");
  const btnExportInvoicePdf = el("btnExportInvoicePdf");
  const invoicePreview = el("invoicePreview");

  // Session
  const SESSION_KEY = "HAYEK_ADMIN_SESSION_V1";

  let adminSession = null;
  let cachedUsers = [];
  let cachedInvoices = [];
  let currentInvoice = null;

  function setPill(text, ok = true) {
    adminStatePill.style.display = "block";
    adminStatePill.className = "status-pill " + (ok ? "ok" : "bad");
    adminStatePill.textContent = text;
  }

  function setStatus(text) {
    statusLine.textContent = text;
  }

  function formatDateTime(ts) {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  }

  function startOfTodayISO() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  function endOfTodayISO() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }

  function isoFromDateInput(value, end = false) {
    if (!value) return null;
    const d = new Date(value + "T00:00:00");
    if (end) d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }

  function safeText(v) {
    return (v === null || v === undefined) ? "" : String(v);
  }

  function pickRangeToday() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    fromDate.value = `${yyyy}-${mm}-${dd}`;
    toDate.value = `${yyyy}-${mm}-${dd}`;
  }

  function pickRangeLast7() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);

    const f = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    fromDate.value = f(start);
    toDate.value = f(end);
  }

  // --- Login (admin user stored in app_users)
  async function adminLogin() {
    const u = adminUser.value.trim();
    const p = adminPass.value.trim();
    if (!u || !p) return setPill("أدخل اسم المستخدم وكلمة السر", false);

    const { data, error } = await supabase
      .from("app_users")
      .select("id, username, pass, is_admin, blocked, device_id")
      .eq("username", u)
      .maybeSingle();

    if (error) return setPill("خطأ اتصال: " + error.message, false);
    if (!data) return setPill("المستخدم غير موجود", false);
    if (!data.is_admin) return setPill("هذا المستخدم ليس Admin", false);
    if (data.blocked) return setPill("الحساب محظور", false);
    if (data.pass !== p) return setPill("كلمة السر غير صحيحة", false);

    adminSession = { username: data.username, is_admin: true, ts: Date.now() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(adminSession));
    setStatus("مفتوح");
    setPill("تم تسجيل الدخول بنجاح", true);

    await refreshUsers();
    await refreshUserPicker();
  }

  function adminLogout() {
    adminSession = null;
    localStorage.removeItem(SESSION_KEY);
    setStatus("غير مسجل");
    setPill("تم تسجيل الخروج", true);
    usersList.innerHTML = "";
    pickUser.innerHTML = `<option value="">— اختر —</option>`;
    invoiceSelect.innerHTML = `<option value="">— اختر فاتورة —</option>`;
    invoicePreview.innerHTML = "";
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      adminSession = JSON.parse(raw);
      if (adminSession?.username) {
        setStatus("مفتوح");
        setPill("جلسة Admin جاهزة", true);
      }
    } catch {}
  }

  // --- Users UI
  function renderUsers() {
    usersCount.textContent = `عدد المستخدمين: ${cachedUsers.length}`;
    usersList.innerHTML = "";

    cachedUsers.forEach((u) => {
      const wrap = document.createElement("div");
      wrap.className = "user-card";

      const left = document.createElement("div");
      left.className = "user-card-left";

      const name = document.createElement("div");
      name.className = "user-card-name";
      name.textContent = u.username;

      const meta = document.createElement("div");
      meta.className = "user-card-meta";
      meta.innerHTML =
        `Admin: <b>${u.is_admin ? "TRUE" : "FALSE"}</b> &nbsp; | &nbsp; محظور: <b>${u.blocked ? "TRUE" : "FALSE"}</b> &nbsp; | &nbsp; Device: <b>${u.device_id ? "مربوط" : "فارغ"}</b>`;

      left.appendChild(name);
      left.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "user-card-actions";

      const btnPick = document.createElement("button");
      btnPick.className = "btn small primary";
      btnPick.textContent = "اختر";
      btnPick.onclick = () => {
        pickUser.value = u.username;
        setPill(`تم اختيار المستخدم: ${u.username}`, true);
      };

      const btnBlock = document.createElement("button");
      btnBlock.className = "btn small";
      btnBlock.textContent = u.blocked ? "فك حظر" : "حظر";
      btnBlock.onclick = async () => {
        const { error } = await supabase.from("app_users").update({ blocked: !u.blocked }).eq("id", u.id);
        if (error) return setPill("فشل: " + error.message, false);
        await refreshUsers();
        await refreshUserPicker();
        setPill("تم", true);
      };

      const btnUnlockDevice = document.createElement("button");
      btnUnlockDevice.className = "btn small";
      btnUnlockDevice.textContent = "فك ربط الجهاز";
      btnUnlockDevice.onclick = async () => {
        const { error } = await supabase.from("app_users").update({ device_id: null }).eq("id", u.id);
        if (error) return setPill("فشل: " + error.message, false);
        await refreshUsers();
        setPill("تم فك ربط الجهاز", true);
      };

      const btnDel = document.createElement("button");
      btnDel.className = "btn small danger";
      btnDel.textContent = "حذف";
      btnDel.onclick = async () => {
        if (!confirm(`حذف المستخدم ${u.username}؟`)) return;
        const { error } = await supabase.from("app_users").delete().eq("id", u.id);
        if (error) return setPill("فشل: " + error.message, false);
        await refreshUsers();
        await refreshUserPicker();
        setPill("تم الحذف", true);
      };

      actions.appendChild(btnPick);
      actions.appendChild(btnBlock);
      actions.appendChild(btnUnlockDevice);
      actions.appendChild(btnDel);

      wrap.appendChild(left);
      wrap.appendChild(actions);
      usersList.appendChild(wrap);
    });
  }

  async function refreshUsers() {
    if (!adminSession) return;

    const { data, error } = await supabase
      .from("app_users")
      .select("id, username, pass, is_admin, blocked, created_at, device_id")
      .order("id", { ascending: true });

    if (error) return setPill("خطأ جلب المستخدمين: " + error.message, false);
    cachedUsers = data || [];
    renderUsers();
  }

  async function refreshUserPicker() {
    const { data, error } = await supabase
      .from("app_users")
      .select("username")
      .order("username", { ascending: true });

    if (error) return;

    pickUser.innerHTML = `<option value="">— اختر —</option>`;
    (data || []).forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.username;
      opt.textContent = u.username;
      pickUser.appendChild(opt);
    });
  }

  async function addUser() {
    if (!adminSession) return setPill("سجل دخول Admin أولاً", false);

    const u = newUsername.value.trim();
    const p = newPassword.value.trim();
    const role = newRole.value;

    if (!u || !p) return setPill("أدخل اسم المستخدم وكلمة السر", false);

    const payload = {
      username: u,
      pass: p,
      is_admin: role === "admin",
      blocked: false
    };

    const { error } = await supabase.from("app_users").insert(payload);
    if (error) return setPill("فشل الإضافة: " + error.message, false);

    newUsername.value = "";
    await refreshUsers();
    await refreshUserPicker();
    setPill("تمت الإضافة", true);
  }

  // --- Invoices
  async function loadInvoices() {
    if (!adminSession) return setPill("سجل دخول Admin أولاً", false);

    const u = pickUser.value.trim();
    if (!u) return setPill("اختر مستخدم أولاً", false);

    const st = pickStatus.value.trim() || null;

    let fromISO = isoFromDateInput(fromDate.value, false);
    let toISO = isoFromDateInput(toDate.value, true);

    if (!fromISO && !toISO) {
      // Default: today
      fromISO = startOfTodayISO();
      toISO = endOfTodayISO();
    }
    if (!fromISO && toISO) fromISO = "1970-01-01T00:00:00.000Z";
    if (fromISO && !toISO) toISO = endOfTodayISO();

    let q = supabase
      .from("app_invoices")
      .select("id, username, total, created_at, customer_name, status, closed_at")
      .eq("username", u)
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: false });

    if (st) q = q.eq("status", st);

    const { data, error } = await q;
    if (error) return setPill("خطأ جلب الفواتير: " + error.message, false);

    cachedInvoices = data || [];
    invCount.textContent = `عدد النتائج: ${cachedInvoices.length}`;

    // dropdown clear
    invoiceSelect.innerHTML = `<option value="">— اختر فاتورة —</option>`;

    cachedInvoices.forEach((inv) => {
      const opt = document.createElement("option");
      const statusTxt = inv.status || "";
      const cName = inv.customer_name || "بدون اسم";
      const total = (inv.total ?? 0);
      const dt = formatDateTime(inv.created_at);

      // ✅ المطلوب: عرض المبلغ داخل القائمة
      opt.value = inv.id;
      opt.textContent = `(${statusTxt}) — ${cName} — ${total} — ${dt}`;
      invoiceSelect.appendChild(opt);
    });

    setPill("تم تحميل الفواتير", true);
  }

  async function openSelectedInvoice() {
    const id = invoiceSelect.value;
    if (!id) return setPill("اختر فاتورة أولاً", false);

    const inv = cachedInvoices.find((x) => x.id === id);
    if (!inv) return setPill("الفاتورة غير موجودة بالقائمة", false);

    currentInvoice = inv;
    await renderInvoice(inv);
    setPill("تم فتح الفاتورة", true);
  }

  async function renderInvoice(inv) {
    invoicePreview.innerHTML = `<div class="muted">جارٍ التحميل...</div>`;

    // ملاحظة: بيانات العمليات موجودة في app_operations حسب username + created_at غالباً
    // نجيب عمليات هذا المستخدم ضمن نفس يوم الفاتورة (أو قريب منها)
    const start = new Date(inv.created_at);
    const end = new Date(inv.created_at);
    // هامش 6 ساعات (لضمان التطابق لو في فرق وقت)
    start.setHours(start.getHours() - 6);
    end.setHours(end.getHours() + 6);

    const { data, error } = await supabase
      .from("app_operations")
      .select("label, operation, result, created_at, note, expression, invoice_id, username")
      .eq("username", inv.username)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      invoicePreview.innerHTML = `<div class="status-pill bad">خطأ جلب العمليات: ${safeText(error.message)}</div>`;
      return;
    }

    const rows = (data || []).map((r) => ({
      time: formatDateTime(r.created_at),
      label: r.label || "",
      op: r.operation || r.expression || "",
      result: r.result || ""
    }));

    const total = inv.total ?? 0;

    // ✅ نفس شكل فاتورة المستخدم (احترافي)
    invoicePreview.innerHTML = `
      <div class="invoice-paper" id="invoicePaper">
        <div class="inv-header">
          <div class="inv-title">شركة الحايك</div>
          <div class="inv-sub">HAYEK SPOT</div>
        </div>

        <div class="inv-box">
          <div class="inv-field"><span class="k">اسم المستخدم</span><span class="v">${safeText(inv.username)}</span></div>
          <div class="inv-field"><span class="k">اسم العميل</span><span class="v">${safeText(inv.customer_name || "")}</span></div>
          <div class="inv-field"><span class="k">رقم الفاتورة</span><span class="v">${safeText(inv.id)}</span></div>
          <div class="inv-field"><span class="k">التاريخ</span><span class="v">${formatDateTime(inv.created_at)}</span></div>
        </div>

        <div class="inv-table-wrap">
          <table class="inv-table">
            <thead>
              <tr>
                <th>الوقت</th>
                <th>البيان</th>
                <th>العملية</th>
                <th>النتيجة</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows.length
                  ? rows.map(r => `
                    <tr>
                      <td>${safeText(r.time)}</td>
                      <td>${safeText(r.label)}</td>
                      <td>${safeText(r.op)}</td>
                      <td>${safeText(r.result)}</td>
                    </tr>
                  `).join("")
                  : `<tr><td colspan="4" class="muted">لا توجد عمليات ضمن نطاق هذه الفاتورة</td></tr>`
              }
            </tbody>
          </table>
        </div>

        <div class="inv-total">
          <div class="inv-total-label">إجمالي الكشف:</div>
          <div class="inv-total-val">${safeText(total)}</div>
        </div>

        <div class="inv-footer">
          <div class="inv-foot-1">تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك</div>
          <div class="inv-foot-2">شركة الحايك: تجارة عامة / توزيع جملة / دعاية وإعلان / طباعة / حلول رقمية</div>
          <div class="inv-phone">05510217646</div>
        </div>
      </div>
    `;
  }

  // ✅ الحل: تصدير PDF من نفس المعاينة (HTML) لضمان عدم الفراغ + دعم عربي 100%
  async function exportInvoicePdf() {
    if (!currentInvoice) return setPill("افتح فاتورة أولاً", false);

    const paper = document.getElementById("invoicePaper");
    if (!paper) return setPill("لا يوجد محتوى لتصديره", false);

    // ضمان أن العنصر ظاهر ومترسم
    paper.scrollIntoView({ behavior: "instant", block: "start" });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const filename = `HAYEK_SPOT_${currentInvoice.username}_${String(currentInvoice.id).slice(0,8)}.pdf`;

    try {
      const opt = {
        margin:       8,
        filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
      };

      // مهم جداً: لا تجعل العنصر display:none أثناء التصدير
      await window.html2pdf().set(opt).from(paper).save();

      setPill("تم تصدير PDF بنجاح", true);
    } catch (e) {
      console.error(e);
      setPill("فشل تصدير PDF: " + (e?.message || e), false);
    }
  }

  // Events
  btnAdminLogin.addEventListener("click", adminLogin);
  btnAdminLogout.addEventListener("click", adminLogout);

  btnAddUser.addEventListener("click", addUser);
  btnRefreshUsers.addEventListener("click", refreshUsers);

  btnToday.addEventListener("click", () => { pickRangeToday(); setPill("تم اختيار اليوم", true); });
  btnLast7.addEventListener("click", () => { pickRangeLast7(); setPill("تم اختيار آخر 7 أيام", true); });

  btnLoadInvoices.addEventListener("click", loadInvoices);
  btnOpenInvoice.addEventListener("click", openSelectedInvoice);
  btnExportInvoicePdf.addEventListener("click", exportInvoicePdf);

  // Boot
  loadSession();
  if (adminSession) {
    refreshUsers();
    refreshUserPicker();
  } else {
    setStatus("غير مسجل");
  }

})();
