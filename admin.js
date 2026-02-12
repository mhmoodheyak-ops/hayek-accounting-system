// admin.js — نسخة مستقرة بدون Supabase Auth
(() => {
  // ===== Helpers =====
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n || 0).toLocaleString("ar");
  const now = () => new Date().toISOString();

  // ===== Config =====
  if (!window.HAYEK_CONFIG || !window.supabase) {
    console.error("config.js أو supabase غير محمّل");
    return;
  }

  const CFG = window.HAYEK_CONFIG;
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);

  const T_USERS = CFG.tables.users;
  const T_INV   = CFG.tables.invoices;
  const T_OPS   = CFG.tables.operations;

  // ===== UI =====
  const usersBody = $("usersBody");
  const invBody   = $("invBody");
  const opsBody   = $("opsBody");

  const statInvCount = $("statInvCount");
  const statInvSum   = $("statInvSum");

  const opsBack  = $("opsBack");
  const opsClose = $("opsClose");

  const selInvId = $("selInvId");
  const selUser  = $("selUser");
  const selCust  = $("selCust");
  const selTotal = $("selTotal");
  const selStatus= $("selStatus");

  // ===== Network dot =====
  const netDot = $("netDot");
  function refreshNet(){
    const on = navigator.onLine;
    netDot.className = "dot " + (on ? "on" : "off");
  }
  window.addEventListener("online", refreshNet);
  window.addEventListener("offline", refreshNet);
  refreshNet();

  // ===== Tabs =====
  document.querySelectorAll(".tab").forEach(tab=>{
    tab.onclick=()=>{
      document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      $("pane-users").style.display = tab.dataset.tab==="users" ? "block" : "none";
      $("pane-inv").style.display   = tab.dataset.tab==="inv"   ? "block" : "none";
    };
  });

  // ===== Load users =====
  async function loadUsers(){
    usersBody.innerHTML = "";
    const { data: users, error } = await sb
      .from(T_USERS)
      .select("id, username, blocked, last_seen");

    if (error) {
      console.error(error);
      return;
    }

    for (const u of users) {
      const { count } = await sb
        .from(T_INV)
        .select("*", { count: "exact", head: true })
        .eq("username", u.username);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.username}</td>
        <td><span class="chip">${count || 0}</span></td>
        <td>
          <span class="chip ${u.blocked ? "bad" : "ok"}">
            ${u.blocked ? "محظور" : "نشط"}
          </span>
        </td>
        <td class="mini">${u.last_seen ? new Date(u.last_seen).toLocaleString("ar") : "—"}</td>
        <td class="actRow">
          <button class="aBtn blue" data-user="${u.username}">فواتير</button>
        </td>
      `;
      tr.querySelector("button").onclick = () => loadInvoices(u.username);
      usersBody.appendChild(tr);
    }
  }

  // ===== Load invoices =====
  async function loadInvoices(username=""){
    invBody.innerHTML = "";

    let q = sb.from(T_INV).select("*").order("created_at", { ascending:false });
    if (username) q = q.eq("username", username);

    const { data: invs, error } = await q;
    if (error) {
      console.error(error);
      return;
    }

    let sum = 0;
    for (const inv of invs) {
      sum += Number(inv.total || 0);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(inv.created_at).toLocaleString("ar")}</td>
        <td>${inv.username}</td>
        <td>${inv.customer_name || "—"}</td>
        <td>${fmt(inv.total)}</td>
        <td>${inv.status}</td>
        <td>${String(inv.id).slice(-6)}</td>
        <td>
          <button class="aBtn blue">العمليات</button>
        </td>
      `;

      tr.querySelector("button").onclick = () => openOps(inv);
      invBody.appendChild(tr);
    }

    statInvCount.textContent = invs.length;
    statInvSum.textContent   = fmt(sum);
  }

  // ===== Operations =====
  async function openOps(inv){
    selInvId.textContent = String(inv.id).slice(-6);
    selUser.textContent  = inv.username;
    selCust.textContent  = inv.customer_name || "—";
    selTotal.textContent = fmt(inv.total);
    selStatus.textContent= inv.status;

    opsBody.innerHTML = "";

    const { data: ops, error } = await sb
      .from(T_OPS)
      .select("*")
      .eq("invoiceId", inv.id)
      .order("created_at", { ascending:true });

    if (error) {
      console.error(error);
      return;
    }

    for (const r of ops) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(r.created_at).toLocaleString("ar")}</td>
        <td>${r.text || "—"}</td>
        <td>${r.expr || "—"}</td>
        <td>${r.result}</td>
      `;
      opsBody.appendChild(tr);
    }

    opsBack.style.display = "flex";
  }

  opsClose.onclick = () => opsBack.style.display = "none";

  // ===== Init =====
  loadUsers();
})();
