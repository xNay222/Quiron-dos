// Triaje de emergencias (Manchester simplificado, para una clínica pequeña).
// Al llegar el paciente se registra motivo, signos vitales y señales de alarma; el programa PROPONE un color y quien hace
// el triaje lo confirma o lo cambia (con motivo). La sala de espera se ordena por color y tiempo, con el tiempo máximo de
// cada color. Quedan las horas de llegada, triaje y atención (lo que pide una auditoría). S.triage guarda cada llegada.

const TRI_COLORS = [
  { k: 'rojo', name: 'Rojo', label: 'Inmediato', max: 0, color: '#e5383b' },
  { k: 'naranja', name: 'Naranja', label: 'Muy urgente', max: 10, color: '#f3722c' },
  { k: 'amarillo', name: 'Amarillo', label: 'Urgente', max: 60, color: '#f2c12e' },
  { k: 'verde', name: 'Verde', label: 'Poco urgente', max: 120, color: '#38b000' },
  { k: 'azul', name: 'Azul', label: 'No urgente', max: 240, color: '#3a86ff' },
];
const triColor = k => TRI_COLORS.find(c => c.k === k) || TRI_COLORS[4];
const triRank = k => TRI_COLORS.findIndex(c => c.k === k);
// Señales de alarma: cada una lleva al menos a su color
const TRI_FLAGS = [
  ['rojo', 'No respira o paro'], ['rojo', 'Inconsciente o no responde'], ['rojo', 'Convulsión en curso'], ['rojo', 'Hemorragia masiva'], ['rojo', 'Dificultad respiratoria grave'],
  ['naranja', 'Dolor de pecho'], ['naranja', 'Falta de aire moderada'], ['naranja', 'Confuso o somnoliento'], ['naranja', 'Signos de ACV (cara, brazo, habla)'], ['naranja', 'Sangrado activo'],
  ['naranja', 'Trauma importante (caída de altura, accidente)'], ['naranja', 'Embarazada con sangrado o dolor'], ['naranja', 'Reacción alérgica con hinchazón'],
  ['amarillo', 'Vómitos o diarrea persistentes'], ['amarillo', 'Fiebre alta que no cede'], ['amarillo', 'Dolor abdominal'], ['amarillo', 'Herida que requiere sutura'],
  ['azul', 'No urgente (control, récipe, curación)'],
];
// Color sugerido por signos vitales y señales; devuelve el color y por qué
function triSuggest(v, flags) {
  const why = []; let best = 'verde'; const up = (k, t) => { why.push(t); if (triRank(k) < triRank(best)) best = k; };
  const n = x => (x === '' || x == null || isNaN(+x)) ? null : +x;
  const sat = n(v.sat), fr = n(v.fr), fc = n(v.fc), tas = n(v.tas), temp = n(v.temp), dolor = n(v.dolor), gcs = n(v.gcs);
  if (sat !== null) { if (sat < 90) up('rojo', `SatO₂ ${sat}%`); else if (sat <= 93) up('naranja', `SatO₂ ${sat}%`); }
  if (fr !== null) { if (fr < 8 || fr > 30) up('rojo', `FR ${fr}`); else if (fr >= 25) up('naranja', `FR ${fr}`); else if (fr > 20) up('amarillo', `FR ${fr}`); }
  if (fc !== null) { if (fc < 40 || fc > 150) up('rojo', `FC ${fc}`); else if (fc > 120 || fc < 50) up('naranja', `FC ${fc}`); else if (fc > 100) up('amarillo', `FC ${fc}`); }
  if (tas !== null) { if (tas < 80) up('rojo', `TA sistólica ${tas}`); else if (tas < 90 || tas >= 200) up('naranja', `TA sistólica ${tas}`); else if (tas >= 180) up('amarillo', `TA sistólica ${tas}`); }
  if (temp !== null) { if (temp >= 40 || temp < 35) up('naranja', `Temp. ${temp} °C`); else if (temp >= 38.5) up('amarillo', `Temp. ${temp} °C`); }
  if (gcs !== null) { if (gcs <= 8) up('rojo', `Glasgow ${gcs}`); else if (gcs <= 13) up('naranja', `Glasgow ${gcs}`); }
  if (dolor !== null) { if (dolor >= 8) up('naranja', `Dolor ${dolor}/10`); else if (dolor >= 5) up('amarillo', `Dolor ${dolor}/10`); }
  flags.forEach(f => { const def = TRI_FLAGS.find(x => x[1] === f); if (def && def[0] !== 'azul') up(def[0], f); });
  if (best === 'verde' && flags.length && flags.every(f => TRI_FLAGS.find(x => x[1] === f)?.[0] === 'azul') && !why.length) return { k: 'azul', why: ['No urgente'] };
  return { k: best, why };
}
const minsSince = s => Math.max(0, Math.round((Date.now() - new Date(String(s).replace(' ', 'T')).getTime()) / 60000));
const minsTxt = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
const canTriage = () => role() === 'admin' || isNurse() || isClin() || can('hosp.ingresar');
const triWaiting = () => (S.triage || []).filter(t => t.status === 'espera').sort((a, b) => triRank(a.color) - triRank(b.color) || a.arrivedAt.localeCompare(b.arrivedAt));

// ---------- Sala de espera (arriba de las camas de Emergencias) ----------
function triageBlock() {
  const w = triWaiting(); const today = (S.triage || []).filter(t => t.arrivedAt.startsWith(dAt(0)));
  const seen = today.filter(t => t.attendedAt); const avg = seen.length ? Math.round(seen.reduce((s, t) => s + minsSince(t.arrivedAt) - minsSince(t.attendedAt), 0) / seen.length) : null;
  const row = t => { const c = triColor(t.color); const m = minsSince(t.arrivedAt); const late = m > c.max; const p = t.pid ? pat(t.pid) : null;
    return `<div class="tri-row${late ? ' late' : ''}" style="--tri:${c.color}"><span class="tri-dot" title="${c.name}"></span>
      <div class="grow" style="min-width:0"><div class="t"><b>${esc(p?.name || t.name || 'Paciente sin identificar')}</b> <span class="pill" style="background:color-mix(in srgb,${c.color} 22%,transparent)">${c.name} · ${c.label}</span></div>
      <div class="s">${esc(t.motive)} · llegó ${t.arrivedAt.slice(11, 16)} · <b class="tri-wait" data-at="${t.arrivedAt}" data-max="${c.max}">esperando ${minsTxt(m)}</b>${c.max ? ` (máx. ${c.max} min)` : ' (atender ya)'}</div></div>
      <div class="hstack">${canAdmit() ? `<button class="btn sm primary" data-act="triAdmit" data-id="${t.id}">Recibir en cama</button>` : ''}<button class="btn sm" data-act="triOpen" data-id="${t.id}">Ver / cambiar</button></div></div>`; };
  return `<div class="card sec tri-box"><div class="between" style="gap:10px;flex-wrap:wrap"><div><h2 style="margin:0">Sala de espera · triaje</h2>
      <div class="small muted">${w.length ? `${w.length} esperando` : 'Nadie esperando'} · ${today.length} llegada(s) hoy${avg !== null ? ` · espera promedio hasta la atención: ${minsTxt(avg)}` : ''}</div></div>
      ${canTriage() ? `<button class="btn primary" data-act="triNew">Registrar llegada (triaje)</button>` : ''}</div>
    ${w.length ? `<div class="tri-list">${w.map(row).join('')}</div>` : ''}
    <div class="tri-legend">${TRI_COLORS.map(c => `<span><i style="background:${c.color}"></i>${c.name}: ${c.max ? 'hasta ' + c.max + ' min' : 'inmediato'}</span>`).join('')}</div></div>`;
}
// El tiempo de espera se actualiza cada 30 s sin redibujar la pantalla
setInterval(() => { document.querySelectorAll('.tri-wait').forEach(el => { const m = minsSince(el.dataset.at); el.textContent = 'esperando ' + minsTxt(m); el.closest('.tri-row')?.classList.toggle('late', m > +el.dataset.max); }); }, 30000);

// ---------- Registrar llegada ----------
ACTIONS.triNew = () => {
  if (!canTriage()) return;
  ppReset('tri', { exclude: S.admissions.filter(a => a.status === 'ingresado').map(a => a.pid) });
  UI.tri = { id: null, motive: '', v: {}, flags: [], color: '', override: '', unknown: false, name: '' };
  openSheet('Registrar llegada · triaje', triForm(), triFoot());
};
const triFoot = () => `<span class="note" id="tri-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="triSave">Guardar triaje</button>`;
function triForm() {
  const o = UI.tri; const s = triSuggest(o.v, o.flags); const fin = o.color || s.k; const c = triColor(fin); const edit = !!o.id;
  const vf = (k, label, ph, step = '1') => `<div class="field"><label for="tri-${k}">${label}</label><input class="input" type="number" step="${step}" id="tri-${k}" value="${esc(o.v[k] ?? '')}" placeholder="${ph}" data-in="triRecalc"></div>`;
  return `${edit ? '' : `<div>${sheetStep(1, 'Paciente')}<label class="hstack small" style="margin:6px 0"><input type="checkbox" id="tri-unk" data-ch="triUnknown" ${o.unknown ? 'checked' : ''}> No se puede identificar todavía (se registra después)</label>
      ${o.unknown ? `<div class="field"><label for="tri-nm">Descripción o nombre provisional</label><input class="input" id="tri-nm" value="${esc(o.name)}" placeholder="Ej. Hombre ~40 años, traído por terceros"></div>` : `<div id="pp-tri">${patientPicker('tri')}</div>`}</div>`}
    ${sheetStep(edit ? 1 : 2, 'Motivo y signos vitales')}
    <div class="form"><div class="field full"><label for="tri-mot">Motivo de consulta</label><input class="input" id="tri-mot" value="${esc(o.motive)}" placeholder="Ej. Dolor abdominal desde anoche"></div>
      ${vf('tas', 'TA sistólica (mmHg)', '120')}${vf('tad', 'TA diastólica (mmHg)', '80')}${vf('fc', 'Frecuencia cardíaca', '80')}${vf('fr', 'Frecuencia respiratoria', '16')}
      ${vf('sat', 'Saturación O₂ (%)', '98')}${vf('temp', 'Temperatura (°C)', '36.8', '0.1')}${vf('dolor', 'Dolor (0–10)', '0')}${vf('gcs', 'Glasgow (3–15)', '15')}</div>
    ${sheetStep(edit ? 2 : 3, 'Señales de alarma')}<div class="tri-flags">${TRI_FLAGS.map(([k, f]) => `<label class="tri-flag" style="--tri:${triColor(k).color}"><input type="checkbox" data-ch="triFlag" value="${esc(f)}" ${o.flags.includes(f) ? 'checked' : ''}><span>${esc(f)}</span></label>`).join('')}</div>
    ${sheetStep(edit ? 3 : 4, 'Color')}
    <div class="tri-result" style="--tri:${triColor(s.k).color}"><div><span class="small muted">Sugerido por el programa</span><div><b>${triColor(s.k).name} · ${triColor(s.k).label}</b></div><div class="small muted">${s.why.length ? esc(s.why.join(' · ')) : 'Sin hallazgos de alarma'}</div></div></div>
    <div class="seg" role="group" aria-label="Color final">${TRI_COLORS.map(x => `<button data-act="triPick" data-k="${x.k}" aria-pressed="${fin === x.k}">${x.name}</button>`).join('')}</div>
    ${fin !== s.k ? `<div class="field"><label for="tri-ov">¿Por qué cambia el color sugerido? (obligatorio)</label><input class="input" id="tri-ov" value="${esc(o.override)}" placeholder="Ej. paciente anticoagulado, mal estado general"></div>` : ''}
    <div class="small muted">El color es una ayuda: decide quien hace el triaje. Tiempo máximo para ${c.name.toLowerCase()}: ${c.max ? c.max + ' minutos' : 'inmediato'}.</div>`;
}
const triKeep = () => { const o = UI.tri; const g = id => document.getElementById(id);
  ['tas', 'tad', 'fc', 'fr', 'sat', 'temp', 'dolor', 'gcs'].forEach(k => { const e = g('tri-' + k); if (e) o.v[k] = e.value; });
  if (g('tri-mot')) o.motive = g('tri-mot').value; if (g('tri-ov')) o.override = g('tri-ov').value; if (g('tri-nm')) o.name = g('tri-nm').value;
  o.flags = [...document.querySelectorAll('#sheetBody input[data-ch="triFlag"]:checked')].map(x => x.value); };
const triRedraw = () => { triKeep(); const y = document.getElementById('sheetBody')?.scrollTop; refreshSheet(triForm()); const b = document.getElementById('sheetBody'); if (b && y != null) b.scrollTop = y; };
// Al escribir un signo vital solo se actualiza la sugerencia (sin perder el foco)
ACTIONS.triRecalc = () => { triKeep(); const s = triSuggest(UI.tri.v, UI.tri.flags); const box = document.querySelector('#sheetBody .tri-result'); if (!box) return;
  box.style.setProperty('--tri', triColor(s.k).color); box.innerHTML = `<div><span class="small muted">Sugerido por el programa</span><div><b>${triColor(s.k).name} · ${triColor(s.k).label}</b></div><div class="small muted">${s.why.length ? esc(s.why.join(' · ')) : 'Sin hallazgos de alarma'}</div></div>`; };
ACTIONS.triFlag = () => { triRedraw(); };
ACTIONS.triUnknown = el => { triKeep(); UI.tri.unknown = el.checked; triRedraw(); };
ACTIONS.triPick = el => { triKeep(); const s = triSuggest(UI.tri.v, UI.tri.flags); UI.tri.color = el.dataset.k === s.k ? '' : el.dataset.k; triRedraw(); };
ACTIONS.triSave = () => {
  triKeep(); const o = UI.tri; const msg = document.getElementById('tri-msg'); const s = triSuggest(o.v, o.flags); const fin = o.color || s.k;
  let pid = null;
  if (!o.id) { if (o.unknown) { if (!o.name.trim()) { msg.textContent = 'Escriba una descripción provisional del paciente.'; return; } }
    else { const who = pickerCommit('tri'); if (!who.ok) { msg.textContent = who.msg; return; } pid = who.pid; } }
  if (!o.motive.trim()) { msg.textContent = 'Escriba el motivo de consulta.'; return; }
  if (fin !== s.k && !o.override.trim()) { msg.textContent = 'Explique por qué cambia el color sugerido.'; document.getElementById('tri-ov')?.focus(); return; }
  S.triage = S.triage || [];
  if (o.id) { const t = S.triage.find(x => x.id === o.id); const before = t.color;
    Object.assign(t, { motive: o.motive.trim(), vitals: { ...o.v }, flags: o.flags, suggested: s.k, color: fin, override: fin !== s.k ? o.override.trim() : '' });
    (t.history = t.history || []).push({ at: nowStamp(), by: actor(), from: before, to: fin }); log('Triaje reclasificado', `${t.num} · ${triColor(before).name} → ${triColor(fin).name}`);
  } else {
    S.triSeq = (S.triSeq || 0) + 1;
    const t = { id: uid('tr'), num: 'TR-' + String(S.triSeq).padStart(4, '0'), pid, name: o.unknown ? o.name.trim() : '', arrivedAt: nowStamp(), triagedAt: nowStamp(), by: actor(),
      motive: o.motive.trim(), vitals: { ...o.v }, flags: o.flags, suggested: s.k, color: fin, override: fin !== s.k ? o.override.trim() : '', status: 'espera' };
    S.triage.push(t); log('Triaje', `${t.num} · ${pid ? pat(pid).name : t.name} · ${triColor(fin).name}${t.override ? ' (cambiado: ' + t.override + ')' : ''}`);
  }
  save(); closeSheet(); render(); toast(`Triaje ${triColor(fin).name.toLowerCase()} registrado`);
};

// ---------- Ver / cambiar una llegada ----------
ACTIONS.triOpen = el => {
  const t = (S.triage || []).find(x => x.id === el.dataset.id); if (!t) return; const p = t.pid ? pat(t.pid) : null;
  UI.tri = { id: t.id, motive: t.motive, v: { ...(t.vitals || {}) }, flags: [...(t.flags || [])], color: t.color === t.suggested ? '' : t.color, override: t.override || '' };
  openSheet(`Triaje ${t.num} · ${p?.name || t.name}`, `<div class="small muted">Llegó ${t.arrivedAt} · triaje por ${esc(t.by)}</div>${triForm()}`,
    `<span class="note" id="tri-msg"></span><button class="btn danger" data-act="triEnd" data-id="${t.id}" data-k="retirado">Se retiró sin atención</button><button class="btn" data-act="triEnd" data-id="${t.id}" data-k="atendido">Atendido sin ingreso</button><button class="btn primary" data-act="triSave">Guardar cambios</button>`);
};
ACTIONS.triEnd = el => { const t = S.triage.find(x => x.id === el.dataset.id); t.status = el.dataset.k; t.attendedAt = el.dataset.k === 'atendido' ? nowStamp() : null; t.endedAt = nowStamp();
  log(el.dataset.k === 'atendido' ? 'Atendido en emergencia sin ingreso' : 'Se retiró sin atención', `${t.num} · ${t.pid ? pat(t.pid).name : t.name} · esperó ${minsTxt(minsSince(t.arrivedAt))}`); save(); closeSheet(); render(); toast('Registrado'); };
// Recibir en cama: abre el ingreso de emergencia con el paciente, el motivo y el triaje ya puestos
ACTIONS.triAdmit = el => {
  const t = (S.triage || []).find(x => x.id === el.dataset.id); if (!t) return;
  if (!t.pid) { toast('Primero identifique al paciente: abra "Ver / cambiar" y regístrelo, o recíbalo eligiéndolo en la cama.'); }
  ACTIONS.admitNew({ dataset: { area: 'emerg', pid: t.pid || '' } }); UI.triFor = t.id;
  const r = document.getElementById('ad-r'); if (r) r.value = `${t.motive} · triaje ${triColor(t.color).name.toLowerCase()}`;
};
