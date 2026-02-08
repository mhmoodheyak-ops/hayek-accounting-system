import { SUPABASE_URL, SUPABASE_ANON_KEY, COMPANY_NAME_AR, APP_NAME, WHATSAPP_NUMBER } from "./config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEVICE_ID_KEY = "HAYEK_DEVICE_ID";
let DEVICE_ID = localStorage.getItem(DEVICE_ID_KEY) || crypto.randomUUID();
localStorage.setItem(DEVICE_ID_KEY, DEVICE_ID);

const ADMIN_SESSION_KEY = "HAYEK_ADMIN_SESSION";

/* عناصر الصفحة */
const adminState = document.getElementById("adminState");
const loginStatus = document.getElementById("loginStatus");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const refreshUsersBtn = document.getElementById("refreshUsersBtn");

const usernameEl = document.getElementById("username");
const passwordEl = document.getElementById("password");

const usersTbody = document.getElementById("usersTbody");
const selectedUserLabel = document.getElementById("selectedUserLabel");

const btnToday = document.getElementById("btnToday");
const btnLast7 = document.getElementById("btnLast7");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");
const btnLoadInvoices = document.getElementById("btnLoadInvoices");

const invoiceSelect = document.getElementById("invoiceSelect");
const invoicePreview = document.getElementById("invoicePreview");
const invCount = document.getElementById("invCount");
const btnExportPdf = document.getElementById("btnExportPdf");

let selectedUser = "";
let invoicesCache = [];
let selectedInvoice = null;

/* Helpers */
function isoDateOnly(d) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x.toISOString().slice(0,10);
}
function todayRange() {
  const t = new Date();
  const from = new Date(t); from.setHours(0,0,0,0);
  const to = new Date(t); to.setHours(23,59,59,999);
  return { from, to };
}
function last7Range() {
  const t = new Date();
  const to = new Date(t); to.setHours(23,59,59,999);
  const from = new Date(t); from.setDate(from.getDate() - 6);
  from.setHours(0,0,0,0);
  return { from, to };
}
function setDateInputs(range) {
  fromDate.value = isoDateOnly(range.from);
  toDate.value = isoDateOnly(range.to);
}

/* جلسة الأدمن */
function setSession(user) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(user));
  adminState.textContent = `مفتوح: ${user.username}`;
}
function getSession() {
  try { return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "null"); }
  catch { return null; }
}
function clearSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  adminState.textContent = "غير مسجل";
}

/* تسجيل دخول */
loginBtn.addEventListener("click", async () => {
  const username = usernameEl.value.trim();
  const pass = passwordEl.value.trim();

  loginStatus.textContent = "جاري التحقق...";

  const { data: user, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("username", username)
    .eq("pass", pass)
    .single();

  if (error || !user) {
    loginStatus.textContent = "❌ بيانات غير صحيحة";
    return;
  }

  if (!user.is_admin) {
    loginStatus.textContent = "⛔ هذا الحساب ليس Admin";
    return;
  }

  if (user.blocked) {
    loginStatus.textContent = "⛔ حساب الأدمن محظور";
    return;
  }

  // قفل الجهاز
  if (user.device_id && user.device_id !== DEVICE_ID) {
    loginStatus.textContent = "❌ Admin مستخدم على جهاز آخر";
    return;
  }

  // تثبيت device_id + last_seen
  await supabase
    .from("app_users")
    .update({
      device_id: DEVICE_ID,
      last_seen: new Date().toISOString(),
    })
    .eq("id", user.id);

  setSession({ id: user.id, username: user.username });
  loginStatus.textContent = "✅ تم تسجيل الدخول";

  await loadUsers();
});

/* تسجيل خروج (يفك ربط جهاز الأدمن) */
logoutBtn.addEventListener("click", async () => {
  const s = getSession();
  if (!s) return;

  await supabase
    .from("app_users")
    .update({ device_id: null })
    .eq("id", s.id);

  clearSession();
  location.reload();
});

refreshUsersBtn.addEventListener("click", loadUsers);

/* تحميل المستخدمين + زر اختر */
async function loadUsers() {
  const s = getSession();
  if (!s) {
    loginStatus.textContent = "⚠️ سجّل دخول Admin أولاً";
    return;
  }

  const { data, error } = await supabase
    .from("app_users")
    .select("id,username,is_admin,blocked,device_id,created_at,last_seen")
    .order("id", { ascending: true });

  if (error) {
    console.error(error);
    loginStatus.textContent = "❌ خطأ تحميل المستخدمين";
    return;
  }

  usersTbody.innerHTML = "";

  data.forEach(u => {
    const tr = document.createElement("tr");

    const role = u.is_admin ? "Admin" : "مستخدم";
    const state = u.blocked ? "محظور" : "حر";
    const dev = u.device_id ? String(u.device_id).slice(0,18) + "..." : "—";

    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.username}</td>
      <td>${role}</td>
      <td>${state}</td>
      <td class="muted">${dev}</td>
      <td>
        <button class="btn btn-small btn-dark" data-act="pick" data-id="${u.id}" data-user="${u.username}">اختر</button>
        <button class="btn btn-small btn-blue" data-act="block" data-id="${u.id}" data-block="${u.blocked ? "0" : "1"}">${u.blocked ? "فك حظر" : "حظر"}</button>
        <button class="btn btn-small btn-dark" data-act="reset" data-id="${u.id}">فك ربط الجهاز</button>
        <button class="btn btn-small btn-red" data-act="del" data-id="${u.id}" data-user="${u.username}">حذف</button>
      </td>
    `;

    usersTbody.appendChild(tr);
  });

  usersTbody.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      const id = btn.dataset.id;

      if (act === "pick") {
        selectedUser = btn.dataset.user;
        selectedUserLabel.textContent = selectedUser;
        invoicesCache = [];
        selectedInvoice = null;
        invoiceSelect.innerHTML = `<option value="">— اختر فاتورة —</option>`;
        invoicePreview.innerHTML = `<div class="muted">اخترت المستخدم: <b>${selectedUser}</b> — الآن اختر التاريخ ثم اضغط جلب الفواتير.</div>`;
        btnExportPdf.disabled = true;
        return;
      }

      if (act === "block") {
        const willBlock = btn.dataset.block === "1";
        await supabase.from("app_users").update({ blocked: willBlock }).eq("id", id);
        await loadUsers();
        return;
      }

      if (act === "reset") {
        await supabase.from("app_users").update({ device_id: null }).eq("id", id);
        await loadUsers();
        return;
      }

      if (act === "del") {
        const user = btn.dataset.user;
        // حماية: لا تحذف admin
        if (user === "admin") return;

        await supabase.from("app_users").delete().eq("id", id);
        await loadUsers();
        return;
      }
    });
  });

  // افتراضي: إعداد التاريخ
  setDateInputs(last7Range());
}

/* فلاتر سريعة */
btnToday.addEventListener("click", () => setDateInputs(todayRange()));
btnLast7.addEventListener("click", () => setDateInputs(last7Range()));

/* جلب الفواتير حسب مستخدم + تاريخ */
btnLoadInvoices.addEventListener("click", loadInvoices);

async function loadInvoices() {
  if (!selectedUser) {
    invoicePreview.innerHTML = `<div class="muted">⚠️ أولاً اضغط <b>اختر</b> على المستخدم.</div>`;
    return;
  }

  const f = fromDate.value;
  const t = toDate.value;
  if (!f || !t) {
    invoicePreview.innerHTML = `<div class="muted">⚠️ اختر التاريخ من/إلى.</div>`;
    return;
  }

  const from = new Date(f); from.setHours(0,0,0,0);
  const to = new Date(t); to.setHours(23,59,59,999);

  invoicePreview.innerHTML = `<div class="muted">جاري جلب الفواتير...</div>`;
  btnExportPdf.disabled = true;

  // مهم: أعمدة جدولك كما بالصورة (بدون lines)
  const { data, error } = await supabase
    .from("app_invoices")
    .select("id,username,customer_name,total,created_at,device_id")
    .eq("username", selectedUser)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    invoicePreview.innerHTML = `<div class="muted">❌ خطأ جلب الفواتير (تحقق من الأعمدة/التواريخ).</div>`;
    return;
  }

  invoicesCache = data || [];
  invCount.textContent = String(invoicesCache.length);

  invoiceSelect.innerHTML = `<option value="">— اختر فاتورة —</option>`;

  invoicesCache.forEach((inv, idx) => {
    const dt = new Date(inv.created_at).toLocaleString();
    const label = `${idx+1}) ${inv.customer_name || "بدون اسم"} — ${inv.total} — ${dt}`;
    const opt = document.createElement("option");
    opt.value = inv.id;
    opt.textContent = label;
    invoiceSelect.appendChild(opt);
  });

  invoicePreview.innerHTML = `<div class="muted">✅ تم جلب الفواتير. اختر فاتورة من القائمة المنسدلة.</div>`;
}

/* اختيار فاتورة */
invoiceSelect.addEventListener("change", () => {
  const id = invoiceSelect.value;
  selectedInvoice = invoicesCache.find(x => x.id === id) || null;

  if (!selectedInvoice) {
    btnExportPdf.disabled = true;
    invoicePreview.innerHTML = `<div class="muted">المعاينة ستظهر هنا بعد اختيار فاتورة.</div>`;
    return;
  }

  const inv = selectedInvoice;
  const dt = new Date(inv.created_at).toLocaleString();

  invoicePreview.innerHTML = `
    <div style="font-weight:900;margin-bottom:8px">${COMPANY_NAME_AR} — ${APP_NAME}</div>
    <div class="row" style="gap:8px">
      <span class="pill">المستخدم: <b>${inv.username}</b></span>
      <span class="pill">الزبون: <b>${inv.customer_name || "—"}</b></span>
      <span class="pill">الإجمالي: <b>${inv.total}</b></span>
      <span class="pill">التاريخ: <b>${dt}</b></span>
    </div>
    <div class="muted" style="margin-top:10px">جاهز للتصدير PDF بنفس تصميم المستخدم.</div>
  `;

  btnExportPdf.disabled = false;
});

/* تصدير PDF */
btnExportPdf.addEventListener("click", () => {
  if (!selectedInvoice) return;
  exportInvoicePdf(selectedInvoice);
});

function exportInvoicePdf(inv) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // خط عربي (إذا amiri-font.js يحقن الخط باسم Amiri)
  try {
    if (window.AmiriFont && typeof window.AmiriFont === "string") {
      doc.addFileToVFS("Amiri-Regular.ttf", window.AmiriFont);
      doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
      doc.setFont("Amiri");
    }
  } catch {}

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;

  // Header Box
  doc.setFontSize(14);
  doc.text(`${COMPANY_NAME_AR} — ${APP_NAME}`, pageW - margin, 50, { align: "right" });

  doc.setFontSize(11);
  doc.text(`اسم المستخدم: ${inv.username}`, pageW - margin, 80, { align: "right" });
  doc.text(`اسم الزبون: ${inv.customer_name || "—"}`, pageW - margin, 100, { align: "right" });
  doc.text(`التاريخ: ${new Date(inv.created_at).toLocaleString()}`, pageW - margin, 120, { align: "right" });
  doc.text(`رقم الفاتورة: ${inv.id}`, pageW - margin, 140, { align: "right" });

  // Table (نفس روح التصميم اللي أرسلته)
  const body = [
    ["الإجمالي", String(inv.total)],
  ];

  doc.autoTable({
    startY: 170,
    theme: "grid",
    head: [["البيان", "القيمة"]],
    body,
    styles: { font: doc.getFont().fontName || "helvetica", fontSize: 11, halign: "right" },
    headStyles: { halign: "right" },
    columnStyles: {
      0: { halign: "right" },
      1: { halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  const y = doc.lastAutoTable.finalY + 30;

  doc.setFontSize(10);
  doc.text("إشعار مهم:", pageW - margin, y, { align: "right" });
  doc.text("هذه الفاتورة صادرة من نظام HAYEK SPOT.", pageW - margin, y + 16, { align: "right" });
  doc.text(`للتواصل واتساب: ${WHATSAPP_NUMBER}`, pageW - margin, y + 34, { align: "right" });

  const fileName = `${inv.username}-${(inv.customer_name||"invoice")}.pdf`.replace(/\s+/g,"_");
  doc.save(fileName);
}

/* تشغيل تلقائي لو كان الأدمن مسجّل */
(function boot() {
  const s = getSession();
  if (s) {
    adminState.textContent = `مفتوح: ${s.username}`;
    setDateInputs(last7Range());
    loadUsers();
  } else {
    setDateInputs(last7Range());
  }
})();
