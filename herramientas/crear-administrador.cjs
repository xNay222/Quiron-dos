// Crea la cuenta del administrador durante la instalación (el sistema ya no tiene registro abierto).
// No pide ni guarda ninguna contraseña: genera un código de activación de 7 días. La persona abre el sistema,
// toca "Tengo un código de invitación", escribe su correo y el código, y crea su propia contraseña.
//
// Uso (con el servidor local detenido o sin nadie usando el sistema):
//   node herramientas/crear-administrador.cjs "Nombre Apellido" correo@ejemplo.com
//   node herramientas/crear-administrador.cjs "Nombre Apellido" correo@ejemplo.com --nuevo-codigo   (si ya existe y el código venció)
//
// Antes de escribir guarda una copia en "copias de seguridad". Si ya hay un administrador activo con otro correo, no hace nada:
// los demás usuarios se invitan desde el sistema (Mi cuenta › Invitar a un usuario).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [name, emailRaw] = process.argv.slice(2).filter(a => !a.startsWith('--')); const renew = process.argv.includes('--nuevo-codigo');
const email = String(emailRaw || '').trim().toLowerCase();
if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error('Uso: node herramientas/crear-administrador.cjs "Nombre Apellido" correo@ejemplo.com [--nuevo-codigo]'); process.exit(1); }

const dir = path.join(__dirname, '..', 'copias de seguridad');
const file = path.join(dir, '_estado-servidor.json'), metaFile = path.join(dir, '_estado-servidor.meta.json');
if (!fs.existsSync(file)) { console.error('No hay datos del sistema todavía. Abra el sistema una vez con "Abrir Quiron Dos.bat" y vuelva a ejecutar esto.'); process.exit(1); }
const raw = fs.readFileSync(file, 'utf8'); const doc = JSON.parse(raw); const S = doc.state || doc; S.users = S.users || [];

const admins = S.users.filter(u => u.role === 'admin' && u.status !== 'desactivado');   // activos o pendientes de activar
const existing = S.users.find(u => u.email === email);
if (admins.length && !(existing && existing.role === 'admin')) { console.error(`Ya hay un administrador (${admins.map(u => u.email).join(', ')}). Invite a los demás desde el sistema.`); process.exit(1); }
if (existing && existing.status === 'activo' && !renew) { console.error(`${email} ya es un usuario activo. Si olvidó la contraseña, use --nuevo-codigo para generarle un código nuevo.`); process.exit(1); }

// Mismo formato que el sistema: 8 caracteres sin letras confusas, la huella SHA-256 sin el guion
const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const c = [...crypto.randomBytes(8)].map(n => A[n % A.length]).join('');
const code = c.slice(0, 4) + '-' + c.slice(4);
const invite = { hash: crypto.createHash('sha256').update(c).digest('hex'), exp: Date.now() + 7 * 864e5 };
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
let u = existing;
if (u) { Object.assign(u, { name, role: 'admin', status: 'invitado', invite }); delete u.hash; delete u.salt; delete u.mustChange; }
else { u = { id: 'u' + crypto.randomBytes(4).toString('hex'), name, email, role: 'admin', doc: null, status: 'invitado', invite, created: stamp, createdBy: 'Instalación' }; S.users.push(u); }
(S.audit = S.audit || []).unshift({ at: stamp, user: 'Instalación', action: existing ? 'Código de administrador renovado' : 'Administrador creado en la instalación', ref: `${name} · ${email}` });

// Copia previa y escritura; la fecha nueva hace que los navegadores tomen estos datos al abrir
const now = new Date().toISOString();
fs.writeFileSync(path.join(dir, `Antes de crear administrador ${now.slice(0, 10)} ${Date.now().toString().slice(-5)}.json`), raw);
S.savedAt = now; if (doc.state) doc.savedAt = now;
fs.writeFileSync(file + '.tmp', JSON.stringify(doc)); fs.renameSync(file + '.tmp', file);
let meta = {}; try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch (e) {}
fs.writeFileSync(metaFile, JSON.stringify({ ...meta, savedAt: now }));

console.log(`\nAdministrador listo: ${name} <${email}>`);
console.log(`Código de activación: ${code}   (vence en 7 días; no se vuelve a mostrar)\n`);
console.log('Abra el sistema, toque "Tengo un código de invitación", escriba el correo y el código, y cree su contraseña.');
