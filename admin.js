// admin.js
(async function () {
  // لازم auth.js يكون عامل window.sb
  const sb = window.sb;
  const logoutBtn = document.getElementById("logoutBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const usersTbody = document.getElementById("usersTbody");
  const countUsers = document.getElementById("countUsers");
  const adminInfo = document.getElementById("adminInfo");

  const createBtn = document.getElementById("createBtn");
  const newUsername = document.getElementById("newUsername");
  const newPassword = document.getElementById("newPassword");

  // حماية: إذا مو مسجّل دخول، رجّعه
  if (!window.isLoggedIn?.()) {
    location.href = "index.html";
    return;
  }

  // تأكد إنه Admin
  const session = window.getSession?.();
  adminInfo.textContent = session?.name ? `مرحبًا ${session.name}` : "";

  async function getMeProfile() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;

    const { data, error } = await sb
      .from("app_users")
      .select("username,is_admin,blocked,created_at")
      .eq("id", user.id)
      .single();

    if (error) return null;
    return data;
  }

  const me = await getMeProfile();
  if (!me?.is_admin) {
    alert("هذه الصفحة للإدمن فقط");
    location.href = "index.html";
    return;
  }

  async function loadUsers() {
    usersTbody.innerHTML = `<tr><td colspan="5">جاري التحميل...</td></tr>`;

    const { data, error } = await sb
      .from("app_users")
      .select("id,username,is_admin,blocked,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      usersTbody.innerHTML = `<tr><td colspan="5">خطأ: ${error.message}</td></tr>`;
      return;
    }

    countUsers.textContent = data?.length || 0;

    usersTbody.innerHTML = "";
    (data || []).forEach(u => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.username}</td>
        <td>${u.is_admin ? `<span class="tag admin">Admin</span>` : `User`}</td>
        <td>${u.blocked ? `<span class="tag blocked">Blocked</span>` : `Active`}</td>
        <td class="ltr">${new Date(u.created_at).toLocaleString()}</td>
        <td>
          <div class="actions">
            <button class="btn ${u.blocked ? "ok" : ""}" data-action="toggle" data-id="${u.id}" data-blocked="${u.blocked}">
              ${u.blocked ? "فك حظر" : "حظر"}
            </button>

            <button class="btn danger" data-action="deleteRow" data-id="${u.id}">
              حذف من الجدول
            </button>
          </div>
          <div class="muted">* حذف نهائي من Auth نعمله لاحقًا بـ Edge Function</div>
        </td>
      `;
      usersTbody.appendChild(tr);
    });
  }

  usersTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "toggle") {
      const blocked = btn.dataset.blocked === "true";
      const next = !blocked;

      const ok = confirm(next ? "تأكيد حظر المستخدم؟" : "تأكيد فك الحظر؟");
      if (!ok) return;

      const { error } = await sb
        .from("app_users")
        .update({ blocked: next })
        .eq("id", id);

      if (error) return alert("خطأ: " + error.message);
      await loadUsers();
    }

    if (action === "deleteRow") {
      const ok = confirm("هذا سيحذف صف المستخدم من جدول app_users فقط (وليس من Auth). متابعة؟");
      if (!ok) return;

      const { error } = await sb
        .from("app_users")
        .delete()
        .eq("id", id);

      if (error) return alert("خطأ: " + error.message);
      await loadUsers();
    }
  });

  refreshBtn.addEventListener("click", loadUsers);

  logoutBtn.addEventListener("click", async () => {
    await window.logout?.();
    location.href = "index.html";
  });

  // إنشاء مستخدم: مبدئيًا (قريبًا) عبر Edge Function
  createBtn.addEventListener("click", async () => {
    alert("إنشاء مستخدم من داخل اللوحة يحتاج Edge Function (Service Role). قلّي إذا بدك أجهزها لك.");
  });

  await loadUsers();
})();