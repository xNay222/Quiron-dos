// Agenda general con dos subagendas (quirúrgica y de consultas) y la guardia de cada día.

const HOURS = Array.from({ length: 12 }, (_, i) => String(7 + i).padStart(2, '0') + ':00');
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const toTime = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const apptEnd = a => toMin(a.time) + (a.kind === 'cirugia' ? Math.round((a.hours || 1) * 60) : 30);
const isActive = a => !['cancelada', 'no_asistio'].includes(a.status);
const apptCls = a => a.status === 'atendida' ? 'done' : a.status === 'en_espera' ? 'wait' : ['cancelada', 'no_asistio'].includes(a.status) ? 'cancel' : '';
const kindPill = a => a.kind === 'cirugia' ? '<span class="pill bad">Cirugía</span>' : '<span class="pill info">Consulta</span>';
const isAnest = m => m.anest || m.esp === 'Anestesiología';
const consultDocs = () => activeDocs().filter(m => !isAnest(m) && !m.resident);
const anesthDocs = () => activeDocs().filter(isAnest);
// Lista de médicos agrupada (para elegir quién solicita, la guardia, etc.). firstRes: residentes primero.
const docOptGroups = (sel, firstRes = false) => { const g = [['Médicos residentes', activeDocs().filter(m => m.resident)], ['Médicos', activeDocs().filter(m => !m.resident && !isAnest(m))], ['Anestesiólogos', anesthDocs()]];
  if (!firstRes) g.push(g.shift());
  return g.filter(([, l]) => l.length).map(([t, l]) => `<optgroup label="${t}">${l.map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)} · ${esc(m.esp)}</option>`).join('')}</optgroup>`).join(''); };
// Guardia del día: el médico la asigna Administración (o almacén); la enfermera sale de su día fijo si no se asignó otra
const dutyOf = day => { const d = S.duty?.[day] || {}; return { doc: d.doc || '', nurse: d.nurse || S.nurseWeek?.[new Date(day + 'T00:00').getDay()] || '' }; };
const hrs = h => `${String(h).replace('.', ',')} h`;

// ---------- Horario de consulta de cada médico ----------
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const availRaw = (doc, date) => S.hours?.[doc]?.[new Date(date + 'T00:00').getDay()] || null;
// Médico sin ningún horario cargado: se le puede agendar de 07:00 a 19:00 hasta que Administración cargue su horario
const hasHours = doc => !!S.hours?.[doc] && Object.keys(S.hours[doc]).length > 0;
const availOf = (doc, date) => hasHours(doc) ? availRaw(doc, date) : { from: '07:00', to: '19:00' };
const inAvail = (doc, date, s, e) => { const a = availOf(doc, date); return !!a && s >= toMin(a.from) && e <= toMin(a.to); };
// "Lun a Vie 08:00–12:00 · Sáb 09:00–13:00" agrupando días seguidos con el mismo horario
function hoursText(doc) {
  const h = S.hours?.[doc] || {}; const order = [1, 2, 3, 4, 5, 6, 0]; const parts = []; let run = [];
  const flush = () => { if (!run.length) return; const r = h[run[0]]; parts.push(`${run.length > 2 ? DAY_SHORT[run[0]] + ' a ' + DAY_SHORT[run.at(-1)] : run.map(d => DAY_SHORT[d]).join(' y ')} ${r.from}–${r.to}`); run = []; };
  order.forEach(d => { if (h[d] && run.length && h[run[0]].from === h[d].from && h[run[0]].to === h[d].to) run.push(d); else { flush(); if (h[d]) run.push(d); } }); flush();
  return parts.join(' · ') || 'Horario por cargar (se agenda de 07:00 a 19:00)';
}
ACTIONS.editHours = () => {
  const admin = role() === 'admin';
  openSheet('Horarios de consulta de los médicos', `<p class="small muted" style="margin:0">${admin ? 'Marca los días en que cada médico atiende en la clínica y su horario. Solo se podrán agendar consultas dentro de ese horario.' : 'Días y horas en que cada médico atiende en la clínica. Solo el administrador puede cambiarlos.'}</p>
    ${consultDocs().map(d => `<div class="card"><h2>${esc(d.name)} <small>${esc(hoursText(d.id))}</small></h2><div class="stack">${[1, 2, 3, 4, 5, 6, 0].map(k => { const a = S.hours?.[d.id]?.[k];
      return `<div class="hrsrow"><label class="hstack small"><input type="checkbox" id="hr-${d.id}-${k}" ${a ? 'checked' : ''} ${admin ? '' : 'disabled'}> ${DAY_NAMES[k]}</label><input class="input" type="time" step="900" id="hf-${d.id}-${k}" value="${a?.from || '08:00'}" ${admin ? '' : 'disabled'} aria-label="Desde"><span class="muted">a</span><input class="input" type="time" step="900" id="ht-${d.id}-${k}" value="${a?.to || '12:00'}" ${admin ? '' : 'disabled'} aria-label="Hasta"></div>`; }).join('')}</div></div>`).join('')}`,
    admin ? `<span class="note" id="hr-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveHours">Guardar horarios</button>` : '', { wide: true });
};
ACTIONS.saveHours = () => {
  const next = {};
  for (const d of consultDocs()) { next[d.id] = {}; for (const k of [0, 1, 2, 3, 4, 5, 6]) { if (!document.getElementById(`hr-${d.id}-${k}`).checked) continue;
    const from = val(`hf-${d.id}-${k}`), to = val(`ht-${d.id}-${k}`); if (!from || !to || toMin(to) <= toMin(from)) { document.getElementById('hr-msg').textContent = `Revisa el horario de ${d.name} el ${DAY_NAMES[k].toLowerCase()}: la hora final debe ser después de la inicial.`; return; }
    next[d.id][k] = { from, to }; } }
  S.hours = { ...S.hours, ...next }; log('Horarios de médicos actualizados', consultDocs().map(d => `${d.name}: ${hoursText(d.id)}`).join(' | ')); save(); closeSheet(); render(); toast('Horarios guardados');
};

// ---------- Guardia del día (la "pestañita") ----------
function dutyStrip(day) {
  const d = dutyOf(day); const doc = med(d.doc);
  return `<div class="duty"><div class="duty-tab">Guardia</div><div class="duty-body">
    <div class="duty-item"><span class="avatar">${doc ? initials(doc.name.replace(/^Dra?\. /, '')) : '?'}</span><div><div class="s">Médico de guardia</div><div class="t">${doc ? esc(doc.name) : '<span class="muted">Sin asignar</span>'}</div>${doc ? `<div class="s">${esc(doc.esp)}</div>` : ''}</div></div>
    <div class="duty-item"><span class="avatar" style="background:var(--good-soft);color:var(--good)">${d.nurse ? initials(d.nurse.replace(/^(Lic|TSU)\.? /, '')) : '?'}</span><div><div class="s">Enfermera de guardia</div><div class="t">${d.nurse ? esc(d.nurse) : '<span class="muted">Sin asignar</span>'}</div></div></div>
    <div class="hstack" style="margin-left:auto">${can('guardia.editar') ? `<button class="btn sm" data-act="editDuty" data-d="${day}">Cambiar</button>` : ''}<button class="btn sm ghost" data-act="dutyLog">Historial de guardias</button></div>
  </div></div>`;
}
ACTIONS.editDuty = el => {
  if (!can('guardia.editar')) return; const day = el.dataset.d || UI.agendaDay || dAt(0); const d = dutyOf(day);
  openSheet('Guardia del día', `<div class="form">
    <div class="field full"><label for="dt-date">Fecha</label><input class="input" type="date" id="dt-date" value="${day}"></div>
    <div class="field"><label for="dt-doc">Médico de guardia</label><select class="input" id="dt-doc"><option value="">Sin asignar</option>${docOptGroups(d.doc, true)}</select></div>
    <div class="field"><label for="dt-nurse">Enfermera de guardia</label><select class="input" id="dt-nurse"><option value="">Sin asignar</option>${[...new Set([...(S.nurses || []), d.nurse].filter(Boolean))].map(n => `<option ${n === d.nurse ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div></div>
    <div class="small muted">Queda registrado para consultar después quién estaba de guardia ese día.</div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveDuty">Guardar guardia</button>`);
};
ACTIONS.saveDuty = () => {
  if (!can('guardia.editar')) return; const day = val('dt-date'); const nurse = val('dt-nurse').trim(); const doc = val('dt-doc');
  if (!day) { toast('Elige la fecha'); return; }
  S.duty = S.duty || {}; S.duty[day] = { doc, nurse };
  log('Guardia asignada', `${day} · ${med(doc)?.name || 'sin médico'} · ${nurse || 'sin enfermera'}`); save(); closeSheet(); render(); toast('Guardia guardada');
};
ACTIONS.dutyLog = () => {
  const days = []; for (let d = 7; d >= -30; d--) days.push(dAt(d));
  openSheet('Historial de guardias', `<div class="small muted">Del ${fdate(dAt(-30))} al ${fdate(dAt(7))}.${can('guardia.editar') ? ' Toque un día para cambiarlo.' : ''}</div>
    <div class="list">${days.map(day => { const g = dutyOf(day); return `<button class="row" ${can('guardia.editar') ? `data-act="editDuty" data-d="${day}"` : ''}><div class="grow"><div class="t">${fday(day).replace(/^./, c => c.toUpperCase())}${day === dAt(0) ? ' <span class="pill info">Hoy</span>' : ''}</div><div class="s">${g.doc ? esc(med(g.doc)?.name) : 'Médico sin asignar'} · ${g.nurse ? esc(g.nurse) : 'enfermera sin asignar'}</div></div></button>`; }).join('')}</div>`);
};

// ---------- Vistas ----------
function apptCard(a, opts = {}) {
  const p = pat(a.pid); const end = toTime(apptEnd(a));
  const title = a.kind === 'cirugia' ? `${a.time}–${end} · ${esc(p.name)}` : `${a.time} · ${esc(p.name)}`;
  const sub = a.kind === 'cirugia' ? `${esc(a.proc)} · Médico tratante: ${esc(med(a.doc).name)}` : `${esc(svc(a.svc).name)}${opts.noDoc ? '' : ' · ' + esc(med(a.doc).name)}`;
  return `<button class="appt ${apptCls(a)} ${a.kind === 'cirugia' ? 'surg' : ''}" data-act="openAppt" data-id="${a.id}"><span style="min-width:0"><span class="t" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${title}</span><span class="small muted" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sub}</span></span><span class="hstack" style="flex:none">${opts.kind ? kindPill(a) : ''}${statusPill(a.status)}</span></button>`;
}

function generalView(list) {
  return `<div class="list" style="padding:4px 0">${HOURS.map(h => {
    const here = list.filter(a => a.time.slice(0, 2) === h.slice(0, 2)).sort((a, b) => a.time.localeCompare(b.time));
    return `<div class="slot"><div class="hr">${h}</div><div class="cell">${here.map(a => apptCard(a, { kind: true })).join('')}<button class="addslot" data-act="newAppt" data-time="${h}">+ Agendar a las ${h}</button></div></div>`;
  }).join('')}</div>`;
}

function surgeryView(list, day) {
  const surg = list.filter(a => a.kind === 'cirugia').sort((a, b) => a.time.localeCompare(b.time)); const act = surg.filter(isActive);
  const booked = act.reduce((s, a) => s + (a.hours || 1), 0); const from = 7 * 60, to = 19 * 60, span = to - from;
  const pos = m => Math.max(0, Math.min(100, (m - from) / span * 100));
  return `<div class="grid g4" style="margin-bottom:14px">${kpi('Cirugías del día', act.length)}${kpi('Quirófano reservado', hrs(booked), `de 12 h (07:00 a 19:00)`)}${kpi('Quirófano libre', hrs(Math.max(0, 12 - booked)))}${kpi('Realizadas', act.filter(a => a.done).length, `de ${act.length}`)}</div>
  <div class="card" style="margin-bottom:14px"><h2>Quirófano <small>${fday(day)}</small></h2>
    <div class="ortrack">${[7, 9, 11, 13, 15, 17, 19].map(h => `<span class="tick" style="left:${pos(h * 60)}%">${String(h).padStart(2, '0')}:00</span>`).join('')}
      ${act.map(a => `<button class="orblock ${apptCls(a)}" style="left:${pos(toMin(a.time))}%;width:${pos(apptEnd(a)) - pos(toMin(a.time))}%" data-act="openAppt" data-id="${a.id}" title="${esc(pat(a.pid).name)} · ${esc(a.proc)}"><b>${a.time}</b> ${esc(pat(a.pid).name.split(' ')[0])}</button>`).join('')}</div></div>
  <div class="stack">${surg.map(a => { const p = pat(a.pid);
    return `<button class="card surgcard" data-act="openAppt" data-id="${a.id}" style="text-align:left;border:0;cursor:pointer;width:100%">
      <div class="surgtime"><b>${a.time}</b><span>${toTime(apptEnd(a))}</span><span class="muted small">${hrs(a.hours || 1)}</span></div>
      <div style="min-width:0;flex:1;display:grid;gap:2px"><div style="font-size:17px;font-weight:600;letter-spacing:-.01em">${esc(p.name)}</div><div>${esc(a.proc)}</div>
        <div class="small muted">Médico tratante: <b style="color:var(--fg)">${esc(med(a.doc).name)}</b>${a.anest ? ` · Anestesiólogo: ${esc(med(a.anest)?.name || '')}` : ' · Anestesiólogo por asignar'}</div>
        ${p.allergies.length ? `<div class="small allergy-txt">⚠ Alergias: ${esc(p.allergies.join(', '))}</div>` : ''}</div>
      <div style="flex:none">${statusPill(a.status)}</div></button>`; }).join('') || `<div class="card empty">No hay cirugías programadas para este día. <button class="btn ghost sm" data-act="newAppt" data-kind="cirugia">Programar cirugía</button></div>`}</div>`;
}

function agendaConsultView(list, day) {
  const cons = list.filter(a => a.kind !== 'cirugia'); const surg = list.filter(a => a.kind === 'cirugia' && isActive(a));
  // Por defecto, solo los médicos que atienden ese día (o que tienen citas); "Ver todos" muestra el resto
  const all = agendaOwn() ? consultDocs().filter(d => d.id === myDoc()) : consultDocs(); const docs = UI.agAll ? all : all.filter(d => availRaw(d.id, day) || cons.some(a => a.doc === d.id));
  const away = all.filter(d => !docs.includes(d));
  const top = `<div class="between" style="margin-bottom:10px"><span class="small muted">${docs.length} médico(s) atienden este día${away.length && !UI.agAll ? ` · no vienen: ${away.map(d => esc(d.name)).join(', ')}` : ''}</span>
    <div class="hstack"><button class="btn sm" data-act="agAll">${UI.agAll ? 'Solo los que atienden' : 'Ver todos los médicos'}</button><button class="btn sm" data-act="editHours">Horarios de médicos</button></div></div>`;
  if (!docs.length) return top + '<div class="card empty">Ningún médico tiene consulta este día.</div>';
  return top + `<div class="tablewrap"><div class="docgrid" style="grid-template-columns:64px repeat(${docs.length},minmax(170px,1fr))">
    <div class="dg-head"></div>${docs.map(d => { const a = availOf(d.id, day); return `<div class="dg-head"><div class="t">${esc(d.name)}</div><div class="small muted">${esc(d.esp)}</div><div class="small" style="color:${a ? 'var(--good)' : 'var(--fg3)'}">${a ? `Atiende ${a.from}–${a.to}` : 'No atiende este día'} · ${cons.filter(x => x.doc === d.id && isActive(x)).length} citas</div></div>`; }).join('')}
    ${HOURS.map(h => `<div class="hr">${h}</div>${docs.map(d => {
      const here = cons.filter(a => a.doc === d.id && a.time.slice(0, 2) === h.slice(0, 2)).sort((a, b) => a.time.localeCompare(b.time));
      const inOR = surg.find(a => a.doc === d.id && toMin(a.time) < toMin(h) + 60 && apptEnd(a) > toMin(h));
      const av = availOf(d.id, day); const open = av && toMin(h) < toMin(av.to) && toMin(h) + 60 > toMin(av.from);
      const slot = open && !inOR ? (toMin(h) < toMin(av.from) ? av.from : h) : null;
      return `<div class="dg-cell ${open ? '' : 'off'}">${inOR ? `<div class="busy">En quirófano · ${esc(pat(inOR.pid).name.split(' ')[0])}</div>` : ''}${here.map(a => apptCard(a, { noDoc: true })).join('')}${slot ? `<button class="addslot" data-act="newAppt" data-kind="consulta" data-doc="${d.id}" data-time="${slot}">+ ${slot}</button>` : ''}</div>`;
    }).join('')}`).join('')}
  </div></div>
  <p class="small muted">Las horas sombreadas están fuera del horario del médico y no se pueden agendar. Un médico sin horario cargado se puede agendar de 07:00 a 19:00.</p>`;
}
ACTIONS.agAll = () => { UI.agAll = !UI.agAll; render(); };

VIEWS.agenda = () => {
  const day = UI.agendaDay || dAt(0); const tab = UI.agTab || 'general';
  const nRef = typeof refsToHandle === 'function' ? refsToHandle().length : 0;
  const tabs = (nS, nC) => `<div class="seg" role="group" aria-label="Agenda"><button data-act="agTab" data-k="general" aria-pressed="${tab === 'general'}">Agenda general</button><button data-act="agTab" data-k="quirurgica" aria-pressed="${tab === 'quirurgica'}">Agenda quirúrgica${nS === null ? '' : ` (${nS})`}</button><button data-act="agTab" data-k="consultas" aria-pressed="${tab === 'consultas'}">Agenda de consultas${nC === null ? '' : ` (${nC})`}</button><button data-act="agTab" data-k="directorio" aria-pressed="${tab === 'directorio'}">Directorio de médicos${nRef ? ` (${nRef} por agendar)` : ''}</button></div>`;
  // Directorio: no depende del día, así que no lleva la navegación por fechas
  if (tab === 'directorio') return header('Agenda', 'Directorio de médicos: a quién derivar y cuándo atiende cada uno') + `<div style="margin-bottom:14px">${tabs(null, null)}</div>` + directoryView();
  const list = S.appts.filter(a => a.date === day && (!agendaOwn() || a.doc === myDoc() || a.anest === myDoc()));
  const nS = list.filter(a => a.kind === 'cirugia' && isActive(a)).length, nC = list.filter(a => a.kind !== 'cirugia' && isActive(a)).length;
  const body = tab === 'quirurgica' ? surgeryView(list, day) : tab === 'consultas' ? agendaConsultView(list, day) : generalView(list);
  return header('Agenda', fday(day).replace(/^./, c => c.toUpperCase()),
    `<button class="btn" data-act="agendaShift" data-n="-1" aria-label="Día anterior">‹</button><button class="btn" data-act="agendaShift" data-n="0">Hoy</button><button class="btn" data-act="agendaShift" data-n="1" aria-label="Día siguiente">›</button><input class="input" type="date" style="width:auto" value="${day}" data-ch="agendaDate" aria-label="Ir a fecha"><button class="btn primary" data-act="newAppt">${tab === 'quirurgica' ? 'Programar cirugía' : 'Nueva cita'}</button>`) +
  dutyStrip(day) +
  `<div class="between" style="margin-bottom:14px">${tabs(nS, nC)}
    <div class="legend">${Object.entries(ESTADOS).map(([k, v]) => `<span class="pill ${v.k}">${v.t} ${list.filter(a => a.status === k).length}</span>`).join('')}</div></div>
  ${body}`;
};
ACTIONS.agTab = el => { UI.agTab = el.dataset.k; render(); };
ACTIONS.agendaShift = el => { const n = +el.dataset.n; UI.agendaDay = n === 0 ? dAt(0) : iso(new Date(new Date((UI.agendaDay || dAt(0)) + 'T00:00').getTime() + n * DAY)); animNext = true; render(); };
ACTIONS.agendaDate = el => { if (el.value) { UI.agendaDay = el.value; animNext = true; render(); } };

// ---------- Nueva cita / cirugía ----------
function apptForm(f) {
  const kindSeg = `<div class="seg" role="group" aria-label="Tipo"><button data-act="apKind" data-k="consulta" aria-pressed="${f.kind === 'consulta'}">Consulta</button><button data-act="apKind" data-k="cirugia" aria-pressed="${f.kind === 'cirugia'}">Cirugía</button></div>`;
  const common = `<div class="full">${sheetStep(1, 'Paciente')}</div><div class="field full"><label for="ap-p">Paciente</label><select class="input" id="ap-p">${patientOptions(f.pid)}</select></div>
    <div class="full">${sheetStep(2, 'Fecha y hora')}</div><div class="field"><label for="ap-date">Fecha</label><input class="input" type="date" id="ap-date" value="${f.date}"></div>
    <div class="field"><label for="ap-time">Hora de inicio</label><input class="input" type="time" id="ap-time" step="900" value="${f.time}"></div>`;
  if (f.kind === 'cirugia') return `<div id="appt-patient-band">${patientBand(f.pid)}</div>` + kindSeg + `<div class="form">${common}<div class="full">${sheetStep(3, 'Atención y equipo médico')}</div>
    <div class="field full"><label for="ap-proc">Cirugía o procedimiento</label><input class="input" id="ap-proc" value="${esc(f.proc || '')}" placeholder="Ej. Colecistectomía laparoscópica"></div>
    <div class="field"><label for="ap-d">Médico tratante</label><select class="input" id="ap-d">${apDocs().map(m => `<option value="${m.id}" ${m.id === f.doc ? 'selected' : ''}>${esc(m.name)} · ${esc(m.esp)}</option>`).join('')}</select></div>
    <div class="field"><label for="ap-h">Duración estimada</label><select class="input" id="ap-h" data-ch="apHours">${[1, 1.5, 2, 2.5, 3, 4, 5, 6].map(h => `<option value="${h}" ${+f.hours === h ? 'selected' : ''}>${hrs(h)}</option>`).join('')}</select></div>
    <div class="field"><label for="ap-an">Anestesiólogo</label><select class="input" id="ap-an"><option value="">Por asignar</option>${anesthDocs().map(m => `<option value="${m.id}" ${m.id === f.anest ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="ap-kit">Kit de cirugía <span style="color:var(--bad)">*</span></label><select class="input" id="ap-kit"><option value="">${(S.kits || []).length ? 'Elija el kit' : 'Aún no hay kits creados'}</option>${(S.kits || []).map(k => `<option value="${k.id}" ${k.id === f.kit ? 'selected' : ''}>${esc(k.name)} · ${k.items.length} artículo(s)</option>`).join('')}</select></div>
    <div class="full small muted" id="ap-msg"></div></div>`;
  return `<div id="appt-patient-band">${patientBand(f.pid)}</div>` + kindSeg + `<div class="form">${common}<div class="full">${sheetStep(3, 'Atención y equipo médico')}</div>
    <div class="field"><label for="ap-d">Médico</label><select class="input" id="ap-d" data-ch="apDoc">${apDocs().map(m => `<option value="${m.id}" ${m.id === f.doc ? 'selected' : ''}>${esc(m.name)} · ${esc(m.esp)}</option>`).join('')}</select><span class="small" id="ap-hrs" style="color:var(--good)">Atiende: ${esc(hoursText(f.doc))}</span></div>
    <div class="field"><label for="ap-s">Servicio</label><select class="input" id="ap-s">${S.services.filter(s => ['Consultas', 'Imagen y diagnóstico', 'Emergencia y enfermería'].includes(s.cat)).map(s => `<option value="${s.id}" ${s.id === f.svc ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div class="full small muted" id="ap-msg">¿Paciente nuevo? <button class="btn ghost sm" data-act="newPatient">Registrar paciente</button></div></div>`;
}
// Médicos que se pueden elegir al agendar: el médico solo se agenda a sí mismo
const apDocs = () => agendaOwn() ? consultDocs().filter(m => m.id === myDoc()) : consultDocs();
ACTIONS.newAppt = el => {
  if (!can('agenda.programar')) { toast('Las citas las programa recepción'); return; }
  const ds = el?.dataset || {};
  UI.ap = { ref: ds.ref || null, kind: ds.kind || (UI.agTab === 'quirurgica' ? 'cirugia' : 'consulta'), pid: ds.pid || S.patients[0]?.id || '', date: UI.agendaDay || dAt(0), time: ds.time || (UI.agTab === 'quirurgica' ? '07:00' : '10:00'), doc: agendaOwn() ? myDoc() : ds.doc || consultDocs()[0].id, svc: 'v1', hours: 2, anest: anesthDocs()[0]?.id || '', proc: '' };
  openSheet(UI.ap.kind === 'cirugia' ? 'Programar cirugía' : 'Nueva cita', apptForm(UI.ap), `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveAppt">Agendar</button>`);
};
const apKeep = () => { const f = UI.ap; f.pid = val('ap-p'); f.date = val('ap-date'); f.time = val('ap-time'); f.doc = val('ap-d'); if (f.kind === 'cirugia') { f.proc = val('ap-proc'); f.hours = +val('ap-h'); f.anest = val('ap-an'); f.kit = val('ap-kit'); } else f.svc = val('ap-s'); };
ACTIONS.apDoc = () => { const t = document.getElementById('ap-hrs'); if (t) t.textContent = 'Atiende: ' + hoursText(val('ap-d')); };
ACTIONS.apKind = el => { apKeep(); UI.ap.kind = el.dataset.k; refreshSheet(apptForm(UI.ap)); };
ACTIONS.apHours = () => {};
// Revisa horario del médico y choques (quirófano, médico, anestesiólogo, paciente). Escribe el motivo en msg y devuelve true si hay choque.
function apptConflict(a, msg) {
  const s0 = toMin(a.time), e0 = apptEnd(a);
  const overlap = x => x.id !== a.id && x.date === a.date && isActive(x) && toMin(x.time) < e0 && apptEnd(x) > s0;
  const people = [a.doc, a.anest].filter(Boolean);
  const docClash = S.appts.find(x => overlap(x) && people.some(id => x.doc === id || x.anest === id));
  const orClash = a.kind === 'cirugia' && S.appts.find(x => x.kind === 'cirugia' && overlap(x));
  if (a.kind === 'consulta' && !inAvail(a.doc, a.date, s0, e0)) { const av = availOf(a.doc, a.date); msg.innerHTML = `<span class="pill bad">Fuera de horario</span> ${esc(med(a.doc).name)} ${av ? `el ${DAY_NAMES[new Date(a.date + 'T00:00').getDay()].toLowerCase()} atiende de ${av.from} a ${av.to}` : `no atiende los ${DAY_NAMES[new Date(a.date + 'T00:00').getDay()].toLowerCase()}`}. Su horario: ${esc(hoursText(a.doc))}.`; return true; }
  if (orClash) { msg.innerHTML = `<span class="pill bad">Quirófano ocupado</span> ${esc(pat(orClash.pid).name)} de ${orClash.time} a ${toTime(apptEnd(orClash))}. Elige otra hora.`; return true; }
  if (docClash) { const who = people.find(id => docClash.doc === id || docClash.anest === id); msg.innerHTML = `<span class="pill bad">Choque de horario</span> ${esc(med(who).name)} ya tiene ${docClash.kind === 'cirugia' ? 'una cirugía' : 'una cita'} de ${docClash.time} a ${toTime(apptEnd(docClash))}.`; return true; }
  const patClash = S.appts.find(x => overlap(x) && x.pid === a.pid);
  if (patClash) { msg.innerHTML = `<span class="pill bad">Choque de horario</span> ${esc(pat(a.pid).name)} ya tiene ${patClash.kind === 'cirugia' ? 'una cirugía' : 'una cita'} de ${patClash.time} a ${toTime(apptEnd(patClash))}.`; return true; }
  return false;
}
ACTIONS.saveAppt = () => {
  apKeep(); const f = UI.ap; const msg = document.getElementById('ap-msg');
  if (!f.pid || !pat(f.pid)) { msg.innerHTML = 'Elija el paciente o regístrelo primero. <button class="btn ghost sm" data-act="newPatient">Registrar paciente</button>'; return; }
  if (agendaOwn() && f.doc !== myDoc()) { msg.textContent = 'Solo puede agendar a su nombre.'; return; }
  if (!f.date || !f.time) { msg.textContent = 'Indica fecha y hora.'; return; }
  if (f.kind === 'cirugia' && !f.proc.trim()) { msg.textContent = 'Escribe qué cirugía se va a realizar.'; return; }
  // El kit es obligatorio; los kits solo los crea Administración (Quirófano › Kits de cirugía)
  if (f.kind === 'cirugia' && !kitOf(f.kit)) { msg.textContent = (S.kits || []).length ? 'Elija el kit de cirugía.' : 'Aún no hay kits de cirugía. Administración debe crearlos en Quirófano › Kits de cirugía.'; return; }
  const a = f.kind === 'cirugia'
    ? { id: uid('a'), kind: 'cirugia', pid: f.pid, doc: f.doc, svc: 'v5', proc: f.proc.trim(), hours: f.hours, anest: f.anest, kit: f.kit || null, date: f.date, time: f.time, status: 'reservada', inv: null }
    : { id: uid('a'), kind: 'consulta', pid: f.pid, doc: f.doc, svc: f.svc, date: f.date, time: f.time, status: 'reservada', inv: null };
  if (apptConflict(a, msg)) return;
  // Cita que viene de una derivación: la derivación queda como agendada
  const ref = f.ref && (S.referrals || []).find(r => r.id === f.ref);
  if (ref) { a.ref = ref.id; Object.assign(ref, { status: 'agendada', apptId: a.id, closedAt: nowStamp(), closedBy: actor() }); }
  S.appts.push(a); log(a.kind === 'cirugia' ? 'Cirugía programada' : 'Cita agendada', `${pat(a.pid).name} · ${a.date} ${a.time}${a.proc ? ' · ' + a.proc : ''}${ref ? ' · derivación ' + ref.num : ''}`); save();
  UI.agendaDay = a.date; UI.agTab = a.kind === 'cirugia' ? 'quirurgica' : 'consultas'; closeSheet(); go('agenda'); toast(a.kind === 'cirugia' ? 'Cirugía programada' : 'Cita agendada');
};

// ---------- Detalle de la cita ----------
ACTIONS.openAppt = el => {
  const a = byId(S.appts, el.dataset.id); const p = pat(a.pid); const g = dutyOf(a.date);
  const btn = (st, label, cls = '') => a.status !== st ? `<button class="btn ${cls}" data-act="apptStatus" data-id="${a.id}" data-st="${st}">${label}</button>` : '';
  const row = (k, v, end = '') => `<div class="row"><div class="grow"><div class="s">${k}</div><div class="t">${v}</div></div>${end ? `<div class="end">${end}</div>` : ''}</div>`;
  openSheet(`${a.kind === 'cirugia' ? 'Cirugía' : 'Consulta'} · ${p.name}`, `${patientBand(p.id)}<div class="list">
    ${row('Fecha y hora', `${fdate(a.date)} · ${a.time}${a.kind === 'cirugia' ? '–' + toTime(apptEnd(a)) + ' (' + hrs(a.hours) + ')' : ''}`, statusPill(a.status))}
    ${a.kind === 'cirugia' ? row('Cirugía', esc(a.proc)) + row('Médico tratante', esc(med(a.doc).name)) + row('Anestesiólogo', a.anest ? esc(med(a.anest)?.name) : 'Por asignar') + row('Kit de cirugía', kitOf(a.kit) ? esc(kitOf(a.kit).name) : '<span style="color:var(--bad)">Sin kit</span>', !a.done && can('agenda.programar') && (S.kits || []).length ? `<button class="btn sm" data-act="apKitChange" data-id="${a.id}">Cambiar</button>` : '')
      : row('Servicio', esc(svc(a.svc).name), svcPriceLabel(svc(a.svc))) + row('Médico', `${esc(med(a.doc).name)} · ${esc(med(a.doc).esp)}`)}
    ${a.moved?.length ? row('Pospuesta', a.moved.map(m => `desde ${fdate(m.date)} ${m.time} · ${esc(m.by)}`).join('<br>')) : ''}
    ${row('Teléfono', esc(p.phone))}
    ${p.allergies.length ? row('Alergias', `<span class="allergy-txt">${esc(p.allergies.join(', '))}</span>`) : ''}
    ${row('De guardia ese día', `${g.doc ? esc(med(g.doc)?.name) : 'Médico sin asignar'} · ${g.nurse ? esc(g.nurse) : 'enfermera sin asignar'}`)}
  </div>${a.inv ? `<div class="banner">Atención registrada en ${byId(S.invoices, a.inv) ? chargeLabel(byId(S.invoices, a.inv)).toLowerCase() : 'la cuenta'} ${esc(byId(S.invoices, a.inv)?.num)}.</div>` : ''}`,
    apptFooter(a, p, btn, `${a.kind === 'cirugia' ? (canSee('quirofano') ? `<button class="btn primary" data-act="openQx" data-id="${a.id}">Ver en Quirófano</button>` : '') : canSee('atencion') ? `<button class="btn primary" data-act="attendAppt" data-id="${a.id}">Atender y cobrar</button>` : ''}`));
};
// Cambiar el kit de una cirugía ya programada (el kit es obligatorio)
ACTIONS.apKitChange = el => { const a = byId(S.appts, el.dataset.id);
  openSheet(`Kit de cirugía · ${a.proc}`, `${patientBand(a.pid)}<div class="field"><label for="ak-k">Kit</label><select class="input" id="ak-k">${S.kits.map(k => `<option value="${k.id}" ${k.id === a.kit ? 'selected' : ''}>${esc(k.name)} · ${k.items.length} artículo(s)</option>`).join('')}</select></div>
    ${qxOrders(a).length ? '<div class="small muted">Ya hay solicitudes enviadas al almacén para esta cirugía: el cambio no las modifica.</div>' : '<div class="small muted">La solicitud al almacén de esta cirugía llegará precargada con el kit elegido.</div>'}`,
    `<button class="btn" data-act="openAppt" data-id="${a.id}">Volver</button><button class="btn primary" data-act="apKitSave" data-id="${a.id}">Guardar</button>`); };
ACTIONS.apKitSave = el => { const a = byId(S.appts, el.dataset.id); const k = kitOf(val('ak-k')); if (!k || !can('agenda.programar')) return;
  a.kit = k.id; log('Kit de cirugía cambiado', `${pat(a.pid).name} · ${a.proc} · ${k.name}`); save(); render(); ACTIONS.openAppt({ dataset: { id: a.id } }); toast('Kit actualizado'); };
ACTIONS.openQx = el => { const a = byId(S.appts, el.dataset.id); UI.qxDay = a.date; closeSheet(); go('quirofano');
};
// Orden de la cita: Reservada → Confirmada → Llegó (en espera) → Atendida. No se vuelve atrás (antes "Confirmar" deshacía "Llegó").
const APPT_NEXT = { reservada: ['confirmada', 'en_espera', 'atendida', 'no_asistio'], confirmada: ['en_espera', 'atendida', 'no_asistio'], en_espera: ['atendida'] };
const APPT_BTN = { confirmada: 'Confirmar', en_espera: 'Llegó', atendida: 'Atendida', no_asistio: 'No asistió' };
const apptEditable = a => can('agenda.programar') && (!agendaOwn() || a.doc === myDoc() || a.anest === myDoc());
function apptFooter(a, p, btn, extra) {
  if (a.kind === 'consulta' && can('consulta.clinico') && (!agendaOwn() || a.doc === myDoc()) && !['cancelada', 'no_asistio'].includes(a.status)) {
    extra += '<button class="btn primary" data-act="beginConsult" data-id="' + a.id + '">Comenzar consulta</button>';
  }
  const open = !['atendida', 'cancelada', 'no_asistio'].includes(a.status);
  const exp = canSee('pacientes') ? `<button class="btn" data-go="pacientes" data-param="${p.id}">Abrir expediente</button>` : '';
  if (!apptEditable(a)) return open ? extra : exp;
  if (!open) return `${exp}${a.status !== 'atendida' ? `<button class="btn primary" data-act="apPostpone" data-id="${a.id}">Reprogramar</button>` : ''}`;
  // La cirugía se marca "realizada" en Quirófano; aquí solo las consultas se marcan atendidas
  const next = (APPT_NEXT[a.status] || []).filter(st => !(a.kind === 'cirugia' && st === 'atendida'));
  return `${btn('cancelada', 'Cancelar cita', 'danger')}<button class="btn" data-act="apPostpone" data-id="${a.id}">Posponer</button>${next.map(st => btn(st, APPT_BTN[st], st === 'atendida' && !canSee('atencion') ? 'primary' : '')).join('')}${extra}`;
}
ACTIONS.apptStatus = el => { const a = byId(S.appts, el.dataset.id); if (!a || !apptEditable(a)) return;
  const st = el.dataset.st; if (st !== 'cancelada' && !(APPT_NEXT[a.status] || []).includes(st)) { toast('Ese cambio no corresponde al estado actual de la cita'); return; } a.status = st; log('Cita: ' + ESTADOS[a.status].t, pat(a.pid).name); save(); closeSheet(); render(); toast(ESTADOS[a.status].t); };
// Una cirugía se factura con su quirófano por las horas programadas (y el anestesiólogo si está asignado)
ACTIONS.attendAppt = el => {
  const a = byId(S.appts, el.dataset.id);
  if (a.kind !== 'cirugia') { ACTIONS.newAttention(null, { pid: a.pid, doc: a.doc, svcs: [a.svc], apptId: a.id }); return; }
  ACTIONS.newAttention(null, { pid: a.pid, doc: a.doc, svcs: ['v5', ...(a.anest ? ['v6'] : [])], apptId: a.id });
  UI.at.qty = { v5: Math.ceil(a.hours || 1) }; UI.at.proc = a.proc; atRedraw();
};

// Posponer (o reprogramar una cita a la que no asistió o que se canceló): nueva fecha y hora, con los mismos controles de choque
ACTIONS.apPostpone = el => { const a = byId(S.appts, el.dataset.id); if (!apptEditable(a)) return;
  openSheet(`${['no_asistio', 'cancelada'].includes(a.status) ? 'Reprogramar' : 'Posponer'} · ${pat(a.pid).name}`, `${patientBand(a.pid)}<div class="small muted">Actual: ${fdate(a.date)} a las ${a.time}${a.kind === 'cirugia' ? ' · ' + esc(a.proc) : ''}.</div><div class="form">
    <div class="field"><label for="pp-date">Nueva fecha</label><input class="input" type="date" id="pp-date" value="${a.date}" min="${dAt(0)}"></div>
    <div class="field"><label for="pp-time">Nueva hora</label><input class="input" type="time" step="900" id="pp-time" value="${a.time}"></div>
    <div class="full small muted" id="pp-msg"></div></div>`,
    `<button class="btn" data-act="openAppt" data-id="${a.id}">Volver</button><button class="btn primary" data-act="apPostponeSave" data-id="${a.id}">Guardar nueva fecha</button>`); };
ACTIONS.apPostponeSave = el => { const a = byId(S.appts, el.dataset.id); if (!a || !apptEditable(a)) return; const msg = document.getElementById('pp-msg');
  const date = val('pp-date'), time = val('pp-time'); if (!date || !time) { msg.textContent = 'Indique la nueva fecha y hora.'; return; }
  if (date === a.date && time === a.time && isActive(a)) { msg.textContent = 'Elija una fecha u hora distinta a la actual.'; return; }
  const cand = { ...a, date, time, status: 'reservada' }; if (apptConflict(cand, msg)) return;
  (a.moved = a.moved || []).push({ date: a.date, time: a.time, status: a.status, at: nowStamp(), by: actor() });
  log(a.kind === 'cirugia' ? 'Cirugía pospuesta' : 'Cita pospuesta', `${pat(a.pid).name} · ${a.date} ${a.time} → ${date} ${time}`);
  Object.assign(a, { date, time, status: 'reservada' }); save(); UI.agendaDay = date; closeSheet(); render(); toast(`Nueva fecha: ${fdate(date)} a las ${time}`); };
