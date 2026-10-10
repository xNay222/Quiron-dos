// Inventario › Cargar factura de compra. La IA lee la factura (fotos) y propone los renglones; usted los revisa.
// Lo completo (producto, cantidad, lote y vencimiento) entra al inventario; lo que falta queda en la pestaña
// "Facturas por completar" para llenarlo a mano. Si la IA no está disponible, los renglones se escriben en la misma tabla.
const INVOICE_PROMPT = `Las imágenes son una FACTURA de compra de medicamentos o insumos médicos de una clínica en Venezuela.
Extrae cada renglón de producto. Lee solo lo impreso; si un dato no aparece, usa null (no lo inventes).
Responde solo con JSON:
{"proveedor": string|null, "numero": string|null, "fecha": "AAAA-MM-DD"|null, "moneda": "USD"|"VES"|null,
 "lineas": [{"nombre": string (nombre genérico o principio activo, en español), "concentracion": string|null (ej. "1 g"), "presentacion": string|null (Ampolla, Tableta, Frasco, Unidad…), "marca": string|null, "lote": string|null, "vencimiento": "AAAA-MM-DD"|null (si solo trae mes y año, el último día de ese mes), "cantidad": number|null (unidades), "costo_unitario": number|null}]}`;
const FC_NEED = { name: 'producto', qty: 'cantidad', lot: 'lote', exp: 'vencimiento' };
const fcMissing = l => Object.keys(FC_NEED).filter(k => k === 'qty' ? !(+l.qty > 0) : !String(l[k] || '').trim()).map(k => FC_NEED[k]);
const fcProd = l => S.products.find(p => p.name.toLowerCase() === String(l.name || '').trim().toLowerCase());
const fcBlank = () => ({ name: '', lot: '', exp: '', qty: '', cost: '', brand: '', unit: 'Unidad' });

ACTIONS.invoiceLoad = async el => {
  if (!can('inv.gestionar')) return;
  const pend = el?.dataset?.id ? (S.invPending || []).find(x => x.id === el.dataset.id) : null;
  const sample = await getCap('sample'); const lim = sample ? await sample.limits().catch(() => null) : null;
  UI.fcMax = Math.min(6, lim?.images?.maxCount || 0); UI.fcTypes = lim?.images?.mediaTypes || [];
  UI.fc = pend ? JSON.parse(JSON.stringify(pend)) : { id: null, sup: S.suppliers[0]?.id || '', num: '', date: dAt(0), cur: 'USD', files: [], lines: [] };
  if (!UI.fc.lines.length) UI.fc.lines.push(fcBlank());
  openSheet(pend ? `Completar factura ${pend.num || ''}` : 'Cargar factura de compra', fcBody(),
    `<span class="note" id="fc-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="invoiceSave">Agregar al inventario</button>`, { wide: true });
};
function fcBody() {
  const o = UI.fc; const ai = UI.fcMax && !o.id;
  return `<div class="form">
    <div class="field"><label for="fc-sup">Proveedor</label><select class="input" id="fc-sup" data-ch="fcHead">${S.suppliers.map(s => `<option value="${s.id}" ${s.id === o.sup ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="fc-num">Nº de factura</label><input class="input" id="fc-num" value="${esc(o.num)}" data-in="fcHead"></div>
    <div class="field"><label for="fc-date">Fecha de la factura</label><input class="input" type="date" id="fc-date" value="${o.date}" data-ch="fcHead"></div>
    <div class="field"><label for="fc-cur">Costos expresados en</label><select class="input" id="fc-cur" data-ch="fcHead"><option value="USD" ${o.cur === 'USD' ? 'selected' : ''}>Dólares</option><option value="VES" ${o.cur === 'VES' ? 'selected' : ''}>Bolívares (se convierten a tasa BCV ${S.rate.toLocaleString('es-VE', { maximumFractionDigits: 4 })})</option></select></div></div>
  ${ai ? `<div class="card" style="display:grid;gap:10px"><div><b>Leer la factura con IA</b><div class="small muted">Tome una foto de cada hoja de la factura. La IA llena la tabla y usted la revisa antes de agregar.</div></div>
    <div class="hstack"><label class="btn" for="fc-files">Tomar o elegir fotos</label><input id="fc-files" type="file" accept="${UI.fcTypes.join(',')}" multiple hidden data-ch="fcFiles"><button class="btn primary" data-act="invoiceRead" id="fc-read" ${o.files.length ? '' : 'disabled'}>Leer con IA</button><span class="small muted" id="fc-ai">${o.files.length ? o.files.length + ' foto(s)' : ''}</span></div></div>`
    : o.id ? '' : '<div class="banner">La lectura con IA estará disponible al pasar el sistema a la nube. Mientras tanto, escriba los renglones de la factura en la tabla.</div>'}
  <datalist id="fc-prods">${S.products.map(p => `<option value="${esc(p.name)}">`).join('')}</datalist>
  <div class="tablewrap"><table><thead><tr><th style="min-width:200px">Producto</th><th>Lote</th><th>Vence</th><th class="num">Cantidad</th><th class="num">Costo unit.</th><th>Estado</th><th></th></tr></thead><tbody>
  ${o.lines.map((l, i) => `<tr>
    <td><input class="input" list="fc-prods" value="${esc(l.name)}" data-in="fcCell" data-i="${i}" data-k="name" placeholder="Ej. Cefazolina 1 g" aria-label="Producto"></td>
    <td><input class="input" value="${esc(l.lot)}" data-in="fcCell" data-i="${i}" data-k="lot" style="width:120px" aria-label="Lote"></td>
    <td><input class="input" type="date" value="${esc(l.exp || '')}" data-in="fcCell" data-i="${i}" data-k="exp" aria-label="Vencimiento"></td>
    <td class="num"><input class="input" type="number" min="1" value="${esc(l.qty)}" data-in="fcCell" data-i="${i}" data-k="qty" style="width:80px" aria-label="Cantidad"></td>
    <td class="num"><input class="input" type="number" min="0" step="0.01" value="${esc(l.cost)}" data-in="fcCell" data-i="${i}" data-k="cost" style="width:90px" aria-label="Costo unitario"></td>
    <td id="fc-st${i}">${fcState(l)}</td><td><button class="btn ghost" data-act="fcDel" data-i="${i}" aria-label="Quitar renglón">✕</button></td></tr>`).join('')}
  </tbody></table></div>
  <button class="btn sm" style="justify-self:start" data-act="fcAdd">+ Agregar renglón</button>
  <div class="small muted">Se agregan al inventario los renglones completos (producto, lote, vencimiento y cantidad). Los que tengan datos faltantes quedan en Inventario › "Facturas por completar". Un producto que no existe se crea nuevo; revise su categoría y ubicación después.</div>`;
}
const fcState = l => { const m = fcMissing(l); const p = fcProd(l);
  return m.length ? `<span class="pill warn">Falta: ${m.join(', ')}</span>` : `<span class="pill good">Lista</span> <span class="pill ${p ? '' : 'info'}">${p ? 'Existe' : 'Nuevo'}</span>`; };
const fcKeep = () => { const o = UI.fc; o.sup = val('fc-sup'); o.num = val('fc-num').trim(); o.date = val('fc-date'); o.cur = val('fc-cur'); };
ACTIONS.fcHead = () => fcKeep();
ACTIONS.fcCell = el => { const l = UI.fc.lines[+el.dataset.i]; l[el.dataset.k] = el.value; const st = document.getElementById('fc-st' + el.dataset.i); if (st) st.innerHTML = fcState(l); };
ACTIONS.fcAdd = () => { fcKeep(); UI.fc.lines.push(fcBlank()); refreshSheet(fcBody()); };
ACTIONS.fcDel = el => { fcKeep(); UI.fc.lines.splice(+el.dataset.i, 1); if (!UI.fc.lines.length) UI.fc.lines.push(fcBlank()); refreshSheet(fcBody()); };
ACTIONS.fcFiles = el => { fcKeep(); UI.fc.files = [...el.files].slice(0, UI.fcMax); refreshSheet(fcBody()); };
ACTIONS.invoiceRead = async el => {
  const sample = await getCap('sample'); const ai = document.getElementById('fc-ai'); fcKeep(); el.disabled = true; ai.textContent = 'Leyendo la factura… puede tardar un minuto.';
  try {
    const j = await sample.json(INVOICE_PROMPT, { images: UI.fc.files });
    const lines = (j.lineas || []).filter(x => x && x.nombre).map(x => { const name = [x.nombre, x.concentracion].filter(Boolean).join(' ').trim();
      const ex = S.products.find(p => p.name.toLowerCase() === name.toLowerCase()) || (typeof findProduct === 'function' && findProduct(x.nombre, x.concentracion || ''));
      return { name: ex ? ex.name : name, lot: x.lote || '', exp: x.vencimiento || '', qty: x.cantidad ?? '', cost: x.costo_unitario ?? '', brand: x.marca || '', unit: x.presentacion || 'Unidad' }; });
    const o = UI.fc; if (j.numero && !o.num) o.num = j.numero; if (j.fecha) o.date = j.fecha; if (j.moneda) o.cur = j.moneda === 'VES' ? 'VES' : 'USD';
    const sup = j.proveedor && S.suppliers.find(s => s.name.toLowerCase().includes(j.proveedor.toLowerCase().split(' ')[0]));
    if (sup) o.sup = sup.id;
    o.lines = lines.length ? lines : o.lines; o.files = [];
    refreshSheet(fcBody()); const miss = o.lines.filter(l => fcMissing(l).length).length;
    document.getElementById('fc-msg').textContent = `${lines.length} renglón(es) leídos${miss ? ` · ${miss} con datos faltantes (en amarillo)` : ''}. Revíselos antes de agregar.`;
  } catch (e) { ai.textContent = { not_granted: 'No se dio permiso para usar la IA.', rate_limited: 'Demasiadas consultas; espere un momento.', image_rejected: 'No se pudo leer la foto; pruebe con otra más nítida.' }[e?.code] || 'No se pudo leer la factura. Inténtelo de nuevo o escriba los renglones.'; el.disabled = false; }
};
ACTIONS.invoiceSave = () => {
  fcKeep(); const o = UI.fc; const msg = document.getElementById('fc-msg');
  const lines = o.lines.filter(l => Object.values(l).some(v => String(v || '').trim() && v !== 'Unidad'));
  if (!lines.length) { msg.textContent = 'Agregue al menos un renglón.'; return; }
  const ok = lines.filter(l => !fcMissing(l).length), rest = lines.filter(l => fcMissing(l).length);
  const rate = o.cur === 'VES' ? S.rate : 1; const ref = `Factura ${o.num || 's/n'} · ${sup(o.sup)?.name || ''}`;
  ok.forEach(l => { let p = fcProd(l);
    if (!p) { p = { id: uid('p'), name: l.name.trim(), cat: 'Medicamento', unit: l.unit || 'Unidad', min: 0, lots: [] }; S.products.push(p); log('Producto creado desde factura', p.name); }
    addLot(p.id, { num: l.lot.trim(), qty: Math.round(+l.qty), cost: r2((+l.cost || 0) / rate), exp: l.exp, sup: o.sup, brand: (l.brand || '').trim() }, ref); });
  S.invPending = (S.invPending || []).filter(x => x.id !== o.id);
  if (rest.length) S.invPending.push({ id: o.id || uid('fp'), sup: o.sup, num: o.num, date: o.date, cur: o.cur, files: [], lines: rest, at: o.at || nowStamp() });
  log('Factura de compra cargada', `${ref} · ${ok.length} renglón(es) al inventario${rest.length ? ` · ${rest.length} por completar` : ''}`); save();
  closeSheet(); if (rest.length) UI.invTab = 'facturas'; render();
  toast(rest.length ? `${ok.length} agregado(s) · ${rest.length} quedan por completar` : `${ok.length} renglón(es) agregados al inventario`);
};
// Pestaña de Inventario con las facturas que quedaron con renglones incompletos
function invPendingTab() {
  const l = S.invPending || [];
  return `<div class="stack">${l.map(x => `<div class="card"><div class="between" style="gap:10px;flex-wrap:wrap"><div><b>Factura ${esc(x.num || 's/n')} · ${esc(sup(x.sup)?.name || '')}</b><div class="small muted">${fdate(x.date)} · cargada ${x.at} · ${x.lines.length} renglón(es) por completar</div></div>
    <div class="hstack"><button class="btn sm danger" data-act="invoiceDrop" data-id="${x.id}">Descartar</button><button class="btn sm primary" data-act="invoiceLoad" data-id="${x.id}">Completar</button></div></div>
    <div class="small" style="margin-top:8px">${x.lines.map(r => `${esc(r.name || '(sin producto)')} · <span style="color:var(--warn)">falta ${fcMissing(r).join(', ')}</span>`).join('<br>')}</div></div>`).join('') || '<div class="card empty">No hay facturas por completar.</div>'}</div>`;
}
ACTIONS.invoiceDrop = el => openSheet('Descartar renglones pendientes', '<p style="margin:0">Los renglones que faltaban por completar de esta factura no se agregarán al inventario.</p>',
  `<button class="btn" data-act="close">Cancelar</button><button class="btn danger" data-act="invoiceDropSave" data-id="${el.dataset.id}">Descartar</button>`);
ACTIONS.invoiceDropSave = el => { const x = (S.invPending || []).find(y => y.id === el.dataset.id); S.invPending = (S.invPending || []).filter(y => y !== x);
  if (x) log('Renglones de factura descartados', `Factura ${x.num || 's/n'} · ${x.lines.length}`); save(); closeSheet(); render(); toast('Descartados'); };
