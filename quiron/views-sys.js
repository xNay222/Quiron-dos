// Integridad del prototipo: aviso fijo si no se pudo guardar o si los datos cambiaron en otra pestaña,
// copias de seguridad reales (descargar, probar y restaurar), confirmación de recurrentes vencidos y
// registro de cirugías realizadas (base de las estadísticas nativas).

// ---------- Descarga de archivos: capacidad de Claude si existe; si no, descarga estándar del navegador ----------
async function saveFile(filename, data, type = 'application/json') {
  filename = safeName(filename);
  const dl = await getCap('downloads');
  if (dl) { try { await dl.save({ filename, data }); return true; } catch (e) { if (e?.code === 'declined') return false; } }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type }); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); return true;
  } catch (e) { return false; }
}
const sha256 = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');

// ---------- Aviso fijo de almacenamiento ----------
function renderSysBar() {
  let bar = document.getElementById('sysbar');
  if (!STORE.error) { bar?.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'sysbar'; bar.setAttribute('role', 'alert'); document.body.prepend(bar); }
  bar.innerHTML = `<span><b>Atención:</b> ${esc(STORE.error)}</span><span class="hstack">${STORE.stale ? '<button class="btn sm" data-act="sysReload">Recargar</button>' : ''}${STORE.blocked
    ? '<button class="btn sm" data-act="sysBadDownload">Descargar los datos dañados</button><button class="btn sm" data-act="restorePick" data-mode="restore">Restaurar una copia</button><button class="btn sm danger" data-act="sysStartDemo">Empezar con datos de ejemplo</button>'
    : STORE.stale ? '' : '<button class="btn sm" data-act="exportData">Descargar copia ahora</button>'}</span>`;
}
ACTIONS.sysReload = () => location.reload();
ACTIONS.sysBadDownload = async () => { let raw = ''; try { raw = localStorage.getItem(STORE.badKey) || ''; } catch (e) {} if (!(await saveFile(`Datos dañados Quiron ${dAt(0)}.json`, raw))) toast('No se pudo descargar'); };
ACTIONS.sysStartDemo = () => openSheet('Empezar con datos de ejemplo', '<p>Los datos dañados quedan conservados aparte en este navegador; se recomienda descargarlos primero. Después se cargarán los datos de ejemplo.</p>',
  '<button class="btn" data-act="close">Cancelar</button><button class="btn danger" data-act="doReset">Empezar con datos de ejemplo</button>');

// ---------- Copias de seguridad ----------
window.backupCard = () => `<div class="card sec"><h2>Copias de seguridad</h2>
  <div class="banner warn" style="margin-bottom:12px">En este prototipo <b>no hay respaldos automáticos</b>: los datos viven solo en este navegador. Descargue una copia con frecuencia y guárdela fuera de este equipo. En el sistema definitivo, el servidor hará copias diarias en otra ubicación y probará su restauración.</div>
  <div class="list" style="margin-bottom:12px">${(S.backups || []).filter(b => b.hash).slice(0, 6).map(b => `<div class="row"><div class="grow"><div class="t">${b.at} · ${esc(b.file)}</div><div class="s">${b.size} · huella ${b.hash.slice(0, 12)}…</div></div>${b.tested ? `<span class="pill good">Restauración probada el ${b.tested}</span>` : '<span class="pill">Sin probar</span>'}</div>`).join('') || '<div class="empty">Todavía no se ha descargado ninguna copia.</div>'}</div>
  <div class="hstack"><button class="btn primary" data-act="exportData">Descargar copia completa</button><button class="btn" data-act="restorePick" data-mode="test">Probar una copia</button><button class="btn" data-act="restorePick" data-mode="restore">Restaurar desde una copia</button></div>
  <input type="file" id="bk-file" accept="application/json,.json" data-ch="restoreFile" hidden></div>`;
const backupPayload = () => JSON.stringify({ app: 'quiron', schema: S.schema || 1, exportedAt: nowStamp(), state: S });
ACTIONS.exportData = async () => {
  const data = backupPayload(); const hash = await sha256(data);
  const file = `Respaldo Quiron ${dAt(0)} ${new Date().toTimeString().slice(0, 5).replace(':', '')}.json`;
  if (!(await saveFile(file, data))) { toast('No se pudo descargar la copia'); return; }
  S.backups = S.backups || []; S.backups.unshift({ at: nowStamp(), file, size: Math.round(data.length / 1024) + ' KB', hash, tested: null });
  log('Copia de seguridad descargada', file); save(); render(); toast('Copia descargada. Guárdela fuera de este equipo.');
};
ACTIONS.restorePick = el => {
  UI.bkMode = el.dataset.mode; let inp = document.getElementById('bk-file');
  if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.id = 'bk-file'; inp.accept = 'application/json,.json'; inp.hidden = true; inp.dataset.ch = 'restoreFile'; document.body.appendChild(inp); }
  inp.click();
};
const validState = st => st && ['patients', 'invoices', 'products', 'services', 'appts'].every(k => Array.isArray(st[k]));
ACTIONS.restoreFile = async el => {
  const f = el.files?.[0]; el.value = ''; if (!f) return;
  let text, obj; try { text = await f.text(); obj = JSON.parse(text); } catch (e) { toast('El archivo no es una copia válida: no se pudo leer.'); return; }
  const st = obj?.app === 'quiron' ? obj.state : obj;   // también acepta copias antiguas (el estado directo)
  if (!validState(st)) { toast('El archivo no contiene datos completos de Quirón.'); return; }
  const hash = await sha256(text); const known = (S.backups || []).find(b => b.hash === hash);
  const sum = `${st.patients.length} pacientes · ${st.invoices.length} cobros · ${(st.budgets || []).length} presupuestos · ${(st.hc || []).length} historias · ${st.products.length} productos`;
  if (UI.bkMode === 'test') {
    if (known) known.tested = fdate(dAt(0));
    log('Copia de seguridad probada', `${f.name} · ${sum}`); save(); render();
    openSheet('Copia verificada', `<div class="banner">La copia <b>${esc(f.name)}</b> se puede leer y restaurar.</div><div class="small">${sum}${obj.exportedAt ? ` · creada ${obj.exportedAt}` : ''}</div>${known ? '<div class="small muted">Coincide exactamente con una copia descargada desde aquí (misma huella).</div>' : ''}`, '<button class="btn primary" data-act="close">Cerrar</button>');
    return;
  }
  UI.bkRestore = st;
  openSheet('Restaurar copia de seguridad', `<div class="banner warn">Se reemplazarán todos los datos de este navegador por los de la copia. Antes se descargará automáticamente una copia del estado actual.</div><div class="small">${esc(f.name)} · ${sum}</div>`,
    '<button class="btn" data-act="close">Cancelar</button><button class="btn danger" data-act="restoreDo">Restaurar</button>');
};
ACTIONS.restoreDo = async () => {
  const st = UI.bkRestore; if (!st) return;
  if (!STORE.blocked) await saveFile(`Antes de restaurar ${dAt(0)}.json`, backupPayload());
  const keepUsers = S.users, keepSession = S.session; S = st; if (!S.users?.length) S.users = keepUsers; S.session = keepSession; STORE.blocked = false; STORE.stale = false; STORE.error = null; try { STORE.rev = +(localStorage.getItem(REV_KEY) || 0); } catch (e) {}
  migrate(); const ok = save();
  // Verificación: se vuelve a leer lo guardado y se comparan los totales
  let verified = false; try { const back = JSON.parse(localStorage.getItem(KEY)); verified = ['patients', 'invoices', 'budgets', 'hc', 'products'].every(k => (back[k] || []).length === (S[k] || []).length); } catch (e) {}
  log('Copia de seguridad restaurada', verified ? 'Guardado verificado' : 'Guardado sin verificar'); save();
  UI.bkRestore = null; closeSheet(); renderSysBar(); go('inicio', null, { root: true });
  toast(ok && verified ? 'Copia restaurada y verificada' : 'La copia se cargó, pero no se pudo verificar el guardado');
};

// ---------- Recurrentes vencidos: entran a la contabilidad solo al confirmarlos ----------
const pendingDues = () => (S.dues || []).filter(d => d.status === 'pendiente' && d.date <= dAt(0)).sort((a, b) => a.date.localeCompare(b.date));
window.duesSection = () => { const list = pendingDues(); if (!list.length) return '';
  return `<div class="sec"><h3>Recurrentes vencidos por confirmar</h3><div class="small muted" style="margin:-4px 0 10px">Solo entran a la contabilidad cuando se confirma que el pago o el cobro se realizó, con su fecha, referencia y tasa.</div>
  <div class="list">${list.map(d => `<div class="row"><span class="pill ${d.type === 'entrada' ? 'good' : 'bad'}" style="min-width:64px;justify-content:center">${d.type === 'entrada' ? 'Ingreso' : 'Gasto'}</span><div class="grow"><div class="t">${esc(d.concept)}</div><div class="s">Vence ${fdate(d.date)} · ${esc(d.method)}</div></div>
    <div class="hstack"><b>${fmt(d.amount, d.cur)}</b><button class="btn sm" data-act="dueSkip" data-id="${d.id}">No se realizó</button><button class="btn sm primary" data-act="dueConfirm" data-id="${d.id}">Confirmar</button></div></div>`).join('')}</div></div>`; };
ACTIONS.dueConfirm = el => { const d = S.dues.find(x => x.id === el.dataset.id);
  openSheet(`Confirmar ${d.type === 'entrada' ? 'cobro' : 'pago'}`, `<div class="small muted">${esc(d.concept)} · vencía el ${fdate(d.date)}</div><div class="form">
    <div class="field"><label for="du-d">Fecha en que se realizó</label><input class="input" type="date" id="du-d" value="${dAt(0)}" max="${dAt(0)}"></div>
    <div class="field"><label for="du-a">Monto (${d.cur === 'USD' ? 'USD' : 'Bs'})</label><input class="input" type="number" min="0" step="0.01" id="du-a" value="${d.amount}"></div>
    <div class="field"><label for="du-m">Método</label><select class="input" id="du-m">${ACCT_METHODS[d.cur].map(m => `<option ${m === d.method ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
    <div class="field"><label for="du-r">Referencia</label><input class="input" id="du-r" placeholder="Nº de operación"></div>
    <div class="field"><label for="du-t">Tasa BCV de esa fecha (Bs/USD)</label><input class="input" type="number" min="0" step="0.01" id="du-t" value="${S.rate}"></div>
    <div class="full small muted">Verifique la tasa del día de la operación; la de hoy es ${S.rate.toLocaleString('es-VE', { maximumFractionDigits: 4 })}.</div></div>`,
    `<span class="note" id="du-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="dueConfirmSave" data-id="${d.id}">Confirmar</button>`); };
ACTIONS.dueConfirmSave = el => {
  const d = S.dues.find(x => x.id === el.dataset.id); if (!d || d.status !== 'pendiente') { closeSheet(); render(); return; }
  const amount = num('du-a'), rate = num('du-t'); const msg = document.getElementById('du-msg');
  if (!(amount > 0)) { msg.textContent = 'Indique el monto.'; return; }
  if (!(rate > 0)) { msg.textContent = 'Indique la tasa de la fecha de la operación.'; return; }
  const g = addLedger({ date: val('du-d') || dAt(0), type: d.type, cat: d.cat, concept: d.concept, amount, cur: d.cur, method: val('du-m'), ref: val('du-r').trim(), source: 'Recurrente', rate });
  g.rec = d.rec; d.status = 'confirmado'; d.ledgerId = g.id; save(); closeSheet(); render(); toast('Registrado en la contabilidad');
};
ACTIONS.dueSkip = el => { const d = S.dues.find(x => x.id === el.dataset.id); if (d.status !== 'pendiente') return; d.status = 'omitido'; log('Recurrente no realizado', d.concept); save(); render(); toast('Marcado como no realizado'); };

// ---------- Quirófano: registrar la cirugía como realizada ----------
ACTIONS.qxDone = el => { const a = S.appts.find(x => x.id === el.dataset.id); if (!canQxDone(a)) { toast('Solo el médico tratante, enfermería o Administración registran la cirugía realizada'); return; }
  openSheet(`Registrar cirugía realizada · ${a.proc}`, `<div class="small muted">${esc(pat(a.pid).name)} · ${fdate(a.date)} ${a.time} · ${esc(med(a.doc)?.name || '')}</div><div class="form">
    <div class="field"><label for="qd-m">Duración real (minutos)</label><input class="input" type="number" min="1" id="qd-m" value="${Math.round((a.hours || 1) * 60)}"></div>
    <div class="field full"><label for="qd-c">Complicaciones (opcional)</label><input class="input" id="qd-c" placeholder="Ninguna"></div></div>
    <div class="small muted">Queda registrada como realizada y entra en las estadísticas con la medicación despachada para ella (descontando devoluciones).</div>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="qxDoneSave" data-id="${a.id}">Registrar</button>`); };
ACTIONS.qxDoneSave = el => {
  const a = S.appts.find(x => x.id === el.dataset.id); if (!a || a.done || !canQxDone(a)) { closeSheet(); render(); return; }
  a.done = { at: nowStamp(), by: actor(), durationMin: Math.round(num('qd-m')) || null, complications: val('qd-c').trim() }; a.status = 'atendida';
  log('Cirugía realizada', `${pat(a.pid).name} · ${a.proc}`); save(); closeSheet(); render(); toast('Cirugía registrada como realizada');
};

// ---------- Empezar en limpio: quita los datos de ejemplo y conserva la configuración ----------
// Se conservan: usuarios, datos de la clínica, tasa e impuestos, catálogo de servicios, paquetes, catálogo de laboratorio,
// horarios de los médicos y recurrentes creados por usted. Se borra todo lo demás (pacientes, inventario, cobros, historias…).
ACTIONS.askClean = () => openSheet('Empezar en limpio', `<p style="margin:0">Se borrarán <b>todos los datos de ejemplo</b>: pacientes, citas, inventario, compras, presupuestos, cobros, contabilidad, historias, exámenes y hospitalizaciones.</p>
  <div class="list small" style="margin:0"><div class="row"><div class="grow">Se conservan: usuarios, datos de la clínica, tasa BCV, servicios y precios, paquetes de presupuesto, catálogo de laboratorio y horarios de médicos.</div></div></div>
  <p class="small muted" style="margin:0">Antes se descargará una copia de lo que hay ahora, por si la necesita.</p>
  <div class="field"><label for="cl-ok">Para confirmar, escriba EMPEZAR</label><input class="input" id="cl-ok" autocomplete="off"></div>`,
  `<span class="note" id="cl-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="cleanStart">Empezar en limpio</button>`);
ACTIONS.cleanStart = async () => {
  if (val('cl-ok').trim().toUpperCase() !== 'EMPEZAR') { document.getElementById('cl-msg').textContent = 'Escriba EMPEZAR para confirmar.'; return; }
  await saveFile(`Datos de ejemplo antes de empezar ${dAt(0)}.json`, backupPayload());
  const empty = ['products', 'suppliers', 'orders', 'moves', 'patients', 'appts', 'invoices', 'budgets', 'admissions', 'medOrders', 'mar', 'hc', 'exams', 'records', 'ledger', 'dues', 'audit', 'nurses'];
  empty.forEach(k => { S[k] = []; });
  S.recurring = (S.recurring || []).filter(r => !r.example); S.duty = {}; S.backups = (S.backups || []).filter(b => b.hash);
  S.cash = { open: null, moves: [], closures: [] };
  Object.assign(S, { invSeq: 1, cobSeq: 1, ocSeq: 1, budSeq: 1, hosSeq: 1, moSeq: 1, exSeq: 1, cleanStart: dAt(0) });
  (S.services || []).forEach(x => { x.items = (x.items || []).filter(() => false); });
  (S.kits || []).forEach(k => { k.items = []; });
  S.doctors = (S.doctors || []).filter(d => !d.example); syncStaff();   // los médicos de ejemplo ya no hacen falta   // los kits se conservan; sus productos se vuelven a elegir con el inventario real   // los insumos de ejemplo de cada servicio se quitan; se asignan con el inventario real
  log('Inicio en limpio', 'Se quitaron los datos de ejemplo'); save(); closeSheet(); go('inicio', null, { root: true }); toast('Listo: el sistema está vacío y listo para sus datos');
};

renderSysBar();
