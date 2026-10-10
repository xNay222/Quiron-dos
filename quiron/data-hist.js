// Historias clínicas: archivo histórico (anterior al software) + registros nativos,
// y las funciones de estadística que usan el panel y la IA. La IA nunca calcula a ojo:
// consulta estas funciones, que trabajan sobre los registros reales.

function seedRecords() {
  let s = 20261004; const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return u - 3; };
  const MED = {
    cef: ['Cefazolina 2 g', 'IV', ['Cefazolina 2 g', 'Cefazolina 2gr', 'Cefazol. 2 g']],
    ond: ['Ondansetrón 4 mg', 'IV', ['Ondansetrón 4 mg', 'Zofran 4 mg', 'Ondansetron 4mg']],
    ket: ['Ketorolaco 30 mg', 'IV', ['Ketorolaco 30 mg', 'Toradol 30 mg']],
    dex: ['Dexametasona 8 mg', 'IV', ['Dexametasona 8 mg', 'Decadron 8 mg']],
    tra: ['Tramadol 100 mg', 'IV', ['Tramadol 100 mg']],
    met: ['Metamizol 1 g', 'IV', ['Dipirona 1 g', 'Novalgina 1 g', 'Metamizol 1 g']],
    eno: ['Enoxaparina 40 mg', 'SC', ['Enoxaparina 40 mg', 'Clexane 40 mg']],
    ome: ['Omeprazol 40 mg', 'IV', ['Omeprazol 40 mg']],
    cro: ['Ceftriaxona 1 g', 'IV', ['Ceftriaxona 1 g', 'Rocephin 1 g']],
    mtz: ['Metronidazol 500 mg', 'IV', ['Metronidazol 500 mg']],
    oxi: ['Oxitocina 10 UI', 'IV', ['Oxitocina 10 UI', 'Syntocinon 10 UI']],
  };
  const PROC = [
    ['Mamoplastia de aumento', 'Cirugía plástica', 155, 25, 20, { cef: .95, ond: .85, ket: .7, dex: .65, tra: .4, met: .3 }],
    ['Lipoescultura', 'Cirugía plástica', 190, 35, 14, { cef: .9, ond: .8, dex: .6, tra: .5, eno: .55, met: .4 }],
    ['Abdominoplastia', 'Cirugía plástica', 210, 30, 9, { cef: .95, eno: .8, ond: .75, ket: .5, tra: .55 }],
    ['Rinoplastia', 'Cirugía plástica', 140, 25, 8, { cef: .8, dex: .8, ond: .7, ket: .5 }],
    ['Colecistectomía laparoscópica', 'Cirugía general', 85, 20, 12, { cef: .85, ket: .7, ond: .7, ome: .6, met: .5 }],
    ['Herniorrafia inguinal', 'Cirugía general', 70, 15, 10, { cef: .8, ket: .75, met: .45, ond: .5 }],
    ['Apendicectomía', 'Cirugía general', 65, 18, 6, { cro: .7, mtz: .65, ket: .6, ond: .5, ome: .5 }],
    ['Cesárea segmentaria', 'Ginecología', 55, 12, 14, { cef: .9, oxi: .95, ket: .6, ond: .55, met: .4 }],
    ['Histerectomía abdominal', 'Ginecología', 120, 25, 7, { cef: .9, eno: .6, ket: .6, ond: .6, tra: .4 }],
  ];
  const SURG = { 'Cirugía plástica': ['Dr. Alejandro Ferrer', 'Dra. Mónica Lara'], 'Cirugía general': ['Dra. Andrea Ruiz', 'Dr. Tomás Vivas'], 'Ginecología': ['Dr. Luis Herrera', 'Dra. Patricia Sosa'] };
  const ANES = ['Dr. Pablo Méndez', 'Dra. Irene Blanco'];
  const F = ['María', 'Carmen', 'Luisa', 'Andrea', 'Gabriela', 'Daniela', 'Rosa', 'Patricia', 'Isabel', 'Mariana', 'José', 'Carlos', 'Luis', 'Miguel', 'Rafael', 'Pedro', 'Antonio', 'Jesús'];
  const Lf = ['Rodríguez', 'González', 'Pérez', 'Hernández', 'Martínez', 'García', 'López', 'Díaz', 'Ramírez', 'Torres', 'Rojas', 'Morales', 'Silva', 'Mendoza', 'Castro', 'Vargas'];
  const totalW = PROC.reduce((a, p) => a + p[4], 0);
  const out = []; const end = TODAY.getTime() - 20 * 864e5, start = end - 2455 * 864e5; // ~6,7 años de archivo en papel hasta hace unas semanas
  for (let i = 0; i < 288; i++) {
    let r = rnd() * totalW, pr = PROC[0]; for (const p of PROC) { r -= p[4]; if (r <= 0) { pr = p; break; } }
    const [name, esp, mu, sd, , probs] = pr;
    const female = esp === 'Ginecología' || (esp === 'Cirugía plástica' && rnd() < .9) || rnd() < .5;
    const first = female ? pick(F.slice(0, 10)) : pick(F.slice(10));
    const date = new Date(start + (end - start) * (i + rnd()) / 288).toISOString().slice(0, 10);
    const meds = rnd() < .08 ? null : Object.entries(probs).filter(([, p]) => rnd() < p).map(([k]) => ({ name: MED[k][0], raw: pick(MED[k][2]), route: MED[k][1] }));
    out.push({
      id: 'h' + (1000 + i), origin: 'histórico', status: 'validado', type: 'Cirugía', date, procedure: name, specialty: esp,
      patient: `${first} ${pick(Lf)} ${pick(Lf)}`, ci: 'V-' + (5 + Math.floor(rnd() * 25)) + '.' + String(Math.floor(rnd() * 1000)).padStart(3, '0') + '.' + String(Math.floor(rnd() * 1000)).padStart(3, '0'),
      surgeon: pick(SURG[esp]), anesth: pick(ANES), durationMin: rnd() < .12 ? null : Math.max(25, Math.round(mu + gauss() * sd)),
      meds, complications: rnd() < .04 ? 'Sangrado leve controlado' : '', source: `Lote #${String(1 + Math.floor(i / 50)).padStart(3, '0')} · historia ${i + 1}`, files: [],
    });
  }
  out.push({ id: 'h-mfg', origin: 'histórico', status: 'validado', type: 'Cirugía', date: '2019-06-18', procedure: 'Cesárea segmentaria', specialty: 'Ginecología', patient: 'María Fernanda González', ci: 'V-14.882.310', surgeon: 'Dr. Luis Herrera', anesth: 'Dr. Pablo Méndez', durationMin: 52, meds: [{ name: 'Cefazolina 2 g', raw: 'Cefazolina 2 g', route: 'IV' }, { name: 'Oxitocina 10 UI', raw: 'Syntocinon 10 UI', route: 'IV' }, { name: 'Ketorolaco 30 mg', raw: 'Toradol 30 mg', route: 'IV' }], complications: '', source: 'Lote #002 · historia 31', files: [] });
  out.push({ id: 'h-pend1', origin: 'histórico', status: 'pendiente', type: 'Cirugía', date: '2018-11-14', procedure: 'Mamoplastia de reducción', specialty: 'Cirugía plástica', patient: 'Rosa Elena Márquez', ci: 'V-8.441.0??', surgeon: 'Dr. Alejandro Ferrer', anesth: '', durationMin: null, meds: [{ name: 'Cefazolina 2 g', raw: 'Cefazol 2g', route: 'IV' }, { name: 'Ketorolaco 30 mg', raw: 'Ketorol. 30', route: 'IV' }], complications: '', source: 'Lote #007 · historia 12', files: [], low: ['ci', 'anesth', 'durationMin'] });
  return out;
}

// Registros nativos (lo generado dentro del software):
//  · cirugías marcadas como realizadas en Quirófano, con la medicación despachada para ellas (descontando devoluciones)
//    y los diagnósticos y récipes de la nota operatoria ligada a esa cirugía;
//  · toda nota firmada en la historia clínica: consultas, evoluciones de hospitalización, notas operatorias,
//    notas libres e informes médicos (con sus diagnósticos y medicamentos indicados en el récipe);
//  · cuentas antiguas con línea de quirófano que no tienen cirugía registrada.
const NOTE_REC_TYPE = { consulta: 'Consulta', ingreso: 'Hospitalización', evolucion: 'Hospitalización', operatoria: 'Cirugía', libre: 'Nota médica', informe: 'Informe médico' };
const REC_TYPES = ['Cirugía', 'Consulta', 'Hospitalización', 'Informe médico', 'Nota médica', 'Historia escaneada'];
const recipeMeds = n => (n.recipe || []).filter(r => r.med).map(r => ({ name: r.med, raw: [r.med, r.dosis].filter(Boolean).join(' '), route: '' }));
function nativeRecords() {
  const notes = (S.hc || []).filter(n => n.status === 'firmada');
  const done = (S.appts || []).filter(a => a.kind === 'cirugia' && a.done).map(a => ({
    id: 'n-' + a.id, apptId: a.id, origin: 'nativo', status: 'validado', type: 'Cirugía', date: a.date, procedure: a.proc || 'Procedimiento quirúrgico',
    specialty: med(a.doc)?.esp || '', patient: pat(a.pid).name, ci: pat(a.pid).ci, surgeon: med(a.doc)?.name || '', anesth: med(a.anest)?.name || '', durationMin: a.done.durationMin ?? null,
    meds: (S.medOrders || []).filter(o => o.apptId === a.id && ['despachada', 'parcial'].includes(o.status)).flatMap(o => o.items.filter(it => it.qty - (it.returned || 0) > 0 && prod(it.pid)?.cat === 'Medicamento').map(it => ({ name: prod(it.pid).name, raw: prod(it.pid).name, route: '' }))),
    complications: a.done.complications || '', source: `Quirófano ${fdate(a.date)} ${a.time}`, files: [] }));
  // La nota operatoria de una cirugía realizada completa ese registro (no se cuenta dos veces)
  const doneIds = new Set(done.map(r => r.apptId));
  done.forEach(r => { const ns = notes.filter(n => n.apptId === r.apptId); if (!ns.length) return;
    r.noteId = ns[0].id; r.dx = [...new Set(ns.flatMap(n => n.dx || []))]; r.prescribed = ns.flatMap(recipeMeds); });   // el récipe es lo indicado, no lo usado en la cirugía
  const fromNotes = notes.filter(n => !(n.apptId && doneIds.has(n.apptId))).map(n => { const d = med(n.doc); const p = pat(n.pid); const type = NOTE_REC_TYPE[n.type] || 'Consulta';
    const title = n.type === 'informe' ? (n.motivo && n.motivo !== 'Informe médico' ? `Informe médico · ${n.motivo}` : 'Informe médico') : n.type === 'libre' ? (n.motivo || 'Nota médica') : n.type === 'operatoria' ? (n.motivo || 'Procedimiento quirúrgico') : ((n.dx || [])[0] || n.motivo || type);
    return { id: 'nh-' + n.id, noteId: n.id, origin: 'nativo', status: 'validado', type, date: n.date, procedure: title, dx: n.dx || [], specialty: d?.esp || '', patient: p?.name || '', ci: p?.ci || '',
      surgeon: d?.name || n.by || '', anesth: '', durationMin: null, meds: null, prescribed: recipeMeds(n), complications: '', source: `${typeof NOTE_TYPES !== 'undefined' ? NOTE_TYPES[n.type] : type} firmada el ${fdate(n.date)}`, files: [] }; });
  return done.concat(fromNotes, S.invoices.filter(i => i.items.some(x => x.sid === 'v5') && !(S.appts || []).some(a => a.inv === i.id && a.done)).map(i => ({
    id: 'n-' + i.id, origin: 'nativo', status: 'validado', type: 'Cirugía', date: i.date, procedure: i.proc || 'Procedimiento quirúrgico',
    specialty: med(i.doc)?.esp || '', patient: pat(i.pid).name, ci: pat(i.pid).ci, surgeon: med(i.doc)?.name || '', anesth: '', durationMin: null,
    meds: S.moves.filter(m => m.ref === i.num && m.cat === 'Medicamento').map(m => ({ name: m.name, raw: m.name, route: '' })), complications: '', source: `Factura ${i.num}`, files: [],
  })));
}
const allRecords = () => S.records.filter(r => r.status === 'validado').concat(nativeRecords());
const surgeriesDesc = () => allRecords().filter(r => r.type === 'Cirugía').sort((a, b) => b.date.localeCompare(a.date));

// Consulta estadística única. Devuelve conteos, con cuántos registros tenían el dato.
function statsQuery(q = {}) {
  const tipo = q.tipo || 'Cirugía';
  let list = (tipo === 'todos' ? allRecords() : allRecords().filter(r => r.type === tipo)).sort((a, b) => b.date.localeCompare(a.date));
  const total = list.length;
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (q.procedimiento) list = list.filter(r => norm(r.procedure).includes(norm(q.procedimiento)));
  if (q.especialidad) list = list.filter(r => norm(r.specialty).includes(norm(q.especialidad)));
  if (q.cirujano) list = list.filter(r => norm(r.surgeon).includes(norm(q.cirujano)));
  if (q.medicamento) list = list.filter(r => [...(r.meds || []), ...(r.prescribed || [])].some(m => norm(m.name).includes(norm(q.medicamento))));
  if (q.origen) list = list.filter(r => norm(r.origin).includes(norm(q.origen)));
  if (q.desde) list = list.filter(r => r.date >= q.desde);
  if (q.hasta) list = list.filter(r => r.date <= q.hasta);
  if (q.ultimas_n) list = list.slice(0, Math.max(1, +q.ultimas_n));
  const by = q.agrupar_por || 'medicamento', metric = q.metrica || 'conteo';
  const res = { tipo, registros_analizados: list.length, registros_del_tipo: total, filtros: q, filas: [] };
  if (list.length) res.periodo = { desde: list.at(-1).date, hasta: list[0].date };
  res.historicos = list.filter(r => r.origin === 'histórico').length; res.nativos = list.length - res.historicos;
  if (by === 'medicamento' || by === 'medicamento_indicado') {
    // medicamento = usado (historias en papel) o entregado para la cirugía, sin devoluciones; medicamento_indicado = récipes
    const field = by === 'medicamento' ? 'meds' : 'prescribed';
    const withMeds = list.filter(r => Array.isArray(r[field]) && (by === 'medicamento' || r[field].length)); const c = {};
    // Se agrupa por principio activo (la presentación puede variar entre historias)
    withMeds.forEach(r => new Set(r[field].map(m => m.name.split(' ')[0])).forEach(n => { c[n] = (c[n] || 0) + 1; }));
    res.con_dato = withMeds.length; res.sin_dato = list.length - withMeds.length;
    res.filas = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, q.limite || 15).map(([k, v]) => ({ clave: k, cirugias: v, porcentaje: Math.round(v / withMeds.length * 1000) / 10 }));
    return res;
  }
  if (by === 'diagnostico') {
    const withDx = list.filter(r => (r.dx || []).length); const c = {};
    withDx.forEach(r => new Set(r.dx).forEach(d => { c[d] = (c[d] || 0) + 1; }));
    res.con_dato = withDx.length; res.sin_dato = list.length - withDx.length;
    res.filas = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, q.limite || 15).map(([k, v]) => ({ clave: k, cirugias: v, porcentaje: Math.round(v / withDx.length * 1000) / 10 }));
    return res;
  }
  const keyOf = r => by === 'tipo' ? r.type : by === 'procedimiento' ? r.procedure : by === 'cirujano' ? r.surgeon : by === 'especialidad' ? r.specialty : by === 'año' ? r.date.slice(0, 4) : by === 'origen' ? r.origin : 'Total';
  const groups = {};
  list.forEach(r => { (groups[keyOf(r)] = groups[keyOf(r)] || []).push(r); });
  res.filas = Object.entries(groups).map(([k, rs]) => {
    const d = rs.map(r => r.durationMin).filter(x => x != null).sort((a, b) => a - b);
    const row = { clave: k, cirugias: rs.length };
    if (metric !== 'conteo') { row.con_duracion = d.length; row.duracion_promedio_min = d.length ? Math.round(d.reduce((a, x) => a + x, 0) / d.length) : null; row.duracion_mediana_min = d.length ? d[Math.floor(d.length / 2)] : null; }
    return row;
  }).sort((a, b) => by === 'año' ? a.clave.localeCompare(b.clave) : b.cirugias - a.cirugias).slice(0, q.limite || 20);
  return res;
}
