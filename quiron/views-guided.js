// Asistente compartido: una tarea clínica por pantalla.
function evolutionOf(id) {
  return (S.evolutions || []).find(e => e.id === id);
}

function evolutionEditable(e) {
  return !!e && e.status !== 'firmada' && isClin() && can('hosp.clinico') &&
    e.doc === myDoc() && admOf(e.admId)?.status === 'ingresado';
}

function guidedCurrent() {
  if (route === 'consultas') return consultOf(param);
  if (['hospitalizacion', 'emergencias'].includes(route)) {
    const e = evolutionOf(UI.evolutionId);
    if (e?.admId === param) return e;
  }
  return null;
}

function guidedEditable(c) {
  return c?.kind === 'evolution' ? evolutionEditable(c) : consultCanEdit(c);
}

function guidedSteps(c) {
  return c.kind === 'evolution' ? EVOLUTION.steps(c) : GUIDE.steps(c, pat(c.pid));
}

function guidedStep(c) {
  const list = guidedSteps(c);
  return list[GUIDE.current(c, list)];
}

function guidedRequirements(c, s) {
  const missing = GUIDE.requirements(c, pat(c.pid), s);
  if (c.kind === 'evolution' && s.key === 'ev-state') {
    if (!c.state) missing.push('Estado del paciente');
    if (c.initial && !c.admissionReason.trim()) missing.push('Motivo de ingreso');
  }
  if (s.type === 'evolutionChecklist' && CONSULT.filled(c.symptomNotes.Dolor) &&
    (!Number.isFinite(+c.symptomNotes.Dolor) || +c.symptomNotes.Dolor < 0 || +c.symptomNotes.Dolor > 10)) missing.push('Dolor: rango permitido 0–10');
  if (s.type === 'allergiesGroup' && GUIDE.init(c).allergyDraft?.substance) missing.push('Guarde o descarte la alergia en captura');
  return missing;
}

function guidedState(c, s) {
  if (GUIDE.init(c).omissions[s.key]) return 'no documentado';
  return c.kind === 'evolution' ? EVOLUTION.state(c, s) : GUIDE.state(c, pat(c.pid), s);
}

function guidedWarnings(c, s) {
  const missing = guidedRequirements(c, s);
  return missing.length ? 'Por completar: ' + missing.join(' · ') + '.' : '';
}

function guidedBand(c) {
  const p = pat(c.pid);
  return '<div class="patient-band guide-band"><div class="grow"><b>' + esc(p.name) +
    '</b><span class="small muted"> · ' + esc(p.code) + '</span><div class="small allergy">' +
    esc(CONSULT.allergyText(p.history)) + '</div></div>' + allergyQuickButton(p.id) + '</div>';
}

function guidedShell(c, title, list, body, editable) {
  const i = GUIDE.current(c, list), s = list[i];
  const report = s.type === 'report', review = s.type === 'review';
  const warning = guidedWarnings(c, s);
  const back = c.kind === 'evolution' ? ccButton('evBack', 'Volver al ingreso') :
    '<button class="btn" data-go="consultas">Volver a Consultas</button>';
  const heading = '<div class="guide-heading"><span class="small muted">' + esc(title) + '</span>' +
    '<span id="consult-save" class="small muted" role="status" aria-live="polite">' +
    esc(UI.consultSave || 'Guardado') + '</span>' + back + '</div>';
  const needsContinue = true;
  return heading + '<div class="guide-wrap">' + guidedBand(c) +
    (c.kind !== 'evolution' && editable ? '<div class="guide-tools">' +
      ccButton('ccMode', c.mode === 'quick' ? 'Ampliar a consulta completa' : 'Volver a consulta rápida', '', 'ghost') + '</div>' : '') +
    '<div class="guide-progress" role="progressbar" aria-label="Progreso del asistente" aria-valuemin="0" aria-valuemax="' +
    list.length + '" aria-valuenow="' + (i + 1) + '"><span style="width:' + ((i + 1) * 100 / list.length) + '%"></span></div>' +
    '<section class="card guide-card" data-question-type="' + s.type + '"><div class="small muted guide-counter">' + esc(s.sectionName || title) +
    ' · Pantalla ' + (i + 1) + ' de ' + list.length + '</div><h1 id="guide-title" tabindex="-1">' + esc(s.title) +
    '</h1><p id="guide-warning" class="banner warn" role="status" ' + (warning ? '' : 'hidden') + '>' + esc(warning) + '</p>' +
    '<div class="cc-editor" role="group" ' + (editable ? '' : 'inert') + '><div class="guide-editor-inner"><div id="guide-body" class="guide-question">' + body + '</div>' +
    '</div></div></section><nav class="guide-footer" aria-label="Navegación del asistente">' +
    ccButton('guidePrevious', '‹ Anterior', i === 0 ? 'disabled' : '') +
    (editable && needsContinue && !report ? ccButton('guideNext', review ? 'Generar informe ›' : 'Continuar', '', 'primary guide-continue') : '') +
    ccButton('guideSkip', 'Omitir ›', report || review || !editable ? 'disabled' : '') +
    '</nav></div>';
}

function guidedRenderNavigation() {
  render();
  const current = guidedCurrent();
  if (current) guidedRefreshVitalFields(current);
  const box = document.getElementById('guide-body');
  const field = box?.querySelector('input:not([type="checkbox"]), textarea:not([data-path="report.draft"])');
  (field || document.getElementById('guide-title'))?.focus({ preventScroll: true });
}

function guidedSavePosition(c) {
  c.updatedAt = nowStamp();
  consultSaveStatus('Guardando…');
  return consultFlush();
}

function guidedGo(c, key) {
  if (/^history-allergies/.test(key)) GUIDE.init(c).editAllergies = true;
  if (!GUIDE.jump(c, guidedSteps(c), key)) return;
  guidedSavePosition(c);
  guidedRenderNavigation();
}

function guidedDirty(c, preserveOmission = false) {
  if (c.kind === 'evolution') evolutionDirty(c, preserveOmission);
  else consultDirty(c, preserveOmission);
}

ACTIONS.guidePrevious = () => {
  const c = guidedCurrent();
  if (!c || !guidedEditable(c)) return;
  GUIDE.move(c, guidedSteps(c), -1);
  guidedSavePosition(c);
  guidedRenderNavigation();
};

ACTIONS.guideNext = () => {
  const c = guidedCurrent();
  if (!c || !guidedEditable(c)) return;
  const s = guidedStep(c);
  if (['examGroup', 'vitalsGroup', 'allergiesGroup', 'evolutionChecklist', 'reasonSearch'].includes(s.type) && guidedRequirements(c, s).length ||
    c.kind === 'evolution' && s.key === 'ev-state' && guidedRequirements(c, s).length) {
    if (s.type === 'examGroup') GUIDE.init(c).examValidation = true;
    guidedRefreshBody(c);
    toast(guidedWarnings(c, s));
    return;
  }
  if (s.type === 'orderDetails') { guidedCommitOrder(c); return; }
  if (s.type === 'planGroup' && c.plan.createAppointment && !c.plan.apptId) {
    ACTIONS.ccFollowup();
    if (!c.plan.apptId) return;
  }
  // "Normal" sin decir qué se verificó no sirve en la historia: se avisa aquí, no al firmar
  if (s.type === 'multi' && s.region && /\.confirmed$/.test(s.path || '') && !c.exam[s.region]?.confirmed?.length) {
    const msg = 'Marque lo que verificó o pulse «Todo lo de esta región». Si no examinó esta región, pulse «Omitir».';
    const box = document.getElementById('guide-warning');
    if (box) { box.textContent = msg; box.hidden = false; }
    toast(msg);
    return;
  }
  // Los valores imposibles deben corregirse o dejarse sin documentar.
  if (s.type === 'vital' && guidedRequirements(c, s).length) {
    toast(guidedWarnings(c, s));
    return;
  }
  if (s.type === 'orderIndication') {
    guidedCommitOrder(c);
    return;
  }
  if (s.type === 'allergyReaction') {
    guidedGo(c, 'history-allergies-severity');
    return;
  }
  if (s.type === 'review') {
    guidedGo(c, 'report');
    const generating = c.kind === 'evolution' ? ACTIONS.evGenerate() : ACTIONS.ccGenerate();
    generating?.catch(() => toast('No se pudo redactar. Puede reintentarlo en esta pantalla.'));
    return;
  }
  const list = guidedSteps(c);
  GUIDE.move(c, list, 1);
  guidedSavePosition(c);
  guidedRenderNavigation();
};

ACTIONS.guideJump = el => {
  const c = guidedCurrent();
  if (c && guidedEditable(c)) guidedGo(c, el.dataset.key);
};

function guidedClearOmission(c) {
  const s = guidedStep(c);
  delete GUIDE.init(c).omissions[s.key];
  // Compatibilidad con omisiones de los asistentes anteriores.
  delete c.guide.omissions[s.title];
  if (c.kind !== 'evolution') delete c.steps[s.section];
}

function guidedDelete(object, key) {
  if (!key) return;
  const parts = key.split('.');
  const parent = parts.slice(0, -1).reduce((v, k) => v?.[k], object);
  if (parent) delete parent[parts.at(-1)];
}

function guidedOmit(c, s) {
  const g = GUIDE.init(c), p = pat(c.pid);
  if (s.type === 'vitalsGroup') c.vitals = c.vitals.map(v => ({ at: v.at }));
  if (s.type === 'examGroup') c.exam = {};
  if (s.type === 'rosGroup') { c.ros = {}; c.rosNotes = {}; }
  if (s.type === 'reasonData' || s.type === 'reasonChecklist') {
    const r = c.reasons[s.reason];
    s.questions.forEach(id => {
      delete r.answers[id];
      delete r.answers[id + '_free'];
      const aliases = { frequency: 'freq', previousTreatment: 'prevTx', response: 'txResponse' };
      delete r.char[aliases[id] || id];
      if (id === 'duration') { delete r.char.durN; delete r.char.durU; }
    });
    c.reasons[s.reason] = CONSULT.reconcile(r, CONSULT.context(p, c));
  }
  if (s.type === 'evolutionChecklist') { c.symptoms = {}; c.symptomNotes = {}; }
  if (s.type === 'resultsGroup') c.reviews = {};
  if (s.path && !s.path.startsWith('history.')) {
    if (/^exam\.[^.]+\.state$/.test(s.path)) {
      const region = s.path.split('.')[1];
      delete c.exam[region];
    }
    guidedDelete(c, s.path);
    if (s.reason !== undefined) {
      const r = c.reasons[s.reason];
      // El motor conserva una proyección antigua de caracterización; se limpia también.
      const aliases = { frequency: 'freq', previousTreatment: 'prevTx', response: 'txResponse' };
      delete r.char[aliases[s.id] || s.id];
      if (s.type === 'duration') {
        delete r.char.durN;
        delete r.char.durU;
      }
      c.reasons[s.reason] = CONSULT.reconcile(r, CONSULT.context(p, c));
    }
  }
  if (s.type === 'vital') {
    const v = c.vitals[s.measurement];
    if (v) {
      delete v[s.vital];
      if (s.vital === 'sys') delete v.dia;
    }
  }
  if (s.path?.startsWith('symptoms.')) delete c.symptomNotes[s.path.slice(9)];
  if (s.type === 'findings') delete c.exam[s.region];
  if (s.type === 'rosGate' || s.type === 'rosItems') {
    delete g.ros[s.system];
    delete c.ros[s.system];
    delete c.rosNotes?.[s.system];
  }
  if (s.type === 'result') delete c.reviews[s.examId];
  // Omitir la confirmación de un antecedente conserva el registro longitudinal previo.
  if (s.path?.startsWith('history.') && s.type !== 'historyConfirm') {
    if (s.path !== 'history.allergies.status') {
      guidedDelete(p, s.path);
      CONSULT.syncLegacy(p);
    }
  }
  if (s.observe && !s.observe.startsWith('history.')) guidedDelete(c, s.observe);
  if (s.type.startsWith('allergy')) delete g.allergyDraft;
  if (s.type.startsWith('order') && s.draft !== undefined) {
    guidedOrderDrafts(c)[s.draft] = null;
  }
  g.omissions[s.key] = 'no documentado';
}

ACTIONS.guideSkip = () => {
  const c = guidedCurrent();
  if (!c || !guidedEditable(c)) return;
  const list = guidedSteps(c), i = GUIDE.current(c, list), s = list[i];
  if (['report', 'review'].includes(s.type)) return;
  if (s.type === 'allergiesGroup' && pat(c.pid).history.allergies.status === 'desconocido' && !c.guide.allergyReviewed) {
    toast('Confirme el estado de alergias. Puede elegir «Desconocido / no confirmado».'); return;
  }
  // Omitir "qué verificó como normal" deja la región sin documentar (nunca "normal" vacío)
  if (s.type === 'multi' && s.region && /\.confirmed$/.test(s.path || '') && c.exam[s.region]) {
    delete c.exam[s.region].state;
    delete c.exam[s.region].confirmed;
  }
  // Se busca la próxima pregunta que siga existiendo después de quitar condiciones.
  const candidates = list.slice(i + 1).map(q => q.key);
  guidedOmit(c, s);
  guidedDirty(c, true);
  const nextList = guidedSteps(c);
  c.guide.current = candidates.find(key => nextList.some(q => q.key === key)) || 'review';
  guidedSavePosition(c);
  guidedRenderNavigation();
};

function guidedRefreshStatus(c) {
  const s = guidedStep(c), warning = document.getElementById('guide-warning');
  if (warning) {
    warning.textContent = guidedWarnings(c, s);
    warning.hidden = !warning.textContent;
  }
}

function guidedRefreshBody(c) {
  const box = document.getElementById('guide-body');
  if (box) box.innerHTML = guidedQuestionBody(c, guidedStep(c));
  guidedRefreshVitalFields(c);
  guidedRefreshStatus(c);
}

function guidedValue(c, key) {
  return ccGet(key?.startsWith('history.') ? pat(c.pid) : c, key || '');
}

function guidedChoices(c, key, options, multi = false, advance = true) {
  const value = guidedValue(c, key);
  return '<div class="guide-options' + (options.length === 11 ? ' guide-scale' : '') + '" role="group">' +
    options.map(o => {
      const [v, label] = Array.isArray(o) ? o : [o, o];
      const selected = multi ? (value || []).includes(v) : value === v;
      return ccButton('guideAnswer', esc(label), ccAttrs(key) +
        ' data-value="' + esc(JSON.stringify(v)) + '" data-multi="' + multi +
        '" data-advance="' + advance + '" aria-pressed="' + selected + '"');
    }).join('') + '</div>';
}

function guidedInput(c, label, key, type = 'text', extra = '') {
  const input = ccField(label, key, guidedValue(c, key), type,
    (type === 'number' ? 'inputmode="decimal" step="any" ' : '') + extra);
  return input.replace('data-in="ccInput"', 'data-in="guideInput"');
}

function guidedObservation(c, key) {
  if (!key) return '';
  const value = guidedValue(c, key);
  const open = UI.guideObservation === c.id + ':' + key;
  return ccButton('guideObservation', value ? 'Editar observación' : 'Agregar observación',
    'data-path="' + esc(key) + '" aria-expanded="' + open + '"', 'ghost guide-observation') +
    (open ? ccText('Observación', key, value).replace('data-in="ccInput"', 'data-in="guideInput"') : '');
}

ACTIONS.guideObservation = el => {
  const c = guidedCurrent();
  if (!c || !guidedEditable(c)) return;
  const key = c.id + ':' + el.dataset.path;
  UI.guideObservation = UI.guideObservation === key ? null : key;
  guidedRefreshBody(c);
  document.getElementById('guide-body')?.querySelector('textarea')?.focus({ preventScroll: true });
};

function guidedEnsureVital(c, key) {
  if (!key.startsWith('vitals.')) return;
  const index = Number(key.split('.')[1]);
  while (c.vitals.length <= index) c.vitals.push({ at: CONSULT.caracas().date + ' ' + CONSULT.caracas().time });
}

ACTIONS.guideInput = el => {
  const c = guidedCurrent();
  if (!c || !guidedEditable(c)) return;
  const key = el.dataset.path;
  guidedEnsureVital(c, key);
  if (c.kind === 'evolution') ACTIONS.evInput(el);
  else ACTIONS.ccInput(el);
  guidedRefreshVitalFields(c);
  guidedRefreshStatus(c);
};

function guidedReconcileExam(c, key, value) {
  if (!/^exam\.[^.]+\.state$/.test(key)) return;
  const e = ccGet(c, key.slice(0, -6));
  // Cambiar el estado descarta los hallazgos que dejan de aplicar.
  if (value !== 'normal') delete e.confirmed;
  if (value !== 'alterado') {
    delete e.findings;
    delete e.note;
  }
}

ACTIONS.guideAnswer = el => {
  const c = guidedCurrent();
  if (!c || !guidedEditable(c)) return;
  const key = el.dataset.path, multi = el.dataset.multi === 'true', value = JSON.parse(el.dataset.value);
  guidedEnsureVital(c, key);
  if (key === 'doc' && !can('consulta.asignar')) return;
  if (c.kind === 'evolution' && !evolutionPathAllowed(key)) return;
  if (key.startsWith('reviews.') && !S.exams.some(x => x.id === key.split('.')[1] && x.admId === c.admId && x.pid === c.pid)) return;
  if (c.kind === 'evolution' && key.startsWith('exam.') && !c.selectedRegions.includes(key.split('.')[1])) c.selectedRegions.push(key.split('.')[1]);
  if (key === 'doc') {
    ACTIONS.ccInput({ type: 'select-one', tagName: 'SELECT', value, dataset: { path: key } });
    ACTIONS.guideNext();
    return;
  }
  const object = key.startsWith('history.') ? pat(c.pid) : c;
  const old = ccGet(object, key);
  ccSet(object, key, multi ? (old || []).includes(value) ? old.filter(x => x !== value) : (old || []).concat(value) : value);
  guidedReconcileExam(c, key, value);
  if (/^dx\.\d+\.priority$/.test(key) && value === 'principal') {
    const index = Number(key.split('.')[1]);
    c.dx.forEach((d, i) => { d.priority = i === index ? 'principal' : 'secundario'; });
  }
  if (key === 'history.allergies.status') GUIDE.init(c).allergyReviewed = true;
  if (key === 'history.allergies.status' && value !== 'conocidas') delete GUIDE.init(c).allergyDraft;
  if (key.startsWith('symptoms.') && value !== 'presente') delete c.symptomNotes[key.slice(9)];
  if (/^diagnosisUpdates\.\d+\.action$/.test(key) && value !== 'modificar certeza') {
    delete c.diagnosisUpdates[Number(key.split('.')[1])].certainty;
  }
  guidedClearOmission(c);
  if (c.kind === 'evolution') evolutionDirty(c);
  else {
    if (key.startsWith('history.')) {
      GUIDE.init(c).history[key.split('.')[1]] = 'updating';
    }
    ccChanged(c, key);
  }
  const activeStep = guidedStep(c);
  const conditional = activeStep.reason !== undefined && CONSULT.visibleQuestions(c.reasons[activeStep.reason].template,
    c.reasons[activeStep.reason].answers, CONSULT.context(pat(c.pid), c)).some(q =>
    !/_free$/.test(q.id) && GUIDE.dependencies(q.showIf).includes(activeStep.id));
  const grouped = ['examGroup', 'dxSearch', 'allergiesGroup', 'reasonChecklist', 'reasonData', 'rosGroup', 'evolutionChecklist', 'resultsGroup', 'evolutionPlan', 'planGroup'].includes(guidedStep(c).type);
  if (!multi && !grouped && !conditional && el.dataset.advance !== 'false') ACTIONS.guideNext();
  else guidedRefreshBody(c);
};

// También los botones existentes capturan y avanzan con el mismo criterio.
ACTIONS.ccChip = el => ACTIONS.guideAnswer(el);
const guidedOriginalInput = ACTIONS.ccInput;
ACTIONS.ccInput = el => {
  const c = ccCurrent();
  if (!c) return;
  const key = el.dataset.path;
  guidedEnsureVital(c, key);
  if (key === 'type' && GUIDE.init(c).started) {
    c.guide.contextEdited = true;
    c.type = el.value;
    ccChanged(c, key);
  } else {
    if (key === 'modality') GUIDE.init(c).modalityEdited = true;
    guidedOriginalInput(el);
  }
  if (key?.startsWith('history.')) GUIDE.init(c).history[key.split('.')[1]] = 'updating';
  guidedClearOmission(c);
  guidedRefreshStatus(c);
};

ACTIONS.ccMode = () => {
  const c = ccCurrent();
  if (!c) return;
  GUIDE.mode(c, c.mode === 'quick' ? 'complete' : 'quick', pat(c.pid));
  consultAudit(c, 'cambio_vista', c.mode);
  consultDirty(c, true);
  guidedRenderNavigation();
};

ACTIONS.ccOpen = el => {
  const c = consultOf(el.dataset.id);
  if (!c || !consultAccessible(c)) return;
  GUIDE.init(c);
  go('consultas', c.id);
};

ACTIONS.guideStart = el => {
  const c = ccCurrent();
  if (!c || !['quick', 'complete'].includes(el.dataset.mode)) return;
  c.mode = el.dataset.mode;
  Object.assign(GUIDE.init(c), { started: true, current: 'reasons' });
  consultAudit(c, 'asistente_iniciado', c.mode);
  consultDirty(c);
  guidedSavePosition(c);
  guidedRenderNavigation();
};

function guidedHistorySummary(c, group) {
  const h = pat(c.pid).history;
  if (group === 'allergies') return CONSULT.allergyText(h);
  const pending = x => /pendiente de confirmar|migrado/i.test(x?.note || '') ? 'por confirmar' : '';
  const extra = (...xs) => { const t = xs.filter(Boolean).join(', '); return t ? ' (' + t + ')' : ''; };
  const list = Array.isArray(h[group]) ? h[group] : [];
  const lines = {
    conditions: () => list.map(x => (x.name || '') + extra(x.state && x.state !== 'presente' ? x.state : '', x.since ? 'desde ' + x.since : '', x.tx ? 'tratamiento: ' + x.tx : '', pending(x))),
    surgeries: () => list.map(x => (x.name || '') + extra(x.date, x.complications ? 'complicaciones: ' + x.complications : '')),
    meds: () => list.map(x => [x.drug, x.dose, x.freq].filter(Boolean).join(' ') + extra(x.active === false ? 'suspendido' : '', pending(x))),
    family: () => list.map(x => (x.disease || x.name || '') + extra(x.relative, x.age ? 'a los ' + x.age : ''))
  }[group];
  const text = lines ? lines().filter(t => t.trim()).join('; ') : guidedDisplay(h[group]);
  return text || 'Ninguno registrado';
}
// Grupos de antecedentes que aplican a este paciente (gineco solo mujeres; pediátricos solo menores)
function guidedHistoryGroupsFor(c) {
  const p = pat(c.pid), age = CONSULT.age(p.birth, c.date);
  return Object.keys(GUIDE.historyGroups).filter(g => g !== 'allergies' &&
    (g !== 'gyneco' || p.sex === 'F') && (g !== 'pediatric' || (age !== null && age < 18)));
}

const guidedLabels = {
  name: 'Nombre', drug: 'Medicamento', ingredient: 'Principio activo',
  presentation: 'Presentación', dose: 'Dosis', unit: 'Unidad', route: 'Vía',
  freq: 'Frecuencia', duration: 'Duración', qty: 'Cantidad', notes: 'Indicaciones',
  note: 'Observación', state: 'Estado', since: 'Desde', tx: 'Tratamiento',
  disease: 'Enfermedad', relative: 'Familiar', age: 'Edad', date: 'Fecha',
  institution: 'Institución', complications: 'Complicaciones', anesthesia: 'Anestesia',
  active: 'Activo', start: 'Inicio', end: 'Fin', substance: 'Sustancia',
  reaction: 'Reacción', severity: 'Gravedad', verified: 'Verificada',
  n: 'Cantidad', at: 'Fecha y hora', priority: 'Prioridad', certainty: 'Certeza',
  status: 'Estado', tabaco: 'Tabaco', alcohol: 'Alcohol', sustancias: 'Sustancias',
  actividad: 'Actividad física', alimentacion: 'Alimentación', ocupacion: 'Ocupación',
  exposiciones: 'Exposiciones', sueno: 'Sueño', social: 'Factores sociales'
};

function guidedDisplay(value) {
  if (!CONSULT.filled(value)) return '';
  if (Array.isArray(value)) return value.map(guidedDisplay).filter(Boolean).join('; ');
  if (typeof value === 'object') return Object.entries(value)
    .filter(([k, v]) => CONSULT.filled(v) && !['updatedAt', 'codeSource', 'productId', 'documentStatus', 'examId'].includes(k))
    .map(([k, v]) => (guidedLabels[k] || k) + ': ' + guidedDisplay(v)).join(' · ');
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (/Migrado;?\s*pendiente de confirmar/i.test(String(value))) return '(por confirmar)';
  return String(value);
}

ACTIONS.guideHistoryUpdate = el => {
  const c = ccCurrent();
  if (!c) return;
  const g = GUIDE.init(c);
  if (el.dataset.group === 'allergies') {
    g.editAllergies = true;
    guidedGo(c, 'history-allergies');
  } else {
    g.updatingHistory = true;
    delete c.historyConfirmedAt;
    guidedDirty(c);
    guidedGo(c, guidedSteps(c).find(s => s.type === 'historyGroup').key);
  }
};
ACTIONS.guideHistoryConfirm = el => {
  const c = ccCurrent();
  if (!c) return;
  const at = new Date().toISOString(), h = pat(c.pid).history, g = GUIDE.init(c);
  if (el?.dataset?.group) {
    g.history[el.dataset.group] = 'confirmed';
    guidedDirty(c);
    ACTIONS.guideNext();
    return;
  }
  Object.keys(GUIDE.historyGroups).forEach(k => { g.history[k] = 'confirmed'; });
  h.confirmedAt = at;
  h.confirmations.push({ at, by: consultSession(), consultId: c.id });
  c.historyConfirmedAt = at;
  g.updatingHistory = false;
  consultAudit(c, 'antecedentes_confirmados', 'Resumen longitudinal');
  guidedDirty(c);
  ACTIONS.guideNext();
};
ACTIONS.guideHistoryEdit = el => {
  const c = ccCurrent(), group = el.dataset.group, i = Number(el.dataset.i);
  if (!c || !GUIDE.historyFields[group] || !pat(c.pid).history[group]?.[i]) return;
  guidedGo(c, 'history-' + group + '-' + i + '-' + GUIDE.historyFields[group][0][0]);
};

ACTIONS.guideHistoryAdd = el => {
  const c = ccCurrent(), group = el.dataset.group;
  if (!c || !Array.isArray(pat(c.pid).history[group])) return;
  const rows = pat(c.pid).history[group];
  rows.push({});
  ccChanged(c, 'history.' + group);
  guidedRefreshBody(c);
};

ACTIONS.guideGroupDone = el => {
  const c = ccCurrent();
  if (!c) return;
  const list = guidedSteps(c), i = GUIDE.current(c, list);
  const next = list.slice(i + 1).find(s => s.group !== el.dataset.group);
  if (next) guidedGo(c, next.key);
};

ACTIONS.guideRosGate = el => {
  const c = ccCurrent(), sys = el.dataset.system;
  if (!c || !CONSULT.ros[sys]) return;
  GUIDE.init(c).ros[sys] = el.dataset.yes === 'true';
  if (!c.guide.ros[sys]) {
    delete c.ros[sys];
    delete c.rosNotes?.[sys];
  }
  guidedDirty(c);
  ACTIONS.guideNext();
};

ACTIONS.guideRegionToggle = el => {
  const c = guidedCurrent(), region = el.dataset.region;
  if (!c || !guidedEditable(c) || !CONSULT.exam[region]) return;
  const g = GUIDE.init(c), selected = c.kind === 'evolution' ? c.selectedRegions : g.regions ||= Object.keys(c.exam);
  const next = selected.includes(region) ? selected.filter(r => r !== region) : selected.concat(region);
  if (c.kind === 'evolution') c.selectedRegions = next;
  else g.regions = next;
  if (!next.includes(region)) delete c.exam[region];
  guidedDirty(c);
  guidedRefreshBody(c);
};

ACTIONS.guideFinding = el => {
  const c = guidedCurrent(), region = el.dataset.region, item = el.dataset.item;
  if (!c || !guidedEditable(c) || c.exam[region]?.state !== 'alterado') return;
  const e = c.exam[region];
  e.findings ||= {};
  if (CONSULT.filled(e.findings[item])) delete e.findings[item];
  else e.findings[item] = 'Alterado';
  guidedDirty(c);
  guidedRefreshBody(c);
};

ACTIONS.guideVitalMore = () => {
  const c = guidedCurrent();
  if (!c || !guidedEditable(c)) return;
  c.vitals.push({ at: CONSULT.caracas().date + ' ' + CONSULT.caracas().time });
  guidedDirty(c);
  guidedRefreshBody(c);
};
ACTIONS.guideAnother = el => {
  const c = guidedCurrent();
  if (!c || !guidedEditable(c)) return;
  if (el.dataset.yes === 'true') guidedGo(c, el.dataset.target);
  else ACTIONS.guideNext();
};

ACTIONS.guideAppointment = () => {
  const c = ccCurrent();
  if (!c) return;
  if (!c.plan.apptId) ACTIONS.ccFollowup();
  if (c.plan.apptId) ACTIONS.guideNext();
};

function guidedSearch(id, act, value, placeholder, results, resultsId, resultsClass = '') {
  return '<label class="sr-only" for="' + id + '">' + esc(placeholder) + '</label><input class="input" id="' + id +
    '" data-in="' + act + '" value="' + esc(value || '') + '" placeholder="' + esc(placeholder) +
    '" autocomplete="off"><div class="guide-options guide-search-results ' + resultsClass + '" id="' + resultsId + '">' + results + '</div>';
}

function guidedVital(c, s) {
  const i = s.measurement, v = c.vitals[i] || {};
  const keys = s.vital === 'sys' ? ['sys', 'dia'] : [s.vital];
  const fields = s.vital === 'pain' ? guidedChoices(c, 'vitals.' + i + '.pain', Array.from({ length: 11 }, (_, i) => i)) :
    '<div class="guide-vital-fields">' + keys.map(key => {
      const def = CONSULT.vitals.find(([k]) => k === key);
      return guidedInput(c, def[1] + ' · ' + def[2], 'vitals.' + i + '.' + key, 'number', 'min="' + def[3] + '" max="' + def[4] + '"');
    }).join('') + '</div>';
  const bmi = CONSULT.bmi(v.weight, v.height), errors = CONSULT.validateVitals(v);
  return fields + '<p class="small muted">' + esc(v.at || 'Se guardará la hora de la medición nueva') + '</p>' +
    '<p id="cc-bmi-wrap-' + i + '" ' + (bmi === null ? 'hidden' : '') + '>IMC: <span id="cc-bmi-' + i + '">' + (bmi ?? '') + '</span></p>' +
    '<div id="cc-vital-error-' + i + '" class="banner warn" role="alert" ' + (errors.length ? '' : 'hidden') + '>' +
    esc(errors.join(' · ')) + '</div>' + (c.kind === 'evolution' ? '<details><summary>Ver mediciones previas</summary>' + evolutionReference(c) + '</details>' : '');
}

function guidedInlineQuestion(c, reason, q) {
  const key = 'reasons.' + reason + '.answers.' + q.id;
  let control;
  if (['single', 'multi', 'yesno', 'yesnounk', 'scale010'].includes(q.type)) {
    const options = ['yesno', 'yesnounk'].includes(q.type) ? ['Sí', 'No', 'Desconocido'] :
      q.type === 'scale010' ? Array.from({ length: 11 }, (_, i) => i) : q.options;
    control = guidedChoices(c, key, options, q.type === 'multi', false);
  } else if (q.type === 'duration') {
    control = guidedInput(c, 'Cantidad', key + '.n', 'number') +
      guidedChoices(c, key + '.unit', ['Horas', 'Días', 'Semanas', 'Meses', 'Años'], false, false);
  } else control = guidedInput(c, 'Respuesta' + (q.unit ? ' · ' + q.unit : ''), key,
    ['date', 'number'].includes(q.type) ? q.type : 'text');
  const template = c.reasons[reason].template || CONSULT.templateFor(c.reasons[reason].key);
  const observation = template.questions.some(x => x.id === q.id + '_free') ? guidedObservation(c, key + '_free') : '';
  return '<div class="guide-inline-question"><b>' + esc(GUIDE.title(q)) + '</b>' + control +
    (q.help ? '<p class="small muted">' + esc(q.help) + '</p>' : '') + observation + '</div>';
}

function guidedReasonGroup(c, s) {
  const r = c.reasons[s.reason], t = r.template || CONSULT.templateFor(r.key);
  const visible = CONSULT.visibleQuestions(t, r.answers, CONSULT.context(pat(c.pid), c))
    .filter(q => !/_free$/.test(q.id));
  const renderChildren = (id, seen = new Set()) => {
    if (seen.has(id)) return '';
    seen.add(id);
    return visible.filter(q => GUIDE.dependencies(q.showIf).includes(id)).map(q =>
      guidedInlineQuestion(c, s.reason, q) + renderChildren(q.id, seen)).join('');
  };
  return s.questions.map(id => {
    const q = visible.find(q => q.id === id);
    return q ? '<div class="guide-clinical-row">' + guidedInlineQuestion(c, s.reason, q) + renderChildren(id) + '</div>' : '';
  }).join('') + (s.type === 'reasonChecklist' ? ccButton('guideNone', 'Ninguno de estos', 'data-reason="' + s.reason + '"', 'primary') +
    '<p class="small muted">Sin marcar = no interrogado. «Ninguno» solo niega los ítems sin responder; conserva sus respuestas.</p>' : '') +
    guidedObservation(c, 'reasons.' + s.reason + '.answers.free');
}

ACTIONS.guideNone = el => {
  const c = guidedCurrent();
  if (!c || !guidedEditable(c)) return;
  if (c.kind === 'evolution') {
    EVOLUTION.symptoms.filter(x => !['Tolera vía oral', 'Diuresis', 'Deposiciones', 'Deambula', 'Descanso'].includes(x))
      .forEach(x => { if (!CONSULT.filled(c.symptoms[x])) c.symptoms[x] = 'ausente'; });
  } else {
    const s = guidedStep(c), r = c.reasons[s.reason];
    if (!r || s.type !== 'reasonChecklist') return;
    s.questions.forEach(id => { if (!CONSULT.filled(r.answers[id])) r.answers[id] = 'No'; });
    ccChanged(c, 'reasons.' + s.reason + '.answers');
  }
  guidedDirty(c);
  guidedRefreshBody(c);
};

function guidedVitalFields(c) {
  return Array.from({ length: Math.max(1, c.vitals.length) }, (_, i) => {
    const v = c.vitals[i] || {}, extra = ['weight', 'height', 'glucose'];
    const field = ([key, label, unit, min, max]) => {
      const invalid = CONSULT.filled(v[key]) && (!Number.isFinite(+v[key]) || +v[key] < min || +v[key] > max);
      return '<div>' + guidedInput(c, label + ' · ' + unit, 'vitals.' + i + '.' + key, 'number',
        'min="' + min + '" max="' + max + '" aria-describedby="guide-vital-' + i + '-' + key + '"') +
        '<p id="guide-vital-' + i + '-' + key + '" class="small allergy" role="status" ' + (invalid ? '' : 'hidden') + '>' +
        (invalid ? esc('Rango permitido: ' + min + '–' + max + ' ' + unit) : '') + '</p></div>';
    };
    return '<section class="guide-measurement"><h2>Medición ' + (i + 1) + '</h2><p class="small muted">' + esc(v.at || 'Hora al registrar') +
      '</p><div class="guide-vital-fields">' + CONSULT.vitals.filter(([k]) => !extra.includes(k)).map(field).join('') + '</div>' +
      '<details ' + (extra.some(k => CONSULT.filled(v[k])) ? 'open' : '') + '><summary>Más (peso, talla, glucemia)</summary>' +
      '<div class="guide-vital-fields">' + CONSULT.vitals.filter(([k]) => extra.includes(k)).map(field).join('') + '</div>' +
      '<p id="cc-bmi-wrap-' + i + '" ' + (CONSULT.bmi(v.weight, v.height) === null ? 'hidden' : '') +
      '>IMC: <span id="cc-bmi-' + i + '">' + (CONSULT.bmi(v.weight, v.height) ?? '') + '</span></p></details>' +
      '<p id="guide-pressure-' + i + '" class="small allergy" hidden></p>' +
      '<div id="cc-vital-error-' + i + '" class="banner warn" hidden></div></section>';
  }).join('') + ccButton('guideVitalMore', 'Agregar otra medición') +
    (c.kind === 'evolution' ? '<details><summary>Ver mediciones previas</summary>' + evolutionReference(c) + '</details>' : '');
}

function guidedRefreshVitalFields(c) {
  c.vitals.forEach((v, i) => {
    CONSULT.vitals.forEach(([key, label, unit, min, max]) => {
      const box = document.getElementById('guide-vital-' + i + '-' + key);
      if (!box) return;
      const invalid = CONSULT.filled(v[key]) && (!Number.isFinite(+v[key]) || +v[key] < min || +v[key] > max);
      box.hidden = !invalid;
      box.textContent = invalid ? 'Rango permitido: ' + min + '–' + max + ' ' + unit : '';
    });
    const box = document.getElementById('guide-pressure-' + i);
    if (box) {
      box.hidden = !(CONSULT.filled(v.sys) && CONSULT.filled(v.dia) && +v.dia >= +v.sys);
      box.textContent = box.hidden ? '' : 'La PAD debe ser menor que la PAS.';
    }
  });
}

function guidedExamGroup(c, s) {
  const suggested = s.regions.length ? s.regions : ['Estado general'];
  const row = region => {
    const e = c.exam[region] || {}, key = 'exam.' + region;
    let detail = '';
    if (e.state === 'normal') detail = ccButton('guideAllNormal', '✓ Todo lo de esta región', 'data-region="' + esc(region) + '"', 'primary') +
      CONSULT.exam[region].split('|').map(item => '<label class="guide-check"><input type="checkbox" data-ch="guideNormalItem" data-region="' +
        esc(region) + '" data-item="' + esc(item) + '" ' + (e.confirmed?.includes(item) ? 'checked' : '') + '> ' + esc(item) + '</label>').join('');
    if (e.state === 'alterado') detail = '<div class="guide-options">' + CONSULT.exam[region].split('|').map(item =>
      ccButton('guideFinding', esc(item), 'data-region="' + esc(region) + '" data-item="' + esc(item) +
        '" aria-pressed="' + CONSULT.filled(e.findings?.[item]) + '"')).join('') + '</div>' + guidedInput(c, 'Observación', key + '.note');
    if (region === 'Exploraciones íntimas' && ['normal', 'alterado'].includes(e.state)) detail +=
      '<p>Consentimiento</p>' + guidedChoices(c, key + '.consent', ['Sí', 'No', 'Desconocido'], false, false) +
      guidedInput(c, 'Acompañante', key + '.chaperone');
    const invalid = GUIDE.init(c).examValidation && e.state === 'normal' && !e.confirmed?.length;
    return '<section class="guide-clinical-row"><h2>' + esc(region) + '</h2>' +
      guidedChoices(c, key + '.state', [['normal', 'Normal'], ['alterado', 'Alterado'], ['no_examinado', 'No examiné']], false, false) +
      (invalid ? '<p class="banner warn" role="alert">Marque qué verificó o pulse «Todo lo de esta región».</p>' : '') + detail + '</section>';
  };
  const rest = Object.keys(CONSULT.exam).filter(r => !suggested.includes(r));
  return suggested.map(row).join('') + (c.mode === 'quick' || c.kind === 'evolution' ?
    '<details><summary>Mostrar más regiones</summary>' + rest.map(row).join('') + '</details>' : rest.map(row).join(''));
}

ACTIONS.guideNormalItem = el => {
  const c = guidedCurrent(), e = c?.exam[el.dataset.region];
  if (!c || !guidedEditable(c) || e?.state !== 'normal') return;
  const items = e.confirmed || [];
  e.confirmed = el.checked ? [...new Set(items.concat(el.dataset.item))] : items.filter(x => x !== el.dataset.item);
  guidedDirty(c);
  guidedRefreshStatus(c);
};

function guidedRosGroup(c) {
  return Object.entries(CONSULT.ros).map(([system, items]) => '<details class="guide-clinical-row"><summary>' + esc(system) + '</summary>' +
    items.split('|').map(item => '<div class="guide-ros-row"><b>' + esc(item) + '</b>' +
      guidedChoices(c, 'ros.' + system + '.' + item, [['presente', 'Presente'], ['ausente', 'Ausente']], false, false) + '</div>').join('') +
    ccButton('guideRosNone', 'Negó el resto de este sistema', 'data-system="' + esc(system) + '"') +
    guidedInput(c, 'Observación', 'rosNotes.' + system) + '</details>').join('');
}

ACTIONS.guideRosNone = el => {
  const c = ccCurrent(), system = el.dataset.system;
  if (!c || !CONSULT.ros[system]) return;
  c.ros[system] ||= {};
  CONSULT.ros[system].split('|').forEach(item => {
    if (!CONSULT.filled(c.ros[system][item])) c.ros[system][item] = 'ausente';
  });
  guidedDirty(c);
  guidedRefreshBody(c);
};

function guidedHistoryGroup(c, group) {
  const value = pat(c.pid).history[group], fields = GUIDE.historyFields[group];
  const row = (item, i) => '<section class="guide-clinical-row">' + fields.map(([key, label, type = 'text', options]) => {
    const field = 'history.' + group + '.' + (Array.isArray(value) ? i + '.' : '') + key;
    return type === 'single' ? '<p>' + esc(label) + '</p>' + guidedChoices(c, field, options, false, false) :
      guidedInput(c, label, field, type);
  }).join('') + '</section>';
  return (Array.isArray(value) ? value.map(row).join('') + ccButton('guideHistoryAdd', 'Agregar registro', 'data-group="' + group + '"') : row(value)) +
    ccButton('guideNext', 'Guardar este grupo y continuar');
}

function guidedAllergiesGroup(c) {
  const h = pat(c.pid).history.allergies, draft = GUIDE.init(c).allergyDraft;
  let body = '<p class="allergy">' + esc(CONSULT.allergyText(pat(c.pid).history)) + '</p>' +
    guidedChoices(c, 'history.allergies.status', [['conocidas', 'Sí, tiene alergias'], ['niega', 'Niega alergias conocidas'], ['desconocido', 'Desconocido / no confirmado']], false, false);
  if (h.status === 'conocidas') body += draft?.stage === 'reaction' ? allergyReaction(draft, true) :
    draft?.stage === 'severity' ? allergySeverity(draft, true) : allergyPicker(draft || {}, true);
  return body;
}

function guidedRxDetails(c, s) {
  return '<div class="guide-vital-fields">' + ['presentation', 'dose', 'unit', 'route', 'freq', 'duration', 'qty', 'notes'].map(key =>
    guidedInput(c, guidedLabels[key], 'rx.' + s.row + '.' + key, key === 'qty' ? 'number' : 'text')).join('') + '</div>';
}

function guidedOrderDetails(c, s) {
  const d = guidedOrderDrafts(c)[s.draft];
  return '<p>Tipo de examen</p><div class="guide-options">' + [['lab', 'Laboratorio'], ['imagen', 'Imagen'], ['otro', 'Otro']].map(([v, label]) =>
    ccButton('guideOrderAnswer', label, 'data-field="category" data-value="' + v + '" aria-pressed="' + (d.category === v) + '"')).join('') +
    '</div><p>Prioridad</p><div class="guide-options">' + ['normal', 'urgente'].map(v => ccButton('guideOrderAnswer', v === 'normal' ? 'Normal' : 'Urgente',
      'data-field="priority" data-value="' + v + '" aria-pressed="' + (d.priority === v) + '"')).join('') +
    '</div><label for="guide-order-note">Indicación</label><input class="input" id="guide-order-note" data-in="guideOrderNote" value="' + esc(d.indication || '') + '">';
}

function guidedPlanGroup(c) {
  const chips = (label, key, options) => '<h2>' + label + '</h2>' + guidedChoices(c, key, options, true, false);
  return chips('Conductas', 'plan.conducts', CONSULT.conducts) + guidedInput(c, 'Otra conducta', 'plan.conductFree') +
    chips('Indicaciones generales', 'plan.instructions', CONSULT.instructions) + guidedInput(c, 'Otras indicaciones', 'plan.instructionFree') +
    guidedInput(c, 'Indicaciones adicionales', 'plan.notes') + chips('Signos de alarma', 'plan.alarmSigns', CONSULT.alarmSigns) +
    guidedInput(c, 'Otros signos de alarma', 'plan.alarmFree') + '<h2>Próximo control</h2><div class="guide-options">' +
    [['7', '1 semana'], ['14', '2 semanas'], ['m1', '1 mes'], ['m3', '3 meses'], ['other', 'Otra fecha']].map(([value, label]) =>
      ccButton('guideControlDate', label, 'data-value="' + value + '"')).join('') + '</div>' +
    guidedInput(c, 'Fecha del control', 'plan.nextControl', 'date') + guidedInput(c, 'Intervalo si aún no hay fecha', 'plan.controlInterval') +
    '<p>Hora acordada</p><div class="guide-options guide-hours">' + Array.from({ length: 10 }, (_, i) => String(i + 8).padStart(2, '0') + ':00').map(h =>
      ccButton('guideApptHour', h, 'data-value="' + h + '" aria-pressed="' + (c.plan.controlTime === h) + '"')).join('') + '</div>' +
    guidedInput(c, 'Otra hora', 'plan.controlTime', 'time') + '<label class="guide-check"><input type="checkbox" data-ch="guideInput" data-path="plan.createAppointment" ' +
    (c.plan.createAppointment ? 'checked' : '') + (c.plan.apptId ? ' disabled' : '') + '> Crear la cita en Agenda</label>' +
    (c.plan.apptId ? '<p class="pill good">Control agendado</p>' : '') +
    (c.plan.conducts.some(x => ['Referencia a especialista', 'Interconsulta'].includes(x)) ? guidedInput(c, '¿A qué especialidad lo refiere?', 'plan.referral') : '');
}

ACTIONS.guideControlDate = el => {
  const c = ccCurrent();
  if (!c) return;
  if (el.dataset.value === 'other') { document.getElementById('cc-plan-nextControl')?.focus(); return; }
  const date = new Date(c.date + 'T12:00:00Z');
  if (el.dataset.value.startsWith('m')) {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + Number(el.dataset.value.slice(1)));
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  } else date.setUTCDate(date.getUTCDate() + Number(el.dataset.value));
  c.plan.nextControl = date.toISOString().slice(0, 10);
  c.plan.controlInterval = '';
  guidedDirty(c);
  guidedRefreshBody(c);
};

function guidedResultsGroup(c) {
  const exams = S.exams.filter(x => x.admId === c.admId && x.pid === c.pid);
  return '<p class="small muted">Solo resultados de este ingreso. Revisar no cambia su estado de realización.</p>' +
    (exams.length ? exams.map(x => '<section class="guide-clinical-row"><h2>' + esc((x.tests || []).join(', ')) + '</h2><p class="freeview">' +
      esc(x.report || 'Resultado textual no documentado') + '</p>' + ccButton('openExam', 'Ver archivos del resultado', 'data-id="' + x.id + '"') +
      guidedChoices(c, 'reviews.' + x.id + '.reviewed', [[true, 'Sí, lo revisé'], [false, 'No']], false, false) +
      guidedInput(c, 'Comentario', 'reviews.' + x.id + '.comment') + '</section>').join('') : '<p>No hay exámenes vinculados.</p>');
}

function guidedEvolutionChecklist(c) {
  return EVOLUTION.symptoms.map(label => '<section class="guide-clinical-row"><h2>' + esc(label) + '</h2>' +
    guidedChoices(c, 'symptoms.' + label, [['presente', 'Sí'], ['ausente', 'No'], ['desconocido', 'Desconocido']], false, false) +
    (c.symptoms[label] === 'presente' ? guidedInput(c, label === 'Dolor' ? 'Intensidad 0–10' : 'Observación', 'symptomNotes.' + label,
      label === 'Dolor' ? 'number' : 'text', label === 'Dolor' ? 'min="0" max="10"' : '') : '') + '</section>').join('') +
    ccButton('guideNone', 'Ninguno de estos síntomas') + '<p class="small muted">Las funciones (vía oral, diuresis, deposiciones, marcha y descanso) se responden por separado.</p>';
}

function guidedDiagnosisUpdates(c) {
  return c.diagnosisUpdates.map((d, i) => '<section class="guide-clinical-row"><h2>' + esc(d.label) + '</h2><p>Evolución del diagnóstico</p>' +
    guidedChoices(c, 'diagnosisUpdates.' + i + '.action', [['mantener', 'Mantener'], ['modificar certeza', 'Modificar certeza'], ['resuelto', 'Resuelto']], false, false) +
    (d.action === 'modificar certeza' ? '<p>Certeza actual</p>' + guidedChoices(c, 'diagnosisUpdates.' + i + '.certainty',
      ['presuntivo', 'confirmado', 'diferencial', 'pendiente de estudio'], false, false) : '') + '</section>').join('');
}

function guidedEvolutionPlan(c) {
  return guidedChoices(c, 'plan.conducts', ['Continuar tratamiento', 'Ajustar tratamiento', 'Solicitar exámenes', 'Interconsulta', 'Preparar alta',
    ...(admArea(admOf(c.admId)) === 'emerg' ? ['Pasar a hospitalización'] : [])], true, false) +
    guidedInput(c, 'Plan del día', 'plan.notes') + guidedIndications(c);
}

ACTIONS.guideNoIndication = el => {
  const c = ccCurrent(), list = el.dataset.list;
  if (!c || !['orders', 'rx'].includes(list)) return;
  if (list === 'orders') {
    if (c.orders.length) { toast('Ya hay solicitudes creadas. Revise o anule cada solicitud antes de indicar que no solicita exámenes.'); return; }
    GUIDE.init(c).orderDrafts = [];
  } else c.rx = [];
  GUIDE.init(c).noIndication ||= {};
  c.guide.noIndication[list] = true;
  guidedDirty(c);
  if (guidedStep(c).type === 'indicationsGroup') {
    if (c.guide.noIndication.orders && c.guide.noIndication.rx) ACTIONS.guideNext();
    else guidedRefreshBody(c);
  } else ACTIONS.guideNext();
};

function guidedQuestionBody(c, s) {
  if (s.type === 'reasonChecklist' || s.type === 'reasonData') return guidedReasonGroup(c, s);
  if (s.type === 'vitalsGroup') return guidedVitalFields(c);
  if (s.type === 'examGroup') return guidedExamGroup(c, s);
  if (s.type === 'rosGroup') return guidedRosGroup(c);
  if (s.type === 'allergiesGroup') return guidedAllergiesGroup(c);
  if (s.type === 'historyGroup') return guidedHistoryGroup(c, s.group);
  if (s.type === 'historySummary') return '<p class="small muted">¿Siguen igual los antecedentes registrados del paciente?</p>' +
    guidedHistoryGroupsFor(c).map(group => '<section><h2>' +
    esc(GUIDE.historyGroups[group]) + '</h2><p>' + esc(guidedHistorySummary(c, group)) + '</p></section>').join('') +
    '<div class="guide-options">' + ccButton('guideHistoryConfirm', 'Sí, siguen igual', '', 'primary') + ccButton('guideHistoryUpdate', 'Actualizar…') + '</div>';
  if (s.type === 'rxDetails') return guidedRxDetails(c, s);
  if (s.type === 'orderDetails') return guidedOrderDetails(c, s);
  if (s.type === 'planGroup') return guidedPlanGroup(c);
  if (s.type === 'resultsGroup') return guidedResultsGroup(c);
  if (s.type === 'evolutionChecklist') return guidedEvolutionChecklist(c);
  if (s.type === 'evolutionPlan') return guidedEvolutionPlan(c);
  if (s.type === 'indicationsGroup') return '<h2>Exámenes</h2>' + guidedQuestionBody(c, { type: 'orderSearch' }) +
    '<h2>Medicamentos</h2>' + guidedQuestionBody(c, { type: 'rxSearch' });
  let body = s.detail ? '<p class="guide-detail">' + esc(s.detail) + '</p>' : '';
  if (['single', 'multi', 'yesno', 'yesnounk', 'scale010'].includes(s.type)) {
    const options = s.type === 'yesno' ? ['Sí', 'No'] : s.type === 'yesnounk' ? ['Sí', 'No', 'Desconocido'] :
      s.type === 'scale010' ? Array.from({ length: 11 }, (_, i) => i) : s.options;
    if (s.type === 'multi' && s.region && /\.confirmed$/.test(s.path || ''))
      body += '<div class="guide-options">' + ccButton('guideAllNormal', '✓ Todo lo de esta región', '', 'primary') + '</div>' +
        '<p class="small muted">O marque solo lo que verificó:</p>';
    body += guidedChoices(c, s.path, options, s.type === 'multi');
  } else if (s.type === 'duration') {
    body += guidedInput(c, 'Cantidad', s.path + '.n', 'number', 'min="0"') +
      '<p class="small muted">Unidad</p>' + guidedChoices(c, s.path + '.unit', ['Minutos', 'Horas', 'Días', 'Semanas', 'Meses', 'Años'], false, false);
  } else if (s.type === 'vital') body += guidedVital(c, s);
  else if (s.type === 'historyConfirm') {
    body += '<p class="guide-detail">' + esc(guidedHistorySummary(c, s.group)) + '</p><div class="guide-options">' +
      ccButton('guideHistoryConfirm', 'Sí, sigue igual', 'data-group="' + s.group + '"') +
      ccButton('guideHistoryUpdate', 'Actualizar', 'data-group="' + s.group + '"') + '</div>';
  } else if (s.type === 'historyAdd') {
    body += '<p>' + esc(guidedHistorySummary(c, s.group)) + '</p><div class="guide-options">' +
      pat(c.pid).history[s.group].map((row, i) => ccButton('guideHistoryEdit', 'Actualizar: ' + esc(row.name || row.drug || row.disease || ('Registro ' + (i + 1))),
        'data-group="' + s.group + '" data-i="' + i + '"')).join('') +
      ccButton('guideHistoryAdd', 'Agregar registro', 'data-group="' + s.group + '"') +
      ccButton('guideGroupDone', 'No, continuar', 'data-group="' + s.group + '"') + '</div>';
  } else if (s.type === 'rosGate') {
    body += '<div class="guide-options">' + ccButton('guideRosGate', 'Sí', 'data-system="' + esc(s.system) + '" data-yes="true"') +
      ccButton('guideRosGate', 'No, omitir', 'data-system="' + esc(s.system) + '" data-yes="false"') + '</div>';
  } else if (s.type === 'rosItems') {
    body += '<div class="guide-ros">' + CONSULT.ros[s.system].split('|').map(item => '<div class="guide-ros-row"><b>' + esc(item) +
      '</b>' + guidedChoices(c, 'ros.' + s.system + '.' + item, [['presente', 'Presente'], ['ausente', 'Ausente']], false, false) + '</div>').join('') +
      '</div><p class="small muted">Los síntomas sin marcar quedan sin documentar.</p>';
  } else if (s.type === 'regions') {
    const selected = c.kind === 'evolution' ? c.selectedRegions : GUIDE.init(c).regions || Object.keys(c.exam);
    body += '<div class="guide-options">' + Object.keys(CONSULT.exam).map(r => ccButton('guideRegionToggle', esc(r),
      'data-region="' + esc(r) + '" aria-pressed="' + selected.includes(r) + '"')).join('') + '</div>';
  } else if (s.type === 'findings') {
    const e = c.exam[s.region] || {};
    body += '<div class="guide-options">' + CONSULT.exam[s.region].split('|').map(item =>
      ccButton('guideFinding', esc(item), 'data-region="' + esc(s.region) + '" data-item="' + esc(item) +
        '" aria-pressed="' + CONSULT.filled(e.findings?.[item]) + '"')).join('') + '</div>';
  } else if (s.type === 'reasonSearch') {
    UI.ccReasonOtherFor = c.id;
    body += guidedSearch('cc-reason-search', 'ccReasonSearch', UI.ccReasonQuery, 'Busque o escriba el motivo',
      consultReasonOptions(c, UI.ccReasonQuery || ''), 'cc-reason-results') +
      '<div class="guide-selected">' + c.reasons.map((r, i) => '<div class="row"><span>' + esc(r.label) + (r.main ? ' · Principal' : '') +
        '</span>' + (r.main ? '' : ccButton('ccReasonMain', 'Principal', 'data-i="' + i + '"')) +
        ccButton('ccRemove', 'Quitar', 'data-list="reasons" data-i="' + i + '"') + '</div>').join('') + '</div>';
  } else if (s.type === 'dxSearch') body += (c.kind === 'evolution' ? guidedDiagnosisUpdates(c) : '') + guidedSearch('cc-dx-search', 'guideDxSearch', UI.ccDxQuery, 'Diagnóstico, sinónimo o CIE-10',
    guidedDxOptions(UI.ccDxQuery || ''), 'cc-dx-results') + guidedSelected(c, 'dx', 'label');
  else if (s.type === 'rxSearch') body += guidedSearch('guide-rx-search', 'guideRxSearch', UI.guideRxQuery, 'Busque o escriba el medicamento',
    guidedRxOptions(UI.guideRxQuery || ''), 'guide-rx-results', 'guide-rx-options') + '<p class="allergy">' + esc(CONSULT.allergyText(pat(c.pid).history)) +
    '</p>' + guidedSelected(c, 'rx', 'drug');
  else if (s.type === 'orderSearch') body += guidedSearch('cc-order-search', 'guideOrderSearch', UI.ccOrderQuery, 'Busque o escriba el examen',
    guidedOrderOptions(UI.ccOrderQuery || ''), 'cc-order-options') + guidedOrderSelections(c);
  else if (s.type === 'orderCategory' || s.type === 'orderPriority') {
    const draft = guidedOrderDrafts(c)[s.draft];
    body += '<div class="guide-options">' +
      (s.type === 'orderCategory' ? [['lab', 'Laboratorio'], ['imagen', 'Imagen'], ['otro', 'Otro']] : [['normal', 'Normal'], ['urgente', 'Urgente']])
        .map(([v, label]) => ccButton('guideOrderAnswer', label, 'data-field="' + (s.type === 'orderCategory' ? 'category' : 'priority') +
          '" data-value="' + v + '" aria-pressed="' + (draft[s.type === 'orderCategory' ? 'category' : 'priority'] === v) + '"')).join('') + '</div>';
  } else if (s.type === 'orderIndication') body += '<label for="guide-order-note">Indicación</label><input class="input" id="guide-order-note" data-in="guideOrderNote" value="' +
    esc(guidedOrderDrafts(c)[s.draft]?.indication || '') + '">';
  else if (s.type === 'another') body += '<div class="guide-options">' +
    ccButton('guideAnother', 'No, continuar', 'data-target="' + s.target + '" data-yes="false"') +
    ccButton('guideAnother', s.target === 'reasons' ? 'Agregar otro' : 'Sí', 'data-target="' + s.target + '" data-yes="true"') + '</div>';
  else if (s.type === 'vitalMore') body += '<div class="guide-options">' +
    ccButton('guideVitalMore', 'No, continuar', 'data-yes="false"') + ccButton('guideVitalMore', 'Agregar otra medición', 'data-yes="true"') + '</div>';
  else if (s.type.startsWith('allergy')) body += guidedAllergyBody(c, s);
  else if (s.type === 'appointment') body += c.plan.apptId ? '<div class="guide-options">' + ccButton('guideAppointment', 'Cita ya creada · continuar', '', 'primary') + '</div>' :
    guidedInput(c, 'Fecha del control', 'plan.nextControl', 'date') +
    '<p class="small muted">Hora del control:</p><div class="guide-options guide-hours">' +
    ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'].map(h =>
      ccButton('guideApptHour', h, 'data-value="' + h + '" aria-pressed="' + (c.plan.controlTime === h) + '"', c.plan.controlTime === h ? 'on' : '')).join('') + '</div>' +
    guidedInput(c, 'Otra hora', 'plan.controlTime', 'time') +
    '<div class="guide-options">' + ccButton('guideAppointment', 'Crear cita de control', '', 'primary') +
    ccButton('guideNext', 'No crear cita, continuar') + '</div>';
  else if (s.type === 'resultsGate') body += '<p class="small muted">Solo verá resultados de este ingreso. Revisar no cambia su estado de realización.</p>' +
    (!S.exams.some(x => x.admId === c.admId && x.pid === c.pid) ? '<p>No hay exámenes vinculados.</p>' : '');
  else if (s.type === 'result') {
    const x = S.exams.find(x => x.id === s.examId && x.admId === c.admId && x.pid === c.pid);
    if (x) body += '<p>' + esc(x.tests.join(', ') + ' · ' + (EX_ST[x.status]?.[0] || x.status)) + '</p><p class="freeview">' +
      esc(x.report || 'Resultado textual no documentado') + '</p>' +
      ccButton('openExam', 'Ver archivos del resultado', 'data-id="' + x.id + '"') +
      guidedChoices(c, 'reviews.' + x.id + '.reviewed', [[true, 'Sí, lo revisé'], [false, 'No']]);
  } else if (s.type === 'indications') body += guidedIndications(c);
  else if (s.type === 'review') body += guidedReview(c);
  else if (s.type === 'report') return c.kind === 'evolution' ? guidedReview(c) + evolutionReport(c) : consultReport(c);
  else body += guidedInput(c, s.unit ? 'Respuesta · ' + s.unit : 'Respuesta', s.path, ['number', 'date', 'time'].includes(s.type) ? s.type : 'text');
  if (s.type === 'orderSearch' || s.type === 'rxSearch') body += ccButton('guideNoIndication',
    s.type === 'orderSearch' ? 'No indica exámenes' : 'No indica medicamentos', 'data-list="' + (s.type === 'orderSearch' ? 'orders' : 'rx') + '" aria-pressed="' +
      !!GUIDE.init(c).noIndication?.[s.type === 'orderSearch' ? 'orders' : 'rx'] + '"', 'primary');
  if (s.key === 'ev-state' && c.initial) body = guidedInput(c, 'Motivo de ingreso', 'admissionReason') + body;
  if (s.reason !== undefined && ['single', 'scale010'].includes(s.type)) {
    const r = c.reasons[s.reason];
    const t = r.template || CONSULT.templateFor(r.key);
    body += CONSULT.visibleQuestions(t, r.answers, CONSULT.context(pat(c.pid), c)).filter(q =>
      !/_free$/.test(q.id) && GUIDE.dependencies(q.showIf).includes(s.id)).map(q => guidedInlineQuestion(c, s.reason, q)).join('');
  }
  if (s.help) body += '<p class="small muted">' + esc(s.help) + '</p>';
  return body + guidedObservation(c, s.observe);
}

function guidedConsultBody(c) {
  return guidedQuestionBody(c, guidedStep(c));
}

function guidedHistory(c, group) {
  const s = guidedSteps(c).find(s => s.group === group);
  return s ? guidedQuestionBody(c, s) : '';
}

const guidedLegacyConsultView = consultView;
consultView = function(c) {
  if (c.status === 'firmada') return guidedLegacyConsultView(c);
  const editable = consultCanEdit(c), g = GUIDE.init(c);
  if (!g.started && (c.reasons.length || c.report.draft || c.vitals.length)) g.started = true;
  if (!g.started) return header('Inicio de consulta', esc(pat(c.pid).name),
    '<button class="btn" data-go="consultas">Volver a Consultas</button>') +
    '<div class="guide-wrap">' + guidedBand(c) + '<section class="card guide-card"><h1>¿Cómo desea documentar la consulta?</h1>' +
    '<fieldset class="cc-editor" ' + (editable ? '' : 'disabled') + '><div class="guide-choices">' +
    '<button class="card" data-act="guideStart" data-mode="quick"><b>Consulta rápida</b><p>Valoración dirigida, control o seguimiento.</p></button>' +
    '<button class="card" data-act="guideStart" data-mode="complete"><b>Consulta completa</b><p>Incluye antecedentes, sistemas y examen por regiones.</p></button>' +
    '</div></fieldset></section></div>';
  return guidedShell(c, 'Consulta ' + (c.mode === 'quick' ? 'rápida' : 'completa'), guidedSteps(c), guidedConsultBody(c), editable);
};

// Enter continúa la respuesta; los buscadores conservan su selección explícita.
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.key !== 'Enter' || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  const target = event.target;
  if (target?.tagName === 'BUTTON' || target?.tagName === 'SELECT' || target?.isContentEditable) return;
  if (target?.dataset?.path === 'report.draft') return;
  if (document.querySelector('.scrim') || document.querySelector('dialog[open]')) return;
  const c = guidedCurrent();
  if (!document.getElementById('guide-body') || !c || !guidedEditable(c)) return;
  if (['reasonSearch', 'dxSearch', 'rxSearch', 'orderSearch', 'allergyPick'].includes(guidedStep(c).type)) return;
  event.preventDefault();
  ACTIONS.guideNext();
});

// ---------- Evolución del ingreso ----------
function evolutionHash(e) {
  return EVOLUTION.hash(e, pat(e.pid), S.exams, S.indications || []);
}

function evolutionDirty(e, preserveOmission = false) {
  if (!preserveOmission) guidedClearOmission(e);
  delete e.report.approvedHash;
  e.report.stale = !!e.report.draft && e.report.sourceHash !== evolutionHash(e);
  e.updatedAt = nowStamp();
  consultSaveStatus('Guardando…');
  clearTimeout(consultSaveTimer);
  consultSaveTimer = setTimeout(() => consultFlush(), 350);
  e.vitals.forEach((v, i) => {
    const bmi = document.getElementById('cc-bmi-' + i);
    if (bmi) bmi.textContent = CONSULT.bmi(v.weight, v.height) ?? '';
    const wrap = document.getElementById('cc-bmi-wrap-' + i);
    if (wrap) wrap.hidden = CONSULT.bmi(v.weight, v.height) === null;
    const box = document.getElementById('cc-vital-error-' + i);
    if (box) {
      const errors = CONSULT.validateVitals(v);
      box.hidden = !errors.length;
      box.textContent = errors.join(' · ');
    }
  });
  const band = document.getElementById('guide-patient');
  if (band) band.innerHTML = guidedBand(e);
  const stale = document.getElementById('ev-stale');
  if (stale) stale.hidden = !e.report.stale;
  guidedRefreshStatus(e);
}

function evolutionCurrent() {
  const e = guidedCurrent();
  return e?.kind === 'evolution' && evolutionEditable(e) ? e : null;
}

function evolutionSurgical(a) {
  return /postoper|cirugía|cirugia|operado/i.test([a.dx, a.reason].join(' ')) ||
    S.hc.some(n => n.admId === a.id && n.type === 'operatoria') ||
    S.appts.some(x => x.admId === a.id && x.kind === 'cirugia') || !!a.surgeryId || S.appts.some(x => x.id === a.apptId && x.kind === 'cirugia');
}

ACTIONS.evNew = el => {
  const a = admOf(el.dataset.id);
  if (!a || a.status !== 'ingresado' || !isClin() || !can('hosp.clinico')) return;
  // Un borrador por autor se retoma; cada nota firmada permite iniciar otra.
  let e = (S.evolutions || []).find(x => x.admId === a.id && x.doc === myDoc() && x.status !== 'firmada');
  if (!e) {
    e = EVOLUTION.create({ id: uid('ev'), admission: a, doc: myDoc(), specialty: med(myDoc())?.esp || '', initial: !hasIngreso(a.id) });
    const previous = S.hc.filter(n => n.admId === a.id && n.status === 'firmada').sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time))[0];
    if (previous?.structured?.kind === 'evolution') {
      const data = previous.structured;
      const active = data.diagnosisUpdates.filter(d => d.action !== 'resuelto').map(d => ({
        label: d.label, action: '', certainty: '',
        baselineCertainty: d.action === 'modificar certeza' ? d.certainty : d.baselineCertainty || ''
      }));
      e.diagnosisUpdates = active.concat(data.dx.map(d => ({ label: d.label, action: '', certainty: '', baselineCertainty: d.certainty || '' })));
    } else {
      const labels = previous?.dx?.length ? previous.dx : a.dx ? [a.dx] : [];
      e.diagnosisUpdates = labels.map(label => ({ label, action: '', certainty: '', baselineCertainty: '' }));
    }
    if (e.initial) e.admissionReason = a.reason || '';
    if (evolutionSurgical(a)) e.selectedRegions.push('Herida quirúrgica');
    S.evolutions ||= [];
    S.evolutions.push(e);
    if (!consultFlush()) { S.evolutions.pop(); return; }
  }
  UI.evolutionId = e.id;
  UI.evRegion = 'Estado general';
  UI.hospTab = 'evoluciones';
  go(areaRoute(a), a.id);
};

ACTIONS.evResume = el => {
  const e = evolutionOf(el.dataset.id);
  if (!evolutionEditable(e)) return;
  UI.evolutionId = e.id;
  UI.evRegion = 'Estado general';
  go(areaRoute(admOf(e.admId)), e.admId);
};

ACTIONS.evBack = () => {
  if (consultSaveTimer) consultFlush();
  UI.evolutionId = null;
  UI.hospTab = 'evoluciones';
  render();
};

// Solo rutas de captura expresamente admitidas; la firma nunca viene de un campo.
function evolutionPathAllowed(key) {
  return /^(admissionReason|state|progressNotes|symptoms\.[^.]+|symptomNotes\.[^.]+|vitals\.\d+\.(at|sys|dia|hr|rr|temp|spo2|weight|height|pain|glucose)|exam\.[^.]+\.(state|consent|chaperone|note|confirmed|findings\.[^.]+)|reviews\.[^.]+\.(reviewed|comment)|diagnosisUpdates\.\d+\.(action|certainty)|dx\.\d+\.(label|priority|certainty)|plan\.(conducts|notes)|report\.draft)$/.test(key);
}

ACTIONS.evInput = el => {
  const e = evolutionCurrent(), key = el.dataset.path;
  if (!e || !evolutionPathAllowed(key)) return;
  if (key.startsWith('reviews.')) {
    const id = key.split('.')[1];
    if (!S.exams.some(x => x.id === id && x.admId === e.admId && x.pid === e.pid)) return;
  }
  const value = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
  ccSet(e, key, value);
  if (key === 'report.draft') e.report.edited = true;
  guidedClearOmission(e);
  evolutionDirty(e);
  if (el.type === 'checkbox' || el.tagName === 'SELECT') guidedRefreshBody(e);
};

ACTIONS.evChip = el => {
  if (!evolutionPathAllowed(el.dataset.path)) return;
  ACTIONS.guideAnswer(el);
};

ACTIONS.evVitalAdd = () => {
  const e = evolutionCurrent();
  if (!e) return;
  e.vitals.push({ at: CONSULT.caracas().date + ' ' + CONSULT.caracas().time });
  guidedClearOmission(e);
  evolutionDirty(e);
  guidedRefreshBody(e);
};

ACTIONS.evRegionToggle = el => {
  const e = evolutionCurrent(), region = el.dataset.region;
  if (!e || !CONSULT.exam[region]) return;
  e.selectedRegions = e.selectedRegions.includes(region) ? e.selectedRegions.filter(x => x !== region) : e.selectedRegions.concat(region);
  UI.evRegion = e.selectedRegions.includes(region) ? region : e.selectedRegions[0];
  guidedClearOmission(e);
  evolutionDirty(e);
  guidedRefreshBody(e);
};
ACTIONS.evRegionOpen = el => {
  const e = evolutionCurrent();
  if (!e || !e.selectedRegions.includes(el.dataset.region)) return;
  UI.evRegion = el.dataset.region;
  guidedRefreshBody(e);
};

ACTIONS.evDxAdd = () => {
  const e = evolutionCurrent();
  if (!e) return;
  e.dx.push({ label: '', priority: e.dx.length ? 'secundario' : 'principal', certainty: 'pendiente de estudio' });
  guidedClearOmission(e);
  evolutionDirty(e);
  guidedRefreshBody(e);
};
ACTIONS.evDxRemove = el => {
  const e = evolutionCurrent();
  if (!e) return;
  e.dx.splice(Number(el.dataset.i), 1);
  evolutionDirty(e);
  guidedRefreshBody(e);
};

ACTIONS.evAddIndication = () => {
  const e = evolutionCurrent();
  if (!e) return;
  consultFlush();
  UI.evIndLink = e.id;
  ACTIONS.indNew({ dataset: { id: e.admId } });
};
const evolutionOriginalIndSave = ACTIONS.indSave;
ACTIONS.indSave = () => {
  const e = evolutionOf(UI.evIndLink);
  const before = new Set((S.indications || []).map(x => x.id));
  if (e && !evolutionEditable(e)) return;
  evolutionOriginalIndSave();
  const added = e && (S.indications || []).filter(x => !before.has(x.id) && x.admId === e.admId && x.doc === e.doc);
  if (added?.length) {
    e.indicationIds.push(...added.map(x => x.id));
    UI.evIndLink = null;
    evolutionDirty(e);
    consultFlush();
    render();
  }
};
ACTIONS.evLinkIndication = el => {
  const e = evolutionCurrent(), id = el.dataset.id;
  if (!e || !(S.indications || []).some(x => x.id === id && x.admId === e.admId)) return;
  e.indicationIds = e.indicationIds.includes(id) ? e.indicationIds.filter(x => x !== id) : e.indicationIds.concat(id);
  evolutionDirty(e);
  guidedRefreshBody(e);
};

function evolutionCapture(html) {
  return html.replaceAll('data-in="ccInput"', 'data-in="evInput"').replaceAll('data-ch="ccInput"', 'data-ch="evInput"')
    .replaceAll('data-act="ccChip"', 'data-act="evChip"').replaceAll('data-act="ccVitalAdd"', 'data-act="evVitalAdd"');
}

function evolutionReference(e) {
  const notes = S.hc.filter(n => n.admId === e.admId && n.status === 'firmada')
    .sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time));
  const previous = notes.find(n => n.structured?.vitals?.length || Object.values(n.vitals || {}).some(CONSULT.filled));
  if (!previous) return '<p class="small muted">No hay signos previos documentados en este ingreso.</p>';
  const rows = previous.structured?.vitals;
  const text = rows ? rows.map(v => (v.at || 'Hora no documentada') + ': ' + CONSULT.vitals.filter(([k]) => CONSULT.filled(v[k]))
    .map(([k, label, unit]) => label + ' ' + v[k] + ' ' + unit).join(' · ')).join('; ') :
    previous.date + ' ' + previous.time + ': ' + Object.entries(previous.vitals).filter(([, v]) => CONSULT.filled(v)).map(([k, v]) => k + ' ' + v).join(' · ');
  return '<div class="banner"><div>Referencia de la última nota firmada: ' + esc(text) +
    '<p class="small muted">Registre mediciones nuevas; los valores previos no se copian.</p></div></div>';
}

function evolutionBody(e) {
  return guidedQuestionBody(e, guidedStep(e));
}

function evolutionView(e) {
  if (!isClin() || !can('hosp.clinico') || e.doc !== myDoc()) return header('Evolución', 'No tiene acceso al borrador.');
  if (e.status === 'firmada') return header('Evolución firmada', 'Solo lectura') + '<div class="card freeview">' + esc(e.report.signedText) + '</div>';
  return guidedShell(e, e.initial ? 'Valoración inicial del ingreso' : 'Nueva evolución', EVOLUTION.steps(e), evolutionBody(e), evolutionEditable(e));
}

function evolutionReport(e) {
  const current = evolutionHash(e), stale = !!e.report.draft && e.report.sourceHash !== current;
  const issues = evolutionIssues(e).filter(x => !/apruebe la nota/.test(x));
  return '<div class="stack">' + (issues.length ? '<div class="banner warn"><b>Antes de firmar falta:</b><ul style="margin:6px 0 0 18px;padding:0">' +
    issues.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '') + '<div id="ev-stale" class="banner warn" ' + (stale ? '' : 'hidden') +
    '>La nota quedó desactualizada. Regenere y revise antes de aprobar.</div>' +
    ccButton('evGenerate', e.report.draft ? 'Regenerar nota' : 'Redactar nota', UI.evGenerating === e.id ? 'disabled' : '', 'primary') +
    '<p class="small muted">Redactada automáticamente a partir de sus respuestas. Revísela y corríjala si hace falta antes de firmar.</p>' +
    ccText('Nota editable', 'report.draft', e.report.draft) + (e.report.candidate ? '<h2>Nuevo borrador para revisar</h2><div class="freeview">' +
      esc(e.report.candidate.text) + '</div><div class="hstack">' + ['use', 'combine', 'keep'].map(action =>
      ccButton('evCandidate', { use: 'Usar nuevo borrador', combine: 'Combinar ambos', keep: 'Conservar mi texto tras revisar' }[action], 'data-choice="' + action + '"')).join('') + '</div>' : '') +
    '<div class="hstack">' + ccButton('evApprove', 'Aprobar borrador', !e.report.draft || stale || e.report.candidate ? 'disabled' : '') +
    ccButton('evSign', 'Firmar evolución', !e.report.approvedHash || e.report.approvedHash !== current ? 'disabled' : '', 'primary') + '</div>' +
    '<p class="small muted">Aprobar no firma. Salir conserva el borrador. La nota firmada solo admite correcciones por adenda.</p></div>';
}

ACTIONS.evGenerate = async () => {
  const e = evolutionCurrent();
  if (!e || UI.evGenerating === e.id) return;
  const id = e.id, user = consultSession(), hash = evolutionHash(e);
  const data = EVOLUTION.clean(e, pat(e.pid), S.exams, S.indications || []);
  const local = EVOLUTION.report(e, pat(e.pid), S.exams, S.indications || []);
  Object.assign(e, CONSULT.receiveReport(e, local, hash, 'plantillas', new Date().toISOString()));
  if (!consultFlush()) { render(); return; }
  render();
  toast('Nota redactada a partir de sus respuestas. Revísela antes de firmar.');
};

ACTIONS.evCandidate = el => {
  const e = evolutionCurrent(), candidate = e?.report.candidate, choice = el.dataset.choice;
  if (!e || !candidate || !['use', 'combine', 'keep'].includes(choice)) return;
  e.report.previousEdits ||= [];
  e.report.previousEdits.push({ text: e.report.draft, at: new Date().toISOString() });
  if (choice === 'use') e.report.draft = candidate.text;
  if (choice === 'combine') e.report.draft += '\n\n--- Borrador nuevo para revisar ---\n\n' + candidate.text;
  Object.assign(e.report, { sourceHash: candidate.sourceHash, source: choice === 'use' ? candidate.source : 'revision_medica',
    candidate: null, edited: choice !== 'use', generatedAt: candidate.generatedAt });
  delete e.report.approvedHash;
  consultFlush();
  render();
};

ACTIONS.evApprove = () => {
  const e = evolutionCurrent();
  if (!e || !e.report.draft.trim() || e.report.candidate || e.report.sourceHash !== evolutionHash(e)) {
    toast('Revise el borrador vigente antes de aprobar.'); return;
  }
  consultTransaction(e, () => { e.report.approvedHash = evolutionHash(e); });
  render();
};

function evolutionIssues(e) {
  const errors = e.vitals.flatMap(CONSULT.validateVitals);
  if (!e.state || e.initial && !e.admissionReason.trim()) errors.push('Complete el estado y el motivo de la valoración inicial.');
  if (!e.dx.some(d => d.label.trim()) && !e.diagnosisUpdates.some(d => d.action)) errors.push('Documente la evolución de un diagnóstico o uno nuevo.');
  if (e.dx.some(d => !d.label.trim() || !d.certainty)) errors.push('Complete o quite los diagnósticos incompletos.');
  if (e.diagnosisUpdates.some(d => d.action === 'modificar certeza' && !d.certainty)) errors.push('Indique la certeza modificada.');
  if (e.symptoms.Dolor === 'presente' && CONSULT.filled(e.symptomNotes.Dolor) &&
    (!Number.isFinite(+e.symptomNotes.Dolor) || +e.symptomNotes.Dolor < 0 || +e.symptomNotes.Dolor > 10)) errors.push('Dolor: indique un valor de 0 a 10.');
  if (e.selectedRegions.some(r => e.exam[r]?.state === 'normal' && !e.exam[r].confirmed?.length)) errors.push('Confirme los ítems normales de las regiones examinadas.');
  const hash = evolutionHash(e);
  if (!e.report.draft.trim() || e.report.candidate || e.report.sourceHash !== hash || e.report.approvedHash !== hash) errors.push('Revise y apruebe la nota vigente antes de firmar.');
  return errors;
}
function evolutionSign(e) {
  if (!evolutionEditable(e)) return false;
  const errors = evolutionIssues(e);
  if (errors.length) { toast(errors.length > 1 ? 'Antes de firmar falta: ' + errors.join(' ') : errors[0]); return false; }
  const hash = evolutionHash(e);
  return consultTransaction(e, () => {
    const clock = CONSULT.caracas(), signedISO = new Date().toISOString();
    e.status = 'firmada';
    e.historySnapshot = CONSULT.clone(pat(e.pid).history);
    e.report.signedAt = signedISO;
    e.report.signedText = e.report.draft;
    e.report.signedBy = e.doc;
    e.report.signedByUser = consultSession();
    e.report.stale = false;
    const last = e.vitals.at(-1) || {};
    const n = { id: uid('hc'), evolutionId: e.id, pid: e.pid, admId: e.admId, doc: e.doc,
      type: admNoteType(e.admId), status: 'firmada', date: clock.date, time: clock.time,
      signedAt: clock.date + ' ' + clock.time, signedISO, timezone: clock.timezone, by: actor(),
      motivo: e.admissionReason || 'Evolución del ingreso', actual: e.report.signedText,
      vitals: { ta: last.sys && last.dia ? last.sys + '/' + last.dia : '', fc: last.hr ?? '', fr: last.rr ?? '',
        temp: last.temp ?? '', sat: last.spo2 ?? '', peso: last.weight ?? '', talla: last.height ?? '' },
      examen: '', dx: e.diagnosisUpdates.filter(d => d.action).map(d => d.label + ' · ' + d.action + (d.certainty ? ' · ' + d.certainty : ''))
        .concat(e.dx.map(CONSULT.diagnosisText)),
      plan: e.plan.notes, indicaciones: '', indicationIds: [...e.indicationIds],
      orders: [], tests: [], recipe: [], addenda: [], reportOnly: true };
    e.noteId = n.id;
    n.structured = CONSULT.clone(e);
    S.hc.unshift(n);
    log('Evolución guiada firmada', e.id + ' · ' + e.admId);
  });
}

ACTIONS.evSign = () => {
  const e = evolutionCurrent();
  if (!e || !evolutionSign(e)) return;
  UI.evolutionId = null;
  UI.hospTab = 'evoluciones';
  render();
  ACTIONS.openNote({ dataset: { id: e.noteId } });
  toast('Evolución firmada y guardada en la historia del paciente.');
};

// Las adendas de evoluciones mantienen el flujo existente y sus permisos clínicos.
const evolutionOriginalAddendum = ACTIONS.addendum;
const evolutionOriginalSaveAddendum = ACTIONS.saveAddendum;
ACTIONS.addendum = el => {
  const n = S.hc.find(x => x.id === el.dataset.id);
  if (n?.evolutionId && !isClin()) { toast('Solo médicos y residentes pueden agregar adendas.'); return; }
  return evolutionOriginalAddendum(el);
};
ACTIONS.saveAddendum = el => {
  const n = S.hc.find(x => x.id === el.dataset.id);
  if (n?.evolutionId && !isClin()) { toast('Solo médicos y residentes pueden agregar adendas.'); return; }
  return evolutionOriginalSaveAddendum(el);
};

ACTIONS.evSymptomOpen = el => {
  const e = evolutionCurrent();
  if (!e || !EVOLUTION.symptoms.includes(el.dataset.symptom)) return;
  UI.evSymptom = el.dataset.symptom;
  guidedRefreshBody(e);
};

// La misma captura rápida sirve en consulta, perfil, pulsera y ficha de ingreso.
function canRecordAllergy() {
  return ['medico', 'residente', 'enfermeria', 'admin'].includes(role());
}
// Si alguien sin permiso toca una alergia, se le explica (antes no pasaba nada y parecía un error)
function allergyDenied() {
  toast('Su usuario no puede registrar alergias. Pídalo a un médico, residente o enfermería.');
  return true;
}

function allergyQuickButton(pid) {
  return canRecordAllergy() ? ccButton('allergyQuick', '+ Alergia', 'data-pid="' + esc(pid) + '"', 'sm') : '';
}

function allergyOptions(query, inline = false) {
  const q = normQ(query || '');
  const catalog = query?.trim() ? [...new Set(CONSULT.frequentAllergies.concat(S.products.map(p => p.name)))] : CONSULT.frequentAllergies;
  return catalog.filter(name => normQ(name).includes(q)).slice(0, 30).map(name => ccButton('allergyPick', esc(name),
    'data-substance="' + esc(name) + '" data-inline="' + inline + '"')).join('') +
    (q ? ccButton('allergyPick', 'Agregar: ' + esc(query), 'data-substance="' + esc(query) + '" data-inline="' + inline + '"') : '');
}

function allergyPicker(draft, inline) {
  return '<label for="allergy-query">Busque un medicamento, alimento u otra sustancia</label><input class="input" id="allergy-query" ' +
    'data-in="allergySearch" data-inline="' + inline + '" value="' + esc(draft.query || '') +
    '" placeholder="Buscar o escribir una alergia" autocomplete="off"><div class="guide-options guide-search-results" id="allergy-options">' +
    allergyOptions(draft.query, inline) + '</div>';
}

function allergyReaction(draft, inline) {
  const options = ['Erupción / ronchas', 'Picazón', 'Hinchazón', 'Dificultad respiratoria', 'Anafilaxia', 'No sabe'];
  return '<p class="guide-detail">' + esc(draft.substance) + '</p><div class="guide-options">' + options.map(value =>
    ccButton('allergyReaction', esc(value), 'data-value="' + esc(value) + '" data-inline="' + inline +
      '" aria-pressed="' + (draft.reaction === value) + '"')).join('') + '</div>' +
    '<label for="allergy-reaction-text">Otra reacción u observación</label><input class="input" id="allergy-reaction-text" data-in="allergyReactionText" ' +
    'data-inline="' + inline + '" value="' + esc(draft.reaction || '') + '">' +
    ccButton('allergyReactionContinue', 'Continuar', 'data-inline="' + inline + '"', 'primary guide-continue');
}

function allergySeverity(draft, inline) {
  return '<p class="guide-detail">' + esc(draft.substance + ' · ' + (draft.reaction || 'Reacción no documentada')) +
    '</p><div class="guide-options">' + [['leve', 'Leve'], ['moderada', 'Moderada'], ['grave', 'Grave'], ['desconocida', 'No sabe']].map(([value, label]) =>
      ccButton('allergySeverity', label, 'data-value="' + value + '" data-inline="' + inline + '"')).join('') +
    '</div><p class="small muted">Alergia referida, sin verificar.</p>';
}

function allergyDraft(inline) {
  if (inline) {
    const c = ccCurrent();
    if (!c) return null;
    return GUIDE.init(c).allergyDraft ||= {};
  }
  return UI.allergyQuick;
}

function allergyRefresh(inline) {
  if (inline) {
    const c = ccCurrent();
    if (!c) return;
    guidedSavePosition(c);
    guidedRenderNavigation();
  } else allergyQuickSheet();
}

function allergyQuickSheet() {
  const d = UI.allergyQuick;
  if (!d || !pat(d.pid) || !canRecordAllergy()) return;
  const titles = { pick: '¿A qué es alérgico?', reaction: '¿Qué reacción tuvo?', severity: '¿Qué tan grave fue la reacción?', more: '¿Desea agregar otra alergia?' };
  const body = d.stage === 'reaction' ? allergyReaction(d, false) : d.stage === 'severity' ? allergySeverity(d, false) :
    d.stage === 'more' ? '<p class="allergy">' + esc(CONSULT.allergyText(pat(d.pid).history)) +
      '</p><div class="guide-options">' + ccButton('allergyQuickMore', 'Agregar otra') + ccButton('allergyQuickDone', 'No, terminar') + '</div>' : allergyPicker(d, false);
  const footer = ccButton('allergyQuickPrevious', '‹ Anterior', d.stage === 'pick' ? 'disabled' : '') +
    ccButton('allergyQuickDone', d.stage === 'more' ? 'Cerrar' : 'Omitir ›');
  openSheet(titles[d.stage] || titles.pick, '<div class="allergy-quick"><p class="small muted">' +
    esc(pat(d.pid).name) + '</p>' + body + '</div>', footer);
  document.getElementById(d.stage === 'pick' ? 'allergy-query' : 'allergy-reaction-text')?.focus({ preventScroll: true });
}

ACTIONS.allergyQuick = el => {
  if (!canRecordAllergy() || !pat(el.dataset.pid)) return;
  // Se conserva un diálogo de origen (por ejemplo, la ficha de ingreso) sin perder sus campos.
  const sheet = document.getElementById('sheetBody');
  const outer = sheet?.closest('.sheet');
  const layer = document.getElementById('layer');
  const origin = outer && layer ? Array.from(layer.childNodes) : null;
  if (origin) {
    origin.forEach(node => node.remove());
    UI.allergyOrigin = origin;
    UI.allergyOriginAfter = sheetAfter;
    UI.allergyOriginFocus = sheetReturnFocus;
  }
  UI.allergyQuick = { pid: el.dataset.pid, stage: 'pick', query: '' };
  allergyQuickSheet();
};

ACTIONS.allergySearch = el => {
  const inline = el.dataset.inline === 'true', d = allergyDraft(inline);
  if (!d || !canRecordAllergy()) return;
  d.query = el.value;
  document.getElementById('allergy-options').innerHTML = allergyOptions(el.value, inline);
  if (inline) guidedSavePosition(ccCurrent());
};

ACTIONS.allergyPick = el => {
  const inline = el.dataset.inline === 'true', d = allergyDraft(inline);
  if (!canRecordAllergy()) { allergyDenied(); return; }
  if (!d || !el.dataset.substance?.trim()) return;
  d.substance = el.dataset.substance.trim();
  d.stage = 'reaction';
  if (inline) ccCurrent().guide.current = 'history-allergies';
  allergyRefresh(inline);
};

ACTIONS.allergyReaction = el => {
  const inline = el.dataset.inline === 'true', d = allergyDraft(inline);
  if (!d || !canRecordAllergy()) return;
  d.reaction = el.dataset.value;
  d.stage = 'severity';
  if (inline) ccCurrent().guide.current = 'history-allergies';
  allergyRefresh(inline);
};

ACTIONS.allergyReactionText = el => {
  const d = allergyDraft(el.dataset.inline === 'true');
  if (d && canRecordAllergy()) d.reaction = el.value;
};

ACTIONS.allergyReactionContinue = el => {
  const inline = el.dataset.inline === 'true', d = allergyDraft(inline);
  if (!d || !canRecordAllergy()) return;
  d.stage = 'severity';
  if (inline) ccCurrent().guide.current = 'history-allergies-severity';
  allergyRefresh(inline);
};

function allergyCommit(pid, draft) {
  if (!canRecordAllergy() || !pat(pid)) return false;
  const backup = CONSULT.clone(S);
  const ok = CONSULT.addAllergy(pat(pid), draft, { role: role(), at: new Date().toISOString(), by: actor() });
  if (!ok) return false;
  log('Alergia referida registrada', pat(pid).code);
  // Invalida borradores afectados; las notas firmadas conservan su instantánea.
  (S.consults || []).filter(c => c.pid === pid && c.status !== 'firmada').forEach(c => {
    delete c.historyConfirmedAt;
    delete c.report.approvedHash;
    c.report.stale = !!c.report.draft;
  });
  (S.evolutions || []).filter(c => c.pid === pid && c.status !== 'firmada').forEach(c => {
    delete c.report.approvedHash;
    c.report.stale = !!c.report.draft;
  });
  if (consultFlush()) return true;
  S = backup;
  syncStaff();
  toast('No se pudo guardar la alergia. Puede reintentarlo.');
  return false;
}

ACTIONS.allergySeverity = el => {
  const inline = el.dataset.inline === 'true', d = allergyDraft(inline);
  const c = inline ? ccCurrent() : null, pid = c?.pid || d?.pid;
  if (!d || !canRecordAllergy()) return;
  d.severity = el.dataset.value;
  if (!allergyCommit(pid, d)) return;
  if (inline) {
    delete c.guide.allergyDraft;
    c.guide.current = 'history-allergies';
  } else Object.assign(d, { stage: 'more', substance: '', reaction: '', query: '' });
  allergyRefresh(inline);
};

ACTIONS.allergyQuickMore = () => {
  if (!UI.allergyQuick || !canRecordAllergy()) return;
  UI.allergyQuick.stage = 'pick';
  allergyQuickSheet();
};

ACTIONS.allergyQuickPrevious = () => {
  const d = UI.allergyQuick;
  if (!d || !canRecordAllergy()) return;
  d.stage = { reaction: 'pick', severity: 'reaction', more: 'pick' }[d.stage] || 'pick';
  allergyQuickSheet();
};

ACTIONS.allergyQuickDone = () => {
  closeSheet();
  render();
};

function guidedAllergyBody(c, s) {
  const d = GUIDE.init(c).allergyDraft || {};
  if (s.type === 'allergyPick') return allergyPicker(d, true) +
    '<p class="small allergy">' + esc(CONSULT.allergyText(pat(c.pid).history)) + '</p>';
  if (s.type === 'allergyReaction') return allergyReaction(d, true);
  if (s.type === 'allergySeverity') return allergySeverity(d, true);
  return '<div class="guide-options">' + ccButton('guideAllergyMore', 'No, continuar', 'data-yes="false"') +
    ccButton('guideAllergyMore', 'Agregar otra', 'data-yes="true"') + '</div>';
}

ACTIONS.guideAllergyMore = el => {
  const c = ccCurrent();
  if (!c) return;
  if (el.dataset.yes === 'true') guidedGo(c, 'history-allergies-add');
  else ACTIONS.guideNext();
};

function guidedSelected(c, list, label) {
  return '<div class="guide-selected">' + c[list].map((r, i) => '<section class="guide-clinical-row"><div class="row"><b class="grow">' + esc(r[label]) +
    (list === 'dx' && r.priority === 'principal' ? ' · Principal' : '') + '</b>' +
    (list === 'dx' && r.priority !== 'principal' ? ccButton('guideDxMain', 'Principal', 'data-i="' + i + '"') : '') +
    (list === 'rx' ? ccButton('guideEditRow', 'Cambiar', 'data-list="rx" data-i="' + i + '"') : '') +
    ccButton('guideRemoveRow', 'Quitar', 'data-list="' + list + '" data-i="' + i + '"') + '</div>' +
    (list === 'dx' ? '<p>Certeza</p>' + guidedChoices(c, 'dx.' + i + '.certainty', [['presuntivo', 'Presuntivo'], ['confirmado', 'Confirmado']], false, false) +
      ccSelect('Otra certeza', 'dx.' + i + '.certainty', r.certainty, [['diferencial', 'Diferencial'], ['pendiente de estudio', 'Pendiente de estudio']]) : '') + '</section>').join('') + '</div>';
}

ACTIONS.guideEditRow = el => {
  const c = guidedCurrent(), list = el.dataset.list, i = Number(el.dataset.i);
  if (!c || !guidedEditable(c) || !['dx', 'rx'].includes(list) || !c[list][i]) return;
  guidedGo(c, list === 'dx' ? 'dx' : list + '-' + i);
};

function guidedEnsureDxMain(c) {
  if (c.dx.length && !c.dx.some(d => d.priority === 'principal')) c.dx[0].priority = 'principal';
}

function guidedSaveSelection(c, resultsId) {
  const scrollTop = document.getElementById(resultsId)?.scrollTop || 0;
  guidedDirty(c);
  guidedSavePosition(c);
  guidedRenderNavigation();
  const results = document.getElementById(resultsId);
  if (results) results.scrollTop = scrollTop;
}

ACTIONS.guideRemoveRow = el => {
  const c = guidedCurrent(), list = el.dataset.list, i = Number(el.dataset.i);
  if (!c || !guidedEditable(c) || !['dx', 'rx'].includes(list) || !c[list][i]) return;
  c[list].splice(i, 1);
  if (list === 'dx') guidedEnsureDxMain(c);
  guidedSaveSelection(c, list === 'dx' ? 'cc-dx-results' : 'guide-rx-results');
};

ACTIONS.guideDxMain = el => {
  const c = guidedCurrent(), i = Number(el.dataset.i);
  if (!c || !guidedEditable(c) || !c.dx[i]) return;
  c.dx.forEach((d, index) => { d.priority = index === i ? 'principal' : 'secundario'; });
  guidedSaveSelection(c, 'cc-dx-results');
};

function guidedDxIndex(c, dx) {
  return c.dx.findIndex(d => dx.code && d.code === dx.code || normQ(d.label).trim() === normQ(dx.label).trim());
}

function guidedDxOptions(query) {
  const c = guidedCurrent(), q = normQ(query || '').trim();
  // Sin búsqueda: arriba lo que coincide con el motivo de consulta y lo que el paciente ya tenía diagnosticado
  const reasonWords = c ? c.reasons.map(r => normQ(r.label)) : [];
  const previous = c ? (S.consults || []).filter(x => x.pid === c.pid && x.id !== c.id && x.status === 'firmada').flatMap(x => x.dx || []).map(d => normQ(d.label)) : [];
  const rank = d => { const t = normQ([d.label, ...(d.synonyms || [])].join(' '));
    return reasonWords.some(w => w && (t.includes(w) || w.includes(normQ(d.label)))) ? 0 : previous.includes(normQ(d.label)) ? 1 : 2; };
  return CONSULT.diagnoses.map((d, i) => ({ d, i }))
    .filter(({ d }) => normQ([d.label, d.code, ...(d.synonyms || [])].join(' ')).includes(q))
    .sort((a, b) => q ? 0 : rank(a.d) - rank(b.d))
    .slice(0, q ? 25 : 15).map(({ d, i }) => {
      const on = !!c && guidedDxIndex(c, d) >= 0;
      return ccButton('guideDxPick', (on ? '✓ ' : '') + esc(d.label) + (d.code ? ' · ' + esc(d.code) : ''),
        'data-i="' + i + '" aria-pressed="' + on + '"', on ? 'on' : '');
    }).join('') + (q ? ccButton('guideDxFree', 'Agregar texto libre: ' + esc(query.trim()),
      'aria-pressed="' + (!!c && guidedDxIndex(c, { label: query.trim() }) >= 0) + '"',
      c && guidedDxIndex(c, { label: query.trim() }) >= 0 ? 'on' : '') : '');
}

ACTIONS.guideDxSearch = el => {
  if (!guidedEditable(guidedCurrent())) return;
  UI.ccDxQuery = el.value;
  document.getElementById('cc-dx-results').innerHTML = guidedDxOptions(el.value);
};

function guidedAddDx(dx) {
  const c = guidedCurrent();
  if (!c || !guidedEditable(c)) return;
  const i = guidedDxIndex(c, dx);
  if (i >= 0) {
    c.dx.splice(i, 1);
    guidedEnsureDxMain(c);
  } else {
    const { synonyms, ...data } = dx;
    c.dx.push({ ...data, priority: c.dx.some(d => d.priority === 'principal') ? 'secundario' : 'principal',
      certainty: '' });
  }
  guidedSaveSelection(c, 'cc-dx-results');
}

ACTIONS.guideDxPick = el => {
  const d = CONSULT.diagnoses[Number(el.dataset.i)];
  if (d) guidedAddDx(d);
};
ACTIONS.guideDxFree = () => {
  if (UI.ccDxQuery?.trim()) guidedAddDx({ label: UI.ccDxQuery.trim() });
};

function guidedRxIndex(c, drug, productId) {
  return c.rx.findIndex(r => productId && r.productId === productId || normQ(r.drug).trim() === normQ(drug).trim());
}

// Coincidencias de palabras registradas; no se infieren familias ni interacciones.
function guidedRxAllergies(c, drug) {
  const allergies = pat(c.pid)?.history?.allergies;
  if (allergies?.status !== 'conocidas') return [];
  const ignored = new Set(['mg', 'ml', 'mcg', 'ui', 'de', 'con', 'solucion', 'tableta', 'tabletas',
    'capsula', 'capsulas', 'ampolla', 'ampollas', 'comprimido', 'comprimidos']);
  const words = text => normQ(text).match(/[a-z]+/g) || [];
  const names = words(drug).filter(word => word.length > 1 && !ignored.has(word));
  return (allergies.items || []).filter(a => words(a.substance).some(word => names.includes(word)))
    .map(a => a.substance);
}

function guidedRxButton(c, drug, attrs, label = drug, productId) {
  const on = !!c && guidedRxIndex(c, drug, productId) >= 0;
  const allergy = !!c && guidedRxAllergies(c, drug).length > 0;
  return ccButton('guideRxPick', (on ? '✓ ' : '') + esc(label) +
    (allergy ? '<span class="guide-rx-allergy-label">⚠ Alergia registrada</span>' : ''),
    attrs + ' aria-pressed="' + on + '"', [on ? 'on' : '', allergy ? 'guide-rx-allergy' : ''].filter(Boolean).join(' '));
}

function guidedRxOptions(query) {
  const c = guidedCurrent(), q = normQ(query || '').trim();
  return S.products.filter(p => normQ(p.cat) === 'medicamento' && normQ(p.name).includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })).slice(0, 40)
    .map(p => guidedRxButton(c, p.name, 'data-id="' + esc(p.id) + '"', p.name, p.id)).join('') +
    (q ? guidedRxButton(c, query.trim(), 'data-label="' + esc(query.trim()) + '"', 'Indicar: ' + query.trim()) : '');
}
ACTIONS.guideRxSearch = el => {
  if (!ccCurrent()) return;
  UI.guideRxQuery = el.value;
  document.getElementById('guide-rx-results').innerHTML = guidedRxOptions(el.value);
};
ACTIONS.guideRxPick = el => {
  const c = ccCurrent(), p = S.products.find(p => p.id === el.dataset.id);
  const drug = (p?.name || el.dataset.label || '').trim();
  if (!c || !drug || p && normQ(p.cat) !== 'medicamento') return;
  const i = guidedRxIndex(c, drug, p?.id);
  if (i >= 0) c.rx.splice(i, 1);
  else {
    const allergies = guidedRxAllergies(c, drug);
    if (allergies.length && !window.confirm('⚠ Alergia registrada: ' + allergies.join(', ') +
      '. ¿Desea indicar ' + drug + ' de todas formas?')) return;
    delete GUIDE.init(c).noIndication?.rx;
    c.rx.push({ drug, ...(p ? { productId: p.id } : {}), status: 'prescrito', documentStatus: 'borrador' });
  }
  guidedSaveSelection(c, 'guide-rx-results');
};

// Exámenes: se pueden marcar varios a la vez (se marcan/desmarcan) y luego "Continuar"
function guidedOrderOptions(query) {
  const c = ccCurrent();
  const chosen = new Set((c ? guidedOrderDrafts(c) : []).filter(Boolean).map(d => d.label));
  const opts = labTestNames().map(label => ({ label, category: 'lab' })).concat(IMG_TESTS.map(label => ({ label, category: 'imagen' })));
  const q = normQ(query || '');
  return opts.filter(o => normQ(o.label).includes(q)).slice(0, q ? 40 : 24).map(o => {
    const on = chosen.has(o.label);
    return ccButton('guideOrderPick', (on ? '✓ ' : '') + esc(o.label),
      'data-label="' + esc(o.label) + '" data-category="' + o.category + '" aria-pressed="' + on + '"', on ? 'on' : '');
  }).join('') +
    (query?.trim() && !chosen.has(query.trim()) ? ccButton('guideOrderPick', 'Solicitar: ' + esc(query), 'data-label="' + esc(query.trim()) + '" data-category="otro"') : '');
}
ACTIONS.guideOrderSearch = el => {
  if (!ccCurrent()) return;
  UI.ccOrderQuery = el.value;
  document.getElementById('cc-order-options').innerHTML = guidedOrderOptions(el.value);
};
function guidedOrderSelections(c) {
  return '<p>' + esc(c.orders.map(x => x.label + ' · solicitado').join('; ')) + '</p>' +
    '<div class="guide-selected">' + guidedOrderDrafts(c).map((draft, i) => draft ?
      '<div class="row"><span class="grow">' + esc(draft.label) +
      ' · por completar, aún sin solicitar</span>' +
      ccButton('guideOrderDiscard', 'Quitar selección', 'data-i="' + i + '"') + '</div>' : '').join('') + '</div>';
}

ACTIONS.guideOrderDiscard = el => {
  const c = ccCurrent();
  if (!c || !guidedOrderDrafts(c)[Number(el.dataset.i)]) return;
  guidedOrderDrafts(c)[Number(el.dataset.i)] = null;
  guidedSavePosition(c);
  guidedRenderNavigation();
};

function guidedOrderDrafts(c) {
  const g = GUIDE.init(c);
  g.orderDrafts ||= g.orderDraft ? [g.orderDraft] : [];
  delete g.orderDraft;
  return g.orderDrafts;
}

ACTIONS.guideOrderPick = el => {
  const c = ccCurrent();
  if (!c || !can('examen.pedir') || !el.dataset.label) return;
  const drafts = guidedOrderDrafts(c);
  const i = drafts.findIndex(d => d && d.label === el.dataset.label);
  // Tocar otra vez el mismo examen lo desmarca; la persona elige varios y luego pulsa "Continuar"
  // Desmarcar el último se quita del todo; en medio queda un hueco para no mover las preguntas ya respondidas
  if (i >= 0) {
    if (i === drafts.length - 1) {
      drafts.pop();
      while (drafts.length && !drafts.at(-1)) drafts.pop();
    } else drafts[i] = null;
  }
  else { delete GUIDE.init(c).noIndication?.orders; drafts.push({ label: el.dataset.label, category: el.dataset.category, priority: 'normal', indication: '' }); }
  guidedSavePosition(c);
  guidedRenderNavigation();
};

ACTIONS.guideOrderAnswer = el => {
  const c = ccCurrent(), s = c && guidedStep(c);
  const d = c && guidedOrderDrafts(c)[s.draft];
  if (!d || !['category', 'priority'].includes(el.dataset.field)) return;
  d[el.dataset.field] = el.dataset.value;
  guidedSavePosition(c);
  guidedRefreshBody(c);
};

ACTIONS.guideOrderNote = el => {
  const c = ccCurrent(), s = c && guidedStep(c);
  const d = c && guidedOrderDrafts(c)[s.draft];
  if (!d) return;
  d.indication = el.value;
  guidedSavePosition(c);
};

function guidedCommitOrder(c) {
  if (!ccCurrent() || !can('examen.pedir')) return;
  const list = guidedSteps(c), s = guidedStep(c);
  const candidates = list.slice(GUIDE.current(c, list) + 1).map(q => q.key);
  const drafts = guidedOrderDrafts(c), draft = drafts[s.draft];
  if (!draft?.label?.trim()) return;
  // La solicitud y la salida de la cola se guardan en una sola transacción.
  if (!consultAddOrder(c, draft, () => { drafts[s.draft] = null; })) return;
  UI.ccOrderQuery = '';
  const next = guidedSteps(c);
  guidedGo(c, candidates.find(key => next.some(q => q.key === key)) || 'rx');
}


const guidedReasonAdd = ACTIONS.ccReasonAdd;
ACTIONS.ccReasonAdd = el => {
  const c = ccCurrent(), count = c?.reasons.length;
  guidedReasonAdd(el);
  if (c && c.reasons.length > count) {
    UI.ccReasonQuery = '';
    GUIDE.inferContext(c);
    guidedRefreshBody(c);
  }
};
const guidedReasonFree = ACTIONS.ccReasonFree;
ACTIONS.ccReasonFree = () => {
  const c = ccCurrent(), count = c?.reasons.length;
  guidedReasonFree();
  if (c && c.reasons.length > count) {
    UI.ccReasonQuery = '';
    guidedGo(c, 'reasons-more');
  }
};

function guidedIndications(c) {
  return '<div class="guide-options">' + (S.indications || []).filter(x => x.admId === c.admId).map(x =>
    ccButton('evLinkIndication', esc([x.med, x.dose, x.freq, x.status].filter(Boolean).join(' · ')),
      'data-id="' + x.id + '" aria-pressed="' + c.indicationIds.includes(x.id) + '"')).join('') + '</div>' +
    ccButton('evAddIndication', 'Agregar indicación') + ccButton('newExam', 'Solicitar examen', 'data-pid="' + c.pid + '" data-adm="' + c.admId + '"');
}

function guidedReview(c) {
  const evolution = c.kind === 'evolution';
  const sections = evolution ? [
    ['Estado del paciente', 'ev-state', [c.admissionReason, c.state, c.progressNotes].filter(Boolean).join(' · ')],
    ['Síntomas', 'ev-symptoms', guidedDisplay(c.symptoms) + ' ' + guidedDisplay(c.symptomNotes)],
    ['Resultados revisados', 'ev-results', guidedDisplay(c.reviews)],
    ['Diagnósticos del ingreso', 'dx', guidedDisplay(c.diagnosisUpdates) + ' ' + c.dx.map(CONSULT.diagnosisText).join('; ')],
    ['Plan del día', 'ev-plan', guidedDisplay(c.plan) + ' ' + guidedDisplay(c.indicationIds)]
  ] : [
    ['Motivo', 'reasons', c.reasons.map(r => r.label + (r.main ? ' · Principal' : '')).join('; ')],
    ...c.reasons.map((r, i) => [r.label, guidedSteps(c).find(s => s.reason === i)?.key || 'reasons',
      CONSULT.clean(c, pat(c.pid)).reasons[i]?.answers.map(a => a.label + ': ' + guidedDisplay(a.value)).join('; ')]),
    ['Antecedentes del paciente', 'history', Object.keys(GUIDE.historyGroups).map(k => GUIDE.historyGroups[k] + ': ' + guidedHistorySummary(c, k)).join('; ')],
    ...(c.mode === 'complete' ? [['Revisión por sistemas', 'ros', guidedDisplay(c.ros)]] : []),
    ['Diagnóstico', 'dx', c.dx.map(CONSULT.diagnosisText).join('; ')],
    ['Exámenes', c.mode === 'quick' ? 'indications' : 'orders', c.orders.map(o => o.label + ' · solicitado').concat(
      guidedOrderDrafts(c).filter(Boolean).map(o => o.label + ' · por completar')).join('; ') || (c.guide.noIndication?.orders ? 'No indica exámenes' : '')],
    ['Medicamentos', c.mode === 'quick' ? 'indications' : 'rx', guidedDisplay(c.rx) || (c.guide.noIndication?.rx ? 'No indica medicamentos' : '')],
    ['Plan y seguimiento', 'plan', guidedDisplay(c.plan)]
  ];
  sections.splice(evolution ? 2 : sections.length - 3, 0,
    ['Signos vitales', 'vitals', guidedDisplay(c.vitals)], ['Examen físico', 'exam', guidedDisplay(c.exam)]);
  const context = evolution ? '' : '<section class="guide-review-section"><h2>Contexto</h2><div class="guide-context-selects">' +
    ccSelect('Tipo de consulta', 'type', c.type, Object.entries(CONSULT.types)) +
    ccSelect('Modalidad', 'modality', c.modality, Object.entries(CONSULT.modes)) +
    (can('consulta.asignar') ? ccSelect('Médico', 'doc', c.doc, MEDICOS.filter(d => d.active !== false).map(d => [d.id, d.name])) : '') + '</div></section>';
  return (evolution ? '' : consultAlerts(c)) + context + sections.map(([label, key, value]) =>
    '<section class="guide-review-section"><div class="between"><h2>' + esc(label) + '</h2>' +
    ccButton('guideJump', 'Cambiar', 'data-key="' + esc(key) + '"') + '</div><p class="freeview">' + esc(value || 'No documentado') + '</p></section>').join('');
}

// Registrar datos reabre la pregunta omitida; navegar no invalida la aprobación.
const guidedOriginalDirty = consultDirty;
consultDirty = function(c, preserveOmission = false) {
  if (!preserveOmission && ccCurrent()?.id === c.id) guidedClearOmission(c);
  guidedOriginalDirty(c);
  if (guidedCurrent()?.id === c.id) guidedRefreshStatus(c);
  c.vitals.forEach((v, i) => {
    const wrap = document.getElementById('cc-bmi-wrap-' + i);
    if (wrap) wrap.hidden = CONSULT.bmi(v.weight, v.height) === null;
  });
};

// Nueva consulta conserva el panel y abre solo la elección inicial.
ACTIONS.ccNewMenu = () => {
  if (!consultClinical() || !can('consulta.crear')) return;
  openSheet('Nueva consulta', '<div class="guide-options">' +
    ccButton('ccNewSearch', 'Buscar paciente') + (can('consulta.registrar') ? ccButton('ccNewRegister', 'Registrar paciente nuevo') : '') +
    '</div>', ccButton('close', 'Cerrar'));
};
ACTIONS.ccNewSearch = () => {
  if (!consultClinical() || !can('consulta.crear')) return;
  openSheet('Buscar paciente', '<div class="allergy-quick">' + guidedSearch('cc-menu-patient-query', 'ccMenuPatientSearch', '',
    'Cédula, nombre, teléfono o QRN', consultPatientResults(''), 'cc-menu-patient-results') + '</div>', ccButton('ccNewMenu', '‹ Volver'));
  document.getElementById('cc-menu-patient-query')?.focus();
};
ACTIONS.ccMenuPatientSearch = el => {
  if (!consultClinical()) return;
  document.getElementById('cc-menu-patient-results').innerHTML = consultPatientResults(el.value);
};
ACTIONS.ccNewRegister = () => {
  if (!consultClinical() || !can('consulta.registrar')) return;
  UI.ccNewOpen = true;
  openSheet('Registrar paciente nuevo', consultNewPatient(), ccButton('ccNewMenu', '‹ Volver'));
  document.getElementById('cc-new-givenNames')?.focus();
};

// "Otro motivo": abre un campo junto a la opción para escribir el motivo a mano
ACTIONS.ccReasonOther = () => {
  UI.ccReasonOther = true;
  const box = document.getElementById('cc-reason-results');
  const c = ccCurrent();
  if (box && c) box.innerHTML = consultReasonOptions(c, UI.ccReasonQuery || '');
  document.getElementById('cc-reason-other')?.focus();
};
ACTIONS.ccReasonOtherAdd = () => {
  const input = document.getElementById('cc-reason-other');
  const text = input?.value.trim();
  if (!text) { toast('Escriba el motivo de consulta.'); input?.focus(); return; }
  UI.ccReasonOther = false;
  UI.ccReasonQuery = text;
  ACTIONS.ccReasonFree();
};
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'cc-reason-other') { e.preventDefault(); ACTIONS.ccReasonOtherAdd(); }
});

// "Continuar" siempre a la vista: si aparece dentro de la tarjeta (muchas opciones la empujaban fuera de la pantalla),
// se traslada a la barra fija inferior, entre "Anterior" y "Omitir". Los botones funcionan igual (delegación data-act).
(() => {
  const dock = () => {
    const footer = document.querySelector('#main .guide-footer');
    if (!footer) return;
    const inCard = [...document.querySelectorAll('#main .guide-card .guide-continue')];
    if (!inCard.length) return;
    footer.querySelectorAll('.guide-continue').forEach(b => b.remove());
    const btn = inCard.at(-1);
    inCard.slice(0, -1).forEach(b => b.remove());
    const next = footer.querySelector('[data-act="guideSkip"], [data-act="guideOmit"]') || footer.lastElementChild;
    footer.insertBefore(btn, next);
  };
  const main = document.getElementById('main');
  if (main && typeof MutationObserver === 'function') new MutationObserver(dock).observe(main, { childList: true, subtree: true });
})();

// Hora rápida para la cita de control
ACTIONS.guideApptHour = el => {
  const c = ccCurrent();
  if (!c || !/^\d{2}:\d{2}$/.test(el.dataset.value || '')) return;
  c.plan.controlTime = el.dataset.value;
  consultDirty(c);
  guidedRefreshBody(c);
};
// Marca todo lo de la región como verificado normal (lo decide el médico con un toque) y sigue
ACTIONS.guideAllNormal = el => {
  const c = guidedCurrent(), region = el?.dataset?.region || guidedStep(c)?.region;
  if (!c || !guidedEditable(c) || c.exam[region]?.state !== 'normal') return;
  c.exam[region].confirmed = CONSULT.exam[region].split('|');
  guidedDirty(c);
  guidedRefreshBody(c);
};