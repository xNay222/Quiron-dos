// Inventario, compras y servicios. Todo movimiento de stock queda registrado con su motivo.

function consumptionChart() {
  const data = monthlyConsumption(6); const max = Math.max(...data.map(d => d.usd), 1);
  const W = 560, H = 190, padL = 44, padB = 26, top0 = 14, bw = (W - padL) / data.length;
  const step = max > 600 ? 200 : max > 300 ? 100 : 50; const ymax = Math.ceil(max / step) * step;
  const y = v => top0 + (H - padB - top0) * (1 - v / ymax);
  const ticks = []; for (let v = 0; v <= ymax; v += step) ticks.push(v);
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Consumo de inventario por mes en dólares">
    ${ticks.map(v => `<line x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--fg2)">$${v}</text>`).join('')}
    ${data.map((d, i) => { const last = i === data.length - 1; const x = padL + i * bw + bw * 0.22, w = bw * 0.56;
      return `<rect x="${x}" y="${y(d.usd)}" width="${w}" height="${Math.max(0, y(0) - y(d.usd))}" rx="5" fill="var(--accent)" opacity="${last ? 1 : 0.35}"/>
      <text x="${x + w / 2}" y="${H - 8}" text-anchor="middle" font-size="11.5" fill="var(--fg2)">${d.label}</text>
      ${d.usd ? `<text x="${x + w / 2}" y="${y(d.usd) - 6}" text-anchor="middle" font-size="11" font-weight="${last ? 600 : 400}" fill="var(--fg)">$${Math.round(d.usd)}</text>` : ''}`; }).join('')}
  </svg></div>`;
}

// Orden de las tablas de inventario: clic en un encabezado ordena de menor a mayor (A-Z), otro clic al revés, un tercero vuelve al orden normal
const locKey = p => { const l = p.loc || {}; return l.shelf || l.sector ? [l.sector || 9, l.shelf || '', String(l.level || '').padStart(2, '0'), String(l.bin || '').padStart(4, '0'), l.spot || ''].join('|') : '~'; };
const nextExpDays = p => { const nx = fefo(p)[0]; return nx && nx.exp ? daysTo(nx.exp) : stock(p) > usable(p) ? -1 : Infinity; };
const ST_RANK = { 'Agotado': 0, 'Solo vencidos': 1, 'Bajo mínimo': 2, 'Disponible': 3 };
const SORT_KEYS = {
  prod: { name: p => p.name, loc: locKey, cat: p => p.cat, stock: usable, lots: p => p.lots.filter(l => l.qty > 0).length, min: p => p.min,
    exp: nextExpDays, value: p => lotsValue(p), state: p => ST_RANK[stockState(p).t] ?? 9 },
  lote: { exp: r => r.l.exp ? daysTo(r.l.exp) : Infinity, loc: r => locKeyOf(lotLoc(r.p, r.l)), name: r => r.p.name, brand: r => r.l.brand || '~', num: r => r.l.num || '',
    qty: r => r.l.qty, cost: r => r.l.cost, state: r => r.l.exp ? daysTo(r.l.exp) : Infinity }
};
function sortRows(t, rows) {
  const o = (UI.invSort || {})[t]; if (!o) return rows; const f = SORT_KEYS[t][o.k]; const dir = o.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => { const x = f(a), y = f(b);
    return dir * (typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y), 'es', { numeric: true, sensitivity: 'base' }) : x === y ? 0 : x > y ? 1 : -1); });
}
const sortTh = (t, k, label, num) => { const o = (UI.invSort || {})[t]; const on = o && o.k === k ? o.dir : '';
  return `<th class="${num ? 'num ' : ''}sort-th${on ? ' ' + on : ''}" data-act="invSort" data-t="${t}" data-k="${k}" aria-sort="${on === 'asc' ? 'ascending' : on === 'desc' ? 'descending' : 'none'}" title="Ordenar por ${label.toLowerCase()}">${label}</th>`; };
// En el teléfono la tabla se ve como tarjetas sin encabezados: el orden se elige en una lista
const SORT_LABELS = { prod: [['name', 'Nombre'], ['stock', 'Existencia'], ['exp', 'Próximo vencimiento'], ['loc', 'Ubicación'], ['cat', 'Categoría'], ['value', 'Valor'], ['state', 'Estado']],
  lote: [['exp', 'Vencimiento'], ['name', 'Producto'], ['qty', 'Cantidad'], ['loc', 'Ubicación'], ['cost', 'Costo unitario']] };
const sortSelect = t => { const o = (UI.invSort || {})[t]; const cur = o ? o.k + ':' + o.dir : '';
  return `<label class="sort-mobile small muted">Ordenar por <select class="input" data-ch="invSortSel" data-t="${t}"><option value="">Orden normal</option>${SORT_LABELS[t].map(([k, l]) => ['asc', 'desc'].map(d => `<option value="${k}:${d}" ${cur === k + ':' + d ? 'selected' : ''}>${l} ${d === 'asc' ? (k === 'stock' || k === 'qty' || k === 'value' || k === 'cost' ? '(de menos a más)' : k === 'exp' ? '(lo que vence antes)' : '(A-Z)') : (k === 'stock' || k === 'qty' || k === 'value' || k === 'cost' ? '(de más a menos)' : k === 'exp' ? '(lo que vence después)' : '(Z-A)')}</option>`).join('')).join('')}</select></label>`; };
ACTIONS.invSortSel = el => { const [k, dir] = el.value.split(':'); UI.invSort = UI.invSort || {}; UI.invSort[el.dataset.t] = k ? { k, dir } : null; render(); };
ACTIONS.invSort = el => { const { t, k } = el.dataset; UI.invSort = UI.invSort || {}; const o = UI.invSort[t];
  UI.invSort[t] = !o || o.k !== k ? { k, dir: 'asc' } : o.dir === 'asc' ? { k, dir: 'desc' } : null; render(); };

// Gráfico del inventario: por defecto los medicamentos más usados del mes; también el gasto por mes y por medicamento
const unitN = (u, n) => { u = (u || 'unidad').toLowerCase(); return n === 1 ? u : /[aeiou]$/.test(u) ? u + 's' : u + 'es'; };
const USAGE_VIEWS = [['top', 'Más usados este mes'], ['mes', 'Consumo en USD por mes'], ['usdmed', 'USD del mes por medicamento']];
function usageCard() {
  const k = USAGE_VIEWS.some(x => x[0] === UI.invChart) ? UI.invChart : 'top'; const mes = TODAY.toLocaleDateString('es-VE', { month: 'long' });
  const seg = `<div class="seg" role="group" aria-label="Gráfico">${USAGE_VIEWS.map(([id, l]) => `<button data-act="invChart" data-k="${id}" aria-pressed="${k === id}">${l}</button>`).join('')}</div>`;
  let title, body;
  if (k === 'mes') { title = 'Consumo por mes <small>costo en USD, últimos 6 meses</small>'; body = consumptionChart(); }
  else {
    const usd = k === 'usdmed'; const rows = monthUsage().sort((a, b) => usd ? b.usd - a.usd : b.qty - a.qty).filter(r => usd ? r.usd > 0 : r.qty > 0).slice(0, 12);
    const max = rows[0] ? (usd ? rows[0].usd : rows[0].qty) : 1; const tot = monthUsage().reduce((a, r) => a + r.usd, 0);
    title = usd ? `Gasto en medicamentos de ${mes} <small>USD por medicamento · total ${fmt(tot)}</small>` : `Medicamentos más usados en ${mes} <small>unidades que salieron del almacén</small>`;
    body = rows.length ? `<ol class="rank">${rows.map(r => `<li style="cursor:pointer" data-act="openProduct" data-id="${r.pid}"><div style="min-width:0;flex:1;display:grid;gap:3px"><div class="between small"><span class="t">${esc(r.name)}</span><b style="font-weight:600">${usd ? fmt(r.usd) : r.qty + ' ' + esc(unitN(r.unit, r.qty))}</b></div>
      <div class="muted" style="font-size:12px">${usd ? r.qty + ' ' + esc(unitN(r.unit, r.qty)) : fmt(r.usd)}</div><div class="bar"><span style="width:${(usd ? r.usd : r.qty) / max * 100}%;background:var(--accent)"></span></div></div></li>`).join('')}</ol>`
      : `<div class="empty">Todavía no ha salido ningún medicamento en ${mes}.</div>`;
  }
  return `<div class="card sec"><div class="between" style="gap:10px;flex-wrap:wrap;margin-bottom:10px"><h2 style="margin:0">${title}</h2>${seg}</div>${body}</div>`;
}
ACTIONS.invChart = el => { UI.invChart = el.dataset.k; render(); };
// Alertas que llaman la atención: aviso arriba y pestaña en rojo cuando hay vencidos o agotados
const stockCritical = a => ({ expired: a.expired.length, out: S.products.filter(p => usable(p) === 0 && p.min > 0).length, soon: a.soon.length, low: a.low.filter(p => usable(p) > 0).length });
const alertTabLabel = a => { const c = stockCritical(a); const n = alertRows().length; return (c.expired || c.out ? '⚠ ' : '') + `Alertas (${n})`; };
function stockAlertBanner(a) {
  const c = stockCritical(a); if (!c.expired && !c.out && !c.soon && !c.low) return '';
  const parts = [c.expired && `<b>${c.expired}</b> lote(s) vencido(s)`, c.out && `<b>${c.out}</b> producto(s) agotado(s)`, c.soon && `<b>${c.soon}</b> lote(s) vencen en 30 días`, c.low && `<b>${c.low}</b> bajo el mínimo`].filter(Boolean);
  return `<button class="stock-alert sec ${c.expired || c.out ? 'crit' : ''}" data-act="invTab" data-k="alertas"><span class="sa-ico">⚠</span><span class="grow">${parts.join(' · ')}</span><span class="sa-go">Ver alertas ›</span></button>`;
}
VIEWS.inventario = () => {
  const tab = UI.invTab || (role() === 'almacen' || pendingMedOrders().length ? 'ordenes' : 'productos'); const a = alerts();
  const thisMonth = monthlyConsumption(1)[0].usd;
  const q = (UI.invQ || '').toLowerCase(); const cat = UI.invCat || 'Todos';
  const cats = ['Todos', ...new Set(S.products.map(p => p.cat))];
  let body = '';
  if (tab === 'productos') {
    const list = S.products.filter(p => (cat === 'Todos' || p.cat === cat) && (!q || p.name.toLowerCase().includes(q)));
    const mode = UI.invMode || 'producto';
    body = `<div class="between" style="margin-bottom:12px"><div class="seg" role="group" aria-label="Agrupar"><button data-act="invMode" data-k="producto" aria-pressed="${mode === 'producto'}">Por producto</button><button data-act="invMode" data-k="lote" aria-pressed="${mode === 'lote'}">Por lote y vencimiento</button></div><div class="search" style="flex:1;min-width:220px">${icon('buscar')}<input class="input" id="invQ" placeholder="Buscar producto" value="${esc(UI.invQ || '')}" data-in="invSearch" aria-label="Buscar producto"></div>
      <div class="seg" role="group" aria-label="Categoría">${cats.map(c => `<button data-act="invCat" data-c="${esc(c)}" aria-pressed="${cat === c}">${esc(c)}</button>`).join('')}</div></div>
    ${sortSelect(mode === 'lote' ? 'lote' : 'prod')}${mode === 'lote' ? lotTable(list) : `<div class="tablewrap"><table><thead><tr>${sortTh('prod', 'name', 'Producto')}${sortTh('prod', 'loc', 'Estantería · caja')}${sortTh('prod', 'cat', 'Categoría')}${sortTh('prod', 'stock', 'Existencia', 1)}${sortTh('prod', 'lots', 'Lotes', 1)}${sortTh('prod', 'min', 'Mínimo', 1)}${sortTh('prod', 'exp', 'Próximo vencimiento')}${sortTh('prod', 'value', 'Valor', 1)}${sortTh('prod', 'state', 'Estado')}</tr></thead><tbody>
    ${sortRows('prod', list).map(p => { const st = stockState(p); const nx = fefo(p)[0]; const dn = nx ? daysTo(nx.exp) : Infinity;
      return `<tr style="cursor:pointer" data-act="openProduct" data-id="${p.id}"><td style="min-width:220px"><b style="font-weight:500">${esc(p.name)}</b></td>${locCells(p)}<td class="muted">${esc(p.cat)}</td>
      <td class="num"><b>${usable(p)}</b> <span class="muted small">${p.unit.toLowerCase()}</span>${expiredNote(p)}</td><td class="num muted">${p.lots.filter(l => l.qty > 0).length}</td><td class="num muted">${p.min}</td>
      <td>${nx && nx.exp ? `<span class="${dn <= 30 ? 'pill warn' : 'muted'}">${fdate(nx.exp)}</span>` : stock(p) > usable(p) && !nx ? '<span class="pill bad">Vencido</span>' : nx ? '<span class="muted">No vence</span>' : '<span class="muted">—</span>'}</td>
      <td class="num">${fmt(lotsValue(p))}${lotsValue(p, true) ? `<div class="small" style="color:var(--bad)">+ ${fmt(lotsValue(p, true))} vencido</div>` : ''}</td><td><span class="pill ${st.k}"><span class="dot"></span>${st.t}</span></td></tr>`; }).join('')}
    </tbody></table></div>`}`;
  }
  if (tab === 'alertas') {
    const rows = alertRows(); const groups = [['bad', 'Urgente: vencidos y agotados'], ['warn', 'Atención: vencen pronto o bajo el mínimo'], ['info', 'Para planificar: vencen en 60–90 días']];
    body = `<div class="legend" style="margin-bottom:10px"><span>Avisos de vencimiento a 90, 60, 30 y 15 días. Se descuenta siempre primero el lote que vence antes (FEFO).</span></div>
    ${groups.map(([k, t]) => { const g = rows.filter(r => r.k === k); return g.length ? `<div class="alert-group ${k}"><h3>${t} <span class="pill ${k}">${g.length}</span></h3><div class="list">${g.map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.t)}</div><div class="s">${esc(r.s)}</div></div><span class="pill ${r.k}">${r.pill}</span></div>`).join('')}</div></div>` : ''; }).join('') || '<div class="empty">Sin alertas.</div>'}
    ${a.low.length ? `<div class="sec between card"><div><b>${a.low.length} productos bajo mínimo</b><div class="small muted">Crea una orden de compra con las cantidades sugeridas.</div></div><button class="btn primary" data-act="newOrder" data-suggest="1">Pedir lo que falta</button></div>` : ''}`;
  }
  if (tab === 'mapa') body = mapTab();
  if (tab === 'facturas' && can('*')) body = invPendingTab();
  if (tab === 'ordenes') body = medOrdersTab();
  if (tab === 'compras') body = comprasBody();
  if (tab === 'movimientos') {
    body = `<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th class="num">Cantidad</th><th class="num">Costo</th><th>Referencia</th><th>Lotes</th><th>Usuario</th></tr></thead><tbody>
    ${S.moves.filter(m => m.pid).slice(0, 80).map(m => `<tr><td>${fdate(m.date)}</td><td><span class="pill ${m.type === 'entrada' ? 'good' : m.type === 'consumo' ? 'info' : 'warn'}">${{ entrada: 'Entrada', consumo: 'Consumo', salida: 'Salida', ajuste: 'Ajuste' }[m.type]}</span></td>
      <td>${esc(m.name)}</td><td class="num">${m.qty > 0 ? '+' : ''}${m.qty}</td><td class="num">${fmt(m.cost)}</td><td>${esc(m.ref)}</td><td class="mono muted">${esc(m.lots || '')}</td><td class="muted">${esc(m.user)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Aún no hay movimientos.</td></tr>'}
    </tbody></table></div>`;
  }
  return header('Inventario', 'Existencias por lote, vencimientos y consumo', `<button class="btn primary" data-act="scanOpen">Escanear código</button>${canBarcode() ? '<button class="btn" data-act="labelsOpen">Etiquetas</button>' : ''}${can('*') ? '<button class="btn" data-act="invoiceLoad">Cargar factura</button>' : ''}<button class="btn" data-act="newProduct">Producto o lote nuevo (con foto)</button>${can('*') ? '<button class="btn primary" data-act="moveStock">Entrada / salida</button>' : ''}${can('inv.extra') ? '<button class="btn primary" data-act="extraReq">Hacer una solicitud extraordinaria</button>' : ''}`) +
  `<div class="grid g4">
    ${can('*') ? kpi('Valor del inventario', fmt(invValue()), fmt(invValue() * S.rate, 'VES') + (expiredValue() ? ' · vencido aparte: ' + fmt(expiredValue()) : '')) : ''}
    ${kpi('Bajo mínimo', a.low.length, 'productos por reponer', a.low.length ? 'alert' : '')}
    ${kpi('Vencen en 30 días', a.soon.length, a.expired.length ? `${a.expired.length} lote(s) ya vencido(s)` : 'lotes por usar primero', a.expired.length ? 'alert' : '')}
    ${kpi('Consumo este mes', fmt(thisMonth), 'costo de insumos usados')}
  </div>
  ${stockAlertBanner(a)}
  ${usageCard()}
  <div class="seg sec" role="group" aria-label="Vista" style="margin-bottom:14px">${[['ordenes', `Órdenes pendientes (${pendingMedOrders().length})`], ['productos', 'Productos'], ...((S.invPending || []).length && can('*') ? [['facturas', `Facturas por completar (${S.invPending.length})`]] : []), ['alertas', `${alertTabLabel(a)}`], ['compras', `Compras${S.orders.filter(ocCanReceive).length ? ` (${S.orders.filter(ocCanReceive).length} por recibir)` : ''}`], ['mapa', 'Mapa del almacén'], ['movimientos', 'Movimientos']].map(([k, t]) => `<button data-act="invTab" data-k="${k}" aria-pressed="${tab === k}">${t}</button>`).join('')}</div>
  ${body}`;
};
ACTIONS.invTab = el => { UI.invTab = el.dataset.k; render(); };
ACTIONS.invCat = el => { UI.invCat = el.dataset.c; render(); };
ACTIONS.invSearch = el => { UI.invQ = el.value; const pos = el.selectionStart; render(); const n = document.getElementById('invQ'); n.focus(); n.setSelectionRange(pos, pos); };

ACTIONS.openProduct = el => {
  const p = prod(el.dataset.id); const order = fefo(p).map(l => l.id);
  const usedIn = S.services.filter(s => s.items.some(i => i.pid === p.id));
  openSheet(p.name, `${locationBlock(p)}<div class="grid g3">${kpi('Existencia utilizable', `${usable(p)} <span class="small muted">${p.unit.toLowerCase()}</span>`)}${kpi('Costo promedio', fmt(avgCost(p)))}${kpi('Mínimo', p.min)}</div>
    <div><h3 class="small muted" style="margin:0 0 6px">Lotes · el primero de la lista sale primero</h3>
    <div class="list">${p.lots.filter(l => l.qty > 0).sort((a, b) => daysTo(a.exp) - daysTo(b.exp)).map(l => { const d = daysTo(l.exp); const n = order.indexOf(l.id);
      return `<div class="row"><div class="grow"><div class="t">Lote ${esc(l.num)}${l.brand ? ' · ' + esc(l.brand) : ''} ${n === 0 ? '<span class="pill info">Sale primero</span>' : ''}</div><div class="s">${l.exp ? 'Vence ' + fdate(l.exp) : 'Sin vencimiento'} · ${esc(sup(l.sup)?.name || 'Proveedor no indicado')} · costo ${fmt(l.cost)}</div><div class="s">Ubicación: <b>${esc(locTextOf(lotLoc(p, l)) || 'sin asignar')}</b>${l.loc?.sector ? '' : ' <span class="muted">(la del producto)</span>'}${can('inv.gestionar') ? ` <button class="btn sm" data-act="locEdit" data-id="${p.id}" data-l="${l.id}">Mover</button>` : ''}</div>${l.photos?.length ? `<div class="hstack" style="margin-top:6px">${l.photos.map(f => `<a href="${safeUrl(f.url)}" target="_blank" rel="noopener"><img src="${safeUrl(f.url)}" alt="Foto del lote ${esc(l.num)}" style="height:56px;border-radius:6px;border:1px solid var(--line)"></a>`).join('')}<span class="small muted">subidas por ${esc(l.by || '')} el ${fdate(l.recv)}</span></div>` : ''}</div>
      <div class="end"><b>${l.qty}</b> ${d < 0 ? `<span class="pill bad">Vencido</span>${can('inv.gestionar') ? ` <button class="btn danger sm" data-act="retireLot" data-id="${p.id}" data-l="${l.id}">Retirar</button>` : ''}` : d <= 30 ? `<span class="pill warn">${d} días</span>` : ''}</div></div>`; }).join('') || '<div class="empty">Sin existencia.</div>'}</div></div>
    <div class="small muted">${usedIn.length ? 'Incluido en: ' + usedIn.map(s => esc(s.name)).join(', ') + '. Se descuenta solo al facturar esos servicios.' : 'No está incluido en ningún servicio.'}</div>
    ${barcodeLine(p)}
    <div class="field" style="max-width:220px"><label for="pr-min">Stock mínimo</label><input class="input" type="number" min="0" id="pr-min" value="${p.min}"></div>`,
    `${can('inv.gestionar') ? `<button class="btn" data-act="locEdit" data-id="${p.id}">Cambiar ubicación</button>` : ''}<button class="btn" data-act="saveMin" data-id="${p.id}">Guardar mínimo</button>${can('*') ? `<button class="btn primary" data-act="moveStock" data-id="${p.id}">Entrada / salida</button>` : can('inv.extra') ? `<button class="btn primary" data-act="extraReq" data-id="${p.id}">Solicitud extraordinaria</button>` : ''}`, { wide: true });
};
// Retirar un lote vencido: sale del inventario y queda en Movimientos como "Vencido, retirado"
ACTIONS.retireLot = el => {
  const p = prod(el.dataset.id), l = p.lots.find(x => x.id === el.dataset.l); if (!l) return;
  openSheet('Retirar lote vencido', `<p style="margin:0"><b>${esc(p.name)}</b></p>
    <div class="small muted">Lote ${esc(l.num)}${l.brand ? ' · ' + esc(l.brand) : ''} · venció el ${fdate(l.exp)} · ${l.qty} ${p.unit.toLowerCase()}(s) · ${esc(locTextOf(lotLoc(p, l)) || 'sin ubicación')}</div>
    <div class="field" style="max-width:220px"><label for="rt-q">Cantidad que retira</label><input class="input" type="number" min="1" max="${l.qty}" id="rt-q" value="${l.qty}"></div>
    <div class="banner">Sáquelas del recipiente y apártelas según el procedimiento de la clínica. Quedará registrado quién las retiró y cuándo.</div>`,
    `<span class="note" id="rt-msg"></span><button class="btn" data-act="openProduct" data-id="${p.id}">Cancelar</button><button class="btn danger" data-act="doRetire" data-id="${p.id}" data-l="${l.id}">Retirar</button>`);
};
ACTIONS.doRetire = el => {
  const p = prod(el.dataset.id), l = p.lots.find(x => x.id === el.dataset.l); const n = Math.round(num('rt-q'));
  if (!(n > 0 && n <= l.qty)) { document.getElementById('rt-msg').textContent = `Indique entre 1 y ${l.qty}.`; return; }
  retireExpired(p, n, [l]); save(); toast(`${p.name}: −${n} vencidas retiradas`); ACTIONS.openProduct({ dataset: { id: p.id } }); renderSide();
};
function retireExpired(p, qty, lots = p.lots.filter(l => l.qty > 0 && daysTo(l.exp) < 0).sort((a, b) => daysTo(a.exp) - daysTo(b.exp))) {
  let left = qty; const used = [];
  for (const l of lots) { if (!left) break; const n = Math.min(l.qty, left); l.qty -= n; left -= n; used.push({ lot: l.num, qty: n, cost: l.cost }); }
  S.moves.unshift({ id: uid('mv'), date: dAt(0), type: 'ajuste', pid: p.id, name: p.name, cat: p.cat, qty: -(qty - left), cost: r2(used.reduce((a, u) => a + u.qty * u.cost, 0)), ref: 'Vencido, retirado', user: S.user, lots: used.map(u => u.lot).join(', ') });
  log('Vencido retirado', `${p.name} −${qty - left} · lote ${used.map(u => u.lot).join(', ')}`);
}
ACTIONS.saveMin = el => { const p = prod(el.dataset.id); p.min = Math.max(0, Math.round(num('pr-min'))); log('Stock mínimo actualizado', `${p.name} → ${p.min}`); save(); closeSheet(); render(); toast('Mínimo actualizado'); };

ACTIONS.invMode = el => { UI.invMode = el.dataset.k; render(); };

// Cada lote es una fila: así se distinguen las mismas medicinas por su vencimiento
// Estantería y nivel (EST-A-02) y número de caja en una sola etiqueta compacta, para encontrar el producto de un vistazo
const locCell = l => { const where = l.shelf ? (l.level ? levelCode(l.shelf, l.level) : shelfOf(l.shelf).name) : l.sector ? sectorOf(l.sector).name : '';
  // Dos renglones: la estantería y nivel en la etiqueta, y debajo la caja (o el detalle) en texto
  return where ? `<div class="loc-cell"><span class="pill info" style="font-family:var(--mono)">${esc(where)}</span>${l.bin ? `<span class="bin">Caja <b>${esc(l.bin)}</b></span>` : l.spot ? `<span class="bin">${esc(l.spot)}</span>` : ''}</div>` : ''; };
// Todas las ubicaciones del producto (la principal primero); en la vista por lote, solo la del lote
const locCells = (p, l = null) => { const cells = (l ? [lotLoc(p, l)] : placements(p).map(e => e.loc)).map(locCell).filter(Boolean);
  return `<td style="white-space:nowrap">${cells.length ? cells.join('<div style="height:6px"></div>') : '<span class="muted small">Sin asignar</span>'}</td>`; };
function lotTable(products) {
  const rows = products.flatMap(p => { const first = fefo(p)[0]?.id; return p.lots.filter(l => l.qty > 0).map(l => ({ p, l, first: l.id === first })); })
    .sort((a, b) => daysTo(a.l.exp) - daysTo(b.l.exp));
  return `<div class="tablewrap"><table><thead><tr>${sortTh('lote', 'exp', 'Vence')}${sortTh('lote', 'loc', 'Estantería · caja')}${sortTh('lote', 'name', 'Producto')}${sortTh('lote', 'brand', 'Marca')}${sortTh('lote', 'num', 'Lote')}${sortTh('lote', 'qty', 'Cantidad', 1)}${sortTh('lote', 'cost', 'Costo unit.', 1)}${sortTh('lote', 'state', 'Estado')}</tr></thead><tbody>
  ${sortRows('lote', rows).map(({ p, l, first }) => { const st = lotState(l); return `<tr style="cursor:pointer" data-act="openProduct" data-id="${p.id}"><td><b style="font-weight:500">${l.exp ? fdate(l.exp) : 'No vence'}</b></td>${locCells(p, l)}<td>${esc(p.name)}</td><td class="muted">${esc(l.brand || '—')}</td><td class="mono">${esc(l.num)}</td><td class="num">${l.qty}</td><td class="num">${fmt(l.cost)}</td>
    <td><span class="pill ${st.k}"><span class="dot"></span>${st.t}</span>${first ? ' <span class="pill info">Sale primero</span>' : ''}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">Sin lotes.</td></tr>'}
  </tbody></table></div>`;
}

// ---------- Producto nuevo (o lote nuevo) leyendo la caja con IA ----------
const PRODUCT_PROMPT = `Las imágenes son fotos de la caja o envase de UN medicamento o insumo médico (frente y la cara donde vienen lote y vencimiento).
Lee solo lo que esté impreso. Si un dato no se ve, usa null; no lo inventes.
Responde solo con JSON:
{"nombre": string|null (principio activo o nombre genérico, en español), "concentracion": string|null (ej. "1 g", "30 mg/ml"), "presentacion": string|null (Ampolla, Tableta, Frasco, Bolsa, Unidad…), "marca": string|null (marca comercial o laboratorio), "lote": string|null, "vencimiento": "AAAA-MM-DD"|null (si solo trae mes y año, usa el último día de ese mes), "unidades_por_caja": number|null, "categoria": "Medicamento"|"Insumo"|"Sutura",
 "confianza": {"nombre": 0-100, "concentracion": 0-100, "marca": 0-100, "lote": 0-100, "vencimiento": 0-100}}`;
function productForm(d = {}) {
  const low = new Set(d.low || []); const L = k => low.has(k) ? 'low' : '';
  const f = (id, label, v, type = 'text', k, extra = '') => `<div class="field"><label for="${id}">${label}${low.has(k) ? ' <span class="pill warn">revisar</span>' : ''}</label><input class="input ${L(k)}" type="${type}" id="${id}" value="${esc(v ?? '')}" ${extra}></div>`;
  return `<div class="form">
    ${f('np-name', 'Medicamento o insumo', d.name, 'text', 'nombre', 'data-in="npMatch" placeholder="Ej. Cefazolina"')}${f('np-str', 'Concentración', d.str, 'text', 'concentracion', 'data-in="npMatch" placeholder="Ej. 1 g"')}
    ${f('np-brand', 'Marca o laboratorio', d.brand, 'text', 'marca')}${f('np-unit', 'Presentación', d.unit || 'Unidad')}
    <div class="field"><label for="np-cat">Categoría</label><select class="input" id="np-cat">${['Medicamento', 'Insumo', 'Sutura'].map(c => `<option ${d.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    ${f('np-min', 'Stock mínimo', d.min ?? 10, 'number')}
    ${f('np-lot', 'Lote', d.lot, 'text', 'lote')}${f('np-exp', 'Vencimiento', d.exp, 'date', 'vencimiento')}
    ${f('np-qty', 'Cantidad que entra', d.qty ?? '', 'number', null, 'min="0"')}${f('np-cost', 'Costo unitario (USD)', d.cost ?? '', 'number', null, 'min="0" step="0.01"')}
    <div class="field full"><label for="np-sup">Proveedor</label><select class="input" id="np-sup">${S.suppliers.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
    <div class="full" id="np-match"></div></div>`;
}
ACTIONS.newProduct = async () => {
  const sample = await getCap('sample'); const lim = sample ? await sample.limits().catch(() => null) : null; const max = Math.min(2, lim?.images?.maxCount || 0);
  UI.np = { files: [] };
  // Las fotos siempre se pueden subir: quedan guardadas con el lote como respaldo (el almacén debe subir al menos una).
  // La lectura automática con IA solo aparece donde está disponible.
  openSheet('Nuevo producto o lote', `<div class="card" style="display:grid;gap:10px"><div><b>Fotos de la mercancía${can('*') ? '' : ' <span style="color:var(--bad)">*</span>'}</b><div class="small muted">Tome 1 a 3 fotos: el frente de la caja y la cara donde vienen el lote y el vencimiento (y la nota de entrega, si la hay). Quedan guardadas con el lote.${max ? ' Con "Leer con IA" se llena el formulario solo; usted lo revisa.' : ''}</div></div>
      <div class="hstack"><label class="btn" for="np-files">Tomar o elegir fotos</label><input id="np-files" type="file" accept="image/*" capture="environment" multiple hidden data-ch="npFiles">${max ? '<button class="btn primary" data-act="readProduct" id="np-read" disabled>Leer con IA</button>' : ''}<span class="small muted" id="np-msg"></span></div>
      <div class="hstack" id="np-thumbs"></div></div>
    <div id="np-form">${productForm()}</div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveProduct">Guardar</button>`, { wide: true });
  UI.npMax = max;
};
ACTIONS.npFiles = el => {
  UI.np.files = [...UI.np.files, ...[...el.files].filter(f => f.type.startsWith('image/'))].slice(0, 3); el.value = '';
  document.getElementById('np-thumbs').innerHTML = UI.np.files.map((f, i) => `<span style="position:relative;display:inline-block"><img src="${URL.createObjectURL(f)}" alt="${esc(f.name)}" style="height:88px;border-radius:8px;border:1px solid var(--line)"><button class="btn ghost sm" data-act="npDelFile" data-i="${i}" aria-label="Quitar foto" style="position:absolute;top:2px;right:2px">✕</button></span>`).join('');
  const r = document.getElementById('np-read'); if (r) r.disabled = !UI.np.files.length;
};
const findProduct = (name, str) => { const k = `${name} ${str}`.toLowerCase().replace(/\s+/g, ' ').trim(); return S.products.find(p => p.name.toLowerCase().replace(/\s+/g, ' ') === k) || (!str && S.products.find(p => p.name.toLowerCase() === name.toLowerCase().trim())); };
ACTIONS.npMatch = () => {
  const name = val('np-name').trim(), str = val('np-str').trim(); const p = name && findProduct(name, str);
  document.getElementById('np-match').innerHTML = p ? `<div class="banner">Ya existe <b>&nbsp;${esc(p.name)}&nbsp;</b>(${usable(p)} disponibles en ${p.lots.filter(l => l.qty > 0).length} lotes). Se agregará como un lote nuevo con su propio vencimiento.</div>` : '';
};
ACTIONS.readProduct = async el => {
  const sample = await getCap('sample'); const msg = document.getElementById('np-msg'); el.disabled = true; msg.textContent = 'Leyendo la caja…';
  try {
    const j = await sample.json(PRODUCT_PROMPT, { images: UI.np.files.slice(0, Math.max(1, UI.npMax)) });
    const c = j.confianza || {}; const low = ['nombre', 'concentracion', 'marca', 'lote', 'vencimiento'].filter(k => j[k] == null || (c[k] ?? 0) < 80);
    document.getElementById('np-form').innerHTML = productForm({ name: j.nombre, str: j.concentracion, unit: j.presentacion, brand: j.marca, lot: j.lote, exp: j.vencimiento, qty: j.unidades_por_caja, cat: j.categoria || 'Medicamento', low });
    ACTIONS.npMatch(); msg.textContent = low.length ? 'Revisa los campos en amarillo.' : 'Listo. Revisa y guarda.';
  } catch (e) {
    msg.textContent = { not_granted: 'No se dio permiso para usar la IA.', rate_limited: 'Demasiadas consultas; espera un momento.', image_rejected: 'No se pudo leer la foto; prueba con otra más nítida.' }[e?.code] || 'No se pudo leer la caja. Inténtalo de nuevo o llénalo a mano.';
  } finally { el.disabled = false; }
};
ACTIONS.npDelFile = el => { UI.np.files.splice(+el.dataset.i, 1); ACTIONS.npFiles({ files: [], set value(v) {} }); };
ACTIONS.saveProduct = async el => {
  const name = val('np-name').trim(), str = val('np-str').trim(); if (!name) { toast('Escribe el nombre del producto'); return; }
  const qty = Math.round(num('np-qty'));
  if (qty > 0 && !val('np-lot').trim()) { toast('Indica el número de lote'); return; }
  if (qty > 0 && val('np-cat') === 'Medicamento' && !val('np-exp')) { toast('Indica el vencimiento del lote'); return; }
  if (qty > 0 && !can('*') && !UI.np.files.length) { toast('Agregue al menos una foto de la mercancía'); return; }
  // Fotos: se reducen y se guardan (carpeta "archivos" con el servidor local, o en la nube); si una falla, se avisa y no se guarda nada
  const photos = [];
  if (qty > 0 && UI.np.files.length) {
    if (el) el.disabled = true; toast('Guardando las fotos…');
    for (const f of UI.np.files) { const url = await storeFile(await shrinkImage(f), false).catch(() => null);
      if (!url) { if (el) el.disabled = false; toast('No se pudo guardar una foto. Intente de nuevo con el servidor local encendido.'); return; }
      photos.push({ url, name: f.name, type: 'image/jpeg' }); }
  }
  let p = findProduct(name, str); const isNew = !p;
  if (isNew) { p = { id: uid('p'), name: str ? `${name} ${str}` : name, cat: val('np-cat'), unit: val('np-unit') || 'Unidad', min: Math.round(num('np-min')), lots: [] }; S.products.push(p); log('Producto creado', p.name); }
  if (qty > 0) { addLot(p.id, { num: val('np-lot').trim(), qty, cost: num('np-cost'), exp: val('np-exp') || null, sup: val('np-sup'), brand: val('np-brand').trim() }, isNew ? 'Alta de producto' : 'Lote nuevo');
    if (photos.length) { p.lots.at(-1).photos = photos; p.lots.at(-1).by = actor(); }
    log('Entrada de inventario', `${p.name} +${qty} · lote ${val('np-lot').trim()}${photos.length ? ` · ${photos.length} foto(s)` : ''}`); }
  save(); closeSheet(); render(); toast(isNew ? `${p.name} creado${qty ? ` con ${qty} en el lote ${val('np-lot').trim()}` : ''}` : `Lote nuevo de ${p.name}: +${qty}`);
};

// ---------- Entrada / salida rápida ----------
const productOptions = sel => S.products.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)} · ${usable(p)} disp.</option>`).join('');
function moveForm(pid, kind) {
  const p = prod(pid);
  const head = `<div class="seg" role="group" aria-label="Tipo de movimiento"><button data-act="moveKind" data-k="entrada" aria-pressed="${kind === 'entrada'}">Entrada (llegó mercancía)</button><button data-act="moveKind" data-k="salida" aria-pressed="${kind === 'salida'}">Salida (uso interno, merma)</button></div>
    <div class="field"><label for="mv-p">Producto</label><select class="input" id="mv-p" data-ch="moveProduct">${productOptions(pid)}</select></div>
    <div class="small muted">Disponible: <b>${usable(p)}</b> ${p.unit.toLowerCase()}(s)${stock(p) > usable(p) ? ` · <span style="color:var(--bad)">vencidas: <b>${stock(p) - usable(p)}</b> (para retirarlas elija el motivo "Vencido, retirado")</span>` : ''}${fefo(p)[0] ? ` · próximo lote a salir ${esc(fefo(p)[0].num)}` : ''}</div>`;
  if (kind === 'entrada') return head + `<div class="form">
    <div class="field"><label for="mv-q">Cantidad</label><input class="input" type="number" min="1" id="mv-q" value="10"></div>
    <div class="field"><label for="mv-c">Costo unitario (USD)</label><input class="input" type="number" min="0" step="0.01" id="mv-c" value="${avgCost(p).toFixed(2)}"></div>
    <div class="field"><label for="mv-l">Número de lote</label><input class="input" id="mv-l" placeholder="Ej. CEF-240"></div>
    <div class="field"><label for="mv-b">Marca o laboratorio</label><input class="input" id="mv-b" value="${esc(p.lots.at(-1)?.brand || '')}"></div>
    <div class="field"><label for="mv-e">Vencimiento</label><input class="input" type="date" id="mv-e" value="${dAt(365)}"></div>
    <div class="field full"><label for="mv-s">Proveedor</label><select class="input" id="mv-s">${S.suppliers.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div></div>`;
  return head + `<div class="form">
    <div class="field"><label for="mv-q">Cantidad</label><input class="input" type="number" min="1" id="mv-q" value="1"></div>
    <div class="field"><label for="mv-r">Motivo</label><select class="input" id="mv-r"><option value="salida">Uso interno (no se cobra)</option><option value="salida|Merma o rotura">Merma o rotura</option><option value="ajuste|Vencido, retirado">Vencido, retirado</option><option value="ajuste|Ajuste por conteo físico">Ajuste por conteo físico</option></select></div>
    <div class="full banner">Lo que se usa con un paciente no se saca aquí: se agrega en <b>Nueva atención</b>, así se descuenta, se cobra y queda en su expediente a la vez.</div></div>`;
}
ACTIONS.moveStock = el => {
  // Entradas y salidas manuales: solo Administración. El almacén saca con orden del médico o con una solicitud extraordinaria.
  if (!can('*')) { toast('Las entradas y salidas manuales solo las hace Administración. Para sacar algo sin orden del médico use "Hacer una solicitud extraordinaria".'); return; }
  if (!S.products.length) { toast('Primero registre un producto con "Producto o lote nuevo"'); return; }
  UI.mv = { pid: el?.dataset?.id || S.products[0].id, kind: 'entrada' };
  openSheet('Entrada / salida de inventario', moveForm(UI.mv.pid, UI.mv.kind), `<span class="note" id="mv-msg"></span><button class="btn" data-act="saveMove" data-again="1">Guardar y otro</button><button class="btn primary" data-act="saveMove">Guardar</button>`);
};
ACTIONS.moveKind = el => { UI.mv.kind = el.dataset.k; UI.mv.pid = val('mv-p'); refreshSheet(moveForm(UI.mv.pid, UI.mv.kind)); };
ACTIONS.moveProduct = () => { UI.mv.pid = val('mv-p'); refreshSheet(moveForm(UI.mv.pid, UI.mv.kind)); };
ACTIONS.saveMove = el => {
  if (!can('*')) { closeSheet(); return; }
  const pid = val('mv-p'), q = Math.round(num('mv-q')); const p = prod(pid); const msg = document.getElementById('mv-msg');
  if (q <= 0) { msg.textContent = 'La cantidad debe ser mayor que cero.'; return; }
  if (UI.mv.kind === 'entrada') {
    if (!val('mv-l').trim()) { msg.textContent = 'Indica el número de lote.'; return; }
    addLot(pid, { num: val('mv-l').trim(), qty: q, cost: num('mv-c'), exp: val('mv-e') || null, sup: val('mv-s'), brand: val('mv-b').trim() }, 'Entrada manual');
    log('Entrada de inventario', `${p.name} +${q}`);
  } else {
    const [type, why] = val('mv-r').split('|');
    if (why === 'Vencido, retirado') {   // sale de los lotes vencidos, no de lo disponible
      const exp = stock(p) - usable(p);
      if (q > exp) { msg.textContent = exp ? `Solo hay ${exp} vencidas de este producto.` : 'Este producto no tiene lotes vencidos.'; return; }
      retireExpired(p, q); save(); toast(`${p.name}: −${q} vencidas retiradas`);
      if (el.dataset.again) { refreshSheet(moveForm(pid, UI.mv.kind)); renderSide(); } else { closeSheet(); render(); }
      return;
    }
    if (q > usable(p)) { msg.textContent = `Solo hay ${usable(p)} disponibles.`; return; }
    takeStock(pid, q, type, why || 'Uso interno');
    log('Salida de inventario', `${p.name} −${q} · ${why || 'Uso interno'}`);
  }
  save(); toast(`${p.name}: ${UI.mv.kind === 'entrada' ? '+' : '−'}${q}`);
  if (el.dataset.again) { refreshSheet(moveForm(pid, UI.mv.kind)); renderSide(); } else { closeSheet(); render(); }
};

// ---------- Compras (pestaña de Inventario) ----------
// Flujo: el almacén crea la orden → Contabilidad la confirma y registra el pago → el almacén recibe la mercancía.
const OC_ST = {
  por_aprobar: ['Esperando confirmación de contabilidad', 'warn'], aprobada: ['Confirmada · lista para recibir', 'info'],
  enviada: ['Confirmada · lista para recibir', 'info'], recibida: ['Recibida', 'good'], rechazada: ['Rechazada', 'bad'],
};
const ocTotal = o => r2(o.lines.reduce((a, l) => a + l.qty * l.cost, 0));
const ocCanReceive = o => ['aprobada', 'enviada'].includes(o.status);
function comprasBody() {
  const wait = S.orders.filter(o => o.status === 'por_aprobar'), ready = S.orders.filter(ocCanReceive);
  return `<div class="between" style="margin-bottom:14px"><span class="small muted">1. Creas la orden · 2. Contabilidad la confirma y paga · 3. Recibes la mercancía y entra al inventario</span>
      <div class="hstack"><button class="btn" data-act="newSupplier">Nuevo proveedor</button><button class="btn primary" data-act="newOrder">+ Nueva orden de compra</button></div></div>
    <div class="grid g4">${kpi('Esperando a contabilidad', wait.length, fmt(wait.reduce((a, o) => a + ocTotal(o), 0)))}${kpi('Listas para recibir', ready.length, fmt(ready.reduce((a, o) => a + ocTotal(o), 0)))}${kpi('Recibido este mes', fmt(S.orders.filter(o => o.status === 'recibida' && (o.recv || '').slice(0, 7) === dAt(0).slice(0, 7)).reduce((a, o) => a + ocTotal(o), 0)))}${kpi('Proveedores', S.suppliers.length)}</div>
    <div class="sec"><h3>Órdenes de compra</h3><div class="list">${S.orders.slice().reverse().map(o => `<button class="row" data-act="openOrder" data-id="${o.id}">
      <div class="grow"><div class="t">${esc(o.num)} · ${esc(sup(o.sup).name)}</div><div class="s">${fdate(o.date)} · ${o.lines.length} productos${o.reason ? ' · ' + esc(o.reason) : ''}</div></div>
      <div class="end"><div>${fmt(ocTotal(o))}</div><span class="pill ${OC_ST[o.status][1]}">${OC_ST[o.status][0]}</span></div></button>`).join('') || '<div class="empty">Aún no hay órdenes.</div>'}</div></div>
    <div class="sec"><h3>Proveedores</h3><div class="list">${S.suppliers.map(s => `<div class="row"><span class="avatar">${initials(s.name)}</span><div class="grow"><div class="t">${esc(s.name)}</div><div class="s">${esc(s.rif)} · ${esc(s.contact)} · ${esc(s.phone)}</div></div><div class="end small muted">Entrega ~${s.days} días</div></div>`).join('')}</div></div>`;
}
ACTIONS.newSupplier = () => openSheet('Nuevo proveedor', `<div class="form">
  <div class="field full"><label for="sp-n">Razón social</label><input class="input" id="sp-n"></div>
  <div class="field"><label for="sp-r">RIF</label><input class="input" id="sp-r" placeholder="J-00000000-0"></div>
  <div class="field"><label for="sp-c">Contacto</label><input class="input" id="sp-c"></div>
  <div class="field"><label for="sp-t">Teléfono</label><input class="input" id="sp-t"></div>
  <div class="field"><label for="sp-d">Días de entrega</label><input class="input" type="number" min="0" id="sp-d" value="3"></div></div>`,
  `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveSupplier">Guardar</button>`);
ACTIONS.saveSupplier = () => { if (!val('sp-n').trim()) { toast('Escribe la razón social'); return; } S.suppliers.push({ id: uid('s'), name: val('sp-n').trim(), rif: val('sp-r'), contact: val('sp-c'), phone: val('sp-t'), days: Math.round(num('sp-d')) }); log('Proveedor creado', val('sp-n')); save(); closeSheet(); render(); toast('Proveedor guardado'); };

function orderLinesHtml() {
  return UI.oc.lines.map((l, i) => `<div class="chip-x"><select class="input" style="flex:2" id="oc-p${i}" data-ch="ocLine" data-i="${i}" aria-label="Producto">${productOptions(l.pid)}</select>
    <input class="input" style="flex:.7" type="number" min="1" id="oc-q${i}" value="${l.qty}" data-in="ocLine" data-i="${i}" aria-label="Cantidad">
    <input class="input" style="flex:.8" type="number" min="0" step="0.01" id="oc-c${i}" value="${l.cost}" data-in="ocLine" data-i="${i}" aria-label="Costo unitario">
    <button class="btn ghost" data-act="ocDel" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('') +
    `<div class="between"><button class="btn sm" data-act="ocAdd">Agregar producto</button><b>Total ${fmt(r2(UI.oc.lines.reduce((a, l) => a + l.qty * l.cost, 0)))}</b></div>`;
}
ACTIONS.newOrder = el => {
  if (!S.products.length) { toast('Primero registre los productos en Inventario'); return; }
  if (!S.suppliers.length) { toast('Primero registre un proveedor con "Nuevo proveedor"'); return; }
  const lines = el?.dataset?.suggest ? alerts().low.map(p => ({ pid: p.id, qty: Math.max(p.min * 2 - usable(p), p.min), cost: r2(avgCost(p)) })) : [{ pid: S.products[0].id, qty: 10, cost: r2(avgCost(S.products[0])) }];
  UI.oc = { lines };
  openSheet('Nueva orden de compra', `<div class="field"><label for="oc-s">Proveedor</label><select class="input" id="oc-s">${S.suppliers.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
    <div class="small muted">Producto · cantidad · costo unitario en USD</div><div class="stack" id="ocLines">${orderLinesHtml()}</div>
    <div class="field"><label for="oc-n">Nota para contabilidad (opcional)</label><input class="input" id="oc-n" placeholder="Ej. urgente, se acaba la cefazolina"></div>`,
    `<span class="note">Contabilidad la confirmará antes de que puedas recibirla.</span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveOrder">Enviar a contabilidad</button>`, { wide: true });
};
const ocRedraw = () => { document.getElementById('ocLines').innerHTML = orderLinesHtml(); };
ACTIONS.ocLine = el => { const i = +el.dataset.i; UI.oc.lines[i] = { pid: val('oc-p' + i), qty: Math.round(num('oc-q' + i)), cost: num('oc-c' + i) }; if (el.tagName === 'SELECT') { UI.oc.lines[i].cost = r2(avgCost(prod(UI.oc.lines[i].pid))); ocRedraw(); } else { document.querySelector('#ocLines > .between b').textContent = 'Total ' + fmt(r2(UI.oc.lines.reduce((a, l) => a + l.qty * l.cost, 0))); } };
ACTIONS.ocAdd = () => { UI.oc.lines.push({ pid: S.products[0].id, qty: 10, cost: r2(avgCost(S.products[0])) }); ocRedraw(); };
ACTIONS.ocDel = el => { UI.oc.lines.splice(+el.dataset.i, 1); ocRedraw(); };
ACTIONS.saveOrder = () => {
  const lines = UI.oc.lines.filter(l => l.qty > 0); if (!lines.length) { toast('Agrega al menos un producto'); return; }
  const o = { id: uid('oc'), num: 'OC-' + String(S.ocSeq++).padStart(4, '0'), sup: val('oc-s'), date: dAt(0), status: 'por_aprobar', lines, note: val('oc-n').trim(), by: actor() };
  S.orders.push(o); log('Orden de compra enviada a contabilidad', `${o.num} · ${fmt(ocTotal(o))}`); save(); closeSheet(); UI.invTab = 'compras'; render(); toast(`${o.num} enviada a contabilidad`);
};
ACTIONS.openOrder = el => {
  const o = byId(S.orders, el.dataset.id); const recv = ocCanReceive(o) && canSee('inventario');
  openSheet(`${o.num} · ${sup(o.sup).name}`, `<div class="between"><span class="small muted">Creada ${fdate(o.date)}${o.by ? ' por ' + esc(o.by) : ''}</span><span class="pill ${OC_ST[o.status][1]}">${OC_ST[o.status][0]}</span></div>
    ${o.payment ? `<div class="banner">Confirmada por ${esc(o.payment.by)} el ${o.payment.at}: pagada con ${esc(o.payment.method)} ${fmt(o.payment.amount, o.payment.cur)}${o.payment.ref ? ' (ref. ' + esc(o.payment.ref) + ')' : ''}.</div>` : ''}
    ${o.reason ? `<div class="banner warn">Rechazada: ${esc(o.reason)}</div>` : ''}
    <div class="tablewrap"><table><thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Costo</th><th class="num">Subtotal</th>${recv ? '<th>Lote</th><th>Vence</th>' : ''}</tr></thead><tbody>
    ${o.lines.map((l, i) => `<tr><td>${esc(prod(l.pid).name)}</td><td class="num">${l.qty}</td><td class="num">${fmt(l.cost)}</td><td class="num">${fmt(l.qty * l.cost)}</td>
    ${recv ? `<td><input class="input" style="min-width:110px" id="rc-l${i}" placeholder="Nº lote" aria-label="Lote de ${esc(prod(l.pid).name)}"></td><td><input class="input" type="date" id="rc-e${i}" value="${dAt(365)}" aria-label="Vencimiento"></td>` : ''}</tr>`).join('')}
    </tbody><tfoot><tr><td>Total</td><td></td><td></td><td class="num">${fmt(ocTotal(o))}</td>${recv ? '<td></td><td></td>' : ''}</tr></tfoot></table></div>
    ${o.note ? `<div class="small muted">Nota: ${esc(o.note)}</div>` : ''}
    <div class="small muted">${o.status === 'recibida' ? `Recibida el ${fdate(o.recv)}. Sus lotes ya están en el inventario.` : o.status === 'por_aprobar' ? 'Falta que Contabilidad la confirme. Después podrás recibir la mercancía.' : recv ? 'Al recibir, cada línea entra al inventario como un lote nuevo con su costo.' : ''}</div>`,
    recv ? `<button class="btn" data-act="close">Cerrar</button><button class="btn primary" data-act="receiveOrder" data-id="${o.id}">Recibir mercancía</button>`
      : o.status === 'por_aprobar' && canSee('contabilidad') ? `<button class="btn" data-act="ocReject" data-id="${o.id}">Rechazar</button><button class="btn primary" data-act="ocApprove" data-id="${o.id}">Confirmar y registrar pago</button>` : '', { wide: true });
};
ACTIONS.receiveOrder = el => { const o = byId(S.orders, el.dataset.id); if (!ocCanReceive(o)) { toast('Esta orden aún no está confirmada por contabilidad'); return; } receiveOrder(o.id, o.lines.map((_, i) => ({ num: val('rc-l' + i).trim() || o.num + '-' + (i + 1), exp: val('rc-e' + i) || null }))); closeSheet(); render(); toast(`${o.num} recibida · inventario actualizado`); };


// ---------- Servicios (precio + insumos que consume) ----------
const svcCost = s => r2(s.items.reduce((a, i) => a + avgCost(prod(i.pid)) * i.qty, 0));
const pendingPrice = s => !s.tiers?.length && s.price <= 1;
VIEWS.servicios = () => {
  const svSeg = `<div class="seg" role="group" aria-label="Sección" style="margin-bottom:14px"><button data-act="svTab" data-k="servicios" aria-pressed="${UI.svTab !== 'paquetes'}">Precios</button><button data-act="svTab" data-k="paquetes" aria-pressed="${UI.svTab === 'paquetes'}">Paquetes para presupuestos</button></div>`;
  if (UI.svTab === 'paquetes') return header('Servicios', 'Paquetes: un presupuesto completo armado de un toque', `<button class="btn primary" data-act="pkgEdit">Nuevo paquete</button>`) + svSeg + packagesView();
  const q = labNameKey(UI.svQ || ''), area = UI.svArea || '';
  const pend = S.services.filter(pendingPrice);
  const allCats = [...new Set(S.services.map(s => s.cat))];
  const list = S.services.filter(s => (!area || s.cat === area) && (!q || labNameKey(s.name + ' ' + s.cat).includes(q)));
  const cats = [...new Set(list.map(s => s.cat))];
  const how = s => s.unit && s.unit !== 'servicio' ? 'por ' + UNITS[s.unit][0] : 'por servicio';
  const row = s => { const p = svcPrice(s, 1), c = svcCost(s), m = p ? (p - c) / p * 100 : 0;
    return `<button class="row" data-act="editService" data-id="${s.id}"><div class="grow"><div class="t">${esc(s.name)}</div>
      <div class="s">Se cobra ${how(s)}${s.items.length ? ` · descuenta ${s.items.length} ${s.items.length === 1 ? 'insumo' : 'insumos'} del inventario` : ''}</div></div>
      <div class="end"><div>${s.tiers?.length ? `<span class="small">${tierText(s)}</span>` : pendingPrice(s) ? '<span class="pill warn">Por definir</span>' : fmt(s.price)}</div>
      ${!pendingPrice(s) && s.items.length ? `<span class="pill ${m >= 60 ? 'good' : m >= 30 ? 'warn' : 'bad'}" title="Ganancia sobre el costo de los insumos">margen ${m.toFixed(0)}%</span>` : ''}</div></button>`; };
  return header('Servicios', 'Su lista de precios. Se usa sola al agendar citas, cobrar y armar presupuestos.', `<button class="btn primary" data-act="editService">Nuevo servicio</button>`) + svSeg +
  (pend.length ? `<div class="banner warn between" style="margin-bottom:16px;gap:12px;flex-wrap:wrap"><span>${pend.length} ${pend.length === 1 ? 'servicio tiene' : 'servicios tienen'} un precio provisional de $1.</span><button class="btn sm primary" data-act="svPending">Poner precios</button></div>` : '') +
  `<div class="hstack" style="margin-bottom:12px;flex-wrap:wrap"><div class="search" style="flex:1;min-width:220px">${icon('buscar')}<input class="input" id="svQ" placeholder="Buscar servicio" value="${esc(UI.svQ || '')}" data-in="svSearch" aria-label="Buscar servicio"></div></div>
  <div class="seg" role="group" aria-label="Área" style="margin-bottom:6px"><button data-act="svArea" data-k="" aria-pressed="${!area}">Todas</button>${allCats.map(c => `<button data-act="svArea" data-k="${esc(c)}" aria-pressed="${area === c}">${esc(c)}</button>`).join('')}</div>
  ${cats.map(cat => `<div class="sec" style="margin-top:16px"><h3>${esc(cat)}</h3><div class="list">${list.filter(s => s.cat === cat).map(row).join('')}</div></div>`).join('') || '<div class="empty">Ningún servicio coincide.</div>'}`;
};
ACTIONS.svArea = el => { UI.svArea = el.dataset.k; render(); };
// Poner precio a varios servicios a la vez (los que tenían $1 provisional), en una ventana aparte
ACTIONS.svPending = () => {
  const how = s => s.unit && s.unit !== 'servicio' ? 'por ' + UNITS[s.unit][0] : 'por servicio';
  openSheet('Poner precios', `<p class="small muted" style="margin:0 0 10px">Escriba el precio en USD de los que ya sepa; los demás pueden esperar.</p>
    <div class="list">${S.services.filter(pendingPrice).map(s => `<div class="row"><div class="grow"><div class="t">${esc(s.name)}</div><div class="s">${esc(s.cat)} · se cobra ${how(s)}</div></div>
      <div class="end"><input class="input" type="number" min="0" step="0.01" inputmode="decimal" id="svq-${s.id}" placeholder="USD" aria-label="Precio de ${esc(s.name)} en USD" style="width:110px"></div></div>`).join('')}</div>`,
    '<span class="note" id="svq-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="svQuickSave">Guardar precios</button>', { wide: true });
};
ACTIONS.svQuickSave = () => {
  const done = S.services.filter(pendingPrice).filter(s => { const v = num('svq-' + s.id); if (v > 1) { s.price = r2(v); return true; } return false; });
  if (!done.length) { document.getElementById('svq-msg').textContent = 'Escriba al menos un precio (mayor que $1).'; return; }
  log('Precios de servicios definidos', done.map(s => `${s.name} ${fmt(s.price)}`).join(' · ')); save(); closeSheet(); render();
  toast(`${done.length} ${done.length === 1 ? 'precio guardado' : 'precios guardados'}`);
};
ACTIONS.svSearch = el => { UI.svQ = el.value; const pos = el.selectionStart; render(); const n = document.getElementById('svQ'); n.focus(); n.setSelectionRange(pos, pos); };

function svcItemsHtml() {
  return UI.sv.items.map((it, i) => `<div class="chip-x"><select class="input" style="flex:2" id="si-p${i}" data-ch="svItem" data-i="${i}" aria-label="Insumo">${productOptions(it.pid)}</select>
    <input class="input" style="flex:.6" type="number" min="1" id="si-q${i}" value="${it.qty}" data-in="svItem" data-i="${i}" aria-label="Cantidad"><button class="btn ghost" data-act="svDel" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('') +
    `<div class="between"><button class="btn sm" data-act="svAdd">Agregar insumo</button><span class="small muted" id="svCost">Costo de insumos ${fmt(r2(UI.sv.items.reduce((a, i) => a + avgCost(prod(i.pid)) * i.qty, 0)))}</span></div>`;
}
ACTIONS.editService = el => {
  const s = el?.dataset?.id ? svc(el.dataset.id) : { name: '', cat: 'Consultas', price: 1, unit: 'servicio', iva: false, items: [] };
  UI.sv = { id: s.id || null, items: s.items.map(i => ({ ...i })) };
  const cats = [...new Set(S.services.map(x => x.cat))];
  openSheet(s.id ? 'Editar servicio' : 'Nuevo servicio', `<div class="form">
    <div class="field full"><label for="sv-n">Nombre</label><input class="input" id="sv-n" value="${esc(s.name)}"></div>
    <div class="field"><label for="sv-c">Área</label><input class="input" id="sv-c" list="sv-cats" value="${esc(s.cat)}"><datalist id="sv-cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
    <div class="field"><label for="sv-u">Se cobra</label><select class="input" id="sv-u">${Object.keys(UNITS).map(u => `<option value="${u}" ${(s.unit || 'servicio') === u ? 'selected' : ''}>${u === 'servicio' ? 'Por servicio' : 'Por ' + UNITS[u][0]}</option>`).join('')}</select></div>
    <div class="field"><label for="sv-p">Precio (USD${s.unit && s.unit !== 'servicio' ? ' por ' + UNITS[s.unit][0] : ''})</label><input class="input" type="number" min="0" step="0.01" id="sv-p" value="${s.price}"></div>
    <div class="field full"><label for="sv-t">Tarifa escalonada (opcional): precio total por 1, 2, 3… unidades, separados por coma</label><input class="input" id="sv-t" placeholder="Ej. 600, 1000, 1300" value="${esc((s.tiers || []).join(', '))}"></div>
    <div class="field"><label for="sv-x">Cada unidad adicional después de la tarifa</label><input class="input" type="number" min="0" step="0.01" id="sv-x" value="${s.extra || ''}" placeholder="Ej. 200"></div>
    <div class="field"><label for="sv-pu">Insumos</label><select class="input" id="sv-pu"><option value="0" ${!s.perUnit ? 'selected' : ''}>Se descuentan una vez</option><option value="1" ${s.perUnit ? 'selected' : ''}>Se descuentan por cada unidad (día, hora…)</option></select></div></div>
    <div><div class="small muted" style="margin-bottom:6px">Insumos que consume cada vez que se factura</div><div class="stack" id="svItems">${svcItemsHtml()}</div></div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveService">Guardar servicio</button>`, { wide: true });
};
const svRedraw = () => { document.getElementById('svItems').innerHTML = svcItemsHtml(); };
ACTIONS.svItem = el => { const i = +el.dataset.i; UI.sv.items[i] = { pid: val('si-p' + i), qty: Math.max(1, Math.round(num('si-q' + i))) }; document.getElementById('svCost').textContent = 'Costo de insumos ' + fmt(r2(UI.sv.items.reduce((a, x) => a + avgCost(prod(x.pid)) * x.qty, 0))); };
ACTIONS.svAdd = () => { if (!S.products.length) { toast('Aún no hay productos en el inventario'); return; } UI.sv.items.push({ pid: S.products[0].id, qty: 1 }); svRedraw(); };
ACTIONS.svDel = el => { UI.sv.items.splice(+el.dataset.i, 1); svRedraw(); };
ACTIONS.saveService = () => {
  const name = val('sv-n').trim(); if (!name) { toast('Escribe el nombre del servicio'); return; }
  const tiers = val('sv-t').split(/[;,]\s*|\s+/).map(x => parseFloat(x.replace(/\.(?=\d{3}\b)/g, ''))).filter(x => x > 0);
  const unit = val('sv-u');
  if (tiers.length && unit === 'servicio') { toast('La tarifa escalonada necesita cobrarse por hora o por día'); return; }
  const data = { name, cat: val('sv-c').trim() || 'General', price: tiers.length ? tiers[0] : r2(num('sv-p')), unit, iva: false, items: UI.sv.items, tiers: tiers.length ? tiers : undefined, extra: tiers.length ? r2(num('sv-x')) : undefined, perUnit: val('sv-pu') === '1' };
  if (UI.sv.id) Object.assign(svc(UI.sv.id), data); else S.services.push({ id: uid('v'), ...data });
  log(UI.sv.id ? 'Servicio editado' : 'Servicio creado', `${name} · ${tiers.length ? tierText(data) : fmt(data.price)}`); save(); closeSheet(); render(); toast('Servicio guardado');
};

ACTIONS.svTab = el => { UI.svTab = el.dataset.k; render(); };
