// Hospitalización: mapa de camas, ficha del ingreso (evoluciones, medicación, exámenes) y alta con factura.
// Médicos tratantes y residentes continúan la historia; el almacén despacha la medicación desde Inventario.

// Pedir medicación, registrar dosis y pedir exámenes: médicos, residentes y el administrador (control maestro).
// Las evoluciones (historia) solo las escriben médicos y residentes.
const canHospWrite = () => can('hosp.solicitar');
const canAdmit = () => can('hosp.ingresar');
// Alta: Administración y el médico tratante; en Emergencias también el médico de guardia del día (de noche no está el tratante)
const canDischarge = a => role() === 'admin' || (!!myDoc() && (myDoc() === a.doc || (admArea(a) === 'emerg' && myDoc() === dutyOf(dAt(0)).doc)));

VIEWS.hospitalizacion = id => id && admOf(id) ? admissionView(admOf(id)) : bedsView('hosp');
// Emergencias: mismas funciones que hospitalización (medicación, evoluciones, exámenes, alta) con sus 3 camas
VIEWS.emergencias = id => id && admOf(id) ? admissionView(admOf(id)) : bedsView('emerg');

function evolutionBedButton(a) {
  if (a.status !== 'ingresado') return '';
  // Administrador sin ficha de médico: el botón explica cómo vincularla en lugar de desaparecer
  if (!evCanWrite()) return role() === 'admin' ? ccButton('evLinkHelp', 'Generar informe evolutivo', '', 'sm') : '';
  const draft = (S.evolutions || []).find(e => e.admId === a.id && e.doc === evDoc() && e.status !== 'firmada');
  return ccButton('evNew', draft ? 'Continuar informe evolutivo' : 'Generar informe evolutivo',
    'data-id="' + esc(a.id) + '"', 'sm');
}

function bedsView(area) {
  const beds = BEDS.filter(b => b.area === area); const R = AREAS[area].route; const em = area === 'emerg';
  const act = S.admissions.filter(a => a.status === 'ingresado' && admArea(a) === area); const pend = pendingMedOrders();
  const done = S.admissions.filter(a => a.status === 'alta' && admArea(a) === area).sort((a, b) => b.dischargedAt.localeCompare(a.dischargedAt)).slice(0, 5);
  const avg = act.length ? (act.reduce((s, a) => s + dayNumber(a), 0) / act.length).toFixed(1).replace('.', ',') : '0';
  const pendHere = pend.filter(o => act.some(a => a.id === o.admId)).length;
  return header(AREAS[area].name, em ? 'Pacientes en emergencia, su evolución y su medicación' : 'Pacientes ingresados, su evolución y su medicación', (canTplEdit() ? `<button class="btn" data-act="tplList">Plantillas de órdenes</button>` : '') + (canAdmit() ? `<button class="btn primary" data-act="admitNew" data-area="${area}">${em ? 'Recibir paciente' : 'Ingresar paciente'}</button>` : '')) +
  (em ? triageBlock() : '') + dutyStrip(dAt(0)) + `<div class="grid g4">${kpi(em ? 'Pacientes en emergencia' : 'Pacientes ingresados', act.length)}${kpi('Camas libres', beds.length - act.length, `de ${beds.length}`)}${kpi('Medicación por despachar', pendHere, 'solicitudes al almacén', pendHere ? 'alert' : '')}${kpi('Estancia promedio', avg + ' días')}</div>
  <div class="bedgrid sec">${beds.map(b => { const a = act.find(x => x.bed === b.id);
    if (!a) return `<div class="bed free"><div class="between"><b>${b.id}</b><span class="pill">${b.type}</span></div><div class="muted small" style="margin:14px 0">Cama libre</div>${canAdmit() ? `<button class="btn sm" data-act="admitNew" data-area="${area}" data-bed="${b.id}">${em ? 'Recibir paciente' : 'Ingresar paciente'}</button>` : ''}</div>`;
    const p = pat(a.pid); const po = pend.filter(o => o.admId === a.id).length;
    // La tarjeta abre el ingreso (evoluciones, medicación, exámenes); "Solicitar medicación" se pide desde aquí mismo
    return `<div class="bed busy"><button class="bed-open" data-go="${R}" data-param="${a.id}" aria-label="Abrir el ingreso de ${esc(p.name)} en ${b.id}"><div class="between"><span class="patient-bed">${b.id}</span><span class="pill ${b.type === 'UCI' || em ? 'bad' : 'info'}">${b.type}</span></div>
      <div class="bed-name">${esc(p.name)}</div><div class="small muted">Día ${dayNumber(a)} · ${esc(a.dx)}</div><div class="small muted">Tratante: ${esc(med(a.doc)?.name)}</div>
      <div class="hstack" style="margin-top:8px">${p.allergies.length ? `<span class="pill allergy">Alergias: ${esc(p.allergies.join(', '))}</span>` : ''}${po ? `<span class="pill warn">${po} medicación por despachar</span>` : ''}</div>${bedIndications(a)}</button>
      <div class="bed-acts"><button class="btn sm" data-go="${R}" data-param="${a.id}">Ver ingreso</button>${canHospWrite() ? `<button class="btn sm primary" data-act="newMedOrder" data-id="${a.id}">Solicitar medicación</button>` : ''}${evolutionBedButton(a)}</div></div>`; }).join('')}</div>
  ${done.length ? `<div class="sec"><h3>Altas recientes</h3><div class="list">${done.map(a => `<button class="row" data-go="${R}" data-param="${a.id}"><div class="grow"><div class="t">${esc(pat(a.pid).name)} · ${a.bed}</div><div class="s">${esc(a.num)} · ${fdate(a.admittedAt.slice(0, 10))} a ${fdate(a.dischargedAt.slice(0, 10))} · ${stayDays(a)} días</div></div><span class="pill">Alta</span>${a.epicrisis ? '' : ' <span class="pill warn">Sin informe de egreso</span>'}</button>`).join('')}</div></div>` : ''}`;
}

function admissionView(a) {
  const guided = evolutionOf(UI.evolutionId);
  if (guided && guided.admId === a.id && evolutionEditable(guided)) return evolutionView(guided);
  const p = pat(a.pid); const clin = can('hosp.clinico'); const tab = clin ? (UI.hospTab || (isNurse() ? 'indicaciones' : 'evoluciones')) : 'medicacion'; const live = a.status === 'ingresado';   // almacén: solo lo que se pidió
  const notes = S.hc.filter(n => n.admId === a.id && (n.status === 'firmada' || n.doc === myDoc())).sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time));
  const orders = S.medOrders.filter(o => o.admId === a.id).sort((x, y) => y.at.localeCompare(x.at));
  const kardex = S.mar.filter(k => k.admId === a.id).sort((x, y) => y.at.localeCompare(x.at));
  const stayEnd = (a.dischargedAt || nowStamp()).slice(0, 10); const noteAdm = e => e.note && S.hc.find(n => n.id === e.note)?.admId;
  const linked = e => e.admId === a.id || noteAdm(e) === a.id;
  const exams = S.exams.filter(e => e.pid === a.pid && (linked(e) || (!e.admId && !noteAdm(e) && !e.apptId && e.date >= a.admittedAt.slice(0, 10) && e.date <= stayEnd)));
  const prevExams = S.exams.filter(e => e.pid === a.pid && !exams.includes(e) && e.date < a.admittedAt.slice(0, 10) && e.date >= iso(new Date(new Date(a.admittedAt.slice(0, 10) + 'T00:00').getTime() - 30 * DAY)));
  let body = '';
  const guidedDrafts = evCanWrite() ? (S.evolutions || []).filter(e => e.admId === a.id && e.doc === evDoc() && e.status !== 'firmada') : [];
  const draftRows = guidedDrafts.map(e => '<button class="row" data-act="evResume" data-id="' + e.id + '"><div class="grow"><div class="t">Evolución guiada · borrador</div><div class="s">' + esc(med(e.doc)?.name) + ' · ' + esc(e.updatedAt || e.date + ' ' + e.time) + '</div></div><span class="pill warn">Retomar</span></button>').join('');
  if (tab === 'evoluciones') body = `<div class="list">${draftRows}${notes.map(n => `<button class="row" data-act="openNote" data-id="${n.id}"><div class="grow"><div class="t">${clinicalNoteTitle(n)} · ${fdate(n.date)} ${n.time}</div><div class="s">${esc(med(n.doc)?.name)}${med(n.doc)?.resident ? ' (residente)' : ''} · ${esc((n.actual || n.motivo || '').slice(0, 110))}</div></div><span class="pill ${n.status === 'firmada' ? 'good' : 'warn'}">${n.status === 'firmada' ? 'Firmada' : 'Borrador'}</span></button>`).join('') || '<div class="empty">Aún no hay evoluciones de este ingreso.</div>'}</div>`;
  if (tab === 'medicacion') body = `<div class="stack">${orders.map(o => `<div class="card"><div class="between"><div><b>${esc(o.num)}</b> ${o.urgent ? '<span class="pill bad">Urgente</span>' : ''}<div class="small muted">${moWho(o)} · ${o.at}${o.dispatchedAt ? ` · despachada ${o.dispatchedAt} por ${esc(o.dispatchedBy)}` : ''}${o.reason ? ' · ' + esc(o.reason) : ''}</div></div>${moPill(o)}</div>
      <div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Medicamento</th><th>Indicación anterior</th><th class="num">Despachado</th><th class="num">Colocadas</th><th>Lote</th><th></th></tr></thead><tbody>
      ${o.items.map(it => { const g = givenCount(o, it); return `<tr><td>${esc(prod(it.pid).name)}</td><td class="muted">${esc([it.freq, it.ind].filter(Boolean).join(' · ') || '—')}</td><td class="num">${moServed(o) ? `${it.qty}${it.qty < (it.req ?? it.qty) ? ` <span class="small" style="color:var(--warn)">de ${it.req} · ${it.short ? 'faltante cerrado' : 'falta ' + moRemaining(o, it)}</span>` : ''}` : `${it.req ?? it.qty} solicitadas`}</td><td class="num">${moServed(o) ? `${g} de ${it.qty}` : '—'}</td><td class="mono muted">${esc(it.lots || '')}</td>
        <td>${moServed(o) && live && can('hosp.aplicar') && g < it.qty - (it.returned || 0) && !admIndications(a.id).some(i => i.status === 'activa' && i.pidProd === it.pid) ? `<button class="btn sm" data-act="giveDose" data-o="${o.id}" data-p="${it.pid}">Registrar aplicación</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>
      ${o.note ? `<div class="small muted" style="margin-top:6px">${esc(o.note)}</div>` : ''}${o.status === 'pendiente' ? '<div class="small" style="margin-top:6px;color:var(--warn)">Esperando que el almacén confirme el despacho.</div>' : o.status === 'parcial' ? '<div class="small" style="margin-top:6px;color:var(--warn)">Entrega parcial: el almacén mantiene pendiente lo que falta.</div>' : o.shortReason ? `<div class="small muted" style="margin-top:6px">Faltante cerrado por el almacén: ${esc(o.shortReason)}</div>` : ''}</div>`).join('') || '<div class="card empty">No se ha solicitado medicación.</div>'}
    <div class="card"><h2>Registro de administración <small>cada aplicación</small></h2>${kardex.length ? `<div class="tablewrap"><table><thead><tr><th>Fecha y hora</th><th>Medicamento</th><th>Dosis</th><th>Resultado</th><th>Enfermera</th><th>Registrada por</th></tr></thead><tbody>
      ${kardex.map(k => `<tr><td>${k.at}</td><td>${esc(prod(k.pidProd)?.name || k.med || '')}</td><td>${esc(k.dose || '')}</td><td>${k.skipped ? `<span class="pill warn">No aplicada</span> <span class="small">${esc(k.reason || '')}</span>` : '<span class="pill good">Aplicada</span>'}</td><td>${esc(k.nurse || '—')}</td><td class="muted">${esc(k.by)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Todavía no se ha registrado ninguna dosis.</div>'}</div></div>`;
  if (tab === 'indicaciones') body = indicationsTab(a);
  if (tab === 'examenes') body = `<div class="list">${exams.map(e => `<button class="row" data-act="openExam" data-id="${e.id}"><div class="grow"><div class="t">${esc(e.num)} · ${esc(e.tests.join(', '))}</div><div class="s">${fdate(e.date)} · ${esc(med(e.doc)?.name || 'Particular')}</div></div>${examFlagPill(e)}</button>`).join('') || '<div class="empty">Sin exámenes durante este ingreso.</div>'}</div>${prevExams.length ? `<div class="sec"><h3>Resultados previos al ingreso <small>últimos 30 días, de otras atenciones</small></h3><div class="list">${prevExams.map(e => `<button class="row" data-act="openExam" data-id="${e.id}"><div class="grow"><div class="t">${esc(e.num)} · ${esc(e.tests.join(', '))}</div><div class="s">${fdate(e.date)} · ${e.external ? 'Externo · ' + esc(e.external.lab) : esc(med(e.doc)?.name || 'Particular')}</div></div>${examFlagPill(e)}</button>`).join('')}</div></div>` : ''}`;
  const em = admArea(a) === 'emerg';
  return `${backBtn(areaRoute(a))}
  <div class="card" style="margin-bottom:16px;display:grid;gap:10px"><div class="between"><div class="hstack" style="gap:14px;min-width:0"><span class="avatar" style="width:56px;height:56px;font-size:16px">${a.bed}</span>
      <div style="min-width:0"><h1 style="font-size:24px;margin:0;letter-spacing:-.02em">${esc(p.name)}</h1><div class="muted small">${esc(a.num)} · ${live ? `Día ${dayNumber(a)} ${em ? 'en emergencia' : 'de hospitalización'}` : `Alta ${a.dischargedAt} · ${stayDays(a)} días`} · ingresó ${a.admittedAt} · ${esc(p.ci)} · ${ageTxt(p)}</div></div></div>
      <div class="actions">${canSee('pacientes') ? `<button class="btn" data-go="pacientes" data-param="${p.id}">Ver perfil del paciente</button>` : ''}${live && isClin() ? `<button class="btn primary" data-act="tplApply" data-id="${a.id}">Aplicar plantilla de órdenes</button>` : ''}${clin || role() === 'admin' ? `<button class="btn${!live && !a.epicrisis ? ' primary' : ''}" data-act="egresoOpen" data-id="${a.id}">${a.epicrisis ? 'Informe de egreso' : 'Hacer informe de egreso'}</button>` : ''}${live && clin && can('examen.pedir') ? `<button class="btn" data-act="newExam" data-pid="${p.id}" data-adm="${a.id}">Pedir exámenes</button>` : ''}${live && canHospWrite() ? `<button class="btn ${isClin() ? '' : 'primary'}" data-act="newMedOrder" data-id="${a.id}">Solicitar medicación</button>` : ''}${live && !evCanWrite() && role() === 'admin' ? `<button class="btn primary" data-act="evLinkHelp">Nueva evolución</button>` : ''}${live && evCanWrite() ? `<button class="btn primary" data-act="evNew" data-id="${a.id}">${(S.evolutions || []).some(x => x.admId === a.id && x.doc === evDoc() && x.status !== 'firmada') ? 'Continuar evolución (borrador)' : hasIngreso(a.id) ? 'Nueva evolución' : 'Valoración inicial'}</button><button class="btn" data-act="newNote" data-pid="${p.id}" data-adm="${a.id}" data-type="libre">Escribir nota libre</button>` : ''}${live && em && canAdmit() ? `<button class="btn" data-act="toHosp" data-id="${a.id}">Pasar a hospitalización</button>` : ''}${live && canDischarge(a) ? `<button class="btn danger" data-act="discharge" data-id="${a.id}">Dar de alta</button>` : ''}${!live && a.inv && canSee('atencion') ? `<button class="btn" data-act="openInvoice" data-id="${a.inv}">Ver cuenta</button>` : ''}</div></div>
    ${canSee('contabilidad') ? (c => c.units ? `<div class="small muted">Costo de medicación e insumos de este ingreso: <b style="color:var(--fg)">${fmt(c.total)}</b> · ${c.units} unidad(es) · detalle en el perfil del paciente › Consumo</div>` : '')(patientConsumption(p.id).list.find(e => e.key === a.id) || { units: 0 }) : ''}
    ${clin ? `<div class="small"><b>Diagnóstico:</b> ${esc(a.dx)} · <b>Tratante:</b> ${esc(med(a.doc)?.name)}${a.reason ? ` · <b>Motivo de ingreso:</b> ${esc(a.reason)}` : ''}</div>` : `<div class="banner">Vista de consulta para almacén: aquí ve lo que se pidió para este paciente. Las solicitudes se despachan en Inventario › Órdenes pendientes.</div>`}
    ${p.allergies.length ? `<div class="banner allergy"><b>⚠ Alergias:</b>&nbsp;${esc(p.allergies.join(', '))}</div>` : ''}</div>
  <div class="seg" role="group" aria-label="Secciones del ingreso" style="margin-bottom:14px">${[['indicaciones', `Indicaciones (${admIndications(a.id).filter(i => i.status === 'activa').length})${nurseDue([a.id]).length ? ' ⚠' : ''}`], ['evoluciones', `Evoluciones (${notes.length})`], ['medicacion', `Pedidos al almacén (${orders.length})`], ['examenes', `Exámenes (${exams.length})`]].filter(([k]) => clin || k === 'medicacion').map(([k, t]) => `<button data-act="hospTab" data-k="${k}" aria-pressed="${tab === k}">${t}</button>`).join('')}</div>
  ${body}`;
}
ACTIONS.hospTab = el => { UI.hospTab = el.dataset.k; render(); };

// ---------- Ingreso ----------
ACTIONS.admitNew = el => {
  UI.triFor = null;   // si viene del triaje, ACTIONS.triAdmit lo vuelve a fijar
  const area = el?.dataset?.area || (route === 'emergencias' ? 'emerg' : 'hosp'); const em = area === 'emerg';
  const busy = S.admissions.filter(a => a.status === 'ingresado'); const free = BEDS.filter(b => b.area === area && !busy.some(a => a.bed === b.id));
  if (!free.length) { toast(em ? 'No hay camas de emergencia libres' : 'No hay camas libres'); return; }
  UI.ppChanged = UI.ppChanged || {}; UI.ppChanged.adm = () => { const box = document.getElementById('ad-budbox'); if (box) box.innerHTML = admBudBox(); const band = document.getElementById('adm-patient-band'); if (band) band.innerHTML = patientBand(UI.pp?.adm?.pid, val('ad-b')); };
  ppReset('adm', { exclude: S.admissions.filter(a => a.status === 'ingresado').map(a => a.pid), pid: el?.dataset?.pid || null });
  openSheet(em ? 'Recibir paciente en emergencia' : 'Ingresar paciente', `<div id="adm-patient-band">${patientBand(UI.pp?.adm?.pid, el?.dataset?.bed || free[0]?.id)}</div><div>${sheetStep(1, 'Seleccione al paciente')}<div id="pp-adm" style="margin-top:8px">${patientPicker('adm')}</div></div>
    ${sheetStep(2, 'Datos del ingreso')}<div class="form">
    <div class="field"><label for="ad-b">Cama</label><select class="input" id="ad-b">${free.map(b => `<option value="${b.id}" ${b.id === el?.dataset?.bed ? 'selected' : ''}>${b.id} · ${b.type}</option>`).join('')}</select></div>
    <div class="field"><label for="ad-d">Médico tratante</label><select class="input" id="ad-d">${consultDocs().map(m => `<option value="${m.id}" ${m.id === myDoc() ? 'selected' : ''}>${esc(m.name)} · ${esc(m.esp)}</option>`).join('')}</select></div>
    <div class="field full"><label for="ad-x">${em ? 'Diagnóstico o impresión diagnóstica' : 'Diagnóstico de ingreso'}</label><input class="input" id="ad-x" placeholder="${em ? 'Ej. Dolor abdominal agudo en estudio' : 'Ej. Postoperatorio de herniorrafia'}"></div>
    <div class="field full"><label for="ad-r">Motivo de ingreso</label><input class="input" id="ad-r"></div>
    <div class="full">${sheetStep(3, 'Presupuesto vinculado (opcional)')}</div><div class="field full" id="ad-budbox">${admBudBox()}</div></div>`,
    `<span class="note" id="ad-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="admitSave">${em ? 'Recibir' : 'Ingresar'}</button>`);
};
// Presupuesto del ingreso (opcional): se elige al ingresar para que el alta descuente lo incluido en ese paquete
function admBudBox() {
  const pid = UI.pp?.adm?.pid; const bs = pid ? budgetCandidates(pid) : [];
  return `<label for="ad-bud">Presupuesto de esta hospitalización con cuenta registrada (opcional)</label><select class="input" id="ad-bud" ${bs.length ? '' : 'disabled'}><option value="">${pid ? (bs.length ? 'Sin presupuesto' : 'El paciente no tiene presupuestos con cuenta registrada') : 'Elija primero el paciente'}</option>${bs.map(b => budOption(b, '')).join('')}</select>`;
}
ACTIONS.admitSave = () => {
  const msg = document.getElementById('ad-msg'); const dx = val('ad-x').trim();
  const who = pickerCommit('adm'); if (!who.ok) { msg.textContent = who.msg; return; }
  if (!dx) { msg.textContent = 'Escriba el diagnóstico.'; return; }
  if (S.admissions.some(x => x.status === 'ingresado' && x.bed === val('ad-b'))) { msg.textContent = 'Esa cama acaba de ocuparse. Elija otra.'; return; }
  if (activeAdmission(who.pid)) { msg.textContent = 'Este paciente ya está ingresado.'; return; }
  const bud = val('ad-bud') && budgetCandidates(who.pid).some(b => b.id === val('ad-bud')) ? val('ad-bud') : null;
  const a = { id: uid('ad'), num: 'HOS-' + String(S.hosSeq++).padStart(4, '0'), pid: who.pid, bed: val('ad-b'), doc: val('ad-d'), dx, reason: val('ad-r').trim(), admittedAt: nowStamp(), status: 'ingresado', budgetId: bud };
  if (admArea(a) === 'emerg') a.emerg = true;   // llegó por emergencia (se conserva aunque pase a hospitalización)
  const tri = UI.triFor && (S.triage || []).find(t => t.id === UI.triFor && t.status === 'espera'); UI.triFor = null;
  if (tri) { tri.status = 'ingresado'; tri.admId = a.id; tri.attendedAt = nowStamp(); if (!tri.pid) tri.pid = a.pid; a.triage = { num: tri.num, color: tri.color, waited: minsSince(tri.arrivedAt) }; }
  S.admissions.push(a); log(a.emerg ? 'Paciente recibido en emergencia' : 'Paciente ingresado', `${a.num} · ${pat(a.pid).name} · cama ${a.bed}`); save(); closeSheet(); UI.hospTab = 'evoluciones'; go(areaRoute(a), a.id); toast(`${pat(a.pid).name} en ${a.bed}`);
};
// Emergencia → hospitalización: el mismo ingreso cambia de cama (se conserva todo lo pedido y escrito)
ACTIONS.toHosp = el => {
  const a = admOf(el.dataset.id); const busy = S.admissions.filter(x => x.status === 'ingresado');
  const free = BEDS.filter(b => b.area === 'hosp' && !busy.some(x => x.bed === b.id));
  if (!free.length) { toast('No hay camas de hospitalización libres'); return; }
  openSheet(`Pasar a hospitalización · ${pat(a.pid).name}`, `${patientBand(a.pid, a.bed)}<div class="small muted">Se conservan las evoluciones, la medicación y los exámenes de la emergencia.</div>
    <div class="field"><label for="th-b">Cama</label><select class="input" id="th-b">${free.map(b => `<option value="${b.id}">${b.id} · ${b.type}</option>`).join('')}</select></div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="toHospSave" data-id="${a.id}">Pasar a hospitalización</button>`);
};
ACTIONS.toHospSave = el => {
  const a = admOf(el.dataset.id); const bed = val('th-b');
  if (!a || a.status !== 'ingresado' || S.admissions.some(x => x.status === 'ingresado' && x.bed === bed)) { toast('No se pudo hacer el traslado. Intente de nuevo.'); closeSheet(); render(); return; }
  (a.moves = a.moves || []).push({ from: a.bed, to: bed, at: nowStamp(), by: actor() }); a.bed = bed;
  log('Traslado de emergencia a hospitalización', `${a.num} · ${pat(a.pid).name} · ${a.moves.at(-1).from} → ${bed}`); save(); closeSheet(); go('hospitalizacion', a.id); toast(`${pat(a.pid).name} pasó a ${bed}`);
};

// ---------- Solicitud de medicación (médico o residente) → la confirma el almacén ----------
// La dosis la define el producto (p. ej. "Ketorolaco 30 mg"); el médico solo indica cantidad y frecuencia.
const medProducts = (qx = UI.mo?.mode === 'qx') => qx ? S.products : S.products.filter(p => ['Medicamento', 'Insumo'].includes(p.cat));
// Producto con el que arranca cada línea de la solicitud: el primero con existencia. Antes era un producto de
// ejemplo fijo ('p8'), que deja de existir al cargar el inventario real y hacía que el botón no abriera nada.
const firstMedPid = (qx = UI.mo?.mode === 'qx') => { const l = medProducts(qx); return (l.find(p => usable(p) > 0) || l[0])?.id || null; };
const noMedProducts = () => toast('Todavía no hay medicamentos ni insumos en el inventario. Cárguelos primero en Inventario.');
const moAppt = () => UI.mo?.mode === 'qx' ? S.appts.find(a => a.id === UI.mo.apptId) : null;
const MED_FREQS = ['Aplicación única', 'Cada hora', ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => `Cada ${h} h`), 'Cada 24 h'];
// Cantidad sugerida para cubrir 24 h según la frecuencia
const freqQty = f => { if (f === 'Aplicación única') return 1; if (f === 'Cada hora') return 24; const h = +(f.match(/\d+/) || [0])[0]; return h ? Math.ceil(24 / h) : 1; };
const doseOf = p => (p.name.match(/\d[\d.,]*\s*(mg|g|mcg|µg|ml|UI|%)(\s*\/\s*\w+)?/i) || [''])[0] || p.unit || '';
const stepper = (id, value, act, data, min = 0, max = 999) => `<div class="stepper"><button class="btn sm" data-act="${act}" ${data} data-d="-1" aria-label="Restar uno" ${value <= min ? 'disabled' : ''}>−</button><output id="${id}" aria-live="polite">${value}</output><button class="btn sm" data-act="${act}" ${data} data-d="1" aria-label="Sumar uno" ${value >= max ? 'disabled' : ''}>+</button></div>`;
// Buscador de productos: se escribe parte del nombre y la lista muestra solo los que coinciden.
// Al entrar al campo se selecciona el texto (escribir lo reemplaza); si se sale sin elegir, vuelve el producto anterior.
const prodLabel = p => `${p.name} · ${p.unit || 'unidad'} · ${usable(p)} disp.`;
const prodList = (id, list) => `<datalist id="${id}">${list.map(p => `<option value="${esc(prodLabel(p))}">`).join('')}</datalist>`;
const prodPicker = (id, pid, listId, act, data = '') => { const p = prod(pid);
  return `<input class="input" id="${id}" list="${listId}" value="${p ? esc(prodLabel(p)) : ''}" data-prev="${p ? esc(prodLabel(p)) : ''}" placeholder="Buscar medicamento o insumo…" autocomplete="off" data-ch="${act}" data-fo="prodFocus" ${data} aria-label="Medicamento o insumo">`; };
// Producto elegido en el buscador (por el texto exacto de la lista, o por un nombre único que coincida)
const pickProd = (text, list) => { const t = text.trim().toLowerCase(); if (!t) return null;
  return list.find(p => prodLabel(p).toLowerCase() === t) || list.find(p => p.name.toLowerCase() === t) || (m => m.length === 1 ? m[0] : null)(list.filter(p => p.name.toLowerCase().includes(t))); };
ACTIONS.prodFocus = (el, e) => { if (e.type === 'focusin') { el.dataset.prev = el.value; setTimeout(() => el.select(), 0); } else if (!el.value.trim()) el.value = el.dataset.prev || ''; };
function medOrderForm() {
  const o = UI.mo; const qx = moAppt();
  return `${patientBand(qx ? qx.pid : admOf(o.admId)?.pid, qx ? 'Q-01' : admOf(o.admId)?.bed)}${sheetStep(1, '¿Qué necesita y cuántas unidades?')}<div class="small muted">${qx ? `Para la cirugía de ${esc(pat(qx.pid).name)} (${qx.time}). Al confirmarse el despacho, se descuenta del inventario; lo que no se use puede devolverse después.` : 'La solicitud se envía al almacén. Al confirmarse el despacho, se descuenta del inventario y queda lista para su aplicación.'}</div>
  ${prodList('mo-list', medProducts())}
  <div class="stack">${o.items.map((it, i) => { const p = prod(it.pid) || { unit: '' }; return `<div class="card" style="display:grid;gap:10px;padding:12px 14px">
    <div class="morow2">${prodPicker('mo-p' + i, it.pid, 'mo-list', 'moProd', `data-i="${i}"`)}
      <button class="btn ghost" data-act="moDel" data-i="${i}" aria-label="Quitar medicamento">✕</button></div>
    <div class="between" style="flex-wrap:wrap;gap:10px">
      <div class="hstack"><span class="small muted">Cantidad</span>${stepper('mo-q' + i, it.qty, 'moQty', `data-i="${i}"`, 1, 99)}<span class="small muted">${esc(p.unit || '')}${p.id && it.qty > usable(p) ? ` · <span style="color:var(--bad)">solo hay ${usable(p)} en almacén</span>` : ''}</span></div>
</div>
  </div>`; }).join('')}</div>
  ${qx ? '' : '<div class="small muted">Aquí solo se pide lo que debe salir del almacén. Cómo y cada cuánto se coloca lo indica el médico en la pestaña Indicaciones del paciente.</div>'}
  <button class="btn sm" style="justify-self:start" data-act="moAdd">+ Agregar medicamento</button>
  ${sheetStep(2, '¿Quién lo solicita?')}<div class="form">
    <div class="field"><label for="mo-dr">Médico que solicita <span style="color:var(--bad)">*</span></label><select class="input" id="mo-dr"><option value="">Seleccione el médico…</option>${docOptGroups(o.reqDoc)}</select></div>
    ${qx ? `<div class="field"><label for="mo-cx">Cirujano <span class="muted">· bloqueado</span></label><input class="input" id="mo-cx" value="${esc(med(qx.doc)?.name || '—')}" disabled title="Se toma de la cirugía programada"></div>
    <div class="field"><label for="mo-an">Anestesiólogo <span class="muted">· bloqueado</span></label><input class="input" id="mo-an" value="${esc(med(qx.anest)?.name || '—')}" disabled title="Se toma de la cirugía programada"></div>`
    : `<div class="field"><label for="mo-gd">Médico de guardia <span class="muted">· bloqueado</span></label><input class="input" id="mo-gd" value="${esc(dutyDocName())}" disabled title="Se toma de la guardia del día y no se puede modificar"></div>`}
    <div class="full">${sheetStep(3, 'Nota y prioridad')}</div><div class="field full"><label for="mo-n">Nota para el almacén (opcional)</label><input class="input" id="mo-n" value="${esc(o.note)}"></div></div>
  <label class="hstack small"><input type="checkbox" id="mo-u" ${o.urgent ? 'checked' : ''}> Urgente</label>`;
}
// Médico de guardia del día (según la pestaña de guardias de la agenda); queda fijo en la solicitud
const dutyDocName = () => med(dutyOf(dAt(0)).doc)?.name || 'Sin guardia asignada';
const moKeep = () => { const o = UI.mo; const n = document.getElementById('mo-n'); if (n) o.note = n.value; const dr = document.getElementById('mo-dr'); if (dr) o.reqDoc = dr.value; const u = document.getElementById('mo-u'); if (u) o.urgent = u.checked; };
const moRedraw = () => { moKeep(); refreshSheet(medOrderForm()); };
ACTIONS.newMedOrder = el => { const first = firstMedPid(false); if (!first) return noMedProducts();
  UI.mo = { admId: el.dataset.id, items: [{ pid: el.dataset.prod || '', qty: 1, freq: '' }], note: '', urgent: false, fOpen: null, reqDoc: myDoc() || '' };
  openSheet('Solicitar medicación', medOrderForm(), `<span class="note" id="mo-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="moSave">Enviar al almacén</button>`, { wide: true }); };
ACTIONS.moInd = el => { UI.mo.items[+el.dataset.i].ind = el.value; };
ACTIONS.moProd = el => { const p = pickProd(el.value, medProducts()); if (!p) { if (el.value.trim()) toast('Elija un producto de la lista'); el.value = el.dataset.prev || ''; return; } UI.mo.items[+el.dataset.i].pid = p.id; moRedraw(); };
ACTIONS.moQty = el => { const it = UI.mo.items[+el.dataset.i]; it.qty = Math.min(99, Math.max(1, it.qty + +el.dataset.d)); moRedraw(); };
ACTIONS.moFreqOpen = el => { const i = +el.dataset.i; UI.mo.fOpen = UI.mo.fOpen === i ? null : i; moRedraw(); };
ACTIONS.moFreq = el => { const it = UI.mo.items[+el.dataset.i]; it.freq = el.dataset.f; if (it.freq) it.qty = freqQty(it.freq); UI.mo.fOpen = null; moRedraw(); };
ACTIONS.moAdd = () => { moKeep(); if (!firstMedPid()) return noMedProducts(); UI.mo.items.push({ pid: '', qty: 1, freq: '' }); UI.mo.fOpen = null; moRedraw(); document.getElementById('mo-p' + (UI.mo.items.length - 1))?.focus(); };
ACTIONS.moDel = el => { UI.mo.items.splice(+el.dataset.i, 1); UI.mo.fOpen = null; moRedraw(); };
ACTIONS.moSave = () => {
  moKeep(); const o = UI.mo; const msg = document.getElementById('mo-msg');
  if (!o.items.length) { msg.textContent = 'Agregue al menos un medicamento.'; return; }
  const blank = o.items.findIndex(it => !prod(it.pid)); if (blank >= 0) { msg.textContent = 'Busque y elija el medicamento de cada línea, o quítela con ✕.'; document.getElementById('mo-p' + blank)?.focus(); return; }
  if (!med(o.reqDoc)) { msg.textContent = 'Elija de la lista el médico que solicita.'; document.getElementById('mo-dr')?.focus(); return; }
  const qx = moAppt();
  // La frecuencia es opcional: si no se indica, la orden se envía igual (se muestra "Sin frecuencia indicada")
  const a = qx ? null : admOf(o.admId); const pid = qx ? qx.pid : a.pid;
  const items = o.items.map(it => ({ pid: it.pid, qty: it.qty, req: it.qty, dose: doseOf(prod(it.pid)), freq: qx ? '' : it.freq, ind: (it.ind || '').trim() }));
  const mo = { id: uid('mo'), num: 'SM-' + String(S.moSeq++).padStart(4, '0'), kind: qx ? 'qx' : 'hosp', admId: a?.id || null, apptId: qx?.id || null, pid, by: myDoc() || actor(), reqDoc: med(o.reqDoc).name, reqDocId: o.reqDoc,
    ...(qx ? { surgeon: med(qx.doc)?.name || '', anesth: med(qx.anest)?.name || '' } : { dutyDoc: dutyOf(dAt(0)).doc || null, dutyName: dutyDocName() }), at: nowStamp(), urgent: o.urgent, note: o.note.trim(), status: 'pendiente', items };
  S.medOrders.push(mo); log(qx ? 'Solicitud de quirófano' : `Medicación solicitada (${AREAS[admArea(a)].name})`, `${mo.num} · ${pat(pid).name} · ${items.map(i => prod(i.pid).name + ' ×' + i.qty).join(', ')}`); save();
  closeSheet(); UI.hospTab = 'medicacion'; render(); toast(`${mo.num} enviada al almacén`);
};

window.moWho = o => `Solicitada por <b style="color:var(--fg)">${esc(o.reqDoc || med(o.by)?.name || o.by || '')}</b>${o.kind === 'qx' ? ` · Cirujano: ${esc(o.surgeon || '—')} · Anestesiólogo: ${esc(o.anesth || '—')}` : o.dutyName ? ` · Guardia: ${esc(o.dutyName)}` : ''}${o.reqDoc && (med(o.by)?.name || o.by) !== o.reqDoc ? ` · registrada por ${esc(med(o.by)?.name || o.by)}` : ''}`;

// ---------- Registrar una dosis colocada ----------
ACTIONS.giveDose = el => {
  const o = S.medOrders.find(x => x.id === el.dataset.o); const it = o.items.find(i => i.pid === el.dataset.p); const now = new Date();
  openSheet(`Registrar aplicación · ${prod(it.pid).name}`, `${patientBand(o.pid, admOf(o.admId)?.bed)}<div class="small muted">${esc(it.freq || '')}</div><div class="form">
    <div class="field"><label for="gd-t">Hora de aplicación</label><input class="input" type="time" id="gd-t" value="${now.toTimeString().slice(0, 5)}"></div>
    <div class="field"><label for="gd-n">Enfermera que la aplicó</label><select class="input" id="gd-n">${(S.nurses || []).map(n => `<option ${n === dutyOf(dAt(0)).nurse ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div></div>
    <div class="small muted">Quedan ${it.qty - givenCount(o, it)} de ${it.qty} despachadas.</div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="giveSave" data-o="${o.id}" data-p="${it.pid}">Registrar</button>`);
};
ACTIONS.giveSave = el => {
  const o = S.medOrders.find(x => x.id === el.dataset.o); const it = o?.items.find(i => i.pid === el.dataset.p); const adm = o && admOf(o.admId);
  // Se revalida al guardar: solicitud despachada, paciente ingresado y unidades disponibles
  if (!it || !moServed(o)) { toast('La solicitud no está despachada'); closeSheet(); render(); return; }
  if (adm && adm.status !== 'ingresado') { toast('El paciente ya fue dado de alta'); closeSheet(); render(); return; }
  if (givenCount(o, it) >= it.qty - (it.returned || 0)) { toast('Ya se registraron todas las unidades despachadas'); closeSheet(); render(); return; }
  S.mar.push({ id: uid('k'), admId: o.admId, orderId: o.id, pidProd: el.dataset.p, dose: it.dose || doseOf(prod(it.pid)), at: `${dAt(0)} ${val('gd-t')}`, by: actor(), nurse: val('gd-n') });
  log('Aplicación registrada', `${pat(o.pid).name} · ${prod(el.dataset.p).name}`); save(); closeSheet(); render(); toast('Aplicación registrada');
};

// ---------- Alta: libera la cama y genera la factura (días + medicación despachada) ----------
// Lo incluido en el paquete aprobado no se vuelve a cobrar: solo los días adicionales y, si se indica, la medicación aparte.
// Los excedentes se agregan a la cuenta del paquete (una sola cuenta por episodio); sin presupuesto se registra la estancia.
// Cuentas registradas del mismo paciente; se conserva también el presupuesto ya vinculado antes de migrar.
const budgetCandidates = (pid, admId = null) => S.budgets.filter(b => b.pid === pid && b.v2 && (b.status === 'facturado' || (admId && admOf(admId)?.budgetId === b.id)) && !S.admissions.some(x => x.id !== admId && x.budgetId === b.id));
const admBudgets = a => budgetCandidates(a.pid, a.id);
const budOption = (b, sel) => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>${esc(b.num)} · ${esc(b.proc)} · ${fdate(b.date)} · ${BUD_ST[budStatus(b)]?.[0] || b.status} · incluye ${b.days || 0} día(s)${b.uci ? ` y ${b.uci} de UCI` : ''}</option>`;
function dischargeItems(a, budgetId, chargeMeds) {
  const days = stayDays(a); const uci = bedOf(a.bed).type === 'UCI'; const sid = uci ? 'v33' : 'v8';
  const b = budgetId ? byId(S.budgets, budgetId) : null; const em = admArea(a) === 'emerg';
  const incl = b ? (uci ? b.uci || 0 : b.days || 0) : 0; const extraDays = em ? 0 : Math.max(0, days - incl);
  // Alta desde emergencia: se cobra la atención de emergencia (servicio "Atención 24h"), salvo que el paquete la incluya
  const items = em ? (!b && svc('v9') ? buildItems(['v9'], [], {}, {}) : []) : extraDays ? buildItems([sid], [], {}, { [sid]: extraDays }).map(x => b ? { ...x, name: `${uci ? 'Días adicionales de UCI' : 'Días adicionales de hospitalización'} · ${extraDays}` } : x) : [];
  const meds = {}; S.medOrders.filter(o => o.admId === a.id && moServed(o)).forEach(o => o.items.forEach(it => { const m = meds[it.pid] = meds[it.pid] || { qty: 0, cost: 0 }; m.qty += it.qty - (it.returned || 0); m.cost += it.cost || 0; }));
  const medLines = Object.entries(meds).filter(([, m]) => m.qty > 0).map(([pid, m]) => ({ pid, name: `${prod(pid).name} ×${m.qty}`, base: r2(m.cost * 1.3), adj: 0, price: r2(m.cost * 1.3), iva: false }));
  const withMeds = !b || chargeMeds; if (withMeds) items.push(...medLines);
  return { days, incl, extraDays, items, medLines, b, cost: withMeds ? r2(Object.values(meds).reduce((s, m) => s + m.cost, 0)) : 0 };
}
ACTIONS.discharge = el => {
  const a = admOf(el.dataset.id); if (a.status !== 'ingresado') { toast('Este paciente ya fue dado de alta'); return; } if (!canDischarge(a)) return;
  UI.dc = { id: a.id, budgetId: a.budgetId || '', meds: false, confirm: false, ret: true };   // solo el presupuesto vinculado al ingreso; ninguno por defecto
  openSheet(`Dar de alta · ${pat(a.pid).name}`, dischargeBody(), `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="dischargeSave" data-id="${a.id}">Dar de alta</button>`, { wide: true });
};
function dischargeBody() {
  const a = admOf(UI.dc.id); const bs = admBudgets(a); const d = dischargeItems(a, UI.dc.budgetId, UI.dc.meds); const t = totalsOf(d.items, 0);
  const pend = S.medOrders.filter(o => o.admId === a.id && ['pendiente', 'parcial'].includes(o.status));
  return `${patientBand(a.pid, a.bed)}${a.epicrisis ? `<div class="banner"><span>Informe de egreso listo (${esc(a.epicrisis.cond)}). <button class="btn sm" data-act="egresoOpen" data-id="${a.id}">Revisar</button></span></div>` : `<div class="banner warn"><span><b>Falta el informe de egreso (epicrisis).</b> Puede hacerlo ahora o después del alta. <button class="btn sm" data-act="egresoOpen" data-id="${a.id}">Hacer informe de egreso</button></span></div>`}<div class="small muted">${esc(a.num)} · ${d.days} día(s) en ${a.bed}${a.moves?.length ? ` (llegó por ${a.moves[0].from})` : ''}</div>
  <div class="field"><label for="dc-b">Presupuesto de esta hospitalización</label><select class="input" id="dc-b" data-ch="dcBudget"><option value="">Sin presupuesto: cobrar la estancia completa</option>${bs.map(b => budOption(b, UI.dc.budgetId)).join('')}</select>
    <div class="small muted">${a.budgetId ? 'Vinculado al ingresar al paciente.' : 'Este ingreso no se vinculó a ningún presupuesto al ingresar.'}</div></div>
  ${UI.dc.budgetId && UI.dc.budgetId !== a.budgetId ? `<label class="hstack small" style="color:var(--warn)"><input type="checkbox" id="dc-ok" data-ch="dcConfirm" ${UI.dc.confirm ? 'checked' : ''}> Confirmo que el presupuesto ${esc(byId(S.budgets, UI.dc.budgetId)?.num || '')} (${esc(byId(S.budgets, UI.dc.budgetId)?.proc || '')}) corresponde a esta hospitalización</label>` : ''}
  ${d.b ? `<div class="banner">El paquete ${d.b.num} incluye ${d.incl} día(s)${d.b.material ? ' y el material, medicamentos e insumos' : ''}. Solo se cobran los excedentes${d.b.inv ? `, que se agregan a la cuenta ${esc(byId(S.invoices, d.b.inv)?.num || '')}` : ', que se agregan a la cuenta del paquete'}.</div>
    ${d.medLines.length ? `<label class="hstack small"><input type="checkbox" id="dc-m" data-ch="dcMeds" ${UI.dc.meds ? 'checked' : ''}> Cobrar aparte la medicación despachada (${fmt(d.medLines.reduce((s, x) => s + x.price, 0))})</label>` : ''}` : ''}
  <div class="tablewrap"><table><thead><tr><th>Concepto</th><th class="num">Monto</th></tr></thead><tbody>${d.items.map(x => `<tr><td>${esc(x.name)}</td><td class="num">${fmt(x.price)}</td></tr>`).join('') || '<tr><td colspan="2" class="empty">Sin cargos adicionales: todo está incluido en el paquete.</td></tr>'}</tbody><tfoot><tr><td>${d.b ? 'Excedentes a cobrar' : 'Total de la estancia'}</td><td class="num">${fmt(t.total)}</td></tr></tfoot></table></div>
  ${pend.length ? `<div class="banner warn">${pend.length} solicitud(es) de medicación con entregas pendientes se cerrarán: lo no entregado se cancela.</div>` : ''}
  ${(u => u.length ? `<label class="hstack small"><input type="checkbox" id="dc-ret" data-ch="dcRet" ${UI.dc.ret ? 'checked' : ''}> Devolver al almacén lo despachado y no aplicado: ${u.map(x => `${esc(prod(x.it.pid)?.name || '?')} ×${x.n}`).join(', ')}</label>` : '')(unusedOfAdm(a.id))}
  <div class="small muted">La medicación ya se descontó del inventario al despacharse. La factura fiscal es opcional y se emite desde Contabilidad › Cobros.</div>
  ${dcExonBlock(a, d, t)}`;
}
// Exoneración al dar de alta (solo Administración): la cuenta se crea igual, con todo lo que costó la atención, y queda con saldo cero
function dcExonBlock(a, d, t) {
  if (!can('*')) return '';
  const pk = d.b?.inv ? byId(S.invoices, d.b.inv) : null;
  const total = r2((pk && invOpen(pk) ? invDue(pk) : 0) + (t.total || 0));
  if (!total) return '';
  return `<div class="card" style="display:grid;gap:8px;padding:12px 14px"><label class="hstack"><input type="checkbox" id="dc-ex" data-ch="dcExon" ${UI.dc.exon ? 'checked' : ''}> <b>Exonerar al paciente de los gastos</b></label>
    <div class="small muted">La cuenta se registra igual, con todo lo que representó la atención (${fmt(total)}${pk ? `, incluido el paquete ${esc(d.b.num)}` : ''}), pero el paciente no paga: el saldo queda en cero y no entra dinero en caja.</div>
    ${UI.dc.exon ? exonReasonField('dc') : ''}</div>`;
}
const dcKeep = () => { const r = document.getElementById('dc-r'); if (r) UI.dc.exonReason = r.value; };
ACTIONS.dcExon = el => { dcKeep(); UI.dc.exon = el.checked; refreshSheet(dischargeBody()); const r = document.getElementById('dc-r'); if (r) { r.value = UI.dc.exonReason || ''; r.focus(); } };
const dcRedraw = () => { dcKeep(); refreshSheet(dischargeBody()); const r = document.getElementById('dc-r'); if (r) r.value = UI.dc.exonReason || ''; };
ACTIONS.dcBudget = el => { UI.dc.budgetId = el.value; UI.dc.confirm = false; dcRedraw(); };
ACTIONS.dcConfirm = el => { UI.dc.confirm = el.checked; };
ACTIONS.dcMeds = el => { UI.dc.meds = el.checked; dcRedraw(); };
ACTIONS.dcRet = el => { UI.dc.ret = el.checked; };
ACTIONS.dischargeSave = el => {
  const a = admOf(el.dataset.id); if (!a || a.status !== 'ingresado') { toast('Este paciente ya fue dado de alta'); closeSheet(); render(); return; } if (!canDischarge(a)) return;
  if (UI.dc.budgetId && UI.dc.budgetId !== a.budgetId && !UI.dc.confirm) { toast('Confirme que el presupuesto elegido corresponde a esta hospitalización'); return; }
  dcKeep(); const exon = can('*') && UI.dc.exon && document.getElementById('dc-ex') ? (UI.dc.exonReason || '').trim() : null;
  if (exon === '') { toast('Escriba el motivo de la exoneración'); document.getElementById('dc-r')?.focus(); return; }
  // Lo no aplicado vuelve al almacén antes de calcular la cuenta (así no se cobra ni cuenta como consumo)
  if (UI.dc.ret) unusedOfAdm(a.id).forEach(x => returnUnits(x.o, x.it, x.n, `Devolución al alta · ${pat(a.pid).name}`));
  const d = dischargeItems(a, UI.dc.budgetId, UI.dc.meds); let inv = null;
  if (d.b) {
    if (a.budgetId !== d.b.id) log('Presupuesto asociado manualmente al alta', `${a.num} · ${d.b.num} · ${d.b.proc}`);
    a.budgetId = d.b.id;
    if (d.items.length) {
      if (!d.b.inv) chargeFromBudget(d.b, false);
      inv = byId(S.invoices, d.b.inv);
      inv.items.push(...d.items.map(x => ({ ...x, name: `Excedente al alta · ${x.name}` }))); inv.cost = r2((inv.cost || 0) + d.cost);
      inv.status = invDue(inv) <= 0.01 ? 'pagada' : invPaid(inv) > 0 ? 'parcial' : 'pendiente';
    }
  } else if (d.items.length) {
    const n = chargeNumber(false);   // la factura fiscal se emite después solo si se pide
    inv = { id: uid('f'), ...n, pid: a.pid, doc: a.doc, date: dAt(0), disc: 0, proc: `${admArea(a) === 'emerg' ? 'Emergencia' : 'Hospitalización'} ${a.num} (${d.days} días) · ${a.dx}`, items: d.items, cost: d.cost, payments: [], status: 'pendiente' };
    S.invoices.unshift(inv);
  }
  S.medOrders.filter(o => o.admId === a.id && o.status === 'pendiente').forEach(o => { o.status = 'rechazada'; o.reason = 'Cancelada por alta del paciente'; });
  S.medOrders.filter(o => o.admId === a.id && o.status === 'parcial').forEach(o => closeShortfall(o.id, 'Cerrada por alta del paciente'));
  a.status = 'alta'; a.dischargedAt = nowStamp(); a.inv = inv?.id || d.b?.inv || null;
  log('Alta de hospitalización', `${a.num} · ${pat(a.pid).name}${inv ? ' · cuenta ' + inv.num : ' · sin cargos adicionales'}`); save();
  // Exoneración: la cuenta (la del alta o la del paquete) queda registrada con todo su monto y saldo cero
  const target = a.inv ? byId(S.invoices, a.inv) : null; let exonMsg = '';
  if (exon && target && invOpen(target)) { const x = exonerate(target.id, exon); exonMsg = x.ok ? ` · gastos exonerados (${fmt(x.inv.exon.usd)})` : ` · no se pudo exonerar: ${x.msg}`; }
  closeSheet(); render();
  toast((inv ? `Alta registrada · ${d.b ? 'excedentes agregados a' : 'cuenta'} ${inv.num}` : 'Alta registrada · sin cargos adicionales') + exonMsg);
};

// ---------- Inventario → pestaña "Órdenes pendientes" (almacén y administrador) ----------
// El almacenista ajusta con − y + la cantidad que realmente sale (p. ej. piden 4 y solo hay 2).
// Nunca más de lo solicitado ni de lo que hay hoy en almacén (la existencia puede bajar por otro despacho)
const dispQty = (o, it) => { UI.disp = UI.disp || {}; const k = o.id + ':' + it.pid; const max = Math.min(moRemaining(o, it), usable(prod(it.pid)));
  UI.disp[k] = UI.disp[k] == null ? max : Math.min(UI.disp[k], max); return UI.disp[k]; };
function medOrdersTab() {
  const pend = pendingMedOrders().sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || a.at.localeCompare(b.at));
  const today = S.medOrders.filter(o => o.status === 'despachada' && (o.dispatchedAt || '').startsWith(dAt(0)));
  const card = o => { const a = admOf(o.admId); const open = ['pendiente', 'parcial'].includes(o.status); const again = o.status === 'parcial';
    const short = open && o.items.some(it => dispQty(o, it) < moRemaining(o, it)); const none = open && o.items.every(it => dispQty(o, it) === 0);
    return `<div class="card"><div class="between"><div><b>${esc(o.num)} · ${esc(pat(o.pid).name)}</b> ${o.urgent ? '<span class="pill bad">Urgente</span>' : ''}<div class="small muted">${o.kind === 'extra' ? `<span class="pill warn">Extraordinaria · ${esc(o.motive)}</span>${a ? ` Cama ${a.bed}` : ''}` : o.kind === 'qx' ? `<span class="pill bad">Quirófano</span> ${esc(S.appts.find(x => x.id === o.apptId)?.proc || '')} · ${S.appts.find(x => x.id === o.apptId)?.time || ''}` : `Cama ${a?.bed || '—'}`} · ${moWho(o)} · ${o.at}</div></div>${moPill(o)}</div>
      <div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Medicamento</th><th>Frecuencia</th><th class="num">Solicitado</th>${again ? '<th class="num">Ya entregado</th>' : ''}<th class="num">En almacén</th><th class="num">${open ? 'Sale ahora' : 'Despachado'}</th><th>Lote</th></tr></thead><tbody>
      ${o.items.map(it => { const p = prod(it.pid); const req = it.req ?? it.qty; const max = Math.min(moRemaining(o, it), usable(p)); const q = open ? dispQty(o, it) : it.qty;
        return `<tr><td>${esc(p.name)}</td><td class="muted">${esc([it.freq || (o.kind === 'qx' ? 'Uso en cirugía' : ''), it.ind].filter(Boolean).join(' · '))}</td><td class="num">${req}</td>${again ? `<td class="num">${it.qty}</td>` : ''}<td class="num"><span class="pill ${usable(p) >= moRemaining(o, it) ? 'good' : 'bad'}">${usable(p)}</span></td>
        <td class="num">${open ? stepper(`dq-${o.id}-${it.pid}`, q, 'moDq', `data-o="${o.id}" data-p="${it.pid}"`, 0, max) : `<b>${q}</b>${q < req ? ` <span class="small muted">de ${req}</span>` : ''}`}</td>
        <td class="mono muted">${open ? esc(fefo(p)[0]?.num || '—') : esc(it.lots || '—')}</td></tr>`; }).join('')}</tbody></table></div>
      ${o.note ? `<div class="small muted" style="margin-top:6px">${esc(o.note)}</div>` : ''}
      ${open ? `<div class="between" style="margin-top:10px;gap:10px;flex-wrap:wrap"><span class="small" style="color:${short ? 'var(--warn)' : 'var(--fg2)'}">${none ? 'No hay cantidades para despachar.' : short ? 'Despacho parcial: hospitalización verá cuánto salió de cada medicamento.' : 'Al despachar se descuenta del inventario (primero el lote que vence antes).'}</span>
        <div class="hstack">${again ? `<button class="btn sm" data-act="moCloseShort" data-id="${o.id}">Cerrar faltante</button>` : `<button class="btn sm danger" data-act="moReject" data-id="${o.id}">Rechazar</button>`}<button class="btn sm primary" data-act="moDispatch" data-id="${o.id}" ${none ? 'disabled' : ''}>${short ? 'Confirmar despacho parcial' : 'Confirmar despacho'}</button></div></div>`
      : `<div class="small muted" style="margin-top:6px">Despachada ${o.dispatchedAt} por ${esc(o.dispatchedBy)}</div>`}</div>`; };
  return `<div class="stack">${pend.map(card).join('') || '<div class="card empty">No hay solicitudes de medicación pendientes.</div>'}</div>
    ${today.length ? `<div class="sec"><h3>Despachadas hoy</h3><div class="stack">${today.map(card).join('')}</div></div>` : ''}
    ${typeof extraHistory === 'function' ? extraHistory() : ''}`;
}
window.moPill = o => o.status === 'parcial' ? `<span class="pill warn">Parcial · faltan ${o.items.reduce((s, it) => s + moRemaining(o, it), 0)}</span>` : o.status === 'despachada' && o.partial ? '<span class="pill">Entregada con faltante cerrado</span>' : `<span class="pill ${MO_ST[o.status][1]}">${MO_ST[o.status][0]}</span>`;
ACTIONS.moDq = el => { const o = S.medOrders.find(x => x.id === el.dataset.o); const it = o.items.find(i => i.pid === el.dataset.p);
  const k = o.id + ':' + it.pid; const max = Math.min(it.req ?? it.qty, usable(prod(it.pid)));
  const cur = dispQty(o, it); UI.disp[k] = Math.min(max, Math.max(0, cur + +el.dataset.d)); render(); };
ACTIONS.moDispatch = el => {
  const o = S.medOrders.find(x => x.id === el.dataset.id); const qty = Object.fromEntries(o.items.map(it => [it.pid, dispQty(o, it)]));
  const r = dispatchMedOrder(el.dataset.id, qty); if (!r.ok) { toast(r.msg || 'No hay existencia suficiente'); return; }
  o.items.forEach(it => delete UI.disp[o.id + ':' + it.pid]); render();
  toast(r.left ? 'Entrega parcial registrada · lo que falta sigue pendiente' : 'Despacho completo · inventario actualizado');
};
ACTIONS.moCloseShort = el => openSheet('Cerrar faltante', `<div class="small muted">No se entregará lo que falta de esta solicitud. Hospitalización o Quirófano verán el motivo.</div><div class="field"><label for="cs-r">Motivo</label><input class="input" id="cs-r" placeholder="Ej. sin existencia; se indicó sustituto"></div>`,
  `<span class="note" id="cs-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="moCloseShortSave" data-id="${el.dataset.id}">Cerrar faltante</button>`);
ACTIONS.moCloseShortSave = el => { const r = val('cs-r').trim(); if (!r) { document.getElementById('cs-msg').textContent = 'Indique el motivo.'; return; } if (closeShortfall(el.dataset.id, r)) toast('Faltante cerrado'); closeSheet(); render(); };
ACTIONS.moReject = el => openSheet('Rechazar solicitud', `<div class="field"><label for="rj-r">Motivo</label><input class="input" id="rj-r" placeholder="Ej. sin existencia, se sustituye por…"></div>`,
  `<button class="btn" data-act="close">Cancelar</button><button class="btn danger" data-act="moRejectSave" data-id="${el.dataset.id}">Rechazar</button>`);
ACTIONS.moRejectSave = el => { const o = S.medOrders.find(x => x.id === el.dataset.id); o.status = 'rechazada'; o.reason = val('rj-r').trim() || 'Rechazada por almacén'; log('Medicación rechazada', `${o.num} · ${o.reason}`); save(); closeSheet(); render(); toast('Solicitud rechazada'); };
