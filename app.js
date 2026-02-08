/* =========================================================
   HAYEK SPOT — app.js
   صفحة المستخدم (حاسبة + تسجيل عمليات + فواتير + PDF)
   Build: v2026.02.08
   ========================================================= */

(() => {
  "use strict";

  // شغّل هذا الملف فقط إذا كانت الصفحة هي صفحة المستخدم (وجود keypad أو display)
  const isAppPage =
    document.querySelector("[data-hayek-page='app']") ||
    document.getElementById("keypad") ||
    document.getElementById("display") ||
    document.getElementById("calcDisplay") ||
    document.getElementById("opsBody") ||
    document.getElementById("opsTbody");

  if (!isAppPage) return;

  /* =======================
     CONFIG (عدّل إن لزم)
     ======================= */
  const CFG = (window.HAYEK_CONFIG || {});
  const SUPABASE_URL =
    CFG.SUPABASE_URL ||
    "https://itidwqvyrjydmegjzuvn.supabase.co";
  const SUPABASE_KEY =
    CFG.SUPABASE_KEY ||
    "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";

  /* =======================
     Helpers
     ======================= */
  const $ = (id) => document.getElementById(id);

  function vibrate(ms = 18) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
  }

  function safeNum(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtDateTime(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString("ar-EG", { hour12: true });
    } catch (_) {
      return String(ts || "");
    }
  }

  function clampStr(s, n = 120) {
    s = String(s ?? "");
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  function uid(prefix = "hx") {
    return (
      prefix +
      "_" +
      Math.random().toString(16).slice(2) +
      "_" +
      Date.now().toString(16)
    );
  }

  function setText(id, txt) {
    const el = $(id);
    if (el) el.textContent = txt;
  }

  function setValue(id, val) {
    const el = $(id);
    if (el) el.value = val;
  }

  function getValue(id) {
    const el = $(id);
    return el ? (el.value ?? "").toString() : "";
  }

  function getSession() {
    // auth.js (لاحقاً) سيحفظ الجلسة هنا
    try {
      const raw = localStorage.getItem("hayek_session");
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.username) return null;
      return s;
    } catch (_) {
      return null;
    }
  }

  function setSession(username) {
    const sess = { username: String(username || "").trim(), ts: Date.now() };
    localStorage.setItem("hayek_session", JSON.stringify(sess));
    return sess;
  }

  function clearSession() {
    localStorage.removeItem("hayek_session");
  }

  function getDeviceId() {
    let id = localStorage.getItem("hayek_device_id");
    if (!id) {
      id = uid("device");
      localStorage.setItem("hayek_device_id", id);
    }
    return id;
  }

  /* =======================
     Supabase client
     ======================= */
  let client = null;

  function initClient() {
    try {
      const sb = (window.supabase && window.supabase.createClient)
        ? window.supabase
        : (typeof supabase !== "undefined" ? supabase : null);

      if (!sb || !sb.createClient) return null;
      if (!SUPABASE_URL || !SUPABASE_KEY) return null;
      client = sb.createClient(SUPABASE_URL, SUPABASE_KEY);
      return client;
    } catch (_) {
      return null;
    }
  }

  initClient();

  /* =======================
     State
     ======================= */
  const state = {
    session: getSession(),
    device_id: getDeviceId(),
    currentInvoiceId: null,
    ops: [],
    total: 0,
    expr: "",
  };

  const LS_KEYS = {
    invoice: () => `hayek_current_invoice_${state.session?.username || "guest"}`,
    ops: (invoiceId) => `hayek_ops_${state.session?.username || "guest"}_${invoiceId}`,
  };

  /* =======================
     عناصر متوقعة بالصفحة
     (إذا كانت IDs مختلفة، ما رح يخرب شيء—بس لازم توافقها لاحقاً)
     ======================= */
  const el = {
    // شاشة/حقل العمليات
    display: $("display") || $("calcDisplay"),
    statement: $("statement") || $("desc") || $("note"),
    opsBody: $("opsBody") || $("opsTbody"),
    total: $("totalValue") || $("grandTotal") || $("sum") || $("totalBadge"),
    invoiceBadge: $("invoiceBadge") || $("invId"),
    // أزرار (إن وجدت)
    btnNewInvoice: $("btnNewInvoice"),
    btnExport: $("btnExportPDF") || $("btnPrintPdf") || $("btnPDF"),
    btnCopy: $("btnCopyTable") || $("btnCopy"),
    btnClearOps: $("btnClearOps") || $("btnClearAll"),
    btnLogout: $("btnLogout"),
    // Login (إن كانت نفس الصفحة فيها تسجيل دخول)
    loginUser: $("username") || $("loginUser"),
    loginPass: $("password") || $("loginPass"),
    btnLogin: $("btnLogin"),
    loginMsg: $("loginMsg"),
    keypad: $("keypad"),
  };

  /* =======================
     UI Rendering
     ======================= */
  function renderTotal() {
    const t = state.total.toFixed(2);

    if (!el.total) return;

    // إذا عنصر totalBadge (div) استخدم textContent
    if (el.total.tagName && el.total.tagName.toLowerCase() !== "input") {
      el.total.textContent = `إجمالي الفاتورة: ${t}`;
    } else {
      el.total.value = t;
    }
  }

  function renderInvoiceId() {
    if (!state.currentInvoiceId) return;
    if (el.invoiceBadge) {
      el.invoiceBadge.textContent = `Invoice: ${state.currentInvoiceId}`;
    }
  }

  function clearOpsTable() {
    if (!el.opsBody) return;
    el.opsBody.innerHTML = "";
  }

  function appendOpRow(row) {
    if (!el.opsBody) return;

    const tr = document.createElement("tr");

    const tdTime = document.createElement("td");
    tdTime.textContent = fmtDateTime(row.created_at);

    const tdStmt = document.createElement("td");
    tdStmt.textContent = row.statement || "";

    const tdOp = document.createElement("td");
    tdOp.textContent = row.operation || "";

    const tdRes = document.createElement("td");
    tdRes.textContent = String(row.result ?? "");

    tr.append(tdTime, tdStmt, tdOp, tdRes);
    el.opsBody.appendChild(tr);
  }

  function rerenderOps() {
    clearOpsTable();
    state.ops.forEach(appendOpRow);
    renderTotal();
    renderInvoiceId();
  }

  function setExpr(v) {
    state.expr = String(v || "");
    if (el.display) {
      if (el.display.tagName && el.display.tagName.toLowerCase() === "input") {
        el.display.value = state.expr;
      } else {
        el.display.textContent = state.expr;
      }
    }
  }

  function getExpr() {
    if (!el.display) return state.expr;
    const t = (el.display.tagName && el.display.tagName.toLowerCase() === "input")
      ? el.display.value
      : el.display.textContent;
    state.expr = String(t || "");
    return state.expr;
  }

  /* =======================
     Local Storage restore/save
     ======================= */
  function saveLocal() {
    if (!state.session?.username) return;

    try {
      localStorage.setItem(LS_KEYS.invoice(), JSON.stringify({
        invoiceId: state.currentInvoiceId,
        ts: Date.now(),
      }));
      if (state.currentInvoiceId) {
        localStorage.setItem(LS_KEYS.ops(state.currentInvoiceId), JSON.stringify({
          ops: state.ops,
          total: state.total,
        }));
      }
    } catch (_) {}
  }

  function restoreLocal() {
    if (!state.session?.username) return;

    try {
      const invRaw = localStorage.getItem(LS_KEYS.invoice());
      if (invRaw) {
        const inv = JSON.parse(invRaw);
        if (inv && inv.invoiceId) state.currentInvoiceId = inv.invoiceId;
      }

      if (state.currentInvoiceId) {
        const opsRaw = localStorage.getItem(LS_KEYS.ops(state.currentInvoiceId));
        if (opsRaw) {
          const data = JSON.parse(opsRaw);
          state.ops = Array.isArray(data?.ops) ? data.ops : [];
          state.total = safeNum(data?.total);
        }
      }
    } catch (_) {}
  }

  /* =======================
     Supabase helpers (Invoices + Operations)
     ======================= */
  async function sbEnsureInvoice() {
    if (!client) return null;
    if (!state.session?.username) return null;

    if (state.currentInvoiceId) return state.currentInvoiceId;

    // إنشاء فاتورة جديدة
    const payload = {
      username: state.session.username,
      device_id: state.device_id,
      total: 0,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from("app_invoices")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      console.error(error);
      return null;
    }

    state.currentInvoiceId = data?.id || null;
    saveLocal();
    renderInvoiceId();
    return state.currentInvoiceId;
  }

  async function sbInsertOperation(row) {
    if (!client) return { ok: false, reason: "no_client" };
    if (!state.session?.username) return { ok: false, reason: "no_session" };

    const invoiceId = await sbEnsureInvoice();
    if (!invoiceId) return { ok: false, reason: "no_invoice" };

    const payload = {
      username: state.session.username,
      invoice_id: invoiceId,
      statement: row.statement || "",
      operation: row.operation || "",
      result: safeNum(row.result),
      created_at: row.created_at,
    };

    const { error } = await client.from("app_operations").insert(payload);
    if (error) {
      console.error(error);
      return { ok: false, reason: "insert_failed", error };
    }

    // تحديث مجموع الفاتورة
    const newTotal = safeNum(state.total);
    const { error: upErr } = await client
      .from("app_invoices")
      .update({ total: newTotal })
      .eq("id", invoiceId)
      .eq("username", state.session.username);

    if (upErr) console.warn("invoice total update failed:", upErr);

    return { ok: true };
  }

  /* =======================
     Expression evaluation (آمن)
     يسمح فقط: أرقام + . + + - * / ( ) مسافات
     ======================= */
  function evalExpr(expr) {
    const s = String(expr || "").trim();

    if (!s) return { ok: false, error: "اكتب عملية أولاً" };

    // سماحية محارف محددة
    if (!/^[0-9+\-*/().\s]+$/.test(s)) {
      return { ok: false, error: "يوجد رموز غير مسموحة" };
    }

    // منع تكرار نقاط غريبة (حماية إضافية بسيطة)
    if (/\.\./.test(s)) {
      return { ok: false, error: "صيغة غير صحيحة" };
    }

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`"use strict"; return (${s});`);
      const r = fn();
      const n = Number(r);
      if (!Number.isFinite(n)) return { ok: false, error: "نتيجة غير صالحة" };
      return { ok: true, value: n };
    } catch (_) {
      return { ok: false, error: "صيغة غير صحيحة" };
    }
  }

  /* =======================
     Add operation
     ======================= */
  async function addOperationFromUI() {
    const expr = getExpr();
    const ev = evalExpr(expr);
    if (!ev.ok) {
      alert(ev.error);
      return;
    }

    const statement = el.statement ? clampStr(el.statement.value || "", 120) : "";
    const result = ev.value;

    const row = {
      id: uid("op"),
      created_at: new Date().toISOString(),
      statement,
      operation: expr,
      result: Number(result.toFixed(6)),
    };

    state.ops.push(row);
    state.total = safeNum(state.total) + safeNum(row.result);

    // نظّف الحقول
    setExpr("");
    if (el.statement) el.statement.value = "";

    rerenderOps();
    saveLocal();
    vibrate(15);

    // Sync
    const res = await sbInsertOperation(row);
    if (!res.ok) {
      // ما نوقف الشغل—بس نوضح أنه صار Offline/Sync لاحق
      console.warn("sync failed:", res.reason, res.error || "");
    }
  }

  /* =======================
     New invoice
     ======================= */
  async function newInvoice() {
    if (!state.session?.username) {
      alert("سجّل دخول أولاً");
      return;
    }

    // صفّر فقط على الجهاز (والفاتورة الجديدة ستنشأ عند أول عملية)
    state.currentInvoiceId = null;
    state.ops = [];
    state.total = 0;
    saveLocal();
    rerenderOps();
    vibrate(20);
  }

  /* =======================
     Copy table (TSV) to clipboard
     ======================= */
  async function copyTable() {
    if (!state.ops.length) {
      alert("لا توجد عمليات لنسخها");
      return;
    }

    const lines = [];
    lines.push(["الوقت", "البيان", "العملية", "النتيجة"].join("\t"));
    state.ops.forEach(r => {
      lines.push([
        fmtDateTime(r.created_at),
        (r.statement || ""),
        (r.operation || ""),
        String(r.result ?? ""),
      ].join("\t"));
    });
    lines.push(["", "", "الإجمالي", state.total.toFixed(2)].join("\t"));

    const text = lines.join("\n");

    try {
      await navigator.clipboard.writeText(text);
      vibrate(18);
      alert("✅ تم النسخ كجدول");
    } catch (_) {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      vibrate(18);
      alert("✅ تم النسخ كجدول");
    }
  }

  /* =======================
     Export PDF (html2pdf إذا موجود)
     يحتاج عنصر printable-area إن كان موجود، وإلا ننشئ واحد مؤقت
     ======================= */
  async function exportPDF() {
    if (!state.ops.length) {
      alert("لا توجد عمليات لتصديرها");
      return;
    }

    const username = state.session?.username || "user";
    const invoiceId = state.currentInvoiceId || "local";

    const existing = document.getElementById("printable-area");
    const wrap = existing || document.createElement("div");

    if (!existing) {
      wrap.id = "printable-area";
      wrap.style.background = "#fff";
      wrap.style.color = "#111";
      wrap.style.padding = "16px";
      wrap.style.borderRadius = "12px";
      wrap.style.maxWidth = "900px";
      wrap.style.margin = "12px auto";
      wrap.style.direction = "rtl";
      wrap.style.fontFamily = "Tahoma, Arial, sans-serif";
      document.body.appendChild(wrap);
    }

    const rowsHtml = state.ops.map(r => `
      <tr>
        <td>${fmtDateTime(r.created_at)}</td>
        <td>${(r.statement || "").replaceAll("<","&lt;")}</td>
        <td>${(r.operation || "").replaceAll("<","&lt;")}</td>
        <td>${String(r.result ?? "")}</td>
      </tr>
    `).join("");

    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
        <div>
          <div style="font-weight:900;font-size:18px;">HAYEK SPOT — فاتورة</div>
          <div style="font-size:12px;color:#444;margin-top:6px;">
            المستخدم: <b>${username}</b><br/>
            رقم الفاتورة: <b>${invoiceId}</b><br/>
            التاريخ: <b>${fmtDateTime(new Date().toISOString())}</b>
          </div>
        </div>
        <div style="font-weight:900;font-size:16px;">الإجمالي: ${state.total.toFixed(2)}</div>
      </div>

      <div style="height:10px;"></div>

      <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;">
        <thead>
          <tr>
            <th style="border-bottom:1px solid #eee;padding:8px;text-align:right;background:#f3f3f3;">الوقت</th>
            <th style="border-bottom:1px solid #eee;padding:8px;text-align:right;background:#f3f3f3;">البيان</th>
            <th style="border-bottom:1px solid #eee;padding:8px;text-align:right;background:#f3f3f3;">العملية</th>
            <th style="border-bottom:1px solid #eee;padding:8px;text-align:right;background:#f3f3f3;">النتيجة</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    // html2pdf
    if (typeof html2pdf !== "undefined") {
      try {
        const opt = {
          margin: 10,
          filename: `invoice_${username}_${String(invoiceId).slice(-6)}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        };
        await html2pdf().set(opt).from(wrap).save();
        vibrate(20);
      } catch (e) {
        console.error(e);
        alert("فشل تصدير PDF. جرّب متصفح Chrome.");
      } finally {
        if (!existing) wrap.remove();
      }
      return;
    }

    // fallback: طباعة المتصفح
    window.print();
    if (!existing) wrap.remove();
  }

  /* =======================
     Keypad generator (اختياري)
     إذا عندك div#keypad فاضي، رح يبنيه تلقائياً
     ترتيب الأرقام المطلوب:
     3 بدل 1 / 6 بدل 4 / 9 بدل 7 (أي صفوف معكوسة)
     ======================= */
  function buildKeypadIfEmpty() {
    if (!el.keypad) return;
    if (el.keypad.children && el.keypad.children.length > 0) return;

    const keys = [
      "3", "2", "1", "+",
      "6", "5", "4", "-",
      "9", "8", "7", "×",
      "0", ".", "⌫", "÷",
      "C", "=", 
    ];

    keys.forEach(k => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn key";
      b.dataset.key = k;
      b.textContent = k;
      el.keypad.appendChild(b);
    });
  }

  function normalizeKey(k) {
    if (k === "×") return "*";
    if (k === "÷") return "/";
    return k;
  }

  function onKeyPress(k) {
    k = normalizeKey(k);

    if (k === "C") {
      setExpr("");
      vibrate(12);
      return;
    }

    if (k === "⌫") {
      const s = getExpr();
      setExpr(s.slice(0, -1));
      vibrate(10);
      return;
    }

    if (k === "=") {
      addOperationFromUI();
      return;
    }

    // default append
    const cur = getExpr();
    setExpr(cur + k);
    vibrate(6);
  }

  function wireKeypad() {
    if (!el.keypad) return;
    el.keypad.addEventListener("click", (e) => {
      const btn = e.target?.closest("button");
      if (!btn) return;
      const k = btn.dataset.key || btn.textContent;
      if (!k) return;
      onKeyPress(k);
    });
  }

  /* =======================
     Login handling (إذا كانت صفحة واحدة)
     ======================= */
  async function doLogin() {
    const username = (el.loginUser?.value || "").trim();
    const pass = (el.loginPass?.value || "").trim();

    if (!username || !pass) {
      if (el.loginMsg) el.loginMsg.textContent = "اكتب اسم المستخدم وكلمة السر";
      alert("اكتب اسم المستخدم وكلمة السر");
      return;
    }

    if (!client) {
      // Offline login (غير مفضل) — فقط لعدم كسر الصفحة
      state.session = setSession(username);
      if (el.loginMsg) el.loginMsg.textContent = "✅ تم الدخول (بدون اتصال)";
      restoreLocal();
      rerenderOps();
      return;
    }

    // تحقق من app_users + blocked
    const { data, error } = await client
      .from("app_users")
      .select("username, pass, blocked")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      console.error(error);
      alert("خطأ اتصال: " + error.message);
      return;
    }

    if (!data) {
      alert("اسم المستخدم غير موجود");
      return;
    }

    if (String(data.pass) !== String(pass)) {
      alert("كلمة السر غير صحيحة");
      return;
    }

    if (data.blocked) {
      alert("هذا الحساب غير مفعّل حالياً");
      return;
    }

    state.session = setSession(username);
    if (el.loginMsg) el.loginMsg.textContent = "✅ تم الدخول";
    vibrate(20);

    restoreLocal();
    rerenderOps();
  }

  /* =======================
     Events wiring
     ======================= */
  function wireButtons() {
    if (el.btnNewInvoice) el.btnNewInvoice.addEventListener("click", newInvoice);
    if (el.btnExport) el.btnExport.addEventListener("click", exportPDF);
    if (el.btnCopy) el.btnCopy.addEventListener("click", copyTable);

    if (el.btnClearOps) {
      el.btnClearOps.addEventListener("click", () => {
        if (!confirm("مسح كل عمليات هذه الفاتورة من الشاشة؟")) return;
        state.ops = [];
        state.total = 0;
        saveLocal();
        rerenderOps();
        vibrate(20);
      });
    }

    if (el.btnLogout) {
      el.btnLogout.addEventListener("click", () => {
        clearSession();
        location.reload();
      });
    }

    // Enter = إضافة عملية إذا display input
    if (el.display && el.display.tagName && el.display.tagName.toLowerCase() === "input") {
      el.display.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addOperationFromUI();
        }
      });
    }

    // زر تسجيل الدخول إن وجد
    if (el.btnLogin) el.btnLogin.addEventListener("click", doLogin);
  }

  /* =======================
     Init
     ======================= */
  function init() {
    // لو ما في جلسة ولسه في فورم login: خليه يشتغل
    if (!state.session?.username) {
      // إذا ما في login inputs، خليه يعمل guest بدون تخزين
      if (!el.loginUser || !el.loginPass) {
        state.session = { username: "guest", ts: Date.now() };
      }
    }

    restoreLocal();
    buildKeypadIfEmpty();
    wireKeypad();
    wireButtons();
    rerenderOps();
  }

  init();
})();
