/* user.js - HAYEK SPOT User (from scratch)
   - Login overlay mandatory
   - One-time login on same device (uses auth.js if available)
   - Invoice open/close + offline queue
   - PDF export + WhatsApp share (best effort)
   - No "copy as table" (removed)
*/

(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const now = () => new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtDT = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${d.getFullYear()}/${pad2(d.getMonth()+1)}/${pad2(d.getDate())}`;
  const fmtTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  const LS = {
    auth: "HAYEK_USER_AUTH",
    invoice: "HAYEK_USER_ACTIVE_INVOICE",
    history: "HAYEK_USER_HISTORY",
    queue: "HAYEK_USER_SYNC_QUEUE",
    settings: "HAYEK_USER_SETTINGS"
  };

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "") ?? fallback; } catch { return fallback; }
  }
  function saveJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function setMsg(el, text, isErr=false) {
    el.textContent = text;
    el.classList.toggle("err", !!isErr);
    el.style.display = "block";
  }

  function vibe(enabled) {
    if (!enabled) return;
    if (navigator.vibrate) navigator.vibrate(18);
  }

  function netUI() {
    const dot = $("netDot");
    const online = navigator.onLine;
    dot.style.background = online ? "#22c55e" : "#ef4444";
    dot.style.boxShadow = online ? "0 0 0 6px rgba(34,197,94,.15)" : "0 0 0 6px rgba(239,68,68,.15)";
  }

  // ---------- auth (use auth.js if available, else local fallback) ----------
  function getDeviceIdFallback() {
    let v = localStorage.getItem("HAYEK_DEVICE_ID");
    if (!v) {
      v = "dev_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
      localStorage.setItem("HAYEK_DEVICE_ID", v);
    }
    return v;
  }

  function authApi() {
    const A = window.HAYEK_AUTH;
    const has = A && (typeof A === "object");
    return {
      has,
      getDeviceId: () => {
        try {
          if (has && typeof A.getDeviceId === "function") return A.getDeviceId();
        } catch {}
        return getDeviceIdFallback();
      },
      isLoggedIn: () => {
        try {
          if (has && typeof A.isLoggedIn === "function") return !!A.isLoggedIn();
          if (has && typeof A.getSession === "function") return !!A.getSession();
        } catch {}
        const s = loadJSON(LS.auth, null);
        return !!(s && s.ok && s.deviceId === getDeviceIdFallback());
      },
      login: async (username, password) => {
        // Prefer auth.js if offers login()
        try {
          if (has && typeof A.login === "function") {
            const res = await A.login(username, password);
            // assume res truthy means success
            return { ok: !!res, user: username };
          }
          if (has && typeof A.signIn === "function") {
            const res = await A.signIn(username, password);
            return { ok: !!res, user: username };
          }
        } catch (e) {
          return { ok:false, error: (e && e.message) ? e.message : "فشل تسجيل الدخول" };
        }

        // Fallback (local only) — for safety if auth.js doesn't expose functions
        // WARNING: this is local, device only.
        const deviceId = getDeviceIdFallback();
        saveJSON(LS.auth, { ok:true, user: username, deviceId, ts: Date.now() });
        return { ok:true, user: username };
      },
      logout: async () => {
        try {
          if (has && typeof A.logout === "function") await A.logout();
        } catch {}
        localStorage.removeItem(LS.auth);
      },
      resetDevice: async () => {
        try {
          if (has && typeof A.clearDevice === "function") await A.clearDevice();
        } catch {}
        // wipe local auth/device
        localStorage.removeItem(LS.auth);
        localStorage.removeItem("HAYEK_DEVICE_ID");
      },
      getUserName: () => {
        try {
          if (has && typeof A.getUserName === "function") return A.getUserName();
          if (has && typeof A.getSession === "function") {
            const s = A.getSession();
            if (s && s.username) return s.username;
          }
        } catch {}
        const s = loadJSON(LS.auth, null);
        return s?.user || "—";
      }
    };
  }

  const AUTH = authApi();

  // ---------- app state ----------
  const settings = loadJSON(LS.settings, { vibe:true, eachLine:true });
  $("toggleVibe").checked = !!settings.vibe;
  $("toggleEachLine").checked = !!settings.eachLine;

  let history = loadJSON(LS.history, []);
  let active = loadJSON(LS.invoice, null); // {id, user, customer, status, createdAt, rows:[...], total}
  let syncQueue = loadJSON(LS.queue, []); // invoices closed pending sync

  function persistAll() {
    saveJSON(LS.settings, settings);
    saveJSON(LS.history, history);
    saveJSON(LS.invoice, active);
    saveJSON(LS.queue, syncQueue);
  }

  function ensureActiveInvoice() {
    if (!active) {
      active = {
        id: null,
        user: AUTH.getUserName(),
        customer: "",
        status: "closed",
        createdAt: null,
        rows: [],
        total: 0
      };
    }
  }

  function setActiveStatus(st) {
    ensureActiveInvoice();
    active.status = st;
    $("invoiceStatus").value = st;
    persistAll();
  }

  function calcTotal(rows) {
    // sum numeric results only
    let sum = 0;
    for (const r of rows) {
      const n = Number(r.result);
      if (Number.isFinite(n)) sum += n;
    }
    return sum;
  }

  // ---------- UI: tabs ----------
  function setTab(name) {
    for (const el of document.querySelectorAll(".tab")) {
      el.classList.toggle("active", el.dataset.tab === name);
    }
    $("tab-calc").style.display = name === "calc" ? "" : "none";
    $("tab-invoice").style.display = name === "invoice" ? "" : "none";
    $("tab-history").style.display = name === "history" ? "" : "none";
    $("tab-tools").style.display = name === "tools" ? "" : "none";
  }
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });

  // ---------- keyboard ----------
  const KEYS = [
    {t:"÷", v:"/"},
    {t:"⌫", v:"back", cls:"warn"},
    {t:"(", v:"("},
    {t:")", v:")"},

    {t:"×", v:"*"},
    {t:"7", v:"7"},
    {t:"8", v:"8"},
    {t:"9", v:"9"},

    {t:"−", v:"-"},
    {t:"4", v:"4"},
    {t:"5", v:"5"},
    {t:"6", v:"6"},

    {t:"+", v:"+"},
    {t:"1", v:"1"},
    {t:"2", v:"2"},
    {t:"3", v:"3"},

    {t:"=", v:"enter", cls:"ok"},
    {t:"±", v:"pm", cls:"soft"},
    {t:"0", v:"0"},
    {t:".", v:"."},
  ];

  function buildKeys() {
    const box = $("keys");
    box.innerHTML = "";
    for (const k of KEYS) {
      const b = document.createElement("div");
      b.className = "key " + (k.cls || "");
      b.textContent = k.t;
      b.addEventListener("click", () => {
        vibe(settings.vibe);
        applyKey(k.v);
      });
      box.appendChild(b);
    }
  }
  buildKeys();

  function applyKey(v) {
    const inp = $("lineInput");
    if (v === "back") {
      inp.value = inp.value.slice(0, -1);
      renderLive();
      return;
    }
    if (v === "enter") {
      commitLine();
      return;
    }
    if (v === "pm") {
      // toggle last number sign: simplest
      inp.value = inp.value + "*-1";
      renderLive();
      return;
    }
    inp.value += v;
    renderLive();
  }

  $("lineInput").addEventListener("input", renderLive);

  function safeEval(expr) {
    // accept only digits, operators, dot, parentheses, spaces
    const cleaned = expr.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)); // arabic indic digits
    if (!/^[0-9+\-*/().\s]+$/.test(cleaned)) return { ok:false, value:0 };
    try {
      // eslint-disable-next-line no-new-func
      const val = Function(`"use strict"; return (${cleaned});`)();
      if (!Number.isFinite(val)) return { ok:false, value:0 };
      return { ok:true, value: val };
    } catch {
      return { ok:false, value:0 };
    }
  }

  function splitTextAndExpr(line) {
    // allow "محارم 5+5" => text="محارم", expr="5+5"
    // if contains any digit/operator, take last token-ish as expr
    const m = line.match(/^(.*?)([0-9٠-٩+\-*/().\s]+)$/);
    if (!m) return { text: line.trim(), expr: "" };
    return { text: (m[1] || "").trim(), expr: (m[2] || "").trim() };
  }

  function renderLive() {
    const v = $("lineInput").value || "";
    const { text, expr } = splitTextAndExpr(v);

    $("exprView").textContent = expr ? `${text ? (text + " — ") : ""}${expr}` : (text || "—");
    if (!expr) {
      $("valView").textContent = "0";
      return;
    }
    const r = safeEval(expr);
    $("valView").textContent = r.ok ? String(r.value) : "0";
  }

  // ---------- invoice + history ----------
  function renderTables() {
    // history table
    const h = $("historyRows");
    h.innerHTML = "";
    for (const r of history) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.time}</td>
        <td>${escapeHtml(r.text || "")}</td>
        <td>${escapeHtml(r.expr || "")}</td>
        <td>${escapeHtml(String(r.result ?? ""))}</td>
      `;
      h.appendChild(tr);
    }

    // paper table from active invoice
    ensureActiveInvoice();
    const p = $("paperRows");
    p.innerHTML = "";
    for (const r of active.rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.time}</td>
        <td>${escapeHtml(r.text || "")}</td>
        <td>${escapeHtml(r.expr || "")}</td>
        <td>${escapeHtml(String(r.result ?? ""))}</td>
      `;
      p.appendChild(tr);
    }
    active.total = calcTotal(active.rows);
    $("paperTotal").textContent = String(active.total);

    $("pUser").textContent = active.user || "—";
    $("pId").textContent = active.id || "—";
    $("pCustomer").textContent = active.customer || "—";
    $("pDate").textContent = active.createdAt ? fmtDT(new Date(active.createdAt)) : "—";
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function newInvoice(customer) {
    active = {
      id: crypto.randomUUID ? crypto.randomUUID() : ("inv_" + Date.now() + "_" + Math.random().toString(16).slice(2)),
      user: AUTH.getUserName(),
      customer: customer.trim(),
      status: "open",
      createdAt: Date.now(),
      rows: [],
      total: 0
    };
    history = []; // reset history per invoice session
    persistAll();
    renderTables();
    setActiveStatus("open");
  }

  function commitLine() {
    ensureActiveInvoice();
    if (active.status !== "open") {
      alert("لا يمكنك إدخال عمليات لأن الفاتورة مغلقة. افتح فاتورة جديدة أولاً.");
      setTab("invoice");
      return;
    }
    const raw = ($("lineInput").value || "").trim();
    if (!raw) return;

    const { text, expr } = splitTextAndExpr(raw);
    let result = "";
    if (expr) {
      const r = safeEval(expr);
      result = r.ok ? r.value : "";
    }

    const row = {
      time: fmtTime(now()),
      text: text || "",
      expr: expr || "",
      result: result
    };

    // add
    active.rows.push(row);
    history.push(row);

    active.total = calcTotal(active.rows);
    persistAll();
    renderTables();

    // clear input for next line
    if (settings.eachLine) $("lineInput").value = "";
    renderLive();
  }

  // ---------- actions ----------
  $("btnClearAll").addEventListener("click", () => {
    vibe(settings.vibe);
    $("lineInput").value = "";
    renderLive();
  });

  $("toggleVibe").addEventListener("change", (e) => {
    settings.vibe = !!e.target.checked;
    persistAll();
  });

  $("toggleEachLine").addEventListener("change", (e) => {
    settings.eachLine = !!e.target.checked;
    persistAll();
  });

  $("btnClearHistory").addEventListener("click", () => {
    if (!confirm("مسح السجل الحالي؟")) return;
    history = [];
    ensureActiveInvoice();
    active.rows = [];
    active.total = 0;
    persistAll();
    renderTables();
  });

  $("customerName").addEventListener("input", (e) => {
    ensureActiveInvoice();
    active.customer = e.target.value || "";
    persistAll();
    renderTables();
  });

  $("invoiceStatus").addEventListener("change", (e) => {
    setActiveStatus(e.target.value);
  });

  $("btnOpenInvoice").addEventListener("click", () => {
    vibe(settings.vibe);
    const customer = ($("customerName").value || "").trim();
    if (!customer) {
      alert("اسم العميل إجباري.");
      $("customerName").focus();
      return;
    }
    newInvoice(customer);
    setTab("calc");
  });

  $("btnCloseInvoice").addEventListener("click", async () => {
    vibe(settings.vibe);
    ensureActiveInvoice();
    if (!active.id || active.status !== "open") {
      alert("لا توجد فاتورة مفتوحة لإغلاقها.");
      return;
    }
    if (!active.customer) {
      alert("اسم العميل إجباري.");
      setTab("invoice");
      return;
    }

    // close invoice
    active.status = "closed";
    persistAll();
    renderTables();
    $("invoiceStatus").value = "closed";

    // silently enqueue for sync
    enqueueForSync(active);

    // attempt sync if online (silent)
    if (navigator.onLine) {
      await syncQueueNow(true);
    }

    // show minimal success without mentioning server/admin
    const msg = $("toolMsg");
    setMsg(msg, "تم إغلاق الفاتورة بنجاح ✅", false);
    setTab("tools");
  });

  // ---------- sync queue (silent) ----------
  function enqueueForSync(invoice) {
    const copy = JSON.parse(JSON.stringify(invoice));
    syncQueue.unshift(copy);
    // keep small
    syncQueue = syncQueue.slice(0, 200);
    persistAll();
  }

  async function syncQueueNow(silent=false) {
    if (!navigator.onLine) return;

    // If app.js provides a save endpoint, use it; else keep queued.
    const maybeSave = window.HAYEK_APP && typeof window.HAYEK_APP.saveInvoice === "function"
      ? window.HAYEK_APP.saveInvoice
      : null;

    if (!maybeSave) {
      // no server hook available yet
      if (!silent) setMsg($("toolMsg"), "لا يوجد موصل رفع جاهز حالياً (سيبقى محفوظاً محلياً).", true);
      return;
    }

    const remaining = [];
    for (const inv of syncQueue) {
      try {
        await maybeSave(inv); // expected to throw on fail
      } catch {
        remaining.push(inv);
      }
    }
    syncQueue = remaining;
    persistAll();
    if (!silent) setMsg($("toolMsg"), remaining.length ? "بعض العناصر لم تُرفع، ستُعاد المحاولة تلقائياً." : "تمت المزامنة ✅", !!remaining.length);
  }

  $("btnForceSync").addEventListener("click", async () => {
    vibe(settings.vibe);
    await syncQueueNow(false);
  });

  // ---------- PDF + WhatsApp ----------
  async function buildPdfBlob() {
    ensureActiveInvoice();

    if (active.status !== "closed") {
      alert("لازم تغلق الفاتورة قبل تصدير PDF.");
      throw new Error("invoice not closed");
    }

    // Use jsPDF basic (Arabic in PDF depends on your embedding strategy).
    // Here we export a clean table in Arabic UI; PDF text rendering depends on your jsPDF setup.
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert("jsPDF غير محمل.");
      throw new Error("jspdf missing");
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    // Simple layout (works reliably)
    const margin = 36;
    let y = 50;

    doc.setFontSize(16);
    doc.text("HAYEK SPOT", margin, y); y += 18;
    doc.setFontSize(11);
    doc.text(`User: ${active.user || ""}`, margin, y); y += 14;
    doc.text(`Customer: ${active.customer || ""}`, margin, y); y += 14;
    doc.text(`Invoice: ${active.id || ""}`, margin, y); y += 14;
    doc.text(`Date: ${active.createdAt ? fmtDT(new Date(active.createdAt)) : ""}`, margin, y); y += 18;

    // Table header
    doc.setFontSize(10);
    doc.text("Time", margin, y);
    doc.text("Text", margin + 90, y);
    doc.text("Expr", margin + 300, y);
    doc.text("Result", margin + 440, y);
    y += 10;
    doc.line(margin, y, 560, y);
    y += 14;

    for (const r of active.rows) {
      if (y > 780) { doc.addPage(); y = 50; }
      doc.text(String(r.time || ""), margin, y);
      doc.text(String(r.text || ""), margin + 90, y, { maxWidth: 200 });
      doc.text(String(r.expr || ""), margin + 300, y, { maxWidth: 120 });
      doc.text(String(r.result ?? ""), margin + 440, y);
      y += 14;
    }

    y += 10;
    doc.line(margin, y, 560, y);
    y += 18;
    doc.setFontSize(12);
    doc.text(`Total: ${String(active.total || 0)}`, margin, y);

    const blob = doc.output("blob");
    return blob;
  }

  $("btnExportPdf").addEventListener("click", async () => {
    try {
      vibe(settings.vibe);
      const blob = await buildPdfBlob();
      const fileName = `invoice_${active.id || "hayek"}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    } catch {}
  });

  $("btnSendWhatsApp").addEventListener("click", async () => {
    try {
      vibe(settings.vibe);
      const blob = await buildPdfBlob();
      const fileName = `invoice_${active.id || "hayek"}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      // Best: share as file (mobile)
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({
          title: "فاتورة",
          text: `فاتورة العميل: ${active.customer || ""}`,
          files: [file]
        });
        return;
      }

      // Fallback: download then open WhatsApp with text
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8000);

      const msg = encodeURIComponent(`فاتورة العميل: ${active.customer || ""} — تم حفظ PDF باسم: ${fileName}`);
      window.open(`https://wa.me/?text=${msg}`, "_blank");
    } catch {}
  });

  // ---------- login overlay flow ----------
  async function showLoginIfNeeded() {
    netUI();

    // show device id
    $("devicePill").textContent = `Device: ${AUTH.getDeviceId().slice(-8)}`;

    // If auth.js didn't load, block with message
    const overlay = $("loginOverlay");
    const msg = $("loginMsg");

    if (!window.HAYEK_AUTH && !loadJSON(LS.auth, null)) {
      // still allow fallback login (local) but warn softly
      setMsg(msg, "تنبيه: auth.js غير ظاهر كـ window.HAYEK_AUTH — سيتم استخدام تسجيل محلي على هذا الجهاز.", true);
    }

    if (AUTH.isLoggedIn()) {
      overlay.style.display = "none";
      $("userPill").textContent = `مستخدم: ${AUTH.getUserName()}`;
      $("userPill").style.display = "block";
      return;
    } else {
      overlay.style.display = "flex";
      return;
    }
  }

  $("btnLogin").addEventListener("click", async () => {
    const u = ($("loginUser").value || "").trim();
    const p = ($("loginPass").value || "").trim();
    const msg = $("loginMsg");

    if (!u || !p) {
      setMsg(msg, "الرجاء إدخال اسم المستخدم وكلمة السر.", true);
      return;
    }

    const r = await AUTH.login(u, p);
    if (!r.ok) {
      setMsg(msg, r.error || "فشل تسجيل الدخول.", true);
      return;
    }

    setMsg(msg, "تم تسجيل الدخول ✅", false);
    $("userPill").textContent = `مستخدم: ${AUTH.getUserName() || u}`;
    setTimeout(() => {
      $("loginOverlay").style.display = "none";
    }, 450);
  });

  $("btnResetDevice").addEventListener("click", async () => {
    if (!confirm("مسح بيانات الجهاز؟ سيطلب تسجيل الدخول من جديد.")) return;
    await AUTH.resetDevice();
    location.reload();
  });

  $("btnLogout").addEventListener("click", async () => {
    if (!confirm("تسجيل خروج؟")) return;
    await AUTH.logout();
    location.reload();
  });

  // ---------- init ----------
  function initFromStorage() {
    ensureActiveInvoice();
    $("customerName").value = active.customer || "";
    $("invoiceStatus").value = active.status || "closed";
    $("userPill").textContent = `مستخدم: ${AUTH.getUserName()}`;
    renderTables();
    renderLive();
    netUI();
  }

  // silent auto-sync when back online
  window.addEventListener("online", async () => {
    netUI();
    await syncQueueNow(true);
  });
  window.addEventListener("offline", netUI);

  // service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }

  // Start
  initFromStorage();
  showLoginIfNeeded();
})();
