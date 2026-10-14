// Regresión de Consultas. Solo memoria/DOM simulado; no lee ni escribe pacientes reales.
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'),
  dir = path.join(root, 'quiron'),
  storage = new Map(),
  nodes = new Map(),
  timers = new Map();
let timerId = 0,
  failStorage = false,
  failRevision = false;
const node = id => {
  if (!nodes.has(id)) nodes.set(id, {
    id,
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
    scrollIntoView() {}
  });
  return nodes.get(id);
};
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
    setItem: (k, v) => {
      if (failStorage || failRevision && k.endsWith('-rev')) throw Error('quota');
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
    addEventListener() {},
    body: node('body'),
    documentElement: node('html')
  },
  setTimeout: fn => {
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
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
for (const [, name] of html.matchAll(/<script src="([^"/:]+\.js)"/g)) {
  let code = fs.readFileSync(path.join(dir, name), 'utf8');
  if (name === 'app.js') code = code.slice(0, code.indexOf('(function start()'));
  vm.runInContext(code, ctx, {
    filename: name
  });
}
run("S.users=[{id:'uA',name:'Administración',role:'admin',status:'activo'}];applyUser(S.users[0]);render=()=>{};renderSide=()=>{};closeSheet=()=>{};toast=msg=>{window.lastToast=msg};openSheet=(title,body,footer)=>{window.lastSheet={title,body,footer}};refreshSheet=()=>{};go=(r,p=null)=>{if(consultSaveTimer)consultFlush();route=r;param=p};window.clinicalBaseline=CONSULT.clone(S);");
const checks = [];
const test = (name, code) => {
  run('{' + code + '}');
  checks.push(name);
};
(async () => {
  test('Migración longitudinal sin pérdidas e idempotente', "const p={allergies:['Penicilina'],conditions:['HTA'],meds:['Losartán'],surgeries:['Cirugía 2019']};const legacy=JSON.stringify(p);assert.equal(CONSULT.migratePatient(p),true);assert.equal(p.history.allergies.status,'conocidas');assert.equal(p.history.allergies.items[0].verified,false);assert.equal(JSON.stringify({allergies:p.allergies,conditions:p.conditions,meds:p.meds,surgeries:p.surgeries}),legacy);assert.equal(CONSULT.migratePatient(p),false);const unknown={allergies:[]};CONSULT.migratePatient(unknown);assert.equal(unknown.history.allergies.status,'desconocido');const explicit={allergies:[],history:{allergies:{status:'niega',items:[]},conditions:[{name:'Propio'}]}};CONSULT.migratePatient(explicit);assert.equal(explicit.history.allergies.status,'niega');assert.equal(explicit.history.conditions[0].name,'Propio');");
  test('Paciente nuevo: nombres, documento opcional, edad, contacto y consulta', "route='consultas';param='new';UI.ccNew={givenNames:'Paciente',familyNames:'Prueba',documentType:'sin documento',birth:'1995-10-11',sex:'F',emergencyName:'Contacto Prueba',emergencyPhone:'04120000000'};ACTIONS.ccCreatePatient();window.currentConsult=consultOf(param);window.currentPatient=pat(currentConsult.pid);assert.equal(currentPatient.givenNames,'Paciente');assert.equal(currentPatient.ci,'');assert.equal(CONSULT.age(currentPatient.birth,'2026-10-11'),31);assert.equal(currentPatient.emergencyContact.name,'Contacto Prueba');assert.equal(currentPatient.history.allergies.status,'desconocido');assert.equal(currentConsult.mode,'complete');assert.equal(currentConsult.status,'borrador');");
  test('Menor requiere representante y duplicados requieren revisión', "const count=S.patients.length;UI.ccNew={givenNames:'Menor',familyNames:'Prueba',documentType:'sin documento',birth:CONSULT.caracas().date};ACTIONS.ccCreatePatient();assert.equal(S.patients.length,count);UI.ccNew={givenNames:'Paciente',familyNames:'Prueba',documentType:'sin documento'};UI.ccDuplicatesReviewed=false;ACTIONS.ccCreatePatient();assert.equal(S.patients.length,count);assert.ok(consultDuplicates(UI.ccNew).length);UI.ccNew=null;");
  test('Consulta desde Agenda: vínculo e inicio idempotente', "const a={id:'appt-consult-test',pid:currentPatient.id,doc:currentConsult.doc,date:currentConsult.date,time:currentConsult.time,kind:'consulta',status:'en_espera',svc:'v1'};S.appts.push(a);ACTIONS.beginConsult({dataset:{id:a.id}});window.currentConsult=consultOf(param);const count=S.consults.length;ACTIONS.beginConsult({dataset:{id:a.id}});assert.equal(S.consults.length,count);assert.equal(currentConsult.apptId,a.id);assert.ok(apptFooter(a,currentPatient,()=>'', '').includes('Comenzar consulta'));");
  test('Caracterización y condición de vómitos; descartados fuera del informe', "currentConsult.reasons=[CONSULT.newReason('dolor_abdominal','Dolor abdominal',true)];const r=currentConsult.reasons[0];r.answers={associated:['Vómitos'],vomitEpisodes:4,hematemesis:'Sí',liquids:'No'};assert.ok(CONSULT.visibleQuestions(r.template,r.answers,CONSULT.context(currentPatient,currentConsult)).some(q=>q.id==='vomitEpisodes'));assert.ok(CONSULT.alarms(currentConsult,currentPatient).length===2);r.answers.associated=[];currentConsult.reasons[0]=CONSULT.reconcile(r,CONSULT.context(currentPatient,currentConsult));assert.equal(currentConsult.reasons[0].discarded.vomitEpisodes,4);assert.equal(currentConsult.reasons[0].answers.vomitEpisodes,undefined);assert.ok(!CONSULT.report(CONSULT.clean(currentConsult,currentPatient)).includes('Vómitos: número de episodios'));assert.equal(CONSULT.alarms(currentConsult,currentPatient).length,0);currentConsult.reasons[0].answers.associated=['Vómitos'];assert.equal(CONSULT.reconcile(currentConsult.reasons[0],CONSULT.context(currentPatient,currentConsult)).answers.vomitEpisodes,undefined);");
  test('Respiratorio no examinado y alergia desconocida nunca normales/negadas', "currentConsult.exam.Respiratorio={state:'no_examinado',findings:{Sibilancias:'ruidos previos'},confirmed:['Esfuerzo'],note:'hallazgo oculto'};const data=CONSULT.clean(currentConsult,currentPatient);assert.equal(data.exam.Respiratorio.findings,undefined);const text=CONSULT.report(data);assert.ok(text.includes('Respiratorio: No examinado'));assert.ok(text.includes('Alergias: desconocidas / no confirmadas'));assert.ok(!text.includes('Niega alergias'));assert.ok(!text.includes('hallazgo oculto'));assert.ok(!text.includes('Respiratorio: Normal'));");
  test('Datos vacíos no rellenados, escala sin valor por defecto y examen normal confirmado', "const fresh=CONSULT.newConsult({id:'fresh',pid:currentPatient.id,doc:currentConsult.doc});const q=CONSULT.templates.generic.questions.find(q=>q.type==='scale010');const reason=CONSULT.newReason('otro_motivo','Otro');assert.ok(consultQuestion(reason,0,q).includes('Registrar intensidad'));assert.ok(!consultQuestion(reason,0,q).includes('type=\"range\"'));assert.equal(CONSULT.stepState(fresh,currentPatient,4),'no evaluado');assert.ok(!CONSULT.report(CONSULT.clean(fresh,currentPatient)).includes('Normal'));currentConsult.exam.Respiratorio={state:'normal',confirmed:['Esfuerzo']};assert.ok(CONSULT.report(CONSULT.clean(currentConsult,currentPatient)).includes('Respiratorio: esfuerzo normal'));currentConsult.exam.Respiratorio={state:'no_examinado'};");
  test('Plantillas, alarmas revisables e IPSS opcional solo completo', "for(const id of ['dolor_abdominal','cefalea','dolor_articular','urinarios','dolor_lumbar','tos','fiebre','postop','followup']){assert.equal(CONSULT.templates[id].version,1);assert.ok(CONSULT.templates[id].active);}const r=CONSULT.newReason('cefalea','Cefalea',true);r.answers={onset:'Súbito',intensity:10};currentConsult.reasons=[r];assert.equal(CONSULT.alarms(currentConsult,currentPatient).length,1);ACTIONS.ccAlarmReviewed({dataset:{ref:'0:thunder'}});assert.ok(currentConsult.audit.some(a=>a.action==='alarma_revisada'));const a={ipss:'Sí',ipss0:1,ipss1:1,ipss2:1,ipss3:1,ipss4:1,ipss5:1,ipss6:1,ipssQoL:2};assert.equal(CONSULT.ipss(a).total,7);assert.equal(CONSULT.ipss(a).range,'leve');delete a.ipss2;assert.equal(CONSULT.ipss(a),null);currentConsult.reasons=[CONSULT.newReason('dolor_abdominal','Dolor abdominal',true)];currentConsult.reasons[0].answers.free='Paciente describe dolor desde ayer.';");
  test('IMC, signos imposibles y mediciones sin sobrescribir', "assert.equal(CONSULT.bmi(70,170),24.2);assert.equal(CONSULT.bmi('',170),null);assert.ok(CONSULT.validateVitals({sys:999,hr:0,temp:100,spo2:101}).length===4);assert.ok(CONSULT.validateVitals({sys:80,dia:100}).length);ACTIONS.ccVitalAdd();currentConsult.vitals[0].weight=70;currentConsult.vitals[0].height=170;ACTIONS.ccVitalAdd();assert.equal(currentConsult.vitals.length,2);assert.equal(currentConsult.vitals[0].weight,70);assert.ok(currentConsult.vitals[0].at);currentConsult.vitals[0].sys=999;assert.ok(CONSULT.signProblems(currentConsult,currentPatient).some(e=>e.includes('PAS')));delete currentConsult.vitals[0].sys;");
  test('Antecedentes recurrentes confirmados sin reescribirlos', "const recurrent=pat('pt1');const h=JSON.stringify(recurrent.history);const c=CONSULT.newConsult({id:'recurrent',pid:recurrent.id,doc:currentConsult.doc});S.consults.push(c);param=c.id;assert.ok(consultSummary(c).includes('Penicilina'));assert.ok(consultSummary(c).includes('Levotiroxina'));ACTIONS.ccConfirmHistory();assert.equal(JSON.stringify(recurrent.history.conditions),JSON.stringify(JSON.parse(h).conditions));assert.ok(c.historyConfirmedAt);param=currentConsult.id;");
  test('JSON mínimo sin identificadores, incluso en texto coincidente', "currentConsult.reasons[0].answers.free=currentPatient.name+' '+currentPatient.emergencyContact.phone;const json=JSON.stringify(CONSULT.clean(currentConsult,currentPatient));for(const forbidden of ['pid','doc','apptId','admId','ci','phone','address','audit','report'])assert.ok(!(forbidden in CONSULT.clean(currentConsult,currentPatient)));assert.ok(!json.includes(currentPatient.name));assert.ok(!json.includes(currentPatient.emergencyContact.phone));assert.equal(CONSULT.clean(currentConsult,currentPatient).patient.initials,'P.P.');currentConsult.reasons[0].answers.free='Dolor informado por el paciente.';");
  test('Diagnóstico: sinónimo, CIE local y prioridad/certeza independientes', "assert.ok(consultDxOptions('dolor de cabeza').includes('Cefalea'));UI.ccDxQuery='Diagnóstico libre Z999';ACTIONS.ccDxFree();assert.equal(currentConsult.dx[0].code,undefined);ACTIONS.ccDxAdd({dataset:{i:'3'}});assert.equal(currentConsult.dx[1].priority,'secundario');assert.equal(currentConsult.dx[1].certainty,'presuntivo');assert.equal(currentConsult.dx[1].code,'R10.4');assert.ok(consultDx(currentConsult).includes('pendiente de estudio'));");
  test('Examen solicitado vinculado y prescripción sin descontar inventario', "const qty=stock(S.products.find(p=>p.id==='p8'));UI.ccOrderDraft={label:'Hematología completa',category:'lab',priority:'normal',indication:'Valoración registrada'};ACTIONS.ccOrderAdd();const order=currentConsult.orders[0],e=S.exams.find(e=>e.id===order.examId);assert.equal(e.status,'solicitado');assert.equal(e.consultId,currentConsult.id);assert.equal(e.apptId,currentConsult.apptId);assert.equal(e.pid,currentPatient.id);currentConsult.rx=[{drug:'Cefazolina 1 g',dose:'1',unit:'g',route:'IV',freq:'Según indicación documentada',duration:'1 día'}];assert.equal(stock(S.products.find(p=>p.id==='p8')),qty);assert.ok(consultRx(currentConsult).indexOf('Alergias')<consultRx(currentConsult).indexOf('Agregar medicamento'));assert.ok(CONSULT.report(CONSULT.clean(currentConsult,currentPatient)).includes('prescrito'));");
  test('Guardado real: debounce, error y reintento', "ACTIONS.ccInput({type:'text',tagName:'INPUT',value:'Indicaciones revisadas',dataset:{path:'plan.notes'}});assert.equal(UI.consultSave,'Guardando…');assert.ok(consultSaveTimer);assert.equal(consultFlush(),true);assert.equal(UI.consultSave,'Guardado');");
  failStorage = true;
  test('No anuncia Guardado si localStorage falla', "assert.equal(consultFlush(),false);assert.equal(UI.consultSave,'Error al guardar');");
  failStorage = false;
  run('consultFlush();');
  test('Borrador reabierto desde localStorage conserva datos y no firma al salir', "consultFlush();const saved=JSON.parse(localStorage.getItem(KEY));const c=saved.consults.find(x=>x.id===currentConsult.id);assert.equal(c.plan.notes,'Indicaciones revisadas');assert.equal(c.mode,currentConsult.mode);assert.equal(c.status,'borrador');go('inicio');assert.equal(currentConsult.status,'borrador');S=JSON.parse(localStorage.getItem(KEY));syncStaff();window.currentConsult=consultOf(c.id);window.currentPatient=pat(c.pid);go('consultas',c.id);assert.equal(ccCurrent().id,c.id);");
  test('Rápida ↔ completa: mismo registro, auditoría y sin pérdida clínica', "const id=currentConsult.id,reasons=JSON.stringify(currentConsult.reasons),dx=JSON.stringify(currentConsult.dx),orders=JSON.stringify(currentConsult.orders),rx=JSON.stringify(currentConsult.rx);ACTIONS.ccMode();assert.equal(currentConsult.mode,'quick');assert.ok(GUIDE.steps(currentConsult,currentPatient).length>6);assert.equal(GUIDE.steps(currentConsult,currentPatient).filter(s=>s.type==='vitalsGroup').length,1);assert.equal(GUIDE.steps(currentConsult,currentPatient).filter(s=>s.type==='examGroup').length,1);assert.ok(consultView(currentConsult).includes('Pantalla 1 de'));assert.ok(!consultView(currentConsult).includes('cc-layout'));ACTIONS.ccMode();assert.equal(currentConsult.mode,'complete');assert.equal(currentConsult.id,id);assert.equal(JSON.stringify(currentConsult.reasons),reasons);assert.equal(JSON.stringify(currentConsult.dx),dx);assert.equal(JSON.stringify(currentConsult.orders),orders);assert.equal(JSON.stringify(currentConsult.rx),rx);assert.equal(currentConsult.audit.filter(a=>a.action==='cambio_vista').length,2);");
  run("ACTIONS.guideJump({dataset:{key:'history-allergies'}});ACTIONS.guideAnswer({dataset:{path:'history.allergies.status',value:JSON.stringify('desconocido'),advance:'false'}});ACTIONS.guideJump({dataset:{key:'review'}});");
  await run('ACTIONS.ccGenerate()');
  test('Generación local disponible sin IA y hash no se invalida por generar', "assert.ok(currentConsult.report.draft);assert.equal(currentConsult.report.source,'plantillas');assert.equal(currentConsult.report.sourceHash,CONSULT.hash(currentConsult,currentPatient));assert.ok(!currentConsult.report.stale);assert.equal(currentConsult.status,'pendiente_revision');");
  run("ACTIONS.ccInput({type:'text',tagName:'TEXTAREA',value:'Corrección propia del médico.',dataset:{path:'report.draft'}});");
  await run('ACTIONS.ccGenerate()');
  test('Regenerar conserva corrección al lado y requiere elección', "assert.equal(currentConsult.report.draft,'Corrección propia del médico.');assert.ok(currentConsult.report.candidate.text.includes('Dolor abdominal'));assert.ok(consultReport(currentConsult).includes('Nuevo borrador para elegir o combinar'));ACTIONS.ccCandidateKeep();assert.equal(currentConsult.report.draft,'Corrección propia del médico.');assert.equal(currentConsult.report.candidate,null);ACTIONS.ccApprove();assert.equal(currentConsult.report.approvedHash,CONSULT.hash(currentConsult,currentPatient));");
  test('Cambio clínico deja borrador desactualizado e impide firma', "ACTIONS.ccInput({type:'text',tagName:'INPUT',value:'Plan actualizado',dataset:{path:'plan.notes'}});assert.equal(currentConsult.report.stale,true);assert.equal(consultSign(currentConsult),false);assert.equal(currentConsult.status,'pendiente_revision');assert.equal(currentConsult.report.approvedHash,undefined);");
  await run('ACTIONS.ccGenerate()');
  run('ACTIONS.ccCandidateKeep();ACTIONS.ccApprove();');
  failStorage = true;
  test('Fallo al firmar revierte nota, firma y cita de forma atómica', "const id=currentConsult.id,notes=S.hc.length;assert.equal(consultSign(currentConsult),false);window.currentConsult=consultOf(id);assert.notEqual(currentConsult.status,'firmada');assert.equal(S.hc.length,notes);assert.equal(S.appts.find(a=>a.id===currentConsult.apptId).status,'en_espera');");
  failStorage = false;
  run('consultFlush();');
  test('Paciente nuevo hasta firma: nota clínica única y cita atendida', "assert.equal(consultSign(currentConsult),true);assert.equal(currentConsult.status,'firmada');assert.equal(currentConsult.report.signedText,'Corrección propia del médico.');assert.equal(currentConsult.report.signedBy,currentConsult.doc);assert.ok(currentConsult.report.signedAt);assert.equal(S.hc.filter(n=>n.consultId===currentConsult.id).length,1);assert.equal(S.appts.find(a=>a.id===currentConsult.apptId).status,'atendida');assert.ok(currentConsult.historySnapshot);assert.equal(S.exams.find(e=>e.id===currentConsult.orders[0].examId).note,currentConsult.noteId);assert.equal(consultSign(currentConsult),false);");
  test('Firmado no editable por acciones de captura, modos ni vía formulario antiguo', "const frozen=JSON.stringify(currentConsult),n=S.hc.find(n=>n.id===currentConsult.noteId);ACTIONS.ccInput({type:'text',value:'CAMBIO',dataset:{path:'plan.notes'}});ACTIONS.ccMode();ACTIONS.ccRxAdd();ACTIONS.ccReasonFree();assert.equal(JSON.stringify(currentConsult),frozen);UI.nt={...n,actual:'CAMBIO'};ACTIONS.saveNote({dataset:{sign:'0'}});assert.equal(S.hc.find(x=>x.id===n.id).actual,'Corrección propia del médico.');assert.ok(!consultView(currentConsult).includes('data-in=\"ccInput\"'));");
  node('ad-t').value = 'Adenda documentada por el médico';
  test('Adenda trazable conserva texto firmado y se replica en consulta', "const text=currentConsult.report.signedText;ACTIONS.saveAddendum({dataset:{id:currentConsult.noteId}});assert.equal(currentConsult.report.signedText,text);assert.equal(currentConsult.report.addenda.length,1);assert.equal(S.hc.find(n=>n.id===currentConsult.noteId).addenda.length,1);assert.equal(currentConsult.report.addenda[0].user,'uA');");
  test('Firma usa snapshot longitudinal: cambios posteriores no reescriben informe', "const data=JSON.stringify(CONSULT.clean(currentConsult,currentPatient));currentPatient.history.allergies.status='niega';assert.equal(JSON.stringify(CONSULT.clean(currentConsult,currentPatient)),data);");
  test('Recepción solo agenda/estado; rechaza rutas, creación y adendas clínicas', "S.session={uid:'ur',role:'recepcion',name:'Recepción'};assert.ok(can('consulta.estado'));assert.equal(can('consulta.clinico'),false);const page=VIEWS.consultas();assert.ok(page.includes('Consultas de hoy'));for(const secret of ['Corrección propia','Cefazolina','Dolor abdominal','Diagnósticos previos','Nueva consulta','Pendientes'])assert.ok(!page.includes(secret),secret);assert.ok(VIEWS.consultas(currentConsult.id).includes('No tiene acceso'));const count=S.consults.length;ACTIONS.ccChoosePatient({dataset:{pid:currentPatient.id}});ACTIONS.ccOrderAdd();ACTIONS.ccInput({type:'text',value:'CAMBIO',dataset:{path:'plan.notes'}});ACTIONS.saveAddendum({dataset:{id:currentConsult.noteId}});assert.equal(S.consults.length,count);assert.equal(currentConsult.report.addenda.length,1);assert.ok(!apptFooter(S.appts.find(a=>a.id===currentConsult.apptId),currentPatient,()=>'', '').includes('Comenzar consulta'));S.session={uid:'uA',role:'admin',name:'Administración'};");
  test('Médico ajeno no edita ni firma; residente solo firma su consulta', "const c=CONSULT.newConsult({id:'other-doc',pid:currentPatient.id,doc:'dr01'});S.consults.push(c);S.session={uid:'um',role:'medico',doc:'dr02'};assert.equal(consultAccessible(c),false);assert.equal(consultCanSign(c),false);S.session={uid:'ur',role:'residente',doc:'rs01'};assert.equal(consultAccessible(c),true);assert.equal(consultCanEdit(c),false);assert.equal(consultCanSign(c),false);c.doc='rs01';assert.equal(consultCanSign(c),true);S.session={uid:'uA',role:'admin',name:'Administración'};");
  test('Permisos explícitos y render de todos los pasos del asistente', "const c=S.consults.find(c=>c.id==='other-doc');c.doc='dr01';c.guide={started:true,current:'reasons',omissions:{},history:{}};param=c.id;const list=GUIDE.steps(c,pat(c.pid));for(const s of list){GUIDE.jump(c,list,s.key);assert.ok(consultView(c).includes(esc(s.title)));assert.ok(consultView(c).includes('guide-footer'));}assert.ok(ROLES.medico.nav.some(n=>n&&n[0]==='consultas'));assert.ok(ROLES.residente.nav.some(n=>n&&n[0]==='consultas'));assert.ok(ROLES.admin.nav.some(n=>n&&n[0]==='consultas'));assert.ok(consultView(c).includes('Revisar y firmar el informe'));assert.ok(!consultView(c).includes('Ir a…'));assert.ok(!consultView(c).includes('cc-layout'));assert.ok(!consultView(c).includes('cc-steps'));");
  test('Caracterización canónica y campos pertinentes; texto clínico escapado', "const c=S.consults.find(x=>x.id==='other-doc');const r=CONSULT.newReason('cefalea','Cefalea',true);r.answers={onset:'Gradual',duration:{n:2,unit:'Días'},intensity:4};const rr=CONSULT.reconcile(r);assert.equal(rr.char.onset,'Gradual');assert.equal(rr.char.durN,2);assert.equal(rr.char.durU,'Días');const hidden=CONSULT.newReason('dolor_lumbar','Dolor lumbar');hidden.answers.radiates='No';hidden.char.radiation='Dato oculto previo';const filtered=CONSULT.reconcile(hidden);assert.equal(filtered.char.radiation,undefined);assert.equal(filtered.discarded['char.radiation'],'Dato oculto previo');assert.equal(CONSULT.templates.fiebre.questions.some(q=>q.id==='radiates'),false);currentConsult.plan.notes='<img src=x onerror=alert(1)>';assert.ok(!consultSummary(c).includes('<img src=x'));assert.ok(consultSummary(c).includes('&lt;img'));");
  test('Antecedentes en fichas previas conservan detalles y alergia vacía sigue desconocida', "const p={allergies:['Penicilina'],conditions:['HTA'],meds:['Losartán'],surgeries:[]};CONSULT.migratePatient(p);p.history.allergies.items[0].reaction='Erupción confirmada';CONSULT.applyLegacyClinical(p,{allergies:['Penicilina','Látex'],conditions:['HTA'],meds:['Losartán'],surgeries:[]},'fecha','medico');assert.equal(p.history.allergies.items[0].reaction,'Erupción confirmada');CONSULT.syncLegacy(p);CONSULT.applyLegacyClinical(p,{allergies:[],conditions:['HTA'],meds:['Losartán'],surgeries:[]},'fecha2','medico');assert.equal(p.history.allergies.status,'desconocido');assert.ok(p.history.archivedChanges.length);CONSULT.syncLegacy(p);assert.equal(p.allergies.length,0);assert.equal(p.history.allergies.items[0].reaction,'Erupción confirmada');");
  test('Firma conserva también identificación y médico, y recepción no ve campos clínicos', "const p=pat(currentConsult.pid);const before=JSON.stringify(CONSULT.clean(currentConsult,p));p.birth='2000-01-01';p.name='Nombre actualizado';assert.equal(JSON.stringify(CONSULT.clean(currentConsult,p)),before);assert.ok(currentConsult.report.signedDoctor.name);S.session={uid:'ur',role:'recepcion'};assert.ok(!patientForm(p).includes('pf-all'));assert.ok(!patientForm({}).includes('1990-01-01'));assert.ok(patientForm({}).includes('No documentado'));assert.ok(!patientBand('pt1').includes('Penicilina'));S.session={uid:'uA',role:'admin',name:'Administración'};");
  run('consultFlush();');
  failRevision = true;
  test('Fallo en revisión restaura el JSON previamente guardado', "const old=localStorage.getItem(KEY);const c=S.consults.find(x=>x.id==='other-doc');c.plan.notes='Cambio no guardado por fallo en revisión';assert.equal(consultFlush(),false);assert.equal(localStorage.getItem(KEY),old);assert.equal(STORE.blocked,false);");
  failRevision = false;
  run('consultFlush();');
  test('Otros exámenes conservan categoría correcta', "assert.equal(areaName('otro'),'Otros exámenes');const e={id:'generic-test',pid:'pt1',doc:'dr01',num:'EX-T',area:'otro',tests:['Estudio libre'],date:CONSULT.caracas().date,status:'solicitado',results:[],files:[]};assert.ok(examRow(e).includes('Otros exámenes'));assert.ok(listView().includes('Otros'));");
  if (process.argv.includes('--pdf')) {
    // Usa exactamente la biblioteca y la integridad declaradas por la app; no crea archivos.
    const script = html.match(/<script src="(https:[^"]+jspdf\.umd\.min\.js)" integrity="sha512-([^"]+)"/);
    assert.ok(script, 'Biblioteca jsPDF no encontrada');
    const response = await fetch(script[1], {
      signal: AbortSignal.timeout(20000)
    });
    assert.ok(response.ok);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(require('node:crypto').createHash('sha512').update(bytes).digest('base64'), script[2], 'Integridad jsPDF');
    ctx.navigator = {
      userAgent: 'Quiron pruebas'
    };
    ctx.self = ctx;
    ctx.atob = s => Buffer.from(s, 'base64').toString('binary');
    ctx.btoa = s => Buffer.from(s, 'binary').toString('base64');
    vm.runInContext(bytes.toString('utf8'), ctx, {
      filename: 'jspdf.umd.min.js'
    });
    test('PDF reales: informe, récipe, orden y referencia con pdf-kit', "currentConsult.plan.referral='Medicina interna';for(const kind of ['report','recipe','orders','referral']){const doc=consultPdf(currentConsult,kind);const result=new Uint8Array(doc.output('arraybuffer'));assert.ok(result.length>1000);assert.equal(String.fromCharCode(...result.slice(0,5)),'%PDF-');assert.ok(doc.internal.getNumberOfPages()>=1);}");
  }
  console.log(checks.map(n => 'OK ' + n).join('\n'));
  console.log(checks.length + ' grupos de pruebas correctos.');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
