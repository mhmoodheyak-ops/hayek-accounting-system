window.onload = function() {
    const btn = document.getElementById('btn-login');
    if (btn) {
        btn.onclick = function() {
            const u = document.getElementById('auth-email').value.trim().toLowerCase();
            const p = document.getElementById('auth-pass').value.trim();
            const msg = document.getElementById('auth-msg');

            if (typeof login === 'function') {
                if (login(u, p)) {
                    document.getElementById('auth-overlay').style.display = 'none';
                    document.getElementById('main-content').style.display = 'block';
                } else {
                    alert("خطأ: اسم المستخدم أو كلمة المرور غير صحيحة");
                }
            } else {
                alert("يتم تحميل النظام.. انتظر ثانية وحاول مجدداً");
            }
        };
    }
};
