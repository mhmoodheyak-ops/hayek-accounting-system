/* admin.js — لوحة الإدارة (واجهة مستقرة + إصلاح invoiceId في العمليات) */
(() => {
  const $ = (id) => document.getElementById(id);

  // ===== Helpers =====
  const toast = (msg, bad = false) => {
    const t = $("toast");
    t.style.display = "block";
    t.textContent = msg || "";
    t.style.borderColor = bad ? "rgba(255,107,107,.35)" : "rgba(73,227,154,.35)";
    setTimeout(() => (t.style.display = "none"), 2200);
  };

  const esc = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const fmtNum = (n) => {
    const x = Number(n);
    if (!isFinite(x)) return "0";
    return String(Math.round(x * 1000) / 1000);
  };

  const fmtDT = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm} ${y}/${m}/${day}`;
  };

  const sinceText = (iso) => {
    if (!iso) return "—";
    const ms = Date.now() - new Date(iso).getTime();
    if (!isFinite(ms) || ms < 0) return "—";
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} دق`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} س`;
    const days = Math.floor(hrs / 24);
    return `منذ ${days} يوم`;
  };

  // ===== Auth Guard =====
  if (!window.HAYEK_AUTH || !window.__HAYEK_AUTH_LOADED__ || !window.HAYEK_AUTH.isAuthed()) {
    location.href = "index.html?v=" + Date.now();
    return;
  }
  const session = window.HAYEK_AUTH.getUser() || {};
  if (session.role !== "admin") {
    location.href = "invoice.html?v=" + Date.now();
    return;
  }
  $("adminName").textContent = `${session.username || "admin"} : admin`;

  // ===== Network dot =====
  const netDot = $("netDot");
  const refreshNet = () => {
    const on = navigator.onLine;
    netDot.className = "dot " + (on ? "on" : "off");
    netDot.title = on ? "متصل" : "غير متصل";
  };
  window.addEventListener("online", refreshNet);
  window.addEventListener("offline", refreshNet);
  refreshNet();

  // ===== Supabase =====
  const CFG = window.HAYEK_CONFIG || {};
  const hasDB = !!(window.supabase && CFG.supabaseUrl && CFG.supabaseKey);
  if (!hasDB) {
    alert("Supabase غير جاهز (config.js).");
    return;
  }
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);

  const T_USERS = (CFG.tables && CFG.tables.users) || "app_users";
  const T_INV   = (CFG.tables && CFG.tables.invoices) || "app_invoices";
  const T_OPS   = (CFG.tables && CFG.tables.operations) || "app_operations";

  // ===== UI refs =====
  const usersBody = $("usersBody");
  const invBody = $("invBody");
  const opsBody = $("opsBody");
  const opsBack = $("opsBack");
  const opsClose = $("opsClose");
  const opsTitle = $("opsTitle");

  const statInvCount = $("statInvCount");
  const statInvSum = $("statInvSum");
  const metaMini = $("metaMini");

  const search = $("search");
  const userFilter = $("userFilter");
  const dateFrom = $("dateFrom");
  const dateTo = $("dateTo");

  const paneUsers = $("pane-users");
  const paneInv = $("pane-inv");

  // selected
  let selectedInvoice = null;

  function setSelected(inv){
    selectedInvoice = inv || null;
    $("selInvId").textContent = inv ? String(inv.id).slice(-6) : "—";
    $("selUser").textContent = inv?.username || "—";
    $("selCust").textContent = inv?.customer_name || "—";
    $("selTotal").textContent = inv ? fmtNum(inv.total) : "—";
    $("selStatus").textContent = inv?.status || "—";
  }

  // ===== Tabs =====
  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      const key = b.dataset.tab;

      if (key === "users") {
        paneUsers.style.display = "block";
        paneInv.style.display = "none";
      } else {
        paneUsers.style.display = "none";
        paneInv.style.display = "block";
      }
      metaMini.textContent = key === "users" ? "عرض جدول المستخدمين" : "عرض جدول الفواتير";
    });
  });

  // ===== Logout =====
  $("logoutBtn").onclick = () => {
    window.HAYEK_AUTH.logout();
    location.href = "index.html?v=" + Date.now();
  };

  // ===== Add user (بسيطة) =====
  $("addUserBtn").onclick = async () => {
    const username = prompt("اسم المستخدم الجديد:");
    if (!username) return;

    const pass = prompt("كلمة السر:");
    if (!pass) return;

    try{
      await sb.from(T_USERS).insert({
        username: username.trim(),
        pass: String(pass),
        is_admin: false,
        blocked: false,
        created_at: new Date().toISOString()
      });
      toast("تمت إضافة المستخدم.");
      await refreshAll();
    }catch{
      toast("فشل إضافة المستخدم.", true);
    }
  };

  // ===== Data cache =====
  let USERS = [];
  let INVOICES = [];
  let invoiceCountByUser = new Map();

  function applyRangeDays(days){
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);
    if (days === null){
      dateFrom.value = "";
      dateTo.value = "";
      return;
    }
    start.setDate(start.getDate() - (days - 1));
    const toISO = (d) => d.toISOString().slice(0,10);
    dateFrom.value = toISO(start);
    dateTo.value = toISO(new Date()); // اليوم
  }

  $("rangeAll").onclick = () => applyRangeDays(null);
  $("range1").onclick = () => applyRangeDays(1);
  $("range7").onclick = () => applyRangeDays(7);

  $("refreshBtn").onclick = () => refreshAll();
  $("showBtn").onclick = () => renderInvoices(); // يعيد تطبيق الفلاتر

  // ===== Fetch =====
  async function fetchUsers(){
    const { data, error } = await sb
      .from(T_USERS)
      .select("id, username, pass, is_admin, blocked, device_id, created_at, last_seen")
      .order("username", { ascending: true });
    if (error) throw error;
    USERS = data || [];
  }

  async function fetchInvoices(){
    const { data, error } = await sb
      .from(T_INV)
      .select("id, username, customer_name, total, status, created_at, closed_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    INVOICES = data || [];
  }

  function buildCounts(){
    invoiceCountByUser = new Map();
    for (const inv of INVOICES){
      const u = inv.username || "";
      invoiceCountByUser.set(u, (invoiceCountByUser.get(u) || 0) + 1);
    }
  }

  function fillUserDropdown(){
    const cur = userFilter.value || "";
    const opts = ['<option value="">كل المستخدمين</option>'];
    for (const u of USERS){
      if (u.is_admin) continue;
      opts.push(`<option value="${esc(u.username)}">${esc(u.username)}</option>`);
    }
    userFilter.innerHTML = opts.join("");
    userFilter.value = cur;
  }

  function updateStats(){
    statInvCount.textContent = String(INVOICES.length);
    const sum = INVOICES.reduce((a, x) => a + (Number(x.total) || 0), 0);
    statInvSum.textContent = fmtNum(sum);
  }

  // ===== Render users =====
  function renderUsers(){
    const q = (search.value || "").trim().toLowerCase();

    const rows = [];
    for (const u of USERS){
      if (u.is_admin) continue;
      const name = u.username || "";

      if (q && !name.toLowerCase().includes(q)) continue;

      const invCount = invoiceCountByUser.get(name) || 0;
      const blocked = !!u.blocked;

      const statusChip = blocked
        ? `<span class="chip bad">محظور</span>`
        : `<span class="chip ok">نشط</span>`;

      const seen = sinceText(u.last_seen);

      rows.push(`
        <tr>
          <td><b>${esc(name)}</b></td>
          <td><span class="chip">${invCount}</span></td>
          <td>${statusChip}</td>
          <td class="mini">${esc(seen)}</td>
          <td>
            <div class="actRow">
              <button class="aBtn blue" data-act="invoices" data-u="${esc(name)}">الفواتير</button>
              <button class="aBtn gray" data-act="clearDevice" data-u="${esc(name)}">مسح الجهاز</button>
              ${blocked
                ? `<button class="aBtn blue" data-act="unblock" data-u="${esc(name)}">فك</button>`
                : `<button class="aBtn red" data-act="block" data-u="${esc(name)}">حظر</button>`
              }
              <button class="aBtn red" data-act="del" data-u="${esc(name)}">حذف</button>
              <button class="aBtn gray" data-act="makeAdmin" data-u="${esc(name)}">جعله أدمن</button>
            </div>
          </td>
        </tr>
      `);
    }

    usersBody.innerHTML = rows.join("") || `
      <tr><td colspan="5" class="mini">لا يوجد بيانات.</td></tr>
    `;
  }

  usersBody.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const act = b.dataset.act;
    const username = b.dataset.u;

    if (!username) return;

    if (act === "invoices"){
      // انتقل لتبويب الفواتير + فلتر على المستخدم
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      document.querySelector('.tab[data-tab="inv"]').classList.add("active");
      paneUsers.style.display = "none";
      paneInv.style.display = "block";
      userFilter.value = username;
      renderInvoices();
      return;
    }

    if (act === "clearDevice"){
      if (!confirm(`مسح device_id للمستخدم ${username}؟`)) return;
      await sb.from(T_USERS).update({ device_id: null }).eq("username", username);
      toast("تم مسح الجهاز.");
      await refreshAll();
      return;
    }

    if (act === "block"){
      if (!confirm(`حظر المستخدم ${username}؟`)) return;
      await sb.from(T_USERS).update({ blocked: true }).eq("username", username);
      toast("تم الحظر.");
      await refreshAll();
      return;
    }

    if (act === "unblock"){
      if (!confirm(`فك حظر المستخدم ${username}؟`)) return;
      await sb.from(T_USERS).update({ blocked: false }).eq("username", username);
      toast("تم فك الحظر.");
      await refreshAll();
      return;
    }

    if (act === "del"){
      if (!confirm(`حذف المستخدم ${username}؟`)) return;
      await sb.from(T_USERS).delete().eq("username", username);
      toast("تم الحذف.");
      await refreshAll();
      return;
    }

    if (act === "makeAdmin"){
      if (!confirm(`تحويل ${username} إلى أدمن؟`)) return;
      await sb.from(T_USERS).update({ is_admin: true }).eq("username", username);
      toast("تم تحويله لأدمن.");
      await refreshAll();
      return;
    }
  });

  // ===== Render invoices =====
  function invoiceMatches(inv, q){
    if (!q) return true;
    const id6 = String(inv.id || "").slice(-6).toLowerCase();
    const u = String(inv.username || "").toLowerCase();
    const c = String(inv.customer_name || "").toLowerCase();
    return id6.includes(q) || u.includes(q) || c.includes(q);
  }

  function inDateRange(inv){
    const from = dateFrom.value ? new Date(dateFrom.value + "T00:00:00") : null;
    const to = dateTo.value ? new Date(dateTo.value + "T23:59:59") : null;
    const d = inv.created_at ? new Date(inv.created_at) : null;
    if (!d) return true;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  function renderInvoices(){
    const q = (search.value || "").trim().toLowerCase();
    const u = userFilter.value || "";

    const rows = [];
    for (const inv of INVOICES){
      if (u && inv.username !== u) continue;
      if (!inDateRange(inv)) continue;
      if (!invoiceMatches(inv, q)) continue;

      const statusChip = inv.status === "closed"
        ? `<span class="chip ok">closed</span>`
        : `<span class="chip bad">open</span>`;

      rows.push(`
        <tr data-inv="${esc(inv.id)}">
          <td>${esc(fmtDT(inv.created_at))}</td>
          <td><b>${esc(inv.username || "")}</b></td>
          <td>${esc(inv.customer_name || "—")}</td>
          <td>${fmtNum(inv.total)}</td>
          <td>${statusChip}</td>
          <td><b>${esc(String(inv.id).slice(-6))}</b></td>
          <td>
            <div class="actRow">
              <button class="aBtn gray" data-act="select" data-id="${esc(inv.id)}">عرض</button>
              <button class="aBtn blue" data-act="ops" data-id="${esc(inv.id)}">العمليات</button>
              <button class="aBtn gray" data-act="pdf" data-id="${esc(inv.id)}">PDF</button>
            </div>
          </td>
        </tr>
      `);
    }

    invBody.innerHTML = rows.join("") || `
      <tr><td colspan="7" class="mini">لا يوجد فواتير ضمن الفلاتر الحالية.</td></tr>
    `;
  }

  invBody.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const act = b.dataset.act;
    const id = b.dataset.id;
    const inv = INVOICES.find(x => String(x.id) === String(id));
    if (!inv) return;

    if (act === "select"){
      setSelected(inv);
      toast("تم تحديد الفاتورة.");
      return;
    }
    if (act === "ops"){
      setSelected(inv);
      await openOps(inv);
      return;
    }
    if (act === "pdf"){
      setSelected(inv);
      await exportInvoicePDF(inv);
      return;
    }
  });

  // ===== Selected panel buttons =====
  $("selOpsBtn").onclick = async () => {
    if (!selectedInvoice) return toast("حدد فاتورة أولاً.", true);
    await openOps(selectedInvoice);
  };
  $("selPdfBtn").onclick = async () => {
    if (!selectedInvoice) return toast("حدد فاتورة أولاً.", true);
    await exportInvoicePDF(selectedInvoice);
  };

  // ===== OPS modal (الأهم: invoiceId) =====
  opsClose.onclick = () => (opsBack.style.display = "none");
  opsBack.addEventListener("click", (e) => {
    if (e.target === opsBack) opsBack.style.display = "none";
  });

  async function fetchOpsForInvoice(invoiceId){
    // ✅ هنا الإصلاح: العمود الصحيح هو invoiceId
    const { data, error } = await sb
      .from(T_OPS)
      .select("created_at, text, expr, result, invoiceId")
      .eq("invoiceId", invoiceId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function openOps(inv){
    opsTitle.textContent = `عمليات الفاتورة: ${String(inv.id).slice(-6)} — ${inv.customer_name || ""}`;
    opsBody.innerHTML = `<tr><td colspan="4" class="mini">تحميل...</td></tr>`;
    opsBack.style.display = "flex";

    try{
      const ops = await fetchOpsForInvoice(inv.id);

      opsBody.innerHTML = ops.map(r => `
        <tr>
          <td>${esc(fmtDT(r.created_at))}</td>
          <td>${esc(r.text || "—")}</td>
          <td>${esc(r.expr || "")}</td>
          <td>${esc(String(r.result ?? ""))}</td>
        </tr>
      `).join("") || `<tr><td colspan="4" class="mini">لا يوجد عمليات لهذه الفاتورة.</td></tr>`;
    }catch(e){
      opsBody.innerHTML = `<tr><td colspan="4" class="mini">فشل تحميل العمليات.</td></tr>`;
      toast("خطأ بتحميل العمليات (تحقق من اسم العمود).", true);
      console.error(e);
    }
  }

  // ===== PDF (يبني نفس جدول العمليات للأدمن) =====
  function buildInvoiceHtml(inv, ops){
    const rows = (ops || []).map((r, i) => `
      <tr>
        <td style="border:1px solid #111;padding:8px;text-align:center">${i+1}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center">${esc(fmtDT(r.created_at))}</td>
        <td style="border:1px solid #111;padding:8px;text-align:right">${esc(r.text || "عملية")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center">${esc(r.expr || "")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center;font-weight:900">${esc(String(r.result ?? ""))}</td>
      </tr>
    `).join("");

    const invNo = String(inv.id || "").slice(-6);

    return `
      <div style="direction:rtl;font-family:Arial,system-ui;background:#fff;color:#111;padding:18px;">
        <div style="border:2px solid #111;border-radius:14px;padding:16px;">
          <div style="text-align:center;font-weight:900;font-size:24px;margin-bottom:4px;">شركة الحايك</div>
          <div style="text-align:center;font-weight:900;font-size:20px;color:#0a7c3a;margin-bottom:10px;">HAYEK SPOT</div>

          <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;margin-bottom:10px;flex-wrap:wrap">
            <div>اسم الزبون: <b>${esc(inv.customer_name||"-")}</b></div>
            <div>اسم المستخدم: <b>${esc(inv.username||"-")}</b></div>
            <div>رقم الفاتورة: <b>${esc(invNo)}</b></div>
            <div>التاريخ: <b>${new Date(inv.created_at||Date.now()).toLocaleString("ar")}</b></div>
          </div>

          <div style="border-top:1px solid #111;margin:10px 0"></div>

          <div style="font-weight:900;margin:6px 0 10px;">تفاصيل العمليات</div>

          <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff">
            <thead>
              <tr style="background:#f3f3f3">
                <th style="border:1px solid #111;padding:8px;text-align:center;">#</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">الوقت</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">البيان</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">العملية</th>
                <th style="border:1px solid #111;padding:8px;text-align:center;">النتيجة</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="5" style="border:1px solid #111;padding:14px;text-align:center;color:#666">لا يوجد عمليات</td></tr>`}
            </tbody>
          </table>

          <div style="margin-top:12px;border:2px dashed #111;border-radius:12px;padding:10px;display:flex;justify-content:space-between;font-weight:900">
            <span>إجمالي الكشف:</span>
            <span>${esc(fmtNum(inv.total || 0))}</span>
          </div>

          <div style="margin-top:12px;border:2px solid #111;border-radius:14px;padding:12px;text-align:center;font-size:12px;line-height:1.8">
            تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك<br/>
            <span style="display:inline-block;margin-top:8px;border:2px solid #0a7c3a;color:#0a7c3a;border-radius:12px;padding:8px 16px;font-weight:900;font-size:16px;">05510217646</span>
          </div>
        </div>
      </div>
    `;
  }

  async function exportInvoicePDF(inv){
    try{
      const ops = await fetchOpsForInvoice(inv.id);

      const stage = $("pdfStage");
      stage.innerHTML = buildInvoiceHtml(inv, ops);

      const canvas = await html2canvas(stage, { scale: 2, backgroundColor:"#ffffff" });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p","pt","a4");

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const imgW = pageW;
      const imgH = canvas.height * (imgW / canvas.width);

      let y = 0;
      let remaining = imgH;

      while (remaining > 0) {
        pdf.addImage(imgData, "JPEG", 0, y, imgW, imgH);
        remaining -= pageH;
        if (remaining > 0) { pdf.addPage(); y -= pageH; }
      }

      const cust = (inv.customer_name||"invoice").trim().replace(/\s+/g,"_");
      const invNo = String(inv.id||"").slice(-6);
      pdf.save(`HAYEK_${cust}_${invNo}.pdf`);

      toast("تم تصدير PDF.");
    }catch(e){
      toast("فشل تصدير PDF.", true);
      console.error(e);
    }
  }

  // ===== Search live =====
  search.addEventListener("input", () => {
    renderUsers();
    renderInvoices();
  });
  userFilter.addEventListener("change", () => renderInvoices());

  // ===== Boot =====
  async function refreshAll(){
    try{
      await fetchUsers();
      await fetchInvoices();
      buildCounts();
      fillUserDropdown();
      updateStats();
      renderUsers();
      renderInvoices();
      metaMini.textContent = `آخر تحديث: ${fmtDT(new Date().toISOString())}`;
    }catch(e){
      console.error(e);
      alert("خطأ تحميل البيانات من Supabase.");
    }
  }

  refreshAll();
})();
