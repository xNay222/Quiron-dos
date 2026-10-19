// Contabilidad: libro de entradas y salidas en dólares y en bolívares.
// Lo que ya pasa por el sistema entra solo (cobros, IGTF, compras recibidas); lo demás se registra a mano en S.ledger.
// Cada movimiento guarda su moneda original y la tasa del día, así el equivalente en USD nunca cambia.

const ACCT_CATS = {
  entrada: ['Cobros a pacientes', 'Alquiler de consultorios', 'Subarriendo (laboratorio)', 'Otros ingresos'],
  salida: ['Compras de inventario', 'Gastos de caja', 'Nómina', 'Honorarios médicos', 'Servicios (luz, agua, internet)', 'Alcaldía y tasas municipales', 'Alquiler', 'Mantenimiento', 'Impuestos', 'Otros gastos'],
};

// ---------- Recurrentes: cada vencimiento queda "por confirmar"; entra al libro solo al confirmar el pago o cobro ----------
const RECUR_FREQ = { mensual: 'Cada mes', quincenal: 'Cada quincena (15 y último día)' };
function seedRecurring() {
  const start = iso(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const R = (name, type, cat, amount, cur, method, freq, day, example = true) => ({ id: uid('rc'), name, type, cat, amount, cur, method, freq, day, start, active: true, done: [], example });
  return [
    R('Alcaldía y Fospuca (aseo urbano)', 'salida', 'Alcaldía y tasas municipales', 400, 'USD', 'Transferencia USD', 'mensual', 5),
    R('Internet', 'salida', 'Servicios (luz, agua, internet)', 90, 'USD', 'Transferencia USD', 'mensual', 1),
    R('Electricidad (Corpoelec)', 'salida', 'Servicios (luz, agua, internet)', 412000, 'VES', 'Transferencia Bs', 'mensual', 10),
    R('Nómina', 'salida', 'Nómina', 3200, 'USD', 'Transferencia USD', 'quincenal', null),
    R('Alquiler consultorio 1', 'entrada', 'Alquiler de consultorios', 500, 'USD', 'Transferencia USD', 'mensual', 1),
    R('Alquiler consultorio 2', 'entrada', 'Alquiler de consultorios', 500, 'USD', 'Zelle', 'mensual', 1),
    R('Subarriendo del laboratorio', 'entrada', 'Subarriendo (laboratorio)', 800, 'USD', 'Transferencia USD', 'mensual', 5),
  ];
}
const monthLen = (y, m) => new Date(y, m + 1, 0).getDate();
// Fechas en que toca un recurrente dentro de un mes
function recurDates(r, y, m) {
  const pad = d => iso(new Date(y, m, d));
  if (r.freq === 'quincenal') return [{ date: pad(15), label: '1ra quincena' }, { date: pad(monthLen(y, m)), label: '2da quincena' }];
  return [{ date: pad(Math.min(r.day || 1, monthLen(y, m))), label: '' }];
}
// Crea los vencimientos pendientes (desde su inicio hasta hoy) que aún no existen
function runRecurrents() {
  if (!S.recurring) return 0; S.dues = S.dues || []; let n = 0; const today = dAt(0);
  S.recurring.filter(r => r.active).forEach(r => {
    const s = new Date(r.start + 'T00:00');
    for (let y = s.getFullYear(), m = s.getMonth(); y < TODAY.getFullYear() || (y === TODAY.getFullYear() && m <= TODAY.getMonth()); m === 11 ? (y++, m = 0) : m++) {
      recurDates(r, y, m).forEach(({ date, label }) => {
        if (date < r.start || date > today || r.done.includes(date)) return;
        S.dues.push({ id: uid('du'), rec: r.id, date, type: r.type, cat: r.cat, concept: r.name + (label ? ` · ${label}` : ''), amount: r.amount, cur: r.cur, method: r.method, status: 'pendiente' });
        r.done.push(date); n++;
      });
    }
  });
  if (n) save();
  return n;
}
function nextDue(r) {
  const today = dAt(0);
  for (let k = 0; k < 3; k++) { const d = new Date(TODAY.getFullYear(), TODAY.getMonth() + k, 1); const hit = recurDates(r, d.getFullYear(), d.getMonth()).find(x => x.date > today && x.date >= r.start); if (hit) return hit.date; }
  return null;
}
const ACCT_METHODS = { USD: ['Efectivo USD', 'Zelle', 'Transferencia USD'], VES: ['Pago móvil', 'Transferencia Bs', 'Punto de venta'] };

function seedLedger() {
  const out = []; const L = (date, type, cat, concept, amount, cur, method, rate, example = true) => out.push({ id: 'g' + out.length, date, type, cat, concept, amount, cur, method, rate, example });
  // Resumen de los 5 meses anteriores (ejemplo) para que el gráfico tenga historia; tasas de cada mes
  const rates = [612.4, 668.9, 731.2, 789.5, 834.1];
  [-5, -4, -3, -2, -1].forEach((m, i) => {
    const d = k => iso(new Date(TODAY.getFullYear(), TODAY.getMonth() + m, k)); const r = rates[i]; const f = 1 + i * 0.06;
    L(d(28), 'entrada', 'Cobros a pacientes', 'Cobros del mes en dólares (resumen)', Math.round(16800 * f), 'USD', 'Zelle', r);
    L(d(28), 'entrada', 'Cobros a pacientes', 'Cobros del mes en bolívares (resumen)', Math.round(5200 * f * r), 'VES', 'Pago móvil', r);
    L(d(5), 'entrada', 'Subarriendo (laboratorio)', 'Subarriendo del laboratorio', 800, 'USD', 'Transferencia USD', r);
    L(d(15), 'salida', 'Nómina', 'Nómina 1ra quincena', 3200, 'USD', 'Transferencia USD', r);
    L(d(30 > 28 ? 28 : 30), 'salida', 'Nómina', 'Nómina 2da quincena', 3200, 'USD', 'Transferencia USD', r);
    L(d(20), 'salida', 'Honorarios médicos', 'Liquidación de honorarios', Math.round(5400 * f), 'USD', 'Zelle', r);
    L(d(10), 'salida', 'Servicios (luz, agua, internet)', 'Corpoelec, Hidrocapital, internet', Math.round(950 * r), 'VES', 'Transferencia Bs', r);
    L(d(3), 'salida', 'Alquiler', 'Alquiler del local', 2500, 'USD', 'Transferencia USD', r);
    L(d(18), 'salida', 'Compras de inventario', 'Compras del mes (resumen)', Math.round(2100 * f), 'USD', 'Transferencia USD', r);
    L(d(22), 'salida', 'Impuestos', 'IVA e IGTF declarados', Math.round(380 * f * r), 'VES', 'Transferencia Bs', r);
  });
  // El mes en curso lo llenan los recurrentes (nómina, alquileres, servicios…) y los movimientos del sistema
  return out;
}

const usdOf = m => m.cur === 'USD' ? m.amount : (m.rate ? m.amount / m.rate : 0);

// Todos los movimientos (automáticos + manuales) en un rango de fechas, del más reciente al más antiguo
function acctMoves(from = '0000', to = '9999') {
  const out = [];
  S.invoices.forEach(inv => inv.payments.forEach(p => {
    const d = p.at.slice(0, 10); const m = metodo(p.method);
    out.push({ id: p.id, date: d, type: 'entrada', cat: 'Cobros a pacientes', concept: `${inv.num} · ${pat(inv.pid)?.name || ''}`, amount: p.amount, cur: p.cur, method: m?.name || p.method, rate: p.rate || S.rate, auto: 'Facturación' , invId: inv.id, at: p.at });
    if (p.igtf) out.push({ id: p.id + '-igtf', date: d, type: 'entrada', cat: 'IGTF cobrado (por pagar al SENIAT)', concept: `IGTF de ${inv.num}`, amount: p.igtf, cur: 'USD', method: m?.name || p.method, rate: p.rate || S.rate, auto: 'Facturación', at: p.at });
  }));
  // Compras: la salida se registra cuando Contabilidad confirma y paga la orden
  S.orders.filter(o => o.payment).forEach(o => out.push({ id: o.id, date: o.payment.date, type: 'salida', cat: 'Compras de inventario', concept: `${o.num} · ${sup(o.sup)?.name || ''}`, amount: o.payment.amount, cur: o.payment.cur, method: o.payment.method, rate: o.payment.rate, ref: o.payment.ref, auto: 'Compras', at: o.payment.at }));
  (S.ledger || []).filter(g => !g.void).forEach(g => out.push({ ...g, auto: g.source || '' }));
  return out.filter(m => m.date >= from && m.date <= to).sort((a, b) => b.date.localeCompare(a.date));
}

function acctTotals(list) {
  const t = { USD: { in: 0, out: 0 }, VES: { in: 0, out: 0 }, usdIn: 0, usdOut: 0 };
  list.forEach(m => { t[m.cur][m.type === 'entrada' ? 'in' : 'out'] += m.amount; if (m.type === 'entrada') t.usdIn += usdOf(m); else t.usdOut += usdOf(m); });
  ['USD', 'VES'].forEach(c => { t[c].in = r2(t[c].in); t[c].out = r2(t[c].out); t[c].net = r2(t[c].in - t[c].out); });
  t.usdIn = r2(t.usdIn); t.usdOut = r2(t.usdOut); t.usdNet = r2(t.usdIn - t.usdOut);
  return t;
}

function acctMonthly(months = 6) {
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1); const from = iso(d), to = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const t = acctTotals(acctMoves(from, to));
    out.push({ label: d.toLocaleDateString('es-VE', { month: 'short' }).replace('.', ''), in: t.usdIn, out: t.usdOut });
  }
  return out;
}

// rate: tasa BCV del día de la operación (si no se indica, la de hoy)
function addLedger({ date, type, cat, concept, amount, cur, method, ref, source, rate, fund }) {
  const g = { id: uid('g'), date, type, cat, concept, amount: r2(amount), cur, method, ref: ref || '', rate: rate > 0 ? r2(rate) : S.rate, source: source || '', confirmed: true, at: nowStampS(), ...(fund ? { fund } : {}) };
  (S.ledger = S.ledger || []).unshift(g);
  log(type === 'entrada' ? 'Entrada registrada' : 'Salida registrada', `${concept} · ${fmt(amount, cur)}`);
  save();
  return g;
}
