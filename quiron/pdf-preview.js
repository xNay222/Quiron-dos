// Vista previa de documentos: todo PDF de la plataforma se ve aquí antes de imprimirlo o guardarlo.
// · "Descargar PDF" guarda el documento completo, con membrete (o con la hoja de factura).
// · "Imprimir" manda solo el contenido, en el mismo lugar, para imprimir sobre las hojas membretadas (o la hoja de factura).
// Las páginas se dibujan con PDF.js para que la vista previa funcione igual en computadora, tableta y teléfono.

const PDFJS = {
  lib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  libSri: 'sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==',
  worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  workerSri: 'sha512-BbrZ76UNZq5BhH7LL7pn9A4TKQpQeNCHOo65/akfelcIBbcVvYWOFQKPXIrykE3qZxYjmDX573oa4Ywsc7rpTw=='
};
let pdfjsLoading = null;
function loadPdfjs() {
  if (window.pdfjsLib?.GlobalWorkerOptions?.workerSrc) return Promise.resolve(window.pdfjsLib);
  return pdfjsLoading ||= (async () => {
    if (!window.pdfjsLib) await new Promise((ok, no) => {
      const s = document.createElement('script'); s.src = PDFJS.lib; s.integrity = PDFJS.libSri; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
      s.onload = ok; s.onerror = no; document.head.appendChild(s);
    });
    // El trabajador se sirve desde el mismo origen (un Worker de otro dominio no se puede crear)
    const code = await (await fetch(PDFJS.worker, { integrity: PDFJS.workerSri, mode: 'cors', referrerPolicy: 'no-referrer' })).text();
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    return window.pdfjsLib;
  })().catch(e => { pdfjsLoading = null; throw e; });
}

// Estado de la vista previa abierta
let PDFV = null;
function pdfvDoc(mode) {
  if (!PDFV) return null;
  if (!PDFV.docs[mode]) PDFV.docs[mode] = pdfFinish(typeof PDFV.src === 'function' ? pdfBuild(PDFV.src, mode) : PDFV.src, PDFV.filename);
  return PDFV.docs[mode];
}

async function pdfPreview(src, filename, opts = {}) {
  PDFV = { src, filename, opts, docs: {}, view: 'membrete', token: 0 };
  try { pdfvDoc('membrete'); } catch (e) { toast(e.message || 'No se pudo preparar el documento'); PDFV = null; return false; }
  const both = typeof src === 'function';
  openSheet(opts.title || filename.replace(/\.pdf$/i, ''),
    (both ? `<div class="seg pdfv-seg" role="group" aria-label="Vista">
      <button data-act="pdfvView" data-k="membrete" aria-pressed="true">Documento completo</button>
      <button data-act="pdfvView" data-k="contenido" aria-pressed="false">Lo que se imprime</button></div>` : '') +
    `<p class="small muted pdfv-note" id="pdfv-note">${esc(opts.note || (both ? 'El PDF se guarda con el membrete. Al imprimir solo sale el contenido, para usar las hojas membretadas.' : ''))}</p>
    <div class="pdfv-pages" id="pdfv-pages" aria-live="polite"><div class="pdfv-loading">Preparando la vista previa…</div></div>${opts.after || ''}`,
    `${opts.extra || ''}<button class="btn" data-act="pdfvDownload">${icon('descargar')}Descargar PDF</button><button class="btn primary" data-act="pdfvPrint">${esc(opts.printLabel || 'Imprimir')}</button>`,
    { wide: true });
  pdfvRender();
  return true;
}

async function pdfvRender() {
  if (!PDFV) return; const token = ++PDFV.token; const box = document.getElementById('pdfv-pages'); if (!box) return;
  const doc = pdfvDoc(PDFV.view);
  try {
    const lib = await loadPdfjs();
    const pdf = await lib.getDocument({ data: doc.output('arraybuffer') }).promise;
    if (!PDFV || token !== PDFV.token) return;
    const width = Math.max(260, box.clientWidth || 600), dpr = Math.min(2, window.devicePixelRatio || 1);
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i); const base = page.getViewport({ scale: 1 }); const vp = page.getViewport({ scale: width / base.width * dpr });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height); c.className = 'pdfv-page';
      c.setAttribute('role', 'img'); c.setAttribute('aria-label', `Página ${i} de ${pdf.numPages}`);
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp, intent: 'print' }).promise;   // 'print': dibuja sin esperar cuadros de animación
      if (!PDFV || token !== PDFV.token) return;
      frag.appendChild(c);
    }
    box.replaceChildren(frag);
  } catch (e) {
    // Sin PDF.js (sin internet): el visor del navegador
    if (!PDFV || token !== PDFV.token) return;
    const url = URL.createObjectURL(doc.output('blob'));
    box.innerHTML = `<iframe class="pdfv-frame" title="Vista previa del documento" src="${url}"></iframe>`;
  }
}

ACTIONS.pdfvView = el => {
  if (!PDFV) return; PDFV.view = el.dataset.k;
  document.querySelectorAll('.pdfv-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === PDFV.view)));
  pdfvRender();
};
ACTIONS.pdfvDownload = async () => { if (PDFV) await pdfDownload(pdfvDoc('membrete'), PDFV.filename); };
ACTIONS.pdfvPrint = async () => {
  if (!PDFV) return;
  const doc = pdfvDoc(typeof PDFV.src === 'function' ? 'contenido' : 'membrete');
  log('Documento impreso', PDFV.filename.replace(/\.pdf$/i, ''));
  // Computadora: se imprime el PDF tal cual (texto nítido). Teléfono y tableta: se imprimen las páginas dibujadas.
  if (!matchMedia('(pointer: coarse)').matches) { try { await pdfPrintFrame(doc); return; } catch (e) {} }
  try { await pdfPrintPages(doc); } catch (e) { toast('No se pudo abrir la impresión. Descargue el PDF e imprímalo desde allí.'); }
};

function pdfPrintFrame(doc) {
  return new Promise((ok, no) => {
    document.getElementById('pdf-print-frame')?.remove();
    const f = document.createElement('iframe'); f.id = 'pdf-print-frame'; f.title = 'Impresión'; f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    const url = URL.createObjectURL(doc.output('blob'));
    const t = setTimeout(() => no(new Error('sin respuesta')), 8000);
    f.onload = () => { clearTimeout(t); setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); ok(); } catch (e) { no(e); } }, 120); };
    f.src = url; document.body.appendChild(f);
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  });
}
async function pdfPrintPages(doc) {
  const lib = await loadPdfjs(); const pdf = await lib.getDocument({ data: doc.output('arraybuffer') }).promise;
  const area = document.getElementById('print-area') || Object.assign(document.createElement('div'), { id: 'print-area' });
  document.body.appendChild(area); area.replaceChildren();
  let size = null;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i); const base = page.getViewport({ scale: 1 }); size ||= base;
    const vp = page.getViewport({ scale: 200 / 72 });   // 200 ppp
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp, intent: 'print' }).promise;   // 'print': dibuja sin esperar cuadros de animación
    const img = new Image(); img.src = c.toDataURL('image/png'); img.alt = ''; area.appendChild(img);
  }
  let st = document.getElementById('print-page'); if (!st) { st = document.createElement('style'); st.id = 'print-page'; document.head.appendChild(st); }
  st.textContent = `@page{size:${size.width}pt ${size.height}pt;margin:0}`;
  await Promise.all([...area.querySelectorAll("img")].map(im => im.decode?.().catch(() => {})));
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); area.replaceChildren(); removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 60000);
}
