// Secuencia de preguntas: conserva los datos y las reglas del motor clínico.
const GUIDE = (() => {
  const historyGroups = {
    allergies: 'Alergias', conditions: 'Patológicos', surgeries: 'Quirúrgicos',
    meds: 'Medicación habitual', family: 'Familiares', habits: 'Hábitos',
    gyneco: 'Ginecoobstétricos', pediatric: 'Pediátricos'
  };
  const historyFields = {
    conditions: [
      ['name', '¿Qué enfermedad tiene?'],
      ['state', '¿Está presente?', 'single', ['presente', 'ausente', 'desconocido']],
      ['since', '¿Desde cuándo?', 'date'],
      ['tx', '¿Qué tratamiento recibe?'],
      ['note', '¿Qué más necesita documentar?']
    ],
    surgeries: [
      ['name', '¿Qué cirugía tuvo?'],
      ['date', '¿Cuándo fue la cirugía?'],
      ['institution', '¿Dónde fue operado?'],
      ['complications', '¿Tuvo complicaciones?'],
      ['anesthesia', '¿Qué anestesia recibió?'],
      ['note', '¿Qué más necesita documentar?']
    ],
    meds: [
      ['drug', '¿Qué medicamento toma?'],
      ['ingredient', '¿Cuál es el principio activo?'],
      ['presentation', '¿Cuál es la presentación?'],
      ['dose', '¿Qué dosis toma?'],
      ['freq', '¿Con qué frecuencia?'],
      ['route', '¿Por qué vía?'],
      ['start', '¿Cuándo lo empezó?', 'date'],
      ['end', '¿Cuándo lo suspendió?', 'date'],
      ['active', '¿Lo toma actualmente?', 'single', [[true, 'Sí'], [false, 'No']]],
      ['note', '¿Qué más necesita documentar?']
    ],
    family: [
      ['disease', '¿Qué enfermedad hay en la familia?'],
      ['relative', '¿Qué familiar la tiene?'],
      ['age', '¿A qué edad fue diagnosticado?', 'number'],
      ['note', '¿Qué más necesita documentar?']
    ],
    habits: [
      ['tabaco', '¿Fuma?'],
      ['alcohol', '¿Consume alcohol?'],
      ['sustancias', '¿Consume otras sustancias?'],
      ['actividad', '¿Qué actividad física realiza?'],
      ['alimentacion', '¿Cómo se alimenta?'],
      ['ocupacion', '¿En qué trabaja?'],
      ['exposiciones', '¿Tiene exposiciones laborales?'],
      ['sueno', '¿Cómo duerme?'],
      ['social', '¿Qué factores sociales necesita registrar?']
    ],
    gyneco: [
      ['menarquia', '¿A qué edad fue la menarquia?'],
      ['fum', '¿Cuándo fue la última menstruación?', 'date'],
      ['regularidad', '¿Es regular?'],
      ['duracion', '¿Cuánto dura?'],
      ['g', '¿Cuántas gestaciones?', 'number'],
      ['p', '¿Cuántos partos?', 'number'],
      ['c', '¿Cuántas cesáreas?', 'number'],
      ['a', '¿Cuántos abortos?', 'number'],
      ['menopausia', '¿Tiene menopausia?'],
      ['anticoncepcion', '¿Qué anticoncepción utiliza?'],
      ['embarazo', '¿Hay embarazo actual o posible?'],
      ['nota', '¿Qué más necesita documentar?']
    ],
    pediatric: [
      ['embarazo', '¿Cómo fue el embarazo?'],
      ['nacimiento', '¿Cómo fue el nacimiento?'],
      ['prematuridad', '¿Hubo prematuridad?'],
      ['peso', '¿Cuál fue el peso al nacer?'],
      ['desarrollo', '¿Cómo ha sido el desarrollo?'],
      ['vacunacion', '¿Cómo está la vacunación?'],
      ['alimentacion', '¿Cómo se alimenta?'],
      ['crecimiento', '¿Cómo ha sido el crecimiento?'],
      ['enfermedades', '¿Qué enfermedades ha tenido?'],
      ['nota', '¿Qué más necesita documentar?']
    ]
  };

  function init(c) {
    c.guide ||= { started: false, current: 'context', omissions: {}, history: {} };
    c.guide.omissions ||= {};
    c.guide.history ||= {};
    c.guide.ros ||= {};
    if (/^history-(conditions|surgeries|meds|family|habits|gyneco|pediatric)/.test(c.guide.current)) c.guide.updatingHistory = true;
    if (/^history-allergies/.test(c.guide.current)) c.guide.editAllergies = true;
    return c.guide;
  }

  // Títulos de pantalla en forma de pregunta natural (los catálogos conservan su etiqueta corta para el informe)
  const ASK = {
    onset: '¿Cómo empezó?', duration: '¿Desde hace cuánto tiempo?', startDate: '¿Recuerda la fecha aproximada de inicio?',
    frequency: '¿Con qué frecuencia se presenta?', evolution: '¿Cómo ha evolucionado?',
    intensity: '¿Qué tan intenso es? (0 = nada, 10 = el peor)', location: '¿Dónde se localiza?', side: '¿De qué lado?',
    quality: '¿Cómo es (qué carácter tiene)?', radiates: '¿Se irradia a otra parte?', radiation: '¿Hacia dónde se irradia?',
    triggers: '¿Qué lo desencadena o empeora?', relievers: '¿Qué lo alivia?', previousTreatment: '¿Ha recibido algún tratamiento?',
    previousTreatmentDetail: '¿Qué tratamiento recibió?', response: '¿Cómo respondió al tratamiento?',
    impact: '¿Cuánto limita sus actividades?', free: '¿Algo más que quiera anotar?'
  };
  function question(key, title, section, extra = {}) {
    return { key, title, section, type: 'text', ...extra };
  }

  function dependencies(rule) {
    if (rule?.qid) return [rule.qid];
    return [...(rule?.all || []), ...(rule?.any || [])].flatMap(dependencies);
  }

  function reasonPages(r, context = {}, mode = 'complete') {
    const t = r.template || CONSULT.templateFor(r.key);
    const visible = CONSULT.visibleQuestions(t, r.answers, context)
      .filter(q => q.id !== 'free' && !/_free$/.test(q.id));
    const roots = visible.filter(q => !dependencies(q.showIf).length);
    const binary = roots.filter(q => ['yesno', 'yesnounk'].includes(q.type));
    const selections = roots.filter(q => ['single', 'scale010'].includes(q.type));
    const important = ['onset', 'evolution', 'intensity', 'quality', 'side', 'location'];
    let singles = mode === 'quick' ? selections.filter(q => important.includes(q.id)).slice(0, 5) : selections;
    // En el control rápido estos datos se capturan en vitales y examen.
    if (mode === 'quick' && t.id === 'postop') singles = singles.filter(q => !['intensity', 'wound'].includes(q.id));
    const data = roots.filter(q => !binary.includes(q) && !selections.includes(q));
    const pages = [];
    if (data.length) pages.push(data.map(q => q.id));
    if (binary.length) pages.push(binary.map(q => q.id));
    singles.forEach(q => pages.push([q.id]));
    return pages;
  }

  function title(q) {
    const natural = {
      procedure: '¿Qué procedimiento se realizó?', surgeryDate: '¿Cuándo fue la intervención?',
      wound: '¿Cómo está la herida?', apertura: '¿Hay apertura de la herida?',
      complications: '¿Hubo complicaciones?', progressivePain: '¿El dolor va en aumento?',
      adherence: '¿Cómo ha cumplido el tratamiento?', kind: '¿Qué tipo de tos tiene?',
      vomitEpisodes: '¿Cuántas veces ha vomitado?', hematemesis: '¿Ha vomitado sangre?',
      liquids: '¿Tolera líquidos?', dehydration: '¿Hay signos de deshidratación?',
      location: '¿Dónde se localiza?', since: '¿Desde cuándo?', adverse: '¿Ha tenido efectos adversos?',
      newSymptoms: '¿Qué síntomas nuevos presenta?', alarms: '¿Qué signos de alarma interrogó?',
      food: '¿Qué relación tiene con los alimentos?', bowel: '¿Qué relación tiene con la evacuación?',
      alarmDetail: '¿Qué signos de alarma interrogó?', pregnancy: '¿Hay posibilidad de embarazo?',
      mechanism: '¿Cómo ocurrió la lesión?', postFunction: '¿Qué podía hacer después de la lesión?',
      activity: '¿Qué actividad física realiza?', medicines: '¿Qué medicamentos ha usado?',
      sputum: '¿Cómo es la expectoración?', contact: '¿Qué contactos o exposiciones ha tenido?',
      maxTemp: '¿Cuál fue la temperatura máxima?', pattern: '¿Cómo se presenta la fiebre?',
      focus: '¿Dónde parece estar el foco?', travel: '¿Ha viajado recientemente?',
      vomitDuration: '¿Desde cuándo vomita?', ipss: '¿Desea aplicar el IPSS?' 
    };
    return natural[q.id] || ASK[q.id] || (/^¿/.test(q.label) ? q.label : '¿Presenta ' + q.label.toLowerCase() + '?');
  }

  function inferContext(c) {
    if (c.status === 'firmada' || c.kind === 'evolution') return;
    const g = init(c), appointments = typeof S === 'undefined' ? [] : S.appts || [];
    if (!g.contextEdited) {
      const appt = appointments.find(a => a.id === c.apptId);
      const apptType = appt?.consultType || appt?.type;
      const previous = typeof S === 'undefined' ? [] : (S.consults || []).filter(x =>
        x.id !== c.id && x.pid === c.pid && x.doc === c.doc && x.status === 'firmada');
      c.type = CONSULT.types[apptType] ? apptType :
        c.reasons.some(r => (r.template || CONSULT.templateFor(r.key)).id === 'postop') ? 'postoperatoria' :
        previous.length ? 'control' : 'primera';
    }
    if (!g.modalityEdited) c.modality = 'presencial';
    c.reasons.forEach(r => {
      if ((r.template || CONSULT.templateFor(r.key)).id !== 'postop' || r.surgeryPrefilled) return;
      const today = CONSULT.caracas().date;
      const surgery = appointments.filter(a => a.pid === c.pid && a.kind === 'cirugia' &&
        !['cancelada', 'no_asistio'].includes(a.status) &&
        (a.done === true || a.status === 'done' || (a.date && a.date <= today))).sort((a, b) =>
        (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')))[0];
      if (!surgery) return;
      const service = typeof S === 'undefined' ? null : (S.services || []).find(x => x.id === surgery.svc);
      if (!CONSULT.filled(r.answers.procedure)) r.answers.procedure = surgery.proc || surgery.procedure || service?.name || surgery.label || '';
      if (!CONSULT.filled(r.answers.surgeryDate)) r.answers.surgeryDate = surgery.date;
      r.surgeryPrefilled = true;
    });
  }

  function suggestedRegions(c) {
    if (c.kind === 'evolution') return [...new Set(c.selectedRegions || ['Estado general'])];
    const suggested = [];
    c.reasons.forEach(r => {
      const id = (r.template || CONSULT.templateFor(r.key)).id;
      const regions = { postop: ['Herida quirúrgica', 'Abdomen'], cefalea: ['Neurológico', 'Cabeza y cuello'],
        dolor_abdominal: ['Abdomen'], dolor_lumbar: ['Musculoesquelético', 'Neurológico'],
        dolor_articular: ['Musculoesquelético'], tos: ['Respiratorio'], urinarios: ['Abdomen'] };
      suggested.push(...(regions[id] || ['Estado general']));
    });
    return [...new Set([...suggested, ...Object.keys(c.exam)])];
  }

  function vitalSteps(c, section) {
    return [question('vitals', 'Signos vitales', section, { type: 'vitalsGroup', sectionName: 'Signos vitales' })];
  }

  function examSteps(c, regions, section) {
    return [question('exam', c.kind === 'evolution' ? 'Examen dirigido' : 'Examen físico', section,
      { type: 'examGroup', regions, sectionName: 'Examen físico' })];
  }

  function historySteps(c, p, group) {
    if (group === 'allergies') return [question('history-allergies', 'Alergias del paciente', 3,
      { type: 'allergiesGroup', group, sectionName: 'Alergias' })];
    return [question('history-' + group, historyGroups[group], 3,
      { type: 'historyGroup', group, sectionName: 'Antecedentes · ' + historyGroups[group] })];
  }

  function diagnosisSteps(c, section) {
    return [question('dx', '¿Cuáles diagnósticos desea registrar?', section,
      { type: 'dxSearch', sectionName: 'Diagnóstico' })];
  }

  function treatmentSteps(c) {
    return c.rx.map((r, i) => question('rx-' + i, 'Indicación de ' + r.drug, 9,
      { type: 'rxDetails', row: i, sectionName: 'Tratamiento' }));
  }

  function planSteps(c, section = 10) {
    return [question('plan', 'Plan y seguimiento', section, { type: 'planGroup', sectionName: 'Plan y seguimiento' })];
  }

  function steps(c, p) {
    inferContext(c);
    const g = init(c), list = [question('reasons', '¿Por qué consulta hoy?', 1,
      { type: 'reasonSearch', sectionName: 'Motivo' })];
    c.reasons.forEach((r, reason) => {
      const t = r.template || CONSULT.templateFor(r.key);
      reasonPages(r, CONSULT.context(p, c), c.mode).forEach(ids => {
        const q = t.questions.find(q => q.id === ids[0]);
        const binary = ['yesno', 'yesnounk'].includes(q.type);
        const single = ids.length === 1 && ['single', 'scale010'].includes(q.type);
        list.push(question('reason-' + reason + '-' + (binary ? 'symptoms' : single ? q.id : 'data'),
          binary ? '¿Qué presenta el paciente?' : single ? title(q) : t.id === 'postop' ? 'Datos de la cirugía' : 'Datos del motivo', 2,
          { ...(single ? q : {}), type: binary ? 'reasonChecklist' : single ? q.type : 'reasonData',
            reason, questions: ids, sectionName: r.label,
            ...(single ? { path: 'reasons.' + reason + '.answers.' + q.id } : {}) }));
      });
    });
    list.push(question('history', 'Antecedentes del paciente', 3, { type: 'historySummary', sectionName: 'Antecedentes' }));
    const groups = Object.keys(historyGroups).filter(k => k !== 'allergies' &&
      (k !== 'gyneco' || p.sex === 'F') && (k !== 'pediatric' || CONSULT.age(p.birth, c.date) < 18 && CONSULT.age(p.birth, c.date) !== null));
    if (g.updatingHistory) groups.forEach(group => list.push(...historySteps(c, p, group)));
    if (p.history.allergies.status === 'desconocido' || g.editAllergies || g.allergyDraft) list.push(...historySteps(c, p, 'allergies'));
    if (c.mode !== 'quick') list.push(question('ros', 'Revisión por sistemas', 4, { type: 'rosGroup', sectionName: 'Revisión por sistemas' }));
    list.push(...vitalSteps(c, 5), ...examSteps(c, suggestedRegions(c), 6), ...diagnosisSteps(c, 7));
    if (c.mode === 'quick') list.push(question('indications', 'Indicaciones', 8, { type: 'indicationsGroup', sectionName: 'Indicaciones' }));
    else list.push(question('orders', '¿Qué exámenes desea solicitar?', 8, { type: 'orderSearch', sectionName: 'Exámenes' }));
    const drafts = g.orderDrafts || (g.orderDraft ? [g.orderDraft] : []);
    drafts.forEach((draft, i) => {
      if (draft) list.push(question('orders-' + i, 'Solicitud de ' + draft.label, 8,
        { type: 'orderDetails', draft: i, detail: draft.label, sectionName: 'Exámenes' }));
    });
    if (c.mode !== 'quick') list.push(question('rx', '¿Qué medicamentos desea indicar?', 9, { type: 'rxSearch', sectionName: 'Tratamiento' }));
    list.push(...treatmentSteps(c), ...planSteps(c));
    list.push(question('review', 'Revisar', 11, { type: 'review', sectionName: 'Resumen' }),
      question('report', 'Revisar y firmar el informe', 11, { type: 'report', sectionName: 'Informe' }));
    return list;
  }

  function current(c, list) {
    const g = init(c);
    let index = list.findIndex(s => s.key === g.current);
    if (index < 0) {
      const old = g.current;
      const aliases = { context: 'reasons', 'context-modality': 'reasons', 'context-doc': 'review',
        'reasons-more': 'reasons', 'quick-reasons': 'reasons', 'quick-exam': 'exam',
        'quick-plan': 'plan', 'history-personal': 'history', 'history-social': 'history',
        'ev-0': 'ev-state', 'ev-1': 'vitals', 'ev-2': 'exam', 'ev-3': 'ev-results',
        'ev-4': 'dx', 'ev-5': 'ev-plan', 'ev-6': 'report', 'ev-admission': 'ev-state', ...(c.kind === 'evolution' ? { review: 'report' } : {}) };
      let target = aliases[old] || old;
      if (/^vital-|^vitals-more$/.test(old)) target = 'vitals';
      if (/^exam-/.test(old)) target = 'exam';
      if (/^ros-/.test(old)) target = 'ros';
      if (/^dx-/.test(old) || /^ev-(diagnosis|certainty)-/.test(old)) target = 'dx';
      if (/^plan-/.test(old)) target = 'plan';
      if (/^ev-symptom-|^ev-pain$/.test(old)) target = 'ev-symptoms';
      if (/^ev-result-/.test(old)) target = 'ev-results';
      if (old === 'ev-indications') target = 'ev-plan';
      if (/^history-allergies/.test(old)) { g.editAllergies = true; target = 'history-allergies'; }
      if (/^history-/.test(old) && !/^history-allergies/.test(old)) {
        const group = old.split('-')[1];
        target = historyGroups[group] ? 'history-' + group : 'history';
      }
      if (/^rx-\d+/.test(old)) target = old.match(/^rx-\d+/)[0];
      if (/^orders-\d+/.test(old)) target = old.match(/^orders-\d+/)[0];
      if (['orders-more', 'orders-category', 'orders-priority', 'orders-indication'].includes(old)) target = 'orders';
      if (['dx-more', 'rx-more'].includes(old)) target = old.split('-')[0];
      if (c.mode === 'quick' && ['rx', 'orders'].includes(target)) target = 'indications';
      index = list.findIndex(s => s.key === target);
      if (index < 0 && old.startsWith('reason-')) {
        const reason = Number(old.split('-')[1]), id = old.split('-').slice(2).join('-');
        const r = c.reasons[reason], t = r?.template || (r ? CONSULT.templateFor(r.key) : null);
        const ancestors = new Set([id]);
        function parentIds(qid) {
          dependencies(t?.questions.find(q => q.id === qid)?.showIf).forEach(parent => {
            if (!ancestors.has(parent)) { ancestors.add(parent); parentIds(parent); }
          });
        }
        parentIds(id);
        if (c.mode === 'quick' && t?.id === 'postop' && ['intensity', 'wound'].includes(id)) {
          index = list.findIndex(s => s.key === (id === 'intensity' ? 'vitals' : 'exam'));
        } else index = list.findIndex(s => s.reason === reason && s.questions?.some(qid => ancestors.has(qid)));
        if (index < 0) index = list.findIndex(s => s.reason === reason);
      }
      if (index < 0) index = 0;
      g.current = list[index].key;
    }
    return index;
  }

  function move(c, list, direction) {
    const i = current(c, list);
    init(c).current = list[Math.max(0, Math.min(list.length - 1, i + direction))].key;
    return current(c, list);
  }

  function jump(c, list, key) {
    const g = init(c), previous = g.current;
    if (/^history-allergies/.test(key)) g.editAllergies = true;
    g.current = key;
    current(c, list);
    const known = list.some(s => s.key === key) || /^(context|reason-|reasons-more|history|vital|exam|ros|dx-|rx|orders|plan-|quick-|ev-)/.test(key);
    if (!known) { g.current = previous; return false; }
    return true;
  }

  function mode(c, next, p) {
    const old = steps(c, p)[current(c, steps(c, p))];
    c.mode = next;
    const list = steps(c, p);
    init(c).current = (list.find(s => s.key === old.key) || list.find(s => s.section === old.section) || list[0]).key;
  }

  function state(c, p, s) {
    if (init(c).omissions[s.key]) return 'no documentado';
    if (s.path) {
      const value = s.path.split('.').reduce((v, k) => v?.[k], s.path.startsWith('history.') ? p : c);
      return CONSULT.filled(value) ? 'completado' : 'pendiente';
    }
    if (s.group) return c.guide.history[s.group] === 'confirmed' ? 'completado' : 'pendiente';
    return CONSULT.stepState(c, p, s.section);
  }

  function requirements(c, p, s) {
    const missing = [];
    if (s.key === 'context-specialty' && (!c.doc || !c.specialty?.trim())) missing.push('Médico y especialidad');
    if (s.type === 'reasonSearch' && !c.reasons.length) missing.push('Motivo principal');
    if (s.type === 'allergiesGroup' && p.history.allergies.status === 'desconocido' && !init(c).allergyReviewed) missing.push('Confirme el estado de alergias, incluso si sigue desconocido');
    if (s.type === 'vitalsGroup') missing.push(...c.vitals.flatMap(CONSULT.validateVitals));
    if (s.type === 'examGroup') Object.entries(c.exam).forEach(([region, e]) => {
      if (e.state === 'normal' && !e.confirmed?.length) missing.push('Ítems confirmados normales en ' + region);
    });
    if (s.type === 'vital') missing.push(...CONSULT.validateVitals(c.vitals[s.measurement] || {}));
    if (s.type === 'multi' && s.region && c.exam[s.region]?.state === 'normal' && !c.exam[s.region].confirmed?.length) missing.push('Ítems confirmados normales en ' + s.region);
    return missing;
  }

  return { init, title, dependencies, inferContext, suggestedRegions, historyGroups, historyFields, question, reasonPages, vitalSteps, examSteps,
    diagnosisSteps, steps, current, move, jump, mode, state, requirements };
})();

// Evoluciones: registros propios del ingreso; no se crean consultas ambulatorias.
const EVOLUTION = (() => {
  const symptoms = ['Dolor', 'Fiebre', 'Náuseas', 'Vómitos', 'Disnea', 'Sangrado',
    'Tolera vía oral', 'Diuresis', 'Deposiciones', 'Deambula', 'Descanso'];
  const titles = ['Estado del paciente', 'Signos vitales', 'Examen dirigido',
    'Resultados revisados', 'Diagnósticos del ingreso', 'Plan del día', 'Nota de evolución'];

  function create({ id, admission, doc, specialty, initial }) {
    const e = CONSULT.newConsult({ id, pid: admission.pid, admId: admission.id, doc,
      specialty, type: admission.area === 'emerg' || admission.emerg ? 'urgencia' : 'seguimiento', mode: 'quick' });
    Object.assign(e, { kind: 'evolution', initial, admissionReason: '', state: '', symptoms: {},
      symptomNotes: {}, progressNotes: '', reviews: {}, diagnosisUpdates: [], selectedRegions: ['Estado general'], indicationIds: [] });
    e.guide = { started: true, current: initial ? 'ev-admission' : 'ev-state', omissions: {}, history: {} };
    return e;
  }

  function steps(e) {
    const q = GUIDE.question;
    return [
      q('ev-state', '¿Cómo está el paciente?', 0, { type: 'single', path: 'state',
        options: ['Mejoría', 'Sin cambios', 'Empeoramiento', 'Nuevo problema'], observe: 'progressNotes', sectionName: 'Estado del paciente' }),
      q('ev-symptoms', '¿Qué presenta el paciente?', 0, { type: 'evolutionChecklist', sectionName: 'Síntomas' }),
      ...GUIDE.vitalSteps(e, 1), ...GUIDE.examSteps(e, e.selectedRegions, 2),
      q('ev-results', 'Resultados revisados', 3, { type: 'resultsGroup', sectionName: 'Resultados' }),
      ...GUIDE.diagnosisSteps(e, 4),
      q('ev-plan', 'Plan del día', 5, { type: 'evolutionPlan', sectionName: 'Plan del día' }),
      q('report', 'Revisar y firmar la evolución', 6, { type: 'report', sectionName: 'Nota de evolución' })
    ];
  }

  function clean(e, p, exams = [], indications = []) {
    // CONSULT limpia identificadores y hallazgos ocultos, también en texto libre.
    const projection = CONSULT.clone(e);
    projection.type = e.initial ? 'ingreso' : 'evolucion';
    projection.reasons = [CONSULT.newReason('otro_motivo', e.initial ? 'Valoración inicial del ingreso' : 'Evolución desde la última nota', true)];
    const facts = [];
    if (e.admissionReason) facts.push('Motivo de ingreso: ' + e.admissionReason);
    if (e.state) facts.push('Estado: ' + e.state);
    if (e.progressNotes) facts.push('Evolución: ' + e.progressNotes);
    Object.entries(e.symptoms).forEach(([label, state]) => {
      if (!state) return;
      const detail = state === 'presente' ? e.symptomNotes[label] : '';
      facts.push(label + ': ' + ({ presente: 'sí', ausente: 'no' }[state] || state.replace(/_/g, ' ')) + (CONSULT.filled(detail) ? ' · ' + detail : ''));
    });
    projection.reasons[0].answers.free = facts.join('\n');
    projection.exam = Object.fromEntries(Object.entries(e.exam).filter(([region]) => e.selectedRegions.includes(region)));
    projection.dx = e.diagnosisUpdates.filter(d => d.action).map(d => ({ label: d.label + ' · ' + d.action,
      priority: 'principal', certainty: (d.action === 'modificar certeza' ? d.certainty : d.baselineCertainty) || 'certeza no documentada' })).concat(e.dx);
    projection.orders = exams.filter(x => x.admId === e.admId && x.pid === e.pid && e.reviews[x.id]?.reviewed)
      .map(x => ({ label: (x.tests || []).join(', '), status: x.status,
        indication: 'Revisado' + (e.reviews[x.id].comment ? ': ' + e.reviews[x.id].comment : '') +
          (x.report ? ' · Resultado registrado: ' + x.report : '') }));
    projection.plan.notes = [e.plan.notes, ...indications.filter(x => x.admId === e.admId && e.indicationIds.includes(x.id))
      .map(x => 'Indicación vinculada: ' + [x.med, x.dose, x.freq, x.note, x.status].filter(Boolean).join(' · '))].filter(Boolean).join('\n');
    const data = CONSULT.clean(projection, p);
    data.steps = CONSULT.clone(e.guide.omissions);
    return data;
  }

  function hash(e, p, exams, indications) {
    const data = clean(e, p, exams, indications);

    // Solo datos documentados: navegar no invalida la aprobación.
    const text = JSON.stringify(data);
    let h = 2166136261, second = 5381;
    for (const char of text) {
      h = Math.imul(h ^ char.charCodeAt(0), 16777619);
      second = Math.imul(second, 33) ^ char.charCodeAt(0);
    }
    return (h >>> 0).toString(16) + (second >>> 0).toString(16);
  }

  // Nota de evolución propia (no la plantilla de consulta): breve, con el nombre real y solo lo documentado.
  function report(e, p, exams, indications) {
    const d = clean(e, p, exams, indications);
    const show = v => Array.isArray(v) ? v.filter(CONSULT.filled).map(show).join(', ') : v && typeof v === 'object' ?
      Object.entries(v).filter(([, x]) => CONSULT.filled(x)).map(([k, x]) => k + ': ' + show(x)).join('; ') : CONSULT.clinicalText(v);
    const adm = (S.admissions || []).find(a => a.id === e.admId);
    const day = adm && typeof dayNumber === 'function' ? dayNumber(adm) : null;
    const out = [], missing = [];
    const section = (title, lines) => { lines = lines.filter(Boolean); if (lines.length) out.push(title + '\n' + lines.join('\n')); };
    out.push((e.initial ? 'Valoración inicial del ingreso' : 'Evolución médica') + '\n' + [p.name,
      d.patient?.age != null ? d.patient.age + ' años' : '',
      d.date + ' ' + d.time + ' (Caracas)', adm?.bed ? 'Cama ' + adm.bed : '', day ? 'Día ' + day + ' de ingreso' : ''].filter(Boolean).join(' · '));
    // Subjetivo: lo que refiere el paciente y su estado (los hechos ya vienen depurados de identificadores)
    const facts = String(d.reasons?.[0]?.answers?.map(a => a.value).join('\n') || '').split('\n').filter(Boolean);
    section('Estado y síntomas', facts);
    const vit = (d.vitals || []).map(v => {
      const parts = CONSULT.vitals.filter(([k]) => CONSULT.filled(v[k])).map(([k, label, unit]) => label + ' ' + v[k] + (unit === '0–10' ? '/10' : ' ' + unit));
      if (v.bmi != null) parts.push('IMC ' + v.bmi);
      return parts.length ? (v.at ? v.at + ' · ' : '') + parts.join('; ') : '';
    });
    if (vit.some(Boolean)) section('Signos vitales', vit); else missing.push('signos vitales');
    const exam = Object.entries(d.exam || {}).map(([region, x]) => x.state === 'normal' ? region + ': normal en lo confirmado (' + (x.confirmed || []).join(', ') + ')' :
      x.state === 'alterado' ? region + ': ' + (show(x.findings || {}) || 'alterado') + (x.note ? ' · ' + x.note : '') : x.state === 'no_examinado' ? region + ': no examinado' : '');
    if (exam.some(Boolean)) section('Examen dirigido', exam); else missing.push('examen físico');
    section('Resultados revisados', (d.orders || []).map(o => o.label + (o.indication ? ' · ' + o.indication : '')));
    section('Diagnósticos', (d.dx || []).map(CONSULT.diagnosisText));
    const plan = d.plan || {};
    section('Plan del día', [plan.conducts?.length ? 'Conducta: ' + plan.conducts.join(', ') : '', plan.notes || ''].concat(
      (d.rx || []).map(r => 'Tratamiento: ' + show(r))));
    if (missing.length) out.push('No documentado en esta nota: ' + missing.join(', ') + '.');
    return CONSULT.clinicalText(out.join('\n\n'));
  }

  function state(e, s) {
    if (e.guide.omissions[s.title]) return e.guide.omissions[s.title];
    const evaluated = [
      !!e.state && (!e.initial || !!e.admissionReason.trim()),
      e.vitals.some(v => CONSULT.vitals.some(([k]) => CONSULT.filled(v[k]))) && !e.vitals.some(v => CONSULT.validateVitals(v).length),
      e.selectedRegions.some(r => e.exam[r]?.state),
      Object.values(e.reviews).some(r => r.reviewed),
      e.dx.length > 0 || e.diagnosisUpdates.some(d => d.action),
      e.plan.conducts.length > 0 || !!e.plan.notes || e.indicationIds.length > 0,
      !!e.report.draft
    ];
    return evaluated[s.section] ? 'completado' : 'pendiente';
  }

  return { symptoms, titles, create, steps, clean, hash, report, state };
})();
