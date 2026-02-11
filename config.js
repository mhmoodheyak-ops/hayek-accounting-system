// config.js - هذا الملف ضروري لتحميل Supabase في admin.js
window.HAYEK_CONFIG = {
  supabaseUrl: "https://itidwqvyrjydmegjzuvn.supabase.co",
  supabaseKey: "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_",
  tables: {
    users: "app_users",
    invoices: "app_invoices",
    operations: "app_operations"
  }
};

console.log("config.js تم تحميله بنجاح ✓");
