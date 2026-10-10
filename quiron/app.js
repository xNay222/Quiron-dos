// Navegación, ventanas y delegación de eventos.
const ICONS = {
  inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  agenda: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  pacientes: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  historias: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M9 8h7M9 12h5"/>',
  atencion: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  descargar: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  quirofano: '<circle cx="12" cy="7" r="3.2"/><path d="M4 11h16M6 11l1.5 9h9L18 11M12 3.8V2"/>',
  emergencias: '<path d="M12 3 2.5 20h19z"/><path d="M12 9.5v5M12 17.5h.01"/>',
  hospitalizacion: '<path d="M3 20V6M3 13h18v7M21 13v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="10" r="1.8"/>',
  consultorio: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',
  examenes: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7 15h10"/>',
  contabilidad: '<path d="M3 20h18"/><path d="M6 16V9M10 16V5M14 16v-5M18 16V7"/>',
  inventario: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  compras: '<path d="M3 4h2.5l2.2 11.2a1.5 1.5 0 0 0 1.5 1.3h8.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6.2"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  servicios: '<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/>',
  usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2c3 .1 5.5 2 5.5 5.3"/>',
  tutorial: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 17h.01"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

// Cada tipo de usuario ve solo su parte del sistema. Los médicos no ven finanzas; el laboratorio y rayos X solo sus órdenes.
const ROLES = {
  recepcion: { name: 'Recepción', nav: [['agenda', 'Agenda'], ['pacientes', 'Pacientes'], null, ['tutorial', 'Tutorial']] },
  admin: { name: 'Administrador · control maestro', nav: [
    ['inicio', 'Inicio'], ['agenda', 'Agenda'], ['quirofano', 'Quirófano'], ['hospitalizacion', 'Hospitalización'], ['emergencias', 'Emergencias'], ['pacientes', 'Pacientes'], ['historias', 'Historias'], ['examenes', 'Exámenes'], ['atencion', 'Presupuestos'], ['contabilidad', 'Contabilidad'],
    null, ['inventario', 'Inventario'], ['servicios', 'Servicios'], null, ['usuarios', 'Usuarios'], ['ajustes', 'Ajustes'], null, ['tutorial', 'Tutorial']] },
  medico: { name: 'Médico', nav: [['consultorio', 'Mi consulta'], ['agenda', 'Agenda'], ['quirofano', 'Quirófano'], ['hospitalizacion', 'Hospitalización'], ['emergencias', 'Emergencias'], ['pacientes', 'Pacientes'], ['examenes', 'Exámenes'], ['historias', 'Historias'], null, ['tutorial', 'Tutorial']] },
  residente: { name: 'Médico residente', nav: [['hospitalizacion', 'Hospitalización'], ['emergencias', 'Emergencias'], ['pacientes', 'Pacientes'], ['examenes', 'Exámenes'], ['historias', 'Historias'], null, ['tutorial', 'Tutorial']] },
  almacen: { name: 'Almacén', nav: [['inventario', 'Inventario'], ['quirofano', 'Quirófano'], ['hospitalizacion', 'Hospitalización'], ['emergencias', 'Emergencias'], null, ['tutorial', 'Tutorial']] },
  enfermeria: { name: 'Enfermería', nav: [['hospitalizacion', 'Hospitalización'], ['emergencias', 'Emergencias'], ['quirofano', 'Quirófano'], null, ['tutorial', 'Tutorial']] },
  laboratorio: { name: 'Laboratorio', nav: [['examenes', 'Laboratorio'], ['pacientes', 'Pacientes'], null, ['tutorial', 'Tutorial']] },
  imagen: { name: 'Rayos X e imagen', nav: [['examenes', 'Rayos X e imagen'], null, ['tutorial', 'Tutorial']] },
};
const role = () => S.session?.role || 'admin';
const isClin = () => ['medico', 'residente'].includes(role());   // médicos tratantes y residentes
const myDoc = () => isClin() ? S.session.doc : null;
const NAV_FOR = () => ROLES[role()].nav;
const canSee = r => NAV_FOR().some(n => n && n[0] === r) || (role() === 'admin' && r === 'consultorio');
// Qué puede HACER cada rol dentro de las secciones que ve (el menú decide qué secciones ve).
//  agenda.programar: citas y cirugías · agenda.propia: solo la agenda a su nombre
//  hosp.clinico: evoluciones, exámenes y diagnóstico del ingreso · hosp.ingresar · hosp.solicitar: pedir medicación/material · hosp.aplicar: registrar aplicaciones
//  qx.solicitar · qx.devolver (cirugía realizada: canQxDone, solo el tratante, enfermería o Administración) · pac.clinico: antecedentes, alergias y exámenes · pac.historia: historia clínica · pac.escribir: historias e informes
//  guardia.editar: asignar el médico y la enfermera de guardia
//  pac.papeles: consentimientos y preoperatorios externos · pac.registrar: crear y editar fichas · examen.pedir · inv.gestionar · *: todo (administrador)
const PERMS = {
  admin: ['*'],
  medico: ['agenda.propia', 'agenda.programar', 'qx.solicitar', 'qx.devolver', 'hosp.clinico', 'hosp.ingresar', 'hosp.solicitar', 'hosp.aplicar', 'pac.clinico', 'pac.historia', 'pac.escribir', 'pac.papeles', 'pac.registrar', 'examen.pedir'],
  residente: ['hosp.clinico', 'hosp.ingresar', 'hosp.solicitar', 'hosp.aplicar', 'pac.clinico', 'pac.historia', 'pac.escribir', 'examen.pedir'],
  enfermeria: ['hosp.clinico', 'hosp.solicitar', 'hosp.aplicar', 'qx.solicitar', 'qx.devolver'],
  almacen: ['inv.gestionar', 'guardia.editar'],
  laboratorio: ['pac.clinico', 'pac.registrar', 'examen.pedir'],
  imagen: ['examen.pedir'],
  recepcion: ['agenda.programar', 'pac.registrar', 'pac.papeles'],
};
const can = p => { const l = PERMS[role()] || []; return l.includes('*') || l.includes(p); };
const agendaOwn = () => can('agenda.propia') && !can('*');   // el médico ve solo su agenda

let route = 'inicio', param = null;
const UI = {}; // estado efímero de las vistas (filtros, búsquedas)

function navCount(k) {
  if (k === 'inventario') { const a = alerts(); return pendingMedOrders().length + (role() === 'almacen' ? 0 : a.low.length + a.expired.length + a.soon.length); }
  if (k === 'contabilidad') return S.orders.filter(o => o.status === 'por_aprobar').length + (typeof pendingDues === 'function' ? pendingDues().length : 0) + S.budgets.filter(b => ['enviado', 'aceptado'].includes(b.status)).length;
  const mineOnly = role() === 'medico';   // el médico tratante: solo sus pacientes; residentes y enfermería ven a todos
  if (k === 'quirofano') return S.appts.filter(a => a.kind === 'cirugia' && a.date === dAt(0) && isActive(a) && !a.done && (!mineOnly || a.doc === myDoc() || a.anest === myDoc())).length;
  if ((k === 'hospitalizacion' || k === 'emergencias') && role() === 'enfermeria') return nurseDue((S.admissions || []).filter(a => a.status === 'ingresado' && AREAS[admArea(a)].route === k).map(a => a.id)).length;
  if (k === 'hospitalizacion' || k === 'emergencias') return (S.admissions || []).filter(a => a.status === 'ingresado' && AREAS[admArea(a)].route === k && (!mineOnly || a.doc === myDoc())).length;
  if (k === 'agenda') return S.appts.filter(a => a.date === dAt(0) && ['en_espera'].includes(a.status) && (!myDoc() || a.doc === myDoc())).length;
  if (k === 'atencion') return S.budgets.filter(b => budStatus(b) === 'abierto').length;
  if (k === 'historias') return role() === 'admin' ? S.records.filter(r => r.status === 'pendiente').length : 0;
  if (k === 'examenes') return typeof examBadge === 'function' ? examBadge() : 0;
  if (k === 'consultorio') return S.hc.filter(n => n.doc === myDoc() && n.status === 'borrador').length;
  return 0;
}

function renderSide() {
  const who = S.session?.name || (isClin() ? med(myDoc())?.name : role() === 'admin' ? 'Administrador' : ROLES[role()].name) || 'Usuario';
  document.getElementById('side').innerHTML =
    (window.LOGO ? `<div class="brand"><img class="brandlogo" src="${window.LOGO.url}" alt="Quirón Especialidades Médicas"></div>` : `<div class="brand"><i>Q</i>Quirón</div>`) +
    NAV_FOR().map(n => {
      if (!n) return '<div class="sep" role="presentation"></div>';
      const c = navCount(n[0]);
      return `<button class="nav" data-go="${n[0]}" ${route === n[0] ? 'aria-current="page"' : ''}>${icon(n[0])}<span>${n[1]}</span>${c ? `<span class="count">${c}</span>` : ''}</button>`;
    }).join('') +
    `<div class="foot"><button class="userbtn" data-act="switchUser"><span class="avatar" style="width:30px;height:30px;font-size:12px">${initials(who.replace(/^Dra?\. /, ''))}</span><span style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(who)}</b><span>${typeof roleLabel === 'function' ? roleLabel(role()) : ROLES[role()].name} · mi cuenta</span></span></button>
      ${role() === 'admin' ? `<div style="margin-top:8px">Tasa BCV ${fmt(S.rate, 'VES')}</div>` : ''}</div>`;
}

// ---------- Cambiar de usuario (en el sistema real: usuario y contraseña de cada persona) ----------
// Selector de roles del prototipo (ya no se usa: cada persona entra con su usuario)
ACTIONS.switchUserDemo = () => {
  const opt = (r, doc, title, sub) => { const on = role() === r && (r !== 'medico' || myDoc() === doc);
    return `<button class="row" data-act="setUser" data-r="${r}" data-doc="${doc || ''}"><span class="avatar">${initials(title.replace(/^Dra?\. /, ''))}</span><div class="grow"><div class="t">${esc(title)}</div><div class="s">${esc(sub)}</div></div>${on ? '<span class="pill info">Actual</span>' : ''}</button>`; };
  openSheet('Entrar como', `<p class="small muted" style="margin:0">En el prototipo cambias de usuario aquí para ver lo que ve cada persona. En el sistema real cada uno entra con su usuario y contraseña.</p>
    <div class="list">${opt('admin', null, 'Administrador', 'Control maestro: todo el sistema, incluidas las áreas de laboratorio y rayos X')}${opt('recepcion', null, 'Recepción', 'Solo la agenda: consultar y registrar citas')}</div>
    <h3 class="small muted" style="margin:6px 0 0">Médicos</h3><div class="list">${MEDICOS.filter(m => !m.resident).map(m => opt('medico', m.id, m.name, m.esp + ' · Mi consulta, hospitalización, historias, exámenes')).join('')}</div>
    <h3 class="small muted" style="margin:6px 0 0">Médicos residentes</h3><div class="list">${MEDICOS.filter(m => m.resident).map(m => opt('residente', m.id, m.name, 'Hospitalización: evoluciones, medicación y exámenes')).join('')}</div>
    <h3 class="small muted" style="margin:6px 0 0">Enfermería</h3><div class="list">${opt('enfermeria', null, 'Enfermería', 'Registra las aplicaciones de medicación en hospitalización')}</div>
    <h3 class="small muted" style="margin:6px 0 0">Almacén</h3><div class="list">${opt('almacen', null, 'Almacén', 'Inventario, compras y despacho de medicación a hospitalización')}</div>
    <h3 class="small muted" style="margin:6px 0 0">Exámenes</h3><div class="list">${opt('laboratorio', null, 'Laboratorio', 'Recibe órdenes y sube resultados')}${opt('imagen', null, 'Rayos X e imagen', 'Recibe órdenes y sube estudios e informes')}</div>
    <div class="between"><span class="small muted">Apariencia</span>${themeSeg('setTheme')}</div>`);
};
ACTIONS.setUser = el => {
  S.session = { role: el.dataset.r, doc: el.dataset.doc || null }; save(); closeSheet();
  const first = NAV_FOR().find(Boolean)[0]; go(first, null, { root: true });
  toast(`Entraste como ${el.dataset.doc ? med(el.dataset.doc).name : ROLES[el.dataset.r].name}`);
};

// Contadores: al abrir una pantalla, cada cifra grande sube desde 0 hasta su valor (~0,8 s, frenando al final).
// Respeta el formato ($1.250,00 · Bs 866,56 · 12) y al terminar deja el texto original exacto.
function countUp(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const re = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/;
  root.querySelectorAll('.kpi .val').forEach(el => {
    const tn = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.nodeValue)); if (!tn) return;
    const orig = tn.nodeValue; if (/\d\s*[–-]\s*\d/.test(orig)) return; // rangos como 2019–2026 no se animan
    const m = orig.match(re); if (!m) return;
    const [intPart, frac = ''] = m[0].split(','); const target = parseFloat(intPart.replace(/\./g, '') + (frac ? '.' + frac : ''));
    if (!(target > 0)) return;
    const dec = frac.length, before = orig.slice(0, m.index), after = orig.slice(m.index + m[0].length);
    const show = v => before + v.toLocaleString('es-VE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + after;
    const t0 = performance.now(), dur = 800;
    tn.nodeValue = show(0);
    const step = t => {
      if (!tn.isConnected) return;
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      if (k < 1) { tn.nodeValue = show(dec ? target * e : Math.round(target * e)); requestAnimationFrame(step); } else tn.nodeValue = orig;
    };
    requestAnimationFrame(step);
  });
}

// Animación de entrada solo al cambiar de pantalla o de pestaña, nunca al escribir en un campo
let lastView = '', animNext = false;
function render() {
  if (!S.session?.uid) return;   // sin sesión iniciada solo se muestra la pantalla de acceso
  document.body.classList.toggle('no-agenda-write', !can('agenda.programar'));
  if (!canSee(route)) { route = NAV_FOR().find(Boolean)[0]; param = null; }
  renderSide();
  const v = VIEWS[route] || VIEWS.inicio; const main = document.getElementById('main');
  main.innerHTML = v(param);
  const key = route + '|' + (param || '');
  if (key !== lastView || animNext) { main.classList.remove('enter', 'enter-soft'); void main.offsetWidth; main.classList.add(key !== lastView ? 'enter' : 'enter-soft'); if (key !== lastView) countUp(main); }
  lastView = key; animNext = false;
  if (VIEWS[route + '_after']) VIEWS[route + '_after'](param);
}

// Historial de pantallas: "‹ Volver" regresa a donde estabas (p. ej. Hospitalización → perfil del paciente → Hospitalización).
// El menú lateral empieza un recorrido nuevo.
const NAV_HIST = [];
function go(r, p = null, { root = false } = {}) {
  if (root) NAV_HIST.length = 0;
  else if (r !== route || p !== param) { NAV_HIST.push({ route, param, y: window.scrollY }); if (NAV_HIST.length > 30) NAV_HIST.shift(); }
  route = r; param = p;
  try { history.replaceState(null, '', '#' + r); } catch (e) {}
  render();
  window.scrollTo(0, 0);
}
// Nombre de una pantalla para el botón de volver
function placeName(h) {
  const nav = Object.values(ROLES).flatMap(x => x.nav).find(n => n && n[0] === h.route); const base = nav ? nav[1] : h.route;
  if (!h.param) return base;
  if (h.route === 'pacientes') return pat(h.param)?.name || base;
  if (h.route === 'hospitalizacion' || h.route === 'emergencias') { const a = byId(S.admissions || [], h.param); return a ? `${base} · ${pat(a.pid)?.name || ''}` : base; }
  return base;
}
// Botón "‹ Volver": a la pantalla anterior si la hay; si no, a la lista por defecto
window.backBtn = (defRoute) => {
  const prev = NAV_HIST.at(-1);
  const label = prev ? placeName(prev) : placeName({ route: defRoute });
  return `<button class="btn ghost" data-act="goBack" data-def="${defRoute}" style="margin:-8px 0 8px -8px">‹ ${esc(label)}</button>`;
};
ACTIONS.goBack = el => {
  const prev = NAV_HIST.pop(); closeSheet();
  if (!prev) { go(el.dataset.def, null, { root: true }); return; }
  route = prev.route; param = prev.param;
  try { history.replaceState(null, '', '#' + route); } catch (e) {}
  render(); window.scrollTo(0, prev.y || 0);
};

// ---------- Ventanas (sheets) ----------
let sheetAfter = null;
let closeT = null;
function openSheet(title, body, footer = '', { wide = false, after = null } = {}) {
  const layer = document.getElementById('layer'); clearTimeout(closeT);
  const swap = !!layer.querySelector('.scrim'); // una ventana reemplaza a otra: sin volver a subir desde abajo
  layer.innerHTML = `<div class="scrim ${swap ? 'swap' : ''}" data-act="scrim"><div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="grabber" aria-hidden="true"></div><header><h2>${esc(title)}</h2><button class="btn ghost" data-act="close">Cerrar</button></header>
    <div class="body" id="sheetBody">${body}</div>
    ${footer ? `<footer id="sheetFoot">${footer}</footer>` : ''}
  </div></div>`;
  sheetAfter = after;
  if (after) after();
  const f = layer.querySelector('.body input, .body select, .body textarea');
  if (f) f.focus();
}
function closeSheet() {
  const layer = document.getElementById('layer'); const s = layer.querySelector('.scrim'); sheetAfter = null;
  if (!s) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { layer.innerHTML = ''; return; }
  s.classList.add('closing'); clearTimeout(closeT);
  closeT = setTimeout(() => { if (s.isConnected) layer.innerHTML = ''; }, 260);
}
function refreshSheet(body, footer) {
  const b = document.getElementById('sheetBody'); if (b && body != null) b.innerHTML = body;
  const f = document.getElementById('sheetFoot'); if (f && footer != null) f.innerHTML = footer;
}

let toastT;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.remove('out', 'pop'); void t.offsetWidth; t.classList.add('pop'); clearTimeout(toastT);
  toastT = setTimeout(() => { t.classList.add('out'); toastT = setTimeout(() => t.remove(), 220); }, 2600);
}

async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (e) {
    openSheet('Copiar manualmente', `<p class="small muted">Tu navegador no permitió copiar. Selecciona el texto y cópialo.</p><textarea class="input mono" id="copyBox" rows="12">${esc(text)}</textarea>`);
    const b = document.getElementById('copyBox'); b.focus(); b.select();
  }
}

// ---------- Delegación ----------
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); closeSheet(); go(g.dataset.go, g.dataset.param || null, { root: !!g.closest('#side') }); return; }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const name = a.dataset.act;
  // Una misma operación no se ejecuta dos veces por doble clic
  if (/Save$|^save|Dispatch$|^budSend$|^budAccept$|^convertBudget$|^emitFiscal$|^restoreDo$|^consentCreate$|^bqSave$|^moSave$/.test(name)) { const t = Date.now(); if (a._busy && t - a._busy < 1500) return; a._busy = t; }
  if (name === 'scrim') { if (e.target === a) closeSheet(); return; }
  if (a.closest('.seg') && a.closest('#main')) animNext = true;
  if (name === 'close') { closeSheet(); return; }
  if (ACTIONS[name]) { e.preventDefault(); ACTIONS[name](a, e); }
});
document.addEventListener('input', e => {
  const a = e.target.closest('[data-in]');
  if (a && ACTIONS[a.dataset.in]) ACTIONS[a.dataset.in](a, e);
});
document.addEventListener('change', e => {
  const a = e.target.closest('[data-ch]');
  if (a && ACTIONS[a.dataset.ch]) ACTIONS[a.dataset.ch](a, e);
});
['focusin', 'focusout'].forEach(t => document.addEventListener(t, e => {
  const a = e.target.closest?.('[data-fo]');
  if (a && ACTIONS[a.dataset.fo]) ACTIONS[a.dataset.fo](a, e);
}));
// ---------- Buscadores con lista propia ----------
// La lista que despliega el navegador (datalist) aparecía lejos del campo dentro de las ventanas. Cualquier campo con
// lista usa esta: se abre pegada al campo, filtra mientras se escribe (sin importar acentos) y se maneja con flechas y Enter.
const normQ = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
let combo = null;
function comboRender(inp) {
  const dl = document.getElementById(inp.dataset.combo); if (!dl) { comboClose(); return; }
  const q = normQ(inp.value.trim()); const all = [...dl.options].map(o => o.value);
  const items = (q ? all.filter(v => normQ(v).includes(q)) : all).slice(0, 60);
  let box = document.getElementById('combo');
  if (!box) { box = document.createElement('div'); box.id = 'combo'; box.setAttribute('role', 'listbox'); document.body.appendChild(box); }
  combo = { inp, items, idx: -1 };
  if (!items.length || (items.length === 1 && items[0] === inp.value)) { box.hidden = true; return; }
  box.innerHTML = items.map((v, i) => `<div class="combo-opt" role="option" data-i="${i}">${esc(v)}</div>`).join('');
  box.hidden = false; comboPlace();
}
function comboPlace() {
  const box = document.getElementById('combo'); if (!box || box.hidden || !combo) return;
  if (!combo.inp.isConnected) { comboClose(); return; }
  const r = combo.inp.getBoundingClientRect(); const below = innerHeight - r.bottom, above = r.top;
  box.style.left = r.left + 'px'; box.style.width = r.width + 'px';
  if (below < 200 && above > below) { box.style.top = ''; box.style.bottom = (innerHeight - r.top + 4) + 'px'; box.style.maxHeight = Math.min(300, above - 16) + 'px'; }
  else { box.style.bottom = ''; box.style.top = (r.bottom + 4) + 'px'; box.style.maxHeight = Math.min(300, Math.max(140, below - 16)) + 'px'; }
}
function comboClose() { const box = document.getElementById('combo'); if (box) box.hidden = true; combo = null; }
function comboPick(i) { const c = combo; if (!c) return; c.inp.value = c.items[i]; comboClose();
  c.inp.dispatchEvent(new Event('input', { bubbles: true })); c.inp.dispatchEvent(new Event('change', { bubbles: true })); }
document.addEventListener('focusin', e => { const t = e.target;
  if (t.matches?.('input[list]')) { t.dataset.combo = t.getAttribute('list'); t.removeAttribute('list'); }   // apaga la lista del navegador
});
// La lista se abre solo cuando la persona escribe o hace clic en el campo, no cuando el cursor llega solo al abrir una ventana
document.addEventListener('click', e => { const t = e.target; if (t.matches?.('input[list]')) { t.dataset.combo = t.getAttribute('list'); t.removeAttribute('list'); }
  if (t.matches?.('input[data-combo]')) comboRender(t); });
document.addEventListener('input', e => { if (e.target.matches?.('input[data-combo]') && document.activeElement === e.target) comboRender(e.target); });
document.addEventListener('focusout', e => { if (combo && e.target === combo.inp) setTimeout(() => { if (combo && document.activeElement !== combo.inp) comboClose(); }, 120); });
document.addEventListener('mousedown', e => { const o = e.target.closest?.('.combo-opt'); if (o) { e.preventDefault(); comboPick(+o.dataset.i); } });
document.addEventListener('keydown', e => {
  const box = document.getElementById('combo'); if (!combo || e.target !== combo.inp || !box || box.hidden) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); combo.idx = (combo.idx + (e.key === 'ArrowDown' ? 1 : -1) + combo.items.length) % combo.items.length;
    [...box.children].forEach((c, i) => c.classList.toggle('on', i === combo.idx)); box.children[combo.idx]?.scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'Enter' && combo.idx >= 0) { e.preventDefault(); e.stopPropagation(); comboPick(combo.idx); }
  else if (e.key === 'Escape') { e.stopPropagation(); comboClose(); }
}, true);
addEventListener('scroll', comboPlace, true); addEventListener('resize', comboPlace);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.scrim')) closeSheet(); });

// Atajos compartidos
const val = id => document.getElementById(id)?.value ?? '';
const num = id => parseFloat(String(val(id)).replace(',', '.')) || 0;
const kpi = (lab, v, sub = '', cls = '') => `<div class="card kpi ${cls}"><div class="lab">${lab}</div><div class="val">${v}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
const header = (title, sub, actions = '') => `<div class="head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="actions">${actions}</div></div>`;
const exampleTag = '<span class="example"><span class="dot"></span>Datos de ejemplo</span>';

// Capacidades de la página (IA, descargas, archivos): null si esta vista no las tiene
const capCache = {};
function getCap(name) {
  if (!capCache[name]) capCache[name] = (window.claude?.use ? window.claude.use(name) : Promise.resolve(null)).catch(() => null);
  return capCache[name];
}

// Modo día / noche, recordado en este navegador
const THEME_KEY = 'quiron-theme';
function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; } }
function applyTheme(t) { if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
const THEMES = [['light', 'Día'], ['dark', 'Noche'], ['verde', 'Esmeralda']];   // Esmeralda: negro con verde, como el diseño de referencia
function setTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} applyTheme(t);
  document.querySelectorAll('[data-act="setTheme"],[data-act="authTheme"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === t))); toast(`Tema ${(THEMES.find(x => x[0] === t) || ['', 'del dispositivo'])[1]} activado`); }
const themeSeg = (act = 'setTheme') => `<div class="seg" role="group" aria-label="Apariencia">${THEMES.map(([k, t]) => `<button data-act="${act}" data-k="${k}" aria-pressed="${getTheme() === k}">${t}</button>`).join('')}</div>`;
applyTheme(getTheme());

(function start() {
  const h = (location.hash || '').slice(1);
  if (h && VIEWS[h]) route = h;
  if (authBoot()) render();   // sin sesión válida: pantalla de acceso
})();
// En pantallas angostas el menú es una barra inferior que se desplaza de lado: con la rueda del ratón también
// se puede llegar al final (Tutorial y el perfil), no solo deslizando con el dedo.
document.getElementById('side').addEventListener('wheel', e => {
  const s = e.currentTarget;
  if (!matchMedia('(max-width:820px)').matches || Math.abs(e.deltaX) > Math.abs(e.deltaY) || s.scrollWidth <= s.clientWidth) return;
  s.scrollLeft += e.deltaY; e.preventDefault();
}, { passive: false });
