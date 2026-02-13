import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================
// ضع بيانات Supabase
// =====================
const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================
// Helpers
// =====================
const $ = (id) => document.getElementById(id);

function setSys(msg) {
  const el = $("sysMsg");
  if (el) el.textContent = msg;
}
function setUsersStatus(msg) {
  const el = $("usersStatus");
  if (el) el.textContent = msg;
}
function vibrate() {
  if (navigator.vibrate) navigator.vibrate(15);
}
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("tr-TR");
  } catch {
    return "—";
  }
}
function boolText(v) {
  return v ? "نعم" : "لا";
}

// =====================
// Tabs (Lazy)
// =====================
const panels = {
  users: $("usersPanel"),
  invoices: $("invoicesPanel"),
  reports: $("reportsPanel"),
};

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    Object.keys(panels).forEach((k) => (panels[k].style.display = k === tab ? "" : "none"));
    if (tab === "users") loadUsers(true);
  });
});

// =====================
// Session / Auth
// =====================
async function ensureSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error(error);

  if (!session) {
    // إذا ما في جلسة: رجع لصفحة الدخول
    location.href = "./index.html";
    return null;
  }

  const info = $("sessionInfo");
  if (info) info.textContent = `مسجّل: ${session.user?.email || "—"}`;
  return session;
}

$("btnLogout")?.addEventListener("click", async () => {
  vibrate();
  await supabase.auth.signOut();
  location.href = "./index.html";
});

$("btnRefresh")?.addEventListener("click", async () => {
  vibrate();
  await refreshSummary();
  await loadUsers(true);
});

// =====================
// Users State
// =====================
let usersPage = 1;
let usersPageSize = 25;
let usersLastBatchCount = 0;
let usersTotalKnown = null;
let usersLoading = false;
let usersQueryTimer = null;

$("pageSizeUsers")?.addEventListener("change", () => {
  usersPageSize = Number($("pageSizeUsers").value || 25);
  usersPage = 1;
  loadUsers(true);
});

$("qUsers")?.addEventListener("input", () => {
  clearTimeout(usersQueryTimer);
  usersQueryTimer = setTimeout(() => {
    usersPage = 1;
    loadUsers(true);
  }, 300);
});

$("prevUsers")?.addEventListener("click", () => {
  if (usersPage > 1) {
    usersPage--;
    loadUsers(false);
  }
});

$("nextUsers")?.addEventListener("click", () => {
  if (usersLastBatchCount === usersPageSize) {
    usersPage++;
    loadUsers(false);
  }
});

// =====================
// IMPORTANT: جدولك الحقيقي
// public.app_users
// الأعمدة:
// id (int8), username (text), pass (text), is_admin (bool),
// blocked (bool), created_at (timestamptz), device_id (text), last_seen (timestamptz)
// =====================

async function loadUsers(force = false) {
  if (usersLoading) return;
  usersLoading = true;

  setUsersStatus("جارٍ التحميل...");
  $("usersTbody").innerHTML = "";

  try {
    const q = ($("qUsers").value || "").trim();
    const from = (usersPage - 1) * usersPageSize;
    const to = from + usersPageSize - 1;

    // ملاحظة: Supabase or() مع ilike ممتاز للبحث السريع
    let query = supabase
      .from("app_users")
      .select("id,username,is_admin,blocked,created_at,device_id,last_seen", { count: "exact" })
      .order("id", { ascending: true })
      .range(from, to);

    if (q) {
      // بحث في username OR device_id
      query = query.or(`username.ilike.%${q}%,device_id.ilike.%${q}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    usersLastBatchCount = (data || []).length;
    usersTotalKnown = count ?? null;

    $("usersPageInfo").textContent = `صفحة ${usersPage}`;
    $("usersCountInfo").textContent =
      usersTotalKnown != null ? `النتائج: ${usersTotalKnown}` : `النتائج: —`;

    renderUsers(data || []);
    setUsersStatus("تم ✅");
  } catch (e) {
    console.error(e);
    setUsersStatus("خطأ ❌");
    $("usersTbody").innerHTML = `<tr><td colspan="6" style="color:rgba(255,77,77,.95);">فشل تحميل المستخدمين: ${escapeHtml(e.message || e)}</td></tr>`;
  } finally {
    usersLoading = false;
  }
}

function renderUsers(rows) {
  if (!rows.length) {
    $("usersTbody").innerHTML = `<tr><td colspan="6" style="color:var(--muted);">لا يوجد نتائج</td></tr>`;
    return;
  }

  const html = rows
    .map((u) => {
      const isBlocked = !!u.blocked;
      const statusPillClass = isBlocked ? "bad" : "ok";
      const statusText = isBlocked ? "محظور" : "نشط";

      return `
      <tr>
        <td>${escapeHtml(u.username || "—")}</td>
        <td title="${escapeHtml(u.device_id || "")}">${escapeHtml(u.device_id || "—")}</td>
        <td>${boolText(!!u.is_admin)}</td>
        <td><span class="pill ${statusPillClass}">${statusText}</span></td>
        <td>${fmtDate(u.last_seen || u.created_at)}</td>
        <td>
          <button class="primary" data-act="toggle" data-id="${u.id}" data-blocked="${u.blocked ? "1" : "0"}" data-admin="${u.is_admin ? "1" : "0"}">
            ${isBlocked ? "فك الحظر" : "حظر"}
          </button>
        </td>
      </tr>
    `;
    })
    .join("");

  $("usersTbody").innerHTML = html;

  $("usersTbody")
    .querySelectorAll("button[data-act]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        vibrate();
        const act = btn.dataset.act;
        const id = btn.dataset.id;
        const blocked = btn.dataset.blocked === "1";
        const isAdmin = btn.dataset.admin === "1";

        if (act === "toggle") {
          // منع حظر الأدمن
          if (isAdmin) {
            setSys("لا يمكن حظر الأدمن ❌");
            return;
          }
          await setBlocked(id, !blocked);
        }
      });
    });
}

async function setBlocked(id, nextBlocked) {
  try {
    setSys("تحديث حالة الحظر...");
    const { error } = await supabase
      .from("app_users")
      .update({
        blocked: nextBlocked,
        last_seen: new Date().toISOString(), // (اختياري) نستخدمه كآخر تعديل
      })
      .eq("id", id);

    if (error) throw error;

    setSys(nextBlocked ? "تم الحظر ✅" : "تم فك الحظر ✅");
    await loadUsers(false);
    await refreshSummary();
  } catch (e) {
    console.error(e);
    setSys(`فشل التحديث: ${e.message || e}`);
  }
}

// =====================
// Summary (خفيف)
// =====================
async function refreshSummary() {
  try {
    const { count: usersCount, error: e1 } = await supabase
      .from("app_users")
      .select("id", { count: "exact", head: true });
    if (e1) throw e1;

    const pillUsers = $("pillUsers");
    if (pillUsers) {
      pillUsers.textContent = `Users: ${usersCount ?? "—"}`;
      pillUsers.classList.add("ok");
    }

    // invoices قد لا تكون جاهزة الآن
    const { count: invCount, error: e2 } = await supabase
      .from("app_invoices")
      .select("id", { count: "exact", head: true });

    const pillInv = $("pillInvoices");
    if (pillInv) {
      pillInv.textContent = `Invoices: ${e2 ? "—" : (invCount ?? "—")}`;
      if (!e2) pillInv.classList.add("ok");
    }
  } catch (e) {
    console.error(e);
    setSys(`ملخص: تعذر الجلب (${e.message || e})`);
  }
}

// =====================
// Disable add user button for now (لأن جدولك يعتمد username/pass)
// =====================
$("btnAddUser")?.addEventListener("click", () => {
  vibrate();
  setSys("الإضافة من الأدمن سيتم تفعيلها لاحقاً (بعد ضبط الأمان وRLS).");
});

// =====================
// Init
// =====================
(async function init() {
  setSys("تشغيل الأدمن...");
  const session = await ensureSession();
  if (!session) return;

  await refreshSummary();
  await loadUsers(true);

  setSys("جاهز ✅");
})();
