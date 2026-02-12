// admin.js  (واجهة الأدمن كما طلبت + إصلاح جلب العمليات invoiceId)
(() => {
  const $ = (id) => document.getElementById(id);

  // ===== Guard =====
  if (!window.HAYEK_AUTH || !window.__HAYEK_AUTH_LOADED__ || !window.HAYEK_AUTH.isAuthed()) {
    location.href = "index.html?v=" + Date.now();
    return;
  }
  const session = window.HAYEK_AUTH.getUser() || {};
  if (session.role !== "admin") {
    location.href = "invoice.html?v=" + Date.now();
    return;
  }

  // ===== Net dot =====
  const netDot = $("netDot");
  const updateNet = () => {
    const on = navigator.onLine;
    netDot.classList.toggle("online", on);
    netDot.classList.toggle("offline", !on);
    netDot.title = on ? "متصل" : "غير متصل";
  };
  window.addEventListener("online", updateNet);
  window.addEventListener("offline", updateNet);
  updateNet();

  // ===== Toast =====
  const toast = (msg, bad = false) => {
    const t = $("toast");
    t.style.display = "block";
    t.textContent = msg;
    t.style.borderColor = bad ? "#ff5a6b88" : "#27d17f66";
    t.style.background = bad ? "#7a1f2a66" : "#07131a66";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.style.display = "none"), 2400);
  };

  // ===== Supabase =====
  const CFG = window.HAYEK_CONFIG || {};
  const hasDB = !!(window.supabase && CFG.supabaseUrl && CFG.supabaseKey);
  if (!hasDB) { toast("Supabase غير جاهز (config.js).", true); return; }
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);

  const T_USERS = (CFG.tables && CFG.tables.users) || "app_users";
  const T_INV   = (CFG.tables && CFG.tables.invoices) || "app_invoices";
  const T_OPS   = (CFG.tables && CFG.tables.operations) || "app_operations";

  // ===== UI refs =====
  $("whoTag").textContent = "admin : " + (session.username || "admin");

  const invBody = $("invBody");
  const usersBody = $("usersBody");

  const kpiInvCount = $("kpiInvCount");
  const kpiInvSum = $("kpiInvSum");

  const fltUser = $("fltUser");
  const fromDate = $("fromDate");
  const toDate = $("toDate");
  const searchInv = $("searchInv");
  const searchUser = $("searchUser");

  // modal ops
  const opsBack = $("opsBack");
  const opsTitle = $("opsTitle");
  const opsMeta = $("opsMeta");
  const opsBody = $("opsBody");
  const opsTotal = $("opsTotal");
  const pdfStage = $("pdfStage");

  // ===== Helpers =====
  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  const fmtNum = (n) => {
    const x = Number(n);
    if (!isFinite(x)) return "0";
    return (Math.round(x * 1000000) / 1000000).toString();
  };

  const fmtDT = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `${hh}:${mm} ${y}/${m}/${day}`;
  };

  const since = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "الآن";
    if (min < 60) return `منذ ${min} د`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `منذ ${hr} س`;
    const days = Math.floor(hr / 24);
    return `منذ ${days} يوم`;
  };

  function setPreset(days){
    const today = new Date();
    const end = new Date(today);
    const start = new Date(today);
    if (days === null){
      fromDate.value = "";
      toDate.value = "";
      return;
    }
    start.setDate(start.getDate() - (days-1));
    const iso = (d)=> d.toISOString().slice(0,10);
    fromDate.value = iso(start);
    toDate.value = iso(end);
  }

  // ===== Tabs =====
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      const key = btn.dataset.tab;
      document.querySelectorAll('[id^="tab-"]').forEach(p => p.classList.add("hidden"));
      $("tab-" + key).classList.remove("hidden");
    });
  });

  // ===== Load Users =====
  let usersCache = [];
  let invoicesCache = [];

  async function fetchUsers(){
    const { data, error } = await sb
      .from(T_USERS)
      .select("id, username, is_admin, blocked, created_at, device_id, last_seen")
      .order("username", { ascending:true });

    if (error) { console.error(error); toast("فشل تحميل المستخدمين", true); return; }
    usersCache = data || [];

    // fill dropdown
    fltUser.innerHTML = `<option value="">كل المستخدمين</option>` +
      usersCache.map(u => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.username)}</option>`).join("");

    renderUsers();
  }

  // ===== Load Invoices =====
  async function fetchInvoices(){
    let q = sb.from(T_INV).select("id, username, customer_name, total, status, created_at, closed_at").order("created_at", {ascending:false});

    const u = (fltUser.value || "").trim();
    if (u) q = q.eq("username", u);

    const f = fromDate.value;
    const t = toDate.value;
    if (f) q = q.gte("created_at", f + "T00:00:00.000Z");
    if (t) q = q.lte("created_at", t + "T23:59:59.999Z");

    const { data, error } = await q;
    if (error) { console.error(error); toast("فشل تحميل الفواتير", true); return; }
    invoicesCache = data || [];

    renderInvoices();
  }

  function renderUsers(){
    const q = (searchUser.value || "").trim();
    const arr = q ? usersCache.filter(u => (u.username||"").includes(q)) : usersCache;

    // عداد فواتير لكل مستخدم (من كاش الفواتير لو موجود)
    const invCount = new Map();
    for (const inv of invoicesCache){
      invCount.set(inv.username, (invCount.get(inv.username)||0)+1);
    }

    usersBody.innerHTML = arr.map(u => {
      const blocked = !!u.blocked;
      const role = u.is_admin ? "admin" : "user";
      const last = u.last_seen || u.created_at;
      const stateCls = blocked ? "bad" : "ok";
      const stateTxt = blocked ? "محظور" : "نشط";
      const invs = invCount.get(u.username) || 0;

      return `
        <tr>
          <td><b>${escapeHtml(u.username)}</b></td>
          <td class="num">${invs}</td>
          <td><span class="pillState ${stateCls}">${stateTxt}</span></td>
          <td>${escapeHtml(since(last))}</td>
          <td>${escapeHtml(role)}</td>
          <td>
            <button class="btnTiny primary" data-act="invoices" data-user="${escapeHtml(u.username)}">الفواتير</button>
            <button class="btnTiny warn" data-act="toggleBlock" data-id="${u.id}" data-blocked="${blocked ? "1":"0"}">${blocked ? "فك الحظر" : "حظر"}</button>
            <button class="btnTiny" data-act="clearDevice" data-id="${u.id}">مسح الجهاز</button>
            <button class="btnTiny danger" data-act="deleteUser" data-id="${u.id}" data-user="${escapeHtml(u.username)}">حذف</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderInvoices(){
    const q = (searchInv.value || "").trim();
    const arr = q ? invoicesCache.filter(inv => {
      const id6 = String(inv.id||"").slice(-6);
      return (inv.username||"").includes(q) || (inv.customer_name||"").includes(q) || id6.includes(q);
    }) : invoicesCache;

    const sum = arr.reduce((a,i)=> a + (Number(i.total)||0), 0);
    kpiInvCount.textContent = String(arr.length);
    kpiInvSum.textContent = fmtNum(sum);

    invBody.innerHTML = arr.map(inv => {
      const id6 = String(inv.id||"").slice(-6);
      const st = String(inv.status||"").toLowerCase();
      const stCls = st === "closed" ? "ok" : "bad";
      return `
        <tr>
          <td>${escapeHtml(fmtDT(inv.created_at))}</td>
          <td>${escapeHtml(inv.username||"—")}</td>
          <td>${escapeHtml(inv.customer_name||"—")}</td>
          <td class="num">${fmtNum(inv.total)}</td>
          <td><span class="pillState ${stCls}">${escapeHtml(st || "—")}</span></td>
          <td class="num">${escapeHtml(id6)}</td>
          <td>
            <button class="btnTiny" data-act="viewInv" data-id="${inv.id}">عرض</button>
            <button class="btnTiny primary" data-act="ops" data-id="${inv.id}">العمليات</button>
            <button class="btnTiny" data-act="pdf" data-id="${inv.id}">PDF</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // ===== Ops Modal =====
  let currentInvoice = null;
  let currentOps = [];

  async function openOps(invoiceId){
    const inv = invoicesCache.find(x => String(x.id) === String(invoiceId));
    currentInvoice = inv || { id: invoiceId };

    opsTitle.textContent = "عمليات الفاتورة: " + String(invoiceId).slice(-6);

    // ✅ جلب العمليات بالعمود الصحيح invoiceId
    const { data, error } = await sb
      .from(T_OPS)
      .select("*")
      .eq("invoiceId", invoiceId)
      .order("created_at", {ascending:true});

    if (error) {
      console.error(error);
      toast("فشل تحميل العمليات (تأكد أن العمود اسمه invoiceId)", true);
      currentOps = [];
    } else {
      currentOps = data || [];
    }

    opsMeta.textContent =
      `المستخدم: ${currentInvoice.username||"—"} — الزبون: ${currentInvoice.customer_name||"—"} — التاريخ: ${fmtDT(currentInvoice.created_at||new Date().toISOString())}`;

    const tot = currentOps.reduce((a,r)=> a + (Number(r.result)||0), 0);
    opsTotal.textContent = fmtNum(tot);

    opsBody.innerHTML = currentOps.map((r, i)=> `
      <tr>
        <td class="num">${i+1}</td>
        <td>${escapeHtml(fmtDT(r.created_at || ""))}</td>
        <td>${escapeHtml(r.text || r.label || "—")}</td>
        <td>${escapeHtml(r.expr || r.operation || "—")}</td>
        <td class="num">${escapeHtml(String(r.result ?? ""))}</td>
      </tr>
    `).join("") || `<tr><td colspan="5" style="text-align:center;color:#666;padding:16px">لا يوجد عمليات</td></tr>`;

    opsBack.style.display = "flex";
  }

  $("btnOpsClose").onclick = () => (opsBack.style.display = "none");

  // ===== PDF for invoice (from ops) =====
  function buildPdfRows(){
    return currentOps.map((r,i)=> ([
      String(i+1),
      fmtDT(r.created_at || ""),
      String(r.text || r.label || "—"),
      String(r.expr || r.operation || "—"),
      String(r.result ?? "")
    ]));
  }

  function exportInvoicePDF(){
    if (!currentInvoice) { toast("اختر فاتورة أولاً", true); return; }

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { toast("PDF غير جاهز", true); return; }

    const doc = new jsPDF({ orientation:"p", unit:"pt", format:"a4" });

    // خط عربي إن توفر
    try {
      const base64 =
        window.AMIRI_TTF_BASE64 ||
        window.Amiri_TTF_Base64 ||
        window.amiri_base64 ||
        null;
      if (base64) {
        doc.addFileToVFS("Amiri-Regular.ttf", base64);
        doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
        doc.setFont("Amiri");
      }
    } catch {}

    const margin = 40;
    let y = 50;

    doc.setFontSize(18);
    doc.text("شركة الحايك", doc.internal.pageSize.getWidth()-margin, y, {align:"right"}); y += 18;
    doc.setFontSize(12);
    doc.text("HAYEK SPOT", doc.internal.pageSize.getWidth()-margin, y, {align:"right"}); y += 20;

    doc.setFontSize(11);
    doc.text(`اسم المستخدم: ${currentInvoice.username || "—"}`, doc.internal.pageSize.getWidth()-margin, y, {align:"right"}); y += 16;
    doc.text(`اسم الزبون: ${currentInvoice.customer_name || "—"}`, doc.internal.pageSize.getWidth()-margin, y, {align:"right"}); y += 16;
    doc.text(`رقم الفاتورة: ${String(currentInvoice.id).slice(-6)}`, doc.internal.pageSize.getWidth()-margin, y, {align:"right"}); y += 16;
    doc.text(`التاريخ: ${fmtDT(currentInvoice.created_at || new Date().toISOString())}`, doc.internal.pageSize.getWidth()-margin, y, {align:"right"}); y += 14;

    const head = [["#", "الوقت", "البيان", "العملية", "النتيجة"]];
    const body = buildPdfRows();

    doc.autoTable({
      startY: y + 10,
      head,
      body,
      styles: { halign:"right" },
      headStyles: { halign:"right" },
      bodyStyles: { halign:"right" },
      margin: { left: margin, right: margin }
    });

    const tot = currentOps.reduce((a,r)=> a + (Number(r.result)||0), 0);
    const endY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 18 : y + 40;

    doc.setFontSize(14);
    doc.text(`إجمالي الكشف: ${fmtNum(tot)}`, doc.internal.pageSize.getWidth()-margin, endY, {align:"right"});

    doc.setFontSize(10);
    doc.text("تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك — 05510217646",
      doc.internal.pageSize.getWidth()/2,
      doc.internal.pageSize.getHeight()-30,
      {align:"center"}
    );

    doc.save(`OPS_${String(currentInvoice.id).slice(-6)}.pdf`);
  }

  $("btnOpsPDF").onclick = exportInvoicePDF;

  // ===== Click handlers =====
  usersBody.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const act = b.dataset.act;

    if (act === "invoices"){
      // انتقل تبويب الفواتير + فلتر المستخدم
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      document.querySelector('.tab[data-tab="invoices"]').classList.add("active");
      $("tab-users").classList.add("hidden");
      $("tab-invoices").classList.remove("hidden");
      fltUser.value = b.dataset.user || "";
      await fetchInvoices();
      return;
    }

    if (act === "toggleBlock"){
      const id = Number(b.dataset.id);
      const isBlocked = b.dataset.blocked === "1";
      await sb.from(T_USERS).update({ blocked: !isBlocked }).eq("id", id);
      toast(isBlocked ? "تم فك الحظر" : "تم الحظر");
      await fetchUsers();
      return;
    }

    if (act === "clearDevice"){
      const id = Number(b.dataset.id);
      await sb.from(T_USERS).update({ device_id: null }).eq("id", id);
      toast("تم مسح الجهاز");
      await fetchUsers();
      return;
    }

    if (act === "deleteUser"){
      const id = Number(b.dataset.id);
      const u = b.dataset.user || "";
      if (!confirm(`حذف المستخدم ${u} ؟`)) return;
      await sb.from(T_USERS).delete().eq("id", id);
      toast("تم الحذف");
      await fetchUsers();
      return;
    }
  });

  invBody.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const act = b.dataset.act;
    const id = b.dataset.id;

    if (act === "ops"){
      await openOps(id);
      return;
    }
    if (act === "pdf"){
      // افتح العمليات ثم PDF
      await openOps(id);
      exportInvoicePDF();
      return;
    }
    if (act === "viewInv"){
      toast("تم تحديد الفاتورة. اضغط (العمليات) لعرض التفاصيل.");
      return;
    }
  });

  // ===== Filters / Buttons =====
  $("btnToday").onclick = async () => { setPreset(1); await fetchInvoices(); };
  $("btn7d").onclick = async () => { setPreset(7); await fetchInvoices(); };
  $("btnAll").onclick = async () => { setPreset(null); await fetchInvoices(); };

  $("btnApply").onclick = fetchInvoices;
  fltUser.onchange = fetchInvoices;
  searchInv.oninput = renderInvoices;
  searchUser.oninput = renderUsers;

  $("btnRefresh").onclick = async () => {
    await fetchUsers();
    await fetchInvoices();
    toast("تم التحديث");
  };

  $("btnLogout").onclick = () => {
    window.HAYEK_AUTH.logout();
    location.href = "index.html?v=" + Date.now();
  };

  $("btnAddUser").onclick = async () => {
    const username = prompt("اسم المستخدم الجديد:");
    if (!username) return;
    const pass = prompt("كلمة السر:");
    if (!pass) return;

    const is_admin = confirm("هل هذا المستخدم أدمن؟ موافق = نعم / إلغاء = مستخدم عادي");
    const payload = {
      username: username.trim(),
      pass: pass.trim(),
      is_admin,
      blocked: false,
      created_at: new Date().toISOString(),
      device_id: null,
      last_seen: new Date().toISOString(),
    };

    const { error } = await sb.from(T_USERS).insert(payload);
    if (error) { console.error(error); toast("فشل إضافة المستخدم", true); return; }
    toast("تم إضافة المستخدم");
    await fetchUsers();
  };

  // CSV export (فواتير)
  $("btnCSV").onclick = () => {
    const rows = [
      ["id","username","customer_name","total","status","created_at","closed_at"],
      ...invoicesCache.map(i => [
        i.id, i.username, i.customer_name, i.total, i.status, i.created_at, i.closed_at
      ])
    ];
    const csv = rows.map(r => r.map(x => `"${String(x ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== Boot =====
  (async () => {
    // افتراضي: اليوم
    setPreset(1);
    await fetchUsers();
    await fetchInvoices();
  })();
})();
