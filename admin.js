// admin.js (بدون import)
(() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG || {};
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    alert('config.js غير مضبوط (SUPABASE_URL / SUPABASE_ANON_KEY)');
    return;
  }

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // عناصر
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
  const usersTbody = el("usersTable").querySelector("tbody");

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
  const pdfHint = el("pdfHint");

  // Preview fields
  const pv_username = el("pv_username");
  const pv_customer = el("pv_customer");
  const pv_invoiceId = el("pv_invoiceId");
  const pv_date = el("pv_date");
  const pv_table_body = el("pv_table").querySelector("tbody");
  const pv_total = el("pv_total");
  const invoicePreview = el("invoicePreview");

  // Session keys
  const SESSION_KEY = "HAYEK_ADMIN_SESSION_V2";
  const DEVICE_KEY = "HAYEK_DEVICE_ID_V2";

  // Helpers
  const nowLocalISODate = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const addDaysISO = (iso, delta) => {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
  };

  const fmtDateTime = (t) => {
    if (!t) return "—";
    const d = new Date(t);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}`;
  };

  const safeText = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

  const parseNum = (v) => {
    if (v === null || v === undefined) return 0;
    const s = String(v).replace(/,/g, ".").replace(/[^\d.\-]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const toast = (msg, ok = true) => {
    statusLine.textContent = msg;
    statusLine.className = "hint " + (ok ? "ok" : "bad");
  };

  const toastPdf = (msg, ok = true) => {
    pdfHint.textContent = msg;
    pdfHint.className = "hint " + (ok ? "ok" : "bad");
  };

  const getDeviceId = () => {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "dev_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  };

  const isAuthed = () => !!localStorage.getItem(SESSION_KEY);

  const setAuthed = (v) => {
    if (v) localStorage.setItem(SESSION_KEY, "1");
    else localStorage.removeItem(SESSION_KEY);
    adminStatePill.textContent = v ? "مفتوح" : "غير مسجل";
    adminStatePill.className = "pill " + (v ? "pill-ok" : "pill-off");
  };

  // ===== AUTH (Admin) =====
  async function adminLogin() {
    toast("جاري التحقق...", true);

    const u = (adminUser.value || "").trim();
    const p = (adminPass.value || "").trim();
    if (!u || !p) return toast("أدخل اسم المستخدم وكلمة السر", false);

    const deviceId = getDeviceId();

    const { data, error } = await supabase
      .from("app_users")
      .select("id, username, pass, is_admin, blocked, device_id")
      .eq("username", u)
      .limit(1);

    if (error) return toast("خطأ قاعدة البيانات: " + error.message, false);
    if (!data || !data.length) return toast("المستخدم غير موجود", false);

    const row = data[0];
    if (!row.is_admin) return toast("هذا المستخدم ليس Admin", false);
    if (row.blocked) return toast("هذا المستخدم محظور", false);
    if (row.pass !== p) return toast("كلمة السر خاطئة", false);

    // قفل جهاز الأدمن: إذا كان مسجل بجهاز آخر
    if (row.device_id && row.device_id !== deviceId) {
      return toast("❌ الحالة: Admin مستخدم على جهاز آخر", false);
    }

    // اربط الجهاز إن لم يكن مربوط
    if (!row.device_id) {
      const { error: upErr } = await supabase
        .from("app_users")
        .update({ device_id: deviceId })
        .eq("id", row.id);
      if (upErr) return toast("فشل ربط الجهاز: " + upErr.message, false);
    }

    setAuthed(true);
    toast("✅ تم تسجيل الدخول بنجاح", true);

    await refreshUsers();
    await fillUsersPickers();
  }

  function adminLogout() {
    setAuthed(false);
    toast("تم تسجيل الخروج", true);
  }

  // ===== USERS =====
  async function refreshUsers() {
    if (!isAuthed()) return;

    const { data, error } = await supabase
      .from("app_users")
      .select("id, username, is_admin, blocked, device_id")
      .order("id", { ascending: true });

    if (error) return toast("خطأ تحميل المستخدمين: " + error.message, false);

    usersCount.textContent = String(data?.length || 0);
    usersTbody.innerHTML = "";

    (data || []).forEach((u, idx) => {
      const tr = document.createElement("tr");

      const tdId = document.createElement("td");
      tdId.textContent = String(u.id ?? (idx + 1));
      tr.appendChild(tdId);

      const tdUser = document.createElement("td");
      tdUser.innerHTML = `<div class="u-name">${safeText(u.username)}</div>`;
      tr.appendChild(tdUser);

      const tdAdmin = document.createElement("td");
      tdAdmin.textContent = u.is_admin ? "TRUE" : "FALSE";
      tr.appendChild(tdAdmin);

      const tdBlocked = document.createElement("td");
      tdBlocked.textContent = u.blocked ? "TRUE" : "FALSE";
      tr.appendChild(tdBlocked);

      const tdDev = document.createElement("td");
      tdDev.textContent = u.device_id ? "مقفل" : "حر";
      tr.appendChild(tdDev);

      const tdActions = document.createElement("td");
      tdActions.className = "actions";

      const btnBlock = document.createElement("button");
      btnBlock.className = "btn small";
      btnBlock.textContent = u.blocked ? "فك الحظر" : "حظر";
      btnBlock.onclick = async () => {
        await supabase.from("app_users").update({ blocked: !u.blocked }).eq("id", u.id);
        await refreshUsers();
        await fillUsersPickers();
      };

      const btnUnlink = document.createElement("button");
      btnUnlink.className = "btn small";
      btnUnlink.textContent = "فك ربط الجهاز";
      btnUnlink.onclick = async () => {
        await supabase.from("app_users").update({ device_id: null }).eq("id", u.id);
        await refreshUsers();
      };

      const btnDel = document.createElement("button");
      btnDel.className = "btn small danger";
      btnDel.textContent = "حذف";
      btnDel.onclick = async () => {
        if (!confirm("حذف المستخدم نهائياً؟")) return;
        await supabase.from("app_users").delete().eq("id", u.id);
        await refreshUsers();
        await fillUsersPickers();
      };

      tdActions.appendChild(btnBlock);
      tdActions.appendChild(btnUnlink);
      tdActions.appendChild(btnDel);

      tr.appendChild(tdActions);

      usersTbody.appendChild(tr);
    });

    toast("✅ تم تحديث قائمة المستخدمين", true);
  }

  async function addUser() {
    if (!isAuthed()) return;

    const u = (newUsername.value || "").trim();
    const p = (newPassword.value || "").trim();
    if (!u || !p) return toast("أدخل اسم المستخدم وكلمة السر", false);

    const isAdmin = newRole.value === "admin";

    const { error } = await supabase.from("app_users").insert({
      username: u,
      pass: p,
      is_admin: isAdmin,
      blocked: false,
      device_id: null
    });

    if (error) return toast("فشل إضافة المستخدم: " + error.message, false);

    newUsername.value = "";
    newPassword.value = "";
    newRole.value = "user";

    await refreshUsers();
    await fillUsersPickers();
    toast("✅ تمت الإضافة", true);
  }

  async function fillUsersPickers() {
    // users for invoices filter
    const { data, error } = await supabase
      .from("app_users")
      .select("username")
      .order("id", { ascending: true });

    if (error) return;

    const list = (data || []).map(x => x.username).filter(Boolean);

    pickUser.innerHTML = "";
    list.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u;
      opt.textContent = u;
      pickUser.appendChild(opt);
    });

    // default
    if (list.length && !pickUser.value) pickUser.value = list[0];
  }

  // ===== INVOICES =====
  async function loadInvoices() {
    if (!isAuthed()) return;

    const username = pickUser.value;
    if (!username) return toastPdf("اختر المستخدم أولاً", false);

    const status = pickStatus.value;
    const from = fromDate.value;
    const to = toDate.value;

    let q = supabase.from("app_invoices")
      .select("id, username, total, created_at, customer_name, status, closed_at")
      .eq("username", username)
      .order("created_at", { ascending: false })
      .limit(500);

    if (status !== "all") q = q.eq("status", status);

    // فلترة التاريخ (على created_at)
    if (from) q = q.gte("created_at", from + "T00:00:00");
    if (to) q = q.lte("created_at", to + "T23:59:59");

    const { data, error } = await q;
    if (error) return toastPdf("خطأ تحميل الفواتير: " + error.message, false);

    invCount.textContent = String(data?.length || 0);

    invoiceSelect.innerHTML = "";
    (data || []).forEach(inv => {
      const opt = document.createElement("option");
      const st = inv.status || "open";
      const dt = fmtDateTime(inv.created_at);
      const cust = inv.customer_name || "—";
      const total = (inv.total ?? 0);
      // ✅ المطلوب: يظهر قيمة الفاتورة ضمن القائمة قبل فتحها
      opt.value = inv.id;
      opt.textContent = `(${st}) — ${dt} — ${cust} — الإجمالي: ${total}`;
      invoiceSelect.appendChild(opt);
    });

    if (data && data.length) {
      invoiceSelect.value = data[0].id;
      await openInvoice();
    } else {
      clearPreview();
    }

    toastPdf("✅ تم تحميل الفواتير", true);
  }

  function clearPreview() {
    pv_username.textContent = "—";
    pv_customer.textContent = "—";
    pv_invoiceId.textContent = "—";
    pv_date.textContent = "—";
    pv_total.textContent = "0";
    pv_table_body.innerHTML = "";
  }

  async function fetchInvoiceAndOps(invoiceId) {
    const { data: inv, error: invErr } = await supabase
      .from("app_invoices")
      .select("id, username, total, created_at, customer_name, status, closed_at")
      .eq("id", invoiceId)
      .limit(1);

    if (invErr) throw new Error(invErr.message);
    if (!inv || !inv.length) throw new Error("الفاتورة غير موجودة");

    const invoice = inv[0];

    // 1) نحاول invoice_id إذا موجود بالسجلات
    let { data: ops, error: opsErr } = await supabase
      .from("app_operations")
      .select("created_at, label, operation, result, invoice_id")
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: true })
      .limit(2000);

    // 2) إذا ما في ربط invoice_id (مثل صورك كانت NULL) نجيب حسب وقت الفاتورة
    if (!opsErr && (!ops || ops.length === 0)) {
      const start = invoice.created_at;
      const end = invoice.closed_at || new Date().toISOString();

      const q2 = supabase
        .from("app_operations")
        .select("created_at, label, operation, result")
        .eq("username", invoice.username)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: true })
        .limit(2000);

      const r2 = await q2;
      if (r2.error) throw new Error(r2.error.message);
      ops = r2.data || [];
    } else if (opsErr) {
      // حتى لو فشل invoice_id، نجرب fallback
      const start = invoice.created_at;
      const end = invoice.closed_at || new Date().toISOString();
      const r2 = await supabase
        .from("app_operations")
        .select("created_at, label, operation, result")
        .eq("username", invoice.username)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: true })
        .limit(2000);

      if (r2.error) throw new Error(r2.error.message);
      ops = r2.data || [];
    }

    return { invoice, ops };
  }

  async function openInvoice() {
    if (!isAuthed()) return;

    const invoiceId = invoiceSelect.value;
    if (!invoiceId) return clearPreview();

    try {
      const { invoice, ops } = await fetchInvoiceAndOps(invoiceId);

      pv_username.textContent = safeText(invoice.username);
      pv_customer.textContent = safeText(invoice.customer_name);
      pv_invoiceId.textContent = safeText(invoice.id);
      pv_date.textContent = fmtDateTime(invoice.created_at);

      pv_table_body.innerHTML = "";

      let totalCalc = 0;
      ops.forEach((r) => {
        const tr = document.createElement("tr");
        const tTime = document.createElement("td");
        const tLabel = document.createElement("td");
        const tOp = document.createElement("td");
        const tRes = document.createElement("td");

        tTime.textContent = fmtDateTime(r.created_at);
        tLabel.textContent = safeText(r.label);
        tOp.textContent = safeText(r.operation);
        tRes.textContent = safeText(r.result);

        // ✅ إصلاح المجموع النهائي: مجموع نتائج كل الأسطر (مثل مثال 15125+6+2+5=15138)
        totalCalc += parseNum(r.result);

        tr.appendChild(tTime);
        tr.appendChild(tLabel);
        tr.appendChild(tOp);
        tr.appendChild(tRes);
        pv_table_body.appendChild(tr);
      });

      // إذا total موجود ومضبوط، بنستعمل الأكبر بينهم حتى ما يطلع غلط
      const invTotal = parseNum(invoice.total);
      const finalTotal = Math.abs(totalCalc) > 0 ? totalCalc : invTotal;

      pv_total.textContent = String(finalTotal);

      toastPdf("✅ تم فتح الفاتورة", true);
    } catch (e) {
      toastPdf("خطأ فتح الفاتورة: " + e.message, false);
      clearPreview();
    }
  }

  // ===== PDF EXPORT (Arabic-safe) =====
  async function exportInvoicePDF() {
    if (!isAuthed()) return;

    if (!window.html2pdf) {
      return toastPdf("مكتبة html2pdf غير محمّلة", false);
    }

    // إذا مافي جدول أو بيانات
    if (!pv_invoiceId.textContent || pv_invoiceId.textContent === "—") {
      return toastPdf("افتح فاتورة أولاً", false);
    }

    toastPdf("جاري التصدير...", true);

    // نعمل clone نظيف (أبيض) حتى ما يطلع PDF فاضي/غامق
    const clone = invoicePreview.cloneNode(true);
    clone.style.background = "#fff";
    clone.style.color = "#111";
    clone.classList.add("print-white");

    // حاوية خارج الشاشة لكن مرئية للـ html2canvas
    const wrap = document.createElement("div");
    wrap.style.position = "fixed";
    wrap.style.left = "-10000px";
    wrap.style.top = "0";
    wrap.style.width = "794px"; // تقريب A4 px
    wrap.style.background = "#fff";
    wrap.appendChild(clone);
    document.body.appendChild(wrap);

    const fileName = `HAYEK_SPOT_${pv_invoiceId.textContent}.pdf`;

    try {
      const opt = {
        margin: [12, 12, 12, 12],
        filename: fileName,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: clone.scrollWidth,
          windowHeight: clone.scrollHeight
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
      };

      await window.html2pdf().set(opt).from(clone).save();
      toastPdf("✅ تم تصدير PDF بنجاح", true);
    } catch (e) {
      toastPdf("فشل التصدير: " + e.message, false);
    } finally {
      wrap.remove();
    }
  }

  // ===== Date shortcuts =====
  function setTodayRange() {
    const today = nowLocalISODate();
    fromDate.value = today;
    toDate.value = today;
  }

  function setLast7Range() {
    const today = nowLocalISODate();
    fromDate.value = addDaysISO(today, -7);
    toDate.value = today;
  }

  // ===== init =====
  function init() {
    setAuthed(isAuthed());

    // default range
    setLast7Range();

    btnAdminLogin.onclick = adminLogin;
    btnAdminLogout.onclick = adminLogout;

    btnAddUser.onclick = addUser;
    btnRefreshUsers.onclick = async () => {
      await refreshUsers();
      await fillUsersPickers();
    };

    btnToday.onclick = () => { setTodayRange(); };
    btnLast7.onclick = () => { setLast7Range(); };
    btnLoadInvoices.onclick = loadInvoices;

    btnOpenInvoice.onclick = openInvoice;
    invoiceSelect.onchange = openInvoice;

    btnExportInvoicePdf.onclick = exportInvoicePDF;

    // Auto load if session
    if (isAuthed()) {
      refreshUsers().then(fillUsersPickers).catch(() => {});
    }
  }

  init();
})();

