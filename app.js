document.addEventListener('DOMContentLoaded', () => {document.addEventListener('DOMContentLoaded', () => {// التأكد من أن الكود يعمل فور تحميل الصفحة
window.onload = function() {
    console.log("النظام جاهز...");
    
    const btnLogin = document.getElementById('btn-login');
    
    if (btnLogin) {
        btnLogin.onclick = function() {
            const u = document.getElementById('auth-email').value.trim().toLowerCase(); // تحويل للأحرف الصغيرة تلقائياً
            const p = document.getElementById('auth-pass').value.trim();
            const msgEl = document.getElementById('auth-msg');

            console.log("محاولة دخول باسم:", u);

            // استدعاء المنطق من ملف auth.js
            if (typeof login === "function") {
                const result = login(u, p);
                if (result === true) {
                    msgEl.innerText = "تم التحقق بنجاح! جاري الدخول...";
                    msgEl.style.color = "#d4af37";
                    setTimeout(() => {
                        document.getElementById('auth-overlay').style.display = 'none';
                        document.getElementById('main-content').style.display = 'block';
                    }, 1000);
                }
            } else {
                alert("خطأ تقني: ملف auth.js لم يتم تحميله بعد. يرجى تحديث الصفحة.");
            }
        };
    } else {
        console.error("لم يتم العثور على زر الدخول!");
    }
};
