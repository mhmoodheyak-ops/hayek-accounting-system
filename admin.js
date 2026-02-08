// admin.js  (NO IMPORTS - works on GitHub Pages)
(() => {
  const cfg = window.APP_CONFIG || {};
  const SUPABASE_URL = cfg.SUPABASE_URL;
  const SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    alert("❌ config.js غير مضبوط (SUPABASE_URL / SUPABASE_ANON_KEY)");
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    alert("❌ مكتبة Supabase لم تُحمّل. تأكد أن admin.html يحتوي على <script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'></script>");
    return;
  }

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const $ = (id) => document.getElementById(id);
  const statusLine = $("statusLine");
  const adminStatePill = $("adminStatePill");

  const adminUser = $("adminUser");
  const adminPass = $("adminPass");
  const btnAdminLogin = $("btnAdminLogin");
  const btnAdminLogout = $("btnAdminLogout");

  const newUsername = $("newUsername");
  const newPassword = $("newPassword");
  const newRole = $("newRole");
  const btnAddUser = $("btnAddUser");
  const btnRefreshUsers = $("btnRefreshUsers");
  const usersCount = $("usersCount");
  const usersTableBody = $("usersTable").querySelector("tbody");

  const pickUser = $("pickUser");
  const pickStatus = $("pickStatus");
  const fromDate = $("fromDate");
  const toDate = $("toDate");
  const btnToday = $("btnToday");
  const btnLast7 = $("btnLast7");
  const btnLoadInvoices = $("btnLoadInvoices");
  const invCount = $("invCount");

  const invoiceSelect = $("invoiceSelect");
  const btnOpenInvoice = $("btnOpenInvoice");
  const btnExportInvoicePdf = $("btnExportInvoicePdf");
  const invoicePreview = $("invoicePreview");

  const SESSION_KEY = "HAYEK_ADMIN_SESSION_V1";
  const DEVICE_KEY = "HAYEK_DEVICE_ID_V1";

  function setStatus(msg) {
    statusLine.textContent = `الحالة: ${msg}`;
  }

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "dev_" + (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch { return null; }
  }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }
  function isAdminLogged() {
    const s = loadSession();
    return !!(s && s.username && s.device_id);
  }

  function setAdminUI() {
    if (isAdminLogged()) {
      adminStatePill.textContent = "مسجّل";
      adminStatePill.classList.add("ok");
    } else {
      adminStatePill.textContent = "غير مسجّل";
      adminStatePill.classList.remove("ok");
    }
  }

  function toISODate(d) {
    const x = new Date(d);
    const yyyy = x.getFullYear();
    const mm = String(x.getMonth() + 1).padStart(2, "0");
    const dd = String(x.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function setTodayRange() {
    const today = new Date();
    fromDate.value = toISODate(today);
    toDate.value = toISODate(today);
  }

  function setLast7Range() {
    const today = new Date();
    const prev = new Date();
    prev.setDate(today.getDate() - 6);
    fromDate.value = toISODate(prev);
    toDate.value = toISODate(today);
  }

  async function adminLogin() {
    const u = (adminUser.value || "").trim();
    const p = (adminPass.value || "").trim();
    if (!u || !p) return alert("اكتب اسم المستخدم وكلمة السر");

    const device_id = getDeviceId();

    setStatus("جاري التحقق...");
    const { data, error } = await supabase
      .from("app_users")
      .select("id, username, pass, is_admin, blocked, device_id")
      .eq("username", u)
      .limit(1);

    if (error) { console.error(error); setStatus("خطأ اتصال"); return alert("خطأ اتصال بقاعدة البيانات"); }

    const row = data?.[0];
    if (!row) { setStatus("مستخدم غير موجود"); return alert("المستخدم غير موجود"); }
    if (!row.is_admin) { setStatus("ليس Admin"); return alert("هذا المستخدم ليس Admin"); }
    if (row.blocked) { setStatus("محظور"); return alert("هذا المستخدم محظور"); }
    if (String(row.pass) !== String(p)) { setStatus("بيانات خاطئة"); return alert("بيانات خاطئة"); }

    if (row.device_id && row.device_id !== device_id) {
      setStatus("مرفوض: جهاز آخر");
      return alert("❌ Admin مستخدم على جهاز آخر.\nلفك القفل: اجعل device_id = null لهذا المستخدم من Supabase.");
    }

    if (!row.device_id) {
      const { error: upErr } = await supabase
        .from("app_users")
        .update({ device_id, last_seen: new Date().toISOString() })
        .eq("id", row.id);

      if (upErr) { console.error(upErr); setStatus("فشل ربط الجهاز"); return alert("فشل ربط الجهاز"); }
    } else {
      await supabase.from("app_users").update({ last_seen: new Date().toISOString() }).eq("id", row.id);
    }

    saveSession({ username: row.username, device_id });
    setStatus("تم تسجيل الدخول");
    setAdminUI();

    await refreshUsers();
    await fillUsersDropdown();
  }

  async function adminLogout() {
    clearSession();
    setAdminUI();
    setStatus("تم تسجيل الخروج");
  }

  async function refreshUsers() {
    if (!isAdminLogged()) return;

    setStatus("جاري تحديث المستخدمين...");
    const { data, error } = await supabase
      .from("app_users")
      .select("id, username, is_admin, blocked, device_id")
      .order("id", { ascending: true });

    if (error) { console.error(error); setStatus("خطأ"); return alert("خطأ بجلب المستخدمين"); }

    usersCount.textContent = String(data.length);
    usersTableBody.innerHTML = "";

    data.forEach((u, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>${u.is_admin ? "TRUE" : "FALSE"}</td>
        <td>${u.blocked ? "TRUE" : "FALSE"}</td>
        <td>${u.device_id ? "مقفول" : "حر"}</td>
        <td class="actions">
          <button class="mini blue" data-act="pick" data-id="${u.id}">اختر</button>
          <button class="mini" data-act="toggleBlock" data-id="${u.id}">${u.blocked ? "فك" : "حظر"}</button>
          <button class="mini" data-act="unlock" data-id="${u.id}">فك ربط الجهاز</button>
          <button class="mini red" data-act="del" data-id="${u.id}">حذف</button>
        </td>
      `;
      usersTableBody.appendChild(tr);
    });

    setStatus("جاهز");
  }

  async function addUser() {
    if (!isAdminLogged()) return alert("سجّل دخول Admin أولاً");

    const u = (newUsername.value || "").trim();
    const p = (newPassword.value || "").trim();
    const role = newRole.value;

    if (!u || !p) return alert("اكتب اسم المستخدم وكلمة السر");

    setStatus("جاري الإضافة...");
    const { error } = await supabase.from("app_users").insert({
      username: u,
      pass: p,
      is_admin: role === "admin",
      blocked: false,
      device_id: null,
      last_seen: new Date().toISOString()
    });

    if (error) { console.error(error); setStatus("فشل"); return alert("فشل الإضافة (قد يكون الاسم مستخدم)"); }

    newUsername.value = "";
    newPassword.value = "";
    setStatus("تمت الإضافة");
    await refreshUsers();
    await fillUsersDropdown();
  }

  usersTableBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (!isAdminLogged()) return alert("سجّل دخول Admin أولاً");

    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    if (!id || !act) return;

    if (act === "del") {
      if (!confirm("حذف المستخدم نهائياً؟")) return;
      setStatus("جاري الحذف...");
      const { error } = await supabase.from("app_users").delete().eq("id", id);
      if (error) { console.error(error); setStatus("فشل"); return alert("فشل الحذف"); }
      setStatus("تم الحذف");
      await refreshUsers();
      await fillUsersDropdown();
      return;
    }

    if (act === "toggleBlock") {
      const { data, error } = await supabase.from("app_users").select("blocked").eq("id", id).limit(1);
      if (error) return alert("خطأ");
      const blocked = !!data?.[0]?.blocked;

      setStatus("جاري التحديث...");
      const { error: upErr } = await supabase.from("app_users").update({ blocked: !blocked }).eq("id", id);
      if (upErr) { console.error(upErr); setStatus("فشل"); return alert("فشل"); }

      setStatus("تم");
      await refreshUsers();
      await fillUsersDropdown();
      return;
    }

    if (act === "unlock") {
      setStatus("جاري فك الربط...");
      const { error } = await supabase.from("app_users").update({ device_id: null }).eq("id", id);
      if (error) { console.error(error); setStatus("فشل"); return alert("فشل فك الربط"); }
      setStatus("تم فك الربط");
      await refreshUsers();
      return;
    }

    if (act === "pick") {
      const { data, error } = await supabase.from("app_users").select("username").eq("id", id).limit(1);
      if (error) return alert("خطأ");
      const uname = data?.[0]?.username || "";
      pickUser.value = uname;
      await loadInvoices();
    }
  });

  async function fillUsersDropdown() {
    if (!isAdminLogged()) return;

    const { data, error } = await supabase
      .from("app_users")
      .select("username, is_admin")
      .order("username", { ascending: true });

    if (error) return;

    pickUser.innerHTML = `<option value="">— اختر —</option>`;
    data.filter(x => !x.is_admin).forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.username;
      opt.textContent = u.username;
      pickUser.appendChild(opt);
    });
  }

  let loadedInvoices = [];
  let loadedInvoiceDetails = null;

  async function loadInvoices() {
    if (!isAdminLogged()) return alert("سجّل دخول Admin أولاً");

    const user = pickUser.value;
    if (!user) return alert("اختر المستخدم أولاً");

    const fd = fromDate.value;
    const td = toDate.value;
    if (!fd || !td) return alert("حدد التاريخ");

    const status = pickStatus.value;

    const fromTS = new Date(fd + "T00:00:00").toISOString();
    const toTS = new Date(td + "T23:59:59").toISOString();

    setStatus("جاري جلب الفواتير...");
    let q = supabase
      .from("app_invoices")
      .select("id, username, device_id, customer, total, status, created_at")
      .eq("username", user)
      .gte("created_at", fromTS)
      .lte("created_at", toTS)
      .order("created_at", { ascending: false });

    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) { console.error(error); setStatus("خطأ"); return alert("خطأ بجلب الفواتير"); }

    loadedInvoices = data || [];
    invCount.textContent = String(loadedInvoices.length);

    invoiceSelect.innerHTML = `<option value="">— اختر فاتورة —</option>`;
    loadedInvoices.forEach(inv => {
      const opt = document.createElement("option");
      opt.value = inv.id;
      const d = new Date(inv.created_at);
      opt.textContent = `${inv.customer || "بدون اسم"} — ${inv.total || 0} — ${d.toLocaleString("ar")}`;
      invoiceSelect.appendChild(opt);
    });

    invoicePreview.innerHTML = `<div class="muted">اختر فاتورة من القائمة لعرض التفاصيل…</div>`;
    loadedInvoiceDetails = null;

    setStatus("تم");
  }

  async function openSelectedInvoice() {
    const id = invoiceSelect.value;
    if (!id) return alert("اختر فاتورة أولاً");

    const inv = loadedInvoices.find(x => x.id === id);
    if (!inv) return alert("فاتورة غير موجودة");

    setStatus("جاري جلب السطور...");
    const { data: ops, error } = await supabase
      .from("app_operations")
      .select("note, expression, result, created_at")
      .eq("invoice_id", id)
      .order("created_at", { ascending: true });

    if (error) { console.error(error); setStatus("خطأ"); return alert("خطأ بجلب سطور الفاتورة"); }

    loadedInvoiceDetails = { inv, ops: ops || [] };
    renderPreview(loadedInvoiceDetails);
    setStatus("تم فتح الفاتورة");
  }

  function renderPreview({ inv, ops }) {
    const d = new Date(inv.created_at);
    const total = Number(inv.total || 0);

    const rows = ops.map((o, i) => {
      const dt = new Date(o.created_at);
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(dt.toLocaleString("ar"))}</td>
          <td>${escapeHtml(o.note || "")}</td>
          <td>${escapeHtml(o.expression || "")}</td>
          <td>${escapeHtml(String(o.result ?? ""))}</td>
        </tr>
      `;
    }).join("");

    invoicePreview.innerHTML = `
      <div class="preview-head">
        <div><b>المستخدم:</b> ${escapeHtml(inv.username)}</div>
        <div><b>الزبون:</b> ${escapeHtml(inv.customer || "")}</div>
        <div><b>رقم الفاتورة:</b> ${escapeHtml(inv.id)}</div>
        <div><b>التاريخ:</b> ${escapeHtml(d.toLocaleString("ar"))}</div>
        <div><b>الإجمالي:</b> ${total}</div>
      </div>

      <div class="table-wrap">
        <table class="tbl">
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
            ${rows || `<tr><td colspan="5" class="muted">لا يوجد سطور.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  async function exportInvoicePdf() {
    if (!loadedInvoiceDetails) return alert("افتح الفاتورة أولاً");

    const { inv, ops } = loadedInvoiceDetails;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

    // خط عربي (amiri-font.js يضعه داخل window.AMIRI_FONT_BASE64)
    if (window.AMIRI_FONT_BASE64) {
      doc.addFileToVFS("Amiri-Regular.ttf", window.AMIRI_FONT_BASE64);
      doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
      doc.setFont("Amiri");
    }

    const pageW = doc.internal.pageSize.getWidth();
    const margin = 12;

    doc.setLineWidth(0.4);
    doc.roundedRect(margin, 12, pageW - margin * 2, 28, 4, 4);

    doc.setFontSize(16);
    doc.text("شركة الحايك", pageW / 2, 22, { align: "center" });
    doc.setFontSize(11);
    doc.text("HAYEK SPOT", pageW / 2, 28, { align: "center" });

    doc.setFontSize(9);
    doc.roundedRect(pageW/2 - 36, 32, 22, 7, 3, 3);
    doc.text("PDF / طباعة", pageW/2 - 25, 37, { align: "center" });
    doc.roundedRect(pageW/2 - 11, 32, 26, 7, 3, 3);
    doc.text("سجل عمليات كامل", pageW/2 + 2, 37, { align: "center" });
    doc.roundedRect(pageW/2 + 18, 32, 22, 7, 3, 3);
    doc.text("فاتورة رسمية", pageW/2 + 29, 37, { align: "center" });

    const infoY = 45;
    const boxH = 14;
    const boxW = pageW - margin * 2;

    function infoBox(y, label, value) {
      doc.roundedRect(margin, y, boxW, boxH, 3, 3);
      doc.setFontSize(10);
      doc.text(label, pageW - margin - 2, y + 5.5, { align: "right" });
      doc.setFontSize(11);
      doc.text(String(value || ""), margin + 2, y + 10, { align: "left" });
    }

    const created = new Date(inv.created_at);
    infoBox(infoY + 0, "اسم المستخدم", inv.username);
    infoBox(infoY + 16, "اسم العميل", inv.customer || "");
    infoBox(infoY + 32, "رقم الفاتورة", inv.id);
    infoBox(infoY + 48, "التاريخ", created.toLocaleString("ar"));

    // 3 سطور فراغ فوق الجدول ≈ 10-12mm
    const tableStartY = infoY + 48 + 18;

    const tableRows = ops.map(o => {
      const t = new Date(o.created_at).toLocaleString("ar");
      return [t, (o.note || ""), (o.expression || ""), (o.result ?? "")];
    });

    doc.autoTable({
      startY: tableStartY,
      head: [["الوقت", "البيان", "العملية", "النتيجة"]],
      body: tableRows.length ? tableRows : [["", "لا يوجد سطور", "", ""]],
      theme: "grid",
      styles: {
        font: window.AMIRI_FONT_BASE64 ? "Amiri" : "helvetica",
        fontSize: 10,
        cellPadding: 2,
        overflow: "linebreak",
        halign: "center",
        valign: "middle"
      },
      headStyles: { halign: "center" },
      bodyStyles: { halign: "center" },
      margin: { left: margin, right: margin }
    });

    // 3 سطور فراغ تحت الجدول
    const afterTableY = doc.lastAutoTable.finalY + 10;

    doc.setLineDashPattern([2, 2], 0);
    doc.roundedRect(margin, afterTableY, boxW, 14, 3, 3);
    doc.setLineDashPattern([], 0);

    doc.setFontSize(11);
    doc.text("إجمالي الكشف:", pageW - margin - 2, afterTableY + 9, { align: "right" });
    doc.setFontSize(12);
    doc.text(String(inv.total ?? 0), margin + 6, afterTableY + 9, { align: "left" });

    const footerY = afterTableY + 20;
    doc.roundedRect(margin, footerY, boxW, 26, 4, 4);
    doc.setFontSize(10);
    doc.text("تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك", pageW / 2, footerY + 9, { align: "center" });
    doc.setFontSize(9);
    doc.text("شركة الحايك: تجارة عامة / توزيع جملة / دعاية و اعلان / طباعة / حلول رقمية", pageW / 2, footerY + 15, { align: "center" });
    doc.setFontSize(12);
    doc.roundedRect(pageW/2 - 20, footerY + 18, 40, 8, 3, 3);
    doc.text("05510217646", pageW / 2, footerY + 24, { align: "center" });

    const fileName = `HAYEK_SPOT_${inv.username}_${(inv.customer || "invoice")}_${inv.id}.pdf`;
    doc.save(fileName);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  btnAdminLogin.addEventListener("click", adminLogin);
  btnAdminLogout.addEventListener("click", adminLogout);

  btnAddUser.addEventListener("click", addUser);
  btnRefreshUsers.addEventListener("click", async () => {
    await refreshUsers();
    await fillUsersDropdown();
  });

  btnToday.addEventListener("click", setTodayRange);
  btnLast7.addEventListener("click", setLast7Range);

  btnLoadInvoices.addEventListener("click", loadInvoices);
  btnOpenInvoice.addEventListener("click", openSelectedInvoice);
  btnExportInvoicePdf.addEventListener("click", exportInvoicePdf);

  (async function init() {
    setAdminUI();
    setLast7Range();
    if (isAdminLogged()) {
      await refreshUsers();
      await fillUsersDropdown();
      setStatus("جاهز");
    } else {
      setStatus("جاهز — سجّل دخول Admin");
    }
  })();
})();
