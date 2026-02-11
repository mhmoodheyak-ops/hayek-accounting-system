/* HAYEK SPOT — ADMINISTRATIVE CONTROL PANEL (V3.1)
   PROJECT: PROFESSIONAL MANAGEMENT SYSTEM
   LOGIC: INPUT -> PROCESSING -> DATABASE -> PDF EXPORT
   DATE: 2026
*/

(function () {
    /**
     * @description: الأساسيات وتعريف المتغيرات العامة
     */
    const $ = (id) => document.getElementById(id);

    // --- عناصر واجهة الإدارة الرئيسية ---
    const lock = $("lock");
    const goLogin = $("goLogin");
    const onlineDot = $("onlineDot");
    const adminInfo = $("adminInfo");
    const logoutBtn = $("logoutBtn");
    const refreshBtn = $("refreshBtn");
    const rangeSel = $("range");
    const searchUser = $("searchUser");
    const stInvoices = $("stInvoices");
    const stUsers = $("stUsers");
    const stActive = $("stActive");
    const usersTbody = $("usersTbody");

    // --- عناصر نافذة إضافة مستخدم جديد ---
    const addModalBack = $("addModalBack");
    const closeAddModalBtn = $("closeAddModal");
    const addUserBtn = $("addUserBtn");
    const newUsername = $("newUsername");
    const newPass = $("newPass");
    const newIsAdmin = $("newIsAdmin");
    const saveUserBtn = $("saveUserBtn");
    const addUserMsg = $("addUserMsg");

    // --- عناصر نافذة عرض الفواتير وتفاصيلها ---
    const invModalBack = $("invModalBack");
    const closeInvModalBtn = $("closeInvModal");
    const invModalTitle = $("invModalTitle");
    const invSearch = $("invSearch");
    const invTbody = $("invTbody");
    const reloadInvBtn = $("reloadInvBtn");

    // --- دوال المساعدة والتحقق من الحالة ---

    /**
     * تحديث نقطة الحالة (متصل/غير متصل)
     */
    function updateConnectionStatus() {
        if (onlineDot) {
            const isOnline = navigator.onLine;
            if (isOnline) {
                onlineDot.style.background = "#49e39a";
                onlineDot.style.boxShadow = "0 0 0 6px rgba(73,227,154,.12)";
            } else {
                onlineDot.style.background = "#ff6b6b";
                onlineDot.style.boxShadow = "0 0 0 6px rgba(255,107,107,.12)";
            }
        }
    }

    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);
    updateConnectionStatus();

    /**
     * تنظيف النصوص للحماية من الـ XSS
     */
    function escapeHtml(text) {
        if (!text) return "";
        const map = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };
        return String(text).replace(/[&<>"']/g, (m) => map[m]);
    }

    /**
     * دالة حساب الوقت المنقضي (Time Ago)
     */
    function formatTimeAgo(timestamp) {
        if (!timestamp) return "—";
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return "—";
        
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        
        let interval = Math.floor(seconds / 31536000);
        if (interval >= 1) return `منذ ${interval} سنة`;
        
        interval = Math.floor(seconds / 2592000);
        if (interval >= 1) return `منذ ${interval} شهر`;
        
        interval = Math.floor(seconds / 86400);
        if (interval >= 1) return `منذ ${interval} يوم`;
        
        interval = Math.floor(seconds / 3600);
        if (interval >= 1) return `منذ ${interval} ساعة`;
        
        interval = Math.floor(seconds / 60);
        if (interval >= 1) return `منذ ${interval} دقيقة`;
        
        return "الآن";
    }

    /**
     * تحويل نطاق البحث الزمني إلى صيغة ISO
     */
    function getRangeStartDate(range) {
        const now = new Date();
        if (range === "today") {
            now.setHours(0, 0, 0, 0);
            return now.toISOString();
        }
        if (range === "7d") {
            return new Date(Date.now() - 7 * 86400000).toISOString();
        }
        if (range === "30d") {
            return new Date(Date.now() - 30 * 86400000).toISOString();
        }
        return null;
    }

    // --- نظام التحقق والأمان (Auth Guard) ---

    function showAccessDenied() {
        if (lock) {
            lock.style.display = "flex";
        }
        if (goLogin) {
            goLogin.onclick = function() {
                location.href = "index.html?ref=admin_denied";
            };
        }
    }

    // التحقق من الجلسة وصلاحية الأدمن
    const currentUser = window.HAYEK_AUTH ? window.HAYEK_AUTH.getUser() : null;
    const isAuthed = window.HAYEK_AUTH ? window.HAYEK_AUTH.isAuthed() : false;

    if (!isAuthed || !currentUser || currentUser.role !== "admin") {
        showAccessDenied();
        return;
    }

    // إذا كان الأدمن مسجل دخوله فعلاً
    if (lock) lock.style.display = "none";
    if (adminInfo) {
        adminInfo.textContent = `المسؤول: ${currentUser.username} | الحالة: متصل`;
    }

    if (logoutBtn) {
        logoutBtn.onclick = function() {
            if (confirm("هل تريد تسجيل الخروج؟")) {
                window.HAYEK_AUTH.logout();
                location.href = "index.html";
            }
        };
    }

    // --- تهيئة الاتصال بقاعدة البيانات (Supabase) ---

    function initDatabase() {
        const config = window.HAYEK_CONFIG;
        if (!config || !config.supabaseUrl || !config.supabaseKey) {
            throw new Error("ملف الإعدادات config.js غير موجود أو ناقص.");
        }

        const client = supabase.createClient(config.supabaseUrl, config.supabaseKey);
        
        return {
            client: client,
            tables: {
                users: config.tables.users,
                invoices: config.tables.invoices,
                operations: config.tables.operations
            }
        };
    }

    let DB_CORE;
    try {
        DB_CORE = initDatabase();
    } catch (error) {
        alert(error.message);
        return;
    }

    // --- إدارة البيانات وحالة النظام ---

    let allUsers = [];
    let invoiceStatsMap = new Map();
    let selectedUserForView = null;
    let userInvoicesList = [];

    /**
     * جلب إحصائيات الفواتير لكل مستخدم
     */
    async function loadInvoiceStats(since) {
        const { client, tables } = DB_CORE;
        invoiceStatsMap.clear();

        let query = client.from(tables.invoices).select("username");
        if (since) {
            query = query.gte("created_at", since);
        }

        const { data, error } = await query;
        if (error) {
            console.error("خطأ في جلب إحصائيات الفواتير:", error);
            return 0;
        }

        if (data) {
            data.forEach(item => {
                const uname = String(item.username);
                const currentCount = invoiceStatsMap.get(uname) || 0;
                invoiceStatsMap.set(uname, currentCount + 1);
            });
            return data.length;
        }
        return 0;
    }

    /**
     * جلب قائمة جميع المستخدمين
     */
    async function fetchAllUsers() {
        const { client, tables } = DB_CORE;
        const { data, error } = await client
            .from(tables.users)
            .select("*")
            .order("username", { ascending: true });

        if (error) {
            console.error("خطأ في جلب المستخدمين:", error);
            return [];
        }
        return data || [];
    }

    /**
     * حساب عدد المستخدمين النشطين في آخر 24 ساعة
     */
    function filterActiveLast24h(list) {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        let count = 0;
        list.forEach(u => {
            if (u.last_seen) {
                const lastSeenDate = new Date(u.last_seen).getTime();
                if (lastSeenDate >= oneDayAgo) {
                    count++;
                }
            }
        });
        return count;
    }

    // --- معالجة الواجهة وعرض البيانات (Rendering) ---

    /**
     * رسم جدول المستخدمين في الصفحة
     */
    function renderUsersTable() {
        if (!usersTbody) return;
        
        const searchTerm = (searchUser?.value || "").toLowerCase();
        
        const filtered = allUsers.filter(u => {
            return (u.username || "").toLowerCase().includes(searchTerm);
        });

        let htmlRows = "";

        if (filtered.length === 0) {
            htmlRows = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#888;">لا يوجد مستخدمين مطابقين للبحث</td></tr>`;
        } else {
            filtered.forEach(user => {
                const invCount = invoiceStatsMap.get(String(user.username)) || 0;
                const lastSeenStr = formatTimeAgo(user.last_seen);
                
                // تحديد شكل البادج بناء على الحالة
                const roleBadge = user.is_admin ? '<span class="badge blue">أدمن</span>' : '<span class="badge">مستخدم</span>';
                const statusBadge = user.blocked ? '<span class="badge red">محظور</span>' : '<span class="badge green">نشط</span>';

                htmlRows += `
                    <tr>
                        <td><b style="color:#9fd0ff">${escapeHtml(user.username)}</b></td>
                        <td>${roleBadge}</td>
                        <td>${statusBadge}</td>
                        <td><span class="badge amber">${invCount}</span></td>
                        <td>${lastSeenStr}</td>
                        <td style="font-family:monospace; font-size:11px; color:#aaa; max-width:150px; overflow:hidden;">${escapeHtml(user.device_id || "—")}</td>
                        <td>
                            <div class="actions">
                                <button class="mini ghost" data-action="view-invoices" data-username="${user.username}">الفواتير</button>
                                <button class="mini ${user.blocked ? 'green' : 'red'}" data-action="toggle-block" data-id="${user.id}" data-current="${user.blocked}">
                                    ${user.blocked ? 'فك حظر' : 'حظر'}
                                </button>
                                <button class="mini ghost" data-action="reset-device" data-id="${user.id}">مسح الجهاز</button>
                                <button class="mini red" data-action="delete-user" data-id="${user.id}">حذف</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        usersTbody.innerHTML = htmlRows;
    }

    /**
     * تحديث جميع البيانات في الواجهة
     */
    async function performGlobalRefresh() {
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner"></span> جاري التحديث...';
        }

        try {
            const rangeValue = rangeSel ? rangeSel.value : "all";
            const sinceDate = getRangeStartDate(rangeValue);

            // 1. جلب المستخدمين
            allUsers = await fetchAllUsers();
            
            // 2. جلب إحصائيات الفواتير
            const totalInvoicesFound = await loadInvoiceStats(sinceDate);

            // 3. تحديث مربعات الإحصائيات (Stats Cards)
            if (stUsers) stUsers.textContent = allUsers.length;
            if (stInvoices) stInvoices.textContent = totalInvoicesFound;
            if (stActive) stActive.textContent = filterActiveLast24h(allUsers);

            // 4. إعادة رسم الجدول
            renderUsersTable();

        } catch (err) {
            console.error("Refresh Error:", err);
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = "تحديث البيانات";
            }
        }
    }

    // --- التعامل مع الأحداث (Event Listeners) ---

    if (usersTbody) {
        usersTbody.addEventListener("click", async (e) => {
            const btn = e.target.closest("button");
            if (!btn) return;

            const action = btn.dataset.action;
            const targetId = btn.dataset.id;
            const targetUser = btn.dataset.username;

            // فتح فواتير المستخدم
            if (action === "view-invoices") {
                const userObj = allUsers.find(u => u.username === targetUser);
                if (userObj) openInvoicesDialog(userObj);
                return;
            }

            // حظر أو فك حظر
            if (action === "toggle-block") {
                const isBlocked = btn.dataset.current === "true";
                if (confirm(`هل أنت متأكد من ${isBlocked ? 'فك حظر' : 'حظر'} هذا المستخدم؟`)) {
                    await DB_CORE.client.from(DB_CORE.tables.users).update({ blocked: !isBlocked }).eq("id", targetId);
                    performGlobalRefresh();
                }
            }

            // مسح معرّف الجهاز
            if (action === "reset-device") {
                if (confirm("سيتمكن المستخدم من الدخول من جهاز جديد. متابعة؟")) {
                    await DB_CORE.client.from(DB_CORE.tables.users).update({ device_id: null }).eq("id", targetId);
                    performGlobalRefresh();
                }
            }

            // حذف المستخدم نهائياً
            if (action === "delete-user") {
                if (confirm("تحذير: سيتم حذف المستخدم وجميع بياناته بشكل نهائي! هل أنت متأكد؟")) {
                    await DB_CORE.client.from(DB_CORE.tables.users).delete().eq("id", targetId);
                    performGlobalRefresh();
                }
            }
        });
    }

    // --- نظام الفواتير والـ PDF وتفاصيل العمليات ---

    async function openInvoicesDialog(user) {
        selectedUserForView = user;
        if (invModalTitle) invModalTitle.textContent = `سجل فواتير: ${user.username}`;
        if (invModalBack) invModalBack.style.display = "flex";
        
        loadUserSpecificInvoices();
    }

    async function loadUserSpecificInvoices() {
        if (!selectedUserForView) return;
        
        if (invTbody) invTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">جاري جلب الفواتير...</td></tr>';
        
        const { client, tables } = DB_CORE;
        const { data, error } = await client
            .from(tables.invoices)
            .select("*")
            .eq("username", selectedUserForView.username)
            .order("created_at", { ascending: false });

        if (error) {
            invTbody.innerHTML = '<tr><td colspan="5" style="color:red;">خطأ في تحميل الفواتير</td></tr>';
            return;
        }

        userInvoicesList = data || [];
        renderInvoicesSubTable();
    }

    function renderInvoicesSubTable() {
        if (!invTbody) return;
        
        const search = (invSearch?.value || "").toLowerCase();
        const filtered = userInvoicesList.filter(inv => {
            return String(inv.invoice_no).toLowerCase().includes(search) || 
                   String(inv.customer_name || "").toLowerCase().includes(search);
        });

        if (filtered.length === 0) {
            invTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999;">لا توجد فواتير مسجلة</td></tr>';
            return;
        }

        invTbody.innerHTML = filtered.map(inv => {
            const dateStr = new Date(inv.created_at).toLocaleDateString('ar-EG', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            return `
                <tr>
                    <td>${dateStr}</td>
                    <td>${escapeHtml(inv.customer_name || "زبون عام")}</td>
                    <td><b style="color:#49e39a">${inv.total}</b></td>
                    <td><span style="font-family:monospace;">${inv.invoice_no}</span></td>
                    <td>
                        <div class="actions">
                            <button class="mini blue" data-action="print-pdf" data-id="${inv.id}">PDF</button>
                            <button class="mini ghost" data-action="raw-data" data-id="${inv.id}">JSON</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    /**
     * جلب تفاصيل العمليات الحسابية وتوليد ملف PDF
     */
    async function createInvoicePDF(invoiceId) {
        const invoice = userInvoicesList.find(i => i.id === invoiceId);
        if (!invoice) return;

        // جلب سجل العمليات الحسابية المرتبط بهذه الفاتورة
        const { client, tables } = DB_CORE;
        const { data: operations, error } = await client
            .from(tables.operations)
            .select("*")
            .eq("invoice_id", invoice.id)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("فشل جلب سجل العمليات:", error);
        }

        // بناء محتوى الفاتورة للطباعة
        const printContent = `
            <div style="direction:rtl; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding:40px; border:3px solid #0a7c3a; border-radius:20px; background:#fff; color:#071820; max-width:800px; margin:auto;">
                <div style="text-align:center; margin-bottom:40px;">
                    <h1 style="margin:0; font-size:36px; color:#071820;">شركة الحايك</h1>
                    <h2 style="margin:0; color:#0a7c3a; letter-spacing:2px;">HAYEK SPOT</h2>
                    <div style="margin-top:10px; height:4px; width:100px; background:#0a7c3a; display:inline-block;"></div>
                </div>

                <div style="display:flex; justify-content:space-between; margin-bottom:30px; border-bottom:1px solid #eee; padding-bottom:20px;">
                    <div>
                        <p><b>رقم الفاتورة:</b> ${invoice.invoice_no}</p>
                        <p><b>اسم الزبون:</b> ${invoice.customer_name || "غير محدد"}</p>
                    </div>
                    <div style="text-align:left;">
                        <p><b>التاريخ:</b> ${new Date(invoice.created_at).toLocaleString('ar-EG')}</p>
                        <p><b>اسم المستخدم:</b> ${invoice.username}</p>
                    </div>
                </div>

                <h3 style="background:#f4f4f4; padding:10px; border-right:5px solid #0a7c3a;">سجل العمليات التفصيلي</h3>
                <table style="width:100%; border-collapse:collapse; margin-top:20px;">
                    <thead>
                        <tr style="background:#0a7c3a; color:#fff;">
                            <th style="padding:12px; border:1px solid #ddd; text-align:center;">البيان</th>
                            <th style="padding:12px; border:1px solid #ddd; text-align:center;">العملية الحسابية</th>
                            <th style="padding:12px; border:1px solid #ddd; text-align:center;">النتيجة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(operations && operations.length > 0) ? operations.map(op => `
                            <tr>
                                <td style="padding:10px; border:1px solid #ddd; text-align:center;">${escapeHtml(op.note || "عملية")}</td>
                                <td style="padding:10px; border:1px solid #ddd; text-align:center; font-family:monospace; direction:ltr;">${op.expression || "—"}</td>
                                <td style="padding:10px; border:1px solid #ddd; text-align:center; font-weight:bold;">${op.result}</td>
                            </tr>
                        `).join("") : `<tr><td colspan="3" style="padding:20px; text-align:center; color:#888;">لا توجد تفاصيل عمليات مسجلة لهذه الفاتورة</td></tr>`}
                    </tbody>
                </table>

                <div style="margin-top:40px; padding:20px; background:#f0fff4; border:2px dashed #0a7c3a; border-radius:10px; text-align:center;">
                    <span style="font-size:22px; font-weight:bold;">إجمالي الفاتورة النهائي: </span>
                    <span style="font-size:32px; font-weight:900; color:#0a7c3a;">${invoice.total}</span>
                </div>

                <div style="margin-top:50px; text-align:center; border-top:1px solid #eee; padding-top:20px; font-size:14px; color:#555;">
                    <p>تم استخراج هذا الكشف آلياً بواسطة نظام HAYEK SPOT الإداري</p>
                    <p style="font-weight:bold; color:#0a7c3a;">للتواصل والدعم الفني: 05510217646</p>
                </div>
            </div>
        `;

        const printWindow = window.open('', '_blank', 'width=900,height=1000');
        printWindow.document.write(`
            <html>
                <head>
                    <title>فاتورة رقم ${invoice.invoice_no}</title>
                    <style>body { background: #f5f5f5; margin: 0; padding: 20px; }</style>
                </head>
                <body onload="window.print()">
                    ${printContent}
                </body>
            </html>
        `);
        printWindow.document.close();
    }

    if (invTbody) {
        invTbody.addEventListener("click", (e) => {
            const btn = e.target.closest("button");
            if (!btn) return;
            
            const action = btn.dataset.action;
            const invId = btn.dataset.id;
            
            if (action === "print-pdf") {
                createInvoicePDF(invId);
            } else if (action === "raw-data") {
                const invData = userInvoicesList.find(i => i.id === invId);
                alert(JSON.stringify(invData, null, 2));
            }
        });
    }

    // --- إعدادات الحقول وأزرار الإغلاق ---

    if (rangeSel) rangeSel.onchange = performGlobalRefresh;
    if (searchUser) searchUser.oninput = renderUsersTable;
    if (refreshBtn) refreshBtn.onclick = performGlobalRefresh;
    if (invSearch) invSearch.oninput = renderInvoicesSubTable;
    if (reloadInvBtn) reloadInvBtn.onclick = loadUserSpecificInvoices;

    if (closeInvModalBtn) {
        closeInvModalBtn.onclick = function() {
            if (invModalBack) invModalBack.style.display = "none";
            selectedUserForView = null;
        };
    }

    // --- تشغيل النظام لأول مرة ---
    performGlobalRefresh();

})();
