// المنطق الهندسي لفتح النظام
const runSystem = () => {
    const loginBtn = document.getElementById('btn-login');
    const logoutBtn = document.getElementById('btn-logout');

    if (loginBtn) {
        loginBtn.onclick = () => {
            const user = document.getElementById('auth-email').value.trim().toLowerCase();
            const pass = document.getElementById('auth-pass').value.trim();
            const message = document.getElementById('auth-msg');

            // فحص البيانات باستخدام الدالة الموجودة في auth.js
            if (typeof login === 'function') {
                if (login(user, pass)) {
                    message.innerText = "تم التحقق.. أهلاً بك يا حايك";
                    message.style.color = "#d4af37";
                    
                    // إخفاء الدخول وإظهار النظام
                    setTimeout(() => {
                        document.getElementById('auth-overlay').style.display = 'none';
                        document.getElementById('main-content').style.display = 'block';
                    }, 500);
                } else {
                    message.innerText = "بيانات غير صحيحة أو مستخدم محظور";
                    message.style.color = "#ff4d4d";
                }
            } else {
                alert("خطأ: لم يتم العثور على ملف الصلاحيات auth.js");
            }
        };
    }

    if (logoutBtn) {
        logoutBtn.onclick = () => location.reload();
    }
};

// تشغيل النظام فوراً وعند تحميل الصفحة لضمان الاستجابة
window.onload = runSystem;
runSystem();
