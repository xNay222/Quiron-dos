// Panel de contabilidad: entradas y salidas, con dólares y bolívares contados por separado.

const ACCT_PERIODS = [['hoy', 'Hoy'], ['semana', '7 días'], ['mes', 'Este mes'], ['mesant', 'Mes anterior'], ['anio', 'Este año']];
function acctRange(k) {
  const y = TODAY.getFullYear(), m = TODAY.getMonth();
  if (k === 'hoy') return [dAt(0), dAt(0)];
  if (k === 'semana') return [dAt(-6), dAt(0)];
  if (k === 'mesant') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
  if (k === 'anio') return [iso(new Date(y, 0, 1)), dAt(0)];
  return [iso(new Date(y, m, 1)), dAt(0)];
}
const kShort = v => Math.abs(v) >= 1000 ? '$' + (v / 1000).toLocaleString('es-VE', { maximumFractionDigits: 1 }) + 'k' : '$' + Math.round(v);

function acctChart() {
  const data = acctMonthly(6); const max = Math.max(...data.flatMap(d => [d.in, d.out]), 1);
  const W = 600, H = 220, padL = 52, padB = 26, top0 = 18, bw = (W - padL) / data.length;
  const step = [1000, 2000, 5000, 10000, 20000, 50000].find(s => max / s <= 5) || 100000; const ymax = Math.ceil(max / step) * step;
  const y = v => top0 + (H - padB - top0) * (1 - v / ymax); const ticks = []; for (let v = 0; v <= ymax; v += step) ticks.push(v);
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Entradas y salidas por mes en dólares">
    ${ticks.map(v => `<line x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--fg2)">${kShort(v)}</text>`).join('')}
    ${data.map((d, i) => { const x0 = padL + i * bw + bw * 0.16, w = bw * 0.32; const last = i === data.length - 1;
      return `<rect x="${x0}" y="${y(d.in)}" width="${w}" height="${Math.max(0, y(0) - y(d.in))}" rx="4" fill="var(--good)" opacity="${last ? 1 : .55}"/>
      <rect x="${x0 + w + 3}" y="${y(d.out)}" width="${w}" height="${Math.max(0, y(0) - y(d.out))}" rx="4" fill="var(--bad)" opacity="${last ? 1 : .55}"/>
      <text x="${x0 + w + 1.5}" y="${H - 8}" text-anchor="middle" font-size="11.5" fill="var(--fg2)" font-weight="${last ? 600 : 400}">${d.label}</text>`; }).join('')}
  </svg></div><div class="legend" style="margin-top:6px"><span><span class="dot" style="color:var(--good);display:inline-block"></span> Entradas</span><span><span class="dot" style="color:var(--bad);display:inline-block"></span> Salidas</span><span>En USD; los Bs se convierten a la tasa del día de cada movimiento</span></div>`;
}

function catBreakdown(list, type) {
  const g = {}; list.filter(m => m.type === type).forEach(m => { const c = g[m.cat] = g[m.cat] || { usd: 0, USD: 0, VES: 0 }; c.usd += usdOf(m); c[m.cur] += m.amount; });
  const rows = Object.entries(g).sort((a, b) => b[1].usd - a[1].usd); const max = rows[0]?.[1].usd || 1;
  return rows.length ? `<ol class="rank">${rows.map(([k, v]) => `<li><div style="min-width:0;flex:1;display:grid;gap:3px"><div class="between small"><span class="t">${esc(k)}</span><b style="font-weight:600">≈ ${fmt(v.usd)}</b></div>
    <div class="muted" style="font-size:12px">${[v.USD ? fmt(v.USD) : '', v.VES ? fmt(v.VES, 'VES') : ''].filter(Boolean).join(' + ')}</div>
    <div class="bar"><span style="width:${v.usd / max * 100}%;background:var(${type === 'entrada' ? '--good' : '--bad'})"></span></div></div></li>`).join('')}</ol>` : '<div class="empty">Sin movimientos en el período.</div>';
}

function acctResumen() {
  const per = UI.acP || 'mes'; const [from, to] = acctRange(per); const all = acctMoves(from, to); const t = acctTotals(all);
  const ft = UI.acT || 'todos', fc = UI.acC || 'todas';
  const list = all.filter(m => (ft === 'todos' || m.type === ft) && (fc === 'todas' || m.cur === fc));
  const net = (v, cur) => `<span style="color:${v >= 0 ? 'var(--good)' : 'var(--bad)'}">${v < 0 ? '-' : ''}${fmt(Math.abs(v), cur)}</span>`;
  const curCard = (cur, title) => `<div class="card"><h2>${title} <small>${cur === 'VES' ? 'solo digitales' : 'efectivo, Zelle y transferencias'}</small></h2>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
      <div class="kpi"><div class="lab">Entradas</div><div class="val" style="font-size:22px;color:var(--good)">${fmt(t[cur].in, cur)}</div></div>
      <div class="kpi"><div class="lab">Salidas</div><div class="val" style="font-size:22px;color:var(--bad)">${fmt(t[cur].out, cur)}</div></div>
      <div class="kpi"><div class="lab">Saldo</div><div class="val" style="font-size:22px">${net(t[cur].net, cur)}</div></div></div>
    ${cur === 'VES' ? `<div class="small muted" style="margin-top:8px">Equivale a ≈ ${fmt(all.filter(m => m.cur === 'VES').reduce((a, m) => a + (m.type === 'entrada' ? 1 : -1) * usdOf(m), 0))} a la tasa de cada día · hoy ${fmt(t.VES.net / S.rate)} a tasa BCV ${S.rate.toLocaleString('es-VE', { maximumFractionDigits: 4 })}</div>` : ''}</div>`;
  return `<div class="sec" style="margin:0 0 22px">${walletCards()}</div><div class="small muted" style="margin:-6px 0 10px">Entradas y salidas del ${fdate(from)}${from !== to ? ' al ' + fdate(to) : ''}</div>
  <div class="seg" role="group" aria-label="Período" style="margin-bottom:16px">${ACCT_PERIODS.map(([k, l]) => `<button data-act="acP" data-k="${k}" aria-pressed="${per === k}">${l}</button>`).join('')}</div>
  <div class="grid g2">${curCard('USD', 'Dólares')}${curCard('VES', 'Bolívares')}</div>
  <div class="grid g4 sec">${kpi('Entradas totales', fmt(t.usdIn), 'USD + Bs convertidos')}${kpi('Salidas totales', fmt(t.usdOut), 'USD + Bs convertidos')}${kpi('Resultado', fmt(t.usdNet), t.usdIn ? `margen ${Math.round(t.usdNet / t.usdIn * 100)}%` : '', t.usdNet < 0 ? 'alert' : '')}${kpi('Movimientos', all.length, `${all.filter(m => m.auto && m.auto !== '').length} automáticos`)}</div>
  <div class="card sec"><h2>Entradas y salidas por mes <small>últimos 6 meses</small></h2>${acctChart()}</div>
  <div class="grid g2 sec" style="align-items:start"><div class="card"><h2>Entradas por categoría</h2>${catBreakdown(all, 'entrada')}</div><div class="card"><h2>Salidas por categoría</h2>${catBreakdown(all, 'salida')}</div></div>
  <div class="between sec" style="margin-bottom:12px"><h3 style="margin:0;font-size:20px;letter-spacing:-.01em">Movimientos</h3><div class="hstack">
    <div class="seg" role="group" aria-label="Tipo">${[['todos', 'Todos'], ['entrada', 'Entradas'], ['salida', 'Salidas']].map(([k, l]) => `<button data-act="acT" data-k="${k}" aria-pressed="${ft === k}">${l}</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="Moneda">${[['todas', 'USD y Bs'], ['USD', 'USD'], ['VES', 'Bs']].map(([k, l]) => `<button data-act="acC" data-k="${k}" aria-pressed="${fc === k}">${l}</button>`).join('')}</div></div></div>
  <div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Método</th><th>Origen</th><th class="num">Monto</th><th class="num">Tasa</th><th class="num">≈ USD</th></tr></thead><tbody>
  ${list.slice(0, 150).map(m => `<tr ${m.invId ? `style="cursor:pointer" data-act="openInvoice" data-id="${m.invId}" title="Ver la cuenta y su factura"` : !m.auto || ['Caja', 'Recurrente'].includes(m.auto) ? `style="cursor:pointer" data-act="acctOpen" data-id="${m.id}"` : ''}><td>${fdate(m.date)}</td><td style="white-space:normal;min-width:180px">${esc(m.concept)}${m.example ? ' <span class="pill">ejemplo</span>' : ''}</td><td class="muted">${esc(m.cat)}</td><td class="muted">${esc(m.method)}</td>
    <td>${m.invId ? (isFiscal(byId(S.invoices, m.invId) || {}) ? '<span class="pill good">Con factura</span>' : '<span class="pill warn">Sin factura</span>') : m.auto ? `<span class="pill info">${esc(m.auto)}</span>` : '<span class="pill">Manual</span>'}</td>
    <td class="num" style="color:${m.type === 'entrada' ? 'var(--good)' : 'var(--bad)'};font-weight:500">${m.type === 'entrada' ? '+' : '-'}${fmt(m.amount, m.cur)}</td><td class="num muted">${m.cur === 'VES' ? Number(m.rate).toLocaleString('es-VE') : '—'}</td><td class="num">${fmt(usdOf(m))}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Sin movimientos en este período.</td></tr>'}
  </tbody></table></div>
  <p class="small muted">Se registran solos: los cobros a pacientes y su IGTF, las compras confirmadas y los recurrentes una vez confirmados. Los meses anteriores son datos de ejemplo.</p>`;
}
ACTIONS.acP = el => { UI.acP = el.dataset.k; render(); };
ACTIONS.acT = el => { UI.acT = el.dataset.k; render(); };
ACTIONS.acC = el => { UI.acC = el.dataset.k; render(); };

// ---------- Registrar entrada o salida ----------
function acctForm() {
  const f = UI.acF;
  return `<div class="seg" role="group" aria-label="Tipo"><button data-act="acFType" data-k="entrada" aria-pressed="${f.type === 'entrada'}">Entrada</button><button data-act="acFType" data-k="salida" aria-pressed="${f.type === 'salida'}">Salida</button></div>
  <div class="form">
    <div class="field"><label for="ac-cat">Categoría</label><select class="input" id="ac-cat">${ACCT_CATS[f.type].map(c => `<option ${f.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div class="field"><label for="ac-date">Fecha</label><input class="input" type="date" id="ac-date" value="${f.date}"></div>
    <div class="field full"><label for="ac-con">Concepto</label><input class="input" id="ac-con" value="${esc(f.concept)}" placeholder="${f.type === 'entrada' ? 'Ej. Subarriendo del laboratorio, octubre' : 'Ej. Pago de Corpoelec'}"></div>
    <div class="field"><label>Moneda</label><div class="seg" role="group" aria-label="Moneda"><button data-act="acFCur" data-k="USD" aria-pressed="${f.cur === 'USD'}">Dólares</button><button data-act="acFCur" data-k="VES" aria-pressed="${f.cur === 'VES'}">Bolívares</button></div></div>
    <div class="field"><label for="ac-met">Método</label><select class="input" id="ac-met">${ACCT_METHODS[f.cur].map(m => `<option>${m}</option>`).join('')}</select></div>
    <div class="field"><label for="ac-fund">Fondo</label><select class="input" id="ac-fund"><option value="">Según el método</option>${FUNDS.filter(x => x.cur === f.cur || (f.cur === 'USD' && x.cur === 'USDT')).map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="ac-amt">Monto en ${f.cur === 'USD' ? 'dólares' : 'bolívares'}</label><input class="input" type="number" min="0" step="0.01" id="ac-amt" value="${f.amount || ''}" data-in="acAmt"></div>
    <div class="field"><label for="ac-ref">Referencia (opcional)</label><input class="input" id="ac-ref" placeholder="Nº de operación o factura"></div>
    <div class="field"><label for="ac-rate">Tasa BCV del día de la operación</label><input class="input" type="number" min="0" step="0.01" id="ac-rate" value="${f.rate || S.rate}" data-in="acAmt"></div>
    <div class="full small muted" id="ac-eq">${acEq(f.amount, f.cur)}</div></div>
  ${f.type === 'salida' ? '<div class="small muted">Las compras de inventario se registran solas al confirmar las órdenes; usa esta opción para cualquier otro gasto.</div>' : '<div class="small muted">Los cobros a pacientes entran solos al cobrar una factura; usa esta opción para otros ingresos.</div>'}`;
}
const acEq = (a, cur, rt = S.rate) => a > 0 && rt > 0 ? (cur === 'USD' ? `Equivale a ${fmt(a * rt, 'VES')} a tasa ${rt.toLocaleString('es-VE')}` : `Equivale a ${fmt(a / rt)} a tasa ${rt.toLocaleString('es-VE')} (la tasa queda guardada)`) : '';
const acKeep = () => { const f = UI.acF; f.cat = val('ac-cat'); f.date = val('ac-date'); f.concept = val('ac-con'); f.amount = num('ac-amt'); f.rate = num('ac-rate'); };
ACTIONS.acctNew = el => {
  const type = el.dataset.t || 'entrada'; UI.acF = { type, cat: ACCT_CATS[type][type === 'entrada' ? 1 : 2], date: dAt(0), concept: '', cur: 'USD', amount: 0 };
  openSheet('Registrar movimiento', acctForm(), `<span class="note" id="ac-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="acctSave">Guardar</button>`);
};
ACTIONS.acFType = el => { acKeep(); UI.acF.type = el.dataset.k; UI.acF.cat = ACCT_CATS[el.dataset.k][0]; refreshSheet(acctForm()); };
ACTIONS.acFCur = el => { acKeep(); UI.acF.cur = el.dataset.k; refreshSheet(acctForm()); };
ACTIONS.acAmt = () => { document.getElementById('ac-eq').textContent = acEq(num('ac-amt'), UI.acF.cur, num('ac-rate')); };
ACTIONS.acctSave = () => {
  acKeep(); const f = UI.acF; const msg = document.getElementById('ac-msg');
  if (!f.concept.trim()) { msg.textContent = 'Escribe el concepto.'; return; }
  if (!(f.amount > 0)) { msg.textContent = 'El monto debe ser mayor que cero.'; return; }
  if (!(f.rate > 0)) { msg.textContent = 'Indique la tasa BCV del día de la operación.'; return; }
  addLedger({ date: f.date || dAt(0), type: f.type, cat: f.cat, concept: f.concept.trim(), amount: f.amount, cur: f.cur, method: val('ac-met'), ref: val('ac-ref').trim(), rate: f.rate, fund: val('ac-fund') });
  closeSheet(); render(); toast(`${f.type === 'entrada' ? 'Entrada' : 'Salida'} registrada · ${fmt(f.amount, f.cur)}`);
};
ACTIONS.acctVoid = el => { const g = S.ledger.find(x => x.id === el.dataset.id); g.void = true; log('Movimiento anulado', `${g.concept} · ${fmt(g.amount, g.cur)}`); save(); closeSheet(); render(); toast('Movimiento anulado'); };
ACTIONS.acctDownload = async () => {
  const [from, to] = acctRange(UI.acP || 'mes');
  const rows = [['Fecha', 'Tipo', 'Categoría', 'Concepto', 'Método', 'Moneda', 'Monto', 'Tasa Bs/USD', 'Equivalente USD', 'Origen']].concat(acctMoves(from, to).map(m => [m.date, m.type, m.cat, m.concept, m.method, m.cur === 'VES' ? 'Bs' : 'USD', String(m.amount).replace('.', ','), String(m.rate).replace('.', ','), String(r2(usdOf(m))).replace('.', ','), m.auto || 'Manual']));
  const csv = '﻿' + toCSV(rows); const dl = await getCap('downloads');
  toast(await saveFile(`Contabilidad Quiron ${from} a ${to}.csv`, csv, 'text/csv') ? 'Archivo guardado' : 'No se pudo guardar el archivo');
};

// ---------- Contabilidad: Resumen · Por confirmar · Recurrentes ----------
VIEWS.contabilidad = () => {
  const pend = navCount('contabilidad'); const openInv = S.invoices.filter(invOpen).length;
  const tabs = [['resumen', 'Resumen'], ['confirmar', `Por confirmar${pend ? ` (${pend})` : ''}`], ['facturas', `Cobros${openInv ? ` (${openInv} pendientes)` : ''}`], ['recurrentes', 'Recurrentes']];
  const tab = tabs.some(t => t[0] === UI.acTab) ? UI.acTab : (pend ? 'confirmar' : 'resumen');
  const actions = tab === 'recurrentes' ? `<button class="btn primary" data-act="recEdit">+ Nuevo recurrente</button>`
    : tab === 'facturas' ? `<button class="btn" data-act="facturaVoid">Hoja dañada / anulada</button><button class="btn primary" data-act="newAttention">+ Cobro directo</button>`
    : `<button class="btn" data-act="acctDownload">Descargar Excel</button><button class="btn" data-act="acctNew" data-t="salida">Registrar salida</button><button class="btn primary" data-act="acctNew" data-t="entrada">Registrar entrada</button>`;
  return header('Contabilidad', 'Entradas y salidas de la clínica, en dólares y en bolívares', actions) +
    `<div class="seg" role="group" aria-label="Secciones" style="margin-bottom:16px">${tabs.map(([k, l]) => `<button data-act="acTab" data-k="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>` +
    (tab === 'confirmar' ? confirmView() : tab === 'facturas' ? invoicesView() : tab === 'recurrentes' ? recurView() : acctResumen());
};
ACTIONS.acTab = el => { UI.acTab = el.dataset.k; render(); };

// Órdenes de compra que el almacén envió y Contabilidad debe confirmar (pagar) o rechazar
function confirmView() {
  const pend = S.orders.filter(o => o.status === 'por_aprobar');
  const recent = S.orders.filter(o => o.payment || o.status === 'rechazada').slice(-6).reverse();
  const card = o => `<div class="card"><div class="between"><div><b>${esc(o.num)} · ${esc(sup(o.sup).name)}</b><div class="small muted">Pedida por ${esc(o.by || 'Almacén')} el ${fdate(o.date)}${o.note ? ' · ' + esc(o.note) : ''}</div></div><div style="font-size:20px;font-weight:600">${fmt(ocTotal(o))}</div></div>
    <div class="small" style="margin:8px 0">${o.lines.map(l => `${esc(prod(l.pid).name)} ×${l.qty}`).join(' · ')}</div>
    <div class="hstack" style="justify-content:flex-end"><button class="btn sm" data-act="openOrder" data-id="${o.id}">Ver detalle</button><button class="btn sm danger" data-act="ocReject" data-id="${o.id}">Rechazar</button><button class="btn sm primary" data-act="ocApprove" data-id="${o.id}">Confirmar y registrar pago</button></div></div>`;
  const bSent = S.budgets.filter(b => ['enviado', 'aceptado'].includes(b.status));
  const bCard = b => `<div class="card"><div class="between"><div><b>${esc(b.num)} · ${esc(pat(b.pid).name)}</b><div class="small muted">${esc(b.proc || '')} · ${b.sentAt ? fdate(b.sentAt.slice(0, 10)) : fdate(b.date)}</div></div><b>${fmt(budgetTotals(b).total)}</b></div><div class="hstack" style="justify-content:flex-end;margin-top:8px"><button class="btn sm" data-act="openBudget" data-id="${b.id}">Ver detalle</button><button class="btn sm danger" data-act="budReject" data-id="${b.id}">No pagado / rechazado</button><button class="btn sm primary" data-act="budAccept" data-id="${b.id}">Pago recibido</button></div></div>`;
  return `${duesSection()}<div class="sec"><h3>Presupuestos enviados a Contabilidad</h3><div class="small muted" style="margin-bottom:10px">Registre el monto recibido o indique que no se pagó / fue rechazado. La factura fiscal es opcional y puede emitirse desde la cuenta.</div><div class="stack">${bSent.map(bCard).join('') || '<div class="card empty">No hay presupuestos esperando.</div>'}</div></div>
    <div class="sec"><h3>Órdenes de compra</h3><div class="small muted" style="margin:-4px 0 10px">El almacén crea las órdenes de compra. Al confirmarlas se registra el pago como salida y el almacén ya puede recibir la mercancía.</div>
    <div class="stack">${pend.map(card).join('') || '<div class="card empty">No hay órdenes de compra esperando confirmación.</div>'}</div></div>
    ${recent.length ? `<div class="sec"><h3>Últimas confirmadas o rechazadas</h3><div class="list">${recent.map(o => `<button class="row" data-act="openOrder" data-id="${o.id}"><div class="grow"><div class="t">${esc(o.num)} · ${esc(sup(o.sup).name)}</div><div class="s">${o.payment ? `Pagada ${o.payment.at} · ${esc(o.payment.method)} ${fmt(o.payment.amount, o.payment.cur)}` : esc(o.reason || '')}</div></div><span class="pill ${OC_ST[o.status][1]}">${OC_ST[o.status][0]}</span></button>`).join('')}</div></div>` : ''}`;
}
const allMethods = () => [...ACCT_METHODS.USD.map(m => [m, 'USD']), ...ACCT_METHODS.VES.map(m => [m, 'VES'])];
ACTIONS.ocApprove = el => {
  const o = byId(S.orders, el.dataset.id); UI.ocp = { id: o.id };
  openSheet(`Confirmar ${o.num}`, `<div class="between"><div><b>${esc(sup(o.sup).name)}</b><div class="small muted">${o.lines.map(l => `${esc(prod(l.pid).name)} ×${l.qty}`).join(' · ')}</div></div><div style="font-size:22px;font-weight:600">${fmt(ocTotal(o))}</div></div>
    <div class="form"><div class="field"><label for="op-m">¿Cómo se pagó?</label><select class="input" id="op-m" data-ch="opMethod">${allMethods().map(([m, c]) => `<option value="${m}" data-cur="${c}">${m}</option>`).join('')}</select></div>
      <div class="field"><label for="op-a" id="op-al">Monto pagado (USD)</label><input class="input" type="number" min="0" step="0.01" id="op-a" value="${ocTotal(o).toFixed(2)}"></div>
      <div class="field"><label for="op-d">Fecha del pago</label><input class="input" type="date" id="op-d" value="${dAt(0)}"></div>
      <div class="field"><label for="op-r">Referencia (opcional)</label><input class="input" id="op-r" placeholder="Nº de transferencia"></div></div>
    <div class="small muted">Tasa BCV de hoy: ${S.rate.toLocaleString('es-VE', { maximumFractionDigits: 4 })} Bs/USD</div>`,
    `<span class="note" id="op-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="ocApproveSave">Confirmar orden</button>`);
};
ACTIONS.opMethod = () => { const o = byId(S.orders, UI.ocp.id); const cur = document.querySelector('#op-m option:checked').dataset.cur;
  document.getElementById('op-al').textContent = `Monto pagado (${cur === 'USD' ? 'USD' : 'Bs'})`; document.getElementById('op-a').value = (cur === 'USD' ? ocTotal(o) : ocTotal(o) * S.rate).toFixed(2); };
ACTIONS.ocApproveSave = () => {
  const o = byId(S.orders, UI.ocp.id); const amount = num('op-a'); if (!(amount > 0)) { document.getElementById('op-msg').textContent = 'Escribe el monto pagado.'; return; }
  const cur = document.querySelector('#op-m option:checked').dataset.cur;
  o.payment = { date: val('op-d') || dAt(0), at: nowStamp(), by: actor(), method: val('op-m'), cur, amount: r2(amount), rate: S.rate, ref: val('op-r').trim() }; o.status = 'aprobada';
  log('Orden de compra confirmada y pagada', `${o.num} · ${fmt(amount, cur)} · ${o.payment.method}`); save(); closeSheet(); render(); toast(`${o.num} confirmada · el almacén ya puede recibirla`);
};
ACTIONS.ocReject = el => openSheet('Rechazar orden de compra', `<div class="field"><label for="ocr-r">Motivo</label><input class="input" id="ocr-r" placeholder="Ej. no hay presupuesto este mes, pedir menos cantidad"></div>`,
  `<button class="btn" data-act="close">Cancelar</button><button class="btn danger" data-act="ocRejectSave" data-id="${el.dataset.id}">Rechazar</button>`);
ACTIONS.ocRejectSave = el => { const o = byId(S.orders, el.dataset.id); o.status = 'rechazada'; o.reason = val('ocr-r').trim() || 'Rechazada por contabilidad'; log('Orden de compra rechazada', `${o.num} · ${o.reason}`); save(); closeSheet(); render(); toast(`${o.num} rechazada`); };

// ---------- Recurrentes ----------
function recurView() {
  const list = S.recurring || []; const monthly = r => r.freq === 'quincenal' ? 2 : 1;
  const sum = (type, cur) => list.filter(r => r.active && r.type === type && r.cur === cur).reduce((s, r) => s + r.amount * monthly(r), 0);
  const row = r => { const nx = nextDue(r);
    return `<button class="row" data-act="recEdit" data-id="${r.id}"><span class="pill ${r.type === 'entrada' ? 'good' : 'bad'}" style="min-width:64px;justify-content:center">${r.type === 'entrada' ? 'Ingreso' : 'Gasto'}</span>
      <div class="grow"><div class="t">${esc(r.name)} ${r.active ? '' : '<span class="pill">Pausado</span>'}${r.example ? ' <span class="pill">ejemplo</span>' : ''}</div><div class="s">${RECUR_FREQ[r.freq]}${r.freq === 'mensual' ? ` · día ${r.day}` : ''} · ${esc(r.method)} · ${esc(r.cat)}</div></div>
      <div class="end"><div style="font-weight:600;color:${r.type === 'entrada' ? 'var(--good)' : 'var(--bad)'}">${fmt(r.amount, r.cur)}</div><div class="small muted">${r.active && nx ? 'próximo ' + fdate(nx) : ''}</div></div></button>`; };
  return `<div class="banner" style="margin-bottom:14px">En cada vencimiento aparecen en Contabilidad › Por confirmar con el monto de siempre; entran a la contabilidad solo cuando se confirma que el pago o el cobro se realizó. Para cambiar un monto, edite el recurrente: aplica desde el próximo vencimiento.</div>
    <div class="grid g4">${kpi('Ingresos fijos al mes', fmt(sum('entrada', 'USD')), sum('entrada', 'VES') ? '+ ' + fmt(sum('entrada', 'VES'), 'VES') : 'en dólares')}${kpi('Gastos fijos al mes', fmt(sum('salida', 'USD')), sum('salida', 'VES') ? '+ ' + fmt(sum('salida', 'VES'), 'VES') : 'en dólares')}${kpi('Recurrentes activos', list.filter(r => r.active).length)}</div>
    <div class="sec"><h3>Ingresos recurrentes</h3><div class="list">${list.filter(r => r.type === 'entrada').map(row).join('') || '<div class="empty">Sin ingresos recurrentes.</div>'}</div></div>
    <div class="sec"><h3>Gastos recurrentes</h3><div class="list">${list.filter(r => r.type === 'salida').map(row).join('') || '<div class="empty">Sin gastos recurrentes.</div>'}</div></div>`;
}
const recCats = type => ACCT_CATS[type].filter(c => !['Cobros a pacientes', 'Compras de inventario', 'Gastos de caja'].includes(c));
function recurForm(r) {
  return `<div class="seg" role="group" aria-label="Tipo"><button data-act="recType" data-k="salida" aria-pressed="${r.type === 'salida'}">Gasto</button><button data-act="recType" data-k="entrada" aria-pressed="${r.type === 'entrada'}">Ingreso</button></div>
  <div class="form"><div class="field full"><label for="rc-n">Nombre</label><input class="input" id="rc-n" value="${esc(r.name)}" placeholder="${r.type === 'entrada' ? 'Ej. Alquiler consultorio 3' : 'Ej. Alcaldía, Fospuca, internet'}"></div>
    <div class="field"><label for="rc-c">Categoría</label><select class="input" id="rc-c">${recCats(r.type).map(c => `<option ${c === r.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div class="field"><label for="rc-m">Método</label><select class="input" id="rc-m">${allMethods().map(([m, c]) => `<option value="${m}" data-cur="${c}" ${m === r.method ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
    <div class="field"><label for="rc-a">Monto (en la moneda del método)</label><input class="input" type="number" min="0" step="0.01" id="rc-a" value="${r.amount || ''}"></div>
    <div class="field"><label for="rc-f">¿Cada cuánto?</label><select class="input" id="rc-f" data-ch="recFreq"><option value="mensual" ${r.freq === 'mensual' ? 'selected' : ''}>Cada mes</option><option value="quincenal" ${r.freq === 'quincenal' ? 'selected' : ''}>Cada quincena (15 y último día)</option></select></div>
    <div class="field" id="rc-dayf" ${r.freq === 'quincenal' ? 'hidden' : ''}><label for="rc-d">Día del mes</label><input class="input" type="number" min="1" max="31" id="rc-d" value="${r.day || 1}"></div>
    <div class="field"><label for="rc-s">Desde</label><input class="input" type="date" id="rc-s" value="${r.start}"></div>
    <label class="hstack small full"><input type="checkbox" id="rc-on" ${r.active ? 'checked' : ''}> Activo (si lo desmarcas, deja de registrarse)</label></div>`;
}
ACTIONS.recEdit = el => {
  const r = el?.dataset?.id ? S.recurring.find(x => x.id === el.dataset.id) : null;
  UI.rc = r ? { ...r } : { id: null, name: '', type: 'salida', cat: 'Servicios (luz, agua, internet)', amount: 0, cur: 'USD', method: 'Transferencia USD', freq: 'mensual', day: 1, start: dAt(0), active: true };
  openSheet(r ? 'Editar recurrente' : 'Nuevo recurrente', recurForm(UI.rc), `<span class="note" id="rc-msg"></span>${r ? `<button class="btn danger" data-act="recDelete" data-id="${r.id}">Eliminar</button>` : ''}<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="recSave">Guardar</button>`);
};
const rcKeep = () => { const r = UI.rc; r.name = val('rc-n'); r.cat = val('rc-c'); r.method = val('rc-m'); r.cur = document.querySelector('#rc-m option:checked').dataset.cur; r.amount = num('rc-a'); r.freq = val('rc-f'); r.day = Math.min(31, Math.max(1, Math.round(num('rc-d') || 1))); r.start = val('rc-s') || dAt(0); r.active = document.getElementById('rc-on').checked; };
ACTIONS.recType = el => { rcKeep(); UI.rc.type = el.dataset.k; UI.rc.cat = recCats(el.dataset.k)[0]; refreshSheet(recurForm(UI.rc)); };
ACTIONS.recFreq = () => { document.getElementById('rc-dayf').hidden = val('rc-f') === 'quincenal'; };
ACTIONS.recSave = () => {
  rcKeep(); const r = UI.rc; const msg = document.getElementById('rc-msg');
  if (!r.name.trim()) { msg.textContent = 'Escribe el nombre.'; return; } if (!(r.amount > 0)) { msg.textContent = 'Escribe el monto.'; return; }
  const prev = r.id && S.recurring.find(x => x.id === r.id);
  if (prev) { Object.assign(prev, { ...r, done: prev.done, example: false }); log('Recurrente editado', `${r.name} · ${fmt(r.amount, r.cur)}`); }
  else { S.recurring.push({ ...r, id: uid('rc'), name: r.name.trim(), done: [] }); log('Recurrente creado', `${r.name} · ${fmt(r.amount, r.cur)} · ${RECUR_FREQ[r.freq]}`); }
  save(); const n = runRecurrents(); closeSheet(); render(); toast(n ? `Guardado · ${n} registro(s) que ya tocaban se anotaron` : 'Recurrente guardado');
};
ACTIONS.recDelete = el => { const r = S.recurring.find(x => x.id === el.dataset.id); S.recurring = S.recurring.filter(x => x.id !== r.id); log('Recurrente eliminado', r.name); save(); closeSheet(); render(); toast('Recurrente eliminado · lo ya registrado se conserva'); };

// Ver o corregir un movimiento manual o recurrente (el cambio queda en el historial)
ACTIONS.acctOpen = el => {
  const g = (S.ledger || []).find(x => x.id === el.dataset.id); if (!g) return;
  openSheet(g.concept, `<div class="list">
    <div class="row"><div class="grow"><div class="s">Tipo</div><div class="t">${g.type === 'entrada' ? 'Entrada' : 'Salida'} · ${esc(g.cat)}${g.rec ? ' · recurrente' : ''}</div></div></div>
    <div class="row"><div class="grow"><div class="s">Fecha</div><div class="t">${fdate(g.date)}</div></div></div></div>
    <div class="form"><div class="field"><label for="ag-a">Monto (${g.cur === 'USD' ? 'USD' : 'Bs'})</label><input class="input" type="number" min="0" step="0.01" id="ag-a" value="${g.amount}"></div>
      <div class="field"><label for="ag-m">Método</label><select class="input" id="ag-m">${ACCT_METHODS[g.cur].map(m => `<option ${m === g.method ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="field full"><label for="ag-r">Referencia</label><input class="input" id="ag-r" value="${esc(g.ref || '')}"></div></div>
    <div class="small muted">Tasa guardada: ${Number(g.rate).toLocaleString('es-VE')} Bs/USD · ≈ ${fmt(usdOf(g))}. Los cambios quedan en el historial.</div>`,
    `<button class="btn danger" data-act="acctVoid" data-id="${g.id}">Anular</button><button class="btn primary" data-act="acctEditSave" data-id="${g.id}">Guardar cambios</button>`);
};
ACTIONS.acctEditSave = el => {
  const g = S.ledger.find(x => x.id === el.dataset.id); const a = num('ag-a'); if (!(a > 0)) { toast('El monto debe ser mayor que cero'); return; }
  const before = fmt(g.amount, g.cur); g.amount = r2(a); g.method = val('ag-m'); g.ref = val('ag-r').trim();
  log('Movimiento corregido', `${g.concept} · ${before} → ${fmt(g.amount, g.cur)}`); save(); closeSheet(); render(); toast('Movimiento actualizado');
};
