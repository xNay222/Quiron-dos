// Tutorial: recorridos guiados por rol. Durante un recorrido el software entra en "modo tutorial":
// oscurece la pantalla, resalta cada botón o sección, navega solo a la pantalla correcta y explica qué hace.
// El tutorial no guarda ni modifica nada (puede abrir un formulario para mostrarlo, sin enviarlo).
// Cada paso: { go: ruta, param, setup: () => prepara pestañas, open: () => abre una ventana, el: selector, t: título, d: texto }

const firstAdm = () => (S.admissions || []).find(a => a.status === 'ingresado')?.id || null;
const surgPatient = () => (S.appts || []).find(a => a.kind === 'cirugia' && a.date >= dAt(0) && isActive(a))?.pid || S.patients[0]?.id;
const anyPatient = () => S.patients[0]?.id;
const MENU = { el: '#side', t: 'Su menú', d: 'Aquí están las secciones disponibles. Toque una para entrar.' };
const ACCOUNT = { el: '.userbtn', t: 'Mi cuenta', d: 'Su nombre y rol. Desde aquí cambia su contraseña, el modo día o noche y cierra la sesión.' };
// Médicos y residentes: también registran sus datos para firmar
const ACCOUNT_CLIN = { ...ACCOUNT, d: 'Su nombre y rol. Aquí registra su cédula y su número de Colegio de Médicos (sin él no puede firmar), cambia su contraseña, el modo día o noche y cierra la sesión.' };
// Administrador: si también atiende pacientes, vincula su ficha de médico
const ACCOUNT_ADMIN = { ...ACCOUNT, d: 'Su nombre y rol. Si también atiende pacientes, elija aquí "Su ficha de médico" y registre su número de colegiado: así escribe y firma evoluciones y consultas con su nombre.' };
const BACK_HERE = r => ({ go: 'tutorial', el: '#side [data-go="tutorial"]', t: 'Vuelva cuando quiera', d: 'Los recorridos están siempre en "Tutorial". Puede repetirlos las veces que necesite.' });

const TOURS = {
  admin: [
    { id: 'adm-general', title: 'Recorrido general', desc: 'Las secciones principales y para qué sirve cada una.', steps: [
      { go: 'inicio', ...MENU, d: 'Aquí están las secciones disponibles, ordenadas en cuatro grupos: Clínica, Pacientes, Gestión y Sistema.' },
      { go: 'inicio', el: '.main .today-intro', t: 'Inicio', d: 'Una frase le dice cómo está la clínica ahora: el quirófano, las camas de hospitalización y UCI, y la medicación por despachar.' },
      { go: 'inicio', el: '.main .today-feed', t: 'Hoy en la clínica', d: 'Lo que requiere atención primero. Toque cualquier aviso para ir directo a resolverlo.' },
      { go: 'agenda', el: '.main .seg', setup: () => { UI.agTab = 'general'; }, t: 'Agenda', d: 'Agenda general, quirúrgica y de consultas por médico, con la guardia del día, y el directorio de médicos para derivar pacientes.' },
      { go: 'consultas', el: '#side [data-go="consultas"]', t: 'Consultas', d: 'Consultas guiadas, una pregunta por pantalla (rápida o completa). Al firmar salen el informe, el récipe, las órdenes, constancias y reposo.' },
      { go: 'quirofano', el: '.main .head', t: 'Quirófano', d: 'Cirugías del día, solicitudes al almacén y registro de cirugías realizadas.' },
      { go: 'quirofano', el: '.main [data-act="kitsOpen"]', t: 'Kits de cirugía', d: 'Arme aquí los kits (sevoflurano, fentanilo, kit de cama…). Al programar la cirugía se elige el kit y la solicitud al almacén llega precargada.' },
      { go: 'hospitalizacion', el: '.bedgrid', t: 'Hospitalización', d: 'Mapa de camas. Toque una cama ocupada para ver evoluciones, medicación y exámenes. En cada cama, "Generar informe evolutivo" guía la evolución del día.' },
      { go: 'emergencias', el: '.bedgrid', t: 'Emergencias', d: 'Las 3 camas de emergencia, con medicación, evoluciones y exámenes como en hospitalización. Si el paciente se queda, use "Pasar a hospitalización".' },
      { go: 'atencion', el: '#side [data-go="atencion"]', t: 'Presupuestos', d: 'Presupuestos por paquete: se guardan y se envían directamente a Contabilidad.' },
      { go: 'contabilidad', el: '#side [data-go="contabilidad"]', t: 'Contabilidad', d: 'Lo que hay por confirmar (presupuestos, compras, recurrentes), los cobros y el resumen en USD y Bs.' },
      { go: 'usuarios', el: '#side [data-go="usuarios"]', t: 'Usuarios', d: 'Crea e invita a cada persona con su rol. Solo usted tiene acceso.' },
      { go: 'ajustes', el: '#side [data-go="ajustes"]', t: 'Ajustes', d: 'Tasa BCV (se actualiza sola cada hora), datos de la clínica, importar inventario y copias de seguridad cifradas con su clave.' },
      ACCOUNT_ADMIN, BACK_HERE()] },
    { id: 'adm-presupuesto', title: 'Hacer un presupuesto', desc: 'De la elección del paquete al envío a Contabilidad.', steps: [
      { go: 'atencion', el: '.main [data-act="newAttention"][data-budget="1"]', t: 'Nuevo presupuesto', d: 'Empieza aquí. Los presupuestos son quirúrgicos, de emergencia o de procedimientos.' },
      { go: 'atencion', open: () => ACTIONS.newBudget(), el: '.sheet', t: 'Tres pasos', d: '1) Paciente. 2) Tipo y paquete: un clic arma todo. 3) Ajuste solo lo que cambie: horas, días, honorarios y material.' },
      { go: 'atencion', el: '.main .seg', t: 'Seguimiento', d: 'Cada presupuesto pasa por: guardado → enviado a Contabilidad → pago recibido o no pagado / rechazado.' }] },
    { id: 'adm-contab', title: 'Contabilidad y cobros', desc: 'Confirmar, cobrar con o sin factura fiscal y recurrentes.', steps: [
      { go: 'contabilidad', setup: () => { UI.acTab = 'confirmar'; }, el: '.main [data-act="acTab"][data-k="confirmar"]', t: 'Por confirmar', d: 'Presupuestos enviados a Contabilidad, órdenes de compra del almacén y gastos o ingresos recurrentes vencidos.' },
      { go: 'contabilidad', setup: () => { UI.acTab = 'facturas'; }, el: '.main [data-act="acTab"][data-k="facturas"]', t: 'Cobros', d: 'Todas las cuentas. La factura fiscal es opcional y se puede emitir después.' },
      { go: 'contabilidad', setup: () => { UI.acTab = 'recurrentes'; }, el: '.main [data-act="acTab"][data-k="recurrentes"]', t: 'Recurrentes', d: 'Alcaldía, Fospuca, alquileres, nómina… Cada vencimiento se confirma con su fecha, referencia y tasa.' }] },
    { id: 'adm-servicios', title: 'Servicios: precios y paquetes', desc: 'Para qué sirve la lista de precios y cómo mantenerla al día.', steps: [
      { go: 'servicios', setup: () => { UI.svTab = 'servicios'; UI.svArea = ''; }, el: '.main .head', t: 'Su lista de precios', d: 'Cada servicio tiene su precio y, si aplica, los insumos que gasta. Se usa sola al agendar una cita, al cobrar y al armar presupuestos.' },
      { go: 'servicios', setup: () => { UI.svTab = 'servicios'; }, el: '.main [data-act="svPending"], .main .list', t: 'Precios pendientes', d: 'Si hay servicios con precio provisional de $1, aparece un aviso arriba: toque "Poner precios", escriba los que sepa y guarde todos de una vez.' },
      { go: 'servicios', setup: () => { UI.svTab = 'servicios'; }, el: '.main .seg[aria-label="Área"]', t: 'Por área', d: 'Filtre por área o busque por nombre. Toque un servicio para cambiar su precio, cómo se cobra (por hora, por día) o los insumos que descuenta del inventario.' },
      { go: 'servicios', setup: () => { UI.svTab = 'paquetes'; }, el: '.main [data-act="svTab"][data-k="paquetes"]', t: 'Paquetes', d: 'Combinaciones listas para presupuestos, por ejemplo una cirugía con su quirófano, días de hospitalización, honorarios y material. Al presupuestar se elige el paquete y todo queda armado.' }] },
    { id: 'adm-usuarios', title: 'Usuarios y copias de seguridad', desc: 'Invitar personal y proteger la información.', steps: [
      { go: 'usuarios', el: '.main [data-act="userNew"]', t: 'Nuevo usuario', d: 'Nombre, correo y rol. Elija código de invitación (la persona crea su contraseña) o contraseña temporal.' },
      { go: 'usuarios', el: '.main .list', t: 'Gestión', d: 'Toque un usuario para cambiar su rol, desactivarlo o generarle un acceso nuevo.' },
      { go: 'ajustes', el: '.main [data-act="exportData"]', t: 'Copia de seguridad', d: 'Descargue una copia con frecuencia y guárdela fuera de este equipo. Se cifra con su clave: sin ella no se puede abrir, así que no la pierda. Puede probarla y restaurarla aquí mismo.' }] },
  ],
  recepcion: [
    { id: 'rec-general', title: 'Primeros pasos', desc: 'Su menú y la agenda.', steps: [MENU,
      { go: 'agenda', el: '.main .head .actions', t: 'Moverse por los días', d: 'Use ‹ Hoy › o el calendario para ver otro día.' },
      { go: 'agenda', setup: () => { UI.agTab = 'general'; }, el: '.main .seg', t: 'Agendas y directorio', d: 'General (todo el día), quirúrgica (quirófano), de consultas (una columna por médico, con su horario) y el directorio de médicos.' },
      { go: 'agenda', setup: () => { UI.agTab = 'directorio'; }, el: '.main .list', t: 'Derivaciones por agendar', d: 'Cuando un médico deriva un paciente a un colega, aparece arriba del directorio: toque "Agendar cita" y el formulario sale con el paciente y el médico ya elegidos.' },
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
      { go: 'agenda', el: '.main .seg', t: 'Su agenda', d: 'Solo ve sus citas y cirugías, y puede programar consultas y cirugías a su nombre.' },
      { go: 'agenda', setup: () => { UI.agTab = 'directorio'; }, el: '.main .list', t: 'Directorio de médicos', d: 'Todos los médicos de la clínica con su especialidad y horario. Con "Derivar paciente" le envía un paciente a un colega: sale la hoja de referencia con su firma y la derivación llega para agendarle la cita.' },
      ACCOUNT_CLIN, BACK_HERE()] },
    { id: 'med-consulta', title: 'Hacer una consulta', desc: 'Del paciente a la consulta firmada, con sus documentos.', steps: [
      { go: 'consultas', el: '.main [data-act="ccNewMenu"]', t: 'Nueva consulta', d: 'Empiece aquí. Busque al paciente o regístrelo, y elija consulta rápida (control o seguimiento) o completa.' },
      { go: 'consultas', open: () => ACTIONS.ccNewMenu(), el: '.sheet', t: 'Elegir al paciente', d: 'Busque por nombre o cédula. Si es nuevo, regístrelo sin salir de aquí.' },
      { go: 'consultas', t: 'Una pregunta por pantalla', d: 'Responda tocando las opciones; "Continuar" está siempre abajo. Para un control puede usar una plantilla (postoperatorio, resultados, HTA) o "Repetir el tratamiento anterior".' },
      { go: 'consultas', t: 'Firmar y entregar', d: 'Al firmar salen el informe, el récipe y las órdenes con su firma, cédula y número de colegiado. Desde la consulta firmada también emite constancia de asistencia, reposo e indicaciones para el paciente.' },
      { el: '.userbtn', t: 'Antes de firmar', d: 'Registre su número de Colegio de Médicos en Mi cuenta. Sin él el sistema no le deja firmar.' }] },
    { id: 'med-historia', title: 'Historia clínica e informes', desc: 'Escribir, firmar y descargar.', steps: [
      { go: 'pacientes', param: anyPatient, setup: () => { UI.patTab = 'resumen'; }, el: '.main .head .actions, .main .actions', t: 'En el perfil del paciente', d: '"Nueva historia" (consulta, evolución, nota operatoria o libre), "Informe médico" y "Solicitar examen".' },
      { go: 'pacientes', param: anyPatient, setup: () => { UI.patTab = 'evoluciones'; }, el: '.main [data-act="patTab"][data-k="evoluciones"]', t: 'Historia clínica', d: 'Todo lo firmado queda aquí y en el archivo de Historias. Una historia firmada no se modifica: se agrega una nota aclaratoria.' },
      { go: 'pacientes', param: anyPatient, setup: () => { UI.patTab = 'examenes'; }, el: '.main [data-act="patTab"][data-k="examenes"]', t: 'Exámenes', d: 'Resultados de laboratorio e imagen del paciente, incluidos los externos.' }] },
    { id: 'med-qx', title: 'Quirófano y hospitalización', desc: 'Material, cirugía realizada, evolución y alta.', steps: [
      { go: 'quirofano', el: '.main [data-act="qxSchedule"]', t: 'Programar su cirugía', d: 'Programe sus cirugías a su nombre: paciente, cirugía, anestesiólogo, duración y kit. El sistema impide choques de quirófano o de médicos.' },
      { go: 'quirofano', el: '.main [data-act="qxMedOrder"], .main .head', t: 'Pedir medicación e insumos', d: 'Para cada cirugía. Cirujano y anestesiólogo quedan fijos; la solicitud llega al almacén.' },
      { go: 'emergencias', el: '.bedgrid', t: 'Emergencias', d: 'Las 3 camas de emergencia funcionan como hospitalización: evolución, medicación y exámenes. Si el paciente se queda, "Pasar a hospitalización".' },
      { go: 'quirofano', el: '.main [data-act="qxDone"], .main .head', t: 'Cirugía realizada', d: 'Al terminar, regístrela con su duración real. Así entra en las estadísticas.' },
      { go: 'hospitalizacion', param: firstAdm, el: '.main .actions', t: 'El ingreso', d: '"Generar informe evolutivo" (la evolución del día, guiada), "Solicitar medicación", "Pedir exámenes" y "Dar de alta".' },
      { go: 'hospitalizacion', param: firstAdm, setup: () => { UI.hospTab = 'medicacion'; }, el: '.main [data-act="hospTab"][data-k="medicacion"]', t: 'Medicación', d: 'Lo solicitado, lo que entregó el almacén y cada aplicación registrada por enfermería.' }] },
  ],
  residente: [
    { id: 'res-general', title: 'Primeros pasos', desc: 'Hospitalización y consulta de pacientes.', steps: [MENU,
      { go: 'hospitalizacion', el: '.bedgrid', t: 'Mapa de camas', d: 'Toque una cama ocupada para trabajar en ese ingreso.' },
      { go: 'hospitalizacion', param: firstAdm, setup: () => { UI.hospTab = 'indicaciones'; }, el: '.main [data-act="hospTab"][data-k="indicaciones"]', t: 'Indicaciones de medicación', d: 'Deje aquí qué colocar, la dosis, la frecuencia y la duración. Enfermería lo ve en la cama con la hora de cada dosis. El pedido al almacén es aparte.' },
      { go: 'emergencias', el: '.bedgrid', t: 'Emergencias', d: 'Las 3 camas de emergencia funcionan como hospitalización: evolución, medicación y exámenes. Si el paciente se queda, "Pasar a hospitalización".' },
      { go: 'hospitalizacion', param: firstAdm, el: '.main .actions', t: 'En el ingreso', d: 'Con "Generar informe evolutivo" el sistema le guía en la evolución del día. También solicita medicación y pide exámenes; todo queda ligado a este ingreso.' },
      { go: 'hospitalizacion', param: firstAdm, setup: () => { UI.hospTab = 'evoluciones'; }, el: '.main .seg', t: 'Evoluciones, medicación y exámenes', d: 'Lo que se hizo durante la estancia, en orden.' },
      { go: 'pacientes', el: '#patQ', t: 'Pacientes', d: 'Consulte la ficha, la historia clínica y los exámenes de cualquier paciente.' },
      ACCOUNT_CLIN, BACK_HERE()] },
  ],
  enfermeria: [
    { id: 'enf-general', title: 'Primeros pasos', desc: 'Medicación en hospitalización y emergencias.', steps: [MENU,
      { go: 'hospitalizacion', el: '.bedgrid', t: 'Mapa de camas', d: 'Toque una cama ocupada para ver al paciente.' },
      { go: 'emergencias', el: '.bedgrid', t: 'Emergencias', d: 'Igual que en hospitalización: toque la cama, solicite la medicación y registre cada aplicación.' },
      { go: 'hospitalizacion', param: firstAdm, setup: () => { UI.hospTab = 'indicaciones'; }, el: '.main [data-act="hospTab"][data-k="indicaciones"]', t: 'Indicaciones del médico', d: 'Qué colocar, cuánto y cada cuánto, con la hora de la próxima dosis (rojo si está atrasada). Registre cada aplicación, o "No se aplicó" con el motivo.' },
      { go: 'hospitalizacion', param: firstAdm, el: '.main [data-act="newMedOrder"]', t: 'Solicitar medicación o material', d: 'Elija el medicamento, la cantidad y la frecuencia, y elija de la lista al médico que lo indicó. Llega al almacén.' },
      { go: 'hospitalizacion', param: firstAdm, setup: () => { UI.hospTab = 'medicacion'; }, el: '.main [data-act="hospTab"][data-k="medicacion"]', t: 'Aplicaciones', d: 'Cuando el almacén entrega, aparece "Registrar aplicación" en cada medicamento: hora y enfermera que la aplicó.' },
      { go: 'hospitalizacion', param: firstAdm, setup: () => { UI.hospTab = 'evoluciones'; }, el: '.main [data-act="hospTab"][data-k="evoluciones"]', t: 'Evoluciones', d: 'Lea lo que indicó el médico antes de pedir o aplicar.' },
      ACCOUNT, BACK_HERE()] },
  ],
  enfermeria_plus: [
    { id: 'enfp-general', title: 'Primeros pasos', desc: 'Medicación en hospitalización y quirófano, y programación de cirugías.', steps: [MENU,
      { go: 'hospitalizacion', el: '.bedgrid', t: 'Mapa de camas', d: 'Toque una cama ocupada para ver al paciente, sus indicaciones y su medicación.' },
      { go: 'emergencias', el: '.bedgrid', t: 'Emergencias', d: 'Igual que en hospitalización: toque la cama, solicite la medicación y registre cada aplicación.' },
      { go: 'quirofano', el: '.main [data-act="qxSchedule"]', t: 'Programar cirugía', d: 'Usted puede programar cirugías: elija paciente, cirugía, cirujano, anestesiólogo, duración y kit. El sistema impide choques de quirófano o de médicos.' },
      { go: 'quirofano', el: '.main [data-act="qxMedOrder"], .main .head', t: 'Material de la cirugía', d: 'Pida la medicación y los insumos de cada cirugía. Al terminar, regístrela como realizada y registre la devolución de lo que no se usó.' },
      ACCOUNT, BACK_HERE()] },
  ],
  almacen: [
    { id: 'alm-general', title: 'Primeros pasos', desc: 'Su menú, Inicio, el inventario y la agenda.', steps: [MENU,
      { go: 'inicio', el: '.main .today-intro', t: 'Inicio', d: 'Cómo está la clínica ahora y lo que requiere atención, igual que lo ve la administración.' },
      { go: 'inventario', setup: () => { UI.invTab = 'productos'; }, el: '.main .grid.g4', t: 'Resumen', d: 'Productos bajo mínimo y lotes por vencer.' },
      { go: 'inventario', el: '.main .seg.sec, .main [data-act="invTab"]', t: 'Secciones', d: 'Órdenes pendientes, productos, alertas, compras, mapa del almacén y movimientos.' },
      { go: 'inventario', setup: () => { UI.invTab = 'productos'; }, el: '.main .head .actions', t: 'Lo que usted puede hacer', d: '"Producto o lote nuevo (con foto)" para registrar la mercancía que llega, y "Hacer una solicitud extraordinaria" para lo que sale sin orden del médico. Las facturas y las entradas o salidas manuales las hace Administración.' },
      { go: 'agenda', setup: () => { UI.agTab = 'general'; }, el: '.main [data-act="newAppt"]', t: 'Agenda', d: 'Puede crear y editar citas y cirugías. El sistema avisa si el médico no atiende a esa hora o si hay un choque.' },
      ACCOUNT, BACK_HERE()] },
    { id: 'alm-despacho', title: 'Despachar una solicitud', desc: 'Lo que piden hospitalización y quirófano.', steps: [
      { go: 'inventario', setup: () => { UI.invTab = 'ordenes'; }, el: '.main [data-act="invTab"][data-k="ordenes"]', t: 'Órdenes pendientes', d: 'Aquí llega todo lo que se pide para pacientes. Las urgentes aparecen primero.' },
      { go: 'inventario', setup: () => { UI.invTab = 'ordenes'; }, el: '.main .stepper', t: 'Cuánto sale', d: 'Con − y + ajuste lo que realmente entrega. Si no hay suficiente, se entrega lo que hay y el resto queda pendiente.' },
      { go: 'inventario', setup: () => { UI.invTab = 'ordenes'; }, el: '.main [data-act="moDispatch"]', t: 'Confirmar', d: 'Se descuenta del inventario, primero el lote que vence antes. Si algo no llegará, use "Cerrar faltante" con el motivo.' },
      { go: 'quirofano', el: '.main .head', t: 'Ver lo que se pidió', d: 'En Quirófano y Hospitalización consulta qué se pidió para cada paciente; las solicitudes y las aplicaciones no las modifica.' }] },
    { id: 'alm-extra', title: 'Solicitud extraordinaria', desc: 'Sacar algo del almacén sin orden previa del médico.', steps: [
      { go: 'inventario', setup: () => { UI.invTab = 'ordenes'; }, el: '.main [data-act="extraReq"]', t: 'Solo con un motivo', d: 'Usted no hace entradas ni salidas libres: solo despacha lo que pide un médico. Si tuvo que entregar algo sin esa orden (por ejemplo, una urgencia en quirófano), regístrelo aquí.' },
      { go: 'inventario', setup: () => { UI.invTab = 'ordenes'; }, el: '.main [data-act="extraReq"]', t: 'Qué se pide', d: 'Los productos y cuántos salieron; para qué fue (cirugía, hospitalización, emergencia, consulta u otro); qué médico estaba atendiendo y para qué paciente.' },
      { go: 'inventario', setup: () => { UI.invTab = 'ordenes'; }, el: '.main [data-act="invTab"][data-k="ordenes"]', t: 'Queda registrado', d: 'Sale del inventario al guardar, se suma al ingreso o a la cirugía del paciente si los tiene, y aparece en "Solicitudes extraordinarias" para que Administración lo revise.' }] },
    { id: 'alm-compras', title: 'Productos, compras y alertas', desc: 'Entradas, órdenes de compra y vencimientos.', steps: [
      { go: 'inventario', setup: () => { UI.invTab = 'productos'; }, el: '.main [data-act="newProduct"]', t: 'Producto o lote nuevo (con foto)', d: 'Cuando llegan medicinas o material: tome 1 a 3 fotos (el frente de la caja y la cara con el lote y el vencimiento; también la nota de entrega si la hay). Las fotos son obligatorias y quedan guardadas con el lote.' },
      { go: 'inventario', setup: () => { UI.invTab = 'productos'; }, el: '.main [data-act="newProduct"]', t: 'Los datos del lote', d: 'Escriba el nombre, la concentración, el lote, el vencimiento y la cantidad. Si es un lote de un producto que ya existe, el sistema lo reconoce y agrega solo el lote nuevo.' },
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
      { go: 'inventario', setup: () => { UI.invTab = 'productos'; UI.invMode = 'producto'; }, open: () => { const p = S.products[0]; if (p) ACTIONS.openProduct({ dataset: { id: p.id } }); }, el: '.sheet [data-act="locEdit"]', t: 'Asignar o cambiar el lugar', d: 'Abra el producto y toque "Cambiar ubicación": elija el sector, la estantería y el nivel; el número de recipiente y un detalle son opcionales. Antes de guardar le muestra cómo quedará.' }] },
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
  TOUR = { t, i: 0, as: r }; document.body.classList.add('touring'); TOUR_ANIM.cur = null; document.addEventListener('keydown', tourKeys); window.addEventListener('resize', tourPlace); window.addEventListener('scroll', tourPlace, true); tourShow(); }
function tourEnd(done) {
  if (!TOUR) return; const id = TOUR.t.id; const as = TOUR.as; TOUR = null;
  if (UI.tourAs) { S.session = UI.tourAs; UI.tourAs = null; }   // vuelve a la vista del administrador
  document.removeEventListener('keydown', tourKeys); window.removeEventListener('resize', tourPlace); window.removeEventListener('scroll', tourPlace, true);
  ['tour-block', 'tour-spot', 'tour-tip'].forEach(x => document.getElementById(x)?.remove()); document.body.classList.remove('touring'); cancelAnimationFrame(TOUR_ANIM.raf); TOUR_ANIM.raf = 0; TOUR_ANIM.cur = null; closeSheet();
  if (as) { toast('De vuelta a su vista de administrador'); go('tutorial', null, { root: true }); return; }
  if (done) { const u = meUser(); if (u) { u.tours = { ...(u.tours || {}), [id]: dAt(0) }; save(); } toast('Recorrido terminado'); go('tutorial', null, { root: true }); }
}
const tourKeys = e => { if (!TOUR) return; if (e.key === 'Escape') tourEnd(false); else if (e.key === 'ArrowRight') tourNext(1); else if (e.key === 'ArrowLeft') tourNext(-1); };
function tourNext(d) { if (!TOUR) return; const n = TOUR.i + d; if (n < 0) return; if (n >= TOUR.t.steps.length) { tourEnd(true); return; } TOUR.i = n; tourShow(); }
// Espera a que la pantalla nueva esté pintada (con tope de 80 ms por si la pestaña no está dibujando)
const nextFrame = () => new Promise(r => { const t = setTimeout(r, 80); requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(t); r(); })); });
async function tourShow() {
  const st = TOUR.t.steps[TOUR.i]; const step = TOUR.i; closeSheet();
  if (st.setup) st.setup();
  // En modo tutorial las pantallas no hacen su animación de entrada: el resaltado sale ya en su sitio, sin esperas fijas
  if (st.go && canSee(st.go)) { const p = typeof st.param === 'function' ? st.param() : st.param || null; if (route !== st.go || param !== p) go(st.go, p, { root: true }); else render(); }
  if (st.open) { await nextFrame(); if (!TOUR || TOUR.i !== step) return; st.open(); }
  await nextFrame();
  if (!TOUR || TOUR.i !== step) return;   // se pasó de paso mientras tanto
  const mk = id => { let n = document.getElementById(id); if (!n) { n = document.createElement('div'); n.id = id; document.body.appendChild(n); } return n; };
  mk('tour-block'); mk('tour-spot');
  const tip = mk('tour-tip'); tip.setAttribute('role', 'dialog'); tip.setAttribute('aria-live', 'polite');
  const last = TOUR.i === TOUR.t.steps.length - 1;
  tip.innerHTML = `<div class="tour-tip-in"><div class="small muted">${TOUR.as ? `<span class="pill info">Viendo como ${esc(roleLabel(TOUR.as))}</span> ` : ''}${esc(TOUR.t.title)} · paso ${TOUR.i + 1} de ${TOUR.t.steps.length}</div><b style="font-size:17px">${esc(st.t)}</b><div style="line-height:1.5">${esc(st.d)}</div>
    <div class="between" style="margin-top:6px"><button class="btn ghost sm" data-act="tourExit">Salir</button><div class="hstack">${TOUR.i ? '<button class="btn sm" data-act="tourPrev">Anterior</button>' : ''}<button class="btn primary sm" data-act="tourNextBtn">${last ? 'Terminar' : 'Siguiente'}</button></div></div></div>`;
  const el = tourTarget(st.el);
  if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });
  TOUR.el = el; tourPlace();
  tip.querySelector('.btn.primary')?.focus({ preventScroll: true });
}
// En el teléfono parte del menú está en "Más secciones" y la cuenta en el botón redondo de arriba: se señala lo que sí se ve
function tourTarget(sel) {
  if (!sel) return null;
  const vis = q => [...document.querySelectorAll(q)].find(n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');
  return vis(sel) || (/^#side \[data-go=/.test(sel) ? vis('#more-sections-button') : sel === '.userbtn' ? vis('.global-topbar .shell-avatar') : null) || null;
}
// Movimiento con muelle (sin rebote, como iOS): sale desde donde está ahora, así que se puede interrumpir pasando rápido de paso
const TOUR_ANIM = { cur: null, tgt: null, vel: null, raf: 0, last: 0 };
const TOUR_KEYS = ['x', 'y', 'w', 'h', 'tx', 'ty'];
function tourAnimate(target, instant) {
  const A = TOUR_ANIM; A.tgt = target;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!A.cur || instant || reduce) { A.cur = { ...target }; A.vel = Object.fromEntries(TOUR_KEYS.map(k => [k, 0])); tourPaint(); return; }
  if (!A.raf) { A.last = performance.now(); A.raf = requestAnimationFrame(tourTick); }
}
function tourTick(now) {
  const A = TOUR_ANIM; A.raf = 0; if (!TOUR || !A.tgt || !A.cur) return;   // paso sin resaltado: no hay nada que mover
  let dt = Math.min(0.064, (now - A.last) / 1000); A.last = now;
  const w = 2 * Math.PI / 0.38; let moving = false;   // respuesta 0,38 s, amortiguación crítica
  while (dt > 0) { const h = Math.min(dt, 1 / 120); dt -= h;
    TOUR_KEYS.forEach(k => { const a = -w * w * (A.cur[k] - A.tgt[k]) - 2 * w * A.vel[k]; A.vel[k] += a * h; A.cur[k] += A.vel[k] * h; }); }
  TOUR_KEYS.forEach(k => { if (Math.abs(A.cur[k] - A.tgt[k]) > 0.3 || Math.abs(A.vel[k]) > 3) moving = true; else { A.cur[k] = A.tgt[k]; A.vel[k] = 0; } });
  tourPaint();
  if (moving) A.raf = requestAnimationFrame(tourTick);
}
function tourPaint() {
  const c = TOUR_ANIM.cur, spot = document.getElementById('tour-spot'), tip = document.getElementById('tour-tip'); if (!c || !spot || !tip) return;
  spot.style.transform = `translate3d(${c.x}px,${c.y}px,0)`; spot.style.width = c.w + 'px'; spot.style.height = c.h + 'px';
  if (!tip.classList.contains('docked') && !tip.classList.contains('center')) tip.style.transform = `translate3d(${c.tx}px,${c.ty}px,0)`;
}
function tourPlace(e) {
  if (!TOUR) return; const spot = document.getElementById('tour-spot'), tip = document.getElementById('tour-tip'), block = document.getElementById('tour-block'); if (!spot || !tip) return;
  const el = TOUR.el && TOUR.el.isConnected ? TOUR.el : null; const pad = 8; const vw = innerWidth, vh = innerHeight;
  const instant = e && e.type === 'scroll';   // al desplazarse el resaltado va pegado, sin muelle
  if (!el) { spot.style.display = 'none'; block.classList.add('dim'); tip.classList.remove('docked'); tip.classList.add('center'); tip.style.transform = ''; cancelAnimationFrame(TOUR_ANIM.raf); TOUR_ANIM.raf = 0; TOUR_ANIM.cur = null; return; }
  block.classList.remove('dim'); spot.style.display = 'block'; tip.classList.remove('center');
  const r = el.getBoundingClientRect();
  const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad), w = Math.min(vw - x - 4, r.width + pad * 2), h = Math.min(vh - y - 4, r.height + pad * 2);
  let tx = 0, ty = 0;
  if (vw < 640) {   // teléfono: la explicación va fija abajo, o arriba si lo señalado está en la mitad de abajo
    tip.classList.add('docked'); tip.style.transform = '';
    tip.classList.toggle('top', y + h / 2 > vh / 2);
  }
  else {
    tip.classList.remove('docked');
    const tw = Math.min(380, vw - 24); tip.style.width = tw + 'px';
    const th = tip.offsetHeight; ty = y + h + 12; tx = Math.min(Math.max(12, x), vw - tw - 12);
    if (ty + th > vh - 12) ty = y - th - 12;
    if (ty < 12) { ty = Math.min(vh - th - 12, Math.max(12, y)); tx = x + w + 12 + tw < vw ? x + w + 12 : Math.max(12, x - tw - 12); }
    ty = Math.min(Math.max(12, ty), vh - th - 12);
  }
  tourAnimate({ x, y, w, h, tx, ty }, instant);
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
