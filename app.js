// app.js - نسخة HAYEK SPOT المحدثة (كاملة - مع تعديل دالة الدخول الذكية)

// ===== عناصر الواجهة =====
const loginView = document.getElementById("loginView") || document.getElementById("auth-overlay");
const calcView  = document.getElementById("calcView") || document.querySelector(".main");

const loginName = document.getElementById("loginName") || document.getElementById("auth-email");
const loginPass = document.getElementById("loginPass") || document.getElementById("auth-pass");
const loginBtn  = document.getElementById("loginBtn") || document.getElementById("btn-login");
const loginMsg  = document.getElementById("loginMsg") || document.getElementById("auth-msg");

const logoutBtn   = document.getElementById("logoutBtn");
const welcomeUser = document.getElementById("welcomeUser");

const exprEl  = document.getElementById("expr");
const valueEl = document.getElementById("value");
const keys    = document.getElementById("keys");
const ceBtn   = document.getElementById("ceBtn");

const noteInput = document.getElementById("noteInput");
const invoiceNameInput = document.getElementById("invoiceName");
const saveInvoiceBtn = document.getElementById("saveInvoiceBtn");

const historyBody = document.getElementById("historyBody");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const printPdfBtn = document.getElementById("printPdfBtn");
const copyLastBtn = document.getElementById("copyLastBtn");

const grandTotalEl = document.getElementById("grandTotal");
const grandTotalBottomEl = document.getElementById("grandTotalBottom");

// ===== تخزين محلي =====
const HISTORY_KEY = "hs_history_v3";
const INVOICE_LAST_KEY = "hs_invoice_last_v2";
const SESSION_KEY = "hayek_auth_session_v1"; 

let history = [];

// ===== حالة الحاسبة =====
let a = null;
let op = null;
let bStr = "0";
let justEval = false;

// ===== أدوات =====
function vibrate(ms=12){
  try{ if (navigator.vibrate) navigator.vibrate(ms); }catch(_){}
}
function trimZeros(s){
  if (!String(s).includes(".")) return String(s);
  return String(s).replace(/\.?0+$/, "");
}
function fmt(x){
  if (!Number.isFinite(x)) return "خطأ";
  const n = +x;
  if (String(n).includes("e")) return n.toString();
  return (Math.abs(n) >= 1e12) ? n.toExponential(6) : trimZeros(n.toString());
}
function symbol(o){
  return ({"+":"+","-":"−","*":"×","/":"÷"}[o] || o);
}
function compute(x, operator, y){
  switch(operator){
    case "+": return x + y;
    case "-": return x - y;
    case "*": return x * y;
    case "/": return (y === 0) ? NaN : x / y;
    default: return y;
  }
}
function getB(){ return Number(bStr); }
function setB(s){ bStr = String(s); valueEl.textContent = String(s); }

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

// ===== إظهار/إخفاء الصفحات =====
function showLogin(){
  if(calcView) calcView.classList.add("hidden");
  if(calcView) calcView.style.display = "none";
  if(loginView) loginView.classList.remove("hidden");
  if(loginView) loginView.style.display = "flex";
}
function showCalc(){
  if(loginView) loginView.classList.add("hidden");
  if(loginView) loginView.style.display = "none";
  if(calcView) calcView.classList.remove("hidden");
  if(calcView) calcView.style.display = "block";

  const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
  if(welcomeUser) welcomeUser.textContent = s.username ? `المسؤول: ${s.username}` : "بائع عام";
}

// ===== تحميل/حفظ السجل =====
function loadHistory(){
  try{
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    history = Array.isArray(saved) ? saved : [];
  }catch(_){
    history = [];
  }
  renderHistory();
}
function saveHistory(){
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}
function calcGrandTotal(){
  const total = history.reduce((sum, it) => sum + (Number(it.resultNumber) || 0), 0);
  const t = fmt(total);
  if(grandTotalEl) grandTotalEl.textContent = t;
  if(grandTotalBottomEl) grandTotalBottomEl.textContent = t; 
  return total;
}

function renderHistory(){
  if(!historyBody) return;
  historyBody.innerHTML = "";

  history.forEach((it, idx) => {
    const lineNo = idx + 1;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${lineNo}</td>
      <td style="color: #d4af37; font-weight: bold;">${escapeHtml(it.note || "-")}</td>
      <td class="ltr" style="color: #a0a0a0;">${escapeHtml(it.opFull || "")}</td>
      <td class="ltr" style="color: #fff; font-weight: bold;">${escapeHtml(it.resultText || "")}
        <div style="margin-top:6px;">
          <button class="btn small gold-border copyBtn" data-copy="${it.id}">نسخ</button>
        </div>
      </td>
    `;
    historyBody.appendChild(tr);
  });

  historyBody.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", async () => {
      vibrate(10);
      const id = btn.getAttribute("data-copy");
      const row = history.find(x => String(x.id) === String(id));
      if (!row) return;
      await copyText(`#${history.indexOf(row)+1}\nالبيان: ${row.note || "-"}\n${row.opFull}\nالنتيجة: ${row.resultText}`);
    });
  });
  calcGrandTotal();
}

async function copyText(text){
  try{ await navigator.clipboard.writeText(text); }
  catch(e){
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

function addHistoryRow(note, opFull, resultNumber){
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  const item = {
    id: Date.now() + Math.random().toString(16).slice(2),
    note: (note || "").trim() || "عملية بيع",
    opFull,
    resultNumber: Number(resultNumber),
    resultText: fmt(resultNumber),
    time
  };
  history.unshift(item);
  history = history.slice(0, 80); 
  saveHistory();
  renderHistory();
}

// ===== منطق الحاسبة الأساسي =====
function resetAll(){
  a = null; op = null; bStr = "0"; justEval = false;
  if(exprEl) exprEl.textContent = "";
  if(valueEl) valueEl.textContent = "0";
}
function clearEntry(){
  if (valueEl && valueEl.textContent === "خطأ") return resetAll();
  setB("0"); justEval = false;
}
function inputNum(d){
  if (valueEl && valueEl.textContent === "خطأ") resetAll();
  if (justEval && !op) { a = null; if(exprEl) exprEl.textContent = ""; setB("0"); justEval = false; }
  if (bStr === "0") setB(String(d)); else setB(bStr + d);
}
function inputDot(){
  if (valueEl && valueEl.textContent === "خطأ") resetAll();
  if (justEval && !op) { a = null; if(exprEl) exprEl.textContent = ""; setB("0"); justEval = false; }
  if (!bStr.includes(".")) setB(bStr + ".");
}
function backspace(){
  if (valueEl && valueEl.textContent === "خطأ") return resetAll();
  if (justEval) return;
  if (bStr.length <= 1) setB("0"); else setB(bStr.slice(0, -1));
}
function percent(){
  if (valueEl && valueEl.textContent === "خطأ") return resetAll();
  setB(trimZeros(String(getB() / 100)));
}
function chooseOp(nextOp){
  if (valueEl && valueEl.textContent === "خطأ") resetAll();
  const b = getB();
  if (a === null) a = b; else if (op) a = compute(a, op, b);
  op = nextOp;
  if(exprEl) exprEl.textContent = `${fmt(a)} ${symbol(op)}`;
  setB("0"); justEval = false;
}
function equals(){
  if (valueEl && valueEl.textContent === "خطأ") return resetAll();
  if (op === null || a === null) return;
  const b = getB();
  const res = compute(a, op, b);
  const opFull = `${fmt(a)} ${symbol(op)} ${fmt(b)} = ${fmt(res)}`;
  if(exprEl) exprEl.textContent = opFull;
  if(valueEl) valueEl.textContent = fmt(res);
  addHistoryRow(noteInput.value, opFull, res);
  if(noteInput) noteInput.value = "";
  a = (Number.isFinite(res) ? res : null);
  op = null; bStr = String(Number.isFinite(res) ? res : "0");
  justEval = true;
}

// ===== أحداث الأزرار =====
if(keys){
    keys.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      vibrate(12);
      if (btn.dataset.num !== undefined) return inputNum(btn.dataset.num);
      if (btn.dataset.op) return chooseOp(btn.dataset.op);
      switch(btn.dataset.action){
        case "clear": return resetAll();
        case "back": return backspace();
        case "dot": return inputDot();
        case "percent": return percent();
        case "equals": return equals();
      }
    });
}

if(ceBtn) ceBtn.addEventListener("click", () => { vibrate(12); clearEntry(); });

// ===== كيبورد الكمبيوتر =====
window.addEventListener("keydown", (e) => {
  const t = document.activeElement;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
  const k = e.key;
  if (k >= "0" && k <= "9") { vibrate(8); inputNum(k); }
  else if (k === ".") { vibrate(8); inputDot(); }
  else if (k === "Enter" || k === "=") { e.preventDefault(); vibrate(10); equals(); }
  else if (k === "Backspace") { vibrate(8); backspace(); }
  else if (k === "Escape") { vibrate(8); resetAll(); }
  else if (k === "+" || k === "-" || k === "*" || k === "/") { vibrate(8); chooseOp(k); }
  else if (k === "%") { vibrate(8); percent(); }
  else if (k === "Delete") { vibrate(8); clearEntry(); }
});

// ===== الأدوات =====
if(clearHistoryBtn) clearHistoryBtn.addEventListener("click", () => {
  if (confirm("هل تريد مسح سجل النشاط بالكامل؟")) {
    vibrate(20); history = []; localStorage.removeItem(HISTORY_KEY); renderHistory();
  }
});

if(copyLastBtn) copyLastBtn.addEventListener("click", async () => {
  vibrate(10); if (!history.length) return; await copyText(history[0].resultText);
});

if(saveInvoiceBtn) saveInvoiceBtn.addEventListener("click", () => {
  vibrate(12);
  const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
  const userName = s.username || "بائع عام";
  const name = (invoiceNameInput.value || "").trim() || `فاتورة-${new Date().toISOString().slice(0,10)}`;
  const total = fmt(calcGrandTotal());
  const payload = { name, user: userName, at: new Date().toISOString(), total, items: history };
  localStorage.setItem(INVOICE_LAST_KEY, JSON.stringify(payload));
  alert(`✅ تم حفظ الفاتورة بنجاح: ${name}`);
});

if(printPdfBtn) printPdfBtn.addEventListener("click", () => { vibrate(10); openPrintInvoice(); });

function openPrintInvoice(){
  const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
  const userName = s.username || "بائع عام";
  const invoiceName = (invoiceNameInput.value || "").trim() || "قائمة مبيعات";
  const totalText = grandTotalEl ? grandTotalEl.textContent : "0";
  const rows = history.slice().reverse();

  const rowsHtml = rows.map((it, i) => `
    <tr>
      <td>${i+1}</td>
      <td style="color:#d4af37; font-weight:bold;">${escapeHtml(it.note || "-")}</td>
      <td style="direction:ltr;text-align:left">${escapeHtml(it.opFull || "")}</td>
      <td style="direction:ltr;text-align:left; font-weight:bold;">${escapeHtml(it.resultText || "")}</td>
    </tr>`).join("");

  const html = `
  <!doctype html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>HAYEK SPOT - ${escapeHtml(invoiceName)}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
      body{font-family: 'Amiri', serif; margin:40px; color:#111; background:#fff;}
      .header-box{text-align:center; border-bottom:3px solid #d4af37; padding-bottom:15px; margin-bottom:20px;}
      h1{margin:0; color:#000; font-size:35px; letter-spacing:2px;}
      .meta{margin-bottom:25px; font-size:16px; line-height:1.8;}
      .meta b{color:#d4af37;}
      table{width:100%; border-collapse:collapse;}
      th,td{padding:12px; border:1px solid #eee; text-align:right;}
      th{background:#111; color:#d4af37; font-size:16px;}
      .totalBox{margin-top:20px; padding:15px; background:#111; color:#d4af37; display:flex; justify-content:space-between; align-items:center; font-size:22px; font-weight:bold;}
      .footer{margin-top:40px; text-align:center; border-top:1px dashed #d4af37; padding-top:20px; font-size:15px; color:#444;}
      @media print{ body{margin:20px;} .totalBox{background:#111 !important; color:#d4af37 !important; -webkit-print-color-adjust: exact;} }
    </style>
  </head>
  <body>
    <div class="header-box"><h1>HAYEK SPOT</h1><div style="font-size:18px; font-weight:bold;">شركة الحايك</div></div>
    <div class="meta">
      <div><b>اسم الفاتورة:</b> ${escapeHtml(invoiceName)}</div>
      <div><b>المسؤول:</b> ${escapeHtml(userName)}</div>
      <div><b>تاريخ التصدير:</b> ${escapeHtml(new Date().toLocaleString('ar-EG'))}</div>
    </div>
    <table>
      <thead><tr><th>#</th><th>البيان</th><th>العملية الحسابية</th><th>النتيجة</th></tr></thead>
      <tbody>${rowsHtml || `<tr><td colspan="4" style="text-align:center;">لا توجد بيانات مسجلة</td></tr>`}</tbody>
    </table>
    <div class="totalBox"><div>المجموع الإجمالي</div><div style="direction:ltr;">${escapeHtml(totalText)}</div></div>
    <div class="footer"><b>شركة الحايك للتجارة والحلول الرقمية</b><br>هاتف: 05510217646</div>
    <script>window.onload = () => { window.print(); };</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("يرجى تفعيل النوافذ المنبثقة."); return; }
  w.document.write(html); w.document.close();
}

// ===== تسجيل الدخول / الخروج =====
if(loginBtn) {
    loginBtn.addEventListener("click", async () => {
      if(loginMsg) loginMsg.textContent = "جاري التحقق...";
      const r = await fetchUser(loginName.value.trim(), loginPass.value);
      if (!r.ok) {
        if(loginMsg) loginMsg.textContent = r.msg || "خطأ في بيانات الدخول";
        return;
      }
      showCalc();
    });
}

// دالة الدخول المعدلة للعمل مع Supabase Client مباشرة (تعديل منطق الربط)
async function fetchUser(u, p) {
    try {
        // نستخدم window.sb المعرف في ملف auth.js للبحث في الجدول
        const { data, error } = await window.sb
            .from('app_users') 
            .select('*')
            .eq('username', u)
            .eq('pass', p)
            .single(); // نتوقع نتيجة واحدة فقط

        if (error || !data) {
            console.error("Login Error:", error);
            return { ok: false, msg: "الاسم أو كلمة السر خطأ" };
        }

        // حفظ الجلسة محلياً ليعرف التطبيق من هو المستخدم الحالي
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username: data.username }));
        return { ok: true };
    } catch (e) {
        console.error("System Error:", e);
        return { ok: false, msg: "فشل الاتصال بالسيرفر" };
    }
}

if(logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem(SESSION_KEY);
      showLogin();
    });
}

// ===== البداية (Initialization) =====
(function init(){
  if (localStorage.getItem(SESSION_KEY)) showCalc();
  else showLogin();
  loadHistory();
  resetAll();
})();