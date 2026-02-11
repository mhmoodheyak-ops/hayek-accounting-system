
/* HAYEK SPOT — Comprehensive Admin Logic (No Truncation) */
(function() {
    const sb = supabase.createClient(window.HAYEK_CONFIG.supabaseUrl, window.HAYEK_CONFIG.supabaseKey);
    let allUsersData = [];

    // --- 1. التحقق الصارم من الصلاحيات ---
    async function checkSecurity() {
        const session = window.HAYEK_AUTH.getUser();
        if (!session || session.role !== 'admin') {
            document.getElementById('auth_lock').style.display = 'flex';
            return;
        }
        document.getElementById('auth_lock').style.display = 'none';
        loadDashboard();
    }

    // --- 2. جلب البيانات وتحليلها ---
    window.loadDashboard = async function() {
        const range = document.getElementById('time_range').value;
        const since = getISOString(range);

        // جلب المستخدمين مع فواتيرهم بطلب واحد (Join) لزيادة السرعة
        const { data: users, error } = await sb.from('app_users').select('*').order('created_at', {ascending: false});
        if (error) { console.error("Error fetching users:", error); return; }
        
        allUsersData = users;

        // إحصائيات الفواتير حسب الفترة
        let invQuery = sb.from('app_invoices').select('id', { count: 'exact', head: true });
        if(since) invQuery = invQuery.gte('created_at', since);
        const { count: totalInvoices } = await invQuery;

        // تحديث العدادات في الواجهة
        document.getElementById('count_users').textContent = allUsersData.length;
        document.getElementById('count_invoices').textContent = totalInvoices || 0;
        document.getElementById('count_active').textContent = allUsersData.filter(u => u.last_seen && (new Date() - new Date(u.last_seen) < 86400000)).length;

        renderUsers();
    };

    function getISOString(range) {
        const now = new Date();
        if (range === 'today') return new Date(now.setHours(0,0,0,0)).toISOString();
        if (range === '7d') return new Date(now.setDate(now.getDate() - 7)).toISOString();
        return null;
    }

    // --- 3. بناء الجدول مع كل الأزرار السابقة ---
    window.renderUsers = function() {
        const tbody = document.getElementById('main_tbody');
        const search = document.getElementById('search_input').value.toLowerCase();
        tbody.innerHTML = '';

        allUsersData.filter(u => u.username.toLowerCase().includes(search)).forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b style="color:#1f62ff; cursor:pointer" onclick="viewUserInvoices('${u.username}')">${u.username}</b></td>
                <td><span class="badge">${u.is_admin ? 'أدمن' : 'مستخدم'}</span></td>
                <td><span class="badge ${u.blocked ? 'status-blocked' : 'status-active'}">${u.blocked ? 'محظور' : 'نشط'}</span></td>
                <td><span class="badge" style="background:rgba(255,255,255,0.1)">${u.inv_count || 0}</span></td>
                <td>${u.last_seen ? new Date(u.last_seen).toLocaleString('ar-EG') : '—'}</td>
                <td style="font-size:10px; color:#888">${u.device_id ? u.device_id.substring(0,8) + '...' : 'غير مرتبط'}</td>
                <td>
                    <div style="display:flex; gap:5px">
                        <button class="btn btn-ghost" style="padding:5px 10px" onclick="resetDevice('${u.id}')">مسح جهاز</button>
                        <button class="btn btn-danger" style="padding:5px 10px" onclick="toggleBlock('${u.id}', ${u.blocked})">${u.blocked ? 'فك حظر' : 'حظر'}</button>
                        <button class="btn btn-ghost" style="padding:5px 10px" onclick="deleteUser('${u.id}')">حذف</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    // --- 4. معالجة فواتير المستخدم وتصدير PDF (الاحترافية) ---
    window.viewUserInvoices = async function(username) {
        document.getElementById('modal_username').textContent = `فواتير: ${username}`;
        document.getElementById('invoices_modal').style.display = 'flex';
        const tbody = document.getElementById('invoices_tbody');
        tbody.innerHTML = '<tr><td colspan="4">جاري تحميل الفواتير...</td></tr>';

        const { data: invs } = await sb.from('app_invoices').select('*').eq('username', username).order('created_at', {ascending: false});
        
        tbody.innerHTML = '';
        if(!invs || invs.length === 0) { tbody.innerHTML = '<tr><td colspan="4">لا يوجد فواتير لهذا المستخدم</td></tr>'; return; }

        invs.forEach(inv => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${inv.id.toString().substring(0,6)}</td>
                <td>${new Date(inv.created_at).toLocaleDateString('ar-EG')}</td>
                <td style="font-weight:bold; color:#49e39a">${inv.total}</td>
                <td><button class="btn btn-primary" style="padding:5px 10px" onclick='generateInvoicePDF(${JSON.stringify(inv)})'>PDF 📄</button></td>
            `;
            tbody.appendChild(tr);
        });
    };

    window.generateInvoicePDF = async function(inv) {
        // ملء بيانات القالب المخفي
        document.getElementById('p_user').textContent = inv.username;
        document.getElementById('p_date').textContent = new Date(inv.created_at).toLocaleString('ar-EG');
        document.getElementById('p_id').textContent = inv.id;
        document.getElementById('p_total').textContent = inv.total;

        const pTable = document.getElementById('p_table_body');
        pTable.innerHTML = '';
        
        let rows = [];
        try { rows = typeof inv.rows === 'string' ? JSON.parse(inv.rows) : inv.rows; } catch(e) { rows = []; }

        rows.forEach(r => {
            pTable.innerHTML += `
                <tr>
                    <td style="border:1px solid #000; padding:10px">${r.text || 'عملية'}</td>
                    <td style="border:1px solid #000; padding:10px; text-align:center; direction:ltr">${r.expr || ''}</td>
                    <td style="border:1px solid #000; padding:10px; text-align:center; font-weight:bold">${r.result || ''}</td>
                </tr>
            `;
        });

        // تحويل القالب إلى PDF
        const capture = document.getElementById('pdf_capture');
        const canvas = await html2canvas(capture, { scale: 2 });
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, (canvas.height * 210) / canvas.width);
        pdf.save(`HAYEK_SPOT_${inv.id}.pdf`);
    };

    // --- 5. العمليات الإدارية (مسح جهاز، حظر، حذف) ---
    window.resetDevice = async (id) => {
        if(confirm("هل تريد بالتأكيد فك ارتباط هذا الحساب بالجهاز؟")) {
            await sb.from('app_users').update({device_id: null}).eq('id', id);
            loadDashboard();
        }
    };

    window.toggleBlock = async (id, status) => {
        await sb.from('app_users').update({blocked: !status}).eq('id', id);
        loadDashboard();
    };

    window.deleteUser = async (id) => {
        if(confirm("تحذير: سيتم حذف المستخدم وجميع بياناته نهائياً!")) {
            await sb.from('app_users').delete().eq('id', id);
            loadDashboard();
        }
    };

    window.logoutAdmin = () => { localStorage.clear(); location.href = 'index.html'; };
    window.closeModals = () => { document.querySelectorAll('.overlay').forEach(el => el.style.display = 'none'); };

    checkSecurity();
})();
