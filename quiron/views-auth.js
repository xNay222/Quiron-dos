// Inicio de sesión y usuarios.
// Primer uso: se crea la cuenta del administrador (control maestro). Después, todo el que entra necesita usuario y contraseña.
// El administrador crea usuarios desde "Usuarios": por invitación (el usuario define su contraseña con un código)
// o con una contraseña temporal que debe cambiar al entrar.
// Las contraseñas y los códigos se guardan cifrados (PBKDF2 / SHA-256), nunca en texto.
// Importante: en este prototipo todo vive en el navegador; en el sistema definitivo la validación la hace el servidor.

const SESSION_KEY = 'quiron-sesion';
const ROLE_ORDER = ['admin', 'medico', 'residente', 'enfermeria_plus', 'enfermeria', 'almacen', 'recepcion', 'laboratorio', 'imagen'];
const userRoles = () => [...ROLE_ORDER.filter(r => ROLES[r]), ...Object.keys(ROLES).filter(r => !ROLE_ORDER.includes(r))];
const userRoleTitle = r => ({ admin: 'Administradores', medico: 'Médicos', residente: 'Residentes', enfermeria_plus: 'Enfermeras+', enfermeria: 'Enfermeras', almacen: 'Almacén', recepcion: 'Recepción', laboratorio: 'Laboratorio', imagen: 'Imagen/Radiología' })[r] || ROLES[r]?.name || r;
const roleLabel = r => r === 'admin' ? 'Administrador · control maestro' : ROLES[r]?.name || r;
const USER_ST = { activo: ['Activo', 'good'], invitado: ['Invitación pendiente', 'warn'], desactivado: ['Desactivado', ''] };
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
async function hashPass(pass, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 150000, hash: 'SHA-256' }, k, 256));
}
const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));
const normEmail = s => String(s || '').trim().toLowerCase();
const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const c = [...crypto.getRandomValues(new Uint8Array(8))].map(n => A[n % A.length]).join(''); return c.slice(0, 4) + '-' + c.slice(4); };
const tempPass = () => { const A = 'abcdefghjkmnpqrstuvwxyz23456789'; return [...crypto.getRandomValues(new Uint8Array(10))].map(n => A[n % A.length]).join(''); };
const passProblem = (p, p2) => p.length < 8 ? 'La contraseña debe tener al menos 8 caracteres.' : !/\d/.test(p) || !/[a-zA-Z]/.test(p) ? 'La contraseña debe combinar letras y números.' : p !== p2 ? 'Las contraseñas no coinciden.' : '';
const meUser = () => (S.users || []).find(u => u.id === S.session?.uid);
const activeAdmins = () => (S.users || []).filter(u => u.role === 'admin' && u.status === 'activo');

// ---------- Sesión ----------
function readSession() {
  try { const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY); if (!raw) return null;
    const s = JSON.parse(raw); if (s.exp && s.exp < Date.now()) { endSession(); return null; } return s; } catch (e) { return null; }
}
function startSession(u, remember) {
  idleMark(true);
  const s = { uid: u.id, exp: remember ? Date.now() + 30 * DAY : null };
  try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  applyUser(u);
}
function endSession() { try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch (e) {} S.session = null; if (typeof forgetBackupKey === 'function') forgetBackupKey(); }
const applyUser = u => { S.session = { uid: u.id, role: u.role, doc: u.doc || null, name: u.name }; };
// Al abrir: si hay una sesión válida, entra directo; si no, pantalla de acceso (o creación del administrador)
function authBoot() {
  S.users = S.users || [];
  const s = readSession(); const u = s && S.users.find(x => x.id === s.uid && x.status === 'activo');
  if (u && idleExpired()) { log('Sesión cerrada por inactividad', u.email || u.name); endSession(); showAuth('login', IDLE_MSG); return false; }
  if (u) { idleMark(true); applyUser(u); if (u.mustChange) { showAuth('cambiar'); return false; } return true; }
  // Sin administrador activo: si hay uno pendiente de activar (contraseña restablecida), se pide su código; nunca se ofrece crear otro
  const pendingAdmin = S.users.some(x => x.role === 'admin' && x.status === 'invitado');
  endSession(); showAuth(activeAdmins().length ? 'login' : pendingAdmin ? 'invite' : 'setup'); return false;
}
function enterApp() {
  const box = document.getElementById('auth'); if (box) box.hidden = true;
  document.querySelector('.app').hidden = false;
  go(NAV_ITEMS()[0][0], null, { root: true });
  setTimeout(() => window.tourOffer?.(), 700);   // primer ingreso: ofrece el recorrido de su rol
  if (typeof autoRate === 'function') autoRate(false);   // tasa BCV al día apenas se entra
}

// ---------- Pantallas de acceso ----------
function showAuth(mode, msg = '') {
  UI.authMode = mode; document.querySelector('.app').hidden = true; closeSheet();
  let box = document.getElementById('auth'); if (!box) { box = document.createElement('div'); box.id = 'auth'; document.body.appendChild(box); }
  box.hidden = false;
  const f = (id, label, type = 'text', extra = '') => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" type="${type}" ${extra}></div>`;
  const keep = `<label class="hstack small" style="margin-top:2px"><input type="checkbox" id="au-keep" checked> Mantener la sesión iniciada en este equipo</label>`;
  const arrow = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const go = (act, text) => `<button class="auth-go" data-act="${act}"><span>${text}</span>${arrow}</button>`;
  // Opciones de la derecha: botones con borde (como en el diseño de referencia) o pasos explicados
  const opt = (act, k, title, sub) => `<button class="auth-opt" data-act="${act}" ${k ? `data-k="${k}"` : ''}><b>${title}</b><span>${sub}</span></button>`;
  const step = (n, title, sub) => `<div class="auth-opt static"><b><i>${n}</i>${title}</b><span>${sub}</span></div>`;
  const views = {
    setup: ['Configuración inicial', 'Cree la cuenta del administrador (control maestro). Con ella podrá crear e invitar al resto de los usuarios.',
      f('au-name', 'Nombre completo', 'text', 'autocomplete="name"') + f('au-email', 'Correo electrónico', 'email', 'autocomplete="username"') + f('au-pass', 'Contraseña', 'password', 'autocomplete="new-password"') + f('au-pass2', 'Repita la contraseña', 'password', 'autocomplete="new-password"') + keep,
      go('authSetup', 'Crear cuenta y entrar'),
      step(1, 'Cree su cuenta', 'Será el administrador: ve y controla todo el sistema.') + step(2, 'Invite a su equipo', 'En Usuarios, cada persona recibe su rol y un código.') + step(3, 'Cargue sus datos', 'Inventario, servicios, kits de cirugía y pacientes.')],
    login: ['Iniciar sesión', 'Sistema de gestión clínica de Quirón Especialidades Médicas. Ingrese con su correo y contraseña.',
      f('au-email', 'Correo electrónico', 'email', 'autocomplete="username"') + f('au-pass', 'Contraseña', 'password', 'autocomplete="current-password" data-enter="authLogin"') + keep,
      go('authLogin', 'Entrar'),
      opt('authMode', 'invite', 'Tengo un código de invitación', 'Active su usuario y cree su contraseña.') + opt('authForgot', '', '¿Olvidó su contraseña?', 'La administración se la restablece desde Usuarios.')],
    invite: ['Activar mi usuario', 'Escriba su correo y el código que le entregó la administración. Luego cree su contraseña.',
      f('au-email', 'Correo electrónico', 'email', 'autocomplete="username"') + f('au-code', 'Código de invitación', 'text', 'placeholder="ABCD-EFGH" autocapitalize="characters"') + f('au-pass', 'Nueva contraseña', 'password', 'autocomplete="new-password"') + f('au-pass2', 'Repita la contraseña', 'password', 'autocomplete="new-password"') + keep,
      go('authInvite', 'Activar y entrar'),
      opt('authMode', 'login', 'Ya tengo contraseña', 'Volver a iniciar sesión.') + opt('authForgot', '', '¿No tiene código o venció?', 'Pídalo a la administración: vale 7 días.')],
    cambiar: ['Cree su contraseña', `Hola, ${esc(meUser()?.name || '')}. Su contraseña es temporal: elija una nueva para continuar.`,
      f('au-pass', 'Nueva contraseña', 'password', 'autocomplete="new-password"') + f('au-pass2', 'Repita la contraseña', 'password', 'autocomplete="new-password"'),
      go('authChange', 'Guardar y entrar'),
      opt('logout', '', 'Salir', 'Entrar con otro usuario.')],
  };
  const [title, sub, body, btn, side] = views[mode]; const th = getTheme();
  box.innerHTML = `<div class="auth-page" role="main">
    <header class="auth-top"><img class="auth-logo" src="${window.LOGO?.url || 'logo.webp'}" alt="Quirón Especialidades Médicas">
      ${themeSeg('authTheme')}</header>
    <div class="auth-hero"><h1>${title}</h1><p>${sub}</p></div>
    <div class="auth-grid">
      <form class="auth-form" onsubmit="return false">${body}<div class="small" id="au-msg" role="alert" style="color:var(--bad);min-height:18px">${esc(msg)}</div><div class="auth-btns">${btn}</div></form>
      <div class="auth-slash" aria-hidden="true">/</div>
      <div class="auth-side">${side}</div>
    </div>
    <footer class="auth-foot"><span>${esc(S.clinic?.name || 'Quirón Especialidades Médicas')} · RIF ${esc(S.clinic?.rif || '')}</span><span>Datos de pacientes confidenciales · uso exclusivo del personal autorizado</span></footer></div>`;
  box.querySelector('input')?.focus();
}
// Día / Noche desde la pantalla de acceso, sin perder lo escrito
ACTIONS.authTheme = el => { setTheme(el.dataset.k); document.querySelectorAll('#auth [data-act="authTheme"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === el.dataset.k))); };
ACTIONS.authForgot = () => auMsg('Pida a la administración que le restablezca la contraseña o le envíe un código nuevo (Usuarios › su nombre).');
const auMsg = t => { const m = document.getElementById('au-msg'); if (m) m.textContent = t; };
ACTIONS.authMode = el => showAuth(el.dataset.k);
// Enter en la contraseña = Entrar
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest?.('#auth form')) { e.preventDefault(); document.querySelector('#auth .auth-btns .auth-go')?.click(); } });

ACTIONS.authSetup = async () => {
  if (activeAdmins().length) { showAuth('login'); return; }
  const name = val('au-name').trim(), email = normEmail(val('au-email')), p = val('au-pass');
  if (!name) return auMsg('Escriba su nombre.'); if (!validEmail(email)) return auMsg('Escriba un correo válido.');
  const prob = passProblem(p, val('au-pass2')); if (prob) return auMsg(prob);
  const salt = newSalt(); const u = { id: uid('u'), name, email, role: 'admin', doc: null, status: 'activo', salt, hash: await hashPass(p, salt), created: nowStamp(), lastLogin: nowStamp() };
  S.users.push(u); startSession(u, document.getElementById('au-keep').checked); log('Cuenta de administrador creada', email); save(); enterApp(); toast(`Bienvenido, ${name}`);
};
ACTIONS.authLogin = async () => {
  const wait = (UI.authLock || 0) - Date.now(); if (wait > 0) return auMsg(`Demasiados intentos. Espere ${Math.ceil(wait / 1000)} segundos.`);
  const email = normEmail(val('au-email')), p = val('au-pass'); if (!email || !p) return auMsg('Escriba su correo y su contraseña.');
  const u = S.users.find(x => x.email === email);
  const ok = u && u.hash && await hashPass(p, u.salt) === u.hash;
  if (!ok || u.status !== 'activo') {
    UI.authFails = (UI.authFails || 0) + 1; if (UI.authFails >= 5) { UI.authLock = Date.now() + 60000; UI.authFails = 0; }
    return auMsg(u && u.status === 'desactivado' && ok ? 'Este usuario está desactivado. Consulte con la administración.' : u && u.status === 'invitado' ? 'Este usuario aún no está activado: use "Tengo un código de invitación".' : 'Correo o contraseña incorrectos.');
  }
  UI.authFails = 0; u.lastLogin = nowStamp(); startSession(u, document.getElementById('au-keep').checked); log('Inicio de sesión', email); save();
  if (u.mustChange) { showAuth('cambiar'); return; }
  enterApp(); toast(`Bienvenido, ${u.name}`);
};
ACTIONS.authInvite = async () => {
  const email = normEmail(val('au-email')), code = val('au-code').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''), p = val('au-pass');
  const u = S.users.find(x => x.email === email && x.status === 'invitado' && x.invite);
  const ok = u && u.invite.exp > Date.now() && await sha256(code) === u.invite.hash;
  if (!ok) return auMsg(u && u.invite?.exp <= Date.now() ? 'El código venció. Pida uno nuevo a la administración.' : 'El correo o el código no coinciden con ninguna invitación.');
  const prob = passProblem(p, val('au-pass2')); if (prob) return auMsg(prob);
  u.salt = newSalt(); u.hash = await hashPass(p, u.salt); u.status = 'activo'; delete u.invite; u.lastLogin = nowStamp();
  startSession(u, document.getElementById('au-keep').checked); log('Usuario activado', email); save(); enterApp(); toast(`Bienvenido, ${u.name}`);
};
ACTIONS.authChange = async () => {
  const u = meUser(); if (!u) { showAuth('login'); return; }
  const p = val('au-pass'); const prob = passProblem(p, val('au-pass2')); if (prob) return auMsg(prob);
  u.salt = newSalt(); u.hash = await hashPass(p, u.salt); u.mustChange = false; log('Contraseña cambiada', u.email); save(); enterApp(); toast('Contraseña guardada');
};
ACTIONS.logout = () => { const u = meUser(); if (u) { log('Cierre de sesión', u.email); save(); } endSession(); showAuth(activeAdmins().length ? 'login' : 'setup'); };

// ---------- Mi cuenta (botón de usuario en el menú lateral) ----------
ACTIONS.switchUser = () => {
  const u = meUser(); if (!u) return;
  openSheet('Mi cuenta', `<div class="hstack" style="gap:14px"><span class="avatar" style="width:52px;height:52px;font-size:18px">${initials(u.name)}</span><div><b style="font-size:17px">${esc(u.name)}</b><div class="small muted">${esc(u.email)} · ${esc(roleLabel(u.role))}${u.doc ? ' · ' + esc(med(u.doc)?.name || '') : ''}</div></div></div>
    <div class="between"><span class="small muted">Apariencia</span>${themeSeg('setTheme')}</div>
    ${credsCard(u)}
    <div class="card" style="display:grid;gap:10px"><b class="small">Cambiar contraseña</b><div class="form">
      <div class="field"><label for="mc-old">Contraseña actual</label><input class="input" type="password" id="mc-old" autocomplete="current-password"></div>
      <div class="field"><label for="mc-new">Nueva contraseña</label><input class="input" type="password" id="mc-new" autocomplete="new-password"></div>
      <div class="field"><label for="mc-new2">Repita la nueva</label><input class="input" type="password" id="mc-new2" autocomplete="new-password"></div></div>
      <div class="hstack"><button class="btn sm" data-act="myPassSave">Guardar contraseña</button><span class="small" id="mc-msg"></span></div></div>`,
    `<button class="btn danger" data-act="logout">Cerrar sesión</button><button class="btn" data-act="close">Cerrar</button>`);
};
ACTIONS.myPassSave = async () => {
  const u = meUser(); const m = document.getElementById('mc-msg');
  if (await hashPass(val('mc-old'), u.salt) !== u.hash) { m.textContent = 'La contraseña actual no es correcta.'; m.style.color = 'var(--bad)'; return; }
  const prob = passProblem(val('mc-new'), val('mc-new2')); if (prob) { m.textContent = prob; m.style.color = 'var(--bad)'; return; }
  u.salt = newSalt(); u.hash = await hashPass(val('mc-new'), u.salt); log('Contraseña cambiada', u.email); save(); closeSheet(); toast('Contraseña actualizada');
};

// ---------- Usuarios (solo administrador) ----------
const usersList = () => {
  const list = [...(S.users || [])].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
  const count = st => list.filter(u => u.status === st).length;
  return header('Usuarios', 'Solo el administrador puede crear, invitar y desactivar usuarios', `<button class="btn primary" data-act="userNew">+ Nuevo usuario</button>`) +
  `<div class="grid g4">${kpi('Activos', count('activo'))}${kpi('Invitaciones pendientes', count('invitado'))}${kpi('Desactivados', count('desactivado'))}</div>
  <div class="banner sec">Cada persona entra con su propio correo y contraseña, y solo ve las secciones de su rol. Lo que hace queda registrado con su nombre en el historial de acciones.</div>
  <div class="list sec">${list.map(u => `<button class="row" data-act="userEdit" data-id="${u.id}"><span class="avatar">${initials(u.name)}</span>
    <div class="grow"><div class="t">${esc(u.name)}${u.id === S.session?.uid ? ' <span class="pill info">Usted</span>' : ''}</div><div class="s">${esc(u.email)} · ${esc(roleLabel(u.role))}${u.doc ? ' · ' + esc(med(u.doc)?.name || '') : ''}</div></div>
    <div class="end"><span class="pill ${USER_ST[u.status][1]}">${USER_ST[u.status][0]}</span><div class="small muted">${u.lastLogin ? 'último acceso ' + u.lastLogin : 'sin accesos'}</div></div></button>`).join('')}</div>`;
};
const docSelect = (role, sel) => ['medico', 'residente'].includes(role) ? `<div class="field"><label for="us-doc">Médico vinculado <span style="color:var(--bad)">*</span></label><select class="input" id="us-doc"><option value="">Seleccione…</option>${activeDocs().filter(m => role === 'residente' ? m.resident : !m.resident).map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)} · ${esc(m.esp)}</option>`).join('')}</select></div>` : '';
function userForm(u) {
  return `<div class="form"><div class="field"><label for="us-name">Nombre completo</label><input class="input" id="us-name" value="${esc(u.name || '')}"></div>
    <div class="field"><label for="us-email">Correo electrónico</label><input class="input" type="email" id="us-email" value="${esc(u.email || '')}" ${u.id ? 'disabled' : ''}></div>
    <div class="field"><label for="us-role">Rol</label><select class="input" id="us-role" data-ch="usRole" ${u.id && u.id === S.session?.uid ? 'disabled' : ''}>${userRoles().map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${esc(roleLabel(r))}</option>`).join('')}</select></div>
    <div id="us-docbox">${docSelect(u.role, u.doc)}</div></div>
    <div class="small muted" id="us-rolehelp">${roleHelp(u.role)}</div>`;
}
const roleHelp = r => ({ enfermeria_plus: 'Todo lo de enfermería (hospitalización, emergencias, medicación y material de quirófano) y además programa cirugías desde Quirófano. No agenda consultas.', admin: 'Acceso total, incluidos usuarios, contabilidad, presupuestos y ajustes.', recepcion: 'Agenda completa (citas y cirugías) y fichas de pacientes: datos de contacto, consentimientos y preoperatorios externos. No ve historias clínicas.', medico: 'Su consulta y su agenda: programa sus propias citas y cirugías; quirófano, hospitalización, pacientes, historias clínicas, informes y sus exámenes.', residente: 'Hospitalización completa; consulta de pacientes, exámenes e historias.', enfermeria: 'Hospitalización y emergencias: solicita medicación y material, registra aplicaciones y lee las evoluciones. No entra a Quirófano (eso es de Enfermeras+).', almacen: 'Inventario, compras y despacho. Ve qué se pidió en quirófano y hospitalización, sin modificar. No ve el valor total del inventario.', laboratorio: 'Laboratorio completo (sin rayos X) y pacientes: alergias, antecedentes y exámenes.', imagen: 'Rayos X e imagen: órdenes, estudios e informes.' })[r] || '';
ACTIONS.usRole = el => { document.getElementById('us-docbox').innerHTML = docSelect(el.value, null); document.getElementById('us-rolehelp').textContent = roleHelp(el.value); };
ACTIONS.userNew = (el = {}) => { if (!can('*')) return;
  UI.usMode = 'invite';
  openSheet('Nuevo usuario', userForm({ role: ROLES[el.dataset?.role] ? el.dataset.role : 'recepcion' }) + `<div><b class="small">¿Cómo recibirá el acceso?</b><div class="seg" role="group" aria-label="Forma de acceso" style="margin-top:6px"><button data-act="usMode" data-k="invite" aria-pressed="true">Código de invitación</button><button data-act="usMode" data-k="temp" aria-pressed="false">Contraseña temporal</button></div>
    <div class="small muted" id="us-modehelp" style="margin-top:6px">${modeHelp('invite')}</div></div>`,
    `<span class="note" id="us-msg"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="userSave">Crear usuario</button>`);
};
const modeHelp = m => m === 'invite' ? 'Se genera un código que vence en 7 días. La persona lo usa en "Tengo un código de invitación" y crea su propia contraseña.' : 'Se genera una contraseña temporal. Al entrar por primera vez, el sistema le pedirá cambiarla.';
ACTIONS.usMode = el => { UI.usMode = el.dataset.k; document.querySelectorAll('[data-act="usMode"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === UI.usMode)); document.getElementById('us-modehelp').textContent = modeHelp(UI.usMode); };
async function issueAccess(u, mode) {
  if (mode === 'temp') { const p = tempPass(); u.salt = newSalt(); u.hash = await hashPass(p, u.salt); u.mustChange = true; u.status = 'activo'; delete u.invite; return { kind: 'temp', secret: p }; }
  const code = newCode(); u.invite = { hash: await sha256(code.replace('-', '')), exp: Date.now() + 7 * DAY }; u.status = 'invitado'; delete u.hash; delete u.salt; return { kind: 'invite', secret: code };
}
function showAccess(u, acc) {
  const msg = acc.kind === 'invite'
    ? `Hola, ${u.name}. Se le creó un usuario en el sistema de ${S.clinic?.name || 'la clínica'}. Abra el sistema, pulse "Tengo un código de invitación" y escriba su correo (${u.email}) y el código ${acc.secret}. El código vence en 7 días.`
    : `Hola, ${u.name}. Se le creó un usuario en el sistema de ${S.clinic?.name || 'la clínica'}. Correo: ${u.email} · Contraseña temporal: ${acc.secret}. Al entrar, el sistema le pedirá crear una contraseña nueva.`;
  UI.accMsg = msg;
  openSheet(acc.kind === 'invite' ? 'Invitación creada' : 'Usuario creado', `<div class="banner">Entregue estos datos a ${esc(u.name)} por un medio privado. <b>Solo se muestran ahora</b>: si se pierden, genere una invitación nueva.</div>
    <div class="card" style="text-align:center;padding:18px"><div class="small muted">${acc.kind === 'invite' ? 'Código de invitación' : 'Contraseña temporal'}</div><div class="mono" style="font-size:26px;font-weight:700;letter-spacing:.08em;margin-top:6px">${esc(acc.secret)}</div><div class="small muted" style="margin-top:6px">${esc(u.email)}</div></div>
    <div class="card small" style="line-height:1.5">${esc(msg)}</div>`,
    `<button class="btn" data-act="accCopy">Copiar mensaje</button><button class="btn primary" data-act="close">Listo</button>`);
}
ACTIONS.accCopy = () => copyText(UI.accMsg || '', 'Mensaje copiado');
ACTIONS.userSave = async () => {
  const msg = document.getElementById('us-msg'); const name = val('us-name').trim(), email = normEmail(val('us-email')), role = val('us-role'), doc = val('us-doc') || null;
  if (!name) { msg.textContent = 'Escriba el nombre.'; return; }
  if (!validEmail(email)) { msg.textContent = 'Escriba un correo válido.'; return; }
  if (S.users.some(u => u.email === email)) { msg.textContent = 'Ya existe un usuario con ese correo.'; return; }
  if (['medico', 'residente'].includes(role) && !doc) { msg.textContent = 'Seleccione el médico vinculado.'; return; }
  const u = { id: uid('u'), name, email, role, doc: ['medico', 'residente'].includes(role) ? doc : null, status: 'invitado', created: nowStamp(), createdBy: actor() };
  const acc = await issueAccess(u, UI.usMode); S.users.push(u);
  log(acc.kind === 'invite' ? 'Usuario invitado' : 'Usuario creado', `${name} · ${email} · ${roleLabel(role)}`); save(); render(); showAccess(u, acc);
};
ACTIONS.userEdit = el => {
  const u = S.users.find(x => x.id === el.dataset.id); const self = u.id === S.session?.uid; const lastAdmin = u.role === 'admin' && activeAdmins().length <= 1 && u.status === 'activo';
  openSheet(self ? 'Su usuario' : `Usuario · ${u.name}`, userForm(u) + `<div class="small muted">${u.created ? 'Creado ' + u.created + (u.createdBy ? ' por ' + esc(u.createdBy) : '') : ''}${u.lastLogin ? ' · último acceso ' + u.lastLogin : ''}${u.invite ? ` · invitación vigente hasta ${fdate(iso(new Date(u.invite.exp)))}` : ''}</div>`,
    `<span class="note" id="us-msg"></span>${self ? '' : u.status === 'desactivado' ? `<button class="btn" data-act="userStatus" data-id="${u.id}" data-st="activo">Reactivar</button>` : lastAdmin ? '' : `<button class="btn danger" data-act="userStatus" data-id="${u.id}" data-st="desactivado">Desactivar</button>`}
    ${self ? '' : `<button class="btn" data-act="userReissue" data-id="${u.id}" data-k="invite">Nueva invitación</button><button class="btn" data-act="userReissue" data-id="${u.id}" data-k="temp">Contraseña temporal</button>`}
    <button class="btn primary" data-act="userUpdate" data-id="${u.id}">Guardar</button>`);
};
ACTIONS.userUpdate = el => {
  const u = S.users.find(x => x.id === el.dataset.id); const msg = document.getElementById('us-msg'); const self = u.id === S.session?.uid;
  const name = val('us-name').trim(); const role = self ? u.role : val('us-role'); const doc = val('us-doc') || null;
  if (!name) { msg.textContent = 'Escriba el nombre.'; return; }
  if (['medico', 'residente'].includes(role) && !doc) { msg.textContent = 'Seleccione el médico vinculado.'; return; }
  if (u.role === 'admin' && role !== 'admin' && activeAdmins().length <= 1) { msg.textContent = 'Debe quedar al menos un administrador activo.'; return; }
  const changed = u.role !== role; u.name = name; u.role = role; u.doc = ['medico', 'residente'].includes(role) ? doc : null;
  if (self) applyUser(u);
  log('Usuario actualizado', `${name}${changed ? ' · nuevo rol: ' + roleLabel(role) : ''}`); save(); closeSheet(); render(); toast('Usuario actualizado');
};
ACTIONS.userStatus = el => {
  const u = S.users.find(x => x.id === el.dataset.id); const st = el.dataset.st;
  if (st === 'desactivado' && u.role === 'admin' && activeAdmins().length <= 1) { toast('Debe quedar al menos un administrador activo'); return; }
  if (st === 'activo' && !u.hash) { toast('Este usuario nunca activó su acceso: genere una nueva invitación'); return; }
  u.status = st; log(st === 'activo' ? 'Usuario reactivado' : 'Usuario desactivado', `${u.name} · ${u.email}`); save(); closeSheet(); render(); toast(st === 'activo' ? 'Usuario reactivado' : 'Usuario desactivado: ya no puede entrar');
};
ACTIONS.userReissue = async el => {
  const u = S.users.find(x => x.id === el.dataset.id); const acc = await issueAccess(u, el.dataset.k);
  log(acc.kind === 'invite' ? 'Nueva invitación generada' : 'Contraseña temporal generada', `${u.name} · ${u.email}`); save(); render(); showAccess(u, acc);
};

// ---------- Usuarios › Médicos y Enfermeras (personal clínico) ----------
// Los médicos de esta lista son los que aparecen en la agenda, en "Médico tratante", en "Médico que solicita" y en la guardia.
const DOC_KIND = { medico: 'Médico tratante', residente: 'Médico residente', anestesiologo: 'Anestesiólogo' };
const docKind = m => m.resident ? 'residente' : isAnest(m) ? 'anestesiologo' : 'medico';
VIEWS.usuarios = () => {
  if (!can('*')) return '<div class="empty">No tiene permiso para administrar usuarios.</div>';
  return header('Usuarios', 'Personal y acceso al sistema, organizados por rol') + userRoles().map(r => {
    const users = (S.users || []).filter(u => u.role === r);
    const docs = ['medico', 'residente'].includes(r) ? (S.doctors || []).filter(d => !d.example && !!d.resident === (r === 'residente')) : [];
    const nurses = r === 'enfermeria' ? (S.nurseStaff || []) : [];
    const staff = docs.map(d => `<button class="row" data-act="staffDoc" data-id="${d.id}"><span class="avatar">${initials(d.name)}</span><div class="grow"><div class="t">${esc(d.name)}</div><div class="s">${esc(d.esp)} · ${esc(hoursText(d.id))}</div></div>${d.active === false ? '<span class="pill">Inactivo</span>' : !d.mpps ? '<span class="pill warn">Falta MPPS</span>' : ''}</button>`).join('') + nurses.map(n => `<button class="row" data-act="staffNurse" data-i="${S.nurseStaff.indexOf(n)}"><span class="avatar">${initials(n.name)}</span><div class="grow"><div class="t">${esc(n.name)}</div><div class="s">${n.days?.length ? 'Guardia fija: ' + n.days.map(d => DAY_NAMES[d]).join(', ') : 'Sin días fijos'}</div></div>${n.active === false ? '<span class="pill">Inactiva</span>' : ''}</button>`).join('');
    const accounts = users.map(u => `<button class="row" data-act="userEdit" data-id="${u.id}"><span class="avatar">${initials(u.name)}</span><div class="grow"><div class="t">${esc(u.name)}${u.id === S.session?.uid ? ' <span class="pill info">Usted</span>' : ''}</div><div class="s">${esc(u.email || '')}${u.doc ? ' · ' + esc(med(u.doc)?.name || '') : ''}</div></div><div class="end"><span class="pill ${USER_ST[u.status]?.[1] || ''}">${USER_ST[u.status]?.[0] || esc(u.status)}</span><div class="small muted">${u.lastLogin ? 'Último acceso ' + esc(u.lastLogin) : 'Sin accesos'}</div></div></button>`).join('');
    const count = users.length + ' usuario(s)' + (['medico', 'residente'].includes(r) ? ' · ' + docs.length + ' en personal' : r === 'enfermeria' ? ' · ' + nurses.length + ' en personal' : '');
    const addStaff = ['medico', 'residente'].includes(r) ? `<button class="btn" data-act="staffDoc" data-kind="${r}">+ Agregar ${r === 'residente' ? 'residente' : 'médico'}</button>` : r === 'enfermeria' ? '<button class="btn" data-act="staffNurse">+ Agregar enfermera</button>' : '';
    return `<section class="sec" data-user-role="${r}"><div class="between"><h2>${esc(userRoleTitle(r))} <span class="pill">${count}</span></h2><div class="hstack">${addStaff}<button class="btn primary" data-act="userNew" data-role="${r}">+ Agregar usuario</button></div></div>${staff ? '<div class="small muted">Personal · editar datos, estado y guardias. Horarios de consulta en Agenda.</div><div class="list" style="margin:8px 0 14px">' + staff + '</div><div class="small muted">Acceso al sistema · invitaciones, contraseñas y permisos</div>' : ''}<div class="list" style="margin-top:8px">${accounts || '<div class="empty">No hay usuarios de este rol.</div>'}</div></section>`;
  }).join('');
};
ACTIONS.usTab = el => { UI.usTab = el.dataset.k; render(); };
ACTIONS.staffDoc = el => { if (!can('*')) return; const d = (S.doctors || []).find(x => x.id === el.dataset?.id) || {};
  openSheet(d.id ? d.name : 'Agregar médico', `<div class="form">
    <div class="field"><label for="sd-n">Nombre (con Dr., Dra. o Lic.)</label><input class="input" id="sd-n" value="${esc(d.name || '')}" placeholder="Ej. Dr. Pedro Gómez"></div>
    <div class="field"><label for="sd-e">Especialidad</label><input class="input" id="sd-e" value="${esc(d.esp || '')}" placeholder="Ej. Traumatología"></div>
    <div class="field"><label for="sd-k">Tipo</label><select class="input" id="sd-k">${Object.entries(DOC_KIND).map(([k, t]) => `<option value="${k}" ${(d.id ? docKind(d) : el.dataset?.kind || 'medico') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <label class="field hstack small" style="align-self:end"><input type="checkbox" id="sd-a" ${d.active !== false ? 'checked' : ''}> Activo (aparece en las listas)</label></div>
    <div class="card small" style="margin-top:6px"><b>Datos profesionales</b><div class="muted">${d.id && (S.users || []).some(u => u.doc === d.id) ?
      (d.mpps ? 'C.I. ' + esc(d.ci || '—') + ' · MPPS ' + esc(d.mpps) + ' · C.M. ' + esc(d.cm || '—') : 'Pendiente: el médico debe registrarlos en Mi cuenta.') :
      'Este médico aún no tiene usuario. Cuando lo tenga, registrará su cédula, MPPS y Colegio en Mi cuenta.'}</div></div>
    <div class="small muted">Su historial se conserva aunque lo desactive. El horario de consulta se carga en Agenda › Consultas › Horarios de médicos.</div><span class="note" id="sd-msg"></span>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="staffDocSave" data-id="${d.id || ''}">Guardar</button>`); };
ACTIONS.staffDocSave = el => { if (!can('*')) return;
  const name = val('sd-n').trim().replace(/\s+/g, ' '), kind = val('sd-k'); let esp = val('sd-e').trim(); const msg = document.getElementById('sd-msg');
  if (name.length < 4) { msg.textContent = 'Escriba el nombre completo.'; return; }
  if (kind === 'residente' && !esp) esp = 'Médico residente'; if (kind === 'anestesiologo' && !esp) esp = 'Anestesiología';
  if (!esp) { msg.textContent = 'Escriba la especialidad.'; return; }
  if ((S.doctors || []).some(x => x.id !== el.dataset.id && !x.example && x.name.toLowerCase() === name.toLowerCase())) { msg.textContent = 'Ya hay un médico con ese nombre.'; return; }
  let d = (S.doctors || []).find(x => x.id === el.dataset.id); const isNew = !d; if (isNew) { d = { id: uid('dr') }; S.doctors.push(d); }
  Object.assign(d, { name, esp, resident: kind === 'residente', anest: kind === 'anestesiologo', active: document.getElementById('sd-a').checked });
  syncStaff(); log(isNew ? 'Médico agregado' : 'Médico modificado', `${name} · ${esp}${d.active ? '' : ' · inactivo'}`); save(); closeSheet(); render(); toast('Guardado'); };
ACTIONS.staffNurse = el => { if (!can('*')) return; const i = el.dataset?.i; const n = i != null ? S.nurseStaff[+i] : { name: '', days: [], active: true };
  openSheet(i != null ? n.name : 'Agregar enfermera', `<div class="field"><label for="sn-n">Nombre</label><input class="input" id="sn-n" value="${esc(n.name)}"></div>
    <div><b class="small">Días fijos de guardia</b><div class="hstack" style="margin-top:6px">${[1, 2, 3, 4, 5, 6, 0].map(k => `<label class="hstack small"><input type="checkbox" class="sn-day" value="${k}" ${n.days?.includes(k) ? 'checked' : ''}> ${DAY_NAMES[k]}</label>`).join('')}</div></div>
    <label class="hstack small"><input type="checkbox" id="sn-a" ${n.active !== false ? 'checked' : ''}> Activa (aparece en las listas)</label><span class="note" id="sn-msg"></span>`,
    `<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="staffNurseSave" data-i="${i ?? ''}">Guardar</button>`); };
ACTIONS.staffNurseSave = el => { if (!can('*')) return;
  const name = val('sn-n').trim().replace(/\s+/g, ' '); if (name.length < 3) { document.getElementById('sn-msg').textContent = 'Escriba el nombre.'; return; }
  const days = [...document.querySelectorAll('.sn-day:checked')].map(c => +c.value); const i = el.dataset.i;
  // Un día fijo es de una sola enfermera: si ya lo tenía otra, se le quita
  S.nurseStaff.forEach((x, j) => { if (String(j) !== i) x.days = (x.days || []).filter(d => !days.includes(d)); });
  const data = { name, days, active: document.getElementById('sn-a').checked };
  if (i === '') S.nurseStaff.push(data); else Object.assign(S.nurseStaff[+i], data);
  syncStaff(); log('Enfermera guardada', `${name} · ${days.map(d => DAY_NAMES[d]).join(', ') || 'sin días fijos'}`); save(); closeSheet(); render(); toast('Guardado'); };

// ---------- Datos profesionales del usuario (cédula, MPPS, Colegio de Médicos) ----------
// Pertenecen a la cuenta de cada persona; si la cuenta está vinculada a un médico del personal, se copian a su ficha
// para que salgan bajo la firma de récipes, informes y constancias.
const CREDS_REQUIRED = ['medico', 'residente'];
const credsOf = u => ({ ci: u?.ci || '', mpps: u?.mpps || '', cm: u?.cm || '' });
const credsMissing = u => !!u && CREDS_REQUIRED.includes(u.role) && (!u.mpps || !u.cm);
function credsCard(u) {
  if (![...CREDS_REQUIRED, 'admin'].includes(u.role)) return '';
  const req = CREDS_REQUIRED.includes(u.role), c = credsOf(u);
  return `<div class="card" style="display:grid;gap:10px"><b class="small">Datos profesionales ${req ? '<span class="pill warn">Obligatorios para firmar</span>' : '<span class="pill">Opcional</span>'}</b>
    ${req && credsMissing(u) ? '<div class="banner warn">Registre su N.º MPPS y su Colegio de Médicos: sin ellos no puede firmar consultas, evoluciones ni récipes.</div>' : ''}
    ${u.role === 'admin' ? `<div class="field"><label for="mc-doc">Su ficha de médico <span class="small muted">(si también atiende pacientes)</span></label><select class="input" id="mc-doc">
      <option value="">No atiendo pacientes</option>${(S.doctors || []).filter(d => !d.resident && (d.active !== false || d.id === u.doc) && !(S.users || []).some(x => x.id !== u.id && x.doc === d.id)).map(d => `<option value="${d.id}" ${u.doc === d.id ? 'selected' : ''}>${esc(d.name)}${d.esp ? ' · ' + esc(d.esp) : ''}</option>`).join('')}</select>
      <div class="small muted" style="margin-top:4px">Con su ficha vinculada puede escribir y firmar evoluciones y consultas con su nombre.</div></div>` : ''}
    <div class="form">
      <div class="field"><label for="mc-ci">Cédula</label><input class="input" id="mc-ci" value="${esc(c.ci)}" placeholder="Ej. V-12.345.678"></div>
      <div class="field"><label for="mc-mpps">N.º de registro MPPS${req ? ' *' : ''}</label><input class="input" id="mc-mpps" inputmode="numeric" value="${esc(c.mpps)}" placeholder="Ej. 54321"></div>
      <div class="field"><label for="mc-cm">Colegio de Médicos: n.º y colegio${req ? ' *' : ''}</label><input class="input" id="mc-cm" value="${esc(c.cm)}" placeholder="Ej. 12345 · CM Miranda"></div></div>
    <div class="small muted">Se imprimen bajo su firma en informes, récipes, órdenes y constancias.</div>
    <div class="hstack"><button class="btn sm primary" data-act="myCredsSave">Guardar datos profesionales</button><span class="small" id="mc-creds-msg"></span></div></div>`;
}
ACTIONS.myCredsSave = () => {
  const u = meUser(); if (!u) return;
  const m = document.getElementById('mc-creds-msg');
  const ci = val('mc-ci').trim(), mpps = val('mc-mpps').trim().replace(/\s+/g, ''), cm = val('mc-cm').trim().replace(/\s+/g, ' ');
  const bad = t => { m.textContent = t; m.style.color = 'var(--bad)'; };
  if (CREDS_REQUIRED.includes(u.role) && (!mpps || !cm)) return bad('El N.º MPPS y el Colegio de Médicos son obligatorios para médicos y residentes.');
  if (mpps && !/^\d{3,8}$/.test(mpps)) return bad('El N.º MPPS lleva solo números (entre 3 y 8 cifras).');
  if (cm && !/\d/.test(cm)) return bad('Indique el número de colegiado (y, si quiere, el colegio).');
  if (u.role === 'admin') {
    const docId = val('mc-doc') || null, d = docId && (S.doctors || []).find(x => x.id === docId);
    if (d && docId !== u.doc) { u.doc = docId; S.session.doc = docId; log('Administrador vinculado a su ficha de médico', u.name + ' · ' + d.name);
      // Al vincularse, los datos que ya tiene la ficha no se pierden si las casillas están vacías
      Object.assign(u, { ci: ci || d.ci || '', mpps: mpps || d.mpps || '', cm: cm || d.cm || '' }); }
    else if (!docId && u.doc) { log('Administrador desvinculado de su ficha de médico', u.name); u.doc = null; S.session.doc = null; Object.assign(u, { ci, mpps, cm }); }
    else Object.assign(u, { ci, mpps, cm });
  } else Object.assign(u, { ci, mpps, cm });
  syncCredsToDoctor(u);
  log('Datos profesionales actualizados', u.name + (mpps ? ' · MPPS ' + mpps : ''));
  save(); m.textContent = 'Guardado'; m.style.color = 'var(--good)'; render();
};
// La ficha del médico toma los números de la cuenta vinculada (no se escriben a mano en Usuarios)
function syncCredsToDoctor(u) {
  const d = u?.doc && (S.doctors || []).find(x => x.id === u.doc); if (!d) return;
  Object.assign(d, credsOf(u)); syncStaff();
}
// Al abrir la app, la ficha de cada médico refleja los datos de su cuenta
if (typeof S !== 'undefined' && S) (S.users || []).forEach(u => { if (u.doc && (u.mpps || u.cm || u.ci)) { const d = (S.doctors || []).find(x => x.id === u.doc); if (d) Object.assign(d, credsOf(u)); } });
// Firma: un médico o residente sin sus números no puede firmar
function credsBlockSign() {
  const u = meUser();
  if (!credsMissing(u)) return false;
  toast('Antes de firmar, registre su N.º MPPS y su Colegio de Médicos en Mi cuenta.');
  setTimeout(() => ACTIONS.switchUser(), 400);
  return true;
}

// ---------- Cierre de sesión por inactividad ----------
// La sesión sigue abierta mientras se usa el programa. Tras 1 hora sin tocarlo (ratón, teclado o pantalla) se cierra
// y hay que volver a entrar con la contraseña. Vale también entre pestañas y si se cerró el navegador. Las consultas y
// evoluciones ya se guardan solas como borrador, así que no se pierde lo escrito.
const IDLE_MS = 60 * 60 * 1000, IDLE_KEY = 'quiron-ultima-actividad';
const IDLE_MSG = 'Su sesión se cerró tras 1 hora sin uso. Vuelva a entrar.';
let idleWrote = 0;
function idleMark(force) {
  const now = Date.now(); if (!force && now - idleWrote < 15000) return;   // como mucho una escritura cada 15 s
  idleWrote = now; try { localStorage.setItem(IDLE_KEY, String(now)); } catch (e) {}
}
// Sin registro previo (primera vez tras la actualización) no se considera vencida
const idleExpired = () => { let last = 0; try { last = +(localStorage.getItem(IDLE_KEY) || 0); } catch (e) {} return !!last && Date.now() - last > IDLE_MS; };
function idleCheck() {
  if (!S?.session?.uid || !idleExpired()) return;
  const u = meUser(); if (u) { log('Sesión cerrada por inactividad', u.email || u.name); save(); }
  endSession(); showAuth('login', IDLE_MSG);
}
if (typeof addEventListener === 'function') {
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { if (S?.session?.uid) idleMark(); }, { passive: true, capture: true }));
  document.addEventListener?.('visibilitychange', () => { if (!document.hidden) idleCheck(); });
  setInterval(idleCheck, 30000);
}
