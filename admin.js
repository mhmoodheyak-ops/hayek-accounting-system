/* admin.js — لوحة الإدارة (فواتير + مستخدمين + PDF بنفس تنسيق المستخدم) */
(() => {
  const $ = (id) => document.getElementById(id);

  // ===== AUTH Gate =====
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
  function updateNet() {
    const on = navigator.onLine;
    netDot.classList.toggle("online", on);
    netDot.classList.toggle("offline", !on);
    netDot.title = on ? "متصل" : "غير متصل";
  }
  window.addEventListener("online", updateNet);
  window.addEventListener("offline", updateNet);

  // ===== Toast =====
  function toast(elId, msg, bad = false) {
    const el = $(elId);
    el.style.display = "block";
    el.textContent = msg;
    el.style.borderColor = bad ? "#ff5a6b88" : "#27d17f66";
    el.style.background = bad ? "#7a1f2a66" : "#07131a66";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.style.display = "none"), 2400);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDT(d) {
    if (!d) return "—";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return `${hh}:${mm} ${y}/${m}/${day}`;
  }

  function num(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0";
    return String(Math.round(x * 1000000) / 1000000);
  }

  // ===== Supabase =====
  const CFG = window.HAYEK_CONFIG || {};
  const hasDB = !!(window.supabase && CFG.supabaseUrl && CFG.supabaseKey);
  if (!hasDB) {
    alert("Supabase غير جاهز (config.js).");
    return;
  }
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);

  const T_USERS = (CFG.tables && CFG.tables.users) || "app_users";
  const T_INV = (CFG.tables && CFG.tables.invoices) || "app_invoices";
  const T_OPS = (CFG.tables && CFG.tables.operations) || "app_operations";

  // ===== UI refs =====
  $("adminName").textContent = session.username || "admin";

  const invTbody = $("invTbody");
  const usersTbody = $("usersTbody");

  const dInvId = $("dInvId");
  const dUser = $("dUser");
  const dCust = $("dCust");
  const dTotal = $("dTotal");
  const dStatus = $("dStatus");

  const btnViewOps = $("btnViewOps");
  const btnPDF = $("btnPDF");

  const opsModalBack = $("opsModalBack");
  const opsTbody = $("opsTbody");
  const opsMeta = $("opsMeta");
  const opsTotal = $("opsTotal");
  const pdfStage = $("pdfStage");

  // ===== State =====
  let invoices = [];
  let selectedInvoice = null;
  let selectedOps = [];

  // ===== Tabs =====
  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      const tab = b.dataset.tab;
      document.querySelectorAll(".tabpane").forEach((p) => p.classList.add("hidden"));
      $("tab-" + tab).classList.remove("hidden");
    });
  });

  // ===== Buttons top =====
  $("btnLogout").onclick = () => {
    window.HAYEK_AUTH.logout();
    location.href = "index.html?v=" + Date.now();
  };
  $("btnRefresh").onclick = async () => {
    updateNet();
    await loadInvoices();
    await loadUsers();
    toast("toastSide", "تم التحديث.");
  };

  // ===== Invoices =====
  function setSelectedInvoice(inv) {
    selectedInvoice = inv;
    dInvId.value = inv?.id ?? "";
    dUser.value = inv?.username ?? "";
    dCust.value = inv?.customer_name ?? "";
    dTotal.value = num(inv?.total ?? 0);
    dStatus.value = inv?.status ?? "";

    btnViewOps.disabled = !inv;
    btnPDF.disabled = !inv;
  }

  function kpiUpdate() {
    $("kpiInvoices").textContent = String(invoices.length);
    const sum = invoices.reduce((a, r) => a + Number(r.total || 0), 0);
    $("kpiTotal").textContent = num(sum);
  }

  function filterInvoices(list, q) {
    const s = (q || "").trim().toLowerCase();
    if (!s) return list;

    return list.filter((r) => {
      const id6 = String(r.id || "").slice(-6);
      return (
        String(r.username || "").toLowerCase().includes(s) ||
        String(r.customer_name || "").toLowerCase().includes(s) ||
        id6.includes(s) ||
        String(r.id || "").toLowerCase().includes(s)
      );
    });
  }

  function renderInvoices() {
    const q = $("qInvoices").value;
    const list = filterInvoices(invoices, q);

    invTbody.innerHTML = list
      .map((r) => {
        const id6 = String(r.id || "").slice(-6);
        const status = r.status || "—";
        return `
          <tr>
            <td>${escapeHtml(fmtDT(r.created_at || r.closed_at))}</td>
            <td>${escapeHtml(r.username || "—")}</td>
            <td>${escapeHtml(r.customer_name || "—")}</td>
            <td class="num">${escapeHtml(num(r.total || 0))}</td>
            <td>${escapeHtml(status)}</td>
            <td>${escapeHtml(id6)}</td>
            <td>
              <div class="rowBtns">
                <button class="btn" data-act="select" data-id="${escapeHtml(String(r.id))}">تحديد</button>
                <button class="btn primary" data-act="ops" data-id="${escapeHtml(String(r.id))}">العمليات</button>
                <button class="btn" data-act="pdf" data-id="${escapeHtml(String(r.id))}">PDF</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    kpiUpdate();
  }

  async function loadInvoices() {
    try {
      const { data, error } = await sb
        .from(T_INV)
        .select("id, username, customer_name, total, status, created_at, closed_at, device_id")
        .order("created_at", { ascending: false });

      if (error) throw error;
      invoices = data || [];
      renderInvoices();

      if (selectedInvoice) {
        const keep = invoices.find((x) => String(x.id) === String(selectedInvoice.id));
        if (keep) setSelectedInvoice(keep);
      }
      toast("toastInv", "تم تحميل الفواتير.");
    } catch (e) {
      console.error(e);
      toast("toastInv", "فشل تحميل الفواتير: " + (e.message || e), true);
    }
  }

  $("btnLoadInvoices").onclick = loadInvoices;
  $("qInvoices").addEventListener("input", renderInvoices);

  invTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    const inv = invoices.find((x) => String(x.id) === String(id));
    if (!inv) return;

    if (act === "select") {
      setSelectedInvoice(inv);
      toast("toastSide", "تم تحديد الفاتورة.");
      return;
    }
    if (act === "ops") {
      setSelectedInvoice(inv);
      await openOpsModal(inv);
      return;
    }
    if (act === "pdf") {
      setSelectedInvoice(inv);
      await exportInvoicePDF(inv);
      return;
    }
  });

  // ===== Operations (حل مشكلة الملف الفارغ) =====
  function mapOpRow(r) {
    // نحاول نقرأ حسب أي أسماء أعمدة عندك
    const t =
      r.t ||
      r.time ||
      (r.created_at ? fmtDT(r.created_at) : "") ||
      "";

    const text = r.text ?? r.label ?? r.note ?? r.lineText ?? "عملية";
    const expr = r.expr ?? r.operation ?? r.op ?? "";
    const result = r.result ?? r.res ?? r.value ?? "";

    return { t, text, expr, result };
  }

  async function fetchOpsForInvoice(invoiceId) {
    // نجرب أعمدة الربط المختلفة حتى ما يرجع فاضي
    const candidates = ["invoiceId", "invoice_id", "invoiceID", "inv_id"];
    let lastErr = null;

    for (const col of candidates) {
      try {
        // لا تستخدم order(line_no) لأنه غير موجود ويسبب 400
        let q = sb.from(T_OPS).select("*").eq(col, invoiceId);

        // إن كان created_at موجود رتّب به
        q = q.order("created_at", { ascending: true });

        const { data, error } = await q;
        if (!error) return { data: data || [], usedCol: col };
        lastErr = error;
      } catch (e) {
        lastErr = e;
      }
    }

    // fallback بدون order
    for (const col of candidates) {
      try {
        const { data, error } = await sb.from(T_OPS).select("*").eq(col, invoiceId);
        if (!error) return { data: data || [], usedCol: col };
        lastErr = error;
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("فشل جلب العمليات");
  }

  function renderOpsTable(rows) {
    opsTbody.innerHTML = rows
      .map((r, i) => {
        return `
          <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(r.t || "")}</td>
            <td>${escapeHtml(r.text || "—")}</td>
            <td>${escapeHtml(r.expr || "")}</td>
            <td class="num">${escapeHtml(String(r.result ?? ""))}</td>
          </tr>
        `;
      })
      .join("");

    const total = rows.reduce((a, x) => a + Number(x.result || 0), 0);
    opsTotal.textContent = num(total);
  }

  async function openOpsModal(inv) {
    try {
      opsModalBack.style.display = "flex";
      opsTbody.innerHTML = `<tr><td colspan="5">جارِ التحميل...</td></tr>`;
      opsMeta.textContent = `فاتورة: ${String(inv.id).slice(-6)} — المستخدم: ${inv.username || "—"} — الزبون: ${inv.customer_name || "—"}`;

      const { data, usedCol } = await fetchOpsForInvoice(inv.id);
      selectedOps = (data || []).map(mapOpRow);

      renderOpsTable(selectedOps);

      if (!selectedOps.length) {
        toast("toastOps", "لا توجد عمليات لهذه الفاتورة (تحقق من عمود الربط).", true);
        console.warn("No ops returned. Used column:", usedCol);
      } else {
        toast("toastOps", `تم جلب العمليات (${selectedOps.length}) ✓`);
      }
    } catch (e) {
      console.error(e);
      opsTbody.innerHTML = `<tr><td colspan="5">فشل جلب العمليات: ${escapeHtml(e.message || String(e))}</td></tr>`;
      toast("toastOps", "فشل جلب العمليات.", true);
    }
  }

  $("btnCloseOps").onclick = () => (opsModalBack.style.display = "none");
  opsModalBack.addEventListener("click", (e) => {
    if (e.target === opsModalBack) opsModalBack.style.display = "none";
  });

  btnViewOps.onclick = async () => {
    if (!selectedInvoice) return;
    await openOpsModal(selectedInvoice);
  };

  // ===== PDF Template (نفس ملف المستخدم) =====
  function buildInvoiceHtmlLikeUser(inv, opsRows) {
    const rowsHtml = (opsRows || []).map((r, i) => `
      <tr>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:10%">${i + 1}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:16%">${escapeHtml(r.t || "")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:right;width:34%">${escapeHtml(r.text || "عملية")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:20%">${escapeHtml(r.expr || "")}</td>
        <td style="border:1px solid #111;padding:8px;text-align:center;width:20%;font-weight:900">${escapeHtml(String(r.result ?? ""))}</td>
      </tr>
    `).join("");

    const invNo = String(inv.id || "").slice(-6);
    const total = num(inv.total ?? opsRows.reduce((a, x) => a + Number(x.result || 0), 0));

    return `
      <div style="direction:rtl;font-family:Arial,system-ui; background:#fff; color:#111; padding:18px;">
        <div style="border:2px solid #111;border-radius:14px;padding:16px;">
          <!-- أعلى الملف -->
          <div style="text-align:center;font-weight:900;font-size:24px;margin-bottom:4px;">شركة الحايك</div>
          <div style="text-align:center;font-weight:900;font-size:20px;color:#0a7c3a;margin-bottom:10px;">HAYEK SPOT</div>

          <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;margin-bottom:10px;flex-wrap:wrap">
            <div>اسم الزبون: <b>${escapeHtml(inv.customer_name || "-")}</b></div>
            <div>اسم المستخدم: <b>${escapeHtml(inv.username || "-")}</b></div>
            <div>رقم الفاتورة: <b>${escapeHtml(invNo)}</b></div>
            <div>التاريخ: <b>${new Date().toLocaleString("ar")}</b></div>
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
              ${rowsHtml || `<tr><td colspan="5" style="border:1px solid #111;padding:14px;text-align:center;color:#666">لا يوجد عمليات</td></tr>`}
            </tbody>
          </table>

          <div style="margin-top:12px;border:2px dashed #111;border-radius:12px;padding:10px;display:flex;justify-content:space-between;font-weight:900">
            <span>إجمالي الكشف:</span>
            <span>${escapeHtml(total)}</span>
          </div>

          <!-- أسفل الملف -->
          <div style="margin-top:12px;border:2px solid #111;border-radius:14px;padding:12px;text-align:center;font-size:12px;line-height:1.8">
            تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك<br/>
            شركة الحايك / تجارة عامة / توزيع جملة / دعاية و اعلان / طباعة / حلول رقمية<br/>
            <span style="display:inline-block;margin-top:8px;border:2px solid #0a7c3a;color:#0a7c3a;border-radius:12px;padding:8px 16px;font-weight:900;font-size:16px;">05510217646</span>
          </div>
        </div>
      </div>
    `;
  }

  async function exportAsPdfFromHtml(html, filename) {
    // نستخدم pdfStage (موجود بالصفحة) لضمان عدم اختفاء الجدول
    pdfStage.innerHTML = html;

    const canvas = await html2canvas(pdfStage, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "pt", "a4");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = canvas.height * (imgW / canvas.width);

    let y = 0;
    let remaining = imgH;

    while (remaining > 0) {
      pdf.addImage(imgData, "JPEG", 0, y, imgW, imgH);
      remaining -= pageH;
      if (remaining > 0) {
        pdf.addPage();
        y -= pageH;
      }
    }

    pdf.save(filename);
    pdfStage.innerHTML = "";
  }

  async function exportInvoicePDF(inv) {
    try {
      toast("toastSide", "جارِ تجهيز PDF...");

      // لازم نجيب العمليات من DB حتى لا يطلع فاضي
      const { data } = await fetchOpsForInvoice(inv.id);
      const opsRows = (data || []).map(mapOpRow);

      const html = buildInvoiceHtmlLikeUser(inv, opsRows);
      const cust = (inv.customer_name || "invoice").trim().replace(/\s+/g, "_");
      const invNo = String(inv.id || "").slice(-6);
      await exportAsPdfFromHtml(html, `HAYEK_${cust}_${invNo}.pdf`);

      toast("toastSide", "تم تصدير PDF ✓");
    } catch (e) {
      console.error(e);
      toast("toastSide", "فشل تصدير PDF: " + (e.message || e), true);
    }
  }

  btnPDF.onclick = async () => {
    if (!selectedInvoice) return;
    await exportInvoicePDF(selectedInvoice);
  };

  $("btnOpsPDF").onclick = async () => {
    if (!selectedInvoice) {
      toast("toastOps", "حدد فاتورة أولاً.", true);
      return;
    }
    await exportInvoicePDF(selectedInvoice);
  };

  // ===== Users management =====
  function filterUsers(list, q) {
    const s = (q || "").trim().toLowerCase();
    if (!s) return list;
    return list.filter((u) => String(u.username || "").toLowerCase().includes(s));
  }

  let users = [];

  function renderUsers() {
    const q = $("qUsers").value;
    const list = filterUsers(users, q);

    usersTbody.innerHTML = list
      .map((u) => {
        return `
          <tr>
            <td>${escapeHtml(String(u.id ?? ""))}</td>
            <td>${escapeHtml(u.username || "")}</td>
            <td>${u.is_admin ? "TRUE" : "FALSE"}</td>
            <td>${u.blocked ? "TRUE" : "FALSE"}</td>
            <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(u.device_id || "")}</td>
            <td>${escapeHtml(fmtDT(u.last_seen || u.created_at))}</td>
            <td>
              <div class="rowBtns">
                <button class="btn" data-act="clearDevice" data-id="${escapeHtml(String(u.id))}">مسح الجهاز</button>
                <button class="btn ${u.blocked ? "primary" : "danger"}" data-act="toggleBlock" data-id="${escapeHtml(String(u.id))}">
                  ${u.blocked ? "فك الحظر" : "حظر"}
                </button>
                <button class="btn danger" data-act="delete" data-id="${escapeHtml(String(u.id))}">حذف</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadUsers() {
    try {
      const { data, error } = await sb
        .from(T_USERS)
        .select("id, username, pass, is_admin, blocked, created_at, device_id, last_seen")
        .order("id", { ascending: true });

      if (error) throw error;
      users = data || [];
      renderUsers();
      toast("toastUsers", "تم تحميل المستخدمين.");
    } catch (e) {
      console.error(e);
      toast("toastUsers", "فشل تحميل المستخدمين: " + (e.message || e), true);
    }
  }

  $("btnLoadUsers").onclick = loadUsers;
  $("qUsers").addEventListener("input", renderUsers);

  usersTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    const user = users.find((x) => String(x.id) === String(id));
    if (!user) return;

    if (act === "clearDevice") {
      if (!confirm(`مسح device_id للمستخدم: ${user.username} ؟`)) return;
      try {
        await sb.from(T_USERS).update({ device_id: null }).eq("id", user.id);
        toast("toastUsers", "تم مسح الجهاز ✓");
        await loadUsers();
      } catch (err) {
        toast("toastUsers", "فشل مسح الجهاز", true);
      }
      return;
    }

    if (act === "toggleBlock") {
      const next = !user.blocked;
      if (!confirm(`${next ? "حظر" : "فك حظر"} المستخدم: ${user.username} ؟`)) return;
      try {
        await sb.from(T_USERS).update({ blocked: next }).eq("id", user.id);
        toast("toastUsers", "تم التنفيذ ✓");
        await loadUsers();
      } catch (err) {
        toast("toastUsers", "فشل التنفيذ", true);
      }
      return;
    }

    if (act === "delete") {
      if (!confirm(`حذف المستخدم نهائياً: ${user.username} ؟`)) return;
      try {
        await sb.from(T_USERS).delete().eq("id", user.id);
        toast("toastUsers", "تم حذف المستخدم ✓");
        await loadUsers();
      } catch (err) {
        toast("toastUsers", "فشل حذف المستخدم", true);
      }
      return;
    }
  });

  // ===== Boot =====
  async function boot() {
    updateNet();
    setSelectedInvoice(null);
    await loadInvoices();
    await loadUsers();
  }
  boot();
})();
