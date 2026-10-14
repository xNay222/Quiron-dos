// Quirófano: cirugías del día (de la agenda quirúrgica), solicitud de medicación e insumos al almacén
// para cada cirugía y devolución de lo que no se usó. El almacén despacha en Inventario → Órdenes pendientes.

// toMin (hh:mm → minutos) viene de views-agenda.js
const fromMin = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const qxEnd = a => fromMin(toMin(a.time) + Math.round((a.hours || 1) * 60));
const qxOrders = a => (S.medOrders || []).filter(o => o.apptId === a.id).sort((x, y) => x.at.localeCompare(y.at));
const canQxDone = a => can('*') || role() === 'enfermeria' || (!!myDoc() && myDoc() === a.doc);
const kitOf = id => (S.kits || []).find(k => k.id === id);
const qxDayList = day => S.appts.filter(a => a.kind === 'cirugia' && a.date === day && isActive(a)).sort((x, y) => x.time.localeCompare(y.time));

VIEWS.quirofano = () => {
  const day = UI.qxDay || dAt(0); const list = qxDayList(day); const today = day === dAt(0);
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const current = today && list.find(a => toMin(a.time) <= nowM && nowM < toMin(qxEnd(a)));
  const next = today && list.find(a => toMin(a.time) > nowM);
  const booked = list.reduce((s, a) => s + (a.hours || 1), 0);
  const pend = list.flatMap(qxOrders).filter(o => o.status === 'pendiente').length;
  const statusCard = today ? `<div class="card between" style="margin-bottom:16px;${current ? 'border-color:var(--bad)' : ''}"><div><h2 style="margin:0 0 2px">${current ? '<span class="pill bad"><span class="dot"></span>En uso</span>' : '<span class="pill good"><span class="dot"></span>Disponible</span>'}</h2>
      <div class="small muted" style="margin-top:6px">${current ? `${esc(pat(current.pid).name)} · ${esc(current.proc)} · hasta las ${qxEnd(current)} aprox.` : next ? `Próxima cirugía a las ${next.time}: ${esc(next.proc)}` : 'No hay más cirugías programadas hoy.'}</div></div></div>` : '';
  return header('Quirófano', today ? fday(day).replace(/^./, c => c.toUpperCase()) : fday(day),
    `<button class="btn" data-act="qxShift" data-n="-1" aria-label="Día anterior">‹</button><button class="btn" data-act="qxShift" data-n="0">Hoy</button><button class="btn" data-act="qxShift" data-n="1" aria-label="Día siguiente">›</button>${can('*') ? `<button class="btn" data-act="kitsOpen">Kits de cirugía</button>` : ''}${can('agenda.programar') ? `<button class="btn primary" data-act="qxSchedule">Programar cirugía</button>` : ''}`) +
  statusCard + (role() === 'almacen' ? '<div class="banner" style="margin-bottom:16px">Vista de consulta para almacén: aquí ve lo que se pidió para cada cirugía. Las solicitudes se despachan en Inventario › Órdenes pendientes.</div>' : '') +
  `<div class="grid g4" style="margin-bottom:16px">${kpi('Cirugías', list.length)}${kpi('Tiempo reservado', hrs(booked), 'de 12 h disponibles')}${kpi('Solicitudes al almacén', pend, 'pendientes de despacho', pend ? 'alert' : '')}</div>
  <div class="stack">${list.map(qxCard).join('') || '<div class="card empty">No hay cirugías programadas para este día.</div>'}</div>`;
};
function qxCard(a) {
  const p = pat(a.pid); const orders = qxOrders(a); const cq = { req: can('qx.solicitar'), done: canQxDone(a), ret: can('qx.devolver') };
  return `<div class="card" style="display:grid;gap:10px"><div class="between" style="align-items:flex-start;gap:12px;flex-wrap:wrap">
    <div class="hstack" style="gap:14px;align-items:flex-start;min-width:0"><div style="text-align:center;min-width:64px"><div style="font-size:20px;font-weight:600">${a.time}</div><div class="small muted">a ${qxEnd(a)}</div></div>
      <div style="min-width:0"><div style="font-size:17px;font-weight:600">${esc(a.proc)}</div><div class="small muted">${esc(p.name)} · ${esc(p.ci)} · ${ageTxt(p)}</div>
      <div class="small" style="margin-top:4px">Cirujano: <b>${esc(med(a.doc)?.name || '—')}</b> · Anestesiólogo: <b>${esc(med(a.anest)?.name || '—')}</b></div>
      ${kitOf(a.kit) ? `<div class="small" style="margin-top:4px">Kit: <b>${esc(kitOf(a.kit).name)}</b></div>` : ''}
      ${p.allergies.length ? `<div class="small allergy-txt" style="margin-top:4px"><b>⚠ Alergias:</b> ${esc(p.allergies.join(', '))}</div>` : ''}</div></div>
    <div class="hstack" style="justify-content:flex-end">${statusPill(a.status)}${surgeryPills(a)}</div></div>
    ${orders.length ? `<div class="tablewrap"><table><thead><tr><th>Solicitud</th><th>Medicación e insumos</th><th>Estado</th><th></th></tr></thead><tbody>${orders.map(o => `<tr><td class="mono">${o.num}</td>
      <td>${o.items.map(it => `${esc(prod(it.pid).name)} <span class="muted">${moServed(o) ? `· entregadas ${it.qty}${it.qty < (it.req ?? it.qty) ? ` de ${it.req}` : ''}${it.returned ? ` · devueltas ${it.returned} · usadas ${it.qty - it.returned}` : ''}` : `×${it.req ?? it.qty}`}</span>`).join('<br>')}</td>
      <td>${moPill(o)}</td><td>${moServed(o) && cq.ret && o.items.some(it => (it.returned || 0) < it.qty) ? `<button class="btn sm" data-act="qxReturn" data-id="${o.id}">Registrar devolución</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="hstack" style="justify-content:flex-end">${qxEvolutionButton(a)}${canSee('pacientes') ? `<button class="btn sm" data-go="pacientes" data-param="${p.id}">Ver perfil del paciente</button>` : ''}${a.done ? `<span class="pill good">Realizada${a.done.durationMin ? ` · ${a.done.durationMin} min` : ''}</span>` : cq.done && a.date <= dAt(0) ? `<button class="btn sm" data-act="qxDone" data-id="${a.id}">Registrar cirugía realizada</button>` : ''}${cq.req && !a.done ? `<button class="btn sm primary" data-act="qxMedOrder" data-id="${a.id}">Solicitar medicación e insumos</button>` : ''}</div></div>`;
}
ACTIONS.qxShift = el => { const n = +el.dataset.n; UI.qxDay = n ? iso(new Date(new Date((UI.qxDay || dAt(0)) + 'T00:00').getTime() + n * DAY)) : dAt(0); render(); };
ACTIONS.qxSchedule = () => { UI.agendaDay = UI.qxDay || dAt(0); UI.agTab = 'quirurgica'; ACTIONS.newAppt({ dataset: { kind: 'cirugia' } }); };
ACTIONS.qxMedOrder = el => {
  const first = firstMedPid(true); if (!first) return noMedProducts();
  const a = S.appts.find(x => x.id === el.dataset.id); const kit = kitOf(a.kit);
  // La primera solicitud de la cirugía se precarga con su kit (se puede quitar, agregar o cambiar cantidades)
  const fromKit = kit && !qxOrders(a).length ? kit.items.filter(it => prod(it.pid)).map(it => ({ pid: it.pid, qty: it.qty, freq: '' })) : [];
  UI.mo = { mode: 'qx', apptId: a.id, items: fromKit.length ? fromKit : [{ pid: '', qty: 1, freq: '' }], note: fromKit.length ? `Kit: ${kit.name}` : '', urgent: false, fOpen: null, reqDoc: myDoc() || '' };
  openSheet(`Solicitar al almacén · ${a.proc}`, medOrderForm(), `<span class="note" id="mo-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="moSave">Enviar al almacén</button>`, { wide: true });
};

// Devolución: lo que no se usó en la cirugía vuelve al inventario (al mismo lote del que salió)
ACTIONS.qxReturn = el => {
  const o = S.medOrders.find(x => x.id === el.dataset.id); UI.ret = { id: o.id, q: Object.fromEntries(o.items.map(it => [it.pid, 0])) };
  openSheet(`Registrar devolución · ${o.num}`, qxReturnBody(), `<span class="note" id="rt-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="qxReturnSave">Devolver al almacén</button>`);
};
function qxReturnBody() {
  const o = S.medOrders.find(x => x.id === UI.ret.id);
  return `${patientBand(o.pid, 'Quirófano')}<div class="small muted">Indique cuántas unidades no se utilizaron. Vuelven al inventario y no se consideran consumidas.</div>
  <div class="list">${o.items.filter(it => it.qty > 0).map(it => { const max = it.qty - (it.returned || 0); return `<div class="row"><div class="grow"><div class="t">${esc(prod(it.pid).name)}</div><div class="s">Despachadas ${it.qty}${it.returned ? ` · ya devueltas ${it.returned}` : ''}</div></div>${stepper('rt-' + it.pid, UI.ret.q[it.pid], 'qxRetQ', `data-p="${it.pid}"`, 0, max)}</div>`; }).join('')}</div>`;
}
ACTIONS.qxRetQ = el => { const o = S.medOrders.find(x => x.id === UI.ret.id); const it = o.items.find(i => i.pid === el.dataset.p);
  UI.ret.q[it.pid] = Math.min(it.qty - (it.returned || 0), Math.max(0, UI.ret.q[it.pid] + +el.dataset.d)); refreshSheet(qxReturnBody()); };
ACTIONS.qxReturnSave = () => {
  const o = S.medOrders.find(x => x.id === UI.ret.id); const lines = o.items.filter(it => UI.ret.q[it.pid] > 0);
  if (!lines.length) { document.getElementById('rt-msg').textContent = 'Indique al menos una unidad a devolver.'; return; }
  lines.forEach(it => { const q = UI.ret.q[it.pid]; let n = q; const p = prod(it.pid);
    // Solicitudes anteriores sin detalle por lote: se reconstruye con lo que queda despachado
    if (!it.used) { const left = it.qty - (it.returned || 0); it.used = [{ lot: (it.lots || '').split(', ')[0], qty: left, cost: left > 0 ? (it.cost || 0) / left : 0, ret: 0 }]; }
    let cost = 0; const back = [];
    for (const u of [...it.used].reverse()) {   // vuelve primero al último lote del que salió
      if (!n) break; const k = Math.min(n, u.qty - (u.ret || 0)); if (k <= 0) continue;
      const lot = p.lots.find(l => l.num === u.lot); if (lot) lot.qty += k; else p.lots.push({ id: uid('l'), num: u.lot || 'DEVOLUCION', qty: k, cost: u.cost, exp: null, sup: null, brand: '', recv: dAt(0) });
      u.ret = (u.ret || 0) + k; n -= k; cost += k * u.cost; back.push(`${u.lot} ×${k}`);
    }
    it.returned = (it.returned || 0) + q; it.cost = r2((it.cost || 0) - cost);
    S.moves.unshift({ id: uid('mv'), date: dAt(0), type: 'entrada', pid: p.id, name: p.name, cat: p.cat, qty: q, cost: r2(cost), ref: `${o.num} · Devolución de quirófano`, user: S.user, lots: back.join(', ') }); });
  log('Devolución de quirófano', `${o.num} · ${lines.map(it => `${prod(it.pid).name} ×${UI.ret.q[it.pid]}`).join(', ')}`); save(); closeSheet(); render(); toast('Devolución registrada · inventario actualizado');
};

// ---------- Kits de cirugía (los crea y modifica el administrador) ----------
// Un kit es una lista de productos del inventario con su cantidad, p. ej. "Laparotomía": sevoflurano, fentanilo,
// kit de cama, kit de laparotomía, kit de paciente… Al programar la cirugía se elige el kit, y la primera
// solicitud al almacén de esa cirugía llega precargada con él.
ACTIONS.kitsOpen = () => !can('*') ? toast('Los kits de cirugía los administra Administración') : openSheet('Kits de cirugía', kitsList(), `<button class="btn" data-act="close">Cerrar</button><button class="btn primary" data-act="kitEdit">Nuevo kit</button>`, { wide: true });
function kitsList() {
  const ks = S.kits || [];
  return `<div class="small muted">Elija el kit al programar la cirugía. La solicitud al almacén se precarga con estos productos y cantidades, y se puede ajustar antes de enviarla.</div>
  <div class="list">${ks.map(k => `<button class="row" data-act="kitEdit" data-id="${k.id}"><div class="grow"><div class="t">${esc(k.name)}</div><div class="s">${k.items.map(it => `${esc(prod(it.pid)?.name || 'Producto eliminado')} ×${it.qty}`).join(' · ') || 'Sin productos'}</div></div><span class="pill">${k.items.length} artículo(s)</span></button>`).join('') || '<div class="empty">Todavía no hay kits. Cree el primero con "Nuevo kit".</div>'}</div>`;
}
ACTIONS.kitEdit = el => { if (!can('*')) return; const k = kitOf(el.dataset?.id);
  UI.kit = k ? { id: k.id, name: k.name, items: k.items.map(it => ({ ...it })) } : { id: null, name: '', items: [{ pid: '', qty: 1 }] };
  openSheet(k ? `Kit · ${k.name}` : 'Nuevo kit de cirugía', kitForm(), `<span class="note" id="kit-msg"></span>${k ? '<button class="btn danger" data-act="kitDel">Eliminar</button>' : ''}<button class="btn" data-act="kitsOpen">Volver</button><button class="btn primary" data-act="kitSave">Guardar kit</button>`, { wide: true }); };
function kitForm() {
  const o = UI.kit;
  return `<div class="field"><label for="kit-n">Nombre del kit</label><input class="input" id="kit-n" value="${esc(o.name)}" placeholder="Ej. Laparotomía · anestesia general"></div>
  ${prodList('kit-list', S.products)}
  <div class="stack">${o.items.map((it, i) => `<div class="morow2">${prodPicker('kit-p' + i, it.pid, 'kit-list', 'kitProd', `data-i="${i}"`)}
    <div class="hstack" style="flex-wrap:nowrap">${stepper('kit-q' + i, it.qty, 'kitQty', `data-i="${i}"`, 1, 999)}<button class="btn ghost" data-act="kitRow" data-i="${i}" aria-label="Quitar producto">✕</button></div></div>`).join('')}</div>
  <button class="btn sm" style="justify-self:start" data-act="kitRow">+ Agregar producto</button>`;
}
const kitKeep = () => { UI.kit.name = val('kit-n'); };
const kitRedraw = () => { kitKeep(); refreshSheet(kitForm()); };
ACTIONS.kitProd = el => { const p = pickProd(el.value, S.products); if (!p) { if (el.value.trim()) toast('Elija un producto de la lista'); el.value = el.dataset.prev || ''; return; } UI.kit.items[+el.dataset.i].pid = p.id; kitRedraw(); };
ACTIONS.kitQty = el => { const it = UI.kit.items[+el.dataset.i]; it.qty = Math.min(999, Math.max(1, it.qty + +el.dataset.d)); kitRedraw(); };
ACTIONS.kitRow = el => { kitKeep(); if (el.dataset.i != null) UI.kit.items.splice(+el.dataset.i, 1); else UI.kit.items.push({ pid: '', qty: 1 }); refreshSheet(kitForm());
  if (el.dataset.i == null) document.getElementById('kit-p' + (UI.kit.items.length - 1))?.focus(); };
ACTIONS.kitSave = () => {
  if (!can('*')) return; kitKeep(); const o = UI.kit; const msg = document.getElementById('kit-msg'); const name = o.name.trim();
  if (!name) { msg.textContent = 'Escriba el nombre del kit.'; return; }
  const items = []; o.items.filter(it => prod(it.pid)).forEach(it => { const x = items.find(y => y.pid === it.pid); if (x) x.qty += it.qty; else items.push({ pid: it.pid, qty: it.qty }); });
  if (!items.length) { msg.textContent = 'Agregue al menos un producto.'; return; }
  S.kits = S.kits || []; const k = o.id ? kitOf(o.id) : { id: uid('kit') }; Object.assign(k, { name, items }); if (!o.id) S.kits.push(k);
  log(o.id ? 'Kit de cirugía modificado' : 'Kit de cirugía creado', `${name} · ${items.length} artículo(s)`); save(); toast('Kit guardado'); ACTIONS.kitsOpen();
};
ACTIONS.kitDel = () => { const k = kitOf(UI.kit.id); if (!k) return;
  const used = S.appts.filter(a => a.kit === k.id && !a.done && isActive(a)).length;
  // El kit es obligatorio en cada cirugía: no se elimina mientras alguna programada lo use
  if (used) { document.getElementById('kit-msg').textContent = `No se puede eliminar: ${used} cirugía(s) programada(s) lo usan. Cámbieles el kit primero.`; return; }
  openSheet('Eliminar kit', `<p style="margin:0">Se eliminará el kit <b>${esc(k.name)}</b>.${used ? ` ${used} cirugía(s) programada(s) lo tienen asignado y quedarán sin kit.` : ''}</p>`,
    `<button class="btn" data-act="kitEdit" data-id="${k.id}">Volver</button><button class="btn danger" data-act="kitDelSave" data-id="${k.id}">Eliminar</button>`); };
ACTIONS.kitDelSave = el => { const k = kitOf(el.dataset.id); if (!k || !can('*')) return; S.kits = S.kits.filter(x => x !== k);
  S.appts.forEach(a => { if (a.kit === k.id) a.kit = null; }); log('Kit de cirugía eliminado', k.name); save(); toast('Kit eliminado'); ACTIONS.kitsOpen(); };

// Evolución desde Quirófano: si el paciente está ingresado se evoluciona en su ingreso; si no, se ofrece ingresarlo
function qxEvolutionButton(a) {
  if (a.date > dAt(0) || ['cancelada', 'no_asistio'].includes(a.status)) return '';
  if (!evCanWrite() && role() !== 'admin') return '';
  const adm = S.admissions.find(x => x.pid === a.pid && x.status === 'ingresado');
  if (adm) return evolutionBedButton(adm);
  return canAdmit() ? `<button class="btn sm" data-act="admitNew" data-pid="${a.pid}" data-area="hosp" title="La evolución se escribe dentro del ingreso">Ingresar para evolucionar</button>` : '';
}
