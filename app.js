// app.js (FINAL - No auto redirect)
// ✅ لا يوجد تحويل تلقائي عند فتح صفحة الدخول (يمنع loop)
// ✅ التحويل يتم فقط بعد نجاح تسجيل الدخول من زر "دخول"

import { supabase } from "./config.js";
import { login } from "./auth.js";

const $ = (id) => document.getElementById(id);

const setMsg = (text, ok = false) => {
  const el = $("msg");
  el.className = "msg " + (ok ? "ok" : "err");
  el.textContent = text || "";
};

function normalizeUsername(u) {
  let s = String(u || "").trim();
  s = s.replace(/^mailto:/i, "").trim();
  if (s.includes("@")) s = s.split("@")[0];
  return s;
}

function usernameFromEmail(email) {
  const s = String(email || "");
  return s.includes("@") ? s.split("@")[0] : s;
}

// ✅ قرار التوجيه حسب الدور — لكن يُستدعى فقط بعد نجاح login
async function redirectByRole() {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return;

  const uname = usernameFromEmail(user.email).toLowerCase();
  if (uname === "admin") location.href = "admin.html?v=" + Date.now();
  else location.href = "invoice.html?v=" + Date.now();
}

async function boot() {
  // ✅ ممنوع redirect تلقائي (حتى لو في جلسة)
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      const uname = usernameFromEmail(data.session.user.email);
      setMsg(`جلسة موجودة للحساب: ${uname} — اضغط "دخول" للمتابعة.`, true);
    }
  } catch (_) {
    // تجاهل
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

    await login(username, pin); // ✅ Supabase Auth signIn
    setMsg("تم تسجيل الدخول ✅", true);

    // ✅ تحويل واحد فقط بعد نجاح الدخول
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
