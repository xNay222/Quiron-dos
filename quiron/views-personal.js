// Personal: datos profesionales de los médicos (colegio, n.º de colegiado y código MPPS) y el registro de
// amonestaciones y destacados de cada persona (médicos, enfermeras y usuarios). Solo Administración.
// S.staffNotes: { id, who: 'doc:<id>' | 'nurse:<id>' | 'user:<id>', kind: 'amonestacion' | 'destacado', motive, title, text, date, by, at, void? }

// Colegios de Médicos de Venezuela (uno por entidad federal)
const COLEGIOS = [['DC', 'Distrito Metropolitano de Caracas'], ['AM', 'Estado Amazonas'], ['AN', 'Estado Anzoátegui'], ['AP', 'Estado Apure'], ['AR', 'Estado Aragua'], ['BA', 'Estado Barinas'],
  ['BO', 'Estado Bolívar'], ['CA', 'Estado Carabobo'], ['CO', 'Estado Cojedes'], ['DA', 'Estado Delta Amacuro'], ['FA', 'Estado Falcón'], ['GU', 'Estado Guárico'], ['LG', 'Estado La Guaira'],
  ['LA', 'Estado Lara'], ['ME', 'Estado Mérida'], ['MI', 'Estado Miranda'], ['MO', 'Estado Monagas'], ['NE', 'Estado Nueva Esparta'], ['PO', 'Estado Portuguesa'], ['SU', 'Estado Sucre'],
  ['TA', 'Estado Táchira'], ['TR', 'Estado Trujillo'], ['YA', 'Estado Yaracuy'], ['ZU', 'Estado Zulia']];
const colegioName = k => { const c = COLEGIOS.find(x => x[0] === k); return c ? 'Colegio de Médicos del ' + c[1] : (k || ''); };
const colegioShort = k => { const c = COLEGIOS.find(x => x[0] === k); return c ? 'CM ' + c[1].replace(/^Estado |^Distrito Metropolitano de /, '') : (k || ''); };
// Campos de datos profesionales (los usan "Mi cuenta" y la ficha del médico en Usuarios)
const credsFields = (pre, c = {}, req = false, locked = false) => { const ro = locked ? 'disabled' : ''; return `<div class="form">
    <div class="field"><label for="${pre}ci">Cédula</label><input class="input" id="${pre}ci" ${ro} value="${esc(c.ci || '')}" placeholder="Ej. V-12.345.678"></div>
    <div class="field"><label for="${pre}cm">N.º de colegiado${req ? ' *' : ''}</label><input class="input" id="${pre}cm" inputmode="numeric" ${ro} value="${esc(c.cm || '')}" placeholder="Ej. 12345"></div>
    <div class="field"><label for="${pre}col">Colegio de Médicos donde está inscrito</label><select class="input" id="${pre}col" ${ro}><option value="">Elija el colegio…</option>${COLEGIOS.map(([k, n]) => `<option value="${k}" ${c.colegio === k ? 'selected' : ''}>Colegio de Médicos del ${n}</option>`).join('')}</select></div>
    <div class="field"><label for="${pre}mpps">Código MPPS</label><input class="input" id="${pre}mpps" inputmode="numeric" ${ro} value="${esc(c.mpps || '')}" placeholder="Ej. 98765"></div></div>`; };
const credsRead = pre => ({ ci: val(pre + 'ci').trim(), cm: val(pre + 'cm').trim().replace(/\s+/g, ' '), colegio: val(pre + 'col'), mpps: val(pre + 'mpps').trim().replace(/\s+/g, ' ') });
// Para firmar hacen falta los cuatro datos: salen en el sello de cada documento
const credsPending = c => [!c?.ci && 'cédula', !c?.cm && 'n.º de colegiado', !c?.colegio && 'Colegio de Médicos', !c?.mpps && 'código MPPS'].filter(Boolean);
const listText = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] : (a[0] || '');
const credsPendingText = c => listText(credsPending(c));
// Aviso fijo arriba de todas las pantallas para el médico o residente al que le faltan datos
const credsAlert = () => { const u = typeof meUser === 'function' ? meUser() : null; if (!u || typeof credsMissing !== 'function' || !credsMissing(u)) return '';
  return `<div class="banner" role="alert" style="background:var(--bad-soft);margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:220px"><b>Le faltan sus datos profesionales:</b> ${esc(credsPendingText(u))}. No puede firmar informes, consultas, evoluciones ni récipes hasta registrarlos.</span><button class="btn sm primary" data-act="switchUser">Completar mis datos</button></div>`; };
// Médico de la cuenta: un médico o residente solo solicita, indica y firma a su nombre; Administración elige a cualquiera
const lockedDoc = () => (typeof isClin === 'function' && isClin()) ? (myDoc() || null) : null;
const docFieldLocked = (id, label) => { const d = med(lockedDoc()); return `<div class="field"><label for="${id}-ro">${label}</label><input class="input" id="${id}-ro" value="${esc(d?.name || '')}${d?.esp ? ' · ' + esc(d.esp) : ''}" disabled><input type="hidden" id="${id}" value="${esc(d?.id || '')}"><span class="small muted">Su cuenta: no se puede cambiar.</span></div>`; };

// ---------- Amonestaciones y destacados ----------
const AMON_MOTIVOS = [
  ['Impuntualidad reiterada', 'Se deja constancia de que se ha presentado a su jornada con retraso en reiteradas ocasiones, lo cual afecta la organización del servicio y la atención oportuna de los pacientes. Se le exhorta a cumplir con el horario establecido.'],
  ['Inasistencia injustificada', 'Se deja constancia de su inasistencia a la jornada asignada sin aviso previo ni justificación, lo que comprometió la cobertura del servicio. Se le recuerda la obligación de notificar con anticipación cualquier impedimento.'],
  ['Incumplimiento de normas o protocolos', 'Se deja constancia del incumplimiento de las normas y protocolos internos de la clínica en el ejercicio de sus funciones. Se le solicita apegarse estrictamente a los procedimientos establecidos para garantizar la seguridad del paciente.'],
  ['Trato inadecuado', 'Se deja constancia de un trato que no corresponde con el respeto y la cordialidad que la clínica exige hacia pacientes, familiares y compañeros de trabajo. Se le exhorta a mantener en todo momento una conducta profesional.'],
  ['Errores u omisiones en registros', 'Se deja constancia de omisiones o errores en los registros clínicos o administrativos a su cargo. La exactitud de estos registros es indispensable para la continuidad de la atención; se le solicita revisarlos con mayor rigor.'],
  ['Otro motivo', ''],
];
const DEST_MOTIVOS = [
  ['Atención excepcional al paciente', 'Se reconoce la calidez, la dedicación y el profesionalismo demostrados en la atención de nuestros pacientes, que reflejan fielmente los valores de la clínica.'],
  ['Compromiso extraordinario', 'Se reconoce su disposición para atender las necesidades del servicio más allá de lo requerido, demostrando un alto sentido de compromiso con el equipo y con la institución.'],
  ['Iniciativa y mejora', 'Se reconoce su iniciativa para proponer y aplicar mejoras que benefician el funcionamiento de la clínica y la atención de los pacientes.'],
  ['Puntualidad y responsabilidad ejemplares', 'Se reconoce su puntualidad y responsabilidad constantes, que constituyen un ejemplo para todo el equipo.'],
  ['Trabajo en equipo', 'Se reconoce su espíritu de colaboración y su apoyo a los compañeros, que fortalecen el trabajo en equipo.'],
  ['Otro motivo', ''],
];
const AMON_LIMIT = 3;
const staffNotes = who => (S.staffNotes || []).filter(n => n.who === who).sort((a, b) => (b.date + b.at).localeCompare(a.date + a.at));
const amonCount = who => staffNotes(who).filter(n => n.kind === 'amonestacion' && !n.void).length;
const destCount = who => staffNotes(who).filter(n => n.kind === 'destacado' && !n.void).length;
const amonPill = who => { const n = amonCount(who); return n ? `<span class="pill bad">${n} amonestaci${n === 1 ? 'ón' : 'ones'}</span>` : ''; };

// Pestañas del perfil: "Datos" y "Amonestaciones y destacados"
const staffTabs = who => `<div class="seg" role="group" aria-label="Perfil" style="margin-bottom:6px"><button data-act="stTab" data-k="datos" aria-pressed="${UI.stTab !== 'notas'}">Datos</button><button data-act="stTab" data-k="notas" aria-pressed="${UI.stTab === 'notas'}">Amonestaciones y destacados${staffNotes(who).filter(n => !n.void).length ? ` (${staffNotes(who).filter(n => !n.void).length})` : ''}</button></div>`;
// Cada perfil registra cómo volver a abrirse (para cambiar de pestaña o volver tras registrar algo)
const staffBack = (act, ds) => { UI.stBack = { act, ds }; };
const staffReopen = tab => { UI.stTab = tab; const b = UI.stBack; if (b) ACTIONS[b.act]({ dataset: { ...b.ds, keep: '1' } }); };
ACTIONS.stTab = el => staffReopen(el.dataset.k);
const staffTabInit = el => { if (el?.dataset?.keep !== '1') UI.stTab = 'datos'; };

function staffNotesTab(who, name) {
  const list = staffNotes(who); const am = amonCount(who), de = destCount(who);
  return `<div class="sn-summary"><span class="pill ${am ? 'bad' : ''}">${am} amonestaci${am === 1 ? 'ón' : 'ones'} vigente${am === 1 ? '' : 's'}</span><span class="pill ${de ? 'good' : ''}">${de} destacado${de === 1 ? '' : 's'}</span></div>
    ${am >= AMON_LIMIT ? `<div class="banner" style="background:var(--bad-soft);color:var(--fg)"><span><b>${esc(name)} alcanzó ${am} amonestaciones.</b> Según las normas internas de la clínica, a partir de ${AMON_LIMIT} amonestaciones se puede evaluar la terminación de la relación laboral. Consulte con su asesor laboral antes de proceder.</span></div>` : am ? `<div class="small muted">Le queda${AMON_LIMIT - am === 1 ? '' : 'n'} ${AMON_LIMIT - am} antes del límite de ${AMON_LIMIT} establecido por la clínica.</div>` : ''}
    <div class="sn-list">${list.map(n => `<details class="sn-item ${n.kind === 'amonestacion' ? 'bad' : 'good'}${n.void ? ' void' : ''}"><summary><span class="sn-kind">${n.kind === 'amonestacion' ? 'Amonestación' : 'Destacado'}</span><b>${esc(n.title)}</b><span class="sn-date">${fdate(n.date)}</span></summary>
      <p>${esc(n.text).replace(/\n/g, '<br>')}</p><div class="small muted">Registrado por ${esc(n.by)} el ${esc(n.at)}${n.void ? ` · <b>Anulado</b> por ${esc(n.void.by)} el ${esc(n.void.at)}: ${esc(n.void.reason)}` : ''}</div>
      ${n.void ? '' : `<button class="btn sm" data-act="snVoid" data-id="${n.id}">Anular</button>`}</details>`).join('') || '<div class="empty">Sin amonestaciones ni destacados registrados.</div>'}</div>
    <div class="hstack"><button class="btn danger" data-act="snNew" data-k="amonestacion" data-who="${who}">Registrar amonestación</button><button class="btn primary" data-act="snNew" data-k="destacado" data-who="${who}">Registrar destacado</button></div>`;
}
ACTIONS.snNew = el => {
  if (!can('*')) return; const kind = el.dataset.k; const mot = kind === 'amonestacion' ? AMON_MOTIVOS : DEST_MOTIVOS;
  UI.sn = { who: el.dataset.who, kind, motive: mot[0][0], title: mot[0][0], text: mot[0][1], date: dAt(0) };
  openSheet(kind === 'amonestacion' ? 'Registrar amonestación' : 'Registrar destacado', snForm(), `<span class="note" id="sn-msg2"></span><button class="btn" data-act="snCancel">Volver</button><button class="btn ${kind === 'amonestacion' ? 'danger' : 'primary'}" data-act="snSave">Registrar</button>`, { wide: true });
};
function snForm() { const o = UI.sn; const mot = o.kind === 'amonestacion' ? AMON_MOTIVOS : DEST_MOTIVOS;
  return `<div class="small muted">${o.kind === 'amonestacion' ? 'Queda registrada en el perfil con fecha y quién la registra. La redacción se propone en tono formal y respetuoso; puede ajustarla.' : 'Queda registrado en el perfil como reconocimiento. Puede ajustar la redacción.'}</div>
  <div class="form"><div class="field"><label for="sn-mot">Motivo</label><select class="input" id="sn-mot" data-ch="snMotive">${mot.map(([m]) => `<option ${o.motive === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
    <div class="field"><label for="sn-date">Fecha del hecho</label><input class="input" type="date" id="sn-date" value="${o.date}"></div>
    <div class="field full"><label for="sn-title">Título</label><input class="input" id="sn-title" value="${esc(o.title)}"></div>
    <div class="field full"><label for="sn-text">Explicación completa</label><textarea class="input" id="sn-text" rows="6" placeholder="Describa con detalle lo ocurrido">${esc(o.text)}</textarea></div></div>`; }
const snKeep = () => { const o = UI.sn; o.title = val('sn-title').trim(); o.text = val('sn-text').trim(); o.date = val('sn-date') || dAt(0); };
ACTIONS.snMotive = el => { snKeep(); const mot = (UI.sn.kind === 'amonestacion' ? AMON_MOTIVOS : DEST_MOTIVOS).find(m => m[0] === el.value); UI.sn.motive = el.value;
  UI.sn.title = el.value === 'Otro motivo' ? '' : el.value; UI.sn.text = mot?.[1] || ''; refreshSheet(snForm()); };
ACTIONS.snCancel = () => staffReopen('notas');
ACTIONS.snSave = () => {
  snKeep(); const o = UI.sn; const msg = document.getElementById('sn-msg2');
  if (!o.title) { msg.textContent = 'Escriba el título.'; return; } if (o.text.length < 15) { msg.textContent = 'Escriba la explicación completa.'; return; }
  (S.staffNotes = S.staffNotes || []).push({ id: uid('sn'), who: o.who, kind: o.kind, motive: o.motive, title: o.title, text: o.text, date: o.date, by: actor(), at: nowStamp() });
  log(o.kind === 'amonestacion' ? 'Amonestación registrada' : 'Destacado registrado', `${staffName(o.who)} · ${o.title}`); save();
  const n = amonCount(o.who); toast(o.kind === 'amonestacion' ? `Amonestación registrada (${n} de ${AMON_LIMIT})` : 'Destacado registrado'); render(); staffReopen('notas');
};
ACTIONS.snVoid = el => { const n = (S.staffNotes || []).find(x => x.id === el.dataset.id); if (!n) return;
  openSheet('Anular registro', `<div class="small muted">El registro no se borra: queda tachado, con el motivo y quién lo anuló.</div><div class="field"><label for="snv-r">Motivo de la anulación</label><input class="input" id="snv-r" placeholder="Ej. Se registró por error en otra persona"></div><span class="note" id="snv-msg"></span>`,
    `<button class="btn" data-act="snCancel">Volver</button><button class="btn danger" data-act="snVoidSave" data-id="${n.id}">Anular</button>`); };
ACTIONS.snVoidSave = el => { const n = S.staffNotes.find(x => x.id === el.dataset.id); const r = val('snv-r').trim(); if (r.length < 5) { document.getElementById('snv-msg').textContent = 'Explique el motivo.'; return; }
  n.void = { by: actor(), at: nowStamp(), reason: r }; log('Registro de personal anulado', `${staffName(n.who)} · ${n.title} · ${r}`); save(); render(); staffReopen('notas'); };
function staffName(who) { const [t, id] = String(who).split(':');
  return t === 'doc' ? med(id)?.name || '' : t === 'nurse' ? (S.nurseStaff || []).find(n => n.id === id)?.name || '' : (S.users || []).find(u => u.id === id)?.name || ''; }
