(() => {
  // ===== Helpers =====
  const $ = (id) => document.getElementById(id);
  const sb = window.supabase.createClient(
    APP_CONFIG.SUPABASE_URL,
    APP_CONFIG.SUPABASE_ANON_KEY
  );

  // ===== Auth check =====
  if (!window.HAYEK_AUTH || !window.HAYEK_AUTH.isAuthed()) {
    $("lock").style.display = "flex";
    $("goLogin").onclick = () => location.href = "index.html";
    return;
  }

  const session = window.HAYEK_AUTH.getUser();
  if (!session?.isAdmin) {
    $("lock").style.display = "flex";
    return;
  }
  $("lock").style.display = "none";

  // ===== Elements =====
  const usersTbody = $("usersTbody");
  const invModalBack = $("invModalBack");
  const invTbody = $("invTbody");
  const invModalTitle = $("invModalTitle");

  $("closeInvModal").onclick = () => invModalBack.style.display = "none";
  $("logoutBtn").onclick = () => {
    HAYEK_AUTH.logout();
    location.href = "index.html";
  };

  // ===== Load users =====
  async function loadUsers() {
    const { data } = await sb.from("users").select("*").order("created_at");
    usersTbody.innerHTML = "";

    data.forEach(u => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${u.username}</td>
        <td>${u.is_admin ? "أدمن" : "مستخدم"}</td>
        <td>${u.blocked ? "محظور" : "نشط"}</td>
        <td>
          <button class="mini blue" data-user="${u.username}">
            الفواتير
          </button>
        </td>
        <td>${u.last_seen ? "✔" : "—"}</td>
        <td>${u.device_id || "—"}</td>
        <td class="actions">
          <button class="mini red">حذف</button>
        </td>
      `;

      usersTbody.appendChild(tr);
    });

    // 🔴 ربط زر الفواتير
    document.querySelectorAll('[data-user]').forEach(btn => {
      btn.onclick = () => openInvoices(btn.dataset.user);
    });
  }

  // ===== Open invoices modal =====
  async function openInvoices(username) {
    invModalBack.style.display = "flex";
    invModalTitle.textContent = `فواتير المستخدم: ${username}`;
    invTbody.innerHTML = `<tr><td colspan="5">جارٍ التحميل...</td></tr>`;

    const { data } = await sb
      .from("app_invoices")
      .select("*")
      .eq("username", username)
      .order("created_at", { ascending: false });

    invTbody.innerHTML = "";

    if (!data.length) {
      invTbody.innerHTML = `<tr><td colspan="5">لا يوجد فواتير</td></tr>`;
      return;
    }

    data.forEach(inv => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(inv.created_at).toLocaleString()}</td>
        <td>${inv.customer_name || "-"}</td>
        <td>${inv.total}</td>
        <td>${inv.id.slice(-6)}</td>
        <td>
          <button class="mini green" onclick="exportPDF('${inv.id}')">
            PDF
          </button>
        </td>
      `;
      invTbody.appendChild(tr);
    });
  }

  // ===== Export PDF =====
  window.exportPDF = async function (invoiceId) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const { data: inv } = await sb
      .from("app_invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    const { data: ops } = await sb
      .from("app_operations")
      .select("*")
      .eq("invoice_id", invoiceId);

    let y = 50;
    doc.setFontSize(16);
    doc.text("HAYEK SPOT", 300, y, { align: "center" });

    y += 30;
    doc.setFontSize(11);
    doc.text(`الزبون: ${inv.customer_name}`, 40, y);
    y += 18;
    doc.text(`الإجمالي: ${inv.total}`, 40, y);
    y += 25;

    doc.setFontSize(10);
    ops.forEach(r => {
      doc.text(`${r.text || ""} | ${r.expr} = ${r.result}`, 40, y);
      y += 14;
      if (y > 760) {
        doc.addPage();
        y = 50;
      }
    });

    doc.save(`invoice_${inv.id.slice(-6)}.pdf`);
  };

  // ===== Init =====
  loadUsers();
})();
