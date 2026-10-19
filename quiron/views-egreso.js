// Informe de egreso (epicrisis) de hospitalización y emergencias.
// Se arma solo con lo que ya está en el sistema (ingreso, evoluciones firmadas, medicación aplicada, exámenes) y el médico
// completa el diagnóstico de egreso, la condición al alta y las indicaciones. Queda guardado en el ingreso (a.epicrisis)
// y se descarga en PDF con membrete y firma del médico tratante.

const EGRESO_COND = ['Mejorado', 'Curado', 'Estable sin cambios', 'Referido a otro centro', 'Alta voluntaria (contra opinión médica)', 'Fallecido'];
const canEpicrisis = a => role() === 'admin' || (isClin() && can('hosp.clinico'));

// Lo que el sistema ya sabe del ingreso, para proponer el texto inicial
function egresoDraft(a) {
  const p = pat(a.pid); const end = (a.dischargedAt || nowStamp()).slice(0, 10);
  const notes = S.hc.filter(n => n.admId === a.id && n.status === 'firmada').sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  const curso = notes.map(n => `${fdate(n.date)}: ${String(n.actual || n.motivo || '').replace(/\s+/g, ' ').trim().slice(0, 400)}`).filter(t => t.length > 14).join('\n');
  const meds = [...new Set((S.medOrders || []).filter(o => o.admId === a.id && o.status !== 'rechazada').flatMap(o => o.items.map(it => prod(it.pid)?.name)).filter(Boolean))];
  const exams = (S.exams || []).filter(e => e.pid === a.pid && (e.admId === a.id || (e.date >= a.admittedAt.slice(0, 10) && e.date <= end)))
    .map(e => `${(e.tests || [e.name || e.label || 'Examen']).join(', ')} (${fdate(e.date)})`);
  const qx = (S.appts || []).filter(x => x.pid === a.pid && x.kind === 'cirugia' && x.date >= a.admittedAt.slice(0, 10) && x.date <= end).map(x => `${x.proc || x.reason || 'Cirugía'} (${fdate(x.date)})`);
  return { dxIn: a.dx || '', motivo: a.reason || '', dxOut: a.dx || '', curso, proc: qx.join('\n'), tto: meds.join(', '), exams: exams.join('\n'),
    cond: '', indic: '', control: '', doc: a.doc || '', pid: p.id };
}
const egresoOf = a => a.epicrisis || null;

ACTIONS.egresoOpen = el => {
  const a = admOf(el.dataset.id); if (!a) return;
  UI.eg = { id: a.id, ...(egresoOf(a) ? JSON.parse(JSON.stringify(a.epicrisis)) : egresoDraft(a)) };
  openSheet(`Informe de egreso · ${pat(a.pid).name}`, egresoForm(a), egresoFoot(a), { wide: true });
};
const egresoFoot = a => `<span class="note" id="eg-msg"></span><button class="btn" data-act="close">Cerrar</button>${canEpicrisis(a) ? `<button class="btn" data-act="egresoReset" data-id="${a.id}">Volver a proponer desde el sistema</button><button class="btn" data-act="egresoSave" data-id="${a.id}">Guardar</button>` : ''}<button class="btn primary" data-act="egresoPdf" data-id="${a.id}">Guardar y ver PDF</button>`;
function egresoForm(a) {
  const g = UI.eg; const ro = canEpicrisis(a) ? '' : 'readonly'; const area = admArea(a) === 'emerg' ? 'Emergencia' : 'Hospitalización';
  const ta = (id, label, v, rows = 3, ph = '') => `<div class="field full"><label for="eg-${id}">${label}</label><textarea class="input" id="eg-${id}" rows="${rows}" ${ro} placeholder="${esc(ph)}">${esc(v || '')}</textarea></div>`;
  const inp = (id, label, v, ph = '') => `<div class="field"><label for="eg-${id}">${label}</label><input class="input" id="eg-${id}" ${ro} value="${esc(v || '')}" placeholder="${esc(ph)}"></div>`;
  return `${patientBand(a.pid, a.bed)}<div class="small muted">${area} ${esc(a.num)} · ingresó ${esc(a.admittedAt)}${a.dischargedAt ? ` · alta ${esc(a.dischargedAt)}` : ' · todavía ingresado'} · ${stayDays(a)} día(s)${a.epicrisis?.savedAt ? ` · informe guardado el ${esc(a.epicrisis.savedAt)} por ${esc(a.epicrisis.by || '')}` : ' · borrador propuesto con lo registrado en el sistema'}</div>
  <div class="form">
    ${inp('dxIn', 'Diagnóstico de ingreso', g.dxIn)}${inp('dxOut', 'Diagnóstico de egreso', g.dxOut)}
    ${ta('motivo', 'Motivo de ingreso', g.motivo, 2)}
    ${ta('curso', 'Evolución durante el ingreso (resumen)', g.curso, 6, 'Resumen del curso clínico')}
    ${ta('proc', 'Procedimientos y cirugías realizados', g.proc, 2, 'Ninguno')}
    ${ta('tto', 'Tratamiento recibido', g.tto, 3)}
    ${ta('exams', 'Exámenes realizados y hallazgos relevantes', g.exams, 3)}
    <div class="field"><label for="eg-cond">Condición al egreso</label><select class="input" id="eg-cond" ${ro ? 'disabled' : ''}><option value="">Elija…</option>${EGRESO_COND.map(c => `<option ${g.cond === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    ${lockedDoc() ? docFieldLocked('eg-doc', 'Médico que firma') : `<div class="field"><label for="eg-doc">Médico que firma</label><select class="input" id="eg-doc" ${ro ? 'disabled' : ''}>${(S.doctors || []).filter(d => d.active !== false).map(d => `<option value="${d.id}" ${d.id === g.doc ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>`}
    ${ta('indic', 'Indicaciones al alta (tratamiento en casa, cuidados, signos de alarma)', g.indic, 4)}
    ${inp('control', 'Control', g.control, 'Ej. consulta en 7 días con el Dr. …')}
  </div>`;
}
const egKeep = () => { const g = UI.eg; ['dxIn', 'dxOut', 'motivo', 'curso', 'proc', 'tto', 'exams', 'indic', 'control', 'cond', 'doc'].forEach(k => { const e = document.getElementById('eg-' + k); if (e) g[k] = e.value; }); };
ACTIONS.egresoReset = el => { const a = admOf(el.dataset.id); egKeep(); const d = egresoDraft(a); Object.assign(UI.eg, { curso: d.curso, proc: d.proc, tto: d.tto, exams: d.exams }); refreshSheet(egresoForm(a)); toast('Evolución, tratamiento y exámenes propuestos de nuevo desde el sistema'); };
function egresoStore(a) {
  egKeep(); const g = UI.eg; const msg = document.getElementById('eg-msg'); if (lockedDoc()) g.doc = lockedDoc();
  if (lockedDoc() && typeof credsBlockSign === 'function' && credsBlockSign()) return false;   // el informe sale firmado a su nombre
  if (!g.dxOut.trim()) { if (msg) msg.textContent = 'Escriba el diagnóstico de egreso.'; return false; }
  if (!g.cond) { if (msg) msg.textContent = 'Elija la condición al egreso.'; return false; }
  const { id, ...data } = g; const first = !a.epicrisis;
  a.epicrisis = { ...data, savedAt: nowStamp(), by: actor() };
  log(first ? 'Informe de egreso elaborado' : 'Informe de egreso actualizado', `${a.num} · ${pat(a.pid).name} · ${g.cond}`); save(); return true;
}
ACTIONS.egresoSave = el => { const a = admOf(el.dataset.id); if (!canEpicrisis(a)) return; if (egresoStore(a)) { closeSheet(); render(); toast('Informe de egreso guardado'); } };
ACTIONS.egresoPdf = async el => {
  const a = admOf(el.dataset.id); if (canEpicrisis(a) && !egresoStore(a)) return;
  if (!a.epicrisis) { toast('Todavía no hay informe de egreso guardado'); return; }
  if (!pdfReady()) return; closeSheet(); render();
  await pdfSave(() => pdfEgreso(a), `Informe de egreso ${pat(a.pid).name} ${a.num}.pdf`);
};

function pdfEgreso(a) {
  const g = a.epicrisis; const p = pat(a.pid); const d = med(g.doc) || med(a.doc) || {}; const area = admArea(a) === 'emerg' ? 'Emergencia' : 'Hospitalización';
  const doc = pdfNew('Informe de egreso (epicrisis)', [`${area} ${a.num}`, `Egreso ${a.dischargedAt ? fdate(a.dischargedAt.slice(0, 10)) : 'pendiente'}`]); let y = PG.top;
  y = pdfInfoBox(doc, y, [...patientPairs(p).slice(0, 4), ['Ingreso', a.admittedAt], ['Egreso', a.dischargedAt || 'Todavía ingresado'], ['Estancia', `${stayDays(a)} día(s) · cama ${a.bed}`], ['Médico tratante', med(a.doc)?.name || '—']], 2);
  if (p.allergies?.length) y = pdfPara(doc, y, `Alergias: ${p.allergies.join(', ')}`, { size: 9, color: RED, bold: true });
  const sec = (t, v) => { if (!String(v || '').trim()) return; y = pdfSection(doc, y + 4, t); y = pdfPara(doc, y, v, { size: 10 }); };
  sec('Diagnóstico de ingreso', g.dxIn); sec('Motivo de ingreso', g.motivo); sec('Evolución durante el ingreso', g.curso);
  sec('Procedimientos y cirugías', g.proc); sec('Tratamiento recibido', g.tto); sec('Exámenes realizados', g.exams);
  sec('Diagnóstico de egreso', g.dxOut); sec('Condición al egreso', g.cond); sec('Indicaciones al alta', g.indic); sec('Control', g.control);
  pdfDocSign(doc, Math.max(y, 600), d.name ? d : { name: 'Médico tratante' }, `${d.esp || ''}${d.esp ? ' · ' : ''}firma y sello`, { at: g.savedAt, ref: a.num + ':egreso' });
  return doc;
}
