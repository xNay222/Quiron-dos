// Requisitos de cada cirugía programada: consentimiento firmado y preoperatorio.
// Se indican en el perfil del paciente, en la lista de pacientes y en Quirófano.
// El preoperatorio puede hacerse en la clínica (Exámenes) o subirse si se hizo en otro laboratorio.

const normTxt = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
const PREOP_DAYS = 60;   // un preoperatorio vale si se hizo hasta 60 días antes de la cirugía
const upcomingSurgeries = pid => S.appts.filter(a => a.kind === 'cirugia' && a.pid === pid && a.date >= dAt(0) && isActive(a)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
function surgeryConsent(a) {
  const p = pat(a.pid);
  return p.consents.find(c => c.apptId === a.id) || p.consents.find(c => !c.apptId && c.proc && normTxt(c.proc) === normTxt(a.proc));
}
function surgeryPreop(a) {
  const from = iso(new Date(new Date(a.date + 'T00:00').getTime() - PREOP_DAYS * DAY));
  const list = S.exams.filter(e => e.pid === a.pid && (e.preop || e.tests.includes('Perfil preoperatorio')) && e.date >= from && e.date <= a.date);
  return list.find(e => e.status === 'listo') || list[0] || null;
}
// Estado de los requisitos: { consent: 'firmado'|'sin_firmar'|'falta', preop: 'listo'|'proceso'|'falta' }
function surgeryChecks(a) {
  const c = surgeryConsent(a); const e = surgeryPreop(a);
  return { c, e, consent: !c ? 'falta' : c.status === 'pendiente' ? 'sin_firmar' : 'firmado', preop: !e ? 'falta' : e.status === 'listo' ? 'listo' : 'proceso' };
}
window.surgeryPills = a => { const k = surgeryChecks(a);
  return `${k.consent === 'firmado' ? '<span class="pill good">Consentimiento firmado</span>' : k.consent === 'sin_firmar' ? '<span class="pill warn">Consentimiento sin firmar</span>' : '<span class="pill bad">Pendiente de consentimiento</span>'}
  ${k.preop === 'listo' ? '<span class="pill good">Preoperatorio listo</span>' : k.preop === 'proceso' ? '<span class="pill warn">Preoperatorio en proceso</span>' : '<span class="pill bad">Pendiente de preoperatorio</span>'}`; };
window.patientSurgeryPills = pid => { const a = upcomingSurgeries(pid)[0]; if (!a) return '';
  const k = surgeryChecks(a); return `${k.consent !== 'firmado' ? '<span class="pill bad">Pendiente de consentimiento</span>' : ''}${k.preop !== 'listo' ? '<span class="pill bad">Pendiente de preoperatorio</span>' : ''}`; };

// Recuadro en el perfil del paciente: una fila por cirugía programada, con lo que falta y cómo resolverlo
window.surgeryBanner = p => {
  const list = upcomingSurgeries(p.id); if (!list.length) return '';
  const papers = can('pac.papeles') || can('pac.escribir');
  return `<div class="card sxbanner" style="margin-bottom:14px;display:grid;gap:12px">${list.map(a => { const k = surgeryChecks(a); const i = k.c ? p.consents.indexOf(k.c) : -1;
    return `<div style="display:grid;gap:8px"><div class="between" style="gap:10px;flex-wrap:wrap"><div><b>Cirugía programada:</b> ${esc(a.proc)}<div class="small muted">${fday(a.date)} · ${a.time} · ${esc(med(a.doc)?.name || '')}</div></div><div class="hstack">${surgeryPills(a)}</div></div>
      ${(k.consent !== 'firmado' || k.preop !== 'listo') && (papers || canCreateExam()) ? `<div class="hstack" style="justify-content:flex-end">
        ${!papers ? '' : k.consent === 'falta' ? `<button class="btn sm" data-act="newConsent" data-id="${p.id}" data-appt="${a.id}">Crear consentimiento</button>` : k.consent === 'sin_firmar' ? `<button class="btn sm" data-act="consentPrint" data-id="${p.id}" data-i="${i}">Imprimir consentimiento</button><button class="btn sm" data-act="consentUpload" data-id="${p.id}" data-i="${i}">Subir consentimiento firmado</button>` : ''}
        ${k.preop === 'falta' && canCreateExam() ? `<button class="btn sm" data-act="newExam" data-pid="${p.id}" data-appt="${a.id}" data-tests="Perfil preoperatorio">Solicitar preoperatorio</button>` : ''}
        ${k.preop !== 'listo' && papers ? `<button class="btn sm primary" data-act="preopUpload" data-appt="${a.id}">Subir preoperatorio externo</button>` : ''}</div>` : ''}</div>`; }).join('<hr style="border:none;border-top:1px solid var(--line);margin:0">')}</div>`;
};

// ---------- Subir un preoperatorio hecho en otro laboratorio o clínica ----------
const PREOP_TESTS = LAB_COMBOS['Perfil preoperatorio'];
ACTIONS.preopUpload = el => {
  const a = S.appts.find(x => x.id === el.dataset.appt);
  UI.po = { apptId: a.id, lab: '', date: dAt(0), tests: [...PREOP_TESTS], notes: '', files: [], busy: false };
  openSheet('Subir preoperatorio externo', preopBody(), `<span class="note" id="po-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="preopSave">Guardar preoperatorio</button>`, { wide: true });
};
function preopBody() {
  const o = UI.po; const a = S.appts.find(x => x.id === o.apptId); const p = pat(a.pid);
  return `${patientBand(p.id)}<div class="small muted">${esc(p.name)} · para ${esc(a.proc)} (${fdate(a.date)}). Suba las fotos o el PDF de los resultados; quedarán en la pestaña Exámenes del paciente.</div>
  <div class="form">
    <div class="field"><label for="po-lab">Laboratorio o clínica donde se realizó <span style="color:var(--bad)">*</span></label><input class="input" id="po-lab" value="${esc(o.lab)}" placeholder="Ej. Laboratorio Clínico Central"></div>
    <div class="field"><label for="po-date">Fecha de los resultados</label><input class="input" type="date" id="po-date" value="${o.date}" max="${dAt(0)}"></div></div>
  <div><b class="small">Exámenes incluidos</b><div class="hstack" style="margin-top:6px">${PREOP_TESTS.map(t => { const on = o.tests.includes(t); return `<button class="btn sm ${on ? 'primary' : ''}" data-act="poTest" data-t="${esc(t)}" aria-pressed="${on}">${on ? '✓ ' : ''}${esc(t)}</button>`; }).join('')}</div></div>
  <div><b class="small">Resultados (fotos o PDF) <span style="color:var(--bad)">*</span></b>
    <div class="hstack" style="margin-top:6px">${o.files.map((f, i) => `<span class="pill">${esc(f.name)} <button class="btn ghost sm" data-act="poDelFile" data-i="${i}" aria-label="Quitar ${esc(f.name)}">✕</button></span>`).join('')}
    <button class="btn sm" data-act="poPick" ${o.busy ? 'disabled' : ''}>${o.busy ? 'Subiendo…' : '+ Agregar archivo'}</button></div>
    <input type="file" id="po-file" accept="image/*,application/pdf" multiple data-ch="poFiles" hidden></div>
  <div class="field"><label for="po-notes">Observaciones (opcional)</label><input class="input" id="po-notes" value="${esc(o.notes)}" placeholder="Ej. Hemoglobina 13,2 · plaquetas normales"></div>`;
}
const poKeep = () => { const o = UI.po; o.lab = val('po-lab'); o.date = val('po-date') || dAt(0); o.notes = val('po-notes'); };
const poRedraw = () => { if (UI.po.ext) { extKeep(); document.getElementById('xe-rest').innerHTML = extBody(); return; } poKeep(); refreshSheet(preopBody()); };
ACTIONS.poTest = el => { const t = el.dataset.t; const l = UI.po.tests; l.includes(t) ? l.splice(l.indexOf(t), 1) : l.push(t); poRedraw(); };
ACTIONS.poDelFile = el => { UI.po.files.splice(+el.dataset.i, 1); poRedraw(); };
ACTIONS.poPick = () => { if (UI.po.ext) extKeep(); else poKeep(); document.getElementById('po-file').click(); };
ACTIONS.poFiles = async el => {
  const files = [...(el.files || [])]; el.value = ''; if (!files.length) return;
  UI.po.busy = true; poRedraw();
  try {
    for (const f of files) {
      const isPdf = f.type === 'application/pdf'; if (!isPdf && !f.type.startsWith('image/')) continue;
      const url = await storeFile(isPdf ? f : await shrinkImage(f), isPdf);   // carpeta "archivos" con el servidor local
      if (url) UI.po.files.push({ url, name: f.name, type: isPdf ? 'application/pdf' : 'image/jpeg' }); else toast(`${f.name} es demasiado grande; súbalo con el servidor local encendido`);
    }
  } catch (e) { toast('No se pudo subir algún archivo. Inténtelo de nuevo.'); }
  UI.po.busy = false; if (UI.po.ext) document.getElementById('xe-rest').innerHTML = extBody(); else refreshSheet(preopBody());
};
ACTIONS.preopSave = () => {
  poKeep(); const o = UI.po; const msg = document.getElementById('po-msg');
  if (!o.lab.trim()) { msg.textContent = 'Indique el laboratorio o la clínica donde se realizó.'; return; }
  if (!o.files.length) { msg.textContent = 'Agregue al menos una foto o PDF de los resultados.'; return; }
  if (!o.tests.length) { msg.textContent = 'Indique qué exámenes incluye.'; return; }
  const a = S.appts.find(x => x.id === o.apptId);
  const e = { id: uid('ex'), num: 'EX-' + String(S.exSeq++).padStart(4, '0'), pid: a.pid, doc: a.doc, note: null, date: o.date, area: 'laboratorio', tests: [...o.tests], priority: 'normal', notes: `Preoperatorio para ${a.proc}`,
    status: 'listo', readyAt: o.date, by: o.lab.trim(), seen: true, files: o.files, results: [], report: o.notes.trim(), preop: true, apptId: a.id, external: { lab: o.lab.trim(), uploadedBy: actor(), at: nowStamp() } };
  S.exams.unshift(e); log('Preoperatorio externo cargado', `${pat(a.pid).name} · ${o.lab.trim()} · ${o.files.length} archivo(s)`); save(); closeSheet(); render(); toast('Preoperatorio guardado en el perfil del paciente');
};

// ---------- Examen externo (laboratorio o rayos X de otro centro) ----------
// No hace falta una orden del médico de la clínica: se sube el resultado (fotos o PDF) y queda en Exámenes del paciente.
const canUploadExt = () => canCreateExam() || can('pac.papeles') || can('pac.escribir');
ACTIONS.extExam = el => { if (!canUploadExt()) return;
  UI.po = { ext: true, area: el?.dataset?.area || 'laboratorio', lab: '', date: dAt(0), testsTxt: '', notes: '', files: [], busy: false };
  ppReset('xe', { pid: el?.dataset?.pid || null });
  openSheet('Subir examen externo', `<div><b class="small">1. Paciente</b><div id="pp-xe" style="margin-top:8px">${patientPicker('xe')}</div></div><div id="xe-rest">${extBody()}</div>`,
    `<span class="note" id="po-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="extSave">Guardar en el perfil</button>`, { wide: true }); };
function extBody() { const o = UI.po;
  return `<div class="form">
    <div class="field"><label>Tipo</label><div class="seg" role="group" aria-label="Tipo de examen"><button data-act="extArea" data-k="laboratorio" aria-pressed="${o.area === 'laboratorio'}">Laboratorio</button><button data-act="extArea" data-k="imagen" aria-pressed="${o.area === 'imagen'}">Rayos X e imagen</button></div></div>
    <div class="field"><label for="po-date">Fecha del examen</label><input class="input" type="date" id="po-date" value="${o.date}" max="${dAt(0)}"></div>
    <div class="field"><label for="po-lab">Laboratorio o centro donde se hizo <span style="color:var(--bad)">*</span></label><input class="input" id="po-lab" value="${esc(o.lab)}" placeholder="Ej. Laboratorio Clínico Central"></div>
    <div class="field"><label for="xe-tests">Exámenes <span style="color:var(--bad)">*</span></label><input class="input" id="xe-tests" value="${esc(o.testsTxt)}" placeholder="${o.area === 'imagen' ? 'Ej. Rayos X de tórax, Ecografía abdominal' : 'Ej. Hematología completa, Glicemia'}"></div>
    <div class="field full"><label for="po-notes">Observaciones (opcional)</label><input class="input" id="po-notes" value="${esc(o.notes)}" placeholder="Ej. Hemoglobina 11,2 · resto normal"></div></div>
  <div><b class="small">Resultados (fotos o PDF) <span style="color:var(--bad)">*</span></b>
    <div class="hstack" style="margin-top:6px">${o.files.map((f, i) => `<span class="pill">${esc(f.name)} <button class="btn ghost sm" data-act="poDelFile" data-i="${i}" aria-label="Quitar ${esc(f.name)}">✕</button></span>`).join('')}
    <button class="btn sm" data-act="poPick" ${o.busy ? 'disabled' : ''}>${o.busy ? 'Subiendo…' : '+ Agregar archivo'}</button></div>
    <input type="file" id="po-file" accept="image/*,application/pdf" multiple data-ch="poFiles" hidden></div>`; }
const extKeep = () => { const o = UI.po; o.lab = val('po-lab'); o.date = val('po-date') || dAt(0); o.notes = val('po-notes'); o.testsTxt = val('xe-tests'); };
ACTIONS.extArea = el => { extKeep(); UI.po.area = el.dataset.k; document.getElementById('xe-rest').innerHTML = extBody(); };
ACTIONS.extSave = () => {
  extKeep(); const o = UI.po; const msg = document.getElementById('po-msg'); const who = pickerCommit('xe'); if (!who.ok) { msg.textContent = who.msg; return; }
  const tests = o.testsTxt.split(/[,;\n]/).map(t => t.trim()).filter(Boolean);
  if (!o.lab.trim()) { msg.textContent = 'Indique el laboratorio o centro donde se hizo.'; return; }
  if (!tests.length) { msg.textContent = 'Escriba qué exámenes son.'; return; }
  if (!o.files.length) { msg.textContent = 'Agregue al menos una foto o PDF del resultado.'; return; }
  const e = { id: uid('ex'), num: 'EX-' + String(S.exSeq++).padStart(4, '0'), pid: who.pid, doc: myDoc() || null, note: null, date: o.date, area: o.area, tests, priority: 'normal', notes: 'Examen externo',
    status: 'listo', readyAt: o.date, by: o.lab.trim(), seen: true, files: o.files, results: [], report: o.notes.trim(), external: { lab: o.lab.trim(), uploadedBy: actor(), at: nowStamp() } };
  S.exams.unshift(e); log('Examen externo cargado', `${pat(who.pid).name} · ${tests.join(', ')} · ${o.lab.trim()}`); save(); closeSheet(); render(); toast('Examen externo guardado en el perfil del paciente');
};
