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
  consultas: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',
  consultorio: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',
  examenes: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7 15h10"/>',
  contabilidad: '<path d="M3 20h18"/><path d="M6 16V9M10 16V5M14 16v-5M18 16V7"/>',
  inventario: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  compras: '<path d="M3 4h2.5l2.2 11.2a1.5 1.5 0 0 0 1.5 1.3h8.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6.2"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  servicios: '<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/>',
  usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2c3 .1 5.5 2 5.5 5.3"/>',
  tutorial: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 17h.01"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
  leaf: '<path d="M20 3C8 2 3 8 5 15s15 8 15-12ZM4 21 15 10"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

// Cada tipo de usuario ve solo su parte del sistema. Los médicos no ven finanzas; el laboratorio y rayos X solo sus órdenes.
const ROLES = {
  recepcion: { name: 'Recepción', nav: [['agenda', 'Agenda'], ['consultas', 'Consultas'], ['pacientes', 'Pacientes'], null, ['tutorial', 'Tutorial']] },
  admin: { name: 'Administrador · control maestro', nav: [
    ['inicio', 'Inicio'], ['agenda', 'Agenda'], ['consultas', 'Consultas'], ['quirofano', 'Quirófano'], ['hospitalizacion', 'Hospitalización'], ['emergencias', 'Emergencias'], ['pacientes', 'Pacientes'], ['historias', 'Historias'], ['examenes', 'Exámenes'], ['atencion', 'Presupuestos'], ['contabilidad', 'Contabilidad'],
    null, ['inventario', 'Inventario'], ['servicios', 'Servicios'], null, ['usuarios', 'Usuarios'], ['ajustes', 'Ajustes'], null, ['tutorial', 'Tutorial']] },
  medico: { name: 'Médico', nav: [['consultas', 'Consultas'], ['consultorio', 'Mi consulta'], ['agenda', 'Agenda'], ['quirofano', 'Quirófano'], ['hospitalizacion', 'Hospitalización'], ['emergencias', 'Emergencias'], ['pacientes', 'Pacientes'], ['examenes', 'Exámenes'], ['historias', 'Historias'], null, ['tutorial', 'Tutorial']] },
  residente: { name: 'Médico residente', nav: [['consultas', 'Consultas'], ['hospitalizacion', 'Hospitalización'], ['emergencias', 'Emergencias'], ['pacientes', 'Pacientes'], ['examenes', 'Exámenes'], ['historias', 'Historias'], null, ['tutorial', 'Tutorial']] },
  almacen: { name: 'Almacén', nav: [['inventario', 'Inventario'], ['quirofano', 'Quirófano'], ['hospitalizacion', 'Hospitalización'], ['emergencias', 'Emergencias'], null, ['tutorial', 'Tutorial']] },
  enfermeria: { name: 'Enfermería', nav: [['hospitalizacion', 'Hospitalización'], ['emergencias', 'Emergencias'], ['quirofano', 'Quirófano'], ['pacientes', 'Pacientes'], null, ['tutorial', 'Tutorial']] },
  laboratorio: { name: 'Laboratorio', nav: [['examenes', 'Laboratorio'], ['pacientes', 'Pacientes'], null, ['tutorial', 'Tutorial']] },
  imagen: { name: 'Rayos X e imagen', nav: [['examenes', 'Rayos X e imagen'], ['pacientes', 'Pacientes'], null, ['tutorial', 'Tutorial']] },
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
  medico: ['consulta.estado', 'consulta.clinico', 'consulta.crear', 'consulta.registrar', 'consulta.agendar', 'agenda.propia', 'agenda.programar', 'qx.solicitar', 'qx.devolver', 'hosp.clinico', 'hosp.ingresar', 'hosp.solicitar', 'hosp.aplicar', 'pac.clinico', 'pac.historia', 'pac.escribir', 'pac.papeles', 'pac.registrar', 'examen.pedir', 'imagen.subir'],
  residente: ['consulta.estado', 'consulta.clinico', 'consulta.crear', 'consulta.registrar', 'consulta.agendar', 'consulta.ver_todas', 'hosp.clinico', 'hosp.ingresar', 'hosp.solicitar', 'hosp.aplicar', 'pac.clinico', 'pac.historia', 'pac.escribir', 'examen.pedir', 'imagen.subir'],
  enfermeria: ['hosp.clinico', 'hosp.solicitar', 'hosp.aplicar', 'qx.solicitar', 'qx.devolver'],
  almacen: ['inv.gestionar', 'guardia.editar'],
  laboratorio: ['pac.clinico', 'pac.registrar', 'examen.pedir'],
  imagen: ['examen.pedir', 'imagen.subir'],
  recepcion: ['consulta.estado', 'agenda.programar', 'pac.registrar', 'pac.papeles'],
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
    NAV_FOR().map((n, i, all) => {
      if (!n) return '<div class="sep" role="presentation"></div>';
      const index = all.slice(0, i).filter(Boolean).length;
      return shellNav(n, index >= 5 ? 'nav-extra' + (index < 7 ? ' nav-tablet' : '') : '');
    }).join('') +
    '<button class="nav nav-more" id="more-sections-button" data-act="moreSections" aria-label="Más secciones" title="Más secciones" aria-haspopup="dialog" aria-expanded="false" aria-controls="more-sections">' + icon('menu') + '</button>' +
    `<div class="foot"><button class="userbtn" data-act="switchUser"><span class="avatar" style="width:30px;height:30px;font-size:12px">${initials(who.replace(/^Dra?\. /, ''))}</span><span style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(who)}</b><span>${typeof roleLabel === 'function' ? roleLabel(role()) : ROLES[role()].name} · mi cuenta</span></span></button>
      ${role() === 'admin' ? `<div style="margin-top:8px">Tasa BCV ${fmt(S.rate, 'VES')}</div>` : ''}</div>`;
}


// Estructura común: los destinos y contadores siguen procediendo del menú del rol.
function shellNav(n, cls = '') {
  const count = navCount(n[0]);
  return `<button class="nav ${cls}" data-go="${n[0]}" aria-label="${esc(n[1])}" title="${esc(n[1])}" ${route === n[0] ? 'aria-current="page"' : ''}>${icon(n[0])}<span class="nav-label">${esc(n[1])}</span>${count ? `<span class="count">${count}</span>` : ''}</button>`;
}
function renderTopbar() {
  const bar = document.getElementById('global-topbar');
  const who = S.session?.name || ROLES[role()].name;
  bar.innerHTML = `<button class="global-search-button" id="global-search-button" data-act="globalSearch" aria-label="Buscar paciente" title="Buscar paciente Ctrl K" aria-keyshortcuts="Control+k Meta+k /">${icon('buscar')}<span>Buscar paciente</span><kbd>Ctrl K</kbd></button><button class="shell-icon-button" id="theme-button" data-act="rotateTheme"></button><button class="shell-icon-button shell-avatar" data-act="switchUser" aria-label="Mi cuenta: ${esc(who)}" title="Mi cuenta">${esc(initials(who.replace(/^Dra?\. /, '')))}</button>`;
  updateThemeButton();
}
function updateThemeButton() {
  const button = document.getElementById('theme-button'); if (!button) return;
  const index = Math.max(0, THEMES.findIndex(([key]) => key === getTheme()));
  button.innerHTML = icon(['sun', 'moon', 'leaf'][index]);
  button.setAttribute('aria-label', 'Tema: ' + THEMES[index][1] + ' (cambiar)');
  button.title = 'Tema: ' + THEMES[index][1] + ' · Cambiar a ' + THEMES[(index + 1) % 3][1];
}
ACTIONS.rotateTheme = () => setTheme(THEMES[(Math.max(0, THEMES.findIndex(([key]) => key === getTheme())) + 1) % 3][0]);
const mobileSectionCount = () => matchMedia('(min-width:600px)').matches ? 7 : 5;
function closeShellDialogs() {
  document.querySelectorAll('.shell-dialog[open]').forEach(dialog => dialog.close());
}
ACTIONS.moreSections = () => {
  if (!S.session?.uid) return;
  const dialog = document.getElementById('more-sections');
  const remaining = NAV_FOR().filter(Boolean).slice(mobileSectionCount());
  dialog.innerHTML = `<div class="shell-panel"><header><h2 id="more-sections-title">Más secciones</h2><button class="btn" data-act="closeShellDialog">Cerrar</button></header>${remaining.map(n => shellNav(n)).join('') || '<p class="muted">Todas las secciones están en la barra inferior.</p>'}</div>`;
  dialog.showModal();
  document.getElementById('more-sections-button').setAttribute('aria-expanded', 'true');
  dialog.querySelector('.nav, button').focus();
};
ACTIONS.closeShellDialog = el => el.closest('dialog').close();
function globalPatientResults(query) {
  if (!canSee('pacientes')) return '<p class="muted">Tu rol no tiene acceso a la sección Pacientes.</p>';
  const q = normQ(query.trim()), digits = normDigits(q);
  const patients = S.patients.filter(p => !q || normQ(p.name).includes(q) || normQ(p.code).includes(q) || (digits.length > 2 && !q.startsWith('qrn') && normDigits(p.ci).includes(digits))).slice(0, 30);
  return patients.map(p => `<button class="row" data-act="globalPatientPick" data-id="${esc(p.id)}"><span class="avatar">${esc(initials(p.name))}</span><span class="grow"><span class="t" style="display:block">${esc(p.name)}</span><span class="s" style="display:block">${esc(p.ci)} · ${esc(p.code || '')}</span></span></button>`).join('') || '<p class="empty">No se encontraron pacientes.</p>';
}
ACTIONS.globalSearch = () => {
  if (!S.session?.uid) return;
  closeShellDialogs();
  const dialog = document.getElementById('global-search');
  dialog.innerHTML = `<div class="shell-panel"><header><h2 id="global-search-title">Buscar paciente</h2><button class="btn" data-act="closeShellDialog">Cerrar</button></header><label class="small muted" for="global-patient-query">Nombre, cédula o código QRN</label><input class="input" id="global-patient-query" data-in="globalPatientSearch" autocomplete="off" placeholder="Nombre, cédula o QRN" aria-controls="global-patient-results"><div id="global-patient-results" class="list" aria-live="polite">${globalPatientResults('')}</div></div>`;
  dialog.showModal(); dialog.querySelector('input').focus();
};
ACTIONS.globalPatientSearch = el => { document.getElementById('global-patient-results').innerHTML = globalPatientResults(el.value); };
ACTIONS.globalPatientPick = el => { if (!canSee('pacientes')) return; closeShellDialogs(); go('pacientes', el.dataset.id); };
// Los diálogos nativos aíslan el fondo; el ciclo de Tab también es explícito.
document.querySelectorAll('.shell-dialog').forEach(dialog => {
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('cancel', e => { e.preventDefault(); dialog.close(); });
  dialog.addEventListener('close', () => {
    const trigger = document.getElementById(dialog.id === 'more-sections' ? 'more-sections-button' : 'global-search-button');
    if (dialog.id === 'more-sections') trigger?.setAttribute('aria-expanded', 'false');
    if (!document.querySelector('.shell-dialog[open]') && trigger?.getClientRects().length) trigger.focus();
  });
  dialog.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dialog.close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = items[0], last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
});
addEventListener('resize', () => {
  const dialog = document.getElementById('more-sections'); if (!dialog.open) return;
  if (matchMedia('(min-width:1024px)').matches) { dialog.close(); return; }
  const focusedRoute = document.activeElement?.dataset.go;
  const panel = dialog.querySelector('.shell-panel');
  panel.querySelectorAll('.nav, p').forEach(el => el.remove());
  panel.insertAdjacentHTML('beforeend', NAV_FOR().filter(Boolean).slice(mobileSectionCount()).map(n => shellNav(n)).join('') || '<p class="muted">Todas las secciones están en la barra inferior.</p>');
  ([...panel.querySelectorAll('[data-go]')].find(el => el.dataset.go === focusedRoute) || panel.querySelector('button')).focus();
});
document.addEventListener('keydown', e => {
  if (!S.session?.uid || document.querySelector('.app').hidden || e.defaultPrevented || e.isComposing) return;
  const editing = e.target.closest?.('input,textarea,select,[contenteditable="true"]');
  if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !editing && !e.ctrlKey && !e.metaKey && !e.altKey)) {
    // No reemplazar formularios abiertos ni perder los datos que contienen.
    if (document.querySelector('#layer .scrim, .shell-dialog[open]')) return;
    e.preventDefault(); ACTIONS.globalSearch();
  }
});

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
    // Los conteos enteros deben verse inmediatamente, incluso si se suspenden los cuadros de animación.
    if (!(target > 0) || /^\s*\d+\s*$/.test(orig)) return;
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
let lastView = '', animNext = false; const SEEN_VIEWS = new Set();
function render() {
  if (!S.session?.uid) return;   // sin sesión iniciada solo se muestra la pantalla de acceso
  document.body.classList.toggle('no-agenda-write', !can('agenda.programar'));
  if (!canSee(route)) { route = NAV_FOR().find(Boolean)[0]; param = null; }
  renderSide();
  renderTopbar();
  const v = VIEWS[route] || VIEWS.inicio; const main = document.getElementById('main');
  main.innerHTML = v(param);
  presentContent(main);
  const key = route + '|' + (param || '');
  if (key !== lastView || animNext) {
    // La entrada escalonada solo la primera vez que se abre cada pantalla en la sesión; después, un fundido breve
    const first = key !== lastView && !SEEN_VIEWS.has(route);
    main.classList.remove('enter', 'enter-soft', 'enter-quick'); void main.offsetWidth;
    main.classList.add(first ? 'enter' : key !== lastView ? 'enter-quick' : 'enter-soft');
    if (first) countUp(main);
    SEEN_VIEWS.add(route);
  }
  lastView = key; animNext = false;
  if (VIEWS[route + '_after']) VIEWS[route + '_after'](param);
}

// Historial de pantallas: "‹ Volver" regresa a donde estabas (p. ej. Hospitalización → perfil del paciente → Hospitalización).
// El menú lateral empieza un recorrido nuevo.
const NAV_HIST = [];
function go(r, p = null, { root = false } = {}) {
  if (typeof consultSaveTimer !== 'undefined' && consultSaveTimer) consultFlush();
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
  if (typeof consultSaveTimer !== 'undefined' && consultSaveTimer) consultFlush();
  const prev = NAV_HIST.pop(); closeSheet();
  if (!prev) { go(el.dataset.def, null, { root: true }); return; }
  route = prev.route; param = prev.param;
  try { history.replaceState(null, '', '#' + route); } catch (e) {}
  render(); window.scrollTo(0, prev.y || 0);
};

// Presentación compartida: no modifica datos clínicos ni autorizaciones.
function patientBand(pid, bed = '') {
  const p = pat(pid); if (!p) return '';
  if (bed === 'Quirófano') bed = 'Q-01';   // la miniatura muestra el código del quirófano, no la palabra
  return `<div class="patient-band" data-pid="${esc(p.id)}" data-bed="${esc(bed)}"><span class="patient-bed">${esc(bed || initials(p.name))}</span><div class="grow"><b>${esc(p.name)}</b><div class="small muted">${esc(p.ci)} · ${ageTxt(p)}${bed ? ' · ' + (/^Q-/.test(bed) ? 'Quirófano ' + esc(bed) : 'Cama ' + esc(bed)) : ''}</div></div>${can('pac.clinico') || can('hosp.clinico') ? `<span class="small allergy">${esc(CONSULT.allergyText(p.history))}</span>${allergyQuickButton(p.id)}` : ''}</div>`;
}
const sheetStep = (n, title) => `<h3 class="sheet-step"><span>${n}</span>${title}</h3>`;
function presentContent(root) {
  if (root.id === 'sheetBody' || root.id === 'layer') root.querySelectorAll('b').forEach(el => {
    const m = !el.children.length && el.textContent.match(/^(\d+)\.\s+(.+)$/);
    if (m) { el.classList.add('sheet-step'); el.innerHTML = '<span>' + m[1] + '</span>' + esc(m[2]); }
  });
  root.querySelectorAll('[data-act], [data-go]').forEach(el => {
    if (el.matches('button, a, input, select, textarea, option, .scrim') || el.closest('svg')) return;
    el.tabIndex = 0; if (el.tagName !== 'TR') el.setAttribute('role', 'button');
  });
  root.querySelectorAll('table:not(.ptable)').forEach(table => {
    if (table.closest('.paper')) return;
    table.classList.add('responsive-table');
    const heads = [...(table.tHead?.rows[table.tHead.rows.length - 1]?.cells || [])].map(c => c.textContent.trim());
    for (const body of table.tBodies) for (const row of body.rows) {
      let col = 0;
      for (const cell of row.cells) {
        if (cell.colSpan === 1 && heads[col]) cell.dataset.label = heads[col];
        col += cell.colSpan;
      }
    }
  });
}
document.addEventListener('keydown', e => {
  if (e.defaultPrevented || !['Enter', ' '].includes(e.key)) return;
  const el = e.target;
  if (!el.matches('[tabindex="0"][data-act], [tabindex="0"][data-go]') || el.matches('button, a, input, select, textarea') || el.closest('svg')) return;
  e.preventDefault(); el.click();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || e.defaultPrevented) return;
  const sheet = document.querySelector('.scrim:not(.closing) .sheet'); if (!sheet) return;
  const controls = [...sheet.querySelectorAll('button, input, select, textarea, a[href], summary, [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
  const first = controls[0], last = controls.at(-1); if (!first) return;
  if (e.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
});
document.addEventListener('toggle', e => { if (e.target.id === 'today-past') UI.todayPastOpen = e.target.open; }, true);
// Actualiza solo la pulsera al elegir otro paciente; conserva los valores del formulario.
document.addEventListener('change', e => {
  if (e.target.id === 'ad-b') { const band = document.getElementById('adm-patient-band'); if (band) band.innerHTML = patientBand(UI.pp?.adm?.pid, e.target.value); return; }
  if (e.target.id !== 'ap-p') return;
  const band = document.getElementById('appt-patient-band'); if (band) band.innerHTML = patientBand(e.target.value);
});

// ---------- Ventanas (sheets) ----------
let sheetAfter = null;
let sheetReturnFocus = null;
let closeT = null;
function openSheet(title, body, footer = '', { wide = false, after = null } = {}) {
  const layer = document.getElementById('layer'); clearTimeout(closeT);
  const swap = !!layer.querySelector('.scrim');
  if (!swap) sheetReturnFocus = document.activeElement; // una ventana reemplaza a otra: sin volver a subir desde abajo
  layer.innerHTML = `<div class="scrim ${swap ? 'swap' : ''}" data-act="scrim"><div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="grabber" aria-hidden="true"></div><header><h2>${esc(title)}</h2><button class="btn ghost" data-act="close">Cerrar</button></header>
    <div class="body" id="sheetBody">${body}</div>
    ${footer ? `<footer id="sheetFoot">${footer}</footer>` : ''}
  </div></div>`;
  presentContent(layer);
  sheetAfter = after;
  if (after) after();
  const f = layer.querySelector('.body input, .body select, .body textarea');
  if (f) f.focus();
  else layer.querySelector('.sheet button')?.focus();
}
function closeSheet({ dragged = false } = {}) {
  const layer = document.getElementById('layer');
  if (UI.allergyQuick || UI.allergyOrigin) {
    clearTimeout(closeT);
    const origin = UI.allergyOrigin;
    UI.allergyOrigin = null;
    UI.allergyQuick = null;
    render();
    layer.replaceChildren(...(origin || []));
    layer.querySelectorAll('.patient-band[data-pid]').forEach(band => {
      band.outerHTML = patientBand(band.dataset.pid, band.dataset.bed);
    });
    sheetAfter = UI.allergyOriginAfter || null;
    sheetReturnFocus = UI.allergyOriginFocus || sheetReturnFocus;
    UI.allergyOriginAfter = null;
    UI.allergyOriginFocus = null;
    return;
  }
  const s = layer.querySelector('.scrim');
  sheetAfter = null;
  if (!s) return;
  const restoreFocus = () => { if (sheetReturnFocus?.isConnected) sheetReturnFocus.focus({ preventScroll: true }); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { layer.innerHTML = ''; restoreFocus(); return; }
  clearTimeout(closeT);
  if (dragged) {
    // Sale desde donde la soltó el dedo, por el mismo camino por el que entró (hacia abajo)
    const sh = s.querySelector('.sheet'); sh.style.transition = 'transform .22s cubic-bezier(.4,0,1,1)'; sh.style.transform = 'translateY(100%)';
    s.classList.add('closing-drag');
  } else s.classList.add('closing');
  closeT = setTimeout(() => { if (s.isConnected) { layer.innerHTML = ''; restoreFocus(); } }, 240);
}
// Cierre pedido por la persona (fuera de la ventana, "Cerrar", Escape o arrastre): si escribió algo, se pregunta antes
const sheetDirty = () => document.querySelector('#layer .sheet')?.dataset.dirty === '1';
function requestCloseSheet(opts) {
  const sh = document.querySelector('#layer .sheet'); if (!sh) return;
  if (typeof comboClose === 'function') comboClose();
  if (!sheetDirty()) { closeSheet(opts); return; }
  let bar = sh.querySelector('.discard-bar');
  if (!bar) {
    bar = document.createElement('div'); bar.className = 'discard-bar'; bar.setAttribute('role', 'alertdialog'); bar.setAttribute('aria-label', 'Cambios sin guardar');
    bar.innerHTML = '<span>Tiene cambios sin guardar.</span><button class="btn" data-act="keepEditing">Seguir editando</button><button class="btn danger" data-act="discardSheet">Descartar</button>';
    sh.appendChild(bar);
  }
  bar.querySelector('[data-act="keepEditing"]').focus();
}
ACTIONS.keepEditing = el => el.closest('.discard-bar')?.remove();
ACTIONS.discardSheet = () => closeSheet();
// Cualquier dato escrito o elegido en la ventana la marca como "con cambios" (los buscadores no cuentan)
['input', 'change'].forEach(ev => document.addEventListener(ev, e => {
  const t = e.target; if (!e.isTrusted || !t.closest?.('#sheetBody')) return;
  if (t.type === 'search' || /search|buscar|filtr|Q$/i.test(t.dataset?.in || '') || t.closest('[data-nodirty]')) return;
  const sh = t.closest('.sheet'); if (sh) sh.dataset.dirty = '1';
}, true));
// Teléfono: la barrita de arriba se arrastra; la ventana sigue al dedo y se cierra si se suelta lejos o rápido
document.addEventListener('pointerdown', e => {
  const sh = e.target.closest?.('#layer .sheet'); if (!sh || !matchMedia('(max-width:820px)').matches) return;
  if (!e.target.closest('.grabber, .sheet > header') || e.target.closest('button, a, input, select, textarea')) return;
  const y0 = e.clientY, hist = [{ y: y0, t: e.timeStamp }]; let dy = 0;
  try { sh.setPointerCapture(e.pointerId); } catch (err) {}   // sigue al dedo aunque salga de la ventana
  sh.style.transition = 'none';
  const move = ev => {
    dy = ev.clientY - y0; hist.push({ y: ev.clientY, t: ev.timeStamp }); if (hist.length > 6) hist.shift();
    // Hacia arriba resiste (no hay más ventana); hacia abajo sigue al dedo 1:1
    const off = dy >= 0 ? dy : -(Math.abs(dy) * 60) / (60 + Math.abs(dy));
    sh.style.transform = 'translateY(' + off + 'px)';
  };
  const up = () => {
    sh.removeEventListener('pointermove', move); sh.removeEventListener('pointerup', up); sh.removeEventListener('pointercancel', up);
    const a = hist[0], b = hist.at(-1); const v = (b.y - a.y) / Math.max(1, b.t - a.t);   // px por ms
    if (dy > 120 || (v > 0.6 && dy > 20)) {
      if (sheetDirty()) { sh.style.transition = 'transform .35s cubic-bezier(.32,.72,0,1)'; sh.style.transform = ''; requestCloseSheet(); }
      else closeSheet({ dragged: true });
    } else { sh.style.transition = 'transform .35s cubic-bezier(.32,.72,0,1)'; sh.style.transform = ''; }
  };
  sh.addEventListener('pointermove', move); sh.addEventListener('pointerup', up); sh.addEventListener('pointercancel', up);
});
function refreshSheet(body, footer) {
  const b = document.getElementById('sheetBody'); if (b && body != null) b.innerHTML = body;
  const f = document.getElementById('sheetFoot'); if (f && footer != null) f.innerHTML = footer;
  if (b) presentContent(b);
}

let toastT;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  const sh = document.querySelector('#layer .scrim:not(.closing):not(.closing-drag) .sheet');
  if (sh) {
    let m = sh.querySelector('.sheet-msg'); if (!m) { m = document.createElement('div'); m.className = 'sheet-msg'; m.setAttribute('role', 'alert'); (sh.querySelector('footer') || sh.querySelector('.body')).before(m); }
    m.textContent = msg; m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop');
  }
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
  if (g) { e.preventDefault(); closeShellDialogs(); closeSheet(); go(g.dataset.go, g.dataset.param || null, { root: !!g.closest('#side, #more-sections') }); return; }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const name = a.dataset.act;
  // Una misma operación no se ejecuta dos veces por doble clic
  if (/Save$|^save|Dispatch$|^budSend$|^budAccept$|^convertBudget$|^emitFiscal$|^restoreDo$|^consentCreate$|^bqSave$|^moSave$/.test(name)) { const t = Date.now(); if (a._busy && t - a._busy < 1500) return; a._busy = t; }
  if (name === 'scrim') { if (e.target === a) requestCloseSheet(); return; }
  if (a.closest('.seg') && a.closest('#main')) animNext = true;
  if (name === 'close') { requestCloseSheet(); return; }
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
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.scrim')) requestCloseSheet(); });

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
function setTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { const h = document.documentElement; h.classList.add('theme-fade'); clearTimeout(setTheme.t); setTheme.t = setTimeout(() => h.classList.remove('theme-fade'), 400); }
  applyTheme(t); updateThemeButton();
  document.querySelectorAll('[data-act="setTheme"],[data-act="authTheme"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === t))); toast(`Tema ${(THEMES.find(x => x[0] === t) || ['', 'del dispositivo'])[1]} activado`); }
const themeSeg = (act = 'setTheme') => `<div class="seg" role="group" aria-label="Apariencia">${THEMES.map(([k, t]) => `<button data-act="${act}" data-k="${k}" aria-pressed="${getTheme() === k}">${t}</button>`).join('')}</div>`;
applyTheme(getTheme());

(function start() {
  const h = (location.hash || '').slice(1);
  if (h && VIEWS[h]) route = h;
  if (authBoot()) render();   // sin sesión válida: pantalla de acceso
})();
