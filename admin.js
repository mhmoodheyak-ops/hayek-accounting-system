/* HAYEK SPOT — Full Admin Logic */
const SB_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";
const SB_KEY = "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";
const sb = supabase.createClient(SB_URL, SB_KEY);

const sess = JSON.parse(localStorage.getItem("HAYEK_SESSION") || "{}");
let currentViewingUser = "";

// 1. حماية الصفحة
if (sess.role === "admin") {
    document.getElementById("lock").style.display = "none";
    document.getElementById("adminInfo").textContent = `الأدمن: ${sess.username} (متصل)`;
}

// 2. تحديث البيانات بالكامل
async function refreshData() {
    const { data: users } = await sb.from('app_users').select('*').order('created_at', {ascending:false});
    const { count: invCount } = await sb.from('app_invoices').select('*', { count: 'exact', head: true });
    
    document.getElementById("stUsers").textContent = users.length;
    document.getElementById("stInvoices").textContent = invCount || 0;
    document.getElementById("stActive").textContent = users.filter(u => u.last_seen).length;

    renderUsersTable(users);
}

// 3. عرض جدول المستخدمين بكل الأزرار
function renderUsersTable(users) {
    const tbody = document.getElementById("usersTbody");
    tbody.innerHTML = "";

    users.forEach(u => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><span class="user-link" onclick="openUserInvoices('${u.username}')">${u.username}</span></td>
            <td><span class="badge ${u.blocked ? 'red' : 'green'}">${u.blocked ? 'محظور' : 'نشط'}</span></td>
            <td>${u.is_admin ? 'أدمن' : 'مستخدم'}</td>
            <td>${u.last_seen ? new Date(u.last_seen).toLocaleTimeString('ar-EG') : '—'}</td>
            <td style="font-size:10px; max-width:100px; overflow:hidden">${u.device_id || '—'}</td>
            <td>
                <div style="display:flex; gap:5px">
                    <button class="btn" style="padding:5px 8px" onclick="resetDevice('${u.username}')">مسح جهاز</button>
                    <button class="btn danger" style="padding:5px 8px" onclick="toggleBlock('${u.username}', ${u.blocked})">${u.blocked ? 'فك حظر' : 'حظر'}</button>
                    <button class="btn" style="padding:5px 8px; background:var(--amber); color:#000" onclick="toggleAdmin('${u.username}', ${u.is_admin})">ترقية/تنزيل</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 4. عرض فواتير مستخدم معين
async function openUserInvoices(username) {
    currentViewingUser = username;
    document.getElementById("invModal").style.display = "flex";
    document.getElementById("invModalTitle").textContent = `فواتير: ${username}`;
    
    const { data: invs } = await sb.from('app_invoices').select('*').eq('username', username).order('created_at', {ascending:false});
    const tbody = document.getElementById("invTbody");
    tbody.innerHTML = invs.length ? "" : "<tr><td colspan='4'>لا يوجد فواتير</td></tr>";

    invs.forEach(i => {
        tbody.innerHTML += `
            <tr>
                <td>#${i.id}</td>
                <td>${new Date(i.created_at).toLocaleDateString()}</td>
                <td style="color:var(--green)">${i.total}</td>
                <td>مغلقة</td>
            </tr>`;
    });
}

// 5. تصدير PDF لكشف فواتير المستخدم
document.getElementById("exportFullPdf").onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Customer Activity Report: ${currentViewingUser}`, 14, 15);
    doc.autoTable({ 
        html: '#pdfTable', 
        startY: 25,
        theme: 'grid',
        headStyles: { fillColor: [31, 98, 255] }
    });
    doc.save(`Report_${currentViewingUser}.pdf`);
};

// --- وظائف الأزرار الكاملة ---
async function resetDevice(user) {
    if(!confirm("مسح ربط الجهاز لهذا المستخدم؟")) return;
    await sb.from('app_users').update({ device_id: null }).eq('username', user);
    alert("تم مسح الجهاز"); refreshData();
}

async function toggleBlock(user, currentStatus) {
    await sb.from('app_users').update({ blocked: !currentStatus }).eq('username', user);
    refreshData();
}

async function toggleAdmin(user, currentAdmin) {
    await sb.from('app_users').update({ is_admin: !currentAdmin }).eq('username', user);
    refreshData();
}

function closeModal(id) { document.getElementById(id).style.display = "none"; }
function logout() { localStorage.clear(); location.href = "index.html"; }

// تشغيل عند البداية
refreshData();
