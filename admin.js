/* HAYEK SPOT — Admin (final: PDF with original design) */
(function () {
  const $ = (id) => document.getElementById(id);

  // UI elements (نفس السابق)
  const lock = $("lock");
  const goLogin = $("goLogin");
  const onlineDot = $("onlineDot");
  const adminInfo = $("adminInfo");
  const logoutBtn = $("logoutBtn");
  const refreshBtn = $("refreshBtn");
  const rangeSel = $("range");
  const searchUser = $("searchUser");
  const stInvoices = $("stInvoices");
  const stUsers = $("stUsers");
  const stActive = $("stActive");
  const usersTbody = $("usersTbody");

  const addModalBack = $("addModalBack");
  const closeAddModalBtn = $("closeAddModal");
  const addUserBtn = $("addUserBtn");
  const newUsername = $("newUsername");
  const newPass = $("newPass");
  const newIsAdmin = $("newIsAdmin");
  const saveUserBtn = $("saveUserBtn");
  const addUserMsg = $("addUserMsg");

  const invModalBack = $("invModalBack");
  const closeInvModalBtn = $("closeInvModal");
  const invModalTitle = $("invModalTitle");
  const invSearch = $("invSearch");
  const invTbody = $("invTbody");
  const reloadInvBtn = $("reloadInvBtn");

  // Helpers (نفس السابق)
  function setOnlineDot() { /* ... */ }
  window.addEventListener("online", setOnlineDot);
  window.addEventListener("offline", setOnlineDot);
  setOnlineDot();

  function escapeHtml(s) { /* ... */ }
  function timeAgo(ts) { /* ... */ }
  function rangeToSince(range) { /* ... */ }
  function vibrateTiny() { /* ... */ }

  // Auth guard (نفس السابق)
  function hardLock() { /* ... */ }

  if (!window.HAYEK_AUTH || !window.__HAYEK_AUTH_LOADED__ || !window.HAYEK_AUTH.isAuthed()) {
    hardLock();
    return;
  }

  const session = window.HAYEK_AUTH.getUser() || {};

  if (session.role !== "admin") {
    hardLock();
    return;
  }

  lock.style.display = "none";
  adminInfo.textContent = `أدمن: ${session.username || "—"} — متصل`;

  logoutBtn.onclick = () => {
    window.HAYEK_AUTH.logout();
    location.href = "index.html?v=" + Date.now();
  };

  // Supabase client (نفس السابق)
  function getSB() { /* ... */ }

  let SB;
  try {
    SB = getSB();
  } catch (e) {
    console.error("خطأ في getSB:", e);
    alert("خطأ إعداد Supabase:\n" + e.message);
    return;
  }

  // Data state
  let users = [];
  let invoiceCounts = new Map();
  let currentUserForInvoices = null;
  let invoicesForUser = [];

  // ... (باقي الدوال: countInvoicesForUsers, fetchUsers, computeActiveUsers24h, badgeRole, badgeStatus, renderUsers, refreshAll, user actions, add user modal)

  // Invoices modal
  function openInvoicesModal(user) {
    currentUserForInvoices = user;
    invModalTitle.textContent = `فواتير: ${user.username}`;
    invSearch.value = "";
    invTbody.innerHTML = "";
    invModalBack.style.display = "flex";
    loadInvoicesForCurrentUser();
  }

  function closeInvModalFunc() {
    invModalBack.style.display = "none";
    currentUserForInvoices = null;
    invoicesForUser = [];
  }

  closeInvModalBtn.onclick = closeInvModalFunc;
  invModalBack.addEventListener("click", (e) => {
    if (e.target === invModalBack) closeInvModalFunc();
  });

  async function loadInvoicesForCurrentUser() {
    if (!currentUserForInvoices) return;
    const { sb } = SB;
    const invTable = SB.tables.invoices;
    const sinceISO = rangeToSince(rangeSel.value);

    let q = sb.from(invTable).select("*").order("created_at", { ascending: false }).limit(200);
    if (sinceISO) q = q.gte("created_at", sinceISO);

    const { data, error } = await q.eq("username", currentUserForInvoices.username);

    if (error) {
      console.error(error);
      invTbody.innerHTML = `<tr><td colspan="5">خطأ: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }

    invoicesForUser = data || [];
    renderInvoices();
  }

  function renderInvoices() {
    const term = invSearch.value.trim().toLowerCase();
    const filtered = invoicesForUser.filter(inv => {
      const fields = [inv.customer, inv.customer_name, inv.client, inv.name, inv.invoice_no, inv.code, inv.created_at];
      return fields.some(f => String(f || "").toLowerCase().includes(term));
    });

    invTbody.innerHTML = filtered.map(inv => {
      const date = inv.created_at ? new Date(inv.created_at).toLocaleString() : "—";
      const cust = inv.customer || inv.customer_name || inv.client || inv.name || "—";
      const total = inv.total || inv.grand_total || inv.amount || "—";
      const code = inv.invoice_no || inv.code || inv.id || "—";

      return `
        <tr>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(cust)}</td>
          <td><b>${escapeHtml(total)}</b></td>
          <td>${escapeHtml(code)}</td>
          <td>
            <button class="mini ghost" data-act="viewJson" data-id="${inv.id}">عرض</button>
            <button class="mini blue" data-act="pdf" data-id="${inv.id}">PDF</button>
          </td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="5" class="mut">لا فواتير</td></tr>`;
  }

  invSearch.oninput = renderInvoices;
  reloadInvBtn.onclick = loadInvoicesForCurrentUser;

  invTbody.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");
    const inv = invoicesForUser.find(i => i.id === id);
    if (!inv) return;

    if (act === "viewJson") {
      alert(JSON.stringify(inv, null, 2));
    }

    if (act === "pdf") {
      console.log("بدء PDF:", id);
      try {
        const html = `
          <div style="direction:rtl; font-family:Arial, sans-serif; padding:30px; background:#fff; text-align:right; border:2px solid #111; border-radius:14px; max-width:794px; margin:0 auto; box-shadow:0 0 10px rgba(0,0,0,0.2);">
            <div style="text-align:center; font-weight:900; font-size:28px; color:#0a7c3a; margin-bottom:10px;">شركة الحايك</div>
            <div style="text-align:center; font-weight:900; font-size:24px; color:#071820; margin-bottom:20px;">HAYEK SPOT</div>
            
            <div style="display:flex; justify-content:space-between; gap:20px; flex-wrap:wrap; font-size:14px; margin-bottom:20px;">
              <div>اسم الزبون: <b>${escapeHtml(inv.customer || inv.customer_name || "غير محدد")}</b></div>
              <div>اسم المستخدم: <b>${escapeHtml(currentUserForInvoices.username)}</b></div>
              <div>رقم الفاتورة: <b>${escapeHtml(inv.invoice_no || inv.code || inv.id || "غير متوفر")}</b></div>
              <div>التاريخ: <b>${escapeHtml(new Date(inv.created_at).toLocaleString('ar-EG'))}</b></div>
              <div>الحالة: <b>${escapeHtml(inv.status || "مفتوحة")}</b></div>
            </div>
            
            <hr style="border:1px solid #111; margin:20px 0;">
            
            <div style="font-weight:800; margin:10px 0 15px; font-size:18px;">سجل العمليات</div>
            
            <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:20px;">
              <thead>
                <tr style="background:#f0f0f0;">
                  <th style="border:1px solid #111; padding:10px; text-align:center;">#</th>
                  <th style="border:1px solid #111; padding:10px; text-align:center;">الوقت</th>
                  <th style="border:1px solid #111; padding:10px; text-align:center;">البيان</th>
                  <th style="border:1px solid #111; padding:10px; text-align:center;">العملية</th>
                  <th style="border:1px solid #111; padding:10px; text-align:center;">النتيجة</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="5" style="border:1px solid #111; padding:15px; text-align:center; color:#777;">لا توجد تفاصيل عمليات محفوظة في الفاتورة</td>
                </tr>
              </tbody>
            </table>
            
            <div style="margin-top:20px; border:2px dashed #111; border-radius:12px; padding:15px; display:flex; justify-content:space-between; font-weight:900; font-size:18px;">
              <span>إجمالي الكشف:</span>
              <span style="color:#0a7c3a;">${escapeHtml(inv.total || inv.grand_total || inv.amount || "—")}</span>
            </div>
            
            <div style="margin-top:30px; text-align:center; font-size:12px; line-height:1.6; color:#333;">
              تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك<br/>
              شركة الحايك / تجارة عامة / توزيع جملة / دعاية و إعلان / طباعة / حلول رقمية<br/>
              <span style="display:inline-block; margin-top:15px; border:2px solid #0a7c3a; color:#0a7c3a; border-radius:12px; padding:10px 20px; font-weight:900; font-size:18px;">05510217646</span>
            </div>
          </div>
        `;

        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        tmp.style.position = "absolute";
        tmp.style.left = "-9999px";
        tmp.style.top = "0";
        tmp.style.width = "794px";
        document.body.appendChild(tmp);

        html2canvas(tmp, { scale: 2, backgroundColor: "#ffffff" }).then(canvas => {
          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          const { jsPDF } = window.jspdf;
          if (!jsPDF) {
            console.error("jsPDF غير متوفر");
            alert("مكتبة PDF غير محملة، تأكد من الإنترنت");
            tmp.remove();
            return;
          }
          const pdf = new jsPDF("p", "pt", "a4");
          pdf.addImage(imgData, "JPEG", 0, 0, pdf.internal.pageSize.getWidth(), canvas.height * (pdf.internal.pageSize.getWidth() / canvas.width));
          pdf.save(`فاتورة_${currentUserForInvoices.username}_${Date.now()}.pdf`);
          tmp.remove();
          console.log("PDF تم إنشاؤه بنجاح");
        }).catch(err => {
          console.error("html2canvas خطأ:", err);
          alert("فشل تحويل الفاتورة إلى صورة");
          tmp.remove();
        });
      } catch (err) {
        console.error("PDF خطأ عام:", err);
        alert("فشل إنشاء PDF");
      }
    }
  });

  // Init
  refreshAll();
})();
