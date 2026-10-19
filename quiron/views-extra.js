// Inventario: cambiar la ubicación de un producto con listas simples, y la "solicitud extraordinaria" del almacén
// (sacar algo sin orden previa del médico, dejando el motivo, el médico que atendía y el paciente).

// ---------- Cambiar ubicación (sector · estantería · nivel · recipiente) ----------
function locForm() {
  const o = UI.loc; const p = prod(o.pid); const lot = o.lid ? p.lots.find(l => l.id === o.lid) : null;
  const shelves = SHELVES.filter(s => +s.sector === +o.sector);
  const preview = o.sector ? [sectorOf(o.sector).name, spotText({ shelf: o.shelf, level: o.level, bin: o.bin, spot: o.spot })].filter(Boolean).join(' · ') : 'Sin ubicación';
  return `<div class="small muted">${lot ? `Lote ${esc(lot.num)} · ${lot.qty} ${esc(p.unit.toLowerCase())}(s) · ` : ''}Ubicación actual: <b style="color:var(--fg)">${esc((lot ? locTextOf(lotLoc(p, lot)) : locText(p)) || 'sin asignar')}</b></div>
  ${lot ? `<div class="banner"><span>Mueve solo este lote. Si mueve una parte, el resto se queda donde está.${p.loc?.sector && lot.loc?.sector ? ` <button class="btn sm" data-act="locToMain">Devolver a la ubicación principal (${esc(locText(p))})</button>` : ''}</span></div>` : ''}
  <div class="form">${lot ? `<div class="field"><label for="lc-q">Cantidad a mover</label><input class="input" type="number" id="lc-q" min="1" max="${lot.qty}" value="${o.qty || lot.qty}"></div>` : ''}
    <div class="field"><label for="lc-s">Sector</label><select class="input" id="lc-s" data-ch="locRedraw"><option value="">Elija el sector…</option>${SECTORS.map(s => `<option value="${s.id}" ${+o.sector === s.id ? 'selected' : ''}>${s.name} · ${s.desc}</option>`).join('')}</select></div>
    <div class="field"><label for="lc-e">Estantería</label><select class="input" id="lc-e" data-ch="locRedraw" ${o.sector ? '' : 'disabled'}><option value="">${shelves.length ? 'Sin estantería (en el piso o suelto)' : 'Este sector no tiene estanterías'}</option>${shelves.map(s => `<option value="${s.id}" ${o.shelf === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
    <div class="field"><label for="lc-l">Nivel</label><select class="input" id="lc-l" data-ch="locRedraw" ${o.shelf ? '' : 'disabled'}><option value="">${o.shelf ? 'Elija el nivel…' : '—'}</option>${o.shelf ? levelsOf(o.shelf).map(n => `<option value="${n}" ${+o.level === n ? 'selected' : ''}>${levelCode(o.shelf, n)}${shelfOf(o.shelf).levelNames?.[n] ? ' · ' + shelfOf(o.shelf).levelNames[n] : n === 1 ? ' · arriba' : ''}</option>`).join('') : ''}</select></div>
    <div class="field"><label for="lc-b">Recipiente o caja nº (opcional)</label><input class="input" id="lc-b" inputmode="numeric" value="${esc(o.bin)}" ${o.shelf ? '' : 'disabled'}></div>
    <div class="field full"><label for="lc-d">Detalle (opcional)</label><input class="input" id="lc-d" placeholder="Ej. al fondo, caja azul" value="${esc(o.spot)}"></div></div>
  <div class="banner"><span>Quedará en: <b>${esc(preview)}</b></span></div>`;
}
const locKeep = () => { const o = UI.loc; const g = id => document.getElementById(id);
  const s = g('lc-s')?.value || ''; if (s !== String(o.sector || '')) { o.sector = s ? +s : ''; o.shelf = ''; o.level = ''; }
  else { const e = g('lc-e')?.value || ''; if (e !== (o.shelf || '')) { o.shelf = e; o.level = ''; } else o.level = g('lc-l')?.value ? +g('lc-l').value : ''; }
  o.bin = g('lc-b')?.value.trim() || ''; o.spot = g('lc-d')?.value.trim() || ''; if (g('lc-q')) o.qty = Math.round(+g('lc-q').value || 0); };
ACTIONS.locEdit = el => {
  if (!can('inv.gestionar')) return;
  const p = prod(el.dataset.id); const lot = el.dataset.l ? p.lots.find(x => x.id === el.dataset.l) : null; const l = lot ? lotLoc(p, lot) : p.loc || {};
  UI.loc = { pid: p.id, lid: lot?.id || null, qty: lot?.qty || 0, sector: l.sector || '', shelf: l.shelf || '', level: l.level || '', bin: l.bin || '', spot: l.spot || '' };
  openSheet(lot ? `Mover lote ${lot.num} · ${p.name}` : `Cambiar ubicación · ${p.name}`, locForm(), `<span class="note" id="lc-msg"></span><button class="btn" data-act="openProduct" data-id="${p.id}">Cancelar</button><button class="btn primary" data-act="locSave">Guardar ubicación</button>`);
};
ACTIONS.locRedraw = () => { locKeep(); refreshSheet(locForm()); };
ACTIONS.locSave = () => {
  locKeep(); const o = UI.loc; const p = prod(o.pid); const msg = document.getElementById('lc-msg');
  if (!o.sector) { msg.textContent = 'Elija el sector.'; return; }
  if (o.shelf && !o.level) { msg.textContent = 'Elija el nivel de la estantería.'; return; }
  const loc = { sector: +o.sector, shelf: o.shelf || null, level: o.shelf ? +o.level : null, bin: o.shelf ? o.bin : '', spot: o.spot };
  if (o.lid) { if (!moveLot(p, o.lid, loc, o.qty, msg)) return; }
  else { const before = locText(p) || 'sin ubicación'; p.loc = loc;
    log('Ubicación cambiada', `${p.name}: ${before} → ${locText(p)}`); save(); toast(`${p.name}: ${locText(p)}`); }
  ACTIONS.openProduct({ dataset: { id: p.id } }); render();
};

// Mover un lote (o parte) a otro sitio. Si va a la ubicación principal, deja de tener ubicación propia.
// Una parte se separa en un lote nuevo con el mismo número, vencimiento y costo.
function moveLot(p, lid, loc, qty, msg) {
  const l = p.lots.find(x => x.id === lid); if (!l) return false;
  if (!(qty >= 1 && qty <= l.qty)) { if (msg) msg.textContent = 'Indique entre 1 y ' + l.qty + '.'; return false; }
  const before = locTextOf(lotLoc(p, l)) || 'sin ubicación';
  let target = l;
  if (qty < l.qty) { target = { ...l, id: uid('l'), qty }; delete target.photos; l.qty -= qty; p.lots.push(target); }
  if (locKeyOf(loc) === locKeyOf(p.loc || {})) delete target.loc; else target.loc = loc;
  // Si quedan dos partes del mismo lote en el mismo sitio, se vuelven a juntar
  const twin = p.lots.find(x => x !== target && x.num === target.num && x.exp === target.exp && x.cost === target.cost && locKeyOf(lotLoc(p, x)) === locKeyOf(lotLoc(p, target)));
  if (twin) { twin.qty += target.qty; p.lots = p.lots.filter(x => x !== target); }
  const now = locTextOf(lotLoc(p, twin || target));
  log('Lote movido', p.name + ' · lote ' + l.num + ' · ' + qty + ' u.: ' + before + ' → ' + now); save();
  toast('Lote ' + l.num + ': ' + qty + ' → ' + now); return true;
}
ACTIONS.locToMain = () => { locKeep(); const o = UI.loc; const p = prod(o.pid);
  if (moveLot(p, o.lid, { ...p.loc }, o.qty, document.getElementById('lc-msg'))) { ACTIONS.openProduct({ dataset: { id: p.id } }); render(); } };

// ---------- Solicitud extraordinaria (almacén) ----------
// Para cuando el almacén entrega algo sin que el médico lo haya pedido en el sistema (p. ej. una urgencia en quirófano).
// Sale del inventario al guardar (primero el lote que vence antes) y queda como una solicitud despachada, ligada al
// paciente (y a su ingreso o su cirugía si los tiene), con el motivo, el médico que atendía y quién la registró.
const XR_MOTIVES = ['Cirugía', 'Hospitalización', 'Emergencia', 'Consulta', 'Otro'];
// Ingreso activo o cirugía cercana del paciente, para que lo entregado cuente en su episodio
const xrLink = (pid, motive) => {
  if (!pid) return {};
  if (motive === 'Hospitalización' || motive === 'Emergencia') { const a = (S.admissions || []).find(x => x.pid === pid && x.status === 'ingresado'); return a ? { admId: a.id, label: `Se suma a su ingreso (cama ${a.bed})` } : {}; }
  if (motive === 'Cirugía') { const q = S.appts.filter(x => x.kind === 'cirugia' && x.pid === pid && isActive(x) && x.date >= dAt(-2) && x.date <= dAt(1)).sort((a, b) => Math.abs(daysTo(a.date)) - Math.abs(daysTo(b.date)))[0];
    return q ? { apptId: q.id, label: `Se suma a su cirugía: ${q.proc} (${fdate(q.date)} ${q.time})` } : {}; }
  return {};
};
function xrForm() {
  const o = UI.xr; const pid = ppState('xr').pid; const link = xrLink(pid, o.motive);
  return `<div class="banner warn"><span>Use esta opción solo cuando entregue algo <b>sin orden del médico</b> en el sistema. Queda registrado con su nombre, la hora y el motivo, y Administración lo revisa.</span></div>
  ${sheetStep(1, '¿Qué sale del almacén?')}${prodList('xr-list', S.products)}
  <div class="stack">${o.items.map((it, i) => { const p = prod(it.pid); return `<div class="card" style="display:grid;gap:10px;padding:12px 14px">
    <div class="morow2">${prodPicker('xr-p' + i, it.pid, 'xr-list', 'xrProd', `data-i="${i}"`)}<button class="btn ghost" data-act="xrDel" data-i="${i}" aria-label="Quitar">✕</button></div>
    <div class="hstack"><span class="small muted">Cantidad</span>${stepper('xr-q' + i, it.qty, 'xrQty', `data-i="${i}"`, 1, Math.max(1, p ? usable(p) : 99))}<span class="small muted">${p ? `${esc(p.unit || '')} · hay ${usable(p)} en almacén` : ''}</span></div></div>`; }).join('')}</div>
  <button class="btn sm" style="justify-self:start" data-act="xrAdd">+ Agregar otro producto</button>
  ${sheetStep(2, '¿Para qué fue?')}<div class="seg" role="group" aria-label="Motivo">${XR_MOTIVES.map(m => `<button data-act="xrMotive" data-m="${m}" aria-pressed="${o.motive === m}">${m}</button>`).join('')}</div>
  ${o.motive === 'Otro' ? `<div class="field"><label for="xr-o">¿Cuál? <span style="color:var(--bad)">*</span></label><input class="input" id="xr-o" value="${esc(o.other)}" placeholder="Ej. curación en consultorio"></div>` : ''}
  ${sheetStep(3, '¿Qué médico estaba atendiendo?')}<div class="field"><label for="xr-d">Médico <span style="color:var(--bad)">*</span></label><select class="input" id="xr-d"><option value="">Seleccione el médico…</option>${docOptGroups(o.doc)}</select></div>
  ${sheetStep(4, '¿Para qué paciente?')}<div id="pp-xr">${patientPicker('xr')}</div>
  ${link.label ? `<div class="small muted">${esc(link.label)}.</div>` : ''}
  ${sheetStep(5, 'Nota (opcional)')}<div class="field"><label for="xr-n">¿Por qué no hubo orden del médico?</label><input class="input" id="xr-n" value="${esc(o.note)}" placeholder="Ej. urgencia en quirófano; el médico lo pidió de palabra"></div>`;
}
const xrKeep = () => { const o = UI.xr; const g = id => document.getElementById(id);
  if (g('xr-o')) o.other = g('xr-o').value; if (g('xr-d')) o.doc = g('xr-d').value; if (g('xr-n')) o.note = g('xr-n').value; };
const xrRedraw = () => { xrKeep(); refreshSheet(xrForm()); };
ACTIONS.extraReq = el => {
  if (!can('inv.extra')) return;
  if (!S.products.length) { toast('Todavía no hay productos en el inventario'); return; }
  UI.xr = { items: [{ pid: el?.dataset?.id || '', qty: 1 }], motive: '', other: '', doc: '', note: '' };
  ppReset('xr', { existingOnly: true }); UI.ppChanged = { ...(UI.ppChanged || {}), xr: () => { if (document.getElementById('xr-d')) xrRedraw(); } };
  openSheet('Solicitud extraordinaria', xrForm(), `<span class="note" id="xr-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="xrSave">Registrar y sacar del almacén</button>`, { wide: true });
};
ACTIONS.xrProd = el => { const p = pickProd(el.value, S.products); if (!p) { if (el.value.trim()) toast('Elija un producto de la lista'); el.value = el.dataset.prev || ''; return; }
  const it = UI.xr.items[+el.dataset.i]; it.pid = p.id; it.qty = Math.min(it.qty, Math.max(1, usable(p))); xrRedraw(); };
ACTIONS.xrQty = el => { const it = UI.xr.items[+el.dataset.i]; const p = prod(it.pid); it.qty = Math.max(1, Math.min(p ? Math.max(1, usable(p)) : 99, it.qty + +el.dataset.d)); xrRedraw(); };
ACTIONS.xrAdd = () => { xrKeep(); UI.xr.items.push({ pid: '', qty: 1 }); xrRedraw(); document.getElementById('xr-p' + (UI.xr.items.length - 1))?.focus(); };
ACTIONS.xrDel = el => { xrKeep(); UI.xr.items.splice(+el.dataset.i, 1); xrRedraw(); };
ACTIONS.xrMotive = el => { xrKeep(); UI.xr.motive = el.dataset.m; xrRedraw(); };
ACTIONS.xrSave = () => {
  xrKeep(); const o = UI.xr; const msg = document.getElementById('xr-msg');
  if (!o.items.length) { msg.textContent = 'Agregue al menos un producto.'; return; }
  const blank = o.items.findIndex(it => !prod(it.pid)); if (blank >= 0) { msg.textContent = 'Busque y elija el producto de cada línea, o quítela con ✕.'; document.getElementById('xr-p' + blank)?.focus(); return; }
  const need = {}; o.items.forEach(it => { need[it.pid] = (need[it.pid] || 0) + it.qty; });
  const short = Object.entries(need).find(([pid, q]) => usable(prod(pid)) < q); if (short) { msg.textContent = `De ${prod(short[0]).name} solo hay ${usable(prod(short[0]))} disponibles.`; return; }
  if (!o.motive) { msg.textContent = 'Elija para qué fue (cirugía, hospitalización, emergencia…).'; return; }
  if (o.motive === 'Otro' && !o.other.trim()) { msg.textContent = 'Escriba cuál fue el motivo.'; document.getElementById('xr-o')?.focus(); return; }
  if (!med(o.doc)) { msg.textContent = 'Elija el médico que estaba atendiendo.'; document.getElementById('xr-d')?.focus(); return; }
  const who = pickerCommit('xr'); if (!who.ok) { msg.textContent = who.msg; return; }
  const motive = o.motive === 'Otro' ? o.other.trim() : o.motive; const link = xrLink(who.pid, o.motive);
  const items = Object.entries(need).map(([pid, qty]) => ({ pid, qty, req: qty, dose: doseOf(prod(pid)), freq: '', ind: '' }));
  const mo = { id: uid('mo'), num: 'SM-' + String(S.moSeq++).padStart(4, '0'), kind: 'extra', extra: true, motive, admId: link.admId || null, apptId: link.apptId || null, pid: who.pid,
    by: actor(), reqDoc: med(o.doc).name, reqDocId: o.doc, at: nowStamp(), urgent: false, note: [o.note.trim() && `Sin orden del médico: ${o.note.trim()}`].filter(Boolean).join(''), status: 'pendiente', items };
  S.medOrders.push(mo);
  const r = dispatchMedOrder(mo.id);
  if (!r.ok) { S.medOrders.splice(S.medOrders.indexOf(mo), 1); S.moSeq--; msg.textContent = r.msg || 'No hay existencia suficiente.'; return; }
  log('Solicitud extraordinaria', `${mo.num} · ${motive} · ${pat(who.pid).name} · ${mo.reqDoc} · ${items.map(i => prod(i.pid).name + ' ×' + i.qty).join(', ')}`); save();
  closeSheet(); UI.invTab = 'ordenes'; render(); renderSide(); toast(`${mo.num} registrada · salió del inventario`);
};
// Historial en la pestaña "Órdenes pendientes" del inventario
window.extraHistory = () => {
  const list = (S.medOrders || []).filter(o => o.kind === 'extra').sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
  if (!list.length) return '';
  return `<div class="sec"><h3>Solicitudes extraordinarias <span class="muted small" style="font-weight:400">(sin orden previa del médico)</span></h3><div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Nº</th><th>Motivo</th><th>Paciente</th><th>Médico que atendía</th><th>Productos</th><th>Registró</th></tr></thead><tbody>
    ${list.map(o => `<tr><td class="muted">${esc(o.at)}</td><td class="mono">${esc(o.num)}</td><td><span class="pill warn">${esc(o.motive)}</span></td><td>${esc(pat(o.pid)?.name || '')}</td><td>${esc(o.reqDoc)}</td>
      <td>${o.items.map(it => `${esc(prod(it.pid)?.name || '')} ×${it.qty}`).join('<br>')}${o.note ? `<div class="small muted">${esc(o.note)}</div>` : ''}</td><td class="muted">${esc(o.dispatchedBy || o.by)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
};
