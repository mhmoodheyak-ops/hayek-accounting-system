// admin.js
(() => {
  "use strict";

  // =========================
  // Config + Supabase
  // =========================
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG || {};
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    alert('config.js غير مضبوط (SUPABASE_URL / SUPABASE_ANON_KEY)');
    return;
  }
  if (!window.supabase?.createClient) {
    alert("Supabase UMD غير محمّل");
    return;
  }
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // =========================
  // Helpers
  // =========================
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
  const usersTableBody = el("usersTable")?.querySelector("tbody");

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

  const SESSION_KEY = "HAYEK_ADMIN_SESSION_V2";
  const DEVICE_KEY = "HAYEK_DEVICE_ID_V1";

  function setStatus(msg, ok = true) {
    if (statusLine) {
      statusLine.textContent = msg;
      statusLine.style.color = ok ? "#bfffd9" : "#ffd1d1";
    }
  }

  function setAdminPill(text, ok) {
    if (!adminStatePill) return;
    adminStatePill.textContent = text;
    adminStatePill.classList.remove("ok", "bad");
    adminStatePill.classList.add(ok ? "ok" : "bad");
  }

  function nowLocalDateStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function dateToRange(fromStr, toStr) {
    // inclusive [from 00:00:00, to+1day 00:00:00)
    const from = fromStr ? new Date(fromStr + "T00:00:00") : null;
    const to = toStr ? new Date(toStr + "T00:00:00") : null;
    let toExclusive = null;
    if (to) {
      toExclusive = new Date(to.getTime());
      toExclusive.setDate(toExclusive.getDate() + 1);
    }
    return { from, toExclusive };
  }

  function fmtDateTime(dtLike) {
    const d = new Date(dtLike);
    if (Number.isNaN(d.getTime())) return String(dtLike || "");
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toNumber(v) {
    if (v === null || v === undefined) return 0;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }

  function calcInvoiceTotal(ops) {
    // ✅ FIX نهائي: مجموع كل النتائج
    return (ops || []).reduce((sum, r) => sum + toNumber(r.result), 0);
  }

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "dev_" + cryptoRandomString(36);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function cryptoRandomString(len) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    let out = "";
    for (let i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length];
    return out;
  }

  function saveSession(sessionObj) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionObj));
  }

  function loadSession() {
    try {
      const s = localStorage.getItem(SESSION_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isLoggedIn() {
    const s = loadSession();
    return !!(s && s.username && s.loggedIn);
  }

  function requireLoginOrAlert() {
    if (!isLoggedIn()) {
      alert("سجل دخول الأدمن أولاً");
      return false;
    }
    return true;
  }

  // =========================
  // Admin Login with device lock
  // =========================
  async function adminLogin() {
    const u = (adminUser?.value || "").trim();
    const p = (adminPass?.value || "").trim();
    if (!u || !p) {
      setStatus("أدخل اسم المستخدم وكلمة السر", false);
      return;
    }

    setStatus("جاري التحقق...");
    const deviceId = getDeviceId();

    // read user
    const { data, error } = await supabase
      .from("app_users")
      .select("id, username, pass, is_admin, blocked, device_id")
      .eq("username", u)
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setStatus("فشل تسجيل الدخول", false);
      setAdminPill("غير مسجل", false);
      return;
    }

    if (!data.is_admin) {
      setStatus("هذا الحساب ليس Admin", false);
      setAdminPill("غير مسجل", false);
      return;
    }

    if (data.blocked) {
      setStatus("الحساب محظور", false);
      setAdminPill("غير مسجل", false);
      return;
    }

    if (String(data.pass || "") !== p) {
      setStatus("كلمة السر خاطئة", false);
      setAdminPill("غير مسجل", false);
      return;
    }

    // device lock
    if (data.device_id && data.device_id !== deviceId) {
      setStatus("الحالة: Admin مستخدم على جهاز آخر", false);
      setAdminPill("مقفل", false);
      return;
    }

    // set device if empty
    if (!data.device_id) {
      const { error: upErr } = await supabase
        .from("app_users")
        .update({ device_id: deviceId })
        .eq("id", data.id);
      if (upErr) console.warn("device_id update failed:", upErr);
    }

    saveSession({ loggedIn: true, username: u, ts: Date.now() });
    setStatus("تم تسجيل الدخول بنجاح ✅");
    setAdminPill("مفتوح", true);

    await refreshUsers();
    await refreshPickUserOptions();
  }

  async function adminLogout() {
    clearSession();
    setStatus("تم تسجيل الخروج");
    setAdminPill("غير مسجل", false);
  }

  // =========================
  // Users Management
  // =========================
  async function refreshUsers() {
    if (!requireLoginOrAlert()) return;

    setStatus("تحديث المستخدمين...");
    const { data, error } = await supabase
      .from("app_users")
      .select("id, username, is_admin, blocked, device_id, created_at")
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      setStatus("فشل تحديث المستخدمين", false);
      return;
    }

    if (usersCount) usersCount.textContent = String(data?.length || 0);

    if (!usersTableBody) {
      setStatus("تم تحديث المستخدمين ✅");
      return;
    }

    usersTableBody.innerHTML = "";
    (data || []).forEach((u, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="white-space:nowrap">${idx + 1}</td>
        <td style="white-space:nowrap; max-width:280px; overflow:hidden; text-overflow:ellipsis">
          ${escapeHtml(u.username)}
        </td>
        <td style="white-space:nowrap">${u.is_admin ? "TRUE" : "FALSE"}</td>
        <td style="white-space:nowrap">${u.blocked ? "TRUE" : "FALSE"}</td>
        <td style="white-space:nowrap">${u.device_id ? "مقفل" : "حر"}</td>
        <td style="white-space:nowrap; display:flex; gap:8px; flex-wrap:wrap">
          <button class="btn btn-sm" data-act="pick" data-id="${u.id}" data-username="${escapeHtml(u.username)}">اختر</button>
          <button class="btn btn-sm" data-act="toggleBlock" data-id="${u.id}" data-blocked="${u.blocked ? "1" : "0"}">${u.blocked ? "فك الحظر" : "حظر"}</button>
          <button class="btn btn-sm" data-act="unlock" data-id="${u.id}">فك ربط الجهاز</button>
          <button class="btn btn-sm danger" data-act="del" data-id="${u.id}" data-username="${escapeHtml(u.username)}">حذف</button>
        </td>
      `;
      usersTableBody.appendChild(tr);
    });

    setStatus("تم تحديث المستخدمين ✅");
  }

  async function refreshPickUserOptions() {
    if (!pickUser) return;
    const { data, error } = await supabase
      .from("app_users")
      .select("username, is_admin, blocked")
      .order("username", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    const current = pickUser.value;
    pickUser.innerHTML = `<option value="">اختر المستخدم</option>`;
    (data || [])
      .filter((u) => !u.is_admin)
      .forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u.username;
        opt.textContent = u.username;
        pickUser.appendChild(opt);
      });

    if (current) pickUser.value = current;
  }

  async function addUser() {
    if (!requireLoginOrAlert()) return;
    const u = (newUsername?.value || "").trim();
    const p = (newPassword?.value || "").trim();
    const role = (newRole?.value || "user").trim();
    if (!u || !p) {
      alert("أدخل اسم مستخدم وكلمة سر");
      return;
    }

    const is_admin = role === "admin";
    const { error } = await supabase.from("app_users").insert([
      {
        username: u,
        pass: p,
        is_admin,
        blocked: false,
        created_at: new Date().toISOString(),
        device_id: null,
      },
    ]);

    if (error) {
      console.error(error);
      alert("فشل إضافة المستخدم");
      return;
    }

    newUsername.value = "";
    newPassword.value = "";
    await refreshUsers();
    await refreshPickUserOptions();
    alert("تمت الإضافة ✅");
  }

  async function toggleBlockUser(userId, currentlyBlocked) {
    if (!requireLoginOrAlert()) return;
    const { error } = await supabase
      .from("app_users")
      .update({ blocked: !currentlyBlocked })
      .eq("id", userId);

    if (error) {
      console.error(error);
      alert("فشل التحديث");
      return;
    }
    await refreshUsers();
    await refreshPickUserOptions();
  }

  async function unlockDevice(userId) {
    if (!requireLoginOrAlert()) return;
    const { error } = await supabase.from("app_users").update({ device_id: null }).eq("id", userId);
    if (error) {
      console.error(error);
      alert("فشل فك الربط");
      return;
    }
    await refreshUsers();
  }

  async function deleteUser(userId, username) {
    if (!requireLoginOrAlert()) return;
    if (!confirm(`حذف المستخدم: ${username} ؟`)) return;

    const { error } = await supabase.from("app_users").delete().eq("id", userId);
    if (error) {
      console.error(error);
      alert("فشل الحذف");
      return;
    }
    await refreshUsers();
    await refreshPickUserOptions();
  }

  // delegate buttons in users table
  function onUsersTableClick(e) {
    const btn = e.target?.closest("button");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");
    if (!act || !id) return;

    if (act === "pick") {
      const u = btn.getAttribute("data-username") || "";
      if (pickUser) {
        pickUser.value = u;
        setStatus(`تم اختيار المستخدم: ${u} ✅`);
      }
      return;
    }

    if (act === "toggleBlock") {
      const blocked = btn.getAttribute("data-blocked") === "1";
      toggleBlockUser(id, blocked);
      return;
    }

    if (act === "unlock") {
      unlockDevice(id);
      return;
    }

    if (act === "del") {
      const u = btn.getAttribute("data-username") || "";
      deleteUser(id, u);
      return;
    }
  }

  // =========================
  // Invoices (admin)
  // =========================
  function setInvoicesUiVisible() {
    if (!invoiceSelect) return;
    // ✅ حل الغباش/الشفافية في القائمة المنسدلة (حتى لو CSS عاملها باهتة)
    invoiceSelect.style.opacity = "1";
    invoiceSelect.style.background = "#ffffff";
    invoiceSelect.style.color = "#111111";
    invoiceSelect.style.fontWeight = "700";
  }

  function setTodayRange() {
    const d = nowLocalDateStr();
    if (fromDate) fromDate.value = d;
    if (toDate) toDate.value = d;
  }

  function setLast7Range() {
    const now = new Date();
    const start = new Date(now.getTime());
    start.setDate(start.getDate() - 6); // last 7 days inclusive
    const yyyy = start.getFullYear();
    const mm = String(start.getMonth() + 1).padStart(2, "0");
    const dd = String(start.getDate()).padStart(2, "0");
    if (fromDate) fromDate.value = `${yyyy}-${mm}-${dd}`;
    if (toDate) toDate.value = nowLocalDateStr();
  }

  async function loadInvoicesForSelectedUser() {
    if (!requireLoginOrAlert()) return;
    if (!pickUser?.value) {
      alert("اختر المستخدم أولاً");
      return;
    }

    setInvoicesUiVisible();
    setStatus("جاري جلب الفواتير...");

    const username = pickUser.value;
    const st = (pickStatus?.value || "all").trim();
    const { from, toExclusive } = dateToRange(fromDate?.value || "", toDate?.value || "");

    let q = supabase
      .from("app_invoices")
      .select("id, username, customer_name, customer, total, status, created_at")
      .eq("username", username)
      .order("created_at", { ascending: false });

    if (st && st !== "all") q = q.eq("status", st);
    if (from) q = q.gte("created_at", from.toISOString());
    if (toExclusive) q = q.lt("created_at", toExclusive.toISOString());

    const { data, error } = await q;

    if (error) {
      console.error(error);
      setStatus("فشل جلب الفواتير", false);
      return;
    }

    const invoices = data || [];
    if (invCount) invCount.textContent = String(invoices.length);

    if (!invoiceSelect) return;

    invoiceSelect.innerHTML = `<option value="">اختر فاتورة</option>`;

    // ✅ المطلوب: ضمن القائمة المنسدلة يظهر اسم العميل + قيمة الفاتورة
    invoices.forEach((inv) => {
      const cust = inv.customer_name || inv.customer || "بدون اسم";
      const time = fmtDateTime(inv.created_at);
      const statusTxt = inv.status || "";
      const total = (inv.total ?? 0);
      const opt = document.createElement("option");
      opt.value = inv.id;
      opt.textContent = `(${statusTxt}) — ${cust} — ${total} — ${time}`;
      opt.style.color = "#111";
      opt.style.background = "#fff";
      invoiceSelect.appendChild(opt);
    });

    setStatus("تم تحميل الفواتير ✅");
  }

  // =========================
  // Invoice Preview (HTML)
  // =========================
  function renderAdminInvoicePreview(inv, ops) {
    if (!invoicePreview) return;

    const username = inv?.username || "";
    const customerName = inv?.customer_name || inv?.customer || "";
    const invoiceId = inv?.id || "";
    const createdAt = inv?.created_at ? fmtDateTime(inv.created_at) : "";

    // ✅ FIX: إجمالي الكشف الصحيح من العمليات
    const computedTotal = calcInvoiceTotal(ops);

    const rowsHtml = (ops || [])
      .map((r) => {
        const t = r.created_at ? fmtDateTime(r.created_at) : "";
        const label = escapeHtml(r.label || "");
        const op = escapeHtml(r.operation || r.expression || "");
        const res = escapeHtml(r.result ?? "");
        return `
          <tr>
            <td>${t}</td>
            <td>${label}</td>
            <td>${op}</td>
            <td>${res}</td>
          </tr>
        `;
      })
      .join("");

    invoicePreview.innerHTML = `
      <div style="background:#fff;border-radius:18px;padding:18px;border:2px solid #111;max-width:820px;margin:0 auto;font-family:Arial,'Amiri',sans-serif;direction:rtl">

        <div style="border:2px solid #111;border-radius:18px;padding:18px;text-align:center;margin-bottom:14px">
          <div style="font-size:22px;font-weight:900">شركة الحايك</div>
          <div style="font-size:14px;font-weight:800;color:#0a7a52;letter-spacing:1px">HAYEK SPOT</div>
        </div>

        <div style="border:2px solid #111;border-radius:18px;padding:12px;margin-bottom:10px;display:flex;justify-content:space-between;gap:10px">
          <div style="font-weight:700;color:#666">اسم المستخدم</div>
          <div style="font-weight:900">${escapeHtml(username)}</div>
        </div>

        <div style="border:2px solid #111;border-radius:18px;padding:12px;margin-bottom:10px;display:flex;justify-content:space-between;gap:10px">
          <div style="font-weight:700;color:#666">اسم العميل</div>
          <div style="font-weight:900">${escapeHtml(customerName)}</div>
        </div>

        <div style="border:2px solid #111;border-radius:18px;padding:12px;margin-bottom:10px;display:flex;justify-content:space-between;gap:10px">
          <div style="font-weight:700;color:#666">رقم الفاتورة</div>
          <div style="font-weight:900;direction:ltr;text-align:left">${escapeHtml(invoiceId)}</div>
        </div>

        <div style="border:2px solid #111;border-radius:18px;padding:12px;margin-bottom:18px;display:flex;justify-content:space-between;gap:10px">
          <div style="font-weight:700;color:#666">التاريخ</div>
          <div style="font-weight:900">${escapeHtml(createdAt)}</div>
        </div>

        <!-- ✅ 3 أسطر فراغ فوق الجدول -->
        <div style="height:36px"></div>

        <div style="border:2px solid #111;border-radius:18px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
              <tr style="background:#f2f2f2">
                <th style="padding:10px;border-left:1px solid #ccc;text-align:center">الوقت</th>
                <th style="padding:10px;border-left:1px solid #ccc;text-align:center">البيان</th>
                <th style="padding:10px;border-left:1px solid #ccc;text-align:center">العملية</th>
                <th style="padding:10px;text-align:center">النتيجة</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="4" style="padding:14px;text-align:center;color:#666">لا يوجد بيانات</td></tr>`}
            </tbody>
          </table>
        </div>

        <!-- ✅ 3 أسطر فراغ تحت الجدول -->
        <div style="height:36px"></div>

        <div style="border:2px dashed #111;border-radius:18px;padding:14px;display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:18px;font-weight:900">${computedTotal}</div>
          <div style="font-size:18px;font-weight:900">إجمالي الكشف:</div>
        </div>

        <div style="border:2px solid #111;border-radius:18px;padding:14px;margin-top:14px;text-align:center">
          <div style="font-size:13px;color:#444;font-weight:800">تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك</div>
          <div style="font-size:12px;color:#444;margin-top:6px">شركة الحايك: تجارة عامة / توزيع جملة / دعاية وإعلان / طباعة / حلول رقمية</div>
          <div style="display:inline-block;margin-top:10px;border:2px solid #0a7a52;border-radius:14px;padding:8px 18px;font-weight:900;color:#0a7a52">
            05510217646
          </div>
        </div>

      </div>
    `;

    // حفظ آخر فاتورة مفتوحة للاستخدام في PDF
    window.__HAYEK_LAST_INVOICE__ = { inv, ops, computedTotal };
  }

  // =========================
  // Open Selected Invoice
  // =========================
  async function openSelectedInvoice() {
    if (!requireLoginOrAlert()) return;
    if (!invoiceSelect?.value) {
      alert("اختر فاتورة أولاً");
      return;
    }

    setStatus("جاري فتح الفاتورة...");
    const invoiceId = invoiceSelect.value;

    const { data: inv, error: invErr } = await supabase
      .from("app_invoices")
      .select("id, username, customer_name, customer, created_at, total, status")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr || !inv) {
      console.error(invErr);
      setStatus("تعذر جلب الفاتورة", false);
      return;
    }

    const { data: ops, error: opsErr } = await supabase
      .from("app_operations")
      .select("label, operation, expression, result, created_at, invoice_id")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true });

    if (opsErr) {
      console.error(opsErr);
      setStatus("تعذر جلب عمليات الفاتورة", false);
      return;
    }

    renderAdminInvoicePreview(inv, ops || []);
    setStatus("تم فتح الفاتورة ✅");
  }

  // =========================
  // PDF Export (Arabic + not empty)
  // =========================
  function arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  async function ensureAmiriFont(doc) {
    // يحمل الخط من ملف Amiri-Regular.ttf الموجود في الريبو
    // ويضيفه لـ jsPDF (بدون الاعتماد على amiri-font.js)
    if (doc.__AMIRI_READY__) return;

    const res = await fetch("./Amiri-Regular.ttf", { cache: "no-store" });
    if (!res.ok) throw new Error("فشل تحميل Amiri-Regular.ttf");
    const buf = await res.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);

    doc.addFileToVFS("Amiri-Regular.ttf", b64);
    doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    doc.setFont("Amiri", "normal");

    doc.__AMIRI_READY__ = true;
  }

  async function exportInvoicePdf() {
    if (!requireLoginOrAlert()) return;

    const payload = window.__HAYEK_LAST_INVOICE__;
    if (!payload?.inv) {
      alert("افتح الفاتورة أولاً");
      return;
    }

    // ✅ يمنع PDF فارغ: نولّد PDF من البيانات مباشرة (مو من HTML)
    const inv = payload.inv;
    const ops = payload.ops || [];
    const total = calcInvoiceTotal(ops);

    if (!window.jspdf?.jsPDF) {
      alert("jsPDF غير محمّل");
      return;
    }

    try {
      setStatus("جاري تصدير PDF...");

      const doc = new window.jspdf.jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
      });

      // RTL إذا مدعوم
      if (typeof doc.setR2L === "function") doc.setR2L(true);

      await ensureAmiriFont(doc);

      const pageW = doc.internal.pageSize.getWidth();
      const margin = 12;

      const username = inv.username || "";
      const customerName = inv.customer_name || inv.customer || "";
      const invoiceId = inv.id || "";
      const createdAt = inv.created_at ? fmtDateTime(inv.created_at) : "";

      // Header box
      doc.setDrawColor(0);
      doc.setLineWidth(0.6);
      doc.roundedRect(margin, 12, pageW - margin * 2, 20, 4, 4);
      doc.setFontSize(16);
      doc.text("شركة الحايك", pageW / 2, 23, { align: "center" });
      doc.setFontSize(10);
      doc.text("HAYEK SPOT", pageW / 2, 28, { align: "center" });

      // info boxes
      const boxY = 36;
      const boxH = 12;
      const gap = 4;
      const boxW = pageW - margin * 2;

      function infoBox(y, label, value, ltr = false) {
        doc.roundedRect(margin, y, boxW, boxH, 4, 4);
        doc.setFontSize(10);
        doc.text(label, pageW - margin - 2, y + 7.5, { align: "right" });
        doc.setFontSize(11);
        if (ltr) {
          doc.text(String(value || ""), margin + 2, y + 7.5, { align: "left" });
        } else {
          doc.text(String(value || ""), margin + 2, y + 7.5, { align: "left" });
        }
      }

      infoBox(boxY + (boxH + gap) * 0, "اسم المستخدم", username);
      infoBox(boxY + (boxH + gap) * 1, "اسم العميل", customerName);
      infoBox(boxY + (boxH + gap) * 2, "رقم الفاتورة", invoiceId, true);
      infoBox(boxY + (boxH + gap) * 3, "التاريخ", createdAt);

      // ✅ 3 أسطر فراغ فوق الجدول
      let tableStartY = boxY + (boxH + gap) * 4 + 12;

      const head = [["الوقت", "البيان", "العملية", "النتيجة"]];
      const body = ops.map((r) => [
        r.created_at ? fmtDateTime(r.created_at) : "",
        r.label || "",
        r.operation || r.expression || "",
        String(r.result ?? ""),
      ]);

      // AutoTable
      doc.autoTable({
        startY: tableStartY,
        head,
        body: body.length ? body : [["", "لا يوجد بيانات", "", ""]],
        styles: {
          font: "Amiri",
          fontSize: 10,
          cellPadding: 2.5,
          lineColor: 200,
          lineWidth: 0.2,
          halign: "center",
          valign: "middle",
        },
        headStyles: {
          fillColor: [242, 242, 242],
          textColor: 20,
          lineWidth: 0.2,
          lineColor: 180,
          halign: "center",
        },
        columnStyles: {
          0: { halign: "center" },
          1: { halign: "center" },
          2: { halign: "center" },
          3: { halign: "center" },
        },
        margin: { left: margin, right: margin },
        didDrawPage: () => {
          // no-op
        },
      });

      // ✅ 3 أسطر فراغ تحت الجدول
      const afterTableY = (doc.lastAutoTable?.finalY || tableStartY) + 12;

      // Total dashed box
      doc.setLineDashPattern([2, 2], 0);
      doc.roundedRect(margin, afterTableY, boxW, 14, 4, 4);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(13);
      doc.text("إجمالي الكشف:", pageW - margin - 2, afterTableY + 9, { align: "right" });
      doc.text(String(total), margin + 2, afterTableY + 9, { align: "left" });

      // Footer box
      const footY = afterTableY + 18;
      doc.roundedRect(margin, footY, boxW, 20, 4, 4);
      doc.setFontSize(9);
      doc.text("تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك", pageW / 2, footY + 8, { align: "center" });
      doc.text("شركة الحايك: تجارة عامة / توزيع جملة / دعاية وإعلان / طباعة / حلول رقمية", pageW / 2, footY + 13, {
        align: "center",
      });
      doc.setFontSize(11);
      doc.text("05510217646", pageW / 2, footY + 18, { align: "center" });

      const safeId = String(invoiceId).slice(0, 8);
      doc.save(`HAYEK_SPOT_INVOICE_${safeId}.pdf`);

      setStatus("تم تصدير PDF بنجاح ✅");
    } catch (err) {
      console.error(err);
      setStatus("فشل تصدير PDF", false);
      alert("فشل تصدير PDF (راجع Console)");
    }
  }

  // =========================
  // Wire UI
  // =========================
  function wireEvents() {
    btnAdminLogin?.addEventListener("click", adminLogin);
    btnAdminLogout?.addEventListener("click", adminLogout);

    btnAddUser?.addEventListener("click", addUser);
    btnRefreshUsers?.addEventListener("click", async () => {
      await refreshUsers();
      await refreshPickUserOptions();
    });

    usersTableBody?.addEventListener("click", onUsersTableClick);

    btnToday?.addEventListener("click", () => {
      setTodayRange();
      setStatus("تم اختيار فواتير اليوم ✅");
    });

    btnLast7?.addEventListener("click", () => {
      setLast7Range();
      setStatus("تم اختيار آخر 7 أيام ✅");
    });

    btnLoadInvoices?.addEventListener("click", loadInvoicesForSelectedUser);
    btnOpenInvoice?.addEventListener("click", openSelectedInvoice);
    btnExportInvoicePdf?.addEventListener("click", exportInvoicePdf);

    // تحسين وضوح القائمة حتى لو فتحت قبل
    invoiceSelect?.addEventListener("focus", setInvoicesUiVisible);
    invoiceSelect?.addEventListener("click", setInvoicesUiVisible);
  }

  // =========================
  // Init
  // =========================
  async function init() {
    wireEvents();

    // default date range
    if (fromDate && !fromDate.value) fromDate.value = nowLocalDateStr();
    if (toDate && !toDate.value) toDate.value = nowLocalDateStr();

    setInvoicesUiVisible();

    if (isLoggedIn()) {
      setAdminPill("مفتوح", true);
      setStatus("جاهز ✅");
      await refreshUsers();
      await refreshPickUserOptions();
    } else {
      setAdminPill("غير مسجل", false);
      setStatus("سجل دخول الأدمن");
    }
  }

  init();
})();

