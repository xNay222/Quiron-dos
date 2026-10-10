// Presupuestos y facturas imprimibles (vista previa + PDF tamaño carta).
// El aumento por servicio va dentro del precio y no se menciona; la cortesía sí aparece.

function docModel(kind, id) {
  if (kind === 'budget') {
    const b = byId(S.budgets, id); const until = iso(new Date(new Date(b.date + 'T00:00').getTime() + b.valid * DAY));
    return { kind, title: 'PRESUPUESTO', num: b.num, date: b.date, until, p: pat(b.pid), doc: med(b.doc), proc: b.proc, items: budgetItems(b), t: budgetTotals(b), payments: [], money: n => fmt(n) };
  }
  const i = byId(S.invoices, id);
  return { kind, title: isFiscal(i) ? 'FACTURA' : i.status === 'pagada' ? 'RECIBO DE PAGO' : 'NOTA DE COBRO', fiscal: isFiscal(i), num: i.num, control: i.control, date: i.date, p: pat(i.pid), doc: med(i.doc), proc: i.proc, items: i.items, t: invTotals(i), payments: i.payments,
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
  openSheet(`${m.kind === 'budget' ? 'Presupuesto' : m.fiscal ? 'Factura' : 'Recibo'} ${m.num}`, docHTML(m),
    `<span class="note" id="doc-msg">${m.kind === 'budget' ? 'Los aumentos por servicio no se muestran; la cortesía sí.' : ''}</span><button class="btn" data-act="close">Cerrar</button><button class="btn primary" data-act="downloadDoc">Descargar PDF</button>`, { wide: true });
};
ACTIONS.downloadDoc = async () => {
  const msg = document.getElementById('doc-msg'); const m = docModel(UI.docShown.kind, UI.docShown.id);
  if (!pdfReady()) return;
  await pdfSave(pdfBilling(m), `${m.kind === 'budget' ? 'Presupuesto' : m.fiscal ? 'Factura' : 'Recibo'} ${m.num} - ${m.p.name}.pdf`);
};

// ---------- Presupuestos ----------
// Flujo: se elabora → se descarga y se entrega al paciente → el paciente lo aprueba → se envía a Contabilidad
// → Contabilidad aprueba o descarta → Contabilidad registra el cobro (la factura fiscal es opcional).
// Vocabulario formal: en presupuestos quirúrgicos se usa "Cirugía aprobada" / "Cirugía descartada".
const isSurgBudget = b => b.v2 ? b.kind === 'quirurgico' : b.serviceIds.includes('v5') || /cirug|ectom|rrafia|plastia|scopia/i.test(b.proc || '');
const budWords = b => isSurgBudget(b)
  ? { ok: 'Cirugía aprobada', no: 'Cirugía descartada', okSt: 'Cirugía aprobada · pendiente de cobro', noSt: 'Cirugía descartada' }
  : { ok: 'Presupuesto aprobado', no: 'Presupuesto descartado', okSt: 'Aprobado · pendiente de cobro', noSt: 'Descartado' };
const BUD_ST = {
  abierto: ['Pendiente de aprobación del paciente', 'info'], enviado: ['En revisión por Contabilidad', 'warn'], aceptado: ['Aprobado · pendiente de cobro', 'info'],
  facturado: ['Cobro registrado', 'good'], rechazado: ['Descartado', ''], vencido: ['Vencido', ''],
};
const budStatus = b => b.status === 'abierto' && daysTo(iso(new Date(new Date(b.date + 'T00:00').getTime() + b.valid * DAY))) < 0 ? 'vencido' : b.status;
window.budPill = b => { const st = budStatus(b); const s = BUD_ST[st]; const w = budWords(b);
  const label = st === 'aceptado' ? w.okSt : st === 'rechazado' ? w.noSt : s[0]; return `<span class="pill ${s[1]}">${label}</span>`; };
// Etapas del presupuesto
function budSteps(b) {
  const st = budStatus(b); if (st === 'rechazado' || st === 'vencido') return '';
  const order = ['abierto', 'enviado', 'aceptado', 'facturado']; const at = order.indexOf(st);
  const names = ['Aprobación del paciente', 'Revisión de Contabilidad', 'Registro del cobro', 'Cobro registrado'];
  return `<div class="hstack small" style="gap:6px;flex-wrap:wrap">${names.map((n, i) => `<span class="pill ${i < at ? 'good' : i === at ? 'warn' : ''}">${i < at ? '✓ ' : `${i + 1}. `}${n}</span>`).join('')}</div>`;
}
window.budSteps = budSteps;

ACTIONS.openBudget = el => {
  const b = byId(S.budgets, el.dataset.id); const t = budgetTotals(b); const items = budgetItems(b); const st = budStatus(b); const w = budWords(b);
  const missing = b.v2 ? [] : checkStock(bundleLines(b.serviceIds, b.extras, b.qty || {}));
  const acct = canSee('contabilidad'); const surg = isSurgBudget(b);
  const tip = {
    abierto: 'Descargue el PDF y entréguelo al paciente. Una vez aprobado por el paciente, envíelo a Contabilidad.',
    enviado: acct ? `El paciente aprobó el presupuesto. Indique si ${surg ? 'la cirugía queda aprobada o descartada' : 'el presupuesto queda aprobado o descartado'}.` : 'El paciente aprobó el presupuesto. Pendiente de revisión por Contabilidad.',
    aceptado: acct ? `${w.ok} por Contabilidad. Registre el cobro; la factura fiscal es opcional y puede emitirse después.` : `${w.ok} por Contabilidad. Contabilidad registrará el cobro.`,
    facturado: 'El cobro ya está registrado.', rechazado: `${w.noSt}.${b.reason ? ' Motivo: ' + b.reason : ''}`, vencido: 'El período de validez finalizó. Si el paciente desea continuar, elabore un presupuesto nuevo con los precios vigentes.',
  }[st];
  const dl = `<button class="btn" data-act="budDownload" data-id="${b.id}">${icon('descargar')}Descargar PDF</button>`;
  const no = `<button class="btn danger" data-act="budReject" data-id="${b.id}">${w.no}</button>`;
  const btns = {
    abierto: `${no}${dl}<button class="btn primary" data-act="budSend" data-id="${b.id}">Aprobado por el paciente · Enviar a Contabilidad</button>`,
    enviado: acct ? `${dl}${no}<button class="btn primary" data-act="budAccept" data-id="${b.id}">${w.ok}</button>` : dl,
    aceptado: acct ? `${dl}<button class="btn" data-act="convertBudget" data-id="${b.id}" data-fiscal="1" ${missing.length ? 'disabled' : ''}>Cobrar con factura fiscal</button><button class="btn primary" data-act="convertBudget" data-id="${b.id}" ${missing.length ? 'disabled' : ''}>Registrar cobro</button>` : dl,
    facturado: `${dl}${b.inv && canSee('contabilidad') ? `<button class="btn primary" data-act="openInvoice" data-id="${b.inv}">Ver cobro</button>` : ''}`,
  }[st] || dl;
  openSheet(`Presupuesto ${b.num}`, `<div class="between"><div><b>${esc(pat(b.pid).name)}</b><div class="small muted">${fdate(b.date)} · válido por ${b.valid} días${b.proc ? ' · ' + esc(b.proc) : ''}</div></div>${budPill(b)}</div>
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
  const b = byId(S.budgets, el.dataset.id); if (b.status !== 'abierto') { closeSheet(); render(); return; } b.status = 'enviado'; b.sentAt = nowStamp(); b.sentBy = actor();
  log('Presupuesto enviado a Contabilidad', `${b.num} · aprobado por el paciente`); budRefresh(b); toast(`${b.num} enviado a Contabilidad`);
};
ACTIONS.budAccept = el => {
  const b = byId(S.budgets, el.dataset.id); if (b.status !== 'enviado') { closeSheet(); render(); return; } const w = budWords(b); b.status = 'aceptado'; b.acceptedAt = nowStamp(); b.acceptedBy = actor();
  log(w.ok, b.num); save(); toast(`${b.num}: ${w.ok.toLowerCase()}. Puede registrar el cobro.`); ACTIONS.openBudget({ dataset: { id: b.id } }); render();
};
ACTIONS.budReject = el => { const w = budWords(byId(S.budgets, el.dataset.id));
  openSheet(w.no, `<div class="field"><label for="bud-r">Motivo (opcional)</label><input class="input" id="bud-r" placeholder="Ej. el paciente no aceptó el monto; la intervención se reprogramará"></div>`,
  `<button class="btn" data-act="close">Cancelar</button><button class="btn danger" data-act="budRejectSave" data-id="${el.dataset.id}">Confirmar</button>`); };
ACTIONS.budRejectSave = el => {
  const b = byId(S.budgets, el.dataset.id); const w = budWords(b); b.status = 'rechazado'; b.reason = val('bud-r').trim();
  log(w.noSt, `${b.num}${b.reason ? ' · ' + b.reason : ''}`); budRefresh(b); toast(`${b.num}: ${w.noSt.toLowerCase()}`);
};
ACTIONS.convertBudget = el => {
  const b = byId(S.budgets, el.dataset.id); const fiscal = el.dataset.fiscal === '1';
  const res = b.v2 ? chargeFromBudget(b, fiscal)
    : createAttention({ pid: b.pid, doc: b.doc, serviceIds: b.serviceIds, extras: b.extras, adj: b.adj, qty: b.qty || {}, disc: b.disc, proc: b.proc, budgetId: b.id, fiscal });
  if (!res.ok) { toast(res.msg || 'Existencia insuficiente'); closeSheet(); render(); return; }
  toast(`${fiscal ? 'Factura' : 'Cuenta'} ${res.inv.num} registrada desde ${b.num}`); openPay(res.inv.id);
};
