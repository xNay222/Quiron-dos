// Documentos PDF en A4 con la identidad de Quirón: logo, RIF discreto en el encabezado y pie de página
// numerado en todas las páginas. Todos los documentos comparten este mismo diseño.

// ---------- Logo: se prepara una vez (recorte + fondo transparente) a partir de logo.webp ----------
window.LOGO = null;
(async function loadLogo() {
  try {
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = 'logo.webp'; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0); // sobre blanco: sirve si el original trae fondo blanco o transparente
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) { const k = (y * c.width + i) * 4; const a = Math.max(0, Math.min(255, Math.round((255 - (p[k] + p[k + 1] + p[k + 2]) / 3) * 1.15)));
      p[k] = p[k + 1] = p[k + 2] = 0; p[k + 3] = a; if (a > 20) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    x.putImageData(d, 0, 0);
    const w = x1 - x0 + 9, h = y1 - y0 + 9, s = Math.min(1, 1200 / w); const o = document.createElement('canvas'); o.width = Math.round(w * s); o.height = Math.round(h * s);
    o.getContext('2d').drawImage(c, x0 - 4, y0 - 4, w, h, 0, 0, o.width, o.height);
    // Versión liviana para los PDF: ~560 px de ancho bastan para imprimir el logo nítido a 300 ppp (132 pt de ancho)
    const pw = Math.min(560, o.width), pc = document.createElement('canvas'); pc.width = pw; pc.height = Math.round(o.height * pw / o.width); pc.getContext('2d').drawImage(o, 0, 0, pc.width, pc.height);
    window.LOGO = { url: o.toDataURL('image/png'), pdf: pc.toDataURL('image/png'), ratio: o.height / o.width };
    if (typeof renderSide === 'function') renderSide();
  } catch (e) { window.LOGO = null; }
})();

// ---------- Dos salidas para cada documento ----------
// 'membrete': el PDF que se guarda o se envía, con logo, datos de la clínica, marca de agua y pie de página.
// 'contenido': lo que se imprime sobre las hojas membretadas: solo el texto del documento, exactamente en el mismo lugar.
let PDF_MODE = 'membrete';
const pdfPlain = doc => (doc?._mode || PDF_MODE) === 'contenido';   // cada documento recuerda con qué modo se armó
function pdfBuild(build, mode) { const prev = PDF_MODE; PDF_MODE = mode; try { return build(mode); } finally { PDF_MODE = prev; } }

// ---------- Plantilla A4 ----------
const PG = { W: 595.28, H: 841.89, L: 48, R: 547.28, top: 176, bottom: 780 };
const INK = [24, 24, 26], GREY = [112, 112, 118], SOFT = [246, 246, 248], LINE = [85, 85, 88], RED = [196, 32, 38];
const PDF_CLINIC = { name: 'Quirón Especialidades Médicas S.A.', rif: 'J-502131973', email: 'Quironespecialidadesmedicas@gmail.com', address: 'Calle Choroní entre Santa Fe y Roraima, Qta Lala,', address2: 'Urb. Chuao, Caracas (El Cafetal) Miranda. Z.P.: 1061.', phone: '(+58-212) 9939173 - 9932747' };
const rifText = () => 'RIF ' + PDF_CLINIC.rif;

// Las fuentes estándar del PDF solo traen caracteres latinos: se reemplazan subíndices, letras griegas, etc.
const PDF_SUBST = [[/⚠\uFE0F?/g, 'Advertencia: '], [/[–—]/g, '-'],[/[₀-₉]/g, c => String(c.charCodeAt(0) - 0x2080)], [/⁴|⁵|⁶|⁷|⁸|⁹|⁰/g, c => ({ '⁰': '0', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' })[c]],
  [/≥/g, '>='], [/≤/g, '<='], [/≠/g, '<>'], [/≈|∼/g, '~'], [/→/g, '->'], [/←/g, '<-'], [/↑/g, '(alto)'], [/↓/g, '(bajo)'], [/✓|✔/g, 'Sí'], [/✗|✘/g, 'No'],
  [/α/g, 'alfa'], [/β/g, 'beta'], [/γ/g, 'gamma'], [/δ|Δ/g, 'delta'], [/κ/g, 'kappa'], [/λ/g, 'lambda'], [/[\u2009\u202F\u00A0]/g, ' '], [/[‐‑‒]/g, '-']];
const pdfClean = s => Array.isArray(s) ? s.map(pdfClean) : PDF_SUBST.reduce((t, [re, to]) => t.replace(re, to), String(s ?? '')).replace(/[^\x00-\xFF–—‘’“”•…€]/g, '');
function pdfNew(title, meta = []) {
  const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', compress: true });   // compresión: archivos livianos para enviar por WhatsApp o correo
  const rawText = doc.text.bind(doc); doc.text = (t, ...a) => rawText(pdfClean(t), ...a);
  const rawSplit = doc.splitTextToSize.bind(doc); doc.splitTextToSize = (t, ...a) => rawSplit(pdfClean(t), ...a);
  doc._title = title; doc._meta = meta; doc._mode = PDF_MODE;
  pdfHeader(doc, true);
  return doc;
}
// Encabezado: logo a la izquierda con el RIF debajo; título y datos del documento a la derecha
function pdfHeader(doc, first) {
  const { L, R } = PG, c=PDF_CLINIC;
  if (pdfPlain(doc)) {   // hoja membretada: solo los datos del documento y su título, en su lugar de siempre
    doc.setTextColor(...INK); doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text(doc._meta.flatMap(x=>doc.splitTextToSize(x,230)),R,79,{align:'right',lineHeightFactor:1.2});
    doc.setFont('helvetica','bold'); doc.setFontSize(12);
    const t=doc.splitTextToSize(pdfClean(doc._title.toUpperCase()),R-L-20); if(t.length>1) doc.setFontSize(9);
    doc.text(t.slice(0,2),L+10,t.length>1?146:153,{lineHeightFactor:1.1});
    return PG.top;
  }
  // Marca de agua detrás del contenido, nunca en la impresión sobre imprenta.
  if(window.LOGO && doc.GState) {
    doc.saveGraphicsState(); doc.setGState(new doc.GState({opacity:.07}));
    doc.addImage(window.LOGO.pdf || window.LOGO.url,'PNG',100,355,395,395*window.LOGO.ratio,'logo','FAST'); doc.restoreGraphicsState();
  }
  // La dirección va debajo del logo completo (incluida la línea ESPECIALIDADES MÉDICAS), nunca encima.
  const logoH = window.LOGO ? 150*window.LOGO.ratio : 30;
  if(window.LOGO) doc.addImage(window.LOGO.pdf || window.LOGO.url,'PNG',L,25,150,logoH,'logo','FAST');
  else { doc.setFont('helvetica','bold');doc.setFontSize(26);doc.text('QUIRÓN',L,55); }
  doc.setTextColor(...INK);doc.setFont('helvetica','normal');doc.setFontSize(9);
  doc.text([c.address,c.address2,'Teléfonos: '+c.phone],L,Math.min(25+logoH+11,107),{lineHeightFactor:1.2});
  doc.text(c.email,R,32,{align:'right'});doc.setFont('helvetica','bold');
  doc.text(c.name,R,46,{align:'right'});doc.text(rifText(),R,60,{align:'right'});
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  const meta=doc._meta.flatMap(x=>doc.splitTextToSize(x,230));
  doc.text(meta,R,79,{align:'right',lineHeightFactor:1.2});
  const title=pdfClean(doc._title.toUpperCase());
  doc.setDrawColor(...LINE);doc.setLineWidth(.6);doc.roundedRect(L,135,R-L,27,5,5);
  doc.setFont('helvetica','bold');doc.setFontSize(12);
  const lines=doc.splitTextToSize(title,R-L-20);
  if(lines.length>1) doc.setFontSize(9);
  doc.text(doc.splitTextToSize(title,R-L-20).slice(0,2),L+10,lines.length>1?146:153,{lineHeightFactor:1.1});
  return PG.top;
}
function pdfFooters(doc) {
  if (pdfPlain(doc)) { const n=doc.getNumberOfPages(); if (n>1) for(let i=1;i<=n;i++){ doc.setPage(i); doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...GREY); doc.text(i+'/'+n,PG.R,PG.bottom+8,{align:'right'}); } return; }
  for(let i=1;i<=doc.getNumberOfPages();i++) {
    doc.setPage(i); doc.setDrawColor(...LINE);doc.setLineWidth(.5);doc.roundedRect(PG.L,793,PG.R-PG.L,33,4,4);
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...INK);
    doc.text(PDF_CLINIC.name+' · '+rifText(),PG.L+8,806);
    doc.text('Caracas, Miranda · Teléfonos '+PDF_CLINIC.phone,PG.L+8,819);
    doc.text(i+'/'+doc.getNumberOfPages(),PG.R-8,806,{align:'right'});
  }
}
// Salto de página si no cabe lo que viene
function pdfEnsure(doc, y, need) { if (y + need <= PG.bottom) return y; doc.addPage(); return pdfHeader(doc, false); }
function pdfSection(doc, y, label) {
  y = pdfEnsure(doc, y, 40);
  doc.setFillColor(...INK); doc.rect(PG.L, y - 6.5, 10, 2.2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK); doc.setCharSpace(0.6); doc.text(label.toUpperCase(), PG.L + 16, y - 4); doc.setCharSpace(0);
  return y + 12;
}
function pdfPara(doc, y, text, { size = 10, color = INK, bold = false, indent = 0, gap = 8 } = {}) {
  if (!text) return y;
  size = Math.max(9, size);
  doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
  const lh = size * 1.42; const lines = doc.splitTextToSize(String(text), PG.R - PG.L - indent);
  lines.forEach(l => { y = pdfEnsure(doc, y, lh); doc.text(l, PG.L + indent, y + size * .8); y += lh; });
  return y + gap;
}
// Caja gris con pares etiqueta / valor en columnas
function pdfInfoBox(doc, y, pairs, cols = 2) {
  const cw=(PG.R-PG.L-28)/cols, maxLines=38;
  for(let row=0;row<pairs.length;row+=cols) {
    const cells=pairs.slice(row,row+cols).map(([k,v])=>{doc.setFontSize(9.8);return {key:String(k).toUpperCase(),lines:doc.splitTextToSize(String(v ?? '—'),cw-12)};});
    const length=Math.max(...cells.map(c=>c.lines.length));
    for(let offset=0;offset<length;offset+=maxLines) {
      const count=Math.min(maxLines,length-offset),h=30+count*12;
      y=pdfEnsure(doc,y,h+10);doc.setDrawColor(...LINE);doc.setLineWidth(.5);doc.roundedRect(PG.L,y,PG.R-PG.L,h,5,5);
      cells.forEach((cell,i)=>{const x=PG.L+14+i*cw;doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...GREY);doc.text(cell.key+(offset?' (cont.)':''),x,y+14);
        doc.setFont('helvetica','normal');doc.setFontSize(9.8);doc.setTextColor(...INK);doc.text(cell.lines.slice(offset,offset+count),x,y+28,{lineHeightFactor:12/9.8});});
      y+=h+6;
    }
  }
  return y+12;
}
const pdfTable = (doc, y, head, body, opts = {}) => {
  doc.autoTable({ startY: y, margin: { left: PG.L, right: PG.W - PG.R, top: PG.top, bottom: PG.H - PG.bottom }, head: [head.map(h => typeof h === 'string' ? h.toUpperCase() : h)], body, theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9.4, cellPadding: { top: 7, bottom: 7, left: 8, right: 8 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: .5 } },
    headStyles: { fillColor: [243,243,243], textColor: INK, fontStyle: 'bold', fontSize: 9, lineWidth: 0 }, alternateRowStyles: { fillColor: [251, 251, 252] },
    willDrawPage: d => { if (doc.getCurrentPageInfo().pageNumber > 1 && d.pageNumber > 1) pdfHeader(doc, false); }, ...opts });
  return doc.lastAutoTable.finalY + 18;
};
// Bloque de firma
// Credenciales del médico bajo la firma: C.I. · MPPS · Colegio de Médicos
const docCreds = d => [d?.ci && 'C.I. ' + d.ci, d?.mpps && 'MPPS ' + d.mpps, d?.cm && 'C.M. ' + d.cm].filter(Boolean).join(' · ');
function pdfSignature(doc, y, name, sub, img, creds = '') {
  y = pdfEnsure(doc, y + 30, 90); const x = PG.R - 200;
  if (img) doc.addImage(img, 'PNG', x + 20, y - 4, 160, 40);
  doc.setDrawColor(...INK); doc.setLineWidth(.6); doc.line(x, y + 40, PG.R, y + 40);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK); doc.text(name, x + 100, y + 54, { align: 'center' });
  if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY); doc.text(sub, x + 100, y + 66, { align: 'center' }); }
  if (creds) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY);
    const lines = doc.splitTextToSize(creds, 200); lines.forEach((l, i) => doc.text(l, x + 100, y + 78 + i * 11, { align: 'center' })); return y + 92 + (lines.length - 1) * 11; }
  return y + 80;
}
// Nombre de archivo válido en Windows, macOS y teléfonos (sin / \\ : * ? " < > |)
const safeName = n => String(n).replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 140);
function pdfFinish(doc, filename) {
  if (doc._finished) return doc; doc._finished = true;
  doc.setProperties({ title: pdfClean(String(filename).replace(/\.pdf$/i, '')), subject: pdfClean(doc._title), author: pdfClean(S.clinic?.name || 'Quirón'), keywords: pdfClean(`RIF ${S.clinic?.rif || ''}`), creator: 'Quirón · sistema de gestión clínica' });
  try { doc.setLanguage('es-VE'); } catch (e) {}
  if (!doc._preprinted) pdfFooters(doc);
  return doc;
}
// Todos los documentos pasan por la vista previa: desde ahí se imprime (solo el contenido) o se descarga el PDF (con membrete).
// "src" es una función que arma el documento para un modo ('membrete' o 'contenido'); también se acepta un documento ya armado.
async function pdfSave(src, filename, opts = {}) {
  if (typeof pdfPreview === 'function') return pdfPreview(src, safeName(filename), opts);
  return pdfDownload(typeof src === 'function' ? pdfBuild(src, 'membrete') : src, filename);
}
async function pdfDownload(doc, filename) {
  filename = safeName(filename);
  // Metadatos: el visor y el explorador de archivos muestran título, autor y asunto; idioma para lectores de pantalla
  pdfFinish(doc, filename);
  const dl = await getCap('downloads');
  if (!dl) { try { doc.save(filename); toast('PDF descargado'); return true; } catch (e) { toast('No se pudo descargar el PDF'); return false; } }
  try { await dl.save({ filename, data: doc.output('blob') }); toast('PDF guardado'); return true; }
  catch (e) { if (e?.code !== 'declined') toast('No se pudo guardar el PDF'); return false; }
}
const pdfReady = () => { if (window.jspdf?.jsPDF) return true; toast('No se pudo cargar el generador de PDF. Revisa la conexión y recarga.'); return false; };
const usd = n => fmt(n).replace('$', 'USD ');
const patientPairs = p => [['Paciente', p.name], ['Cédula', p.ci], ['Historia', p.code], ['Edad', `${ageTxt(p)} · ${p.sex === 'F' ? 'Femenino' : p.sex === 'M' ? 'Masculino' : 'sexo no registrado'}`], ['Teléfono', p.phone], ['Grupo sanguíneo', p.blood || '—']];

// ---------- Presupuesto y factura ----------
function pdfBilling(m) {
  const meta = [`Nº ${m.num}`]; if (m.control) meta.push(`Nº de control ${m.control}`); meta.push(`Fecha ${fdate(m.date)}`); if (m.until) meta.push(`Válido hasta ${fdate(m.until)}`);
  const doc = pdfNew(m.fiscal ? 'FACTURA - COPIA DIGITAL' : m.title, meta); let y = PG.top;
  y = pdfInfoBox(doc, y, [['Paciente', m.p.name], ['Cédula', m.p.ci], ['Teléfono', m.p.phone], ['Dirección', m.p.address || '—'], ['Médico tratante', m.doc?.name || '—'], ['Procedimiento', m.proc || '—']]);
  const money = m.kind === 'budget' ? usd : m.money;   // presupuesto en dólares; cuentas y facturas en Bs
  y = pdfTable(doc, y, ['Descripción', 'Monto'], m.items.map(x => [x.name, money(x.price)]), { columnStyles: { 1: { halign: 'right', cellWidth: 120 } } });
  // Totales a la derecha
  const lines = [['Subtotal', money(m.t.sub)]]; if (m.t.disc) lines.push([`Cortesía (descuento ${m.t.disc}%)`, '-' + money(m.t.desc)]);
  if (m.kind === 'invoice' && m.fiscal) lines.push(['IVA', 'Exento (servicio médico)']);
  const igtf = r2(m.payments.reduce((a, p) => a + (+p.igtf || 0), 0));
  y = pdfEnsure(doc, y, lines.length * 15 + 80); const x0 = PG.R - 230;
  doc.setFontSize(9.5); lines.forEach(([k, v]) => { doc.setFont('helvetica', 'normal'); doc.setTextColor(...(k.startsWith('Cortesía') ? RED : GREY)); doc.text(k, x0, y); doc.setTextColor(...(k.startsWith('Cortesía') ? RED : INK)); doc.text(v, PG.R, y, { align: 'right' }); y += 15; });
  y += 2; doc.setFillColor(...INK); doc.roundedRect(x0 - 10, y - 2, PG.R - x0 + 10, 30, 5, 5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255); doc.text('TOTAL', x0, y + 17); doc.text(money(m.t.total), PG.R - 8, y + 17, { align: 'right' }); y += 42;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY);
  doc.text(m.kind === 'budget' ? `Equivalente: ${fmt(m.t.total * S.rate, 'VES')} a tasa BCV ${S.rate.toLocaleString('es-VE', { maximumFractionDigits: 4 })} Bs/USD` : `Tasa BCV ${m.rate.toLocaleString('es-VE', { maximumFractionDigits: 4 })} Bs/USD · referencia ${usd(m.t.total)}`, PG.R, y, { align: 'right' }); y += 13;
  if (igtf) { doc.text(`IGTF ${S.igtfRate}% pagado: ${money(igtf)}`, PG.R, y, { align: 'right' }); y += 13; }
  y += 10;
  if (m.payments.length) { y = pdfSection(doc, y, 'Forma de pago'); y = pdfPara(doc, y, m.payments.map(p => `${metodo(p.method)?.name || p.method}: ${fmt(p.amount, p.cur)}${p.ref ? ' (ref. ' + p.ref + ')' : ''}`).join('   ·   '), { size: 9 }); }
  if (m.kind !== 'budget' && m.fiscal === false) { y = pdfPara(doc, y, 'Este documento no constituye factura fiscal.', { size: 8.5, color: GREY, bold: true }); }
  y = pdfSection(doc, y, 'Condiciones');
  y = pdfPara(doc, y, (m.kind === 'budget' ? `Presupuesto válido hasta el ${fdate(m.until)}. Los montos están expresados en dólares; el equivalente en bolívares se calcula a la tasa oficial del BCV del día del pago. ` : '') + (S.clinic.note || ''), { size: 8.5, color: GREY });
  return doc;
}

// ---------- Historia clínica (una nota) ----------
function pdfNoteBody(doc, y, n, compact) {
  const v = n.vitals || {}; const d = med(n.doc);
  if (compact) { y = pdfEnsure(doc, y, 60); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK); doc.text(`${clinicalNoteTitle(n)} · ${fdate(n.date)} ${n.time}`, PG.L, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY); doc.text(`${d?.name || ''} · ${d?.esp || ''}`, PG.R, y, { align: 'right' }); y += 16; }
  const block = (label, text) => { if (!text) return; y = pdfEnsure(doc, y, 34); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GREY); doc.setCharSpace(.5); doc.text(label.toUpperCase(), PG.L, y); doc.setCharSpace(0); y = pdfPara(doc, y + 4, text, { size: 9.8, gap: 10 }); };
  if (n.type === 'informe') { if (n.to) block('Dirigido a', n.to); block(compact ? (n.motivo || 'Informe médico') : 'Contenido', n.actual); }
  else if (n.type === 'libre') block(n.motivo || 'Nota', n.actual);
  else {
    block(n.type === 'operatoria' ? 'Cirugía realizada' : n.type === 'ingreso' ? 'Motivo de ingreso' : 'Motivo de consulta', n.motivo);
    block(n.type === 'operatoria' ? 'Procedimiento y hallazgos' : n.type === 'evolucion' ? 'Evolución' : 'Enfermedad actual', n.actual);
  }
  const vit = VITALS.filter(([k]) => v[k]).map(([k, l, u]) => `${l} ${v[k]} ${u}`); if (imc(v)) vit.push(`IMC ${imc(v)}`);
  if (vit.length) block('Signos vitales', vit.join('   ·   '));
  block('Examen físico', n.examen);
  if (n.dx?.length) block('Diagnósticos', n.dx.map((x, i) => `${i + 1}. ${x}`).join('\n'));
  block('Plan', n.plan); block('Indicaciones', n.indicaciones);
  if (n.recipe?.length) block('Tratamiento indicado', n.recipe.map(r => `• ${r.med}${[r.dosis, r.frec, r.dur].filter(Boolean).length ? ' — ' + [r.dosis, r.frec, r.dur].filter(Boolean).join(', ') : ''}`).join('\n'));
  const ords = S.exams.filter(e => e.note === n.id); if (ords.length) block('Exámenes solicitados', ords.map(e => `${e.num}: ${e.tests.join(', ')} (${EX_ST[e.status][0].toLowerCase()})`).join('\n'));
  (n.addenda || []).forEach(a => block(`Nota aclaratoria · ${a.at} · ${a.by}`, a.text));
  y = pdfEnsure(doc, y, 20); doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...GREY); doc.text(`Firmada electrónicamente por ${d?.name || ''} el ${n.signedAt || ''}.`, PG.L, y); y += 18;
  return y;
}
function pdfNote(n) {
  const p = pat(n.pid); const d = med(n.doc);
  const doc = pdfNew(n.evolutionId ? clinicalNoteTitle(n) : n.type === 'informe' ? (n.motivo || 'Informe médico') : 'Historia clínica', [clinicalNoteTitle(n), `Fecha ${fdate(n.date)} · ${n.time}`, d?.name || '']); let y = PG.top;
  y = pdfInfoBox(doc, y, patientPairs(p), 3);
  if (p.allergies.length) { doc.setFillColor(253, 236, 236); doc.roundedRect(PG.L, y - 8, PG.R - PG.L, 24, 5, 5, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...RED); doc.text(`ALERGIAS: ${p.allergies.join(', ')}`, PG.L + 12, y + 7.5); y += 30; }
  y = pdfNoteBody(doc, y, n, false);
  pdfSignature(doc, y, d?.name || '', d?.esp || '', null, docCreds(d));
  return doc;
}

// ---------- Historia clínica completa del paciente ----------
function pdfFullHistory(pid) {
  const p = pat(pid); const notes = S.hc.filter(n => n.pid === pid && n.status === 'firmada').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const exams = S.exams.filter(e => e.pid === pid && e.status === 'listo').sort((a, b) => (a.readyAt || a.date).localeCompare(b.readyAt || b.date));
  const doc = pdfNew('Historia clínica completa', [`Historia ${p.code}`, `Emitida ${fdate(dAt(0))}`]); let y = PG.top;
  y = pdfInfoBox(doc, y, [...patientPairs(p), ['Dirección', p.address || '—'], ['Contacto de emergencia', p.emergency || '—'], ['Registrado', p.code]], 3);
  y = pdfSection(doc, y, 'Antecedentes');
  y = pdfPara(doc, y, `Alergias: ${p.allergies.join(', ') || 'ninguna conocida'}\nAntecedentes: ${p.conditions.join(', ') || 'ninguno registrado'}\nMedicación habitual: ${p.meds.join(', ') || 'ninguna'}\nCirugías previas: ${p.surgeries.join(', ') || 'ninguna'}`, { size: 9.6 });
  y = pdfSection(doc, y, `Consultas y notas (${notes.length})`);
  if (!notes.length) y = pdfPara(doc, y, 'No hay historias firmadas en el sistema.', { color: GREY });
  notes.forEach((n, i) => { if (i) { y = pdfEnsure(doc, y, 20); doc.setDrawColor(...LINE); doc.line(PG.L, y - 4, PG.R, y - 4); y += 12; } y = pdfNoteBody(doc, y, n, true); });
  const old = S.records.filter(r => normDigits(r.ci) === normDigits(p.ci) && r.status === 'validado');
  if (old.length) { y = pdfSection(doc, y, 'Historias anteriores al sistema (archivo digitalizado)'); y = pdfTable(doc, y, ['Fecha', 'Procedimiento', 'Cirujano', 'Medicamentos'], old.map(r => [fdate(r.date), r.procedure, r.surgeon || '—', (r.meds || []).map(m => m.name).join(', ') || '—'])); }
  if (exams.length) { y = pdfSection(doc, y, `Exámenes con resultado (${exams.length})`);
    exams.forEach(e => { y = pdfPara(doc, y, `${e.num} · ${e.tests.join(', ')} · ${fdate(e.date)} · ${docNameOf(e.doc)}`, { size: 9, bold: true, gap: 4 });
      if (e.area === 'imagen') y = pdfPara(doc, y, e.report || 'Sin informe.', { size: 9 });
      else y = pdfTable(doc, y, ['Parámetro', 'Resultado', 'Unidad', 'Referencia'], e.results.filter(r => r.value).map(r => [r.param, r.value + (r.flag ? ` (${r.flag})` : ''), r.unit, r.ref || '—']), { didParseCell: c => { if (c.section === 'body' && c.column.index === 1 && /\((alto|bajo)\)/.test(c.cell.raw)) { c.cell.styles.textColor = RED; c.cell.styles.fontStyle = 'bold'; } } }); }); }
  return doc;
}
const docNameOf = id => med(id)?.name || 'Particular';

// ---------- Récipe ----------
function pdfRecipe(n) {
  const p = pat(n.pid); const d = med(n.doc);
  const doc = pdfNew('Récipe médico', [`Fecha ${fdate(n.date)}`, d.name, d.esp]); let y = PG.top;
  y = pdfInfoBox(doc, y, [['Paciente', p.name], ['Cédula', p.ci], ['Edad', `${ageTxt(p)}`]], 3);
  if (p.allergies.length) y = pdfPara(doc, y, `Alergias: ${p.allergies.join(', ')}`, { size: 9, color: RED, bold: true });
  doc.setFont('times', 'bolditalic'); doc.setFontSize(26); doc.setTextColor(...INK); doc.text('Rp/', PG.L, y + 18); y += 38;
  n.recipe.forEach((r, i) => { y = pdfEnsure(doc, y, 44); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...INK); doc.text(`${i + 1}.  ${r.med}`, PG.L + 6, y);
    const ind = [r.dosis, r.frec, r.dur].filter(Boolean).join('  ·  '); if (ind) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9.8); doc.setTextColor(...GREY); doc.text(ind, PG.L + 22, y + 15); } y += ind ? 36 : 24; });
  if (n.indicaciones) { y = pdfSection(doc, y + 6, 'Indicaciones'); y = pdfPara(doc, y, n.indicaciones, { size: 9.8 }); }
  pdfSignature(doc, Math.max(y, 560), d.name, `${d.esp} · firma y sello`, null, docCreds(d));
  return doc;
}

// ---------- Resultado de examen ----------
function pdfExam(e) {
  const p = pat(e.pid);
  const doc = pdfNew(e.area === 'laboratorio' ? 'Resultado de laboratorio' : 'Informe de imagen', [`Orden ${e.num}`, `Solicitado ${fdate(e.date)}`, `Validado ${e.readyAt || ''}`]); let y = PG.top;
  y = pdfInfoBox(doc, y, [['Paciente', p.name], ['Cédula', p.ci], ['Edad', `${ageTxt(p)} · ${p.sex === 'F' ? 'F' : 'M'}`], ['Solicitado por', docNameOf(e.doc)], ['Exámenes', e.tests.join(', ')], ['Validado por', e.by || '—']], 3);
  if (e.area === 'imagen') { y = pdfSection(doc, y, 'Informe'); y = pdfPara(doc, y, e.report || 'Sin informe escrito.', { size: 10 }); }
  else [...new Set(e.results.map(r => r.test))].forEach(g => { y = pdfSection(doc, y, g);
    y = pdfTable(doc, y, ['Parámetro', 'Resultado', 'Unidad', 'Valor de referencia'], e.results.filter(r => r.test === g).map(r => [r.param, (r.value || '—') + (r.flag ? `   ${r.flag.toUpperCase()}` : ''), r.unit || '', r.ref || '—']),
      { columnStyles: { 1: { fontStyle: 'bold' } }, didParseCell: c => { if (c.section === 'body' && c.column.index === 1 && /(ALTO|BAJO)/.test(c.cell.raw)) c.cell.styles.textColor = RED; } }); });
  y = pdfPara(doc, y, 'Los valores marcados están fuera del rango de referencia. La interpretación corresponde al médico tratante.', { size: 8, color: GREY });
  pdfSignature(doc, y, e.by || '', e.area === 'laboratorio' ? 'Bioanalista responsable' : 'Médico radiólogo');
  return doc;
}

// ---------- Consentimiento informado médico y quirúrgico (para imprimir y firmar en papel) ----------
function pdfConsentPrint(p, c) {
  const d = med(c.doc); const dn = c.docName || d?.name;
  const doc = pdfNew('Consentimiento informado', ['Médico y quirúrgico', `Elaborado ${fdate(c.d)}`, `Historia ${p.code}`]); let y = PG.top;
  y = pdfInfoBox(doc, y, [['Paciente', p.name], ['Cédula', p.ci], ['Edad', `${ageTxt(p)}`], ['Médico tratante', dn || '—'], ['Procedimiento', c.proc], ['Diagnóstico', c.dx || '—']], 3);
  if (p.allergies.length) { doc.setFillColor(253, 236, 236); doc.roundedRect(PG.L, y - 8, PG.R - PG.L, 24, 5, 5, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...RED); doc.text(`ALERGIAS: ${p.allergies.join(', ')}`, PG.L + 12, y + 7.5); y += 30; }
  y = pdfSection(doc, y, 'Declaración del paciente');
  (c.clauses || consentClauses(c, p)).forEach((t, i) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK); y = pdfEnsure(doc, y, 28); doc.text(`${i + 1}.`, PG.L, y + 7.4);
    // La cláusula de "la medicina no es una ciencia exacta" se destaca en negrita
    y = pdfPara(doc, y, t, { size: 9, indent: 16, gap: 3, bold: /ciencia exacta/.test(t) });
  });
  y = pdfPara(doc, y + 4, `En ${(S.clinic.address || 'Caracas').split(',')[0]}, a los _____ días del mes de ____________________ de ________.`, { size: 9, gap: 4 });
  // Firmas: paciente (con huella), representante, testigo y médico tratante
  const box = (x, yy, w, title, sub, finger) => {
    doc.setDrawColor(...INK); doc.setLineWidth(.6); doc.line(x, yy + 44, x + w - (finger ? 70 : 0), yy + 44);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK); doc.text(title, x, yy + 57);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY); doc.text(sub, x, yy + 68);
    if (finger) { doc.setDrawColor(...LINE); doc.roundedRect(x + w - 58, yy, 58, 62, 4, 4); doc.setFontSize(9); doc.text('Huella', x + w - 29, yy + 72, { align: 'center' }); }
  };
  const w = (PG.R - PG.L - 30) / 2;
  y = pdfEnsure(doc, y + 8, 166);
  box(PG.L, y, w, 'Firma del paciente', `${p.name} · C.I. ${p.ci}`, true);
  box(PG.L + w + 30, y, w, 'Firma del representante legal (si aplica)', c.rep || 'Nombre: ________________  C.I.: __________');
  y += 78;
  box(PG.L, y, w, 'Firma del testigo', 'Nombre: ________________  C.I.: __________');
  box(PG.L + w + 30, y, w, 'Firma del médico tratante', dn ? `${dn}${d?.esp ? ' · ' + d.esp : ''}` : 'Nombre: ________________');
  y += 74;
  y = pdfPara(doc, y, 'Revocación de este consentimiento · Nombre: ________________  C.I.: __________  Firma: ______________  Fecha: __________', { size: 7.8, color: GREY, gap: 0 });
  const pages = doc.getNumberOfPages();
  if (pages > 1) for (let i = 1; i < pages; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY); doc.text('Iniciales del paciente: __________', PG.R, PG.bottom - 2, { align: 'right' }); }
  doc.setPage(pages);
  return doc;
}

// ---------- Consentimiento firmado en pantalla (documentos anteriores) ----------
function pdfConsent(p, c) {
  const doc = pdfNew(c.type, [`Firmado ${fdate(c.d)}${c.time ? ' · ' + c.time : ''}`]); let y = PG.top;
  y = pdfInfoBox(doc, y, [['Paciente', p.name], ['Cédula', p.ci], ['Historia', p.code]], 3);
  y = pdfSection(doc, y, 'Declaración'); y = pdfPara(doc, y, c.text || consentText(c.type, p), { size: 10.5 });
  pdfSignature(doc, y + 10, c.signer, `C.I. ${p.ci} · ${fdate(c.d)}`, c.img || null);
  return doc;
}

// ---------- Botones ----------
ACTIONS.pdfNote = async el => { if (!pdfReady()) return; const n = S.hc.find(x => x.id === el.dataset.id); await pdfSave(() => pdfNote(n), `${n.evolutionId ? clinicalNoteTitle(n) : n.type === 'informe' ? 'Informe médico' : 'Historia clínica'} ${pat(n.pid).name} ${n.date}.pdf`); };
ACTIONS.pdfFull = async el => { if (!pdfReady()) return; const p = pat(el.dataset.id); await pdfSave(() => pdfFullHistory(p.id), `Historia clínica completa ${p.name}.pdf`); };
ACTIONS.pdfExam = async el => { if (!pdfReady()) return; const e = S.exams.find(x => x.id === el.dataset.id); await pdfSave(() => pdfExam(e), `${e.area === 'laboratorio' ? 'Laboratorio' : 'Informe'} ${e.num} ${pat(e.pid).name}.pdf`); };
ACTIONS.pdfConsent = async el => { if (!pdfReady()) return; const p = pat(el.dataset.id); const c = p.consents[+el.dataset.i]; await pdfSave(() => pdfConsent(p, c), `${c.type} ${p.name}.pdf`); };
ACTIONS.rxPdf = async el => { if (!pdfReady()) return; const n = S.hc.find(x => x.id === el.dataset.id); await pdfSave(() => pdfRecipe(n), `Récipe ${pat(n.pid).name} ${n.date}.pdf`); };

// Hoja de imprenta Carta. Origen arriba/izquierda; unidades pt (PNG 1275x1650, 150 dpi: px * 0.48).
// Rectángulos de escritura: x, y, ancho, alto. Ningún elemento fijo se dibuja en el PDF de impresión.
const FACTURA_LAYOUT = {
  width: 612, height: 792, fontSize: 10, lineHeight: 13,
  background: 'plantillas/factura-hoja.png',
  fields: {
    place: [372, 74, 82, 19], day: [460, 74, 36, 19], month: [502, 74, 35, 19], year: [544, 74, 36, 19],
    name: [100, 146, 480, 18], address: [94, 169, 486, 19],
    ci: [62, 191, 121, 16], phone: [226, 191, 119, 16], terms: [425, 191, 155, 16],
    base: [482, 643, 98, 13], exempt: [482, 660, 98, 13], igtf: [482, 677, 98, 13],
    ivaPercent: [410, 694, 15, 13], ivaBase: [482, 694, 46, 13], iva: [532, 694, 48, 13], total: [482, 711, 98, 13]
  },
  table: { x: 33, y: 239, bottom: 635, descriptionWidth: 383, unitX: 425, unitWidth: 60, totalX: 495, totalWidth: 85, gap: 5 }
};
// Imagen de la hoja de factura para el PDF que se guarda (en la impresión no se usa: la hoja ya viene impresa)
window.FACTURA_BG = null;
(async () => { try { const b = await (await fetch(FACTURA_LAYOUT.background)).blob(); window.FACTURA_BG = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(b); }); } catch (e) {} })();
const facturaCalibration = () => ({ x: Number(S.facturaPrint?.x) || 0, y: Number(S.facturaPrint?.y) || 0 });
function facturaDoc() {
  const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter', compress: true });
  const raw = doc.text.bind(doc); doc.text = (t, ...a) => raw(pdfClean(t), ...a);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(FACTURA_LAYOUT.fontSize); doc.setTextColor(0);
  doc._preprinted = true; doc._title = 'Datos variables de factura'; return doc;
}
function facturaPages(inv) {
  const doc = facturaDoc(), t = FACTURA_LAYOUT.table, pages = [[]]; let y = t.y;
  const source = inv.items.map(x => ({ ...x }));
  const totals = invTotals(inv);
  if (totals.desc) source.push({ name: 'Cortesía (descuento ' + totals.disc + '%)', price: -totals.desc });
  source.forEach(item => {
    const lines = doc.splitTextToSize(pdfClean(item.name), t.descriptionWidth);
    // Un concepto muy largo continúa sin repetir su monto en los fragmentos intermedios.
    let pos = 0;
    while (pos < lines.length) {
      let available = Math.floor((t.bottom - y - t.gap) / FACTURA_LAYOUT.lineHeight);
      if (available < 1) { pages.push([]); y = t.y; continue; }
      const part = lines.slice(pos, pos + available); pos += part.length;
      pages.at(-1).push({ item, lines: part, y, amount: pos === lines.length });
      y += part.length * FACTURA_LAYOUT.lineHeight + t.gap;
    }
  });
  return pages;
}
function facturaCommands(inv) {
  const l = FACTURA_LAYOUT, f = l.fields, t = l.table, doc = facturaDoc();
  const buyer = inv.buyer || pat(inv.pid), date = (inv.issueDate || inv.date).split('-');
  const money = n => (n * invRate(inv)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pages = facturaPages(inv), totals = invTotals(inv), igtf = r2((inv.payments || []).reduce((s,p) => s + (+p.igtf || 0),0));
  return pages.map((rows,index) => {
    const commands = [];
    const put = (rect, value, right = false) => {
      const lines = doc.splitTextToSize(pdfClean(value), rect[2]);
      if (lines.length * l.lineHeight > rect[3] + 1) throw new Error('Un dato no cabe en la hoja: ' + value + '. Ajuste el dato antes de imprimir.');
      commands.push({ x: rect[0] + (right ? rect[2] : 0), y: rect[1] + 10, lines, right });
    };
    put(f.place, inv.place || 'Caracas'); put(f.day,date[2]); put(f.month,date[1]); put(f.year,date[0]);
    put(f.name,buyer.name || ''); put(f.address,buyer.address || ''); put(f.ci,buyer.ci || ''); put(f.phone,buyer.phone || '');
    put(f.terms,inv.paymentTerms || (inv.status === 'pagada' ? 'Contado' : 'Crédito'));
    rows.forEach(r => {
      commands.push({ x: t.x, y: r.y + 10, lines: r.lines });
      if(r.amount) {
        put([t.unitX,r.y,t.unitWidth,14],money(r.item.price / (r.item.qty || 1)),true);
        put([t.totalX,r.y,t.totalWidth,14],money(r.item.price),true);
      }
    });
    // Los totales globales aparecen solo en la última hoja para no duplicar el cobro.
    if(index === pages.length - 1) {
      put(f.base,money(totals.base),true); put(f.exempt,money(totals.exento),true); put(f.igtf,money(igtf),true);
      put(f.ivaPercent,'0',true); put(f.ivaBase,money(totals.base),true); put(f.iva,money(totals.iva),true); put(f.total,money(totals.total + igtf),true);
    }
    return commands;
  });
}
// La factura: 'contenido' = solo los datos (con la calibración de la impresora); 'membrete' = datos sobre la imagen de la hoja
const pdfFactura = inv => mode => mode === 'contenido' ? pdfFacturaPrint(inv) : pdfFacturaPrint(inv, false, true);
function pdfFacturaPrint(inv, test = false, withSheet = false) {
  const doc = facturaDoc(), offset = withSheet ? { x: 0, y: 0 } : facturaCalibration(), dx = offset.x * 72 / 25.4, dy = offset.y * 72 / 25.4;
  facturaCommands(inv).forEach((commands, page) => {
    if(page) doc.addPage('letter');
    if(withSheet && window.FACTURA_BG) doc.addImage(window.FACTURA_BG,'PNG',0,0,FACTURA_LAYOUT.width,FACTURA_LAYOUT.height,'factura-hoja','FAST');
    // Copia digital: el Nº de factura y el Nº de control que en papel ya vienen impresos por la imprenta
    if(withSheet) { const h=inv.sheets?.[page]||{}; doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(...RED);
      if(h.printedNumber) doc.text(String(h.printedNumber),124,133.5);
      if(h.control) doc.text(String(h.control).replace(/^00-/,''),501,133.5);
      doc.setFont('helvetica','normal'); doc.setFontSize(FACTURA_LAYOUT.fontSize); doc.setTextColor(0); }
    commands.forEach(c => doc.text(c.lines,c.x+dx,c.y+dy,{ align: c.right ? 'right' : 'left', lineHeightFactor: 1.3 }));
    if(test) {
      doc.setDrawColor(90); doc.setLineWidth(.3);
      const t=FACTURA_LAYOUT.table;
      [...Object.values(FACTURA_LAYOUT.fields),[t.x,t.y,t.descriptionWidth,t.bottom-t.y],[t.unitX,t.y,t.unitWidth,t.bottom-t.y],[t.totalX,t.y,t.totalWidth,t.bottom-t.y]].forEach(([x,y,w,h]) => {
        [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]].forEach(([a,b,sx,sy]) => { doc.line(a+dx,b+dy,a+dx+3*sx,b+dy); doc.line(a+dx,b+dy,a+dx,b+dy+3*sy); });
      });
    }
  }); return doc;
}
function facturaPreview(inv) {
  const off=facturaCalibration();
  return facturaCommands(inv).map((commands,i) => '<div class="small muted">Hoja '+(i+1)+' · Control '+esc(inv.sheets?.[i]?.control || 'pendiente de registrar')+'</div><div style="overflow:auto"><div style="position:relative;width:612px;height:792px;background:white;color:black;flex-shrink:0"><img src="'+FACTURA_LAYOUT.background+'" alt="Modelo de hoja preimpresa" style="position:absolute;width:612px;height:792px"><svg xmlns="http://www.w3.org/2000/svg" width="612" height="792" viewBox="0 0 612 792" style="position:absolute;inset:0">'+commands.map(c => '<text x="'+(c.x+off.x*72/25.4)+'" y="'+(c.y+off.y*72/25.4)+'" font-family="Arial,Helvetica,sans-serif" font-size="10" text-anchor="'+(c.right?'end':'start')+'">'+c.lines.map((line,j)=>'<tspan x="'+(c.x+off.x*72/25.4)+'" dy="'+(j?13:0)+'">'+esc(line)+'</tspan>').join('')+'</text>').join('')+'</svg></div></div>').join('');
}
