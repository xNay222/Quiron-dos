// Imágenes clínicas: adjuntos originales, sin reducir resolución; siempre ligados a un paciente.
const IMAGE_TYPES = { radiografia: 'Radiografía', ecografia: 'Ecografía', tomografia: 'Tomografía', resonancia: 'Resonancia', otro: 'Otro' };
const canUploadImage = () => can('imagen.subir');
const canReadImages = () => can('pac.clinico') || can('imagen.subir');
const imageUploadButton = pid => canUploadImage() ? `<button class="btn" data-act="imageUpload" data-pid="${pid || ''}">Subir radiografía / estudio de imagen</button>` : '';
const imageOrders = pid => S.exams.filter(e => e.pid === pid && e.area === 'imagen' && e.status !== 'listo' && !e.external);
function imageOrderOptions() { const pid = ppState('rx').pid; return '<option value="">Sin orden vinculada</option>' + imageOrders(pid).map(e => `<option value="${e.id}">${esc(e.num)} · ${esc(e.tests.join(', '))} · ${fdate(e.date)}${e.admId ? ' · ingreso ' + esc(admOf(e.admId)?.num || e.admId) : e.apptId ? ' · cita vinculada' : ''}</option>`).join(''); }
ACTIONS.imageUpload = (el = {}) => {
  if (!canUploadImage()) return;
  const order = S.exams.find(e => e.id === el.dataset?.order && e.area === 'imagen' && e.status !== 'listo');
  UI.rx = { files: [], busy: false }; ppReset('rx', { pid: order?.pid || el.dataset?.pid || null, existingOnly: true });
  UI.ppChanged = UI.ppChanged || {}; UI.ppChanged.rx = () => { const select = document.getElementById('rx-order'); if (select) select.innerHTML = imageOrderOptions(); };
  openSheet('Subir radiografía / estudio de imagen', `<div><b>Paciente</b><div id="pp-rx" style="margin-top:8px">${patientPicker('rx')}</div></div><div class="form"><div class="field"><label for="rx-type">Tipo de estudio</label><select class="input" id="rx-type">${Object.entries(IMAGE_TYPES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><div class="field"><label for="rx-region">Región</label><input class="input" id="rx-region" placeholder="Ej. Tórax, abdomen, rodilla derecha"></div><div class="field"><label for="rx-date">Fecha del estudio</label><input class="input" type="date" id="rx-date" value="${dAt(0)}" max="${dAt(0)}"></div><div class="field"><label for="rx-doc">Médico solicitante (opcional)</label><select class="input" id="rx-doc"><option value="">Sin médico solicitante</option>${activeDocs().map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></div><div class="field full"><label for="rx-order">Vincular a una orden de imagen (opcional)</label><select class="input" id="rx-order">${imageOrderOptions()}</select><span class="small muted">Solo órdenes pendientes del paciente elegido. Se conserva su vínculo con el ingreso o la cita y quedará con resultado.</span></div><div class="field full"><label for="rx-report">Informe (opcional)</label><textarea class="input" id="rx-report" rows="4" placeholder="Hallazgos y conclusión"></textarea></div><div class="field full"><label for="rx-files">Archivos JPG, PNG o PDF (uno o varios)</label><input class="input" type="file" id="rx-files" multiple accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" data-ch="imageFiles"><div id="rx-file-list" class="small muted"></div></div></div>`, '<span class="note" id="rx-msg" role="alert"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="imageSave">Guardar en el expediente</button>', { wide: true });
  if (order) document.getElementById('rx-order').value = order.id;
};
ACTIONS.imageFiles = el => { if (!canUploadImage() || UI.rx?.busy) return; UI.rx.files = [...el.files].map(file => ({ file, saved: null })); document.getElementById('rx-file-list').textContent = UI.rx.files.map(x => x.file.name).join(' · '); };
ACTIONS.imageSave = async btn => {
  if (!canUploadImage() || !UI.rx || UI.rx.busy) return;
  const w = UI.rx, msg = document.getElementById('rx-msg');
  const pid = ppState('rx').pid, type = val('rx-type'), region = val('rx-region').trim(), date = val('rx-date'), doc = val('rx-doc'), report = val('rx-report').trim(), orderId = val('rx-order');
  if (!pid || !pat(pid)) { msg.textContent = 'Seleccione un paciente ya registrado.'; return; }
  if (!IMAGE_TYPES[type] || !region || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > dAt(0)) { msg.textContent = 'Indique el tipo, la región y una fecha válida que no sea futura.'; return; }
  if (!w.files.length || w.files.some(x => !['image/jpeg', 'image/png', 'application/pdf'].includes(x.file.type))) { msg.textContent = 'Seleccione al menos un archivo. Solo se admiten JPG, PNG o PDF.'; return; }
  const order = orderId ? imageOrders(pid).find(e => e.id === orderId) : null;
  if (orderId && !order) { msg.textContent = 'La orden no está pendiente o pertenece a otro paciente.'; return; }
  w.busy = true; btn.disabled = true;
  const controls = [...document.querySelectorAll('#sheetBody input, #sheetBody select, #sheetBody textarea, #sheetBody button')].map(el => [el, el.disabled]); controls.forEach(([el]) => { el.disabled = true; });
  try {
    for (const entry of w.files) { if (entry.saved) continue; msg.textContent = 'Guardando ' + entry.file.name + '…'; const url = await storeFile(entry.file, entry.file.type === 'application/pdf'); if (!url) throw Error('No se pudo guardar ' + entry.file.name + '. Verifique el servidor local e intente nuevamente.'); entry.saved = { url, name: entry.file.name, type: entry.file.type }; }
    if (orderId && !imageOrders(pid).some(e => e.id === orderId)) throw Error('La orden cambió durante la carga. Revise la vinculación.');
    const before = order ? JSON.parse(JSON.stringify(order)) : null; const seq = S.exSeq; const audit = [...S.audit];
    const e = order || { id: uid('ex'), num: 'EX-' + String(S.exSeq++).padStart(4, '0'), pid, doc: doc || null, note: null, admId: null, apptId: null, date, area: 'imagen', tests: [IMAGE_TYPES[type] + ' · ' + region], priority: 'normal', notes: '', results: [], files: [] };
    e.imageStudy = { type, region, date, requestingDoc: doc || e.doc || null, uploadedBy: actor(), at: nowStamp() };
    if (!e.doc && doc) e.doc = doc;
    if (report) e.report = e.report ? e.report + '\n\n' + report : report;
    e.files = [...(e.files || []), ...w.files.map(x => x.saved)]; e.status = 'listo'; e.readyAt = nowStamp(); e.by = actor(); e.seen = false;
    if (!order) S.exams.unshift(e);
    log('Estudio de imagen cargado', e.num + ' · ' + pat(pid).name + (order ? ' · orden vinculada' : ''));
    if (!save()) { if (order) { Object.keys(order).forEach(k => delete order[k]); Object.assign(order, before); } else S.exams = S.exams.filter(x => x !== e); S.exSeq = seq; S.audit = audit; throw Error('No se pudo guardar el expediente. Revise el aviso de almacenamiento y vuelva a intentar.'); }
    if (UI.rx === w) { closeSheet(); if (route === 'pacientes') UI.patTab = 'imagenes'; render(); } toast('Estudio guardado en el expediente');
  } catch (err) { msg.textContent = err.message || 'No se pudo guardar el estudio. Intente nuevamente.'; }
  finally { w.busy = false; btn.disabled = false; controls.forEach(([el, disabled]) => { el.disabled = disabled; }); }
};
function imageGallery(e) { return `<div class="hstack" style="flex-wrap:wrap">${(e.files || []).map((f,i) => `<button class="btn" data-act="imageViewer" data-id="${e.id}" data-i="${i}" style="display:grid;gap:6px">${f.type?.startsWith('image/') ? `<img src="${safeUrl(fileSrc(f))}" alt="${esc(f.name)}" style="width:140px;height:100px;object-fit:contain;border-radius:8px">` : '<span class="pill">PDF</span>'}<span>${esc(f.name)}</span></button>`).join('')}</div>`; }
function patientImages(pid) { if (!canReadImages()) return ''; const exams = S.exams.filter(e => e.pid === pid && e.area === 'imagen').sort((a,b) => (b.imageStudy?.date || b.date).localeCompare(a.imageStudy?.date || a.date)); return imageUploadButton(pid) + `<div class="stack sec">${exams.map(e => `<div class="card"><div class="between"><div><h3>${esc(e.tests.join(', '))}</h3><p class="small muted">${fdate(e.imageStudy?.date || e.date)} · ${esc(e.imageStudy?.region || '')} · ${esc(docName(e.imageStudy?.requestingDoc || e.doc))}</p></div>${examFlagPill(e)}<button class="btn sm" data-act="openExam" data-id="${e.id}">Ver detalle</button></div>${imageGallery(e)}${e.report ? `<p style="white-space:pre-wrap">${esc(e.report)}</p>` : ''}</div>`).join('') || '<div class="empty">No hay estudios de imagen registrados.</div>'}</div>`; }
ACTIONS.imageViewer = el => {
  if (!canReadImages()) return; const e = S.exams.find(x => x.id === el.dataset.id && x.area === 'imagen'); const f = e?.files?.[+el.dataset.i]; if (!f) return;
  document.getElementById('image-viewer')?.remove(); const d = document.createElement('dialog'); d.id = 'image-viewer'; d.setAttribute('aria-label', 'Visor de estudio de imagen'); d.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:16px;border:0;background:var(--bg);color:var(--fg)';
  d.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;gap:12px"><div class="between"><b>${esc(f.name)} · ${esc(pat(e.pid).name)}</b><button class="btn" id="image-viewer-close">Cerrar visor</button></div>${f.type?.startsWith('image/') ? `<img src="${safeUrl(fileSrc(f))}" alt="${esc(f.name)}" style="width:100%;flex:1;min-height:0;object-fit:contain">` : `<iframe title="${esc(f.name)}" src="${safeUrl(fileSrc(f))}" style="width:100%;flex:1;border:0"></iframe>`}<a class="btn" href="${safeUrl(fileSrc(f))}" target="_blank" rel="noopener">Abrir archivo original</a></div>`;
  document.body.appendChild(d); d.showModal(); d.querySelector('#image-viewer-close').onclick = () => d.close(); d.addEventListener('close', () => d.remove()); d.addEventListener('keydown', event => event.stopPropagation());
};
