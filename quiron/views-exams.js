// Exámenes / Laboratorio, por secciones según quién entra:
//  · "Crear examen" — médicos y laboratorio
//  · "Solicitudes y resultados" — médicos (los suyos), laboratorio y administración (consulta)
//  · "Área de laboratorio" — solo laboratorio: procesar, cargar y validar resultados, catálogo y valores de referencia
// Rayos X e imagen tiene su propia área de trabajo. Todo examen queda en el perfil del paciente.

const workerArea = () => role() === 'laboratorio' ? 'laboratorio' : role() === 'imagen' ? 'imagen' : null;
// Quién puede procesar resultados: el personal del área y el administrador (control maestro)
const canWork = area => role() === 'admin' || workerArea() === area;
const examPending = e => e.status !== 'listo';
const docName = id => med(id)?.name || 'Particular (sin médico)';
window.examBadge = () => {
  if (workerArea()) return S.exams.filter(e => e.area === workerArea() && examPending(e)).length;
  if (isClin()) return S.exams.filter(e => e.doc === myDoc() && e.status === 'listo' && !e.seen).length;
  return S.exams.filter(examPending).length;
};
window.examFlagPill = e => {
  if (e.status !== 'listo') return `<span class="pill ${EX_ST[e.status][1]}">${EX_ST[e.status][0]}</span>`;
  if (e.external) return '<span class="pill info">Externo</span>';
  if (e.area === 'imagen') return '<span class="pill good">Informe listo</span>';
  const n = e.results.filter(r => r.flag).length;
  return n ? `<span class="pill bad">${n} fuera de rango</span>` : '<span class="pill good">Dentro de rango</span>';
};
const areaName = a => a === 'laboratorio' ? 'Laboratorio' : 'Rayos X e imagen';
const fileSrc = f => f.url || `/_blob/${f.id}`;
const fileLinks = files => (files || []).length ? `<div class="hstack">${files.map(f => f.type?.startsWith('image/') ? `<a href="${fileSrc(f)}" target="_blank" rel="noopener"><img src="${fileSrc(f)}" alt="${esc(f.name)}" style="height:96px;border-radius:8px;border:1px solid var(--line)"></a>` : `<a class="btn sm" href="${fileSrc(f)}" target="_blank" rel="noopener">Abrir ${esc(f.name)}</a>`).join('')}</div>` : '';
const examRow = (e, mode = 'view') => { const p = pat(e.pid); const me = myDoc();
  return `<button class="row" data-act="openExam" data-id="${e.id}" data-mode="${mode}"><span class="avatar" style="${e.area === 'imagen' ? 'background:var(--warn-soft);color:var(--warn)' : ''}">${e.area === 'imagen' ? 'Rx' : 'Lab'}</span>
    <div class="grow"><div class="t">${e.num} · ${esc(p.name)} ${e.priority === 'urgente' ? '<span class="pill bad">Urgente</span>' : ''} ${me && e.status === 'listo' && !e.seen ? '<span class="pill info">Nuevo</span>' : ''}</div><div class="s">${esc(e.tests.join(', '))} · ${esc(docName(e.doc))} · ${fdate(e.date)}</div></div>
    <div class="end">${examFlagPill(e)}</div></button>`; };
const byPriority = (a, b) => (a.priority === 'urgente' ? 0 : 1) - (b.priority === 'urgente' ? 0 : 1) || b.date.localeCompare(a.date);

// Pestañas simples según quién entra. Crear un examen siempre es el botón grande de arriba ("Nuevo examen").
const workAreas = () => role() === 'laboratorio' ? ['laboratorio'] : role() === 'imagen' ? ['imagen'] : role() === 'admin' ? ['laboratorio', 'imagen'] : [];
function examTabs() {
  if (isClin()) return [['todos', 'Mis exámenes']];
  if (role() === 'imagen') return [['pendientes', 'Por hacer'], ['todos', 'Todos los estudios']];
  if (role() === 'laboratorio' || role() === 'admin') return [['pendientes', 'Por hacer'], ['todos', 'Todos los exámenes'], ['catalogo', 'Catálogo y valores de referencia']];
  return [['todos', 'Todos los exámenes']];
}
const canCreateExam = () => can('examen.pedir');
const createLabel = () => isClin() ? 'Solicitar examen' : role() === 'imagen' ? 'Nuevo estudio' : 'Nuevo examen';

VIEWS.examenes = () => {
  const tabs = examTabs(); const tab = tabs.some(t => t[0] === UI.exTab) ? UI.exTab : tabs[0][0];
  const title = role() === 'laboratorio' ? 'Laboratorio' : role() === 'imagen' ? 'Rayos X e imagen' : 'Exámenes';
  const sub = isClin() ? 'Lo que pediste y sus resultados. Todo queda también en el perfil del paciente.' : 'Toca "' + createLabel() + '" para registrar un examen y cargar su resultado en el mismo paso.';
  const body = tab === 'pendientes' ? queueView() : tab === 'catalogo' ? catalogView() : listView();
  return header(title, sub, `${canUploadExt() ? `<button class="btn" data-act="extExam" data-area="${role() === 'imagen' ? 'imagen' : 'laboratorio'}">Subir examen externo</button>` : ''}${canCreateExam() ? `<button class="btn primary big" data-act="newExam">+ ${createLabel()}</button>` : ''}`) +
    (tabs.length > 1 ? `<div class="seg" role="group" aria-label="Secciones" style="margin-bottom:16px">${tabs.map(([k, l]) => `<button data-act="exTab" data-k="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>` : '') + body;
};
ACTIONS.exTab = el => { UI.exTab = el.dataset.k; render(); };

// "Por hacer": lo que falta procesar (pedido por un médico o guardado sin resultado). Tocar = cargar resultado.
function queueView() {
  const areas = workAreas(); const pend = S.exams.filter(e => areas.includes(e.area) && examPending(e)).sort(byPriority);
  const done = S.exams.filter(e => areas.includes(e.area) && (e.readyAt || '').startsWith(dAt(0)));
  return `<div class="grid g4">${kpi('Por hacer', pend.length)}${kpi('Urgentes', pend.filter(e => e.priority === 'urgente').length, '', pend.some(e => e.priority === 'urgente') ? 'alert' : '')}${kpi('Validados hoy', done.length)}</div>
    <div class="sec"><h3>Toca un examen para cargar su resultado</h3><div class="list">${pend.map(e => examRow(e, 'work')).join('') || '<div class="empty">No hay nada pendiente.</div>'}</div></div>
    ${done.length ? `<div class="sec"><h3>Validados hoy</h3><div class="list">${done.map(e => examRow(e)).join('')}</div></div>` : ''}`;
}

// ---------- Solicitudes y resultados (vista compartida) ----------
function listView() {
  const me = myDoc(); const wa = workerArea();
  const area = wa || UI.exA || 'todos'; const st = UI.exS || 'todos';
  const base = S.exams.filter(e => (area === 'todos' || e.area === area) && (!me || e.doc === me));
  const list = base.filter(e => st === 'todos' || (st === 'listos' ? !examPending(e) : examPending(e))).sort(byPriority);
  const q = (UI.exQ || '').toLowerCase(); const shown = list.filter(e => !q || (pat(e.pid).name + pat(e.pid).ci + e.num + e.tests.join(' ')).toLowerCase().includes(q));
  return `<div class="grid g4">${kpi('Solicitados', base.filter(e => e.status === 'solicitado').length)}${kpi('En proceso', base.filter(e => ['muestra', 'proceso'].includes(e.status)).length)}${kpi('Con resultado', base.filter(e => e.status === 'listo').length)}${kpi(me ? 'Resultados sin ver' : 'Listos hoy', me ? base.filter(e => e.status === 'listo' && !e.seen).length : base.filter(e => (e.readyAt || '').startsWith(dAt(0))).length)}</div>
  <div class="between sec" style="margin-bottom:12px">
    <div class="hstack"><div class="seg" role="group" aria-label="Estado">${[['todos', 'Todos'], ['pendientes', 'Pendientes'], ['listos', 'Con resultado']].map(([k, l]) => `<button data-act="exS" data-k="${k}" aria-pressed="${st === k}">${l}</button>`).join('')}</div>
    ${wa ? '' : `<div class="seg" role="group" aria-label="Área">${[['todos', 'Todos'], ['laboratorio', 'Laboratorio'], ['imagen', 'Imagen']].map(([k, l]) => `<button data-act="exA" data-k="${k}" aria-pressed="${area === k}">${l}</button>`).join('')}</div>`}</div>
    <div class="search" style="min-width:220px">${icon('buscar')}<input class="input" id="exQ" placeholder="Paciente, cédula o examen" value="${esc(UI.exQ || '')}" data-in="exSearch" aria-label="Buscar examen"></div></div>
  <div class="list">${shown.map(e => examRow(e)).join('') || '<div class="empty">No hay exámenes en esta lista.</div>'}</div>`;
}
ACTIONS.exS = el => { UI.exS = el.dataset.k; render(); };
ACTIONS.exA = el => { UI.exA = el.dataset.k; render(); };
ACTIONS.exSearch = el => { UI.exQ = el.value; const pos = el.selectionStart; render(); const n = document.getElementById('exQ'); n.focus(); n.setSelectionRange(pos, pos); };

// ---------- "Nuevo examen": todo en una sola ventana (paciente → exámenes → resultados) ----------
// El laboratorio (y el administrador) carga el resultado ahí mismo; rayos X escribe su informe;
// el médico solo lo solicita. Siempre queda guardado en el perfil del paciente.
const fillsNow = () => ['laboratorio', 'admin', 'imagen'].includes(role());
function ewChoices() {
  const lab = role() !== 'imagen' ? [...Object.keys(LAB_COMBOS), ...Object.keys(labPanels())] : [];
  const img = role() !== 'laboratorio' ? IMG_TESTS : [];
  return { lab, img };
}
function ewRest() {
  const w = UI.ew; const { lab, img } = ewChoices();
  const chip = t => { const on = w.tests.includes(t); return `<button class="btn sm ${on ? 'primary' : ''}" data-act="ewTest" data-t="${esc(t)}" aria-pressed="${on}">${on ? '✓ ' : ''}${esc(t)}</button>`; };
  const labSel = w.tests.filter(isLabTest), imgSel = w.tests.filter(t => IMG_TESTS.includes(t));
  let results = '';
  if (fillsNow() && role() !== 'imagen' && labSel.length) {
    const rows = blankResults(labSel); const groups = [...new Set(rows.map(r => r.test))];
    results = `<div><b>3. Resultados</b> <span class="small muted">llénalos ahora o déjalos para después</span>${groups.map(g => `<div style="margin-top:10px"><div class="small muted" style="margin-bottom:4px">${esc(g)}</div><div class="tablewrap"><table><thead><tr><th>Parámetro</th><th>Resultado</th><th>Unidad</th><th>Referencia</th><th></th></tr></thead><tbody>
      ${rows.map((r, i) => r.test !== g ? '' : `<tr><td>${esc(r.param)}</td><td><input class="input" style="width:110px" id="ew-v${i}" value="${esc(w.values[r.param] || '')}" data-in="ewVal" data-i="${i}" data-p="${esc(r.param)}" data-ref="${esc(r.ref)}" inputmode="decimal" aria-label="${esc(r.param)}"></td><td class="muted">${esc(r.unit)}</td><td class="muted">${esc(r.ref || '—')}</td><td id="ew-f${i}">${flagCell(w.values[r.param], r.ref)}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}</div>`;
  }
  if (role() === 'imagen' && imgSel.length) results = `<div><b>3. Informe</b><textarea class="input" id="ew-rep" rows="7" style="margin-top:8px" placeholder="Hallazgos y conclusión">${esc(w.report || '')}</textarea></div>`;
  return `<div><b>2. ${role() === 'imagen' ? 'Estudio' : 'Exámenes'}</b>
      ${lab.length ? `<div class="small muted" style="margin:8px 0 4px">Laboratorio</div><div class="hstack">${lab.map(chip).join('')}</div>` : ''}
      ${img.length ? `<div class="small muted" style="margin:10px 0 4px">Rayos X, ecografía y otros</div><div class="hstack">${img.map(chip).join('')}</div>` : ''}</div>
    <div class="form">${myDoc() ? '' : `<div class="field"><label for="ew-d">Médico que lo pide</label><select class="input" id="ew-d" data-ch="ewKeep"><option value="">Particular (sin médico de la clínica)</option>${consultDocs().map(m => `<option value="${m.id}" ${m.id === w.doc ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>`}
      <div class="field"><label for="ew-x">Motivo o diagnóstico (opcional)</label><input class="input" id="ew-x" value="${esc(w.notes)}" data-in="ewKeep"></div></div>
    <label class="hstack small"><input type="checkbox" id="ew-u" ${w.urgent ? 'checked' : ''} data-ch="ewKeep"> Urgente</label>
    ${results}`;
}
const ewFoot = () => fillsNow()
  ? `<span class="note" id="ew-msg"></span><button class="btn" data-act="ewSave">Guardar, resultado después</button><button class="btn primary" data-act="ewSave" data-validate="1">${role() === 'imagen' ? 'Guardar y enviar informe' : 'Guardar y validar'}</button>`
  : `<span class="note" id="ew-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="ewSave">Enviar solicitud</button>`;
ACTIONS.newExam = el => {
  if (!canCreateExam()) { toast('No tienes permiso para crear exámenes'); return; }
  UI.ew = { tests: el?.dataset?.tests ? el.dataset.tests.split('|') : [], doc: myDoc() || '', notes: '', urgent: false, values: {}, report: '', admId: el?.dataset?.adm || null, apptId: el?.dataset?.appt || null };   // pedido desde un ingreso o una cirugía: queda ligado a él
  ppReset('ex', { pid: el?.dataset?.pid || null });
  openSheet(createLabel(), `<div><b>1. Paciente</b><div id="pp-ex" style="margin-top:8px">${patientPicker('ex')}</div></div><div id="ew-rest" style="display:grid;gap:16px">${ewRest()}</div>`, ewFoot(), { wide: true });
};
const ewKeep = () => { const w = UI.ew; const g = id => document.getElementById(id); if (g('ew-d')) w.doc = g('ew-d').value; if (g('ew-x')) w.notes = g('ew-x').value; if (g('ew-u')) w.urgent = g('ew-u').checked; if (g('ew-rep')) w.report = g('ew-rep').value; };
ACTIONS.ewKeep = () => ewKeep();
ACTIONS.ewTest = el => { ewKeep(); const l = UI.ew.tests; const t = el.dataset.t; l.includes(t) ? l.splice(l.indexOf(t), 1) : l.push(t); document.getElementById('ew-rest').innerHTML = ewRest(); };
ACTIONS.ewVal = el => { UI.ew.values[el.dataset.p] = el.value; document.getElementById('ew-f' + el.dataset.i).innerHTML = flagCell(el.value, el.dataset.ref); };
ACTIONS.ewSave = el => {
  ewKeep(); const w = UI.ew; const msg = document.getElementById('ew-msg'); const validate = !!el.dataset.validate;
  // Valores más de 25 % por debajo de lo normal: se pide confirmación (segundo clic) antes de registrar nada
  const lowNew = validate && role() !== 'imagen' ? checkList(blankResults(w.tests.filter(isLabTest)).map(r => ({ ...r, value: String(w.values[r.param] || '').trim() }))) : [];
  const sigNew = lowNew.map(r => r.param + '=' + r.value).join('|');
  if (lowNew.length && w.lowOk !== sigNew) { w.lowOk = sigNew;
    msg.innerHTML = `<span class="pill warn">⚠ Verifique</span> ${lowNew.map(r => `<b>${esc(r.param)}</b> ${esc(r.value)} ${esc(r.unit)} (normal ${esc(r.ref)})`).join(' · ')}: más de 25 % por debajo de lo normal. Revise la muestra y el valor; si es correcto, toque de nuevo el botón.`;
    return; }
  const who = pickerCommit('ex'); if (!who.ok) { msg.textContent = who.msg; return; }
  if (!w.tests.length) { msg.textContent = 'Toca al menos un examen.'; return; }
  const labSel = w.tests.filter(isLabTest), imgSel = w.tests.filter(t => IMG_TESTS.includes(t));
  if (validate && role() !== 'imagen' && labSel.length && !Object.values(w.values).some(v => String(v).trim())) { msg.textContent = 'Escribe al menos un resultado, o usa "Guardar, resultado después".'; return; }
  if (validate && role() === 'imagen' && !w.report.trim()) { msg.textContent = 'Escribe el informe, o usa "Guardar, resultado después".'; return; }
  const orders = createOrders({ id: null, pid: who.pid, doc: myDoc() || w.doc || null, tests: w.tests, urgent: w.urgent, dx: w.notes ? [w.notes] : [], admId: w.admId && admOf(w.admId)?.pid === who.pid ? w.admId : null, apptId: w.apptId || null });
  if (lowNew.length) log('Valores bajos confirmados por el bioanalista', `${pat(who.pid).name} · ${lowNew.map(r => `${r.param} ${r.value}`).join(', ')}`);
  if (validate) orders.forEach(o => {
    if (o.area === 'laboratorio' && role() !== 'imagen') { o.results = blankResults(o.tests).map(r => { const v = String(w.values[r.param] || '').trim(); return { ...r, value: v, flag: flagOf(v, r.ref) }; }); o.status = 'listo'; o.readyAt = nowStamp(); o.by = actor(); o.seen = false; }
    if (o.area === 'imagen' && role() === 'imagen') { o.report = w.report.trim(); o.status = 'listo'; o.readyAt = nowStamp(); o.by = actor(); o.seen = false; }
  });
  log(validate ? 'Examen registrado con resultado' : isClin() ? 'Examen solicitado' : 'Examen registrado', `${pat(who.pid).name} · ${w.tests.join(', ')}`); save();
  closeSheet(); render();
  toast(`${orders.map(o => o.num).join(', ')} ${validate ? 'validado' : isClin() ? 'solicitado' : 'guardado'} · queda en el perfil de ${pat(who.pid).name}`);
};

// Catálogo de exámenes: el laboratorio define parámetros, unidades y valores de referencia
function catalogView() {
  const cat = UI.cat = UI.cat || JSON.parse(JSON.stringify(labPanels()));
  return `<div class="banner" style="margin-bottom:14px">Los cambios aplican a los resultados nuevos. Los resultados ya validados conservan el valor de referencia con que se emitieron.</div>
  <div class="grid g2" style="align-items:start">${Object.entries(cat).map(([panel, rows], pi) => `<div class="card"><h2>${esc(panel)} <button class="btn ghost sm" data-act="catDelPanel" data-p="${esc(panel)}">Quitar</button></h2>
    <div class="stack">${rows.map((r, ri) => `<div class="catrow"><input class="input" id="cat-${pi}-${ri}-0" value="${esc(r[0])}" placeholder="Parámetro" aria-label="Parámetro"><input class="input" id="cat-${pi}-${ri}-1" value="${esc(r[1])}" placeholder="Unidad" aria-label="Unidad"><input class="input" id="cat-${pi}-${ri}-2" value="${esc(r[2])}" placeholder="Ej. 12–16, <200" aria-label="Valor de referencia"><button class="btn ghost" data-act="catDelRow" data-p="${esc(panel)}" data-i="${ri}" aria-label="Quitar parámetro">✕</button></div>`).join('')}</div>
    <button class="btn sm" style="margin-top:10px" data-act="catAddRow" data-p="${esc(panel)}">Agregar parámetro</button></div>`).join('')}</div>
  <div class="card sec between"><div class="hstack" style="flex:1"><input class="input" id="cat-new" placeholder="Nombre del examen nuevo, ej. Perfil tiroideo" style="max-width:360px" aria-label="Examen nuevo"><button class="btn" data-act="catAddPanel">Agregar examen</button></div><button class="btn primary" data-act="catSave">Guardar catálogo</button></div>`;
}
function catRead() { const cat = UI.cat; Object.keys(cat).forEach((panel, pi) => { cat[panel] = cat[panel].map((r, ri) => [0, 1, 2].map(k => document.getElementById(`cat-${pi}-${ri}-${k}`)?.value.trim() ?? r[k])); }); }
ACTIONS.catAddRow = el => { catRead(); UI.cat[el.dataset.p].push(['', '', '']); render(); };
ACTIONS.catDelRow = el => { catRead(); UI.cat[el.dataset.p].splice(+el.dataset.i, 1); render(); };
ACTIONS.catDelPanel = el => { catRead(); delete UI.cat[el.dataset.p]; render(); };
ACTIONS.catAddPanel = () => { catRead(); const n = val('cat-new').trim(); if (!n) { toast('Escribe el nombre del examen'); return; } if (UI.cat[n]) { toast('Ese examen ya existe'); return; } UI.cat[n] = [['', '', '']]; render(); };
ACTIONS.catSave = () => {
  catRead(); const clean = {}; Object.entries(UI.cat).forEach(([p, rows]) => { const r = rows.filter(x => x[0]); if (r.length) clean[p] = r; });
  S.labCatalog = clean; UI.cat = null; log('Catálogo de laboratorio actualizado', `${Object.keys(clean).length} exámenes`); save(); render(); toast('Catálogo guardado');
};

// ---------- Ver / trabajar una orden ----------
ACTIONS.openExam = el => {
  const e = S.exams.find(x => x.id === el.dataset.id); if (!e) return; const p = pat(e.pid);
  const worker = canWork(e.area);
  if (isClin() && e.doc === myDoc() && e.status === 'listo' && !e.seen) { e.seen = true; save(); renderSide(); }
  const head = `<div class="between"><div><b style="font-size:17px">${esc(p.name)}</b><div class="small muted">${esc(p.code)} · ${esc(p.ci)} · ${ageTxt(p)} · ${p.sex === 'F' ? 'Femenino' : p.sex === 'M' ? 'Masculino' : 'sexo no registrado'}</div></div><div class="hstack">${e.priority === 'urgente' ? '<span class="pill bad">Urgente</span>' : ''}${examFlagPill(e)}</div></div>
    <div class="list"><div class="row"><div class="grow"><div class="s">Solicitado por</div><div class="t">${esc(docName(e.doc))} · ${fdate(e.date)}</div></div></div>
      <div class="row"><div class="grow"><div class="s">Exámenes</div><div class="t">${esc(e.tests.join(', '))}</div></div></div>
      ${e.notes ? `<div class="row"><div class="grow"><div class="s">Diagnóstico o motivo</div><div class="t">${esc(e.notes)}</div></div></div>` : ''}</div>
    <div class="small muted">Guardado en el perfil del paciente ${esc(p.code)}${canSee('pacientes') ? ` · <button class="btn ghost sm" data-go="pacientes" data-param="${p.id}">Abrir perfil</button>` : ''}</div>`;
  const noteBtn = e.note && S.hc.find(n => n.id === e.note) && can('pac.historia') ? `<button class="btn" data-act="openNote" data-id="${e.note}">Ver historia</button>` : '';
  if (e.status === 'listo') { openSheet(`${e.num} · ${areaName(e.area)}`, head + resultView(e), `${noteBtn}${e.external ? '<button class="btn" data-act="close">Cerrar</button>' : `<button class="btn primary" data-act="pdfExam" data-id="${e.id}">Descargar resultado (PDF)</button>`}`, { wide: true }); return; }
  if (!worker || el.dataset.mode !== 'work') {
    openSheet(`${e.num} · ${areaName(e.area)}`, head + `<div class="banner">${EX_ST[e.status][0]}. El resultado aparecerá aquí y en el perfil del paciente en cuanto ${e.area === 'laboratorio' ? 'el laboratorio' : 'rayos X'} lo valide.</div>`,
      worker ? `<button class="btn primary" data-act="openExam" data-id="${e.id}" data-mode="work">Cargar resultado ahora</button>` : noteBtn, { wide: true }); return;
  }
  UI.exr = { id: e.id, values: Object.fromEntries((e.results.length ? e.results : blankResults(e.tests)).map((r, i) => [i, r.value])), report: e.report || '', files: [...(e.files || [])], pending: [] };
  openSheet(`${e.num} · ${areaName(e.area)}`, head + workForm(e), workFoot(e), { wide: true });
};
function resultView(e) {
  if (e.external) return `<div class="banner">Resultado externo de <b>${esc(e.external.lab)}</b> · fecha ${fdate(e.date)} · cargado por ${esc(e.external.uploadedBy)} el ${e.external.at}</div>
    ${e.report ? `<div><div class="small muted">Observaciones</div><div>${esc(e.report)}</div></div>` : ''}${fileLinks(e.files)}`;
  if (e.area === 'imagen') return `<div><div class="small muted">Informe · ${e.readyAt} · ${esc(e.by)}</div><div class="card" style="white-space:pre-wrap;margin-top:6px">${esc(e.report || 'Sin informe escrito.')}</div></div>${fileLinks(e.files)}`;
  const groups = [...new Set(e.results.map(r => r.test))];
  return `<div class="small muted">Validado ${e.readyAt} · ${esc(e.by)}</div>${groups.map(g => `<div><b class="small">${esc(g)}</b><div class="tablewrap" style="margin-top:6px"><table><thead><tr><th>Parámetro</th><th class="num">Resultado</th><th>Unidad</th><th>Referencia</th><th>Anterior</th></tr></thead><tbody>
    ${e.results.filter(r => r.test === g).map(r => { const pv = prevValue(e.pid, r.param, e.readyAt || e.date, e.id); const a = parseFloat(String(r.value).replace(',', '.')), b = pv ? parseFloat(String(pv.value).replace(',', '.')) : NaN;
      return `<tr><td>${esc(r.param)}</td><td class="num" style="font-weight:600;color:${r.flag ? 'var(--bad)' : 'inherit'}">${esc(r.value || '—')}${r.flag ? ` <span class="pill bad">${r.flag}</span>` : ''}</td><td class="muted">${esc(r.unit)}</td><td class="muted">${esc(r.ref || '—')}</td>
      <td class="muted">${pv ? `${esc(pv.value)} ${!isNaN(a) && !isNaN(b) && a !== b ? (a > b ? '↑' : '↓') : ''} <span class="small">(${fdate(pv.date)})</span>` : '—'}</td></tr>`; }).join('')}</tbody></table></div></div>`).join('')}${fileLinks(e.files)}`;
}
function workForm(e) {
  const flow = e.area === 'laboratorio' ? [['muestra', 'Muestra tomada'], ['proceso', 'En proceso']] : [['proceso', 'En proceso']];
  const steps = `<div class="hstack"><span class="small muted">Estado:</span>${flow.map(([k, l]) => `<button class="btn sm ${e.status === k ? 'primary' : ''}" data-act="exStatus" data-id="${e.id}" data-st="${k}">${l}</button>`).join('')}</div>`;
  const files = `<div><b class="small">Archivos</b> <span class="small muted">${e.area === 'laboratorio' ? 'PDF o foto del resultado del equipo' : 'Imágenes del estudio o PDF'}</span>
    <div class="hstack" style="margin-top:6px"><label class="btn sm" for="exr-files">Adjuntar archivos</label><input id="exr-files" type="file" multiple accept="image/*,application/pdf" hidden data-ch="exrFiles">${e.area === 'laboratorio' ? '<button class="btn sm" data-act="exrAI" id="exr-ai" disabled>Leer resultados de la foto con IA</button>' : ''}<span class="small muted" id="exr-msg"></span></div>
    <div class="hstack" id="exr-thumbs" style="margin-top:6px">${fileLinks(UI.exr.files)}</div></div>`;
  if (e.area === 'imagen') return steps + files + `<div class="field"><label for="exr-rep">Informe del estudio</label><textarea class="input" id="exr-rep" rows="8" placeholder="Hallazgos y conclusión">${esc(UI.exr.report)}</textarea></div>`;
  const rows = e.results.length ? e.results : blankResults(e.tests); const groups = [...new Set(rows.map(r => r.test))];
  return steps + groups.map(g => `<div><b class="small">${esc(g)}</b><div class="tablewrap" style="margin-top:6px"><table><thead><tr><th>Parámetro</th><th>Resultado</th><th>Unidad</th><th>Referencia</th><th></th></tr></thead><tbody>
    ${rows.map((r, i) => r.test !== g ? '' : `<tr><td>${esc(r.param)}</td><td><input class="input" style="width:110px" id="exv-${i}" value="${esc(UI.exr.values[i] || '')}" data-in="exVal" data-i="${i}" inputmode="decimal" aria-label="${esc(r.param)}"></td><td class="muted">${esc(r.unit)}</td><td class="muted">${esc(r.ref || '—')}</td><td id="exf-${i}">${flagCell(UI.exr.values[i], r.ref)}</td></tr>`).join('')}</tbody></table></div></div>`).join('') + files;
}
const workFoot = e => `<span class="note" id="exw-msg">Al validar, el resultado llega al médico y queda en el perfil del paciente.</span><button class="btn" data-act="exSaveDraft" data-id="${e.id}">Guardar sin enviar</button><button class="btn primary" data-act="exSend" data-id="${e.id}">${e.area === 'laboratorio' ? 'Validar y enviar' : 'Enviar informe'}</button>`;
ACTIONS.exVal = el => { const i = +el.dataset.i; UI.exr.values[i] = el.value; const e = S.exams.find(x => x.id === UI.exr.id); const r = (e.results.length ? e.results : blankResults(e.tests))[i]; document.getElementById('exf-' + i).innerHTML = flagCell(el.value, r.ref); };
ACTIONS.exStatus = el => {
  const e = S.exams.find(x => x.id === el.dataset.id);
  if (e.area === 'laboratorio') e.results = (e.results.length ? e.results : blankResults(e.tests)).map((r, i) => { const v = (document.getElementById('exv-' + i)?.value ?? r.value ?? '').trim(); return { ...r, value: v, flag: flagOf(v, r.ref) }; });
  e.status = el.dataset.st; log('Examen: ' + EX_ST[e.status][0], `${e.num} · ${pat(e.pid).name}`); save(); renderSide();
  ACTIONS.openExam({ dataset: { id: e.id, mode: 'work' } }); toast(EX_ST[e.status][0]);
};
ACTIONS.exrFiles = el => {
  UI.exr.pending = [...el.files];
  document.getElementById('exr-thumbs').innerHTML = fileLinks(UI.exr.files) + UI.exr.pending.map(f => f.type.startsWith('image/') ? `<img src="${URL.createObjectURL(f)}" alt="${esc(f.name)}" style="height:96px;border-radius:8px;border:1px solid var(--line)">` : `<span class="pill">${esc(f.name)}</span>`).join('');
  const ai = document.getElementById('exr-ai'); if (ai) ai.disabled = !UI.exr.pending.some(f => f.type.startsWith('image/'));
};
function collectResults(e) {
  const rows = e.results.length ? e.results : blankResults(e.tests);
  return rows.map((r, i) => { const v = (document.getElementById('exv-' + i)?.value ?? UI.exr.values[i] ?? '').trim(); return { ...r, value: v, flag: flagOf(v, r.ref) }; });
}
async function uploadPending(msgEl) {
  if (!UI.exr.pending.length) return true;
  const assets = await getCap('assets');
  if (!assets) { msgEl.textContent = 'Esta vista no permite guardar archivos; se guardan solo los datos.'; return true; }
  msgEl.textContent = 'Subiendo archivos…';
  for (const f of UI.exr.pending) { try { const r = await assets.upload(f); UI.exr.files.push({ id: r.id, type: r.contentType, name: f.name }); } catch (err) { msgEl.textContent = `No se pudo subir ${f.name}.`; return false; } }
  UI.exr.pending = []; return true;
}
async function persistWork(id, send) {
  const e = S.exams.find(x => x.id === id); const msg = document.getElementById('exw-msg');
  if (e.area === 'laboratorio') e.results = collectResults(e); else e.report = val('exr-rep').trim();
  if (send && e.area === 'laboratorio' && !e.results.some(r => r.value)) { msg.textContent = 'Carga al menos un resultado antes de validar.'; return; }
  // Valores más de 25 % por debajo de lo normal: se pide confirmación una vez (segundo clic) y queda registrado quién los confirmó
  const low = send && e.area === 'laboratorio' ? checkList(e.results) : [];
  const sig = low.map(r => r.param + '=' + r.value).join('|');
  if (low.length && UI.exr.lowOk !== sig) { UI.exr.lowOk = sig;
    msg.innerHTML = `<span class="pill warn">⚠ Verifique</span> ${low.map(r => `<b>${esc(r.param)}</b> ${esc(r.value)} ${esc(r.unit)} (normal ${esc(r.ref)})`).join(' · ')}: más de 25 % por debajo de lo normal. Revise la muestra y el valor; si es correcto, toque de nuevo «Validar y enviar».`;
    return; }
  if (low.length) log('Valores bajos confirmados por el bioanalista', `${e.num} · ${low.map(r => `${r.param} ${r.value}`).join(', ')}`);
  if (send && e.area === 'imagen' && !e.report && !UI.exr.files.length && !UI.exr.pending.length) { msg.textContent = 'Escribe el informe o adjunta el estudio antes de enviar.'; return; }
  if (!(await uploadPending(msg))) return;
  e.files = UI.exr.files;
  if (send) { e.status = 'listo'; e.readyAt = nowStamp(); e.by = actor(); e.seen = false; }
  else if (e.status === 'solicitado') e.status = 'proceso';
  log(send ? 'Resultado validado y enviado' : 'Resultado guardado sin enviar', `${e.num} · ${pat(e.pid).name}`); save(); closeSheet(); render();
  toast(send ? (e.doc ? `Resultado enviado a ${docName(e.doc)} y guardado en el perfil` : 'Resultado guardado en el perfil del paciente') : 'Guardado');
}
ACTIONS.exSaveDraft = el => persistWork(el.dataset.id, false);
ACTIONS.exSend = el => persistWork(el.dataset.id, true);

// Leer con IA la foto del resultado impreso por el equipo del laboratorio
ACTIONS.exrAI = async btn => {
  const e = S.exams.find(x => x.id === UI.exr.id); const rows = e.results.length ? e.results : blankResults(e.tests); const msg = document.getElementById('exr-msg');
  const sample = await getCap('sample'); const lim = sample ? await sample.limits().catch(() => null) : null;
  if (!lim?.images) { msg.textContent = 'La lectura con IA no está disponible en esta vista.'; return; }
  const imgs = UI.exr.pending.filter(f => f.type.startsWith('image/')).slice(0, lim.images.maxCount);
  btn.disabled = true; msg.textContent = 'Leyendo el resultado…';
  try {
    const j = await sample.json(`Las imágenes son fotos de un resultado de laboratorio impreso. Busca SOLO estos parámetros y copia el valor tal como aparece (número con coma decimal o texto). Si un parámetro no aparece, usa null. No inventes valores.
Parámetros: ${rows.map(r => r.param).join(', ')}.
Responde solo con JSON: {"valores": {"Hemoglobina": "14,2", ...}}`, { images: imgs });
    let n = 0; rows.forEach((r, i) => { const v = j?.valores?.[r.param]; if (v != null && v !== '') { const inp = document.getElementById('exv-' + i); inp.value = String(v); UI.exr.values[i] = String(v); ACTIONS.exVal(inp); inp.classList.add('low'); n++; } });
    msg.textContent = n ? `Se leyeron ${n} de ${rows.length} valores. Revisa los marcados en amarillo antes de validar.` : 'No se encontraron los valores en la foto.';
  } catch (err) { msg.textContent = err?.code === 'not_granted' ? 'No se dio permiso para usar la IA.' : 'No se pudo leer la foto. Carga los valores a mano.'; }
  finally { btn.disabled = false; }
};

