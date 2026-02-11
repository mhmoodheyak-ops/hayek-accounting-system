/* HAYEK SPOT - ADMIN PANEL CORE V4.0
   Logic: Engineering & Logical Connections (Final Fix)
   Status: Stable / No-Conflict Mode
*/

(function () {
    // منع التكرار البرمجي وتجنب أخطاء التعريف
    'use strict';

    const get = (id) => document.getElementById(id);

    // 1. تعريف العناصر (عبر كائن واحد لتجنب التكرار)
    const UI = {
        usersTable: get("usersTbody"),
        addModal: get("addModalBack"),
        invoiceModal: get("invModalBack"),
        statInvoices: get("stInvoices"),
        statUsers: get("stUsers"),
        // الأزرار
        btnOpenAdd: get("addUserBtn"),
        btnRefresh: get("refreshBtn"),
        btnSaveUser: get("saveUserBtn"),
        // الحقول
        search: get("searchUser"),
        newU: get("newUsername"),
        newP: get("newPass"),
        newA: get("newIsAdmin"),
        msg: get("addUserMsg")
    };

    // التحقق من الصلاحيات
    const auth = window.HAYEK_AUTH;
    if (!auth || !auth.isAuthed() || auth.getUser().role !== 'admin') {
        if (get("lock")) get("lock").style.display = "flex";
        return;
    }

    const DB = supabase.createClient(window.HAYEK_CONFIG.supabaseUrl, window.HAYEK_CONFIG.supabaseKey);
    const TABLES = window.HAYEK_CONFIG.tables;

    let localStore = { allUsers: [], invoiceCounts: new Map(), currentInvoices: [] };

    // --- 2. المنطق الهندسي (Logic) ---

    // جلب البيانات الأساسية
    async function syncSystem() {
        if (UI.btnRefresh) UI.btnRefresh.textContent = "جاري المزامنة...";
        
        // جلب المستخدمين وفواتيرهم في وقت واحد
        const [uRes, iRes] = await Promise.all([
            DB.from(TABLES.users).select("*").order("created_at", { ascending: false }),
            DB.from(TABLES.invoices).select("username")
        ]);

        localStore.allUsers = uRes.data || [];
        localStore.invoiceCounts.clear();
        (iRes.data || []).forEach(i => {
            const u = String(i.username);
            localStore.invoiceCounts.set(u, (localStore.invoiceCounts.get(u) || 0) + 1);
        });

        if (UI.statInvoices) UI.statInvoices.textContent = (iRes.data || []).length;
        if (UI.statUsers) UI.statUsers.textContent = localStore.allUsers.length;

        renderMainTable();
        if (UI.btnRefresh) UI.btnRefresh.textContent = "تحديث البيانات";
    }

    // --- 3. الألوان والواجهة (UI & Colors) ---
    function renderMainTable() {
        if (!UI.usersTable) return;
        const term = (UI.search?.value || "").toLowerCase();
        
        UI.usersTable.innerHTML = localStore.allUsers
            .filter(u => u.username.toLowerCase().includes(term))
            .map(u => {
                const count = localStore.invoiceCounts.get(String(u.username)) || 0;
                // تحديد الألوان بناءً على المنطق المطلوب
                const statusColor = u.blocked ? '#ff4d4d' : '#49e39a'; // أحمر للمحظور، أخضر للنشط
                const roleBadge = u.is_admin ? '<span class="badge" style="background:#3b82f6">أدمن</span>' : '<span class="badge">مستخدم</span>';
                
                return `
                <tr>
                    <td><b style="color:#9fd0ff">${u.username}</b></td>
                    <td>${roleBadge}</td>
                    <td><span class="badge" style="background:${statusColor}">${u.blocked ? 'محظور' : 'نشط'}</span></td>
                    <td><span class="badge amber">${count}</span></td>
                    <td>${u.last_seen ? 'منذ قليل' : '—'}</td>
                    <td style="font-size:9px; color:#555">${u.device_id || '—'}</td>
                    <td>
                        <div class="actions">
                            <button class="mini ghost" onclick="HAYEK_ADMIN.viewInvoices('${u.username}')">الفواتير</button>
                            <button class="mini" style="background:${u.blocked ? '#49e39a' : '#ff4d4d'}; color:white;" 
                                    onclick="HAYEK_ADMIN.toggleBlock('${u.id}', ${u.blocked})">${u.blocked ? 'فك حظر' : 'حظر'}</button>
                            <button class="mini ghost" onclick="HAYEK_ADMIN.resetID('${u.id}')">الجهاز</button>
                            <button class="mini red" onclick="HAYEK_ADMIN.delUser('${u.id}')">حذف</button>
                        </div>
                    </td>
                </tr>`;
            }).join("");
    }

    // --- 4. إدارة الفواتير والـ PDF (الإصلاح الجذري) ---
    window.HAYEK_ADMIN = {
        viewInvoices: async (username) => {
            get("invModalTitle").textContent = `فواتير: ${username}`;
            UI.invoiceModal.style.display = "flex";
            const { data } = await DB.from(TABLES.invoices).select("*").eq("username", username).order("created_at", { ascending: false });
            localStore.currentInvoices = data || [];
            
            get("invTbody").innerHTML = localStore.currentInvoices.map(inv => `
                <tr>
                    <td>${new Date(inv.created_at).toLocaleDateString('ar-EG')}</td>
                    <td>${inv.customer_name || "زبون"}</td>
                    <td style="color:#49e39a; font-weight:bold">${inv.total}</td>
                    <td>${inv.invoice_no ? inv.invoice_no.substring(0,8) : '—'}</td>
                    <td><button class="mini blue" onclick="HAYEK_ADMIN.printPDF('${inv.id}')">PDF</button></td>
                </tr>
            `).join("");
        },

        printPDF: async (invId) => {
            const inv = localStore.currentInvoices.find(i => i.id === invId);
            // جلب العمليات (Logic Connection)
            const { data: ops } = await DB.from(TABLES.operations).select("*").eq("invoice_id", inv.id);
            
            const win = window.open('', '_blank');
            win.document.write(`
                <div style="direction:rtl; font-family:Arial; padding:20px; border:2px solid #0a7c3a;">
                    <h2 style="text-align:center">شركة الحايك - HAYEK SPOT</h2>
                    <p><b>رقم الفاتورة:</b> ${inv.invoice_no || inv.id.substring(0,8)}</p>
                    <p><b>التاريخ:</b> ${new Date(inv.created_at).toLocaleString()}</p>
                    <p><b>المستخدم:</b> ${inv.username} | <b>الزبون:</b> ${inv.customer_name || 'غير محدد'}</p>
                    <table border="1" style="width:100%; border-collapse:collapse; margin:20px 0;">
                        <tr style="background:#eee"><th>البيان</th><th>العملية</th><th>النتيجة</th></tr>
                        ${ops && ops.length > 0 ? ops.map(o => `<tr><td>${o.note || '—'}</td><td>${o.expression}</td><td>${o.result}</td></tr>`).join("") : '<tr><td colspan="3">لا توجد تفاصيل محفظة</td></tr>'}
                    </table>
                    <h3 style="text-align:left">إجمالي الفاتورة النهائي: ${inv.total}</h3>
                </div>
            `);
            win.print();
        },

        // وظائف الحظر والحذف
        toggleBlock: async (id, state) => {
            if(confirm("تغيير حالة الحظر؟")) {
                await DB.from(TABLES.users).update({ blocked: !state }).eq("id", id);
                syncSystem();
            }
        },
        resetID: async (id) => {
            if(confirm("مسح معرّف الجهاز؟")) {
                await DB.from(TABLES.users).update({ device_id: null }).eq("id", id);
                syncSystem();
            }
        },
        delUser: async (id) => {
            if(confirm("حذف نهائي؟")) {
                await DB.from(TABLES.users).delete().eq("id", id);
                syncSystem();
            }
        }
    };

    // --- 5. ربط الأحداث (Events) ---
    if (UI.btnOpenAdd) UI.btnOpenAdd.onclick = () => { UI.addModal.style.display = "flex"; UI.msg.textContent=""; };
    get("closeAddModal").onclick = () => UI.addModal.style.display = "none";
    get("closeInvModal").onclick = () => UI.invoiceModal.style.display = "none";

    UI.btnSaveUser.onclick = async () => {
        const u = UI.newU.value.trim(), p = UI.newP.value.trim(), a = UI.newA.checked;
        if (!u || !p) { UI.msg.textContent = "أدخل البيانات"; return; }
        
        const { error } = await DB.from(TABLES.users).insert({ username: u, pass: p, is_admin: a });
        if (error) UI.msg.textContent = "الاسم موجود مسبقاً";
        else {
            UI.msg.style.color = "#49e39a"; UI.msg.textContent = "تمت الإضافة!";
            setTimeout(() => { UI.addModal.style.display = "none"; syncSystem(); }, 1000);
        }
    };

    if (UI.btnRefresh) UI.btnRefresh.onclick = syncSystem;
    if (UI.search) UI.search.oninput = renderMainTable;

    // البدء
    syncSystem();

})();
