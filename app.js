document.addEventListener('DOMContentLoaded', () => {document.addEventListener('DOMContentLoaded', () => {
    const btnLogin = document.getElementById('btn-login');
    const authOverlay = document.getElementById('auth-overlay');
    const mainContent = document.getElementById('main-content');
    const userEl = document.getElementById('auth-email');
    const passEl = document.getElementById('auth-pass');
    const msgEl = document.getElementById('auth-msg');

    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            const u = userEl.value.trim();
            const p = passEl.value.trim();

            // استخدام المنطق من ملف auth.js
            const result = login(u, p); 

            if (result === true) {
                msgEl.innerText = "تم التحقق.. جاري الدخول";
                msgEl.style.color = "#4caf50";
                
                // المنطق الهندسي: إخفاء شاشة الدخول وإظهار الواجهة
                setTimeout(() => {
                    authOverlay.style.display = 'none';
                    mainContent.style.display = 'block';
                }, 1000);
            } else {
                msgEl.innerText = "فشل الدخول، تحقق من البيانات";
                msgEl.style.color = "#ff4d4d";
            }
        });
    }

    // إضافة منطق زر تسجيل الخروج
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            location.reload(); // إعادة تحميل الصفحة للعودة لشاشة الدخول
        });
    }
});
