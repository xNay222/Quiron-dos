// Hospitalización: ingresos, camas, solicitudes de medicación (el médico pide, el almacén despacha) y
// registro de administración (qué dosis se colocó, cuándo y quién). El despacho descuenta el inventario por lote.

// area: 'hosp' (Hospitalización) o 'emerg' (Emergencias). Cada área tiene su propio mapa de camas.
const BEDS = [
  ...[1, 2, 3, 4, 5].map(n => ({ id: 'H-0' + n, type: 'Habitación', area: 'hosp' })),
  { id: 'UCI-01', type: 'UCI', area: 'hosp' }, { id: 'UCI-02', type: 'UCI', area: 'hosp' },
  ...[1, 2, 3].map(n => ({ id: 'EM-0' + n, type: 'Emergencia', area: 'emerg' })),
];
const AREAS = { hosp: { route: 'hospitalizacion', name: 'Hospitalización' }, emerg: { route: 'emergencias', name: 'Emergencias' } };
const MO_ST = { pendiente: ['Pendiente de despacho', 'warn'], parcial: ['Despacho parcial · falta', 'warn'], despachada: ['Despachada', 'good'], rechazada: ['Rechazada', 'bad'] };
// Solicitud con algo entregado (total o parcial): ya se puede aplicar o devolver lo que salió
const moServed = o => ['despachada', 'parcial'].includes(o.status);
// Lo que aún falta entregar de una línea (0 si se completó o si el faltante se cerró)
const moRemaining = (o, it) => o.status === 'pendiente' ? (it.req ?? it.qty) : it.short ? 0 : Math.max(0, (it.req ?? it.qty) - it.qty);

// Datos de ejemplo. El despacho ya hecho descuenta sus lotes aquí mismo para que el inventario cuadre.
function seedHosp(products, moves) {
  const take = (pid, qty, ref) => { const p = products.find(x => x.id === pid); let left = qty; const used = [];
    for (const l of p.lots.filter(l => l.qty > 0 && (!l.exp || l.exp >= dAt(0))).sort((a, b) => (a.exp || '9').localeCompare(b.exp || '9'))) { if (!left) break; const n = Math.min(l.qty, left); l.qty -= n; left -= n; used.push(l.num); }
    const cost = Math.round(qty * (p.lots[0]?.cost || 0) * 100) / 100; /* r2 aún no existe mientras se crean los datos de ejemplo */ moves.unshift({ id: uid('mv'), date: dAt(-1), type: 'consumo', pid, name: p.name, cat: p.cat, qty: -qty, cost, ref, user: 'Almacén', lots: used.join(', ') }); return { lots: used.join(', '), cost }; };
  const d1 = take('p9', 3, 'SM-0007 · Hospitalización'), d2 = take('p14', 2, 'SM-0007 · Hospitalización'), d3 = take('p10', 2, 'SM-0007 · Hospitalización');
  const admissions = [
    { id: 'ad1', num: 'HOS-0011', pid: 'pt3', bed: 'H-03', doc: 'm2', dx: 'Dolor pélvico agudo en estudio', reason: 'Dolor pélvico intenso, vómitos', admittedAt: dAt(-1) + ' 18:20', status: 'ingresado', billDays: null },
    { id: 'ad2', num: 'HOS-0012', pid: 'pt4', bed: 'H-01', doc: 'm1', dx: 'Postoperatorio de colecistectomía laparoscópica', reason: 'Postoperatorio inmediato', admittedAt: dAt(0) + ' 09:30', status: 'ingresado', billDays: null },
  ];
  const medOrders = [
    { id: 'mo1', num: 'SM-0007', admId: 'ad1', pid: 'pt3', by: 'r1', at: dAt(-1) + ' 18:45', urgent: false, note: 'Analgesia y antiemético.', status: 'despachada', dispatchedBy: 'Almacén', dispatchedAt: dAt(-1) + ' 19:05',
      items: [{ pid: 'p9', qty: 3, dose: '30 mg', route: 'IV', freq: 'cada 8 h', lots: d1.lots, cost: d1.cost }, { pid: 'p14', qty: 2, dose: '500 ml', route: 'IV', freq: 'cada 12 h', lots: d2.lots, cost: d2.cost }, { pid: 'p10', qty: 2, dose: '4 mg', route: 'IV', freq: 'cada 12 h si náuseas', lots: d3.lots, cost: d3.cost }] },
    { id: 'mo2', num: 'SM-0008', admId: 'ad2', pid: 'pt4', by: 'm1', at: dAt(0) + ' 09:50', urgent: true, note: 'Profilaxis y analgesia postoperatoria.', status: 'pendiente',
      items: [{ pid: 'p8', qty: 3, dose: '1 g', route: 'IV', freq: 'cada 8 h' }, { pid: 'p9', qty: 3, dose: '30 mg', route: 'IV', freq: 'cada 8 h' }, { pid: 'p10', qty: 2, dose: '4 mg', route: 'IV', freq: 'cada 12 h' }] },
  ];
  // Registro de administración (kardex): cada dosis colocada
  const mar = [
    { id: uid('k'), admId: 'ad1', orderId: 'mo1', pidProd: 'p9', dose: '30 mg', route: 'IV', at: dAt(-1) + ' 19:15', by: 'Dr. Daniel Pérez', nurse: 'Lic. Carmen Díaz' },
    { id: uid('k'), admId: 'ad1', orderId: 'mo1', pidProd: 'p14', dose: '500 ml', route: 'IV', at: dAt(-1) + ' 19:20', by: 'Dr. Daniel Pérez', nurse: 'Lic. Carmen Díaz' },
    { id: uid('k'), admId: 'ad1', orderId: 'mo1', pidProd: 'p9', dose: '30 mg', route: 'IV', at: dAt(0) + ' 03:15', by: 'Dra. Sofía Marín', nurse: 'Lic. Yolanda Pérez' },
  ];
  return { admissions, medOrders, mar, hosSeq: 13, moSeq: 9 };
}
const hospNotes = [
  { id: 'hc3', pid: 'pt3', admId: 'ad1', date: null, time: '19:00', doc: 'r1', type: 'evolucion', status: 'firmada', motivo: 'Ingreso por dolor pélvico agudo.',
    actual: 'Paciente consciente, orientada, con dolor pélvico 7/10 que mejora con analgesia IV. Tolera vía oral líquida.', vitals: { ta: '118/76', fc: '92', fr: '18', temp: '37,6', sat: '98' },
    examen: 'Abdomen blando, doloroso en hipogastrio, sin signos de irritación peritoneal.', dx: ['Dolor pélvico agudo en estudio (R10.2)'], plan: 'Ecografía pélvica urgente. Analgesia y antiemético. Control de signos vitales cada 4 h.', indicaciones: '', recipe: [], addenda: [] },
];

const admOf = id => (S.admissions || []).find(a => a.id === id);
const activeAdmission = pid => (S.admissions || []).find(a => a.pid === pid && a.status === 'ingresado');
const bedOf = id => BEDS.find(b => b.id === id);
const admArea = a => bedOf(a?.bed)?.area || 'hosp';   // área donde está hoy el paciente
const areaRoute = a => AREAS[admArea(a)].route;
const stayDays = a => Math.max(1, Math.ceil(((a.status === 'alta' ? new Date(a.dischargedAt.replace(' ', 'T')) : new Date()) - new Date(a.admittedAt.replace(' ', 'T'))) / DAY));
const dayNumber = a => Math.round((TODAY - new Date(a.admittedAt.slice(0, 10) + 'T00:00')) / DAY) + 1;   // día calendario del ingreso
const pendingMedOrders = () => (S.medOrders || []).filter(o => ['pendiente', 'parcial'].includes(o.status));
const givenCount = (o, it) => (S.mar || []).filter(k => k.orderId === o.id && k.pidProd === it.pid).length;

// El almacén despacha lo que realmente sale (puede ser menos de lo solicitado): descuenta del inventario (FEFO)
// y guarda en cada línea lo solicitado (req), lo despachado (qty), los lotes y el costo.
function dispatchMedOrder(oid, qtyMap = null) {
  const o = S.medOrders.find(x => x.id === oid);
  if (!o || !['pendiente', 'parcial'].includes(o.status)) return { ok: false, msg: 'Esta solicitud ya fue procesada.' };   // evita descontar dos veces
  const give = it => { const rem = moRemaining(o, it); return qtyMap ? Math.max(0, Math.min(qtyMap[it.pid] ?? 0, rem)) : rem; };
  const lines = o.items.map(it => ({ it, q: give(it) }));
  if (lines.every(l => l.q === 0)) return { ok: false, msg: 'No hay cantidades para despachar' };
  const missing = checkStock(lines.filter(l => l.q > 0).map(l => ({ pid: l.it.pid, qty: l.q })));
  if (missing.length) return { ok: false, missing };
  // Primer despacho: la cantidad solicitada pasa a "req" y "qty" cuenta lo entregado
  if (o.status === 'pendiente') o.items.forEach(it => { it.req = it.req ?? it.qty; it.qty = 0; it.cost = 0; it.used = []; it.lots = ''; });
  const ref = `${o.num} · ${o.kind === 'qx' ? 'Quirófano' : o.kind === 'extra' ? `Solicitud extraordinaria (${o.motive})` : AREAS[admArea(admOf(o.admId))].name} · ${pat(o.pid).name}`;
  lines.forEach(({ it, q }) => { if (!q) return; const r = takeStock(it.pid, q, 'consumo', ref);
    it.qty += q; it.cost = r2((it.cost || 0) + r.cost); it.used.push(...r.used.map(u => ({ ...u, ret: 0 }))); it.lots = [...new Set(it.used.map(u => u.lot))].join(', '); });
  (o.dispatches = o.dispatches || []).push({ at: nowStamp(), by: actor(), lines: lines.filter(l => l.q).map(l => ({ pid: l.it.pid, qty: l.q })) });
  const left = o.items.some(it => !it.short && it.qty < (it.req ?? it.qty));   // se calcula con lo entregado: el estado aún dice "pendiente"
  o.status = left ? 'parcial' : 'despachada'; o.partial = o.items.some(it => it.qty < it.req); o.dispatchedBy = actor(); o.dispatchedAt = nowStamp();
  log(left ? 'Medicación despachada parcialmente' : 'Medicación despachada', `${o.num} · ${pat(o.pid).name} · ${o.items.map(i => `${prod(i.pid).name} ${i.qty}/${i.req}`).join(', ')}`); save();
  return { ok: true, left };
}
// Cerrar lo que falta de una solicitud parcial (no habrá más entregas), con su motivo
function closeShortfall(oid, reason) {
  const o = S.medOrders.find(x => x.id === oid); if (!o || o.status !== 'parcial') return false;
  o.items.forEach(it => { if (moRemaining(o, it) > 0) it.short = reason; }); o.status = 'despachada'; o.shortReason = reason;
  log('Faltante de medicación cerrado', `${o.num} · ${reason}`); save(); return true;
}

// ---------- Consumo del paciente (contabilidad interna) ----------
// Todo lo que el almacén despachó para el paciente (hospitalización, emergencia y quirófano), menos lo devuelto,
// con su costo de compra por lote. Agrupado por episodio: cada ingreso y cada cirugía.
function patientConsumption(pid) {
  const eps = {};
  (S.medOrders || []).filter(o => o.pid === pid && moServed(o)).forEach(o => {
    const a = o.admId && admOf(o.admId); const q = o.apptId && S.appts.find(x => x.id === o.apptId);
    const key = a ? a.id : q ? q.id : 'otro';
    const ep = eps[key] = eps[key] || (a ? { key, date: a.admittedAt.slice(0, 10), title: `${a.emerg ? 'Emergencia' : 'Hospitalización'} ${a.num}`, sub: `${a.dx} · ${a.status === 'alta' ? `${stayDays(a)} día(s)` : 'en curso'}`, go: [areaRoute(a), a.id] }
      : q ? { key, date: q.date, title: `Cirugía · ${q.proc}`, sub: `${fdate(q.date)} · ${med(q.doc)?.name || ''}`, go: null } : { key, date: o.at.slice(0, 10), title: 'Otras solicitudes', sub: '', go: null });
    ep.lines = ep.lines || {};
    o.items.forEach(it => { const n = it.qty - (it.returned || 0); if (n <= 0 && !(it.cost > 0)) return;
      const l = ep.lines[it.pid] = ep.lines[it.pid] || { pid: it.pid, qty: 0, cost: 0 }; l.qty += n; l.cost = r2(l.cost + (it.cost || 0)); });
  });
  const list = Object.values(eps).map(ep => ({ ...ep, lines: Object.values(ep.lines).filter(l => l.qty > 0).sort((x, y) => y.cost - x.cost) })).filter(ep => ep.lines.length)
    .map(ep => ({ ...ep, total: r2(ep.lines.reduce((s, l) => s + l.cost, 0)), units: ep.lines.reduce((s, l) => s + l.qty, 0) })).sort((x, y) => y.date.localeCompare(x.date));
  return { list, total: r2(list.reduce((s, e) => s + e.total, 0)), units: list.reduce((s, e) => s + e.units, 0), noCost: list.some(e => e.lines.some(l => !l.cost)) };
}

// Devuelve al inventario n unidades de una línea despachada (al mismo lote del que salieron) y lo descuenta del consumo del paciente
function returnUnits(o, it, n, why) {
  const pr = prod(it.pid); if (!pr || n <= 0) return 0; let left = n, cost = 0;
  if (!it.used?.length) it.used = [{ lot: (it.lots || '').split(', ')[0], qty: it.qty, cost: it.qty ? (it.cost || 0) / it.qty : 0, ret: 0 }];
  [...it.used].reverse().forEach(u => { const k = Math.min(left, u.qty - (u.ret || 0)); if (k <= 0) return; const lot = pr.lots.find(l => l.num === u.lot);
    if (lot) lot.qty += k; else pr.lots.push({ id: uid('l'), num: u.lot || 'DEVOLUCION', qty: k, cost: u.cost || 0, exp: null, sup: null, brand: '', recv: dAt(0) });
    u.ret = (u.ret || 0) + k; left -= k; cost += k * (u.cost || 0);
    S.moves.unshift({ id: uid('mv'), date: dAt(0), type: 'entrada', pid: pr.id, name: pr.name, cat: pr.cat, qty: k, cost: r2(k * (u.cost || 0)), ref: `${o.num} · ${why}`, user: actor(), lots: u.lot || '' }); });
  const done = n - left; it.returned = (it.returned || 0) + done; it.cost = r2((it.cost || 0) - cost); return done;
}
// Unidades despachadas a un ingreso que nadie registró como aplicadas
const unusedOfAdm = admId => (S.medOrders || []).filter(o => o.admId === admId && moServed(o)).flatMap(o => o.items.map(it => ({ o, it, n: it.qty - (it.returned || 0) - givenCount(o, it) }))).filter(x => x.n > 0);
