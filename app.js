document.addEventListener('DOMContentLoaded', () => {
    const btnLogin = document.getElementById('btn-login');
    const userEl = document.getElementById('auth-email');
    const passEl = document.getElementById('auth-pass');
    const msgEl = document.getElementById('auth-msg');

    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            const u = userEl.value.trim();
            const p = passEl.value.trim();

            // هنا نستخدم "المنطق الجديد" من ملف auth.js
            const result = login(u, p); 

            if (result === true) {
                msgEl.innerText = "جاري الدخول...";
                msgEl.style.color = "#4caf50";
                // بعد ثانية ننتقل لصفحة الإدارة
                setTimeout(() => { window.location.href = 'admin.html'; }, 1000);
            } else {
                // الرسالة ستظهر تلقائياً من دالة alert في ملف auth.js
                msgEl.innerText = "فشل الدخول";
                msgEl.style.color = "#ff4d4d";
            }
        });
    }
});
