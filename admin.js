// =========================
// ✅ Supabase REST config
// =========================
const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";
const SUPABASE_KEY = "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";
const REST = `${SUPABASE_URL}/rest/v1`;

const $ = (id) => document.getElementById(id);

const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${REST}${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(options.headers || {}),
    }
  });
  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error(`API ${res.status}: ${t || res.statusText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const toast = (msg) => {
  const d = document.createElement("div");
  d.textContent = msg;
  Object.assign(d.style, {
    position:"fixed", bottom:"18px", left:"50%",
    transform:"translateX(-50%)",
    background:"rgba(17,19,21,.85)",
    color:"#fff", padding:"10px 14px",
    borderRadius:"14px", fontWeight:"1000",
    zIndex:9999, backdropFilter:"blur(8px)",
    border:"1px solid rgba(255,255,255,.18)"
  });
  document.body.appendChild(d);
  setTimeout(()=>d.remove(), 1600);
};

const formatNumber = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  const s = x.toString();
  return s.includes(".") ? x.toFixed(6).replace(/0+$/,"").replace(/\.$/,"") : s;
};

const fmtDate = (iso) => {
  try{
    const d = new Date(iso);
    return d.toLocaleString("ar", { hour12: true });
  }catch{
    return iso || "";
  }
};

// =========================
// Users Paging + Search
// =========================
let userOffset = 0;
const userLimit = 30;

async function loadUsers(){
  const term = ($("searchUser").value || "").trim();

  const baseSelect = `?select=username,is_admin&is_admin=eq.false&order=username.asc&limit=${userLimit}&offset=${userOffset}`;
  const filtered = term ? `${baseSelect}&username=ilike.*${encodeURIComponent(term)}*` : baseSelect;

  const rows = await apiFetch(`/app_users${filtered}`, { method:"GET" });
  const sel = $("userSelect");
  sel.innerHTML = `<option value="">— اختر المستخدم —</option>`;
  (rows || []).forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.username;
    opt.textContent = r.username;
    sel.appendChild(opt);
  });

  toast(`تم تحميل ${rows?.length || 0} مستخدم`);
}

// =========================
// Invoice loader
// =========================
async function loadInvoice(username){
  if (!username) { toast("اختر المستخدم"); return; }

  // جلب العمليات
  // (الترتيب: الأقدم فوق)
  const q =
    `?select=created_at,label,operation,result,device_id` +
    `&username=eq.${encodeURIComponent(username)}` +
    `&order=created_at.asc` +
    `&limit=5000`;

  const rows = await apiFetch(`/app_operations${q}`, { method:"GET" });

  const body = $("opsBody");
  body.innerHTML = "";

  let sum = 0;
  let first = null, last = null;

  (rows || []).forEach(r => {
    if (!first) first = r.created_at;
    last = r.created_at;

    const tr = document.createElement("tr");

    const tdTime = document.createElement("td");
    tdTime.textContent = fmtDate(r.created_at);

    const tdLabel = document.createElement("td");
    tdLabel.textContent = (r.label && String(r.label).trim()) ? r.label : "عملية";

    const tdOp = document.createElement("td");
    tdOp.className = "num";
    tdOp.textContent = r.operation || "";

    const tdRes = document.createElement("td");
    tdRes.className = "num";
    tdRes.textContent = r.result || "";

    tr.append(tdTime, tdLabel, tdOp, tdRes);
    body.appendChild(tr);

    const v = Number(r.result);
    if (Number.isFinite(v)) sum += v;
  });

  $("sum").textContent = formatNumber(sum);

  $("chipUser").textContent = `العميل: ${username}`;
  $("chipCount").textContent = `عدد العمليات: ${rows?.length || 0}`;
  $("chipFrom").textContent = `من: ${first ? fmtDate(first) : "—"}`;
  $("chipTo").textContent = `إلى: ${last ? fmtDate(last) : "—"}`;

  toast("تم عرض الفاتورة ✅");
}

// =========================
// Delete user operations (space saving)
// =========================
async function deleteInvoiceData(username){
  if (!username) { toast("اختر المستخدم"); return; }

  const confirmTyped = ($("confirmName").value || "").trim();
  if (confirmTyped !== username){
    toast("للحذف: اكتب اسم المستخدم حرفيًا في خانة التأكيد");
    return;
  }

  const ok = confirm(`تأكيد نهائي:\nسيتم حذف كل عمليات "${username}" من app_operations.\nهل أنت متأكد؟`);
  if (!ok) return;

  try{
    await apiFetch(`/app_operations?username=eq.${encodeURIComponent(username)}`, {
      method:"DELETE",
      headers:{ "Prefer":"return=minimal" }
    });
    toast("تم حذف بيانات المستخدم ✅");
    $("confirmName").value = "";
    await loadInvoice(username);
  }catch(e){
    console.error(e);
    toast("فشل الحذف ❌");
  }
}

// =========================
// Events
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  // initial users load
  await loadUsers();

  $("refreshUsers").addEventListener("click", async () => {
    userOffset = 0;
    await loadUsers();
  });

  $("nextUsers").addEventListener("click", async () => {
    userOffset += userLimit;
    await loadUsers();
  });

  $("prevUsers").addEventListener("click", async () => {
    userOffset = Math.max(0, userOffset - userLimit);
    await loadUsers();
  });

  $("searchUser").addEventListener("input", async () => {
    userOffset = 0;
    // debounce بسيط
    if (window.__t) clearTimeout(window.__t);
    window.__t = setTimeout(loadUsers, 350);
  });

  $("viewInvoice").addEventListener("click", async () => {
    const u = $("userSelect").value;
    await loadInvoice(u);
  });

  $("printInvoice").addEventListener("click", () => {
    window.print();
  });

  $("deleteUserOps").addEventListener("click", async () => {
    const u = $("userSelect").value;
    await deleteInvoiceData(u);
  });

  $("userSelect").addEventListener("change", async () => {
    const u = $("userSelect").value;
    if (u) await loadInvoice(u);
  });
});
