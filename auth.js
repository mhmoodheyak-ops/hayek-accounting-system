// auth.js (EDGE LOGIN VERSION - NO SUPABASE AUTH)

const FUNCTION_URL =
  "https://itidwqvyrjydmegjzuvn.supabase.co/functions/v1/hayek-sync";

let _user = null;

function getOrCreateDeviceId() {
  const KEY = "HAYEK_DEVICE_ID_V1";
  let v = localStorage.getItem(KEY);
  if (!v) {
    v =
      crypto?.randomUUID?.() ||
      "dev_" + Math.random().toString(16).slice(2) + Date.now();
    localStorage.setItem(KEY, v);
  }
  return v;
}

export async function login(username, password) {
  const deviceId = getOrCreateDeviceId();

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hayek-device": deviceId,
      "x-hayek-user": username,
      "x-hayek-pass": password
    },
    body: JSON.stringify({ action: "login" })
  });

  const data = await res.json();

  if (!data.ok) {
    throw new Error(data.error || "فشل تسجيل الدخول");
  }

  _user = data.user;

  localStorage.setItem("HAYEK_USER_SESSION", JSON.stringify(_user));

  return _user;
}

export function logout() {
  _user = null;
  localStorage.removeItem("HAYEK_USER_SESSION");
}

export function isAuthed() {
  return !!_user;
}

export function getUser() {
  if (!_user) {
    const s = localStorage.getItem("HAYEK_USER_SESSION");
    if (s) _user = JSON.parse(s);
  }
  return _user;
}

window.HAYEK_AUTH = {
  login,
  logout,
  isAuthed,
  getUser,
  getOrCreateDeviceId
};

console.log("HAYEK AUTH loaded (EDGE VERSION)");
