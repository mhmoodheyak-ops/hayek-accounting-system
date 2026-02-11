(() => {
  // ========= Helpers =========
  const $ = (id) => document.getElementById(id);
  const LS_CURRENT = "HAYEK_USER_CURRENT_INVOICE_V1";
  const LS_QUEUE   = "HAYEK_USER_UPLOAD_QUEUE_V1";

  function jparse(s, fallback){ try { return JSON.parse(s) ?? fallback; } catch { return fallback; } }
  function jset(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  function nowTime(){
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `${hh}:${mm}`;
  }
  function nowIso(){ return new Date().toISOString(); }
  function uuid(){
    return (crypto?.randomUUID?.() || ("id_" + Math.random().toString(16).slice(2) + Date.now()));
  }
  function toNumber(x){
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }
  function vibrateTiny(){
    try { if (navigator.vibrate) navigator.vibrate(18); } catch {}
  }

  // ========= AUTH Gate (no content for strangers) =========
  const lock = $("lock");
  const goLogin = $("goLogin");

  function hardLock(){
    lock.style.display = "flex";
    document.body.style.opacity = "1";
  }

  // require login
  if (!window.HAYEK_AUTH || !window.__HAYEK_AUTH_LOADED__ || !window.HAYEK_AUTH.isAuthed()) {
    hardLock();
    goLogin.onclick = () => window.location.href = "index.html?v=" + Date.now();
    return;
  }

  const session = window.HAYEK_AUTH.getUser() || {};
  // Optional: block admin from using user page (إذا بتحب)
  // if (session.role === "admin") { window.location.href = "admin.html?v=" + Date.now(); return; }

  // show body now
  document.body.style.opacity = "1";

  // ========= State =========
  const state = {
    invoice: null,      // {id, username, deviceId, customer, createdAt, rows:[...], total, closedAt?}
    expr: "",
    lastResult: 0
  };

  const onlineDot = $("onlineDot");
  function refreshOnline(){
    onlineDot.style.background = navigator.onLine ? "#49e39a" : "#ffb1b1";
    onlineDot.style.boxShadow = navigator.onLine ? "0 0 0 6px rgba(73,227,154,.12)" : "0 0 0 6px rgba(255,107,107,.12)";
  }
  window.addEventListener("online", () => { refreshOnline(); tryUploadQueue(); });
  window.addEventListener("offline", refreshOnline);
  refreshOnline();

  // ========= UI refs =========
  const customerName = $("customerName");
  const lineText = $("lineText");
  const exprInput = $("expr");
  const resEl = $("res");
  const rowsTbody = $("rows");
  const rowsTbody2 = $("rows2");
  const totalEl = $("total");
  const totalEl2 = $("total2");
  const invPill = $("invPill");
  const userPill = $("userPill");

  const clearLineBtn = $("clearLine");
  const clearAllBtn = $("clearAllBtn");
  const pdfBtn = $("pdfBtn");
  const waBtn = $("waBtn");
  const logoutBtn = $("logoutBtn");

  // Tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const key = tab.getAttribute("data-tab");
      $("tab_calc").style.display = (key === "calc") ? "block" : "none";
      $("tab_log").style.display  = (key === "log") ? "block" : "none";
    });
  });

  // ========= Load persisted current invoice =========
  function loadCurrent(){
    const cur = jparse(localStorage.getItem(LS_CURRENT), null);
    if (cur && cur.id && cur.username === session.username) {
      state.invoice = cur;
      customerName.value = cur.customer || "";
    }
  }
  loadCurrent();

  // ========= Invoice auto-create =========
  function ensureInvoice(){
    const cust = (customerName.value || "").trim();
    if (!cust) return null;

    if (!state.invoice || state.invoice.closedAt) {
      state.invoice = {
        id: uuid(),
        username: session.username || "user",
        deviceId: session.deviceId || (window.HAYEK_AUTH.getOrCreateDeviceId ? window.HAYEK_AUTH.getOrCreateDeviceId() : ""),
        customer: cust,
        createdAt: nowIso(),
        rows: [],
        total: 0
      };
      jset(LS_CURRENT, state.invoice);
    } else {
      // keep customer synced
      state.invoice.customer = cust;
      jset(LS_CURRENT, state.invoice);
    }
    return state.invoice;
  }

  // If customer typed, create invoice immediately
  customerName.addEventListener("input", () => {
    const cust = (customerName.value || "").trim();
    if (cust) ensureInvoice();
    renderMeta();
  });

  // ========= Calculator =========
  function setExpr(v){
    state.expr = v;
    exprInput.value = v;
  }

  function appendToken(tok){
    if (tok === "BACK") {
      setExpr(state.expr.slice(0, -1));
      return;
    }
    if (tok === "±") {
      // toggle leading minus for last number (simple)
      const s = state.expr;
      if (!s) { setExpr("-"); return; }
      // find last token start
      let i = s.length - 1;
      while (i >= 0 && /[0-9.]/.test(s[i])) i--;
      const start = i + 1;
      const before = s.slice(0, start);
      const num = s.slice(start);
      if (!num) { setExpr(s + "-"); return; }
      if (before.endsWith("-")) {
        setExpr(before.slice(0, -1) + num);
      } else {
        setExpr(before + "-" + num);
      }
      return;
    }

    // Normalize symbols
    if (tok === "×") tok = "*";
    if (tok === "÷") tok = "/";

    // Only allow safe chars
    if (!/^[0-9+\-*/().]$/.test(tok)) return;

    setExpr(state.expr + tok);
  }

  function safeEval(expr){
    // allow digits, ops, dot, spaces, parentheses only
    const cleaned = (expr || "").replace(/\s+/g,"");
    if (!cleaned) throw new Error("empty");
    if (!/^[0-9+\-*/().]+$/.test(cleaned)) throw new Error("badchars");
    // prevent dangerous patterns
    if (cleaned.includes("..")) throw new Error("bad");
    // Evaluate
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${cleaned});`)();
    const n = Number(val);
    if (!Number.isFinite(n)) throw new Error("nan");
    return n;
  }

  function commitLine(){
    const inv = ensureInvoice();
    if (!inv) {
      // customer required
      customerName.focus();
      vibrateTiny();
      return;
    }

    const expr = (state.expr || "").trim();
    if (!expr) return;

    let result;
    try {
      result = safeEval(expr);
    } catch {
      vibrateTiny();
      resEl.textContent = "خطأ";
      return;
    }

    const text = (lineText.value || "").trim(); // optional
    const row = {
      t: nowTime(),
      text,
      expr,
      result
    };
    inv.rows.push(row);

    // total = sum of results
    inv.total = inv.rows.reduce((a,r) => a + toNumber(r.result), 0);
    inv.customer = (customerName.value || "").trim();
    jset(LS_CURRENT, inv);

    state.lastResult = result;
    resEl.textContent = String(result);

    // reset line inputs
    lineText.value = "";
    setExpr("");
    renderAll();
  }

  // Keypad
  $("pad").addEventListener("click", (e) => {
    const btn = e.target.closest(".k");
    if (!btn) return;
    const k = btn.getAttribute("data-k");
    vibrateTiny();

    if (k === "=") {
      commitLine();
      return;
    }
    appendToken(k);
  });

  clearLineBtn.addEventListener("click", () => {
    vibrateTiny();
    lineText.value = "";
    setExpr("");
    resEl.textContent = "0";
  });

  clearAllBtn.addEventListener("click", () => {
    vibrateTiny();
    // wipe current invoice rows only (keep customer)
    if (state.invoice && !state.invoice.closedAt) {
      state.invoice.rows = [];
      state.invoice.total = 0;
      jset(LS_CURRENT, state.invoice);
    } else {
      localStorage.removeItem(LS_CURRENT);
      state.invoice = null;
    }
    renderAll();
  });

  logoutBtn.addEventListener("click", () => {
    window.HAYEK_AUTH.logout();
    window.location.href = "index.html?v=" + Date.now();
  });

  // ========= Rendering =========
  function renderMeta(){
    const inv = state.invoice;
    const cust = (customerName.value || "").trim();

    userPill.textContent = `المستخدم: ${session.username || "—"}`;

    if (!cust) {
      invPill.textContent = "—";
      return;
    }
    const id = inv?.id ? inv.id.slice(-6) : "—";
    invPill.textContent = `فاتورة: ${id}`;
  }

  function renderTables(){
    const inv = state.invoice;
    const arr = inv?.rows || [];

    rowsTbody.innerHTML = arr.map(r => `
      <tr>
        <td>${r.t}</td>
        <td>${escapeHtml(r.text || "")}</td>
        <td>${escapeHtml(r.expr || "")}</td>
        <td>${escapeHtml(String(r.result ?? ""))}</td>
      </tr>
    `).join("");

    rowsTbody2.innerHTML = rowsTbody.innerHTML;

    const total = inv?.total ?? 0;
    totalEl.textContent = String(total);
    totalEl2.textContent = String(total);
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function renderAll(){
    renderMeta();
    renderTables();
  }

  renderAll();

  // ========= Hidden Upload Queue (no user alerts) =========
  function getQueue(){
    return jparse(localStorage.getItem(LS_QUEUE), []);
  }
  function setQueue(q){
    jset(LS_QUEUE, q);
  }

  async function getSupabase(){
    try{
      const cfg = window.APP_CONFIG || {};
      if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return null;
      if (!window.supabase) return null;
      return window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }catch{
      return null;
    }
  }

  async function uploadInvoiceSilent(inv){
    // table name: invoices (إذا ما كانت موجودة، رح يفشل بصمت ونتركها بالصف)
    const sb = await getSupabase();
    if (!sb) return false;

    try{
      const payload = {
        id: inv.id,
        username: inv.username,
        device_id: inv.deviceId || "",
        customer: inv.customer || "",
        created_at: inv.createdAt,
        closed_at: inv.closedAt,
        total: inv.total,
        items: inv.rows
      };

      const { error } = await sb.from("invoices").insert([payload]);
      if (error) return false;
      return true;
    }catch{
      return false;
    }
  }

  async function tryUploadQueue(){
    if (!navigator.onLine) return;

    const q = getQueue();
    if (!q.length) return;

    const rest = [];
    for (const inv of q) {
      const ok = await uploadInvoiceSilent(inv);
      if (!ok) rest.push(inv);
    }
    setQueue(rest);
  }

  // ========= Auto-close invoice (on export/send) =========
  async function closeInvoiceSilent(){
    const inv = ensureInvoice();
    if (!inv) return null;

    // must have at least one row to close
    if (!inv.rows || inv.rows.length === 0) {
      // إذا بدك تسمح بإغلاق فاتورة فارغة، قلّي
      return null;
    }

    inv.closedAt = nowIso();
    jset(LS_CURRENT, inv);

    // push to queue and try upload silently
    const q = getQueue();
    q.unshift(inv);
    setQueue(q);
    tryUploadQueue();

    // After close, start fresh invoice (keep customer empty)
    state.invoice = null;
    localStorage.removeItem(LS_CURRENT);
    customerName.value = "";
    lineText.value = "";
    setExpr("");
    resEl.textContent = "0";
    renderAll();

    return inv;
  }

  // ========= PDF Export (works offline) =========
  async function buildPdfBlob(inv){
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) throw new Error("jspdf");

    const doc = new jsPDF({ unit: "pt", format: "a4" });

    // Simple layout (works even if arabic shaping not perfect on some devices)
    let y = 52;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("HAYEK SPOT", 420, y, { align: "right" });

    y += 28;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Customer: ${inv.customer || "-"}`, 420, y, { align: "right" }); y += 16;
    doc.text(`User: ${inv.username || "-"}`, 420, y, { align: "right" }); y += 16;
    doc.text(`Invoice: ${inv.id}`, 420, y, { align: "right" }); y += 16;
    doc.text(`Date: ${new Date(inv.closedAt || inv.createdAt).toLocaleString()}`, 420, y, { align: "right" }); y += 22;

    // Table headers
    doc.setFont("helvetica", "bold");
    doc.text("Time", 52, y);
    doc.text("Text", 130, y);
    doc.text("Expr", 270, y);
    doc.text("Result", 520, y, { align: "right" });
    y += 10;

    doc.setLineWidth(0.5);
    doc.line(52, y, 540, y);
    y += 16;

    doc.setFont("helvetica", "normal");
    for (const r of inv.rows) {
      if (y > 760) { doc.addPage(); y = 60; }
      doc.text(String(r.t || ""), 52, y);
      doc.text(String(r.text || "").slice(0,20), 130, y);
      doc.text(String(r.expr || "").slice(0,22), 270, y);
      doc.text(String(r.result ?? ""), 520, y, { align: "right" });
      y += 16;
    }

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text(`Total: ${inv.total}`, 520, y, { align: "right" });

    const blob = doc.output("blob");
    return blob;
  }

  async function exportPdf(){
    const inv = await closeInvoiceSilent();
    if (!inv) { vibrateTiny(); return; }

    try{
      const blob = await buildPdfBlob(inv);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `HAYEK_${(inv.customer||"invoice").replace(/\s+/g,"_")}_${inv.id.slice(-6)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }catch(e){
      console.log("PDF error", e);
    }
  }

  // ========= WhatsApp Send =========
  async function sendWhatsApp(){
    const inv = await closeInvoiceSilent();
    if (!inv) { vibrateTiny(); return; }

    const text =
      `فاتورة\n` +
      `الزبون: ${inv.customer}\n` +
      `الإجمالي: ${inv.total}\n` +
      `رقم: ${inv.id.slice(-6)}`;

    // Try share (mobile) with PDF file if possible
    try{
      const blob = await buildPdfBlob(inv);
      const file = new File([blob], `HAYEK_${inv.id.slice(-6)}.pdf`, { type: "application/pdf" });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ text, files: [file], title: "فاتورة" });
        return;
      }
    }catch {}

    // Fallback: open whatsapp text
    const waUrl = "https://wa.me/?text=" + encodeURIComponent(text);
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  pdfBtn.addEventListener("click", () => { vibrateTiny(); exportPdf(); });
  waBtn.addEventListener("click", () => { vibrateTiny(); sendWhatsApp(); });

  // ========= Start upload attempts silently on load =========
  tryUploadQueue();
})();
