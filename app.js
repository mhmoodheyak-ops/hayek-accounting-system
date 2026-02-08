(() => {
  const $ = (id) => document.getElementById(id);

  const statePill = $("statePill");
  const statusText = $("statusText");
  const invoiceState = $("invoiceState");
  const totalText = $("totalText");
  const serverName = $("serverName");

  const usernameEl = $("username");
  const passwordEl = $("password");
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");

  const customerNameEl = $("customerName");
  const btnOpenInvoice = $("btnOpenInvoice");
  const btnFinalize = $("btnFinalize");
  const btnCopyTable = $("btnCopyTable");
  const btnPdf = $("btnPdf");

  const lineNoteEl = $("lineNote");
  const lineAmountEl = $("lineAmount");
  const btnAddLine = $("btnAddLine");
  const btnClearLines = $("btnClearLines");

  const linesBody = $("linesBody");
  const printable = $("printable");

  const calcDisplay = $("calcDisplay");
  const opsCount = $("opsCount");

  // Supabase config
  const cfg = window.HAYEK || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.error("Missing config.js values: SUPABASE_URL / SUPABASE_ANON_KEY");
  }

  // Create ONE Supabase client only
  if (!window.HAYEK_DB && window.supabase) {
    window.HAYEK_DB = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
  const db = window.HAYEK_DB;

  // ✅ مطابق لقاعدة بياناتك
  const USERS_TABLE = "app_users";      // columns: username, pass, blocked, device_id
  const INVOICES_TABLE = "app_invoices"; // must have: id, username, customer_name, status, total, lines, created_at, finalized_at
  const OPS_TABLE = "app_operations";    // optional (نسجل عمليات الحاسبة إن كانت الأعمدة متاحة)

  const LS_USER = "HAYEK_USER_SESSION";
  const LS_INVOICE = "HAYEK_OPEN_INVOICE";
  const LS_DEVICE = "HAYEK_DEVICE_ID";

  let sessionUser = null;     // { username }
  let currentInvoice = null;  // { id, customer_name, status, lines:[] }

  let expr = "0";
  let opsLog = [];

  // ---------- Helpers ----------
  function setStatus(msg, err=false){
    statusText.textContent = msg;
    statePill.className = "pill " + (err ? "bad" : (sessionUser ? "good" : "bad"));
    statePill.textContent = sessionUser ? "مفتوح" : "غير مسجّل";
  }

  function vibrate(){ try{ if(navigator.vibrate) navigator.vibrate(15); }catch{} }

  function money(n){ const x = Number(n||0); return (Math.round(x*100)/100).toString(); }

  function safeName(s){ return String(s||"").trim().replace(/[\\\/:*?"<>|]+/g, "-").slice(0,80); }

  function escapeHtml(s){
    return String(s||"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  }

  function updateTotal(){
    const total = (currentInvoice?.lines || []).reduce((a,l)=>a + Number(l.amount||0), 0);
    totalText.textContent = money(total);
    return total;
  }

  function setInvoiceUI(){
    const open = !!currentInvoice;
    invoiceState.textContent = open ? (currentInvoice.status === "final" ? "منتهية" : "مفتوحة") : "غير مفتوحة";

    const finalized = open && currentInvoice.status === "final";
    btnCopyTable.disabled = !finalized;
    btnPdf.disabled = !finalized;

    btnFinalize.disabled = !open || currentInvoice.status === "final";
    btnOpenInvoice.disabled = !sessionUser || !customerNameEl.value.trim();

    btnAddLine.disabled = !open || currentInvoice.status === "final";

    if (open){
      serverName.textContent = `${safeName(sessionUser.username)}__${safeName(currentInvoice.customer_name)}__${currentInvoice.id}`;
    } else {
      serverName.textContent = "—";
    }
  }

  function getOrCreateDeviceId(){
    let deviceId = localStorage.getItem(LS_DEVICE);
    if (deviceId) return deviceId;

    // crypto.randomUUID موجود غالبًا، مع fallback
    if (window.crypto && crypto.randomUUID) deviceId = crypto.randomUUID();
    else deviceId = "dev_" + Math.random().toString(16).slice(2) + "_" + Date.now();

    localStorage.setItem(LS_DEVICE, deviceId);
    return deviceId;
  }

  // ---------- LOGIN (قفل جهاز واحد) ----------
  async function login(){
    vibrate();

    const username = usernameEl.value.trim();
    const pass = passwordEl.value.trim();
    if(!username || !pass){
      setStatus("اسم المستخدم وكلمة السر إجباريين", true);
      return;
    }
    if(!db){
      setStatus("Supabase غير جاهز", true);
      return;
    }

    setStatus("جاري التحقق...");

    const deviceId = getOrCreateDeviceId();

    const { data, error } = await db
      .from(USERS_TABLE)
      .select("username, pass, blocked, device_id")
      .eq("username", username)
      .limit(1);

    if(error){
      console.error(error);
      setStatus("خطأ قراءة جدول app_users", true);
      return;
    }

    const u = data?.[0] || null;
    if(!u){ setStatus("بيانات خاطئة", true); return; }
    if(u.blocked === true){ setStatus("هذا الحساب محظور", true); return; }
    if(String(u.pass) !== pass){ setStatus("بيانات خاطئة", true); return; }

    // 🔐 قفل الجهاز
    if (u.device_id && u.device_id !== deviceId){
      setStatus("هذا الحساب مستخدم على جهاز آخر ❌", true);
      return;
    }

    // أول دخول: اربط الحساب بهذا الجهاز
    if (!u.device_id){
      const { error: upErr } = await db
        .from(USERS_TABLE)
        .update({ device_id: deviceId })
        .eq("username", username);

      if (upErr){
        console.error(upErr);
        setStatus("فشل ربط الجهاز بالحساب", true);
        return;
      }
    }

    sessionUser = { username: u.username };
    localStorage.setItem(LS_USER, JSON.stringify(sessionUser));
    setStatus("تم تسجيل الدخول ✅");
    setInvoiceUI();
  }

  function logout(){
    vibrate();
    sessionUser = null;
    currentInvoice = null;
    localStorage.removeItem(LS_USER);
    localStorage.removeItem(LS_INVOICE);
    renderLines([]);
    totalText.textContent = "0";
    setStatus("تم تسجيل الخروج");
    setInvoiceUI();
  }

  // ---------- INVOICE ----------
  async function openInvoice(){
    vibrate();
    if(!sessionUser){ setStatus("سجّل دخول أولًا", true); return; }
    const customer = customerNameEl.value.trim();
    if(!customer){ setStatus("اسم الزبون إجباري", true); return; }
    if(!db){ setStatus("Supabase غير جاهز", true); return; }

    setStatus("فتح فاتورة...");

    const payload = {
      username: sessionUser.username,
      customer_name: customer,
      status: "open",
      total: 0,
      lines: [],
      created_at: new Date().toISOString()
    };

    const { data, error } = await db
      .from(INVOICES_TABLE)
      .insert(payload)
      .select("*")
      .single();

    if(error){
      console.error(error);
      setStatus("خطأ إنشاء فاتورة (app_invoices)", true);
      return;
    }

    currentInvoice = {
      id: data.id,
      customer_name: data.customer_name,
      status: data.status,
      lines: data.lines || []
    };

    localStorage.setItem(LS_INVOICE, JSON.stringify(currentInvoice));
    renderLines(currentInvoice.lines);
    updateTotal();
    setStatus("تم فتح فاتورة ✅");
    setInvoiceUI();
  }

  async function syncInvoice(partial = {}){
    if(!db || !currentInvoice) return;

    const total = updateTotal();
    const updatePayload = { ...partial, lines: currentInvoice.lines, total };

    const { error } = await db
      .from(INVOICES_TABLE)
      .update(updatePayload)
      .eq("id", currentInvoice.id);

    if(error){
      console.error(error);
      setStatus("تحذير: لم يتم حفظ الفاتورة على السيرفر", true);
    }
  }

  async function finalizeInvoice(){
    vibrate();
    if(!currentInvoice) return;
    if(currentInvoice.status === "final") return;

    setStatus("إنهاء الفاتورة...");
    currentInvoice.status = "final";

    await syncInvoice({ status:"final", finalized_at: new Date().toISOString() });

    localStorage.setItem(LS_INVOICE, JSON.stringify(currentInvoice));
    setStatus("تم إنهاء الفاتورة ورفعها ✅");
    setInvoiceUI();
  }

  // ---------- LINES ----------
  function renderLines(lines){
    if(!lines || !lines.length){
      linesBody.innerHTML = `<tr><td colspan="4" class="center muted">لا يوجد سطور بعد.</td></tr>`;
      return;
    }
    linesBody.innerHTML = "";
    lines.forEach((l, idx)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx+1}</td>
        <td>${escapeHtml(l.note || "")}</td>
        <td>${escapeHtml(money(l.amount))}</td>
        <td class="tdActions">
          <button class="btn mini gray" data-act="edit" data-i="${idx}">تعديل</button>
          <button class="btn mini red"  data-act="del"  data-i="${idx}">حذف</button>
        </td>
      `;
      linesBody.appendChild(tr);
    });
  }

  async function addLine(){
    vibrate();
    if(!currentInvoice){ setStatus("افتح فاتورة أولًا", true); return; }
    if(currentInvoice.status === "final"){ setStatus("الفاتورة منتهية", true); return; }

    const note = lineNoteEl.value.trim();
    const amount = Number(lineAmountEl.value);
    if(!isFinite(amount)){ setStatus("المبلغ غير صحيح", true); return; }

    currentInvoice.lines.push({ note, amount: Math.round(amount*100)/100 });
    lineNoteEl.value = "";
    lineAmountEl.value = "";

    renderLines(currentInvoice.lines);
    await syncInvoice();
    setStatus("تمت إضافة السطر ✅");
    setInvoiceUI();
  }

  async function clearLines(){
    vibrate();
    if(!currentInvoice) return;
    if(currentInvoice.status === "final"){ setStatus("الفاتورة منتهية", true); return; }
    currentInvoice.lines = [];
    renderLines(currentInvoice.lines);
    await syncInvoice();
    setStatus("تم مسح السطور ✅");
    setInvoiceUI();
  }

  async function handleTableActions(e){
    const btn = e.target.closest("button");
    if(!btn) return;
    const act = btn.dataset.act;
    const i = Number(btn.dataset.i);
    if(!currentInvoice || !isFinite(i)) return;

    if(currentInvoice.status === "final"){ setStatus("الفاتورة منتهية", true); return; }

    if(act === "del"){
      vibrate();
      currentInvoice.lines.splice(i,1);
      renderLines(currentInvoice.lines);
      await syncInvoice();
      setStatus("تم الحذف ✅");
      return;
    }

    if(act === "edit"){
      vibrate();
      const l = currentInvoice.lines[i];
      const newNote = prompt("تعديل البيان (اختياري):", l.note || "");
      if(newNote === null) return;
      const newAmountStr = prompt("تعديل المبلغ:", String(l.amount ?? 0));
      if(newAmountStr === null) return;
      const newAmount = Number(newAmountStr);
      if(!isFinite(newAmount)){ setStatus("المبلغ غير صحيح", true); return; }

      l.note = (newNote || "").trim();
      l.amount = Math.round(newAmount*100)/100;
      renderLines(currentInvoice.lines);
      await syncInvoice();
      setStatus("تم التعديل ✅");
    }
  }

  // ---------- COPY TABLE ----------
  async function copyTable(){
    vibrate();
    if(!currentInvoice || currentInvoice.status !== "final"){
      setStatus("لا يمكن النسخ قبل إنهاء الفاتورة", true);
      return;
    }
    const rows = currentInvoice.lines.map((l,idx)=> `${idx+1}\t${l.note||""}\t${money(l.amount)}`);
    const text = ["رقم\tالبيان\tالمبلغ", ...rows].join("\n");
    try{
      await navigator.clipboard.writeText(text);
      setStatus("تم نسخ الجدول ✅");
    }catch{
      setStatus("فشل النسخ (المتصفح منع)", true);
    }
  }

  // ---------- PDF ----------
  function buildPrintableHTML(){
    const user = sessionUser?.username || "—";
    const customer = currentInvoice?.customer_name || "—";
    const total = money(updateTotal());
    const now = new Date().toLocaleString("ar");

    const header = `
      <h3>فاتورة — HAYEK SPOT</h3>
      <p class="p-muted">
        المستخدم: <b>${escapeHtml(user)}</b> | الزبون: <b>${escapeHtml(customer)}</b> | التاريخ: <b>${escapeHtml(now)}</b>
      </p>
      <p class="p-muted">ملاحظة تعريفية: هذه الفاتورة صادرة من نظام HAYEK SPOT.</p>
    `;

    const rows = (currentInvoice?.lines || []).map((l, idx) => `
      <tr>
        <td>${idx+1}</td>
        <td>${escapeHtml(l.note||"")}</td>
        <td>${escapeHtml(money(l.amount))}</td>
      </tr>
    `).join("");

    const table = `
      <table>
        <thead>
          <tr>
            <th style="width:60px">#</th>
            <th>البيان</th>
            <th style="width:140px">المبلغ</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="3" class="center">لا يوجد سطور</td></tr>`}</tbody>
      </table>
    `;

    const footer = `
      <div class="p-footer">
        <b>الإجمالي:</b> ${escapeHtml(total)} <br/>
        شكرًا لتعاملكم معنا — HAYEK SPOT.
      </div>
    `;

    return `${header}${table}${footer}`;
  }

  async function exportPDF(){
    vibrate();
    if(!currentInvoice || currentInvoice.status !== "final"){
      setStatus("لا يمكن PDF قبل إنهاء الفاتورة", true);
      return;
    }

    printable.style.display = "block";
    printable.innerHTML = buildPrintableHTML();

    const fileName = `${safeName(sessionUser.username)}__${safeName(currentInvoice.customer_name)}.pdf`;

    const opt = {
      margin: 10,
      filename: fileName,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };

    try{
      await html2pdf().set(opt).from(printable).save();
      setStatus("تم تصدير PDF ✅");
    }catch(e){
      console.error(e);
      setStatus("فشل تصدير PDF", true);
    }finally{
      printable.style.display = "none";
    }
  }

  // ---------- CALC ----------
  function setCalcDisplay(v){ calcDisplay.textContent = v; }

  async function tryLogOperation(exprText, outVal){
    // إذا جدول app_operations عنده أعمدة مختلفة، تجاهل بدون كسر الصفحة
    try{
      if(!db || !sessionUser) return;
      // نفترض أعمدة عامة: username, expr, result, created_at (إن ما موجودة، يفشل بصمت)
      await db.from(OPS_TABLE).insert({
        username: sessionUser.username,
        expr: exprText,
        result: String(outVal),
        created_at: new Date().toISOString()
      });
    }catch{}
  }

  async function calcPress(k){
    vibrate();

    if (k === "C"){
      expr = "0";
      setCalcDisplay("0");
      return;
    }

    if (k === "="){
      try{
        const cleaned = expr.replace(/[^0-9+\-*/().]/g, "");
        // eslint-disable-next-line no-new-func
        const val = Function(`"use strict"; return (${cleaned || "0"});`)();
        const out = Math.round(Number(val)*100)/100;
        setCalcDisplay(String(out));

        opsLog.push({ expr, out, t: Date.now() });
        opsCount.textContent = String(opsLog.length);

        await tryLogOperation(expr, out);
        expr = String(out);
      }catch{
        setStatus("عملية غير صحيحة بالحاسبة", true);
      }
      return;
    }

    if (k === "PUT"){
      const v = Number(calcDisplay.textContent);
      if (isFinite(v)){
        lineAmountEl.value = String(v);
        setStatus("تم إدخال النتيجة في مبلغ السطر ✅");
      }
      return;
    }

    if (expr === "0" && /[0-9.]/.test(k)) expr = k;
    else expr += k;

    setCalcDisplay(expr);
  }

  // ---------- Events ----------
  btnLogin.addEventListener("click", login);
  btnLogout.addEventListener("click", logout);

  btnOpenInvoice.addEventListener("click", openInvoice);
  customerNameEl.addEventListener("keydown", (e)=>{ if(e.key === "Enter") openInvoice(); });

  btnFinalize.addEventListener("click", finalizeInvoice);

  btnAddLine.addEventListener("click", addLine);
  btnClearLines.addEventListener("click", clearLines);
  linesBody.addEventListener("click", handleTableActions);

  btnCopyTable.addEventListener("click", copyTable);
  btnPdf.addEventListener("click", exportPDF);

  document.addEventListener("click", (e)=>{
    const b = e.target.closest(".key");
    if (!b) return;
    calcPress(b.dataset.k);
  });

  // ---------- Restore ----------
  function restore(){
    try{
      const u = JSON.parse(localStorage.getItem(LS_USER) || "null");
      if (u && u.username) sessionUser = u;
    }catch{}

    try{
      const inv = JSON.parse(localStorage.getItem(LS_INVOICE) || "null");
      if (inv && inv.id){
        currentInvoice = inv;
        renderLines(currentInvoice.lines || []);
        updateTotal();
      }
    }catch{}

    setCalcDisplay("0");
    opsCount.textContent = "0";
    setInvoiceUI();
    setStatus("جاهز");
  }

  restore();
})();
