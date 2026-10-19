// Plantillas de órdenes (indicaciones posoperatorias o de ingreso por tipo de caso), editables.
// Una plantilla es una lista de medicamentos con dosis y vía, frecuencia, días y cantidad a pedir al almacén, más cuidados
// generales. Al aplicarla en un ingreso se revisa todo (se puede cambiar o quitar cada línea) y se crean de una vez las
// indicaciones para enfermería y la solicitud al almacén. S.orderTemplates guarda las plantillas.

const canTplEdit = () => isClin() || role() === 'admin';
const tplList = () => (S.orderTemplates = S.orderTemplates || []);
const tplBlankLine = () => ({ pidProd: '', med: '', dose: '', freq: '', days: '', qty: 0, note: '' });
// Borrador inicial: los medicamentos que más se indican tras las cirugías de la clínica (según las historias), sin dosis
function seedTemplates() {
  if ((S.orderTemplates || []).length || S.tplSeeded) return;
  const pick = re => S.products.find(p => p.cat === 'Medicamento' && re.test(p.name));
  const lines = [/^Ceftriaxona/i, /^Ketoprofeno 100 mg\/2/i, /^Dipirona/i, /^Ondansetr/i, /^Omeprazol/i].map(re => pick(re)).filter(Boolean)
    .map(p => ({ ...tplBlankLine(), pidProd: p.id, med: p.name }));
  S.orderTemplates = [{ id: uid('tp'), name: 'Posoperatorio cirugía plástica (borrador: completar dosis y frecuencia)', lines, care: 'Dieta según tolerancia. Deambulación precoz. Vigilar sangrado y signos vitales.', updatedAt: nowStamp(), by: 'Borrador del sistema' }];
  S.tplSeeded = true;
}

// ---------- Administrar plantillas ----------
ACTIONS.tplList = () => {
  seedTemplates();
  openSheet('Plantillas de órdenes', `<div class="small muted">Cada plantilla trae los medicamentos y cuidados habituales de un tipo de caso. Al aplicarla en un ingreso se revisa y se ajusta antes de enviar.</div>
    <div class="list">${tplList().map(t => `<div class="row"><div class="grow"><div class="t">${esc(t.name)}</div><div class="s">${t.lines.length} medicamento(s) · ${esc(t.lines.map(l => l.med).join(', ')).slice(0, 140)}</div><div class="s">Editada ${esc(t.updatedAt)} · ${esc(t.by || '')}</div></div>
      ${canTplEdit() ? `<div class="hstack"><button class="btn sm" data-act="tplEdit" data-id="${t.id}">Editar</button><button class="btn sm" data-act="tplDup" data-id="${t.id}">Duplicar</button></div>` : ''}</div>`).join('') || '<div class="empty">Todavía no hay plantillas.</div>'}</div>`,
    `<button class="btn" data-act="close">Cerrar</button>${canTplEdit() ? '<button class="btn primary" data-act="tplEdit">Nueva plantilla</button>' : ''}`, { wide: true });
};
ACTIONS.tplDup = el => { const t = tplList().find(x => x.id === el.dataset.id); const c = JSON.parse(JSON.stringify(t)); c.id = uid('tp'); c.name = t.name + ' (copia)'; c.updatedAt = nowStamp(); c.by = actor(); tplList().push(c); save(); ACTIONS.tplEdit({ dataset: { id: c.id } }); };
ACTIONS.tplEdit = el => {
  if (!canTplEdit()) return; const t = el?.dataset?.id ? tplList().find(x => x.id === el.dataset.id) : null;
  UI.tpl = t ? JSON.parse(JSON.stringify(t)) : { id: null, name: '', lines: [tplBlankLine()], care: '' };
  openSheet(t ? 'Editar plantilla' : 'Nueva plantilla', tplForm(), tplFoot(), { wide: true });
};
const tplFoot = () => `<span class="note" id="tp-msg"></span>${UI.tpl.id ? `<button class="btn danger" data-act="tplDel" data-id="${UI.tpl.id}">Eliminar</button>` : ''}<button class="btn" data-act="tplList">Volver</button><button class="btn primary" data-act="tplSave">Guardar plantilla</button>`;
const tplLineFields = (l, i, pre) => `<div class="tpl-line">
    <div class="field" style="grid-column:1/-1"><label for="${pre}m${i}">Medicamento</label>${i === 0 ? prodList(pre + 'list', medProducts(false)) : ''}<input class="input" id="${pre}m${i}" list="${pre}list" value="${esc(l.med)}" placeholder="Busque en el inventario o escriba" autocomplete="off"></div>
    <div class="field"><label for="${pre}d${i}">Dosis y vía</label><input class="input" id="${pre}d${i}" value="${esc(l.dose)}" placeholder="Ej. 1 g endovenoso"></div>
    <div class="field"><label for="${pre}f${i}">Frecuencia</label><select class="input" id="${pre}f${i}"><option value="">Elija…</option>${IND_FREQS.map(f => `<option ${f === l.freq ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
    <div class="field"><label for="${pre}y${i}">Días</label><input class="input" type="number" min="1" id="${pre}y${i}" value="${esc(l.days || '')}" placeholder="Hasta nuevo aviso"></div>
    <div class="field"><label for="${pre}q${i}">Pedir al almacén</label><input class="input" type="number" min="0" id="${pre}q${i}" value="${esc(l.qty || '')}" placeholder="0 = no pedir"></div>
    <div class="field" style="grid-column:1/-1"><label for="${pre}n${i}">Observación</label><input class="input" id="${pre}n${i}" value="${esc(l.note || '')}" placeholder="Ej. diluir en 100 ml, pasar en 30 min"></div>
  </div>`;
function tplForm() { const t = UI.tpl;
  return `<div class="field"><label for="tp-name">Nombre de la plantilla</label><input class="input" id="tp-name" value="${esc(t.name)}" placeholder="Ej. Posoperatorio mamoplastia"></div>
  ${t.lines.map((l, i) => `<div class="card tpl-card"><div class="between"><b>Medicamento ${i + 1}</b><button class="btn sm" data-act="tplLineDel" data-i="${i}">Quitar</button></div>${tplLineFields(l, i, 'tp-')}</div>`).join('')}
  <button class="btn sm" style="justify-self:start" data-act="tplLineAdd">+ Agregar medicamento</button>
  <div class="field"><label for="tp-care">Cuidados generales (dieta, reposo, vigilancia…)</label><textarea class="input" id="tp-care" rows="3">${esc(t.care || '')}</textarea></div>`; }
function tplKeepLines(lines, pre) {
  lines.forEach((l, i) => { const g = k => document.getElementById(pre + k + i);
    if (g('m')) { l.med = g('m').value.trim(); const p = pickProd(l.med, medProducts(false)); l.pidProd = p?.id || ''; if (p) l.med = p.name; }
    if (g('d')) l.dose = g('d').value.trim(); if (g('f')) l.freq = g('f').value; if (g('y')) l.days = g('y').value; if (g('q')) l.qty = Math.max(0, Math.round(+g('q').value || 0)); if (g('n')) l.note = g('n').value.trim(); });
}
const tplKeep = () => { const t = UI.tpl; t.name = val('tp-name').trim(); t.care = val('tp-care').trim(); tplKeepLines(t.lines, 'tp-'); };
ACTIONS.tplLineAdd = () => { tplKeep(); UI.tpl.lines.push(tplBlankLine()); refreshSheet(tplForm()); };
ACTIONS.tplLineDel = el => { tplKeep(); UI.tpl.lines.splice(+el.dataset.i, 1); refreshSheet(tplForm()); };
ACTIONS.tplSave = () => {
  tplKeep(); const t = UI.tpl; const msg = document.getElementById('tp-msg');
  if (!t.name) { msg.textContent = 'Póngale un nombre a la plantilla.'; return; }
  t.lines = t.lines.filter(l => l.med); if (!t.lines.length && !t.care) { msg.textContent = 'Agregue al menos un medicamento o los cuidados.'; return; }
  const data = { name: t.name, lines: t.lines, care: t.care, updatedAt: nowStamp(), by: actor() };
  if (t.id) Object.assign(tplList().find(x => x.id === t.id), data); else tplList().push({ id: uid('tp'), ...data });
  log(t.id ? 'Plantilla de órdenes editada' : 'Plantilla de órdenes creada', t.name); save(); toast('Plantilla guardada'); ACTIONS.tplList();
};
ACTIONS.tplDel = el => { const t = tplList().find(x => x.id === el.dataset.id); S.orderTemplates = tplList().filter(x => x !== t); log('Plantilla de órdenes eliminada', t.name); save(); toast('Plantilla eliminada'); ACTIONS.tplList(); };

// ---------- Aplicar en un ingreso ----------
ACTIONS.tplApply = el => {
  if (!isClin()) { toast('Las indicaciones las deja un médico o residente'); return; }
  seedTemplates(); const a = admOf(el.dataset.id); if (!tplList().length) { toast('Todavía no hay plantillas: créelas en "Plantillas de órdenes"'); return; }
  UI.tpa = { admId: a.id, tplId: tplList()[0].id, lines: [], care: '', send: true, reqDoc: myDoc() || '' }; tpaLoad();
  openSheet(`Aplicar plantilla · ${pat(a.pid).name}`, tpaForm(), `<span class="note" id="ta-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="tplApplySave">Aplicar</button>`, { wide: true });
};
const tpaLoad = () => { const t = tplList().find(x => x.id === UI.tpa.tplId); UI.tpa.lines = JSON.parse(JSON.stringify(t.lines)).map(l => ({ ...l, on: true })); UI.tpa.care = t.care || ''; };
function tpaForm() { const o = UI.tpa; const a = admOf(o.admId);
  return `${patientBand(a.pid, a.bed)}<div class="field"><label for="ta-t">Plantilla</label><select class="input" id="ta-t" data-ch="tpaPick">${tplList().map(t => `<option value="${t.id}" ${t.id === o.tplId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
  <div class="small muted">Revise y ajuste cada línea para este paciente. Lo que cambie aquí no modifica la plantilla.</div>
  ${o.lines.map((l, i) => `<div class="card tpl-card${l.on ? '' : ' off'}"><label class="hstack"><input type="checkbox" data-ch="tpaOn" data-i="${i}" ${l.on ? 'checked' : ''}> <b>${esc(l.med || 'Medicamento')}</b>${l.pidProd ? ` <span class="small muted">· en piso ${floorUnits(a.id, l.pidProd)} · almacén ${usable(prod(l.pidProd))}</span>` : ' <span class="small muted">· no está en el inventario</span>'}</label>${l.on ? tplLineFields(l, i, 'ta-') : ''}</div>`).join('')}
  <div class="field"><label for="ta-care">Cuidados generales</label><textarea class="input" id="ta-care" rows="2">${esc(o.care)}</textarea></div>
  <label class="hstack small"><input type="checkbox" id="ta-send" ${o.send ? 'checked' : ''}> Enviar al almacén la solicitud con las cantidades indicadas</label>
  <div class="field"><label for="ta-dr">Médico que indica</label><select class="input" id="ta-dr"><option value="">Seleccione…</option>${docOptGroups(o.reqDoc)}</select></div>`; }
const tpaKeep = () => { const o = UI.tpa; tplKeepLines(o.lines, 'ta-'); o.care = val('ta-care').trim(); o.send = !!document.getElementById('ta-send')?.checked; o.reqDoc = val('ta-dr'); };
ACTIONS.tpaPick = el => { tpaKeep(); UI.tpa.tplId = el.value; tpaLoad(); refreshSheet(tpaForm()); };
ACTIONS.tpaOn = el => { tpaKeep(); UI.tpa.lines[+el.dataset.i].on = el.checked; refreshSheet(tpaForm()); };
ACTIONS.tplApplySave = () => {
  tpaKeep(); const o = UI.tpa; const a = admOf(o.admId); const msg = document.getElementById('ta-msg'); const on = o.lines.filter(l => l.on && l.med);
  if (!on.length && !o.care) { msg.textContent = 'No hay nada marcado para aplicar.'; return; }
  const bad = on.findIndex(l => !l.freq); if (bad >= 0) { msg.textContent = `Elija la frecuencia de ${on[bad].med}.`; return; }
  if (!med(o.reqDoc)) { msg.textContent = 'Elija el médico que indica.'; return; }
  S.indications = S.indications || []; const start = nowStamp(); const tpl = tplList().find(x => x.id === o.tplId);
  on.forEach(l => S.indications.push({ id: uid('in'), admId: a.id, pid: a.pid, pidProd: l.pidProd || null, med: l.med, dose: l.dose, freq: l.freq, days: Math.round(+l.days) || null, note: l.note, doc: o.reqDoc, byName: actor(), at: start, start, status: 'activa', tpl: tpl?.name }));
  if (o.care) S.indications.push({ id: uid('in'), admId: a.id, pid: a.pid, pidProd: null, med: 'Cuidados generales', dose: '', freq: 'Según necesidad', days: null, note: o.care, doc: o.reqDoc, byName: actor(), at: start, start, status: 'activa', tpl: tpl?.name });
  const items = on.filter(l => o.send && l.pidProd && l.qty > 0).map(l => ({ pid: l.pidProd, qty: l.qty, req: l.qty, dose: l.dose || doseOf(prod(l.pidProd)), freq: l.freq, ind: l.note || '' }));
  let num = '';
  if (items.length) { const mo = { id: uid('mo'), num: 'SM-' + String(S.moSeq++).padStart(4, '0'), kind: 'hosp', admId: a.id, apptId: null, pid: a.pid, by: myDoc() || actor(), reqDoc: med(o.reqDoc).name, reqDocId: o.reqDoc,
      dutyDoc: dutyOf(dAt(0)).doc || null, dutyName: dutyDocName(), at: nowStamp(), urgent: false, note: `Plantilla: ${tpl?.name || ''}`, status: 'pendiente', items };
    S.medOrders.push(mo); num = mo.num; }
  log('Plantilla de órdenes aplicada', `${pat(a.pid).name} · ${tpl?.name} · ${on.length} indicación(es)${num ? ' · solicitud ' + num : ''}`); save(); closeSheet(); UI.hospTab = 'indicaciones'; render();
  toast(`${on.length} indicación(es) creadas${num ? ` · ${num} enviada al almacén` : ''}`);
};
