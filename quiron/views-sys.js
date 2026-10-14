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
  <div class="banner" style="margin-bottom:12px"><span>${S.backupKey ? `🔒 Las copias se descargan <b>cifradas</b> con su clave (creada el ${esc(S.backupKey.at)}). Sin ella no se pueden abrir.` : '🔒 La primera vez que descargue una copia se le pedirá crear la <b>clave de las copias</b>: sin ella nadie podrá leer el archivo.'}</span></div>
  <div class="hstack"><button class="btn primary" data-act="exportData">Descargar copia completa</button>${S.backupKey ? '<button class="btn ghost" data-act="bkKeyChange">Cambiar la clave</button>' : ''}<button class="btn" data-act="restorePick" data-mode="test">Probar una copia</button><button class="btn" data-act="restorePick" data-mode="restore">Restaurar desde una copia</button></div>
  <input type="file" id="bk-file" accept="application/json,.json" data-ch="restoreFile" hidden>
  ${['admin', 'almacen'].includes(role()) ? `<h3 style="margin-top:18px">Inventario del almacén</h3>
  <div class="small muted" style="margin-bottom:8px">Carga un archivo de inventario (por ejemplo <i>almacen-2026-10-13.json</i>). Solo reemplaza productos, lotes, proveedores, movimientos, órdenes de compra, kits y tasas BCV; los pacientes, historias, usuarios y cobros no se tocan. Antes se descarga una copia completa.</div>
  <button class="btn" data-act="invImportPick">Importar inventario del almacén</button>
  <input type="file" id="inv-file" accept="application/json,.json" data-ch="invImportFile" hidden>` : ''}</div>`;
const backupPayload = () => JSON.stringify({ app: 'quiron', schema: S.schema || 1, exportedAt: nowStamp(), state: S });
// ---------- Copias cifradas (AES-256-GCM) con una clave que solo conoce el administrador ----------
// La clave nunca se guarda: solo una huella (PBKDF2) para comprobar que se escribe bien. Se pide una vez por sesión,
// vive en memoria y se olvida al cerrar la sesión. Sin la clave, una copia cifrada no se puede abrir.
let BACKUP_PASS = null;
const forgetBackupKey = () => { BACKUP_PASS = null; };
const B64 = {   // en trozos: las copias pesan varios MB y no caben en una sola llamada
  enc: bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); },
  dec: str => Uint8Array.from(atob(str), c => c.charCodeAt(0))
};
const BK_ITER = 310000;
async function bkKey(pass, salt, iter = BK_ITER) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptBackup(text, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await bkKey(pass, salt), new TextEncoder().encode(text)));
  return JSON.stringify({ app: 'quiron', cifrado: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter: BK_ITER, salt: B64.enc(salt), iv: B64.enc(iv), exportedAt: nowStamp(), data: B64.enc(ct) });
}
// Con una clave equivocada AES-GCM falla: no hay forma de "abrir a medias"
async function decryptBackup(obj, pass) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: B64.dec(obj.iv) }, await bkKey(pass, B64.dec(obj.salt), obj.iter || BK_ITER), B64.dec(obj.data));
  return new TextDecoder().decode(pt);
}
const isEncryptedBackup = o => o?.app === 'quiron' && !!o.cifrado && !!o.data;
// Pide la clave (o la crea la primera vez) y la devuelve; null si se cancela
function ensureBackupKey() {
  if (BACKUP_PASS) return Promise.resolve(BACKUP_PASS);
  return new Promise(resolve => {
    UI.bkResolve = resolve; const first = !S.backupKey;
    openSheet(first ? 'Crear la clave de las copias' : 'Clave de las copias', first ?
      `<p style="margin:0 0 10px">Las copias de seguridad se guardan <b>cifradas</b>: sin esta clave nadie puede leerlas, aunque encuentre el archivo.</p>
      <div class="banner warn" style="margin-bottom:12px"><span><b>Si pierde la clave, las copias no se pueden abrir.</b> Nadie puede recuperarla. Anótela y guárdela en un lugar seguro.</span></div>
      <div class="form"><div class="field"><label for="bk-p1">Clave (al menos 10 caracteres)</label><input class="input" type="password" id="bk-p1" autocomplete="new-password"></div>
      <div class="field"><label for="bk-p2">Repita la clave</label><input class="input" type="password" id="bk-p2" autocomplete="new-password"></div></div>
      <label class="hstack small" style="margin-top:8px"><input type="checkbox" id="bk-ok"> Entiendo que si pierdo esta clave, las copias no se pueden abrir.</label>` :
      `<p style="margin:0 0 10px">Escriba la clave de las copias de seguridad. Se recordará hasta que cierre la sesión.</p>
      <div class="field"><label for="bk-p">Clave de las copias</label><input class="input" type="password" id="bk-p" autocomplete="off"></div>`,
      '<span class="note" id="bk-msg"></span><button class="btn" data-act="bkKeyCancel">Cancelar</button><button class="btn primary" data-act="bkKeySave">Continuar</button>');
    setTimeout(() => document.getElementById(first ? 'bk-p1' : 'bk-p')?.focus(), 50);
  });
}
ACTIONS.bkKeyCancel = () => { const r = UI.bkResolve; UI.bkResolve = null; closeSheet(); r?.(null); };
ACTIONS.bkKeySave = async () => {
  const msg = document.getElementById('bk-msg'), first = !S.backupKey; let pass;
  if (first) {
    pass = val('bk-p1');
    if (pass.length < 10) { msg.textContent = 'Use al menos 10 caracteres (puede ser una frase).'; return; }
    if (pass !== val('bk-p2')) { msg.textContent = 'Las dos claves no coinciden.'; return; }
    if (!document.getElementById('bk-ok')?.checked) { msg.textContent = 'Confirme que entiende que la clave no se puede recuperar.'; return; }
    const salt = newSalt(); S.backupKey = { salt, hash: await hashPass(pass, salt), at: nowStamp() };
    log('Clave de las copias de seguridad creada', actor()); save();
  } else {
    pass = val('bk-p');
    if (await hashPass(pass, S.backupKey.salt) !== S.backupKey.hash) { msg.textContent = 'La clave no es correcta.'; return; }
  }
  BACKUP_PASS = pass; const r = UI.bkResolve; UI.bkResolve = null; closeSheet(); r?.(pass);
};
ACTIONS.bkKeyChange = () => openSheet('Cambiar la clave de las copias', `<p class="small muted" style="margin:0 0 10px">Las copias nuevas usarán la clave nueva. Las que ya descargó siguen abriéndose con la clave anterior: no la olvide mientras las conserve.</p>
  <div class="form"><div class="field full"><label for="bk-old">Clave actual</label><input class="input" type="password" id="bk-old" autocomplete="off"></div>
  <div class="field"><label for="bk-n1">Clave nueva (al menos 10 caracteres)</label><input class="input" type="password" id="bk-n1" autocomplete="new-password"></div>
  <div class="field"><label for="bk-n2">Repita la clave nueva</label><input class="input" type="password" id="bk-n2" autocomplete="new-password"></div></div>`,
  '<span class="note" id="bk-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="bkKeyChangeSave">Cambiar clave</button>');
ACTIONS.bkKeyChangeSave = async () => {
  const msg = document.getElementById('bk-msg'), n1 = val('bk-n1');
  if (await hashPass(val('bk-old'), S.backupKey.salt) !== S.backupKey.hash) { msg.textContent = 'La clave actual no es correcta.'; return; }
  if (n1.length < 10) { msg.textContent = 'La clave nueva necesita al menos 10 caracteres.'; return; }
  if (n1 !== val('bk-n2')) { msg.textContent = 'Las dos claves nuevas no coinciden.'; return; }
  const salt = newSalt(); S.backupKey = { salt, hash: await hashPass(n1, salt), at: nowStamp() }; BACKUP_PASS = n1;
  log('Clave de las copias de seguridad cambiada', actor()); save(); closeSheet(); render(); toast('Clave cambiada. Las copias nuevas usarán la clave nueva.');
};
// Copia completa cifrada, lista para guardar (null si no se escribió la clave)
async function backupBlob() { const pass = await ensureBackupKey(); return pass ? encryptBackup(backupPayload(), pass) : null; }

ACTIONS.exportData = async () => {
  const data = await backupBlob(); if (!data) return; const hash = await sha256(data);
  const file = `Respaldo Quiron ${dAt(0)} ${new Date().toTimeString().slice(0, 5).replace(':', '')} (cifrada).json`;
  if (!(await saveFile(file, data))) { toast('No se pudo descargar la copia'); return; }
  S.backups = S.backups || []; S.backups.unshift({ at: nowStamp(), file, size: Math.round(data.length / 1024) + ' KB', hash, tested: null, cifrada: true });
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
  // Copia cifrada: se pide la clave con que se descargó (puede ser una anterior)
  if (isEncryptedBackup(obj)) {
    UI.bkEnc = { name: f.name, text, obj };
    openSheet('Copia cifrada', `<p style="margin:0 0 10px"><b>${esc(f.name)}</b> está cifrada. Escriba la clave con la que se descargó.</p><div class="field"><label for="bk-r">Clave de la copia</label><input class="input" type="password" id="bk-r" autocomplete="off"></div>`,
      '<span class="note" id="bk-rmsg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="bkDecrypt">Abrir copia</button>');
    setTimeout(() => document.getElementById('bk-r')?.focus(), 50); return;
  }
  return restoreParsed(f.name, text, obj);
};
ACTIONS.bkDecrypt = async () => {
  const e = UI.bkEnc; if (!e) return; const msg = document.getElementById('bk-rmsg'); msg.textContent = 'Abriendo…';
  let inner; try { inner = JSON.parse(await decryptBackup(e.obj, val('bk-r'))); } catch (err) { msg.textContent = 'La clave no es correcta para esta copia.'; return; }
  UI.bkEnc = null; return restoreParsed(e.name, e.text, inner);
};
async function restoreParsed(name, text, obj) {
  const f = { name };
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
  if (!STORE.blocked) { const prev = await backupBlob(); if (!prev) return; await saveFile(`Antes de restaurar ${dAt(0)} (cifrada).json`, prev); }
  const keepUsers = S.users, keepSession = S.session, keepKey = S.backupKey; S = st; if (!S.users?.length) S.users = keepUsers; S.session = keepSession; if (keepKey) S.backupKey = keepKey;   // la clave de las copias no cambia al restaurar STORE.blocked = false; STORE.stale = false; STORE.error = null; try { STORE.rev = +(localStorage.getItem(REV_KEY) || 0); } catch (e) {}
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
  { const prev = await backupBlob(); if (!prev) return; await saveFile(`Datos antes de empezar en limpio ${dAt(0)} (cifrada).json`, prev); }
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

// ---------- Importar inventario del almacén (archivo "tipo: almacen") ----------
// Reemplaza solo las claves del almacén; deja intactos pacientes, historias, usuarios y el resto.
const INV_KEYS = ['products', 'suppliers', 'orders', 'moves', 'rates', 'kits', 'rate', 'rateDate'];

// Productos del inventario actual que no vienen en el archivo pero siguen usados en otros registros
const invOrphans = obj => {
  const incoming = new Set(obj.products.map(p => p.id));
  const others = JSON.stringify(Object.fromEntries(Object.entries(S).filter(([k]) => !INV_KEYS.includes(k) && !['audit', 'backups'].includes(k))));
  return S.products.filter(p => !incoming.has(p.id) && others.includes('"' + p.id + '"'));
};
ACTIONS.invImportPick = () => {
  if (!['admin', 'almacen'].includes(role())) { toast('Solo administración o almacén pueden importar el inventario.'); return; }
  document.getElementById('inv-file')?.click();
};
ACTIONS.invImportFile = async el => {
  const f = el.files?.[0]; el.value = ''; if (!f) return;
  let obj; try { obj = JSON.parse(await f.text()); } catch (e) { toast('El archivo no se pudo leer.'); return; }
  if (obj?.tipo !== 'almacen' || !Array.isArray(obj.products)) { toast('El archivo no es un inventario del almacén de Quirón.'); return; }
  const today = dAt(0), lots = obj.products.flatMap(p => p.lots || []);
  const units = lots.reduce((n, l) => n + (+l.qty || 0), 0);
  const expired = lots.filter(l => l.exp && l.exp < today).reduce((n, l) => n + (+l.qty || 0), 0);
  const noLoc = obj.products.filter(p => !p.loc?.sector).length;
  UI.invImport = obj;
  const orphans = invOrphans(obj);
  openSheet('Importar inventario del almacén',
    `<div class="banner warn">Se reemplazará el inventario actual (${S.products.length} productos) por el del archivo. Pacientes, historias, usuarios y cobros no cambian. Antes se descargará una copia completa.</div>
    <div class="list"><div class="row"><div class="grow"><div class="t">${esc(f.name)}</div><div class="s">Exportado ${esc(obj.exportado || '—')}</div></div></div>
    <div class="row"><div class="grow"><div class="t">${obj.products.length} productos · ${units.toLocaleString('es-VE')} unidades</div><div class="s">${expired.toLocaleString('es-VE')} unidades vencidas · ${noLoc} sin ubicar · ${(obj.suppliers || []).length} proveedores · ${(obj.moves || []).length} movimientos</div></div></div></div>
    ${orphans.length ? `<div class="banner" style="margin-top:10px">${orphans.length} producto(s) del inventario actual no vienen en el archivo pero se usan en solicitudes, indicaciones o consultas ya registradas (${esc(orphans.slice(0, 4).map(p => p.name).join(', '))}${orphans.length > 4 ? '…' : ''}). Se conservarán como <b>retirado · sin existencias</b> para no romper esos registros.</div>` : ''}`,
    '<button class="btn" data-act="close">Cancelar</button><button class="btn danger" data-act="invImportDo">Importar</button>');
};
ACTIONS.invImportDo = async () => {
  const obj = UI.invImport; if (!obj) return;
  const prev = await backupBlob(); if (!prev) return;
  if (!(await saveFile(`Antes de importar inventario ${dAt(0)} (cifrada).json`, prev))) { toast('No se pudo descargar la copia previa; no se importó nada.'); return; }
  const orphans = invOrphans(obj).map(p => ({ ...p, name: /retirado/.test(p.name) ? p.name : p.name + ' (retirado)', lots: [], min: 0, loc: null, retired: true }));
  INV_KEYS.forEach(k => { if (obj[k] !== undefined) S[k] = obj[k]; });
  S.products = S.products.concat(orphans);
  migrate(); const ok = save();
  let verified = false; try { const back = JSON.parse(localStorage.getItem(KEY)); verified = (back.products || []).length === S.products.length && (back.patients || []).length === S.patients.length; } catch (e) {}
  log('Inventario del almacén importado', `${obj.products.length} productos · ${obj.exportado || ''}`); save();
  UI.invImport = null; closeSheet(); render();
  toast(ok && verified ? `Inventario importado: ${obj.products.length} productos. Pacientes sin cambios.` : 'El inventario se cargó, pero no se pudo verificar el guardado.');
};
