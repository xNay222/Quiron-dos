function consultAlerts(c) {
  const alarms = CONSULT.alarms(c, pat(c.pid));
  return alarms.map(a => '<div class="banner warn"><div class="grow">' + esc(a.text) + '<div class="small">Considere ampliar a consulta completa.</div></div>' + ccButton('ccAlarmReviewed', c.audit.some(x => x.action === 'alarma_revisada' && x.detail === a.ref) ? 'Revisado' : 'Marcar revisado', 'data-ref="' + a.ref + '"') + '</div>').join('');
}
// Consultas: una ruta propia, sobre el mismo registro en vista rápida o completa.
const consultOf = id => (S.consults || []).find(c => c.id === id);
const consultClinical = () => can('consulta.clinico');
const consultCanEdit = c => !!c && c.status !== 'firmada' && consultClinical() && (c.doc === myDoc() || can('consulta.editar_ajena'));
const consultCanSign = c => consultCanEdit(c) && (c.doc === myDoc() || can('consulta.firmar'));
const consultAccessible = c => consultClinical() && (c.doc === myDoc() || can('consulta.ver_todas'));
const consultSession = () => S.session?.uid;
let consultSaveTimer = null;
addEventListener('pagehide', () => {
  if (consultSaveTimer) consultFlush();
});
addEventListener('beforeunload', () => {
  if (consultSaveTimer) consultFlush();
});
function consultSaveStatus(text) {
  UI.consultSave = text;
  const el = document.getElementById('consult-save');
  if (el) el.textContent = text;
}
function consultFlush() {
  if (consultSaveTimer) clearTimeout(consultSaveTimer);
  consultSaveTimer = null;
  const ok = save();
  consultSaveStatus(ok ? 'Guardado' : 'Error al guardar');
  return ok;
}
function consultDirty(c) {
  delete c.report.approvedHash;
  c.report.stale = !!c.report.draft && c.report.sourceHash !== CONSULT.hash(c, pat(c.pid));
  c.updatedAt = nowStamp();
  consultSaveStatus('Guardando…');
  clearTimeout(consultSaveTimer);
  consultSaveTimer = setTimeout(() => {
    consultSaveTimer = null;
    consultFlush();
  }, 350);
  const stale = document.getElementById('consult-stale');
  if (stale) stale.hidden = !c.report.stale;
  consultRefreshSummary(c);
  const alertBox = document.getElementById('cc-alerts');
  if (alertBox) alertBox.innerHTML = consultAlerts(c);
  c.vitals.forEach((v, i) => {
    const bmi = document.getElementById('cc-bmi-' + i),
      error = document.getElementById('cc-vital-error-' + i);
    if (bmi) bmi.textContent = CONSULT.bmi(v.weight, v.height) ?? 'No calculable sin peso y talla';
    if (error) {
      const errors = CONSULT.validateVitals(v);
      error.hidden = !errors.length;
      error.textContent = errors.join(' · ');
    }
  });
}
function consultAudit(c, action, detail = '') {
  c.audit.push({
    at: new Date().toISOString(),
    user: consultSession(),
    by: actor(),
    action,
    detail
  });
}
function consultTransaction(c, fn) {
  const backup = CONSULT.clone(S);
  try {
    fn();
    if (consultFlush()) return true;
  } catch (e) {
    toast('No se pudo completar la operación.');
  }
  S = backup;
  syncStaff();
  consultSaveStatus('Error al guardar');
  return false;
}
const ccButton = (act, text, attrs = '', cls = '') => '<button class="btn ' + cls + '" data-act="' + act + '" ' + attrs + '>' + text + '</button>';
const ccAttrs = (path, extra = '') => 'data-path="' + esc(path) + '" ' + extra;
function ccField(label, path, value = '', type = 'text', extra = '') {
  const id = 'cc-' + path.replace(/[^a-z0-9]/gi, '-');
  return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><input class="input" id="' + id + '" ' + ccAttrs(path) + ' data-in="ccInput" type="' + type + '" value="' + esc(value ?? '') + '" ' + extra + '></div>';
}
function ccText(label, path, value = '') {
  const id = 'cc-' + path.replace(/[^a-z0-9]/gi, '-');
  return '<div class="field full"><label for="' + id + '">' + esc(label) + '</label><textarea class="input" id="' + id + '" ' + ccAttrs(path) + ' data-in="ccInput" rows="3">' + esc(value || '') + '</textarea></div>';
}
function ccSelect(label, path, value, options, extra = '') {
  const id = 'cc-' + path.replace(/[^a-z0-9]/gi, '-');
  return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><select class="input" id="' + id + '" data-ch="ccInput" ' + ccAttrs(path) + ' ' + extra + '><option value="">No documentado</option>' + options.map(o => {
    const [k, l] = Array.isArray(o) ? o : [o, o];
    return '<option value="' + esc(k) + '" ' + (String(k) === String(value) ? 'selected' : '') + '>' + esc(l) + '</option>';
  }).join('') + '</select></div>';
}
function ccChips(label, path, value, options, multi = false) {
  return '<div class="field full"><label>' + esc(label) + '</label><div class="seg" role="group" aria-label="' + esc(label) + '">' + options.map(o => {
    const [k, l] = Array.isArray(o) ? o : [o, o];
    const on = multi ? (value || []).includes(k) : value === k;
    return '<button type="button" data-act="ccChip" ' + ccAttrs(path) + ' data-value="' + esc(JSON.stringify(k)) + '" data-multi="' + multi + '" aria-pressed="' + on + '">' + esc(l) + '</button>';
  }).join('') + '</div></div>';
}
function ccGet(o, path) {
  return path.split('.').reduce((v, k) => v?.[k], o);
}
function ccSet(o, path, value) {
  const parts = path.split('.');
  if (parts.some(k => ['__proto__', 'constructor', 'prototype'].includes(k))) throw Error('Campo inválido');
  let target = o;
  parts.slice(0, -1).forEach(k => {
    target[k] ||= {};
    target = target[k];
  });
  target[parts.at(-1)] = value;
}
function ccCurrent() {
  const c = consultOf(param);
  return route === 'consultas' && consultCanEdit(c) ? c : null;
}
function ccChanged(c, path) {
  if (path.startsWith('reasons.') || path === 'date') c.reasons = c.reasons.map(r => CONSULT.reconcile(r, CONSULT.context(pat(c.pid), c)));
  if (path.startsWith('history.')) {
    const p = pat(c.pid);
    p.history.updatedAt = new Date().toISOString();
    const parts = path.split('.');
    if (['conditions', 'surgeries', 'meds', 'family'].includes(parts[1]) && p.history[parts[1]][+parts[2]]) p.history[parts[1]][+parts[2]].updatedAt = p.history.updatedAt;
    CONSULT.syncLegacy(p);
    delete c.historyConfirmedAt;
    consultAudit(c, 'antecedente_actualizado', path);
  }
  consultDirty(c);
}
ACTIONS.ccInput = el => {
  const c = ccCurrent();
  if (!c) return;
  const path = el.dataset.path;
  if (path === 'doc' && !can('consulta.asignar')) return;
  const object = path.startsWith('history.') ? pat(c.pid) : c;
  const value = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? el.value === '' ? '' : Number(el.value) : el.value;
  ccSet(object, path, value);
  if (/^rx\.\d+\.drug$/.test(path)) {
    const row = c.rx[+path.split('.')[1]],
      product = S.products.find(p => p.name === value);
    if (product) row.productId = product.id;else delete row.productId;
  }
  if (path === 'report.draft') {
    c.report.edited = true;
    delete c.report.approvedHash;
  }
  ccChanged(c, path);
  if (el.type === 'range') {
    el.nextElementSibling.textContent = el.value;
  }
  if (path === 'type') {
    c.mode = ['control', 'postoperatoria', 'seguimiento', 'urgencia'].includes(c.type) ? 'quick' : 'complete';
    consultAudit(c, 'modalidad_sugerida', c.mode);
    render();
  } else if (path === 'doc') {
    c.specialty = med(c.doc)?.esp || c.specialty;
    c.orders.forEach(o => {
      const e = S.exams.find(e => e.id === o.examId && e.consultId === c.id);
      if (e) e.doc = c.doc;
    });
    consultAudit(c, 'medico_asignado', c.doc);
    render();
  } else if (el.tagName === 'SELECT' && (path.endsWith('.state') || path === 'history.allergies.status')) render();
};
ACTIONS.ccChip = el => {
  const c = ccCurrent();
  if (!c) return;
  const path = el.dataset.path;
  const object = path.startsWith('history.') ? pat(c.pid) : c;
  const v = JSON.parse(el.dataset.value);
  if (el.dataset.multi === 'true') {
    const list = ccGet(object, path) || [];
    ccSet(object, path, list.includes(v) ? list.filter(x => x !== v) : list.concat(v));
  } else ccSet(object, path, ccGet(object, path) === v ? '' : v);
  ccChanged(c, path);
  render();
};
function consultSummary(c) {
  const p = pat(c.pid),
    h = c.status === 'firmada' ? c.historySnapshot : p.history;
  const prev = (S.consults || []).filter(x => x.pid === p.id && x.id !== c.id && x.status === 'firmada').sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0];
  const previousDetails = prev ? [...prev.reasons.map(r => r.answers.evolution || r.answers.free || '').filter(Boolean), prev.plan.notes || ''].join(' · ') : '';
  const notes = S.hc.filter(n => n.pid === p.id && n.status === 'firmada' && n.consultId !== c.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const exams = S.exams.filter(e => e.pid === p.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return '<div class="stack"><div class="patient-band"><div class="grow"><b>' + esc(p.name) + '</b><div class="small muted">' + esc(p.code) + ' · ' + (CONSULT.age(p.birth, c.date) === null ? 'Edad no documentada' : CONSULT.age(p.birth, c.date) + ' años') + '</div></div></div><div class="banner allergy">' + esc(CONSULT.allergyText(h)) + '</div><div class="small"><b>Crónicas</b><p>' + esc((h?.conditions || []).map(x => x.name + ' · ' + (x.state || 'no documentado')).join('; ') || 'No documentadas') + '</p><b>Medicación activa</b><p>' + esc((h?.meds || []).filter(x => x.active === true).map(x => [x.drug, x.dose, x.freq, x.route].filter(Boolean).join(' · ')).join('; ') || 'No documentada') + '</p><b>Cirugías</b><p>' + esc((h?.surgeries || []).map(x => x.name).join('; ') || 'No documentadas') + '</p></div><div class="small"><b>Última consulta</b><p>' + esc(prev ? prev.date + ' · ' + prev.reasons.map(r => r.label).join(', ') : notes[0] ? notes[0].date + ' · ' + (notes[0].motivo || 'Nota clínica') : 'No hay consulta anterior registrada') + (previousDetails ? ' · ' + esc(previousDetails.slice(0, 420)) : '') + '</p><b>Diagnósticos previos (sin confirmar)</b><p>' + esc([...new Set((prev?.dx || []).map(d => d.label).concat(notes.flatMap(n => n.dx || [])))].join('; ') || 'No documentados') + '</p></div><div class="small"><b>Motivo actual</b><p>' + esc(c.reasons.map(r => r.label).join('; ') || 'No documentado') + '</p><b>Signos registrados</b>' + c.vitals.map(v => '<p>' + esc((v.at || '') + ' · ' + CONSULT.vitals.filter(([k]) => CONSULT.filled(v[k])).map(([k, l, u]) => l + ' ' + v[k] + ' ' + u).join('; ')) + '</p>').join('') + '</div><div class="small"><b>Exámenes recientes</b>' + exams.map(e => '<p>' + esc(e.date + ' · ' + e.tests.join(', ') + ' · ' + (EX_ST[e.status]?.[0] || e.status)) + '</p>').join('') + '</div>' + ccButton('ccHistory', 'Ver historia completa', 'data-pid="' + p.id + '"') + '</div>';
}
function consultRefreshSummary(c) {
  const box = document.getElementById('consult-summary');
  if (box) box.innerHTML = consultSummary(c);
}
ACTIONS.ccHistory = el => {
  if (!consultClinical()) return;
  UI.patTab = 'evoluciones';
  go('pacientes', el.dataset.pid);
};
function consultPatientResults(query) {
  if (!consultClinical()) return '';
  const q = normQ(query), digits = String(query || '').replace(/\D/g, '');
  const matches = S.patients.filter(p => {
    const text = [p.name, p.ci, p.code, p.phone, p.givenNames, p.familyNames];
    const numeric = [p.ci, p.phone, p.code];
    return text.some(value => normQ(value).includes(q)) ||
      digits.length >= 4 && numeric.some(value => String(value || '').replace(/\D/g, '').includes(digits));
  });
  return matches.slice(0, 25).map(p =>
    '<button class="row" data-act="ccChoosePatient" data-pid="' + p.id + '"><div class="grow"><div class="t">' +
    esc(p.name) + '</div><div class="s">' + esc(p.ci || 'Sin documento') + ' · ' +
    esc(p.code) + ' · ' + esc(p.phone) + '</div></div></button>'
  ).join('') || '<p class="empty">Sin coincidencias. Puede registrar al paciente.</p>';
}

const ccInputNew = (key, label, type = 'text') => '<div class="field"><label for="cc-new-' + key + '">' + label + '</label><input class="input" id="cc-new-' + key + '" type="' + type + '" data-in="ccNewInput" data-key="' + key + '" value="' + esc(UI.ccNew?.[key] || '') + '"></div>';
function consultNewPatient() {
  const p = UI.ccNew || {};
  const years = CONSULT.age(p.birth);
  return '<details class="card" ' + (UI.ccNewOpen ? 'open' : '') + '><summary>Registrar paciente nuevo</summary><p class="small muted">Los posibles duplicados se revisan antes de registrar. La cédula es opcional.</p><div class="form">' + ccInputNew('givenNames', 'Nombres') + ccInputNew('familyNames', 'Apellidos') + '<div class="field"><label for="cc-new-document">Tipo de documento</label><select class="input" id="cc-new-document" data-ch="ccNewInput" data-key="documentType">' + ['V', 'E', 'pasaporte', 'otro', 'sin documento'].map(v => '<option ' + (v === (p.documentType || 'V') ? 'selected' : '') + '>' + v + '</option>').join('') + '</select></div>' + ccInputNew('document', 'Número de documento') + ccInputNew('birth', 'Fecha de nacimiento', 'date') + '<div id="cc-new-age" class="small">' + (years === null ? 'Edad no documentada' : years + ' años') + '</div><div class="field"><label for="cc-new-sex">Sexo registrado</label><select class="input" id="cc-new-sex" data-ch="ccNewInput" data-key="sex"><option value="">No documentado</option>' + ['F', 'M', 'Otro'].map(v => '<option ' + (p.sex === v ? 'selected' : '') + '>' + v + '</option>').join('') + '</select></div>' + ccInputNew('phone', 'Teléfono') + ccInputNew('emergencyName', 'Contacto de emergencia · nombre') + ccInputNew('emergencyPhone', 'Contacto de emergencia · teléfono') + ccInputNew('representativeName', 'Representante (requerido si es menor)') + ccInputNew('representativeDocument', 'Documento del representante') + ccInputNew('representativePhone', 'Teléfono del representante') + '</div><div id="cc-duplicates" aria-live="polite"></div>' + ccButton('ccCreatePatient', 'Registrar y comenzar', '', 'primary') + '</details>';
}
function consultDuplicates(d) {
  const name = normQ([d.givenNames, d.familyNames].filter(Boolean).join(' ')).trim(),
    ci = String(d.document || '').replace(/\W/g, '').toLowerCase(),
    phone = String(d.phone || '').replace(/\D/g, '');
  return S.patients.filter(p => name.length > 5 && normQ(p.name).includes(name) || ci.length > 3 && String(p.ci || '').replace(/\W/g, '').toLowerCase().endsWith(ci) || phone.length > 6 && String(p.phone || '').replace(/\D/g, '') === phone);
}
ACTIONS.ccNewInput = el => {
  if (!consultClinical() || !can('consulta.registrar')) return;
  UI.ccNew ||= {
    documentType: 'V'
  };
  UI.ccNew[el.dataset.key] = el.value;
  UI.ccNewOpen = true;
  UI.ccDuplicatesReviewed = false;
  const years = CONSULT.age(UI.ccNew.birth);
  document.getElementById('cc-new-age').textContent = years === null ? 'Edad no documentada' : years + ' años';
  const duplicates = consultDuplicates(UI.ccNew);
  document.getElementById('cc-duplicates').innerHTML = duplicates.length ? '<div class="banner warn">Posibles duplicados: ' + duplicates.map(p => esc(p.name + ' · ' + p.code)).join('; ') + '</div>' + ccButton('ccReviewDuplicates', 'Revisé los duplicados; es otra persona') : '';
};
ACTIONS.ccReviewDuplicates = () => {
  if (consultClinical()) {
    UI.ccDuplicatesReviewed = true;
    toast('Revisión de duplicados registrada para esta ficha.');
  }
};
ACTIONS.ccCreatePatient = () => {
  if (!consultClinical() || !can('consulta.registrar')) return;
  const d = UI.ccNew || {};
  if (!d.givenNames?.trim() || !d.familyNames?.trim()) {
    toast('Registre nombres y apellidos por separado.');
    return;
  }
  if (d.birth && (CONSULT.age(d.birth) === null || new Date(d.birth + 'T12:00:00Z').toISOString().slice(0, 10) !== d.birth)) {
    toast('Verifique la fecha de nacimiento.');
    return;
  }
  if (CONSULT.age(d.birth) !== null && CONSULT.age(d.birth) < 18 && !d.representativeName?.trim()) {
    toast('Registre el representante del menor.');
    return;
  }
  if ((d.documentType || 'V') !== 'sin documento' && !d.document?.trim()) {
    toast('Indique el documento o seleccione Sin documento.');
    return;
  }
  const duplicates = consultDuplicates(d);
  if (duplicates.length && !UI.ccDuplicatesReviewed) {
    toast('Revise los posibles duplicados antes de continuar.');
    return;
  }
  const seq = Math.max(100, ...S.patients.map(p => +(p.code || '').replace(/\D/g, '') || 0)) + 1;
  const p = {
    id: uid('pt'),
    code: 'QRN-' + String(seq).padStart(6, '0'),
    name: d.givenNames.trim() + ' ' + d.familyNames.trim(),
    givenNames: d.givenNames.trim(),
    familyNames: d.familyNames.trim(),
    documentType: d.documentType || 'V',
    ci: d.documentType === 'sin documento' ? '' : (d.documentType || 'V') + '-' + d.document.trim(),
    birth: d.birth || '',
    sex: d.sex || '',
    phone: d.phone || '',
    address: '',
    emergencyContact: {
      name: d.emergencyName || '',
      phone: d.emergencyPhone || ''
    },
    emergency: [d.emergencyName, d.emergencyPhone].filter(Boolean).join(' · '),
    representative: {
      name: d.representativeName || '',
      ci: d.representativeDocument || '',
      phone: d.representativePhone || ''
    },
    allergies: [],
    conditions: [],
    surgeries: [],
    meds: [],
    notes: [],
    consents: []
  };
  CONSULT.migratePatient(p);
  const backup = CONSULT.clone(S);
  S.patients.push(p);
  log('Paciente registrado en Consultas', p.code + (duplicates.length ? ' · duplicados revisados' : ''));
  if (!consultFlush()) {
    S = backup;
    return;
  }
  UI.ccNew = null;
  ACTIONS.ccChoosePatient({
    dataset: {
      pid: p.id
    }
  });
};
ACTIONS.ccChoosePatient = el => {
  if (!consultClinical()) return;
  consultStart({
    pid: el.dataset.pid
  });
};
function consultStart({
  pid,
  apptId = null,
  admId = null,
  type = 'primera',
  doc = null
}) {
  if (!consultClinical() || !can('consulta.crear') || !pat(pid)) return;
  const ap = apptId && S.appts.find(a => a.id === apptId);
  if (ap && (ap.kind !== 'consulta' || ap.pid !== pid || ['cancelada', 'no_asistio'].includes(ap.status))) return;
  const existing = apptId && S.consults.find(c => c.apptId === apptId && c.status !== 'cancelada');
  if (existing) {
    if (consultAccessible(existing)) {
      closeSheet();
      go('consultas', existing.id);
    }
    return;
  }
  CONSULT.migratePatient(pat(pid));
  doc = doc || ap?.doc || myDoc();
  if (!can('consulta.asignar') && doc && doc !== myDoc()) {
    toast('La cita corresponde a otro médico.');
    return;
  }
  doc = doc || activeDocs()[0]?.id || '';
  const c = CONSULT.newConsult({
    id: uid('co'),
    pid,
    doc,
    apptId,
    admId,
    type,
    specialty: med(doc)?.esp || 'Medicina general'
  });
  consultAudit(c, 'creada', apptId ? 'Desde agenda' : 'Nueva consulta');
  S.consults.push(c);
  if (!consultFlush()) {
    S.consults.pop();
    return;
  }
  UI.consultStep = 0;
  closeSheet();
  go('consultas', c.id);
}
ACTIONS.beginConsult = el => {
  const a = S.appts.find(x => x.id === el.dataset.id);
  if (a) consultStart({
    pid: a.pid,
    apptId: a.id,
    doc: a.doc
  });
};
ACTIONS.ccOpen = el => {
  const c = consultOf(el.dataset.id);
  if (c && consultAccessible(c)) {
    UI.consultStep = 0;
    go('consultas', c.id);
  }
};
function consultListRows(list, clinical) {
  return list.map(c => '<div class="row"><div class="grow"><div class="t">' + esc(pat(c.pid)?.name || 'Paciente') + '</div><div class="s">' + esc(fdate(c.date) + ' ' + c.time + ' · ' + (med(c.doc)?.name || 'Médico no asignado') + ' · ' + c.specialty + ' · ' + (CONSULT.types[c.type] || c.type)) + '</div></div><span class="pill ' + (c.status === 'firmada' ? 'good' : 'warn') + '">' + esc(c.status === 'firmada' ? 'Finalizada y firmada' : c.status === 'pendiente_revision' ? 'Pendiente de revisión' : 'Borrador guardado') + '</span>' + (clinical ? ccButton('ccOpen', c.status === 'firmada' ? 'Ver' : 'Continuar', 'data-id="' + c.id + '"') : '') + '</div>').join('') || '<div class="empty">No hay consultas en este grupo.</div>';
}
function consultPrevious() {
  if (!consultClinical()) return '';
  const f = UI.ccFilters || {};
  const list = S.consults.filter(c => c.status === 'firmada' && consultAccessible(c)).filter(c => (!f.patient || normQ(pat(c.pid)?.name + ' ' + pat(c.pid)?.code + ' ' + pat(c.pid)?.ci).includes(normQ(f.patient))) && (!f.doc || c.doc === f.doc) && (!f.date || c.date === f.date) && (!f.specialty || normQ(c.specialty).includes(normQ(f.specialty))) && (!f.dx || c.dx.some(d => normQ(d.label).includes(normQ(f.dx))))).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return consultListRows(list, true);
}
ACTIONS.ccFilter = el => {
  if (!consultClinical()) return;
  UI.ccFilters ||= {};
  UI.ccFilters[el.dataset.key] = el.value;
  document.getElementById('cc-previous').innerHTML = consultPrevious();
};
ACTIONS.ccSearchPatient = el => {
  if (!consultClinical()) return;
  UI.ccPatientQuery = el.value;
  document.getElementById('cc-patient-results').innerHTML = consultPatientResults(el.value);
};
VIEWS.consultas = id => {
  if (!can('consulta.estado')) return header('Consultas', 'No tiene acceso a esta sección.');
  if (id && id !== 'new') {
    const c = consultOf(id);
    if (!c || !consultAccessible(c)) return header('Consultas', 'No tiene acceso al contenido clínico.');
    return consultView(c);
  }
  const clinical = consultClinical();
  const today = CONSULT.caracas().date;
  const list = S.consults.filter(c => !clinical || consultAccessible(c));
  const appts = S.appts.filter(a => a.kind === 'consulta' && a.date === today && (!agendaOwn() || a.doc === myDoc()));
  const open = list.filter(c => c.status !== 'firmada' && c.status !== 'cancelada');
  const fresh = list.filter(c => c.date === today || open.includes(c));
  return header('Consultas', clinical ? 'Atención guiada · borradores y consultas firmadas' : 'Agenda y estado de atención', clinical ? '<button class="btn primary" data-act="ccNewMenu">Nueva consulta</button>' : '') + '<div class="stack"><section class="card"><h2>Consultas de hoy</h2><div class="list">' + appts.filter(a => !fresh.some(c => c.apptId === a.id)).map(a => '<div class="row"><div class="grow"><div class="t">' + esc(pat(a.pid)?.name) + '</div><div class="s">' + esc(a.time + ' · ' + (med(a.doc)?.name || '') + ' · ' + (med(a.doc)?.esp || '') + ' · ' + ageTxt(pat(a.pid))) + '</div></div>' + statusPill(a.status) + (clinical && !['cancelada', 'no_asistio', 'atendida'].includes(a.status) ? ccButton('beginConsult', 'Comenzar consulta', 'data-id="' + a.id + '"') : '') + '</div>').join('') + consultListRows(fresh, clinical) + '</div></section>' + (clinical ? '<section class="card" id="cc-new"><h2>Nueva consulta</h2><label for="cc-patient-query" class="small muted">Cédula, nombres, apellidos, teléfono o QRN</label><input class="input" id="cc-patient-query" data-in="ccSearchPatient" value="' + esc(UI.ccPatientQuery || '') + '" autocomplete="off"><div class="list" id="cc-patient-results">' + consultPatientResults(UI.ccPatientQuery || '') + '</div></section>' + consultNewPatient() + '<section class="card"><h2>Pendientes</h2><div class="list">' + consultListRows(open, true) + '</div></section><section class="card"><h2>Anteriores</h2><div class="form">' + ['patient', 'specialty', 'dx'].map(k => '<div class="field"><label for="cc-filter-' + k + '">' + {
    patient: 'Paciente',
    specialty: 'Especialidad',
    dx: 'Diagnóstico'
  }[k] + '</label><input class="input" id="cc-filter-' + k + '" data-in="ccFilter" data-key="' + k + '" value="' + esc(UI.ccFilters?.[k] || '') + '"></div>').join('') + '<div class="field"><label for="cc-filter-date">Fecha</label><input class="input" type="date" id="cc-filter-date" data-ch="ccFilter" data-key="date" value="' + esc(UI.ccFilters?.date || '') + '"></div><div class="field"><label for="cc-filter-doc">Médico</label><select class="input" id="cc-filter-doc" data-ch="ccFilter" data-key="doc"><option value="">Todos</option>' + MEDICOS.map(d => '<option value="' + d.id + '" ' + (UI.ccFilters?.doc === d.id ? 'selected' : '') + '>' + esc(d.name) + '</option>').join('') + '</select></div></div><div class="list" id="cc-previous">' + consultPrevious() + '</div></section>' : '') + '</div>';
};
VIEWS.consultas_after = id => {
  if (id === 'new') ACTIONS.ccNewMenu();
  const c = id && consultOf(id);
  if (c?.guide?.started) document.getElementById('guide-body')?.querySelector('input:not([type=checkbox])')?.focus({
    preventScroll: true
  });
};
function consultConfig(c) {
  return '<div class="form">' + ccSelect('Médico tratante', 'doc', c.doc, MEDICOS.filter(d => d.active !== false || d.id === c.doc).map(d => [d.id, d.name]), can('consulta.asignar') ? '' : 'disabled') + ccField('Especialidad', 'specialty', c.specialty) + ccSelect('Tipo de consulta', 'type', c.type, Object.entries(CONSULT.types)) + ccChips('Modalidad', 'modality', c.modality, Object.entries(CONSULT.modes)) + ccField('Fecha · Caracas', 'date', c.date, 'date') + ccField('Hora · Caracas', 'time', c.time, 'time') + '</div><p class="small muted">Primera y preoperatoria sugieren consulta completa; control, seguimiento, postoperatoria y urgencia sugieren rápida. Puede cambiar de vista conservando los datos.</p>';
}
function consultReasons(c, questions = false, only = null, questionIds = null) {
  const search = questions ? '' : '<label for="cc-reason-search" class="small muted">Buscar motivo o escribir uno libre</label>' + '<input class="input" id="cc-reason-search" data-in="ccReasonSearch" value="' + esc(UI.ccReasonQuery || '') + '">' + '<div class="hstack" id="cc-reason-results">' + consultReasonOptions(c, UI.ccReasonQuery || '') + '</div>';
  const rows = c.reasons.map((r, i) => {
    if (only !== null && only !== i) return '';
    const template = r.template || CONSULT.templateFor(r.key);
    const tools = (r.main ? '<span class="pill info">Principal</span>' : ccButton('ccReasonMain', 'Marcar principal', 'data-i="' + i + '"')) + ccButton('ccRemove', 'Quitar', 'data-list="reasons" data-i="' + i + '"');
    let body = '<div class="small muted">' + esc(template.name) + ' · versión ' + r.templateVersion + '</div>';
    if (questions) {
      const visible = CONSULT.visibleQuestions(template, r.answers, CONSULT.context(pat(c.pid), c)).filter(q => !questionIds || questionIds.includes(q.id));
      const score = CONSULT.ipss(r.answers);
      body = '<div class="form">' + visible.map(q => consultQuestion(r, i, q)).join('') + '</div>' + (score ? '<p class="pill">IPSS ' + score.total + ' · ' + score.range + '</p>' : '') + '<p class="small muted">' + Object.keys(r.discarded).length + ' respuestas descartadas por condición (excluidas del informe).</p>';
    }
    return '<section class="card"><div class="between"><h2>' + esc(r.label) + '</h2><div class="hstack">' + tools + '</div></div>' + body + '</section>';
  }).join('');
  return '<div class="stack">' + search + rows + '</div>';
}
function consultReasonOptions(c, q) {
  const ordered = c.mode === 'quick' ? CONSULT.reasons.filter(r => r.group === 'Rápida').concat(CONSULT.reasons.filter(r => r.group !== 'Rápida')) : CONSULT.reasons;
  const matches = ordered.filter(r => r.key !== 'otro_motivo' && r.label !== 'Otro' && normQ(r.label + ' ' + r.group).includes(normQ(q)) );
  // "Otro motivo" siempre al final de la lista, aunque no se haya buscado nada
  const other = CONSULT.reasons.find(r => r.key === 'otro_motivo');
  const unique = [...new Map(matches.map(r => [r.key, r])).values()].slice(0, q ? 25 : 12).concat(other ? [other] : []);
  // "Otro motivo" no se agrega con ese nombre: abre un campo para escribirlo
  return unique.map(r => r.key === 'otro_motivo' ? (UI.ccReasonOther ? '<div class="guide-other"><input class="input" id="cc-reason-other" placeholder="Escriba el motivo de consulta" autocomplete="off">' +
      ccButton('ccReasonOtherAdd', 'Agregar', '', 'primary') + '</div>' : ccButton('ccReasonOther', 'Otro motivo (escribir)')) :
    ccButton('ccReasonAdd', (c.reasons.some(x => x.key === r.key) ? '✓ ' : '') + esc(r.label),
      'data-key="' + r.key + '" aria-pressed="' + c.reasons.some(x => x.key === r.key) + '"')).join('') + (q ? ccButton('ccReasonFree', 'Añadir texto libre: ' + esc(q)) : '');
}
ACTIONS.ccReasonSearch = el => {
  const c = ccCurrent();
  if (!c) return;
  UI.ccReasonQuery = el.value;
  document.getElementById('cc-reason-results').innerHTML = consultReasonOptions(c, el.value);
};
ACTIONS.ccReasonAdd = el => {
  const c = ccCurrent();
  if (!c) return;
  const r = CONSULT.reasons.find(r => r.key === el.dataset.key);
  if (!r) return;
  const index = c.reasons.findIndex(x => x.key === r.key);
  if (index >= 0) {
    c.reasons.splice(index, 1);
    if (c.reasons.length && !c.reasons.some(x => x.main)) c.reasons[0].main = true;
    consultDirty(c);
    render();
    return;
  }
  c.reasons.push(CONSULT.newReason(r.key, r.label, !c.reasons.length));
  consultDirty(c);
  render();
};
ACTIONS.ccReasonFree = () => {
  const c = ccCurrent();
  if (!c || !UI.ccReasonQuery?.trim()) return;
  c.reasons.push(CONSULT.newReason('otro_motivo', UI.ccReasonQuery.trim(), !c.reasons.length));
  consultDirty(c);
  render();
};
ACTIONS.ccReasonMain = el => {
  const c = ccCurrent();
  if (!c) return;
  c.reasons.forEach((r, i) => r.main = i === +el.dataset.i);
  consultDirty(c);
  render();
};
function consultQuestion(r, i, q) {
  const path = 'reasons.' + i + '.answers.' + q.id,
    v = r.answers[q.id];
  const opts = q.type === 'yesno' ? ['Sí', 'No'] : q.type === 'yesnounk' ? ['Sí', 'No', 'Desconocido'] : q.options;
  const help = q.help ? '<p class="small muted">' + esc(q.help) + '</p>' : '';
  if (['single', 'multi', 'yesno', 'yesnounk'].includes(q.type)) return ccChips(q.label, path, v, opts, q.type === 'multi') + help;
  if (q.type === 'scale010') return '<div class="field"><label for="cc-scale-' + i + '-' + q.id + '">' + esc(q.label) + ' · 0–10</label>' + (!CONSULT.filled(v) ? ccButton('ccScaleSet', 'Registrar intensidad', 'data-path="' + path + '"') : '<input id="cc-scale-' + i + '-' + q.id + '" type="range" min="0" max="10" step="1" data-in="ccInput" ' + ccAttrs(path) + ' value="' + esc(v) + '"><output>' + esc(v) + '</output>') + '</div>';
  if (q.type === 'duration') return '<div class="field"><label>' + esc(q.label) + '</label><div class="form">' + ccField('Número', path + '.n', v?.n, 'number', 'min="0" step="any"') + ccSelect('Unidad', path + '.unit', v?.unit, ['Minutos', 'Horas', 'Días', 'Semanas', 'Meses', 'Años']) + '</div></div>';
  if (q.type === 'search') return ccField(q.label, path, v);
  if (q.type === 'text') return ccText(q.label, path, v);
  return ccField(q.label + (q.unit ? ' · ' + q.unit : ''), path, v, q.type === 'date' ? 'date' : 'number', 'min="0" step="any"');
}
ACTIONS.ccScaleSet = el => {
  const c = ccCurrent();
  if (!c) return;
  ccSet(c, el.dataset.path, 0);
  consultDirty(c);
  render();
};
function consultVitals(c) {
  const rows = c.vitals.map((v, i) => {
    const errors = CONSULT.validateVitals(v);
    const fields = ccField('Fecha y hora · Caracas', 'vitals.' + i + '.at', String(v.at || '').replace(' ', 'T'), 'datetime-local') + CONSULT.vitals.map(([key, label, unit, min, max]) => ccField(label + ' · ' + unit, 'vitals.' + i + '.' + key, v[key], 'number', 'min="' + min + '" max="' + max + '" step="any"')).join('');
    return '<section class="card"><h2>Medición ' + (i + 1) + ' · ' + esc(v.at) + '</h2><div class="form">' + fields + '</div><p>IMC: <span id="cc-bmi-' + i + '">' + (CONSULT.bmi(v.weight, v.height) ?? 'No calculable sin peso y talla') + '</span></p><div id="cc-vital-error-' + i + '" class="banner warn" ' + (errors.length ? '' : 'hidden') + '>' + esc(errors.join(' · ')) + '</div></section>';
  }).join('');
  return '<div class="stack">' + rows + ccButton('ccVitalAdd', 'Agregar medición con hora') + '<p class="small muted">Cada medición se conserva. Los campos vacíos no se interpretan como valores normales.</p></div>';
}
ACTIONS.ccVitalAdd = () => {
  const c = ccCurrent();
  if (!c) return;
  c.vitals.push({
    at: CONSULT.caracas().date + ' ' + CONSULT.caracas().time
  });
  consultDirty(c);
  render();
};
function consultExam(c, only = null, subset = null) {
  const regions = Object.entries(CONSULT.exam).filter(([region]) => !only || region === only);
  return '<div class="stack">' + regions.map(([region, value]) => {
    const e = c.exam[region] || {},
      key = 'exam.' + region;
    const items = value.split('|').filter(item => !subset || subset.includes(item));
    let fields = ccChips('Estado de ' + region, key + '.state', e.state, [['normal', 'Normal'], ['alterado', 'Alterado'], ['no_examinado', 'No examinado']]);
    if (region === 'Exploraciones íntimas') fields += ccChips('Consentimiento para la exploración', key + '.consent', e.consent, ['Sí', 'No', 'Desconocido']) + ccField('Acompañante / chaperón (o ausencia documentada)', key + '.chaperone', e.chaperone);
    if (e.state === 'normal') fields += ccChips('Seleccione únicamente los ítems confirmados normales', key + '.confirmed', e.confirmed, items, true);
    if (e.state === 'alterado') fields += '<div class="form">' + items.map(item => ccField(item, key + '.findings.' + item, e.findings?.[item])).join('') + ccText('Hallazgos / texto libre', key + '.note', e.note) + '</div>';
    return '<details class="card" ' + (e.state ? 'open' : '') + '><summary>' + esc(region) + ' · ' + esc(e.state?.replace(/_/g, ' ') || 'No documentado') + '</summary>' + fields + '</details>';
  }).join('') + '</div>';
}
function consultRos(c, only = null, subset = null) {
  const systems = Object.entries(CONSULT.ros).filter(([system]) => !only || system === only);
  return '<div class="stack"><p class="small muted">Marque solo lo interrogado. Para negar varios ítems, seleccione cuáles confirmó con el paciente.</p>' + systems.map(([system, value]) => {
    const items = value.split('|').filter(item => !subset || subset.includes(item));
    const fields = items.map(item => '<div class="field"><label class="hstack">' + '<input type="checkbox" data-ch="ccRosPick" data-system="' + esc(system) + '" data-item="' + esc(item) + '" ' + (UI.ccRosSelected?.[system]?.includes(item) ? 'checked' : '') + '> ' + esc(item) + '</label>' + ccChips(item, 'ros.' + system + '.' + item, c.ros[system]?.[item], [['presente', 'Presente'], ['ausente', 'Ausente'], ['no_interrogado', 'No interrogado'], ['desconocido', 'Desconocido']]) + '</div>').join('');
    return '<details class="card"><summary>' + esc(system) + '</summary><div class="form">' + fields + '</div>' + ccButton('ccRosNegated', 'Marcar los seleccionados como negados', 'data-system="' + esc(system) + '"') + ccText('Observaciones / texto libre', 'rosNotes.' + system, c.rosNotes?.[system]) + '</details>';
  }).join('') + '</div>';
}
ACTIONS.ccRosPick = el => {
  if (!ccCurrent()) return;
  UI.ccRosSelected ||= {};
  const list = UI.ccRosSelected[el.dataset.system] || [];
  UI.ccRosSelected[el.dataset.system] = el.checked ? list.concat(el.dataset.item) : list.filter(i => i !== el.dataset.item);
};
ACTIONS.ccRosNegated = el => {
  const c = ccCurrent();
  if (!c) return;
  const list = UI.ccRosSelected?.[el.dataset.system] || [];
  if (!list.length) {
    toast('Seleccione los ítems interrogados.');
    return;
  }
  c.ros[el.dataset.system] ||= {};
  list.forEach(i => c.ros[el.dataset.system][i] = 'ausente');
  consultAudit(c, 'sistemas_negados_seleccionados', list.join(', '));
  consultDirty(c);
  render();
};
function consultHistory(c) {
  const p = pat(c.pid),
    h = p.history;
  const rows = (list, fields) => h[list].map((item, i) => '<section class="card"><div class="form">' + fields.map(([k, l, type, opts]) => type === 'select' ? ccSelect(l, 'history.' + list + '.' + i + '.' + k, item[k], opts) : type === 'bool' ? ccChips(l, 'history.' + list + '.' + i + '.' + k, item[k], [[true, 'Activo'], [false, 'Suspendido']]) : ccField(l, 'history.' + list + '.' + i + '.' + k, item[k], type || 'text')).join('') + '</div></section>').join('');
  return '<div class="stack"><div class="banner allergy">' + esc(CONSULT.allergyText(h)) + '</div><p class="small muted">Última confirmación: ' + esc(h.confirmedAt || 'No confirmados') + '. Confirme o actualice estos antecedentes longitudinales; no necesita copiarlos en cada consulta.</p>' + ccButton('ccConfirmHistory', 'Confirmar antecedentes con el paciente', '', 'primary') + ccChips('Estado de alergias', 'history.allergies.status', h.allergies.status, [['conocidas', 'Alergias conocidas'], ['niega', 'Niega alergias conocidas'], ['desconocido', 'Desconocido / no confirmado']]) + (h.allergies.status === 'conocidas' ? h.allergies.items.map((a, i) => '<div class="card"><div class="form">' + ccField('Sustancia', 'history.allergies.items.' + i + '.substance', a.substance) + ccSelect('Tipo', 'history.allergies.items.' + i + '.type', a.type, ['medicamento', 'alimento', 'látex', 'contraste', 'otra']) + ccField('Reacción', 'history.allergies.items.' + i + '.reaction', a.reaction) + ccSelect('Gravedad', 'history.allergies.items.' + i + '.severity', a.severity, ['leve', 'moderada', 'grave', 'desconocida']) + ccField('Fecha', 'history.allergies.items.' + i + '.date', a.date, 'date') + ccChips('Verificación', 'history.allergies.items.' + i + '.verified', a.verified, [[true, 'Verificada'], [false, 'No confirmada']]) + '</div></div>').join('') + ccButton('ccHistoryAdd', 'Agregar alergia', 'data-list="allergies.items"') : '') + '<details class="card" open><summary>Patológicos</summary><datalist id="cc-conditions">' + CONSULT.conditions.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>' + h.conditions.map((x, i) => '<div class="form">' + ccField('Enfermedad', 'history.conditions.' + i + '.name', x.name, 'text', 'list="cc-conditions"') + ccSelect('Estado', 'history.conditions.' + i + '.state', x.state, ['presente', 'ausente', 'desconocido']) + ccField('Desde', 'history.conditions.' + i + '.since', x.since, 'date') + ccField('Tratamiento', 'history.conditions.' + i + '.tx', x.tx) + ccField('Nota', 'history.conditions.' + i + '.note', x.note) + '</div>').join('') + ccButton('ccHistoryAdd', 'Agregar patológico', 'data-list="conditions"') + '</details><details class="card"><summary>Quirúrgicos</summary>' + rows('surgeries', [['name', 'Cirugía'], ['date', 'Fecha aproximada'], ['institution', 'Institución'], ['complications', 'Complicaciones'], ['anesthesia', 'Anestesia'], ['note', 'Nota']]) + ccButton('ccHistoryAdd', 'Agregar cirugía', 'data-list="surgeries"') + '</details><details class="card"><summary>Medicación habitual</summary>' + rows('meds', [['drug', 'Nombre'], ['ingredient', 'Principio activo'], ['presentation', 'Presentación'], ['dose', 'Dosis'], ['freq', 'Frecuencia'], ['route', 'Vía'], ['start', 'Inicio', 'date'], ['end', 'Fin', 'date'], ['active', 'Estado', 'bool'], ['note', 'Nota']]) + ccButton('ccHistoryAdd', 'Agregar medicación', 'data-list="meds"') + '</details><details class="card"><summary>Familiares</summary>' + rows('family', [['disease', 'Enfermedad'], ['relative', 'Familiar'], ['age', 'Edad de diagnóstico', 'number'], ['note', 'Nota']]) + ccButton('ccHistoryAdd', 'Agregar familiar', 'data-list="family"') + '</details><details class="card"><summary>Hábitos</summary><div class="form">' + Object.entries({
    tabaco: 'Tabaco',
    alcohol: 'Alcohol',
    sustancias: 'Otras sustancias',
    actividad: 'Actividad física',
    alimentacion: 'Alimentación',
    ocupacion: 'Ocupación',
    exposiciones: 'Exposiciones laborales',
    sueno: 'Sueño',
    social: 'Factores sociales'
  }).map(([k, l]) => ccField(l, 'history.habits.' + k, h.habits[k])).join('') + '</div></details>' + (p.sex === 'F' ? '<details class="card"><summary>Ginecoobstétricos</summary><div class="form">' + Object.entries({
    menarquia: 'Menarquia',
    fum: 'FUM',
    regularidad: 'Regularidad',
    duracion: 'Duración',
    g: 'G',
    p: 'P',
    c: 'C',
    a: 'A',
    menopausia: 'Menopausia',
    anticoncepcion: 'Anticoncepción',
    embarazo: 'Embarazo actual o posible',
    nota: 'Antecedentes / nota'
  }).map(([k, l]) => ccField(l, 'history.gyneco.' + k, h.gyneco[k], k === 'fum' ? 'date' : 'text')).join('') + '</div></details>' : '') + (CONSULT.age(p.birth, c.date) !== null && CONSULT.age(p.birth, c.date) < 18 ? '<details class="card"><summary>Pediátricos</summary><div class="form">' + Object.entries({
    embarazo: 'Embarazo',
    nacimiento: 'Nacimiento',
    prematuridad: 'Prematuridad',
    peso: 'Peso al nacer',
    desarrollo: 'Desarrollo',
    vacunacion: 'Vacunación',
    alimentacion: 'Alimentación',
    crecimiento: 'Crecimiento',
    enfermedades: 'Enfermedades',
    nota: 'Nota'
  }).map(([k, l]) => ccField(l, 'history.pediatric.' + k, h.pediatric[k])).join('') + '</div></details>' : '') + '</div>';
}
ACTIONS.ccHistoryAdd = el => {
  const c = ccCurrent();
  if (!c) return;
  const list = el.dataset.list;
  if (!['conditions', 'surgeries', 'meds', 'family', 'allergies.items'].includes(list)) return;
  const h = pat(c.pid).history;
  ccGet(h, list).push(list === 'meds' ? {
    active: true
  } : list === 'conditions' ? {
    state: 'desconocido'
  } : {});
  ccChanged(c, 'history.' + list);
  render();
};
ACTIONS.ccConfirmHistory = () => {
  const c = ccCurrent();
  if (!c) return;
  const h = pat(c.pid).history;
  const at = new Date().toISOString();
  h.confirmedAt = at;
  h.confirmations.push({
    at,
    by: consultSession(),
    consultId: c.id
  });
  c.historyConfirmedAt = at;
  consultAudit(c, 'antecedentes_confirmados');
  consultDirty(c);
  render();
};
function consultDx(c) {
  return '<div class="stack"><label for="cc-dx-search" class="small muted">Buscar diagnóstico, sinónimo o CIE-10; texto libre disponible</label><input class="input" id="cc-dx-search" data-in="ccDxSearch" value="' + esc(UI.ccDxQuery || '') + '"><div id="cc-dx-results" class="hstack">' + consultDxOptions(UI.ccDxQuery || '') + '</div>' + c.dx.map((d, i) => '<section class="card"><h2>' + esc(d.label) + (d.code ? ' <small>' + esc(d.code) + '</small>' : '') + '</h2><div class="form">' + ccSelect('Prioridad', 'dx.' + i + '.priority', d.priority, ['principal', 'secundario']) + ccSelect('Certeza', 'dx.' + i + '.certainty', d.certainty, ['presuntivo', 'confirmado', 'diferencial', 'pendiente de estudio']) + '</div>' + ccButton('ccRemove', 'Quitar', 'data-list="dx" data-i="' + i + '"') + '</section>').join('') + '</div>';
}
function consultDxOptions(q) {
  return CONSULT.diagnoses.map((d, i) => ({
    d,
    i
  })).filter(({
    d
  }) => normQ([d.label, d.code, ...d.synonyms].join(' ')).includes(normQ(q))).slice(0, 15).map(({
    d,
    i
  }) => ccButton('ccDxAdd', esc(d.label) + (d.code ? ' · ' + d.code : ''), 'data-i="' + i + '"')).join('') + (q ? ccButton('ccDxFree', 'Agregar texto libre: ' + esc(q)) : '');
}
ACTIONS.ccDxSearch = el => {
  if (!ccCurrent()) return;
  UI.ccDxQuery = el.value;
  document.getElementById('cc-dx-results').innerHTML = consultDxOptions(el.value);
};
ACTIONS.ccDxAdd = el => {
  const c = ccCurrent(),
    d = CONSULT.diagnoses[+el.dataset.i];
  if (!c || !d) return;
  const {
    synonyms,
    ...dx
  } = d;
  c.dx.push({
    ...dx,
    priority: c.dx.some(x => x.priority === 'principal') ? 'secundario' : 'principal',
    certainty: 'presuntivo'
  });
  consultDirty(c);
  render();
};
ACTIONS.ccDxFree = () => {
  const c = ccCurrent();
  if (!c || !UI.ccDxQuery?.trim()) return;
  c.dx.push({
    label: UI.ccDxQuery.trim(),
    priority: c.dx.some(x => x.priority === 'principal') ? 'secundario' : 'principal',
    certainty: 'pendiente de estudio'
  });
  consultDirty(c);
  render();
};
function consultOrderOptions(q) {
  const opts = labTestNames().map(label => ({
    label,
    category: 'lab'
  })).concat(IMG_TESTS.map(label => ({
    label,
    category: 'imagen'
  })));
  return opts.filter(o => normQ(o.label).includes(normQ(q))).slice(0, 20).map(o => ccButton('ccOrderPick', esc(o.label), 'data-label="' + esc(o.label) + '" data-category="' + o.category + '"')).join('');
}
function consultOrders(c) {
  return '<div class="stack"><label for="cc-order-search" class="small muted">Buscar en laboratorio de la clínica, imagen y otros; no registra resultados</label><input class="input" id="cc-order-search" data-in="ccOrderSearch" value="' + esc(UI.ccOrderQuery || '') + '"><div class="hstack" id="cc-order-options">' + consultOrderOptions(UI.ccOrderQuery || '') + '</div><div class="form"><div class="field"><label for="cc-order-label">Examen / texto libre</label><input class="input" id="cc-order-label" data-in="ccOrderDraft" data-key="label" value="' + esc(UI.ccOrderDraft?.label || '') + '"></div><div class="field"><label for="cc-order-category">Categoría</label><select class="input" id="cc-order-category" data-ch="ccOrderDraft" data-key="category">' + [['lab', 'Laboratorio'], ['imagen', 'Imagen'], ['otro', 'Otro']].map(([v, l]) => '<option value="' + v + '" ' + (UI.ccOrderDraft?.category === v ? 'selected' : '') + '>' + l + '</option>').join('') + '</select></div><div class="field"><label for="cc-order-indication">Indicación</label><input class="input" id="cc-order-indication" data-in="ccOrderDraft" data-key="indication" value="' + esc(UI.ccOrderDraft?.indication || '') + '"></div><div class="field"><label for="cc-order-priority">Prioridad</label><select class="input" id="cc-order-priority" data-ch="ccOrderDraft" data-key="priority"><option value="normal">Normal</option><option value="urgente" ' + (UI.ccOrderDraft?.priority === 'urgente' ? 'selected' : '') + '>Urgente</option></select></div></div>' + ccButton('ccOrderAdd', 'Solicitar examen', '', 'primary') + '<div class="list">' + c.orders.map(o => '<div class="row"><div class="grow"><div class="t">' + esc(o.label) + '</div><div class="s">Solicitado · ' + esc(o.indication || 'Indicación no documentada') + '</div></div><span class="pill">' + esc(EX_ST[S.exams.find(e => e.id === o.examId)?.status]?.[0] || o.status) + '</span></div>').join('') + '</div>' + (c.orders.length ? ccButton('ccPdf', 'Orden de exámenes (PDF)', 'data-kind="orders"') : '') + '</div>';
}
ACTIONS.ccOrderSearch = el => {
  if (!ccCurrent()) return;
  UI.ccOrderQuery = el.value;
  document.getElementById('cc-order-options').innerHTML = consultOrderOptions(el.value);
};
ACTIONS.ccOrderPick = el => {
  if (!ccCurrent()) return;
  UI.ccOrderDraft = {
    label: el.dataset.label,
    category: el.dataset.category,
    priority: 'normal',
    indication: ''
  };
  render();
};
ACTIONS.ccOrderDraft = el => {
  if (!ccCurrent()) return;
  UI.ccOrderDraft ||= {};
  UI.ccOrderDraft[el.dataset.key] = el.value;
};
function consultAddOrder(c, draft, onCommit = () => {}) {
  if (!consultCanEdit(c) || !can('examen.pedir')) return false;
  if (!draft.label?.trim()) {
    toast('Indique el examen.');
    return false;
  }
  const category = draft.category || 'lab';
  return consultTransaction(c, () => {
    const e = {
      id: uid('ex'),
      num: 'EX-' + String(S.exSeq++).padStart(4, '0'),
      pid: c.pid,
      doc: c.doc,
      consultId: c.id,
      admId: c.admId,
      apptId: c.apptId,
      date: c.date,
      area: category === 'lab' ? 'laboratorio' : category === 'imagen' ? 'imagen' : 'otro',
      tests: [draft.label.trim()],
      priority: draft.priority || 'normal',
      notes: draft.indication || '',
      status: 'solicitado',
      by: actor(),
      seen: false,
      files: [],
      results: [],
      report: ''
    };
    S.exams.unshift(e);
    c.orders.push({
      examId: e.id,
      label: e.tests[0],
      category,
      indication: e.notes,
      priority: e.priority,
      status: 'solicitado',
      documentStatus: 'borrador'
    });
    consultAudit(c, 'examen_solicitado', e.id);
    delete c.report.approvedHash;
    c.report.stale = !!c.report.draft;
    onCommit();
  });
}

ACTIONS.ccOrderAdd = () => {
  const c = ccCurrent();
  if (!c || !consultAddOrder(c, UI.ccOrderDraft || {})) return;
  UI.ccOrderDraft = {};
  render();
};
function consultRx(c) {
  return '<div class="stack"><div class="banner allergy">' + esc(CONSULT.allergyText(pat(c.pid).history)) + '</div><p class="small muted">Prescripción documental. Usted indica la dosis; no se calculan dosis ni interacciones. No descuenta inventario ni registra administración.</p><datalist id="cc-products">' + S.products.map(p => '<option value="' + esc(p.name) + '">').join('') + '</datalist>' + c.rx.map((r, i) => '<section class="card"><div class="form">' + ccField('Medicamento (inventario o libre)', 'rx.' + i + '.drug', r.drug, 'text', 'list="cc-products"') + [['presentation', 'Presentación'], ['dose', 'Dosis'], ['unit', 'Unidad'], ['route', 'Vía'], ['freq', 'Frecuencia'], ['duration', 'Duración'], ['qty', 'Cantidad'], ['notes', 'Indicaciones']].map(([k, l]) => ccField(l, 'rx.' + i + '.' + k, r[k])).join('') + '</div>' + ccButton('ccRemove', 'Quitar', 'data-list="rx" data-i="' + i + '"') + '</section>').join('') + ccButton('ccRxAdd', 'Agregar medicamento') + '</div>';
}
ACTIONS.ccRxAdd = () => {
  const c = ccCurrent();
  if (!c) return;
  c.rx.push({
    drug: '',
    status: 'prescrito',
    documentStatus: 'borrador'
  });
  consultDirty(c);
  render();
};
function consultPlan(c) {
  return '<div class="form">' + ccChips('Conductas', 'plan.conducts', c.plan.conducts, CONSULT.conducts, true) + ccChips('Indicaciones generales', 'plan.instructions', c.plan.instructions, CONSULT.instructions, true) + ccText('Otras conductas / texto libre', 'plan.conductFree', c.plan.conductFree) + ccText('Otras indicaciones / texto libre', 'plan.instructionFree', c.plan.instructionFree) + ccText('Indicaciones / texto libre', 'plan.notes', c.plan.notes) + ccChips('Signos de alarma elegidos por usted', 'plan.alarmSigns', c.plan.alarmSigns, CONSULT.alarmSigns, true) + ccText('Otros signos de alarma / texto libre', 'plan.alarmFree', c.plan.alarmFree) + ccField('Próximo control · fecha', 'plan.nextControl', c.plan.nextControl, 'date') + ccField('Intervalo de control (alternativa libre)', 'plan.controlInterval', c.plan.controlInterval) + ccField('Hora del control si desea crear una cita', 'plan.controlTime', c.plan.controlTime, 'time') + ccField('Referencia · especialidad destino', 'plan.referral', c.plan.referral) + '</div><div class="hstack" style="margin-top:16px">' + ccButton('ccFollowup', 'Crear cita de control') + (c.plan.referral ? ccButton('ccPdf', 'Referencia (PDF)', 'data-kind="referral"') : '') + '</div>' + (c.plan.apptId ? '<p class="pill good">Control agendado</p>' : '');
}
ACTIONS.ccFollowup = () => {
  const c = ccCurrent();
  if (!c || !can('consulta.agendar')) return;
  if (c.plan.apptId) {
    toast('Esta consulta ya tiene una cita de control.');
    return;
  }
  const date = c.plan.nextControl,
    time = c.plan.controlTime;
  if (!date || !time || date < CONSULT.caracas().date) {
    toast(!date ? 'Falta la fecha del control.' : !time ? 'Falta la hora del control: elija una de los botones o escríbala.' : 'La fecha del control ya pasó; elija una fecha de hoy en adelante.');
    return;
  }
  const conflict = S.appts.some(a => a.date === date && !['cancelada', 'no_asistio'].includes(a.status) && (a.doc === c.doc || a.pid === c.pid) && toMin(a.time) < toMin(time) + 30 && apptEnd(a) > toMin(time));
  if (conflict) {
    toast('La hora coincide con otra cita del médico o paciente.');
    return;
  }
  if (consultTransaction(c, () => {
    const a = {
      id: uid('a'),
      kind: 'consulta',
      date,
      time,
      pid: c.pid,
      doc: c.doc,
      svc: S.services.find(s => s.cat === 'Consultas')?.id || null,
      status: 'reservada',
      consultId: c.id,
      inv: null
    };
    S.appts.push(a);
    c.plan.apptId = a.id;
    consultAudit(c, 'control_agendado', a.id);
  })) {
    render();
    toast('Cita de control creada.');
  }
};
ACTIONS.ccRemove = el => {
  const c = ccCurrent();
  if (!c || !['reasons', 'dx', 'rx'].includes(el.dataset.list)) return;
  c[el.dataset.list].splice(+el.dataset.i, 1);
  if (el.dataset.list === 'reasons' && c.reasons.length && !c.reasons.some(r => r.main)) c.reasons[0].main = true;
  consultDirty(c);
  render();
};
function consultReport(c) {
  const stale = !!c.report.draft && c.report.sourceHash !== CONSULT.hash(c, pat(c.pid));
  if (c.status === 'firmada') return '<div class="paper"><p>Firmada por ' + esc(c.report.signedDoctor?.name || med(c.doc)?.name) + ' · ' + esc(new Date(c.report.signedAt).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    dateStyle: 'medium',
    timeStyle: 'short'
  })) + ' (Caracas)</p><div class="freeview">' + esc(c.report.signedText) + '</div></div>';
  return '<div class="stack"><div id="consult-stale" class="banner warn" ' + (stale ? '' : 'hidden') + '>Borrador desactualizado: la consulta cambió. Regenere y revise antes de aprobar.</div>' + ccButton('ccGenerate', UI.ccGenerating === c.id ? 'Redactando…' : c.report.draft ? 'Regenerar informe' : 'Generar informe', UI.ccGenerating === c.id ? 'disabled' : '', 'primary') + '<p class="small muted">' + esc(c.report.draft ? 'Redactado automáticamente a partir de sus respuestas. Revíselo y corríjalo si hace falta.' : 'El informe se redacta automáticamente con lo que usted registró.') + '</p><div class="grid ' + (c.report.candidate ? 'g2' : '') + '"><section>' + ccText('Su borrador editable', 'report.draft', c.report.draft) + '</section>' + (c.report.candidate ? '<section><label class="small muted">Nuevo borrador para elegir o combinar</label><textarea class="input cc-report" readonly>' + esc(c.report.candidate.text) + '</textarea><div class="hstack">' + ccButton('ccCandidateUse', 'Usar el nuevo borrador') + ccButton('ccCandidateCombine', 'Combinar ambos') + ccButton('ccCandidateKeep', 'Conservar mi texto tras revisar') + '</div></section>' : '') + '</div><div class="hstack">' + ccButton('ccApprove', 'Aprobar borrador', stale || !c.report.draft || c.report.candidate ? 'disabled' : '') + (consultCanSign(c) ? ccButton('ccSign', 'Firmar consulta', c.report.approvedHash === CONSULT.hash(c, pat(c.pid)) ? '' : 'disabled', 'primary') : '') + '</div><div class="small muted">La aprobación no firma. Al firmar se congela el texto y se guarda en la historia clínica; salir nunca firma.</div><div id="cc-sign-msg" class="banner warn" hidden></div></div>';
}
ACTIONS.ccGenerate = async () => {
  const c = ccCurrent();
  if (!c || UI.ccGenerating === c.id) return;
  const pid = c.pid,
    id = c.id,
    user = consultSession(),
    data = CONSULT.clean(c, pat(pid)),
    hash = CONSULT.hash(c, pat(pid));
  const generatedAt = new Date().toISOString();
  const named = t => data.patient.initials && data.patient.initials.length >= 2 ? t.split(data.patient.initials).join(pat(pid).name) : t;
  const local = named(CONSULT.report(data));
  Object.assign(c, CONSULT.receiveReport(c, local, hash, 'plantillas', generatedAt));
  consultAudit(c, 'informe_generado', 'plantillas');
  if (!consultFlush()) {
    render();
    return;
  }
  render();
  toast('Informe redactado a partir de sus respuestas. Revíselo antes de firmar.');
};
function consultCandidate(action) {
  const c = ccCurrent(),
    candidate = c?.report.candidate;
  if (!candidate) return;
  if (action === 'use') {
    c.report.previousEdits ||= [];
    c.report.previousEdits.push({
      text: c.report.draft,
      at: new Date().toISOString()
    });
    c.report.draft = candidate.text;
  } else if (action === 'combine') c.report.draft += '\n\n--- Borrador nuevo para revisar ---\n\n' + candidate.text;
  Object.assign(c.report, {
    sourceHash: candidate.sourceHash,
    source: action === 'use' ? candidate.source : 'revision_medica',
    generatedAt: candidate.generatedAt,
    candidate: null,
    edited: action !== 'use'
  });
  delete c.report.approvedHash;
  c.report.stale = c.report.sourceHash !== CONSULT.hash(c, pat(c.pid));
  consultAudit(c, 'regeneracion_' + action);
  consultFlush();
  render();
}
ACTIONS.ccCandidateUse = () => consultCandidate('use');
ACTIONS.ccCandidateCombine = () => consultCandidate('combine');
ACTIONS.ccCandidateKeep = () => consultCandidate('keep');
ACTIONS.ccApprove = () => {
  const c = ccCurrent();
  if (!c) return;
  const hash = CONSULT.hash(c, pat(c.pid));
  if (!c.report.draft?.trim() || c.report.candidate || c.report.sourceHash !== hash) {
    toast('Revise el borrador vigente antes de aprobar.');
    return;
  }
  if (consultTransaction(c, () => {
    c.report.approvedHash = hash;
    consultAudit(c, 'informe_aprobado');
  })) {
    render();
  }
};
function consultSign(c) {
  if (!consultCanSign(c)) return false;
  if (typeof credsBlockSign === 'function' && credsBlockSign()) return false;
  const p = pat(c.pid),
    errors = CONSULT.signProblems(c, p);
  if (errors.length) {
    const msg = document.getElementById('cc-sign-msg');
    if (msg) {
      msg.hidden = false;
      msg.textContent = errors.join(' ');
    }
    toast(errors[0]);
    // En el asistente, lleva directo a la pregunta que hay que corregir
    if (c.guide && typeof guidedGo === 'function') {
      const region = Object.entries(c.exam).find(([, e]) => e.state === 'normal' && !e.confirmed?.length)?.[0];
      const pendingOrder = (c.guide.orderDrafts || []).findIndex(Boolean);
      const target = region ? 'exam' :
        pendingOrder >= 0 ? 'orders-' + pendingOrder :
        (p.history.allergies.status === 'desconocido' && c.guide.started && !c.guide.allergyReviewed) ? 'history-allergies' :
        (!c.reasons.length || c.reasons.filter(r => r.main).length !== 1) ? 'reasons' :
        (!c.dx.length || c.dx.filter(d => d.priority === 'principal').length !== 1 || c.dx.some(d => !d.certainty)) ? 'dx' : null;
      const msg = region ? errors.find(e => e.includes('verificó como normal')) : errors.find(e => target === 'reasons' ? e.includes('motivo') : e.includes('diagnóstico'));
      if (target) { guidedGo(c, target); toast((msg || errors[0]) + ' Le llevé a esa pregunta.'); }
    }
    return false;
  }
  return consultTransaction(c, () => {
    const now = new Date().toISOString();
    c.status = 'firmada';
    c.historySnapshot = CONSULT.clone(p.history);
    c.patientSnapshot = {
      name: p.name,
      ci: p.ci,
      code: p.code,
      birth: p.birth,
      sex: p.sex,
      documentType: p.documentType
    };
    c.report.signedAt = now;
    c.report.signedBy = c.doc;
    c.report.signedByUser = consultSession();
    c.report.signedDoctor = CONSULT.clone(med(c.doc) || {
      id: c.doc,
      name: actor(),
      esp: c.specialty
    });
    c.report.signedText = c.report.draft;
    c.report.stale = false;
    consultAudit(c, 'firmada');
    const last = c.vitals.at(-1) || {};
    const n = {
      id: uid('hc'),
      consultId: c.id,
      pid: c.pid,
      doc: c.doc,
      apptId: c.apptId,
      admId: c.admId,
      type: 'consulta',
      date: c.date,
      time: c.time,
      status: 'firmada',
      signedAt: CONSULT.caracas().date + ' ' + CONSULT.caracas().time,
      signedISO: now,
      by: actor(),
      motivo: c.reasons.map(r => r.label).join('; '),
      actual: c.report.signedText,
      vitals: {
        ta: last.sys && last.dia ? last.sys + '/' + last.dia : '',
        fc: last.hr ?? '',
        fr: last.rr ?? '',
        temp: last.temp ?? '',
        sat: last.spo2 ?? '',
        peso: last.weight ?? '',
        talla: last.height ?? ''
      },
      examen: '',
      dx: c.dx.map(CONSULT.diagnosisText),
      plan: c.plan.notes || '',
      indicaciones: c.plan.instructions.join('; '),
      recipe: c.rx.filter(r => r.drug).map(r => ({
        med: r.drug,
        dosis: [r.dose, r.unit, r.route].filter(Boolean).join(' '),
        frec: r.freq,
        dur: r.duration
      })),
      orders: c.orders.map(o => o.examId),
      tests: [],
      addenda: [],
      reportOnly: true
    };
    S.hc.unshift(n);
    c.noteId = n.id;
    c.rx.forEach(r => r.documentStatus = 'firmado');
    c.plan.referralStatus = c.plan.referral ? 'firmado' : null;
    c.orders.forEach(o => {
      o.documentStatus = 'firmado';
      const e = S.exams.find(e => e.id === o.examId);
      if (e) e.note = n.id;
    });
    const a = S.appts.find(a => a.id === c.apptId);
    if (a) a.status = 'atendida';
    log('Consulta médica firmada', c.id);
  });
}
ACTIONS.ccSign = async () => {
  const c = ccCurrent();
  if (!c || !consultSign(c)) return;
  render();
  toast('Consulta firmada y guardada.');
  await consultDownload(c, 'report');   // se abre el informe; desde la vista previa se pasa al récipe y a las órdenes
};
ACTIONS.ccMode = () => {
  const c = ccCurrent();
  if (!c) return;
  c.mode = c.mode === 'quick' ? 'complete' : 'quick';
  consultAudit(c, 'cambio_vista', c.mode);
  consultDirty(c);
  render();
};
ACTIONS.ccStep = el => {
  const c = consultOf(param);
  if (!c || !consultAccessible(c)) return;
  UI.consultStep = +el.dataset.i;
  render();
};
ACTIONS.ccStepState = el => {
  const c = ccCurrent();
  if (!c) return;
  const i = +el.dataset.i;
  if ([0, 1, 7, 11].includes(i)) return;
  c.steps[i] = el.dataset.state;
  consultAudit(c, 'estado_paso', i + ': ' + el.dataset.state);
  consultDirty(c);
  render();
};
ACTIONS.ccAlarmReviewed = el => {
  const c = ccCurrent();
  if (!c) return;
  const alarm = CONSULT.alarms(c, pat(c.pid)).find(a => a.ref === el.dataset.ref);
  if (!alarm) return;
  consultAudit(c, 'alarma_revisada', alarm.ref);
  consultDirty(c);
  render();
};
function consultSection(c, i) {
  const bodies = [() => consultConfig(c), () => consultReasons(c), () => consultReasons(c, true), () => consultHistory(c), () => consultRos(c), () => consultVitals(c), () => consultExam(c), () => consultDx(c), () => consultOrders(c), () => consultRx(c), () => consultPlan(c), () => consultReport(c)];
  return '<section class="card"><h2>' + CONSULT.steps[i] + ' <small>' + CONSULT.stepState(c, pat(c.pid), i) + '</small></h2>' + (![0, 1, 7, 11].includes(i) ? '<div class="hstack" style="margin-bottom:12px">' + ['pendiente', 'no aplica', 'no evaluado'].map(s => ccButton('ccStepState', s === 'pendiente' ? 'Evaluar' : s, 'data-i="' + i + '" data-state="' + s + '"')).join('') + '</div>' : '') + bodies[i]() + '</section>';
}
function consultView(c) {
  const p = pat(c.pid),
    editable = consultCanEdit(c);
  const alarms = CONSULT.alarms(c, p);
  const alerts = consultAlerts(c);
  const top = header('Consulta ' + (c.mode === 'quick' ? 'rápida' : 'completa'), esc(p.name) + ' · ' + esc(c.specialty) + ' · ' + esc(fdate(c.date) + ' ' + c.time) + ' Caracas', '<span class="pill ' + (c.status === 'firmada' ? 'good' : 'info') + '">' + (c.status === 'firmada' ? 'Firmada · solo lectura' : 'Borrador') + '</span><span class="pill" id="consult-save" role="status" aria-live="polite">' + esc(UI.consultSave || 'Guardado') + '</span><button class="btn" data-go="consultas">Volver a Consultas</button>' + (editable ? ccButton('ccMode', c.mode === 'quick' ? 'Ampliar a consulta completa' : 'Volver a vista rápida') : ''));
  if (c.status === 'firmada') return top + '<div class="stack">' + consultReport(c) + '<div class="hstack">' + ['report', 'recipe', 'orders', 'referral'].filter(k => k === 'report' || k === 'recipe' && c.rx.some(r => r.drug) || k === 'orders' && c.orders.length || k === 'referral' && c.plan.referral).map(k => ccButton('ccPdf', {
    report: 'Informe PDF',
    recipe: 'Récipe PDF',
    orders: 'Orden PDF',
    referral: 'Referencia PDF'
  }[k], 'data-kind="' + k + '"')).join('') + ccButton('ccPatientSheet', 'Indicaciones al paciente') +
    ccButton('ccCertAttendance', 'Constancia de asistencia') + ccButton('ccCertRest', 'Reposo médico') + ccButton('ccAddendum', 'Agregar adenda') + '</div><div class="card"><h2>Adendas</h2>' + (S.hc.find(n => n.consultId === c.id)?.addenda || []).map(a => '<p>' + esc(a.at + ' · ' + a.by) + '<br>' + esc(a.text) + '</p>').join('') + '</div></div>';
  const step = Math.max(0, Math.min(11, UI.consultStep || 0));
  const quick = '<div class="stack cc-quick"><section class="card"><h2>1. Paciente y contexto</h2>' + consultSummary(c) + '<details><summary>Configurar consulta y confirmar antecedentes</summary>' + consultConfig(c) + consultHistory(c) + '</details></section><section class="card"><h2>2. Motivo y evolución</h2>' + consultReasons(c) + consultReasons(c, true) + '</section><section class="card"><h2>3. Signos vitales</h2>' + consultVitals(c) + '</section><section class="card"><h2>4. Examen dirigido</h2>' + consultExam(c) + '</section><section class="card"><h2>5. Diagnóstico y conducta</h2>' + consultDx(c) + '<details><summary>Exámenes solicitados</summary>' + consultOrders(c) + '</details><details><summary>Tratamiento prescrito</summary>' + consultRx(c) + '</details>' + consultPlan(c) + '</section><section class="card"><h2>6. Informe rápido</h2>' + consultReport(c) + '</section></div>';
  return top + (!editable ? '<div class="banner">Lectura de borrador. Solo el médico tratante o un usuario autorizado puede editar.</div>' : '') + '<fieldset class="cc-editor" ' + (editable ? '' : 'disabled') + '>' + '<div id="cc-alerts">' + alerts + '</div>' + (c.mode === 'quick' ? quick : '<div class="cc-layout"><aside class="cc-steps card" aria-label="Pasos de consulta">' + CONSULT.steps.map((label, i) => '<button class="row" data-act="ccStep" data-i="' + i + '" ' + (i === step ? 'aria-current="step"' : '') + '><div class="grow">' + esc(label) + '<div class="small muted">' + CONSULT.stepState(c, p, i) + '</div></div></button>').join('') + '</aside><div class="cc-section">' + consultSection(c, step) + '</div><details class="cc-summary card" ' + (matchMedia('(min-width:1024px)').matches ? 'open' : '') + '><summary>Resumen clínico</summary><div id="consult-summary">' + consultSummary(c) + '</div></details></div>') + '</fieldset>';
}
ACTIONS.ccAddendum = () => {
  const c = consultOf(param);
  if (!c || c.status !== 'firmada' || !consultAccessible(c) || !(c.doc === myDoc() || can('consulta.firmar'))) return;
  ACTIONS.addendum({
    dataset: {
      id: c.noteId
    }
  });
};
function consultPdf(c, kind = 'report', opts = {}) {
  const p = c.patientSnapshot || pat(c.pid),
    d = c.report.signedDoctor || med(c.doc);
  const titles = {
    report: 'Informe de consulta médica',
    recipe: 'Récipe médico',
    orders: 'Orden de exámenes',
    referral: 'Referencia médica',
    attendance: 'Constancia de asistencia',
    rest: 'Constancia de reposo médico',
    patient: 'Indicaciones para el paciente'
  };
  // Constancias: documentos para terceros (empleo, estudios); no llevan alergias ni historia, solo lo necesario
  const certificate = kind === 'attendance' || kind === 'rest';
  const doc = pdfNew(titles[kind], [fdate(c.date) + ' ' + c.time + ' · Caracas', d?.name || 'Médico no documentado', c.specialty]);
  let y = PG.top;
  y = pdfInfoBox(doc, y, certificate ? [['Paciente', p.name], ['Cédula', p.ci || 'Sin documento']] :
    [['Paciente', p.name], ['Documento', p.ci || 'Sin documento'], ['Historia', p.code], ['Edad', CONSULT.age(p.birth, c.date) === null ? 'No documentada' : CONSULT.age(p.birth, c.date) + ' años']], 2);
  if (!certificate) y = pdfPara(doc, y, CONSULT.allergyText(c.historySnapshot || p.history), {
    size: 9,
    bold: true
  });
  if (c.status !== 'firmada') y = pdfPara(doc, y, 'BORRADOR · sin firma. Orden solicitada; no acredita realización.', {
    bold: true
  });
  if (kind === 'report') {
    /* Cada bloque del informe: la primera línea corta es su título (Motivo, Antecedentes…) */String(c.status === 'firmada' ? c.report.signedText : c.report.draft || '').split(/\n{2,}/).forEach(block => {
      const [h, ...rest] = block.split('\n');
      if (rest.length && h.trim().length <= 60) {
        y = pdfSection(doc, y + 6, h.trim());
        y = pdfPara(doc, y, rest.join('\n'));
      } else y = pdfPara(doc, y, block);
    });
  }
  if (kind === 'recipe') {
    y = pdfSection(doc, y, 'Tratamiento prescrito');
    c.rx.filter(r => r.drug).forEach((r, i) => {
      y = pdfPara(doc, y, i + 1 + '. ' + r.drug + ' · ' + [r.presentation, r.dose, r.unit, r.route, r.freq, r.duration, r.qty ? 'Cantidad: ' + r.qty : '', r.notes].filter(Boolean).join(' · '));
    });
    y = pdfPara(doc, y, c.plan.instructions.concat(c.plan.notes || []).join('\n'));
  }
  if (kind === 'orders') {
    y = pdfSection(doc, y, 'Exámenes solicitados');
    c.orders.forEach(o => {
      y = pdfPara(doc, y, o.label + ' · ' + o.category + ' · ' + o.priority + ' · Solicitado' + (o.indication ? '\nIndicación: ' + o.indication : ''));
    });
  }
  const longDate = iso => { const [Y, M, D] = String(iso).split('-').map(Number); return new Date(Date.UTC(Y, M - 1, D, 12)).toLocaleDateString('es-VE', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }); };
  const addDays = (iso, n) => { const [Y, M, D] = String(iso).split('-').map(Number); const t = new Date(Date.UTC(Y, M - 1, D + n, 12)); return t.toISOString().slice(0, 10); };
  if (kind === 'attendance') {
    y = pdfSection(doc, y + 10, 'Constancia');
    y = pdfPara(doc, y, 'Quien suscribe, ' + (d?.name || 'médico tratante') + ', hace constar que el(la) ciudadano(a) ' + p.name + ', titular de la cédula de identidad ' +
      (p.ci || 'no documentada') + ', asistió a consulta de ' + (c.specialty || 'medicina') + ' en Quirón Especialidades Médicas el día ' + longDate(c.date) +
      ', desde las ' + c.time + (opts.until ? ' hasta las ' + opts.until : '') + '.', { size: 11 });
    y = pdfPara(doc, y + 6, 'Constancia que se expide a solicitud de la parte interesada, en Caracas, a los ' + longDate(c.date) + '.', { size: 11 });
  }
  if (kind === 'rest') {
    const days = Math.max(1, +opts.days || 1), from = opts.from || c.date, to = addDays(from, days - 1), back = addDays(from, days);
    y = pdfSection(doc, y + 10, 'Reposo médico');
    y = pdfPara(doc, y, 'Quien suscribe, ' + (d?.name || 'médico tratante') + ', hace constar que el(la) ciudadano(a) ' + p.name + ', titular de la cédula de identidad ' +
      (p.ci || 'no documentada') + ', fue evaluado(a) en consulta de ' + (c.specialty || 'medicina') + ' el día ' + longDate(c.date) + ' y amerita reposo médico por ' +
      days + (days === 1 ? ' día' : ' días') + ', desde el ' + longDate(from) + ' hasta el ' + longDate(to) + ', ambos inclusive. Debe reincorporarse a sus actividades el ' + longDate(back) + '.', { size: 11 });
    // El diagnóstico solo se imprime si el médico lo marca (dato privado del paciente)
    if (opts.showDx && c.dx.length) y = pdfPara(doc, y + 4, 'Diagnóstico: ' + c.dx.map(x => x.label).join('; ') + '.', { size: 11 });
    y = pdfPara(doc, y + 6, 'Constancia que se expide a solicitud de la parte interesada, en Caracas, a los ' + longDate(c.date) + '.', { size: 11 });
  }
  if (kind === 'patient') {
    // Indicaciones en lenguaje sencillo para el paciente
    const meds = c.rx.filter(r => r.drug);
    if (meds.length) {
      y = pdfSection(doc, y + 6, 'Sus medicamentos');
      meds.forEach((r, i) => { y = pdfPara(doc, y, (i + 1) + '. ' + r.drug + (r.presentation ? ' (' + r.presentation + ')' : '') + ': ' +
        ['tome ' + [r.dose, r.unit].filter(Boolean).join(' ') || '', r.route ? 'por vía ' + low0(r.route) : '', r.freq ? low0(r.freq) : '', r.duration ? 'durante ' + low0(r.duration) : ''].filter(x => x && x !== 'tome ').join(', ') +
        (r.notes ? '. ' + r.notes : '') + '.', { size: 11 }); });
    }
    const general = (c.plan.instructions || []).concat(c.plan.instructionFree ? [c.plan.instructionFree] : [], c.plan.notes ? [c.plan.notes] : []).filter(Boolean);
    if (general.length) { y = pdfSection(doc, y + 6, 'Recomendaciones'); general.forEach(t => { y = pdfPara(doc, y, '• ' + t, { size: 11 }); }); }
    if (c.orders.length) { y = pdfSection(doc, y + 6, 'Exámenes que debe realizarse'); c.orders.forEach(o => { y = pdfPara(doc, y, '• ' + o.label, { size: 11 }); }); }
    const alarms = (c.plan.alarmSigns || []).concat(c.plan.alarmFree ? [c.plan.alarmFree] : []).filter(Boolean);
    if (alarms.length) { y = pdfSection(doc, y + 6, 'Acuda de inmediato a emergencia si presenta'); alarms.forEach(t => { y = pdfPara(doc, y, '• ' + t, { size: 11, bold: true }); }); }
    if (c.plan.nextControl) { y = pdfSection(doc, y + 6, 'Su próximo control'); y = pdfPara(doc, y, longDate(c.plan.nextControl) + (c.plan.controlTime ? ' a las ' + c.plan.controlTime : '') + ', con ' + (d?.name || 'su médico') + '.', { size: 11, bold: true }); }
    y = pdfPara(doc, y + 8, 'Si tiene dudas, comuníquese con la clínica: (+58-212) 9939173 - 9932747.', { size: 10 });
  }
  if (kind === 'referral') {
    y = pdfSection(doc, y, 'Referencia a ' + c.plan.referral);
    y = pdfPara(doc, y, c.dx.map(d => d.label + ' · ' + d.certainty).join('\n') + '\n' + c.plan.notes);
  }
  if (c.status === 'firmada') {
    if (!certificate && kind !== 'patient') y = pdfPara(doc, y, 'Firmado por ' + (d?.name || '') + ' · ' + new Date(c.report.signedAt).toLocaleString('es-VE', {
      timeZone: 'America/Caracas'
    }) + ' (Caracas)', {
      size: 9
    });
    if (certificate) y = Math.max(y, 520);
    if (kind === 'report') (S.hc.find(n => n.consultId === c.id)?.addenda || []).forEach(a => {
      y = pdfSection(doc, y, 'Adenda · ' + a.at + ' · ' + a.by);
      y = pdfPara(doc, y, a.text);
    });
    pdfSignature(doc, y, d?.name || '', c.specialty + ' · firma y sello', null, docCreds(d));
  }
  return doc;
}
const CONSULT_DOC_NAMES = { report: 'Informe médico', recipe: 'Récipe', orders: 'Órdenes de exámenes', referral: 'Referencia médica' };
async function consultDownload(c, kind) {
  try {
    if (!pdfReady()) return false;
    const name = (CONSULT_DOC_NAMES[kind] || 'Consulta') + ' ' + (pat(c.pid)?.name || '') + ' ' + c.date;
    // Los demás documentos de la misma consulta, a un toque desde la vista previa
    const others = ['report', 'recipe', 'orders', 'referral'].filter(k => k !== kind && (k === 'report' || (k === 'recipe' && c.rx.some(r => r.drug)) || (k === 'orders' && c.orders.length) || (k === 'referral' && c.plan.referral)))
      .map(k => ccButton('ccPdf', CONSULT_DOC_NAMES[k], 'data-kind="' + k + '"')).join('');
    return await pdfSave(() => consultPdf(c, kind), name + '.pdf', { title: CONSULT_DOC_NAMES[kind] || 'Documento', extra: others });
  } catch (e) {
    toast('La consulta está guardada. No se pudo descargar el PDF; puede reintentarlo.');
  }
}
ACTIONS.ccPdf = el => {
  const c = consultOf(param);
  if (c && consultAccessible(c)) return consultDownload(c, el.dataset.kind);
};

// ---------- Constancias e indicaciones al paciente (solo de consultas firmadas) ----------
const low0 = t => t ? String(t).charAt(0).toLowerCase() + String(t).slice(1) : t;
const consultSigned = () => { const c = consultOf(param); return c && consultAccessible(c) && c.status === 'firmada' ? c : null; };
ACTIONS.ccPatientSheet = async () => {
  const c = consultSigned(); if (!c || !pdfReady()) return;
  log('Indicaciones al paciente entregadas', pat(c.pid)?.code || '');
  await pdfSave(() => consultPdf(c, 'patient'), 'Indicaciones ' + (pat(c.pid)?.name || '') + ' ' + c.date + '.pdf');
};
ACTIONS.ccCertAttendance = () => {
  const c = consultSigned(); if (!c) return;
  openSheet('Constancia de asistencia', patientBand(c.pid) +
    '<div class="form"><div class="field"><label for="cert-from">Llegó a las</label><input class="input" id="cert-from" value="' + esc(c.time) + '" disabled></div>' +
    '<div class="field"><label for="cert-until">Se retiró a las (opcional)</label><input class="input" type="time" id="cert-until"></div></div>',
    '<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="ccCertAttendanceDo">Descargar constancia</button>');
};
ACTIONS.ccCertAttendanceDo = async () => {
  const c = consultSigned(); if (!c || !pdfReady()) return;
  const until = val('cert-until');
  if (until && until <= c.time) { toast('La hora de salida debe ser posterior a la llegada (' + c.time + ').'); return; }
  closeSheet(); log('Constancia de asistencia emitida', pat(c.pid)?.code || '');
  await pdfSave(() => consultPdf(c, 'attendance', { until }), 'Constancia de asistencia ' + (pat(c.pid)?.name || '') + ' ' + c.date + '.pdf');
};
ACTIONS.ccCertRest = () => {
  const c = consultSigned(); if (!c) return;
  openSheet('Reposo médico', patientBand(c.pid) +
    '<div class="form"><div class="field"><label for="rest-days">Días de reposo</label><input class="input" type="number" min="1" max="90" id="rest-days" value="1"></div>' +
    '<div class="field"><label for="rest-from">Desde</label><input class="input" type="date" id="rest-from" value="' + esc(c.date) + '"></div></div>' +
    '<div class="guide-options">' + [1, 2, 3, 5, 7, 15].map(n => '<button class="btn" type="button" onclick="document.getElementById(\'rest-days\').value=' + n + '">' + n + (n === 1 ? ' día' : ' días') + '</button>').join('') + '</div>' +
    '<label class="hstack small"><input type="checkbox" id="rest-dx"> Incluir el diagnóstico en la constancia (solo si el paciente lo autoriza)</label>',
    '<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="ccCertRestDo">Descargar constancia</button>');
};
ACTIONS.ccCertRestDo = async () => {
  const c = consultSigned(); if (!c || !pdfReady()) return;
  const days = Math.round(+val('rest-days')), from = val('rest-from');
  if (!(days >= 1 && days <= 90)) { toast('Indique entre 1 y 90 días de reposo.'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) { toast('Indique la fecha de inicio del reposo.'); return; }
  const showDx = document.getElementById('rest-dx')?.checked;
  closeSheet(); log('Constancia de reposo emitida', (pat(c.pid)?.code || '') + ' · ' + days + ' día(s) desde ' + from);
  await pdfSave(() => consultPdf(c, 'rest', { days, from, showDx }), 'Reposo ' + (pat(c.pid)?.name || '') + ' ' + from + '.pdf');
};
