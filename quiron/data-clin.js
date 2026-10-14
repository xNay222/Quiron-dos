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

// Rango "a–b", "<x" o ">x" → 'alto' | 'bajo' | ''. Referencia cualitativa ("Negativo", "No reactivo", "Ausente")
// → 'anormal' si el resultado es positivo / reactivo / presente. Un texto que no es un rango no se marca solo.
const QUAL_NORMAL = /^(negativo|no reactivo|ausente|no se observan|sin crecimiento|no detectado)/;
const QUAL_ABNORMAL = /^(positivo|reactivo|presente|detectado|\+)/;
const labNorm = t => labNameKey(t);   // sin tildes ni mayúsculas
function flagOf(value, ref) {
  if (!ref || String(value ?? '').trim() === '') return '';
  if (QUAL_NORMAL.test(labNorm(ref))) return QUAL_ABNORMAL.test(labNorm(value)) ? 'anormal' : '';
  if (/:/.test(ref)) return '';   // rango por sexo o por fase sin resolver: no se adivina
  const v = parseFloat(String(value).replace(',', '.')); if (isNaN(v)) return '';
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
  const v = parseFloat(String(value).replace(',', '.')); if (isNaN(v) || !ref || ref.startsWith('<') || /:/.test(ref) || !/^[<>]?\d|\d–\d/.test(ref)) return false;
  const low = parseFloat((ref.startsWith('>') ? ref.slice(1) : ref.split('–')[0]).replace(',', '.'));
  return !isNaN(low) && low > 0 && v < low * VERIFY_LOW;
}
const flagCell = (value, ref) => { const f = flagOf(value, ref);
  return (f ? `<span class="pill bad">${f}</span>` : '') + (needsCheck(value, ref) ? ' <span class="pill warn" title="Más de 25 % por debajo del valor normal">⚠ Verifique</span>' : ''); };
const checkList = rows => rows.filter(r => needsCheck(r.value, r.ref));
// Fuente: herramientas/catalogo-laboratorio-2026.txt. Sin precios ni rangos inventados.
const CLINIC_LAB_2026 = [
  {"name":"Perfil 20","kind":"perfil","includes":"Hematología completa, glicemia basal, urea, creatinina, ácido úrico, colesterol total, triglicéridos, transaminasas (AST y ALT), proteínas totales y fraccionadas, bilirrubina total y fraccionada, VDRL, orina y heces"},
  {"name":"Perfil 21","kind":"perfil","includes":"Hematología completa, glicemia basal, urea, creatinina, ácido úrico, colesterol total, triglicéridos, transaminasas (AST y ALT), proteínas totales y fraccionadas, bilirrubina total y fraccionada, perfil lipídico, orina y heces"},
  {"name":"Perfil hepático","kind":"perfil","includes":"Hematología completa, transaminasas (AST y ALT), proteínas totales y fraccionadas, bilirrubina total y fraccionada, GGT, fosfatasa alcalina, LDH"},
  {"name":"Perfil lipídico","kind":"perfil","includes":"Colesterol total, triglicéridos, HDL-colesterol, LDL-colesterol y VLDL-colesterol"},
  {"name":"Perfil preoperatorio","kind":"perfil","includes":"Hematología completa, glicemia, urea, creatinina, PT, PTT, HIV, VDRL cualitativo y orina"},
  {"name":"Perfil prenatal básico 1","kind":"perfil","includes":"Hematología completa, grupo sanguíneo, glicemia basal, urea, creatinina, VDRL cualitativo, HIV, orina y heces"},
  {"name":"Perfil prenatal 2","kind":"perfil","includes":"Hematología completa, glicemia basal, PT, PTT, VDRL cualitativo, HIV y orina"},
  {"name":"Perfil hormonal femenino","kind":"perfil","includes":"Progesterona, prolactina, LH, FSH y estradiol"},
  {"name":"Perfil hormonal masculino","kind":"perfil","includes":"Testosterona total y libre, LH, FSH y prolactina"},
  {"name":"Perfil diarreico","kind":"perfil","includes":"Heces, leucograma fecal, adenovirus y rotavirus"},
  {"name":"Perfil TORCH I (IgG/IgM)","kind":"perfil","includes":"Toxoplasma, rubéola y citomegalovirus"},
  {"name":"Perfil TORCH II (IgG/IgM)","kind":"perfil","includes":"Toxoplasma, rubéola, citomegalovirus y herpes"},
  {"name":"Perfil tiroideo libre","kind":"perfil","includes":"TSH, T4 libre, T3 libre"},
  {"name":"Hematología completa","kind":"prueba","includes":""},
  {"name":"VSG","kind":"prueba","includes":""},
  {"name":"Grupo sanguíneo (tipiaje)","kind":"prueba","includes":""},
  {"name":"Frotis de sangre periférica","kind":"prueba","includes":""},
  {"name":"Reticulocitos","kind":"prueba","includes":""},
  {"name":"Glicemia basal","kind":"prueba","includes":""},
  {"name":"Glicemia posprandial","kind":"prueba","includes":""},
  {"name":"Urea","kind":"prueba","includes":""},
  {"name":"Creatinina","kind":"prueba","includes":""},
  {"name":"Ácido úrico","kind":"prueba","includes":""},
  {"name":"Colesterol total","kind":"prueba","includes":""},
  {"name":"Triglicéridos","kind":"prueba","includes":""},
  {"name":"AST/TGO","kind":"prueba","includes":""},
  {"name":"ALT/TGP","kind":"prueba","includes":""},
  {"name":"HDL-colesterol","kind":"prueba","includes":""},
  {"name":"Bilirrubina total","kind":"prueba","includes":""},
  {"name":"Bilirrubina directa","kind":"prueba","includes":""},
  {"name":"Proteínas totales","kind":"prueba","includes":""},
  {"name":"Albúmina","kind":"prueba","includes":""},
  {"name":"Deshidrogenasa láctica (LDH)","kind":"prueba","includes":""},
  {"name":"Fosfatasa alcalina (ALP)","kind":"prueba","includes":""},
  {"name":"Calcio sérico/orina","kind":"prueba","includes":""},
  {"name":"Electrolitos séricos (sodio, potasio y cloro)","kind":"prueba","includes":""},
  {"name":"Fósforo sérico/orina","kind":"prueba","includes":""},
  {"name":"Magnesio","kind":"prueba","includes":""},
  {"name":"Amilasa sérica","kind":"prueba","includes":""},
  {"name":"Lipasa sérica","kind":"prueba","includes":""},
  {"name":"Gammaglutamil transpeptidasa (GGT)","kind":"prueba","includes":""},
  {"name":"PCR cuantitativa (proteína C reactiva)","kind":"prueba","includes":""},
  {"name":"Procalcitonina","kind":"prueba","includes":""},
  {"name":"CK total","kind":"prueba","includes":""},
  {"name":"CK-MB","kind":"prueba","includes":""},
  {"name":"Troponina I cualitativa","kind":"prueba","includes":""},
  {"name":"ASTO cuantitativo (antiestreptolisina O)","kind":"prueba","includes":""},
  {"name":"RA test (factor reumatoideo)","kind":"prueba","includes":""},
  {"name":"HCG cualitativa (prueba de embarazo en sangre/orina)","kind":"prueba","includes":""},
  {"name":"HCG cuantitativa (prueba de embarazo)","kind":"prueba","includes":""},
  {"name":"HIV prueba rápida","kind":"prueba","includes":""},
  {"name":"HIV por ELISA","kind":"prueba","includes":""},
  {"name":"Dengue (IgG/IgM, antígeno NS1)","kind":"prueba","includes":""},
  {"name":"Hepatitis A (IgM)","kind":"prueba","includes":""},
  {"name":"Hepatitis A (IgG)","kind":"prueba","includes":""},
  {"name":"Hepatitis B (core total)","kind":"prueba","includes":""},
  {"name":"Hepatitis B (antígeno de superficie)","kind":"prueba","includes":""},
  {"name":"Hepatitis C","kind":"prueba","includes":""},
  {"name":"Mycoplasma pneumoniae (IgG/IgM)","kind":"prueba","includes":""},
  {"name":"Toxoplasma (IgM)","kind":"prueba","includes":""},
  {"name":"Toxoplasma (IgG)","kind":"prueba","includes":""},
  {"name":"VDRL cualitativo","kind":"prueba","includes":""},
  {"name":"VDRL cuantitativo","kind":"prueba","includes":""},
  {"name":"PT (coagulación)","kind":"prueba","includes":""},
  {"name":"PTT (coagulación)","kind":"prueba","includes":""},
  {"name":"Dímero D","kind":"prueba","includes":""},
  {"name":"Orina","kind":"prueba","includes":""},
  {"name":"Urocultivo","kind":"prueba","includes":""},
  {"name":"Heces","kind":"prueba","includes":""},
  {"name":"Azúcares reductores en heces","kind":"prueba","includes":""},
  {"name":"Leucograma fecal","kind":"prueba","includes":""},
  {"name":"Sangre oculta en heces","kind":"prueba","includes":""},
  {"name":"Depuración de creatinina 24 horas","kind":"prueba","includes":""},
  {"name":"Proteinuria en orina aislada","kind":"prueba","includes":""},
  {"name":"Proteinuria en orina 24 horas","kind":"prueba","includes":""},
  {"name":"Relación calcio/creatinina en orina parcial","kind":"prueba","includes":""},
  {"name":"Relación ácido úrico/creatinina en orina parcial","kind":"prueba","includes":""},
  {"name":"Relación fósforo/creatinina en orina parcial","kind":"prueba","includes":""},
  {"name":"Citrato en orina de 24 horas","kind":"prueba","includes":""},
  {"name":"Oxalato en orina de 24 horas","kind":"prueba","includes":""},
  {"name":"Cocaína en orina","kind":"prueba","includes":""},
  {"name":"Marihuana en orina","kind":"prueba","includes":""},
  {"name":"Monotest","kind":"prueba","includes":""},
  {"name":"CEA (antígeno carcinoembrionario)","kind":"prueba","includes":""},
  {"name":"Chagas","kind":"prueba","includes":""},
  {"name":"CA 125","kind":"prueba","includes":""},
  {"name":"CA 15-3","kind":"prueba","includes":""},
  {"name":"CA 19-9","kind":"prueba","includes":""},
  {"name":"Alfafetoproteína","kind":"prueba","includes":""},
  {"name":"Anticuerpo antitiroideo (anti-TPO)","kind":"prueba","includes":""},
  {"name":"Anticuerpo antitiroideo (anti-TG)","kind":"prueba","includes":""},
  {"name":"Tiroglobulina","kind":"prueba","includes":""},
  {"name":"Hemoglobina glicosilada","kind":"prueba","includes":""},
  {"name":"Helicobacter pylori (antígeno en heces)","kind":"prueba","includes":""},
  {"name":"Helicobacter pylori en suero (IgG)","kind":"prueba","includes":""},
  {"name":"Helicobacter pylori en suero (IgM)","kind":"prueba","includes":""},
  {"name":"FTA-ABS","kind":"prueba","includes":""},
  {"name":"Fibrinógeno","kind":"prueba","includes":""},
  {"name":"Anticuerpos COVID-19 (IgG/IgM)","kind":"prueba","includes":""},
  {"name":"IgE sérica","kind":"prueba","includes":""},
  {"name":"Citomegalovirus (IgG)","kind":"prueba","includes":""},
  {"name":"Citomegalovirus (IgM)","kind":"prueba","includes":""},
  {"name":"Electrolitos en orina (sodio, potasio y cloro)","kind":"prueba","includes":""},
  {"name":"Epstein-Barr (IgG)","kind":"prueba","includes":""},
  {"name":"Epstein-Barr (IgM)","kind":"prueba","includes":""},
  {"name":"Pro-BNP","kind":"prueba","includes":""},
  {"name":"Rubéola (IgG)","kind":"prueba","includes":""},
  {"name":"Rubéola (IgM)","kind":"prueba","includes":""},
  {"name":"Herpes simplex I (IgG)","kind":"prueba","includes":""},
  {"name":"Herpes simplex I (IgM)","kind":"prueba","includes":""},
  {"name":"Herpes simplex II (IgG)","kind":"prueba","includes":""},
  {"name":"Herpes simplex II (IgM)","kind":"prueba","includes":""},
  {"name":"TSH","kind":"prueba","includes":""},
  {"name":"T4 libre","kind":"prueba","includes":""},
  {"name":"T3 libre","kind":"prueba","includes":""},
  {"name":"PSA total","kind":"prueba","includes":""},
  {"name":"PSA libre","kind":"prueba","includes":""},
  {"name":"Saturación de transferrina","kind":"prueba","includes":""},
  {"name":"Transferrina","kind":"prueba","includes":""},
  {"name":"Ferritina","kind":"prueba","includes":""},
  {"name":"Captación de hierro","kind":"prueba","includes":""},
  {"name":"Ácido fólico o folato","kind":"prueba","includes":""},
  {"name":"Ácido láctico","kind":"prueba","includes":""},
  {"name":"Ácido láctico posprandial","kind":"prueba","includes":""},
  {"name":"Insulina (basal, 30 minutos, 1 hora o 2 horas)","kind":"prueba","includes":""},
  {"name":"Litio","kind":"prueba","includes":""},
  {"name":"Péptido C","kind":"prueba","includes":""},
  {"name":"Somatomedina C","kind":"prueba","includes":""},
  {"name":"Homocisteína","kind":"prueba","includes":""},
  {"name":"Hormona antimülleriana","kind":"prueba","includes":""},
  {"name":"Estrógeno","kind":"prueba","includes":""},
  {"name":"Anticuerpos antinucleares (ANA)","kind":"prueba","includes":""},
  {"name":"Anti-DNA","kind":"prueba","includes":""},
  {"name":"Anticuerpos anti-CCP","kind":"prueba","includes":""},
  {"name":"Paratohormona (PTH)","kind":"prueba","includes":""},
  {"name":"Hormona de crecimiento (hGH)","kind":"prueba","includes":""},
  {"name":"SHBG (globulina fijadora de hormona sexual)","kind":"prueba","includes":""},
  {"name":"Vitamina D","kind":"prueba","includes":""},
  {"name":"Vitamina D3","kind":"prueba","includes":""},
  {"name":"Amonio (muestra plasma citratado)","kind":"prueba","includes":""},
  {"name":"Complemento C3","kind":"prueba","includes":""},
  {"name":"Complemento C4","kind":"prueba","includes":""},
  {"name":"Complemento CH50","kind":"prueba","includes":""},
  {"name":"Coombs directo","kind":"prueba","includes":""},
  {"name":"Coombs indirecto","kind":"prueba","includes":""},
  {"name":"Androstenediona","kind":"prueba","includes":""},
  {"name":"Prolactina","kind":"prueba","includes":""},
  {"name":"Estradiol","kind":"prueba","includes":""},
  {"name":"Progesterona","kind":"prueba","includes":""},
  {"name":"FSH","kind":"prueba","includes":""},
  {"name":"17-OH progesterona","kind":"prueba","includes":""},
  {"name":"DHEA-S","kind":"prueba","includes":""},
  {"name":"Testosterona total","kind":"prueba","includes":""},
  {"name":"Testosterona libre","kind":"prueba","includes":""},
  {"name":"Cortisol AM o PM","kind":"prueba","includes":""},
  {"name":"Adenovirus en heces","kind":"prueba","includes":""},
  {"name":"Rotavirus en heces","kind":"prueba","includes":""},
  {"name":"Calprotectina en heces","kind":"prueba","includes":""},
  {"name":"Antígeno prostático","kind":"prueba","includes":""}
];
const labNameKey = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
function importClinicLab2026(state) {
  state.labCatalog = state.labCatalog || JSON.parse(JSON.stringify(LAB_PANELS));
  state.labCatalogMeta = state.labCatalogMeta || {};
  for (const entry of CLINIC_LAB_2026) {
    const key = Object.keys(state.labCatalog).find(n => labNameKey(n) === labNameKey(entry.name)) || entry.name;
    if (!Object.hasOwn(state.labCatalog, key)) state.labCatalog[key] = (entry.includes ? entry.includes.split(',').map(s => s.trim()) : [entry.name]).map(n => [n, '', '']);
    state.labCatalogMeta[key] = { ...state.labCatalogMeta[key], source: 'clinica', kind: entry.kind, includes: entry.includes };
  }
  state.clinicLab2026 = true;
  return state;
}
const labMeta = name => S.labCatalogMeta?.[name];
const labTestNames = () => [...Object.keys(labPanels()), ...Object.keys(LAB_COMBOS).filter(n => !Object.keys(labPanels()).some(k => labNameKey(k) === labNameKey(n)))];

// El catálogo vigente es el que mantiene el laboratorio (S.labCatalog); LAB_PANELS es solo el de partida
const labPanels = () => (typeof S !== 'undefined' && S.labCatalog) || LAB_PANELS;
const isLabTest = t => !!(labPanels()[t] || LAB_COMBOS[t]);
// Un perfil se desglosa en los exámenes que incluye; cada uno trae sus parámetros y referencias
const panelsOf = tests => [...new Set(tests.flatMap(t => { const parts = typeof S !== 'undefined' && S.labCatalogMeta?.[t]?.parts; return parts?.length ? parts : labPanels()[t] ? [t] : LAB_COMBOS[t] || [t]; }))];
// sex: 'M' | 'F' del paciente → se usa su rango ("Hombres: … · Mujeres: …")
function blankResults(tests, sex) { const cat = labPanels(); return panelsOf(tests).filter(t => cat[t]?.length).flatMap(t => cat[t].map(([param, unit, ref]) => ({ test: t, param, unit, ref: typeof refFor === 'function' ? refFor(ref, sex) : ref, value: '', flag: '' }))); }

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
  const st = importClinicLab2026({ notes, exams, exSeq: 36, labCatalog: JSON.parse(JSON.stringify(LAB_PANELS)) });
  return typeof applyLabStandard === 'function' ? applyLabStandard(st) : st;
}

// Valor anterior del mismo parámetro para el paciente (para mostrar si subió o bajó)
function prevValue(pid, param, beforeDate, exId) {
  const prev = S.exams.filter(e => e.pid === pid && e.status === 'listo' && e.id !== exId && (e.readyAt || e.date) < beforeDate)
    .sort((a, b) => (b.readyAt || b.date).localeCompare(a.readyAt || a.date))
    .flatMap(e => e.results.filter(r => r.param === param && r.value !== '').map(r => ({ ...r, date: e.date })));
  return prev[0] || null;
}
