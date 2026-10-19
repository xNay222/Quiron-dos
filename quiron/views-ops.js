// Vistas operativas: Inicio, Agenda, Pacientes (expediente y consentimientos).
window.VIEWS = {}; window.ACTIONS = {};

const ESTADOS = {
  reservada: { t: 'Reservada', k: '' }, confirmada: { t: 'Confirmada', k: 'info' }, en_espera: { t: 'En espera', k: 'warn' },
  atendida: { t: 'Atendida', k: 'good' }, cancelada: { t: 'Cancelada', k: '' }, no_asistio: { t: 'No asistió', k: 'bad' },
};
const statusPill = s => `<span class="pill ${ESTADOS[s].k}">${ESTADOS[s].t}</span>`;
const initials = n => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

function alertRows(limit = 99) {
  const a = alerts(); const rows = [];
  a.expired.forEach(e => rows.push({ k: 'bad', t: e.p.name, s: `Lote ${e.l.num} vencido hace ${-e.d} días · ${e.l.qty} ${e.p.unit.toLowerCase()}(s)`, pill: 'Vencido' }));
  S.products.filter(p => usable(p) === 0 && stock(p) === 0).forEach(p => rows.push({ k: 'bad', t: p.name, s: `Sin existencia utilizable · mínimo ${p.min}`, pill: 'Agotado' }));   // lo vencido ya sale arriba, lote por lote
  a.soon.forEach(e => rows.push({ k: 'warn', t: e.p.name, s: `Lote ${e.l.num} vence en ${e.d} días · ${e.l.qty} ${e.p.unit.toLowerCase()}(s)`, pill: `${e.d} días` }));
  a.low.filter(p => usable(p) > 0).forEach(p => rows.push({ k: 'warn', t: p.name, s: `Quedan ${usable(p)} · mínimo ${p.min}`, pill: 'Bajo mínimo' }));
  a.exp.filter(e => e.d > 30).forEach(e => rows.push({ k: 'info', t: e.p.name, s: `Lote ${e.l.num} vence en ${e.d} días`, pill: e.d <= 60 ? '60 días' : '90 días' }));
  return rows.slice(0, limit);
}

// ---------- Inicio ----------
// ---------- Inicio: resumen en vivo de la clínica ----------
// Solo lo que está pasando ahora: quirófano, camas (hospitalización, UCI y emergencias) y lo que requiere atención.
// Las consultas no salen aquí: son de cada médico (alquilan su consultorio) y se ven en Agenda.
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const inMin = m => m < 60 ? `en ${m} min` : `en ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
const isUciBed = id => BEDS.find(b => b.id === id)?.type === 'UCI';
// Zona de cada ingreso: 'hosp' (habitaciones), 'uci' o 'emerg'
const zoneOf = a => admArea(a) === 'emerg' ? 'emerg' : isUciBed(a.bed) ? 'uci' : 'hosp';
const zoneBeds = z => BEDS.filter(b => z === 'emerg' ? b.area === 'emerg' : b.area === 'hosp' && (z === 'uci') === (b.type === 'UCI')).length;
const zoneAdms = z => S.admissions.filter(a => a.status === 'ingresado' && zoneOf(a) === z).sort((x, y) => x.bed.localeCompare(y.bed, 'es', { numeric: true }));
function occupiedRows(z) {
  return zoneAdms(z).map(a => { const p = pat(a.pid); const late = nurseDue([a.id]).filter(i => indState(i).k === 'late').length;
    const pend = pendingMedOrders().filter(o => o.admId === a.id).length;
    return `<button class="row" data-go="${areaRoute(a)}" data-param="${a.id}"><span class="avatar" style="border-radius:10px;width:auto;min-width:44px;padding:0 6px;font-size:12px">${esc(a.bed)}</span>
      <div class="grow"><div class="t">${esc(p.name)}</div><div class="s">Día ${dayNumber(a)} · ${esc(a.dx)} · ${esc(med(a.doc)?.name || '')}</div></div>
      <div class="hstack" style="flex:none;justify-content:flex-end">${p.allergies.length ? `<span class="pill allergy">Alergias: ${esc(p.allergies.join(', '))}</span>` : ''}${late ? `<span class="pill bad">${late} dosis atrasada${late > 1 ? 's' : ''}</span>` : ''}${pend ? '<span class="pill warn">Medicación por despachar</span>' : ''}</div></button>`; }).join('');
}
const listJoin = xs => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs.at(-1);
VIEWS.inicio = () => {
  const today = dAt(0); const now = nowMin(); const hour = new Date().getHours();
  const occ = z => zoneAdms(z).length; const anyIn = occ('hosp') + occ('uci') + occ('emerg');
  // Quirófano de hoy: en curso y próximas (las realizadas o canceladas no aparecen)
  const surg = S.appts.filter(a => a.kind === 'cirugia' && a.date === today && isActive(a) && !a.done).sort((x, y) => x.time.localeCompare(y.time));
  const live = surg.filter(a => toMin(a.time) <= now && now < toMin(qxEnd(a))); const next = surg.filter(a => toMin(a.time) > now);
  const late = surg.filter(a => toMin(qxEnd(a)) <= now);   // pasó su hora y nadie la registró como realizada
  const g = dutyOf(today);
  // Lo que requiere atención (solo lo que existe)
  const lateDoses = nurseDue().filter(i => indState(i).k === 'late'); const due = lateDoses.length; const orders = pendingMedOrders().length;
  const lateBeds = [...new Set(lateDoses.map(i => admOf(i.admId)?.bed).filter(Boolean))];
  const urgentEx = S.exams.filter(e => e.priority === 'urgente' && e.status !== 'listo').length;
  const a = alerts(); const notReady = surg.filter(x => { const k = surgeryChecks(x); return k.consent !== 'firmado' || k.preop !== 'listo'; }).length;
  const todo = [
    !g.doc && ['bad', 'Guardia de hoy sin médico asignado', 'Asígnela para que quede en las solicitudes', 'hospitalizacion'],
    due && ['bad', `${due} dosis atrasada${due > 1 ? 's' : ''}`, 'Indicaciones médicas sin aplicar a tiempo', 'hospitalizacion'],
    orders && ['warn', `${orders} solicitud${orders > 1 ? 'es' : ''} al almacén por despachar`, 'Hospitalización, UCI, emergencias y quirófano', 'inventario'],
    notReady && ['warn', `${notReady} cirugía${notReady > 1 ? 's' : ''} de hoy sin consentimiento o preoperatorio`, 'Revise antes de pasar a quirófano', 'quirofano'],
    late.length && ['warn', `${late.length} cirugía${late.length > 1 ? 's' : ''} sin registrar como realizada`, 'Ya pasó su hora prevista', 'quirofano'],
    urgentEx && ['warn', `${urgentEx} ${urgentEx > 1 ? 'exámenes urgentes' : 'examen urgente'} sin resultado`, 'Laboratorio y rayos X', 'examenes'],
    a.expired.length && ['warn', `${a.expired.length} lote${a.expired.length > 1 ? 's' : ''} vencido${a.expired.length > 1 ? 's' : ''} por retirar`, 'Inventario', 'inventario'],
  ].filter(Boolean);
  // La frase del día: cómo está la clínica ahora mismo, en palabras. Datos en negrita; lo urgente en rojo.
  const hi = (txt, cls = '') => `<b class="today-hi ${cls}">${txt}</b>`;
  const qxTxt = live.length ? `El quirófano está ${hi(`en uso hasta las ${qxEnd(live[0])}`, 'bad')} (${esc(live[0].proc)})`
    : next.length ? `El quirófano está ${hi('libre')}; la próxima cirugía es a las ${hi(next[0].time)}` : `El quirófano está ${hi('libre')} por hoy`;
  const bedParts = [`${hi(`${occ('hosp')}/${zoneBeds('hosp')}`)} camas ocupadas en hospitalización`];
  if (occ('uci')) bedParts.push(`${hi(`${occ('uci')}/${zoneBeds('uci')}`)} en UCI`);
  if (occ('emerg')) bedParts.push(`${hi(`${occ('emerg')}/${zoneBeds('emerg')}`)} en emergencias`);
  const bedTxt = anyIn ? `Hay ${listJoin(bedParts)}` : 'No hay pacientes ingresados';
  const medParts = [];
  if (due) medParts.push(hi(`${due} dosis atrasada${due > 1 ? 's' : ''}${lateBeds.length ? ` en ${listJoin(lateBeds)}` : ''}`, 'bad'));
  if (orders) medParts.push(hi(`${orders} solicitud${orders > 1 ? 'es' : ''} de medicación por despachar`, 'bad'));
  const medTxt = medParts.length ? ` Hay ${listJoin(medParts)}.` : anyIn ? ' La medicación está al día.' : '';
  const tile = (go, label, value, sub, cls = '') => `<button class="card kpi tile ${cls}" data-go="${go}"><div class="lab">${label}</div><div class="val">${value}</div><div class="sub">${sub}</div></button>`;
  const hosp = occupiedRows('hosp'), uci = occupiedRows('uci'), emerg = occupiedRows('emerg');
  const qxRow = (x, state) => { const p = pat(x.pid); const k = surgeryChecks(x); const st = state === 'live' ? `<span class="pill bad"><span class="dot pulse"></span>En curso · hasta ${qxEnd(x)}</span>` : state === 'late' ? '<span class="pill warn">Sin registrar</span>' : `<span class="pill info">${x.time} · ${inMin(toMin(x.time) - now)}</span>`;
    return `<button class="row" data-go="quirofano"><div style="min-width:58px;text-align:center"><div class="t" style="font-variant-numeric:tabular-nums">${x.time}</div><div class="s">a ${qxEnd(x)}</div></div>
      <div class="grow"><div class="t">${esc(x.proc)}</div><div class="s">${esc(p.name)} · ${esc(med(x.doc)?.name || '')}${x.anest ? ' · ' + esc(med(x.anest)?.name || '') : ''}</div></div>
      <div class="hstack" style="flex:none;justify-content:flex-end">${k.consent !== 'firmado' ? '<span class="pill bad">Consentimiento</span>' : ''}${k.preop !== 'listo' ? '<span class="pill bad">Preoperatorio</span>' : ''}${st}</div></button>`; };
  const block = (title, sub, body, go) => body ? `<section class="sec"><div class="between" style="margin-bottom:10px"><h3 style="margin:0">${title} <span class="muted small" style="font-weight:400">${sub}</span></h3>${go ? `<button class="btn ghost sm" data-go="${go}">Ver todo</button>` : ''}</div><div class="list">${body}</div></section>` : '';
  const past = S.appts.filter(x => x.date === today && x.kind === 'cirugia' && x.done).sort((x, y) => x.time.localeCompare(y.time));
  return `<section class="today-intro"><div class="small muted">${fday(today).replace(/^./, c => c.toUpperCase())} · así está la clínica ahora</div><h1>${hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'}. ${qxTxt}. ${bedTxt}.${medTxt}</h1></section>` +
  `<div class="grid g4 today-kpis">
    ${tile('quirofano', 'Quirófano', live.length ? 'En uso' : 'Libre', live.length ? `${esc(live[0].proc)} · hasta ${qxEnd(live[0])}` : next.length ? `próxima a las ${next[0].time}` : 'sin más cirugías hoy', live.length ? 'alert' : '')}
    ${tile('hospitalizacion', 'Hospitalización', `${occ('hosp')}<span class="of">/${zoneBeds('hosp')}</span>`, occ('hosp') ? 'camas ocupadas' : 'todas las camas libres')}
    ${tile('hospitalizacion', 'UCI', `${occ('uci')}<span class="of">/${zoneBeds('uci')}</span>`, occ('uci') ? 'camas ocupadas' : 'camas libres', occ('uci') ? 'alert' : '')}
    ${tile('emergencias', 'Emergencias', `${occ('emerg')}<span class="of">/${zoneBeds('emerg')}</span>`, occ('emerg') ? 'camas ocupadas' : 'sin pacientes', occ('emerg') ? 'alert' : '')}
  </div>
  <div class="small muted" style="margin:12px 2px 0">Guardia: <b style="color:var(--fg)">${esc(med(g.doc)?.name || 'sin médico asignado')}</b> · Enfermera: <b style="color:var(--fg)">${esc(g.nurse || 'sin asignar')}</b></div>
  ${dailySummaryCard()}
  <section class="today-feed card sec" aria-label="Hoy en la clínica"><div class="between feed-heading"><h2>Hoy en la clínica</h2><span class="small muted" title="Se actualiza sola cada minuto">Actualizado ${new Date().toTimeString().slice(0, 5)}</span></div>
  <div class="timeline">
  ${todo.length ? `<section class="sec"><h3>Requiere atención</h3><div class="list">${todo.map(([k, t, s, go]) => `<button class="row" data-go="${go}"><span class="dot" style="color:var(--${k === 'bad' ? 'bad' : 'warn'});width:9px;height:9px"></span><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div><span class="muted">›</span></button>`).join('')}</div></section>` : `<p class="small muted">No hay nada que requiera atención.</p>`}
  <div class="now-marker">Ahora · ${new Date().toTimeString().slice(0, 5)}</div>
  ${block('Quirófano', `${surg.length} cirugía${surg.length === 1 ? '' : 's'} hoy`, [...live.map(x => qxRow(x, 'live')), ...late.map(x => qxRow(x, 'late'))].join(''), 'quirofano')}
  ${block('Hospitalización', `${occ('hosp')} de ${zoneBeds('hosp')} camas`, hosp, 'hospitalizacion')}
  ${block('UCI', `${occ('uci')} de ${zoneBeds('uci')} camas`, uci, 'hospitalizacion')}
  ${block('Emergencias', `${occ('emerg')} de ${zoneBeds('emerg')} camas`, emerg, 'emergencias')}
  ${!hosp && !uci && !emerg && !live.length && !late.length ? '<div class="empty">Sin pacientes ingresados ni cirugías en curso.</div>' : ''}
  ${block('Lo próximo', 'Cirugías de hoy', next.map(x => qxRow(x, 'next')).join('') || '<div class="empty">No hay más cirugías programadas para hoy.</div>', 'quirofano')}
  </div>
  <details class="past-events" id="today-past" ${UI.todayPastOpen ? 'open' : ''}><summary>Ver lo que ya pasó (${past.length})</summary><div class="list">${past.map(x => `<button class="row" data-go="quirofano"><span class="timeline-time">${x.time}</span><div class="grow"><div class="t">${esc(x.proc)}</div><div class="s">${esc(pat(x.pid).name)} · ${esc(med(x.doc)?.name || '')}</div></div><span class="pill good">Realizada</span></button>`).join('') || '<div class="empty">Aún no hay cirugías realizadas hoy.</div>'}</div></details></section>`;
};
// Se actualiza solo cada minuto mientras está abierto (sin ventanas abiertas encima)
setInterval(() => { if (route === 'inicio' && S.session?.uid && !document.querySelector('.scrim') && !document.hidden) { document.getElementById('main').classList.remove('enter', 'enter-soft'); render(); } }, 60000);

// La agenda (general, quirúrgica y de consultas, con guardias) está en views-agenda.js
const patientOptions = sel => S.patients.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)} · ${esc(p.ci)}</option>`).join('');
const docOptions = sel => [...activeDocs(), ...MEDICOS.filter(m => m.id === sel && m.active === false)].map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)} · ${esc(m.esp)}</option>`).join('');
const svcOptions = sel => S.services.map(s => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)} · ${fmt(s.price)}</option>`).join('');


// ---------- Pacientes ----------
// Última atención de cada paciente (cita, ingreso, historia, examen, cobro, presupuesto o historia escaneada) para
// ordenarlos por año: los de este año a la mano, los de años anteriores en su "carpeta". La búsqueda recorre todos.
function lastActivity() {
  const m = {}; const ci2pid = {}; S.patients.forEach(p => { const d = normDigits(p.ci); if (d) ci2pid[d] = p.id; });
  const put = (pid, date, what) => { if (!pid || !date) return; const d = String(date).slice(0, 10); if (!m[pid] || d > m[pid].date) m[pid] = { date: d, what }; };
  S.appts.forEach(a => isActive(a) && a.date <= dAt(0) && put(a.pid, a.date, a.kind === 'cirugia' ? 'Cirugía' : 'Consulta'));
  (S.admissions || []).forEach(a => put(a.pid, a.admittedAt, a.emerg ? 'Emergencia' : 'Hospitalización'));
  S.hc.forEach(n => put(n.pid, n.date, NOTE_TYPES[n.type] || 'Historia'));
  S.exams.forEach(e => put(e.pid, e.date, 'Examen'));
  S.invoices.forEach(i => put(i.pid, i.date, 'Cobro'));
  S.budgets.forEach(b => put(b.pid, b.date, 'Presupuesto'));
  (S.records || []).forEach(r => put(r.pid || ci2pid[normDigits(r.ci)], r.date, 'Historia escaneada'));
  S.patients.forEach(p => { if (!m[p.id] && p.created) put(p.id, p.created, 'Registro'); });
  return m;
}
const YEAR_NOW = () => +dAt(0).slice(0, 4);
// La carpeta es el año de la ÚLTIMA atención (no el de la primera): un paciente de 2024 que volvió este año está en el año actual
const patFolders = () => { const y = YEAR_NOW(); return [[String(y), `Última atención ${y}`], [String(y - 1), `Última atención ${y - 1}`], [String(y - 2), `Última atención ${y - 2}`], ['antes', `Última atención ${y - 3} o antes`], ['sin', 'Sin atenciones'], ['todos', 'Todos']]; };
const folderOf = act => { if (!act) return 'sin'; const y = +act.date.slice(0, 4), n = YEAR_NOW(); return y >= n - 2 ? String(Math.min(y, n)) : 'antes'; };
VIEWS.pacientes = id => {
  if (id) return patientRecord(pat(id));
  const q = (UI.patQ || '').toLowerCase();
  const qd = normDigits(q);   // la cédula se encuentra con o sin puntos
  const act = lastActivity(); const folder = UI.patYear || String(YEAR_NOW()); const sortAZ = UI.patSort === 'az';
  const count = {}; S.patients.forEach(p => { const f = folderOf(act[p.id]); count[f] = (count[f] || 0) + 1; }); count.todos = S.patients.length;
  // Con búsqueda se buscan todos los pacientes, sin importar el año
  const all = S.patients.filter(p => q ? (p.name + p.ci + p.phone + p.code).toLowerCase().includes(q) || (qd.length >= 4 && normDigits(p.ci).includes(qd)) : folder === 'todos' || folderOf(act[p.id]) === folder)
    .sort((a, b) => sortAZ ? a.name.localeCompare(b.name, 'es') : (act[b.id]?.date || '').localeCompare(act[a.id]?.date || '') || a.name.localeCompare(b.name, 'es'));
  const lim = UI.patLim || 50; const list = all.slice(0, lim);
  return header('Pacientes', `${S.patients.length} registrados · ${count[String(YEAR_NOW())] || 0} atendidos en ${YEAR_NOW()}`, can('pac.registrar') ? `<button class="btn primary" data-act="newPatient">Nuevo paciente</button>` : '') +
  `<div class="search" style="margin-bottom:14px">${icon('buscar')}<input class="input" id="patQ" placeholder="Buscar por nombre, cédula, teléfono o código QRN (en todos los años)" value="${esc(UI.patQ || '')}" data-in="patSearch" aria-label="Buscar paciente"></div>
  ${q ? `<div class="small muted" style="margin-bottom:10px">${all.length} resultado(s) en todos los años</div>` : `<div class="between" style="margin-bottom:12px;gap:10px;flex-wrap:wrap"><div class="seg" role="group" aria-label="Año de la última atención">${patFolders().filter(([k]) => count[k] || k === folder || k === String(YEAR_NOW()) || k === 'todos').map(([k, t]) => `<button data-act="patYear" data-k="${k}" aria-pressed="${folder === k}">${t}${count[k] ? ` (${count[k]})` : ''}</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="Orden"><button data-act="patSort" data-k="rec" aria-pressed="${!sortAZ}">Más recientes</button><button data-act="patSort" data-k="az" aria-pressed="${sortAZ}">A–Z</button></div></div>`}
  <div class="list">${list.map(p => `<button class="row" data-go="pacientes" data-param="${p.id}">
    <span class="avatar">${initials(p.name)}</span>
    <div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.code)} · ${esc(p.ci)} · ${ageTxt(p)}${act[p.id] ? ` · última atención: ${esc(act[p.id].what.toLowerCase())}, ${fdate(act[p.id].date)}` : ''}</div></div>
    <div class="end hstack">${patientSurgeryPills(p.id)}${p.allergies.length ? '<span class="pill allergy">⚠ Alergias</span>' : ''}<span class="small muted">${esc(p.phone)}</span></div></button>`).join('') || '<div class="empty">No hay pacientes con esa búsqueda.</div>'}
  ${all.length > lim ? `<button class="row" data-act="patMore" style="justify-content:center;color:var(--accent)">Ver ${Math.min(50, all.length - lim)} más de ${all.length}</button>` : ''}</div>`;
};
ACTIONS.patYear = el => { UI.patYear = el.dataset.k; UI.patLim = 50; render(); };
ACTIONS.patSort = el => { UI.patSort = el.dataset.k; render(); };
ACTIONS.patMore = () => { UI.patLim = (UI.patLim || 50) + 50; render(); };
ACTIONS.patSearch = el => { UI.patQ = el.value; UI.patLim = 50; const pos = el.selectionStart; render(); const n = document.getElementById('patQ'); n.focus(); n.setSelectionRange(pos, pos); };

function patientForm(p = {}) {
  return `<div class="form">
    <div class="field full"><label for="pf-name">Nombre completo</label><input class="input" id="pf-name" value="${esc(p.name || '')}" data-in="dupCheck"></div>
    <div class="field"><label for="pf-ci">Cédula / pasaporte</label><input class="input" id="pf-ci" placeholder="V-12.345.678" value="${esc(p.ci || '')}" data-in="dupCheck"></div>
    <div class="field"><label for="pf-phone">Teléfono / WhatsApp</label><input class="input" id="pf-phone" placeholder="0414-000-0000" value="${esc(p.phone || '')}" data-in="dupCheck"></div>
    <div class="field"><label for="pf-birth">Fecha de nacimiento</label><input class="input" type="date" id="pf-birth" value="${esc(p.birth || '')}"></div>
    <div class="field"><label for="pf-sex">Sexo</label><select class="input" id="pf-sex"><option value="" ${!p.sex ? 'selected' : ''}>No documentado</option><option value="F" ${p.sex === 'F' ? 'selected' : ''}>Femenino</option><option value="M" ${p.sex === 'M' ? 'selected' : ''}>Masculino</option></select></div>
    <div class="field"><label for="pf-blood">Grupo sanguíneo</label><select class="input" id="pf-blood">${['', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(b => `<option ${p.blood === b ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
    <div class="field"><label for="pf-em">Contacto de emergencia</label><input class="input" id="pf-em" value="${esc(p.emergency || '')}"></div>
    <div class="field full"><label for="pf-addr">Dirección</label><input class="input" id="pf-addr" value="${esc(p.address || '')}"></div>
    ${can('pac.clinico') ? `<div class="field full"><label for="pf-all">Alergias (separadas por coma)</label><input class="input" id="pf-all" value="${esc((p.allergies || []).join(', '))}"></div>
    <div class="field full"><label for="pf-cond">Antecedentes / diagnósticos</label><input class="input" id="pf-cond" value="${esc((p.conditions || []).join(', '))}"></div>
    <div class="field"><label for="pf-meds">Medicamentos habituales</label><input class="input" id="pf-meds" value="${esc((p.meds || []).join(', '))}"></div>
    <div class="field"><label for="pf-surg">Cirugías previas</label><input class="input" id="pf-surg" value="${esc((p.surgeries || []).join(', '))}"></div>
    ` : ''}
    <div class="full" id="dupMsg"></div>
  </div>`;
}
const splitList = s => s.split(',').map(x => x.trim()).filter(Boolean);
const normDigits = s => s.replace(/\D/g, '');
ACTIONS.dupCheck = () => {
  const name = val('pf-name').toLowerCase(), ci = normDigits(val('pf-ci')), ph = normDigits(val('pf-phone'));
  const words = name.split(' ').filter(w => w.length > 2);
  const hit = S.patients.find(p => p.id !== UI.editingPat && ((ci.length > 5 && normDigits(p.ci) === ci) || (ph.length > 9 && normDigits(p.phone) === ph) || (words.length >= 2 && words.filter(w => p.name.toLowerCase().includes(w)).length >= 2)));
  document.getElementById('dupMsg').innerHTML = hit ? `<div class="banner warn"><div><b>Posible duplicado:</b> ${esc(hit.name)} (${esc(hit.ci)} · ${esc(hit.phone)}). <button class="btn ghost sm" data-go="pacientes" data-param="${hit.id}">Abrir ese expediente</button></div></div>` : '';
};
ACTIONS.newPatient = () => { UI.editingPat = null; openSheet('Nuevo paciente', patientForm(), `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="savePatient">Guardar paciente</button>`, { wide: true }); };
ACTIONS.editPatient = el => { const p = pat(el.dataset.id); UI.editingPat = p.id; openSheet('Editar ficha', patientBand(p.id) + patientForm(p), `${can('*') ? `<button class="btn danger" data-act="delPatient" data-id="${p.id}">Eliminar paciente</button>` : ''}<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="savePatient">Guardar cambios</button>`, { wide: true }); };

// ---------- Eliminar un paciente (solo Administración): pensado para pacientes de prueba o duplicados ----------
// Antes de borrar se guarda una copia completa de los datos (en "copias de seguridad" con el servidor local, o se descarga).
// Se borran sus citas, ingresos, historias, exámenes, presupuestos, cobros y solicitudes de medicación. Las historias
// escaneadas NO se borran (son documentos reales): solo se desvinculan. Lo despachado puede volver al inventario.
const patLinks = pid => { const adm = (S.admissions || []).filter(a => a.pid === pid).map(a => a.id);
  const orders = (S.medOrders || []).filter(o => o.pid === pid);
  // Lo que se puede devolver: despachado, menos lo ya devuelto y las dosis que enfermería registró como aplicadas
  const served = orders.filter(moServed).flatMap(o => o.items.map(it => ({ o, it, n: it.qty - (it.returned || 0) - givenCount(o, it) }))).filter(x => x.n > 0);
  return { appts: S.appts.filter(a => a.pid === pid), adm, orders, served, hc: S.hc.filter(n => n.pid === pid), exams: S.exams.filter(e => e.pid === pid),
    invoices: S.invoices.filter(i => i.pid === pid), budgets: S.budgets.filter(b => b.pid === pid), records: (S.records || []).filter(r => r.pid === pid), consults: (S.consults || []).filter(c => c.pid === pid) }; };
ACTIONS.delPatient = el => { if (!can('*')) return; const p = pat(el.dataset.id); const L = patLinks(p.id);
  const paid = L.invoices.reduce((a, i) => a + invPaid(i), 0);
  const rows = [['Citas y cirugías', L.appts.length], ['Hospitalizaciones o emergencias', L.adm.length], ['Historias clínicas', L.hc.length], ['Consultas', L.consults.length], ['Exámenes', L.exams.length],
    ['Presupuestos', L.budgets.length], ['Cobros', L.invoices.length], ['Solicitudes de medicación', L.orders.length], ['Consentimientos', (p.consents || []).length]].filter(r => r[1]);
  openSheet(`Eliminar a ${p.name}`, `${patientBand(p.id)}<div class="banner warn">Esto borra al paciente y todo lo registrado a su nombre. Úselo para pacientes de prueba o duplicados, no para pacientes reales.</div>
    <div class="small muted">${esc(p.code)} · ${esc(p.ci)}</div>
    ${rows.length ? `<div class="list">${rows.map(([t, n]) => `<div class="row"><div class="grow">${t}</div><b>${n}</b></div>`).join('')}</div>` : '<div class="small">No tiene nada registrado a su nombre.</div>'}
    ${paid ? `<div class="banner warn">Tiene cobros registrados por ${bsSum(L.invoices, invPaid)}. Desaparecerán de Contabilidad.</div>` : ''}
    ${L.records.length ? `<div class="small">Tiene ${L.records.length} historia(s) escaneada(s) vinculada(s): <b>no se borran</b>, quedan en Historias sin paciente asignado.</div>` : ''}
    ${L.served.length ? `<label class="hstack small"><input type="checkbox" id="dp-ret" checked> Devolver al inventario lo despachado y no usado (${L.served.map(x => `${esc(prod(x.it.pid)?.name || '?')} ×${x.n}`).join(', ')})</label>` : ''}
    <div class="small muted">Antes de borrar se guarda una copia completa de los datos, por si necesita recuperarlo.</div>
    <div class="form"><div class="field"><label for="dp-why">Motivo</label><select class="input" id="dp-why"><option value="">Elija el motivo…</option>${['Paciente de prueba', 'Paciente duplicado', 'Creado por error', 'Otro'].map(x => `<option>${x}</option>`).join('')}</select></div>
      <div class="field"><label for="dp-det">Detalle (opcional)</label><input class="input" id="dp-det" placeholder="Ej. duplicado de QRN-000245"></div></div>
    <div class="banner" style="background:var(--bad-soft)"><span>¿Seguro que va a eliminar a <b>${esc(p.name)}</b> (${esc(p.code)} · ${esc(p.ci || 'sin cédula')})? Esta acción no se puede deshacer desde el programa.</span></div>
    <div class="field"><label for="dp-ok">Para confirmar, escriba ELIMINAR</label><input class="input" id="dp-ok" autocomplete="off"></div><span class="note" id="dp-msg"></span>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn danger" data-act="delPatientDo" data-id="${p.id}">Eliminar definitivamente</button>`); };
ACTIONS.delPatientDo = async el => { if (!can('*')) return; const p = pat(el.dataset.id); if (!p) return; const msg = document.getElementById('dp-msg');
  const why = val('dp-why'), det = val('dp-det').trim();
  if (!why) { msg.textContent = 'Elija el motivo.'; return; }
  if (why === 'Otro' && !det) { msg.textContent = 'Explique el motivo en el detalle.'; return; }
  if (val('dp-ok').trim().toUpperCase() !== 'ELIMINAR') { msg.textContent = 'Escriba ELIMINAR para confirmar.'; return; }
  const ret = document.getElementById('dp-ret')?.checked; const L = patLinks(p.id);
  // Copia de seguridad previa: en la carpeta del servidor local; si no hay servidor, se descarga
  const name = `Antes de eliminar ${safeName(p.name)} ${dAt(0)} ${Date.now().toString().slice(-5)}.json`; let saved = false;
  try { saved = (await fetch('/__copia?nombre=' + encodeURIComponent(name), { method: 'PUT', body: backupPayload() })).ok; } catch (e) {}
  if (!saved) { const enc = await backupBlob(); saved = !!enc && await saveFile(name.replace(/\.json$/, ' (cifrada).json'), enc); }
  if (!saved) { msg.textContent = 'No se pudo guardar la copia previa; no se eliminó nada.'; return; }
  if (ret) L.served.forEach(({ o, it, n }) => returnUnits(o, it, n, 'Devolución por paciente eliminado'));
  const ids = k => new Set(L[k].map(x => x.id)); const inv = ids('invoices'), ord = new Set(L.orders.map(o => o.id)), adm = new Set(L.adm);
  S.appts = S.appts.filter(a => a.pid !== p.id); S.admissions = (S.admissions || []).filter(a => a.pid !== p.id); S.medOrders = (S.medOrders || []).filter(o => !ord.has(o.id));
  S.mar = (S.mar || []).filter(k => !adm.has(k.admId) && !ord.has(k.orderId)); S.hc = S.hc.filter(n => n.pid !== p.id); S.exams = S.exams.filter(e => e.pid !== p.id);
  S.invoices = S.invoices.filter(i => !inv.has(i.id)); S.budgets = S.budgets.filter(b => b.pid !== p.id); S.consults = (S.consults || []).filter(c => c.pid !== p.id);
  L.records.forEach(r => { r.pid = null; }); S.patients = S.patients.filter(x => x.id !== p.id);
  (S.deletedPatients = S.deletedPatients || []).unshift({ at: nowStamp(), by: actor(), code: p.code, name: p.name, ci: p.ci || '', why, det, backup: name, counts: { citas: L.appts.length, consultas: L.consults.length, historias: L.hc.length, cobros: L.invoices.length } });
  log('Paciente eliminado', `${p.code} · ${p.name} · motivo: ${why}${det ? ' (' + det + ')' : ''} · ${L.appts.length} cita(s), ${L.consults.length} consulta(s), ${L.hc.length} historia(s), ${L.invoices.length} cobro(s)${ret && L.served.length ? ' · medicación devuelta al inventario' : ''} · copia previa: ${name}`);
  save(); closeSheet(); go('pacientes', null, { root: true }); toast(`${p.name} eliminado · copia previa guardada`);
};
ACTIONS.savePatient = () => {
  if (!can('pac.registrar')) return;
  if (!val('pf-name').trim() || (!val('pf-ci').trim() && !(UI.editingPat && pat(UI.editingPat)?.documentType === 'sin documento'))) { document.getElementById('dupMsg').innerHTML = '<div class="banner warn">El nombre y la cédula son obligatorios.</div>'; return; }
  const data = { name: val('pf-name').trim(), ci: val('pf-ci').trim(), phone: val('pf-phone').trim(), birth: val('pf-birth'), sex: val('pf-sex'), blood: val('pf-blood'), emergency: val('pf-em'), address: val('pf-addr').trim(), allergies: splitList(val('pf-all')), conditions: splitList(val('pf-cond')), meds: splitList(val('pf-meds')), surgeries: splitList(val('pf-surg')) };
  if (!can('pac.clinico')) { const existing = UI.editingPat && pat(UI.editingPat); ['allergies','conditions','meds','surgeries'].forEach(k => { data[k] = existing?.[k] || []; }); }
  let p;
  if (UI.editingPat) { p = pat(UI.editingPat); if (can('pac.clinico')) CONSULT.applyLegacyClinical(p, data, new Date().toISOString(), S.session?.uid); Object.assign(p, data); log('Ficha de paciente editada', p.name); }
  else { p = { id: uid('pt'), code: 'QRN-' + String(101 + S.patients.length).padStart(6, '0'), notes: [], consents: [], created: dAt(0), ...data }; S.patients.push(p); log('Paciente registrado', `${p.code} · ${p.name}`); }
  CONSULT.migratePatient(p);
  save();
  // Recepción no entra al expediente: vuelve a la cita con el paciente nuevo ya elegido
  if (!canSee('pacientes')) { go('agenda'); ACTIONS.newAppt({ dataset: {} }); UI.ap.pid = p.id; document.getElementById('ap-p').value = p.id; toast('Paciente registrado · completa la cita'); return; }
  closeSheet(); go('pacientes', p.id); toast('Paciente guardado');
};

function patientRecord(p) {
  const tab = patTabs().some(t => t[0] === UI.patTab) ? UI.patTab : 'resumen';
  const invs = S.invoices.filter(i => i.pid === p.id);
  const tagList = (arr, empty) => arr.length ? arr.map(x => `<span class="pill">${esc(x)}</span>`).join(' ') : `<span class="muted small">${empty}</span>`;
  let body = '';
  // Recepción ve la ficha de contacto; el personal clínico, además, antecedentes y alergias
  if (tab === 'resumen' && !can('pac.clinico')) body = `<div class="list">${[['Teléfono', p.phone], ['Dirección', p.address], ['Fecha de nacimiento', p.birth ? fdate(p.birth) + ' · ' + age(p.birth) + ' años' : ''], ['Contacto de emergencia', p.emergency]].map(([k, v]) => `<div class="row"><div class="grow"><div class="s">${k}</div><div class="t">${esc(v || '—')}</div></div></div>`).join('')}</div>`;
  else if (tab === 'resumen') body = `<div class="grid g2">
    <div class="list">
      <div class="row"><div class="grow"><div class="s">Alergias</div><div>${esc(CONSULT.allergyText(p.history))}</div></div>${allergyQuickButton(p.id)}</div>
      <div class="row"><div class="grow"><div class="s">Antecedentes</div><div>${tagList(p.conditions, 'Sin antecedentes registrados')}</div></div></div>
      <div class="row"><div class="grow"><div class="s">Medicamentos habituales</div><div>${tagList(p.meds, 'Ninguno')}</div></div></div>
      <div class="row"><div class="grow"><div class="s">Cirugías previas</div><div>${tagList(p.surgeries, 'Ninguna')}</div></div></div>
    </div>
    <div class="list">
      <div class="row"><div class="grow"><div class="s">Grupo sanguíneo</div><div class="t">${esc(p.blood || '—')}</div></div></div>
      <div class="row"><div class="grow"><div class="s">Contacto de emergencia</div><div class="t">${esc(p.emergency || '—')}</div></div></div>
      ${!can('pac.historia') ? '' : (() => { const h = S.hc.filter(n => n.pid === p.id && n.status === 'firmada').sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0];
        return `<button class="row" data-act="patTab" data-k="evoluciones"><div class="grow"><div class="s">Última historia clínica</div><div class="t">${h ? fdate(h.date) + ' · ' + esc(med(h.doc)?.name) : 'Sin historias en el sistema'}</div></div></button>`; })()}
      ${(() => { const ex = S.exams.filter(e => e.pid === p.id).sort((a, b) => (b.readyAt || b.date).localeCompare(a.readyAt || a.date))[0];
        return `<button class="row" data-act="${ex ? 'openExam' : 'patTab'}" data-id="${ex?.id || ''}" data-k="examenes"><div class="grow"><div class="s">Último examen</div><div class="t">${ex ? esc(ex.tests.join(', ')) + ' · ' + fdate(ex.date) : 'Sin exámenes'}</div></div>${ex ? examFlagPill(ex) : ''}</button>`; })()}
      ${!canSee('contabilidad') ? '' : `<div class="row"><div class="grow"><div class="s">Saldo pendiente</div><div class="t">${bsSum(invs, invDue)}</div></div></div>`}
    </div></div>`;
  if (tab === 'evoluciones') { const hcs = S.hc.filter(n => n.pid === p.id && (n.status === 'firmada' || n.doc === myDoc() || role() === 'admin')).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    body = `<div class="between" style="margin-bottom:10px"><span class="muted small">Escritas y firmadas por los médicos en el sistema. Una historia firmada no se modifica.</span><div class="hstack"><button class="btn sm" data-act="pdfFull" data-id="${p.id}">Historia completa (PDF)</button>${canWriteReport() ? (isClin() ? `<button class="btn primary sm" data-act="newNote" data-pid="${p.id}">Nueva historia</button>` : `<button class="btn primary sm" data-act="newNote" data-pid="${p.id}" data-type="informe">Informe médico</button>`) : ''}</div></div>
    <div class="list">${hcs.map(n => `<button class="row" data-act="openNote" data-id="${n.id}"><div class="grow"><div class="t">${n.type === 'informe' ? `<span class="pill info">Informe médico</span> ${esc(n.motivo && n.motivo !== 'Informe médico' ? n.motivo : (n.to ? 'Dirigido a ' + n.to : ''))}` : `${clinicalNoteTitle(n)} · ${esc((n.dx || [])[0] || n.motivo || '')}`}</div><div class="s">${fdate(n.date)} ${n.time} · ${esc(med(n.doc)?.name)}${n.addenda?.length ? ` · ${n.addenda.length} nota(s) aclaratoria(s)` : ''}</div></div><span class="pill ${n.status === 'firmada' ? 'good' : 'warn'}">${n.status === 'firmada' ? 'Firmada' : 'Borrador'}</span>${n.scans?.length ? '<span class="pill info">Copia física</span>' : ''}</button>`).join('')}
      ${p.notes.map(n => `<div class="row" style="align-items:flex-start"><div class="grow"><div class="s">${fdate(n.d)} · ${esc(n.by)} · nota anterior</div><div style="white-space:pre-wrap">${esc(n.t)}</div></div></div>`).join('')}
      ${!hcs.length && !p.notes.length ? '<div class="empty">Aún no hay historias clínicas en el sistema.</div>' : ''}</div>`; }
  if (tab === 'imagenes') body = patientImages(p.id);
  if (tab === 'presupuestos') body = '<div class="list">' + S.budgets.filter(b => b.pid === p.id).map(b => `<button class="row" data-act="openBudget" data-id="${b.id}"><div class="grow">${esc(b.num)} · ${esc(b.proc || '')}</div>${budPill(b)}</button>`).join('') + '</div>';
  if (tab === 'examenes') { const exs = S.exams.filter(e => e.pid === p.id).sort((a, b) => b.date.localeCompare(a.date));
    body = `<div class="between" style="margin-bottom:10px"><span class="muted small">Laboratorio, rayos X y ecografías, de la clínica o de otros centros</span><div class="hstack">${canUploadExt() ? `<button class="btn sm" data-act="extExam" data-pid="${p.id}">Subir examen externo</button>` : ''}${canCreateExam() ? `<button class="btn sm" data-act="newExam" data-pid="${p.id}">${createLabel()}</button>` : ''}</div></div>
    <div class="list">${exs.map(e => `<button class="row" data-act="openExam" data-id="${e.id}"><div class="grow"><div class="t">${esc(e.num)} · ${esc(e.tests.join(', '))}</div><div class="s">${fdate(e.date)} · ${e.external ? 'Externo · ' + esc(e.external.lab) : esc(med(e.doc)?.name || 'Sin médico solicitante')} · ${e.area === 'laboratorio' ? 'Laboratorio' : 'Imagen'}</div></div>${examFlagPill(e)}</button>`).join('') || '<div class="empty">Sin exámenes.</div>'}</div>`; }
  if (tab === 'consentimientos') body = `<div class="between" style="margin-bottom:10px"><span class="muted small">Se imprimen, el paciente los firma en papel y se sube la foto o el escaneo firmado</span>${can('pac.papeles') || can('pac.escribir') ? `<button class="btn primary sm" data-act="newConsent" data-id="${p.id}">Nuevo consentimiento</button>` : ''}</div>
    <div class="list">${p.consents.map((c, i) => { const pend = c.status === 'pendiente'; return `<div class="row"><button style="all:unset;flex:1;cursor:pointer;min-width:0" data-act="viewConsent" data-id="${p.id}" data-i="${i}"><div class="t">${esc(c.type)}</div><div class="s">${c.proc ? esc(c.proc) + ' · ' : ''}${pend ? `creado el ${fdate(c.d)}` : c.signedAt ? `firmado subido el ${fdate(c.signedAt.slice(0, 10))}` : `firmado por ${esc(c.signer || '')} · ${fdate(c.d)}`}</div></button>
      <div class="hstack">${pend ? `<span class="pill warn">Pendiente de firma</span><button class="btn sm" data-act="consentPrint" data-id="${p.id}" data-i="${i}">Imprimir</button><button class="btn sm primary" data-act="consentUpload" data-id="${p.id}" data-i="${i}">Subir firmado</button>` : '<span class="pill good">Firmado</span>'}</div></div>`; }).join('') || '<div class="empty">Sin consentimientos.</div>'}</div>`;
  if (tab === 'facturas') body = `<div class="list">${invs.map(i => `<button class="row" data-act="openInvoice" data-id="${i.id}"><div class="grow"><div class="t">${esc(i.num)} · ${esc(i.items.map(x => x.name).join(', '))}</div><div class="s">${fdate(i.date)}</div></div><div class="end"><div>${bsOf(invTotals(i).total, i)}</div>${invStatusPill(i)}</div></button>`).join('') || '<div class="empty">Sin cobros.</div>'}</div>`;
  if (tab === 'consumo') { const c = patientConsumption(p.id);
    body = `<div class="small muted" style="margin-bottom:10px">Medicación e insumos que el almacén despachó para este paciente (hospitalización, emergencia y quirófano), menos lo devuelto, valorados al costo de compra de cada lote. Uso interno: no es lo que se cobra.</div>
    <div class="grid g4" style="margin-bottom:14px">${kpi('Costo total', fmt(c.total))}${kpi('Unidades consumidas', c.units)}${kpi('Episodios', c.list.length)}</div>
    ${c.noCost ? '<div class="banner warn" style="margin-bottom:14px">Algunos productos no tienen costo cargado en Inventario y cuentan como $0. Cargue el costo unitario de cada lote para que el total sea real.</div>' : ''}
    <div class="stack">${c.list.map(ep => `<div class="card"><div class="between" style="gap:10px;flex-wrap:wrap"><div><b>${esc(ep.title)}</b><div class="small muted">${fdate(ep.date)} · ${esc(ep.sub)}</div></div><div class="hstack"><b>${fmt(ep.total)}</b>${ep.go && canSee(ep.go[0]) ? `<button class="btn sm" data-go="${ep.go[0]}" data-param="${ep.go[1]}">Ver ingreso</button>` : ''}</div></div>
      <div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Producto</th><th class="num">Unidades</th><th class="num">Costo unitario</th><th class="num">Costo</th></tr></thead><tbody>
      ${ep.lines.map(l => `<tr><td>${esc(prod(l.pid)?.name || 'Producto eliminado')}</td><td class="num">${l.qty}</td><td class="num muted">${fmt(l.qty ? l.cost / l.qty : 0)}</td><td class="num">${fmt(l.cost)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total del episodio</td><td class="num">${ep.units}</td><td></td><td class="num">${fmt(ep.total)}</td></tr></tfoot></table></div></div>`).join('') || '<div class="card empty">Todavía no se ha despachado medicación ni insumos para este paciente.</div>'}</div>`; }
  if (tab === 'historias') { const ci = normDigits(p.ci); const old = S.records.filter(r => r.pid === p.id || (ci && normDigits(r.ci) === ci)).sort((a, b) => b.date.localeCompare(a.date));
    body = `<div class="between" style="margin-bottom:10px"><span class="muted small">Historias en papel digitalizadas que coinciden con su cédula</span><button class="btn sm" data-go="historias">Ir al archivo de historias</button></div>
    <div class="list">${old.map(r => `<button class="row" data-act="openRecord" data-id="${r.id}"><div class="grow"><div class="t">${esc(r.procedure)}</div><div class="s">${r.status === 'escaneada' ? `Año ${esc(r.year)} · ${esc(r.period)} · ${esc(r.file.split('/').pop())}` : `${fdate(r.date)} · ${esc(r.surgeon)} · ${esc(r.source)}`}</div></div>${recPill(r)}</button>`).join('') || '<div class="empty">No hay historias antiguas de este paciente.</div>'}</div>`; }
  return `${backBtn('pacientes')}
  <div class="card between" style="margin-bottom:18px">
    <div class="hstack" style="gap:14px;min-width:0"><span class="avatar" style="width:56px;height:56px;font-size:20px">${initials(p.name)}</span>
      <div style="min-width:0"><h1 style="font-size:24px;margin:0;letter-spacing:-.02em">${esc(p.name)}</h1>
      <div class="muted small">${esc(p.code)} · ${esc(p.ci)} · ${ageTxt(p)} · ${p.sex === 'F' ? 'Femenino' : p.sex === 'M' ? 'Masculino' : 'sexo no registrado'} · ${esc(p.phone)}</div></div></div>
    <div class="actions">${imageUploadButton(p.id)}${can('pac.registrar') ? `<button class="btn" data-act="editPatient" data-id="${p.id}">Editar ficha</button>` : ''}${can('*') ? `<button class="btn danger" data-act="delPatient" data-id="${p.id}">Eliminar</button>` : ''}${can('agenda.programar') ? `<button class="btn" data-act="newApptFor" data-id="${p.id}">Agendar</button>` : ''}${canCreateExam() ? `<button class="btn" data-act="newExam" data-pid="${p.id}">${createLabel()}</button>` : ''}${can('pac.escribir') ? `<button class="btn" data-act="newNote" data-pid="${p.id}" data-type="informe">Informe médico</button>` : ''}${can('pac.escribir') && isClin() ? `<button class="btn primary" data-act="newNote" data-pid="${p.id}">Nueva historia</button>` : ''}${canSee('atencion') ? `<button class="btn primary" data-act="newAttentionFor" data-id="${p.id}">Nueva atención</button>` : ''}</div>
  </div>
  ${(() => { const ad = activeAdmission(p.id); return ad && canSee('hospitalizacion') ? `<div class="banner" style="margin-bottom:14px;align-items:center"><div style="flex:1"><b>Ingresado</b> en ${ad.bed} desde ${ad.admittedAt} · día ${dayNumber(ad)} · ${esc(ad.dx)}</div><button class="btn sm" data-go="${areaRoute(ad)}" data-param="${ad.id}">Ver ${admArea(ad) === 'emerg' ? 'emergencia' : 'hospitalización'}</button></div>` : ''; })()}
  ${canRecordAllergy() && !can('pac.clinico') ? patientBand(p.id) : ''}
  ${surgeryBanner(p)}
  <input type="file" id="cs-file" accept="image/*,application/pdf" data-ch="consentFile" hidden>
  <div class="seg" role="group" aria-label="Secciones del expediente" style="margin-bottom:14px">${patTabs().map(([k, t]) => `<button data-act="patTab" data-k="${k}" aria-pressed="${tab === k}">${t}</button>`).join('')}</div>
  ${body}`;
}
ACTIONS.patTab = el => { UI.patTab = el.dataset.k; render(); };
// Pestañas del expediente según el rol
const patTabs = () => [['resumen', 'Resumen'], ['evoluciones', 'Historia clínica', 'pac.historia'], ['examenes', 'Exámenes', 'pac.clinico'], ['imagenes', 'Imágenes', 'imagenes'], ['presupuestos', 'Presupuestos', 'contab'], ['consentimientos', 'Consentimientos', 'pac.papeles'], ['facturas', 'Cobros', 'contab'], ['consumo', 'Consumo', 'contab'], ['historias', 'Historias antiguas', 'pac.historia']]
  .filter(([, , p]) => !p || (p === 'imagenes' ? canReadImages() : p === 'contab' ? canSee('contabilidad') : can(p) || (p === 'pac.papeles' && can('pac.escribir'))));
// Informes médicos: médicos, residentes y el administrador (a nombre del médico que suscribe)
window.canWriteReport = () => can('pac.escribir');
ACTIONS.newApptFor = el => { ACTIONS.newAppt({ dataset: {} }); document.getElementById('ap-p').value = el.dataset.id; };
ACTIONS.newAttentionFor = el => ACTIONS.newAttention(null, { pid: el.dataset.id });

// La historia clínica (crear, firmar, notas aclaratorias) está en views-clin.js
// ---------- Consentimiento informado médico y quirúrgico ----------
// Flujo: se completa el procedimiento y el médico → se imprime (PDF A4) → el paciente lo firma en papel
// → se fotografía o escanea y se sube aquí. Queda en el expediente del paciente.
const CONSENT_TYPE = 'Consentimiento informado médico y quirúrgico';
// Cláusulas del documento (redacción formal). El texto se guarda con el consentimiento para que no cambie después.
function consentClauses(c, p) {
  const d = med(c.doc); const dn = c.docName || d?.name;
  return [
    `Declaro que he sido informado(a) de manera clara, comprensible y suficiente por mi médico tratante, ${dn ? dn + (d?.esp ? ', ' + d.esp : '') : '______________________'}, acerca de mi condición de salud${c.dx ? ' (' + c.dx + ')' : ''} y de la naturaleza, propósito y beneficios esperados del tratamiento médico y/o procedimiento quirúrgico denominado: ${c.proc}.`,
    'Se me han explicado los riesgos generales inherentes a todo acto médico y quirúrgico, tales como infección, sangrado, reacciones a medicamentos o a la anestesia, formación de coágulos, lesión de estructuras vecinas, alteraciones en la cicatrización y, de forma excepcional, complicaciones graves que pueden comprometer la vida, así como los riesgos específicos relacionados con mi caso particular.',
    'Comprendo que la medicina no es una ciencia exacta y que, en consecuencia, no se me ha garantizado ni puede garantizarse el resultado del tratamiento o del procedimiento. Los resultados pueden variar según la respuesta individual de cada paciente.',
    'Se me han explicado las alternativas de tratamiento disponibles y las consecuencias previsibles de no realizar el procedimiento propuesto.',
    'Autorizo la aplicación de la anestesia y de los medicamentos que el equipo médico considere necesarios, administrados por el personal médico competente.',
    'Autorizo al equipo médico para que, si durante el procedimiento surgieran situaciones imprevistas, realice las maniobras o procedimientos adicionales que considere necesarios para preservar mi vida y mi salud.',
    'Autorizo, en caso de ser necesario, la transfusión de sangre o hemoderivados:   SÍ  [   ]      NO  [   ]',
    'Autorizo el envío de tejidos o muestras obtenidos durante el procedimiento para su estudio anatomopatológico o de laboratorio.',
    'Declaro haber suministrado información veraz y completa sobre mis antecedentes médicos, alergias y medicamentos que utilizo, y me comprometo a cumplir las indicaciones médicas antes y después del procedimiento.',
    'Se me ha informado que puedo revocar este consentimiento en cualquier momento antes de iniciarse el procedimiento, sin que ello afecte la atención que recibiré.',
    'He leído y comprendido este documento, he tenido la oportunidad de formular preguntas y todas han sido respondidas satisfactoriamente. En consecuencia, otorgo mi consentimiento de manera libre y voluntaria.',
  ];
}
const consentText = (type, p) => `Consentimiento de ${p.name}, C.I. ${p.ci}.`;   // compatibilidad con consentimientos anteriores
const nextSurgery = pid => S.appts.filter(a => a.kind === 'cirugia' && a.pid === pid && a.date >= dAt(0) && isActive(a)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];

ACTIONS.newConsent = el => {
  const p = pat(el.dataset.id); const sx = el.dataset.appt ? S.appts.find(a => a.id === el.dataset.appt) : nextSurgery(p.id);
  UI.csAppt = sx?.id || null;   // el consentimiento queda ligado a la cirugía programada
  openSheet('Nuevo consentimiento médico y quirúrgico', `${patientBand(p.id)}<div class="small muted">Complete los datos, imprima el documento y entréguelo al paciente para su firma. Después suba la foto o el escaneo del documento firmado.</div>
    <div class="form">
      <div class="field full"><label for="cs-proc">Tratamiento o procedimiento <span style="color:var(--bad)">*</span></label><input class="input" id="cs-proc" value="${esc(sx?.proc || '')}" placeholder="Ej. Colecistectomía laparoscópica"></div>
      <div class="field"><label for="cs-doc">Médico tratante de la cirugía o procedimiento <span style="color:var(--bad)">*</span></label><input class="input" id="cs-doc" list="cs-docs" placeholder="Escriba o elija el médico tratante" autocomplete="off" value="${esc(med(sx?.doc)?.name || (myDoc() && !med(myDoc())?.resident ? med(myDoc()).name : ''))}">
        <datalist id="cs-docs">${activeDocs().filter(m => !m.resident).map(m => `<option value="${esc(m.name)}">${esc(m.esp)}</option>`).join('')}</datalist>
        ${sx ? `<span class="small muted">En la cirugía programada figura: ${esc(med(sx.doc)?.name || '—')}</span>` : ''}</div>
      <div class="field"><label for="cs-dx">Diagnóstico (opcional)</label><input class="input" id="cs-dx" placeholder="Ej. Colelitiasis sintomática"></div>
      <div class="field full"><label for="cs-rep">Representante legal (solo si el paciente es menor de edad o no puede firmar)</label><input class="input" id="cs-rep" placeholder="Nombre y cédula del representante"></div></div>
    <div class="banner">El documento incluye, entre otras cláusulas, que <b>la medicina no es una ciencia exacta</b> y que no se garantiza el resultado del tratamiento.</div>`,
    `<span class="note" id="cs-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="consentCreate" data-id="${p.id}">${icon('descargar')}Crear e imprimir (PDF)</button>`, { wide: true });
};
ACTIONS.consentCreate = async el => {
  const p = pat(el.dataset.id); const proc = val('cs-proc').trim();
  if (!proc) { document.getElementById('cs-msg').textContent = 'Indique el tratamiento o procedimiento.'; return; }
  const docName = val('cs-doc').trim(); if (docName.length < 3) { document.getElementById('cs-msg').textContent = 'Indique el médico tratante de la cirugía o procedimiento.'; document.getElementById('cs-doc').focus(); return; }
  const dm = MEDICOS.find(m => m.name.toLowerCase() === docName.toLowerCase());
  const c = { id: uid('cs'), type: CONSENT_TYPE, apptId: UI.csAppt || null, proc, doc: dm?.id || null, docName: dm?.name || docName, dx: val('cs-dx').trim(), rep: val('cs-rep').trim(), d: dAt(0), time: new Date().toTimeString().slice(0, 5), status: 'pendiente', by: actor() };
  c.clauses = consentClauses(c, p);
  p.consents.unshift(c); log('Consentimiento creado', `${p.name} · ${proc}`); save(); closeSheet(); UI.patTab = 'consentimientos'; render();
  toast('Consentimiento creado · pendiente de firma');
  if (pdfReady()) await pdfSave(() => pdfConsentPrint(p, c), `Consentimiento ${p.name} ${c.d}.pdf`);
};
ACTIONS.consentPrint = async el => { if (!pdfReady()) return; const p = pat(el.dataset.id); const c = p.consents[+el.dataset.i]; await pdfSave(() => pdfConsentPrint(p, c), `Consentimiento ${p.name} ${c.d}.pdf`); };

// Subir el documento firmado: foto (se reduce de tamaño) o PDF
ACTIONS.consentUpload = el => { UI.csUp = { pid: el.dataset.id, i: +el.dataset.i }; document.getElementById('cs-file').click(); };
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file); const s = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise(ok => c.toBlob(ok, 'image/jpeg', .82));
}
const blobToDataURL = b => new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = fail; r.readAsDataURL(b); });
// Guarda un documento subido y devuelve su dirección. Con el servidor local queda en la carpeta "archivos" del proyecto
// (el navegador tiene poco espacio); en la nube, en su almacenamiento. Devuelve null si no se pudo.
async function storeFile(blob, isPdf) {
  const assets = await getCap('assets'); if (assets) { const file = await assets.upload(blob); return file.url || (file.id ? '/_blob/' + file.id : null); }
  const name = uid('doc') + (isPdf ? '.pdf' : blob.type === 'image/png' ? '.png' : '.jpg');
  try { const r = await fetch('/__archivo?nombre=' + name, { method: 'PUT', body: blob }); if (r.ok) return 'archivos/' + name; } catch (e) {}
  return blob.size < 1.5e6 ? await blobToDataURL(blob) : null;
}
ACTIONS.consentFile = async el => {
  const f = el.files?.[0]; el.value = ''; if (!f || !UI.csUp) return;
  const isPdf = f.type === 'application/pdf'; if (!isPdf && !f.type.startsWith('image/')) { toast('Suba una foto o un PDF'); return; }
  toast('Subiendo documento…');
  try {
    const blob = isPdf ? f : await shrinkImage(f);
    const url = await storeFile(blob, isPdf); if (!url) { toast('El archivo es demasiado grande. Súbalo con el servidor local encendido.'); return; }
    const p = pat(UI.csUp.pid); const c = p.consents[UI.csUp.i];
    c.file = { url, kind: isPdf ? 'pdf' : 'image', name: f.name }; c.status = 'firmado'; c.signedAt = nowStamp(); c.uploadedBy = actor();
    log('Consentimiento firmado subido', `${p.name} · ${c.proc}`); save(); render(); toast('Documento firmado guardado en el expediente');
  } catch (e) { toast('No se pudo subir el documento. Inténtelo de nuevo.'); }
};

ACTIONS.viewConsent = el => {
  const p = pat(el.dataset.id); const i = +el.dataset.i; const c = p.consents[i];
  const doc = c.file ? (c.file.kind === 'image' ? `<img src="${safeUrl(c.file.url)}" alt="Consentimiento firmado" style="width:100%;border-radius:10px;border:1px solid var(--line);background:#fff">`
      : `<iframe src="${safeUrl(c.file.url)}" title="Consentimiento firmado" style="width:100%;height:520px;border:1px solid var(--line);border-radius:10px;background:#fff"></iframe>`)
    : c.img ? `<div class="card small" style="line-height:1.55">${esc(c.text || '')}</div><img src="${safeUrl(c.img)}" alt="Firma de ${esc(c.signer)}" style="background:#fff;border-radius:10px;border:1px solid var(--line)">`
    : '<div class="banner warn">Pendiente de firma: imprima el documento, hágalo firmar y súbalo.</div>';
  openSheet(c.type, `${patientBand(p.id)}<div class="small muted">${c.proc ? esc(c.proc) + ' · ' : ''}${c.docName || c.doc ? 'Médico tratante: ' + esc(c.docName || med(c.doc)?.name || '') + ' · ' : ''}creado el ${fdate(c.d)}${c.signedAt ? ` · firmado subido el ${c.signedAt} por ${esc(c.uploadedBy)}` : c.signer ? ` · firmado por ${esc(c.signer)}` : ''}</div>${doc}`,
    `${c.clauses ? `<button class="btn" data-act="consentPrint" data-id="${p.id}" data-i="${i}">Imprimir en blanco (PDF)</button>` : `<button class="btn" data-act="pdfConsent" data-id="${p.id}" data-i="${i}">Descargar PDF</button>`}${c.status === 'pendiente' ? `<button class="btn primary" data-act="consentUpload" data-id="${p.id}" data-i="${i}">Subir documento firmado</button>` : ''}`, { wide: true });
};

// Registro de pacientes eliminados (Ajustes · solo Administración)
function deletedPatientsCard() {
  const list = S.deletedPatients || [];
  return `<div class="sec"><h3>Pacientes eliminados</h3><div class="list">${list.map(x => `<div class="row"><div class="grow"><div class="t">${esc(x.name)} <span class="muted small">${esc(x.code)} · ${esc(x.ci || 'sin cédula')}</span></div>
    <div class="s">${esc(x.why)}${x.det ? ' · ' + esc(x.det) : ''} · ${Object.entries(x.counts || {}).filter(([, n]) => n).map(([k, n]) => n + ' ' + k).join(', ') || 'sin registros'} · copia previa: ${esc(x.backup)}</div></div>
    <div class="end small muted">${esc(x.at)}<br>${esc(x.by)}</div></div>`).join('') || '<div class="empty">No se ha eliminado ningún paciente.</div>'}</div></div>`;
}
