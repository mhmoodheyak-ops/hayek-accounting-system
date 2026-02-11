/* HAYEK SPOT — Admin Professional Logic */
(function() {
    const $ = (id) => document.getElementById(id);
    const sb = supabase.createClient(window.HAYEK_CONFIG.supabaseUrl, window.HAYEK_CONFIG.supabaseKey);
    
    let allUsers = [];
    let currentInvoices = [];
    let selectedUser = null;

    // --- 1. حماية الدخول ---
    function checkAccess() {
        const user = window.HAYEK_AUTH?.getUser();
        if (!user || user.role !== 'admin') {
            $('lock').style.display = 'flex';
        } else {
            $('lock').style.display = 'none';
            $('adminName').textContent = `الأدمن: ${user.username}`;
            init();
        }
    }

    // --- 2. جلب البيانات الرئيسية ---
    async function init() {
        await refreshAll();
        
        $('refreshBtn').onclick = refreshAll;
        $('rangeSelect').onchange = refreshAll;
        $('userSearch').oninput = renderUsers;
        $('logoutBtn').onclick = () => { window.HAYEK_AUTH.logout(); location.reload(); };
    }

    async function refreshAll() {
        $('refreshBtn').disabled = true;
        const range = $('rangeSelect').value;
        const sinceISO = getSinceDate(range);

        // جلب المستخدمين
        const { data: users, error: uErr } = await sb.from('app_users').select('*').order('id', {ascending: true});
        allUsers = users || [];

        // جلب عدد الفواتير حسب الفترة
        let invQuery = sb.from('app_invoices').select('id', { count: 'exact', head: true });
        if(sinceISO) invQuery = invQuery.gte('created_at', sinceISO);
        const { count: invCount } = await invQuery;

        $('stUsers').textContent = allUsers.length;
        $('stInvoices').textContent = invCount || 0;
        $('stActive').textContent = allUsers.filter(u => u.last_seen && (new Date() - new Date(u.last_seen) < 300000)).length;

        renderUsers();
        $('refreshBtn').disabled = false;
    }

    function getSinceDate(range) {
        if (range === 'today') return new Date(new Date().setHours(0,0,0,0)).toISOString();
        if (range === '7d') return new Date(Date.now() - 7 * 864e5).toISOString();
        return null;
    }

    // --- 3. عرض جدول المستخدمين وإجراءاته (الميزات القديمة كاملة) ---
    function renderUsers() {
        const tbody = $('usersTbody');
        const term = $('userSearch').value.toLowerCase();
        tbody.innerHTML = '';

        allUsers.filter(u => u.username.toLowerCase().includes(term)).forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b style="color:var(--blue); cursor:pointer" onclick="viewInvoices('${u.username}')">${u.username}</b></td>
                <td><span class="badge">${u.is_admin ? 'أدمن' : 'مستخدم'}</span></td>
                <td><span class="badge ${u.blocked ? 'bg-red' : 'bg-green'}">${u.blocked ? 'محظور' : 'نشط'}</span></td>
                <td><span class="badge" style="background:#333">${u.inv_count || 0}</span></td>
                <td style="font-size:12px; color:#888">${u.last_seen ? new Date(u.last_seen).toLocaleString('ar-EG') : '—'}</td>
                <td>
                    <button class="btn btn-ghost" onclick="resetDevice('${u.id}')" style="padding:5px 10px; font-size:11px">مسح جهاز</button>
                    <button class="btn ${u.blocked ? 'btn-blue' : 'btn-red'}" onclick="toggleBlock('${u.id}', ${u.blocked})" style="padding:5px 10px; font-size:11px">${u.blocked ? 'فك حظر' : 'حظر'}</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- 4. إدارة الفواتير والـ PDF ---
    window.viewInvoices = async function(username) {
        selectedUser = username;
        $('invTitle').textContent = `فواتير: ${username}`;
        $('invModal').style.display = 'flex';
        $('invTbody').innerHTML = '<tr><td colspan="5">جاري التحميل...</td></tr>';

        const { data: invs } = await sb.from('app_invoices').select('*').eq('username', username).order('created_at', {ascending: false});
        currentInvoices = invs || [];
        
        const tbody = $('invTbody');
        tbody.innerHTML = '';
        currentInvoices.forEach(inv => {
            tbody.innerHTML += `
                <tr>
                    <td>#${inv.id}</td>
                    <td>${new Date(inv.created_at).toLocaleDateString('ar-EG')}</td>
                    <td>${inv.customer_name || 'زبون عام'}</td>
                    <td style="font-weight:bold; color:var(--green)">${inv.total}</td>
                    <td><button class="btn btn-blue" style="padding:5px" onclick='downloadPDF(${JSON.stringify(inv)})'>PDF 📄</button></td>
                </tr>`;
        });
    }

    window.downloadPDF = async function(inv) {
        // تعبئة البيانات في قالب الـ PDF
        $('pdf_cust').textContent = inv.customer_name || 'زبون عام';
        $('pdf_date').textContent = new Date(inv.created_at).toLocaleDateString('ar-EG');
        $('pdf_code').textContent = inv.id;
        $('pdf_total').textContent = inv.total;

        const rowsArea = $('pdf_rows');
        rowsArea.innerHTML = '';
        let items = inv.rows || [];
        if(typeof items === 'string') try { items = JSON.parse(items); } catch(e) { items = []; }

        items.forEach(it => {
            rowsArea.innerHTML += `
                <tr>
                    <td style="border:1px solid #000; padding:8px">${it.text || 'عملية'}</td>
                    <td style="border:1px solid #000; padding:8px; direction:ltr; text-align:center">${it.expr || ''}</td>
                    <td style="border:1px solid #000; padding:8px; text-align:center; font-weight:bold">${it.result || ''}</td>
                </tr>`;
        });

        // تحويل القالب لصورة ثم PDF
        const element = $('pdfTemplate');
        const canvas = await html2canvas(element, { scale: 2 });
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, (canvas.height * 210) / canvas.width);
        pdf.save(`HAYEK_REPORT_${inv.id}.pdf`);
    }

    // --- 5. وظائف التحكم (القديمة) ---
    window.resetDevice = async (id) => { if(confirm("مسح ربط الجهاز؟")) { await sb.from('app_users').update({device_id: null}).eq('id', id); refreshAll(); } };
    window.toggleBlock = async (id, current) => { await sb.from('app_users').update({blocked: !current}).eq('id', id); refreshAll(); };
    window.closeInvModal = () => $('invModal').style.display = 'none';

    checkAccess();
})();
