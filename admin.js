/* HAYEK SPOT - ADMIN PANEL CORE V4.0
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
