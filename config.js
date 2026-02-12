// config.js - إعدادات Supabase (موحّدة لكل الصفحات)
(() => {
  const CFG = {
    supabaseUrl: "https://itidwqvyrjydmegjzuvn.supabase.co",
    supabaseKey: "sb_publishable_j4ubD1htJvuMvOWUKC9w7g_mwVQzHb_",
    tables: {
      users: "app_users",
      invoices: "app_invoices",
      operations: "app_operations"
    }
  };

  // الاسم الأساسي الجديد
  window.HAYEK_CONFIG = CFG;

  // توافق مع كود قديم كان يستخدم APP_CONFIG
  window.APP_CONFIG = {
    SUPABASE_URL: CFG.supabaseUrl,
    SUPABASE_ANON_KEY: CFG.supabaseKey,
    TABLE_USERS: CFG.tables.users,
    TABLE_INVOICES: CFG.tables.invoices,
    TABLE_OPERATIONS: CFG.tables.operations,
    tables: CFG.tables
  };

  console.log("config.js تم تحميله بنجاح ✓");
})();
