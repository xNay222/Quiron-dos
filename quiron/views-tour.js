// Tutorial: recorridos guiados por rol. Durante un recorrido el software entra en "modo tutorial":
// oscurece la pantalla, resalta cada botón o sección, navega solo a la pantalla correcta y explica qué hace.
// El tutorial no guarda ni modifica nada (puede abrir un formulario para mostrarlo, sin enviarlo).
// Cada paso: { go: ruta, param, setup: () => prepara pestañas, open: () => abre una ventana, el: selector, t: título, d: texto }

const firstAdm = () => (S.admissions || []).find(a => a.status === 'ingresado')?.id || null;
const surgPatient = () => (S.appts || []).find(a => a.kind === 'cirugia' && a.date >= dAt(0) && isActive(a))?.pid || S.patients[0]?.id;
const anyPatient = () => S.patients[0]?.id;
const MENU = { el: '#side', t: 'Su menú', d: 'Aquí están solo las secciones de su rol. Lo que no le corresponde no aparece.' };
const ACCOUNT = { el: '.userbtn', t: 'Mi cuenta', d: 'Su nombre y rol. Desde aquí cambia su contraseña, el modo día o noche y cierra la sesión.' };
const BACK_HERE = r => ({ go: 'tutorial', el: '#side [data-go="tutorial"]', t: 'Vuelva cuando quiera', d: 'Los recorridos están siempre en "Tutorial". Puede repetirlos las veces que necesite.' });

const TOURS = {
  admin: [
    { id: 'adm-general', title: 'Recorrido general', desc: 'Las secciones principales y para qué sirve cada una.', steps: [
      { go: 'inicio', ...MENU, d: 'Como administrador (control maestro) ve todas las secciones del sistema.' },
      { go: 'inicio', el: '.main .grid.g4', t: 'Inicio', d: 'Resumen del día: cobros, cuentas por cobrar, citas y valor del inventario.' },
      { go: 'agenda', el: '.main .seg', setup: () => { UI.agTab = 'general'; }, t: 'Agenda', d: 'Agenda general, quirúrgica y de consultas por médico, con la guardia del día.' },
      { go: 'quirofano', el: '.main .head', t: 'Quirófano', d: 'Cirugías del día, solicitudes al almacén y registro de cirugías realizadas.' },
      { go: 'quirofano', el: '.main [data-act="kitsOpen"]', t: 'Kits de cirugía', d: 'Arme aquí los kits (sevoflurano, fentanilo, kit de cama…). Al programar la cirugía se elige el kit y la solicitud al almacén llega precargada.' },
      { go: 'hospitalizacion', el: '.bedgrid', t: 'Hospitalización', d: 'Mapa de camas. Toque una cama ocupada para ver evoluciones, medicación y exámenes del ingreso.' },
      { go: 'emergencias', el: '.bedgrid', t: 'Emergencias', d: 'Las 3 camas de emergencia, con medicación, evoluciones y exámenes como en hospitalización. Si el paciente se queda, use "Pasar a hospitalización".' },
      { go: 'atencion', el: '#side [data-go="atencion"]', t: 'Presupuestos', d: 'Presupuestos por paquete: se guardan y se envían directamente a Contabilidad.' },
      { go: 'contabilidad', el: '#side [data-go="contabilidad"]', t: 'Contabilidad', d: 'Lo que hay por confirmar (presupuestos, compras, recurrentes), los cobros y el resumen en USD y Bs.' },
      { go: 'usuarios', el: '#side [data-go="usuarios"]', t: 'Usuarios', d: 'Crea e invita a cada persona con su rol. Solo usted tiene acceso.' },
      { go: 'ajustes', el: '#side [data-go="ajustes"]', t: 'Ajustes', d: 'Tasa BCV, datos de la clínica y copias de seguridad.' },
      ACCOUNT, BACK_HERE()] },
    { id: 'adm-presupuesto', title: 'Hacer un presupuesto', desc: 'De la elección del paquete al envío a Contabilidad.', steps: [
      { go: 'atencion', el: '.main [data-act="newAttention"][data-budget="1"]', t: 'Nuevo presupuesto', d: 'Empieza aquí. Los presupuestos son quirúrgicos, de emergencia o de procedimientos.' },
      { go: 'atencion', open: () => ACTIONS.newBudget(), el: '.sheet', t: 'Tres pasos', d: '1) Paciente. 2) Tipo y paquete: un clic arma todo. 3) Ajuste solo lo que cambie: horas, días, honorarios y material.' },
      { go: 'atencion', el: '.main .seg', t: 'Seguimiento', d: 'Cada presupuesto pasa por: guardado → enviado a Contabilidad → pago recibido o no pagado / rechazado.' }] },
    { id: 'adm-contab', title: 'Contabilidad y cobros', desc: 'Confirmar, cobrar con o sin factura fiscal y recurrentes.', steps: [
      { go: 'contabilidad', setup: () => { UI.acTab = 'confirmar'; }, el: '.main [data-act="acTab"][data-k="confirmar"]', t: 'Por confirmar', d: 'Presupuestos enviados a Contabilidad, órdenes de compra del almacén y gastos o ingresos recurrentes vencidos.' },
      { go: 'contabilidad', setup: () => { UI.acTab = 'facturas'; }, el: '.main [data-act="acTab"][data-k="facturas"]', t: 'Cobros', d: 'Todas las cuentas. La factura fiscal es opcional y se puede emitir después.' },
      { go: 'contabilidad', setup: () => { UI.acTab = 'recurrentes'; }, el: '.main [data-act="acTab"][data-k="recurrentes"]', t: 'Recurrentes', d: 'Alcaldía, Fospuca, alquileres, nómina… Cada vencimiento se confirma con su fecha, referencia y tasa.' }] },
    { id: 'adm-usuarios', title: 'Usuarios y copias de seguridad', desc: 'Invitar personal y proteger la información.', steps: [
      { go: 'usuarios', el: '.main [data-act="userNew"]', t: 'Nuevo usuario', d: 'Nombre, correo y rol. Elija código de invitación (la persona crea su contraseña) o contraseña temporal.' },
      { go: 'usuarios', el: '.main .list', t: 'Gestión', d: 'Toque un usuario para cambiar su rol, desactivarlo o generarle un acceso nuevo.' },
      { go: 'ajustes', el: '.main [data-act="exportData"]', t: 'Copia de seguridad', d: 'Descargue una copia con frecuencia y guárdela fuera de este equipo. Puede probarla y restaurarla aquí mismo.' }] },
  ],
  recepcion: [
    { id: 'rec-general', title: 'Primeros pasos', desc: 'Su menú y la agenda.', steps: [MENU,
      { go: 'agenda', el: '.main .head .actions', t: 'Moverse por los días', d: 'Use ‹ Hoy › o el calendario para ver otro día.' },
      { go: 'agenda', setup: () => { UI.agTab = 'general'; }, el: '.main .seg', t: 'Tres agendas', d: 'General (todo el día), quirúrgica (quirófano) y de consultas (una columna por médico, con su horario).' },
      ACCOUNT, BACK_HERE()] },
    { id: 'rec-cita', title: 'Agendar una cita', desc: 'Consulta con un médico, dentro de su horario.', steps: [
      { go: 'agenda', setup: () => { UI.agTab = 'consultas'; }, el: '.main .head [data-act="newAppt"]', t: 'Nueva cita', d: 'Elija paciente, médico, servicio, fecha y hora. El sistema avisa si el médico no atiende a esa hora o si hay un choque.' },
      { go: 'agenda', setup: () => { UI.agTab = 'consultas'; }, open: () => ACTIONS.newAppt({ dataset: {} }), el: '.sheet', t: 'El formulario', d: 'Si el paciente es nuevo, use "Registrar paciente" sin salir de aquí.' },
      { go: 'agenda', setup: () => { UI.agTab = 'general'; }, el: '.main .list, .main .slot', t: 'Estados de la cita', d: 'Toque una cita para marcarla como confirmada, llegó, no asistió o cancelada.' }] },
    { id: 'rec-cirugia', title: 'Programar una cirugía', desc: 'Quirófano, cirujano y anestesiólogo.', steps: [
      { go: 'agenda', setup: () => { UI.agTab = 'quirurgica'; }, el: '.main .seg', t: 'Agenda quirúrgica', d: 'Aquí ve el quirófano del día y sus horas libres.' },
      { go: 'agenda', setup: () => { UI.agTab = 'quirurgica'; }, open: () => ACTIONS.newAppt({ dataset: { kind: 'cirugia' } }), el: '.sheet', t: 'Programar', d: 'Cirugía, cirujano, duración y anestesiólogo. El sistema impide que el quirófano o el médico estén ocupados.' }] },
    { id: 'rec-papeles', title: 'Pacientes, consentimiento y preoperatorio', desc: 'Lo que falta antes de la cirugía.', steps: [
      { go: 'pacientes', el: '.main [data-act="newPatient"]', t: 'Registrar paciente', d: 'Nombre, cédula, teléfono y contacto. El sistema avisa si la cédula ya existe.' },
      { go: 'pacientes', el: '#patQ', t: 'Buscar', d: 'Por nombre, cédula, teléfono o código. En la lista verá en rojo "Pendiente de consentimiento" o "Pendiente de preoperatorio".' },
      { go: 'pacientes', param: surgPatient, el: '.main .sxbanner', t: 'Requisitos de la cirugía', d: 'Desde aquí imprime el consentimiento, sube el firmado y sube un preoperatorio hecho en otro laboratorio.' }] },
  ],
  medico: [
    { id: 'med-general', title: 'Primeros pasos', desc: 'Su consulta y su menú.', steps: [MENU,
      { go: 'consultorio', el: '.main .grid.g4', t: 'Mi consulta', d: 'Sus pacientes de hoy, resultados nuevos de exámenes e historias sin firmar.' },
      { go: 'agenda', el: '.main .seg', t: 'Su agenda', d: 'Solo ve sus citas y cirugías, y puede programarlas a su nombre.' },
      ACCOUNT, BACK_HERE()] },
    { id: 'med-historia', title: 'Historia clínica e informes', desc: 'Escribir, firmar y descargar.', steps: [
      { go: 'pacientes', param: anyPatient, setup: () => { UI.patTab = 'resumen'; }, el: '.main .head .actions, .main .actions', t: 'En el perfil del paciente', d: '"Nueva historia" (consulta, evolución, nota operatoria o libre), "Informe médico" y "Solicitar examen".' },
      { go: 'pacientes', param: anyPatient, setup: () => { UI.patTab = 'evoluciones'; }, el: '.main [data-act="patTab"][data-k="evoluciones"]', t: 'Historia clínica', d: 'Todo lo firmado queda aquí y en el archivo de Historias. Una historia firmada no se modifica: se agrega una nota aclaratoria.' },
      { go: 'pacientes', param: anyPatient, setup: () => { UI.patTab = 'examenes'; }, el: '.main [data-act="patTab"][data-k="examenes"]', t: 'Exámenes', d: 'Resultados de laboratorio e imagen del paciente, incluidos los externos.' }] },
    { id: 'med-qx', title: 'Quirófano y hospitalización', desc: 'Material, cirugía realizada, evolución y alta.', steps: [
      { go: 'quirofano', el: '.main [data-act="qxMedOrder"]', t: 'Pedir medicación e insumos', d: 'Para cada cirugía. Elija de la lista al médico que solicita; cirujano y anestesiólogo quedan fijos.' },
      { go: 'emergencias', el: '.bedgrid', t: 'Emergencias', d: 'Las 3 camas de emergencia funcionan como hospitalización: evolución, medicación y exámenes. Si el paciente se queda, "Pasar a hospitalización".' },
      { go: 'quirofano', el: '.main [data-act="qxDone"]', t: 'Cirugía realizada', d: 'Al terminar, regístrela con su duración real. Así entra en las estadísticas.' },
      { go: 'hospitalizacion', param: firstAdm, el: '.main .actions', t: 'El ingreso', d: '"Nueva evolución", "Solicitar medicación", "Pedir exámenes" y "Dar de alta".' },
      { go: 'hospitalizacion', param: firstAdm, setup: () => { UI.hospTab = 'medicacion'; }, el: '.main [data-act="hospTab"][data-k="medicacion"]', t: 'Medicación', d: 'Lo solicitado, lo que entregó el almacén y cada aplicación registrada por enfermería.' }] },
  ],
  residente: [
    { id: 'res-general', title: 'Primeros pasos', desc: 'Hospitalización y consulta de pacientes.', steps: [MENU,
      { go: 'hospitalizacion', el: '.bedgrid', t: 'Mapa de camas', d: 'Toque una cama ocupada para trabajar en ese ingreso.' },
      { go: 'hospitalizacion', param: firstAdm, setup: () => { UI.hospTab = 'indicaciones'; }, el: '.main [data-act="hospTab"][data-k="indicaciones"]', t: 'Indicaciones de medicación', d: 'Deje aquí qué colocar, la dosis, la frecuencia y la duración. Enfermería lo ve en la cama con la hora de cada dosis. El pedido al almacén es aparte.' },
      { go: 'emergencias', el: '.bedgrid', t: 'Emergencias', d: 'Las 3 camas de emergencia funcionan como hospitalización: evolución, medicación y exámenes. Si el paciente se queda, "Pasar a hospitalización".' },
      { go: 'hospitalizacion', param: firstAdm, el: '.main .actions', t: 'En el ingreso', d: 'Escriba la evolución, solicite medicación y pida exámenes. Todo queda ligado a este ingreso.' },
      { go: 'hospitalizacion', param: firstAdm, setup: () => { UI.hospTab = 'evoluciones'; }, el: '.main .seg', t: 'Evoluciones, medicación y exámenes', d: 'Lo que se hizo durante la estancia, en orden.' },
      { go: 'pacientes', el: '#patQ', t: 'Pacientes', d: 'Consulte la ficha, la historia clínica y los exámenes de cualquier paciente.' },
      ACCOUNT, BACK_HERE()] },
  ],
  enfermeria: [
    { id: 'enf-general', title: 'Primeros pasos', desc: 'Medicación en hospitalización y quirófano.', steps: [MENU,
      { go: 'hospitalizacion', el: '.bedgrid', t: 'Mapa de camas', d: 'Toque una cama ocupada para ver al paciente.' },
      { go: 'emergencias', el: '.bedgrid', t: 'Emergencias', d: 'Igual que en hospitalización: toque la cama, solicite la medicación y registre cada aplicación.' },
      { go: 'hospitalizacion', param: firstAdm, setup: () => { UI.hospTab = 'indicaciones'; }, el: '.main [data-act="hospTab"][data-k="indicaciones"]', t: 'Indicaciones del médico', d: 'Qué colocar, cuánto y cada cuánto, con la hora de la próxima dosis (rojo si está atrasada). Registre cada aplicación, o "No se aplicó" con el motivo.' },
      { go: 'hospitalizacion', param: firstAdm, el: '.main [data-act="newMedOrder"]', t: 'Solicitar medicación o material', d: 'Elija el medicamento, la cantidad y la frecuencia, y elija de la lista al médico que lo indicó. Llega al almacén.' },
      { go: 'hospitalizacion', param: firstAdm, setup: () => { UI.hospTab = 'medicacion'; }, el: '.main [data-act="hospTab"][data-k="medicacion"]', t: 'Aplicaciones', d: 'Cuando el almacén entrega, aparece "Registrar aplicación" en cada medicamento: hora y enfermera que la aplicó.' },
      { go: 'hospitalizacion', param: firstAdm, setup: () => { UI.hospTab = 'evoluciones'; }, el: '.main [data-act="hospTab"][data-k="evoluciones"]', t: 'Evoluciones', d: 'Lea lo que indicó el médico antes de pedir o aplicar.' },
      { go: 'quirofano', el: '.main [data-act="qxMedOrder"]', t: 'Quirófano', d: 'Pida el material de cada cirugía. Después registre la devolución de lo que no se usó.' },
      ACCOUNT, BACK_HERE()] },
  ],
  almacen: [
    { id: 'alm-general', title: 'Primeros pasos', desc: 'Su menú y el inventario.', steps: [MENU,
      { go: 'inventario', setup: () => { UI.invTab = 'productos'; }, el: '.main .grid.g4', t: 'Resumen', d: 'Productos bajo mínimo y lotes por vencer.' },
      { go: 'inventario', el: '.main .seg.sec, .main [data-act="invTab"]', t: 'Secciones', d: 'Órdenes pendientes, productos, alertas, compras, mapa del almacén y movimientos.' },
      ACCOUNT, BACK_HERE()] },
    { id: 'alm-despacho', title: 'Despachar una solicitud', desc: 'Lo que piden hospitalización y quirófano.', steps: [
      { go: 'inventario', setup: () => { UI.invTab = 'ordenes'; }, el: '.main [data-act="invTab"][data-k="ordenes"]', t: 'Órdenes pendientes', d: 'Aquí llega todo lo que se pide para pacientes. Las urgentes aparecen primero.' },
      { go: 'inventario', setup: () => { UI.invTab = 'ordenes'; }, el: '.main .stepper', t: 'Cuánto sale', d: 'Con − y + ajuste lo que realmente entrega. Si no hay suficiente, se entrega lo que hay y el resto queda pendiente.' },
      { go: 'inventario', setup: () => { UI.invTab = 'ordenes'; }, el: '.main [data-act="moDispatch"]', t: 'Confirmar', d: 'Se descuenta del inventario, primero el lote que vence antes. Si algo no llegará, use "Cerrar faltante" con el motivo.' },
      { go: 'quirofano', el: '.main .head', t: 'Ver lo que se pidió', d: 'En Quirófano y Hospitalización solo consulta qué se pidió para cada paciente; no puede modificar nada.' }] },
    { id: 'alm-compras', title: 'Productos, compras y alertas', desc: 'Entradas, órdenes de compra y vencimientos.', steps: [
      { go: 'inventario', setup: () => { UI.invTab = 'productos'; }, el: '.main [data-act="newProduct"]', t: 'Producto o lote nuevo', d: 'Tome 1 o 2 fotos de la caja: la IA lee nombre, concentración, lote y vencimiento, y usted lo revisa.' },
      { go: 'inventario', setup: () => { UI.invTab = 'alertas'; }, el: '.main [data-act="invTab"][data-k="alertas"]', t: 'Alertas', d: 'Lo que está bajo mínimo, vencido o por vencer.' },
      { go: 'inventario', setup: () => { UI.invTab = 'compras'; }, el: '.main [data-act="invTab"][data-k="compras"]', t: 'Compras', d: 'Cree la orden de compra; Contabilidad la confirma y paga. Luego reciba la mercancía con su lote y vencimiento.' },
      { go: 'inventario', setup: () => { UI.invTab = 'mapa'; UI.mapShelf = null; }, el: '.main [data-act="invTab"][data-k="mapa"]', t: 'Mapa del almacén', d: 'Dónde está cada producto: sector, estantería, nivel y recipiente.' }] },
    { id: 'alm-vencidos', title: 'Retirar productos vencidos', desc: 'Encontrarlos, sacarlos del recipiente y registrarlo.', steps: [
      { go: 'inventario', setup: () => { UI.invTab = 'alertas'; }, el: '.main [data-act="invTab"][data-k="alertas"]', t: 'Alertas', d: 'Aquí aparece cada lote vencido o por vencer. Lo vencido no se despacha a ningún paciente.' },
      { go: 'inventario', setup: () => { UI.invTab = 'productos'; UI.invMode = 'lote'; UI.invQ = ''; }, el: '.main table', t: 'Por lote y vencimiento', d: 'Los vencidos salen arriba, con su estantería y caja (por ejemplo "EST-A-03 · Caja 19"). Así sabe a dónde ir.' },
      { go: 'inventario', setup: () => { UI.invTab = 'productos'; UI.invMode = 'lote'; }, open: () => { const p = S.products.find(x => stock(x) > usable(x)); if (p) ACTIONS.openProduct({ dataset: { id: p.id } }); }, el: '.sheet [data-act="retireLot"]', t: 'Retirar', d: 'Abra el producto. Junto a cada lote vencido está "Retirar": indique cuántas saca del recipiente y confirme.' },
      { go: 'inventario', setup: () => { UI.invTab = 'movimientos'; }, el: '.main [data-act="invTab"][data-k="movimientos"]', t: 'Queda registrado', d: 'Cada retiro aparece en Movimientos como "Vencido, retirado", con la fecha y quién lo hizo.' }] },
    { id: 'alm-estanterias', title: 'Estanterías y ubicación de los medicamentos', desc: 'Encontrar un medicamento y asignarle su lugar.', steps: [
      { go: 'inventario', setup: () => { UI.invTab = 'mapa'; UI.mapShelf = null; UI.mapSel = null; }, el: '.main svg[aria-label^="Mapa"]', t: 'El mapa', d: 'Está orientado como se ve al entrar. El Sector 1 es la sala de la entrada; los sectores 2 y 3 siguen hacia el fondo.' },
      { go: 'inventario', setup: () => { UI.invTab = 'mapa'; UI.mapShelf = null; }, el: '.main svg .shelves', t: 'Estanterías A, B y C', d: 'Están detrás de la puerta del Sector 1. La A es la más cercana a la puerta. Toque una para verla de cerca.' },
      { go: 'inventario', setup: () => { UI.invTab = 'mapa'; UI.mapShelf = 'A'; }, el: '.main .shelf-front', t: 'La estantería de frente', d: 'Sus 6 niveles, de EST-A-01 (arriba) a EST-A-06. En cada nivel ve los medicamentos con el número de su recipiente en negro y la cantidad disponible.' },
      { go: 'inventario', setup: () => { UI.invTab = 'mapa'; UI.mapShelf = 'A'; }, el: '#shelf-pick', t: 'Buscar en la estantería', d: 'Elija un medicamento de la lista para abrir su ficha: lotes, vencimientos y existencia.' },
      { go: 'inventario', setup: () => { UI.invTab = 'mapa'; UI.mapShelf = 'A'; }, el: '.main .seg[aria-label="Estantería"]', t: 'Cambiar de estantería', d: 'Pase a la B o la C desde aquí, o use "Volver al mapa".' },
      { go: 'inventario', setup: () => { UI.invTab = 'mapa'; UI.mapShelf = null; }, el: '.main [data-act="invTab"][data-k="productos"]', t: 'Asignar el lugar', d: 'Abra el producto en "Productos". En "Dónde está" toque la estantería, luego el nivel, escriba el número de recipiente y toque "Guardar".' }] },
  ],
  laboratorio: [
    { id: 'lab-general', title: 'Trabajo del laboratorio', desc: 'Pendientes, resultados y catálogo.', steps: [MENU,
      { go: 'examenes', setup: () => { UI.exTab = 'pendientes'; }, el: '.main [data-act="exTab"][data-k="pendientes"]', t: 'Por hacer', d: 'Lo que pidieron los médicos. Toque un examen para cargar su resultado y validarlo.' },
      { go: 'examenes', el: '.main [data-act="newExam"]', t: 'Nuevo examen', d: 'Para un paciente que llega directo: búsquelo o regístrelo, elija los exámenes y cargue el resultado en el mismo paso.' },
      { go: 'examenes', setup: () => { UI.exTab = 'catalogo'; }, el: '.main [data-act="exTab"][data-k="catalogo"]', t: 'Catálogo y valores de referencia', d: 'Los parámetros y rangos de cada examen. Los valores fuera de rango se marcan solos.' },
      { go: 'pacientes', el: '#patQ', t: 'Pacientes', d: 'Consulte alergias, antecedentes y exámenes anteriores del paciente.' },
      ACCOUNT, BACK_HERE()] },
  ],
  imagen: [
    { id: 'img-general', title: 'Trabajo de rayos X e imagen', desc: 'Pendientes e informes.', steps: [MENU,
      { go: 'examenes', setup: () => { UI.exTab = 'pendientes'; }, el: '.main [data-act="exTab"][data-k="pendientes"]', t: 'Por hacer', d: 'Los estudios pedidos. Toque uno para escribir el informe y adjuntar las imágenes.' },
      { go: 'examenes', el: '.main [data-act="newExam"]', t: 'Nuevo estudio', d: 'Para un paciente que llega directo: búsquelo o regístrelo y registre el estudio.' },
      ACCOUNT, BACK_HERE()] },
  ],
};
const toursFor = (r = role()) => TOURS[r] || [];
// Para ver el recorrido de otro rol, el administrador lo recorre "como" ese usuario (sin cambiar su cuenta)
const previewDoc = r => r === 'medico' ? MEDICOS.find(m => !m.resident)?.id : r === 'residente' ? MEDICOS.find(m => m.resident)?.id : null;

// ---------- Sección "Tutorial" ----------
VIEWS.tutorial = () => {
  const u = meUser(); const done = u?.tours || {}; const list = toursFor();
  return header('Tutorial', `Recorridos guiados para ${esc(roleLabel(role()))}`) +
  `<div class="banner" style="margin-bottom:14px">En modo tutorial el sistema lo lleva paso a paso por cada pantalla y resalta dónde tocar. No se guarda ni se cambia nada. Puede salir cuando quiera con "Salir" o la tecla Esc.</div>
  <div class="grid g2">${list.map(t => `<div class="card" style="display:grid;gap:8px"><div class="between"><h2 style="margin:0">${esc(t.title)}</h2>${done[t.id] ? '<span class="pill good">Visto</span>' : ''}</div>
    <div class="small muted">${esc(t.desc)} · ${t.steps.length} pasos</div><div><button class="btn ${done[t.id] ? '' : 'primary'}" data-act="tourStart" data-id="${t.id}">${done[t.id] ? 'Repetir' : 'Empezar'}</button></div></div>`).join('')}</div>
  ${can('*') ? `<div class="sec"><h3 style="font-size:20px;margin:0 0 4px">Tutoriales de los demás usuarios</h3><p class="small muted" style="margin:0 0 12px">Al abrir uno, el sistema se muestra tal como lo ve ese rol: su menú, sus botones y sus límites. Al terminar vuelve a su vista de administrador.</p>
    ${Object.keys(TOURS).filter(r => r !== 'admin').map(r => `<div class="card" style="margin-bottom:12px"><h2 style="margin:0 0 8px">${esc(roleLabel(r))}</h2><div class="list">${TOURS[r].map(t => `<div class="row"><div class="grow"><div class="t">${esc(t.title)}</div><div class="s">${esc(t.desc)} · ${t.steps.length} pasos</div></div><button class="btn sm" data-act="tourStart" data-id="${t.id}" data-role="${r}">Ver como ${esc(roleLabel(r).toLowerCase())}</button></div>`).join('')}</div></div>`).join('')}</div>` : ''}`;
};
ACTIONS.tourStart = el => tourStart(el.dataset.id, el.dataset.role);

// ---------- Modo tutorial ----------
let TOUR = null;
function tourStart(id, asRole) {
  const r = asRole && asRole !== role() && can('*') ? asRole : null; const t = toursFor(r || role()).find(x => x.id === id); if (!t) return;
  closeSheet(); if (r) { UI.tourAs = S.session; S.session = { ...S.session, role: r, doc: previewDoc(r) }; renderSide(); }   // vista temporal del otro rol
  TOUR = { t, i: 0, as: r }; document.addEventListener('keydown', tourKeys); window.addEventListener('resize', tourPlace); window.addEventListener('scroll', tourPlace, true); tourShow(); }
function tourEnd(done) {
  if (!TOUR) return; const id = TOUR.t.id; const as = TOUR.as; TOUR = null;
  if (UI.tourAs) { S.session = UI.tourAs; UI.tourAs = null; }   // vuelve a la vista del administrador
  document.removeEventListener('keydown', tourKeys); window.removeEventListener('resize', tourPlace); window.removeEventListener('scroll', tourPlace, true);
  ['tour-block', 'tour-spot', 'tour-tip'].forEach(x => document.getElementById(x)?.remove()); closeSheet();
  if (as) { toast('De vuelta a su vista de administrador'); go('tutorial', null, { root: true }); return; }
  if (done) { const u = meUser(); if (u) { u.tours = { ...(u.tours || {}), [id]: dAt(0) }; save(); } toast('Recorrido terminado'); go('tutorial', null, { root: true }); }
}
const tourKeys = e => { if (!TOUR) return; if (e.key === 'Escape') tourEnd(false); else if (e.key === 'ArrowRight') tourNext(1); else if (e.key === 'ArrowLeft') tourNext(-1); };
function tourNext(d) { if (!TOUR) return; const n = TOUR.i + d; if (n < 0) return; if (n >= TOUR.t.steps.length) { tourEnd(true); return; } TOUR.i = n; tourShow(); }
async function tourShow() {
  const st = TOUR.t.steps[TOUR.i]; closeSheet();
  if (st.setup) st.setup();
  if (st.go && canSee(st.go)) { const p = typeof st.param === 'function' ? st.param() : st.param || null; if (route !== st.go || param !== p) go(st.go, p, { root: true }); else render(); }
  if (st.open) { await new Promise(r => setTimeout(r, 300)); st.open(); }
  await new Promise(r => setTimeout(r, st.open ? 450 : 320));
  if (!TOUR) return;
  const mk = id => { let n = document.getElementById(id); if (!n) { n = document.createElement('div'); n.id = id; document.body.appendChild(n); } return n; };
  mk('tour-block'); mk('tour-spot');
  const tip = mk('tour-tip'); tip.setAttribute('role', 'dialog'); tip.setAttribute('aria-live', 'polite');
  const last = TOUR.i === TOUR.t.steps.length - 1;
  tip.innerHTML = `<div class="small muted">${TOUR.as ? `<span class="pill info">Viendo como ${esc(roleLabel(TOUR.as))}</span> ` : ''}${esc(TOUR.t.title)} · paso ${TOUR.i + 1} de ${TOUR.t.steps.length}</div><b style="font-size:17px">${esc(st.t)}</b><div style="line-height:1.5">${esc(st.d)}</div>
    <div class="between" style="margin-top:6px"><button class="btn ghost sm" data-act="tourExit">Salir</button><div class="hstack">${TOUR.i ? '<button class="btn sm" data-act="tourPrev">Anterior</button>' : ''}<button class="btn primary sm" data-act="tourNextBtn">${last ? 'Terminar' : 'Siguiente'}</button></div></div>`;
  const el = st.el ? [...document.querySelectorAll(st.el)].find(n => n.offsetParent !== null || n.getClientRects().length) : null;
  if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });   // desplazamiento inmediato: el resaltado se dibuja en el lugar correcto
  // La pantalla entra con una animación: el resaltado la sigue hasta que se asienta (~1 s)
  TOUR.el = el; const t0 = performance.now(); const follow = () => { if (!TOUR || TOUR.el !== el) return; tourPlace(); if (performance.now() - t0 < 1000) requestAnimationFrame(follow); }; requestAnimationFrame(follow);
  tip.querySelector('.btn.primary')?.focus();
}
function tourPlace() {
  if (!TOUR) return; const spot = document.getElementById('tour-spot'), tip = document.getElementById('tour-tip'), block = document.getElementById('tour-block'); if (!spot || !tip) return;
  const el = TOUR.el && TOUR.el.isConnected ? TOUR.el : null; const pad = 8;
  if (!el) { spot.style.display = 'none'; block.classList.add('dim'); tip.style.left = '50%'; tip.style.top = '50%'; tip.style.transform = 'translate(-50%,-50%)'; return; }
  block.classList.remove('dim'); spot.style.display = 'block'; tip.style.transform = 'none';
  const r = el.getBoundingClientRect(); const vw = innerWidth, vh = innerHeight;
  const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad), w = Math.min(vw - x - 4, r.width + pad * 2), h = Math.min(vh - y - 4, r.height + pad * 2);
  Object.assign(spot.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  if (vw < 640) { Object.assign(tip.style, { left: '12px', right: '12px', top: 'auto', bottom: '12px', width: 'auto' }); return; }
  const tw = Math.min(380, vw - 24); tip.style.width = tw + 'px'; tip.style.right = 'auto'; tip.style.bottom = 'auto';
  const th = tip.offsetHeight; let top = y + h + 12, left = Math.min(Math.max(12, x), vw - tw - 12);
  if (top + th > vh - 12) top = y - th - 12;                               // si no cabe abajo, arriba
  if (top < 12) { top = Math.min(vh - th - 12, Math.max(12, y)); left = x + w + 12 + tw < vw ? x + w + 12 : Math.max(12, x - tw - 12); }   // si no, al lado
  top = Math.min(Math.max(12, top), vh - th - 12);
  Object.assign(tip.style, { left: left + 'px', top: top + 'px' });
}
ACTIONS.tourExit = () => tourEnd(false);
ACTIONS.tourPrev = () => tourNext(-1);
ACTIONS.tourNextBtn = () => tourNext(1);

// Primer ingreso de cada usuario: se ofrece el recorrido de su rol
window.tourOffer = () => {
  const u = meUser(); if (!u || u.tourOffered || !toursFor().length) return;
  u.tourOffered = true; save();
  openSheet('Bienvenido', `<p style="margin:0">¿Quiere un recorrido rápido por lo que puede hacer como <b>${esc(roleLabel(u.role))}</b>? Toma un par de minutos y no modifica nada.</p><p class="small muted">Siempre lo encontrará en "Tutorial", en el menú.</p>`,
    `<button class="btn" data-act="close">Ahora no</button><button class="btn primary" data-act="tourStart" data-id="${toursFor()[0].id}">Empezar recorrido</button>`);
};
