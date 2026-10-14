// Consultorio del médico e historia clínica electrónica.
// El médico escribe la historia en el sistema; al firmarla queda bloqueada (solo se agregan notas aclaratorias)
// y los exámenes que pidió llegan solos al laboratorio o a rayos X.

// "libre": el médico escribe sin campos fijos (título + texto). Se guarda el título en motivo y el texto en actual.
// "informe": informe médico de redacción libre (título, destinatario y texto); queda en la historia clínica del paciente.
// "ingreso": la primera historia de una hospitalización o emergencia (motivo, enfermedad actual, examen, diagnóstico y plan).
const NOTE_TYPES = { consulta: 'Consulta', ingreso: 'Historia de ingreso', evolucion: 'Evolución', operatoria: 'Nota operatoria', libre: 'Nota libre', informe: 'Informe médico' };
// Un ingreso sin historia de ingreso firmada empieza por ella; después, evoluciones
const hasIngreso = admId => S.hc.some(n => n.admId === admId && n.type === 'ingreso' && n.status === 'firmada');
function clinicalNoteTitle(n) {
  if (n.evolutionId) return n.type === 'ingreso' ? 'Valoración inicial del ingreso' : 'Evolución médica';
  return NOTE_TYPES[n.type] || 'Historia clínica';
}
const admNoteType = admId => admId && !hasIngreso(admId) ? 'ingreso' : 'evolucion';
const isFree = t => t === 'libre' || t === 'informe';
// Médico que suscribe por defecto: el último que atendió al paciente, o el primero de la lista
const defaultDoc = pid => ME() || S.hc.filter(n => n.pid === pid && n.doc).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0]?.doc || S.appts.find(a => a.pid === pid)?.doc || MEDICOS.find(m => !m.resident)?.id;
const VITALS = [['ta', 'TA', 'mmHg', '120/80'], ['fc', 'FC', 'lpm', '72'], ['fr', 'FR', 'rpm', '16'], ['temp', 'Temp.', '°C', '36,5'], ['sat', 'SatO₂', '%', '98'], ['peso', 'Peso', 'kg', '70'], ['talla', 'Talla', 'cm', '170']];
const imc = v => { const p = parseFloat(String(v.peso || '').replace(',', '.')), t = parseFloat(String(v.talla || '').replace(',', '.')) / 100; return p > 0 && t > 0 ? (p / (t * t)).toFixed(1).replace('.', ',') : ''; };
const ME = () => myDoc();

// ---------- Mi consulta ----------
VIEWS.consultorio = () => {
  const me = ME(); const d = med(me); if (!d) return header('Mi consulta', 'Entra como médico para ver tu consulta');
  const today = S.appts.filter(a => a.date === dAt(0) && (a.doc === me || a.anest === me) && isActive(a)).sort((a, b) => a.time.localeCompare(b.time));
  const fresh = S.exams.filter(e => e.doc === me && e.status === 'listo' && !e.seen);
  const drafts = S.hc.filter(n => n.doc === me && n.status === 'borrador');
  const mine = S.hc.filter(n => n.doc === me && n.status === 'firmada').sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 8);
  const noteFor = a => S.hc.find(n => n.apptId === a.id);
  const hour = new Date().getHours();
  return header(`${hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'}, ${esc(d.name)}`, `${esc(d.esp)} · ${fday(dAt(0))}`, `<button class="btn primary" data-act="newNote">Nueva historia</button>`) +
  `<div class="grid g4">${kpi('Pacientes de hoy', today.filter(a => a.kind !== 'cirugia').length)}${kpi('Cirugías de hoy', today.filter(a => a.kind === 'cirugia').length)}${kpi('Resultados nuevos', fresh.length, 'de exámenes que pediste', fresh.length ? 'alert' : '')}${kpi('Historias sin firmar', drafts.length, '', drafts.length ? 'alert' : '')}</div>
  <div class="grid g2 sec" style="align-items:start">
    <div class="card"><h2>Mis pacientes de hoy</h2><div class="stack">${today.map(a => { const n = noteFor(a); const p = pat(a.pid);
      return `<div class="between"><div class="hstack" style="min-width:0;flex:1;flex-wrap:nowrap"><span class="mono muted">${a.time}</span><div style="min-width:0"><div class="t">${esc(p.name)} ${p.allergies.length ? '<span class="pill allergy">⚠ Alergias</span>' : ''}</div><div class="small muted">${a.kind === 'cirugia' ? (a.anest === me ? 'Anestesia · ' : 'Cirugía · ') + esc(a.proc) : esc(svc(a.svc).name)}</div></div></div>
        <div class="hstack">${statusPill(a.status)}<button class="btn sm ${n?.status === 'firmada' ? '' : 'primary'}" data-act="${n ? 'openNote' : 'newNote'}" data-id="${n?.id || ''}" data-pid="${a.pid}" data-appt="${a.id}" data-type="${a.kind === 'cirugia' ? 'operatoria' : 'consulta'}">${n ? (n.status === 'firmada' ? 'Ver historia' : 'Continuar') : 'Abrir historia'}</button></div></div>`; }).join('') || '<div class="empty">No tienes pacientes agendados hoy.</div>'}</div></div>
    <div class="stack">
      <div class="card"><h2>Resultados nuevos</h2>${fresh.length ? `<div class="stack">${fresh.map(e => `<button class="row" style="padding:8px 0" data-act="openExam" data-id="${e.id}"><div class="grow"><div class="t">${esc(pat(e.pid).name)}</div><div class="s">${esc(e.tests.join(', '))} · ${e.readyAt}</div></div>${examFlagPill(e)}</button>`).join('')}</div>` : '<div class="small muted">No hay resultados nuevos.</div>'}</div>
      ${drafts.length ? `<div class="card"><h2>Sin firmar</h2><div class="stack">${drafts.map(n => `<button class="row" style="padding:8px 0" data-act="openNote" data-id="${n.id}"><div class="grow"><div class="t">${esc(pat(n.pid).name)}</div><div class="s">${NOTE_TYPES[n.type]} · ${fdate(n.date)} ${n.time}</div></div><span class="pill warn">Borrador</span></button>`).join('')}</div></div>` : ''}
      <div class="card"><h2>Mis últimas historias</h2><div class="stack">${mine.map(n => `<button class="row" style="padding:8px 0" data-act="openNote" data-id="${n.id}"><div class="grow"><div class="t">${esc(pat(n.pid).name)}</div><div class="s">${NOTE_TYPES[n.type]} · ${fdate(n.date)} · ${esc((n.dx || [])[0] || '')}</div></div><span class="pill good">Firmada</span></button>`).join('') || '<div class="small muted">Aún no has firmado historias.</div>'}</div></div>
    </div></div>`;
};

// ---------- Historia clínica: crear, editar, firmar ----------
ACTIONS.newNote = el => {
  const ds = el?.dataset || {};
  // El administrador (control maestro) puede redactar informes médicos a nombre del médico que los suscribe
  if (!isClin() && role() !== 'admin') { toast('Solo los médicos y residentes redactan historias clínicas'); return; }
  // Sin paciente indicado (p. ej. "Nueva historia" en Mi consulta) se elige primero con el buscador; nunca se toma uno por defecto
  const pid = ds.pid || null;
  const adm = ds.adm || (pid && activeAdmission(pid)?.id) || null;   // si está ingresado, la nota queda ligada a la hospitalización
  const type = !isClin() ? 'informe' : ds.type || (adm ? admNoteType(adm) : 'consulta');
  ppReset('nt'); UI.ppChanged = UI.ppChanged || {};
  UI.ppChanged.nt = () => { const st = UI.pp.nt; if (!st.pid || st.newPat) return; const n = UI.nt; n.pid = st.pid; n.doc = isClin() ? n.doc : defaultDoc(st.pid);
    n.admId = activeAdmission(st.pid)?.id || null; if (isClin() && !ds.type) n.type = n.admId ? admNoteType(n.admId) : 'consulta'; refreshSheet(noteForm()); };
  UI.nt = { id: null, pid, doc: pid ? defaultDoc(pid) : ME(), apptId: ds.appt || null, admId: adm, type, motivo: type === 'informe' ? 'Informe médico' : '', to: '', actual: '', vitals: {}, examen: '', dx: [''], plan: '', indicaciones: '', recipe: [], tests: [], urgent: false, pickPatient: !ds.pid };
  openNoteEditor();
};
function openNoteEditor() {
  const inf = UI.nt.type === 'informe';
  openSheet(inf ? (UI.nt.id ? 'Informe médico (borrador)' : 'Nuevo informe médico') : UI.nt.id ? 'Historia clínica (borrador)' : 'Nueva historia clínica', noteForm(),
    `<span class="note" id="nt-msg">${inf ? 'Al firmarlo queda guardado en la historia clínica del paciente y no se puede modificar.' : 'Al firmarla queda bloqueada y los exámenes solicitados llegan al laboratorio o a rayos X.'}</span><button class="btn" data-act="saveNote" data-sign="0">Guardar borrador</button><button class="btn primary" data-act="saveNote" data-sign="1">${inf ? 'Firmar y guardar informe' : 'Firmar historia'}</button>`, { wide: true });
}
const allMedNames = () => [...new Set(S.products.filter(p => p.cat === 'Medicamento').map(p => p.name))];
function noteForm() {
  const n = UI.nt;
  // Paso 1: elegir (o registrar) el paciente con el buscador
  if (!n.pid) { const st = ppState('nt');
    return `<div><b class="small">¿A qué paciente le escribe la historia?</b><div class="small muted" style="margin:4px 0 8px">Busque por nombre o cédula. Si es la primera vez que viene, regístrelo como paciente nuevo.</div><div id="pp-nt">${patientPicker('nt')}</div></div>
    ${st.newPat ? '<button class="btn primary" style="justify-self:start" data-act="ntNewPat">Registrar paciente y continuar</button>' : ''}`; }
  const p = pat(n.pid); const v = n.vitals || {};
  const ta = (id, label, val, ph = '') => `<div class="field full"><label for="${id}">${label}</label><textarea class="input" id="${id}" rows="3" placeholder="${ph}">${esc(val || '')}</textarea></div>`;
  const chip = (t, area) => { const on = n.tests.includes(t); return `<button class="btn sm ${on ? 'primary' : ''}" data-act="ntTest" data-t="${esc(t)}" aria-pressed="${on}">${on ? '✓ ' : ''}${esc(t)}</button>`; };
  const head = `${patientBand(p.id, n.admId ? admOf(n.admId)?.bed : '')}${n.pickPatient && !n.id ? `<div class="between"><span class="small muted">Paciente elegido</span><button class="btn ghost sm" data-act="ntChangePat">Cambiar de paciente</button></div>` : ''}
  ${n.admId && admOf(n.admId) ? `<div class="banner">Queda en el ingreso ${esc(admOf(n.admId).num)} (${esc(admOf(n.admId).bed)}) de ${admArea(admOf(n.admId)) === 'emerg' ? 'Emergencias' : 'Hospitalización'}.</div>` : ''}
  <div class="card" style="display:grid;gap:6px"><div class="between"><div><b style="font-size:17px">${esc(p.name)}</b><div class="small muted">${esc(p.code)} · ${esc(p.ci)} · ${ageTxt(p)} · ${p.sex === 'F' ? 'Femenino' : p.sex === 'M' ? 'Masculino' : 'sexo no registrado'}${p.blood ? ' · ' + esc(p.blood) : ''}</div></div>
    <div class="seg" role="group" aria-label="Tipo de nota">${Object.entries(NOTE_TYPES).filter(([k]) => isClin() || k === 'informe').map(([k, t]) => `<button data-act="ntType" data-k="${k}" aria-pressed="${n.type === k}">${t}</button>`).join('')}</div></div>
    ${p.allergies.length ? `<div class="banner allergy"><b>⚠ Alergias:</b>&nbsp;${esc(p.allergies.join(', '))}</div>` : '<div class="small muted">Sin alergias conocidas.</div>'}
    <div class="small muted">Antecedentes: ${esc([...p.conditions, ...p.surgeries].join(', ') || 'ninguno registrado')} · Medicación habitual: ${esc(p.meds.join(', ') || 'ninguna')}</div></div>`;
  if (n.type === 'informe') return head + `<div class="form">
    <div class="field"><label for="nt-title">Título</label><input class="input" id="nt-title" value="${esc(n.motivo || '')}" placeholder="Informe médico"></div>
    <div class="field"><label for="nt-to">Dirigido a (opcional)</label><input class="input" id="nt-to" value="${esc(n.to || '')}" placeholder="Ej. A quien pueda interesar, seguro, empleador"></div>
    ${isClin() ? '' : `<div class="field full"><label for="nt-doc">Médico que suscribe</label><select class="input" id="nt-doc">${[...activeDocs(), ...MEDICOS.filter(m => m.id === UI.nt?.doc && m.active === false)].map(m => `<option value="${m.id}" ${m.id === n.doc ? 'selected' : ''}>${esc(m.name)} · ${esc(m.esp)}</option>`).join('')}</select></div>`}
    <div class="field full"><label for="nt-free">Contenido del informe</label><textarea class="input freetext" id="nt-free" rows="18" placeholder="Redacte el informe libremente…">${esc(n.actual || '')}</textarea></div></div>
    <div class="small muted">El informe queda guardado en la historia clínica del paciente y puede descargarse en PDF con el membrete de la clínica.</div>`;
  if (n.type === 'libre') return head + `<div class="form">
    <div class="field full"><label for="nt-title">Título (opcional)</label><input class="input" id="nt-title" value="${esc(n.motivo || '')}" placeholder="Ej. Interconsulta, informe, nota de seguimiento"></div>
    <div class="field full"><label for="nt-free">Nota</label><textarea class="input freetext" id="nt-free" rows="18" placeholder="Escribe libremente…">${esc(n.actual || '')}</textarea></div></div>
    <div class="small muted">Se firma igual que cualquier historia: al firmarla queda bloqueada y solo se pueden agregar notas aclaratorias.</div>`;
  return head + `<div class="form">
    ${ta('nt-motivo', n.type === 'operatoria' ? 'Cirugía realizada' : n.type === 'ingreso' ? 'Motivo de ingreso' : 'Motivo de consulta', n.motivo, n.type === 'operatoria' ? 'Ej. Colecistectomía laparoscópica' : '¿Por qué viene el paciente?')}
    ${ta('nt-actual', n.type === 'operatoria' ? 'Descripción del procedimiento y hallazgos' : n.type === 'evolucion' ? 'Evolución' : 'Enfermedad actual', n.actual)}
  </div>
  <div><b class="small">Signos vitales</b><div class="vitals">${VITALS.map(([k, l, u, ph]) => `<div class="field"><label for="nv-${k}">${l} <span class="muted">${u}</span></label><input class="input" id="nv-${k}" value="${esc(v[k] || '')}" placeholder="ej. ${ph}" inputmode="decimal" data-in="ntImc"></div>`).join('')}
    <div class="field"><label>IMC</label><div class="input" id="nv-imc" style="background:none">${imc(v) || '—'}</div></div></div></div>
  <div class="form">${ta('nt-examen', 'Examen físico', n.examen)}
    <div class="field full"><label>Diagnósticos</label><div class="stack" id="nt-dx">${n.dx.map((d, i) => `<div class="chip-x"><input class="input" id="nt-dx${i}" value="${esc(d)}" placeholder="Ej. Hernia inguinal derecha (K40.9)" aria-label="Diagnóstico ${i + 1}"><button class="btn ghost" data-act="ntDxDel" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('')}</div><button class="btn sm" style="justify-self:start" data-act="ntDxAdd">Agregar diagnóstico</button></div>
    ${ta('nt-plan', 'Plan', n.plan)}${ta('nt-ind', 'Indicaciones para el paciente', n.indicaciones)}</div>
  <div><div class="between" style="margin-bottom:6px"><b class="small">Récipe</b><button class="btn sm" data-act="ntRxAdd">Agregar medicamento</button></div>
    <datalist id="rx-meds">${allMedNames().map(m => `<option value="${esc(m)}">`).join('')}</datalist>
    <div class="stack">${n.recipe.map((r, i) => `<div class="chip-x rxrow"><input class="input" style="flex:2" id="rx-m${i}" list="rx-meds" value="${esc(r.med)}" placeholder="Medicamento" aria-label="Medicamento"><input class="input" id="rx-d${i}" value="${esc(r.dosis)}" placeholder="Dosis" aria-label="Dosis"><input class="input" id="rx-f${i}" value="${esc(r.frec)}" placeholder="Frecuencia" aria-label="Frecuencia"><input class="input" id="rx-u${i}" value="${esc(r.dur)}" placeholder="Duración" aria-label="Duración"><button class="btn ghost" data-act="ntRxDel" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('') || '<span class="small muted">Sin medicamentos.</span>'}</div></div>
  <div><b class="small">Solicitar exámenes</b>
    <div class="small muted" style="margin:6px 0 4px">Laboratorio</div><div class="hstack">${labTestNames().map(t => chip(t)).join('')}</div>
    <div class="small muted" style="margin:10px 0 4px">Rayos X, ecografía y otros</div><div class="hstack">${IMG_TESTS.map(t => chip(t)).join('')}</div>
    <label class="hstack small" style="margin-top:10px"><input type="checkbox" id="nt-urg" ${n.urgent ? 'checked' : ''}> Urgente</label></div>`;
}
function readNote() {
  const n = UI.nt; const g = id => document.getElementById(id);
  if (g('nt-free')) { n.motivo = g('nt-title').value; n.actual = g('nt-free').value; if (g('nt-to')) n.to = g('nt-to').value; if (g('nt-doc')) n.doc = g('nt-doc').value; return n; }
  if (!n.pid || !g('nt-motivo')) return n;
  n.motivo = g('nt-motivo').value; n.actual = g('nt-actual').value; n.examen = g('nt-examen').value; n.plan = g('nt-plan').value; n.indicaciones = g('nt-ind').value; n.urgent = g('nt-urg').checked;
  n.vitals = Object.fromEntries(VITALS.map(([k]) => [k, g('nv-' + k).value.trim()]));
  n.dx = n.dx.map((_, i) => g('nt-dx' + i)?.value ?? '');
  n.recipe = n.recipe.map((_, i) => ({ med: g('rx-m' + i).value.trim(), dosis: g('rx-d' + i).value.trim(), frec: g('rx-f' + i).value.trim(), dur: g('rx-u' + i).value.trim() }));
  return n;
}
const ntRedraw = () => { readNote(); refreshSheet(noteForm()); };
ACTIONS.ntChangePat = () => { readNote(); UI.nt.pid = null; ppReset('nt'); refreshSheet(noteForm()); };
ACTIONS.ntNewPat = () => { const r = pickerCommit('nt'); if (!r.ok) { document.getElementById('nt-msg').textContent = r.msg; return; } save(); UI.ppChanged.nt(); };
ACTIONS.ntType = el => { readNote(); UI.nt.type = el.dataset.k; refreshSheet(noteForm()); };
ACTIONS.ntTest = el => { readNote(); const t = el.dataset.t; const l = UI.nt.tests; l.includes(t) ? l.splice(l.indexOf(t), 1) : l.push(t); refreshSheet(noteForm()); };
ACTIONS.ntDxAdd = () => { readNote(); UI.nt.dx.push(''); refreshSheet(noteForm()); };
ACTIONS.ntDxDel = el => { readNote(); UI.nt.dx.splice(+el.dataset.i, 1); if (!UI.nt.dx.length) UI.nt.dx.push(''); refreshSheet(noteForm()); };
ACTIONS.ntRxAdd = () => { readNote(); UI.nt.recipe.push({ med: '', dosis: '', frec: '', dur: '' }); refreshSheet(noteForm()); };
ACTIONS.ntRxDel = el => { readNote(); UI.nt.recipe.splice(+el.dataset.i, 1); refreshSheet(noteForm()); };
ACTIONS.ntImc = () => { const v = { peso: val('nv-peso'), talla: val('nv-talla') }; document.getElementById('nv-imc').textContent = imc(v) || '—'; };

// Crea las órdenes de exámenes: una para laboratorio y una por cada estudio de imagen
function createOrders(n) {
  const lab = n.tests.filter(isLabTest); const img = n.tests.filter(t => IMG_TESTS.includes(t)); const out = [];
  const mk = (area, tests) => { const e = { id: uid('ex'), num: 'EX-' + String(S.exSeq++).padStart(4, '0'), pid: n.pid, doc: n.doc, note: n.id, admId: n.admId || null, apptId: n.apptId || null, date: dAt(0), area, tests, priority: n.urgent ? 'urgente' : 'normal', notes: (n.dx || []).filter(Boolean).join('; '), status: 'solicitado', by: '', seen: false, files: [], results: [], report: '' }; S.exams.unshift(e); out.push(e); };
  if (lab.length) mk('laboratorio', lab);
  img.forEach(t => mk('imagen', [t]));
  return out;
}
ACTIONS.saveNote = el => {
  if (UI.nt?.id && S.hc.some(n => n.id === UI.nt.id && n.status === 'firmada')) { toast('La historia firmada solo admite adendas.'); return; }
  const n = readNote(); const sign = el.dataset.sign === '1'; const msg = document.getElementById('nt-msg');
  if (!n.pid) { msg.textContent = 'Primero elija el paciente.'; return; }
  if (isFree(n.type)) { if (!n.actual.trim()) { msg.textContent = n.type === 'informe' ? 'Redacte el contenido del informe antes de guardarlo.' : 'Escribe la nota antes de guardarla.'; return; } }
  else {
    if (sign && !n.motivo.trim()) { msg.textContent = `Para firmar, escriba al menos el ${n.type === 'ingreso' ? 'motivo de ingreso' : n.type === 'operatoria' ? 'nombre de la cirugía' : 'motivo de consulta'}.`; return; }
    if (sign && !n.dx.some(d => d.trim())) { msg.textContent = 'Para firmar, indica al menos un diagnóstico.'; return; }
  }
  if (sign && typeof credsBlockSign === 'function' && credsBlockSign()) return;
  const now = nowStamp(); const data = { pid: n.pid, apptId: n.apptId, admId: n.admId || null, type: n.type, motivo: n.motivo.trim(), actual: n.actual.trim(), vitals: n.vitals, examen: n.examen.trim(), dx: n.dx.map(d => d.trim()).filter(Boolean), plan: n.plan.trim(), indicaciones: n.indicaciones.trim(), recipe: n.recipe.filter(r => r.med), tests: n.tests, urgent: n.urgent, to: (n.to || '').trim(), doc: n.doc || ME() };
  let rec = n.id && S.hc.find(x => x.id === n.id);
  if (!rec) { rec = { id: uid('hc'), date: dAt(0), time: now.slice(11), status: 'borrador', addenda: [], by: actor() }; S.hc.unshift(rec); }
  Object.assign(rec, data);
  let orders = [];
  if (sign) { rec.status = 'firmada'; rec.signedAt = now; orders = createOrders(rec); rec.orders = orders.map(o => o.id); rec.tests = [];
    const ap = rec.apptId && S.appts.find(x => x.id === rec.apptId); if (ap && ap.kind !== 'cirugia' && ['reservada', 'confirmada', 'en_espera'].includes(ap.status)) ap.status = 'atendida'; }
  log(sign ? 'Historia clínica firmada' : 'Historia clínica guardada (borrador)', `${pat(rec.pid).name} · ${NOTE_TYPES[rec.type]}${orders.length ? ' · ' + orders.length + ' orden(es) de exámenes' : ''}`); save();
  closeSheet(); UI.hospTab = rec.admId ? 'evoluciones' : UI.hospTab; if (route === 'pacientes') UI.patTab = 'evoluciones'; render();
  toast(rec.type === 'informe' ? (sign ? 'Informe médico guardado en la historia del paciente y en el archivo de historias' : 'Borrador del informe guardado') : sign ? `Historia firmada${orders.length ? ` · ${orders.length} orden(es) enviadas` : ''}` : 'Borrador guardado');
};

// ---------- Ver historia ----------
ACTIONS.openNote = el => {
  if (!can('pac.historia') && !can('hosp.clinico')) { toast('No tiene acceso a la historia clínica'); return; }
  const n = S.hc.find(x => x.id === el.dataset.id); if (!n) return;
  if (n.consultId) { const c = consultOf(n.consultId); if (c && consultAccessible(c)) { closeSheet(); go('consultas', c.id); } return; }
  if (n.status === 'borrador') {
    if (n.doc !== ME() && role() !== 'admin') { toast('Solo el autor puede editar un borrador'); return; }
    UI.nt = { ...JSON.parse(JSON.stringify(n)), dx: n.dx.length ? [...n.dx] : [''], tests: n.tests || [], pickPatient: false }; openNoteEditor(); return;
  }
  const p = pat(n.pid); const v = n.vitals || {}; const orders = S.exams.filter(e => e.note === n.id);
  const sec = (t, x) => x ? `<div><div class="small muted">${t}</div><div style="white-space:pre-wrap">${esc(x)}</div></div>` : '';
  openSheet(`${clinicalNoteTitle(n)} · ${p.name}`, `${patientBand(p.id, n.admId ? admOf(n.admId)?.bed : '')}<div class="between"><div class="small muted">${fdate(n.date)} ${n.time} · ${esc(med(n.doc)?.name)} · ${esc(med(n.doc)?.esp)}</div><span class="pill good">Firmada ${n.signedAt?.slice(11) || ''}</span></div>
    ${p.allergies.length ? `<div class="banner allergy"><b>⚠ Alergias:</b>&nbsp;${esc(p.allergies.join(', '))}</div>` : ''}
    ${isFree(n.type) ? `${n.motivo ? `<div style="font-size:18px;font-weight:600">${esc(n.motivo)}</div>` : ''}${n.to ? `<div class="small muted">Dirigido a: ${esc(n.to)}</div>` : ''}<div class="freeview">${esc(n.actual)}</div>`
      : sec(n.type === 'operatoria' ? 'Cirugía realizada' : n.type === 'ingreso' ? 'Motivo de ingreso' : 'Motivo de consulta', n.motivo) + sec(n.type === 'operatoria' ? 'Procedimiento y hallazgos' : n.type === 'evolucion' ? 'Evolución' : 'Enfermedad actual', n.actual)}
    ${Object.values(v).some(Boolean) ? `<div><div class="small muted">Signos vitales</div><div class="hstack">${VITALS.filter(([k]) => v[k]).map(([k, l, u]) => `<span class="pill">${l} ${esc(v[k])} ${u}</span>`).join('')}${imc(v) ? `<span class="pill">IMC ${imc(v)}</span>` : ''}</div></div>` : ''}
    ${sec('Examen físico', n.examen)}
    ${n.dx?.length ? `<div><div class="small muted">Diagnósticos</div><ul style="margin:4px 0;padding-left:18px">${n.dx.map(d => `<li>${esc(d)}</li>`).join('')}</ul></div>` : ''}
    ${sec('Plan', n.plan)}${sec('Indicaciones', n.indicaciones)}
    ${n.recipe?.length ? `<div><div class="small muted">Récipe</div><div class="list">${n.recipe.map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.med)}</div><div class="s">${esc([r.dosis, r.frec, r.dur].filter(Boolean).join(' · '))}</div></div></div>`).join('')}</div></div>` : ''}
    ${orders.length ? `<div><div class="small muted">Exámenes pedidos</div><div class="list">${orders.map(e => `<button class="row" data-act="openExam" data-id="${e.id}"><div class="grow"><div class="t">${e.num} · ${esc(e.tests.join(', '))}</div><div class="s">${e.area === 'laboratorio' ? 'Laboratorio' : 'Imagen'}</div></div><span class="pill ${EX_ST[e.status][1]}">${EX_ST[e.status][0]}</span></button>`).join('')}</div></div>` : ''}
    ${n.addenda?.length ? `<div><div class="small muted">Notas aclaratorias</div>${n.addenda.map(a => `<div class="card small" style="margin-top:6px"><div class="muted">${a.at} · ${esc(a.by)}</div><div style="white-space:pre-wrap">${esc(a.text)}</div></div>`).join('')}</div>` : ''}
    ${n.scans?.length ? `<div><div class="small muted">Copia física firmada y sellada</div><div class="list" style="margin-top:6px">${n.scans.map((f, i) => `<a class="row" href="${esc(f.url)}" target="_blank" rel="noopener"><div class="grow"><div class="t">${f.kind === 'pdf' ? 'PDF' : 'Foto'} ${i + 1} · ${esc(f.name || '')}</div><div class="s">Subida el ${f.at} por ${esc(f.by)}</div></div><span class="pill info">Abrir</span></a>`).join('')}</div></div>` : ''}
    <div class="small muted">Historia firmada: no se puede modificar. Las correcciones se agregan como nota aclaratoria y quedan en el historial.</div>`,
    `<button class="btn" data-act="pdfNote" data-id="${n.id}">${n.type === 'informe' ? 'Descargar informe (PDF)' : 'Descargar historia (PDF)'}</button>${n.recipe?.length ? `<button class="btn" data-act="rxPdf" data-id="${n.id}">Récipe (PDF)</button>` : ''}${can('pac.escribir') ? `<button class="btn" data-act="noteScan" data-id="${n.id}">${n.scans?.length ? 'Agregar otra hoja firmada' : 'Subir copia firmada y sellada'}</button>` : ''}${isClin() ? `<button class="btn primary" data-act="addendum" data-id="${n.id}">Agregar nota aclaratoria</button>` : ''}`, { wide: true });
};
ACTIONS.addendum = el => { const n = S.hc.find(x => x.id === el.dataset.id); const c = n?.consultId && consultOf(n.consultId); if (!n || n.status !== 'firmada' || (c ? !(consultAccessible(c) && (c.doc === myDoc() || can('consulta.firmar'))) : !can('pac.escribir'))) return; return openSheet('Nota aclaratoria', `${patientBand(S.hc.find(n => n.id === el.dataset.id)?.pid)}<div class="field"><label for="ad-t">Aclaración o corrección</label><textarea class="input" id="ad-t" rows="5"></textarea></div><div class="small muted">Se agrega a la historia con su nombre, fecha y hora. El texto original no cambia.</div>`,
  `<button class="btn" data-act="openNote" data-id="${el.dataset.id}">Volver</button><button class="btn primary" data-act="saveAddendum" data-id="${el.dataset.id}">Agregar</button>`); };
ACTIONS.saveAddendum = el => {
  const n = S.hc.find(x => x.id === el.dataset.id); if (!n || n.status !== 'firmada') return;
  const c = n.consultId && consultOf(n.consultId);
  if (c ? !(consultAccessible(c) && (c.doc === myDoc() || can('consulta.firmar'))) : !can('pac.escribir')) { toast('No tiene permiso para agregar una adenda.'); return; }
  const t = val('ad-t').trim(); if (!t) { toast('Escriba la nota.'); return; }
  const backup = JSON.parse(JSON.stringify(S)); const entry = { at: nowStamp(), by: actor(), user: S.session?.uid, text: t };
  n.addenda.push(entry); if (c) { c.report.addenda.push({ ...entry }); consultAudit(c, 'adenda_agregada', n.id); }
  log('Nota aclaratoria agregada', n.id); if (!save()) { S = backup; syncStaff(); toast('Error al guardar. La adenda no quedó registrada.'); return; }
  ACTIONS.openNote({ dataset: { id: n.id } }); toast('Adenda guardada; el texto firmado se conserva.');
};

// Los PDF (historia, récipe) se generan en pdf-kit.js con el diseño A4 de la clínica

// La historia impresa, con firma y sello húmedo, se escanea o fotografía y queda junto a la versión digital
ACTIONS.noteScan = el => { UI.scanNote = el.dataset.id; let inp = document.getElementById('nt-scan');
  if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.id = 'nt-scan'; inp.accept = 'image/*,application/pdf'; inp.multiple = true; inp.hidden = true; inp.dataset.ch = 'noteScanFile'; document.body.appendChild(inp); }
  inp.click(); };
ACTIONS.noteScanFile = async el => {
  const files = [...(el.files || [])]; el.value = ''; const n = S.hc.find(x => x.id === UI.scanNote); if (!files.length || !n) return;
  toast('Subiendo…'); let ok = 0;
  for (const f of files) { const isPdf = f.type === 'application/pdf'; if (!isPdf && !f.type.startsWith('image/')) continue;
    try { const url = await storeFile(isPdf ? f : await shrinkImage(f), isPdf); if (!url) continue;
      (n.scans = n.scans || []).push({ url, kind: isPdf ? 'pdf' : 'image', name: f.name, at: nowStamp(), by: actor() }); ok++; } catch (e) {} }
  if (!ok) { toast('No se pudo subir. Use fotos o PDF; si es muy grande, encienda el servidor local.'); return; }
  log('Copia firmada de historia subida', `${pat(n.pid).name} · ${NOTE_TYPES[n.type]} ${fdate(n.date)} · ${ok} archivo(s)`); save(); render(); ACTIONS.openNote({ dataset: { id: n.id } }); toast('Copia firmada guardada junto a la historia');
};
