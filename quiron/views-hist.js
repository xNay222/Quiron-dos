// Historias: archivo de historias en papel (digitalizadas con IA y validadas por una persona)
// y "Quirón IA", que responde preguntas estadísticas sobre historias viejas y nuevas.

window.recPill = r => r.origin === 'nativo' ? '<span class="pill info">Del sistema</span>' : r.status === 'escaneada' ? '<span class="pill">Escaneada · sin leer</span>' : r.status === 'validado' ? '<span class="pill good">Validada</span>' : '<span class="pill warn">Por revisar</span>';
// Historias escaneadas del archivo (PDF en la carpeta del Escritorio): se registran por nombre, cédula y año/mes de la carpeta.
// Aún no están leídas, así que no entran en las estadísticas; el PDF se abre desde el servidor local (/historias/...).
const scannedRecords = () => S.records.filter(r => r.status === 'escaneada');
const recWhen = r => r.period || fdate(r.date);
const pdfUrl = r => '/historias/' + r.file.split('/').map(encodeURIComponent).join('/');
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fmtCi = d => d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : 'Sin cédula';
// Lee la carpeta de historias (a través del servidor local) y registra las que falten; las ya registradas no se duplican
ACTIONS.syncScanned = async () => {
  let list; try { const r = await fetch('/__historias'); if (!r.ok) throw 0; list = await r.json(); }
  catch (e) { toast('No se encontró la carpeta de historias. Abra el software con serve.ps1 en esta computadora.'); return; }
  const have = new Set(scannedRecords().map(r => r.file)); let n = 0;
  list.forEach(h => { if (have.has(h.rel)) return; n++;
    const m = h.month ? String(h.month).padStart(2, '0') : null; const y = /^\d{4}$/.test(h.year) ? h.year : h.year.slice(0, 4);
    S.records.push({ id: 'hx-' + uid(''), origin: 'histórico', status: 'escaneada', type: 'Historia escaneada', date: `${y}-${m || '01'}-01`,
      year: h.year, period: m ? `${MES[h.month - 1].replace(/^./, c => c.toUpperCase())} ${h.year}` : h.year, procedure: 'Historia escaneada', patient: h.name || 'Sin nombre',
      ci: fmtCi(h.ci), surgeon: '', source: `Archivo ${h.year}${m ? ' · ' + MES[h.month - 1] : ''} · ${h.rel.split('/').pop()}`, file: h.rel, mb: h.mb, files: [] }); });
  const gone = scannedRecords().filter(r => !list.some(h => h.rel === r.file)).length;
  if (n) { log('Historias escaneadas registradas', `${n} nuevas · ${scannedRecords().length} en total`); save(); }
  render(); toast(n ? `${n} historias escaneadas registradas` : 'No hay historias nuevas en la carpeta');
  if (gone) toast(`${gone} historias registradas ya no están en la carpeta (¿se movieron o renombraron?)`);
};
const IA_QUICK = [
  '¿Cuáles son los 10 medicamentos más usados en las últimas 300 cirugías?',
  '¿Cuánto dura en promedio una mamoplastia de aumento?',
  'Compara la duración media de las cirugías por cirujano',
  '¿Cuántas cirugías hicimos por año?',
  '¿Qué cirujano operó más este último año y qué cirugías hizo?',
];

// Markdown mínimo para las respuestas de la IA (tablas, negritas, listas)
function mdLite(t) {
  const lines = esc(t).split('\n'); let html = '', i = 0;
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*\|/.test(l)) { const rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim()));
      const body = rows.filter((r, k) => k !== 1 || !/^[\s|:-]+$/.test(r));
      html += `<div class="tablewrap" style="margin:8px 0"><table><thead><tr>${cells(body[0]).map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body.slice(1).map(r => `<tr>${cells(r).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; continue; }
    if (/^\s*[-*] /.test(l)) { html += '<ul style="margin:6px 0;padding-left:20px">'; while (i < lines.length && /^\s*[-*] /.test(lines[i])) html += `<li>${inline(lines[i++].replace(/^\s*[-*] /, ''))}</li>`; html += '</ul>'; continue; }
    if (/^#{1,4} /.test(l)) { html += `<div style="font-weight:600;margin:10px 0 4px">${inline(l.replace(/^#+ /, ''))}</div>`; i++; continue; }
    html += l.trim() ? `<p style="margin:6px 0">${inline(l)}</p>` : ''; i++;
  }
  return html;
}

// Período de las estadísticas: últimas 300 cirugías, últimos 12 meses o todo el archivo
const STAT_PERIODS = [['300', 'Últimas 300 cirugías'], ['12m', 'Últimos 12 meses'], ['todo', 'Todo el archivo']];
function periodFilter() {
  const p = UI.statP || '300';
  if (p === '300') return { ultimas_n: 300 };
  if (p === '12m') return { desde: iso(new Date(TODAY.getFullYear() - 1, TODAY.getMonth(), TODAY.getDate())) };
  return {};
}
const pct = n => String(n).replace('.', ',') + '%';
function rankBars(rows, label) {
  const max = rows[0]?.cirugias || 1;
  return `<ol class="rank">${rows.map((f, i) => `<li><span class="pos ${i < 3 ? 'top' : ''}">${i + 1}</span><div style="min-width:0;flex:1;display:grid;gap:3px"><div class="t small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.clave)}</div><div class="muted small" style="font-size:12px">${label(f)}</div><div class="bar"><span style="width:${f.cirugias / max * 100}%;animation-delay:${i * 40}ms"></span></div></div></li>`).join('') || '<li class="muted small">Sin datos en este período.</li>'}</ol>`;
}
function medBars() {
  const q = statsQuery({ agrupar_por: 'medicamento', limite: 10, ...periodFilter() });
  return rankBars(q.filas, f => `${f.cirugias} cirugías · ${pct(f.porcentaje)}`) +
    `<div class="small muted" style="margin-top:10px">${q.registros_analizados} cirugías (${q.historicos} de historias en papel, ${q.nativos} del sistema); ${q.con_dato} tienen la medicación registrada. El % es sobre esas ${q.con_dato}.</div>`;
}
function surgeonBars() {
  const q = statsQuery({ agrupar_por: 'cirujano', metrica: 'duracion', limite: 10, ...periodFilter() });
  const total = q.registros_analizados;
  return rankBars(q.filas.filter(f => f.clave), f => `${f.cirugias} cirugías · ${pct(Math.round(f.cirugias / total * 1000) / 10)}${f.duracion_promedio_min ? ` · ${f.duracion_promedio_min} min prom.` : ''}`) +
    `<div class="small muted" style="margin-top:10px">${total} cirugías analizadas. La duración promedio usa solo las que tienen la hora registrada.</div>`;
}
// Cuántos registros de cada tipo se generaron en el software (en el período elegido)
function activityBars() {
  const p = periodFilter(); const nat = allRecords().filter(r => r.origin === 'nativo' && (!p.desde || r.date >= p.desde));
  const rows = REC_TYPES.map(t => ({ clave: t, cirugias: nat.filter(r => r.type === t).length })).filter(r => r.cirugias).sort((a, b) => b.cirugias - a.cirugias);
  return (rows.length ? rankBars(rows, f => `${f.cirugias} registro${f.cirugias === 1 ? '' : 's'}`) : '<div class="empty">Aún no hay registros firmados en el sistema.</div>') +
    `<div class="small muted" style="margin-top:10px">${nat.length} registros creados en el software: cada historia, evolución o informe firmado y cada cirugía marcada como realizada.</div>`;
}
function dxBars() {
  const q = statsQuery({ tipo: 'todos', agrupar_por: 'diagnostico', limite: 8, ...(periodFilter().desde ? { desde: periodFilter().desde } : {}) });
  return (q.filas.length ? rankBars(q.filas, f => `${f.cirugias} registro${f.cirugias === 1 ? '' : 's'} · ${pct(f.porcentaje)}`) : '<div class="empty">Sin diagnósticos registrados todavía.</div>') +
    `<div class="small muted" style="margin-top:10px">${q.con_dato || 0} registros tienen diagnóstico escrito. El % es sobre esos registros.</div>`;
}
function surgeryBars() {
  const q = statsQuery({ agrupar_por: 'procedimiento', metrica: 'duracion', limite: 10, ...periodFilter() });
  const total = q.registros_analizados;
  return rankBars(q.filas, f => `${f.cirugias} · ${pct(Math.round(f.cirugias / total * 1000) / 10)}${f.duracion_promedio_min ? ` · ${f.duracion_promedio_min} min prom.` : ''}`) +
    `<div class="small muted" style="margin-top:10px">${total} cirugías analizadas (${q.historicos} históricas, ${q.nativos} del sistema).</div>`;
}
ACTIONS.statP = el => { UI.statP = el.dataset.k; render(); };

VIEWS.historias = () => {
  const recs = S.records; const val0 = recs.filter(r => r.status === 'validado').length; const pend = recs.filter(r => r.status === 'pendiente');
  const nat = nativeRecords().length; const tab = !can('*') ? 'archivo' : UI.recTab || (pend.length ? 'pendientes' : 'archivo');
  const q = (UI.recQ || '').toLowerCase();
  const ty = UI.recType || 'todos';
  const scan = scannedRecords();
  const list = (tab === 'pendientes' ? pend : allRecords().concat(scan)).filter(r => (tab === 'pendientes' || ty === 'todos' || r.type === ty) && (!q || (r.patient + r.ci + normDigits(r.ci) + r.procedure + r.surgeon + r.type + (r.period || '') + (r.dx || []).join(' ')).toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date));
  const lim = UI.recLim || 30;
  return header('Historias clínicas', 'Historias en papel digitalizadas y todo lo registrado en el sistema (consultas, cirugías, evoluciones e informes), en un solo archivo', (can('*') ? `<button class="btn" data-act="syncScanned">Actualizar historias escaneadas</button><button class="btn" data-act="uploadHistory">Subir historia en papel</button>` : '') + (can('pac.escribir') ? `<button class="btn primary" data-act="newNote">${isClin() ? 'Nueva historia' : 'Informe médico'}</button>` : '')) +
  `<div class="grid g4">${kpi('Historias escaneadas', scan.length, `${new Set(scan.map(r => normDigits(r.ci) || r.patient)).size} pacientes · por leer con IA`)}${kpi('Historias digitalizadas', val0, 'validadas por una persona')}${kpi('Por revisar', pend.length, 'leídas por la IA, sin validar', pend.length ? 'alert' : '')}${kpi('Cirugías en el análisis', surgeriesDesc().length, `${nat} registradas en el sistema`)}</div>
  <div class="sec">
    <div class="card"><h2>Quirón IA <small>pregunta sobre todas las historias</small></h2>
      <div class="hstack" style="margin-bottom:10px">${IA_QUICK.map((t, i) => `<button class="btn sm" data-act="iaQuick" data-i="${i}">${esc(t)}</button>`).join('')}</div>
      <div class="hstack" style="flex-wrap:nowrap"><input class="input" id="ia-q" placeholder="Ej. ¿Qué antibiótico usamos más en cesáreas?" aria-label="Pregunta para Quirón IA"><button class="btn primary" data-act="iaAsk" id="ia-btn">Preguntar</button></div>
      <div id="ia-out" class="stack small" style="margin-top:12px">${UI.iaHTML || '<span class="muted">La IA calcula sobre los registros reales y te dice cuántos analizó. Si un dato no está, lo dice.</span>'}</div></div>
  </div>
  <div class="between sec" style="margin-bottom:12px"><h3 style="font-size:20px;margin:0;letter-spacing:-.01em">Estadísticas</h3>
    <div class="seg" role="group" aria-label="Período">${STAT_PERIODS.map(([k, t]) => `<button data-act="statP" data-k="${k}" aria-pressed="${(UI.statP || '300') === k}">${t}</button>`).join('')}</div></div>
  <div class="grid g3" style="align-items:start">
    <div class="card"><h2>Top cirujanos <small>quién más opera</small></h2>${surgeonBars()}</div>
    <div class="card"><h2>Top cirugías <small>las más realizadas</small></h2>${surgeryBars()}</div>
    <div class="card"><h2>Medicamentos más usados</h2>${medBars()}</div>
  </div>
  <div class="grid g2 sec" style="align-items:start">
    <div class="card"><h2>Actividad registrada en el sistema <small>${(UI.statP || '300') === '12m' ? 'últimos 12 meses' : 'todo el período'}</small></h2>${activityBars()}</div>
    <div class="card"><h2>Diagnósticos más frecuentes <small>consultas, evoluciones e informes</small></h2>${dxBars()}</div>
  </div>
  <div class="between sec" style="margin-bottom:12px"><div class="seg" role="group" aria-label="Lista">${can('*') ? `<button data-act="recTab" data-k="pendientes" aria-pressed="${tab === 'pendientes'}">Por revisar (${pend.length})</button>` : ''}<button data-act="recTab" data-k="archivo" aria-pressed="${tab === 'archivo'}">Todo el archivo</button></div>
    ${tab === 'archivo' ? `<select class="input" style="width:auto" data-ch="recFilter" aria-label="Tipo de registro"><option value="todos">Todos los tipos</option>${REC_TYPES.map(t => `<option ${t === ty ? 'selected' : ''}>${t}</option>`).join('')}</select>` : ''}
    <div class="search" style="min-width:240px">${icon('buscar')}<input class="input" id="recQ" placeholder="Paciente, cédula, procedimiento o cirujano" value="${esc(UI.recQ || '')}" data-in="recSearch" aria-label="Buscar historia"></div></div>
  <div class="list">${list.slice(0, lim).map(r => `<button class="row" data-act="openRecord" data-id="${r.id}"><div class="grow"><div class="t">${esc(r.procedure)} · ${esc(r.patient)}</div><div class="s"><span class="pill" style="margin-right:4px">${esc(r.type)}</span>${r.status === 'escaneada' ? `${esc(r.period)} · Cédula ${esc(r.ci)} · ${r.mb} MB` : `${fdate(r.date)} · ${esc(r.surgeon || (r.type === 'Cirugía' ? 'Cirujano no indicado' : 'Médico no indicado'))} · ${esc(r.source)}`}</div></div>${recPill(r)}</button>`).join('') || '<div class="empty">No hay historias en esta lista.</div>'}
  ${list.length > lim ? `<button class="row" data-act="recMore" style="justify-content:center;color:var(--accent)">Ver ${Math.min(30, list.length - lim)} más de ${list.length}</button>` : ''}</div>`;
};
ACTIONS.recTab = el => { UI.recTab = el.dataset.k; UI.recLim = 30; render(); };
ACTIONS.recFilter = el => { UI.recType = el.value; UI.recLim = 30; render(); };
ACTIONS.recMore = () => { UI.recLim = (UI.recLim || 30) + 30; render(); };
ACTIONS.recSearch = el => { UI.recQ = el.value; const pos = el.selectionStart; render(); const n = document.getElementById('recQ'); n.focus(); n.setSelectionRange(pos, pos); };

// ---------- Ver una historia ----------
const findRecord = id => S.records.find(r => r.id === id) || nativeRecords().find(r => r.id === id);
ACTIONS.openRecord = el => {
  const r = findRecord(el.dataset.id); const linked = S.patients.find(p => p.id === r.pid) || S.patients.find(p => normDigits(p.ci) && normDigits(p.ci) === normDigits(r.ci));
  if (r.status === 'escaneada') {   // historia escaneada: datos del archivo y el PDF original
    const same = scannedRecords().filter(x => x !== r && normDigits(x.ci) && normDigits(x.ci) === normDigits(r.ci));
    openSheet(r.patient, `<div class="between patient-band"><div><b>${esc(r.patient)}</b> · Cédula ${esc(r.ci)}<div class="small muted">Año de la cirugía: <b>${esc(r.year)}</b>${r.period !== r.year ? ` · ${esc(r.period)}` : ''}</div></div>${recPill(r)}</div>
      ${linked ? `<div class="banner">Vinculada al expediente de <button class="btn ghost sm" data-go="pacientes" data-param="${linked.id}">${esc(linked.name)}</button></div>` : ''}
      <div class="list"><div class="row"><div class="grow"><div class="s">Archivo</div><div class="t">${esc(r.file)}</div></div><span class="small muted">${r.mb} MB</span></div></div>
      ${same.length ? `<div><h3 class="small muted" style="margin:0 0 6px">Otras historias de esta cédula</h3><div class="list">${same.map(x => `<button class="row" data-act="openRecord" data-id="${x.id}"><div class="grow"><div class="t">${esc(x.patient)}</div><div class="s">${esc(x.period)} · ${esc(x.file.split('/').pop())}</div></div></button>`).join('')}</div></div>` : ''}
      <div class="banner">El contenido (diagnóstico, cirugía, cirujano, medicación) todavía no está leído: se cargará con la lectura por IA. Mientras tanto, abra el PDF original.</div>`,
      `<button class="btn" data-act="close">Cerrar</button><a class="btn primary" href="${pdfUrl(r)}" target="_blank" rel="noopener">Abrir historia (PDF)</a>`, { wide: true });
    return;
  }
  const f = (k, v) => `<div class="row"><div class="grow"><div class="s">${k}</div><div class="t">${v ?? '<span class="muted">No consta</span>'}</div></div></div>`;
  openSheet(`${r.procedure}`, `<div class="between patient-band"><div><b>${esc(r.patient)}</b> · ${esc(r.ci)}<div class="small muted">${fdate(r.date)} · ${esc(r.source)}</div></div>${recPill(r)}</div>
    ${linked ? `<div class="banner">Vinculada al expediente de <button class="btn ghost sm" data-go="pacientes" data-param="${linked.id}">${esc(linked.name)}</button></div>` : ''}
    <div class="grid g2"><div class="list">${f('Tipo', esc(r.type))}${f('Especialidad', r.specialty ? esc(r.specialty) : null)}${f(r.type === 'Cirugía' ? 'Cirujano' : 'Médico', r.surgeon ? esc(r.surgeon) : null)}${r.type === 'Cirugía' ? f('Anestesiólogo', r.anesth ? esc(r.anesth) : null) : ''}${(r.dx || []).length ? f('Diagnósticos', r.dx.map(esc).join('<br>')) : ''}</div>
    <div class="list">${f('Duración', r.durationMin != null ? r.durationMin + ' min' : null)}${f('Complicaciones', r.complications ? esc(r.complications) : 'Ninguna registrada')}${f('Origen', r.origin === 'nativo' ? 'Registrada en el sistema' : 'Historia en papel digitalizada')}</div></div>
    ${(r.prescribed || []).length ? `<div><h3 class="small muted" style="margin:0 0 6px">Medicación indicada (récipe)</h3><div class="small">${r.prescribed.map(m => esc(m.raw || m.name)).join(' · ')}</div></div>` : ''}
    <div><h3 class="small muted" style="margin:0 0 6px">${r.origin === 'nativo' ? 'Medicación entregada por almacén (sin devoluciones)' : 'Medicamentos'}</h3>${Array.isArray(r.meds) ? `<div class="tablewrap"><table><thead><tr><th>Escrito en la historia</th><th>Normalizado</th><th>Vía</th></tr></thead><tbody>${r.meds.map(m => `<tr><td>${esc(m.raw)}</td><td>${esc(m.name)}</td><td>${esc(m.route || '—')}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sin medicamentos.</td></tr>'}</tbody></table></div>` : '<div class="muted small">La historia no registra medicación (no cuenta en ese análisis).</div>'}</div>
    ${r.files?.length ? `<div class="hstack">${r.files.map(id => `<img src="/_blob/${id}" alt="Página escaneada" style="height:120px;border-radius:8px;border:1px solid var(--line)">`).join('')}</div>` : ''}`,
    r.noteId ? `<button class="btn primary" data-act="openNote" data-id="${r.noteId}">Ver documento original</button>` : r.origin !== 'nativo' && can('*') ? `<button class="btn ${r.status === 'pendiente' ? 'primary' : ''}" data-act="editRecord" data-id="${r.id}">${r.status === 'pendiente' ? 'Revisar y validar' : 'Corregir'}</button>` : '', { wide: true });
};

// ---------- Formulario de revisión (lo usa la carga con IA y la corrección) ----------
function recordForm(r) {
  const low = new Set(r.low || []); const L = k => low.has(k) ? 'low' : '';
  const hint = k => low.has(k) ? ' <span class="pill warn">revisar</span>' : '';
  const inp = (k, label, v, type = 'text', full) => `<div class="field ${full ? 'full' : ''}"><label for="rf-${k}">${label}${hint(k)}</label><input class="input ${L(k)}" type="${type}" id="rf-${k}" value="${esc(v ?? '')}"></div>`;
  const match = S.patients.find(p => r.ci && normDigits(p.ci) === normDigits(r.ci));
  return `${match ? `<div class="banner">La cédula coincide con <b>&nbsp;${esc(match.name)}&nbsp;</b>: se vinculará a su expediente.</div>` : ''}
  <div class="form">${inp('patient', 'Paciente', r.patient, 'text', true)}${inp('ci', 'Cédula', r.ci)}${inp('date', 'Fecha', r.date, 'date')}
    <div class="field"><label for="rf-type">Tipo</label><select class="input" id="rf-type">${['Cirugía', 'Consulta', 'Hospitalización'].map(t => `<option ${r.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    ${inp('procedure', 'Procedimiento', r.procedure)}${inp('specialty', 'Especialidad', r.specialty)}${inp('surgeon', 'Cirujano', r.surgeon)}${inp('anesth', 'Anestesiólogo', r.anesth)}${inp('durationMin', 'Duración (min)', r.durationMin, 'number')}${inp('complications', 'Complicaciones', r.complications, 'text', true)}</div>
  <div><div class="between" style="margin-bottom:6px"><b class="small">Medicamentos · texto original → normalizado</b><button class="btn sm" data-act="rfAddMed">Agregar</button></div>
    <div class="stack" id="rf-meds">${(r.meds || []).map((m, i) => medRow(m, i)).join('')}</div></div>`;
}
const medRow = (m, i) => `<div class="chip-x"><input class="input ${m.low ? 'low' : ''}" style="flex:1.2" id="rm-raw${i}" value="${esc(m.raw)}" aria-label="Texto original"><span class="muted">→</span><input class="input" style="flex:1.2" id="rm-name${i}" value="${esc(m.name)}" aria-label="Normalizado"><input class="input" style="flex:.5" id="rm-route${i}" value="${esc(m.route || '')}" placeholder="Vía" aria-label="Vía"><button class="btn ghost" data-act="rfDelMed" data-i="${i}" aria-label="Quitar">✕</button></div>`;
function readForm() {
  const meds = [...document.querySelectorAll('#rf-meds .chip-x')].map((_, i) => ({ raw: val('rm-raw' + i).trim(), name: val('rm-name' + i).trim() || val('rm-raw' + i).trim(), route: val('rm-route' + i).trim() })).filter(m => m.raw || m.name);
  const d = val('rf-durationMin');
  return { patient: val('rf-patient').trim(), ci: val('rf-ci').trim(), date: val('rf-date'), type: val('rf-type'), procedure: val('rf-procedure').trim(), specialty: val('rf-specialty').trim(), surgeon: val('rf-surgeon').trim(), anesth: val('rf-anesth').trim(), durationMin: d === '' ? null : Math.round(+d), complications: val('rf-complications').trim(), meds };
}
ACTIONS.rfAddMed = () => { const box = document.getElementById('rf-meds'); box.insertAdjacentHTML('beforeend', medRow({ raw: '', name: '', route: 'IV' }, box.children.length)); };
ACTIONS.rfDelMed = el => { const meds = readForm().meds; meds.splice(+el.dataset.i, 1); document.getElementById('rf-meds').innerHTML = meds.map((m, i) => medRow(m, i)).join(''); };

ACTIONS.editRecord = el => {
  const r = findRecord(el.dataset.id); UI.recEdit = { id: r.id, files: r.files || [] };
  openSheet('Revisar historia', recordForm(r), `<span class="note" id="rf-msg">Los campos en amarillo la IA no los leyó con seguridad.</span><button class="btn" data-act="saveRecord" data-st="pendiente">Guardar sin validar</button><button class="btn primary" data-act="saveRecord" data-st="validado">Validar e importar</button>`, { wide: true });
};
ACTIONS.saveRecord = async el => {
  const f = readForm(); const msg = document.getElementById('rf-msg');
  if (el.dataset.st === 'validado' && (!f.patient || !f.date || !f.procedure)) { msg.textContent = 'Para validar hacen falta al menos paciente, fecha y procedimiento.'; return; }
  let files = UI.recEdit.files || [];
  let failed = 0;
  if (UI.recEdit.pending?.length) {
    const assets = await getCap('assets');
    if (assets) { msg.textContent = 'Guardando las imágenes originales…'; for (const file of UI.recEdit.pending) { try { files.push((await assets.upload(file)).id); } catch (e) { failed++; } } }
    else failed = UI.recEdit.pending.length;
  }
  // Una historia solo se valida con su original en papel guardado; si no, queda "por revisar"
  let st = el.dataset.st; let warn = '';
  if (st === 'validado' && (failed || !files.length)) { st = 'pendiente'; warn = failed ? 'La imagen original no se pudo guardar: la historia quedó en "Por revisar" hasta adjuntarla.' : 'Falta la imagen original: la historia quedó en "Por revisar" hasta adjuntarla.'; }
  const prev = UI.recEdit.id && S.records.find(r => r.id === UI.recEdit.id);
  const rec = { ...(prev || { id: uid('h'), origin: 'histórico', source: `Carga del ${fdate(dAt(0))}` }), ...f, files, status: st, low: st === 'validado' ? [] : (prev?.low || UI.recEdit.low || []), validatedBy: st === 'validado' ? S.user : null };
  if (prev) Object.assign(prev, rec); else S.records.push(rec);
  log(st === 'validado' ? 'Historia validada' : 'Historia guardada para revisar', `${rec.patient} · ${rec.procedure}`); save(); closeSheet(); UI.iaHTML = ''; render();
  toast(warn || (st === 'validado' ? 'Historia validada e incluida en las estadísticas' : 'Guardada en "Por revisar"'));
};

// ---------- Subir historia en papel ----------
ACTIONS.uploadHistory = async () => {
  const sample = await getCap('sample'); const lim = sample ? await sample.limits().catch(() => null) : null; const max = lim?.images?.maxCount || 0;
  UI.recEdit = { id: null, files: [], pending: [] };
  openSheet('Subir historia en papel', `<p class="small muted" style="margin:0">Toma una foto por página de una misma historia${max ? ` (hasta ${max})` : ''}. La IA lee los datos y tú los revisas antes de guardarlos. Las fotos originales se conservan.</p>
    ${max ? `<label class="btn" style="justify-self:start" for="hist-files">Elegir fotos o tomar foto</label><input id="hist-files" type="file" accept="${lim.images.mediaTypes.join(',')}" multiple hidden data-ch="histFiles">` : '<div class="banner warn">La lectura con IA no está disponible en esta vista. Puedes cargar la historia a mano.</div>'}
    <div class="hstack" id="hist-thumbs"></div><div id="hist-msg" class="small muted"></div>`,
    `${max ? '<button class="btn" data-act="manualHistory">Cargar a mano</button><button class="btn primary" data-act="readHistory" id="hist-read" disabled>Leer con IA</button>' : '<button class="btn primary" data-act="manualHistory">Cargar a mano</button>'}`);
  UI.histMax = max;
};
ACTIONS.histFiles = el => {
  const files = [...el.files].slice(0, UI.histMax); UI.recEdit.pending = files;
  document.getElementById('hist-thumbs').innerHTML = files.map(f => `<img src="${URL.createObjectURL(f)}" alt="${esc(f.name)}" style="height:96px;border-radius:8px;border:1px solid var(--line)">`).join('');
  document.getElementById('hist-read').disabled = !files.length;
  document.getElementById('hist-msg').textContent = el.files.length > UI.histMax ? `Solo se usarán las primeras ${UI.histMax} fotos.` : '';
};
ACTIONS.manualHistory = () => { const pend = UI.recEdit.pending; UI.recEdit = { id: null, files: [], pending: pend };
  refreshSheet(recordForm({ type: 'Cirugía', meds: [] }), `<span class="note" id="rf-msg"></span><button class="btn" data-act="saveRecord" data-st="pendiente">Guardar sin validar</button><button class="btn primary" data-act="saveRecord" data-st="validado">Validar e importar</button>`); };
const EXTRACT_PROMPT = `Las imágenes son páginas escaneadas o fotografiadas de UNA historia clínica en papel de la Clínica Quirón (Caracas, Venezuela), en orden.
Extrae solo lo que esté escrito. Si un dato no aparece o no se lee con claridad, usa null. No inventes ni deduzcas datos clínicos.
Responde solo con un objeto JSON con esta forma:
{"paciente": string|null, "cedula": string|null, "fecha": "AAAA-MM-DD"|null, "tipo": "Cirugía"|"Consulta"|"Hospitalización"|null, "procedimiento": string|null, "especialidad": string|null, "cirujano": string|null, "anestesiologo": string|null, "duracion_min": number|null, "complicaciones": string|null,
 "medicamentos": [{"texto_original": string, "nombre_normalizado": string, "via": string|null, "confianza": 0-100}],
 "confianza": {"paciente": 0-100, "cedula": 0-100, "fecha": 0-100, "procedimiento": 0-100, "cirujano": 0-100, "anestesiologo": 0-100, "duracion_min": 0-100}}
"nombre_normalizado" = principio activo y concentración en español (por ejemplo "Novalgina 1 g" → "Metamizol 1 g"; "Zofran 4mg" → "Ondansetrón 4 mg"). Si la unidad no se lee, no la supongas.`;
ACTIONS.readHistory = async el => {
  const sample = await getCap('sample'); const msg = document.getElementById('hist-msg'); el.disabled = true; msg.textContent = 'Leyendo la historia… puede tardar hasta un minuto.';
  try {
    const j = await sample.json(EXTRACT_PROMPT, { images: UI.recEdit.pending });
    const c = j.confianza || {}; const low = Object.entries({ patient: 'paciente', ci: 'cedula', date: 'fecha', procedure: 'procedimiento', surgeon: 'cirujano', anesth: 'anestesiologo', durationMin: 'duracion_min' }).filter(([, k]) => j[k] != null && (c[k] ?? 0) < 80 || j[k] == null).map(([f]) => f);
    const r = { patient: j.paciente, ci: j.cedula, date: j.fecha, type: j.tipo || 'Cirugía', procedure: j.procedimiento, specialty: j.especialidad, surgeon: j.cirujano, anesth: j.anestesiologo, durationMin: j.duracion_min, complications: j.complicaciones,
      meds: (j.medicamentos || []).map(m => ({ raw: m.texto_original || '', name: m.nombre_normalizado || m.texto_original || '', route: m.via || '', low: (m.confianza ?? 100) < 80 })), low };
    UI.recEdit.low = low;
    refreshSheet(recordForm(r), `<span class="note" id="rf-msg">Los campos en amarillo la IA no los leyó con seguridad; compáralos con la foto.</span><button class="btn" data-act="saveRecord" data-st="pendiente">Guardar sin validar</button><button class="btn primary" data-act="saveRecord" data-st="validado">Validar e importar</button>`);
  } catch (e) {
    el.disabled = false;
    msg.textContent = { not_granted: 'No se dio permiso para usar la IA. Puedes cargarla a mano.', rate_limited: 'Demasiadas consultas seguidas; espera un momento e inténtalo de nuevo.', image_rejected: 'Alguna foto no se pudo leer; prueba con otra más nítida.', invalid_json: 'La IA no devolvió datos legibles. Inténtalo de nuevo o cárgala a mano.' }[e?.code] || 'No se pudo leer la historia. Inténtalo de nuevo o cárgala a mano.';
  }
};

// ---------- Quirón IA: preguntas estadísticas ----------
function iaDataPack() {
  const meds = statsQuery({ agrupar_por: 'medicamento', ultimas_n: 300, limite: 12 });
  const proc = statsQuery({ agrupar_por: 'procedimiento', metrica: 'duracion' });
  const year = statsQuery({ agrupar_por: 'año' });
  return JSON.stringify({ medicamentos_ultimas_300: meds, duracion_por_procedimiento: proc.filas, cirugias_por_año: year.filas, total_cirugias: proc.registros_analizados });
}
const IA_RULES = `Eres Quirón IA, el asistente de estadística de la Clínica Quirón. Respondes preguntas de la dirección sobre las historias clínicas: las digitalizadas del archivo en papel (origen "histórico") y las registradas en el sistema (origen "nativo").
Reglas:
- Usa SOLO datos de la herramienta "estadisticas" o del resumen que te doy. Nunca calcules a ojo ni inventes cifras.
- Di siempre cuántos registros analizaste y cuántos tenían el dato (por ejemplo "287 de 300 cirugías tienen la medicación registrada").
- Si los datos no alcanzan para responder, di "Dato insuficiente" y qué faltaría.
- Los medicamentos se cuentan por principio activo; el porcentaje es sobre las cirugías que tienen la medicación registrada.
- Distingue siempre lo indicado (récipe) de lo entregado por el almacén; ninguno de los dos prueba que se haya administrado.
- Responde en español, breve, con una tabla Markdown cuando compares varias cosas.`;
const iaTools = () => [{
  name: 'estadisticas', description: 'Calcula estadísticas sobre el archivo de historias (históricas y del sistema): cirugías por defecto, o consultas, hospitalización, informes médicos y notas con "tipo". Devuelve registros_analizados, con_dato y filas agrupadas. Úsala para cualquier cifra.',
  inputSchema: { type: 'object', properties: {
    tipo: { type: 'string', enum: ['Cirugía', 'Consulta', 'Hospitalización', 'Informe médico', 'Nota médica', 'todos'], description: 'tipo de registro a analizar; por defecto Cirugía' },
    agrupar_por: { type: 'string', enum: ['medicamento', 'medicamento_indicado', 'diagnostico', 'procedimiento', 'cirujano', 'especialidad', 'año', 'origen', 'tipo', 'total'], description: 'medicamento = usado/entregado (papel: lo escrito; sistema: lo entregado por almacén sin devoluciones); medicamento_indicado = lo prescrito en récipes; cirujano = médico que firmó en registros que no son cirugías' },
    metrica: { type: 'string', enum: ['conteo', 'duracion'], description: 'duracion añade promedio y mediana en minutos' },
    ultimas_n: { type: 'number', description: 'solo las N cirugías más recientes' },
    procedimiento: { type: 'string' }, especialidad: { type: 'string' }, cirujano: { type: 'string' }, medicamento: { type: 'string', description: 'solo cirugías que usaron este medicamento' },
    origen: { type: 'string', enum: ['histórico', 'nativo'] }, desde: { type: 'string', description: 'AAAA-MM-DD' }, hasta: { type: 'string', description: 'AAAA-MM-DD' }, limite: { type: 'number' } } },
  execute: input => statsQuery(input),
}];
let iaCtl = null;
ACTIONS.iaQuick = el => { document.getElementById('ia-q').value = IA_QUICK[+el.dataset.i]; ACTIONS.iaAsk(); };
ACTIONS.iaAsk = async () => {
  const qEl = document.getElementById('ia-q'); const q = qEl.value.trim(); const out = document.getElementById('ia-out'); const btn = document.getElementById('ia-btn');
  if (iaCtl) { iaCtl.abort(); return; }
  if (!q) { qEl.focus(); return; }
  const sample = await getCap('sample');
  if (!sample) { out.innerHTML = '<span class="muted">La IA no está disponible en esta vista. El gráfico de la derecha sí se calcula con todos los registros.</span>'; return; }
  const lim = await sample.limits().catch(() => null);
  const prompt = [{ role: 'user', content: IA_RULES + (lim?.tools ? '' : '\n\nResumen de datos (no hay herramienta disponible):\n' + iaDataPack()) + `\n\nHoy es ${dAt(0)}.\n\nPregunta: ${q}` }];
  iaCtl = new AbortController(); btn.textContent = 'Detener';
  out.innerHTML = `<div class="t">${esc(q)}</div><div class="muted" id="ia-ans">Analizando los registros…</div>`;
  try {
    const opts = { signal: iaCtl.signal, onText: ({ text }) => { document.getElementById('ia-ans').innerHTML = mdLite(text); } };
    if (lim?.tools) opts.tools = iaTools(); else opts.cache = false;
    const { text } = await sample(prompt, opts);
    UI.iaHTML = `<div class="t">${esc(q)}</div><div>${mdLite(text)}</div>`; out.innerHTML = UI.iaHTML;
  } catch (e) {
    const keep = e?.text ? mdLite(e.text) : '';
    out.innerHTML = `<div class="t">${esc(q)}</div>${keep}<div class="muted">${e?.code === 'cancelled' ? 'Detenido.' : e?.code === 'not_granted' ? 'No se dio permiso para usar la IA.' : e?.code === 'rate_limited' ? 'Demasiadas consultas; inténtalo en un momento.' : 'No se pudo completar la respuesta. Inténtalo de nuevo.'}</div>`;
  } finally { iaCtl = null; const b = document.getElementById('ia-btn'); if (b) b.textContent = 'Preguntar'; }
};
