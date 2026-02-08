<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#111315" />
  <title>HAYEK SPOT | نظام المحاسبة الذكي</title>

  <style>
    :root{
      --white:#FFFFFF; --green:#19C37D; --gray:#5F6368; --dark:#2F3337; --black:#111315; --yellow:#D6A628;
      --bg: var(--gray);
      --line: rgba(255,255,255,.18);
      --text: var(--white);
      --muted: rgba(255,255,255,.78);
      --shadow: 0 14px 40px rgba(0,0,0,.35);
      --radius: 22px;
    }
    *{box-sizing:border-box}
    body{
      margin:0;background:var(--bg);color:var(--text);
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,"Noto Sans Arabic","Noto Naskh Arabic",sans-serif;
      display:flex;justify-content:center;padding:16px
    }
    .wrap{width:min(440px,100%);display:grid;gap:12px}

    .top{
      background: linear-gradient(180deg, rgba(17,19,21,.95), rgba(47,51,55,.95));
      border:1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding:14px 14px;
      display:flex; align-items:center; justify-content:space-between;
    }
    .brand{display:grid;gap:4px}
    .brand b{font-size:16px;letter-spacing:.4px}
    .brand span{font-size:12px;color:var(--muted)}
    .pill{
      font-size:12px;font-weight:1000;padding:7px 10px;border-radius:999px;
      background: var(--yellow); color: var(--black);
    }

    .card{
      background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04));
      border:1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow:hidden;
    }

    /* ✅ Luxe banners */
    .heroWrap{
      padding:14px;
      display:grid;
@@ -173,7 +172,6 @@
      box-shadow: 0 10px 22px rgba(0,0,0,.35);
    }

    /* LOGIN */
    .login{padding:14px;display:grid;gap:10px}
    .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .field{display:grid;gap:6px}
@@ -193,7 +191,6 @@
    .btn.red{background: rgba(255,80,90,.18); border-color: rgba(255,80,90,.35)}
    .note{font-size:12px;color:var(--muted);line-height:1.7}

    /* APP */
    .app{display:none}
    .screen{padding:14px;border-bottom:1px solid var(--line)}
    .display{
@@ -239,79 +236,26 @@
    }
    .total span:last-child{direction:ltr}

    /* ✅ PDF Styling + Fix overlap */
    @media print{
      body{
        background:#fff;
        color:#000;
        padding:0;
        font-family: "Amiri", serif;
      }
      .top,.login,.keys,.footer,.btn,.pill{
        display:none !important;
      }
      body{background:#fff;color:#000;padding:0;font-family: "Amiri", serif;}
      .top,.login,.keys,.footer,.btn,.pill{display:none !important;}
      .wrap{width:100%}
      .card{box-shadow:none;border:none}
      .screen{border:none}
      .heroWrap{
        background:#fff !important;
        border-bottom:none !important;
      }
      .bannerBox{
        background:#fff !important;
        color:#000 !important;
        border:2px solid #000 !important;
        box-shadow:none !important;
      }
      .bannerFooter{
        background:#111 !important;
        color:#fff !important;
        border:2px solid #111 !important;
        box-shadow:none !important;
      }
      .heroWrap{background:#fff !important;border-bottom:none !important;}
      .bannerBox{background:#fff !important;color:#000 !important;border:2px solid #000 !important;box-shadow:none !important;}
      .bannerFooter{background:#111 !important;color:#fff !important;border:2px solid #111 !important;box-shadow:none !important;}
      .bannerSub{color:#0b7a4a !important}
      .footerLine{color:#D6A628 !important}
      .footerPhone{color:#19C37D !important; border:2px solid #19C37D !important; box-shadow:none !important; background:#fff !important}
      .badge{border:1px solid #000 !important; box-shadow:none !important; background:#fff !important}

      h3{
        color:#111;
        border-bottom:2px solid #000;
        padding-bottom:6px;
      }
      table{
        width:100%;
        border-collapse:collapse;
        margin-top:10px;
        border:1px solid #000;
        margin-bottom: 14px !important;
      }
      th{
        background:#f0f0f0;
        color:#000;
        font-weight:900;
        border:1px solid #000;
      }
      td{
        border:1px solid #999;
        padding:8px;
      }
      tr:nth-child(even){
        background:#fafafa;
      }
      .total{
        margin-top:12px;
        margin-bottom: 14px !important;
        font-size:16px;
        font-weight:900;
        border:2px dashed #000;
        background:#fff;
      }
      .bannerFooter{
        margin-top: 16px !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .footerPhone{color:#19C37D !important;border:2px solid #19C37D !important;box-shadow:none !important;background:#fff !important}
      .badge{border:1px solid #000 !important;box-shadow:none !important;background:#fff !important}
      h3{color:#111;border-bottom:2px solid #000;padding-bottom:6px;}
      table{width:100%;border-collapse:collapse;margin-top:10px;border:1px solid #000;margin-bottom: 14px !important;}
      th{background:#f0f0f0;color:#000;font-weight:900;border:1px solid #000;}
      td{border:1px solid #999;padding:8px;}
      tr:nth-child(even){background:#fafafa;}
      .total{margin-top:12px;margin-bottom: 14px !important;font-size:16px;font-weight:900;border:2px dashed #000;background:#fff;}
      .bannerFooter{margin-top: 16px !important;break-inside: avoid !important;page-break-inside: avoid !important;}
    }
  </style>
</head>
@@ -388,6 +332,7 @@
        <button class="key" data-k="0">0</button>
        <button class="key" data-k=".">.</button>

        <!-- ✅ (=) يسجل ويحفظ تلقائياً -->
        <button class="key eq" data-k="=" style="grid-column: span 2; font-size:20px;">=</button>
      </div>

@@ -493,14 +438,15 @@
  };

  // =========================
  // ✅ Device ID (جهاز واحد فقط)
  // ✅ Device ID
  // =========================
  const K_DEVICE = "hs_device_id_v1";
  function getDeviceId(){
    let id = localStorage.getItem(K_DEVICE);
    if (id) return id;

    const rnd = crypto?.getRandomValues ? crypto.getRandomValues(new Uint32Array(4)) : [Date.now(), Math.random()*1e9, Math.random()*1e9, Math.random()*1e9];
    const rnd = crypto?.getRandomValues
      ? crypto.getRandomValues(new Uint32Array(4))
      : [Date.now(), Math.random()*1e9, Math.random()*1e9, Math.random()*1e9];
    id = `dev_${Array.from(rnd).map(n=>Number(n).toString(16)).join("")}_${Date.now().toString(16)}`;
    localStorage.setItem(K_DEVICE, id);
    return id;
@@ -509,7 +455,7 @@
  // =========================
  // Session
  // =========================
  const K_SESSION = "hs_session_v3";
  const K_SESSION = "hs_session_v4"; // ✅ نسخة جديدة
  const saveSession = (obj) => localStorage.setItem(K_SESSION, JSON.stringify(obj));
  const loadSession = () => { try { return JSON.parse(localStorage.getItem(K_SESSION) || "null"); } catch { return null; } };
  const clearSession = () => { try { localStorage.removeItem(K_SESSION); } catch(_){} };
@@ -564,17 +510,11 @@
    if (user.blocked) { toast("هذا المستخدم محظور ❌"); return; }

    if (!user.device_id){
      try{
        await apiFetch(`/app_users?id=eq.${user.id}`, {
          method:"PATCH",
          headers:{ "Prefer":"return=minimal" },
          body: JSON.stringify({ device_id: deviceId, last_seen: new Date().toISOString() })
        });
      }catch(e){
        console.error(e);
        toast("مشكلة ربط الجهاز");
        return;
      }
      await apiFetch(`/app_users?id=eq.${user.id}`, {
        method:"PATCH",
        headers:{ "Prefer":"return=minimal" },
        body: JSON.stringify({ device_id: deviceId, last_seen: new Date().toISOString() })
      });
    } else if (user.device_id !== deviceId){
      toast("هذا الحساب مرتبط بجهاز آخر ❌");
      return;
@@ -588,7 +528,16 @@
      }catch(_){}
    }

    saveSession({ id: user.id, username: user.username, is_admin: !!user.is_admin, device_id: deviceId, ts: Date.now() });
    // ✅ نفتح بدون فاتورة جاهزة.. أول عملية تفتح فاتورة تلقائياً
    saveSession({
      id: user.id,
      username: user.username,
      is_admin: !!user.is_admin,
      device_id: deviceId,
      invoice_id: null,
      ts: Date.now()
    });

    setLocked(false);
    toast("تم الدخول ✅");
  };
@@ -608,7 +557,6 @@
      const u = Array.isArray(rows) ? rows[0] : null;

      if (!u) return forceLogout("تم تسجيل الخروج");

      if (u.blocked) return forceLogout("تم حظرك من النظام ❌");

      const myDevice = getDeviceId();
@@ -632,10 +580,92 @@
    guardTick();
  }

  // =========================
  // ✅ Invoices: create + keep current invoice_id
  // =========================
  async function ensureInvoice(){
    const sess = loadSession();
    if (!sess?.id || !sess?.username) throw new Error("No session");

    if (sess.invoice_id) return sess.invoice_id;

    const deviceId = getDeviceId();
    const username = sess.username;

    // 1) Try RPC create_invoice
    try{
      const rpcRes = await apiFetch(`/rpc/create_invoice`, {
        method:"POST",
        body: JSON.stringify({ p_username: username, p_device_id: deviceId })
      });

      // بعض المشاريع ترجع uuid مباشرة، وبعضها ترجع كائن
      const invoiceId = (typeof rpcRes === "string")
        ? rpcRes
        : (rpcRes?.id || rpcRes?.invoice_id || rpcRes?.data || rpcRes);

      if (invoiceId){
        sess.invoice_id = invoiceId;
        saveSession(sess);
        toast("تم فتح فاتورة جديدة ✅");
        return invoiceId;
      }
    }catch(e){
      // نكمل بالفولباك
      console.warn("RPC create_invoice failed, fallback insert", e);
    }

    // 2) Fallback: insert into app_invoices
    const inserted = await apiFetch(`/app_invoices`, {
      method:"POST",
      headers:{ "Prefer":"return=representation" },
      body: JSON.stringify({ username, device_id: deviceId, total: 0 })
    });

    const row = Array.isArray(inserted) ? inserted[0] : inserted;
    const invoiceId = row?.id;
    if (!invoiceId) throw new Error("Could not create invoice");

    sess.invoice_id = invoiceId;
    saveSession(sess);
    toast("تم فتح فاتورة جديدة ✅");
    return invoiceId;
  }

  async function updateInvoiceTotal(invoice_id, totalNumber){
    try{
      await apiFetch(`/app_invoices?id=eq.${invoice_id}`, {
        method:"PATCH",
        headers:{ "Prefer":"return=minimal" },
        body: JSON.stringify({ total: Number(totalNumber) || 0 })
      });
    }catch(e){
      console.warn("Update invoice total failed", e);
    }
  }

  async function startNewInvoiceAndReset(){
    const sess = loadSession();
    if (!sess?.id) return;

    // فك ارتباط الفاتورة الحالية
    sess.invoice_id = null;
    saveSession(sess);

    // فتح فاتورة جديدة عند أول عملية (أو مباشرة)
    try{ await ensureInvoice(); } catch(_){}

    // تفريغ السجل محلياً
    log = [];
    expr = "";
    lastResult = 0;
    render();
  }

  // =========================
  // Calculator + Log (local + central)
  // =========================
  const K_LOG = "hs_calc_log_v2";
  const K_LOG = "hs_calc_log_v3";
  let expr = "";
  let lastResult = 0;
  let log = loadLog();
@@ -659,14 +689,21 @@
    }catch{ return null; }
  }

  function computeTotal(){
    let total = 0;
    for (const row of log){
      const r = Number(row.result);
      if (Number.isFinite(r)) total += r;
    }
    return total;
  }

  function render(){
    exprEl.textContent = expr.trim() ? expr : "0";
    const calc = safeEval(expr);
    resEl.textContent = calc === null ? formatNumber(lastResult) : formatNumber(calc);

    tbody.innerHTML = "";
    let total = 0;

    const orderedLog = [...log].reverse(); // الأقدم فوق
    for (const row of orderedLog){
      const tr = document.createElement("tr");
@@ -684,35 +721,57 @@

      tr.append(td1, td2, td3);
      tbody.appendChild(tr);

      const r = Number(row.result);
      if (Number.isFinite(r)) total += r;
    }

    const total = computeTotal();
    grandTotalEl.textContent = formatNumber(total);
    saveLog();
  }

  async function pushOperationToCentral({ user_id, username, label, operation, result, device_id }){
  // ✅ إرسال عملية للسيرفر + invoice_id (ولو ما كان العمود موجود، يعمل fallback)
  async function pushOperationToCentral({ user_id, username, label, operation, result, device_id, invoice_id }){
    const payload = {
      user_id,
      username,
      label: label || null,
      operation,
      result,
      device_id
    };

    // جرّب مع invoice_id أولاً
    if (invoice_id) payload.invoice_id = invoice_id;

    try{
      await apiFetch(`/app_operations`, {
        method:"POST",
        headers:{ "Prefer":"return=minimal" },
        body: JSON.stringify({
          user_id,
          username,
          label: label || null,
          operation,
          result,
          device_id
        })
        body: JSON.stringify(payload)
      });
      return;
    }catch(e){
      // لو فشل بسبب عمود invoice_id غير موجود: جرّب بدون invoice_id
      const msg = String(e?.message || "");
      if (invoice_id && (msg.includes("invoice_id") || msg.includes("column") || msg.includes("schema"))){
        try{
          delete payload.invoice_id;
          await apiFetch(`/app_operations`, {
            method:"POST",
            headers:{ "Prefer":"return=minimal" },
            body: JSON.stringify(payload)
          });
          return;
        }catch(e2){
          console.warn("Central log failed", e2);
          return;
        }
      }
      console.warn("Central log failed", e);
      // ما بنوقف المستخدم إذا فشل الإرسال
    }
  }

  function newlineCommit(){
  // ✅ تسجيل العملية + إنشاء فاتورة تلقائياً
  async function newlineCommit(){
    const sess = loadSession();
    if (!sess?.id || !sess?.username){
      toast("سجّل دخول أولاً");
@@ -731,6 +790,16 @@
    const opDisplay = clean.replace(/\*/g,"×").replace(/\//g,"÷");
    const resultText = formatNumber(val);

    // ✅ تأكد من وجود فاتورة قبل حفظ العملية
    let invoiceId = null;
    try{
      invoiceId = await ensureInvoice();
    }catch(e){
      console.warn("ensureInvoice failed", e);
      // حتى لو فشلت الفاتورة، منخلي المستخدم يكمل محلياً
      toast("تنبيه: لم يتم فتح فاتورة على السيرفر");
    }

    // محلياً
    log.unshift({
      label,
@@ -746,9 +815,16 @@
      label,
      operation: opDisplay,
      result: resultText,
      device_id: getDeviceId()
      device_id: getDeviceId(),
      invoice_id: invoiceId
    });

    // تحديث total الفاتورة (لو موجودة)
    if (invoiceId){
      const total = computeTotal();
      updateInvoiceTotal(invoiceId, total);
    }

    expr = "";
    labelInput.value = "";
    render();
@@ -768,13 +844,16 @@
    if (k === "C") return clearAll();
    if (k === "CE") return clearEntry();
    if (k === "BK") return backspace();
    if (k === "=") return newlineCommit();

    // ✅ (=) يسجل ويحفظ تلقائياً
    if (k === "=") { newlineCommit(); return; }

    if (["/","*","-","+"].includes(k)){
      if (!expr.trim()) return;
      if (/[+\-*/]\s*$/.test(expr)) expr = expr.replace(/[+\-*/]\s*$/,"");
      expr += ` ${k} `;
      return render();
      render();
      return;
    }

    if (k === "."){
@@ -834,8 +913,24 @@
  $("newlineBtn").addEventListener("click", () => { vibe(); newlineCommit(); }, { passive:true });
  $("copyTableBtn").addEventListener("click", () => { vibe(); copyText(logAsTSV()); }, { passive:true });
  $("copyResBtn").addEventListener("click", () => { vibe(); copyText(resEl.textContent); }, { passive:true });
  $("pdfBtn").addEventListener("click", () => { vibe(); window.print(); }, { passive:true });
  $("clearLogBtn").addEventListener("click", () => { vibe(); log=[]; render(); toast("تم مسح السجل"); }, { passive:true });

  // ✅ PDF: بعد الطباعة افتح فاتورة جديدة وافرّغ السجل تلقائياً
  $("pdfBtn").addEventListener("click", () => {
    vibe();
    window.print();
  }, { passive:true });

  window.addEventListener("afterprint", () => {
    // إنهاء الفاتورة الحالية وبدء فاتورة جديدة تلقائياً
    startNewInvoiceAndReset();
    toast("تم حفظ الفاتورة وفتح فاتورة جديدة ✅");
  });

  $("clearLogBtn").addEventListener("click", () => {
    vibe();
    startNewInvoiceAndReset();
    toast("تم مسح السجل وفتح فاتورة جديدة ✅");
  }, { passive:true });

  window.addEventListener("keydown", (e) => {
    const map = { "Enter":"=", "Backspace":"BK", "Escape":"C", "/":"/", "*":"*", "-":"-", "+":"+",
