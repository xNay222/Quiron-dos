// Historia clínica electrónica y exámenes (laboratorio e imagen).
// Los médicos escriben y firman sus historias en el sistema; el laboratorio y rayos X reciben las órdenes
// y suben los resultados aquí mismo, así todo queda en el expediente del paciente.

// Paneles de laboratorio: [parámetro, unidad, valor de referencia]. Los rangos son de ejemplo; los define el laboratorio.
const LAB_PANELS = {
  'Hematología completa': [['Hemoglobina', 'g/dL', '12–16'], ['Hematocrito', '%', '36–46'], ['Leucocitos', 'x10³/µL', '4,5–11'], ['Plaquetas', 'x10³/µL', '150–450']],
  'Química sanguínea': [['Glicemia', 'mg/dL', '70–100'], ['Urea', 'mg/dL', '15–40'], ['Creatinina', 'mg/dL', '0,6–1,2']],
  'Perfil de coagulación': [['PT', 's', '11–13,5'], ['PTT', 's', '25–35'], ['INR', '', '0,8–1,2']],
  'Perfil lipídico': [['Colesterol total', 'mg/dL', '<200'], ['Triglicéridos', 'mg/dL', '<150'], ['HDL', 'mg/dL', '>40'], ['LDL', 'mg/dL', '<130']],
  'Uroanálisis': [['Densidad', '', '1,005–1,030'], ['pH', '', '5–8'], ['Leucocitos en orina', '/campo', '0–5'], ['Hematíes en orina', '/campo', '0–3']],
  'Grupo sanguíneo y Rh': [['Grupo y Rh', '', '']],
  'Prueba de embarazo (β-hCG)': [['β-hCG', 'mUI/mL', '<5']],
};
const LAB_COMBOS = { 'Perfil preoperatorio': ['Hematología completa', 'Química sanguínea', 'Perfil de coagulación', 'Grupo sanguíneo y Rh'] };
const IMG_TESTS = ['Rayos X de tórax', 'Rayos X de columna', 'Rayos X de extremidades', 'Ecografía abdominal', 'Ecografía pélvica', 'Ecografía obstétrica', 'Ecografía mamaria', 'Ecografía de partes blandas', 'Electrocardiograma'];
const EX_ST = { solicitado: ['Solicitado', 'warn'], muestra: ['Muestra tomada', 'info'], proceso: ['En proceso', 'info'], listo: ['Resultado listo', 'good'] };

// Rango "a–b", "<x" o ">x" → 'alto' | 'bajo' | '' (sin rango o valor no numérico)
function flagOf(value, ref) {
  const v = parseFloat(String(value).replace(',', '.')); if (isNaN(v) || !ref) return '';
  const n = s => parseFloat(s.replace(',', '.'));
  if (ref.startsWith('<')) return v >= n(ref.slice(1)) ? 'alto' : '';
  if (ref.startsWith('>')) return v <= n(ref.slice(1)) ? 'bajo' : '';
  const [a, b] = ref.split('–').map(n); if (isNaN(a) || isNaN(b)) return '';
  return v < a ? 'bajo' : v > b ? 'alto' : '';
}
// Valor más de un 25 % por debajo del límite inferior normal (rango "a–b" o ">x"): probable error de carga o de muestra.
// No bloquea: el bioanalista debe confirmar que el valor es correcto antes de validar.
const VERIFY_LOW = 0.75;
function needsCheck(value, ref) {
  const v = parseFloat(String(value).replace(',', '.')); if (isNaN(v) || !ref || ref.startsWith('<')) return false;
  const low = parseFloat((ref.startsWith('>') ? ref.slice(1) : ref.split('–')[0]).replace(',', '.'));
  return !isNaN(low) && low > 0 && v < low * VERIFY_LOW;
}
const flagCell = (value, ref) => { const f = flagOf(value, ref);
  return (f ? `<span class="pill bad">${f}</span>` : '') + (needsCheck(value, ref) ? ' <span class="pill warn" title="Más de 25 % por debajo del valor normal">⚠ Verifique</span>' : ''); };
const checkList = rows => rows.filter(r => needsCheck(r.value, r.ref));
// El catálogo vigente es el que mantiene el laboratorio (S.labCatalog); LAB_PANELS es solo el de partida
const labPanels = () => (typeof S !== 'undefined' && S.labCatalog) || LAB_PANELS;
const isLabTest = t => !!(labPanels()[t] || LAB_COMBOS[t]);
const panelsOf = tests => tests.flatMap(t => LAB_COMBOS[t] || [t]);
function blankResults(tests) { const cat = labPanels(); return panelsOf(tests).filter(t => cat[t]).flatMap(t => cat[t].map(([param, unit, ref]) => ({ test: t, param, unit, ref, value: '', flag: '' }))); }

function seedClinical() {
  const notes = [
    { id: 'hc1', pid: 'pt2', date: dAt(-3), time: '10:15', doc: 'm1', type: 'consulta', status: 'firmada', signedAt: dAt(-3) + ' 10:40',
      motivo: 'Aumento de volumen en región inguinal derecha de 4 meses de evolución.', actual: 'Masa reductible que aumenta con el esfuerzo, sin dolor en reposo. Niega fiebre ni vómitos.',
      vitals: { ta: '130/85', fc: '76', fr: '16', temp: '36,6', sat: '98', peso: '82', talla: '174' }, examen: 'Hernia inguinal derecha reductible, anillo de aprox. 2 cm. Resto sin alteraciones.',
      dx: ['Hernia inguinal derecha no complicada (K40.9)'], plan: 'Herniorrafia inguinal derecha programada. Perfil preoperatorio y Rx de tórax.', indicaciones: 'Evitar esfuerzos. Traer resultados el día de la cirugía.',
      recipe: [{ med: 'Losartán 50 mg', dosis: '1 tableta', frec: 'cada 24 h', dur: 'continuo' }], addenda: [] },
    { id: 'hc2', pid: 'pt1', date: dAt(-30), time: '08:20', doc: 'm2', type: 'consulta', status: 'firmada', signedAt: dAt(-30) + ' 08:45',
      motivo: 'Control ginecológico anual.', actual: 'Asintomática. Ciclos regulares.', vitals: { ta: '110/70', fc: '72', fr: '14', temp: '36,4', sat: '99', peso: '61', talla: '163' },
      examen: 'Mamas sin nódulos. Especuloscopia normal.', dx: ['Control ginecológico de rutina (Z01.4)'], plan: 'Ecografía pélvica de control. Control en 6 meses.', indicaciones: '', recipe: [], addenda: [] },
  ];
  const R = (test, param, unit, ref, value) => ({ test, param, unit, ref, value, flag: flagOf(value, ref) });
  const exams = [
    { id: 'ex1', num: 'EX-0031', pid: 'pt2', doc: 'm1', note: 'hc1', date: dAt(-3), area: 'laboratorio', tests: ['Perfil preoperatorio'], priority: 'normal', notes: 'Preoperatorio de herniorrafia.', status: 'listo', readyAt: dAt(-2) + ' 16:10', by: 'Laboratorio', seen: true, files: [],
      results: [R('Hematología completa', 'Hemoglobina', 'g/dL', '12–16', '14,2'), R('Hematología completa', 'Hematocrito', '%', '36–46', '42'), R('Hematología completa', 'Leucocitos', 'x10³/µL', '4,5–11', '7,8'), R('Hematología completa', 'Plaquetas', 'x10³/µL', '150–450', '265'),
        R('Química sanguínea', 'Glicemia', 'mg/dL', '70–100', '112'), R('Química sanguínea', 'Urea', 'mg/dL', '15–40', '32'), R('Química sanguínea', 'Creatinina', 'mg/dL', '0,6–1,2', '1,0'),
        R('Perfil de coagulación', 'PT', 's', '11–13,5', '12,4'), R('Perfil de coagulación', 'PTT', 's', '25–35', '29'), R('Perfil de coagulación', 'INR', '', '0,8–1,2', '1,0'), R('Grupo sanguíneo y Rh', 'Grupo y Rh', '', '', 'A+')], report: '' },
    { id: 'ex2', num: 'EX-0032', pid: 'pt2', doc: 'm1', note: 'hc1', date: dAt(-3), area: 'imagen', tests: ['Rayos X de tórax'], priority: 'normal', notes: 'Preoperatorio.', status: 'listo', readyAt: dAt(-2) + ' 11:30', by: 'Rayos X', seen: false, files: [], results: [],
      report: 'Proyección PA de tórax. Silueta cardíaca de tamaño normal. Campos pulmonares sin infiltrados ni derrames. Senos costodiafragmáticos libres.\n\nConclusión: estudio radiológico de tórax dentro de límites normales.' },
    { id: 'ex3', num: 'EX-0033', pid: 'pt4', doc: 'm4', date: dAt(0), area: 'laboratorio', tests: ['Hematología completa', 'Química sanguínea', 'Perfil lipídico'], priority: 'normal', notes: 'Paciente diabético, control.', status: 'muestra', by: '', seen: false, files: [], results: [], report: '' },
    { id: 'ex4', num: 'EX-0034', pid: 'pt3', doc: 'm2', date: dAt(0), area: 'imagen', tests: ['Ecografía pélvica'], priority: 'urgente', notes: 'Dolor pélvico.', status: 'solicitado', by: '', seen: false, files: [], results: [], report: '' },
    { id: 'ex5', num: 'EX-0035', pid: 'pt4', doc: 'm1', date: dAt(0), area: 'laboratorio', tests: ['Perfil preoperatorio'], priority: 'urgente', notes: 'Colecistectomía hoy.', status: 'solicitado', by: '', seen: false, files: [], results: [], report: '' },
  ];
  // Hemoglobina anterior de Ricardo Salazar, para ver la evolución
  exams.push({ id: 'ex0', num: 'EX-0012', pid: 'pt2', doc: 'm4', date: dAt(-180), area: 'laboratorio', tests: ['Hematología completa'], priority: 'normal', notes: 'Control anual.', status: 'listo', readyAt: dAt(-179) + ' 15:00', by: 'Laboratorio', seen: true, files: [], report: '',
    results: [R('Hematología completa', 'Hemoglobina', 'g/dL', '12–16', '13,6'), R('Hematología completa', 'Hematocrito', '%', '36–46', '40'), R('Hematología completa', 'Leucocitos', 'x10³/µL', '4,5–11', '6,9'), R('Hematología completa', 'Plaquetas', 'x10³/µL', '150–450', '240')] });
  return { notes, exams, exSeq: 36, labCatalog: JSON.parse(JSON.stringify(LAB_PANELS)) };
}

// Valor anterior del mismo parámetro para el paciente (para mostrar si subió o bajó)
function prevValue(pid, param, beforeDate, exId) {
  const prev = S.exams.filter(e => e.pid === pid && e.status === 'listo' && e.id !== exId && (e.readyAt || e.date) < beforeDate)
    .sort((a, b) => (b.readyAt || b.date).localeCompare(a.readyAt || a.date))
    .flatMap(e => e.results.filter(r => r.param === param && r.value !== '').map(r => ({ ...r, date: e.date })));
  return prev[0] || null;
}
