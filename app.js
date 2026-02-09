/* app.js — واجهة المستخدم (بدون كشف “الأدمن” أو “السيرفر” للمستخدم) */

(() => {
  // ===== أدوات صغيرة =====
  const $ = (id) => document.getElementById(id);
  const nowISO = () => new Date().toISOString();
  const fmtDT = (d) => {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return `${hh}:${mm} ${y}/${m}/${day}`;
  };

  const toast = (msg, kind = "ok") => {
    const t = $("toast");
    t.style.display = "block";
    t.textContent = msg;
    t.style.borderColor = kind === "bad" ? "#ff5a6b88" : "#27d17f66";
    t.style.background = kind === "bad" ? "#7a1f2a66" : "#07131a66";
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => (t.style.display = "none"), 2400);
  };

  const vibrate = (ms = 18) => {
    try {
      if ($("chkVibrate").checked && navigator.vibrate) navigator.vibrate(ms);
    } catch {}
  };

  // ===== تحقق الدخول (من auth.js) =====
  // نتوقع auth.js يوفر:
  // window.Auth = { requireUser(), logout(), getSessionUser() }
  // إذا ما موجود، لا نخرب الصفحة، بس نوقف.
  if (!window.Auth || !window.Auth.requireUser) {
    alert("auth.js غير محمل بشكل صحيح.");
    return;
  }

  // ===== Supabase (خلف الكواليس) =====
  const cfg = window.APP_CONFIG || {};
  const supabase = window.supabase?.createClient?.(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  // إذا ما اشتغل، الصفحة تشتغل محلياً (لكن بدون مزامنة)
  const hasDB = !!supabase;

  // ===== تخزين محلي =====
  const LS = {
    user: "hs_user",
    device: "hs_device",
    invoiceId: "hs_invoice_id",
    invoiceStatus: "hs_invoice_status",
    customer: "hs_customer",
    ops: "hs_ops",
    closedAt: "hs_closed_at",
  };

  const loadOps = () => {
    try { return JSON.parse(localStorage.getItem(LS.ops) || "[]"); } catch { return []; }
  };
  const saveOps = (ops) => localStorage.setItem(LS.ops, JSON.stringify(ops));

  // ===== حالة التطبيق =====
  let currentUser = null;        // { username, ... }
  let invoiceId = localStorage.getItem(LS.invoiceId) || "";
  let invoiceStatus = localStorage.getItem(LS.invoiceStatus) || ""; // open/closed
  let customerName = localStorage.getItem(LS.customer) || "";
  let ops = loadOps();

  // ===== عناصر =====
  const netDot = $("netDot");
  const customerInput = $("customerName");
  const statusPill = $("invoiceStatusPill");

  const noteInput = $("noteInput");
  const exprInput = $("exprInput");
  const bigResult = $("bigResult");

  const historyBody = $("historyBody");
  const invBody = $("invBody");

  const invUser = $("invUser");
  const invCust = $("invCust");
  const invId = $("invId");
  const invDate = $("invDate");
  const invTotal = $("invTotal");

  // Buttons
  const btnLogout = $("btnLogout");
  const btnOpenInvoice = $("btnOpenInvoice");
  const btnCloseInvoice = $("btnCloseInvoice");
  const btnPDF = $("btnPDF");

  const btnCopyResult = $("btnCopyResult");
  const btnCopyTable = $("btnCopyTable");
  const btnClearHistory = $("btnClearHistory");

  const btnToday = $("btnToday");
  const btnLast7 = $("btnLast7");
  const btnRebuild = $("btnRebuild");

  // ===== تبويبات =====
  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");

      const tab = b.dataset.tab;
      document.querySelectorAll(".tabpane").forEach((p) => p.classList.add("hidden"));
      $("tab-" + tab).classList.remove("hidden");
      rebuildUI();
    });
  });

  // ===== الإنترنت (للنقطة فقط) =====
  const updateNet = () => {
    const on = navigator.onLine;
    netDot.classList.toggle("online", on);
    netDot.classList.toggle("offline", !on);
    netDot.title = on ? "متصل" : "غير متصل";
  };
  window.addEventListener("online", updateNet);
  window.addEventListener("offline", updateNet);

  // ===== تقييم آمن للعملية =====
  const safeEval = (expr) => {
    // يسمح بالأرقام والنقاط والمسافات والأقواس و + - * /
    const clean = (expr || "").replace(/×/g, "*").replace(/÷/g, "/").trim();

    if (!clean) return { ok: false, value: 0 };

    // منع أي حروف/رموز غير مسموحة
    if (!/^[0-9+\-*/().\s]+$/.test(clean)) return { ok: false, value: 0 };

    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${clean});`)();
    if (typeof val !== "number" || !isFinite(val)) return { ok: false, value: 0 };
    return { ok: true, value: val };
  };

  // ===== حساب الإجمالي الصحيح =====
  const calcTotal = () => {
    // إجمالي الكشف = مجموع نتائج كل العمليات
    return ops.reduce((sum, r) => sum + (Number(r.result) || 0), 0);
  };

  // ===== عرض الجدول/الفاتورة =====
  const rebuildTables = () => {
    // history table
    historyBody.innerHTML = "";
    for (const r of ops) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtDT(r.created_at)}</td>
        <td>${escapeHtml(r.label || "")}</td>
        <td>${escapeHtml(r.operation || "")}</td>
        <td>${formatNumber(r.result)}</td>
      `;
      historyBody.appendChild(tr);
    }

    // invoice body
    invBody.innerHTML = "";
    for (const r of ops) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtDT(r.created_at)}</td>
        <td>${escapeHtml(r.label || "")}</td>
        <td>${escapeHtml(r.operation || "")}</td>
        <td>${formatNumber(r.result)}</td>
      `;
      invBody.appendChild(tr);
    }

    invTotal.textContent = formatNumber(calcTotal());
  };

  const rebuildHeader = () => {
    customerInput.value = customerName || "";
    invUser.textContent = currentUser?.username || "—";
    invCust.textContent = customerName || "—";
    invId.textContent = invoiceId || "—";
    invDate.textContent = invoiceId ? fmtDT(new Date()) : "—";

    // حالة
    let txt = "لا توجد فاتورة";
    if (invoiceId && invoiceStatus === "open") txt = "فاتورة مفتوحة";
    if (invoiceId && invoiceStatus === "closed") txt = "فاتورة مغلقة";
    statusPill.textContent = txt;

    // زر PDF ممنوع إذا لم تُغلق الفاتورة
    const canExport = invoiceId && invoiceStatus === "closed";
    btnPDF.disabled = !canExport;
    btnPDF.style.opacity = canExport ? "1" : "0.55";
  };

  const rebuildUI = () => {
    updateNet();
    rebuildHeader();
    rebuildTables();

    // نتيجة كبيرة
    const last = ops.length ? ops[ops.length - 1] : null;
    bigResult.textContent = last ? formatNumber(last.result) : "0";
  };

  // ===== HTML escape =====
  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function formatNumber(n){
    const x = Number(n);
    if (!isFinite(x)) return "0";
    // بدون كسور طويلة
    const s = (Math.round(x * 1000000) / 1000000).toString();
    return s;
  }

  // ===== فتح/إغلاق فاتورة (بالخلفية) =====
  const ensureInvoiceOpen = async () => {
    if (!customerName || !customerName.trim()) return;
    if (invoiceId && invoiceStatus === "open") return;

    // لو كانت مغلقة وبدأ اسم عميل جديد -> نفتح فاتورة جديدة
    ops = [];
    saveOps(ops);

    invoiceStatus = "open";
    localStorage.setItem(LS.invoiceStatus, invoiceStatus);

    // إنشاء رقم فاتورة بالخلفية
    if (hasDB) {
      const payload = {
        username: currentUser.username,
        device_id: localStorage.getItem(LS.device) || null,
        total: 0,
        customer_name: customerName.trim(),
        status: "open",
      };
      const { data, error } = await supabase.from("app_invoices").insert(payload).select("id, created_at").single();
      if (!error && data?.id) {
        invoiceId = data.id;
        localStorage.setItem(LS.invoiceId, invoiceId);
        localStorage.setItem(LS.invoiceStatus, "open");
      } else {
        // بدون ما نخوف المستخدم
        invoiceId = "local-" + Date.now();
        localStorage.setItem(LS.invoiceId, invoiceId);
        localStorage.setItem(LS.invoiceStatus, "open");
      }
    } else {
      invoiceId = "local-" + Date.now();
      localStorage.setItem(LS.invoiceId, invoiceId);
    }

    rebuildUI();
    toast("تم فتح فاتورة جديدة.");
  };

  const closeInvoice = async () => {
    if (!invoiceId || invoiceStatus !== "open") {
      toast("لا توجد فاتورة مفتوحة لإغلاقها.", "bad");
      return;
    }
    if (!ops.length) {
      toast("لا يوجد عمليات ضمن الفاتورة.", "bad");
      return;
    }

    const total = calcTotal();
    invoiceStatus = "closed";
    localStorage.setItem(LS.invoiceStatus, "closed");
    localStorage.setItem(LS.closedAt, nowISO());

    // تحديث بالسيرفر (بالخلفية)
    if (hasDB && !String(invoiceId).startsWith("local-")) {
      await supabase
        .from("app_invoices")
        .update({ status: "closed", closed_at: nowISO(), total })
        .eq("id", invoiceId);
    }

    rebuildUI();
    toast("تم إغلاق الفاتورة.");
  };

  // ===== إضافة عملية (سطر) =====
  const addOperation = async () => {
    // لازم فاتورة مفتوحة
    if (!customerName.trim()) {
      toast("اكتب اسم العميل أولاً.", "bad");
      customerInput.focus();
      return;
    }
    if (!invoiceId || invoiceStatus !== "open") {
      await ensureInvoiceOpen();
    }

    const label = (noteInput.value || "").trim();
    const expr = (exprInput.value || "").trim();

    const ev = safeEval(expr);
    if (!ev.ok) {
      toast("العملية غير صحيحة.", "bad");
      return;
    }

    const row = {
      created_at: nowISO(),
      label: label || "عملية",
      operation: expr,
      result: ev.value,
    };

    ops.push(row);
    saveOps(ops);

    // إرسال السطر للسيرفر (بالخلفية)
    if (hasDB && invoiceId && !String(invoiceId).startsWith("local-")) {
      const payload = {
        invoice_id: invoiceId,
        username: currentUser.username,
        device_id: localStorage.getItem(LS.device) || null,
        label: row.label,
        operation: row.operation,
        result: String(row.result),
        created_at: row.created_at,
      };
      // لا نوقف المستخدم لو فشل
      supabase.from("app_operations").insert(payload).then(() => {}).catch(() => {});
    }

    bigResult.textContent = formatNumber(row.result);
    rebuildTables();

    // إذا خيار كل عملية بسطر -> نفرّغ العملية فقط
    if ($("chkPerLine").checked) {
      exprInput.value = "";
      noteInput.value = "";
      noteInput.focus();
    }
  };

  // ===== لوحة الأزرار =====
  document.querySelectorAll(".k").forEach((btn) => {
    btn.addEventListener("click", async () => {
      vibrate();
      const k = btn.dataset.k;

      if (k === "DEL") {
        exprInput.value = exprInput.value.slice(0, -1);
        return;
      }
      if (k === "CLEAR_LINE") {
        exprInput.value = "";
        noteInput.value = "";
        bigResult.textContent = "0";
        return;
      }
      if (k === "±") {
        // قلب الإشارة لآخر رقم/القيمة إذا ممكن
        const v = exprInput.value.trim();
        if (!v) { exprInput.value = "-"; return; }
        if (v.startsWith("-")) exprInput.value = v.slice(1);
        else exprInput.value = "-" + v;
        return;
      }
      if (k === "=") {
        await addOperation();
        return;
      }

      // إدخال عادي
      const char = (k === "*") ? "*" : (k === "/") ? "/" : k;
      exprInput.value += char;
      exprInput.focus();
    });
  });

  // Enter = تنفيذ
  exprInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await addOperation();
    }
  });

  // ===== نسخ/مسح =====
  btnClearHistory.addEventListener("click", () => {
    ops = [];
    saveOps(ops);
    rebuildUI();
    toast("تم مسح السجل.");
  });

  btnCopyResult.addEventListener("click", async () => {
    const last = ops.length ? ops[ops.length - 1] : null;
    const txt = last ? String(last.result) : "0";
    await navigator.clipboard.writeText(txt);
    toast("تم نسخ النتيجة.");
  });

  btnCopyTable.addEventListener("click", async () => {
    // نسخ كجدول TSV
    const lines = [
      ["الوقت","البيان","العملية","النتيجة"].join("\t"),
      ...ops.map(r => [fmtDT(r.created_at), r.label||"", r.operation||"", String(r.result)].join("\t")),
      ["", "", "إجمالي الكشف", String(calcTotal())].join("\t")
    ].join("\n");
    await navigator.clipboard.writeText(lines);
    toast("تم النسخ كجدول.");
  });

  // ===== PDF (بعد الإغلاق فقط) =====
  const exportPDF = async () => {
    if (!invoiceId || invoiceStatus !== "closed") {
      toast("أغلق الفاتورة أولاً قبل التصدير.", "bad");
      return;
    }

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      toast("PDF غير جاهز.", "bad");
      return;
    }

    const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

    // خط عربي إذا موجود
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

    doc.setFontSize(16);
    doc.text("شركة الحايك", doc.internal.pageSize.getWidth() - margin, y, { align: "right" });
    y += 18;
    doc.setFontSize(12);
    doc.text("HAYEK SPOT", doc.internal.pageSize.getWidth() - margin, y, { align: "right" });
    y += 24;

    doc.setFontSize(11);
    doc.text(`اسم المستخدم: ${currentUser?.username || "—"}`, doc.internal.pageSize.getWidth() - margin, y, { align: "right" }); y += 16;
    doc.text(`اسم العميل: ${customerName || "—"}`, doc.internal.pageSize.getWidth() - margin, y, { align: "right" }); y += 16;
    doc.text(`رقم الفاتورة: ${invoiceId}`, doc.internal.pageSize.getWidth() - margin, y, { align: "right" }); y += 16;
    doc.text(`التاريخ: ${fmtDT(new Date())}`, doc.internal.pageSize.getWidth() - margin, y, { align: "right" }); y += 18;

    // جدول
    const head = [["الوقت", "البيان", "العملية", "النتيجة"]];
    const body = ops.map(r => [
      fmtDT(r.created_at),
      r.label || "",
      r.operation || "",
      String(formatNumber(r.result))
    ]);

    doc.autoTable({
      startY: y + 10,
      head,
      body,
      styles: { halign: "right", font: (doc.getFont().fontName || "helvetica") },
      headStyles: { halign: "right" },
      bodyStyles: { halign: "right" },
      margin: { left: margin, right: margin }
    });

    const total = formatNumber(calcTotal());
    const endY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 18 : y + 40;

    doc.setFontSize(14);
    doc.text(`إجمالي الكشف: ${total}`, doc.internal.pageSize.getWidth() - margin, endY, { align: "right" });

    doc.setFontSize(10);
    doc.text("تم تطوير هذه الحاسبة الاحترافية من قبل شركة الحايك — 05510217646",
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 30,
      { align: "center" }
    );

    doc.save(`HAYEK-SPOT-${invoiceId}.pdf`);
    toast("تم تصدير PDF.");
  };

  btnPDF.addEventListener("click", exportPDF);

  // ===== فتح فاتورة =====
  btnOpenInvoice.addEventListener("click", async () => {
    if (!customerInput.value.trim()) {
      toast("اكتب اسم العميل أولاً.", "bad");
      customerInput.focus();
      return;
    }
    // اجبار فاتورة جديدة (حتى لو كانت مغلقة)
    invoiceId = "";
    invoiceStatus = "";
    localStorage.removeItem(LS.invoiceId);
    localStorage.removeItem(LS.invoiceStatus);
    await ensureInvoiceOpen();
  });

  // ===== إغلاق فاتورة =====
  btnCloseInvoice.addEventListener("click", closeInvoice);

  // ===== اسم العميل: فتح تلقائي =====
  let custTm = null;
  customerInput.addEventListener("input", () => {
    customerName = customerInput.value;
    localStorage.setItem(LS.customer, customerName);
    clearTimeout(custTm);
    custTm = setTimeout(async () => {
      if (customerName.trim()) await ensureInvoiceOpen();
      rebuildHeader();
    }, 400);
  });

  // ===== خروج =====
  btnLogout.addEventListener("click", async () => {
    try { await window.Auth.logout(); } catch {}
    location.reload();
  });

  // ===== أدوات =====
  btnRebuild.addEventListener("click", () => rebuildUI());

  btnToday.addEventListener("click", () => {
    toast("جاهز. (سنجعلها فلترة ذكية لاحقاً)", "ok");
  });
  btnLast7.addEventListener("click", () => {
    toast("جاهز. (سنجعلها فلترة ذكية لاحقاً)", "ok");
  });

  // ===== بدء التطبيق =====
  const boot = async () => {
    updateNet();
    currentUser = await window.Auth.requireUser(); // يمنع أي دخول بدون تسجيل
    // نخفي أي تفاصيل “سيرفر/أدمن” — فقط نستخدم اسم المستخدم داخلياً
    invUser.textContent = currentUser?.username || "—";

    // استرجاع الحالة
    customerName = localStorage.getItem(LS.customer) || "";
    invoiceId = localStorage.getItem(LS.invoiceId) || "";
    invoiceStatus = localStorage.getItem(LS.invoiceStatus) || "";
    ops = loadOps();

    // لو يوجد اسم عميل ولم يوجد فاتورة -> افتح تلقائياً
    if (customerName.trim() && (!invoiceId || !invoiceStatus)) {
      await ensureInvoiceOpen();
    }

    rebuildUI();
  };

  boot();
})();

