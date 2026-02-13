// app.js (FINAL - no DB role lookup)
// يعتمد فقط على Supabase Auth + تحويل حسب اسم المستخدم

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
  if (!s.includes("@")) return s;
  return s.split("@")[0];
}

// قاعدة بسيطة ونهائية الآن: admin فقط هو الأدمن
function routeByUsername(username) {
  const u = String(username || "").toLowerCase();
  if (u === "admin") return "admin.html";
  return "invoice.html";
}

async function redirectNow() {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return;

  const username = usernameFromEmail(user.email);
  const target = routeByUsername(username);

  // يمنع الرجوع/التقليب
  location.replace(target);
}

async function boot() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      await redirectNow();
    }
  } catch (e) {
    console.error(e);
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

    await login(username, pin);
    setMsg("تم تسجيل الدخول ✅", true);

    await redirectNow();
  } catch (e) {
    console.error(e);
    const m = String(e?.message || e);

    // رسائل واضحة
    if (m.includes("Invalid login credentials") || m.includes("بيانات")) {
      setMsg("بيانات الدخول غير صحيحة", false);
    } else {
      setMsg("فشل الدخول: " + m, false);
    }
  } finally {
    $("loginBtn").disabled = false;
  }
});

boot();
