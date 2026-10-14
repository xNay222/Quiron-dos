// Agenda › Directorio de médicos y derivaciones entre médicos.
// Un médico (o el administrador que también es médico) deriva un paciente a otro médico de la clínica: queda la hoja
// de referencia firmada y una derivación "por agendar" que ven el médico que la recibe y recepción, para darle la cita.

const REF_URG = { normal: ['Normal', ''], preferente: ['Preferente · esta semana', 'warn'], urgente: ['Urgente', 'bad'] };
const REF_ST = { pendiente: ['Por agendar', 'warn'], agendada: ['Cita agendada', 'good'], descartada: ['Descartada', ''] };
const canRefer = () => isClin() || role() === 'admin';
const refFromDoc = () => typeof evDoc === 'function' ? evDoc() : myDoc();
// Derivaciones que le toca atender a quien mira: recepción y administración todas; cada médico, las suyas
const refsToHandle = () => (S.referrals || []).filter(r => r.status === 'pendiente' &&
  (['recepcion', 'admin'].includes(role()) || (myDoc() && r.to === myDoc())));
const refSchedulable = r => can('agenda.programar') && (!agendaOwn() || r.to === myDoc());

function directoryView() {
  const q = labNameKey(UI.dirQ || ''), esp = UI.dirEsp || '';
  const docs = consultDocs().filter(d => d.active !== false);
  const specs = [...new Set(docs.map(d => d.esp).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const shown = docs.filter(d => (!esp || d.esp === esp) && (!q || labNameKey(d.name + ' ' + d.esp).includes(q)));
  const me = refFromDoc();
  const pending = refsToHandle().sort((a, b) => (b.urgency === 'urgente') - (a.urgency === 'urgente') || a.at.localeCompare(b.at));
  const sent = me ? (S.referrals || []).filter(r => r.from === me).slice(-8).reverse() : [];
  const refRow = (r, mine) => { const p = pat(r.pid), to = med(r.to), from = med(r.from);
    return `<div class="row"><span class="avatar">${initials(p?.name || '?')}</span><div class="grow"><div class="t">${esc(p?.name || 'Paciente')} <span class="pill ${REF_URG[r.urgency]?.[1] || ''}">${REF_URG[r.urgency]?.[0] || 'Normal'}</span></div>
      <div class="s">${mine ? 'Para ' + esc(to?.name || '') : 'De ' + esc(from?.name || r.fromName || '') + ' → ' + esc(to?.name || '')} · ${esc(to?.esp || r.esp || '')} · ${fdate(r.at.slice(0, 10))}</div>
      <div class="small" style="margin-top:2px">${esc(r.reason)}</div></div>
      <div class="end hstack" style="flex-wrap:wrap;justify-content:flex-end">${mine ? `<span class="pill ${REF_ST[r.status][1]}">${REF_ST[r.status][0]}</span>` : ''}
        <button class="btn sm" data-act="refPdf" data-id="${r.id}">Hoja</button>
        ${!mine && refSchedulable(r) ? `<button class="btn sm primary" data-act="refSchedule" data-id="${r.id}">Agendar cita</button>` : ''}
        ${!mine ? `<button class="btn sm ghost" data-act="refDiscard" data-id="${r.id}">Descartar</button>` : ''}</div></div>`; };
  const card = d => `<div class="row dir-doc"><span class="avatar">${initials(d.name.replace(/^(Dra?|Lic)\. /, ''))}</span>
    <div class="grow"><div class="t">${esc(d.name)}${d.id === me ? ' <span class="pill info">Usted</span>' : ''}</div><div class="s">${esc(d.esp || 'Medicina')}</div>
      <div class="small muted">${esc(hoursText(d.id))}</div></div>
    <div class="end hstack" style="flex-wrap:wrap;justify-content:flex-end">
      ${canRefer() && d.id !== me ? `<button class="btn sm primary" data-act="refNew" data-doc="${d.id}">Derivar paciente</button>` : ''}
      ${can('agenda.programar') && !agendaOwn() ? `<button class="btn sm" data-act="newAppt" data-doc="${d.id}">Agendar cita</button>` : ''}</div></div>`;
  return (pending.length ? `<section class="card" style="margin-bottom:16px"><h2>Derivaciones por agendar <span class="pill warn">${pending.length}</span></h2>
      <div class="list">${pending.map(r => refRow(r, false)).join('')}</div></section>` : '') +
    `<div class="hstack" style="margin-bottom:14px;flex-wrap:wrap"><div class="search" style="flex:1;min-width:220px">${icon('buscar')}<input class="input" id="dirQ" placeholder="Buscar médico o especialidad" value="${esc(UI.dirQ || '')}" data-in="dirSearch" aria-label="Buscar médico o especialidad"></div>
      <select class="input" style="width:auto;min-width:200px" data-ch="dirEsp" aria-label="Especialidad"><option value="">Todas las especialidades</option>${specs.map(s => `<option ${esp === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
    ${shown.length ? `<div class="list">${shown.sort((a, b) => (a.esp || '').localeCompare(b.esp || '', 'es') || a.name.localeCompare(b.name, 'es')).map(card).join('')}</div>` : '<div class="empty">Ningún médico coincide.</div>'}
    ${sent.length ? `<section class="sec"><h3>Mis derivaciones enviadas</h3><div class="list">${sent.map(r => refRow(r, true)).join('')}</div></section>` : ''}`;
}
ACTIONS.dirEsp = el => { UI.dirEsp = el.value; render(); };
ACTIONS.dirSearch = el => { UI.dirQ = el.value; const pos = el.selectionStart; render(); const n = document.getElementById('dirQ'); n?.focus(); n?.setSelectionRange(pos, pos); };

// ---------- Derivar ----------
ACTIONS.refNew = el => {
  if (!canRefer()) return;
  const d = med(el.dataset.doc); if (!d) return;
  UI.ref = { to: d.id, urgency: 'normal' };
  ppReset('ref', { pid: el.dataset.pid || null });
  openSheet('Derivar paciente', `<div class="card small" style="margin-bottom:12px"><b>${esc(d.name)}</b> · ${esc(d.esp || '')}<div class="muted">${esc(hoursText(d.id))}</div></div>
    <div>${sheetStep(1, 'Paciente')}<div id="pp-ref" style="margin-top:8px">${patientPicker('ref')}</div></div>
    ${sheetStep(2, 'Motivo de la derivación')}
    <div class="field"><label for="rf-reason">¿Por qué lo deriva? *</label><textarea class="input" id="rf-reason" rows="3" placeholder="Ej. Evaluación por dolor torácico atípico con ECG normal"></textarea></div>
    <div class="form"><div class="field"><label for="rf-dx">Impresión diagnóstica (opcional)</label><input class="input" id="rf-dx"></div>
      <div class="field"><label>Prioridad</label><div class="seg" role="group" aria-label="Prioridad" id="rf-urg">${Object.entries(REF_URG).map(([k, [t]]) => `<button type="button" data-act="refUrg" data-k="${k}" aria-pressed="${k === 'normal'}">${esc(t)}</button>`).join('')}</div></div></div>
    <div class="field"><label for="rf-sum">Resumen clínico para el colega (opcional)</label><textarea class="input" id="rf-sum" rows="3" placeholder="Antecedentes, hallazgos y tratamiento actual relevantes"></textarea></div>`,
    '<span class="note" id="rf-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="refSave">Derivar y ver la hoja</button>', { wide: true });
};
ACTIONS.refUrg = el => { UI.ref.urgency = el.dataset.k; document.querySelectorAll('#rf-urg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === UI.ref.urgency))); };
ACTIONS.refSave = async () => {
  if (!canRefer() || !UI.ref) return;
  const msg = document.getElementById('rf-msg'); const reason = val('rf-reason').trim();
  const who = pickerCommit('ref'); if (!who.ok) { msg.textContent = who.msg; return; }
  if (!reason) { msg.textContent = 'Escriba el motivo de la derivación.'; return; }
  if (typeof credsBlockSign === 'function' && credsBlockSign()) return;   // la hoja lleva la firma de quien deriva
  S.refSeq = S.refSeq || 1;
  const from = refFromDoc();
  const r = { id: uid('rf'), num: 'REF-' + String(S.refSeq++).padStart(4, '0'), pid: who.pid, from, fromUser: S.session?.uid || null, fromName: from ? med(from)?.name : actor(),
    to: UI.ref.to, esp: med(UI.ref.to)?.esp || '', urgency: UI.ref.urgency || 'normal', reason, dx: val('rf-dx').trim(), summary: val('rf-sum').trim(), at: nowStamp(), status: 'pendiente' };
  (S.referrals = S.referrals || []).push(r);
  log('Paciente derivado', `${r.num} · ${pat(r.pid).name} → ${med(r.to)?.name || ''}${r.urgency !== 'normal' ? ' · ' + REF_URG[r.urgency][0] : ''}`);
  save(); UI.ref = null; render();
  toast(`Derivación enviada a ${med(r.to)?.name || 'el médico'}`);
  ACTIONS.refPdf({ dataset: { id: r.id } });
};

// ---------- Hoja de referencia ----------
function pdfReferral(r) {
  const p = pat(r.pid), to = med(r.to), from = med(r.from);
  const doc = pdfNew('Referencia médica', ['Nº ' + r.num, 'Emitida ' + fdate(r.at.slice(0, 10)), 'Historia ' + (p?.code || '')]); let y = PG.top;
  y = pdfInfoBox(doc, y, [['Paciente', p?.name || ''], ['Cédula', p?.ci || '—'], ['Edad', p ? ageTxt(p) : '—'], ['Teléfono', p?.phone || '—']], 2);
  if (p?.allergies?.length) y = pdfPara(doc, y, 'Alergias: ' + p.allergies.join(', '), { bold: true, color: RED });
  y = pdfSection(doc, y + 6, 'Se refiere a');
  y = pdfPara(doc, y, (to?.name || '') + (to?.esp ? ' · ' + to.esp : '') + (r.urgency !== 'normal' ? '   ·   Prioridad: ' + REF_URG[r.urgency][0] : ''), { size: 11, bold: true });
  y = pdfSection(doc, y + 6, 'Motivo de la referencia'); y = pdfPara(doc, y, r.reason, { size: 11 });
  if (r.dx) { y = pdfSection(doc, y + 6, 'Impresión diagnóstica'); y = pdfPara(doc, y, r.dx, { size: 11 }); }
  if (r.summary) { y = pdfSection(doc, y + 6, 'Resumen clínico'); y = pdfPara(doc, y, r.summary, { size: 11 }); }
  y = pdfPara(doc, y + 8, 'Agradezco su valoración y conducta.', { size: 11 });
  pdfSignature(doc, y, from?.name || r.fromName || '', from?.esp ? from.esp + ' · firma y sello' : 'Firma y sello', null, from ? docCreds(from) : '');
  return doc;
}
ACTIONS.refPdf = async el => {
  const r = (S.referrals || []).find(x => x.id === el.dataset.id); if (!r || !pdfReady()) return;
  const sched = refSchedulable(r) && r.status === 'pendiente' ? `<button class="btn" data-act="refSchedule" data-id="${r.id}">Agendar cita</button>` : '';
  await pdfSave(() => pdfReferral(r), `Referencia ${r.num} ${pat(r.pid)?.name || ''}.pdf`, { title: 'Referencia ' + r.num, extra: sched });
};

// ---------- Agendar o descartar ----------
ACTIONS.refSchedule = el => {
  const r = (S.referrals || []).find(x => x.id === el.dataset.id); if (!r) return;
  if (!refSchedulable(r)) { toast('La cita la agenda recepción o el médico que recibe al paciente.'); return; }
  closeSheet(); setTimeout(() => ACTIONS.newAppt({ dataset: { doc: r.to, pid: r.pid, ref: r.id } }), 0);
};
ACTIONS.refDiscard = el => {
  const r = (S.referrals || []).find(x => x.id === el.dataset.id); if (!r) return;
  openSheet('Descartar derivación', `${patientBand(r.pid)}<div class="field"><label for="rf-why">Motivo *</label><input class="input" id="rf-why" placeholder="Ej. el paciente prefiere otro centro"></div>`,
    `<span class="note" id="rf-dmsg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn danger" data-act="refDiscardSave" data-id="${r.id}">Descartar</button>`);
};
ACTIONS.refDiscardSave = el => {
  const r = (S.referrals || []).find(x => x.id === el.dataset.id); if (!r) return;
  const why = val('rf-why').trim(); if (!why) { document.getElementById('rf-dmsg').textContent = 'Indique el motivo.'; return; }
  Object.assign(r, { status: 'descartada', closedAt: nowStamp(), closedBy: actor(), closeReason: why });
  log('Derivación descartada', `${r.num} · ${why}`); save(); closeSheet(); render(); toast('Derivación descartada');
};
