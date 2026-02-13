import { supabase } from "./config.js";

export async function login(username, password) {
  const email = `${username}@hayek.local`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw new Error("فشل تسجيل الدخول");
  }

  return data.user;
}
