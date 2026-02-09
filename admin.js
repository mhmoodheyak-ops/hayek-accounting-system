(() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG || {};
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    alert("config.js غير مضبوط (SUPABASE_URL / SUPABASE_ANON_KEY)");
    return;
  }

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

  const SESSION_KEY = "HAYEK_ADMIN_SESSION_V1";
  let adminSession = null;
  let cachedUsers = [];
  let cachedInvoices = [];
  let currentInvoice = null;

  const safe = (v) => (v === null || v === undefined ? "" : String(v));

  function setStatus(t) { statusLine.textContent = t; }
  function setPill(text, ok = true) {
    adminStatePill.style.display = "block";
    adminStatePill.className = "status-pill " + (ok ? "ok" : "bad");
    adminStatePill.textContent = text;
  }

  function fmt(ts) {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  }

  function isoFromDateInput(value, end = false) {
    if (!value) return null;
    const d = new Date(value + "T00:00:00");
    if (end) d.setHours(23, 59, 59, 999);
    return d.toISOString();
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

  // ====== LOGIN ======
  async function adminLogin() {
    const u = adminUser.value.trim();
    const p = adminPass.value.trim();
    if (!u || !p) return setPill("أدخل اسم المستخدم وكلمة السر", false);

    const { data, error } = await supabase
      .from("app_users")
      .select("id, username, pass, is_admin, blocked")
      .eq("username", u)
      .maybeSingle();

    if (error) return setPill("خطأ اتصال: " + error.message, false);
    if (!data) return setPill("المستخدم غير موجود", false);
    if (!data.is_admin) return setPill("هذا المستخدم ليس Admin", false);
    if (data.blocked) return setPill("الحساب محظور", false);
    if (data.pass !== p) return setPill("كلمة السر غير صحيحة", false);

    adminSession = { username: data.username, ts: Date.now() };
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

  // ====== USERS ======
  function renderUsers() {
    usersCount.textContent = `عدد المستخدمين: ${cachedUsers.length}`;
    usersList.innerHTML = "";

    cachedUsers.forEach((u) => {
      const card = document.createElement("div");
      card.className = "user-card";

      card.innerHTML = `
        <div class="user-card-left">
          <div class="user-card-name">${safe(u.username)}</div>
          <div class="user-card-meta">
            Admin: <b>${u.is_admin ? "TRUE" : "FALSE"}</b>
            &nbsp; | &nbsp; محظور: <b>${u.blocked ? "TRUE" : "FALSE"}</b>
            &nbsp; | &nbsp; Device: <b>${u.device_id ? "مربوط" : "فارغ"}</b>
          </div>
        </div>
        <div class="user-card-actions"></div>
      `;

      const actions = card.querySelector(".user-card-actions");

      const mkBtn = (txt, cls, on) => {
        const b = document.createElement("button");
        b.className = "btn small " + (cls || "");
        b.textContent = txt;
        b.onclick = on;
        return b;
      };

      actions.appendChild(mkBtn("اختر", "primary", () => {
        pickUser.value = u.username;
        setPill(`تم اختيار المستخدم: ${u.username}`, true);
      }));

      actions.appendChild(mkBtn(u.blocked ? "فك حظر" : "حظر", "", async () => {
        const { error } = await supabase.from("app_users").update({ blocked: !u.blocked }).eq("id", u.id);
        if (error) return setPill("فشل: " + error.message, false);
        await refreshUsers(); await refreshUserPicker();
        setPill("تم", true);
      }));

      actions.appendChild(mkBtn("فك ربط الجهاز", "", async () => {
        const { error } = await supabase.from("app_users").update({ device_id: null }).eq("id", u.id);
        if (error) return setPill("فشل: " + error.message, false);
        await refreshUsers();
        setPill("تم فك ربط الجهاز", true);
      }));

      actions.appendChild(mkBtn("حذف", "danger", async () => {
        if (!confirm(`حذف المستخدم ${u.username}؟`)) return;
        const { error } = await supabase.from("app_users").delete().eq("id", u.id);
        if (error) return setPill("فشل: " + error.message, false);
        await refreshUsers(); await refreshUserPicker();
        setPill("تم الحذف", true);
      }));

      usersList.appendChild(card);
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

    const payload = { username: u, pass: p, is_admin: role === "admin", blocked: false };
    const { error } = await supabase.from("app_users").insert(payload);
    if (error) return setPill("فشل الإضافة: " + error.message, false);

    newUsername.value = "";
    await refreshUsers(); await refreshUserPicker();
    setPill("تمت الإضافة", true);
  }

  // ====== INVOICES ======
  async function loadInvoices() {
    if (!adminSession) return setPill("سجل دخول Admin أولاً", false);

    const u = pickUser.value.trim();
    if (!u) return setPill("اختر مستخدم أولاً", false);

    const st = pickStatus.value.trim() || null;
    let fromISO = isoFromDateInput(fromDate.value, false);
    let toISO = isoFromDateInput(toDate.value, true);

    if (!fromISO && !toISO) {
      pickRangeToday();
      fromISO = isoFromDateInput(fromDate.value, false);
      toISO = isoFromDateInput(toDate.value, true);
    }

    let q = supabase
      .from("app_invoices")
      .select("id, username, total, created_at, customer_name, status")
      .eq("username", u)
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: false });

    if (st) q = q.eq("status", st);

    const { data, error } = await q;
    if (error) return setPill("خطأ جلب الفواتير: " + error.message, false);

    cachedInvoices = data || [];
    invCount.textContent = `عدد النتائج: ${cachedInvoices.length}`;

    invoiceSelect.innerHTML = `<option value="">— اختر فاتورة —</option>`;
    cachedInvoices.forEach((inv) => {
      const opt = document.createElement("option");
      opt.value = inv.id;
      opt.textContent = `(${safe(inv.status)}) — ${safe(inv.customer_name || "بدون اسم")} — ${safe(inv.total ?? 0)} — ${fmt(inv.created_at)}`;
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

    // هامش وقت لجلب العمليات القريبة من وقت الفاتورة
    const start = new Date(inv.created_at); start.setHours(start.getHours() - 6);
    const end = new Date(inv.created_at); end.setHours(end.getHours() + 6);

    const { data, error } = await supabase
      .from("app_operations")
      .select("label, operation, result, created_at, username")
      .eq("username", inv.username)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      invoicePreview.innerHTML = `<div class="status-pill bad">خطأ جلب العمليات: ${safe(error.message)}</div>`;
      return;
    }

    const rows = (data || []).map(r => ({
      time: fmt(r.created_at),
      label: safe(r.label),
      op: safe(r.operation),
      result: safe(r.result)
    }));

    // ✅ شكل احترافي + id ثابت للتصدير
    invoicePreview.innerHTML = `
      <div id="invoicePaper" style="
        background:#fff; color:#111; border-radius:16px;
        padding:18px; max-width:820px; margin:18px auto;
        box-shadow:0 8px 24px rgba(0,0,0,.08);
        font-family: Arial, 'Segoe UI', Tahoma, sans-serif;
      ">
        <div style="text-align:center; margin-bottom:14px;">
          <div style="font-size:20px; font-weight:800;">شركة الحايك</div>
          <div style="font-size:12px; letter-spacing:1px; margin-top:4px;">HAYEK SPOT</div>
        </div>

        <div style="border:2px solid #111; border-radius:14px; padding:12px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid #e6e6e6;">
            <div style="font-weight:700;">اسم المستخدم</div>
            <div>${safe(inv.username)}</div>
          </div>
          <div style="display:flex; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid #e6e6e6;">
            <div style="font-weight:700;">اسم العميل</div>
            <div>${safe(inv.customer_name || "")}</div>
          </div>
          <div style="display:flex; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid #e6e6e6;">
            <div style="font-weight:700;">رقم الفاتورة</div>
            <div style="font-family: monospace;">${safe(inv.id)}</div>
          </div>
          <div style="display:flex; justify-content:space-between; gap:10px; padding:8px 0;">
            <div style="font-weight:700;">التاريخ</div>
            <div>${fmt(inv.created_at)}</div>
          </div>
        </div>

        <div style="height:18px;"></div> <!-- ✅ 3 سطور فراغ تقريباً -->

        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr>
              <th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f3f3f3;">الوقت</th>
              <th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f3f3f3;">البيان</th>
              <th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f3f3f3;">العملية</th>
              <th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f3f3f3;">النتيجة</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows.map(r => `
                  <tr>
                    <td style="border:1px solid #ddd; padding:10px;">${r.time}</td>
                    <td style="border:1px solid #ddd; padding:10px;">${r.label}</td>
                    <td style="border:1px solid #ddd; padding:10px;">${r.op}</td>
                    <td style="border:1px solid #ddd; padding:10px; font-weight:700;">${r.result}</td>
                  </tr>
                `).join("")
                : `<tr><td colspan="4" style="border:1px solid #ddd; padding:12px; color:#666;">لا توجد عمليات ضمن نطاق هذه الفاتورة</td></tr>`
            }
          </tbody>
        </table>

        <div style="height:18px;"></div> <!-- ✅ 3 سطور فراغ تقريباً -->

        <div style="
          display:flex; justify-content:space-between; align-items:center;
          border:2px dashed #111; border-radius:14px; padding:12px; margin-top:12px;
          font-size:16px; font-weight:800;
        ">
          <div>إجمالي الكشف:</div>
          <div>${safe(inv.total ?? 0)}</div>
        </div>

        <div style="text-align:center; margin-top:14px; font-size:12px; color:#333;">
          <div style="font-weight:700;">تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك</div>
          <div style="margin-top:4px;">شركة الحايك: تجارة عامة / توزيع جملة / دعاية وإعلان / طباعة / حلول رقمية</div>
          <div style="margin-top:8px; font-weight:800; border:2px solid #0b8; display:inline-block; padding:6px 14px; border-radius:999px;">
            05510217646
          </div>
        </div>
      </div>
    `;
  }

  // ✅ إصلاح PDF الفارغ: نصنع نسخة نظيفة على body ثم نصوّرها
  async function exportInvoicePdf() {
    if (!currentInvoice) return setPill("افتح فاتورة أولاً", false);

    const paper = document.getElementById("invoicePaper");
    if (!paper) return setPill("لا يوجد محتوى لتصديره", false);

    // صندوق مؤقت بدون أي blur / filters / overflow
    const stage = document.createElement("div");
    stage.id = "pdfStage";
    stage.style.cssText = `
      position: fixed;
      left: 0; top: 0;
      width: 100%;
      background: #ffffff;
      z-index: 999999;
      padding: 18px;
    `;

    // clone
    const clone = paper.cloneNode(true);
    clone.style.maxWidth = "820px";
    clone.style.margin = "0 auto";
    clone.style.boxShadow = "none";

    stage.appendChild(clone);
    document.body.appendChild(stage);

    // انتظر رندر
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const filename = `HAYEK_SPOT_${currentInvoice.username}_${String(currentInvoice.id).slice(0,8)}.pdf`;

    try {
      const opt = {
        margin: 8,
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          scrollY: 0
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      };

      await window.html2pdf().set(opt).from(clone).save();
      setPill("تم تصدير PDF بنجاح", true);
    } catch (e) {
      console.error(e);
      setPill("فشل تصدير PDF: " + (e?.message || e), false);
    } finally {
      // حذف الصندوق المؤقت
      stage.remove();
    }
  }

  // ====== Events ======
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

