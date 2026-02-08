<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>لوحة الإدارة - HAYEK SPOT</title>
  <link rel="stylesheet" href="style.css" />
  <style>
    .adminWrap{ width:min(920px, 100%); margin:0 auto; padding:14px; }
    .adminCard{ background:#fff; border-radius:18px; box-shadow:0 10px 25px rgba(0,0,0,.08); padding:14px; }
    .adminTop{ display:flex; gap:10px; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom:10px; }
    .adminTop .left{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
    .kpi{ font-size:12px; color:#555; }
    .row{ display:flex; gap:10px; flex-wrap:wrap; margin:10px 0; }
    .row input{ flex:1; min-width:220px; }
    .btn{ border:0; border-radius:12px; padding:10px 12px; font-weight:900; cursor:pointer; background:#eef0f3; }
    .btn.primary{ background:#111; color:#fff; }
    .btn.danger{ background:#ffe3e3; color:#a80000; }
    .btn.ok{ background:#dff7e7; color:#0d6b2a; }
    .tag{ display:inline-block; padding:4px 8px; border-radius:999px; font-size:12px; font-weight:900; }
    .tag.admin{ background:#e8f0ff; color:#1b4dd6; }
    .tag.blocked{ background:#ffe3e3; color:#a80000; }
    .tableWrap{ overflow:auto; border:1px solid #eee; border-radius:14px; }
    table{ width:100%; border-collapse:collapse; min-width:760px; }
    th,td{ padding:10px; border-bottom:1px solid #eee; font-size:13px; vertical-align:top; text-align:right; }
    th{ background:#fafafa; font-weight:950; }
    td.ltr{ direction:ltr; text-align:left; }
    .actions{ display:flex; gap:8px; flex-wrap:wrap; }
    .muted{ color:#666; font-size:12px; }
  </style>
</head>
<body>

  <header class="topbar">
    <div class="brand">
      <div class="title">HAYEK SPOT</div>
      <div class="sub">لوحة الإدارة</div>
    </div>
    <div class="left">
      <a class="chip" href="index.html">رجوع للحاسبة</a>
      <button id="logoutBtn" class="chip">خروج</button>
    </div>
  </header>

  <main class="adminWrap">
    <div class="adminCard">

      <div class="adminTop">
        <div class="left">
          <button id="refreshBtn" class="btn">تحديث</button>
          <div class="kpi">عدد المستخدمين: <b id="countUsers">0</b></div>
        </div>
        <div class="muted" id="adminInfo">...</div>
      </div>

      <!-- إضافة مستخدم (يتطلب Edge Function لاحقًا إذا بدك إنشاء من داخل اللوحة) -->
      <div class="row">
        <input id="newUsername" type="text" placeholder="اسم المستخدم الجديد (مثال: ali)" inputmode="text" />
        <input id="newPassword" type="text" placeholder="كلمة المرور الجديدة" inputmode="text" />
        <button id="createBtn" class="btn primary">إنشاء مستخدم</button>
      </div>
      <div class="muted">
        * إنشاء المستخدم من داخل اللوحة يحتاج Edge Function (لأن إنشاء مستخدم في Auth يحتاج Service Role). إذا ما بدك هلأ، بنخليه “قريبًا”.
      </div>

      <div style="height:12px"></div>

      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th style="width:18%;">Username</th>
              <th style="width:14%;">Role</th>
              <th style="width:14%;">Status</th>
              <th style="width:24%;">Created</th>
              <th style="width:30%;">Actions</th>
            </tr>
          </thead>
          <tbody id="usersTbody"></tbody>
        </table>
      </div>

    </div>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="auth.js"></script>
  <script src="admin.js"></script>
</body>
</html>// admin.js
(async function () {
  // لازم auth.js يكون عامل window.sb
  const sb = window.sb;
  const logoutBtn = document.getElementById("logoutBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const usersTbody = document.getElementById("usersTbody");
  const countUsers = document.getElementById("countUsers");
  const adminInfo = document.getElementById("adminInfo");

  const createBtn = document.getElementById("createBtn");
  const newUsername = document.getElementById("newUsername");
  const newPassword = document.getElementById("newPassword");

  // حماية: إذا مو مسجّل دخول، رجّعه
  if (!window.isLoggedIn?.()) {
    location.href = "index.html";
    return;
  }

  // تأكد إنه Admin
  const session = window.getSession?.();
  adminInfo.textContent = session?.name ? `مرحبًا ${session.name}` : "";

  async function getMeProfile() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;

    const { data, error } = await sb
      .from("app_users")
      .select("username,is_admin,blocked,created_at")
      .eq("id", user.id)
      .single();

    if (error) return null;
    return data;
  }

  const me = await getMeProfile();
  if (!me?.is_admin) {
    alert("هذه الصفحة للإدمن فقط");
    location.href = "index.html";
    return;
  }

  async function loadUsers() {
    usersTbody.innerHTML = `<tr><td colspan="5">جاري التحميل...</td></tr>`;

    const { data, error } = await sb
      .from("app_users")
      .select("id,username,is_admin,blocked,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      usersTbody.innerHTML = `<tr><td colspan="5">خطأ: ${error.message}</td></tr>`;
      return;
    }

    countUsers.textContent = data?.length || 0;

    usersTbody.innerHTML = "";
    (data || []).forEach(u => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.username}</td>
        <td>${u.is_admin ? `<span class="tag admin">Admin</span>` : `User`}</td>
        <td>${u.blocked ? `<span class="tag blocked">Blocked</span>` : `Active`}</td>
        <td class="ltr">${new Date(u.created_at).toLocaleString()}</td>
        <td>
          <div class="actions">
            <button class="btn ${u.blocked ? "ok" : ""}" data-action="toggle" data-id="${u.id}" data-blocked="${u.blocked}">
              ${u.blocked ? "فك حظر" : "حظر"}
            </button>

            <button class="btn danger" data-action="deleteRow" data-id="${u.id}">
              حذف من الجدول
            </button>
          </div>
          <div class="muted">* حذف نهائي من Auth نعمله لاحقًا بـ Edge Function</div>
        </td>
      `;
      usersTbody.appendChild(tr);
    });
  }

  usersTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "toggle") {
      const blocked = btn.dataset.blocked === "true";
      const next = !blocked;

      const ok = confirm(next ? "تأكيد حظر المستخدم؟" : "تأكيد فك الحظر؟");
      if (!ok) return;

      const { error } = await sb
        .from("app_users")
        .update({ blocked: next })
        .eq("id", id);

      if (error) return alert("خطأ: " + error.message);
      await loadUsers();
    }

    if (action === "deleteRow") {
      const ok = confirm("هذا سيحذف صف المستخدم من جدول app_users فقط (وليس من Auth). متابعة؟");
      if (!ok) return;

      const { error } = await sb
        .from("app_users")
        .delete()
        .eq("id", id);

      if (error) return alert("خطأ: " + error.message);
      await loadUsers();
    }
  });

  refreshBtn.addEventListener("click", loadUsers);

  logoutBtn.addEventListener("click", async () => {
    await window.logout?.();
    location.href = "index.html";
  });

  // إنشاء مستخدم: مبدئيًا (قريبًا) عبر Edge Function
  createBtn.addEventListener("click", async () => {
    alert("إنشاء مستخدم من داخل اللوحة يحتاج Edge Function (Service Role). قلّي إذا بدك أجهزها لك.");
  });

  await loadUsers();
})();         /**
 * HAYEK SPOT - FONT ENGINE
 * هذا الملف يحول خط Amiri إلى صيغة برمجية لضمان ظهور اللغة العربية في الـ PDF
 */

const AMIRI_FONT_DATA = "AAEAAAATAQA... (هنا يكون كود الخط الطويل جداً) ..."; 

// تخزين الخط في الذاكرة المحلية لضمان السرعة
(function setupFont() {
    try {
        localStorage.setItem("AMIRI_TTF_BASE64_V1", AMIRI_FONT_DATA);
        console.log("✅ تم تحميل الخط العربي بنجاح في نظام حايك سبوت");
    } catch (e) {
        console.error("❌ فشل تخزين الخط، قد تكون المساحة ممتلئة");
    }
})();    (() => {
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
})();      <!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HAYEK SPOT | نظام المحاسبة الذكي</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="auth-overlay">
        <div class="auth-card">
            <h1 style="color: #d4af37; margin-bottom: 5px;">HAYEK SPOT</h1>
            <p style="color: #888; margin-bottom: 20px;">نظام المحاسبة المحمي © 2026</p>
            <div style="text-align: right; margin-bottom: 15px;">
                <label style="color: #d4af37; font-size: 0.9rem;">اسم المستخدم</label>
                <input type="text" id="auth-email" class="in" placeholder="أدخل اسمك هنا">
                <label style="color: #d4af37; font-size: 0.9rem; margin-top: 10px; display: block;">كلمة المرور</label>
                <input type="password" id="auth-pass" class="in" placeholder="••••••">
            </div>
            <button id="btn-login" class="btn primary" style="width: 100%; font-size: 1.2rem;">دخول النظام</button>
            <p id="auth-msg" style="margin-top: 15px; min-height: 20px; font-weight: bold;"></p>
        </div>
    </div>

    <div class="main">
        <div class="calc">
            <div class="topbar">
                <div class="user-info">
                    <span class="status-dot"></span>
                    <span id="welcomeUser" style="color: #d4af37;"></span>
                </div>
                <button onclick="window.logout()" class="btn small danger">تسجيل خروج</button>
            </div>

            <div class="screen">
                <div id="expr" class="expr"></div>
                <div id="value" class="value">0</div>
            </div>

            <div class="noteBox">
                <input type="text" id="noteInput" class="in" placeholder="البيان (مثلاً: دفعة بضاعة)">
                <input type="text" id="invoiceName" class="in" placeholder="اسم العميل / الفاتورة">
            </div>

            <div id="keys" class="keys">
                <button class="btn op" data-action="clear">C</button>
                <button class="btn op" id="ceBtn">CE</button>
                <button class="btn op" data-action="back">⌫</button>
                <button class="btn op" data-op="/">÷</button>
                <button class="btn" data-num="7">7</button>
                <button class="btn" data-num="8">8</button>
                <button class="btn" data-num="9">9</button>
                <button class="btn op" data-op="*">×</button>
                <button class="btn" data-num="4">4</button>
                <button class="btn" data-num="5">5</button>
                <button class="btn" data-num="6">6</button>
                <button class="btn op" data-op="-">−</button>
                <button class="btn" data-num="1">1</button>
                <button class="btn" data-num="2">2</button>
                <button class="btn" data-num="3">3</button>
                <button class="btn op" data-op="+">+</button>
                <button class="btn span2" data-num="0">0</button>
                <button class="btn" data-action="dot">.</button>
                <button class="btn eq" data-action="equals">=</button>
            </div>

            <div class="tools">
                <button id="printPdfBtn" class="btn gold-border">تصدير فاتورة PDF</button>
                <button id="clearHistoryBtn" class="btn danger">مسح السجل</button>
            </div>

            <div class="historyWrap">
                <h3 style="color: #d4af37; border-bottom: 1px solid #333; padding-bottom: 5px;">سجل العمليات</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>البيان</th>
                            <th>العملية</th>
                            <th>النتيجة</th>
                        </tr>
                    </thead>
                    <tbody id="historyBody"></tbody>
                </table>
            </div>

            <div class="finalTotalBox">
                <span>إجمالي الكشف:</span>
                <span id="grandTotal">0</span>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    
    <script src="amiri-font.js"></script>
    <script src="auth.js"></script>
    <script src="app.js"></script>
</body>
</html>   /* الألوان والخطوط الملكية لشركة الحايك */
:root {
  --main-bg: #0a0a0a;          /* أسود عميق */
  --card-bg: #141414;          /* أسود ملكي للبطاقات */
  --gold: #d4af37;             /* ذهبي معتق */
  --gold-hover: #ffdf00;       /* ذهبي مشع */
  --white: #ffffff;
  --gray-text: #a0a0a0;
  --danger: #b22222;           /* أحمر غامق */
  --btn-dark: #222222;         /* خلفية الأزرار */
  --radius: 16px;
  --shadow: 0 10px 40px rgba(0,0,0,0.8);
}

/* التنسيق العام */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

body {
  direction: rtl;
  background-color: var(--main-bg);
  color: var(--white);
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
  padding: 20px;
  overflow-x: hidden;
}

/* الحاوية الرئيسية (الدخول والحاسبة) */
.card, .calc {
  background-color: var(--card-bg);
  width: 100%;
  max-width: 480px;
  border: 1px solid #333;
  border-top: 6px solid var(--gold);
  border-radius: var(--radius);
  padding: 30px;
  box-shadow: var(--shadow);
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* شاشة الحاسبة */
.screen {
  background: #000;
  padding: 25px;
  border-radius: 12px;
  text-align: left;
  margin-bottom: 25px;
  border: 1px solid #222;
  box-shadow: inset 0 2px 10px rgba(0,0,0,1);
}

.expr {
  color: var(--gray-text);
  min-height: 24px;
  font-size: 1.1rem;
  word-wrap: break-word;
  margin-bottom: 5px;
}

.value {
  color: var(--gold);
  font-size: 3rem;
  font-weight: bold;
  overflow-x: auto;
  white-space: nowrap;
}

/* لوحة المفاتيح */
.keys {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 25px;
}

.btn {
  cursor: pointer;
  border: none;
  border-radius: 10px;
  padding: 15px;
  font-size: 1.3rem;
  font-weight: 600;
  transition: all 0.2s ease;
  font-family: inherit;
  display: flex;
  justify-content: center;
  align-items: center;
}

.keys .btn { background: var(--btn-dark); color: var(--white); }
.keys .btn:active { transform: scale(0.95); }
.keys .btn:hover { background: #333; }

.keys .op { color: var(--gold); font-size: 1.5rem; }
.keys .alt { color: #ff6b6b; }
.keys .eq { background: var(--gold); color: #000; font-size: 1.8rem; }
.keys .eq:hover { background: var(--gold-hover); }

.span2 { grid-column: span 2; }

/* المدخلات */
.lbl { display: block; margin-bottom: 8px; color: var(--gold); font-size: 0.9rem; }
.in {
  width: 100%;
  padding: 14px;
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 10px;
  color: #fff;
  margin-bottom: 20px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s;
}
.in:focus { border-color: var(--gold); }

/* السجل والجداول */
.historyWrap {
  margin-top: 30px;
  border-top: 1px solid #333;
  padding-top: 20px;
}

.historyTitle {
  color: var(--gold);
  font-size: 1.1rem;
  margin-bottom: 15px;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  text-align: right;
  color: var(--gray-text);
  padding: 12px 8px;
  font-size: 0.85rem;
  border-bottom: 1px solid #333;
}

.table td {
  padding: 12px 8px;
  border-bottom: 1px solid #222;
  font-size: 0.95rem;
}

/* المجموع النهائي */
.finalTotalBox {
  margin-top: 20px;
  padding: 20px;
  background: linear-gradient(135deg, var(--gold), #b8860b);
  color: #000;
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 900;
  font-size: 1.4rem;
  box-shadow: 0 5px 15px rgba(212, 175, 55, 0.3);
}

/* أدوات إضافية */
.hidden { display: none; }
.msg { color: #ff4d4d; text-align: center; margin-top: 10px; font-size: 0.85rem; }

/* للهواتف الذكية */
@media (max-width: 500px) {
  .card, .calc { padding: 20px; border-radius: 0; border-top-width: 4px; }
  .value { font-size: 2.2rem; }
  .btn { padding: 12px; font-size: 1.1rem; }
}

/* تنسيق الطباعة (الفاتورة) */
@media print {
  body { background: #fff; padding: 0; }
  .calc { border: none; box-shadow: none; max-width: 100%; }
  .keys, .topbar, .noteBox, .bottomBar, .btn { display: none; }
  .table th, .table td { color: #000; border-bottom: 1px solid #000; }
  .finalTotalBox { background: #fff; border: 2px solid #000; color: #000; box-shadow: none; }
}
