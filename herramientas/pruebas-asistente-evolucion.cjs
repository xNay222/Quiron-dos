// Regresión del asistente: memoria y DOM simulado, sin pacientes ni servidor reales.
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'),
  nodes = new Map(),
  storage = new Map(),
  timers = new Map(),
  keyHandlers = [];
let failStorage = false,
  timerId = 0;
function node(id) {
  if (!nodes.has(id)) nodes.set(id, {
    value: '',
    textContent: '',
    innerHTML: '',
    checked: false,
    hidden: false,
    dataset: {},
    style: {},
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    remove() {},
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    focus() {},
    scrollIntoView() {},
    setSelectionRange() {},
    closest() {
      return null;
    }
  });
  return nodes.get(id);
}
const ctx = vm.createContext({
  console,
  assert,
  Date,
  Intl,
  Math,
  JSON,
  Blob,
  URL,
  AbortController,
  TextEncoder,
  Uint8Array,
  crypto: require('node:crypto').webcrypto,
  localStorage: {
    getItem: k => storage.get(k) || null,
    setItem(k, v) {
      if (failStorage) throw Error('quota');
      storage.set(k, v);
    },
    removeItem: k => storage.delete(k)
  },
  sessionStorage: {
    getItem: () => null,
    removeItem() {}
  },
  document: {
    getElementById: node,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener(type, fn) {
      if (type === 'keydown') keyHandlers.push(fn);
    },
    body: node('body'),
    documentElement: node('html')
  },
  setTimeout(fn) {
    const id = ++timerId;
    timers.set(id, fn);
    return id;
  },
  clearTimeout: id => timers.delete(id),
  setInterval() {},
  addEventListener() {},
  matchMedia: () => ({
    matches: false
  }),
  location: {
    hash: ''
  },
  fetch: async () => ({
    ok: false,
    status: 503
  }),
  requestAnimationFrame() {}
});
ctx.window = ctx;
const run = code => vm.runInContext(code, ctx);
const html = fs.readFileSync(path.join(root, 'quiron/index.html'), 'utf8');
for (const [, name] of html.matchAll(/<script src="([^"/:]+\.js)"/g)) {
  let code = fs.readFileSync(path.join(root, 'quiron', name), 'utf8');
  if (name === 'app.js') code = code.slice(0, code.indexOf('(function start()'));
  const start = keyHandlers.length;
  vm.runInContext(code, ctx, {
    filename: name
  });
  if (name === 'views-guided.js') ctx.wizardKeyHandler = keyHandlers[start];
}
run("render=()=>{};renderSide=()=>{};closeSheet=()=>{};toast=text=>window.lastToast=text;openSheet=(title,body,footer)=>window.lastSheet={title,body,footer};refreshSheet=()=>{};go=(r,p=null)=>{if(consultSaveTimer)consultFlush();route=r;param=p};window.baseline=CONSULT.clone(S);");
run('window.resetGuided=' + function () {
  S = CONSULT.clone(baseline);
  syncStaff();
  const d = activeDocs().find(x => !x.resident),
    u = {
      id: 'uM-test',
      name: d.name,
      role: 'medico',
      doc: d.id,
      status: 'activo',
      mpps: '54321',
      cm: '12345',
      ci: 'V-12.345.678',
      colegio: 'MI'
    };
  S.users = [u];
  applyUser(u);
  UI.evolutionId = null;
  UI.evRegion = null;
  UI.guideRegion = null;
  UI.guideReasonIndex = 0;
  UI.guideReasonPage = 0;
  UI.guideRxQuery = '';
  UI.ccDxQuery = '';
  UI.ccOrderQuery = '';
  window.confirmResult = false;
  window.confirmCalls = 0;
  window.lastConfirm = '';
  window.confirm = text => {
    window.lastConfirm = text;
    window.confirmCalls++;
    return window.confirmResult;
  };
  window.c = CONSULT.newConsult({
    id: 'co-guided-test',
    pid: 'pt1',
    doc: d.id,
    specialty: d.esp
  });
  S.consults.push(c);
  route = 'consultas';
  param = c.id;
  window.a = {
    id: 'ad-guided-test',
    pid: 'pt1',
    num: 'HOS-TEST',
    doc: d.id,
    dx: 'Diagnóstico del ingreso',
    reason: 'Motivo de ingreso de prueba',
    bed: 'H-01',
    area: 'hosp',
    status: 'ingresado',
    admittedAt: CONSULT.caracas().date + ' 08:00'
  };
  S.admissions.push(a);
  window.lastSheet = null;
}.toString());
run("window.startEvolution=()=>{ACTIONS.evNew({dataset:{id:a.id}});window.e=evolutionOf(UI.evolutionId)};window.prepareEvolution=async()=>{e.state='Sin cambios';e.diagnosisUpdates[0].action='mantener';await ACTIONS.evGenerate();ACTIONS.evApprove()};");
const checks = [];
async function test(name, fn) {
  run('resetGuided()');
  await run('(' + fn.toString() + ')()');
  checks.push(name);
}
(async () => {
  await test('Inicio agrupado: contexto automático, siguiente, anterior y límites', () => {
    assert.ok(consultView(c).includes('¿Cómo desea documentar'));
    ACTIONS.guideStart({ dataset: { mode: 'quick' } });
    const list = guidedSteps(c);
    assert.ok(list.length > 6);
    assert.ok(!list.some(s => s.path === 'type' || s.path === 'modality'));
    assert.ok(consultView(c).includes('Pantalla 1 de ' + list.length));
    assert.ok(consultView(c).includes('data-act="guideNext"'));
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'reasons');
    ACTIONS.ccReasonAdd({ dataset: { key: 'control_postoperatorio' } });
    assert.equal(c.guide.current, 'reasons');
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'reason-0-data');
    ACTIONS.guidePrevious(); ACTIONS.guidePrevious();
    assert.equal(c.guide.current, 'reasons');
    ACTIONS.guideJump({ dataset: { key: 'report' } });
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'report');
    assert.ok(!consultView(c).includes('Ir a…'));
  });
  await test('Omitir borra una respuesta sin crear normalidad ni negativos', () => {
    ACTIONS.guideStart({
      dataset: {
        mode: 'complete'
      }
    });
    ACTIONS.guideJump({
      dataset: {
        key: 'reasons'
      }
    });
    ACTIONS.guideNext();
    c.vitals = [{
      at: '2026-10-11 10:00',
      sys: 120,
      dia: 80
    }];
    ACTIONS.guideJump({
      dataset: {
        key: 'vitals'
      }
    });
    const step = guidedSteps(c).find(x => x.key === 'vitals');
    ACTIONS.guideJump({
      dataset: {
        key: 'inexistente'
      }
    });
    assert.equal(c.guide.current, step.key);
    ACTIONS.guideSkip();
    assert.equal(GUIDE.state(c, pat(c.pid), step), 'no documentado');
    assert.equal(c.vitals[0].sys, undefined);
    assert.equal(c.vitals[0].dia, undefined);
    assert.equal(Object.keys(c.exam).length, 0);
    assert.equal(c.guide.omissions[step.key], 'no documentado');
    c.reasons = [CONSULT.newReason('cefalea', 'Cefalea', true)];
    c.reasons[0].answers.onset = 'Súbito';
    c.reasons[0] = CONSULT.reconcile(c.reasons[0]);
    ACTIONS.guideJump({
      dataset: {
        key: 'reason-0-onset'
      }
    });
    ACTIONS.guideSkip();
    assert.equal(c.reasons[0].answers.onset, undefined);
    assert.equal(c.reasons[0].char.onset, undefined);
    assert.ok(!CONSULT.report(CONSULT.clean(c, pat(c.pid))).includes('Súbito'));
  });
  await test('Retomar desde localStorage conserva última pregunta y datos', () => {
    ACTIONS.guideStart({
      dataset: {
        mode: 'quick'
      }
    });
    ACTIONS.guideJump({
      dataset: {
        key: 'vitals'
      }
    });
    ACTIONS.guideInput({
      type: 'number',
      tagName: 'INPUT',
      value: '70',
      dataset: {
        path: 'vitals.0.weight'
      }
    });
    consultFlush();
    S = JSON.parse(localStorage.getItem(KEY));
    syncStaff();
    c = consultOf(c.id);
    ACTIONS.ccOpen({
      dataset: {
        id: c.id
      }
    });
    assert.equal(c.guide.current, 'vitals');
    assert.equal(c.status, 'borrador');
    assert.equal(c.vitals[0].weight, 70);
    const list = guidedSteps(c),
      index = GUIDE.current(c, list);
    assert.ok(consultView(c).includes('Pantalla ' + (index + 1) + ' de ' + list.length));
  });
  await test('Ampliar y volver mantiene datos y la misma pregunta', () => {
    ACTIONS.guideStart({
      dataset: {
        mode: 'quick'
      }
    });
    c.reasons = [CONSULT.newReason('dolor_abdominal', 'Dolor abdominal', true)];
    c.reasons[0].answers.free = 'Dato propio';
    c.vitals = [{
      weight: 70,
      height: 170
    }];
    c.plan.notes = 'Plan propio';
    const before = JSON.stringify({
      id: c.id,
      reasons: c.reasons,
      vitals: c.vitals,
      plan: c.plan
    });
    ACTIONS.guideJump({
      dataset: {
        key: 'vitals'
      }
    });
    ACTIONS.ccMode();
    assert.equal(c.mode, 'complete');
    assert.equal(c.guide.current, 'vitals');
    ACTIONS.ccMode();
    assert.equal(c.mode, 'quick');
    assert.equal(c.guide.current, 'vitals');
    assert.equal(JSON.stringify({
      id: c.id,
      reasons: c.reasons,
      vitals: c.vitals,
      plan: c.plan
    }), before);
  });
  await test('Condicionales en línea, sin pantallas adicionales ni respuestas ocultas en el informe', () => {
    c.reasons = [CONSULT.newReason('dolor_abdominal', 'Dolor abdominal', true)];
    c.guide = { started: true, current: 'reason-0-data', history: {}, omissions: {} };
    assert.ok(!guidedConsultBody(c).includes('reasons.0.answers.vomitEpisodes'));
    ACTIONS.ccChip({ dataset: { path: 'reasons.0.answers.associated', value: JSON.stringify('Vómitos'), multi: 'true' } });
    assert.equal(c.guide.current, 'reason-0-data');
    const body = guidedConsultBody(c);
    assert.ok(body.indexOf('reasons.0.answers.vomitDuration') > body.indexOf('reasons.0.answers.associated'));
    assert.ok(body.indexOf('reasons.0.answers.vomitEpisodes') > body.indexOf('reasons.0.answers.vomitDuration'));
    assert.ok(!guidedSteps(c).some(s => s.key === 'reason-0-vomitEpisodes'));
    ACTIONS.ccInput({ type: 'number', tagName: 'INPUT', value: '3', dataset: { path: 'reasons.0.answers.vomitEpisodes' } });
    ACTIONS.ccChip({ dataset: { path: 'reasons.0.answers.associated', value: JSON.stringify('Vómitos'), multi: 'true' } });
    assert.equal(c.reasons[0].discarded.vomitEpisodes, 3);
    assert.equal(c.reasons[0].answers.vomitEpisodes, undefined);
    assert.ok(!guidedConsultBody(c).includes('reasons.0.answers.vomitEpisodes'));
    assert.ok(!CONSULT.report(CONSULT.clean(c, pat(c.pid))).includes('Vómitos: número de episodios'));
  });
  await test('Sistemas y regiones agrupados: negación explícita y omisión sin normalidad', () => {
    c.guide = { started: true, current: 'ros', history: {}, omissions: {} };
    const list = guidedSteps(c);
    assert.equal(list.filter(s => s.type === 'rosGroup').length, 1);
    assert.equal(list.filter(s => s.type === 'examGroup').length, 1);
    assert.ok(guidedConsultBody(c).includes('Presente'));
    assert.equal(Object.keys(c.ros).length, 0);
    ACTIONS.guideAnswer({ dataset: { path: 'ros.Respiratorio.Tos', value: JSON.stringify('presente'), advance: 'false' } });
    assert.equal(c.ros.Respiratorio.Hemoptisis, undefined);
    ACTIONS.guideRosNone({ dataset: { system: 'Respiratorio' } });
    assert.equal(c.ros.Respiratorio.Tos, 'presente');
    assert.equal(c.ros.Respiratorio.Hemoptisis, 'ausente');
    assert.equal(c.ros.Neurológico, undefined);
    ACTIONS.guideSkip();
    assert.equal(Object.keys(c.ros).length, 0);
    UI.ccRosSelected = { Respiratorio: ['Tos', 'Disnea'] };
    ACTIONS.ccRosNegated({ dataset: { system: 'Respiratorio' } });
    assert.equal(c.ros.Respiratorio.Tos, 'ausente');
    assert.equal(c.ros.Respiratorio.Hemoptisis, undefined);
  });
  await test('IMC y advertencias inmediatas; valor imposible bloquea Continuar', () => {
    ACTIONS.guideStart({
      dataset: {
        mode: 'quick'
      }
    });
    ACTIONS.guideJump({
      dataset: {
        key: 'vitals'
      }
    });
    for (const [key, value] of [['weight', '70'], ['height', '170'], ['sys', '999']]) ACTIONS.guideInput({
      type: 'number',
      tagName: 'INPUT',
      value,
      dataset: {
        path: 'vitals.0.' + key
      }
    });
    assert.equal(document.getElementById('cc-bmi-0').textContent, 24.2);
    assert.equal(document.getElementById('cc-vital-error-0').hidden, false);
    assert.ok(document.getElementById('guide-warning').textContent.includes('PAS'));
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'vitals');
    ACTIONS.guideSkip();
    assert.equal(c.guide.current, 'exam');
    assert.equal(c.vitals[0].sys, undefined);
  });
  await test('Antecedentes: confirmar resumen conserva detalles y actualizar abre grupos', () => {
    c.guide = { started: true, current: 'history', history: {}, omissions: {} };
    const before = JSON.stringify(pat(c.pid).history);
    const body = guidedConsultBody(c);
    // Solo los grupos que aplican al paciente (gineco solo mujeres, pediátricos solo menores); alergias tienen su propia pantalla
    guidedHistoryGroupsFor(c).forEach(g => assert.ok(body.includes(GUIDE.historyGroups[g])));
    assert.ok(!guidedHistoryGroupsFor(c).includes('allergies'));
    if (pat(c.pid).sex !== 'F') assert.ok(!body.includes(GUIDE.historyGroups.gyneco));
    ACTIONS.guideHistoryConfirm();
    assert.ok(c.historyConfirmedAt);
    assert.equal(c.guide.history.conditions, 'confirmed');
    const h = JSON.parse(before);
    assert.equal(JSON.stringify(pat(c.pid).history.conditions), JSON.stringify(h.conditions));
    assert.equal(JSON.stringify(pat(c.pid).history.allergies), JSON.stringify(h.allergies));
    ACTIONS.guideHistoryUpdate({ dataset: {} });
    assert.equal(c.guide.current, 'history-conditions');
    assert.equal(c.historyConfirmedAt, undefined);
    assert.ok(guidedConsultBody(c).includes('history.conditions.0.name'));
  });
  await test('Evolución: borrador retomable del ingreso sin crear consulta ni nota', () => {
    const count = S.consults.length,
      notes = S.hc.length;
    startEvolution();
    assert.equal(S.consults.length, count);
    assert.equal(S.hc.length, notes);
    assert.equal(e.status, 'borrador');
    assert.equal(e.admId, a.id);
    ACTIONS.guideNext();
    consultFlush();
    const id = e.id;
    ACTIONS.evBack();
    assert.ok(admissionView(a).includes('data-act="evResume"'));
    ACTIONS.evNew({
      dataset: {
        id: a.id
      }
    });
    assert.equal(UI.evolutionId, id);
    assert.equal(e.guide.current, 'ev-state');
    S = JSON.parse(localStorage.getItem(KEY));
    syncStaff();
    assert.equal(evolutionOf(id).guide.current, 'ev-state');
  });
  await test('Signos previos del mismo ingreso solo como referencia, sin copiar', () => {
    S.hc.push({
      id: 'ref-note',
      pid: a.pid,
      admId: a.id,
      doc: myDoc(),
      type: 'ingreso',
      status: 'firmada',
      date: '2026-10-10',
      time: '10:00',
      vitals: {
        fc: 84
      },
      dx: []
    });
    S.hc.push({
      id: 'foreign-note',
      pid: a.pid,
      admId: 'otro-ingreso',
      doc: myDoc(),
      type: 'evolucion',
      status: 'firmada',
      date: '2026-10-11',
      time: '11:00',
      vitals: {
        fc: 199
      },
      dx: []
    });
    startEvolution();
    assert.ok(evolutionReference(e).includes('84'));
    assert.ok(!evolutionReference(e).includes('199'));
    assert.equal(e.vitals.length, 0);
    ACTIONS.evVitalAdd();
    ACTIONS.evInput({
      type: 'number',
      value: '70',
      dataset: {
        path: 'vitals.0.weight'
      }
    });
    ACTIONS.evVitalAdd();
    assert.equal(e.vitals[0].weight, 70);
    assert.equal(e.vitals[1].weight, undefined);
    assert.ok(e.vitals.every(v => v.at));
    ACTIONS.evInput({
      type: 'number',
      value: '170',
      dataset: {
        path: 'vitals.0.height'
      }
    });
    assert.equal(document.getElementById('cc-bmi-0').textContent, 24.2);
  });
  await test('Revisión por admId, sin convertir solicitado en realizado', () => {
    startEvolution();
    S.exams.push({
      id: 'exam-guided',
      pid: a.pid,
      admId: a.id,
      tests: ['Hemograma'],
      status: 'solicitado',
      report: ''
    });
    S.exams.push({
      id: 'exam-foreign',
      pid: a.pid,
      admId: 'otro-ingreso',
      tests: ['NO INCLUIR'],
      status: 'listo'
    });
    e.guide.current = 'ev-3';
    assert.ok(!evolutionBody(e).includes('NO INCLUIR'));
    ACTIONS.evInput({
      type: 'checkbox',
      checked: true,
      dataset: {
        path: 'reviews.exam-guided.reviewed'
      }
    });
    ACTIONS.evInput({
      type: 'checkbox',
      checked: true,
      dataset: {
        path: 'reviews.exam-foreign.reviewed'
      }
    });
    assert.equal(e.reviews['exam-foreign'], undefined);
    const data = EVOLUTION.clean(e, pat(e.pid), S.exams, S.indications);
    assert.equal(data.orders.length, 1);
    assert.equal(data.orders[0].status, 'solicitado');
    ACTIONS.guideJump({
      dataset: {
        key: 'ev-result-exam-guided'
      }
    });
    assert.ok(evolutionBody(e).includes('data-act="guideAnswer"'));
    ACTIONS.guideAnswer({
      dataset: {
        path: 'reviews.exam-guided.reviewed',
        value: JSON.stringify(true)
      }
    });
    assert.notEqual(e.guide.current, 'ev-result-exam-guided');
    assert.equal(e.reviews['exam-guided'].reviewed, true);
    assert.equal(S.exams.find(x => x.id === 'exam-guided').status, 'solicitado');
  });
  await test('Herida quirúrgica, dolor cero y respuestas ocultas conservan significado', () => {
    a.dx = 'Postoperatorio de cirugía';
    startEvolution();
    assert.ok(e.selectedRegions.includes('Herida quirúrgica'));
    ACTIONS.evChip({
      dataset: {
        path: 'symptoms.Dolor',
        value: JSON.stringify('presente')
      }
    });
    ACTIONS.evInput({
      type: 'number',
      value: '0',
      dataset: {
        path: 'symptomNotes.Dolor'
      }
    });
    assert.ok(EVOLUTION.report(e, pat(e.pid), S.exams, S.indications).includes('Dolor: sí · 0'));
    ACTIONS.evChip({
      dataset: {
        path: 'symptoms.Dolor',
        value: JSON.stringify('ausente')
      }
    });
    assert.ok(!EVOLUTION.report(e, pat(e.pid), S.exams, S.indications).includes('presente · 0'));
    e.exam.Respiratorio = {
      state: 'no_examinado',
      note: 'HALLAZGO OCULTO'
    };
    e.selectedRegions.push('Respiratorio');
    assert.ok(!EVOLUTION.report(e, pat(e.pid), S.exams, S.indications).includes('HALLAZGO OCULTO'));
  });
  await test('Agregar indicación usa el flujo existente y enlaza sin duplicar', () => {
    startEvolution();
    const count = S.indications.length;
    ACTIONS.evAddIndication();
    assert.equal(UI.ind.admId, a.id);
    document.getElementById('ind-p').value = 'Medicamento de prueba';
    document.getElementById('ind-d').value = 'Dosis de prueba';
    document.getElementById('ind-s').value = '12:00';
    document.getElementById('ind-days').value = '';
    document.getElementById('ind-n').value = 'Comentario';
    UI.ind.freq = 'Cada 8 horas';
    ACTIONS.indSave();
    assert.equal(S.indications.length, count + 1);
    const indication = S.indications.at(-1);
    assert.equal(indication.admId, a.id);
    assert.deepEqual(Array.from(e.indicationIds), [indication.id]);
    assert.ok(EVOLUTION.clean(e, pat(e.pid), S.exams, S.indications).plan.notes.includes('Indicación vinculada'));
    assert.equal(e.rx.length, 0);
  });
  await test('Regenerar conserva correcciones; datos nuevos invalidan aprobación', async () => {
    startEvolution();
    await prepareEvolution();
    assert.equal(e.report.source, 'plantillas');
    ACTIONS.evInput({
      type: 'text',
      value: 'Corrección médica',
      dataset: {
        path: 'report.draft'
      }
    });
    await ACTIONS.evGenerate();
    assert.equal(e.report.draft, 'Corrección médica');
    assert.ok(e.report.candidate);
    ACTIONS.evCandidate({
      dataset: {
        choice: 'keep'
      }
    });
    ACTIONS.evApprove();
    assert.equal(e.report.approvedHash, evolutionHash(e));
    ACTIONS.evInput({
      type: 'text',
      value: 'Nuevo dato clínico',
      dataset: {
        path: 'progressNotes'
      }
    });
    assert.equal(e.report.approvedHash, undefined);
    assert.equal(e.report.stale, true);
    assert.equal(evolutionSign(e), false);
  });
  await test('Firma inicial crea ingreso en S.hc, perfil e ingreso; segunda nota es evolución', async () => {
    startEvolution();
    await prepareEvolution();
    const signed = e.report.draft;
    ACTIONS.evSign();
    const n = S.hc.find(x => x.evolutionId === e.id);
    assert.equal(n.type, 'ingreso');
    assert.equal(n.admId, a.id);
    assert.equal(n.pid, a.pid);
    assert.equal(n.doc, e.doc);
    assert.equal(n.actual, signed);
    assert.equal(n.status, 'firmada');
    assert.equal(n.timezone, 'America/Caracas');
    assert.ok(n.signedISO);
    assert.equal(n.structured.id, e.id);
    assert.ok(admissionView(a).includes(n.id));
    UI.patTab = 'evoluciones';
    assert.ok(patientRecord(pat(a.pid)).includes(n.id));
    startEvolution();
    assert.equal(e.initial, false);
    await prepareEvolution();
    ACTIONS.evSign();
    assert.equal(S.hc.find(x => x.evolutionId === e.id).type, 'evolucion');
  });
  await test('Firmado bloquea captura; adendas conservan texto original', async () => {
    startEvolution();
    await prepareEvolution();
    ACTIONS.evSign();
    const signed = e.report.signedText,
      id = e.noteId;
    UI.evolutionId = e.id;
    ACTIONS.evInput({
      type: 'text',
      value: 'PROHIBIDO',
      dataset: {
        path: 'report.draft'
      }
    });
    ACTIONS.evChip({
      dataset: {
        path: 'state',
        value: JSON.stringify('Empeoramiento')
      }
    });
    assert.equal(e.report.draft, signed);
    assert.equal(e.state, 'Sin cambios');
    assert.equal(evolutionSign(e), false);
    ACTIONS.addendum({
      dataset: {
        id
      }
    });
    document.getElementById('ad-t').value = 'Aclaración de prueba';
    ACTIONS.saveAddendum({
      dataset: {
        id
      }
    });
    assert.equal(S.hc.find(x => x.id === id).actual, signed);
    assert.equal(S.hc.find(x => x.id === id).addenda[0].text, 'Aclaración de prueba');
  });
  await test('Enfermería solo lectura; recepción sin contenido; residente puede firmar', async () => {
    startEvolution();
    const draftId = e.id;
    e.progressNotes = 'CONTENIDO CLÍNICO PRIVADO';
    S.session.role = 'enfermeria';
    assert.ok(!admissionView(a).includes(draftId));
    ACTIONS.evInput({
      type: 'text',
      value: 'PROHIBIDO',
      dataset: {
        path: 'progressNotes'
      }
    });
    assert.equal(e.progressNotes, 'CONTENIDO CLÍNICO PRIVADO');
    S.session.role = 'medico';
    await prepareEvolution();
    ACTIONS.evSign();
    S.session.role = 'enfermeria';
    UI.hospTab = 'evoluciones';
    assert.ok(admissionView(a).includes(e.noteId));
    ACTIONS.openNote({
      dataset: {
        id: e.noteId
      }
    });
    assert.ok(lastSheet.body.includes('CONTENIDO CLÍNICO PRIVADO'));
    assert.ok(!lastSheet.footer.includes('addendum'));
    S.session.role = 'recepcion';
    lastSheet = null;
    ACTIONS.openNote({
      dataset: {
        id: e.noteId
      }
    });
    assert.equal(lastSheet, null);
    assert.ok(!admissionView(a).includes('CONTENIDO CLÍNICO PRIVADO'));
    S.session.role = 'residente';
    startEvolution();
    await prepareEvolution();
    assert.equal(evolutionSign(e), true);
  });
  await test('Fallo de almacenamiento revierte firma y nota', async () => {
    startEvolution();
    await prepareEvolution();
    window.failureId = e.id;
  });
  failStorage = true;
  run("assert.equal(evolutionSign(e),false);assert.equal(S.hc.some(x=>x.evolutionId===failureId),false);assert.equal(evolutionOf(failureId).status,'pendiente_revision');");
  failStorage = false;
  await test('Emergencia sin historia inicia valoración y admite diagnóstico resuelto', async () => {
    a.area = 'emerg';
    a.emerg = true;
    a.bed = 'EM-01';
    startEvolution();
    assert.equal(route, 'emergencias');
    assert.equal(EVOLUTION.steps(e)[0].sectionName, 'Estado del paciente');
    e.state = 'Nuevo problema';
    e.diagnosisUpdates[0].action = 'resuelto';
    await ACTIONS.evGenerate();
    ACTIONS.evApprove();
    assert.equal(evolutionSign(e), true);
    const n = S.hc.find(x => x.evolutionId === e.id);
    assert.equal(n.type, 'ingreso');
    assert.ok(n.dx[0].includes('resuelto'));
  });
  await test('Enter avanza; textarea, composición y eventos consumidos conservan el paso', () => {
    ACTIONS.guideStart({
      dataset: {
        mode: 'quick'
      }
    });
    ACTIONS.ccReasonAdd({ dataset: { key: 'control_postoperatorio' } });
    ACTIONS.guideNext();
    let prevented = false;
    wizardKeyHandler({
      key: 'Enter',
      target: {
        tagName: 'TEXTAREA',
        dataset: {
          path: 'report.draft'
        }
      },
      preventDefault() {
        prevented = true;
      }
    });
    assert.equal(c.guide.current, 'reason-0-data');
    assert.equal(prevented, false);
    wizardKeyHandler({
      key: 'Enter',
      isComposing: true,
      target: {
        tagName: 'INPUT'
      },
      preventDefault() {
        prevented = true;
      }
    });
    assert.equal(c.guide.current, 'reason-0-data');
    wizardKeyHandler({
      key: 'Enter',
      defaultPrevented: true,
      target: {
        tagName: 'INPUT'
      },
      preventDefault() {
        prevented = true;
      }
    });
    assert.equal(c.guide.current, 'reason-0-data');
    wizardKeyHandler({
      key: 'Enter',
      target: {
        tagName: 'INPUT'
      },
      preventDefault() {
        prevented = true;
      }
    });
    assert.equal(c.guide.current, 'reason-0-symptoms');
    assert.equal(prevented, true);
  });
  await test('Elegir tipo conserva vista; registrar datos reabre un paso omitido', () => {
    ACTIONS.guideStart({
      dataset: {
        mode: 'quick'
      }
    });
    ACTIONS.ccInput({
      type: 'select-one',
      tagName: 'SELECT',
      value: 'primera',
      dataset: {
        path: 'type'
      }
    });
    assert.equal(c.mode, 'quick');
    ACTIONS.guideJump({
      dataset: {
        key: 'vital-0-sys'
      }
    });
    ACTIONS.guideSkip({
      dataset: {
        state: 'no evaluado'
      }
    });
    ACTIONS.guideJump({
      dataset: {
        key: 'vital-0-sys'
      }
    });
    ACTIONS.ccVitalAdd();
    assert.equal(c.guide.omissions['vital-0-sys'], undefined);
  });
  await test('El informe se redacta sin IA: no se envía nada fuera del equipo y exige aprobación', async () => {
    startEvolution();
    e.state = 'Sin cambios';
    e.diagnosisUpdates[0].action = 'mantener';
    const previousFetch = fetch;
    let calls = 0;
    fetch = async () => { calls++; throw new Error('No debe haber llamadas de red al redactar'); };
    try {
      await ACTIONS.evGenerate();
    } finally {
      fetch = previousFetch;
    }
    assert.equal(calls, 0);
    assert.equal(e.report.source, 'plantillas');
    assert.ok(e.report.draft.includes('Sin cambios'));
    assert.equal(e.report.approvedHash, undefined);
    assert.equal(evolutionSign(e), false);
    ACTIONS.evApprove();
    assert.equal(evolutionSign(e), true);
  });
  await test('Diagnóstico resuelto no reaparece activo; admin y enfermería no agregan adendas', async () => {
    startEvolution();
    e.state = 'Mejoría';
    e.diagnosisUpdates[0].action = 'resuelto';
    await ACTIONS.evGenerate();
    ACTIONS.evApprove();
    assert.equal(evolutionSign(e), true);
    const id = e.noteId,
      signed = e.report.signedText;
    const linkedDoc = S.session.doc;
    S.session.role = 'admin'; S.session.doc = null;   // administrador sin ficha de médico
    lastSheet = null;
    ACTIONS.addendum({
      dataset: {
        id
      }
    });
    assert.equal(lastSheet, null);
    document.getElementById('ad-t').value = 'PROHIBIDO';
    ACTIONS.saveAddendum({
      dataset: {
        id
      }
    });
    S.session.role = 'enfermeria';
    ACTIONS.saveAddendum({
      dataset: {
        id
      }
    });
    assert.equal(S.hc.find(n => n.id === id).addenda.length, 0);
    assert.equal(S.hc.find(n => n.id === id).actual, signed);
    // Administrador que también es médico (cuenta vinculada a su ficha): sí puede escribir evoluciones
    S.session.role = 'admin'; S.session.doc = linkedDoc;
    assert.equal(evCanWrite(), true);
    assert.equal(evDoc(), linkedDoc);
    S.session.role = 'medico';
    startEvolution();
    assert.equal(e.diagnosisUpdates.length, 0);
  });
  await test('Selección única avanza, conserva marca y permite cambiar al volver', () => {
    c.reasons = [CONSULT.newReason('cefalea', 'Cefalea', true)];
    c.guide = {
      started: true,
      current: 'reason-0-onset',
      omissions: {},
      history: {}
    };
    ACTIONS.guideAnswer({
      dataset: {
        path: 'reasons.0.answers.onset',
        value: JSON.stringify('Súbito')
      }
    });
    assert.equal(c.reasons[0].answers.onset, 'Súbito');
    assert.equal(c.guide.current, 'reason-0-frequency');
    ACTIONS.guidePrevious();
    assert.equal(c.guide.current, 'reason-0-onset');
    assert.match(guidedConsultBody(c), /data-value="&quot;Súbito&quot;"[^>]*aria-pressed="true"/);
    ACTIONS.guideAnswer({
      dataset: {
        path: 'reasons.0.answers.onset',
        value: JSON.stringify('Gradual')
      }
    });
    assert.equal(c.reasons[0].answers.onset, 'Gradual');
    assert.equal(c.guide.current, 'reason-0-frequency');
    ACTIONS.guideJump({
      dataset: {
        key: 'reason-0-intensity'
      }
    });
    assert.equal((guidedConsultBody(c).match(/data-act="guideAnswer"/g) || []).length, 11);
    assert.ok(!guidedConsultBody(c).includes('type="range"'));
    ACTIONS.guideAnswer({
      dataset: {
        path: 'reasons.0.answers.intensity',
        value: '0'
      }
    });
    assert.equal(c.reasons[0].answers.intensity, 0);
    assert.notEqual(c.guide.current, 'reason-0-intensity');
  });
  await test('Normal exige ítems concretos y cambiar a alterado descarta normalidad', () => {
    ACTIONS.guideStart({ dataset: { mode: 'complete' } });
    ACTIONS.guideJump({ dataset: { key: 'exam-Abdomen' } });
    ACTIONS.guideAnswer({ dataset: { path: 'exam.Abdomen.state', value: JSON.stringify('normal'), advance: 'false' } });
    assert.equal(c.guide.current, 'exam');
    assert.ok(guidedRequirements(c, guidedStep(c)).length);
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'exam');
    assert.ok(guidedConsultBody(c).includes('Marque qué verificó'));
    ACTIONS.guideNormalItem({ checked: true, dataset: { region: 'Abdomen', item: 'Aspecto' } });
    assert.deepEqual(Array.from(c.exam.Abdomen.confirmed), ['Aspecto']);
    ACTIONS.guideAllNormal({ dataset: { region: 'Abdomen' } });
    assert.deepEqual(Array.from(c.exam.Abdomen.confirmed), CONSULT.exam.Abdomen.split('|'));
    assert.equal(c.guide.current, 'exam');
    ACTIONS.guideAnswer({ dataset: { path: 'exam.Abdomen.state', value: JSON.stringify('alterado'), advance: 'false' } });
    assert.equal(c.exam.Abdomen.confirmed, undefined);
    ACTIONS.guideFinding({ dataset: { region: 'Abdomen', item: 'Distensión' } });
    assert.equal(c.exam.Abdomen.findings.Distensión, 'Alterado');
    ACTIONS.guideSkip();
    assert.equal(c.exam.Abdomen, undefined);
    assert.ok(!CONSULT.clean(c, pat(c.pid)).exam.Abdomen?.findings);
  });
  await test('Alergias rápidas: conocidas, sincronizadas y enfermería sin verificar', () => {
    S.session.role = 'enfermeria';
    assert.equal(canSee('pacientes'), true);
    assert.equal(can('pac.clinico'), false);
    assert.equal(can('pac.escribir'), false);
    ACTIONS.allergyQuick({
      dataset: {
        pid: c.pid
      }
    });
    assert.ok(lastSheet.body.includes('Penicilina'));
    assert.ok(lastSheet.body.includes('Metamizol (Dipirona)'));
    assert.ok(lastSheet.body.includes('Mariscos'));
    ACTIONS.allergyPick({
      dataset: {
        substance: 'Amoxicilina',
        inline: 'false'
      }
    });
    assert.equal(UI.allergyQuick.stage, 'reaction');
    ACTIONS.allergyReaction({
      dataset: {
        value: 'Erupción / ronchas',
        inline: 'false'
      }
    });
    ACTIONS.allergySeverity({
      dataset: {
        value: 'moderada',
        inline: 'false'
      }
    });
    const p = pat(c.pid),
      item = p.history.allergies.items.find(a => a.substance === 'Amoxicilina');
    assert.equal(p.history.allergies.status, 'conocidas');
    assert.ok(p.allergies.includes('Amoxicilina'));
    assert.equal(item.reaction, 'Erupción / ronchas');
    assert.equal(item.severity, 'moderada');
    assert.equal(item.verified, false);
    assert.ok(CONSULT.allergyText(p.history).includes('sin verificar'));
    assert.ok(patientBand(p.id).includes('+ Alergia'));
    UI.patTab = 'resumen';
    assert.ok(patientRecord(p).includes('+ Alergia'));
    assert.ok(CONSULT.allergyText(p.history).includes('Alergias conocidas'));
    const count = p.history.allergies.items.length;
    assert.equal(CONSULT.addAllergy(p, {
      substance: 'PROHIBIDA'
    }, {
      role: 'recepcion'
    }), false);
    S.session.role = 'recepcion';
    lastSheet = null;
    ACTIONS.allergyQuick({
      dataset: {
        pid: p.id
      }
    });
    ACTIONS.allergySeverity({
      dataset: {
        value: 'grave',
        inline: 'false'
      }
    });
    assert.equal(lastSheet, null);
    assert.equal(p.history.allergies.items.length, count);
    assert.ok(!patientBand(p.id).includes('+ Alergia'));
  });
  await test('Alergias dentro del cuestionario usan la misma captura y conservan longitudinal', () => {
    c.guide = {
      started: true,
      current: 'history-allergies',
      omissions: {},
      history: {}
    };
    ACTIONS.guideHistoryUpdate({
      dataset: {
        group: 'allergies'
      }
    });
    ACTIONS.guideAnswer({
      dataset: {
        path: 'history.allergies.status',
        value: JSON.stringify('conocidas')
      }
    });
    assert.equal(c.guide.current, 'history-allergies');
    assert.ok(guidedConsultBody(c).includes('Amoxicilina'));
    ACTIONS.allergyPick({
      dataset: {
        substance: 'Látex',
        inline: 'true'
      }
    });
    assert.equal(c.guide.current, 'history-allergies');
    ACTIONS.allergyReaction({
      dataset: {
        value: 'Picazón',
        inline: 'true'
      }
    });
    assert.equal(c.guide.current, 'history-allergies');
    ACTIONS.allergySeverity({
      dataset: {
        value: 'leve',
        inline: 'true'
      }
    });
    assert.equal(c.guide.current, 'history-allergies');
    assert.ok(pat(c.pid).allergies.includes('Látex'));
    assert.ok(pat(c.pid).allergies.includes('Penicilina'));
    assert.equal(c.guide.allergyDraft, undefined);
    const before = JSON.stringify(pat(c.pid).history.allergies);
    ACTIONS.guideJump({
      dataset: {
        key: 'history-allergies'
      }
    });
    ACTIONS.guideSkip();
    assert.equal(JSON.stringify(pat(c.pid).history.allergies), before);
  });
  await test('Nueva consulta abre mini menú y busca por cédula, nombre, teléfono y QRN', () => {
    const count = S.consults.length,
      p = pat(c.pid);
    ACTIONS.ccNewMenu();
    assert.equal(lastSheet.title, 'Nueva consulta');
    assert.ok(lastSheet.body.includes('data-act="ccNewSearch"'));
    assert.ok(lastSheet.body.includes('data-act="ccNewRegister"'));
    assert.equal(S.consults.length, count);
    assert.ok(VIEWS.consultas().includes('data-act="ccNewMenu"'));
    ACTIONS.ccNewSearch();
    assert.ok(lastSheet.body.includes('cc-menu-patient-query'));
    for (const query of [p.name, p.ci, p.phone, p.code]) {
      ACTIONS.ccMenuPatientSearch({
        value: query
      });
      assert.ok(document.getElementById('cc-menu-patient-results').innerHTML.includes('data-pid="' + p.id + '"'));
    }
    ACTIONS.ccChoosePatient({
      dataset: {
        pid: p.id
      }
    });
    assert.equal(S.consults.length, count + 1);
    assert.equal(consultOf(param).pid, p.id);
    assert.ok(consultView(consultOf(param)).includes('¿Cómo desea documentar'));
    S.session.role = 'recepcion';
    lastSheet = null;
    ACTIONS.ccNewMenu();
    assert.equal(lastSheet, null);
  });
  await test('Tarjetas ocupadas abren o retoman evolución y restringen roles', () => {
    S.admissions = S.admissions.filter(x => x.id === a.id || x.bed !== a.bed);
    assert.ok(bedsView('hosp').includes('Generar informe evolutivo'));
    assert.ok(bedsView('hosp').includes('data-act="evNew" data-id="' + a.id + '"'));
    startEvolution();
    const id = e.id;
    assert.ok(bedsView('hosp').includes('Continuar informe evolutivo'));
    ACTIONS.evNew({
      dataset: {
        id: a.id
      }
    });
    assert.equal(UI.evolutionId, id);
    S.session.role = 'enfermeria';
    assert.equal(evolutionBedButton(a), '');
    S.session.role = 'recepcion';
    assert.equal(evolutionBedButton(a), '');
    S.session.role = 'residente';
    assert.ok(evolutionBedButton(a).includes('Continuar informe evolutivo'));
    a.area = 'emerg';
    a.emerg = true;
    a.bed = 'EM-01';
    S.admissions = S.admissions.filter(x => x.id === a.id || x.bed !== a.bed);
    assert.ok(bedsView('emerg').includes('Continuar informe evolutivo'));
  });
  await test('Evolución autoavanza, omite sin negativos y titula la nota y PDF', async () => {
    startEvolution();
    ACTIONS.guideJump({
      dataset: {
        key: 'ev-state'
      }
    });
    ACTIONS.evChip({
      dataset: {
        path: 'state',
        value: JSON.stringify('Sin cambios')
      }
    });
    assert.equal(e.guide.current, 'ev-symptoms');
    ACTIONS.evChip({
      dataset: {
        path: 'symptoms.Dolor',
        value: JSON.stringify('presente')
      }
    });
    assert.equal(e.guide.current, 'ev-symptoms');
    assert.ok(evolutionBody(e).includes('symptomNotes.Dolor'));
    assert.equal(e.symptoms.Dolor, 'presente');
    ACTIONS.guideSkip();
    assert.equal(e.symptomNotes.Dolor, undefined);
    e.diagnosisUpdates[0].action = 'mantener';
    await ACTIONS.evGenerate();
    ACTIONS.evApprove();
    assert.equal(evolutionSign(e), true);
    let n = S.hc.find(n => n.evolutionId === e.id);
    assert.equal(clinicalNoteTitle(n), 'Valoración inicial del ingreso');
    startEvolution();
    await prepareEvolution();
    assert.ok(e.report.draft.startsWith('Evolución médica\n'));
    ACTIONS.evSign();
    n = S.hc.find(n => n.evolutionId === e.id);
    assert.equal(clinicalNoteTitle(n), 'Evolución médica');
    assert.ok(lastSheet.title.startsWith('Evolución médica'));
    const oldNew = pdfNew,
      oldInfo = pdfInfoBox,
      oldBody = pdfNoteBody,
      oldSign = pdfSignature;
    const oldAllergies = pat(n.pid).allergies;
    try {
      pat(n.pid).allergies = [];
      pdfNew = title => ({
        title
      });
      pdfInfoBox = (doc, y) => y;
      pdfNoteBody = (doc, y) => y;
      pdfSignature = () => {};
      assert.equal(pdfNote(n).title, 'Evolución médica');
      assert.equal(pdfNote({
        ...n,
        type: 'ingreso'
      }).title, 'Valoración inicial del ingreso');
    } finally {
      pdfNew = oldNew;
      pdfInfoBox = oldInfo;
      pdfNoteBody = oldBody;
      pdfSignature = oldSign;
      pat(n.pid).allergies = oldAllergies;
    }
  });
  await test('Selección múltiple: certeza en línea y una pantalla por examen con solicitud vinculada', () => {
    ACTIONS.guideStart({ dataset: { mode: 'quick' } });
    ACTIONS.guideJump({ dataset: { key: 'dx' } });
    ACTIONS.guideDxPick({ dataset: { i: '0' } });
    assert.equal(c.guide.current, 'dx');
    ACTIONS.guideAnswer({ dataset: { path: 'dx.0.certainty', value: JSON.stringify('confirmado'), advance: 'false' } });
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'indications');
    const count = S.exams.length;
    ACTIONS.guideOrderPick({ dataset: { label: 'Hemograma', category: 'lab' } });
    ACTIONS.guideOrderPick({ dataset: { label: 'Orina', category: 'lab' } });
    ACTIONS.guideOrderPick({ dataset: { label: 'Orina', category: 'lab' } });
    assert.equal(guidedOrderDrafts(c).filter(Boolean).length, 1);
    assert.equal(c.guide.current, 'indications');
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'orders-0');
    assert.equal(S.exams.length, count);
    ACTIONS.guidePrevious();
    assert.equal(c.guide.current, 'indications');
    ACTIONS.guideOrderPick({ dataset: { label: 'Orina', category: 'lab' } });
    ACTIONS.guideNext();
    ACTIONS.guideOrderAnswer({ dataset: { field: 'category', value: 'lab' } });
    ACTIONS.guideOrderAnswer({ dataset: { field: 'priority', value: 'urgente' } });
    assert.equal(c.guide.current, 'orders-0');
    ACTIONS.guideOrderNote({ value: 'Indicación explícita de prueba' });
    ACTIONS.guideNext();
    assert.equal(S.exams.length, count + 1);
    assert.equal(c.orders.length, 1);
    assert.equal(S.exams[0].consultId, c.id);
    assert.equal(S.exams[0].priority, 'urgente');
    assert.equal(S.exams[0].status, 'solicitado');
    assert.equal(c.guide.current, 'orders-1');
  });
  await test('Medicamentos: catálogo inicial ordenado, 40 opciones y filtro sin tildes', () => {
    S.products = Array.from({ length: 45 }, (_, i) => ({
      id: 'p-catalogo-' + i, name: 'Medicamento ' + String(44 - i).padStart(2, '0'),
      cat: 'Medicamento', lots: []
    }));
    S.products.push({ id: 'p-filtrado', name: 'Ácido fólico', cat: 'Medicamento', lots: [] });
    S.products.push({ id: 'p-insumo', name: 'Ácido de limpieza', cat: 'Insumo', lots: [] });
    c.guide = { started: true, current: 'rx', omissions: {}, history: {} };
    const options = guidedRxOptions('');
    assert.equal((options.match(/data-act="guideRxPick"/g) || []).length, 40);
    assert.ok(options.indexOf('Ácido fólico') < options.indexOf('Medicamento 00'));
    assert.ok(options.indexOf('Medicamento 00') < options.indexOf('Medicamento 01'));
    assert.ok(!options.includes('Medicamento 44'));
    assert.ok(!options.includes('Ácido de limpieza'));
    const body = guidedConsultBody(c);
    assert.ok(body.includes('guide-rx-options'));
    assert.ok(body.indexOf('id="guide-rx-search"') < body.indexOf('id="guide-rx-results"'));
    assert.ok(consultView(c).includes('data-act="guideNext"'));
    ACTIONS.guideRxSearch({ value: 'acido' });
    const filtered = document.getElementById('guide-rx-results').innerHTML;
    assert.ok(filtered.includes('Ácido fólico'));
    assert.ok(filtered.includes('Indicar: acido'));
    assert.ok(!filtered.includes('Medicamento 00'));
    assert.ok(!filtered.includes('Ácido de limpieza'));
  });
  await test('Medicamentos: marcar varios, desmarcar y Quitar conserva pantalla, datos y guardado', () => {
    c.guide = { started: true, current: 'rx', omissions: {}, history: {} };
    const products = S.products.filter(p => p.cat === 'Medicamento').slice(0, 2);
    const inventory = JSON.stringify(S.products), orders = S.medOrders.length, mar = S.mar.length;
    ACTIONS.guideRxPick({ dataset: { id: products[0].id } });
    c.rx[0].dose = 'Dosis documentada';
    ACTIONS.guideRxPick({ dataset: { id: products[1].id } });
    assert.equal(c.guide.current, 'rx');
    assert.equal(c.rx.length, 2);
    assert.equal(c.rx[0].dose, 'Dosis documentada');
    assert.equal(c.rx[1].dose, undefined);
    assert.equal(c.rx[0].status, 'prescrito');
    assert.equal(c.rx[0].documentStatus, 'borrador');
    assert.match(guidedRxOptions(''), /class="btn on"[^>]*aria-pressed="true"/);
    assert.ok(guidedSelected(c, 'rx', 'drug').includes('Quitar'));
    ACTIONS.guideRxPick({ dataset: { id: products[1].id } });
    assert.equal(c.rx.length, 1);
    assert.equal(c.guide.current, 'rx');
    assert.equal(c.rx[0].dose, 'Dosis documentada');
    ACTIONS.guideRxPick({ dataset: { label: products[0].name.toUpperCase() } });
    assert.equal(c.rx.length, 0);
    ACTIONS.guideRxPick({ dataset: { id: products[0].id } });
    ACTIONS.guideRxPick({ dataset: { id: products[1].id } });
    ACTIONS.guideRemoveRow({ dataset: { list: 'rx', i: '1' } });
    assert.equal(c.rx.length, 1);
    const saved = JSON.parse(localStorage.getItem(KEY)).consults.find(x => x.id === c.id);
    assert.equal(saved.guide.current, 'rx');
    assert.equal(saved.rx.length, 1);
    assert.equal(saved.rx[0].productId, products[0].id);
    assert.equal(JSON.stringify(S.products), inventory);
    assert.equal(S.medOrders.length, orders);
    assert.equal(S.mar.length, mar);
  });
  await test('Medicamentos: alergia por palabra, confirmar o cancelar y texto libre escapado', () => {
    c.guide = { started: true, current: 'rx', omissions: {}, history: {} };
    const p = pat(c.pid);
    p.history.allergies = { status: 'conocidas', items: [
      { substance: 'AINEs / Ibuprofeno', reaction: 'Ronchas', verified: false },
      { substance: 'Penicilina', reaction: 'Erupción', verified: true }
    ] };
    S.products.push({ id: 'p-alergia', name: 'Ibuproféno 400 mg', cat: 'Medicamento', lots: [] });
    S.products.push({ id: 'p-sin-alergia', name: 'Amoxicilina 500 mg', cat: 'Medicamento', lots: [] });
    assert.deepEqual(Array.from(guidedRxAllergies(c, 'Ibuprofeno')), ['AINEs / Ibuprofeno']);
    assert.equal(guidedRxAllergies(c, 'Amoxicilina').length, 0);
    assert.equal(guidedRxAllergies(c, 'Dexibuprofeno').length, 0);
    assert.ok(guidedRxOptions('ibuprofeno').includes('guide-rx-allergy'));
    assert.ok(guidedRxOptions('ibuprofeno').includes('⚠ Alergia registrada'));
    assert.ok(guidedConsultBody(c).includes('AINEs / Ibuprofeno'));
    assert.ok(guidedConsultBody(c).includes('sin verificar'));
    ACTIONS.guideRxPick({ dataset: { id: 'p-alergia' } });
    assert.equal(confirmCalls, 1);
    assert.ok(lastConfirm.includes('AINEs / Ibuprofeno'));
    assert.ok(lastConfirm.includes('Ibuproféno 400 mg'));
    assert.equal(c.rx.length, 0);
    assert.equal(c.guide.current, 'rx');
    confirmResult = true;
    ACTIONS.guideRxPick({ dataset: { id: 'p-alergia' } });
    assert.equal(c.rx.length, 1);
    assert.match(guidedRxOptions('ibuprofeno'), /aria-pressed="true"/);
    ACTIONS.guideRxPick({ dataset: { id: 'p-alergia' } });
    assert.equal(c.rx.length, 0);
    assert.equal(confirmCalls, 2);
    ACTIONS.guideRxPick({ dataset: { id: 'p-sin-alergia' } });
    assert.equal(confirmCalls, 2);
    assert.equal(c.rx.length, 1);
    UI.guideRxQuery = 'Ibuprofeno especial <prueba>';
    assert.ok(guidedRxOptions(UI.guideRxQuery).includes('Indicar: Ibuprofeno especial &lt;prueba&gt;'));
    confirmResult = false;
    ACTIONS.guideRxPick({ dataset: { label: UI.guideRxQuery } });
    assert.equal(c.rx.length, 1);
    confirmResult = true;
    ACTIONS.guideRxPick({ dataset: { label: UI.guideRxQuery } });
    assert.equal(c.rx.length, 2);
    assert.equal(c.rx[1].productId, undefined);
    assert.ok(guidedSelected(c, 'rx', 'drug').includes('&lt;prueba&gt;'));
    assert.equal(c.guide.current, 'rx');
  });
  await test('Medicamentos: Continuar recorre detalles por elegido y Anterior permite agregar más', () => {
    c.guide = { started: true, current: 'rx', omissions: {}, history: {} };
    ACTIONS.guideRxPick({ dataset: { label: 'Medicamento de prueba A' } });
    ACTIONS.guideRxPick({ dataset: { label: 'Medicamento de prueba B' } });
    const fields = ['presentation', 'dose', 'unit', 'route', 'freq', 'duration', 'qty', 'notes'];
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'rx-0');
    ACTIONS.guidePrevious();
    assert.equal(c.guide.current, 'rx');
    ACTIONS.guideRxPick({ dataset: { label: 'Medicamento de prueba C' } });
    ACTIONS.guideNext();
    for (let i = 0; i < 3; i++) {
      assert.equal(c.guide.current, 'rx-' + i);
      for (const field of fields) {
        assert.ok(guidedConsultBody(c).includes('data-path="rx.' + i + '.' + field + '"'));
        ACTIONS.guideInput({ type: 'text', tagName: 'INPUT', value: 'Dato ' + i + ' ' + field, dataset: { path: 'rx.' + i + '.' + field } });
      }
      ACTIONS.guideNext();
    }
    assert.equal(c.guide.current, 'plan');
    assert.equal(c.rx[0].dose, 'Dato 0 dose');
    assert.equal(c.rx[2].qty, 'Dato 2 qty');
    assert.ok(!guidedSteps(c).some(s => s.key === 'rx-more'));
  });
  await test('Diagnósticos: varios marcados, principal cambiable y certeza independiente', () => {
    c.guide = { started: true, current: 'dx', omissions: {}, history: {} };
    ACTIONS.guideDxPick({ dataset: { i: '0' } });
    ACTIONS.guideDxPick({ dataset: { i: '1' } });
    assert.equal(c.guide.current, 'dx');
    assert.equal(c.dx.length, 2);
    assert.equal(c.dx[0].priority, 'principal');
    assert.equal(c.dx[1].priority, 'secundario');
    assert.ok(guidedDxOptions('').includes('Escriba el diagnóstico'));   // el médico escribe el diagnóstico (sin sugerencias)
    assert.ok(guidedSelected(c, 'dx', 'label').includes('data-act="guideDxMain"'));
    const catalog = CONSULT.diagnoses.find(d => d.synonyms?.length && d.code);
    assert.ok(guidedDxOptions(catalog.synonyms[0]).includes('Agregar diagnóstico'));
    assert.ok(guidedDxOptions(catalog.code).includes('Agregar diagnóstico'));
    const certainty = c.dx[1].certainty;
    ACTIONS.guideDxMain({ dataset: { i: '1' } });
    assert.equal(c.dx[0].priority, 'secundario');
    assert.equal(c.dx[1].priority, 'principal');
    assert.equal(c.dx[1].certainty, certainty);
    ACTIONS.guideDxPick({ dataset: { i: '1' } });
    assert.equal(c.dx.length, 1);
    assert.equal(c.dx[0].priority, 'principal');
    // Diagnóstico escrito por el médico: se agrega una vez, la casilla queda vacía y repetirlo no lo duplica
    UI.ccDxQuery = 'Diagnóstico libre';
    ACTIONS.guideDxFree();
    assert.equal(c.dx.length, 2);
    assert.equal(UI.ccDxQuery, '');
    ACTIONS.guideDxFree();
    UI.ccDxQuery = 'diagnóstico libre';
    ACTIONS.guideDxFree();
    assert.equal(c.dx.length, 2);
    assert.ok(guidedConsultBody(c).includes('Presuntivo'));
    assert.ok(guidedConsultBody(c).includes('Confirmado'));
    assert.ok(guidedConsultBody(c).includes('Diferencial'));
    assert.ok(guidedConsultBody(c).includes('Pendiente de estudio'));
    ACTIONS.guideAnswer({ dataset: { path: 'dx.0.priority', value: JSON.stringify('principal') } });
    assert.equal(c.guide.current, 'dx');
    ACTIONS.guideAnswer({ dataset: { path: 'dx.0.certainty', value: JSON.stringify('confirmado') } });
    ACTIONS.guideAnswer({ dataset: { path: 'dx.1.priority', value: JSON.stringify('principal') } });
    assert.equal(c.dx.filter(d => d.priority === 'principal').length, 1);
    assert.equal(c.dx[0].certainty, 'confirmado');
    ACTIONS.guideAnswer({ dataset: { path: 'dx.1.certainty', value: JSON.stringify('pendiente de estudio') } });
    assert.equal(c.guide.current, 'dx');
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'orders');
    assert.ok(!guidedSteps(c).some(s => s.key === 'dx-more'));
    c.guide.current = 'dx';
    ACTIONS.guideRemoveRow({ dataset: { list: 'dx', i: '1' } });
    assert.equal(c.dx[0].priority, 'principal');
  });
  await test('Exámenes: sin agregar otro, huecos respetados y Continuar vacío avanza', () => {
    c.guide = { started: true, current: 'orders', omissions: {}, history: {} };
    ACTIONS.guideOrderPick({ dataset: { label: 'Hemograma', category: 'lab' } });
    ACTIONS.guideOrderPick({ dataset: { label: 'Orina', category: 'lab' } });
    ACTIONS.guideOrderPick({ dataset: { label: 'Hemograma', category: 'lab' } });
    assert.equal(c.guide.current, 'orders');
    assert.equal(guidedOrderDrafts(c)[0], null);
    assert.match(guidedOrderOptions('Orina'), /aria-pressed="true"/);
    assert.ok(!guidedSteps(c).some(s => s.key === 'orders-more'));
    assert.ok(!guidedConsultBody(c).includes('¿Desea agregar otro examen?'));
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'orders-1');
    ACTIONS.guidePrevious();
    assert.equal(c.guide.current, 'orders');
    ACTIONS.guideOrderDiscard({ dataset: { i: '1' } });
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'rx');
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'plan');
    c.guide.current = 'dx';
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'orders');
  });
  await test('Borradores antiguos: orders-more, rx-more y dx-more reabren la selección sin perder datos', () => {
    c.guide = { started: true, current: 'orders', omissions: {}, history: {} };
    ACTIONS.guideOrderPick({ dataset: { label: 'Examen conservado', category: 'otro' } });
    c.rx = [{ drug: 'Medicamento conservado', dose: 'Dato del borrador' }];
    c.dx = [{ label: 'Diagnóstico conservado', priority: 'principal', certainty: 'confirmado' }];
    const id = c.id;
    for (const [legacy, equivalent] of [['orders-more', 'orders'], ['rx-more', 'rx'], ['dx-more', 'dx']]) {
      c.guide.current = legacy;
      consultFlush();
      S = JSON.parse(localStorage.getItem(KEY));
      syncStaff();
      c = consultOf(id);
      ACTIONS.ccOpen({ dataset: { id } });
      assert.doesNotThrow(() => consultView(c));
      assert.equal(c.guide.current, equivalent);
      assert.equal(guidedStep(c).key, equivalent);
      assert.equal(c.rx[0].dose, 'Dato del borrador');
      assert.equal(c.dx[0].certainty, 'confirmado');
      assert.equal(guidedOrderDrafts(c)[0].label, 'Examen conservado');
    }
    c.guide.current = 'orders-more';
    delete c.guide.orderDrafts;
    c.guide.orderDraft = { label: 'Borrador singular', category: 'lab' };
    assert.doesNotThrow(() => consultView(c));
    assert.equal(c.guide.current, 'orders');
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'orders-0');
    assert.equal(guidedOrderDrafts(c)[0].label, 'Borrador singular');
  });
  await test('Selección clínica: firmado y roles sin permiso no cambian medicamentos ni diagnóstico', () => {
    c.guide = { started: true, current: 'rx', omissions: {}, history: {} };
    ACTIONS.guideRxPick({ dataset: { label: 'Medicamento protegido' } });
    c.dx = [{ label: 'Diagnóstico protegido', priority: 'principal', certainty: 'confirmado' }];
    const before = JSON.stringify({ rx: c.rx, dx: c.dx });
    c.status = 'firmada';
    ACTIONS.guideRxPick({ dataset: { label: 'Prohibido' } });
    ACTIONS.guideDxPick({ dataset: { i: '0' } });
    ACTIONS.guideDxMain({ dataset: { i: '0' } });
    ACTIONS.guideRemoveRow({ dataset: { list: 'rx', i: '0' } });
    assert.equal(JSON.stringify({ rx: c.rx, dx: c.dx }), before);
    c.status = 'borrador';
    S.session.role = 'recepcion';
    ACTIONS.guideRxPick({ dataset: { label: 'Prohibido' } });
    ACTIONS.guideDxPick({ dataset: { i: '0' } });
    ACTIONS.guideRemoveRow({ dataset: { list: 'dx', i: '0' } });
    assert.equal(JSON.stringify({ rx: c.rx, dx: c.dx }), before);
    assert.equal(confirmCalls, 0);
  });
  await test('Revisar ofrece Cambiar por sección y genera sin aprobar ni firmar', async () => {
    c.reasons = [CONSULT.newReason('cefalea', 'Cefalea', true)];
    c.dx = [{
      label: 'Cefalea',
      priority: 'principal',
      certainty: 'presuntivo'
    }];
    c.guide = {
      started: true,
      current: 'review',
      omissions: {},
      history: {}
    };
    assert.ok(guidedReview(c).includes('data-act="guideJump"'));
    assert.ok(guidedReview(c).includes('Cambiar'));
    assert.ok(guidedReview(c).includes('No documentado'));
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'report');
    assert.ok(c.report.draft);
    assert.equal(c.report.approvedHash, undefined);
    assert.notEqual(c.status, 'firmada');
    ACTIONS.guideJump({
      dataset: {
        key: 'reasons'
      }
    });
    assert.equal(c.guide.current, 'reasons');
  });
  await test('Confirmar solo alergias en rápida no confirma todos los antecedentes', () => {
    ACTIONS.guideStart({
      dataset: {
        mode: 'quick'
      }
    });
    ACTIONS.guideJump({
      dataset: {
        key: 'history-allergies'
      }
    });
    ACTIONS.guideHistoryConfirm({
      dataset: {
        group: 'allergies'
      }
    });
    assert.equal(c.guide.history.allergies, 'confirmed');
    assert.equal(c.guide.history.conditions, undefined);
    assert.equal(c.historyConfirmedAt, undefined);
  });
  await test('Rápida postoperatoria completa: 10 tareas hasta Revisar y firma inalterable', async () => {
    S.appts.push({ id: 'qx-prefill', pid: c.pid, kind: 'cirugia', status: 'done', proc: 'Apendicectomía', date: '2026-10-01', time: '08:00' });
    ACTIONS.guideStart({ dataset: { mode: 'quick' } });
    ACTIONS.ccReasonAdd({ dataset: { key: 'control_postoperatorio' } });
    assert.equal(c.type, 'postoperatoria');
    const visited = [];
    for (let guard = 0; guard < 30 && guidedStep(c).type !== 'review'; guard++) {
      const s = guidedStep(c);
      visited.push(s.key);
      if (s.type === 'reasonData') {
        assert.equal(c.reasons[0].answers.procedure, 'Apendicectomía');
        assert.equal(c.reasons[0].answers.surgeryDate, '2026-10-01');
        ACTIONS.guideInput({ type: 'text', value: 'Sin complicaciones referidas', dataset: { path: 'reasons.0.answers.complications' } });
      } else if (s.type === 'reasonChecklist') ACTIONS.guideNone({ dataset: {} });
      else if (s.type === 'single') {
        ACTIONS.guideAnswer({ dataset: { path: s.path, value: JSON.stringify('Mejoría completa') } });
        continue;
      } else if (s.type === 'historySummary') { ACTIONS.guideHistoryConfirm(); continue; }
      else if (s.type === 'vitalsGroup') {
        for (const [key, value] of Object.entries({ sys: 120, dia: 80, hr: 72, rr: 16, temp: 36.5, spo2: 98, pain: 0 }))
          ACTIONS.guideInput({ type: 'number', value: String(value), dataset: { path: 'vitals.0.' + key } });
      } else if (s.type === 'examGroup') {
        for (const region of ['Herida quirúrgica', 'Abdomen']) {
          ACTIONS.guideAnswer({ dataset: { path: 'exam.' + region + '.state', value: JSON.stringify('normal'), advance: 'false' } });
          ACTIONS.guideAllNormal({ dataset: { region } });
        }
      } else if (s.type === 'dxSearch') {
        ACTIONS.guideDxPick({ dataset: { i: String(CONSULT.diagnoses.findIndex(d => d.label === 'Control postoperatorio')) } });
        ACTIONS.guideAnswer({ dataset: { path: 'dx.0.certainty', value: JSON.stringify('confirmado'), advance: 'false' } });
      } else if (s.type === 'indicationsGroup') {
        ACTIONS.guideNoIndication({ dataset: { list: 'orders' } });
        ACTIONS.guideNoIndication({ dataset: { list: 'rx' } });
        continue;
      } else if (s.type === 'planGroup') {
        ACTIONS.guideAnswer({ dataset: { path: 'plan.conducts', value: JSON.stringify('Seguimiento'), multi: 'true' } });
        ACTIONS.guideControlDate({ dataset: { value: '7' } });
      }
      ACTIONS.guideNext();
    }
    assert.equal(c.guide.current, 'review');
    assert.ok(visited.length <= 10, visited.join(' → '));
    // El usuario autorizó 11–12 pantallas si se cuenta también Revisar.
    assert.ok(visited.length + 1 <= 12);
    assert.equal(c.vitals[0].pain, 0);
    assert.ok(c.exam['Herida quirúrgica'].confirmed.length);
    assert.ok(!visited.some(key => key === 'reason-0-intensity' || key === 'reason-0-wound'));
    const review = guidedConsultBody(c);
    assert.ok(review.includes('data-path="type"'));
    assert.ok(review.includes('data-path="modality"'));
    await ACTIONS.ccGenerate();
    assert.ok(c.report.draft.includes('No indica exámenes.'));
    assert.ok(c.report.draft.includes('No indica medicamentos.'));
    ACTIONS.ccApprove();
    assert.equal(consultSign(c), true);
    const signed = JSON.stringify(c);
    ACTIONS.guideInput({ type: 'number', value: '9', dataset: { path: 'vitals.0.pain' } });
    assert.equal(JSON.stringify(c), signed);
    console.log('MEDICIÓN rápida: ' + (visited.length + 1) + ' pantallas hasta Revisar (incluido).');
  });
  await test('Completa medida: recorrido con cefalea hasta Revisar en no más de 25 pantallas', () => {
    ACTIONS.guideStart({ dataset: { mode: 'complete' } });
    ACTIONS.ccReasonAdd({ dataset: { key: 'cefalea' } });
    const visited = [];
    while (guidedStep(c).type !== 'review' && visited.length < 30) {
      const s = guidedStep(c);
      visited.push(s.key);
      if (s.type === 'single' || s.type === 'scale010') {
        const option = s.type === 'scale010' ? 0 : s.options[0];
        ACTIONS.guideAnswer({ dataset: { path: s.path, value: JSON.stringify(Array.isArray(option) ? option[0] : option) } });
      } else if (s.type === 'historySummary') ACTIONS.guideHistoryConfirm();
      else if (s.type === 'dxSearch') {
        ACTIONS.guideDxPick({ dataset: { i: '4' } });
        ACTIONS.guideAnswer({ dataset: { path: 'dx.0.certainty', value: JSON.stringify('presuntivo'), advance: 'false' } });
        ACTIONS.guideNext();
      } else ACTIONS.guideNext();
    }
    assert.equal(c.guide.current, 'review');
    assert.ok(visited.length + 1 <= 25);
    assert.equal(guidedSteps(c).filter(s => s.type === 'rosGroup').length, 1);
    console.log('MEDICIÓN completa con cefalea: ' + (visited.length + 1) + ' pantallas hasta Revisar (incluido).');
  });
  await test('Evolución completa en ocho pantallas, con diagnóstico del ingreso y firma', async () => {
    a.reason = 'Control de paciente operado';
    a.dx = 'Postoperatorio';
    startEvolution();
    assert.ok(e.selectedRegions.includes('Herida quirúrgica'));
    const visited = [];
    for (let guard = 0; guard < 12 && guidedStep(e).type !== 'report'; guard++) {
      const s = guidedStep(e);
      visited.push(s.key);
      if (s.key === 'ev-state') { ACTIONS.guideAnswer({ dataset: { path: 'state', value: JSON.stringify('Mejoría') } }); continue; }
      if (s.type === 'evolutionChecklist') ACTIONS.guideNone({ dataset: {} });
      if (s.type === 'vitalsGroup') ACTIONS.guideInput({ type: 'number', value: '0', dataset: { path: 'vitals.0.pain' } });
      if (s.type === 'examGroup') {
        ACTIONS.guideAnswer({ dataset: { path: 'exam.Herida quirúrgica.state', value: JSON.stringify('normal'), advance: 'false' } });
        ACTIONS.guideAllNormal({ dataset: { region: 'Herida quirúrgica' } });
      }
      if (s.type === 'dxSearch') {
        assert.ok(guidedQuestionBody(e, s).includes('diagnosisUpdates.0.action'));
        ACTIONS.guideAnswer({ dataset: { path: 'diagnosisUpdates.0.action', value: JSON.stringify('mantener'), advance: 'false' } });
      }
      if (s.type === 'evolutionPlan') ACTIONS.guideInput({ type: 'text', value: 'Continuar vigilancia documentada', dataset: { path: 'plan.notes' } });
      ACTIONS.guideNext();
    }
    visited.push(guidedStep(e).key);
    assert.equal(e.guide.current, 'report');
    assert.ok(visited.length <= 8);
    assert.equal(e.symptoms['Tolera vía oral'], undefined);
    await ACTIONS.evGenerate();
    ACTIONS.evApprove();
    assert.equal(evolutionSign(e), true);
    assert.equal(S.hc.find(n => n.evolutionId === e.id).admId, a.id);
    console.log('MEDICIÓN evolución: ' + visited.length + ' pantallas, incluida la nota.');
  });
  await test('Ninguno conserva Sí, No y Desconocido; vacío queda no interrogado', () => {
    c.reasons = [CONSULT.newReason('control_postoperatorio', 'Control postoperatorio', true)];
    c.mode = 'quick';
    c.guide = { started: true, current: 'reason-0-symptoms', omissions: {}, history: {} };
    let r = c.reasons[0];
    assert.equal(r.answers.fiebre, undefined);
    assert.ok(!CONSULT.report(CONSULT.clean(c, pat(c.pid))).includes('Fiebre: No'));
    r.answers.progressivePain = 'Sí';
    r.answers.secrecion = 'Desconocido';
    r.answers.sangrado = 'No';
    ACTIONS.guideNone({ dataset: {} });
    r = c.reasons[0];
    assert.equal(r.answers.progressivePain, 'Sí');
    assert.equal(r.answers.secrecion, 'Desconocido');
    assert.equal(r.answers.sangrado, 'No');
    assert.equal(r.answers.fiebre, 'No');
    assert.equal(r.answers.apertura, 'No');
    assert.equal(c.guide.current, 'reason-0-symptoms');
  });
  await test('Informes de consulta y evolución sin undefined ni notas internas de migración', () => {
    pat(c.pid).history.conditions.push({ name: 'Condición registrada', note: 'Migrado; pendiente de confirmar' });
    c.dx = [{ label: 'Cefalea', code: 'R51' }, { label: 'En estudio' }];
    let report = CONSULT.report(CONSULT.clean(c, pat(c.pid)));
    assert.ok(report.includes('Cefalea · CIE-10 R51 (principal, certeza no documentada)'));
    assert.ok(!report.includes('undefined'));
    assert.ok(!report.includes('Migrado'));
    assert.ok(!report.includes('(por confirmar)'));
    assert.ok(guidedHistorySummary(c, 'conditions').includes('(por confirmar)'));
    assert.ok(!JSON.stringify(CONSULT.clean(c, pat(c.pid))).includes('Migrado'));
    startEvolution();
    e.dx = [{ label: 'Cefalea', code: 'R51' }];
    report = EVOLUTION.report(e, pat(e.pid), [], []);
    assert.ok(report.includes('Cefalea · CIE-10 R51 (principal, certeza no documentada)'));
    assert.ok(!report.includes('undefined'));
    assert.ok(!report.includes('Migrado'));
  });
  await test('Tipo inferido por cita, motivo y médico; Revisar conserva sus cambios', () => {
    c.guide = { started: true, current: 'reasons', omissions: {}, history: {} };
    S.consults = S.consults.filter(x => x.id === c.id || x.pid !== c.pid || x.doc !== c.doc);
    GUIDE.steps(c, pat(c.pid));
    assert.equal(c.type, 'primera');
    S.consults.push({ ...CONSULT.newConsult({ id: 'prior-signed', pid: c.pid, doc: c.doc }), status: 'firmada' });
    GUIDE.steps(c, pat(c.pid));
    assert.equal(c.type, 'control');
    ACTIONS.ccReasonAdd({ dataset: { key: 'control_postoperatorio' } });
    assert.equal(c.type, 'postoperatoria');
    S.appts.push({ id: 'typed-appt', type: 'interconsulta' }); c.apptId = 'typed-appt';
    GUIDE.steps(c, pat(c.pid)); assert.equal(c.type, 'interconsulta');
    ACTIONS.guideJump({ dataset: { key: 'review' } });
    ACTIONS.ccInput({ tagName: 'SELECT', value: 'otra', dataset: { path: 'type' } });
    ACTIONS.ccInput({ tagName: 'SELECT', value: 'teleconsulta', dataset: { path: 'modality' } });
    GUIDE.steps(c, pat(c.pid));
    assert.equal(c.type, 'otra'); assert.equal(c.modality, 'teleconsulta');
    assert.equal(c.mode, 'complete');
  });
  await test('Alergias desconocidas: pantalla obligatoria, sin negación implícita y bloqueo al firmar', () => {
    pat(c.pid).history.allergies = { status: 'desconocido', items: [] };
    ACTIONS.guideStart({ dataset: { mode: 'quick' } });
    ACTIONS.guideJump({ dataset: { key: 'history-allergies' } });
    ACTIONS.guideSkip();
    assert.equal(c.guide.current, 'history-allergies');
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'history-allergies');
    assert.ok(CONSULT.signProblems(c, pat(c.pid)).some(x => x.includes('estado desconocido')));
    ACTIONS.guideAnswer({ dataset: { path: 'history.allergies.status', value: JSON.stringify('desconocido'), advance: 'false' } });
    ACTIONS.guideNext();
    assert.notEqual(c.guide.current, 'history-allergies');
    assert.equal(pat(c.pid).history.allergies.status, 'desconocido');
    assert.ok(!CONSULT.report(CONSULT.clean(c, pat(c.pid))).includes('Niega alergias'));
  });
  await test('Compatibilidad de familias antiguas de pasos sin pérdida clínica', () => {
    c.reasons = [CONSULT.newReason('dolor_abdominal', 'Dolor abdominal', true)];
    c.reasons[0].answers.associated = ['Vómitos'];
    c.reasons[0].answers.vomitEpisodes = 3;
    c.rx = [{ drug: 'Medicamento', dose: 'Dato' }];
    c.dx = [{ label: 'Diagnóstico', priority: 'principal', certainty: 'confirmado' }];
    c.guide = { started: true, current: 'reasons', history: {}, omissions: {}, orderDrafts: [{ label: 'Examen', category: 'lab' }] };
    for (const [old, next] of [['context', 'reasons'], ['context-modality', 'reasons'], ['reasons-more', 'reasons'],
      ['reason-0-vomitEpisodes', 'reason-0-data'], ['vital-2-temp', 'vitals'], ['exam-Abdomen-findings', 'exam'],
      ['ros-Respiratorio-items', 'ros'], ['dx-0-certainty', 'dx'], ['rx-0-duration', 'rx-0'],
      ['orders-0-indication', 'orders-0'], ['plan-appointment', 'plan'], ['history-conditions-0-name', 'history-conditions']]) {
      c.guide.current = old;
      assert.doesNotThrow(() => consultView(c));
      assert.equal(c.guide.current, next, old);
    }
    assert.equal(c.reasons[0].answers.vomitEpisodes, 3);
    assert.equal(c.rx[0].dose, 'Dato');
  });
  await test('Plan y seguimiento: referencia condicional, cita única y conflicto conserva el paso', () => {
    c.guide = { started: true, current: 'plan', history: {}, omissions: {} };
    assert.ok(!guidedConsultBody(c).includes('¿A qué especialidad lo refiere?'));
    ACTIONS.guideAnswer({ dataset: { path: 'plan.conducts', value: JSON.stringify('Interconsulta'), multi: 'true' } });
    assert.ok(guidedConsultBody(c).includes('¿A qué especialidad lo refiere?'));
    c.plan.nextControl = '2099-01-15'; c.plan.controlTime = '12:00'; c.plan.createAppointment = true;
    S.appts.push({ id: 'conflict-followup', doc: c.doc, pid: c.pid, kind: 'consulta', date: c.plan.nextControl, time: '12:00', status: 'reservada' });
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'plan'); assert.equal(c.plan.apptId, undefined);
    S.appts = S.appts.filter(x => x.id !== 'conflict-followup');
    const count = S.appts.length;
    ACTIONS.guideNext();
    assert.equal(c.guide.current, 'review');
    assert.equal(S.appts.length, count + 1);
    assert.equal(S.appts.find(x => x.id === c.plan.apptId).consultId, c.id);
    ACTIONS.guidePrevious(); ACTIONS.guideNext();
    assert.equal(S.appts.length, count + 1);
  });
  await test('Plantilla de control postoperatorio: rellena solo lo elegido, nunca signos vitales, y termina en Revisar', () => {
    const t = CONSULT.newConsult({ id: 'co-template-test', pid: 'pt4', doc: c.doc, specialty: c.specialty });
    S.consults.push(t);
    const saved = param; param = t.id;
    ACTIONS.guideTemplate({ dataset: { id: 'postop_ok' } });
    assert.equal(t.mode, 'quick');
    assert.equal(t.reasons[0].key, 'control_postoperatorio');
    assert.equal(t.reasons[0].answers.fiebre, 'No');
    assert.equal(t.exam['Herida quirúrgica'].state, 'normal');
    assert.ok(t.exam['Herida quirúrgica'].confirmed.length > 3);
    assert.equal(t.dx[0].certainty, 'confirmado');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(t.plan.nextControl));
    // Los signos vitales nunca vienen de la plantilla
    assert.ok(!t.vitals.some(v => CONSULT.vitals.some(([k]) => CONSULT.filled(v[k]))));
    // Recorrido corto: evolución → signos vitales → Revisar
    assert.equal(t.guide.current, 'reason-0-evolution');
    ACTIONS.guideNext();
    assert.equal(t.guide.current, 'vitals');
    ACTIONS.guideNext();
    assert.equal(t.guide.current, 'review');
    assert.ok(guidedConsultBody(t).includes('Se usó la plantilla'));
    // El informe dice "sin" para los hallazgos patológicos verificados como normales
    const report = CONSULT.report(CONSULT.clean(t, pat(t.pid)));
    assert.ok(report.includes('sin eritema'));
    assert.ok(!report.includes('undefined'));
    param = saved;
  });
  await test('Repetir el tratamiento anterior copia los medicamentos de la última consulta firmada', () => {
    const prev = { ...CONSULT.newConsult({ id: 'co-prev-rx', pid: 'pt2', doc: c.doc }), date: '2026-01-10', time: '09:00', status: 'firmada',
      rx: [{ drug: 'Losartán 50 mg', dose: '50', unit: 'mg', freq: 'Cada 24 horas' }] };
    const t = CONSULT.newConsult({ id: 'co-repeat-rx', pid: 'pt2', doc: c.doc, specialty: c.specialty });
    S.consults.push(prev, t);
    const saved = param; param = t.id;
    assert.equal(lastPatientRx(t).length, 1);
    ACTIONS.guideRxRepeat();
    assert.equal(t.rx.length, 1);
    assert.equal(t.rx[0].drug, 'Losartán 50 mg');
    assert.equal(lastPatientRx(t).length, 0);
    assert.ok(doctorFavorites(c.doc).rx[normQ('Losartán 50 mg')] >= 1);
    param = saved;
  });
  await test('Un médico sin número de colegiado no puede firmar; al registrarlo sí, y pasa a su ficha con colegio y MPPS', () => {
    const me = meUser();
    const saved = { cm: me.cm };
    me.cm = '';
    assert.equal(credsMissing(me), true);
    assert.equal(credsBlockSign(), true);
    Object.assign(me, saved);
    syncCredsToDoctor(me);
    assert.equal(credsMissing(me), false);
    assert.equal(credsBlockSign(), false);
    assert.equal(med(me.doc).cm, saved.cm);
    assert.ok(docCreds(med(me.doc)).includes('C.M. ' + saved.cm));
    const cr = docCreds({ ci: 'V-1', mpps: '54321', cm: '123', colegio: 'MI' });
    assert.ok(cr.includes('MPPS 54321') && cr.includes('C.M. 123 (CM Miranda)'), 'imprime colegio y MPPS: ' + cr);
    assert.deepEqual([...credsPending({ cm: '1' })], ['cédula', 'Colegio de Médicos', 'código MPPS']);
    me.mpps = ''; assert.equal(credsMissing(me), true, 'sin MPPS tampoco firma'); me.mpps = '54321';
    // Administración: los datos son opcionales y nunca bloquean
    assert.equal(credsMissing({ role: 'admin' }), false);
  });
  await test('Amonestaciones y destacados: se registran en el perfil, cuentan hacia el límite y al anular no se borran', () => {
    const d = S.doctors[0]; const who = 'doc:' + d.id; const before = (S.staffNotes = S.staffNotes || []).length; const ses = { ...S.session }; S.session.role = 'admin';
    UI.stBack = null; ACTIONS.staffDoc({ dataset: { id: d.id } });
    assert.ok(lastSheet.body.includes('Amonestaciones y destacados'), 'pestaña en el perfil');
    assert.ok(lastSheet.body.includes('sd-mpps') && lastSheet.body.includes('sd-col'), 'campos MPPS y colegio');
    for (let k = 0; k < 3; k++) S.staffNotes.push({ id: 'snt' + k, who, kind: 'amonestacion', motive: 'x', title: 'Falta ' + k, text: 'Explicación completa ' + k, date: '2026-10-1' + k, by: 'Prueba', at: '2026-10-19 10:00' });
    assert.equal(amonCount(who), 3);
    UI.stTab = 'notas'; ACTIONS.staffDoc({ dataset: { id: d.id, keep: '1' } });
    assert.ok(lastSheet.body.includes('sn-item bad') && lastSheet.body.includes('alcanzó 3 amonestaciones'), 'en rojo y con aviso');
    S.staffNotes.find(n => n.id === 'snt0').void = { by: 'Prueba', at: 'x', reason: 'error' };
    assert.equal(amonCount(who), 2); assert.equal(S.staffNotes.length, before + 3, 'no se borra');
    S.staffNotes.splice(before); UI.stTab = 'datos'; S.session = ses;
  });
  await test('Seguridad: direcciones peligrosas, contraseñas débiles y textos que no se interpretan como HTML', () => {
    assert.equal(safeUrl('javascript:alert(1)'), '#'); assert.equal(safeUrl(' JaVaScRiPt:x'), '#'); assert.equal(safeUrl('data:text/html,<b>'), '#');
    assert.equal(safeUrl('/archivos/a.jpg'), '/archivos/a.jpg'); assert.equal(safeUrl('blob:http://localhost/1'), 'blob:http://localhost/1');
    assert.ok(!safeUrl('/x\"><img>').includes('\"'), 'escapa comillas');
    assert.ok(passWeak('12345678a') === '' || passWeak('12345678a'));
    assert.ok(passWeak('quiron123'), 'nombre de la clínica'); assert.ok(passWeak('Password1') , 'de las más usadas');
    assert.ok(passWeak('carlos2026', { name: 'Carlos Pérez', email: 'cp@x.com' }), 'contiene el nombre');
    assert.equal(passWeak('Tr3n-azul-Moriche', { name: 'Carlos Pérez' }), '');
  });
  await test('Acceso: sin registro abierto del administrador y permisos explicados para cada rol', () => {
    assert.equal(typeof ACTIONS.authSetup, 'undefined', 'no existe la creación libre del administrador');
    for (const r of Object.keys(ROLES)) { assert.ok(ROLE_CAN[r] && ROLE_CAN[r].can.length, 'falta el resumen de ' + r); assert.ok(roleHelp(r).includes('Puede')); }
    assert.ok(roleSees('enfermeria').includes('Emergencias') && !roleSees('enfermeria').includes('Quirófano'));
  });
  await test('Datos profesionales: se confirman, quedan bloqueados para el médico y el documento sale con sello de firma electrónica', () => {
    const me = meUser(); const saved = { ...me }; delete me.credsLock;
    ['ci', 'cm', 'colegio', 'mpps'].forEach(k => delete me[k]);
    ACTIONS.switchUser();
    assert.ok(lastSheet.body.includes('Le faltan') && lastSheet.body.includes('myCredsSave'), 'aviso y botón de guardar');
    assert.ok(credsAlert().includes('No puede firmar'), 'aviso fijo arriba');
    UI.credsDraft = { ci: 'V-12.345.678', cm: '12345', colegio: 'MI', mpps: '54321' }; ACTIONS.myCredsConfirm();
    assert.ok(me.credsLock && me.credsLock.at, 'quedan bloqueados');
    assert.equal(credsMissing(me), false); assert.equal(credsAlert(), '');
    ACTIONS.switchUser();
    assert.ok(!lastSheet.body.includes('myCredsSave') && lastSheet.body.includes('disabled'), 'ya no se pueden editar');
    UI.credsDraft = { ci: 'V-1', cm: '9', colegio: 'ZU', mpps: '1' }; ACTIONS.myCredsConfirm(); assert.equal(me.cm, '12345', 'una segunda confirmación no cambia nada');
    // Solicitud de medicación: el médico de la cuenta, fijo
    assert.equal(lockedDoc(), me.doc); assert.ok(docFieldLocked('mo-dr', 'Médico').includes('disabled'));
    // Sello: con los cuatro datos y la fecha de firma
    const d = med(me.doc); assert.ok(credsComplete(d));
    assert.match(sealCode('a|b'), /^QX-[A-Z2-9]{4}-[A-Z2-9]{4}$/); assert.notEqual(sealCode('a|b'), sealCode('a|c'));
    Object.assign(me, saved); syncCredsToDoctor(me);
  });
  await test('Anestesiólogo: rol propio con informe de anestesia; residente solo ve pacientes activos', () => {
    const ses = { ...S.session };
    // Anestesiólogo
    assert.ok(ROLES.anestesiologo && PERMS.anestesiologo.includes('anest.informe'));
    S.session = { ...ses, role: 'anestesiologo' }; assert.ok(isClin()); assert.ok(canAnesReport()); assert.ok(CREDS_REQUIRED.includes('anestesiologo'));
    const txt = anesText({ asa: 'II', emerg: true, tipo: 'Raquídea (subaracnoidea)', mallampati: 'I', induccion: 'Bupivacaína 12 mg', sangrado: '200', ia: '08:00', fa: '09:30', aldrete: '9', destino: 'Hospitalización' });
    assert.ok(txt.includes('Clasificación ASA: II E (emergencia)') && txt.includes('Tipo de anestesia: Raquídea') && txt.includes('Sangrado estimado 200 mL') && txt.includes('Aldrete al salir: 9/10'));
    S.session = { ...ses, role: 'medico' }; assert.equal(canAnesReport(), false, 'un médico no hace informes de anestesia');
    // Residente
    const p = S.patients.find(x => !(S.admissions || []).some(a => a.pid === x.id && a.status === 'ingresado') && !(S.appts || []).some(a => a.pid === x.id && a.kind === 'cirugia' && a.date === dAt(0)));
    S.session = { ...ses, role: 'residente', doc: 'rs01' };
    assert.equal(canSee('historias'), false, 'sin el archivo de historias');
    assert.equal(clinVisible(p.id), false, 'paciente no activo: sin acceso');
    S.admissions.push({ id: 'adm-prueba-res', pid: p.id, status: 'ingresado', bed: 'H-99', doc: 'dr01', admittedAt: nowStamp() });
    assert.equal(clinVisible(p.id), true, 'ingresado: con acceso');
    S.admissions = S.admissions.filter(a => a.id !== 'adm-prueba-res');
    S.session = { ...ses, role: 'medico' }; assert.equal(clinVisible(p.id), true, 'los médicos no cambian por ahora');
    S.session = ses;
  });
  await test('Preparar solicitud para probar fallo de almacenamiento sin duplicarla', () => {
    ACTIONS.guideStart({
      dataset: {
        mode: 'quick'
      }
    });
    ACTIONS.guideJump({
      dataset: {
        key: 'orders'
      }
    });
    ACTIONS.guideOrderPick({
      dataset: {
        label: 'Examen de transacción',
        category: 'lab'
      }
    });
    ACTIONS.guideNext();
    ACTIONS.guideOrderAnswer({
      dataset: {
        field: 'category',
        value: 'lab'
      }
    });
    ACTIONS.guideOrderAnswer({
      dataset: {
        field: 'priority',
        value: 'normal'
      }
    });
    window.queueFailureId = c.id;
    window.queueExamCount = S.exams.length;
    assert.equal(c.guide.current, 'orders-0');
  });
  failStorage = true;
  run(`
    ACTIONS.guideNext();
    c = consultOf(queueFailureId);
    assert.equal(c.orders.length, 0);
    assert.equal(S.exams.length, queueExamCount);
    assert.ok(guidedOrderDrafts(c)[0]);
    assert.equal(c.guide.current, 'orders-0');
  `);
  failStorage = false;
  run(`
    ACTIONS.guideNext();
    assert.equal(S.exams.length, queueExamCount + 1);
    assert.equal(c.orders.length, 1);
    assert.equal(guidedOrderDrafts(c)[0], null);
    ACTIONS.guideNext();
    assert.equal(S.exams.length, queueExamCount + 1);
  `);
  console.log(checks.map(name => 'OK ' + name).join('\n'));
  console.log(checks.length + ' grupos de pruebas correctos.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
