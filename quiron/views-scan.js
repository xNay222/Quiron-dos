// Código de barras en el inventario.
// · Leer: con la cámara del teléfono o computadora (BarcodeDetector nativo; si no existe, ZXing) o con un lector USB,
//   que escribe el código como un teclado y termina en Enter.
// · Las cajas suelen traer el código del fabricante (EAN-13) y a veces un DataMatrix GS1 con lote y vencimiento.
//   La primera vez se asocia el código al producto (p.barcodes); desde entonces escanear abre el producto.
// · Lo que no trae código lleva una etiqueta propia "Q-<id del producto>" impresa desde aquí (Code 128).

const SCAN_LIB = { zxing: 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js', jsbarcode: 'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js' };
// Huella (SRI) de cada librería: si el CDN la cambiara o la alterara alguien, el navegador se niega a ejecutarla
const SCAN_SRI = { [SCAN_LIB.zxing]: 'sha384-BzBxP10ZE72aitqj5UMmUsbKFliP/DZqA8Wq+BNNhlIJDGoEd1tpkMYXOg9+n6sB', [SCAN_LIB.jsbarcode]: 'sha384-Kk5SjBOKprEnGfyBWfD2zROFd1Cu8kwOXxG2GIhYPcoDL2rBJS9P8Ud1ZMy4412a' };
const libLoaded = {};
const loadLib = url => libLoaded[url] || (libLoaded[url] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = url; if (SCAN_SRI[url]) { s.integrity = SCAN_SRI[url]; s.crossOrigin = 'anonymous'; } s.referrerPolicy = 'no-referrer'; s.onload = ok; s.onerror = () => { delete libLoaded[url]; no(new Error('sin conexión')); }; document.head.appendChild(s); }));
const canBarcode = () => can('inv.gestionar') || can('*');
const codeKey = c => { c = String(c || '').trim(); return /^\d+$/.test(c) ? c.replace(/^0+/, '') : c.toUpperCase(); };
const labelCode = p => 'Q-' + p.id.toUpperCase();

// GS1 (DataMatrix o GS1-128): (01) GTIN · (17) vencimiento AAMMDD · (10) lote. Acepta separador GS o paréntesis.
function parseGS1(raw) {
  let s = String(raw || '').replace(/^\]d2|^\]C1|^\]Q3/, '');
  if (/\(\d{2}\)/.test(s)) s = s.replace(/\((\d{2,4})\)/g, '\x1d$1').replace(/^\x1d/, '');
  if (!/^01\d{14}/.test(s)) return null;
  const out = {}; let i = 0;
  while (i < s.length) {
    if (s[i] === '') { i++; continue; }   // separador de campos variables
    const ai = s.slice(i, i + 2); i += 2;
    if (ai === '01') { out.gtin = s.slice(i, i + 14); i += 14; }
    else if (ai === '17' || ai === '15' || ai === '11') { const d = s.slice(i, i + 6); i += 6; if (ai === '17') { const yy = +d.slice(0, 2), mm = d.slice(2, 4); let dd = d.slice(4, 6);
      if (dd === '00') dd = String(new Date(2000 + yy, +mm, 0).getDate()); out.exp = `20${d.slice(0, 2)}-${mm}-${dd}`; } }
    else if (ai === '10' || ai === '21') { const end = s.indexOf('\x1d', i); const v = s.slice(i, end < 0 ? s.length : end); i = end < 0 ? s.length : end + 1; if (ai === '10') out.lot = v; }
    else break;
  }
  return out;
}
function prodByCode(raw) {
  const code = String(raw || '').trim(); const g = parseGS1(code); const keys = [codeKey(code), g?.gtin && codeKey(g.gtin)].filter(Boolean);
  const m = code.toUpperCase().match(/^Q-(.+)$/); if (m) { const p = S.products.find(x => x.id.toUpperCase() === m[1]); if (p) return { p, g }; }
  const p = S.products.find(x => (x.barcodes || []).some(b => keys.includes(codeKey(b))));
  return { p, g };
}

// ---------- Escáner ----------
const SCAN = { stream: null, reader: null, timer: null, busy: false };
function scanStop() {
  clearInterval(SCAN.timer); SCAN.timer = null;
  try { SCAN.reader?.reset(); } catch (e) {} SCAN.reader = null;
  SCAN.stream?.getTracks().forEach(t => t.stop()); SCAN.stream = null;
}
// Si la ventana se cierra por cualquier vía, la cámara se apaga
setInterval(() => { if ((SCAN.stream || SCAN.reader) && !document.getElementById('scan-v')) scanStop(); }, 800);

ACTIONS.scanOpen = el => {
  UI.scan = { mode: el?.dataset?.mode || 'find', id: el?.dataset?.id || null };
  const p = UI.scan.id ? prod(UI.scan.id) : null;
  openSheet(p ? `Asociar código · ${p.name}` : 'Escanear código', `<div class="scan-box"><video id="scan-v" playsinline muted></video><div class="scan-aim" aria-hidden="true"></div></div>
    <div class="small muted" id="scan-st">Encendiendo la cámara…</div>
    <div class="field"><label for="scan-in">O con lector USB / escribiendo el código</label><input class="input" id="scan-in" autocomplete="off" inputmode="text" placeholder="Pase el lector o escriba y pulse Enter"></div>`,
    `<button class="btn" data-act="scanClose">Cerrar</button>`);
  setTimeout(() => document.getElementById('scan-in')?.focus(), 50);
  scanStart();
};
ACTIONS.scanClose = () => { scanStop(); closeSheet(); };
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target?.id === 'scan-in') { e.preventDefault(); const v = e.target.value.trim(); if (v) scanGot(v); } });
async function scanStart() {
  const st = t => { const e = document.getElementById('scan-st'); if (e) e.textContent = t; };
  const video = document.getElementById('scan-v'); if (!video) return;
  if (!navigator.mediaDevices?.getUserMedia) { st('Este navegador no deja usar la cámara aquí (hace falta https o localhost). Use el lector o escriba el código.'); video.parentElement.hidden = true; return; }
  try {
    if ('BarcodeDetector' in window) {
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'data_matrix', 'qr_code', 'itf'] });
      SCAN.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); video.srcObject = SCAN.stream; await video.play();
      st('Apunte al código de barras de la caja.');
      SCAN.timer = setInterval(async () => { if (SCAN.busy || !video.videoWidth) return; SCAN.busy = true;
        try { const r = await det.detect(video); if (r[0]?.rawValue) scanGot(r[0].rawValue); } catch (e) {} SCAN.busy = false; }, 250);
    } else {
      st('Cargando el lector…'); await loadLib(SCAN_LIB.zxing);
      SCAN.reader = new window.ZXing.BrowserMultiFormatReader();
      await SCAN.reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, 'scan-v', res => { if (res) scanGot(res.getText()); });
      st('Apunte al código de barras de la caja.');
    }
  } catch (e) { st('No se pudo usar la cámara (permiso denegado o sin cámara). Use el lector o escriba el código.'); video.parentElement.hidden = true; }
}
function scanGot(raw) {
  if (!UI.scan || UI.scan.done) return; UI.scan.done = true; scanStop();
  if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {}
  const code = String(raw).trim();
  if (UI.scan.mode === 'assign') return barcodeAssign(prod(UI.scan.id), code);
  const { p, g } = prodByCode(code);
  if (p) { ACTIONS.openProduct({ dataset: { id: p.id } }); toast(`${p.name}${g?.lot ? ` · lote ${g.lot}` : ''}${g?.exp ? ` · vence ${fdate(g.exp)}` : ''}`); return; }
  UI.scanNew = { code, g };
  openSheet('Código nuevo', scanNewBody(), `<span class="note" id="sn-msg"></span><button class="btn" data-act="close">Cerrar</button>${canBarcode() ? '<button class="btn primary" data-act="scanAssignPick">Asociar al producto</button>' : ''}`);
}
const scanNewBody = () => { const { code, g } = UI.scanNew;
  return `<div class="banner"><span>Este código todavía no está asociado a ningún producto: <b class="mono">${esc(code)}</b>${g ? `<br>Trae datos de la caja: ${g.lot ? 'lote <b>' + esc(g.lot) + '</b>' : ''}${g.exp ? ' · vence <b>' + fdate(g.exp) + '</b>' : ''}` : ''}</span></div>
    ${canBarcode() ? `<div class="field"><label for="sn-p">¿De qué producto es?</label>${prodList('sn-list', S.products)}<input class="input" id="sn-p" list="sn-list" placeholder="Busque el producto del inventario" autocomplete="off"></div>
    <div class="small muted">Desde ahora, al escanear este código se abre ese producto. Si es un producto que aún no está en el inventario, regístrelo primero con "Producto o lote nuevo".</div>` : '<div class="small muted">Pida a almacén o administración que lo asocie.</div>'}`; };
ACTIONS.scanAssignPick = () => { const p = pickProd(val('sn-p'), S.products); if (!p) { document.getElementById('sn-msg').textContent = 'Elija el producto de la lista.'; return; } barcodeAssign(p, UI.scanNew.code); };
function barcodeAssign(p, code) {
  if (!p || !canBarcode()) return;
  const g = parseGS1(code); const key = g?.gtin || code; const other = S.products.find(x => x !== p && (x.barcodes || []).some(b => codeKey(b) === codeKey(key)));
  if (other) { toast(`Ese código ya es de ${other.name}`); ACTIONS.openProduct({ dataset: { id: other.id } }); return; }
  p.barcodes = p.barcodes || []; if (!p.barcodes.some(b => codeKey(b) === codeKey(key))) p.barcodes.push(key);
  log('Código de barras asociado', `${p.name} · ${key}`); save(); ACTIONS.openProduct({ dataset: { id: p.id } }); toast(`Código asociado a ${p.name}`);
}
ACTIONS.barcodeDel = el => { const p = prod(el.dataset.id); if (!canBarcode()) return; p.barcodes = (p.barcodes || []).filter(b => b !== el.dataset.c); log('Código de barras quitado', `${p.name} · ${el.dataset.c}`); save(); ACTIONS.openProduct({ dataset: { id: p.id } }); };
// Línea en la ficha del producto
const barcodeLine = p => `<div class="card" style="display:grid;gap:8px;padding:12px 14px"><div class="between" style="gap:8px;flex-wrap:wrap"><b>Códigos de barras</b>
    <div class="hstack">${canBarcode() ? `<button class="btn sm" data-act="scanOpen" data-mode="assign" data-id="${p.id}">Escanear y asociar</button>` : ''}<button class="btn sm" data-act="labelPrint" data-ids="${p.id}">Imprimir etiqueta</button></div></div>
  <div class="hstack" style="flex-wrap:wrap">${(p.barcodes || []).map(b => `<span class="pill mono">${esc(b)}${canBarcode() ? ` <button class="linkish" data-act="barcodeDel" data-id="${p.id}" data-c="${esc(b)}" aria-label="Quitar código ${esc(b)}">✕</button>` : ''}</span>`).join('') || '<span class="small muted">Sin código de fábrica asociado. Su etiqueta propia es <span class="mono">' + labelCode(p) + '</span>.</span>'}</div></div>`;

// ---------- Etiquetas ----------
const LABEL_SIZES = { '50x25': [50, 25], '60x40': [60, 40], '40x30': [40, 30] };
ACTIONS.labelsOpen = () => {
  const none = S.products.filter(p => !(p.barcodes || []).length && stock(p) > 0);
  UI.lbl = { size: '50x25', which: 'none' };
  openSheet('Imprimir etiquetas', `<div class="small muted">Para pegar en las cajas y recipientes de lo que no trae código de fábrica. Al escanearlas se abre el producto.</div>
    <div class="form"><div class="field"><label for="lb-w">¿Cuáles?</label><select class="input" id="lb-w"><option value="none">Productos con existencia sin código de fábrica (${none.length})</option><option value="all">Todos los productos con existencia (${S.products.filter(p => stock(p) > 0).length})</option></select></div>
    <div class="field"><label for="lb-s">Tamaño de la etiqueta</label><select class="input" id="lb-s">${Object.keys(LABEL_SIZES).map(k => `<option value="${k}">${k.replace('x', ' × ')} mm</option>`).join('')}</select></div></div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="labelPrint">Imprimir</button>`);
};
ACTIONS.labelPrint = async el => {
  const ids = el?.dataset?.ids ? el.dataset.ids.split(',') : (val('lb-w') === 'all' ? S.products.filter(p => stock(p) > 0) : S.products.filter(p => !(p.barcodes || []).length && stock(p) > 0)).map(p => p.id);
  const [w, h] = LABEL_SIZES[val('lb-s') || '50x25'] || LABEL_SIZES['50x25'];
  try { await loadLib(SCAN_LIB.jsbarcode); } catch (e) { toast('No se pudo cargar el generador de códigos (revise la conexión a internet)'); return; }
  const svgOf = text => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); window.JsBarcode(s, text, { format: 'CODE128', displayValue: false, margin: 0, height: 40, width: 1.6 }); s.setAttribute('preserveAspectRatio', 'none'); return s.outerHTML; };
  const labels = ids.map(id => prod(id)).filter(Boolean).map(p => { const l = placements(p)[0]?.loc; const where = l ? (l.shelf ? (l.level ? levelCode(l.shelf, l.level) : shelfOf(l.shelf)?.name) + (l.bin ? ' · Caja ' + l.bin : '') : sectorOf(l.sector)?.name + (l.spot ? ' · ' + l.spot : '')) : '';
    return `<div class="lb"><div class="nm">${esc(p.name)}</div><div class="bc">${svgOf(labelCode(p))}</div><div class="ft"><span>${labelCode(p)}</span><span>${esc(where || '')}</span></div></div>`; });
  if (!labels.length) { toast('No hay productos para etiquetar'); return; }
  const win = window.open('', '_blank'); if (!win) { toast('El navegador bloqueó la ventana de impresión: permita las ventanas emergentes'); return; }
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas Quirón</title><style>
    @page{size:${w}mm ${h}mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#000}
    .lb{width:${w}mm;height:${h}mm;padding:1.6mm 2mm;display:flex;flex-direction:column;gap:.6mm;page-break-after:always;overflow:hidden}
    .nm{font-size:${h > 30 ? 9 : 7}pt;font-weight:700;line-height:1.15;max-height:2.35em;overflow:hidden}
    .bc{flex:1;min-height:0}.bc svg{width:100%;height:100%}
    .ft{display:flex;justify-content:space-between;gap:2mm;font-size:6.5pt;font-family:monospace}
  </style></head><body>${labels.join('')}<script>window.onload=()=>{window.focus();window.print();}<\/script></body></html>`);
  win.document.close(); closeSheet(); log('Etiquetas impresas', `${labels.length} etiqueta(s) ${w}×${h} mm`);
};
