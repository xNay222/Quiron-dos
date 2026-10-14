// Indicaciones médicas de medicación (hospitalización y emergencias).
// El pedido al almacén dice QUÉ y CUÁNTO sale; la indicación dice qué se le coloca al paciente, cuánto y cada cuánto.
// El médico o residente la deja en el ingreso; enfermería la ve en la cama con la hora de la próxima dosis y registra cada
// aplicación (o por qué no se aplicó). Cada aplicación descuenta de lo que el almacén ya entregó para ese paciente.

const IND_FREQS = [...MED_FREQS, 'Según necesidad'];
// Horas entre dosis: 0 = una sola vez · null = según necesidad (sin horario)
const freqHours = f => f === 'Aplicación única' ? 0 : f === 'Según necesidad' ? null : f === 'Cada hora' ? 1 : (+(String(f).match(/\d+/) || [0])[0] || null);
const stamp2date = s => new Date(String(s).replace(' ', 'T'));
const hhmm = d => d.toTimeString().slice(0, 5);
const whenTxt = d => (iso(d) === dAt(0) ? '' : iso(d) === dAt(1) ? 'mañana ' : fdate(iso(d)) + ' ') + hhmm(d);
const indEvents = ind => (S.mar || []).filter(k => k.indId === ind.id).sort((a, b) => a.at.localeCompare(b.at));
const admIndications = admId => (S.indications || []).filter(i => i.admId === admId);
// Unidades que el almacén ya entregó para este ingreso y que aún no se han colocado (de un producto)
const floorUnits = (admId, pidProd) => (S.medOrders || []).filter(o => o.admId === admId && moServed(o)).reduce((s, o) => s + o.items.filter(it => it.pid === pidProd).reduce((t, it) => t + Math.max(0, it.qty - (it.returned || 0) - givenCount(o, it)), 0), 0);

// Estado de la indicación: próxima dosis, si está atrasada, si ya terminó
function indState(ind) {
  if (ind.status !== 'activa') return { k: 'off', cls: '', t: ind.status === 'suspendida' ? 'Suspendida' : 'Terminada' };
  const h = freqHours(ind.freq); const ev = indEvents(ind); const now = new Date();
  if (h === null) return { k: 'prn', cls: 'info', t: 'Según necesidad' };
  if (h === 0 && ev.length) return { k: 'done', cls: '', t: 'Dosis única aplicada' };
  const next = h === 0 || !ev.length ? stamp2date(ind.start || ind.at) : new Date(stamp2date(ev.at(-1).at).getTime() + h * 3600e3);
  if (ind.days && next > new Date(stamp2date(ind.start || ind.at).getTime() + ind.days * DAY)) return { k: 'done', cls: '', t: `Tratamiento completo (${ind.days} día${ind.days > 1 ? 's' : ''})` };
  const min = (next - now) / 60000;
  if (min < -15) return { k: 'late', cls: 'bad', t: `Atrasada · tocaba ${whenTxt(next)}`, next };
  if (min <= 60) return { k: 'soon', cls: 'warn', t: `Toca ${min <= 0 ? 'ahora' : 'a las ' + hhmm(next)}`, next };
  return { k: 'ok', cls: 'good', t: `Próxima ${whenTxt(next)}`, next };
}
// Dosis que requieren atención de enfermería (atrasadas o que tocan en menos de una hora)
const nurseDue = (admIds = null) => (S.indications || []).filter(i => i.status === 'activa' && (!admIds || admIds.includes(i.admId)) && admOf(i.admId)?.status === 'ingresado').filter(i => ['late', 'soon'].includes(indState(i).k));

// ---------- Pestaña "Indicaciones" del ingreso ----------
function indicationsTab(a) {
  const live = a.status === 'ingresado'; const all = admIndications(a.id);
  const active = all.filter(i => i.status === 'activa' && !['done'].includes(indState(i).k)); const past = all.filter(i => !active.includes(i));
  const last = S.hc.filter(n => n.admId === a.id && n.status === 'firmada' && (n.plan || n.indicaciones)).sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time))[0];
  const card = i => { const st = indState(i); const ev = indEvents(i); const given = ev.filter(k => !k.skipped).length; const floor = i.pidProd ? floorUnits(a.id, i.pidProd) : null;
    return `<div class="card" style="display:grid;gap:8px"><div class="between" style="gap:10px;flex-wrap:wrap"><div><b style="font-size:16px">${esc(i.med)}</b> ${i.dose ? `<span class="muted">· ${esc(i.dose)}</span>` : ''}
      <div class="small">${esc(i.freq)}${i.days ? ` · por ${i.days} día${i.days > 1 ? 's' : ''}` : freqHours(i.freq) ? ' · hasta nuevo aviso' : ''}${i.note ? ' · ' + esc(i.note) : ''}</div>
      <div class="small muted">Indicada por ${esc(med(i.doc)?.name || i.byName || '')} · ${i.at}${i.status === 'suspendida' ? ` · suspendida ${i.suspendedAt} por ${esc(i.suspendedBy)}` : ''} · ${given} aplicada${given === 1 ? '' : 's'}${ev.length > given ? ` · ${ev.length - given} no aplicada${ev.length - given === 1 ? '' : 's'}` : ''}</div></div>
      <span class="pill ${st.cls}">${st.t}</span></div>
      ${i.status === 'activa' && floor === 0 ? `<div class="small" style="color:var(--warn)">No hay unidades entregadas por el almacén para este paciente.${live && canHospWrite() ? ` <button class="btn sm" data-act="newMedOrder" data-id="${a.id}" data-prod="${i.pidProd}">Pedir al almacén</button>` : ''}</div>` : floor ? `<div class="small muted">En piso: ${floor} unidad${floor === 1 ? '' : 'es'} entregada${floor === 1 ? '' : 's'} por el almacén</div>` : ''}
      ${live && i.status === 'activa' ? `<div class="hstack" style="justify-content:flex-end">${isClin() ? `<button class="btn sm" data-act="indStop" data-id="${i.id}">Suspender</button>` : ''}${can('hosp.aplicar') && st.k !== 'done' ? `<button class="btn sm primary" data-act="indGive" data-id="${i.id}">Registrar aplicación</button>` : ''}</div>` : ''}</div>`; };
  return `<div class="between" style="margin-bottom:10px;gap:10px;flex-wrap:wrap"><span class="small muted">Lo que el médico indicó colocar a este paciente. Enfermería registra cada aplicación aquí.</span>${live && isClin() ? `<button class="btn primary sm" data-act="indNew" data-id="${a.id}">Nueva indicación</button>` : ''}</div>
  ${last ? `<div class="card" style="margin-bottom:12px"><div class="small muted">Indicaciones generales · ${NOTE_TYPES[last.type]} del ${fdate(last.date)} ${last.time} · ${esc(med(last.doc)?.name || '')}</div><div style="white-space:pre-wrap">${esc([last.plan, last.indicaciones].filter(Boolean).join('\n'))}</div></div>` : ''}
  <div class="stack">${active.map(card).join('') || `<div class="card empty">${isClin() ? 'No hay indicaciones de medicación. Use "Nueva indicación".' : 'El médico aún no ha dejado indicaciones de medicación.'}</div>`}</div>
  ${past.length ? `<details class="sec"><summary class="small muted" style="cursor:pointer">Suspendidas o terminadas (${past.length})</summary><div class="stack" style="margin-top:8px">${past.map(card).join('')}</div></details>` : ''}`;
}
// Resumen en la tarjeta de la cama
const bedIndications = a => { const l = admIndications(a.id).filter(i => i.status === 'activa').map(i => ({ i, st: indState(i) })).filter(x => x.st.k !== 'done');
  if (!l.length) return ''; const order = { late: 0, soon: 1, ok: 2, prn: 3 }; l.sort((x, y) => order[x.st.k] - order[y.st.k] || (x.st.next || 0) - (y.st.next || 0));
  return `<div style="display:grid;gap:4px;margin-top:8px">${l.slice(0, 3).map(({ i, st }) => `<div class="bed-dose ${st.k === 'late' ? 'late' : ''}"><span>${esc(i.med)}</span><span class="pill ${st.cls}" style="flex:none">${st.k === 'ok' ? hhmm(st.next) : st.k === 'prn' ? 'SN' : st.t.replace('Atrasada · tocaba ', 'Atrasada ')}</span></div>`).join('')}${l.length > 3 ? `<div class="small muted">+${l.length - 3} indicación(es) más</div>` : ''}</div>`; };

// ---------- Nueva indicación (médico o residente) ----------
ACTIONS.indNew = el => { if (!isClin()) return; const a = admOf(el.dataset.id);
  UI.ind = { admId: a.id, pidProd: '', med: '', dose: '', freq: '', days: '', note: '', start: hhmm(new Date()) };
  openSheet(`Nueva indicación · ${pat(a.pid).name}`, indForm(), `<span class="note" id="ind-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="indSave">Guardar indicación</button>`, { wide: true }); };
function indForm() { const o = UI.ind; const p = pat(admOf(o.admId).pid);
  return `${patientBand(p.id, admOf(o.admId).bed)}${sheetStep(1, 'Medicamento, dosis y vía')}
  <div class="form">
    <div class="field full"><label for="ind-p">Medicamento <span style="color:var(--bad)">*</span></label>${prodList('ind-list', medProducts(false))}<input class="input" id="ind-p" list="ind-list" value="${esc(o.med)}" placeholder="Busque en el inventario o escriba el nombre" autocomplete="off" data-ch="indProd"></div>
    <div class="field"><label for="ind-d">Dosis y vía</label><input class="input" id="ind-d" value="${esc(o.dose)}" placeholder="Ej. 30 mg endovenoso"></div>
    <div class="full">${sheetStep(2, 'Horario y duración')}</div><div class="field"><label for="ind-s">Primera dosis a las</label><input class="input" type="time" id="ind-s" value="${o.start}"></div>
    <div class="field"><label for="ind-days">Duración (días)</label><input class="input" type="number" min="1" id="ind-days" value="${esc(o.days)}" placeholder="Vacío = hasta nuevo aviso"></div>
    <div class="field"><label for="ind-n">Observación (opcional)</label><input class="input" id="ind-n" value="${esc(o.note)}" placeholder="Ej. diluir en 100 ml, pasar en 30 min"></div></div>
  <div>${sheetStep(3, 'Frecuencia <span style="color:var(--bad)">*</span>')}<div class="freqpanel" role="group" aria-label="Frecuencia" style="margin-top:6px">${IND_FREQS.map(f => `<button class="btn sm ${f === o.freq ? 'primary' : ''}" data-act="indFreq" data-f="${f}" aria-pressed="${f === o.freq}">${f}</button>`).join('')}</div></div>
  ${o.pidProd ? `<div class="small muted">En piso para este paciente: ${floorUnits(o.admId, o.pidProd)} unidad(es) entregadas por el almacén.</div>` : o.med ? '<div class="small muted">No está en el inventario: se registra la indicación, pero no se descuenta del almacén.</div>' : ''}`; }
const indKeep = () => { const o = UI.ind; o.med = val('ind-p').trim(); o.dose = val('ind-d').trim(); o.start = val('ind-s'); o.days = val('ind-days'); o.note = val('ind-n').trim(); };
ACTIONS.indProd = el => { indKeep(); const p = pickProd(el.value, medProducts(false)); UI.ind.pidProd = p?.id || ''; if (p) UI.ind.med = p.name; if (p && !UI.ind.dose) UI.ind.dose = doseOf(p); refreshSheet(indForm()); };
ACTIONS.indFreq = el => { indKeep(); UI.ind.freq = el.dataset.f; refreshSheet(indForm()); };
ACTIONS.indSave = () => {
  indKeep(); const o = UI.ind; const msg = document.getElementById('ind-msg'); const a = admOf(o.admId);
  if (!o.med) { msg.textContent = 'Indique el medicamento.'; return; } if (!o.freq) { msg.textContent = 'Elija la frecuencia.'; return; }
  const days = Math.round(+o.days) || null; const start = `${dAt(0)} ${o.start || hhmm(new Date())}`;
  S.indications = S.indications || [];
  S.indications.push({ id: uid('in'), admId: a.id, pid: a.pid, pidProd: o.pidProd || null, med: o.med, dose: o.dose, freq: o.freq, days, note: o.note, doc: myDoc(), byName: actor(), at: nowStamp(), start, status: 'activa' });
  log('Indicación médica', `${pat(a.pid).name} · ${o.med} ${o.dose} · ${o.freq}${days ? ` · ${days} días` : ''}`); save(); closeSheet(); UI.hospTab = 'indicaciones'; render(); toast('Indicación guardada: enfermería ya la ve en la cama');
};
ACTIONS.indStop = el => { const i = (S.indications || []).find(x => x.id === el.dataset.id);
  openSheet(`Suspender ${i.med}`, `${patientBand(i.pid, admOf(i.admId)?.bed)}<div class="field"><label for="is-r">Motivo (opcional)</label><input class="input" id="is-r" placeholder="Ej. cambio de antibiótico, alta próxima"></div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn danger" data-act="indStopSave" data-id="${i.id}">Suspender</button>`); };
ACTIONS.indStopSave = el => { if (!isClin()) return; const i = S.indications.find(x => x.id === el.dataset.id); i.status = 'suspendida'; i.suspendedAt = nowStamp(); i.suspendedBy = actor(); i.stopReason = val('is-r').trim();
  log('Indicación suspendida', `${pat(i.pid).name} · ${i.med}${i.stopReason ? ' · ' + i.stopReason : ''}`); save(); closeSheet(); render(); toast('Indicación suspendida'); };

// ---------- Registrar la aplicación (enfermería) ----------
ACTIONS.indGive = el => { const i = S.indications.find(x => x.id === el.dataset.id); const st = indState(i); UI.ig = { id: i.id, ok: true };
  openSheet(`Aplicación · ${i.med}`, igBody(i, st), `<span class="note" id="ig-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="indGiveSave" data-id="${i.id}">Registrar</button>`); };
function igBody(i, st = indState(i)) { const o = UI.ig;
  return `${patientBand(i.pid, admOf(i.admId)?.bed)}<div class="small muted">${esc([i.dose, i.freq, i.note].filter(Boolean).join(' · '))} · <span class="pill ${st.cls}">${st.t}</span></div>
  <div class="seg" role="group" aria-label="Resultado"><button data-act="igOk" data-k="1" aria-pressed="${o.ok}">Aplicada</button><button data-act="igOk" data-k="0" aria-pressed="${!o.ok}">No se aplicó</button></div>
  <div class="form"><div class="field"><label for="gd-t">Hora</label><input class="input" type="time" id="gd-t" value="${hhmm(new Date())}"></div>
    <div class="field"><label for="gd-n">Enfermera</label><select class="input" id="gd-n">${(S.nurses || []).map(n => `<option ${n === dutyOf(dAt(0)).nurse ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
    ${o.ok ? '' : `<div class="field full"><label for="ig-r">Motivo <span style="color:var(--bad)">*</span></label><input class="input" id="ig-r" placeholder="Ej. paciente en ayuno, se negó, está en quirófano"></div>`}</div>
  ${o.ok && i.pidProd ? `<div class="small muted">Se descuenta de lo entregado por el almacén (en piso: ${floorUnits(i.admId, i.pidProd)}).</div>` : ''}`; }
ACTIONS.igOk = el => { UI.ig.ok = el.dataset.k === '1'; const i = S.indications.find(x => x.id === UI.ig.id); refreshSheet(igBody(i)); };
ACTIONS.indGiveSave = el => {
  const i = S.indications.find(x => x.id === el.dataset.id); const a = admOf(i.admId); const msg = document.getElementById('ig-msg');
  if (!a || a.status !== 'ingresado') { toast('El paciente ya fue dado de alta'); closeSheet(); render(); return; }
  const at = `${dAt(0)} ${val('gd-t') || hhmm(new Date())}`; const nurse = val('gd-n');
  if (!UI.ig.ok) { const r = val('ig-r').trim(); if (!r) { msg.textContent = 'Indique por qué no se aplicó.'; return; }
    S.mar.push({ id: uid('k'), admId: a.id, indId: i.id, pidProd: i.pidProd, med: i.med, dose: i.dose, at, by: actor(), nurse, skipped: true, reason: r });
    log('Dosis no aplicada', `${pat(a.pid).name} · ${i.med} · ${r}`); save(); closeSheet(); render(); toast('Registrado: no se aplicó'); return; }
  // Se descuenta de la solicitud más antigua que todavía tenga unidades en piso
  let orderId = null;
  if (i.pidProd) { const o = (S.medOrders || []).filter(x => x.admId === a.id && moServed(x)).sort((x, y) => x.at.localeCompare(y.at)).find(x => x.items.some(it => it.pid === i.pidProd && givenCount(x, it) < it.qty - (it.returned || 0)));
    if (!o) { msg.innerHTML = `No hay unidades de ${esc(i.med)} entregadas por el almacén para este paciente. ${canHospWrite() ? `<button class="btn sm" data-act="newMedOrder" data-id="${a.id}" data-prod="${i.pidProd}">Pedir al almacén</button>` : ''}`; return; }
    orderId = o.id; }
  S.mar.push({ id: uid('k'), admId: a.id, indId: i.id, orderId, pidProd: i.pidProd, med: i.med, dose: i.dose, at, by: actor(), nurse });
  log('Aplicación registrada', `${pat(a.pid).name} · ${i.med} ${i.dose}`); save(); closeSheet(); render(); toast('Aplicación registrada');
};
