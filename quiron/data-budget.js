// Presupuestos por paquete: cada cirugía, atención de emergencia o procedimiento frecuente tiene un paquete
// con horas de quirófano, días de hospitalización o UCI, honorarios, un monto global de material e insumos y
// otros cargos. El presupuesto se arma eligiendo el paquete y ajustando solo lo que cambia; en el documento
// aparecen pocas líneas consolidadas. Al cobrar no se descuenta inventario: lo usado sale por las solicitudes
// al almacén (Quirófano y Hospitalización).
// Los exámenes, la imagen y las consultas no llevan presupuesto: se cobran directamente.

const BUD_KINDS = { quirurgico: 'Quirúrgico', emergencia: 'Emergencia', procedimiento: 'Procedimiento' };
const FEES = (...pairs) => pairs.map(([name, amount]) => ({ name, amount }));
function seedPackages() {
  // Valores de ejemplo para empezar: la clínica los ajusta en Servicios → Paquetes
  const P = (id, kind, name, hours, days, uci, fees, material, extras = []) => ({ id, kind, name, hours, days, uci, fees, material, extras, example: true });
  const QX = (s, a, an) => FEES(['Cirujano', s], ['Ayudante', a], ['Anestesiólogo', an]);
  return [
    P('pk1', 'quirurgico', 'Colecistectomía laparoscópica', 2, 1, 0, QX(600, 200, 200), 380),
    P('pk2', 'quirurgico', 'Herniorrafia inguinal', 2, 1, 0, QX(500, 150, 150), 250),
    P('pk3', 'quirurgico', 'Apendicectomía', 2, 2, 0, QX(500, 150, 150), 260),
    P('pk4', 'quirurgico', 'Histerectomía abdominal', 3, 2, 0, QX(800, 250, 250), 420),
    P('pk5', 'quirurgico', 'Cesárea segmentaria', 2, 2, 0, QX(700, 200, 200), 300),
    P('pk6', 'quirurgico', 'Legrado uterino', 1, 0, 0, QX(300, 0, 120), 90),
    P('pk7', 'emergencia', 'Atención de emergencia con observación (hasta 6 h)', 0, 0, 0, FEES(['Médico de guardia', 60]), 60, [{ name: 'Sala de emergencia y observación', amount: 120 }]),
    P('pk8', 'emergencia', 'Emergencia con hospitalización de 24 h', 0, 1, 0, FEES(['Médico de guardia', 80], ['Interconsulta con especialista', 60]), 150),
    P('pk9', 'procedimiento', 'Histeroscopia diagnóstica', 1, 0, 0, FEES(['Médico tratante', 350], ['Anestesiólogo', 120]), 150),
    P('pk10', 'procedimiento', 'Endoscopia digestiva superior', 0, 0, 0, FEES(['Médico tratante', 200], ['Anestesiólogo', 100]), 80, [{ name: 'Sala de procedimientos', amount: 150 }]),
    P('pk11', 'procedimiento', 'Exéresis de lesión de piel o partes blandas', 0, 0, 0, FEES(['Médico tratante', 250]), 80, [{ name: 'Sala de procedimientos', amount: 100 }]),
  ];
}
// Presupuesto (datos) a partir de un paquete
const budgetFromPkg = pk => ({ v2: true, kind: pk.kind || 'quirurgico', tpl: pk.id, proc: pk.name, hours: pk.hours || 0, days: pk.days || 0, uci: pk.uci || 0,
  fees: (pk.fees || []).map(f => ({ ...f })), material: pk.material || 0, extras: (pk.extras || []).map(e => ({ ...e })), adj: 0, disc: 0, detailFees: false });

// Líneas del documento. El aumento interno (adj %) va dentro de cada precio y no se muestra.
function pkgItems(b) {
  const k = 1 + (+b.adj || 0) / 100; const L = [];
  const add = (name, base) => { base = Math.round((+base || 0) * 100) / 100; if (base > 0) L.push({ name, base, adj: +b.adj || 0, price: Math.round(base * k * 100) / 100, iva: false }); };
  const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (b.hours > 0) add(`Quirófano · ${pl(b.hours, 'hora', 'horas')}`, svcPrice(svc('v5'), b.hours));
  if (b.days > 0) add(`Hospitalización · ${pl(b.days, 'día', 'días')}`, b.days * (svc('v8')?.price || 0));
  if (b.uci > 0) add(`Unidad de cuidados intensivos · ${pl(b.uci, 'día', 'días')}`, b.uci * (svc('v33')?.price || 0));
  const fees = (b.fees || []).filter(f => +f.amount > 0);
  if (b.detailFees) fees.forEach(f => add(`Honorarios · ${f.name || 'Médico'}`, f.amount));
  else add('Honorarios médicos', fees.reduce((s, f) => s + +f.amount, 0));
  add('Material, medicamentos e insumos', b.material);
  (b.extras || []).forEach(e => add(e.name || 'Otro cargo', e.amount));
  return L;
}

// Número de la cuenta de cobro: con factura fiscal (F- y Nº de control) o sin factura (C-)
function chargeNumber(fiscal, sheets) {
  if (fiscal) { const error = facturaSheetError(sheets); if (error) throw new Error(error); const num = 'F-' + String(S.invSeq++).padStart(5, '0'); return { num, control: sheets[0].control, sheets: sheets.map(x => ({ ...x })), fiscal: true }; }
  S.cobSeq = S.cobSeq || 1; return { num: 'C-' + String(S.cobSeq++).padStart(5, '0'), control: '', fiscal: false };
}
const isFiscal = i => i.fiscal !== false;
const chargeLabel = i => isFiscal(i) ? 'Factura' : 'Cuenta';
// Emitir la factura fiscal de una cuenta ya registrada (opcional, cuando el paciente la pida)
function emitFiscal(inv, sheets, details = {}) {
  if (isFiscal(inv)) return inv;
  const n = chargeNumber(true, sheets); Object.assign(inv, details, { sheets: n.sheets }); inv.issueDate = dAt(0); inv.prev = inv.num; inv.num = n.num; inv.control = n.control; inv.fiscal = true; inv.fiscalAt = nowStamp();
  if (!inv.rate) inv.rate = S.rate;   // el monto en Bs de la factura queda fijo a la tasa del día de emisión
  log('Factura fiscal emitida', `${inv.num} · antes ${inv.prev} · ${pat(inv.pid).name}`); save();
  return inv;
}

// Cuenta de cobro desde un presupuesto (sin descontar inventario). La factura fiscal es opcional.
function chargeFromBudget(b, fiscal = false, sheets) {
  if (!['enviado', 'aceptado'].includes(b.status) || b.inv) return { ok: false, msg: 'Este presupuesto ya tiene un cobro registrado o no está enviado a Contabilidad.' };
  const n = chargeNumber(fiscal, sheets);
  const inv = { id: uid('f'), ...n, pid: b.pid, doc: b.doc, date: dAt(0), disc: +b.disc || 0, proc: b.proc, items: budgetItems(b).map(x => ({ ...x })), cost: 0, payments: [], status: 'pendiente', budget: b.id, ...(fiscal ? { rate: S.rate } : {}) };
  S.invoices.unshift(inv); b.status = 'facturado'; b.inv = inv.id;
  log('Cobro registrado desde presupuesto', `${inv.num} · ${b.num} · ${pat(b.pid).name}`); save();
  return { ok: true, inv };
}

// Los controles impresos nunca se generan ni se reutilizan, incluidas hojas dañadas.
const facturaControlKey = value => String(value || '').trim().toUpperCase().replace(/[\s-]/g, '').replace(/^0+(?=\d)/, '');
function facturaSheetError(sheets, excludeId) {
  if (!Array.isArray(sheets) || !sheets.length || sheets.some(x => !String(x.control || '').trim())) return 'Escriba el N° de control de cada hoja usada.';
  const keys = sheets.map(x => facturaControlKey(x.control));
  if (new Set(keys).size !== keys.length) return 'No repita el N° de control entre hojas.';
  const used = (S.facturaVoids || []).map(x => x.control);
  (S.invoices || []).filter(x => x.id !== excludeId).forEach(x => used.push(...(x.sheets?.map(h => h.control) || [x.control]).filter(Boolean)));
  const duplicate = sheets.find(x => used.some(y => facturaControlKey(y) === facturaControlKey(x.control)));
  return duplicate ? 'El N° de control ' + duplicate.control + ' ya fue usado o anulado.' : '';
}
