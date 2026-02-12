/* admin.js — لوحة الإدارة (نسخة موحّدة + PDF + إصلاح invoiceId) */
(() => {
  const $ = (id) => document.getElementById(id);

  // ===== Guard Auth =====
  if (!window.HAYEK_AUTH || !window.__HAYEK_AUTH_LOADED__ || !window.HAYEK_AUTH.isAuthed()) {
    location.href = "index.html?v=" + Date.now();
    return;
  }
  const session = window.HAYEK_AUTH.getUser() || {};
  if (session.role !== "admin") {
    location.href = "invoice.html?v=" + Date.now();
    return;
  }

  // ===== Config / Supabase =====
  const CFG = window.HAYEK_CONFIG || {};
  const hasDB = !!(window.supabase && CFG.supabaseUrl && CFG.supabaseKey);
  const sb = hasDB ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;

  const T_USERS = (CFG.tables && CFG.tables.users) || "app_users";
  const T_INV   = (CFG.tables && CFG.tables.invoices) || "app_invoices";
  const T_OPS   = (CFG.tables && CFG.tables.operations) || "app_operations";

  // ===== Utils =====
  const nowISO = () => new Date().toISOString();

  function toast(id, msg, bad = false) {
    const t = $(id);
    t.style.display = "block";
    t.textContent = msg;
    t.style.borderColor = bad ? "#ff5a6b88" : "#27d17f66";
    t.style.background = bad ? "#7a1f2a66" : "#07131a66";
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => (t.style.display = "none"), 2600);
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
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}`;
  }

  function last6(id) {
    const s = String(id || "");
    return s.length <= 6 ? s : s.slice(-6);
  }

  function num(n) {
    const x = Number(n);
    if (!isFinite(x)) return "0";
    return String(Math.round(x * 100) / 100);
  }

  // ===== Net dot =====
  function refreshNet() {
    const on = navigator.onLine;
    const dot = $("netDot");
    dot.classList.toggle("online", on);
    dot.classList.toggle("offline", !on);
  }
  window.addEventListener("online", refreshNet);
  window.addEventListener("offline", refreshNet);
  refreshNet();

  $("adminLabel").textContent = session.username || "admin";

  $("btnLogout").onclick = () => {
    window.HAYEK_AUTH.logout();
    location.href = "index.html?v=" + Date.now();
  };

  $("btnRefresh").onclick = () => {
    const active = document.querySelector(".tab.active")?.dataset?.tab;
    if (active === "users") loadUsers();
    else loadInvoices();
  };

  // ===== Tabs =====
  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");

      const tab = b.dataset.tab;
      document.querySelectorAll(".tabpane").forEach((p) => p.classList.add("hidden"));
      $("tab-" + tab).classList.remove("hidden");

      if (tab === "users") loadUsers();
      else loadInvoices();
    });
  });

  // ====== Invoices state ======
  let invoices = [];
  let selectedInvoice = null;
  let selectedOps = [];

  function renderInvoices(list) {
    const tbody = $("invoicesBody");
    tbody.innerHTML = "";

    list.forEach((inv) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(fmtDT(inv.created_at))}</td>
        <td>${escapeHtml(inv.username || "—")}</td>
        <td>${escapeHtml(inv.customer_name || "—")}</td>
        <td class="num">${escapeHtml(num(inv.total))}</td>
        <td>${escapeHtml(inv.status || "—")}</td>
        <td class="num">${escapeHtml(last6(inv.id))}</td>
        <td>
          <button class="btn" data-act="view" data-id="${escapeHtml(inv.id)}">عرض</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Click actions
    tbody.querySelectorAll("button[data-act='view']").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const inv = invoices.find((x) => String(x.id) === String(id));
        if (inv) selectInvoice(inv);
      };
    });
  }

  function selectInvoice(inv) {
    selectedInvoice = inv;
    selectedOps = [];
    $("opsBody").innerHTML = "";
    $("opsTotal").textContent = "0";

    $("dId").textContent = last6(inv.id);
    $("dStatus").textContent = inv.status || "—";
    $("dUser").textContent = inv.username || "—";
    $("dCust").textContent = inv.customer_name || "—";
    $("dTotal").textContent = num(inv.total);
    $("dDate").textContent = fmtDT(inv.created_at);

    $("btnLoadOps").disabled = false;
    $("btnMakePDF").disabled = false;

    toast("toastInv", "تم تحديد الفاتورة. اضغط العمليات لعرض التفاصيل.");
  }

  // ===== Load invoices =====
  async function loadInvoices() {
    if (!hasDB || !sb) {
      toast("toastInv", "Supabase غير جاهز.", true);
      return;
    }
    try {
      const { data, error } = await sb
        .from(T_INV)
        .select("id, username, customer_name, total, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      invoices = data || [];
      renderInvoices(invoices);
      toast("toastInv", `تم تحميل ${invoices.length} فاتورة.`);
    } catch (e) {
      console.error(e);
      toast("toastInv", "فشل تحميل الفواتير.", true);
    }
  }

  $("btnLoadInvoices").onclick = loadInvoices;

  $("qInvoices").addEventListener("input", () => {
    const q = $("qInvoices").value.trim().toLowerCase();
    if (!q) return renderInvoices(invoices);

    const filtered = invoices.filter((inv) => {
      const a = String(inv.username || "").toLowerCase();
      const b = String(inv.customer_name || "").toLowerCase();
      const c = last6(inv.id).toLowerCase();
      return a.includes(q) || b.includes(q) || c.includes(q);
    });
    renderInvoices(filtered);
  });

  // ===== CSV invoices =====
  $("btnDownloadInvoicesCSV").onclick = () => {
    const rows = [
      ["id", "username", "customer_name", "total", "status", "created_at"],
      ...invoices.map((x) => [
        x.id,
        x.username || "",
        x.customer_name || "",
        x.total ?? "",
        x.status || "",
        x.created_at || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `HAYEK_invoices_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ===== Load operations (FIX: invoiceId) =====
  async function loadOps() {
    if (!selectedInvoice) return;
    if (!hasDB || !sb) {
      toast("toastOps", "Supabase غير جاهز.", true);
      return;
    }

    try {
      $("opsBody").innerHTML = "";
      selectedOps = [];

      // ✅ العمود الصحيح: invoiceId
      const { data, error } = await sb
        .from(T_OPS)
        .select("id, invoiceId, username, text, expr, result, created_at")
        .eq("invoiceId", selectedInvoice.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      selectedOps = data || [];
      renderOps(selectedOps);
      toast("toastOps", `تم تحميل ${selectedOps.length} عملية.`);
    } catch (e) {
      console.error(e);
      toast("toastOps", "فشل تحميل العمليات (تأكد من اسم العمود invoiceId).", true);
    }
  }

  function renderOps(list) {
    const tbody = $("opsBody");
    tbody.innerHTML = "";

    let total = 0;
    list.forEach((r, i) => {
      const res = Number(r.result || 0);
      total += isFinite(res) ? res : 0;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="num">${i + 1}</td>
        <td>${escapeHtml(fmtDT(r.created_at))}</td>
        <td>${escapeHtml(r.text || "—")}</td>
        <td class="num">${escapeHtml(r.expr || "")}</td>
        <td class="num">${escapeHtml(num(r.result))}</td>
      `;
      tbody.appendChild(tr);
    });

    $("opsTotal").textContent = num(total);
  }

  $("btnLoadOps").onclick = loadOps;

  // ===== PDF from admin (pdfStage) =====
  async function makePDF() {
    if (!selectedInvoice) return;

    // لو العمليات غير محمّلة حمّلها أولاً
    if (!selectedOps.length) await loadOps();

    if (!selectedOps.length) {
      toast("toastOps", "لا توجد عمليات لهذه الفاتورة.", true);
      return;
    }

    const stage = $("pdfStage");
    stage.innerHTML = buildPDFStageHtml(selectedInvoice, selectedOps);
    // stage موجود خارج الشاشة (CSS .pdfStage)

    try {
      const canvas = await html2canvas(stage, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) throw new Error("jsPDF غير جاهز");

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

      const cust = (selectedInvoice.customer_name || "invoice").trim().replace(/\s+/g, "_");
      const invNo = last6(selectedInvoice.id);
      pdf.save(`OPS_${cust}_${invNo}.pdf`);

      toast("toastOps", "تم تصدير PDF من الأدمن.");
    } catch (e) {
      console.error(e);
      toast("toastOps", "فشل تصدير PDF.", true);
    }
  }

  function buildPDFStageHtml(inv, ops) {
    const rows = ops.map((r, idx) => `
      <tr>
        <td class="num">${idx + 1}</td>
        <td>${escapeHtml(fmtDT(r.created_at))}</td>
        <td>${escapeHtml(r.text || "عملية")}</td>
        <td class="num">${escapeHtml(r.expr || "")}</td>
        <td class="num">${escapeHtml(num(r.result))}</td>
      </tr>
    `).join("");

    const total = ops.reduce((s, r) => s + (Number(r.result) || 0), 0);

    return `
      <div style="border:2px solid #111;border-radius:14px;padding:16px;">
        <div style="text-align:center;font-weight:900;font-size:24px;margin-bottom:4px;">شركة الحايك</div>
        <div style="text-align:center;font-weight:900;font-size:18px;color:#0a7c3a;margin-bottom:10px;">HAYEK SPOT</div>

        <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;margin-bottom:10px;flex-wrap:wrap">
          <div>اسم الزبون: <b>${escapeHtml(inv.customer_name || "-")}</b></div>
          <div>اسم المستخدم: <b>${escapeHtml(inv.username || "-")}</b></div>
          <div>رقم الفاتورة: <b>${escapeHtml(last6(inv.id))}</b></div>
          <div>التاريخ: <b>${escapeHtml(fmtDT(inv.created_at || nowISO()))}</b></div>
        </div>

        <div style="border-top:1px solid #111;margin:10px 0"></div>

        <div style="font-weight:900;margin:6px 0 10px;">تفاصيل العمليات</div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الوقت</th>
              <th>البيان</th>
              <th>العملية</th>
              <th>النتيجة</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="pdfTotal">
          <span>إجمالي الكشف:</span>
          <span class="num">${escapeHtml(num(total))}</span>
        </div>

        <div style="margin-top:12px;border:2px solid #111;border-radius:14px;padding:12px;text-align:center;font-size:12px;line-height:1.8">
          تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك<br/>
          <span style="display:inline-block;margin-top:8px;border:2px solid #0a7c3a;color:#0a7c3a;border-radius:12px;padding:8px 16px;font-weight:900;font-size:16px;">05510217646</span>
        </div>
      </div>
    `;
  }

  $("btnMakePDF").onclick = makePDF;

  // ===== Users =====
  let users = [];
  let editingUserId = null;

  async function loadUsers() {
    if (!hasDB || !sb) {
      toast("toastUsers", "Supabase غير جاهز.", true);
      return;
    }
    try {
      const { data, error } = await sb
        .from(T_USERS)
        .select("id, username, pass, is_admin, blocked, device_id, last_seen, created_at")
        .order("id", { ascending: true });

      if (error) throw error;
      users = data || [];
      renderUsers(users);
      toast("toastUsers", `تم تحميل ${users.length} مستخدم.`);
    } catch (e) {
      console.error(e);
      toast("toastUsers", "فشل تحميل المستخدمين.", true);
    }
  }

  function renderUsers(list) {
    const tbody = $("usersBody");
    tbody.innerHTML = "";

    list.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="num">${u.id}</td>
        <td>${escapeHtml(u.username || "")}</td>
        <td>${u.blocked ? "محظور" : "نشط"}</td>
        <td>${u.is_admin ? "نعم" : "لا"}</td>
        <td class="num">${escapeHtml(u.device_id ? String(u.device_id).slice(0, 6) + "…" : "—")}</td>
        <td>${escapeHtml(u.last_seen ? fmtDT(u.last_seen) : "—")}</td>
        <td>
          <button class="btn" data-act="edit" data-id="${u.id}">تعديل</button>
          <button class="btn danger" data-act="del" data-id="${u.id}">حذف</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("button[data-act='edit']").forEach((b) => {
      b.onclick = () => {
        const id = Number(b.getAttribute("data-id"));
        const u = users.find((x) => Number(x.id) === id);
        if (!u) return;
        editingUserId = u.id;
        $("u_name").value = u.username || "";
        $("u_pass").value = u.pass || "";
        $("u_is_admin").checked = !!u.is_admin;
        $("u_blocked").checked = !!u.blocked;
        toast("toastUserForm", "تم تحميل المستخدم للتعديل.");
      };
    });

    tbody.querySelectorAll("button[data-act='del']").forEach((b) => {
      b.onclick = async () => {
        const id = Number(b.getAttribute("data-id"));
        if (!confirm("حذف المستخدم نهائياً؟")) return;
        try {
          const { error } = await sb.from(T_USERS).delete().eq("id", id);
          if (error) throw error;
          toast("toastUsers", "تم الحذف.");
          loadUsers();
        } catch (e) {
          console.error(e);
          toast("toastUsers", "فشل الحذف.", true);
        }
      };
    });
  }

  $("btnLoadUsers").onclick = loadUsers;

  $("qUsers").addEventListener("input", () => {
    const q = $("qUsers").value.trim().toLowerCase();
    if (!q) return renderUsers(users);
    renderUsers(users.filter((u) => String(u.username || "").toLowerCase().includes(q)));
  });

  function clearUserForm() {
    editingUserId = null;
    $("u_name").value = "";
    $("u_pass").value = "";
    $("u_is_admin").checked = false;
    $("u_blocked").checked = false;
  }

  $("btnClearForm").onclick = clearUserForm;

  $("btnAddUser").onclick = () => {
    clearUserForm();
    toast("toastUserForm", "جاهز لإضافة مستخدم جديد.");
  };

  $("btnSaveUser").onclick = async () => {
    if (!hasDB || !sb) return toast("toastUserForm", "Supabase غير جاهز.", true);

    const username = $("u_name").value.trim();
    const pass = $("u_pass").value.trim();
    const is_admin = $("u_is_admin").checked;
    const blocked = $("u_blocked").checked;

    if (!username || !pass) return toast("toastUserForm", "املأ اسم المستخدم وكلمة السر.", true);

    try {
      if (editingUserId) {
        const { error } = await sb.from(T_USERS).update({ username, pass, is_admin, blocked }).eq("id", editingUserId);
        if (error) throw error;
        toast("toastUserForm", "تم التعديل.");
      } else {
        const payload = { username, pass, is_admin, blocked, created_at: nowISO() };
        const { error } = await sb.from(T_USERS).insert(payload);
        if (error) throw error;
        toast("toastUserForm", "تمت الإضافة.");
      }
      loadUsers();
    } catch (e) {
      console.error(e);
      toast("toastUserForm", "فشل الحفظ (قد يكون الاسم مكرر).", true);
    }
  };

  $("btnResetDevice").onclick = async () => {
    if (!hasDB || !sb) return toast("toastUserForm", "Supabase غير جاهز.", true);
    if (!editingUserId) return toast("toastUserForm", "اختر مستخدم للتعديل أولاً.", true);

    if (!confirm("مسح الجهاز لهذا المستخدم؟")) return;
    try {
      const { error } = await sb.from(T_USERS).update({ device_id: null }).eq("id", editingUserId);
      if (error) throw error;
      toast("toastUserForm", "تم مسح الجهاز.");
      loadUsers();
    } catch (e) {
      console.error(e);
      toast("toastUserForm", "فشل مسح الجهاز.", true);
    }
  };

  // ===== Boot =====
  loadInvoices();
})();
