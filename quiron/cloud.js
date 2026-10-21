// Nube (Supabase): solo se activa en la dirección publicada (Vercel o el dominio de la clínica).
// En este computador, con serve.ps1, todo sigue funcionando en local como siempre.
//
// Cómo funciona: la aplicación sigue trabajando con sus objetos en memoria (S.patients, S.exams…). Al entrar se cargan
// de las tablas que su rol puede leer (RLS en el servidor); al guardar se envían SOLO los registros que cambiaron;
// y los cambios de los demás equipos llegan en tiempo real. La matriz de permisos vive en public.acceso.

const NUBE_CFG = {
  url: 'https://jcfvgoaqwngesjktmcip.supabase.co',
  key: 'sb_publishable_BMmSkJf0GKKz72pfkZnphg_2l44fbWn',   // llave pública (hecha para el navegador; los permisos los pone RLS)
  hosts: [/\.vercel\.app$/i, /^(www\.)?quiron/i],
  lib: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
  sri: 'sha384-0w2KAL2YHP6wKOkUDzkCDGgVvfmHnj02DHeQ6XcHOgTfFsGyonKOpShMH1x6nk9o',
};
// Colección de la aplicación → tabla. fundTx y fundAdj comparten tabla (se distinguen por __col).
const NUBE_TABLAS = { patients: 'pacientes', appts: 'citas', consults: 'consultas', hc: 'notas_clinicas', records: 'historias', admissions: 'ingresos',
  evolutions: 'evoluciones', indications: 'indicaciones', medOrders: 'ordenes_med', mar: 'aplicaciones', triage: 'triaje', exams: 'examenes',
  referrals: 'derivaciones', orderTemplates: 'plantillas', kits: 'kits', products: 'productos', moves: 'movimientos', suppliers: 'proveedores',
  orders: 'compras', invoices: 'cuentas', budgets: 'presupuestos', ledger: 'contabilidad', recurring: 'recurrentes', dues: 'vencimientos',
  fundTx: 'fondos_mov', fundAdj: 'fondos_mov', facturaVoids: 'facturas_anuladas', services: 'servicios', packages: 'paquetes',
  doctors: 'medicos', nurseStaff: 'enfermeras', staffNotes: 'notas_personal', deletedPatients: 'pacientes_eliminados' };
const NUBE_COMPARTIDAS = new Set(['fondos_mov']);
// Lo que nunca va a "ajustes": sesión, usuarios (van a perfiles), historial (tabla aparte) y cosas de este equipo
const NUBE_LOCAL = new Set(['session', 'users', 'savedAt', 'audit', 'backups', 'backupKey', 'backupCfg', 'user', ...Object.keys(NUBE_TABLAS)]);
const NUBE_TASA = new Set(['rate', 'rateDate', 'rateSource', 'rates', 'rateEUR', 'ratesEUR']);

const NUBE = { on: false, sb: null, me: null, acceso: {}, snap: {}, timer: null, busy: false, again: false, auditN: 0, renderT: null, urls: new Map() };
try {
  const forced = localStorage.getItem('quiron-nube') === '1';   // para probar contra la nube desde este computador
  NUBE.on = typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && (forced || (location.protocol === 'https:' && NUBE_CFG.hosts.some(h => h.test(location.hostname))));
} catch (e) {}

const nubeLib = () => window.supabase?.createClient ? Promise.resolve() : new Promise((ok, no) => {
  const s = document.createElement('script'); s.src = NUBE_CFG.lib; s.integrity = NUBE_CFG.sri; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
  s.onload = ok; s.onerror = () => no(new Error('No se pudo cargar la conexión. Revise su internet.')); document.head.appendChild(s); });
// IA para leer fotos: la función "ia" de Supabase (la clave de Gemini vive allí, en sus secretos)
async function nubeIaFetch(init = {}) {
  const tok = NUBE.sb ? (await NUBE.sb.auth.getSession()).data.session?.access_token : null;
  return fetch(NUBE_CFG.url + '/functions/v1/ia', { ...init, headers: { ...(init.headers || {}), apikey: NUBE_CFG.key, Authorization: 'Bearer ' + (tok || NUBE_CFG.key) } });
}
if (NUBE.on && typeof window !== 'undefined') window.iaFetchNube = nubeIaFetch;
const nubeRowId = (col, rec) => NUBE_COMPARTIDAS.has(NUBE_TABLAS[col]) ? col + '|' + rec.id : rec.id;
const nubeCan = (t, kind) => (NUBE.acceso[t]?.[kind] || []).includes(NUBE.me?.rol);
const nubeMsg = e => { const m = String(e?.message || e || ''); return /fetch|network|Failed/i.test(m) ? 'Sin conexión con el servidor. Revise su internet.' : m; };

// ---------------------------------------------------------------- Arranque
async function nubeBoot() {
  try { await nubeLib(); } catch (e) { showAuth('login', e.message); return; }
  NUBE.sb = window.supabase.createClient(NUBE_CFG.url, NUBE_CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const kind = /type=(invite|recovery)/.exec(location.hash || '')?.[1];   // llegó desde un enlace de invitación o de nueva contraseña
  const { data: { session } } = await NUBE.sb.auth.getSession();
  if (!session) { S = nubeBlank(); showAuth('login'); return; }
  const { data: me, error } = await NUBE.sb.rpc('mi_perfil');
  if (error || !me?.id) { await NUBE.sb.auth.signOut(); S = nubeBlank(); showAuth('login', 'Su usuario no tiene acceso a este sistema. Pida a la administración que lo invite.'); return; }
  if (me.estado === 'desactivado') { await NUBE.sb.auth.signOut(); S = nubeBlank(); showAuth('login', 'Este usuario está desactivado. Consulte con la administración.'); return; }
  NUBE.me = me;
  if (me.estado === 'invitado' || kind) { S = nubeBlank(); S.users = [nubeUser(me)]; applyUser(S.users[0]); history.replaceState(null, '', location.pathname); showAuth('cambiar'); return; }
  await nubeEnter();
}
function nubeBlank() {
  const b = seed(); Object.keys(b).forEach(k => { if (Array.isArray(b[k])) b[k] = []; }); b.users = []; b.session = null; return b;
}
const nubeUser = p => ({ ...(p.datos || {}), id: p.id, name: p.nombre, email: p.correo, role: p.rol, doc: p.doc || null, status: p.estado });

async function nubeEnter() {
  const box = document.getElementById('auth'); if (box) { box.hidden = false; box.innerHTML = '<div class="auth-page" role="main" style="display:grid;place-items:center;min-height:100vh"><div class="small muted">Cargando los datos de la clínica…</div></div>'; }
  try { await nubeLoad(); } catch (e) { showAuth('login', 'No se pudieron cargar los datos: ' + nubeMsg(e)); return; }
  const u = S.users.find(x => x.id === NUBE.me.id); applyUser(u); idleMark(true);
  nubeRealtime();
  enterApp(); render();
}

// ---------------------------------------------------------------- Carga
async function nubeAll(table, build) {
  const out = []; for (let from = 0; ; from += 1000) {
    const { data, error } = await build(NUBE.sb.from(table)).range(from, from + 999); if (error) throw error;
    out.push(...data); if (data.length < 1000) return out;
  }
}
async function nubeLoad() {
  const sb = NUBE.sb;
  const acc = await sb.from('acceso').select('*'); if (acc.error) throw acc.error;
  NUBE.acceso = Object.fromEntries(acc.data.map(r => [r.tabla, { leen: r.leen, escriben: r.escriben }]));
  const base = nubeBlank(); NUBE.snap = {};
  const tables = [...new Set(Object.values(NUBE_TABLAS))].filter(t => nubeCan(t, 'leen'));
  const rows = await Promise.all(tables.map(t => nubeAll(t, q => q.select('id,data').eq('borrado', false).order('actualizado', { ascending: true }))));
  tables.forEach((t, i) => {
    const cols = Object.keys(NUBE_TABLAS).filter(c => NUBE_TABLAS[c] === t);
    rows[i].forEach(r => { const col = NUBE_COMPARTIDAS.has(t) ? r.data.__col : cols[0]; if (!col) return; const rec = { ...r.data }; delete rec.__col;
      (base[col] = base[col] || []).push(rec); (NUBE.snap[t] = NUBE.snap[t] || {})[r.id] = JSON.stringify(rec); });
  });
  // Las listas que la aplicación muestra "lo más nuevo primero" (unshift)
  ['invoices', 'budgets', 'moves', 'ledger', 'orders', 'facturaVoids', 'deletedPatients', 'staffNotes'].forEach(c => base[c]?.reverse());
  const aj = await nubeAll('ajustes', q => q.select('clave,valor')); NUBE.snap.__ajustes = {};
  aj.forEach(r => { base[r.clave] = r.valor; NUBE.snap.__ajustes[r.clave] = JSON.stringify(r.valor); });
  const pf = await nubeAll('perfiles', q => q.select('*')); base.users = pf.map(nubeUser); NUBE.snap.__users = Object.fromEntries(base.users.map(u => [u.id, JSON.stringify(u)]));
  if (nubeCan('historial', 'leen') || NUBE.me.rol === 'admin') {
    const { data } = await sb.from('historial').select('en,nombre,accion,ref').order('en', { ascending: false }).limit(500);
    base.audit = (data || []).map(h => ({ at: String(h.en).slice(0, 16).replace('T', ' '), user: h.nombre, action: h.accion, ref: h.ref }));
  }
  NUBE.auditN = base.audit.length;
  S = base; migrate();
}

// ---------------------------------------------------------------- Guardado (solo lo que cambió)
function nubeSave() {
  if (!NUBE.me) return true;
  clearTimeout(NUBE.timer); NUBE.timer = setTimeout(nubePush, 400);
  return true;
}
async function nubePush() {
  if (NUBE.busy) { NUBE.again = true; return; }
  NUBE.busy = true; const sb = NUBE.sb; const errors = [];
  try {
    // Registros por tabla
    const ups = {}, dels = {}, seen = {};
    for (const [col, t] of Object.entries(NUBE_TABLAS)) {
      const snap = NUBE.snap[t] = NUBE.snap[t] || {}; seen[t] = seen[t] || new Set();
      for (const rec of S[col] || []) {
        if (!rec || typeof rec !== 'object') continue;
        if (!rec.id) rec.id = uid('r');
        const id = nubeRowId(col, rec); seen[t].add(id); const s = JSON.stringify(rec);
        if (snap[id] !== s) (ups[t] = ups[t] || []).push({ id, s, row: { id, data: NUBE_COMPARTIDAS.has(t) ? { ...rec, __col: col } : rec, borrado: false } });
      }
    }
    for (const t of Object.keys(NUBE.snap)) { if (t.startsWith('__') || !seen[t]) continue;
      for (const id of Object.keys(NUBE.snap[t])) if (!seen[t].has(id)) (dels[t] = dels[t] || []).push(id); }
    for (const [t, list] of Object.entries(ups)) {
      if (!nubeCan(t, 'escriben')) { list.forEach(x => { NUBE.snap[t][x.id] = x.s; }); continue; }   // su rol no modifica esta tabla
      for (let i = 0; i < list.length; i += 300) {
        const part = list.slice(i, i + 300); const { error } = await sb.from(t).upsert(part.map(x => x.row), { onConflict: 'id' });
        if (error) errors.push(t + ': ' + error.message); else part.forEach(x => { NUBE.snap[t][x.id] = x.s; });
      }
    }
    for (const [t, ids] of Object.entries(dels)) {
      if (!nubeCan(t, 'escriben')) { ids.forEach(id => delete NUBE.snap[t][id]); continue; }
      const { error } = await sb.from(t).update({ borrado: true }).in('id', ids);
      if (error) errors.push(t + ': ' + error.message); else ids.forEach(id => delete NUBE.snap[t][id]);
    }
    // Configuración general y numeración
    const aj = NUBE.snap.__ajustes; const admin = NUBE.me.rol === 'admin';
    for (const k of Object.keys(S)) {
      if (NUBE_LOCAL.has(k) || typeof S[k] === 'function') continue;
      const s = JSON.stringify(S[k]); if (aj[k] === s) continue;
      if (/Seq$/.test(k) && typeof S[k] === 'number') { const { error } = await sb.rpc('subir_contador', { n: k, v: S[k] }); if (!error) aj[k] = s; continue; }
      if (!admin && !NUBE_TASA.has(k) && !['duty', 'nurseWeek'].includes(k)) { aj[k] = s; continue; }
      const { error } = await sb.from('ajustes').upsert({ clave: k, valor: S[k] }, { onConflict: 'clave' }); if (error) errors.push('ajustes: ' + error.message); else aj[k] = s;
    }
    // Perfiles (datos profesionales, tutoriales vistos…); el rol y el estado solo los cambia la administración
    const us = NUBE.snap.__users;
    for (const u of S.users || []) {
      const s = JSON.stringify(u); if (us[u.id] === s) continue;
      if (!admin && u.id !== NUBE.me.id) { us[u.id] = s; continue; }
      const { id, name, email, role, doc, status, salt, hash, invite, ...datos } = u;
      const patch = { nombre: name, doc: doc || null, datos }; if (admin && id !== NUBE.me.id) Object.assign(patch, { rol: role, estado: status });
      const { error } = await sb.from('perfiles').update(patch).eq('id', id); if (error) errors.push('perfiles: ' + error.message); else us[u.id] = s;
    }
    // Historial de acciones: lo nuevo desde la última vez
    const fresh = (S.audit || []).length - NUBE.auditN;
    if (fresh > 0) { const rows = S.audit.slice(0, fresh).reverse().map(a => ({ nombre: a.user, accion: a.action, ref: a.ref || null, usuario: NUBE.me.id }));
      const { error } = await sb.from('historial').insert(rows); if (!error) NUBE.auditN = S.audit.length; }
    STORE.error = errors.length ? 'No se pudo guardar en la nube (' + errors[0] + '). Se reintentará solo; no cierre esta ventana.' : null; sysNotice();
    if (errors.length) { console.warn('Nube:', errors); setTimeout(nubeSave, 10000); }
  } catch (e) { STORE.error = 'Sin conexión: los cambios se guardarán al volver internet. No cierre esta ventana.'; sysNotice(); setTimeout(nubeSave, 10000); }
  finally { NUBE.busy = false; if (NUBE.again) { NUBE.again = false; nubeSave(); } }
}

// ---------------------------------------------------------------- Tiempo real
function nubeRealtime() {
  const ch = NUBE.sb.channel('quiron');
  ch.on('postgres_changes', { event: '*', schema: 'public' }, p => {
    const t = p.table, r = p.new || {}; if (!r.id && t !== 'ajustes') return;
    if (t === 'ajustes') { const s = JSON.stringify(r.valor); if (NUBE.snap.__ajustes[r.clave] === s) return; NUBE.snap.__ajustes[r.clave] = s; S[r.clave] = r.valor; return nubeRedraw(); }
    if (t === 'perfiles') { const u = nubeUser(r); const s = JSON.stringify(u); if (NUBE.snap.__users[u.id] === s) return; NUBE.snap.__users[u.id] = s;
      const i = S.users.findIndex(x => x.id === u.id); if (i < 0) S.users.push(u); else S.users[i] = u; return nubeRedraw(); }
    if (!NUBE.snap[t] || !r.data) return;
    const col = NUBE_COMPARTIDAS.has(t) ? r.data.__col : Object.keys(NUBE_TABLAS).find(c => NUBE_TABLAS[c] === t); if (!col) return;
    const rec = { ...r.data }; delete rec.__col; const s = JSON.stringify(rec);
    const arr = S[col] = S[col] || []; const i = arr.findIndex(x => nubeRowId(col, x) === r.id);
    if (r.borrado) { if (i >= 0) arr.splice(i, 1); delete NUBE.snap[t][r.id]; return nubeRedraw(); }
    if (NUBE.snap[t][r.id] === s) return;   // es el eco de un cambio propio
    NUBE.snap[t][r.id] = s; if (i >= 0) arr[i] = rec; else arr.push(rec); nubeRedraw();
  }).subscribe();
}
// Repinta sin interrumpir: si hay una ventana abierta, espera a que se cierre
function nubeRedraw() { clearTimeout(NUBE.renderT); NUBE.renderT = setTimeout(() => { if (document.querySelector('#layer .scrim')) return nubeRedraw(); if (!document.getElementById('auth') || document.getElementById('auth').hidden) render(); }, 300); }

// ---------------------------------------------------------------- Archivos privados (enlaces firmados de 1 hora)
async function nubeStore(blob, isPdf) {
  const path = 'docs/' + uid('doc') + (isPdf ? '.pdf' : blob.type === 'image/png' ? '.png' : '.jpg');
  const { error } = await NUBE.sb.storage.from('archivos').upload(path, blob, { contentType: blob.type || (isPdf ? 'application/pdf' : 'image/jpeg') });
  return error ? null : 'sb://archivos/' + path;
}
async function nubeSign(u) {
  if (NUBE.urls.has(u)) return NUBE.urls.get(u);
  const m = /^sb:\/\/([^/]+)\/(.+)$/.exec(u); if (!m) return '#';
  const { data } = await NUBE.sb.storage.from(m[1]).createSignedUrl(m[2], 3600);
  const url = data?.signedUrl || '#'; NUBE.urls.set(u, url); setTimeout(() => NUBE.urls.delete(u), 50 * 60 * 1000); return url;
}
function nubeFixLinks(root) {
  root.querySelectorAll?.('[src^="sb://"],[href^="sb://"]').forEach(async el => {
    for (const a of ['src', 'href']) { const v = el.getAttribute(a); if (v && v.startsWith('sb://')) el.setAttribute(a, await nubeSign(v)); }
  });
}

// ---------------------------------------------------------------- Acceso y usuarios en la nube
const nubeFn = async (name, body) => {
  const { data, error } = await NUBE.sb.functions.invoke(name, { body });
  if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch (e) {} throw new Error(m); }
  return data;
};
function nubeInstall() {
  save = nubeSave;
  storeFile = nubeStore;
  authBoot = () => false;
  const endLocal = endSession; endSession = () => { endLocal(); NUBE.sb?.auth.signOut(); };   // al cerrar por inactividad también se cierra en la nube
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && nubeFixLinks(n)))).observe(document.documentElement, { childList: true, subtree: true });

  ACTIONS.authLogin = async () => {
    const wait = (UI.authLock || 0) - Date.now(); if (wait > 0) return auMsg(`Demasiados intentos. Espere ${Math.ceil(wait / 1000)} segundos.`);
    const email = normEmail(val('au-email')), p = val('au-pass'); if (!email || !p) return auMsg('Escriba su correo y su contraseña.');
    auMsg('Entrando…');
    const { error } = await NUBE.sb.auth.signInWithPassword({ email, password: p });
    if (error) { UI.authFails = (UI.authFails || 0) + 1; if (UI.authFails >= 5) { UI.authLock = Date.now() + 60000; UI.authFails = 0; }
      return auMsg(/Invalid login/i.test(error.message) ? 'Correo o contraseña incorrectos.' : nubeMsg(error)); }
    UI.authFails = 0; await nubeBoot();
  };
  ACTIONS.authChange = async () => {
    const u = meUser(); const p = val('au-pass'); auMsg('Comprobando la contraseña…');
    const prob = await passCheck(p, val('au-pass2'), u || {}); if (prob) return auMsg(prob);
    const { error } = await NUBE.sb.auth.updateUser({ password: p }); if (error) return auMsg(nubeMsg(error));
    await NUBE.sb.rpc('activarme'); const { data: me } = await NUBE.sb.rpc('mi_perfil'); NUBE.me = me;
    await nubeEnter(); toast('Contraseña guardada');
  };
  ACTIONS.authInvite = () => auMsg('Abra el enlace de invitación que le envió la administración.');
  ACTIONS.authForgot = () => auMsg('Pida a la administración un enlace nuevo para crear su contraseña (Usuarios › su nombre).');
  ACTIONS.logout = async () => { const u = meUser(); if (u) { log('Cierre de sesión', u.email); await nubePush(); } await NUBE.sb.auth.signOut(); NUBE.me = null; S = nubeBlank(); showAuth('login'); };
  ACTIONS.myPassSave = async () => {
    const u = meUser(); const m = document.getElementById('mc-msg');
    const chk = await NUBE.sb.auth.signInWithPassword({ email: u.email, password: val('mc-old') });
    if (chk.error) { m.textContent = 'La contraseña actual no es correcta.'; m.style.color = 'var(--bad)'; return; }
    m.textContent = 'Comprobando la contraseña…'; m.style.color = ''; const prob = await passCheck(val('mc-new'), val('mc-new2'), u); if (prob) { m.textContent = prob; m.style.color = 'var(--bad)'; return; }
    const { error } = await NUBE.sb.auth.updateUser({ password: val('mc-new') }); if (error) { m.textContent = nubeMsg(error); m.style.color = 'var(--bad)'; return; }
    log('Contraseña cambiada', u.email); save(); closeSheet(); toast('Contraseña actualizada');
  };
  // Invitar: la nube crea el usuario y devuelve un enlace para enviarlo por WhatsApp (no depende del correo)
  ACTIONS.usMode = () => {};
  ACTIONS.userSave = async () => {
    const msg = document.getElementById('us-msg'); const name = val('us-name').trim(), email = normEmail(val('us-email')), role = val('us-role'), doc = val('us-doc') || null;
    if (!name) { msg.textContent = 'Escriba el nombre.'; return; } if (!validEmail(email)) { msg.textContent = 'Escriba un correo válido.'; return; }
    if (S.users.some(u => u.email === email)) { msg.textContent = 'Ya existe un usuario con ese correo.'; return; }
    if (DOC_ROLES.includes(role) && !doc) { msg.textContent = 'Seleccione el médico vinculado.'; return; }
    msg.textContent = 'Creando la invitación…';
    try {
      const r = await nubeFn('usuarios', { accion: 'invitar', nombre: name, correo: email, rol: role, doc: DOC_ROLES.includes(role) ? doc : null, volver: location.origin });
      const u = nubeUser(r.perfil); S.users.push(u); NUBE.snap.__users[u.id] = JSON.stringify(u);
      log('Usuario invitado', `${name} · ${email} · ${roleLabel(role)}`); save(); render(); nubeShowLink(u, r.enlace);
    } catch (e) { msg.textContent = nubeMsg(e); }
  };
  ACTIONS.userReissue = async el => {
    const u = S.users.find(x => x.id === el.dataset.id); const msg = document.getElementById('us-msg'); if (msg) msg.textContent = 'Generando el enlace…';
    try { const r = await nubeFn('usuarios', { accion: 'enlace', id: u.id, volver: location.origin }); log('Enlace de acceso nuevo', u.email); save(); nubeShowLink(u, r.enlace); }
    catch (e) { if (msg) msg.textContent = nubeMsg(e); }
  };
  ACTIONS.userStatus = async el => {
    const u = S.users.find(x => x.id === el.dataset.id); const st = el.dataset.st;
    try { await nubeFn('usuarios', { accion: 'estado', id: u.id, estado: st }); u.status = st; NUBE.snap.__users[u.id] = JSON.stringify(u);
      log(st === 'desactivado' ? 'Usuario desactivado' : 'Usuario reactivado', u.email); save(); closeSheet(); render(); toast(st === 'desactivado' ? 'Usuario desactivado: ya no puede entrar' : 'Usuario reactivado'); }
    catch (e) { toast(nubeMsg(e)); }
  };
}
function nubeShowLink(u, link) {
  const msg = `Hola, ${u.name}. Se le creó un usuario en el sistema de ${S.clinic?.name || 'la clínica'}. Abra este enlace para crear su contraseña y entrar: ${link}`;
  UI.accMsg = msg;
  openSheet('Enlace de acceso', `<div class="banner">Envíe este enlace a ${esc(u.name)} por un medio privado (WhatsApp, por ejemplo). Es personal y vence en 24 horas; si vence, genere uno nuevo.</div>
    <div class="card small" style="line-height:1.5;word-break:break-all">${esc(msg)}</div>`,
    `<button class="btn" data-act="accCopy">Copiar mensaje</button><button class="btn primary" data-act="close">Listo</button>`);
}
// ---------------------------------------------------------------- Subir los datos del servidor local (solo administración, una vez)
// Se elige "copias de seguridad/_estado-servidor.json" (o una copia sin cifrar). Los usuarios no se copian: se invitan de nuevo.
function nubeImportCard() {
  if (NUBE.me?.rol !== 'admin') return '';
  return `<div class="card sec"><h2>Subir los datos del servidor local</h2>
    <p class="small muted" style="margin:0 0 10px">Elija el archivo <b>_estado-servidor.json</b> de la carpeta "copias de seguridad" del computador de la clínica. Se suben pacientes, historias, exámenes, inventario, cuentas y ajustes. Los usuarios no se copian: se invitan desde aquí.</p>
    <label class="btn"><input type="file" accept=".json,application/json" data-ch="nubeImportFile" hidden>Elegir archivo…</label><div id="ni-res" class="small" style="margin-top:8px"></div></div>`;
}
ACTIONS.nubeImportFile = async el => {
  const f = el.files?.[0]; el.value = ''; const out = document.getElementById('ni-res'); if (!f || NUBE.me?.rol !== 'admin') return;
  try {
    const obj = JSON.parse(await f.text()); const st = obj?.state || obj;
    if (obj?.cifrado) throw new Error('Esa copia está cifrada. Use el archivo _estado-servidor.json.');
    if (!Array.isArray(st?.patients) || !Array.isArray(st?.products)) throw new Error('El archivo no es una copia de Quirón.');
    UI.nubeImp = st;
    const n = k => (st[k] || []).length;
    openSheet('Subir a la nube', `<div class="banner"><span>Se subirán <b>${n('patients')} pacientes</b>, ${n('records')} historias, ${n('exams')} exámenes, ${n('products')} productos, ${n('moves')} movimientos, ${n('invoices')} cuentas y la configuración. Lo que ya esté en la nube con el mismo código se reemplaza.</span></div>
      <div class="small muted">Puede tardar un par de minutos. No cierre la ventana hasta que diga "Listo".</div><div id="ni-prog" class="small" style="margin-top:8px"></div>`,
      `<button class="btn" data-act="close">Cancelar</button><button class="btn" data-act="nubeImportDo" data-k="inventario">Solo el inventario (${n('products')} productos)</button><button class="btn primary" data-act="nubeImportDo">Subir todo</button>`);
  } catch (e) { if (out) out.textContent = e.message; }
};
const NUBE_INVENTARIO = ['products', 'moves', 'suppliers', 'orders', 'kits'];
ACTIONS.nubeImportDo = async el => {
  const st = UI.nubeImp; const prog = document.getElementById('ni-prog'); if (!st) return;
  const soloInv = el?.dataset?.k === 'inventario';
  document.querySelectorAll('[data-act="nubeImportDo"],[data-act="close"]').forEach(b => b.disabled = true);
  prog.textContent = 'Subiendo…';
  const keep = { users: S.users, session: S.session, audit: S.audit };
  Object.keys(st).forEach(k => { if (soloInv ? NUBE_INVENTARIO.includes(k) : !['users', 'session', 'audit', 'savedAt', 'backups', 'backupKey'].includes(k)) S[k] = st[k]; });
  Object.assign(S, keep); migrate();
  log(soloInv ? 'Inventario subido desde el servidor local' : 'Datos subidos desde el servidor local', soloInv ? `${(st.products || []).length} productos · ${(st.moves || []).length} movimientos` : `${(st.patients || []).length} pacientes · ${(st.products || []).length} productos`);
  await nubePush();
  // Verificación: lo que quedó en cada tabla contra lo que había en el archivo
  const checks = (soloInv ? [] : [['patients', 'pacientes'], ['records', 'historias'], ['exams', 'examenes'], ['services', 'servicios'], ['doctors', 'medicos']]).concat([['products', 'productos'], ['moves', 'movimientos'], ['suppliers', 'proveedores']]);
  const res = await Promise.all(checks.map(async ([c, t]) => { const { count } = await NUBE.sb.from(t).select('id', { count: 'exact', head: true }).eq('borrado', false); return [c, (S[c] || []).length, count]; }));
  const bad = res.filter(([, a, b]) => a !== b);
  prog.innerHTML = (bad.length ? '<b style="color:var(--bad)">Faltan registros:</b> ' : '<b style="color:var(--good)">Listo.</b> ') + res.map(([c, a, b]) => `${c}: ${b}/${a}`).join(' · ') + (STORE.error ? `<div style="color:var(--bad)">${esc(STORE.error)}</div>` : '');
  document.querySelectorAll('[data-act="close"]').forEach(b => b.disabled = false); UI.nubeImp = null; render();
};

if (NUBE.on) { nubeInstall();
  const aj = VIEWS.ajustes; VIEWS.ajustes = () => { const h = aj(), i = h.indexOf('</div></div>') + 12; return i > 11 ? h.slice(0, i) + nubeImportCard() + h.slice(i) : nubeImportCard() + h; };   // justo debajo del título
}
