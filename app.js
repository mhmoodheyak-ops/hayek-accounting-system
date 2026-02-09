// app.js (بدون import)
(function () {
  const { createClient } = supabase;
  const cfg = window.APP_CONFIG || {};
  const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const $ = (id) => document.getElementById(id);

  // UI refs
  const loginCard = $("loginCard");
  const mainCard = $("mainCard");
  const loginBtn = $("loginBtn");
  const logoutBtn = $("logoutBtn");
  const loginMsg = $("loginMsg");

  const onlineBadge = $("onlineBadge");

  const expr = $("expr");
  const resultEl = $("result");
  const pad = $("pad");
  const clearLine = $("clearLine");
  const linePerOp = $("linePerOp");
  const vibrate = $("vibrate");

  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panes = {
    calc: $("tab-calc"),
    ops: $("tab-ops"),
    inv: $("tab-inv"),
    tools: $("tab-tools"),
  };

  const opsList = $("opsList");
  const clearOps = $("clearOps");

  // Invoice
  const customerName = $("customerName");
  const invStatus = $("invStatus");
  const openInvoiceBtn = $("openInvoice");
  const closeInvoiceBtn = $("closeInvoice");
  const exportPdfBtn = $("exportPdf");
  const invUser = $("invUser");
  const invCustomer = $("invCustomer");
  const invId = $("invId");
  const invDate = $("invDate");
  const invBody = $("invBody");
  const invTotal = $("invTotal");
  const invMsg = $("invMsg");

  // Tools
  const copyResultBtn = $("copyResult");
  const copyAsTableBtn = $("copyAsTable");
  const syncNowBtn = $("syncNow");
  const toolsMsg = $("toolsMsg");

  // Local storage
  const LS = {
    OPS: "HS_OPS",
    CURRENT_INV: "HS_CURRENT_INV",
    PENDING: "HS_PENDING_SYNC",
  };

  function setMsg(el, text, ok = true) {
    el.textContent = text || "";
    el.className = "msg " + (ok ? "ok" : "bad");
  }

  function vib() {
    if (!vibrate.checked) return;
    try { navigator.vibrate(10); } catch {}
  }

  function isOnline() { return navigator.onLine; }
  function refreshOnlineBadge() {
    onlineBadge.classList.toggle("off", !isOnline());
    onlineBadge.title = isOnline() ? "Online" : "Offline";
  }
  window.addEventListener("online", () => { refreshOnlineBadge(); syncPending(); });
  window.addEventListener("offline", refreshOnlineBadge);

  function loadOps() {
    try { return JSON.parse(localStorage.getItem(LS.OPS) || "[]"); } catch { return []; }
  }
  function saveOps(arr) {
    localStorage.setItem(LS.OPS, JSON.stringify(arr));
  }

  function loadPending() {
    try { return JSON.parse(localStorage.getItem(LS.PENDING) || "[]"); } catch { return []; }
  }
  function savePending(arr) {
    localStorage.setItem(LS.PENDING, JSON.stringify(arr));
  }

  function getSession() { return window.HSAuth.getSession(); }
  function deviceId() { return window.HSAuth.getDeviceId(); }

  // ---- Login once per device (يحفظ session محليًا) ----
  async function login(username, pass) {
    setMsg(loginMsg, "جارِ التحقق...", true);

    // تحقق من المستخدم في app_users
    const { data, error } = await sb
      .from("app_users")
      .select("id, username, pass, blocked")
      .eq("username", username)
      .limit(1)
      .maybeSingle();

    if (error) return setMsg(loginMsg, "خطأ اتصال بقاعدة البيانات", false);
    if (!data) return setMsg(loginMsg, "المستخدم غير موجود", false);
    if (data.blocked) return setMsg(loginMsg, "هذا المستخدم محظور", false);
    if ((data.pass || "") !== (pass || "")) return setMsg(loginMsg, "كلمة السر غير صحيحة", false);

    // تسجيل session محليًا (بدون كلمة مرور)
    window.HSAuth.setSession({
      username: data.username,
      user_id: data.id,
      device_id: deviceId(),
      ts: Date.now()
    });

    setMsg(loginMsg, "تم تسجيل الدخول بنجاح ✅", true);
    showApp();
  }

  function showApp() {
    loginCard.style.display = "none";
    mainCard.style.display = "block";

    const sess = getSession();
    invUser.textContent = sess?.username || "";
    refreshOnlineBadge();
    renderOps();
    renderInvoice();
    syncPending();
  }

  function showLogin() {
    loginCard.style.display = "block";
    mainCard.style.display = "none";
  }

  // ---- Tabs ----
  function setTab(name) {
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    Object.keys(panes).forEach(k => panes[k].classList.toggle("active", k === name));
  }
  tabs.forEach(t => t.addEventListener("click", () => setTab(t.dataset.tab)));

  // ---- Calculator eval (آمن نسبيًا) ----
  function safeEval(input) {
    const s = (input || "").replace(/[×]/g, "*").replace(/[÷]/g, "/").trim();
    if (!s) return { ok: true, val: 0 };

    // فقط أرقام وعمليات وأقواس ونقطة ومسافات
    if (!/^[0-9+\-*/().\s]+$/.test(s)) return { ok: false, err: "صيغة غير مسموحة" };

    try {
      // eslint-disable-next-line no-new-func
      const v = Function('"use strict";return (' + s + ")")();
      if (!isFinite(v)) return { ok: false, err: "نتيجة غير صالحة" };
      return { ok: true, val: v };
    } catch {
      return { ok: false, err: "خطأ بالعملية" };
    }
  }

  function updateResult() {
    const out = safeEval(expr.value);
    resultEl.textContent = out.ok ? String(out.val) : "خطأ";
  }

  expr.addEventListener("input", updateResult);
  expr.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitOperation();
    }
  });

  function insertAtCursor(input, text) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const p = start + text.length;
    input.setSelectionRange(p, p);
    input.focus();
    updateResult();
  }

  pad.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const k = btn.dataset.k;
    if (!k) return;

    vib();

    if (k === "Backspace") {
      const start = expr.selectionStart ?? expr.value.length;
      const end = expr.selectionEnd ?? expr.value.length;
      if (start !== end) {
        expr.value = expr.value.slice(0, start) + expr.value.slice(end);
        expr.setSelectionRange(start, start);
      } else if (start > 0) {
        expr.value = expr.value.slice(0, start - 1) + expr.value.slice(start);
        expr.setSelectionRange(start - 1, start - 1);
      }
      expr.focus();
      updateResult();
      return;
    }

    if (k === "=") {
      commitOperation();
      return;
    }

    if (k === "±") {
      // قلب الإشارة على آخر رقم/جزء بسيط
      const v = expr.value.trim();
      if (!v) { insertAtCursor(expr, "-"); return; }
      if (v.startsWith("-")) expr.value = v.slice(1);
      else expr.value = "-" + v;
      expr.focus();
      updateResult();
      return;
    }

    insertAtCursor(expr, k);
  });

  clearLine.addEventListener("click", () => {
    vib();
    expr.value = "";
    updateResult();
  });

  // ---- Ops ----
  function addOp(op) {
    const arr = loadOps();
    arr.unshift(op);
    saveOps(arr);

    // لو في فاتورة مفتوحة -> ضيفها للفاتورة
    const inv = loadCurrentInv();
    if (inv && inv.status === "open") {
      inv.items.push(op);
      inv.total = calcInvoiceTotal(inv.items);
      saveCurrentInv(inv);
      renderInvoice();
    }

    renderOps();
  }

  function renderOps() {
    const arr = loadOps().slice(0, 100);
    opsList.innerHTML = "";
    if (!arr.length) {
      opsList.innerHTML = `<div class="empty">لا يوجد عمليات بعد</div>`;
      return;
    }
    for (const it of arr) {
      const div = document.createElement("div");
      div.className = "oprow";
      div.innerHTML = `
        <div class="op-time">${it.time}</div>
        <div class="op-exp">${escapeHtml(it.expression)}</div>
        <div class="op-res">${escapeHtml(String(it.result))}</div>
      `;
      opsList.appendChild(div);
    }
  }

  clearOps.addEventListener("click", () => {
    saveOps([]);
    renderOps();
    // لا تمسح الفاتورة المفتوحة
  });

  function nowStr() {
    const d = new Date();
    const pad2 = (n) => String(n).padStart(2, "0");
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${d.getFullYear()}/${pad2(d.getMonth()+1)}/${pad2(d.getDate())}`;
  }

  function commitOperation() {
    vib();
    const out = safeEval(expr.value);
    if (!out.ok) {
      resultEl.textContent = "خطأ";
      return;
    }

    const sess = getSession();
    const op = {
      username: sess.username,
      user_id: sess.user_id,
      device_id: sess.device_id,
      time: nowStr(),
      label: "عملية",
      expression: expr.value.trim(),
      result: out.val
    };

    // إذا خيار "كل عملية بسطر" -> امسح السطر بعد الإدخال
    if (linePerOp.checked) expr.value = "";

    updateResult();
    addOp(op);

    // حفظ محلي (للمزامنة)
    queuePending({ type: "op", payload: op });
    syncPending();
  }

  // ---- Invoice local ----
  function loadCurrentInv() {
    try { return JSON.parse(localStorage.getItem(LS.CURRENT_INV) || "null"); } catch { return null; }
  }
  function saveCurrentInv(inv) {
    localStorage.setItem(LS.CURRENT_INV, JSON.stringify(inv));
  }

  function calcInvoiceTotal(items) {
    // إجمالي الكشف = مجموع النتائج فقط
    return items.reduce((sum, it) => sum + (Number(it.result) || 0), 0);
  }

  function renderInvoice() {
    const sess = getSession();
    let inv = loadCurrentInv();

    if (!inv) {
      inv = {
        id: null,
        created_at: null,
        status: "open",
        customer_name: "",
        items: [],
        total: 0
      };
      saveCurrentInv(inv);
    }

    invCustomer.textContent = inv.customer_name || "";
    invId.textContent = inv.id || "—";
    invDate.textContent = inv.created_at || "—";
    invUser.textContent = sess?.username || "";

    invBody.innerHTML = "";
    for (const it of inv.items) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(it.time)}</td>
        <td>${escapeHtml(it.label || "")}</td>
        <td>${escapeHtml(it.expression)}</td>
        <td>${escapeHtml(String(it.result))}</td>
      `;
      invBody.appendChild(tr);
    }
    invTotal.textContent = String(inv.total || 0);

    // UI controls
    invStatus.value = inv.status || "open";
    customerName.value = inv.customer_name || "";
  }

  customerName.addEventListener("input", () => {
    const inv = loadCurrentInv();
    if (!inv) return;
    inv.customer_name = customerName.value;
    saveCurrentInv(inv);
    renderInvoice();
  });

  invStatus.addEventListener("change", () => {
    const inv = loadCurrentInv();
    if (!inv) return;
    inv.status = invStatus.value;
    saveCurrentInv(inv);
    renderInvoice();
  });

  openInvoiceBtn.addEventListener("click", () => {
    const inv = {
      id: null,
      created_at: null,
      status: "open",
      customer_name: customerName.value || "",
      items: [],
      total: 0
    };
    saveCurrentInv(inv);
    renderInvoice();
    setMsg(invMsg, "تم فتح فاتورة جديدة ✅", true);
  });

  closeInvoiceBtn.addEventListener("click", async () => {
    const inv = loadCurrentInv();
    if (!inv) return;

    inv.status = "closed";
    saveCurrentInv(inv);
    renderInvoice();

    // جهز عملية رفع الفاتورة (حتى لو أوفلاين)
    const sess = getSession();
    const payload = {
      username: sess.username,
      device_id: sess.device_id,
      total: inv.total || 0,
      customer_name: inv.customer_name || null,
      status: "closed",
      created_at: inv.created_at ? inv.created_at : null, // نخليه null وخلي السيرفر now()
      items: inv.items || []
    };

    queuePending({ type: "invoice", payload });
    syncPending();
    setMsg(invMsg, "تم إغلاق الفاتورة (ستُرفع عند توفر الإنترنت) ✅", true);
  });

  // ---- PDF export (jsPDF + Amiri) ----
  exportPdfBtn.addEventListener("click", () => {
    try {
      const inv = loadCurrentInv();
      if (!inv) return;

      const sess = getSession();
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) {
        setMsg(invMsg, "jsPDF غير محمّل", false);
        return;
      }

      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

      // تحميل خط Amiri
      if (window.AMIRI_BASE64) {
        doc.addFileToVFS("Amiri-Regular.ttf", window.AMIRI_BASE64);
        doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
        doc.setFont("Amiri");
      } else {
        // بدون خط عربي = قد تتخرب العربية
        doc.setFont("helvetica", "normal");
      }

      doc.setFontSize(16);
      doc.text("شركة الحايك — HAYEK SPOT", 40, 50, { align: "left" });

      doc.setFontSize(12);
      doc.text(`اسم المستخدم: ${sess.username}`, 40, 80);
      doc.text(`اسم العميل: ${inv.customer_name || "—"}`, 40, 100);
      doc.text(`الحالة: ${inv.status}`, 40, 120);

      // جدول العمليات
      const rows = (inv.items || []).map(it => [it.time, it.label || "", it.expression, String(it.result)]);
      doc.autoTable({
        head: [["الوقت", "البيان", "العملية", "النتيجة"]],
        body: rows,
        startY: 140,
        styles: { font: window.AMIRI_BASE64 ? "Amiri" : "helvetica", fontSize: 10 },
        headStyles: { font: window.AMIRI_BASE64 ? "Amiri" : "helvetica" },
        bodyStyles: { font: window.AMIRI_BASE64 ? "Amiri" : "helvetica" }
      });

      const y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 200;
      doc.setFontSize(14);
      doc.text(`إجمالي الكشف: ${String(inv.total || 0)}`, 40, y);

      doc.setFontSize(10);
      doc.text("تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك — 05510217646", 40, y + 25);

      doc.save(`HAYEK_SPOT_${Date.now()}.pdf`);
      setMsg(invMsg, "تم تصدير PDF ✅", true);
    } catch (e) {
      setMsg(invMsg, "فشل تصدير PDF", false);
    }
  });

  // ---- Tools ----
  copyResultBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(String(resultEl.textContent || "0"));
      setMsg(toolsMsg, "تم نسخ النتيجة ✅", true);
    } catch {
      setMsg(toolsMsg, "تعذر النسخ", false);
    }
  });

  copyAsTableBtn.addEventListener("click", async () => {
    try {
      const inv = loadCurrentInv();
      const rows = (inv?.items || []).map(it => `${it.time}\t${it.label || ""}\t${it.expression}\t${it.result}`).join("\n");
      const head = "الوقت\tالبيان\tالعملية\tالنتيجة\n";
      await navigator.clipboard.writeText(head + rows);
      setMsg(toolsMsg, "تم نسخ كجدول ✅", true);
    } catch {
      setMsg(toolsMsg, "تعذر النسخ", false);
    }
  });

  syncNowBtn.addEventListener("click", () => syncPending(true));

  // ---- Pending sync (Offline) ----
  function queuePending(item) {
    const arr = loadPending();
    arr.push({ ...item, queued_at: Date.now() });
    savePending(arr);
  }

  async function syncPending(showToast = false) {
    if (!isOnline()) {
      if (showToast) setMsg(toolsMsg, "أنت أوفلاين — سيتم الرفع عند رجوع النت", false);
      return;
    }

    const pending = loadPending();
    if (!pending.length) {
      if (showToast) setMsg(toolsMsg, "لا يوجد شيء للمزامنة", true);
      return;
    }

    let left = [];
    for (const item of pending) {
      try {
        if (item.type === "op") {
          // عمليات بدون invoice_id (تبقى سجل)
          const { error } = await sb.from("app_operations").insert([{
            username: item.payload.username,
            user_id: item.payload.user_id,
            label: item.payload.label || "عملية",
            operation: item.payload.expression,
            result: String(item.payload.result),
            device_id: item.payload.device_id,
            note: null,
            expression: item.payload.expression,
            invoice_id: null
          }]);
          if (error) throw error;
        }

        if (item.type === "invoice") {
          // 1) إنشاء فاتورة
          const inv = item.payload;
          const { data: invRow, error: invErr } = await sb.from("app_invoices").insert([{
            username: inv.username,
            device_id: inv.device_id,
            total: inv.total || 0,
            customer_name: inv.customer_name,
            status: inv.status || "closed"
          }]).select("id, created_at").single();
          if (invErr) throw invErr;

          // 2) ربط العمليات بالفاتورة
          const ops = (inv.items || []).map(it => ({
            username: inv.username,
            user_id: null,
            label: it.label || "عملية",
            operation: it.expression,
            result: String(it.result),
            device_id: inv.device_id,
            note: null,
            expression: it.expression,
            invoice_id: invRow.id
          }));
          if (ops.length) {
            const { error: opsErr } = await sb.from("app_operations").insert(ops);
            if (opsErr) throw opsErr;
          }
        }
      } catch {
        left.push(item);
      }
    }

    savePending(left);
    if (showToast) {
      setMsg(toolsMsg, left.length ? "تمت مزامنة جزئية — بقي عناصر ستُعاد لاحقًا" : "تمت المزامنة بالكامل ✅", !left.length);
    }
  }

  // ---- Logout ----
  logoutBtn.addEventListener("click", () => {
    window.HSAuth.clearSession();
    showLogin();
  });

  loginBtn.addEventListener("click", () => {
    const u = ($("loginUser").value || "").trim();
    const p = ($("loginPass").value || "").trim();
    if (!u || !p) return setMsg(loginMsg, "أدخل اسم المستخدم وكلمة السر", false);
    login(u, p);
  });

  // ---- Helpers ----
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  // ---- Boot ----
  (function boot() {
    refreshOnlineBadge();
    const sess = getSession();
    if (sess && sess.username) showApp();
    else showLogin();
    updateResult();
  })();

})();
