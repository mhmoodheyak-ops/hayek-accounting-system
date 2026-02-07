(() => {
    const SUPABASE_URL = "https://itidwqvyrjydmegjzuvn.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_";
    const SESSION_KEY = "hayek_auth_session_v1";

    const overlay = document.getElementById("auth-overlay");
    const userEl = document.getElementById("auth-email");
    const passEl = document.getElementById("auth-pass");
    const msgEl  = document.getElementById("auth-msg");
    const btnLogin = document.getElementById("btn-login");

    async function handleLogin() {
        const u = userEl.value.trim();
        const p = passEl.value.trim();

        if (!u || !p) {
            msgEl.innerText = "الرجاء إدخال اسم المستخدم وكلمة المرور";
            msgEl.style.color = "#ff4d4d";
            return;
        }

        btnLogin.disabled = true;
        msgEl.innerText = "جاري الاتصال بقاعدة البيانات...";
        msgEl.style.color = "#d4af37";

        try {
            const query = `${SUPABASE_URL}/rest/v1/app_users?username=eq.${encodeURIComponent(u)}&pass=eq.${encodeURIComponent(p)}&select=*`;
            const response = await fetch(query, {
                headers: { 
                    "apikey": SUPABASE_ANON_KEY, 
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}` 
                }
            });
            const users = await response.json();

            if (users && users.length > 0) {
                const user = users[0];
                if (user.blocked) {
                    msgEl.innerText = "تم حظر هذا الحساب. راجع الإدارة.";
                    msgEl.style.color = "red";
                } else {
                    localStorage.setItem(SESSION_KEY, JSON.stringify({
                        username: user.username,
                        is_admin: user.is_admin,
                        loginTime: new Date().toISOString()
                    }));
                    msgEl.innerText = "تم التحقق.. جاري الدخول ✅";
                    setTimeout(() => location.reload(), 800);
                }
            } else {
                msgEl.innerText = "بيانات الدخول غير صحيحة";
                msgEl.style.color = "red";
            }
        } catch (e) {
            msgEl.innerText = "خطأ في الاتصال. تأكد من الإنترنت.";
        } finally {
            btnLogin.disabled = false;
        }
    }

    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
        overlay.style.display = "none";
        const data = JSON.parse(session);
        document.getElementById("welcomeUser").innerText = "أهلاً، " + data.username;
    }

    btnLogin.addEventListener("click", handleLogin);
    window.logout = () => { localStorage.removeItem(SESSION_KEY); location.reload(); };
})();
