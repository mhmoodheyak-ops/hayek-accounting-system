(() => {
  const $ = (id) => document.getElementById(id);

  const pill = $("pill");
  const statusEl = $("status");

  const adminUserEl = $("adminUser");
  const adminPassEl = $("adminPass");
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");

  const newUserEl = $("newUser");
  const newPassEl = $("newPass");
  const newRoleEl = $("newRole");
  const btnAddUser = $("btnAddUser");
  const btnRefreshUsers = $("btnRefreshUsers");

  const usersCount = $("usersCount");
  const usersBody = $("usersBody");

  const invUserEl = $("invUser");
  const invStatusEl = $("invStatus");
  const invFromEl = $("invFrom");
  const invToEl = $("invToEl") || $("invTo"); // احتياط
  const btnLoadInvoices = $("btnLoadInvoices");
  const btnExportListPdf = $("btnExportListPdf");
  const invCount = $("invCount");
  const invBody = $("invBody");

  const printable = $("printable");

  const cfg = window.HAYEK || {};
  if (!window.HAYEK_DB && window.supabase) {
    window.HAYEK_DB = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
  const db = window.HAYEK_DB;

  const USERS_TABLE = "app_users";
  const INVOICES_TABLE = "app_invoices";

  const LS_ADMIN = "HAYEK_ADMIN_SESSION";
  const LS_DEVICE = "HAYEK_DEVICE_ID";

  let adminSession = null;
  let invoicesCache = [];

  function vibrate(){ try{ if(navigator.vibrate) navigator.vibrate(15); }catch{} }
  function safe(s){ return String(s||"").trim(); }
  function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
  function money(n){ const x = Number(n||0); return (Math.round(x*100)/100).toString(); }
  function fmtDate(iso){
    try{ return new Date(iso).toLocaleString("ar"); }catch{ return iso || ""; }
  }
  function setStatus(msg, err=false){
    statusEl.textContent = msg;
    pill.className = "pill " + (adminSession ? "good" : "bad");
    pill.textContent = adminSession ? "مفتوح" : "غير مسجّل";
    if(err) pill.className = "pill bad";
  }

  function getOrCreateDeviceId(){
    let deviceId = localStorage.getItem(LS_DEVICE);
    if (deviceId) return deviceId;

    if (window.crypto && crypto.randomUUID) deviceId = crypto.randomUUID();
    else deviceId = "dev_" + Math.random().toString(16).slice(2) + "_" + Date.now();

    localStorage.setItem(LS_DEVICE, deviceId);
    return deviceId;
  }

  function requireAdmin(){
    if(!adminSession){
      setStatus("سجّل دخول Admin أولاً", true);
      return false;
    }
    return true;
  }

  async function login(){
    vibrate();
    if(!db){ setStatus("Supabase غير جاهز (راجع config.js)", true); return; }

    const username = safe(adminUserEl.value);
    const pass = safe(adminPassEl.value);
    if(!username || !pass){ setStatus("اسم المستخدم وكلمة السر إجباريين", true); return; }

    setStatus("جاري التحقق...");

    const deviceId = getOrCreateDeviceId();

    const { data, error } = await db
      .from(USERS_TABLE)
      .select("username, pass, is_admin, blocked, device_id")
      .eq("username", username)
      .limit(1);

    if(error){ console.error(error); setStatus("خطأ قراءة app_users", true); return; }

    const u = data?.[0] || null;
    if(!u){ setStatus("بيانات خاطئة", true); return; }
    if(u.blocked === true){ setStatus("هذا الحساب محظور", true); return; }
    if(String(u.pass) !== pass){ setStatus("بيانات خاطئة", true); return; }
    if(u.is_admin !== true){ setStatus("هذا الحساب ليس Admin", true); return; }

    if (u.device_id && u.device_id !== deviceId){
      setStatus("Admin مستخدم على جهاز آخر ❌", true);
      return;
    }

    if (!u.device_id){
      const { error: upErr } = await db
        .from(USERS_TABLE)
        .update({ device_id: deviceId })
        .eq("username", username);

      if(upErr){ console.error(upErr); setStatus("فشل ربط الجهاز للأدمن", true); return; }
    }

    adminSession = { username: u.username };
    localStorage.setItem(LS_ADMIN, JSON.stringify(adminSession));
    setStatus("تم تسجيل الدخول ✅");

    await loadUsers();
    await loadInvoices(true);
  }

  function logout(){
    vibrate();
    adminSession = null;
    localStorage.removeItem(LS_ADMIN);
    usersBody.innerHTML = `<tr><td colspan="6" class="center muted">لا يوجد بيانات بعد.</td></tr>`;
    invBody.innerHTML = `<tr><td colspan="7" class="center muted">لا يوجد بيانات بعد.</td></tr>`;
    usersCount.textContent = "0";
    invCount.textContent = "0";
    invUserEl.innerHTML = `<option value="">— كل المستخدمين —</option>`;
    invoicesCache = [];
    setStatus("تم تسجيل الخروج");
  }

  async function addUser(){
    vibrate();
    if(!requireAdmin()) return;

    const username = safe(newUserEl.value);
    const pass = safe(newPassEl.value);
    const is_admin = (newRoleEl.value === "admin");

    if(!username || !pass){ setStatus("اسم المستخدم وكلمة السر إجباريين", true); return; }

    setStatus("إضافة مستخدم...");

    const payload = {
      username,
      pass,
      is_admin,
      blocked: false,
      device_id: null,
      created_at: new Date().toISOString()
    };

    const { error } = await db.from(USERS_TABLE).insert(payload);
    if(error){
      console.error(error);
      setStatus("فشل الإضافة (قد يكون الاسم موجود)", true);
      return;
    }

    newUserEl.value = "";
    newPassEl.value = "";
    newRoleEl.value = "user";

    setStatus("تمت الإضافة ✅");
    await loadUsers();
  }

  async function loadUsers(){
    if(!requireAdmin()) return;

    setStatus("تحميل المستخدمين...");

    const { data, error } = await db
      .from(USERS_TABLE)
      .select("id, username, is_admin, blocked, device_id")
      .order("id", { ascending: true });

    if(error){ console.error(error); setStatus("خطأ تحميل المستخدمين", true); return; }

    const rows = data || [];
    usersCount.textContent = String(rows.length);

    // تعبئة dropdown المستخدمين للفواتير
    invUserEl.innerHTML = `<option value="">— كل المستخدمين —</option>` + rows
      .filter(r => !r.is_admin) // فقط المستخدمين العاديين
      .map(r => `<option value="${escapeHtml(r.username)}">${escapeHtml(r.username)}</option>`)
      .join("");

    if(!rows.length){
      usersBody.innerHTML = `<tr><td colspan="6" class="center muted">لا يوجد بيانات.</td></tr>`;
      setStatus("جاهز");
      return;
    }

    usersBody.innerHTML = "";
    rows.forEach((u, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx+1}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>${u.is_admin ? "TRUE" : "FALSE"}</td>
        <td>${u.blocked ? "TRUE" : "FALSE"}</td>
        <td>${u.device_id ? "مقفول" : "حر"}</td>
        <td class="tdActions">
          <button class="btn mini ${u.blocked ? "green" : "blue"}" data-act="toggleBlock" data-user="${escapeHtml(u.username)}">
            ${u.blocked ? "فك الحظر" : "حظر"}
          </button>
          <button class="btn mini gray" data-act="resetDevice" data-user="${escapeHtml(u.username)}">فك ربط الجهاز</button>
          <button class="btn mini red" data-act="delete" data-user="${escapeHtml(u.username)}">حذف</button>
        </td>
      `;
      usersBody.appendChild(tr);
    });

    setStatus("جاهز");
  }

  async function toggleBlock(username){
    vibrate();
    if(!requireAdmin()) return;

    const { data, error } = await db
      .from(USERS_TABLE)
      .select("blocked")
      .eq("username", username)
      .limit(1);

    if(error){ console.error(error); setStatus("خطأ قراءة حالة الحظر", true); return; }
    const blocked = !!(data?.[0]?.blocked);

    const { error: upErr } = await db
      .from(USERS_TABLE)
      .update({ blocked: !blocked })
      .eq("username", username);

    if(upErr){ console.error(upErr); setStatus("فشل تحديث الحظر", true); return; }

    setStatus(blocked ? "تم فك الحظر ✅" : "تم الحظر ✅");
    await loadUsers();
  }

  async function resetDevice(username){
    vibrate();
    if(!requireAdmin()) return;

    const ok = confirm(`فك ربط الجهاز للمستخدم: ${username} ؟`);
    if(!ok) return;

    const { error } = await db
      .from(USERS_TABLE)
      .update({ device_id: null })
      .eq("username", username);

    if(error){ console.error(error); setStatus("فشل فك ربط الجهاز", true); return; }

    setStatus("تم فك ربط الجهاز ✅");
    await loadUsers();
  }

  async function deleteUser(username){
    vibrate();
    if(!requireAdmin()) return;

    const ok = confirm(`حذف المستخدم نهائياً: ${username} ؟`);
    if(!ok) return;

    const { error } = await db
      .from(USERS_TABLE)
      .delete()
      .eq("username", username);

    if(error){ console.error(error); setStatus("فشل الحذف", true); return; }

    setStatus("تم الحذف ✅");
    await loadUsers();
  }

  usersBody.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if(!b) return;
    const act = b.dataset.act;
    const user = b.dataset.user;
    if(!act || !user) return;

    if(act === "toggleBlock") await toggleBlock(user);
    if(act === "resetDevice") await resetDevice(user);
    if(act === "delete") await deleteUser(user);
  });

  function dateToISOStart(d){ return d ? new Date(d + "T00:00:00").toISOString() : null; }
  function dateToISOEnd(d){ return d ? new Date(d + "T23:59:59").toISOString() : null; }

  async function loadInvoices(silent=false){
    if(!requireAdmin()) return;
    if(!silent) setStatus("جلب الفواتير...");

    let q = db
      .from(INVOICES_TABLE)
      .select("id, username, customer_name, status, total, lines, created_at, finalized_at")
      .order("created_at", { ascending: false })
      .limit(200);

    const u = safe(invUserEl.value);
    const st = safe(invStatusEl.value);
    const from = safe(invFromEl.value);
    const to = safe((invToEl && invToEl.value) ? invToEl.value : "");

    if(u) q = q.eq("username", u);
    if(st) q = q.eq("status", st);

    const fromISO = dateToISOStart(from);
    const toISO = dateToISOEnd(to);
    if(fromISO) q = q.gte("created_at", fromISO);
    if(toISO) q = q.lte("created_at", toISO);

    const { data, error } = await q;

    if(error){ console.error(error); setStatus("خطأ جلب الفواتير", true); return; }

    invoicesCache = data || [];
    invCount.textContent = String(invoicesCache.length);

    if(!invoicesCache.length){
      invBody.innerHTML = `<tr><td colspan="7" class="center muted">لا يوجد نتائج.</td></tr>`;
      if(!silent) setStatus("جاهز");
      return;
    }

    invBody.innerHTML = "";
    invoicesCache.forEach(inv => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${inv.id}</td>
        <td>${escapeHtml(inv.username || "")}</td>
        <td>${escapeHtml(inv.customer_name || "")}</td>
        <td>${escapeHtml(inv.status || "")}</td>
        <td>${escapeHtml(money(inv.total))}</td>
        <td>${escapeHtml(fmtDate(inv.created_at))}</td>
        <td class="tdActions">
          <button class="btn mini blue" data-act="pdfOne" data-id="${inv.id}">PDF</button>
        </td>
      `;
      invBody.appendChild(tr);
    });

    if(!silent) setStatus("جاهز");
  }

  btnLoadInvoices.addEventListener("click", () => loadInvoices(false));
  btnRefreshUsers.addEventListener("click", loadUsers);

  invBody.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if(!b) return;
    const act = b.dataset.act;
    const id = Number(b.dataset.id);
    if(act === "pdfOne" && isFinite(id)){
      const inv = invoicesCache.find(x => Number(x.id) === id);
      if(inv) exportInvoicePDF(inv);
    }
  });

  function buildInvoicePrintable(inv){
    const now = new Date().toLocaleString("ar");
    const total = money(inv.total);

    const head = `
      <div class="p-head">
        <h3>فاتورة — HAYEK SPOT</h3>
        <div class="p-sub">نسخة من لوحة الأدمن</div>
      </div>
    `;

    const meta = `
      <div class="p-meta">
        <div>المستخدم: <b>${escapeHtml(inv.username || "—")}</b></div>
        <div>اسم الزبون: <b>${escapeHtml(inv.customer_name || "—")}</b></div>
        <div>التاريخ: <b>${escapeHtml(fmtDate(inv.created_at))}</b></div>
        <div>رقم الفاتورة: <b>${escapeHtml(String(inv.id))}</b></div>
        <div>وقت الطباعة: <b>${escapeHtml(now)}</b></div>
      </div>
    `;

    const topNote = `
      <div class="p-note">
        نص تعريفي (أعلى الملف): هذه الفاتورة صادرة من نظام <b>HAYEK SPOT</b> — يُرجى مراجعة البنود قبل الدفع.
      </div>
    `;

    const lines = Array.isArray(inv.lines) ? inv.lines : [];
    const rows = lines.map((l, idx) => `
      <tr>
        <td>${idx+1}</td>
        <td>${escapeHtml(l.note || "")}</td>
        <td>${escapeHtml(money(l.amount))}</td>
      </tr>
    `).join("");

    const table = `
      <table>
        <thead>
          <tr>
            <th style="width:55px">#</th>
            <th>البيان</th>
            <th style="width:120px">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="3" style="text-align:center">لا يوجد سطور</td></tr>`}
        </tbody>
      </table>
    `;

    const totalBox = `
      <div class="p-total">
        الإجمالي النهائي: <b>${escapeHtml(total)}</b>
      </div>
    `;

    const footer = `
      <div class="p-footer">
        نص تعريفي (آخر الملف): شكرًا لتعاملكم معنا. للاستفسار أو الدعم، تواصلوا مع إدارة <b>HAYEK SPOT</b>.
      </div>
    `;

    return `${head}${meta}${topNote}${table}${totalBox}${footer}`;
  }

  async function exportInvoicePDF(inv){
    vibrate();
    printable.style.display = "block";
    printable.innerHTML = buildInvoicePrintable(inv);

    const fileName = `${safe(inv.username)}__${safe(inv.customer_name)}__${inv.id}.pdf`.replace(/[\\\/:*?"<>|]+/g, "-");

    const opt = {
      margin: 8,
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

  async function exportInvoicesListPDF(){
    vibrate();
    if(!requireAdmin()) return;

    const list = invoicesCache || [];
    if(!list.length){ setStatus("لا يوجد نتائج لتصديرها", true); return; }

    const now = new Date().toLocaleString("ar");
    const rows = list.map((inv, idx) => `
      <tr>
        <td>${idx+1}</td>
        <td>${escapeHtml(inv.username || "")}</td>
        <td>${escapeHtml(inv.customer_name || "")}</td>
        <td>${escapeHtml(inv.status || "")}</td>
        <td>${escapeHtml(money(inv.total))}</td>
        <td>${escapeHtml(fmtDate(inv.created_at))}</td>
      </tr>
    `).join("");

    printable.style.display = "block";
    printable.innerHTML = `
      <div class="p-head">
        <h3>قائمة الفواتير — HAYEK SPOT</h3>
        <div class="p-sub">تقرير من لوحة الأدمن</div>
      </div>
      <div class="p-meta">
        <div>وقت الطباعة: <b>${escapeHtml(now)}</b></div>
        <div>عدد النتائج: <b>${list.length}</b></div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:55px">#</th>
            <th>المستخدم</th>
            <th>الزبون</th>
            <th>الحالة</th>
            <th>الإجمالي</th>
            <th>التاريخ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="p-footer">
        هذا التقرير مولّد من نظام <b>HAYEK SPOT</b>.
      </div>
    `;

    const opt = {
      margin: 8,
      filename: `Invoices_List_${Date.now()}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };

    try{
      await html2pdf().set(opt).from(printable).save();
      setStatus("تم تصدير تقرير PDF ✅");
    }catch(e){
      console.error(e);
      setStatus("فشل تصدير التقرير", true);
    }finally{
      printable.style.display = "none";
    }
  }

  btnExportListPdf.addEventListener("click", exportInvoicesListPDF);

  btnLogin.addEventListener("click", login);
  btnLogout.addEventListener("click", logout);
  btnAddUser.addEventListener("click", addUser);

  function restore(){
    try{
      const s = JSON.parse(localStorage.getItem(LS_ADMIN) || "null");
      if(s && s.username) adminSession = s;
    }catch{}
    setStatus("جاهز");
  }

  restore();
})();
