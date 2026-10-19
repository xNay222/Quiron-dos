// Fondos de la clínica (tipo "wallet"): cuánto dinero hay en cada cuenta o caja.
// Cada fondo parte de un saldo contado a mano ("Ajustar saldo") y desde ese momento suma y resta solo:
// los cobros y pagos que entran por sus métodos de pago, los movimientos manuales que lo eligen y los cambios entre fondos.
// Los meses de ejemplo del libro no cuentan: solo lo registrado después del último ajuste.

const FUNDS = [
  { id: 'usdt', name: 'USDT', sub: 'Billetera cripto', cur: 'USDT', bg: 'linear-gradient(135deg,#26a17b,#145c46)' },
  { id: 'zelle', name: 'Zelle', sub: 'Dólares en cuenta', cur: 'USD', bg: 'linear-gradient(135deg,#7b3fe4,#3f1a8c)' },
  { id: 'banesco', name: 'Bs Banesco', sub: 'Bolívares', cur: 'VES', bg: 'linear-gradient(135deg,#1f8a4c,#0c4a29)' },
  { id: 'plaza', name: 'Bs Banco Plaza', sub: 'Bolívares', cur: 'VES', bg: 'linear-gradient(135deg,#2563c9,#0f2f6b)' },
  { id: 'efectivo', name: 'Dólares en efectivo', sub: 'Caja de la clínica', cur: 'USD', bg: 'linear-gradient(135deg,#5b6b3a,#2d3a1a)' },
];
// A qué fondo entra cada método de pago, mientras Administración no lo cambie
const FUND_MAP_DEFAULT = { 'Efectivo USD': 'efectivo', 'Zelle': 'zelle', 'Pago móvil': 'banesco', 'Transferencia Bs': 'banesco', 'Punto de venta': 'banesco', 'Punto de venta (Bs)': 'banesco', 'Transferencia USD': '' };
const FUND_SYM = { USDT: '₮', USD: '$', VES: 'Bs', EUR: '€' };
const fundCoin = f => `<span class="wcoin" aria-hidden="true">${FUND_SYM[f.cur]}</span>`;
const fundOfId = id => FUNDS.find(f => f.id === id);
const fundMap = () => ({ ...FUND_MAP_DEFAULT, ...(S.fundMap || {}) });
const methodCur = m => ACCT_METHODS.VES.includes(m) || METODOS.some(x => x.name === m && x.cur === 'VES') ? 'VES' : 'USD';
const curFits = (moveCur, f) => f && (f.cur === moveCur || (moveCur === 'USD' && f.cur === 'USDT'));
// Fondo de un movimiento: el elegido a mano o el de su método, siempre que la moneda coincida (Bs con Bs, dólares con dólares/USDT)
const fundOf = m => { const id = m.fund || fundMap()[m.method] || ''; return curFits(m.cur || methodCur(m.method), fundOfId(id)) ? id : ''; };
const fundFmt = (n, cur) => cur === 'VES' || cur === 'USD' ? fmt(n, cur)
  : (n < 0 ? '-' : '') + (cur === 'EUR' ? '€' : '') + Math.abs(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (cur === 'USDT' ? ' USDT' : '');
// Dólares por unidad de cada moneda (el euro sale de la tasa del BCV: Bs por € ÷ Bs por $)
const eurUsd = () => S.rateEUR > 0 && S.rate > 0 ? S.rateEUR / S.rate : 0;
const toUsd = (n, cur) => cur === 'VES' ? (S.rate ? n / S.rate : 0) : cur === 'EUR' ? n * eurUsd() : n;
const moveStamp = m => m.at || (m.date + ' 00:00');

function fundState(f) {
  const adj = (S.fundAdj || []).filter(a => a.fund === f.id).sort((a, b) => a.at.localeCompare(b.at)).pop();
  if (!adj) return { set: false, bal: 0, moves: [] };
  const moves = acctMoves().filter(m => fundOf(m) === f.id && moveStamp(m) > adj.at).map(m => ({ at: moveStamp(m), date: m.date, text: m.concept, method: m.method, amt: (m.type === 'entrada' ? 1 : -1) * m.amount }));
  (S.fundTx || []).filter(t => t.at > adj.at && (t.from === f.id || t.to === f.id)).forEach(t => moves.push({ at: t.at, date: t.at.slice(0, 10),
    text: t.from === f.id ? `Cambio a ${fundOfId(t.to).name}` : `Cambio desde ${fundOfId(t.from).name}`, method: t.note || 'Cambio entre fondos', amt: t.from === f.id ? -t.amtFrom : t.amtTo }));
  moves.sort((a, b) => b.at.localeCompare(a.at));
  return { set: true, adj, bal: r2(adj.amount + moves.reduce((a, m) => a + m.amt, 0)), moves };
}

function walletCards() {
  const st = FUNDS.map(f => ({ f, s: fundState(f) }));
  const set = st.filter(x => x.s.set); const noEur = set.some(x => x.f.cur === 'EUR') && !eurUsd();
  const total = set.reduce((a, x) => a + toUsd(x.s.bal, x.f.cur), 0);
  const unmapped = Object.entries(fundMap()).filter(([, v]) => !v).map(([k]) => k);
  // Balance disponible: los dólares (efectivo, Zelle y USDT juntos) en dólares y los bolívares en bolívares; sin mezclarlos
  const usd = r2(set.filter(x => ['USD', 'USDT'].includes(x.f.cur)).reduce((a, x) => a + x.s.bal, 0));
  const ves = r2(set.filter(x => x.f.cur === 'VES').reduce((a, x) => a + x.s.bal, 0));
  const pending = st.length - set.length;
  return `<div class="balance-hero"><div style="flex:1;min-width:0"><div class="bh-lab">Balance disponible</div>
      <div class="bh-two"><div><span>Dólares</span><div class="bh-val">${set.length ? fmt(usd) : '—'}</div><small>efectivo, Zelle y USDT</small></div>
        <div><span>Bolívares</span><div class="bh-val">${set.length ? fmt(ves, 'VES') : '—'}</div><small>Banesco y Banco Plaza</small></div></div>
      <div class="bh-sub">${set.length ? `${set.length} de ${st.length} fondos con saldo${pending ? ` · faltan ${pending} por contar` : ''} · todo junto ≈ ${fmt(total)} (Bs a tasa BCV ${S.rate.toLocaleString('es-VE')})` : 'Toque cada tarjeta y registre cuánto hay hoy; desde ahí se actualiza solo.'}</div></div></div>
  <div class="between" style="margin:16px 0 10px;gap:10px;flex-wrap:wrap"><h3 style="margin:0;font-size:20px">Fondos de la clínica</h3>
    <button class="btn sm" data-act="fundCfg">Qué entra en cada fondo</button></div>
  <div class="wallet-grid">${st.map(({ f, s }) => `<button class="wcard" data-sym="${FUND_SYM[f.cur]}" style="background:${f.bg}" data-act="fundOpen" data-id="${f.id}">
      <div class="wtop"><span class="wname">${esc(f.name)}</span><span class="wcur">${f.cur === 'VES' ? 'Bs' : f.cur}</span></div>
      <div class="wbal">${s.set ? fundFmt(s.bal, f.cur) : 'Sin saldo'}</div>
      <div class="wsub">${s.set ? `${f.cur !== 'USD' && f.cur !== 'USDT' && (f.cur !== 'EUR' || eurUsd()) ? '≈ ' + fmt(toUsd(s.bal, f.cur)) + ' · ' : ''}contado el ${fdate(s.adj.at.slice(0, 10))}` : 'Toque para registrar el saldo actual'}</div></button>`).join('')}</div>
  ${unmapped.length ? `<div class="small muted" style="margin-top:8px">${unmapped.map(esc).join(', ')}: aún no entra en ningún fondo. Ajústelo en "Qué entra en cada fondo".</div>` : ''}`;
}

// ---------- Detalle de un fondo ----------
// Historial completo de un fondo: movimientos (sin los datos de ejemplo), conteos y cambios entre fondos, en orden.
// El saldo después de cada línea se calcula a partir del primer conteo; lo anterior se muestra sin saldo.
function fundHistory(f) {
  const ev = acctMoves().filter(m => !m.example && fundOf(m) === f.id).map(m => ({ at: moveStamp(m), kind: m.type, amt: (m.type === 'entrada' ? 1 : -1) * m.amount, cur: f.cur === 'USDT' ? 'USDT' : m.cur,
    text: m.concept, sub: [m.cat, m.method, m.auto || 'Manual'].filter(Boolean).join(' · '), invId: m.invId }));
  (S.fundTx || []).filter(t => t.from === f.id || t.to === f.id).forEach(t => ev.push({ at: t.at, kind: 'cambio', amt: t.from === f.id ? -t.amtFrom : t.amtTo,
    text: t.from === f.id ? `Pasado a ${fundOfId(t.to).name}` : `Recibido de ${fundOfId(t.from).name}`, sub: ['Cambio entre fondos', t.note, t.by].filter(Boolean).join(' · ') }));
  (S.fundAdj || []).filter(x => x.fund === f.id).forEach(x => ev.push({ at: x.at, kind: 'conteo', amount: x.amount, text: 'Conteo del saldo', sub: [x.note, x.by].filter(Boolean).join(' · ') }));
  ev.sort((p, q) => p.at.localeCompare(q.at) || (p.kind === 'conteo') - (q.kind === 'conteo'));
  let bal = null;
  ev.forEach(e => { if (e.kind === 'conteo') { e.diff = bal === null ? null : r2(e.amount - bal); bal = e.amount; e.bal = bal; } else if (bal !== null) { bal = r2(bal + e.amt); e.bal = bal; } });
  return ev.reverse();
}
const FH_PERIODS = [['todo', 'Todo'], ['mes', 'Este mes'], ['mesant', 'Mes anterior'], ['anio', 'Este año']];
function fundHistBody(f) {
  const s = fundState(f); const per = UI.fhP || 'todo'; const [from, to] = per === 'todo' ? ['0000', '9999'] : acctRange(per);
  const ev = fundHistory(f).filter(e => e.at.slice(0, 10) >= from && e.at.slice(0, 10) <= to);
  const tin = ev.filter(e => e.kind !== 'conteo' && e.amt > 0).reduce((x, e) => x + e.amt, 0), tout = ev.filter(e => e.kind !== 'conteo' && e.amt < 0).reduce((x, e) => x - e.amt, 0);
  return `<div class="wcard" data-sym="${FUND_SYM[f.cur]}" style="background:${f.bg};cursor:default"><div class="wtop"><span class="wname">${esc(f.name)}</span><span class="wcur">${esc(f.sub)}</span></div>
      <div class="wbal">${s.set ? fundFmt(s.bal, f.cur) : 'Sin saldo registrado'}</div><div class="wsub">${s.set ? `Último conteo: ${fundFmt(s.adj.amount, f.cur)} el ${fdate(s.adj.at.slice(0, 10))} a las ${s.adj.at.slice(11, 16)} (${esc(s.adj.by || '')})` : 'Registre cuánto hay hoy en este fondo para empezar a llevar el saldo.'}</div></div>
    <div class="between" style="margin:14px 0 8px;gap:10px;flex-wrap:wrap"><h3 style="margin:0;font-size:17px">Historial de la cuenta</h3>
      <div class="seg" role="group" aria-label="Período">${FH_PERIODS.map(([k, l]) => `<button data-act="fhP" data-k="${k}" data-id="${f.id}" aria-pressed="${per === k}">${l}</button>`).join('')}</div></div>
    <div class="small muted" style="margin-bottom:8px">${ev.length} registro(s) · entró <b style="color:var(--good)">${fundFmt(tin, f.cur)}</b> · salió <b style="color:var(--bad)">${fundFmt(tout, f.cur)}</b></div>
    <div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Monto</th><th class="num">Saldo</th></tr></thead><tbody>
    ${ev.map(e => `<tr ${e.invId ? `style="cursor:pointer" data-act="openInvoice" data-id="${e.invId}"` : ''}><td style="white-space:nowrap">${fdate(e.at.slice(0, 10))}<div class="small muted">${e.at.slice(11, 16)}</div></td>
      <td>${e.kind === 'conteo' ? '<span class="pill info">Conteo</span> ' : e.kind === 'cambio' ? '<span class="pill">Cambio</span> ' : ''}${esc(e.text)}<div class="small muted">${esc(e.sub || '')}</div></td>
      <td class="num" style="font-weight:500;color:${e.kind === 'conteo' ? 'var(--fg2)' : e.amt >= 0 ? 'var(--good)' : 'var(--bad)'}">${e.kind === 'conteo' ? (e.diff ? `dif. ${e.diff > 0 ? '+' : ''}${fundFmt(e.diff, f.cur)}` : '—') : (e.amt >= 0 ? '+' : '') + fundFmt(e.amt, f.cur)}</td>
      <td class="num">${e.bal === undefined || e.bal === null ? '<span class="muted">—</span>' : `<b style="font-weight:600">${fundFmt(e.bal, f.cur)}</b>`}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Todavía no hay movimientos en esta cuenta.</td></tr>'}
    </tbody></table></div>
    <div class="small muted" style="margin-top:8px">Incluye los cobros y pagos hechos por los métodos que entran en este fondo, los movimientos manuales que lo eligieron, los conteos y los cambios entre fondos. El saldo se lleva desde el primer conteo.</div>`;
}
ACTIONS.fundOpen = el => {
  const f = fundOfId(el.dataset.id); const s = fundState(f); UI.fhId = f.id;
  openSheet(f.name, fundHistBody(f),
    `<button class="btn" data-act="close">Cerrar</button><button class="btn" data-act="fundCsv" data-id="${f.id}">Descargar Excel</button>${s.set ? `<button class="btn" data-act="fundTx" data-id="${f.id}">Pasar a otro fondo</button>` : ''}<button class="btn primary" data-act="fundAdj" data-id="${f.id}">${s.set ? 'Ajustar saldo (conteo)' : 'Registrar saldo actual'}</button>`, { wide: true });
};
ACTIONS.fhP = el => { UI.fhP = el.dataset.k; refreshSheet(fundHistBody(fundOfId(el.dataset.id))); };
ACTIONS.fundCsv = async el => {
  const f = fundOfId(el.dataset.id); const cur = f.cur === 'VES' ? 'Bs' : f.cur; const n = v => String(v).replace('.', ',');
  const rows = [['Fecha', 'Hora', 'Tipo', 'Concepto', 'Detalle', 'Monto (' + cur + ')', 'Saldo (' + cur + ')']].concat(fundHistory(f).reverse().map(e =>
    [e.at.slice(0, 10), e.at.slice(11, 16), { entrada: 'Entrada', salida: 'Salida', cambio: 'Cambio entre fondos', conteo: 'Conteo' }[e.kind], e.text, e.sub || '', e.kind === 'conteo' ? n(e.amount) : n(e.amt), e.bal == null ? '' : n(e.bal)]));
  toast(await saveFile(`Fondo ${f.name} ${dAt(0)}.csv`, '\ufeff' + toCSV(rows), 'text/csv') ? 'Archivo guardado' : 'No se pudo guardar el archivo');
};

// ---------- Ajustar saldo: lo que realmente hay, contado ----------
ACTIONS.fundAdj = el => {
  const f = fundOfId(el.dataset.id); const s = fundState(f);
  openSheet(`Saldo de ${f.name}`, `<div class="small muted">Escriba cuánto hay <b>ahora</b> en ${esc(f.name)}, en ${f.cur === 'VES' ? 'bolívares' : f.cur === 'EUR' ? 'euros' : f.cur}. Desde este momento el fondo suma y resta solo.</div>
    ${s.set ? `<div class="banner">Según el sistema hay <b>${fundFmt(s.bal, f.cur)}</b>. Si el conteo da otra cifra, la diferencia queda anotada.</div>` : ''}
    <div class="form"><div class="field"><label for="fa-amt">Saldo actual</label><input class="input" type="number" step="0.01" id="fa-amt" value="${s.set ? s.bal : ''}"></div>
    <div class="field"><label for="fa-note">Nota (opcional)</label><input class="input" id="fa-note" placeholder="Ej. conteo de caja del viernes"></div></div><span class="note" id="fa-msg"></span>`,
    `<button class="btn" data-act="fundOpen" data-id="${f.id}">Cancelar</button><button class="btn primary" data-act="fundAdjSave" data-id="${f.id}">Guardar saldo</button>`);
};
ACTIONS.fundAdjSave = el => {
  const f = fundOfId(el.dataset.id); const s = fundState(f); const v = num('fa-amt');
  if (!(v >= 0) || val('fa-amt') === '') { document.getElementById('fa-msg').textContent = 'Escriba el saldo (puede ser 0).'; return; }
  (S.fundAdj = S.fundAdj || []).push({ id: uid('fa'), fund: f.id, at: nowStampS(), amount: r2(v), prev: s.set ? s.bal : null, by: actor(), note: val('fa-note').trim() });
  log('Saldo de fondo registrado', `${f.name}: ${fundFmt(v, f.cur)}${s.set && r2(v - s.bal) ? ` · diferencia ${fundFmt(r2(v - s.bal), f.cur)} frente al sistema` : ''}`);
  save(); render(); ACTIONS.fundOpen({ dataset: { id: f.id } }); toast(`${f.name}: ${fundFmt(v, f.cur)}`);
};

// ---------- Pasar dinero de un fondo a otro (cambio de divisas, depósito del efectivo, etc.) ----------
const fundTxForm = () => { const t = UI.ftx; const from = fundOfId(t.from), to = fundOfId(t.to);
  return `<div class="form"><div class="field"><label>Sale de</label><div class="input" style="display:flex;align-items:center">${esc(from.name)}</div></div>
    <div class="field"><label for="ft-to">Entra a</label><select class="input" id="ft-to" data-ch="ftxRedraw">${FUNDS.filter(f => f.id !== from.id).map(f => `<option value="${f.id}" ${f.id === to.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="ft-a">Monto que sale (${from.cur === 'VES' ? 'Bs' : from.cur})</label><input class="input" type="number" min="0" step="0.01" id="ft-a" value="${t.a || ''}" data-in="ftxCalc"></div>
    <div class="field"><label for="ft-b">Monto que entra (${to.cur === 'VES' ? 'Bs' : to.cur})</label><input class="input" type="number" min="0" step="0.01" id="ft-b" value="${t.b || ''}"></div>
    <div class="field full"><label for="ft-n">Nota (opcional)</label><input class="input" id="ft-n" placeholder="Ej. cambio de Zelle a USDT, comisión 1 %"></div></div>
    <div class="small muted">${from.cur === to.cur ? 'Misma moneda: entra lo mismo que sale, salvo comisiones.' : 'Monedas distintas: se propone el monto con la tasa del día; corríjalo con lo que realmente entró.'}</div><span class="note" id="ft-msg"></span>`; };
ACTIONS.fundTx = el => { const from = el.dataset.id; UI.ftx = { from, to: FUNDS.find(f => f.id !== from).id, a: 0, b: 0 };
  openSheet('Pasar a otro fondo', fundTxForm(), `<button class="btn" data-act="fundOpen" data-id="${from}">Cancelar</button><button class="btn primary" data-act="fundTxSave">Registrar</button>`); };
ACTIONS.ftxCalc = () => { const t = UI.ftx; const a = num('ft-a'); const from = fundOfId(t.from), to = fundOfId(t.to); const usd = toUsd(a, from.cur);
  const per = to.cur === 'VES' ? S.rate : to.cur === 'EUR' ? (eurUsd() ? 1 / eurUsd() : 0) : 1; const b = from.cur === to.cur ? a : r2(usd * per);
  if (b > 0) document.getElementById('ft-b').value = b; };
ACTIONS.ftxRedraw = () => { const t = UI.ftx; t.a = num('ft-a'); t.b = num('ft-b'); t.to = val('ft-to'); refreshSheet(fundTxForm()); ACTIONS.ftxCalc(); };
ACTIONS.fundTxSave = () => { const t = UI.ftx; t.to = val('ft-to'); const a = num('ft-a'), b = num('ft-b'); const from = fundOfId(t.from), to = fundOfId(t.to);
  if (!(a > 0 && b > 0)) { document.getElementById('ft-msg').textContent = 'Indique el monto que sale y el que entra.'; return; }
  if (!fundState(to).set) { document.getElementById('ft-msg').textContent = `Primero registre el saldo actual de ${to.name}.`; return; }
  (S.fundTx = S.fundTx || []).push({ id: uid('ft'), at: nowStampS(), from: from.id, to: to.id, amtFrom: r2(a), amtTo: r2(b), note: val('ft-n').trim(), by: actor() });
  log('Cambio entre fondos', `${from.name} −${fundFmt(a, from.cur)} → ${to.name} +${fundFmt(b, to.cur)}`); save(); render(); ACTIONS.fundOpen({ dataset: { id: from.id } }); toast('Cambio registrado'); };

// ---------- Qué método de pago entra en cada fondo ----------
ACTIONS.fundCfg = () => { const map = fundMap();
  openSheet('Qué entra en cada fondo', `<div class="small muted">Cada cobro o pago queda en el fondo de su método. Los movimientos que registre a mano pueden elegir otro fondo.</div>
    <div class="form">${Object.keys(map).map(m => `<div class="field"><label>${esc(m)}</label><select class="input" data-method="${esc(m)}">${['', ...FUNDS.filter(f => curFits(methodCur(m), f)).map(f => f.id)].map(id => `<option value="${id}" ${map[m] === id ? 'selected' : ''}>${id ? esc(fundOfId(id).name) : 'Ningún fondo'}</option>`).join('')}</select></div>`).join('')}</div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="fundCfgSave">Guardar</button>`); };
ACTIONS.fundCfgSave = () => { S.fundMap = {}; document.querySelectorAll('#sheetBody select[data-method]').forEach(s => { S.fundMap[s.dataset.method] = s.value; });
  log('Fondos configurados', Object.entries(S.fundMap).map(([m, f]) => `${m} → ${fundOfId(f)?.name || 'ninguno'}`).join(' · ')); save(); closeSheet(); render(); toast('Guardado'); };
