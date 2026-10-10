// Nuevo presupuesto en tres pasos: 1) paciente, 2) tipo y paquete, 3) ajustar lo que cambia.
// Paquetes: Servicios → Paquetes (los crea y edita la administración; también desde un presupuesto).

const pkgTotal = pk => pkgItems(budgetFromPkg(pk)).reduce((s, i) => s + i.price, 0);
const pkgSummary = pk => [pk.hours ? `${pk.hours} h de quirófano` : '', pk.days ? `${pk.days} día${pk.days > 1 ? 's' : ''} de hospitalización` : '', pk.uci ? `${pk.uci} día${pk.uci > 1 ? 's' : ''} de UCI` : ''].filter(Boolean).join(' · ') || 'Sin quirófano ni hospitalización';
const emptyBudget = kind => ({ v2: true, kind, tpl: null, proc: '', hours: kind === 'quirurgico' ? 1 : 0, days: 0, uci: 0, fees: FEES(['Médico tratante', 0]), material: 0, extras: [], adj: 0, disc: 0, detailFees: false });

ACTIONS.newBudget = (el, pre = {}) => {
  ppReset('bud', { pid: pre.pid || el?.dataset?.pid || null });
  UI.bq = { ...emptyBudget('quirurgico'), chosen: false, q: '', doc: '' };
  openSheet('Nuevo presupuesto', bqBody(), bqFoot(), { wide: true });
};
const bqRow = (label, control, price, hint = '') => `<div class="row"><div class="grow"><div class="t">${label}</div>${hint ? `<div class="s">${hint}</div>` : ''}</div><div class="hstack">${control}</div><div class="end" style="min-width:96px"><b>${price}</b></div></div>`;
function bqList() {
  const q = UI.bq; const list = S.packages.filter(pk => pk.kind === q.kind && (!q.q || normTxt(pk.name).includes(normTxt(q.q))));
  return `<div class="pkgrid">${list.map(pk => `<button class="pkcard" data-act="bqPick" data-id="${pk.id}"><div class="t">${esc(pk.name)}</div><div class="s">${pkgSummary(pk)}</div><div class="p">${fmt(pkgTotal(pk))}</div></button>`).join('')}
    <button class="pkcard blank" data-act="bqBlank"><div class="t">+ Empezar en blanco</div><div class="s">Para un caso que no tiene paquete</div></button></div>`;
}
function bqBody() {
  const q = UI.bq; const items = pkgItems(q);
  if (!q.doc) { const pid = UI.pp?.bud?.pid; q.doc = (pid && nextSurgery(pid)?.doc) || (myDoc() && !med(myDoc())?.resident ? myDoc() : '') || ''; }
  const head = `<div><b class="small">1. Paciente</b><div id="pp-bud" style="margin-top:8px">${patientPicker('bud')}</div></div>`;
  if (!q.chosen) return head + `<div style="display:grid;gap:10px"><b class="small">2. ¿Qué presupuesto va a elaborar?</b>
    <div class="seg" role="group" aria-label="Tipo de presupuesto">${Object.entries(BUD_KINDS).map(([k, t]) => `<button data-act="bqKind" data-k="${k}" aria-pressed="${q.kind === k}">${t}</button>`).join('')}</div>
    <div class="search">${icon('buscar')}<input class="input" id="bq-q" placeholder="Buscar ${q.kind === 'quirurgico' ? 'cirugía' : q.kind === 'emergencia' ? 'atención de emergencia' : 'procedimiento'}" value="${esc(q.q)}" data-in="bqSearch" autocomplete="off" aria-label="Buscar paquete"></div>
    <div id="bq-list">${bqList()}</div></div>`;
  const amt = (id, value, act, data) => `<input class="input" style="width:110px;text-align:right" type="number" min="0" step="1" id="${id}" value="${+value || ''}" placeholder="0" data-in="${act}" ${data} aria-label="Monto en dólares">`;
  const txt = (id, value, act, data, ph) => `<input class="input" style="flex:1;min-width:140px" id="${id}" value="${esc(value || '')}" placeholder="${ph}" data-in="${act}" ${data}>`;
  return head + `<div class="ppsel"><div class="grow"><div class="small muted">2. ${BUD_KINDS[q.kind]} · ${q.tpl ? 'desde paquete' : 'en blanco'}</div><div class="t">${esc(q.proc || 'Sin nombre')}</div></div><button class="btn ghost sm" data-act="bqChange">Cambiar</button></div>
  <div style="display:grid;gap:10px"><b class="small">3. Ajuste lo que cambie</b>
    <div class="form"><div class="field"><label for="bq-proc">Nombre en el documento</label><input class="input" id="bq-proc" value="${esc(q.proc)}" data-in="bqText" data-k="proc" placeholder="Ej. Colecistectomía laparoscópica"></div>
      <div class="field"><label for="bq-doc">Médico tratante <span style="color:var(--bad)">*</span></label><select class="input" id="bq-doc" data-ch="bqDoc"><option value="">Seleccione…</option>${consultDocs().map(m => `<option value="${m.id}" ${m.id === q.doc ? 'selected' : ''}>${esc(m.name)} · ${esc(m.esp)}</option>`).join('')}</select></div></div>
    <div class="list">
      ${bqRow('Quirófano', stepper('bq-h', q.hours, 'bqStep', 'data-k="hours"', 0, 24) + '<span class="small muted">horas</span>', q.hours ? fmt(svcPrice(svc('v5'), q.hours)) : '—', tierText(svc('v5')))}
      ${bqRow('Hospitalización', stepper('bq-d', q.days, 'bqStep', 'data-k="days"', 0, 60) + '<span class="small muted">días</span>', q.days ? fmt(q.days * svc('v8').price) : '—', `${fmt(svc('v8').price)} por día`)}
      ${bqRow('Unidad de cuidados intensivos', stepper('bq-u', q.uci, 'bqStep', 'data-k="uci"', 0, 60) + '<span class="small muted">días</span>', q.uci ? fmt(q.uci * svc('v33').price) : '—', `${fmt(svc('v33').price)} por día`)}
      ${bqRow('Material, medicamentos e insumos', amt('bq-mat', q.material, 'bqNum', 'data-k="material"'), '', 'Un solo monto; no se detallan equipos ni insumos')}
    </div>
    <div class="card" style="display:grid;gap:8px;padding:12px 14px"><div class="between"><b class="small">Honorarios médicos</b><label class="hstack small"><input type="checkbox" id="bq-det" data-ch="bqDetail" ${q.detailFees ? 'checked' : ''}> Detallar en el documento</label></div>
      ${q.fees.map((f, i) => `<div class="hstack" style="flex-wrap:nowrap">${txt('bq-fn' + i, f.name, 'bqArr', `data-a="fees" data-i="${i}" data-f="name"`, 'Ej. Cirujano')}${amt('bq-fa' + i, f.amount, 'bqArr', `data-a="fees" data-i="${i}" data-f="amount"`)}<button class="btn ghost" data-act="bqDel" data-a="fees" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('')}
      <button class="btn sm" style="justify-self:start" data-act="bqAdd" data-a="fees">+ Agregar honorario</button></div>
    <div class="card" style="display:grid;gap:8px;padding:12px 14px"><b class="small">Otros cargos <span class="muted">(opcional)</span></b>
      ${q.extras.map((e, i) => `<div class="hstack" style="flex-wrap:nowrap">${txt('bq-en' + i, e.name, 'bqArr', `data-a="extras" data-i="${i}" data-f="name"`, 'Concepto')}${amt('bq-ea' + i, e.amount, 'bqArr', `data-a="extras" data-i="${i}" data-f="amount"`)}<button class="btn ghost" data-act="bqDel" data-a="extras" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('')}
      <div class="hstack"><button class="btn sm" data-act="bqAdd" data-a="extras">+ Agregar cargo</button>
        <select class="input" style="width:auto" data-ch="bqCatalog" aria-label="Agregar un servicio del catálogo"><option value="">Agregar un servicio del catálogo…</option>${S.services.filter(s => !['Laboratorio', 'Imagen y diagnóstico', 'Consultas'].includes(s.cat)).map(s => `<option value="${s.id}">${esc(s.name)} · ${fmt(svcPrice(s, 1))}</option>`).join('')}</select></div></div>
    <div class="card" id="bq-tot">${bqTotals()}</div></div>`;
}
function bqTotals() {
  const q = UI.bq; const items = pkgItems(q); const t = totalsOf(items, q.disc);
  return `<div class="grid g2" style="align-items:start"><div><div class="small muted" style="margin-bottom:6px">Así se verá en el documento</div><div class="stack small">${items.map(x => `<div class="between"><span>${esc(x.name)}</span><span>${fmt(x.price)}</span></div>`).join('') || '<span class="muted">Sin montos todavía.</span>'}</div></div>
    <div class="totals"><div style="align-items:center"><label class="muted" for="bq-adj">Aumento interno % <span class="small">(no aparece)</span></label><input class="input" style="width:80px;text-align:right" type="number" min="0" step="1" id="bq-adj" value="${q.adj || 0}" data-in="bqNum" data-k="adj"></div>
      <div style="align-items:center"><label class="muted" for="bq-disc">Cortesía (descuento %)</label><input class="input" style="width:80px;text-align:right" type="number" min="0" max="100" step="1" id="bq-disc" value="${q.disc || 0}" data-in="bqNum" data-k="disc"></div>
      ${t.disc ? `<div><span class="muted">Cortesía ${t.disc}%</span><span>-${fmt(t.desc)}</span></div>` : ''}
      <div class="big"><span>Total</span><span id="bq-total">${fmt(t.total)}</span></div>
      <div class="small muted" style="justify-content:flex-end">${fmt(t.total * S.rate, 'VES')} a tasa BCV</div></div></div>`;
}
function bqFoot() {
  const q = UI.bq;
  return `<span class="note" id="bq-msg"></span>${q.chosen && role() === 'admin' ? `<button class="btn ghost" data-act="bqSavePkg">Guardar como paquete</button>` : ''}
    <button class="btn" data-act="bqSave" ${q.chosen ? '' : 'disabled'}>Guardar</button><button class="btn primary" data-act="bqSave" data-dl="1" ${q.chosen ? '' : 'disabled'}>${icon('descargar')}Guardar y descargar PDF</button>`;
}
const bqRedraw = () => refreshSheet(bqBody(), bqFoot());
const bqTot = () => { const n = document.getElementById('bq-tot'); if (!n) return; const f = document.activeElement?.id; n.innerHTML = bqTotals(); const el = f && document.getElementById(f); if (el && n.contains(el)) { el.focus(); try { el.setSelectionRange(99, 99); } catch (e) {} } };
ACTIONS.bqKind = el => { UI.bq.kind = el.dataset.k; bqRedraw(); };
ACTIONS.bqSearch = el => { UI.bq.q = el.value; document.getElementById('bq-list').innerHTML = bqList(); };
ACTIONS.bqPick = el => { const pk = S.packages.find(x => x.id === el.dataset.id); Object.assign(UI.bq, budgetFromPkg(pk), { chosen: true }); bqRedraw(); };
ACTIONS.bqBlank = () => { Object.assign(UI.bq, emptyBudget(UI.bq.kind), { chosen: true }); bqRedraw(); document.getElementById('bq-proc')?.focus(); };
ACTIONS.bqChange = () => { UI.bq.chosen = false; bqRedraw(); };
ACTIONS.bqText = el => { UI.bq[el.dataset.k] = el.value; };
ACTIONS.bqDoc = el => { UI.bq.doc = el.value; };
ACTIONS.bqNum = el => { UI.bq[el.dataset.k] = Math.max(0, +el.value || 0); if (el.dataset.k === 'disc') UI.bq.disc = Math.min(100, UI.bq.disc); bqTot(); };
ACTIONS.bqStep = el => { const k = el.dataset.k; UI.bq[k] = Math.max(0, (UI.bq[k] || 0) + +el.dataset.d); bqRedraw(); };
ACTIONS.bqArr = el => { const row = UI.bq[el.dataset.a][+el.dataset.i]; row[el.dataset.f] = el.dataset.f === 'amount' ? Math.max(0, +el.value || 0) : el.value; if (el.dataset.f === 'amount') bqTot(); };
ACTIONS.bqAdd = el => { UI.bq[el.dataset.a].push({ name: '', amount: 0 }); bqRedraw(); document.getElementById(`bq-${el.dataset.a === 'fees' ? 'fn' : 'en'}${UI.bq[el.dataset.a].length - 1}`)?.focus(); };
ACTIONS.bqDel = el => { UI.bq[el.dataset.a].splice(+el.dataset.i, 1); bqRedraw(); };
ACTIONS.bqDetail = el => { UI.bq.detailFees = el.checked; bqTot(); };
ACTIONS.bqCatalog = el => { const s = svc(el.value); if (!s) return; UI.bq.extras.push({ name: s.name, amount: svcPrice(s, 1) }); bqRedraw(); };
const bqFields = q => ({ v2: true, kind: q.kind, tpl: q.tpl, proc: q.proc.trim(), hours: q.hours, days: q.days, uci: q.uci, fees: q.fees.filter(f => f.name.trim() || +f.amount).map(f => ({ name: f.name.trim(), amount: +f.amount || 0 })),
  material: +q.material || 0, extras: q.extras.filter(e => e.name.trim() || +e.amount).map(e => ({ name: e.name.trim(), amount: +e.amount || 0 })), adj: +q.adj || 0, disc: +q.disc || 0, detailFees: !!q.detailFees });
ACTIONS.bqSave = async el => {
  const q = UI.bq; const msg = document.getElementById('bq-msg');
  const who = pickerCommit('bud'); if (!who.ok) { msg.textContent = who.msg; return; }
  if (!q.proc.trim()) { msg.textContent = 'Escriba el nombre de la cirugía o del procedimiento.'; return; }
  if (!q.doc) { msg.textContent = 'Seleccione el médico tratante.'; return; }
  if (!pkgItems(q).length) { msg.textContent = 'El presupuesto no tiene montos.'; return; }
  const b = { id: uid('b'), num: 'P-' + String(S.budSeq++).padStart(4, '0'), pid: who.pid, doc: q.doc, date: dAt(0), valid: 15, status: 'abierto', inv: null, ...bqFields(q) };
  b.items = pkgItems(b).map(x => ({ ...x })); b.priceDate = dAt(0);   // precios congelados: no cambian si luego se modifican las tarifas
  S.budgets.unshift(b); log('Presupuesto creado', `${b.num} · ${pat(b.pid).name} · ${b.proc}`); save();
  toast(`${b.num} guardado`); UI.budF = 'abierto'; ACTIONS.openBudget({ dataset: { id: b.id } }); render();
  if (el.dataset.dl) await ACTIONS.budDownload({ dataset: { id: b.id } });
};
// Guarda la configuración actual como paquete (actualiza el que tenga el mismo nombre)
ACTIONS.bqSavePkg = () => {
  const q = UI.bq; const f = bqFields(q); if (!f.proc) { document.getElementById('bq-msg').textContent = 'Escriba el nombre antes de guardarlo como paquete.'; return; }
  const ex = S.packages.find(p => normTxt(p.name) === normTxt(f.proc));
  const data = { kind: f.kind, name: f.proc, hours: f.hours, days: f.days, uci: f.uci, fees: f.fees, material: f.material, extras: f.extras, example: false };
  if (ex) Object.assign(ex, data); else { const pk = { id: uid('pk'), ...data }; S.packages.push(pk); q.tpl = pk.id; }
  log(ex ? 'Paquete actualizado' : 'Paquete creado', f.proc); save(); bqRedraw(); toast(ex ? 'Paquete actualizado' : 'Paquete guardado');
};

// ---------- Servicios → Paquetes ----------
function packagesView() {
  return `<div class="banner" style="margin-bottom:14px">Cada paquete arma un presupuesto completo con un clic. Los valores${S.packages.some(p => p.example) ? ' marcados como ejemplo' : ''} se pueden ajustar aquí o desde un presupuesto con "Guardar como paquete".</div>
  ${Object.entries(BUD_KINDS).map(([k, t]) => `<div class="sec"><h3>${t}</h3><div class="list">${S.packages.filter(p => p.kind === k).map(pk => `<button class="row" data-act="pkgEdit" data-id="${pk.id}"><div class="grow"><div class="t">${esc(pk.name)} ${pk.example ? '<span class="pill">ejemplo</span>' : ''}</div><div class="s">${pkgSummary(pk)} · honorarios ${fmt(pk.fees.reduce((s, f) => s + +f.amount, 0))} · material ${fmt(pk.material)}</div></div><div class="end"><b>${fmt(pkgTotal(pk))}</b></div></button>`).join('') || '<div class="empty">Sin paquetes.</div>'}</div></div>`).join('')}`;
}
ACTIONS.pkgEdit = el => {
  const pk = el.dataset.id ? S.packages.find(p => p.id === el.dataset.id) : null;
  UI.pk = pk ? JSON.parse(JSON.stringify(pk)) : { id: null, kind: 'quirurgico', name: '', hours: 1, days: 0, uci: 0, fees: FEES(['Cirujano', 0], ['Anestesiólogo', 0]), material: 0, extras: [] };
  openSheet(pk ? 'Editar paquete' : 'Nuevo paquete', pkgForm(), `<span class="note" id="pk-msg"></span>${pk ? `<button class="btn danger" data-act="pkgDelete" data-id="${pk.id}">Eliminar</button>` : ''}<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="pkgSave">Guardar paquete</button>`, { wide: true });
};
function pkgForm() {
  const p = UI.pk; const n = (id, v, label) => `<div class="field"><label for="${id}">${label}</label><input class="input" type="number" min="0" step="1" id="${id}" value="${v || 0}"></div>`;
  const rows = (a, ph) => p[a].map((f, i) => `<div class="hstack" style="flex-wrap:nowrap"><input class="input" style="flex:1" id="pk-${a}-n${i}" value="${esc(f.name)}" placeholder="${ph}"><input class="input" style="width:110px;text-align:right" type="number" min="0" id="pk-${a}-a${i}" value="${f.amount || 0}"><button class="btn ghost" data-act="pkgDelRow" data-a="${a}" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('');
  return `<div class="form"><div class="field full"><label for="pk-name">Nombre</label><input class="input" id="pk-name" value="${esc(p.name)}" placeholder="Ej. Colecistectomía laparoscópica"></div>
    <div class="field"><label for="pk-kind">Tipo</label><select class="input" id="pk-kind">${Object.entries(BUD_KINDS).map(([k, t]) => `<option value="${k}" ${p.kind === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    ${n('pk-h', p.hours, 'Horas de quirófano')}${n('pk-d', p.days, 'Días de hospitalización')}${n('pk-u', p.uci, 'Días de UCI')}${n('pk-m', p.material, 'Material, medicamentos e insumos (USD)')}</div>
  <div class="card" style="display:grid;gap:8px;padding:12px 14px"><b class="small">Honorarios</b>${rows('fees', 'Ej. Cirujano')}<button class="btn sm" style="justify-self:start" data-act="pkgAddRow" data-a="fees">+ Agregar honorario</button></div>
  <div class="card" style="display:grid;gap:8px;padding:12px 14px"><b class="small">Otros cargos</b>${rows('extras', 'Concepto')}<button class="btn sm" style="justify-self:start" data-act="pkgAddRow" data-a="extras">+ Agregar cargo</button></div>`;
}
const pkgKeep = () => { const p = UI.pk; p.name = val('pk-name'); p.kind = val('pk-kind'); p.hours = +val('pk-h') || 0; p.days = +val('pk-d') || 0; p.uci = +val('pk-u') || 0; p.material = +val('pk-m') || 0;
  ['fees', 'extras'].forEach(a => p[a] = p[a].map((_, i) => ({ name: val(`pk-${a}-n${i}`), amount: +val(`pk-${a}-a${i}`) || 0 }))); };
ACTIONS.pkgAddRow = el => { pkgKeep(); UI.pk[el.dataset.a].push({ name: '', amount: 0 }); refreshSheet(pkgForm()); };
ACTIONS.pkgDelRow = el => { pkgKeep(); UI.pk[el.dataset.a].splice(+el.dataset.i, 1); refreshSheet(pkgForm()); };
ACTIONS.pkgSave = () => {
  pkgKeep(); const p = UI.pk; if (!p.name.trim()) { document.getElementById('pk-msg').textContent = 'Escriba el nombre del paquete.'; return; }
  const data = { ...p, name: p.name.trim(), fees: p.fees.filter(f => f.name.trim() || f.amount), extras: p.extras.filter(e => e.name.trim() || e.amount), example: false };
  if (p.id) Object.assign(S.packages.find(x => x.id === p.id), data); else S.packages.push({ ...data, id: uid('pk') });
  log(p.id ? 'Paquete actualizado' : 'Paquete creado', data.name); save(); closeSheet(); render(); toast('Paquete guardado');
};
ACTIONS.pkgDelete = el => { const i = S.packages.findIndex(p => p.id === el.dataset.id); const n = S.packages[i].name; S.packages.splice(i, 1); log('Paquete eliminado', n); save(); closeSheet(); render(); toast('Paquete eliminado'); };
