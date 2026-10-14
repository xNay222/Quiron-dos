// Cobros (con o sin factura fiscal), Presupuestos (lista) y ajustes. El editor de presupuestos está en views-budget.js.

const INV_ST = { pendiente: ['Pendiente', 'warn'], parcial: ['Abono parcial', 'info'], pagada: ['Pagada', 'good'] };
window.invStatusPill = i => `<span class="pill ${INV_ST[i.status][1]}">${INV_ST[i.status][0]}</span>`;

// ---------- Nueva atención o presupuesto (una sola pantalla) ----------
ACTIONS.newAttention = (el, pre = {}) => {
  // Desde Presupuestos solo se arma el presupuesto; la factura la genera Contabilidad cuando lo acepta.
  // Desde la agenda (consultas del día) se puede facturar directo.
  if (pre.budget || el?.dataset?.budget === '1') return ACTIONS.newBudget(el, pre);   // presupuestos: por paquete
  const budgetOnly = false;
  if (!pre.pid && !S.patients.length) { toast('Primero registre un paciente'); return; }
  UI.at = { pid: pre.pid || S.patients[0].id, doc: pre.doc || activeDocs()[0]?.id || '', svcs: pre.svcs ? [...pre.svcs] : [], extras: [], adj: {}, qty: {}, disc: 0, proc: '', apptId: pre.apptId || null, q: '', budgetOnly };
  openSheet('Registrar atención y cobro', attentionBody(), attentionFoot(), { wide: true });
};
function attentionPreview() {
  const a = UI.at; const lines = bundleLines(a.svcs, a.extras, a.qty);
  const merged = {}; lines.forEach(l => { merged[l.pid] = (merged[l.pid] || 0) + l.qty; });
  const items = buildItems(a.svcs, a.extras, a.adj, a.qty); const t = totalsOf(items, a.disc);
  const cost = r2(Object.entries(merged).reduce((s, [pid, q]) => s + avgCost(prod(pid)) * q, 0));
  return { merged, items, t, cost, missing: checkStock(lines) };
}
function attentionBody() {
  const a = UI.at; const pv = attentionPreview(); const p = pat(a.pid);
  const svcList = S.services.filter(s => !a.q || s.name.toLowerCase().includes(a.q.toLowerCase()));
  return `${patientBand(a.pid)}<div class="form">
    <div class="field"><label for="at-p">Paciente</label><select class="input" id="at-p" data-ch="atField">${patientOptions(a.pid)}</select></div>
    <div class="field"><label for="at-d">Médico</label><select class="input" id="at-d" data-ch="atField">${docOptions(a.doc)}</select></div>
    <div class="field full"><label for="at-proc">Procedimiento o diagnóstico (opcional)</label><input class="input" id="at-proc" value="${esc(a.proc)}" placeholder="Ej. Herniorrafia inguinal derecha" data-in="atProc"></div></div>
  ${p.allergies.length ? `<div class="banner allergy"><b>⚠ Alergias:</b>&nbsp;${esc(p.allergies.join(', '))}</div>` : ''}
  <div><div class="between" style="margin-bottom:8px"><b>1. Servicios</b><div class="search" style="width:220px">${icon('buscar')}<input class="input" id="at-q" placeholder="Buscar servicio" value="${esc(a.q)}" data-in="atSearch" aria-label="Buscar servicio"></div></div>
    <div class="stack">${[...new Set(svcList.map(s => s.cat))].map(cat => `<div><div class="small muted" style="margin-bottom:4px">${esc(cat)}</div><div class="hstack">${svcList.filter(s => s.cat === cat).map(s => { const on = a.svcs.includes(s.id); return `<button class="btn sm ${on ? 'primary' : ''}" data-act="atToggle" data-id="${s.id}" aria-pressed="${on}">${on ? '✓ ' : ''}${esc(s.name)} · ${svcPriceLabel(s)}</button>`; }).join('')}</div></div>`).join('') || '<span class="small muted">Ningún servicio coincide.</span>'}</div></div>
  <div><div class="between" style="margin-bottom:8px"><b>2. Medicamentos o insumos adicionales</b><button class="btn sm" data-act="atAddExtra">Agregar</button></div>
    <div class="stack">${a.extras.map((e, i) => `<div class="chip-x"><select class="input" style="flex:2" id="ax-p${i}" data-ch="atExtra" data-i="${i}" aria-label="Producto">${productOptions(e.pid)}</select><input class="input" style="flex:.6" type="number" min="1" id="ax-q${i}" value="${e.qty}" data-in="atExtra" data-i="${i}" aria-label="Cantidad"><button class="btn ghost" data-act="atDelExtra" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('') || '<span class="small muted">Lo que agregues aquí se descuenta del inventario y se suma a la factura.</span>'}</div></div>
  ${pv.items.length ? `<div><b>3. Precios</b><div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>Concepto</th><th class="num">Cantidad</th><th class="num">Precio lista</th><th class="num">Aumento %</th><th class="num">Precio final</th></tr></thead><tbody>
    ${pv.items.map(x => { const s = x.sid && svc(x.sid); const hasUnit = s && s.unit && s.unit !== 'servicio';
      return `<tr><td>${esc(x.name)}</td><td class="num">${hasUnit ? `<input class="input" style="width:72px;text-align:right" type="number" min="1" step="1" id="qty-${x.sid}" value="${x.qty}" data-in="atQty" data-id="${x.sid}" aria-label="${UNITS[s.unit][1]} de ${esc(s.name)}"> <span class="small muted">${UNITS[s.unit][1]}</span>` : '—'}</td><td class="num">${fmt(x.base)}</td><td class="num">${x.sid ? `<input class="input" style="width:80px;text-align:right" type="number" min="0" step="1" id="adj-${x.sid}" value="${a.adj[x.sid] || 0}" data-in="atAdj" data-id="${x.sid}" aria-label="Aumento para ${esc(x.name)}">` : '—'}</td><td class="num"><b>${fmt(x.price)}</b></td></tr>`; }).join('')}</tbody></table></div>
    <div class="small muted" style="margin-top:6px">El aumento se suma al precio y no aparece en el presupuesto ni en la factura.</div></div>` : ''}
  <div class="grid g2">
    <div class="card"><h2>4. Se descontará del inventario</h2>${Object.keys(pv.merged).length ? `<div class="stack small">${Object.entries(pv.merged).map(([pid, q]) => { const pr = prod(pid); const ok = usable(pr) >= q;
      return `<div class="between"><span>${esc(pr.name)} <span class="muted">×${q}</span></span><span class="pill ${ok ? 'good' : 'bad'}">${ok ? `quedan ${usable(pr) - q}` : `solo hay ${usable(pr)}`}</span></div>`; }).join('')}</div><div class="small muted" style="margin-top:8px">Solo al facturar; un presupuesto no toca el inventario.</div>` : '<div class="small muted">Los servicios elegidos no consumen insumos.</div>'}</div>
    <div class="card"><h2>5. Total</h2><div class="totals">
      <div><span class="muted">Subtotal</span><span>${fmt(pv.t.sub)}</span></div>
      <div style="align-items:center"><label class="muted" for="at-disc">Cortesía (descuento %)</label><input class="input" style="width:80px;text-align:right" type="number" min="0" max="100" step="1" id="at-disc" value="${a.disc}" data-in="atDisc"></div>
      ${pv.t.disc ? `<div><span class="muted">Cortesía ${pv.t.disc}%</span><span>-${fmt(pv.t.desc)}</span></div>` : ''}
      <div class="big"><span>Total</span><span>${fmt(pv.t.total)}</span></div>
      <div class="small muted" style="justify-content:flex-end">${fmt(pv.t.total * S.rate, 'VES')} a tasa BCV ${S.rate.toLocaleString('es-VE', { maximumFractionDigits: 4 })}</div>
      <div class="small muted"><span>Costo de insumos · margen</span><span>${fmt(pv.cost)} · ${pv.t.total ? Math.round((pv.t.total - pv.cost) / pv.t.total * 100) : 0}%</span></div>
    </div></div></div>`;
}
function attentionFoot() {
  const pv = attentionPreview(); const empty = !UI.at.svcs.length && !UI.at.extras.length; const block = empty || pv.missing.length;
  if (UI.at.budgetOnly) return `<span class="note">${pv.missing.length ? `<span class="pill warn">Existencia insuficiente a la fecha</span> ${pv.missing.map(m => esc(prod(m.pid).name)).join(', ')}` : 'El presupuesto no afecta el inventario.'}</span>
    <button class="btn" data-act="saveBudget" ${empty ? 'disabled' : ''}>Guardar</button>
    <button class="btn primary" data-act="saveBudget" data-dl="1" ${empty ? 'disabled' : ''}>${icon('descargar')}Guardar y descargar PDF</button>`;
  return `<span class="note">${pv.missing.length ? `<span class="pill bad">Falta existencia</span> ${pv.missing.map(m => esc(prod(m.pid).name)).join(', ')}` : 'Al registrarla se descuentan los insumos y queda en el expediente.'}</span>
    <label class="hstack small"><input type="checkbox" id="at-fiscal" ${UI.at.fiscal ? 'checked' : ''} data-ch="atFiscal"> Emitir factura fiscal</label>
    <button class="btn" data-act="saveAttention" ${block ? 'disabled' : ''}>Registrar, cobrar después</button>
    <button class="btn primary" data-act="saveAttention" data-pay="1" ${block ? 'disabled' : ''}>Registrar y cobrar</button>`;
}
const atRedraw = () => { const f = document.activeElement?.id; const pos = document.activeElement?.selectionStart; refreshSheet(attentionBody(), attentionFoot()); const n = f && document.getElementById(f); if (n) { n.focus(); try { if (pos != null) n.setSelectionRange(pos, pos); } catch (e) {} } };
ACTIONS.atField = () => { UI.at.pid = val('at-p'); UI.at.doc = val('at-d'); atRedraw(); };
ACTIONS.atProc = el => { UI.at.proc = el.value; };
ACTIONS.atSearch = el => { UI.at.q = el.value; atRedraw(); };
ACTIONS.atToggle = el => { const id = el.dataset.id; const s = UI.at.svcs; s.includes(id) ? s.splice(s.indexOf(id), 1) : s.push(id); atRedraw(); };
ACTIONS.atAddExtra = () => { const first = (S.products.find(p => usable(p) > 0) || S.products[0])?.id;   // antes: producto de ejemplo fijo
  if (!first) { toast('Todavía no hay productos en el inventario.'); return; } UI.at.extras.push({ pid: first, qty: 1 }); atRedraw(); };
ACTIONS.atDelExtra = el => { UI.at.extras.splice(+el.dataset.i, 1); atRedraw(); };
ACTIONS.atExtra = el => { const i = +el.dataset.i; UI.at.extras[i] = { pid: val('ax-p' + i), qty: Math.max(1, Math.round(num('ax-q' + i))) }; atRedraw(); };
ACTIONS.atQty = el => { UI.at.qty[el.dataset.id] = Math.max(1, Math.ceil(num(el.id))); atRedraw(); };
window.svcPriceLabel = s => s.tiers?.length ? `desde ${fmt(s.tiers[0])}` : s.unit && s.unit !== 'servicio' ? `${fmt(s.price)}/${UNITS[s.unit][0]}` : fmt(s.price);
ACTIONS.atAdj = el => { UI.at.adj[el.dataset.id] = Math.max(0, num(el.id)); atRedraw(); };
ACTIONS.atDisc = () => { UI.at.disc = Math.min(100, Math.max(0, num('at-disc'))); atRedraw(); };
ACTIONS.atFiscal = el => { UI.at.fiscal = el.checked; };
ACTIONS.saveAttention = el => {
  const a = UI.at;
  if (a.fiscal && !a.sheets) return openFacturaIssue({ draft: { pid: a.pid, items: attentionPreview().items, disc: a.disc, payments: [], date: dAt(0), status: 'pendiente' }, attentionPay: !!el.dataset.pay });
  const res = createAttention({ pid: a.pid, doc: a.doc, serviceIds: a.svcs, extras: a.extras, adj: a.adj, qty: a.qty, disc: a.disc, proc: a.proc, apptId: a.apptId, fiscal: !!a.fiscal, sheets: a.sheets, fiscalDetails: a.fiscalDetails });
  if (!res.ok) { toast(res.msg || 'No hay existencia suficiente'); a.sheets = null; atRedraw(); return; }
  toast(`${chargeLabel(res.inv)} ${res.inv.num} registrada · inventario actualizado`);
  if (el.dataset.pay) openPay(res.inv.id); else { closeSheet(); render(); }
};
ACTIONS.saveBudget = async el => {
  const a = UI.at; const b = createBudget({ pid: a.pid, doc: a.doc, serviceIds: a.svcs, extras: a.extras, adj: a.adj, qty: a.qty, disc: a.disc, proc: a.proc });
  toast(`${b.num} guardado`); UI.budF = 'abierto'; ACTIONS.openBudget({ dataset: { id: b.id } }); render();
  if (el?.dataset?.dl) await ACTIONS.budDownload({ dataset: { id: b.id } });
};

// ---------- Cobro ----------
function openPay(invId) {
  const inv = byId(S.invoices, invId); UI.pay = { inv: invId, method: UI.pay?.method || 'usd', igtf: false };
  openSheet(`Cobrar ${inv.num}`, payBody(), `<span class="note" id="pay-msg"></span><button class="btn" data-act="close">Más tarde</button><button class="btn primary" data-act="savePay">Registrar cobro</button>`);
  render();
}
window.openPay = openPay;
const payTarget = () => UI.pay.draft || byId(S.invoices, UI.pay.inv);
function payBody() {
  const inv = payTarget(); const m = metodo(UI.pay.method); const due = invDue(inv); const rate = invRate(inv);
  const def = m.cur === 'USD' ? due : r2(due * rate);
  return `${patientBand(inv.pid)}<div class="between"><div><div class="small muted">${esc(pat(inv.pid).name)} · ${esc(inv.items.map(i => i.name).join(', '))}</div><div style="font-size:28px;font-weight:600;letter-spacing:-.02em">${fmt(due * rate, 'VES')}</div><div class="small muted">pendiente · equivale a ${fmt(due)} a tasa ${rate.toLocaleString('es-VE', { maximumFractionDigits: 4 })}${inv.rate ? (isFiscal(inv) ? ' (fija desde la emisión de la factura)' : '') : ' (BCV de hoy)'}</div></div>${invStatusPill(inv)}</div>
  <div class="hstack">${METODOS.map(x => `<button class="btn sm ${x.id === m.id ? 'primary' : ''}" data-act="payMethod" data-id="${x.id}" aria-pressed="${x.id === m.id}">${x.name}</button>`).join('')}</div>
  <div class="form"><div class="field"><label for="pay-a">Monto en ${m.cur === 'USD' ? 'dólares' : 'bolívares'}</label><input class="input" type="number" min="0" step="0.01" id="pay-a" value="${def.toFixed(2)}" data-in="payAmt"></div>
  <div class="field"><label>Equivale a</label><div class="input" id="pay-eq" style="background:none">${eqText(def, m)}</div></div>
  <label class="hstack small full"><input type="checkbox" id="pay-igtf" data-ch="payIgtf" ${UI.pay.igtf ? 'checked' : ''}> Incluir IGTF (${S.igtfRate}%)</label>
  ${m.cur === 'VES' ? `<div class="field full"><label for="pay-ref">Referencia bancaria</label><input class="input" id="pay-ref" placeholder="Últimos dígitos de la operación"></div>` : ''}</div>`;
}
function eqText(amount, m) {
  const rate = invRate(payTarget()); const usd = m.cur === 'USD' ? amount : amount / rate; const igtf = UI.pay.igtf ? r2(usd * S.igtfRate / 100) : 0;
  const base = m.cur === 'USD' ? fmt(amount * rate, 'VES') : `${fmt(usd)} a tasa ${rate.toLocaleString('es-VE', { maximumFractionDigits: 4 })}`;
  return igtf ? `${base} · + IGTF ${S.igtfRate}% ${m.cur === 'USD' ? fmt(igtf) : fmt(igtf * rate, 'VES')} = <b>${m.cur === 'USD' ? fmt(usd + igtf) : fmt((usd + igtf) * rate, 'VES')}</b> a recibir` : base;
}
ACTIONS.payIgtf = el => { UI.pay.igtf = el.checked; ACTIONS.payAmt(); };
ACTIONS.payMethod = el => { UI.pay.method = el.dataset.id; refreshSheet(payBody()); };   // la casilla de IGTF conserva lo marcado
ACTIONS.payAmt = () => { document.getElementById('pay-eq').innerHTML = eqText(num('pay-a'), metodo(UI.pay.method)); };
ACTIONS.savePay = () => {
  if (!canSee('contabilidad')) return;
  const amount = num('pay-a'), target = payTarget(), m = metodo(UI.pay.method);
  const usd = m.cur === 'USD' ? r2(amount) : r2(amount / invRate(target));
  if (!Number.isFinite(usd) || usd <= 0 || usd - invDue(target) > 0.01) { document.getElementById('pay-msg').textContent = 'Indique un monto válido, mayor que cero y que no supere el saldo.'; return; }
  if (UI.pay.budget) {
    const b = byId(S.budgets, UI.pay.budget);
    if (!b || !['enviado', 'aceptado'].includes(b.status) || b.inv) { document.getElementById('pay-msg').textContent = 'El presupuesto cambió. Abra nuevamente el detalle.'; return; }
    const result = b.v2 ? chargeFromBudget(b) : createAttention({ pid: b.pid, doc: b.doc, serviceIds: b.serviceIds, extras: b.extras, adj: b.adj, qty: b.qty || {}, disc: b.disc, proc: b.proc, budgetId: b.id });
    if (!result.ok) { document.getElementById('pay-msg').textContent = result.msg || 'Existencia insuficiente para registrar la cuenta.'; return; }
    UI.pay.inv = result.inv.id; delete UI.pay.draft; delete UI.pay.budget;
  }
  const res = pay(UI.pay.inv, { method: UI.pay.method, amount: num('pay-a'), igtf: UI.pay.igtf });
  if (!res.ok) { document.getElementById('pay-msg').textContent = res.msg; return; }
  const inv = byId(S.invoices, UI.pay.inv);
  const ref = val('pay-ref').trim(); if (ref) { inv.payments.at(-1).ref = ref; save(); }
  if (inv.status === 'pagada') { toast(`${inv.num} pagada`); ACTIONS.showDoc({ dataset: { kind: 'invoice', id: inv.id } }); render(); } else { refreshSheet(payBody()); render(); toast('Abono registrado'); }
};
ACTIONS.payInvoice = el => openPay(el.dataset.id);

// ---------- Presupuestos ----------
const BUD_TABS = [['abierto', 'Por enviar'], ['enviado', 'En Contabilidad'], ['facturado', 'Sin pago'], ['parcial', 'Pago parcial'], ['pagado', 'Pago recibido'], ['otros', 'Descartados y vencidos'], ['todos', 'Todos']];
VIEWS.atencion = () => {
  const f = UI.budF || 'abierto';
  const inTab = b => { const st = budStatus(b); return f === 'todos' || st === f || (f === 'otros' && ['rechazado', 'vencido'].includes(st)); };
  const count = k => S.budgets.filter(b => { const st = budStatus(b); return st === k || (k === 'otros' && ['rechazado', 'vencido'].includes(st)); }).length;
  const sum = k => S.budgets.filter(b => budStatus(b) === k).reduce((a, b) => a + budgetTotals(b).total, 0);
  const list = S.budgets.filter(inTab).map(b => `<button class="row" data-act="openBudget" data-id="${b.id}"><span class="avatar">${initials(pat(b.pid).name)}</span>
    <div class="grow"><div class="t">${b.num} · ${esc(pat(b.pid).name)}</div><div class="s">${fdate(b.date)}${b.proc ? ' · ' + esc(b.proc) : ''} · ${esc(med(b.doc)?.name || '')}</div></div>
    <div class="end"><div>${fmt(budgetTotals(b).total)}</div>${budPill(b)}</div></button>`).join('') || '<div class="empty">No hay presupuestos en esta sección.</div>';
  return header('Presupuestos', 'Quirúrgicos, de emergencia y de procedimientos. Se arman desde un paquete y se envían directamente a Contabilidad para registrar el pago o rechazo', `<button class="btn primary" data-act="newAttention" data-budget="1">+ Nuevo presupuesto</button>`) +
  `<div class="grid g4">${kpi('Por enviar', count('abierto'), fmt(sum('abierto')))}${kpi('En Contabilidad', count('enviado'), fmt(sum('enviado')))}${kpi('Pago parcial', count('parcial'), fmt(sum('parcial')))}${kpi('Pagos recibidos este mes', S.budgets.filter(b => budStatus(b) === 'pagado' && (byId(S.invoices, b.inv)?.date || '').slice(0, 7) === dAt(0).slice(0, 7)).length)}</div>
  <div class="card sec" style="padding:12px 16px"><div class="hstack small" style="gap:8px;flex-wrap:wrap"><b>Procedimiento:</b><span class="pill">1. Guardar presupuesto</span>→<span class="pill">2. Enviar a contabilidad</span>→<span class="pill">3. Pago recibido o no pagado / rechazado</span></div></div>
  <div class="seg sec" role="group" aria-label="Filtro" style="margin-bottom:12px">${BUD_TABS.map(([k, t]) => { const n = k === 'todos' || k === 'facturado' ? 0 : count(k); return `<button data-act="budF" data-k="${k}" aria-pressed="${f === k}">${t}${n ? ` (${n})` : ''}</button>`; }).join('')}</div>
  <div class="list">${list}</div>`;
};
ACTIONS.budF = el => { UI.budF = el.dataset.k; render(); };

// Cobros: viven en Contabilidad (pestaña Cobros). Cada uno puede tener o no factura fiscal.
function invoicesView() {
  const f = UI.invF || 'abiertas';
  const month = dAt(0).slice(0, 7); const monthInv = S.invoices.filter(i => i.date.slice(0, 7) === month);
  const billed = monthInv.reduce((a, i) => a + invTotals(i).total, 0); const cost = monthInv.reduce((a, i) => a + i.cost, 0);
  const billedBs = monthInv.reduce((a, i) => a + invTotals(i).total * invRate(i), 0); const open = S.invoices.filter(i => i.status !== 'pagada');
  const list = S.invoices.filter(i => f === 'todas' || (f === 'abiertas' ? i.status !== 'pagada' : f === 'pagadas' ? i.status === 'pagada' : f === 'fiscal' ? isFiscal(i) : !isFiscal(i))).map(i => `<button class="row" data-act="openInvoice" data-id="${i.id}"><span class="avatar">${initials(pat(i.pid).name)}</span>
    <div class="grow"><div class="t">${i.num} · ${esc(pat(i.pid).name)}</div><div class="s">${fdate(i.date)} · ${esc(i.items.map(x => x.name).join(', '))}</div></div>
    <div class="end"><div>${bsOf(invTotals(i).total, i)}</div><div class="hstack">${isFiscal(i) ? '<span class="pill info">Factura fiscal</span>' : '<span class="pill">Sin factura</span>'}${invStatusPill(i)}</div></div></button>`).join('') || '<div class="empty">No hay cobros en este filtro.</div>';
  return `<div class="grid g3">${kpi('Registrado este mes', fmt(billedBs, 'VES'), `${monthInv.length} cuentas · ${monthInv.filter(isFiscal).length} con factura fiscal · ${fmt(billed)}`)}${kpi('Costo de insumos', fmt(cost), billed ? `margen ${Math.round((billed - cost) / billed * 100)}%` : '')}${kpi('Por cobrar', bsSum(open, invDue), `${open.length} abiertas · ${fmt(open.reduce((a, i) => a + invDue(i), 0))}`)}</div>
  <div class="seg sec" role="group" aria-label="Filtro" style="margin-bottom:12px">${[['abiertas', 'Por cobrar'], ['pagadas', 'Pagadas'], ['fiscal', 'Con factura fiscal'], ['nofiscal', 'Sin factura'], ['todas', 'Todas']].map(([k, t]) => `<button data-act="invF" data-k="${k}" aria-pressed="${f === k}">${t}</button>`).join('')}</div>
  <div class="list">${list}</div>`;
}
ACTIONS.invF = el => { UI.invF = el.dataset.k; render(); };
ACTIONS.openInvoice = el => {
  const i = byId(S.invoices, el.dataset.id); const t = invTotals(i); const used = S.moves.filter(m => m.ref === i.num && m.pid);
  openSheet(`${chargeLabel(i)} ${i.num}`, `${patientBand(i.pid)}<div class="between"><div><b>${esc(pat(i.pid).name)}</b><div class="small muted">${esc(pat(i.pid).ci)} · ${fdate(i.date)}${isFiscal(i) ? ` · Nº control ${esc(i.sheets?.map(h => h.control).join(', ') || i.control || '')}` : ' · sin factura fiscal'}${i.prev ? ` · antes ${i.prev}` : ''}${i.doc ? ' · ' + esc(med(i.doc).name) : ''}</div></div>${invStatusPill(i)}</div>
    <div class="tablewrap"><table><thead><tr><th>Concepto</th><th class="num">Monto</th></tr></thead><tbody>${i.items.map(x => `<tr><td>${esc(x.name)}${x.adj ? ` <span class="pill warn" title="Solo visible para la clínica">+${x.adj}%</span>` : ''}</td><td class="num">${bsOf(x.price, i)}</td></tr>`).join('')}</tbody>
    <tfoot>${t.disc ? `<tr><td>Cortesía (descuento ${t.disc}%)</td><td class="num">-${bsOf(t.desc, i)}</td></tr>` : ''}${isFiscal(i) ? '<tr><td>IVA</td><td class="num">Exento · servicio médico</td></tr>' : ''}<tr><td>Total</td><td class="num">${bsOf(t.total, i)}</td></tr></tfoot></table></div>
    <div class="small muted">Equivale a ${fmt(t.total)} a tasa ${invRate(i).toLocaleString('es-VE', { maximumFractionDigits: 4 })} Bs/USD${i.rate ? (isFiscal(i) ? ' · tasa fija desde la emisión de la factura' : ' · tasa del cobro') : ' · tasa BCV de hoy (queda fija al saldarse)'}.</div>
    <div class="grid g2"><div><h3 class="small muted" style="margin:0 0 6px">Cobros</h3><div class="list">${i.payments.map(p => `<div class="row"><div class="grow"><div class="t">${metodo(p.method)?.name || p.method}</div><div class="s">${p.at}${p.rate ? ' · tasa ' + p.rate : ''}${p.igtf ? ' · IGTF ' + (p.cur === 'USD' ? fmt(p.igtf) : fmt(p.igtf * (p.rate || invRate(i)), 'VES')) : ''}</div></div><div class="end">${fmt(p.amount, p.cur)}</div></div>`).join('') || '<div class="empty">Sin cobros.</div>'}</div></div>
    <div><h3 class="small muted" style="margin:0 0 6px">Insumos descontados</h3><div class="list">${used.map(m => `<div class="row"><div class="grow"><div class="t">${esc(m.name)} ×${-m.qty}</div><div class="s">Lote ${esc(m.lots)}</div></div><div class="end">${fmt(m.cost)}</div></div>`).join('') || '<div class="empty">Sin insumos.</div>'}</div></div></div>`,
    `${i.status !== 'pagada' ? `<span class="note">Pendiente ${bsOf(invDue(i), i)}</span>` : ''}${isFiscal(i) ? '' : `<button class="btn" data-act="emitFiscal" data-id="${i.id}">Emitir factura fiscal</button>`}<button class="btn" data-act="showDoc" data-kind="invoice" data-id="${i.id}">${isFiscal(i) ? 'Imprimir factura (PDF)' : i.status === 'pagada' ? 'Imprimir recibo (PDF)' : 'Imprimir nota de cobro (PDF)'}</button>${i.status !== 'pagada' ? `<button class="btn primary" data-act="payInvoice" data-id="${i.id}">Cobrar</button>` : ''}`, { wide: true });
};

ACTIONS.emitFiscal = el => openFacturaIssue({ id: el.dataset.id });

// Texto CSV (separado por ;) para Excel; lo usa Contabilidad
const toCSV = rows => rows.map(r => r.map(v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\n');

// ---------- Ajustes ----------
VIEWS.ajustes = () => {
  const c = S.backupCfg; const th = getTheme(); const cl = S.clinic;
  return header('Ajustes', 'Apariencia, tasa, datos de la clínica, respaldos e historial') +
  `<div class="card" style="margin-bottom:16px"><div class="between"><div><h2 style="margin:0">Apariencia</h2><div class="small muted">Modo día (fondo blanco) o modo noche (fondo negro).</div></div>
    ${themeSeg('setTheme')}</div></div>
  <div class="grid g2">
    <div class="card"><h2>Tasa del dólar (BCV)</h2>
      <div class="kpi"><div class="val">${fmt(S.rate, 'VES')}</div><div class="sub">por USD · fecha valor ${fdate(S.rateDate)} · ${esc(S.rateSource)}</div></div>
      <div class="small muted" style="margin-top:6px">Se actualiza sola desde el BCV al abrir el software y cada hora. Sábado y domingo se usa la tasa del lunes.${(() => { const n = Object.keys(S.rates || {}).sort().filter(f => f > S.rateDate).pop(); return n ? ` Ya publicada la del ${fdate(n)}: ${fmt(S.rates[n], 'VES')}.` : ''; })()}</div>
      <div class="hstack" style="margin:12px 0"><button class="btn primary" data-act="fetchRate">Actualizar desde BCV</button><span class="small muted" id="rate-msg"></span></div>
      <div class="form"><div class="field"><label for="aj-r">Corregir a mano (Bs por USD)</label><input class="input" type="number" step="0.01" id="aj-r" value="${S.rate}"></div>
      <div class="field"><label for="aj-g">IGTF % (pagos en divisas)</label><input class="input" type="number" step="0.5" id="aj-g" value="${S.igtfRate}"></div>
      <div class="field"><label for="aj-u">Usuario de esta sesión</label><input class="input" id="aj-u" value="${esc(S.user)}"></div></div>
      <div class="small muted" style="margin:10px 0">Cada cobro guarda la tasa del momento: cambiarla no altera cobros anteriores.</div>
      <button class="btn" data-act="saveSettings">Guardar</button></div>
    <div class="card"><h2>Datos de la clínica <small>salen en presupuestos y facturas</small></h2><div class="form">
      <div class="field full"><label for="cl-n">Razón social</label><input class="input" id="cl-n" value="${esc(cl.name)}"></div>
      <div class="field"><label for="cl-r">RIF</label><input class="input" id="cl-r" value="${esc(cl.rif)}"></div>
      <div class="field"><label for="cl-t">Teléfono</label><input class="input" id="cl-t" value="${esc(cl.phone)}"></div>
      <div class="field full"><label for="cl-a">Dirección fiscal</label><input class="input" id="cl-a" value="${esc(cl.address)}"></div>
      <div class="field full"><label for="cl-e">Correo</label><input class="input" id="cl-e" value="${esc(cl.email)}"></div>
      <div class="field full"><label for="cl-x">Nota al pie</label><input class="input" id="cl-x" value="${esc(cl.note)}"></div></div>
      <div style="margin-top:12px"><button class="btn" data-act="saveClinic">Guardar datos</button></div></div>
  </div>
  ${role() === 'admin' ? facturaSettingsCard() : ''}
  ${backupCard()}
  <div class="sec"><h3>Historial de acciones</h3><div class="list">${S.audit.slice(0, 40).map(a => `<div class="row"><div class="grow"><div class="t">${esc(a.action)}</div><div class="s">${esc(a.ref)}</div></div><div class="end small muted">${a.at}<br>${esc(a.user)}</div></div>`).join('')}</div></div>
  <div class="sec card" style="display:grid;gap:12px"><div><b>Datos de trabajo</b><div class="small muted">${S.cleanStart ? `Empezó en limpio el ${fdate(S.cleanStart)}: los datos son los suyos.` : 'Ahora hay <b>datos de ejemplo</b> (pacientes, inventario, cobros, historias…) para practicar.'} Por ahora se guardan solo en este navegador.</div></div>
    <div class="hstack">${S.cleanStart ? '' : '<button class="btn primary" data-act="askClean">Empezar en limpio con mis datos</button>'}<button class="btn danger" data-act="askReset">Volver a los datos de ejemplo</button></div></div>`;
};
ACTIONS.setTheme = el => { setTheme(el.dataset.k); render(); };
// ---------- Tasa BCV automática ----------
// El servidor local lee la tasa publicada en bcv.org.ve (/__tasa) con su "fecha valor"; cada tasa se guarda por fecha valor
// en S.rates. Se usa la MISMA tasa que muestra la página del BCV: la última publicada (en la tarde el BCV ya muestra la
// del día hábil siguiente, y desde ese momento el software usa esa). Sin el servidor local (p. ej. en Vercel) se consulta
// DolarAPI, que replica la tasa oficial del BCV.
function applyRate(why) {
  const rates = S.rates || {};
  const day = Object.keys(rates).sort().pop();   // la última publicada por el BCV
  if (!day) return false;
  const r = rates[day]; if (r === S.rate && S.rateDate === day) return false;
  const old = S.rate; S.rate = r; S.rateDate = day; S.rateSource = 'BCV (automática, igual a bcv.org.ve)';
  log('Tasa BCV actualizada', `${old} → ${r} · fecha valor ${fdate(day)}${why ? ' · ' + why : ''}`); return true;
}
async function fetchBCV() {
  let j = null;
  try { const r = await fetch('/__tasa', { cache: 'no-store' }); const x = await r.json(); if (r.ok && x.rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(x.fechaValor)) j = x; } catch (e) {}
  if (!j) {   // respaldo: DolarAPI (tasa oficial BCV)
    const r = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' }); const x = await r.json();
    const rate = +x.promedio; const day = String(x.fechaActualizacion || '').slice(0, 10);
    if (!r.ok || !(rate > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('sin tasa');
    j = { rate, fechaValor: day, fuente: 'DolarAPI' };
  }
  S.rates = S.rates || {}; S.rates[j.fechaValor] = r2(j.rate * 10000) / 10000; return j;
}
async function autoRate(manual) {
  try { const j = await fetchBCV(); const changed = applyRate(); save();
    if (manual || changed) { render(); toast(changed ? `Tasa BCV: ${fmt(S.rate, 'VES')} (fecha valor ${fdate(S.rateDate)})` : `La tasa ya está al día: ${fmt(S.rate, 'VES')}`); }
    return j;
  } catch (e) { if (applyRate()) { save(); render(); } if (manual) throw e; }
}
ACTIONS.fetchRate = async () => {
  const msg = document.getElementById('rate-msg'); msg.textContent = 'Consultando al BCV…';
  try { await autoRate(true); } catch (e) { msg.textContent = 'No se pudo consultar al BCV (sin internet o la página cambió). Puede corregirla a mano.'; }
};
// Al abrir el software y cada hora (solo con sesión iniciada)
setTimeout(() => { if (S.session) autoRate(false); }, 4000);
setInterval(() => { if (S.session) autoRate(false); }, 60 * 60 * 1000);
ACTIONS.saveSettings = () => { const r = num('aj-r'); if (r <= 0) { toast('La tasa debe ser mayor que cero'); return; } if (r !== S.rate) { log('Tasa corregida a mano', `${S.rate} → ${r}`); S.rate = r; S.rateDate = dAt(0); S.rateSource = 'Corrección manual'; } S.igtfRate = num('aj-g'); S.user = val('aj-u').trim() || 'Recepción'; save(); render(); toast('Ajustes guardados'); };
ACTIONS.saveClinic = () => { S.clinic = { name: val('cl-n').trim() || 'Clínica Quirón', rif: val('cl-r').trim(), phone: val('cl-t').trim(), address: val('cl-a').trim(), email: val('cl-e').trim(), note: val('cl-x').trim() }; log('Datos de la clínica actualizados', S.clinic.rif); save(); toast('Datos guardados'); };
ACTIONS.askReset = () => openSheet('Volver a los datos de ejemplo', '<p>Se borrarán <b>todos</b> los datos de este navegador, incluidos los que haya cargado, y volverán los datos de ejemplo. Los usuarios se conservan.</p><p class="small muted">Descargue antes una copia de seguridad si quiere conservar lo cargado.</p>', '<button class="btn" data-act="close">Cancelar</button><button class="btn danger" data-act="doReset">Restablecer</button>');
ACTIONS.doReset = () => { resetDemo(); closeSheet(); UI.agendaDay = null; go('inicio', null, { root: true }); toast('Datos restablecidos'); };

// Emisión sobre hojas físicas y calibración administrativa.
function facturaSettingsCard() {
  const c = facturaCalibration();
  return '<div class="card sec"><h2>Impresión de facturas</h2><p>Use papel Carta y tamaño real (100%), sin ajustar a página. Los desplazamientos positivos mueven los datos a la derecha y hacia abajo.</p><div class="form"><div class="field"><label for="fp-x">Desplazamiento horizontal (mm)</label><input class="input" id="fp-x" type="number" step="0.1" min="-20" max="20" value="'+c.x+'"></div><div class="field"><label for="fp-y">Desplazamiento vertical (mm)</label><input class="input" id="fp-y" type="number" step="0.1" min="-20" max="20" value="'+c.y+'"></div></div><div class="hstack"><button class="btn" data-act="facturaConfigSave">Guardar calibración</button><button class="btn" data-act="facturaTest">Imprimir página de prueba</button><button class="btn" data-act="facturaVoid">Hoja dañada / anulada</button></div><p class="small muted">Las marcas de prueba se imprimen solo en la página de calibración.</p>'+facturaVoidHistory()+'</div>';
}
function facturaVoidHistory(id) {
  const rows=(S.facturaVoids || []).filter(x => !id || x.invoice === id);
  return rows.length ? '<details><summary>Hojas dañadas / anuladas ('+rows.length+')</summary>'+rows.map(x=>'<p class="small">Control '+esc(x.control)+' · '+esc(x.at)+' · '+esc(x.reason)+'</p>').join('')+'</details>' : '';
}
ACTIONS.facturaConfigSave = () => {
  if (role() !== 'admin') return false;
  const x=Number(val('fp-x')), y=Number(val('fp-y'));
  if (![x,y].every(n=>Number.isFinite(n) && Math.abs(n)<=20)) { toast('Indique desplazamientos entre -20 y 20 mm.'); return false; }
  S.facturaPrint={x,y}; save(); toast('Calibración guardada'); return true;
};
ACTIONS.facturaTest = async () => {
  if (role() !== 'admin' || !pdfReady() || !ACTIONS.facturaConfigSave()) return;
  const inv={date:dAt(0),buyer:{name:'María Peña González',ci:'V-12345678',address:'Av. Principal, Caracas',phone:'0412-1234567'},rate:S.rate,items:[{name:'Consulta médica de demostración',price:20,qty:1},{name:'Evaluación y atención · prueba de alineación',price:30}],disc:0,payments:[],status:'pagada'};
  await pdfSave(pdfFacturaPrint(inv,true),'Calibración de factura - prueba.pdf');
};
function openFacturaIssue(context) {
  if (!canSee('contabilidad') || !pdfReady()) return;
  UI.facturaIssue = context;
  const inv=context.draft || byId(S.invoices,context.id), p=inv.buyer || pat(inv.pid), pages=facturaPages(inv).length;
  const existing=context.replace ? [] : inv.sheets || [];
  openSheet('Registrar hojas de factura', '<div class="banner">'+(pages>1 ? 'Los renglones requieren '+pages+' hojas. Registre un control por hoja, en el orden de impresión. Los totales se imprimen en la última.' : 'Registre el número que ya viene impreso en la hoja.')+'</div><div class="form">'+Array.from({length:pages},(_,i)=>'<div class="field"><label for="fi-c'+i+'">N° de control de la hoja usada '+(i+1)+' *</label><input class="input" id="fi-c'+i+'" required value="'+esc(existing[i]?.control || '')+'"></div><div class="field"><label for="fi-n'+i+'">N° de factura impreso '+(i+1)+' (opcional)</label><input class="input" id="fi-n'+i+'" value="'+esc(existing[i]?.printedNumber || '')+'"></div>').join('')+
    '<div class="field"><label for="fi-name">Nombre y apellido o razón social *</label><input class="input" id="fi-name" value="'+esc(p.name)+'"></div><div class="field"><label for="fi-ci">C.I. / RIF *</label><input class="input" id="fi-ci" value="'+esc(p.ci)+'"></div><div class="field full"><label for="fi-address">Dirección fiscal *</label><input class="input" id="fi-address" value="'+esc(p.address || '')+'"></div><div class="field"><label for="fi-phone">Teléfono</label><input class="input" id="fi-phone" value="'+esc(p.phone || '')+'"></div><div class="field"><label for="fi-place">Lugar de emisión *</label><input class="input" id="fi-place" value="'+esc(inv.place || 'Caracas')+'"></div><div class="field"><label for="fi-terms">Condiciones de pago *</label><input class="input" id="fi-terms" value="'+esc(inv.paymentTerms || (inv.status === 'pagada' ? 'Contado' : 'Crédito'))+'"></div></div>'+(context.replace?'<div class="field"><label for="fi-reason">Motivo de anulación de las hojas anteriores *</label><input class="input" id="fi-reason"></div>':''),
    '<span id="fi-msg" class="note"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="facturaIssueSave">Registrar y continuar</button>', {wide:true});
}
ACTIONS.facturaIssueSave = () => {
  if (!canSee('contabilidad')) return;
  const c=UI.facturaIssue; if(!c) return;
  const inv=c.draft || byId(S.invoices,c.id), sheets=Array.from({length:facturaPages(inv).length},(_,i)=>({control:val('fi-c'+i).trim(),printedNumber:val('fi-n'+i).trim()}));
  const error=facturaSheetError(sheets,c.replace ? undefined : c.id), msg=document.getElementById('fi-msg');
  if(error) {msg.textContent=error;return;}
  const details={buyer:{name:val('fi-name').trim(),ci:val('fi-ci').trim(),address:val('fi-address').trim(),phone:val('fi-phone').trim()},place:val('fi-place').trim(),paymentTerms:val('fi-terms').trim()};
  if(!details.buyer.name || !details.buyer.ci || !details.buyer.address || !details.place || !details.paymentTerms) {msg.textContent='Complete los datos fiscales obligatorios.';return;}
  if(c.replace && !val('fi-reason').trim()) {msg.textContent='Indique el motivo de anulación.';return;}
  try { facturaCommands({...inv,...details}); } catch(e) {msg.textContent=e.message;return;}
  if(c.draft) { UI.at.sheets=sheets; UI.at.fiscalDetails=details; UI.facturaIssue=null; ACTIONS.saveAttention({dataset:c.attentionPay?{pay:'1'}:{}}); return; }
  if(c.replace) {
    (inv.sheets || [{control:inv.control}]).filter(h=>h.control).forEach(h=>S.facturaVoids.push({...h,invoice:inv.id,at:nowStamp(),reason:val('fi-reason').trim(),by:S.user}));
  }
  if(isFiscal(inv)) { Object.assign(inv,details,{sheets,control:sheets[0].control}); }
  else emitFiscal(inv,sheets,details);
  log(c.replace?'Hojas de factura anuladas y reemplazadas':'Hojas de factura registradas',inv.num+' · '+sheets.map(h=>h.control).join(', '));
  save(); UI.facturaIssue=null; render(); ACTIONS.showDoc({dataset:{kind:'invoice',id:inv.id}});
};
ACTIONS.facturaReplace = el => openFacturaIssue({id:el.dataset.id,replace:true});
ACTIONS.facturaVoid = () => {
  if(!canSee('contabilidad')) return;
  openSheet('Hoja dañada / anulada','<div class="field"><label for="fv-control">N° de control *</label><input class="input" id="fv-control"></div><div class="field"><label for="fv-number">N° de factura impreso (opcional)</label><input class="input" id="fv-number"></div><div class="field"><label for="fv-reason">Motivo *</label><input class="input" id="fv-reason"></div>', '<span class="note" id="fv-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="facturaVoidSave">Registrar hoja anulada</button>');
};
ACTIONS.facturaVoidSave = () => {
  if(!canSee('contabilidad')) return;
  const sheet={control:val('fv-control').trim(),printedNumber:val('fv-number').trim()}, error=facturaSheetError([sheet]);
  if(error || !val('fv-reason').trim()) {document.getElementById('fv-msg').textContent=error || 'Indique el motivo.';return;}
  S.facturaVoids.push({...sheet,reason:val('fv-reason').trim(),at:nowStamp(),by:S.user}); log('Hoja dañada / anulada',sheet.control);save();closeSheet();render();
};
