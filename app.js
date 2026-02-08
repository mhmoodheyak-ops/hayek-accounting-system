(() => {
  const $ = (id) => document.getElementById(id);

  // عناصر
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

  // إعداد Supabase
  const cfg = window.HAYEK || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    setStatus("مفاتيح Supabase غير جاهزة في config.js", true);
    console.error("Missing Supabase config.");
  }

  // Instance واحدة
  if (!window.HAYEK_DB && window.supabase) {
    window.HAYEK_DB = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
  const db = window.HAYEK_DB;

  // تخزين محلي
  const LS_USER = "HAYEK_USER_SESSION";
  const LS_INVOICE = "HAYEK_OPEN_INVOICE";

  // جداول/حقول (إذا أسماءك مختلفة خبرني ونعدّلها)
  const USERS_TABLE = "users";       // أعمدة متوقعة: id, username, password, blocked(optional)
  const INVOICES_TABLE = "invoices"; // أعمدة متوقعة: id, user_id, username, customer_name, status, total, lines, created_at, finalized_at

  // حالة
  let sessionUser = null;   // { id, username }
  let currentInvoice = null; // { id, customer_name, status, lines:[] }

  // حاسبة
  let expr = "0";
  let opsLog = [];

  // أدوات
  function setStatus(msg, err=false) {
    statusText.textContent = msg;
    statePill.className = "pill " + (err ? "bad" : (sessionUser ? "good" : "bad"));
    statePill.textContent = sessionUser ? "مفتوح" : "غير مسجّل";
  }
  function setPillLogin(ok){
    statePill.className = "pill " + (ok ? "good" : "bad");
    statePill.textContent = ok ? "مفتوح" : "غير مسجّل";
  }
  function vibrate(){
    try { if (navigator.vibrate) navigator.vibrate(15); } catch {}
  }
  function toastShake(el){
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }
  function money(n){
    const x = Number(n || 0);
    return (Math.round(x*100)/100).toString();
  }
  function safeName(s){
    return String(s||"").trim().replace(/[\\\/:*?"<>|]+/g, "-").slice(0,80);
  }
  function updateTotal(){
    const total = (currentInvoice?.lines || []).reduce((a,l)=>a + Number(l.amount||0), 0);
    totalText.textContent = money(total);
    return total;
  }
  function setInvoiceUI(){
    const open = !!currentInvoice;
    invoiceState.textContent = open ? (currentInvoice.status === "final" ? "منتهية" : "مفتوحة") : "غير مفتوحة";

    // ممنوع نسخ/PDF إلا بعد إنهاء
    const finalized = open && currentInvoice.status === "final";
    btnCopyTable.disabled = !finalized;
    btnPdf.disabled = !finalized;

    // فتح/إنهاء
    btnFinalize.disabled = !open || currentInvoice.status === "final";
    btnOpenInvoice.disabled = !sessionUser || !customerNameEl.value.trim();

    // إضافة سطر
    btnAddLine.disabled = !open || currentInvoice.status === "final";

    // اسم السيرفر
    if (open){
      serverName.textContent = `${safeName(sessionUser.username)}__${safeName(currentInvoice.customer_name)}__${currentInvoice.id}`;
    } else {
      serverName.textContent = "—";
    }
  }

  // ========= 로그인 (مطلوب: اسم + كلمة سر) =========
  async function login() {
    vibrate();
    const username = usernameEl.value.trim();
    const password = passwordEl.value.trim();
    if (!username || !password){
      setStatus("اسم المستخدم وكلمة السر إجباريين", true);
      toastShake(btnLogin);
      return;
    }
    if (!db){
      setStatus("Supabase غير جاهز", true);
      return;
    }

    setStatus("جاري تسجيل الدخول...");
    // بحث عن المستخدم
    const { data, error } = await db
      .from(USERS_TABLE)
      .select("*")
      .eq("username", username)
      .limit(1);

    if (error){
      console.error(error);
      setStatus("خطأ اتصال (users table)", true);
      return;
    }

    const u = (data && data[0]) ? data[0] : null;
    if (!u){
      setStatus("بيانات خاطئة (المستخدم غير موجود)", true);
      setPillLogin(false);
      return;
    }
    if (u.blocked === true){
      setStatus("هذا المستخدم محظور", true);
      setPillLogin(false);
      return;
    }
    if (String(u.password) !== password){
      setStatus("بيانات خاطئة", true);
      setPillLogin(false);
      return;
    }

    sessionUser = { id: u.id, username: u.username };
    localStorage.setItem(LS_USER, JSON.stringify(sessionUser));

    setStatus("تم تسجيل الدخول ✅");
    setPillLogin(true);
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
    setPillLogin(false);
    setInvoiceUI();
  }

  // ========= فتح فاتورة تلقائيًا عند اسم الزبون =========
  async function openInvoice() {
    vibrate();
    if (!sessionUser){
      setStatus("سجّل دخول أولًا", true);
      return;
    }
    const customer = customerNameEl.value.trim();
    if (!customer){
      setStatus("اسم الزبون إجباري", true);
      toastShake(customerNameEl);
      return;
    }
    if (!db){
      setStatus("Supabase غير جاهز", true);
      return;
    }

    setStatus("فتح فاتورة...");

    // إنشاء فاتورة مفتوحة
    const payload = {
      user_id: sessionUser.id,
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

    if (error){
      console.error(error);
      setStatus("خطأ إنشاء فاتورة (invoices table)", true);
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

  // ========= حفظ الفاتورة على السيرفر (تحديث) =========
  async function syncInvoice(partial = {}) {
    if (!db || !currentInvoice) return;

    const total = updateTotal();
    const updatePayload = {
      ...partial,
      lines: currentInvoice.lines,
      total
    };

    const { error } = await db
      .from(INVOICES_TABLE)
      .update(updatePayload)
      .eq("id", currentInvoice.id);

    if (error){
      console.error(error);
      setStatus("تحذير: لم يتم الحفظ على السيرفر", true);
    }
  }

  // ========= إنهاء الفاتورة (إجباري قبل PDF/نسخ) =========
  async function finalizeInvoice(){
    vibrate();
    if (!currentInvoice) return;
    if (currentInvoice.status === "final") return;

    setStatus("إنهاء الفاتورة...");
    currentInvoice.status = "final";

    await syncInvoice({ status: "final", finalized_at: new Date().toISOString() });

    localStorage.setItem(LS_INVOICE, JSON.stringify(currentInvoice));
    setStatus("تم إنهاء الفاتورة ورفعها ✅");
    setInvoiceUI();
  }

  // ========= سطور =========
  function renderLines(lines){
    if (!lines || !lines.length){
      linesBody.innerHTML = `<tr><td colspan="4" class="center muted">لا يوجد سطور بعد.</td></tr>`;
      return;
    }
    linesBody.innerHTML = "";
    lines.forEach((l, idx) => {
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

  function escapeHtml(s){
    return String(s||"").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  async function addLine(){
    vibrate();
    if (!currentInvoice){
      setStatus("افتح فاتورة أولًا", true);
      return;
    }
    if (currentInvoice.status === "final"){
      setStatus("الفاتورة منتهية، لا يمكن إضافة سطور", true);
      return;
    }

    const note = lineNoteEl.value.trim();
    const amount = Number(lineAmountEl.value);
    if (!isFinite(amount)){
      setStatus("المبلغ غير صحيح", true);
      toastShake(lineAmountEl);
      return;
    }

    currentInvoice.lines.push({
      note,
      amount: Math.round(amount*100)/100
    });

    lineNoteEl.value = "";
    lineAmountEl.value = "";

    renderLines(currentInvoice.lines);
    await syncInvoice();
    setStatus("تمت إضافة السطر ✅");
    setInvoiceUI();
  }

  async function clearLines(){
    vibrate();
    if (!currentInvoice) return;
    if (currentInvoice.status === "final"){
      setStatus("الفاتورة منتهية، لا يمكن مسح السطور", true);
      return;
    }
    currentInvoice.lines = [];
    renderLines(currentInvoice.lines);
    await syncInvoice();
    setStatus("تم مسح السطور ✅");
    setInvoiceUI();
  }

  async function handleTableActions(e){
    const btn = e.target.closest("button");
    if (!btn) return;
    const act = btn.dataset.act;
    const i = Number(btn.dataset.i);
    if (!currentInvoice || !isFinite(i)) return;

    if (currentInvoice.status === "final"){
      setStatus("الفاتورة منتهية، لا تعديل/حذف", true);
      return;
    }

    if (act === "del"){
      vibrate();
      currentInvoice.lines.splice(i,1);
      renderLines(currentInvoice.lines);
      await syncInvoice();
      setStatus("تم الحذف ✅");
      return;
    }

    if (act === "edit"){
      vibrate();
      const l = currentInvoice.lines[i];
      const newNote = prompt("تعديل البيان (اختياري):", l.note || "");
      if (newNote === null) return;
      const newAmountStr = prompt("تعديل المبلغ:", String(l.amount ?? 0));
      if (newAmountStr === null) return;
      const newAmount = Number(newAmountStr);
      if (!isFinite(newAmount)){
        setStatus("المبلغ غير صحيح", true);
        return;
      }
      l.note = (newNote || "").trim();
      l.amount = Math.round(newAmount*100)/100;
      renderLines(currentInvoice.lines);
      await syncInvoice();
      setStatus("تم التعديل ✅");
    }
  }

  // ========= نسخ الجدول (بعد الإنهاء فقط) =========
  async function copyTable(){
    vibrate();
    if (!currentInvoice || currentInvoice.status !== "final"){
      setStatus("لا يمكن النسخ قبل إنهاء الفاتورة", true);
      return;
    }

    const rows = currentInvoice.lines.map((l,idx)=> `${idx+1}\t${l.note||""}\t${money(l.amount)}`);
    const header = "رقم\tالبيان\tالمبلغ";
    const text = [header, ...rows].join("\n");

    try{
      await navigator.clipboard.writeText(text);
      setStatus("تم نسخ الجدول ✅");
    }catch{
      setStatus("لم ينجح النسخ (المتصفح منع)", true);
    }
  }

  // ========= PDF احترافي (بعد الإنهاء فقط) =========
  function buildPrintableHTML(){
    const user = sessionUser?.username || "—";
    const customer = currentInvoice?.customer_name || "—";
    const total = money(updateTotal());
    const now = new Date().toLocaleString("ar");

    const headerText = `
      <h3>فاتورة — HAYEK SPOT</h3>
      <p class="p-muted">
        المستخدم: <b>${escapeHtml(user)}</b> &nbsp; | &nbsp;
        الزبون: <b>${escapeHtml(customer)}</b> &nbsp; | &nbsp;
        التاريخ: <b>${escapeHtml(now)}</b>
      </p>
      <p class="p-muted">
        ملاحظة تعريفية: هذه الفاتورة صادرة من نظام HAYEK SPOT، لأي استفسار تواصل مع الإدارة.
      </p>
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
        <tbody>
          ${rows || `<tr><td colspan="3" class="center">لا يوجد سطور</td></tr>`}
        </tbody>
      </table>
    `;

    const footer = `
      <div class="p-footer">
        <b>الإجمالي:</b> ${escapeHtml(total)} <br/>
        نص تعريفي في نهاية الملف: شكرًا لتعاملكم معنا — HAYEK SPOT.
      </div>
    `;

    return `${headerText}${table}${footer}`;
  }

  async function exportPDF(){
    vibrate();
    if (!currentInvoice || currentInvoice.status !== "final"){
      setStatus("لا يمكن PDF قبل إنهاء الفاتورة", true);
      return;
    }

    printable.style.display = "block";
    printable.innerHTML = buildPrintableHTML();

    const fileName = `${safeName(sessionUser.username)}__${safeName(currentInvoice.customer_name)}.pdf`;

    // إعدادات PDF احترافية
    const opt = {
      margin:       10,
      filename:     fileName,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try{
      await html2pdf().set(opt).from(printable).save();
      setStatus("تم تصدير PDF ✅");
    }catch(e){
      console.error(e);
      setStatus("فشل تصدير PDF", true);
    } finally {
      printable.style.display = "none";
    }
  }

  // ========= الحاسبة =========
  function setCalcDisplay(v){
    calcDisplay.textContent = v;
  }
  function calcPress(k){
    vibrate();
    toastShake(calcDisplay);

    if (k === "C"){
      expr = "0";
      setCalcDisplay("0");
      return;
    }
    if (k === "="){
      try{
        // تقييم بسيط
        const cleaned = expr.replace(/[^0-9+\-*/().]/g, "");
        // eslint-disable-next-line no-new-func
        const val = Function(`"use strict"; return (${cleaned || "0"});`)();
        const out = Math.round(Number(val)*100)/100;
        setCalcDisplay(String(out));
        opsLog.push({ expr, out, t: Date.now() });
        opsCount.textContent = String(opsLog.length);
        expr = String(out);
      }catch{
        setStatus("عملية غير صحيحة بالحاسبة", true);
      }
      return;
    }
    if (k === "PUT"){
      // إدخال النتيجة في مبلغ السطر
      const v = Number(calcDisplay.textContent);
      if (isFinite(v)){
        lineAmountEl.value = String(v);
        setStatus("تم إدخال النتيجة في مبلغ السطر ✅");
      }
      return;
    }

    if (expr === "0" && /[0-9.]/.test(k)){
      expr = k;
    } else {
      expr += k;
    }
    setCalcDisplay(expr);
  }

  // ========= أحداث =========
  btnLogin.addEventListener("click", login);
  btnLogout.addEventListener("click", logout);

  btnOpenInvoice.addEventListener("click", openInvoice);
  customerNameEl.addEventListener("keydown", (e)=>{
    if (e.key === "Enter") openInvoice();
  });

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

  // ========= استعادة جلسة =========
  function restore(){
    try{
      const u = JSON.parse(localStorage.getItem(LS_USER) || "null");
      if (u && u.id && u.username){
        sessionUser = u;
        setPillLogin(true);
      } else {
        setPillLogin(false);
      }
    }catch{ setPillLogin(false); }

    try{
      const inv = JSON.parse(localStorage.getItem(LS_INVOICE) || "null");
      if (inv && inv.id){
        currentInvoice = inv;
        renderLines(currentInvoice.lines || []);
        updateTotal();
      }
    }catch{}

    setInvoiceUI();
    setStatus("جاهز");
    setCalcDisplay("0");
    opsCount.textContent = "0";
  }

  restore();
})();
