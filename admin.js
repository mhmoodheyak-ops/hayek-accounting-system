(() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG || {};
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    alert('config.js غير مضبوط (SUPABASE_URL / SUPABASE_ANON_KEY)');
    return;
  }

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const el = (id) => document.getElementById(id);

  const statusLine = el("statusLine");
  const adminStatePill = el("adminStatePill");
  const adminMsg = el("adminMsg");

  const adminUser = el("adminUser");
  const adminPass = el("adminPass");
  const btnAdminLogin = el("btnAdminLogin");
  const btnAdminLogout = el("btnAdminLogout");

  const newUsername = el("newUsername");
  const newPassword = el("newPassword");
  const newRole = el("newRole");
  const btnAddUser = el("btnAddUser");
  const btnRefreshUsers = el("btnRefreshUsers");
  const usersCount = el("usersCount");
  const usersList = el("usersList");
  const pickedUserLabel = el("pickedUserLabel");

  const fromDate = el("fromDate");
  const toDate = el("toDate");
  const pickStatus = el("pickStatus");
  const btnToday = el("btnToday");
  const btnLast7 = el("btnLast7");
  const btnLoadInvoices = el("btnLoadInvoices");
  const invCount = el("invCount");

  const invoiceSelect = el("invoiceSelect");
  const btnOpenInvoice = el("btnOpenInvoice");
  const btnExportInvoicePdf = el("btnExportInvoicePdf");
  const invoicePreview = el("invoicePreview");

  // ========= Helpers =========
  const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
  const toDateInput = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  function fmtDateTime(iso) {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  }

  function setMsg(text, ok = true) {
    adminMsg.textContent = text || "";
    adminMsg.className = "msg " + (ok ? "ok" : "bad");
  }

  function getDeviceId() {
    // جهاز ثابت لكل متصفح
    const k = "HAYEK_ADMIN_DEVICE_V1";
    let v = localStorage.getItem(k);
    if (!v) {
      v = "adm_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
      localStorage.setItem(k, v);
    }
    return v;
  }

  // ========= Session =========
  const SESSION_KEY = "HAYEK_ADMIN_SESSION_V1";
  let session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  let pickedUser = session?.pickedUser || "";
  let openedInvoice = null;

  function setLoggedIn(isIn) {
    adminStatePill.textContent = isIn ? "مفتوح" : "غير مسجل";
    adminStatePill.classList.toggle("ok", !!isIn);
  }

  function saveSession() {
    session = session || {};
    session.pickedUser = pickedUser || "";
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  // ========= Admin Login with device lock =========
  async function adminLogin() {
    setMsg("");
    statusLine.textContent = "الحالة: جاري التحقق...";
    const u = (adminUser.value || "").trim();
    const p = (adminPass.value || "").trim();
    if (!u || !p) return setMsg("❌ أدخل اسم المستخدم وكلمة السر.", false);

    const device_id = getDeviceId();

    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("username", u)
      .limit(1);

    if (error || !data?.length) {
      statusLine.textContent = "الحالة: خطأ";
      return setMsg("❌ المستخدم غير موجود.", false);
    }

    const user = data[0];
    if (!user.is_admin) {
      statusLine.textContent = "الحالة: مرفوض";
      return setMsg("❌ هذا الحساب ليس Admin.", false);
    }
    if (String(user.pass) !== String(p)) {
      statusLine.textContent = "الحالة: مرفوض";
      return setMsg("❌ كلمة السر غير صحيحة.", false);
    }

    // قفل الجهاز: إذا device_id موجود ومختلف => رفض
    if (user.device_id && String(user.device_id) !== String(device_id)) {
      statusLine.textContent = "الحالة: مرفوض";
      setLoggedIn(false);
      return setMsg("❌ الحالة: Admin مستخدم على جهاز آخر.", false);
    }

    // إذا فارغ -> اربط الجهاز الحالي
    if (!user.device_id) {
      const { error: upErr } = await supabase
        .from("app_users")
        .update({ device_id, last_seen: new Date().toISOString() })
        .eq("username", u);

      if (upErr) {
        statusLine.textContent = "الحالة: خطأ";
        setLoggedIn(false);
        return setMsg("❌ فشل ربط الجهاز. راجع صلاحيات Supabase.", false);
      }
    } else {
      // حدث last_seen فقط
      await supabase.from("app_users").update({ last_seen: new Date().toISOString() }).eq("username", u);
    }

    session = { admin: u, device_id, pickedUser };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setLoggedIn(true);
    statusLine.textContent = "الحالة: مفتوح";
    setMsg("✅ تم تسجيل الدخول بنجاح.");
    await refreshUsers();
  }

  function adminLogout() {
    localStorage.removeItem(SESSION_KEY);
    session = null;
    pickedUser = "";
    openedInvoice = null;
    invoiceSelect.innerHTML = `<option value="">— لا يوجد —</option>`;
    invoicePreview.innerHTML = "";
    pickedUserLabel.textContent = "المستخدم المحدد للفواتير: —";
    setLoggedIn(false);
    statusLine.textContent = "الحالة: مغلق";
    setMsg("✅ تم تسجيل الخروج.");
  }

  // ========= Users =========
  function userCard(u) {
    const roleText = u.is_admin ? "Admin" : "User";
    const blocked = !!u.blocked;

    const wrap = document.createElement("div");
    wrap.className = "user-card";

    wrap.innerHTML = `
      <div class="uc-top">
        <div class="uc-name">${escapeHtml(u.username)}</div>
        <div class="uc-meta">
          <span class="tag">${roleText}</span>
          <span class="tag ${blocked ? "bad" : "ok"}">${blocked ? "محظور" : "حر"}</span>
          <span class="tag">${u.device_id ? "مربوط" : "فارغ"}</span>
        </div>
      </div>

      <div class="uc-actions">
        <button class="btn small primary">اختر</button>
        <button class="btn small">${blocked ? "فك الحظر" : "حظر"}</button>
        <button class="btn small">فك ربط الجهاز</button>
        <button class="btn small danger">حذف</button>
      </div>
    `;

    const [btnPick, btnBlock, btnUnbind, btnDel] = wrap.querySelectorAll("button");

    btnPick.onclick = () => {
      pickedUser = u.username;
      pickedUserLabel.textContent = `المستخدم المحدد للفواتير: ${pickedUser}`;
      saveSession();
      setMsg(`✅ تم تحديد المستخدم: ${pickedUser}`);
    };

    btnBlock.onclick = async () => {
      if (!session?.admin) return setMsg("❌ سجّل دخول أولاً.", false);
      const { error } = await supabase
        .from("app_users")
        .update({ blocked: !blocked })
        .eq("id", u.id);
      if (error) return setMsg("❌ فشل تحديث الحظر.", false);
      setMsg("✅ تم التحديث.");
      await refreshUsers();
    };

    btnUnbind.onclick = async () => {
      if (!session?.admin) return setMsg("❌ سجّل دخول أولاً.", false);
      const { error } = await supabase
        .from("app_users")
        .update({ device_id: null })
        .eq("id", u.id);
      if (error) return setMsg("❌ فشل فك ربط الجهاز.", false);
      setMsg("✅ تم فك ربط الجهاز.");
      await refreshUsers();
    };

    btnDel.onclick = async () => {
      if (!session?.admin) return setMsg("❌ سجّل دخول أولاً.", false);
      if (u.is_admin) return setMsg("❌ لا يمكن حذف Admin.", false);
      const ok = confirm(`تأكيد حذف المستخدم: ${u.username} ؟`);
      if (!ok) return;
      const { error } = await supabase.from("app_users").delete().eq("id", u.id);
      if (error) return setMsg("❌ فشل الحذف.", false);
      setMsg("✅ تم حذف المستخدم.");
      await refreshUsers();
    };

    return wrap;
  }

  async function refreshUsers() {
    if (!session?.admin) return;

    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      return setMsg("❌ خطأ بجلب المستخدمين.", false);
    }

    usersList.innerHTML = "";
    data.forEach(u => usersList.appendChild(userCard(u)));

    usersCount.textContent = String(data.length);
    if (pickedUser) {
      pickedUserLabel.textContent = `المستخدم المحدد للفواتير: ${pickedUser}`;
    } else {
      pickedUserLabel.textContent = "المستخدم المحدد للفواتير: —";
    }
  }

  async function addUser() {
    if (!session?.admin) return setMsg("❌ سجّل دخول أولاً.", false);

    const u = (newUsername.value || "").trim();
    const p = (newPassword.value || "").trim();
    const role = (newRole.value || "user");
    if (!u || !p) return setMsg("❌ أدخل اسم المستخدم وكلمة السر.", false);

    const payload = {
      username: u,
      pass: p,
      is_admin: role === "admin",
      blocked: false,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("app_users").insert(payload);
    if (error) return setMsg("❌ فشل الإضافة (قد يكون الاسم مستخدم).", false);

    newUsername.value = "";
    newPassword.value = "";
    setMsg("✅ تم إضافة المستخدم.");
    await refreshUsers();
  }

  // ========= Invoices =========
  function dateRangeToday() {
    const now = new Date();
    fromDate.value = toDateInput(now);
    toDate.value = toDateInput(now);
  }
  function dateRangeLast7() {
    const now = new Date();
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    fromDate.value = toDateInput(d);
    toDate.value = toDateInput(now);
  }

  function setInvoiceOptions(list) {
    invoiceSelect.innerHTML = `<option value="">— اختر فاتورة —</option>`;
    list.forEach(inv => {
      const opt = document.createElement("option");
      opt.value = inv.id;

      // ✅ واضح + يظهر الإجمالي داخل القائمة
      opt.textContent =
        `(${(inv.status || "open")}) — ${fmtDateTime(inv.created_at)} — ` +
        `${(inv.customer_name || "—")} — الإجمالي: ${Number(inv.total || 0)}`;

      invoiceSelect.appendChild(opt);
    });
    invCount.textContent = `عدد النتائج: ${list.length}`;
  }

  function makeISOStartEnd(fromD, toD) {
    // range inclusive: from 00:00 to 23:59:59
    const f = new Date(fromD + "T00:00:00");
    const t = new Date(toD + "T23:59:59");
    return [f.toISOString(), t.toISOString()];
  }

  async function loadInvoices() {
    if (!session?.admin) return setMsg("❌ سجّل دخول أولاً.", false);
    if (!pickedUser) return setMsg("❌ اختر مستخدم أولاً من قائمة المستخدمين (زر اختر).", false);
    if (!fromDate.value || !toDate.value) return setMsg("❌ اختر تاريخ من/إلى.", false);

    setMsg("...");
    const [fromISO, toISO] = makeISOStartEnd(fromDate.value, toDate.value);

    let q = supabase
      .from("app_invoices")
      .select("*")
      .eq("username", pickedUser)
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: false });

    if (pickStatus.value !== "all") {
      q = q.eq("status", pickStatus.value);
    }

    const { data, error } = await q;
    if (error) return setMsg("❌ خطأ بجلب الفواتير.", false);

    setInvoiceOptions(data || []);
    setMsg("✅ تم جلب الفواتير.");
  }

  // ===== Invoice Preview + PDF =====
  async function fetchOperationsForInvoice(inv) {
    // 1) الأفضل: حسب invoice_id
    let { data, error } = await supabase
      .from("app_operations")
      .select("*")
      .eq("invoice_id", inv.id)
      .order("created_at", { ascending: true });

    if (!error && data && data.length) return data;

    // 2) احتياط: إذا invoice_id فاضي عندكم -> نجرب بالوقت + المستخدم + الجهاز
    const t0 = new Date(inv.created_at);
    const t1 = new Date(t0);
    const t2 = new Date(t0);
    t1.setMinutes(t1.getMinutes() - 10);
    t2.setMinutes(t2.getMinutes() + 10);

    const { data: data2 } = await supabase
      .from("app_operations")
      .select("*")
      .eq("username", inv.username)
      .eq("device_id", inv.device_id || "")
      .gte("created_at", t1.toISOString())
      .lte("created_at", t2.toISOString())
      .order("created_at", { ascending: true });

    return data2 || [];
  }

  function buildInvoiceHTML(inv, ops) {
    const rows = (ops || []).map(o => {
      const time = o.created_at ? fmtDateTime(o.created_at) : "—";
      const label = escapeHtml(o.label || "—");
      const op = escapeHtml(o.operation || o.expression || "—");
      const res = escapeHtml(String(o.result ?? "—"));
      return `
        <tr>
          <td>${time}</td>
          <td>${label}</td>
          <td dir="ltr">${op}</td>
          <td dir="ltr">${res}</td>
        </tr>
      `;
    }).join("");

    // ✅ 3 أسطر فراغ فوق وتحت جدول العمليات (تقريباً 36px)
    return `
      <div class="invCard" id="printableInvoice">
        <div class="invHeader">
          <div class="invHeaderBox">
            <div class="invTitle">شركة الحايك</div>
            <div class="invBrand">HAYEK SPOT</div>
          </div>
        </div>

        <div class="invField">
          <div class="invLabel">اسم المستخدم</div>
          <div class="invValue">${escapeHtml(inv.username || "—")}</div>
        </div>

        <div class="invField">
          <div class="invLabel">اسم العميل</div>
          <div class="invValue">${escapeHtml(inv.customer_name || inv.customer || "—")}</div>
        </div>

        <div class="invField">
          <div class="invLabel">رقم الفاتورة</div>
          <div class="invValue" dir="ltr">${escapeHtml(inv.id)}</div>
        </div>

        <div class="invField">
          <div class="invLabel">التاريخ</div>
          <div class="invValue">${fmtDateTime(inv.created_at)}</div>
        </div>

        <div style="height:36px;"></div>

        <div class="invTableWrap">
          <table class="invTable">
            <thead>
              <tr>
                <th>الوقت</th>
                <th>البيان</th>
                <th>العملية</th>
                <th>النتيجة</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="4" style="text-align:center">لا يوجد بيانات</td></tr>`}
            </tbody>
          </table>
        </div>

        <div style="height:36px;"></div>

        <div class="invTotalBox">
          <div class="invTotalLabel">إجمالي الكشف:</div>
          <div class="invTotalValue" dir="ltr">${Number(inv.total || 0)}</div>
        </div>

        <div class="invFooter">
          <div class="invFooterText">تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك</div>
          <div class="invFooterText2">شركة الحايك: تجارة عامة / توزيع جملة / دعاية وإعلان / طباعة / حلول رقمية</div>
          <div class="invPhone" dir="ltr">05510217646</div>
        </div>
      </div>
    `;
  }

  async function openInvoice() {
    if (!session?.admin) return setMsg("❌ سجّل دخول أولاً.", false);

    const invId = invoiceSelect.value;
    if (!invId) return setMsg("❌ اختر فاتورة من القائمة.", false);

    const { data, error } = await supabase
      .from("app_invoices")
      .select("*")
      .eq("id", invId)
      .limit(1);

    if (error || !data?.length) return setMsg("❌ لم يتم العثور على الفاتورة.", false);

    const inv = data[0];
    openedInvoice = inv;

    const ops = await fetchOperationsForInvoice(inv);
    invoicePreview.innerHTML = buildInvoiceHTML(inv, ops);

    setMsg("✅ تم فتح الفاتورة.");
  }

  async function exportInvoicePdf() {
    if (!openedInvoice) return setMsg("❌ افتح فاتورة أولاً.", false);

    const node = document.querySelector("#invoicePreview #printableInvoice");
    if (!node) return setMsg("❌ لا يوجد معاينة لتصديرها.", false);

    // ✅ PDF عربي مضمون لأنه تصوير HTML
    const holder = document.createElement("div");
    holder.style.background = "#fff";
    holder.style.padding = "18px";
    const clone = node.cloneNode(true);
    clone.style.margin = "0";
    clone.style.boxShadow = "none";
    holder.appendChild(clone);

    const filename = `HAYEK_SPOT_${openedInvoice.id}.pdf`;

    const opt = {
      margin: 10,
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] }
    };

    await html2pdf().set(opt).from(holder).save();
    setMsg("✅ تم تصدير PDF عربي بنجاح.");
  }

  // ========= HTML escape =========
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ========= Wire =========
  btnAdminLogin.addEventListener("click", adminLogin);
  btnAdminLogout.addEventListener("click", adminLogout);
  btnAddUser.addEventListener("click", addUser);
  btnRefreshUsers.addEventListener("click", refreshUsers);

  btnToday.addEventListener("click", () => { dateRangeToday(); setMsg("✅ تم اختيار فواتير اليوم."); });
  btnLast7.addEventListener("click", () => { dateRangeLast7(); setMsg("✅ تم اختيار آخر 7 أيام."); });
  btnLoadInvoices.addEventListener("click", loadInvoices);

  btnOpenInvoice.addEventListener("click", openInvoice);
  btnExportInvoicePdf.addEventListener("click", exportInvoicePdf);

  // ========= Init =========
  (function init() {
    statusLine.textContent = "الحالة: جاهز";
    if (!fromDate.value || !toDate.value) dateRangeLast7();

    if (session?.admin) {
      setLoggedIn(true);
      pickedUser = session?.pickedUser || "";
      pickedUserLabel.textContent = pickedUser ? `المستخدم المحدد للفواتير: ${pickedUser}` : "المستخدم المحدد للفواتير: —";
      refreshUsers();
      setMsg("✅ جلسة Admin محفوظة.");
    } else {
      setLoggedIn(false);
    }
  })();
})();
