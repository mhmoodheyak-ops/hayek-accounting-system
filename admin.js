/***********************
 * HAYEK ADMIN PANEL
 * Clean & Stable Version
 * Step 2 – Core Logic
 ***********************/

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* ========= CONFIG ========= */
const SUPABASE_URL = window.HAYEK_CONFIG.supabaseUrl;
const SUPABASE_KEY = window.HAYEK_CONFIG.supabaseKey;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ========= HELPERS ========= */
const $ = (id) => document.getElementById(id);
const show = (el) => el && (el.style.display = "block");
const hide = (el) => el && (el.style.display = "none");

/* ========= STATE ========= */
let USERS = [];
let CURRENT_USER = null;

/* ========= INIT ========= */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Admin panel init…");

  await loadUsers();
  renderUsersTable();
});

/* ========= LOAD USERS ========= */
async function loadUsers() {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, blocked, is_admin, created_at, last_seen");

  if (error) {
    alert("خطأ تحميل المستخدمين");
    console.error(error);
    return;
  }

  USERS = data || [];
}

/* ========= RENDER USERS ========= */
function renderUsersTable() {
  const tbody = document.querySelector("#users-table tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  USERS.forEach((u) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${u.username}</td>
      <td>${u.blocked ? "محظور" : "نشط"}</td>
      <td>${u.last_seen ? timeAgo(u.last_seen) : "-"}</td>
      <td>
        <button class="btn" onclick="openInvoices('${u.username}')">الفواتير</button>
        <button class="btn" onclick="toggleBlock(${u.id}, ${u.blocked})">
          ${u.blocked ? "فك الحظر" : "حظر"}
        </button>
        <button class="btn danger" onclick="deleteUser(${u.id})">حذف</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/* ========= ACTIONS ========= */
window.openInvoices = async (username) => {
  alert("فتح فواتير المستخدم: " + username);
};

window.toggleBlock = async (id, blocked) => {
  const { error } = await supabase
    .from("app_users")
    .update({ blocked: !blocked })
    .eq("id", id);

  if (error) {
    alert("فشل تغيير الحالة");
    return;
  }

  await loadUsers();
  renderUsersTable();
};

window.deleteUser = async (id) => {
  if (!confirm("هل أنت متأكد من الحذف؟")) return;

  const { error } = await supabase
    .from("app_users")
    .delete()
    .eq("id", id);

  if (error) {
    alert("فشل الحذف");
    return;
  }

  await loadUsers();
  renderUsersTable();
};

/* ========= UTILS ========= */
function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 60000);
  if (diff < 1) return "الآن";
  if (diff < 60) return `منذ ${diff} دقيقة`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${Math.floor(h / 24)} يوم`;
}
