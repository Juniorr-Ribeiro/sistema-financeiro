/* ===== Helpers ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const fmt = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBRL = (n) => "R$ " + fmt(n);

function parseBR(str) {
  if (str == null) return 0;
  let s = String(str).replace(/[^\d,.-]/g, "");
  if (s === "" || s === "-") return 0;
  s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

const uid = () => "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  const meses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${meses[m] || m} ${y}`;
}

/* ===== Estado ===== */
let db = null;
let currentMonth = null;

/* ===== API ===== */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  return res;
}

/* ===== Auth ===== */
async function checkAuth() {
  const res = await api("/api/me");
  const { authed } = await res.json();
  if (authed) await startApp();
  else showLogin();
}

function showLogin() {
  $("#app").hidden = true;
  $("#login").hidden = false;
  $("#loginPass").focus();
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pass = $("#loginPass").value;
  const err = $("#loginError");
  err.textContent = "";
  const res = await api("/api/login", { method: "POST", body: JSON.stringify({ password: pass }) });
  if (res.ok) {
    $("#login").hidden = true;
    await startApp();
  } else {
    err.textContent = "Senha incorreta, tenta de novo.";
    $("#loginPass").select();
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  location.reload();
});

/* ===== Start ===== */
async function startApp() {
  const res = await api("/api/data");
  if (!res.ok) return showLogin();
  db = await res.json();
  if (!db.contas) db.contas = [];
  if (!db.budget) db.budget = [];
  if (!db.months) db.months = {};

  // registro de cartoes com vencimento (default dia 20)
  if (!db.cartoes) {
    const nomes = new Set(db.contas);
    for (const mk in db.months)
      for (const ck of ["cycle5", "cycle20"])
        for (const it of db.months[mk][ck].itens) if (it.conta) nomes.add(it.conta.trim());
    db.cartoes = [...nomes].filter(Boolean).map((n) => ({ nome: n, venc: 20 }));
  }
  db.cartoes.forEach((c) => { if (!c.venc) c.venc = 20; });

  const keys = Object.keys(db.months).sort();
  if (keys.length === 0) {
    const k = new Date().toISOString().slice(0, 7);
    db.months[k] = { cycle5: { renda: 0, itens: [] }, cycle20: { renda: 0, itens: [] } };
  }
  currentMonth = Object.keys(db.months).sort().reverse()[0];

  $("#app").hidden = false;
  renderAll();
}

/* ===== Save (debounce) ===== */
let saveTimer = null;
function scheduleSave() {
  setSaveState("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 700);
}
async function saveNow() {
  try {
    const res = await api("/api/data", { method: "POST", body: JSON.stringify(db) });
    setSaveState(res.ok ? "saved" : "error");
  } catch {
    setSaveState("error");
  }
}
function setSaveState(state) {
  const el = $("#saveState");
  el.className = "save-state" + (state === "saving" ? " saving" : state === "error" ? " error" : "");
  el.textContent = state === "saving" ? "Salvando..." : state === "error" ? "Erro ao salvar" : "Salvo";
}

/* ===== Render ===== */
function month() { return db.months[currentMonth]; }

function renderAll() {
  renderMonthSelect();
  updateContas();
  renderCycle("cycle5");
  renderCycle("cycle20");
  renderRenda();
  renderSummary();
  renderBudget();
}

function renderMonthSelect() {
  const sel = $("#monthSelect");
  const keys = Object.keys(db.months).sort().reverse();
  sel.innerHTML = keys.map((k) => `<option value="${k}">${monthLabel(k)}</option>`).join("");
  sel.value = currentMonth;
}

function updateContas() {
  const set = new Set(db.contas);
  (db.cartoes || []).forEach((c) => c.nome && set.add(c.nome));
  for (const ck of ["cycle5", "cycle20"]) {
    for (const it of month()[ck].itens) if (it.conta) set.add(it.conta);
  }
  $("#contasList").innerHTML = [...set].map((c) => `<option value="${c}">`).join("");
}

function renderRenda() {
  for (const ck of ["cycle5", "cycle20"]) {
    const inp = $(`.renda-input[data-cycle="${ck}"]`);
    inp.value = fmt(month()[ck].renda);
  }
}

function renderCycle(ck) {
  const cont = $(`.table[data-cycle="${ck}"]`);
  const itens = month()[ck].itens;
  const head = `<div class="row row-head">
      <span></span><span>Descrição</span><span>Conta/Cartão</span><span>Parc.</span><span style="text-align:right">Valor</span><span></span>
    </div>`;
  cont.innerHTML = head + itens.map((it) => rowHTML(ck, it)).join("");
  renderFoot(ck);
}

function rowHTML(ck, it) {
  return `<div class="row ${it.pago ? "pago" : ""}" data-id="${it.id}" data-cycle="${ck}">
    <span class="r-check"><input type="checkbox" data-field="pago" ${it.pago ? "checked" : ""} title="Pago"></span>
    <input class="r-desc" data-field="descricao" value="${escapeAttr(it.descricao)}" placeholder="Descrição">
    <input class="r-conta" data-field="conta" list="contasList" value="${escapeAttr(it.conta || "")}" placeholder="—">
    <input class="r-parc" data-field="parcela" value="${escapeAttr(it.parcela || "")}" placeholder="—">
    <input class="r-val" data-field="valor" inputmode="decimal" value="${fmt(it.valor)}">
    <button class="r-del" title="Remover">×</button>
  </div>`;
}

function escapeAttr(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function cycleTotals(ck) {
  const c = month()[ck];
  const gasto = c.itens.reduce((s, it) => s + (Number(it.valor) || 0), 0);
  const pago = c.itens.filter((i) => i.pago).reduce((s, it) => s + (Number(it.valor) || 0), 0);
  const sobra = (Number(c.renda) || 0) - gasto;
  return { renda: Number(c.renda) || 0, gasto, pago, pendente: gasto - pago, sobra };
}

function renderFoot(ck) {
  const t = cycleTotals(ck);
  const pos = t.sobra >= 0;
  $(`.cycle-foot[data-cycle="${ck}"]`).innerHTML = `
    <div class="foot-line"><span class="lbl">Total de gastos</span><span class="v">${fmtBRL(t.gasto)}</span></div>
    <div class="foot-line"><span class="lbl">Já pago</span><span class="v">${fmtBRL(t.pago)}</span></div>
    <div class="foot-line"><span class="lbl">Falta pagar</span><span class="v">${fmtBRL(t.pendente)}</span></div>
    <div class="foot-line saldo">
      <span class="lbl">${pos ? "Sobra" : "Falta"}</span>
      <span class="v ${pos ? "pos" : "neg"}">${fmtBRL(Math.abs(t.sobra))}
        <span class="tag-sobra ${pos ? "pos" : "neg"}">${pos ? "sobra" : "falta"}</span>
      </span>
    </div>`;
}

function renderSummary() {
  const a = cycleTotals("cycle5");
  const b = cycleTotals("cycle20");
  const renda = a.renda + b.renda;
  const gasto = a.gasto + b.gasto;
  const saldo = renda - gasto;
  const pos = saldo >= 0;
  $("#summary").innerHTML = `
    <div class="sum-card">
      <div class="label">Total a receber</div>
      <div class="value">${fmtBRL(renda)}</div>
      <div class="sub">Dia 5 + Dia 20</div>
    </div>
    <div class="sum-card">
      <div class="label">Total de gastos</div>
      <div class="value">${fmtBRL(gasto)}</div>
      <div class="sub">${month().cycle5.itens.length + month().cycle20.itens.length} lançamentos</div>
    </div>
    <div class="sum-card saldo">
      <div class="label">${pos ? "Sobra do mês" : "Falta no mês"}</div>
      <div class="value ${pos ? "pos" : "neg"}">${fmtBRL(Math.abs(saldo))}</div>
      <div class="sub">receita menos gastos</div>
    </div>`;
}

/* ===== Eventos: ciclos ===== */
document.querySelectorAll(".table").forEach((tbl) => {
  tbl.addEventListener("input", onCycleInput);
  tbl.addEventListener("change", onCycleChange);
  tbl.addEventListener("click", onCycleClick);
  tbl.addEventListener("blur", onCycleBlur, true);
});

function rowCtx(e) {
  const row = e.target.closest(".row[data-id]");
  if (!row) return null;
  const ck = row.dataset.cycle;
  const id = row.dataset.id;
  const it = month()[ck].itens.find((x) => x.id === id);
  const field = e.target.dataset.field;
  return { row, ck, id, it, field };
}

function onCycleInput(e) {
  const c = rowCtx(e);
  if (!c || !c.field) return;
  if (c.field === "valor") c.it.valor = parseBR(e.target.value);
  else c.it[c.field] = e.target.value;
  if (c.field === "valor") { renderFoot(c.ck); renderSummary(); }
  scheduleSave();
}

function onCycleChange(e) {
  const c = rowCtx(e);
  if (!c || c.field !== "pago") return;
  c.it.pago = e.target.checked;
  c.row.classList.toggle("pago", c.it.pago);
  renderFoot(c.ck);
  scheduleSave();
}

function onCycleBlur(e) {
  const c = rowCtx(e);
  if (!c) return;
  if (c.field === "valor") e.target.value = fmt(c.it.valor);
  if (c.field === "conta") updateContas();
}

function onCycleClick(e) {
  if (!e.target.classList.contains("r-del")) return;
  const c = rowCtx(e);
  if (!c) return;
  const arr = month()[c.ck].itens;
  const i = arr.findIndex((x) => x.id === c.id);
  if (i >= 0) arr.splice(i, 1);
  renderCycle(c.ck);
  renderSummary();
  scheduleSave();
}

/* add gasto */
document.querySelectorAll(".add-row[data-cycle]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const ck = btn.dataset.cycle;
    month()[ck].itens.push({ id: uid(), valor: 0, descricao: "", conta: "", parcela: "", pago: false });
    renderCycle(ck);
    const rows = $$(`.table[data-cycle="${ck}"] .row[data-id]`);
    const last = rows[rows.length - 1];
    if (last) last.querySelector(".r-desc").focus();
    renderSummary();
    scheduleSave();
  });
});

/* renda */
document.querySelectorAll(".renda-input").forEach((inp) => {
  inp.addEventListener("input", () => {
    const ck = inp.dataset.cycle;
    month()[ck].renda = parseBR(inp.value);
    renderFoot(ck);
    renderSummary();
    scheduleSave();
  });
  inp.addEventListener("blur", () => {
    const ck = inp.dataset.cycle;
    inp.value = fmt(month()[ck].renda);
  });
  inp.addEventListener("focus", () => inp.select());
});

/* trocar mes */
$("#monthSelect").addEventListener("change", (e) => {
  currentMonth = e.target.value;
  renderAll();
});

/* ===== Orçamento ===== */
$("#budgetToggle").addEventListener("click", () => {
  const body = $("#budgetBody");
  const open = body.hidden;
  body.hidden = !open;
  $("#budgetToggle").classList.toggle("open", open);
});

function renderBudget() {
  const list = $("#budgetList");
  list.innerHTML = db.budget
    .map((b, i) => `<div class="brow" data-i="${i}">
        <input class="bcat" value="${escapeAttr(b.categoria)}" placeholder="Categoria">
        <input class="bval" inputmode="decimal" value="${fmt(b.valor)}">
        <button class="r-del" title="Remover">×</button>
      </div>`).join("");
  const total = db.budget.reduce((s, b) => s + (Number(b.valor) || 0), 0);
  $("#budgetTotal").textContent = fmtBRL(total);
  $("#budgetTotalTop").textContent = fmtBRL(total);
}

$("#budgetList").addEventListener("input", (e) => {
  const row = e.target.closest(".brow");
  if (!row) return;
  const i = +row.dataset.i;
  if (e.target.classList.contains("bcat")) db.budget[i].categoria = e.target.value;
  if (e.target.classList.contains("bval")) {
    db.budget[i].valor = parseBR(e.target.value);
    const total = db.budget.reduce((s, b) => s + (Number(b.valor) || 0), 0);
    $("#budgetTotal").textContent = fmtBRL(total);
    $("#budgetTotalTop").textContent = fmtBRL(total);
  }
  scheduleSave();
});
$("#budgetList").addEventListener("blur", (e) => {
  if (e.target.classList.contains("bval")) {
    const i = +e.target.closest(".brow").dataset.i;
    e.target.value = fmt(db.budget[i].valor);
  }
}, true);
$("#budgetList").addEventListener("click", (e) => {
  if (!e.target.classList.contains("r-del")) return;
  const i = +e.target.closest(".brow").dataset.i;
  db.budget.splice(i, 1);
  renderBudget();
  scheduleSave();
});
$("#addBudget").addEventListener("click", () => {
  db.budget.push({ categoria: "", valor: 0 });
  renderBudget();
  const rows = $$("#budgetList .brow");
  rows[rows.length - 1]?.querySelector(".bcat").focus();
  scheduleSave();
});

/* ===== Novo mês ===== */
$("#newMonthBtn").addEventListener("click", () => {
  const [y, m] = currentMonth.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  $("#newMonthValue").value = next;
  $("#monthModal").hidden = false;
});
$("#cancelMonth").addEventListener("click", () => ($("#monthModal").hidden = true));
$("#confirmMonth").addEventListener("click", () => {
  const key = $("#newMonthValue").value;
  if (!key) return;
  const mode = $('input[name="newMode"]:checked').value;
  if (db.months[key]) {
    currentMonth = key;
    $("#monthModal").hidden = true;
    renderAll();
    return;
  }
  if (mode === "empty") {
    db.months[key] = { cycle5: { renda: 0, itens: [] }, cycle20: { renda: 0, itens: [] } };
  } else {
    db.months[key] = copyMonth(month());
  }
  currentMonth = key;
  $("#monthModal").hidden = true;
  renderAll();
  scheduleSave();
});

// Copia o mes avancando parcelas e removendo as que terminaram
function copyMonth(src) {
  const copyCycle = (c) => ({
    renda: c.renda,
    itens: c.itens
      .map((it) => {
        const novo = { ...it, id: uid(), pago: false };
        const mt = String(it.parcela || "").match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
        if (mt) {
          const atual = +mt[1], total = +mt[2];
          if (atual >= total) return null; // parcela quitada, nao leva
          novo.parcela = `${atual + 1}/${total}`;
        }
        return novo;
      })
      .filter(Boolean),
  });
  return { cycle5: copyCycle(src.cycle5), cycle20: copyCycle(src.cycle20) };
}

/* ===== Resumo da Fatura ===== */
const faturaModal = $("#faturaModal");

$("#faturaBtn").addEventListener("click", openFatura);
$("#faturaClose").addEventListener("click", () => (faturaModal.hidden = true));
faturaModal.addEventListener("click", (e) => { if (e.target === faturaModal) faturaModal.hidden = true; });

function faturaGroups() {
  const groups = {};
  for (const ck of ["cycle5", "cycle20"]) {
    for (const it of month()[ck].itens) {
      const key = (it.conta || "").trim() || "__sem__";
      (groups[key] = groups[key] || []).push(it);
    }
  }
  // ordena: cartoes com nome primeiro, "sem cartao" por ultimo
  return Object.entries(groups).sort((a, b) => {
    if (a[0] === "__sem__") return 1;
    if (b[0] === "__sem__") return -1;
    return a[0].localeCompare(b[0]);
  });
}

function openFatura() {
  $("#faturaMonth").textContent = monthLabel(currentMonth);
  renderFatura();
  faturaModal.hidden = false;
}

function diasAte(dia) {
  const h = new Date();
  const hojeDia = h.getDate();
  const base = new Date(h.getFullYear(), h.getMonth(), hojeDia);
  let alvo = new Date(h.getFullYear(), h.getMonth(), dia);
  if (hojeDia > dia) alvo = new Date(h.getFullYear(), h.getMonth() + 1, dia);
  return Math.round((alvo - base) / 86400000);
}

function vencDe(conta) {
  if (!conta || conta === "__sem__") return null;
  const c = (db.cartoes || []).find((x) => (x.nome || "").trim().toLowerCase() === conta.trim().toLowerCase());
  return c ? c.venc : null;
}

function vencBannerHTML() {
  const groups = faturaGroups();
  const vencs = [];
  for (const [conta, itens] of groups) {
    if (conta === "__sem__" || !itens.length) continue;
    const v = vencDe(conta);
    if (v) vencs.push(v);
  }
  if (!vencs.length) return "";
  let best = null;
  for (const v of [...new Set(vencs)]) {
    const d = diasAte(v);
    if (best === null || d < best.d) best = { v, d };
  }
  const urgent = best.d <= 3;
  const quando = best.d === 0 ? "vence hoje" : best.d === 1 ? "vence amanhã" : `faltam ${best.d} dias`;
  return `<div class="fbanner ${urgent ? "urgent" : ""}" id="faturaVenc">
    <span class="fb-dot"></span><span>Vencimento dos cartões: <b>dia ${best.v}</b> — ${quando}.</span></div>`;
}

function updateVencBanner() {
  const el = $("#faturaVenc");
  if (!el) return;
  const html = vencBannerHTML();
  if (html) el.outerHTML = html;
  else el.remove();
}

function cartoesManagerHTML() {
  const rows = (db.cartoes || []).map((c, i) => `
    <div class="cm-row" data-i="${i}">
      <input class="cm-nome" value="${escapeAttr(c.nome)}" placeholder="Nome do cartão">
      <span class="cm-venc-wrap">vence dia <input class="cm-venc" type="number" min="1" max="28" value="${c.venc}"></span>
      <button class="r-del cm-del" title="Remover cartão">×</button>
    </div>`).join("");
  return `<div class="cmgr">
    <h4>Cartões e vencimento</h4>
    <div class="cm-list">${rows || `<p class="budget-hint" style="margin:0">Nenhum cartão cadastrado.</p>`}</div>
    <button class="add-row cm-add">+ Adicionar cartão</button>
  </div>`;
}

function renderFatura() {
  const groups = faturaGroups();
  const body = $("#faturaBody");
  let inner = "";

  if (groups.length === 0 || groups.every(([, arr]) => arr.length === 0)) {
    inner = `<p class="fatura-empty">Nenhum gasto lançado neste mês ainda.</p>`;
  } else {
    inner = vencBannerHTML() + groups.map(([conta, itens]) => {
      const nome = conta === "__sem__" ? "Sem cartão" : conta;
      const sub = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
      const pago = itens.filter((i) => i.pago).reduce((s, i) => s + (Number(i.valor) || 0), 0);
      const allPago = itens.length && itens.every((i) => i.pago);
      const v = vencDe(conta);
      const itensHTML = itens.map((it) => `
        <div class="fitem ${it.pago ? "pago" : ""}">
          <span class="fi-desc">${escapeAttr(it.descricao || "(sem nome)")}${it.parcela ? `<em>${escapeAttr(it.parcela)}</em>` : ""}</span>
          <span class="fi-val">${fmtBRL(it.valor)}</span>
        </div>`).join("");
      return `<div class="fgroup">
        <div class="fgroup-head">
          <span class="fgroup-name ${conta === "__sem__" ? "sem" : ""}">${escapeAttr(nome)}</span>
          ${v ? `<span class="fvenc">venc. dia ${v}</span>` : ""}
          <span class="fgroup-sub">${fmtBRL(sub)}</span>
          ${pago > 0 && !allPago ? `<span class="fgroup-paid">${fmtBRL(pago)} pago</span>` : ""}
          <button class="btn-ghost btn-sm fpay" data-conta="${escapeAttr(conta)}">
            ${allPago ? "Estornar" : "Pagar"}
          </button>
        </div>
        <div class="fgroup-items">${itensHTML}</div>
      </div>`;
    }).join("");
  }

  inner += cartoesManagerHTML();
  body.innerHTML = inner;

  let total = 0, pago = 0;
  for (const [, itens] of groups) for (const it of itens) {
    total += Number(it.valor) || 0;
    if (it.pago) pago += Number(it.valor) || 0;
  }
  const falta = total - pago;
  $("#faturaTotais").innerHTML = `
    <span class="ft-grand">${fmtBRL(total)}</span>
    <span class="ft-sub">Pago <b>${fmtBRL(pago)}</b> · Falta <b>${fmtBRL(falta)}</b></span>`;
  $("#faturaPayAll").textContent = falta <= 0 && total > 0 ? "Fatura paga ✓" : "Pagar fatura";
}

// gerenciar cartoes (nome / vencimento)
$("#faturaBody").addEventListener("input", (e) => {
  const row = e.target.closest(".cm-row");
  if (!row) return;
  const i = +row.dataset.i;
  if (e.target.classList.contains("cm-nome")) db.cartoes[i].nome = e.target.value;
  if (e.target.classList.contains("cm-venc")) {
    let v = parseInt(e.target.value, 10);
    if (isNaN(v)) v = 20;
    db.cartoes[i].venc = Math.min(28, Math.max(1, v));
  }
  updateVencBanner();
  updateContas();
  scheduleSave();
});
$("#faturaBody").addEventListener("click", (e) => {
  if (e.target.classList.contains("cm-del")) {
    const i = +e.target.closest(".cm-row").dataset.i;
    db.cartoes.splice(i, 1);
    renderFatura();
    updateContas();
    scheduleSave();
    return;
  }
  if (e.target.classList.contains("cm-add")) {
    db.cartoes.push({ nome: "", venc: 20 });
    renderFatura();
    const rows = $$("#faturaBody .cm-row");
    rows[rows.length - 1]?.querySelector(".cm-nome").focus();
    scheduleSave();
  }
});

// pagar por cartao
$("#faturaBody").addEventListener("click", (e) => {
  const btn = e.target.closest(".fpay");
  if (!btn) return;
  const conta = btn.dataset.conta;
  const nome = conta === "__sem__" ? "Sem cartão" : conta;
  const itens = month().cycle5.itens.concat(month().cycle20.itens)
    .filter((it) => ((it.conta || "").trim() || "__sem__") === conta);
  const allPago = itens.length && itens.every((i) => i.pago);
  if (!allPago) {
    const total = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
    if (!confirm(`Dar baixa na fatura "${nome}" (${fmtBRL(total)})?\nVou marcar todos esses lançamentos como pagos.`)) return;
    itens.forEach((i) => (i.pago = true));
  } else {
    itens.forEach((i) => (i.pago = false));
  }
  afterFaturaChange();
});

// pagar tudo
$("#faturaPayAll").addEventListener("click", () => {
  const all = month().cycle5.itens.concat(month().cycle20.itens);
  const total = all.reduce((s, i) => s + (Number(i.valor) || 0), 0);
  const falta = all.filter((i) => !i.pago).reduce((s, i) => s + (Number(i.valor) || 0), 0);
  if (total === 0) return;
  if (falta <= 0) { // ja pago -> estornar tudo
    if (!confirm("A fatura já está paga. Quer estornar (marcar tudo como não pago)?")) return;
    all.forEach((i) => (i.pago = false));
  } else {
    if (!confirm(`Pagar a fatura inteira (${fmtBRL(falta)} pendente)?\nVou marcar todos os lançamentos como pagos.`)) return;
    all.forEach((i) => (i.pago = true));
  }
  afterFaturaChange();
});

function afterFaturaChange() {
  renderFatura();
  renderCycle("cycle5");
  renderCycle("cycle20");
  renderSummary();
  scheduleSave();
}

// copiar resumo (bom pra mandar no zap)
$("#faturaCopy").addEventListener("click", async () => {
  const groups = faturaGroups();
  let txt = `Fatura — ${monthLabel(currentMonth)}\n\n`;
  let total = 0, pago = 0;
  for (const [conta, itens] of groups) {
    if (!itens.length) continue;
    const nome = conta === "__sem__" ? "Sem cartão" : conta;
    const sub = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
    const v = vencDe(conta);
    txt += `${nome}${v ? ` (vence dia ${v})` : ""} — ${fmtBRL(sub)}\n`;
    for (const it of itens) {
      total += Number(it.valor) || 0;
      if (it.pago) pago += Number(it.valor) || 0;
      txt += `  - ${it.descricao || "(sem nome)"}${it.parcela ? " " + it.parcela : ""}: ${fmtBRL(it.valor)}${it.pago ? " (pago)" : ""}\n`;
    }
    txt += "\n";
  }
  txt += `TOTAL: ${fmtBRL(total)}\nPago: ${fmtBRL(pago)}\nFalta: ${fmtBRL(total - pago)}`;
  try {
    await navigator.clipboard.writeText(txt);
    const b = $("#faturaCopy");
    const old = b.textContent;
    b.textContent = "Copiado!";
    setTimeout(() => (b.textContent = old), 1500);
  } catch {
    alert("Não consegui copiar automático. Segue o resumo:\n\n" + txt);
  }
});

/* ===== Análise do mês ===== */
const analiseModal = $("#analiseModal");
$("#analiseBtn").addEventListener("click", openAnalise);
$("#analiseClose").addEventListener("click", () => (analiseModal.hidden = true));
analiseModal.addEventListener("click", (e) => { if (e.target === analiseModal) analiseModal.hidden = true; });

function allItens() { return month().cycle5.itens.concat(month().cycle20.itens); }

function openAnalise() {
  $("#analiseMonth").textContent = monthLabel(currentMonth);
  renderAnalise();
  analiseModal.hidden = false;
}

function renderAnalise() {
  const itens = allItens();
  const body = $("#analiseBody");
  if (itens.length === 0) {
    body.innerHTML = `<p class="fatura-empty">Nenhum gasto lançado neste mês ainda.</p>`;
    return;
  }
  const gasto = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
  const renda = (Number(month().cycle5.renda) || 0) + (Number(month().cycle20.renda) || 0);
  const sobra = renda - gasto;
  const pct = renda > 0 ? Math.round((gasto / renda) * 100) : 0;

  const byDesc = {};
  for (const it of itens) {
    const k = (it.descricao || "").trim().toUpperCase() || "(SEM NOME)";
    byDesc[k] = (byDesc[k] || 0) + (Number(it.valor) || 0);
  }
  const top = Object.entries(byDesc).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxTop = top[0][1] || 1;

  const byCard = {};
  for (const it of itens) {
    const k = (it.conta || "").trim() || "Sem cartão";
    byCard[k] = (byCard[k] || 0) + (Number(it.valor) || 0);
  }
  const cards = Object.entries(byCard).sort((a, b) => b[1] - a[1]);
  const maxCard = cards[0][1] || 1;

  let parcelaTotal = 0, parcelaCont = 0, contMes = 0;
  for (const it of itens) {
    const m = String(it.parcela || "").match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (m) {
      parcelaTotal += Number(it.valor) || 0;
      if (+m[1] < +m[2]) { parcelaCont += Number(it.valor) || 0; contMes++; }
    }
  }
  const parcelaPct = gasto > 0 ? Math.round((parcelaTotal / gasto) * 100) : 0;

  const orcamento = db.budget.reduce((s, b) => s + (Number(b.valor) || 0), 0);
  const diff = gasto - orcamento;

  body.innerHTML = `
    <div class="an-insight">
      Onde mais vai dinheiro: <b>${escapeAttr(top[0][0])}</b> (${fmtBRL(top[0][1])}).
      Você comprometeu <b>${pct}%</b> do que recebe, e <b>${parcelaPct}%</b> dos gastos são parcelas.
    </div>
    <div class="an-stats">
      <div class="an-stat"><div class="s-lbl">Recebido</div><div class="s-val">${fmtBRL(renda)}</div></div>
      <div class="an-stat"><div class="s-lbl">Gasto</div><div class="s-val">${fmtBRL(gasto)}</div></div>
      <div class="an-stat"><div class="s-lbl">${sobra >= 0 ? "Sobra" : "Falta"}</div><div class="s-val ${sobra >= 0 ? "pos" : "neg"}">${fmtBRL(Math.abs(sobra))}</div></div>
    </div>

    <div class="an-section">
      <h4>Onde foi o dinheiro (maiores gastos)</h4>
      ${top.map(([n, v]) => `
        <div class="an-bar-row"><span class="b-name">${escapeAttr(n)}</span><span class="b-val">${fmtBRL(v)}</span>
          <div class="an-bar-track"><div class="an-bar-fill" style="width:${Math.max(4, Math.round((v / maxTop) * 100))}%"></div></div>
        </div>`).join("")}
    </div>

    <div class="an-section">
      <h4>Gasto por cartão</h4>
      ${cards.map(([n, v]) => `
        <div class="an-bar-row"><span class="b-name">${escapeAttr(n)}</span><span class="b-val">${fmtBRL(v)}</span>
          <div class="an-bar-track"><div class="an-bar-fill gold" style="width:${Math.max(4, Math.round((v / maxCard) * 100))}%"></div></div>
        </div>`).join("")}
    </div>

    <div class="an-section">
      <h4>Parcelas</h4>
      <div class="an-stats" style="margin-bottom:0">
        <div class="an-stat"><div class="s-lbl">Em parcelas</div><div class="s-val">${fmtBRL(parcelaTotal)}</div></div>
        <div class="an-stat"><div class="s-lbl">% dos gastos</div><div class="s-val">${parcelaPct}%</div></div>
        <div class="an-stat"><div class="s-lbl">Vão pro próximo mês</div><div class="s-val">${fmtBRL(parcelaCont)}</div></div>
      </div>
      ${contMes > 0 ? `<p class="budget-hint" style="margin:10px 0 0">${contMes} parcela(s) continuam mês que vem — entram sozinhas quando você criar o próximo mês com "Copiar deste mês".</p>` : ""}
    </div>

    <div class="an-section">
      <h4>Planejado x real</h4>
      <div class="an-vs">
        <div class="vs-col"><div class="vs-lbl">Orçamento planejado</div><div class="vs-num">${fmtBRL(orcamento)}</div></div>
        <div class="vs-sep"></div>
        <div class="vs-col"><div class="vs-lbl">Gasto de verdade</div><div class="vs-num ${diff > 0 ? "over" : "under"}">${fmtBRL(gasto)}</div></div>
        <div class="vs-sep"></div>
        <div class="vs-col"><div class="vs-lbl">${diff > 0 ? "Passou" : "Dentro"}</div><div class="vs-num ${diff > 0 ? "over" : "under"}">${fmtBRL(Math.abs(diff))}</div></div>
      </div>
    </div>`;
}

/* ===== Init ===== */
checkAuth();
