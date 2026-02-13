// app.js
import { supabase } from "./config.js";
import { login } from "./auth.js"; // auth.js عندك (تم التنفيذ)

const $ = (id) => document.getElementById(id);
const setMsg = (text, ok = false) => {
  const el = $("msg");
  el.className = "msg " + (ok ? "ok" : "err");
  el.textContent = text || "";
};

function normalizeUsername(u) {
  let s = String(u || "").trim();
  s = s.replace(/^mailto:/i, "").trim();      // إزالة mailto:
  if (s.includes("@")) s = s.split("@")[0];   // إذا كتب admin@hayek.local
  return s;
}

async function redirectByRole() {
  // نقرأ profile من app_users أو profiles حسب نظامك لاحقًا.
  // حالياً: نفحص إذا أدمن أو لا عبر جدول app_users (المربوط بـ auth.uid) أو profiles.
  // بما أننا لم نبني admin/user بعد في هذه المرحلة، سنحوّل مبدئياً:
  // - admin -> admin.html
  // - غير admin -> invoice.html

  // جرّب جدول profiles أولاً (إذا موجود)
  const uid = (await supabase.auth.getUser()).data?.user?.id;
  if (!uid) return;

  // 1) profiles (الخيار الاحترافي لو عندك)
  let prof = null;
  try {
    const { data } = await supabase.from("profiles").select("is_admin,blocked").eq("id", uid).single();
    prof = data;
  } catch (_) {}

  // 2) fallback: app_users (إذا أنت تستخدمه كمكان صلاحيات)
  if (!prof) {
    try {
      const { data } = await supabase.from("app_users").select("is_admin,blocked").eq("auth_uid", uid).single();
      prof = data;
    } catch (_) {}
  }

  if (prof?.blocked) {
    await supabase.auth.signOut();
    setMsg("الحساب محظور", false);
    return;
  }

  if (prof?.is_admin) {
    location.href = "admin.html";
  } else {
    location.href = "invoice.html";
  }
}

async function boot() {
  // تحويل تلقائي إذا في جلسة
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    await redirectByRole();
  }
}

$("loginBtn").addEventListener("click", async () => {
  try {
    setMsg("");
    $("loginBtn").disabled = true;

    const username = normalizeUsername($("username").value);
    const pin = String($("pin").value || "").trim();

    if (!username || !pin) {
      setMsg("املأ جميع الحقول", false);
      return;
    }

    await login(username, pin); // auth.js (نهائي) يتكفل بتسجيل الدخول عبر Auth
    setMsg("تم تسجيل الدخول ✅", true);

    await redirectByRole();
  } catch (e) {
    console.error(e);
    const m = String(e?.message || e);

    if (m.includes("Invalid login credentials")) setMsg("بيانات الدخول غير صحيحة", false);
    else setMsg("فشل الدخول: " + m, false);
  } finally {
    $("loginBtn").disabled = false;
  }
});

boot();
