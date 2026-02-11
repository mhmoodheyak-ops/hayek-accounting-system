/* HAYEK SPOT — ADMINISTRATIVE CONTROL PANEL (CORE V3.5)
   Logic Strategy: Comprehensive logic with zero-conflict declarations.
   Engineering: Input -> DB Sync -> UI Rendering -> PDF Export.
   Separation: Logic is strictly separated from store files as requested.
*/

(function () {
    // دالة المساعدة الأساسية لجلب العناصر
    const getEl = (id) => document.getElementById(id);

    // --- 1. تعريف المتغيرات (مرة واحدة فقط لتجنب خطأ الـ Redeclaration) ---
    const UI = {
        lockScreen: getEl("lock"),
        loginRedirect: getEl("goLogin"),
        adminLabel: getEl("adminInfo"),
        logoutBtn: getEl("logoutBtn"),
        refreshBtn: getEl("refreshBtn"),
        timeRange: getEl("range"),
        searchBox: getEl("searchUser"),
        
        // عدادات الإحصائيات
        countInvoices: getEl("stInvoices"),
        countUsers: getEl("stUsers"),
        countActive: getEl("stActive"),
        
        // الجدول الرئيسي
        mainTableBody: getEl("usersTbody"),

        // نافذة إضافة مستخدم
        modalAdd: getEl("addModalBack"),
        btnOpenAdd: getEl("addUserBtn"),
        btnCloseAdd: getEl("closeAddModal"),
        inputUser: getEl("newUsername"),
        inputPass: getEl("newPass"),
        checkAdmin: getEl("newIsAdmin"),
        btnSaveUser: getEl("saveUserBtn"),
        msgAdd: getEl("addUserMsg"),

        // نافذة الفواتير
        modalInv: getEl("invModalBack"),
        btnCloseInv: getEl("closeInvModal"),
        invTitle: getEl("invModalTitle"),
        invTableBody: getEl("invTbody")
    };

    // --- 2. التحقق من صلاحيات الأدمن (Security Layer) ---
    const authStatus = window.HAYEK_AUTH ? window.HAYEK_AUTH.isAuthed() : false;
    const userProfile = window.HAYEK_AUTH ? window.HAYEK_AUTH.getUser() : null;

    if (!authStatus || !userProfile || userProfile.role !== "admin") {
        if (UI.lockScreen) UI.lockScreen.style.display = "flex";
        if (UI.loginRedirect) {
            UI.loginRedirect.onclick = function() {
                location.href = "index.html";
            };
        }
        return; 
    }

    if (UI.lockScreen) UI.lockScreen.style.display = "none";
    if (UI.adminLabel) UI.adminLabel.textContent = `أدمن: ${userProfile.username} — متصل`;

    // --- 3. إعدادات قاعدة البيانات (Supabase) ---
    const config = window.HAYEK_CONFIG;
    if (!config) {
        console.error("Critical: config.js missing!");
        return;
    }
    const supabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseKey);

    // مخزن البيانات المؤقت
    let localData = {
        users: [],
        invoiceCounts: new Map(),
        currentInvoices: []
    };

    // --- 4. المنطق الهندسي (Logic Functions) ---

    // جلب عدد الفواتير لكل مستخدم وتحديث العداد الرئيسي
    async function updateInvoiceStats() {
        try {
            const { data, error } = await supabaseClient
                .from(config.tables.invoices)
                .select("username");

            if (error) throw error;

            localData.invoiceCounts.clear();
            data.forEach(inv => {
                const u = String(inv.username);
                localData.invoiceCounts.set(u, (localData.invoiceCounts.get(u) || 0) + 1);
            });

            if (UI.countInvoices) UI.countInvoices.textContent = data.length;
        } catch (err) {
            console.error("Stats Error:", err);
        }
    }

    // جلب قائمة المستخدمين
    async function loadUsersData() {
        try {
            const { data, error } = await supabaseClient
                .from(config.tables.users)
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            localData.users = data || [];
            if (UI.countUsers) UI.countUsers.textContent = localData.users.length;
        } catch (err) {
            console.error("Users Load Error:", err);
        }
    }

    // --- 5. رسم الواجهة (UI Rendering) ---

    function buildUsersTable() {
        if (!UI.mainTableBody) return;

        const filter = (UI.searchBox?.value || "").toLowerCase();
        const filtered = localData.users.filter(u => u.username.toLowerCase().includes(filter));

        let htmlContent = "";
        filtered.forEach(user => {
            const invCount = localData.invoiceCounts.get(String(user.username)) || 0;
            
            // تطبيق الألوان برمجياً بناءً على الحالة
            const statusBadge = user.blocked 
                ? `<span class="badge red">محظور</span>` 
                : `<span class="badge green">نشط</span>`;
            
            const roleBadge = user.is_admin 
                ? `<span class="badge blue">أدمن</span>` 
                : `<span class="badge">مستخدم</span>`;

            const blockBtnClass = user.blocked ? "green" : "red";
            const blockBtnText = user.blocked ? "فك حظر" : "حظر";

            htmlContent += `
                <tr>
                    <td><b style="color:#9fd0ff">${user.username}</b></td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td><span class="badge amber">${invCount}</span></td>
                    <td>${user.last_seen ? "منذ قليل" : "—"}</td>
                    <td style="font-size:10px; color:#555; max-width:120px; overflow:hidden;">${user.device_id || "—"}</td>
                    <td>
                        <div class="actions">
                            <button class="mini ghost" data-action="view" data-uname="${user.username}">الفواتير</button>
                            <button class="mini ${blockBtnClass}" data-action="block" data-id="${user.id}" data-state="${user.blocked}">${blockBtnText}</button>
                            <button class="mini ghost" data-action="reset" data-id="${user.id}">مسح الجهاز</button>
                            <button class="mini red" data-action="delete" data-id="${user.id}">حذف</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        UI.mainTableBody.innerHTML = htmlContent || '<tr><td colspan="7">لا يوجد مستخدمين</td></tr>';
    }

    // --- 6. معالجة الأحداث (Event Handlers) ---

    // إضافة مستخدم جديد (فتح وإغلاق النافذة)
    if (UI.btnOpenAdd) {
        UI.btnOpenAdd.onclick = () => {
            UI.modalAdd.style.display = "flex";
            if (UI.msgAdd) UI.msgAdd.textContent = "";
        };
    }

    if (UI.btnCloseAdd) {
        UI.btnCloseAdd.onclick = () => UI.modalAdd.style.display = "none";
    }

    if (UI.btnSaveUser) {
        UI.btnSaveUser.onclick = async function() {
            const u = UI.inputUser.value.trim();
            const p = UI.inputPass.value.trim();
            const isAdmin = UI.checkAdmin.checked;

            if (!u || !p) {
                UI.msgAdd.textContent = "يرجى ملء البيانات";
                UI.msgAdd.style.color = "orange";
                return;
            }

            UI.btnSaveUser.disabled = true;
            const { error } = await supabaseClient.from(config.tables.users).insert({
                username: u, pass: p, is_admin: isAdmin, blocked: false
            });

            if (error) {
                UI.msgAdd.textContent = "خطأ: الاسم موجود مسبقاً";
                UI.msgAdd.style.color = "red";
            } else {
                UI.msgAdd.textContent = "تمت الإضافة بنجاح!";
                UI.msgAdd.style.color = "#49e39a";
                setTimeout(() => {
                    UI.modalAdd.style.display = "none";
                    UI.inputUser.value = ""; UI.inputPass.value = "";
                    fullRefresh();
                }, 1000);
            }
            UI.btnSaveUser.disabled = false;
        };
    }

    // إدارة العمليات داخل الجدول (حظر، حذف، فواتير)
    if (UI.mainTableBody) {
        UI.mainTableBody.onclick = async (e) => {
            const btn = e.target.closest("button");
            if (!btn) return;

            const action = btn.dataset.action;
            const targetId = btn.dataset.id;
            const targetUname = btn.dataset.uname;

            if (action === "block") {
                const isBlocked = btn.dataset.state === "true";
                if (confirm(`هل تريد ${isBlocked ? 'فك حظر' : 'حظر'} هذا المستخدم؟`)) {
                    await supabaseClient.from(config.tables.users).update({ blocked: !isBlocked }).eq("id", targetId);
                    fullRefresh();
                }
            } else if (action === "delete") {
                if (confirm("سيتم حذف المستخدم نهائياً، هل أنت متأكد؟")) {
                    await supabaseClient.from(config.tables.users).delete().eq("id", targetId);
                    fullRefresh();
                }
            } else if (action === "reset") {
                if (confirm("مسح معرّف الجهاز؟")) {
                    await supabaseClient.from(config.tables.users).update({ device_id: null }).eq("id", targetId);
                    fullRefresh();
                }
            } else if (action === "view") {
                openInvoiceManager(targetUname);
            }
        };
    }

    // --- 7. إدارة الفواتير والـ PDF ---

    async function openInvoiceManager(username) {
        if (UI.invTitle) UI.invTitle.textContent = `سجل فواتير: ${username}`;
        if (UI.modalInv) UI.modalInv.style.display = "flex";
        
        UI.invTableBody.innerHTML = '<tr><td colspan="5">جاري التحميل...</td></tr>';
        
        const { data, error } = await supabaseClient
            .from(config.tables.invoices)
            .select("*")
            .eq("username", username)
            .order("created_at", { ascending: false });

        localData.currentInvoices = data || [];
        renderInvoicesSubTable();
    }

    function renderInvoicesSubTable() {
        if (!UI.invTableBody) return;
        UI.invTableBody.innerHTML = localData.currentInvoices.map(inv => `
            <tr>
                <td>${new Date(inv.created_at).toLocaleDateString('ar-EG')}</td>
                <td>${inv.customer_name || "زبون عام"}</td>
                <td><b style="color:#49e39a">${inv.total}</b></td>
                <td>${inv.invoice_no || "undefined"}</td>
                <td>
                    <button class="mini blue" onclick="window.printSpecificPDF('${inv.id}')">PDF</button>
                </td>
            </tr>
        `).join("");
    }

    // دالة الطباعة (PDF)
    window.printSpecificPDF = async function(invId) {
        const inv = localData.currentInvoices.find(i => i.id === invId);
        if (!inv) return;

        // جلب العمليات التفصيلية من جدول الحاسبة
        const { data: ops } = await supabaseClient
            .from(config.tables.operations)
            .select("*")
            .eq("invoice_id", inv.id);

        const printWin = window.open('', '_blank');
        const content = `
            <div style="direction:rtl; font-family:sans-serif; padding:20px; border:2px solid #0a7c3a;">
                <h1 style="text-align:center;">شركة الحايك - HAYEK SPOT</h1>
                <p><b>رقم الفاتورة:</b> ${inv.invoice_no || '---'}</p>
                <p><b>الزبون:</b> ${inv.customer_name || 'غير محدد'}</p>
                <hr>
                <table style="width:100%; border-collapse:collapse;">
                    <thead><tr style="background:#eee;"><th>البيان</th><th>العملية</th><th>النتيجة</th></tr></thead>
                    <tbody>
                        ${ops && ops.length > 0 ? ops.map(o => `<tr><td>${o.note || 'عملية'}</td><td>${o.expression}</td><td>${o.result}</td></tr>`).join("") : '<tr><td colspan="3">لا يوجد تفاصيل</td></tr>'}
                    </tbody>
                </table>
                <h2 style="text-align:left;">الإجمالي: ${inv.total}</h2>
            </div>
        `;
        printWin.document.write(content);
        printWin.print();
    };

    if (UI.btnCloseInv) UI.btnCloseInv.onclick = () => UI.modalInv.style.display = "none";

    // --- 8. التحديث الشامل ---
    async function fullRefresh() {
        if (UI.refreshBtn) UI.refreshBtn.textContent = "جاري التحديث...";
        await updateInvoiceStats();
        await loadUsersData();
        buildUsersTable();
        if (UI.refreshBtn) UI.refreshBtn.textContent = "تحديث البيانات";
    }

    // التنفيذ عند التشغيل
    if (UI.refreshBtn) UI.refreshBtn.onclick = fullRefresh;
    if (UI.searchBox) UI.searchBox.oninput = buildUsersTable;
    
    fullRefresh();

})();
