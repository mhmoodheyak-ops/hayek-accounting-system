<script type="module">
/* ================== CONFIG ================== */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://itidwqyrjydmegjzuvn.supabase.co";
const SUPABASE_KEY = "sb_publishable_j4uBD1htJvuMvOWUKC9w7g_mwVQzHb_";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEVICE_ID_KEY = "HAYEK_DEVICE_ID";
let DEVICE_ID =
  localStorage.getItem(DEVICE_ID_KEY) ||
  crypto.randomUUID();

localStorage.setItem(DEVICE_ID_KEY, DEVICE_ID);

/* ================== ELEMENTS ================== */
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const usernameInput = document.getElementById("username");
const passInput = document.getElementById("password");

const statusBox = document.getElementById("loginStatus");
const usersTable = document.getElementById("usersTable");
const invoicesTable = document.getElementById("invoicesTable");

/* ================== LOGIN ================== */
loginBtn.onclick = async () => {
  const username = usernameInput.value.trim();
  const pass = passInput.value.trim();

  statusBox.textContent = "جاري التحقق...";

  const { data: user, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("username", username)
    .eq("pass", pass)
    .single();

  if (error || !user) {
    statusBox.textContent = "❌ بيانات غير صحيحة";
    return;
  }

  if (user.blocked) {
    statusBox.textContent = "⛔ المستخدم محظور";
    return;
  }

  if (user.device_id && user.device_id !== DEVICE_ID) {
    statusBox.textContent = "❌ الحساب مستخدم على جهاز آخر";
    return;
  }

  await supabase
    .from("app_users")
    .update({
      device_id: DEVICE_ID,
      last_seen: new Date().toISOString()
    })
    .eq("id", user.id);

  localStorage.setItem("ADMIN_USER", username);
  statusBox.textContent = "✅ تم تسجيل الدخول";

  loadUsers();
  loadInvoices();
};

/* ================== LOGOUT ================== */
logoutBtn.onclick = async () => {
  const username = localStorage.getItem("ADMIN_USER");
  if (!username) return;

  await supabase
    .from("app_users")
    .update({ device_id: null })
    .eq("username", username);

  localStorage.removeItem("ADMIN_USER");
  location.reload();
};

/* ================== LOAD USERS ================== */
async function loadUsers() {
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .order("id", { ascending: true });

  if (error) return;

  usersTable.innerHTML = "";

  data.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.username}</td>
      <td>${u.is_admin ? "Admin" : "User"}</td>
      <td>${u.blocked ? "محظور" : "نشط"}</td>
      <td>
        <button onclick="blockUser(${u.id}, ${!u.blocked})">
          ${u.blocked ? "فك حظر" : "حظر"}
        </button>
        <button onclick="resetDevice(${u.id})">فك ربط الجهاز</button>
      </td>
    `;
    usersTable.appendChild(tr);
  });
}

/* ================== LOAD INVOICES ================== */
async function loadInvoices() {
  const { data, error } = await supabase
    .from("app_invoices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  invoicesTable.innerHTML = "";

  data.forEach(inv => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${inv.username}</td>
      <td>${inv.customer_name || "-"}</td>
      <td>${inv.total}</td>
      <td>${new Date(inv.created_at).toLocaleString()}</td>
    `;
    invoicesTable.appendChild(tr);
  });
}

/* ================== ACTIONS ================== */
window.blockUser = async (id, block) => {
  await supabase
    .from("app_users")
    .update({ blocked: block })
    .eq("id", id);
  loadUsers();
};

window.resetDevice = async (id) => {
  await supabase
    .from("app_users")
    .update({ device_id: null })
    .eq("id", id);
  loadUsers();
};

/* ================== AUTO LOGIN ================== */
if (localStorage.getItem("ADMIN_USER")) {
  loadUsers();
  loadInvoices();
}
</script>
