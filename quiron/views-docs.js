// Presupuestos y facturas imprimibles (vista previa + PDF tamaño carta).
// El aumento por servicio va dentro del precio y no se menciona; la cortesía sí aparece.

function docModel(kind, id) {
  if (kind === 'budget') {
    const b = byId(S.budgets, id); const until = iso(new Date(new Date(b.date + 'T00:00').getTime() + b.valid * DAY));
    return { kind, title: 'PRESUPUESTO', num: b.num, date: b.date, until, p: pat(b.pid), doc: med(b.doc), proc: b.proc, items: budgetItems(b), t: budgetTotals(b), payments: [], money: n => fmt(n) };
  }
  const i = byId(S.invoices, id);
  return { kind, title: isFiscal(i) ? 'FACTURA' : i.status === 'pagada' ? 'RECIBO DE PAGO' : 'NOTA DE COBRO', invoice: i, fiscal: isFiscal(i), num: i.num, control: i.sheets?.map(h => h.control).join(', ') || i.control, date: i.issueDate || i.date, p: i.buyer ? { ...pat(i.pid), ...i.buyer } : pat(i.pid), doc: med(i.doc), proc: i.proc, items: i.items, t: invTotals(i), payments: i.payments,
    rate: invRate(i), fixed: !!i.rate, money: n => fmt(n * invRate(i), 'VES') };   // cuentas y facturas en Bs
}
const pdfMoney = n => fmt(n).replace('$', 'USD ');

function docHTML(m) {
  const c = S.clinic; const igtf = r2(m.payments.reduce((a, p) => a + p.igtf, 0));
  const row = (k, v, strong) => `<div style="display:flex;justify-content:space-between;gap:24px;${strong ? 'font-weight:700;font-size:15px;border-top:1px solid #222;padding-top:6px;margin-top:4px' : ''}"><span>${k}</span><span>${v}</span></div>`;
  return `<div class="paper">
    <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap">
      <div>${window.LOGO ? `<img src="${window.LOGO.url}" alt="${esc(c.name)}" style="width:150px;display:block">` : `<div style="font-size:19px;font-weight:700">${esc(c.name)}</div>`}<div class="prif">RIF ${esc(c.rif)}</div></div>
      <div style="text-align:right"><div style="font-size:17px;font-weight:700;letter-spacing:.04em">${m.title}</div><div class="pm">Nº ${m.num}${m.control ? `<br>Nº de control ${m.control}` : ''}<br>Fecha ${fdate(m.date)}${m.until ? `<br>Válido hasta ${fdate(m.until)}` : ''}</div></div>
    </div>
    <div class="pbox"><div><b>Paciente:</b> ${esc(m.p.name)} · C.I. ${esc(m.p.ci)}</div><div><b>Teléfono:</b> ${esc(m.p.phone)}${m.p.address ? ` · <b>Dirección:</b> ${esc(m.p.address)}` : ''}</div>
      ${m.doc ? `<div><b>Médico tratante:</b> ${esc(m.doc.name)}</div>` : ''}${m.proc ? `<div><b>Procedimiento:</b> ${esc(m.proc)}</div>` : ''}</div>
    <table class="ptable"><thead><tr><th>Descripción</th><th style="text-align:right">Monto</th></tr></thead>
      <tbody>${m.items.map(x => `<tr><td>${esc(x.name)}</td><td style="text-align:right">${m.money(x.price)}</td></tr>`).join('')}</tbody></table>
    <div style="margin-left:auto;max-width:330px;display:grid;gap:3px;font-variant-numeric:tabular-nums">
      ${row('Subtotal', m.money(m.t.sub))}
      ${m.t.disc ? row(`Cortesía (descuento ${m.t.disc}%)`, '-' + m.money(m.t.desc)) : ''}
      ${m.kind === 'invoice' && m.fiscal ? row('IVA', 'Exento · servicio médico') : ''}
      ${row('TOTAL', m.money(m.t.total), true)}
      ${m.kind === 'budget' ? row(`Equivalente en Bs (tasa BCV ${S.rate.toLocaleString('es-VE', { maximumFractionDigits: 4 })})`, fmt(m.t.total * S.rate, 'VES')) : row(`Referencia: tasa BCV ${m.rate.toLocaleString('es-VE', { maximumFractionDigits: 4 })} Bs/USD`, fmt(m.t.total))}
      ${igtf ? row(`IGTF ${S.igtfRate}% pagado`, m.money(igtf)) : ''}
    </div>
    ${m.payments.length ? `<div class="pm" style="margin-top:12px"><b>Forma de pago:</b> ${m.payments.map(p => `${metodo(p.method).name} ${fmt(p.amount, p.cur)}`).join(' · ')}</div>` : ''}
    <div class="pm" style="margin-top:18px;border-top:1px solid #ddd;padding-top:8px">${m.kind === 'budget' ? `Presupuesto válido por ${Math.round((new Date(m.until) - new Date(m.date)) / DAY)} días. Montos expresados en dólares; el equivalente en bolívares se calcula a la tasa oficial BCV del día del pago. ` : ''}${esc(c.note)}</div>
  </div>`;
}

// El PDF (A4, con logo y RIF) se genera en pdf-kit.js

ACTIONS.showDoc = el => {
  const m = docModel(el.dataset.kind, el.dataset.id); UI.docShown = { kind: el.dataset.kind, id: el.dataset.id };
  if (m.fiscal) {
    if (!pdfReady()) return;
    if (!m.invoice.sheets || m.invoice.sheets.length !== facturaPages(m.invoice).length) return openFacturaIssue({ id: m.invoice.id });
    try { openSheet('Factura · revisión sobre hoja preimpresa', facturaPreview(m.invoice) + facturaVoidHistory(m.invoice.id), '<button class="btn" data-act="facturaReplace" data-id="'+m.invoice.id+'">Hoja dañada / anulada · reemplazar</button><button class="btn" data-act="downloadDoc">Descargar copia digital</button><button class="btn primary" data-act="facturaPrint">Imprimir sobre hoja preimpresa</button>', { wide: true }); } catch(e) { toast(e.message); }
    return;
  }
  openSheet(`${m.kind === 'budget' ? 'Presupuesto' : m.fiscal ? 'Factura' : 'Recibo'} ${m.num}`, patientBand(m.p.id) + docHTML(m),
    `<span class="note" id="doc-msg">${m.kind === 'budget' ? 'Los aumentos por servicio no se muestran; la cortesía sí.' : ''}</span><button class="btn" data-act="close">Cerrar</button><button class="btn primary" data-act="downloadDoc">Descargar PDF</button>`, { wide: true });
};
ACTIONS.downloadDoc = async () => {
  const msg = document.getElementById('doc-msg'); const m = docModel(UI.docShown.kind, UI.docShown.id);
  if (!pdfReady()) return;
  await pdfSave(pdfBilling(m), `${m.kind === 'budget' ? 'Presupuesto' : m.fiscal ? 'Copia digital de factura' : 'Recibo'} ${m.num} - ${m.p.name}.pdf`);
};

// ---------- Presupuestos ----------
// Guardar → enviar a Contabilidad → registrar dinero recibido o rechazo.
const isSurgBudget = b => b.v2 ? b.kind === 'quirurgico' : (b.serviceIds || []).includes('v5') || /cirug|ectom|rrafia|plastia|scopia/i.test(b.proc || '');
const budWords = b => ({ ok: 'Pago recibido', no: 'No pagado / rechazado', okSt: 'Enviado a Contabilidad', noSt: 'No pagado / rechazado' });
const BUD_ST = { abierto: ['Guardado · por enviar', 'info'], enviado: ['Enviado a Contabilidad', 'warn'], aceptado: ['Enviado a Contabilidad', 'warn'], facturado: ['Cuenta registrada · sin pago', 'warn'], pagado: ['Pago recibido', 'good'], parcial: ['Pago parcial recibido', 'info'], rechazado: ['No pagado / rechazado', ''], vencido: ['Vencido', ''] };
const budStatus = b => {
  if (b.status === 'facturado') { const inv = byId(S.invoices, b.inv); return inv && invPaid(inv) > 0 ? (invDue(inv) <= 0.01 ? 'pagado' : 'parcial') : 'facturado'; }
  if (b.status === 'aceptado') return 'enviado';
  return b.status === 'abierto' && daysTo(iso(new Date(new Date(b.date + 'T00:00').getTime() + b.valid * DAY))) < 0 ? 'vencido' : b.status;
};
window.budPill = b => { const s = BUD_ST[budStatus(b)] || [b.status, '']; return `<span class="pill ${s[1]}">${s[0]}</span>`; };
function budSteps(b) {
  const st = budStatus(b); if (['rechazado', 'vencido'].includes(st)) return '';
  const at = st === 'abierto' ? 0 : st === 'enviado' || st === 'facturado' ? 1 : 2;
  return `<div class="hstack small">${['Guardado', 'Contabilidad', st === 'parcial' ? 'Pago parcial recibido' : 'Pago recibido'].map((n, i) => `<span class="pill ${i < at || (i === 2 && at === 2) ? 'good' : i === at ? 'warn' : ''}">${i + 1}. ${n}</span>`).join('')}</div>`;
}
window.budSteps = budSteps;

ACTIONS.openBudget = el => {
  const b = byId(S.budgets, el.dataset.id); const t = budgetTotals(b); const items = budgetItems(b); const st = budStatus(b); const w = budWords(b);
  const missing = b.v2 ? [] : checkStock(bundleLines(b.serviceIds, b.extras, b.qty || {}));
  const acct = canSee('contabilidad'); const surg = isSurgBudget(b);
  const tip = { abierto: 'Puede descargar el presupuesto y enviarlo directamente a Contabilidad.', enviado: 'Contabilidad debe registrar el dinero recibido o indicar que no se pagó / fue rechazado.', facturado: 'La cuenta existe, pero todavía no tiene pagos registrados.', parcial: 'Se recibió un abono. El saldo restante está pendiente en Contabilidad.', pagado: 'El pago está registrado en Contabilidad.', rechazado: 'No pagado / rechazado.' + (b.reason ? ' Motivo: ' + b.reason : ''), vencido: 'El período de validez finalizó. Elabore un presupuesto nuevo con los precios vigentes.' }[st];
  const dl = `<button class="btn" data-act="budDownload" data-id="${b.id}">${icon('descargar')}Descargar PDF</button>`;
  const no = `<button class="btn danger" data-act="budReject" data-id="${b.id}">No pagado / rechazado</button>`;
  const btns = st === 'abierto' ? `${dl}<button class="btn primary" data-act="budSend" data-id="${b.id}">Enviar a contabilidad</button>` : st === 'enviado' && acct ? `${dl}${no}<button class="btn primary" data-act="budAccept" data-id="${b.id}">Pago recibido</button>` : ['facturado', 'parcial', 'pagado'].includes(st) && acct && b.inv ? `${dl}<button class="btn primary" data-act="openInvoice" data-id="${b.inv}">Ver cuenta y pagos</button>` : dl;
  openSheet(`Presupuesto ${b.num}`, `${patientBand(b.pid)}<div class="between"><div><b>${esc(pat(b.pid).name)}</b><div class="small muted">${fdate(b.date)} · válido por ${b.valid} días${b.proc ? ' · ' + esc(b.proc) : ''}</div></div>${budPill(b)}</div>
    ${budSteps(b)}
    <div class="banner">${esc(tip)}</div>
    <div class="tablewrap"><table><thead><tr><th>Concepto</th><th class="num">Precio de lista</th><th class="num">Aumento</th><th class="num">En documento</th></tr></thead><tbody>
    ${items.map(x => `<tr><td>${esc(x.name)}</td><td class="num">${fmt(x.base)}</td><td class="num">${x.adj ? `<span class="pill warn">+${x.adj}%</span>` : '—'}</td><td class="num">${fmt(x.price)}</td></tr>`).join('')}</tbody>
    <tfoot>${t.disc ? `<tr><td colspan="3">Cortesía (descuento ${t.disc}%)</td><td class="num">-${fmt(t.desc)}</td></tr>` : ''}<tr><td colspan="3">Total</td><td class="num">${fmt(t.total)}</td></tr></tfoot></table></div>
    <div class="small muted">La columna "Aumento" es de uso interno; el paciente solo ve el precio final.</div>
    ${['enviado', 'aceptado'].includes(st) && missing.length ? `<div class="banner warn">Existencia insuficiente para facturar: ${missing.map(x => esc(prod(x.pid).name)).join(', ')}.</div>` : ''}`,
    `<button class="btn ghost" data-act="showDoc" data-kind="budget" data-id="${b.id}">Ver documento</button>${btns}`, { wide: true });
};
// Descarga directa del PDF (sin pasar por la vista previa)
ACTIONS.budDownload = async el => {
  if (!pdfReady()) return; const m = docModel('budget', el.dataset.id);
  await pdfSave(pdfBilling(m), `Presupuesto ${m.num} - ${m.p.name}.pdf`);
};
const budRefresh = b => { save(); closeSheet(); render(); };
ACTIONS.budSend = el => {
  if (!canSee('atencion')) return;
  const b = byId(S.budgets, el.dataset.id); if (!b || budStatus(b) !== 'abierto') { closeSheet(); render(); return; } b.status = 'enviado'; b.sentAt = nowStamp(); b.sentBy = actor();
  log('Presupuesto enviado a Contabilidad', b.num); budRefresh(b); toast(`${b.num} enviado a Contabilidad`);
};
ACTIONS.budAccept = el => ACTIONS.convertBudget(el);
ACTIONS.budReject = el => { if (!canSee('contabilidad') || !['enviado', 'aceptado'].includes(byId(S.budgets, el.dataset.id)?.status)) return; const w = budWords(byId(S.budgets, el.dataset.id));
  openSheet(w.no, `${patientBand(byId(S.budgets, el.dataset.id)?.pid)}<div class="field"><label for="bud-r">Motivo (opcional)</label><input class="input" id="bud-r" placeholder="Ej. el paciente no aceptó el monto; la intervención se reprogramará"></div>`,
  `<button class="btn" data-act="close">Cancelar</button><button class="btn danger" data-act="budRejectSave" data-id="${el.dataset.id}">Confirmar</button>`); };
ACTIONS.budRejectSave = el => {
  if (!canSee('contabilidad') || !['enviado', 'aceptado'].includes(byId(S.budgets, el.dataset.id)?.status)) return;
  const b = byId(S.budgets, el.dataset.id); const w = budWords(b); b.status = 'rechazado'; b.reason = val('bud-r').trim();
  log(w.noSt, `${b.num}${b.reason ? ' · ' + b.reason : ''}`); budRefresh(b); toast(`${b.num}: ${w.noSt.toLowerCase()}`);
};
ACTIONS.convertBudget = el => {
  if (!canSee('contabilidad')) return;
  const b = byId(S.budgets, el.dataset.id); if (!b || !['enviado', 'aceptado'].includes(b.status)) return;
  UI.pay = { budget: b.id, method: 'usd', igtf: false, draft: { pid: b.pid, items: budgetItems(b), disc: b.disc, payments: [], fiscal: false, status: 'pendiente' } };
  openSheet(`Pago recibido · ${b.num}`, payBody(), '<span class="note" id="pay-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="savePay">Confirmar pago recibido</button>');
};

ACTIONS.facturaPrint = async () => {
  if(!pdfReady() || !canSee('contabilidad')) return;
  const inv=byId(S.invoices,UI.docShown.id);
  if(!inv.sheets || inv.sheets.length !== facturaPages(inv).length) return openFacturaIssue({id:inv.id});
  const error=facturaSheetError(inv.sheets,inv.id); if(error) return toast(error);
  try { await pdfSave(pdfFacturaPrint(inv),'Impresión en hoja preimpresa '+inv.num+'.pdf'); } catch(e) {toast(e.message);}
};
