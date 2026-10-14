// Quirón — datos de ejemplo y motor de negocio.
// Regla central: toda salida de inventario, cobro y movimiento de caja nace de una operación
// (atención, compra, ajuste) y queda enlazada a ella, así las cuentas siempre cuadran.

const DAY = 864e5;
let TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);   // se actualiza si la app sigue abierta al cambiar el día
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const dAt = n => iso(new Date(TODAY.getTime() + n * DAY));
const uid = p => p + Math.random().toString(36).slice(2, 8);

// Los bolívares solo entran por medios digitales; el único efectivo es en dólares.
const METODOS = [
  { id: 'usd', name: 'Efectivo USD', cur: 'USD', igtf: true, cash: true },
  { id: 'zelle', name: 'Zelle', cur: 'USD', igtf: true },
  { id: 'pm', name: 'Pago móvil', cur: 'VES', igtf: false },
  { id: 'trf', name: 'Transferencia Bs', cur: 'VES', igtf: false },
  { id: 'pos', name: 'Punto de venta (Bs)', cur: 'VES', igtf: false },
];

// Médicos de ejemplo: solo sostienen los datos de demostración. Quedan inactivos y no aparecen en las listas.
const DEMO_DOCS = [
  { id: 'm1', name: 'Dra. Andrea Ruiz', esp: 'Cirugía general' },
  { id: 'm2', name: 'Dr. Luis Herrera', esp: 'Ginecología' },
  { id: 'm3', name: 'Dr. Pablo Méndez', esp: 'Anestesiología', anest: true },
  { id: 'm4', name: 'Dra. Carla Rojas', esp: 'Medicina interna' },
  { id: 'r1', name: 'Dr. Daniel Pérez', esp: 'Médico residente', resident: true },
  { id: 'r2', name: 'Dra. Sofía Marín', esp: 'Médico residente', resident: true },
].map(d => ({ ...d, example: true, active: false }));
// Personal médico real de la clínica (lista de la administración, 8 de octubre de 2026). Se modifica en Usuarios › Médicos.
const REAL_DOCS = [
  ['dr01', 'Dr. Thelmo Salazar', 'Urología'], ['dr02', 'Dr. Víctor Correa', 'Cirugía general y pediátrica'], ['dr03', 'Dr. Darío Meza', 'Cirugía general y pediátrica'],
  ['dr04', 'Dr. José Carrillo', 'Pediatría'], ['dr05', 'Dr. Luis Zapata', 'Pediatría'], ['dr06', 'Dra. Elvia Cuauro', 'Endocrinología'],
  ['dr07', 'Dra. Lubeixis Rodríguez', 'Ginecología'], ['dr08', 'Dr. Leopoldo Narváez', 'Ginecología y mastología'], ['dr09', 'Dr. Omar Cubero', 'Neurocirugía'],
  ['dr10', 'Dra. Izabel Vega', 'Gastroenterología'], ['dr11', 'Lic. Liliana De Freitas', 'Fonoaudiología'], ['dr12', 'Dr. Gerardo Silva', 'Cirugía plástica'],
  ['dr13', 'Dr. Alfonzo Ramos', 'Medicina interna y fisioterapia'], ['dr14', 'Dra. Vanesa Brito', 'Cardiología'], ['dr15', 'Dr. Eleazar Acosta', 'Nefrología'],
  ['dr16', 'Dr. Kemmel París', 'Otorrinolaringología'], ['dr17', 'Dr. Álvaro Barrientos', 'Traumatología'], ['dr18', 'Dr. Rafael Portales', 'Traumatología'],
  ['dr19', 'Dr. José Vivas', 'Anestesiología', { anest: true }], ['rs01', 'Dr. Pedro', 'Médico residente', { resident: true }],
].map(([id, name, esp, more]) => ({ id, name, esp, active: true, ...(more || {}) }));
// Enfermeras y sus días fijos de guardia (0 = domingo … 6 = sábado)
const REAL_NURSES = [{ name: 'Rosario Peña', days: [1, 4] }, { name: 'Mileidy Soto', days: [2, 3] }, { name: 'Daniela Tovar', days: [5] }].map(n => ({ ...n, active: true }));
const DEMO_NURSES = ['Lic. Carmen Díaz', 'Lic. Yolanda Pérez', 'Lic. Andreína Gómez', 'TSU Rosa Marín'];
const MEDICOS = [];   // se llena desde S.doctors (syncStaff)
const activeDocs = () => MEDICOS.filter(m => m.active !== false);
// La lista de enfermeras (nombres) y la guardia por día de la semana salen de S.nurseStaff
function syncStaff() {
  MEDICOS.splice(0, MEDICOS.length, ...(S.doctors || []));
  const act = (S.nurseStaff || []).filter(n => n.active !== false);
  S.nurses = act.map(n => n.name); S.nurseWeek = {}; act.forEach(n => (n.days || []).forEach(d => { S.nurseWeek[d] = n.name; }));
}

const CONSENTIMIENTOS = [
  'Consentimiento quirúrgico', 'Consentimiento anestésico',
  'Consentimiento de hospitalización', 'Autorización de procedimiento diagnóstico',
];

function seed() {
  const P = (id, name, cat, min, unit, lots) => ({ id, name, cat, min, unit, lots });
  const L = (num, qty, cost, exp, sup, brand = '') => ({ id: uid('l'), num, qty, cost, exp, sup, brand, recv: dAt(-40) });
  const products = [
    P('p1', 'Bombona de Oxígeno', 'Insumo', 5, 'Unidad', [L('OXI-01', 3, 15, null, 's2')]),
    P('p2', 'Kit de Paciente', 'Insumo', 5, 'Unidad', [L('KP-118', 4, 22, dAt(210), 's1')]),
    P('p3', 'Kit de Laparatomía', 'Insumo', 5, 'Unidad', [L('KL-044', 6, 48, dAt(25), 's1'), L('KL-051', 5, 48, dAt(300), 's1')]),
    P('p4', 'Seda 2/0 cortante', 'Sutura', 12, 'Unidad', [L('S20C-9', 30, 2.1, dAt(400), 's3', 'Ethicon')]),
    P('p5', 'Seda 3/0 cortante', 'Sutura', 12, 'Unidad', [L('S30C-2', 8, 2.1, dAt(55), 's3', 'Ethicon')]),
    P('p6', 'Seda 4/0 no cortante', 'Sutura', 12, 'Unidad', [L('S40N-7', 24, 2.3, dAt(380), 's3', 'Ethicon')]),
    P('p7', 'Caprofyl 4/0 no cortante', 'Sutura', 12, 'Unidad', [L('CAP-31', 18, 4.8, dAt(80), 's3', 'Ethicon')]),
    P('p8', 'Cefazolina 1 g', 'Medicamento', 20, 'Ampolla', [L('CEF-210', 14, 1.9, dAt(12), 's2', 'Vitalis'), L('CEF-233', 40, 1.9, dAt(520), 's2', 'Calox')]),
    P('p9', 'Ketorolaco 30 mg', 'Medicamento', 20, 'Ampolla', [L('KET-77', 26, 0.9, dAt(330), 's2', 'Leti'), L('KET-81', 20, 0.95, dAt(140), 's2', 'Behrens')]),
    P('p10', 'Ondansetrón 4 mg', 'Medicamento', 15, 'Ampolla', [L('OND-19', 9, 1.4, dAt(160), 's2', 'Genven')]),
    P('p11', 'Dexametasona 8 mg', 'Medicamento', 15, 'Ampolla', [L('DEX-50', 25, 0.8, dAt(-6), 's2', 'Behrens')]),
    P('p12', 'Gasas estériles 10x10', 'Insumo', 100, 'Paquete', [L('GAS-3', 240, 0.35, dAt(700), 's1')]),
    P('p13', 'Jeringa 10 ml', 'Insumo', 50, 'Unidad', [L('JER-8', 180, 0.18, dAt(900), 's1', 'Nipro')]),
    P('p14', 'Solución 0,9% 500 ml', 'Medicamento', 40, 'Bolsa', [L('SOL-61', 32, 1.1, dAt(240), 's2', 'Baxter')]),
    P('p15', 'Guantes estériles 7,5', 'Insumo', 30, 'Par', [L('GUA-14', 64, 0.6, dAt(600), 's1')]),
  ];
  // unit: servicio | hora | día | turno. perUnit: los insumos se descuentan por cada unidad (por día de hospitalización).
  // Los precios de $1 son provisionales ("por definir"); los demás son los que ya cobra la clínica.
  const V = (id, name, cat, price, o = {}) => ({ id, name, cat, price, unit: 'servicio', iva: false, items: [], ...o });
  const I = (pid, qty) => ({ pid, qty });
  const services = [
    V('v1', 'Consulta médica general', 'Consultas', 40),
    V('v12', 'Consulta de especialista', 'Consultas', 1), V('v13', 'Consulta de emergencia', 'Consultas', 1),
    V('v14', 'Control postoperatorio', 'Consultas', 1), V('v15', 'Valoración preanestésica', 'Consultas', 1), V('v16', 'Interconsulta', 'Consultas', 1),
    V('v4', 'Paquete Preoperatorio', 'Consultas', 100, { items: [I('p13', 2)] }),
    V('v5', 'Quirófano', 'Quirófano', 600, { unit: 'hora', tiers: [600, 1000, 1300], extra: 200, items: [I('p2', 1), I('p1', 1), I('p3', 1)] }),
    V('v17', 'Sala de procedimientos menores', 'Quirófano', 1, { items: [I('p15', 1), I('p12', 2)] }),
    V('v18', 'Recuperación postanestésica', 'Quirófano', 1, { unit: 'hora' }),
    V('v19', 'Material extraordinario', 'Quirófano', 1),
    V('v20', 'Cirujano principal', 'Honorarios', 1), V('v21', 'Ayudante quirúrgico', 'Honorarios', 1),
    V('v6', 'Anestesiólogo', 'Honorarios', 150, { items: [I('p8', 2), I('p10', 1), I('p9', 1)] }),
    V('v22', 'Instrumentista', 'Honorarios', 1), V('v7', 'Honorarios Médicos', 'Honorarios', 500),
    V('v23', 'Electrobisturí', 'Equipos', 1), V('v24', 'Torre de laparoscopia', 'Equipos', 1), V('v25', 'Arco en C', 'Equipos', 1), V('v26', 'Monitor multiparámetro', 'Equipos', 1),
    V('v10', 'Mesa de Tracción', 'Equipos', 65), V('v11', 'Casa Comercial Laparoscopio', 'Equipos', 400),
    V('v8', 'Hospitalización', 'Hospitalización', 350, { unit: 'día', perUnit: true, items: [I('p14', 2), I('p13', 3), I('p12', 4)] }),
    V('v27', 'Habitación individual', 'Hospitalización', 1, { unit: 'día' }), V('v28', 'Habitación compartida', 'Hospitalización', 1, { unit: 'día' }),
    V('v29', 'Observación', 'Hospitalización', 1, { unit: 'hora' }), V('v30', 'Acompañante', 'Hospitalización', 1, { unit: 'día' }),
    V('v31', 'Alimentación', 'Hospitalización', 1, { unit: 'día' }), V('v32', 'Enfermería privada', 'Hospitalización', 1, { unit: 'turno' }),
    V('v33', 'Día de UCI', 'UCI', 1, { unit: 'día', perUnit: true, items: [I('p14', 3), I('p13', 4), I('p15', 4)] }),
    V('v34', 'Cuidados intermedios', 'UCI', 1, { unit: 'día' }), V('v35', 'Ventilación mecánica', 'UCI', 1, { unit: 'día' }), V('v36', 'Monitoreo hemodinámico', 'UCI', 1, { unit: 'día' }),
    V('v9', 'Servicio de Atención 24h', 'Emergencia y enfermería', 400, { items: [I('p14', 1), I('p9', 1)] }),
    V('v37', 'Cura simple', 'Emergencia y enfermería', 1, { items: [I('p12', 2), I('p15', 1)] }), V('v38', 'Cura compleja', 'Emergencia y enfermería', 1, { items: [I('p12', 4), I('p15', 2)] }),
    V('v39', 'Sutura de herida', 'Emergencia y enfermería', 1, { items: [I('p5', 1), I('p12', 2), I('p15', 1)] }), V('v40', 'Retiro de puntos', 'Emergencia y enfermería', 1, { items: [I('p15', 1)] }),
    V('v41', 'Colocación de vía endovenosa', 'Emergencia y enfermería', 1, { items: [I('p13', 1)] }), V('v42', 'Administración de medicamento IM/IV', 'Emergencia y enfermería', 1, { items: [I('p13', 1)] }),
    V('v43', 'Hidratación endovenosa', 'Emergencia y enfermería', 1, { items: [I('p14', 1)] }), V('v44', 'Nebulización', 'Emergencia y enfermería', 1), V('v45', 'Oxígeno', 'Emergencia y enfermería', 1, { unit: 'hora' }),
    V('v2', 'Ecografía', 'Imagen y diagnóstico', 50, { items: [I('p15', 1)] }),
    V('v46', 'Ecografía abdominal', 'Imagen y diagnóstico', 1), V('v47', 'Ecografía pélvica', 'Imagen y diagnóstico', 1), V('v48', 'Ecografía obstétrica', 'Imagen y diagnóstico', 1),
    V('v49', 'Ecografía mamaria', 'Imagen y diagnóstico', 1), V('v50', 'Ecografía de partes blandas', 'Imagen y diagnóstico', 1), V('v51', 'Ecografía doppler', 'Imagen y diagnóstico', 1),
    V('v3', 'Rayos X', 'Imagen y diagnóstico', 30), V('v52', 'Rayos X de tórax', 'Imagen y diagnóstico', 1), V('v53', 'Rayos X de columna', 'Imagen y diagnóstico', 1), V('v54', 'Rayos X de extremidades', 'Imagen y diagnóstico', 1),
    V('v55', 'Electrocardiograma', 'Imagen y diagnóstico', 1),
    V('v56', 'Toma de muestra (laboratorio externo)', 'Laboratorio', 1, { items: [I('p13', 1), I('p15', 1)] }),
    V('v57', 'Informe médico', 'Administrativos', 1), V('v58', 'Constancia médica', 'Administrativos', 1), V('v59', 'Copia de historia clínica', 'Administrativos', 1),
  ];
  const patients = [
    { id: 'pt1', code: 'QRN-000101', name: 'María Fernanda González', ci: 'V-14.882.310', phone: '0414-555-2381', address: 'Los Palos Grandes, Caracas', birth: '1986-03-11', sex: 'F', blood: 'O+', allergies: ['Penicilina'], conditions: ['Hipotiroidismo'], meds: ['Levotiroxina 50 mcg'], surgeries: ['Cesárea (2019)'], emergency: 'José González · 0412-555-0190', notes: [{ d: dAt(-30), by: 'Dr. Luis Herrera', t: 'Control ginecológico. Ecografía sin hallazgos. Control en 6 meses.' }], consents: [{ type: 'Autorización de procedimiento diagnóstico', d: dAt(-30), signer: 'María Fernanda González' }] },
    { id: 'pt2', code: 'QRN-000102', name: 'Ricardo Salazar', ci: 'V-9.405.117', phone: '0424-555-7702', address: 'El Cafetal, Caracas', birth: '1971-08-02', sex: 'M', blood: 'A+', allergies: [], conditions: ['Hipertensión arterial'], meds: ['Losartán 50 mg'], surgeries: [], emergency: 'Ana Salazar · 0414-555-4410', notes: [{ d: dAt(-3), by: 'Dra. Andrea Ruiz', t: 'Hernia inguinal derecha. Se indica herniorrafia. Preoperatorio solicitado.' }], consents: [] },
    { id: 'pt3', code: 'QRN-000103', name: 'Valentina Torres', ci: 'V-27.310.448', phone: '0412-555-3399', address: 'Chacao, Caracas', birth: '1999-12-20', sex: 'F', blood: 'B+', allergies: ['Ibuprofeno'], conditions: [], meds: [], surgeries: [], emergency: 'Luisa Torres · 0416-555-8820', notes: [], consents: [] },
    { id: 'pt4', code: 'QRN-000104', name: 'Jorge Castillo', ci: 'V-11.220.905', phone: '0416-555-1250', address: 'La Trinidad, Caracas', birth: '1965-05-30', sex: 'M', blood: 'O-', allergies: [], conditions: ['Diabetes tipo 2'], meds: ['Metformina 850 mg'], surgeries: ['Colecistectomía (2015)'], emergency: 'Carmen Castillo · 0424-555-6610', notes: [], consents: [] },
  ];
  // kind: consulta | cirugia. En cirugías, doc = médico tratante, hours = duración estimada, anest = anestesiólogo
  const C = (d, time, pid, doc, svc, status) => ({ id: uid('a'), kind: 'consulta', date: dAt(d), time, pid, doc, svc, status, inv: null });
  const Q = (d, time, pid, doc, proc, hours, anest, status) => ({ id: uid('a'), kind: 'cirugia', date: dAt(d), time, pid, doc, svc: 'v5', proc, hours, anest, status, inv: null });
  const appts = [
    C(0, '08:00', 'pt1', 'm2', 'v2', 'atendida'), C(0, '09:30', 'pt2', 'm1', 'v4', 'en_espera'), C(0, '11:00', 'pt4', 'm4', 'v1', 'confirmada'),
    C(0, '14:00', 'pt3', 'm2', 'v12', 'reservada'), C(0, '15:30', 'pt1', 'm4', 'v14', 'reservada'),
    Q(0, '07:00', 'pt4', 'm1', 'Colecistectomía laparoscópica', 2, 'm3', 'en_espera'),
    Q(0, '13:00', 'pt3', 'm2', 'Histeroscopia diagnóstica', 1, 'm3', 'confirmada'),
    Q(1, '07:00', 'pt2', 'm1', 'Herniorrafia inguinal derecha', 2, 'm3', 'confirmada'),
    C(1, '10:00', 'pt3', 'm2', 'v2', 'reservada'), C(2, '09:00', 'pt4', 'm4', 'v1', 'reservada'),
  ];
  // Horario de consulta de cada médico: día de la semana (0 = domingo) → { from, to }. Ejemplos variados;
  // incluyen los días de las citas de ejemplo para que la agenda inicial sea coherente.
  const dow = n => new Date(TODAY.getTime() + n * DAY).getDay();
  const H = (days, from, to) => Object.fromEntries([...new Set(days)].map(d => [d, { from, to }]));
  const hours = {
    m1: H([1, 2, 3, 4, 5, dow(0), dow(1)], '08:00', '12:00'),          // Dra. Ruiz: mañanas
    m2: H([dow(0), dow(1)], '08:00', '16:00'),                          // Dr. Herrera: dos días a la semana
    m4: H([1, 2, 3, 4, 5, 6, dow(0), dow(2)], '09:00', '17:00'),       // Dra. Rojas
    m3: {},                                                              // Anestesiología: no da consulta
  };
  // Guardia de cada día: médico y enfermera (rotación de ejemplo, de hace 14 días a dentro de 7)
  const nurses = ['Lic. Carmen Díaz', 'Lic. Yolanda Pérez', 'Lic. Andreína Gómez', 'TSU Rosa Marín'];
  const duty = {};
  for (let d = -14; d <= 7; d++) duty[dAt(d)] = { doc: DEMO_DOCS[(d + 20) % 4].id === 'm3' ? 'm4' : DEMO_DOCS[(d + 20) % 4].id, nurse: nurses[(d + 21) % 4] };
  const suppliers = [
    { id: 's1', name: 'Distribuidora Médica Andina', rif: 'J-40122334-5', phone: '0212-555-1020', contact: 'Carolina Pérez', days: 3 },
    { id: 's2', name: 'Farmacéutica del Valle', rif: 'J-30988776-1', phone: '0212-555-8811', contact: 'Miguel Ortega', days: 2 },
    { id: 's3', name: 'Suturas y Materiales CA', rif: 'J-41200987-0', phone: '0241-555-3300', contact: 'Rosa Medina', days: 5 },
  ];
  const orders = [
    { id: 'oc0', num: 'OC-0006', sup: 's3', date: dAt(-3), status: 'aprobada', by: 'Almacén', lines: [{ pid: 'p5', qty: 24, cost: 2.1 }],
      payment: { date: dAt(-2), at: dAt(-2) + ' 11:20', by: 'Administrador', method: 'Transferencia USD', cur: 'USD', amount: 50.4, rate: 866.56, ref: '004512' } },
    { id: 'oc1', num: 'OC-0007', sup: 's2', date: dAt(-1), status: 'por_aprobar', by: 'Almacén', note: 'Se acaba el ondansetrón.', lines: [{ pid: 'p10', qty: 20, cost: 1.4 }, { pid: 'p11', qty: 30, cost: 0.8 }] },
  ];
  const moves = [];
  [[-5, 410], [-4, 455], [-3, 390], [-2, 520], [-1, 610]].forEach(([m, usd]) => {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() + m, 15);
    moves.push({ id: uid('mv'), date: iso(d), type: 'consumo', pid: null, name: 'Consumo del mes (histórico)', qty: 0, cost: usd, ref: 'Histórico', user: 'Sistema' });
  });
  const inv0 = {
    id: 'f0', num: 'F-00041', control: '00-000041', pid: 'pt1', date: dAt(0), doc: 'm2', disc: 0, proc: 'Ecografía pélvica de control',
    items: [{ sid: 'v2', name: 'Ecografía', base: 50, adj: 0, price: 50, iva: false }], cost: 0.6,
    payments: [{ id: uid('pg'), method: 'zelle', amount: 50, cur: 'USD', rate: 866.56, usd: 50, igtf: 1.5, at: dAt(0) + ' 08:40' }],
    status: 'pagada',
  };
  // Presupuestos de ejemplo, uno en cada paso, armados desde los paquetes
  const packages = typeof seedPackages === 'function' ? seedPackages() : [];
  const BP = (id, num, pid, doc, d, pk, status, more = {}) => ({ id, num, pid, doc, date: dAt(d), valid: 15, status, inv: null, ...budgetFromPkg(packages.find(p => p.id === pk)), ...more });
  const budget0 = BP('b0', 'P-0012', 'pt2', 'm1', -3, 'pk2', 'abierto', { proc: 'Herniorrafia inguinal derecha', adj: 10, disc: 5 });
  const budget1 = BP('b1', 'P-0011', 'pt3', 'm1', -2, 'pk1', 'enviado', { sentAt: dAt(-1) + ' 10:20', sentBy: 'Administrador' });
  const budget2 = BP('b2', 'P-0010', 'pt4', 'm1', -6, 'pk3', 'enviado', { sentAt: dAt(-4) + ' 09:00', acceptedAt: dAt(-3) + ' 11:40' });
  return {
    rate: 866.56, rateDate: '2026-10-02', rateSource: 'BCV vía DolarAPI', ivaRate: 16, igtfRate: 3, invSeq: 42, cobSeq: 1, ocSeq: 8, budSeq: 13, packages,
    clinic: { name: 'Quirón Especialidades Médicas', rif: 'J-50213973', address: 'Caracas, Venezuela', phone: '0212-000-0000', email: 'administracion@quiron.com', note: 'Gracias por confiar en Clínica Quirón.' },
    products, services, patients, appts, suppliers, orders, moves, nurses, duty, hours, doctors: [...REAL_DOCS, ...DEMO_DOCS].map(d => ({ ...d })), nurseStaff: REAL_NURSES.map(n => ({ ...n, days: [...n.days] })),
    invoices: [inv0], budgets: [budget0, budget1, budget2], ...(typeof seedHosp === 'function' ? seedHosp(products, moves) : { admissions: [], medOrders: [], mar: [], hosSeq: 1, moSeq: 1 }),
    ...(c => ({ hc: c.notes.concat(typeof hospNotes !== 'undefined' ? hospNotes.map(n => ({ ...n, date: dAt(-1), signedAt: dAt(-1) + ' 19:10' })) : []), exams: c.exams, exSeq: c.exSeq, labCatalog: c.labCatalog, labCatalogMeta: c.labCatalogMeta, clinicLab2026: c.clinicLab2026 }))(typeof seedClinical === 'function' ? seedClinical() : { notes: [], exams: [], exSeq: 1 }),
    session: { role: 'admin', doc: null },
    records: (typeof seedRecords === 'function' ? seedRecords() : []), ledger: (typeof seedLedger === 'function' ? seedLedger() : []), recurring: (typeof seedRecurring === 'function' ? seedRecurring() : []),
    cash: { open: { at: dAt(0) + ' 07:45', by: 'Recepción', floatUSD: 100 }, moves: [{ id: uid('c'), at: dAt(0) + ' 08:40', kind: 'cobro', method: 'zelle', amount: 51.5, cur: 'USD', ref: 'F-00041' }], closures: [
      { date: dAt(-1), expectedUSD: 1430, countedUSD: 1430, digitalVES: 412300, by: 'Recepción' },
    ] },
    audit: [{ at: dAt(0) + ' 08:40', user: 'Recepción', action: 'Cobro registrado', ref: 'F-00041 · Zelle 50,00 USD' }],
    backups: [
      { at: dAt(0) + ' 03:00', size: '4,8 MB', kind: 'Automático', ok: true },
      { at: dAt(-1) + ' 03:00', size: '4,7 MB', kind: 'Automático', ok: true },
      { at: dAt(-2) + ' 03:00', size: '4,7 MB', kind: 'Automático', ok: true },
    ],
    backupCfg: { hour: '03:00', keep: 30, offsite: true },
    user: 'Recepción',
  };
}

// ---------- Estado ----------
// Se guarda en este navegador. La clave ya no cambia entre versiones: los cambios de estructura se migran (migrate()).
// Si los datos guardados están dañados no se reemplazan en silencio: se conserva una copia y se avisa.
// Cada guardado aumenta un número de revisión; si otra pestaña guardó antes, esta no sobrescribe.
const KEY = 'quiron-demo-v18';
const REV_KEY = KEY + '-rev';
const SCHEMA = 2;
const STORE = { error: null, blocked: false, stale: false, rev: 0, badKey: null };
let S;
(function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); STORE.rev = +(localStorage.getItem(REV_KEY) || 0); }
  catch (e) { STORE.error = 'El navegador no permite leer los datos guardados. Los cambios no se conservarán al cerrar.'; }
  if (raw) {
    try { S = JSON.parse(raw); return; }
    catch (e) {
      STORE.badKey = KEY + '-danado-' + Date.now(); try { localStorage.setItem(STORE.badKey, raw); } catch (_) {}
      STORE.blocked = true;
      STORE.error = 'Los datos guardados en este navegador están dañados. Se conservaron intactos y no se guardará nada hasta que decida: descargarlos, restaurar una copia o empezar con datos de ejemplo.';
    }
  }
  S = seed(); S.schema = SCHEMA;
})();
// Devuelve true solo si el cambio quedó guardado; si no, muestra el aviso fijo
function save() {
  if (STORE.blocked) { sysNotice(); return false; }
  try {
    const cur = +(localStorage.getItem(REV_KEY) || 0);
    if (cur > STORE.rev) { STORE.stale = true; STORE.error = 'Los datos se modificaron en otra pestaña o ventana. Para no sobrescribir esos cambios, este no se guardó. Recargue la página.'; sysNotice(); return false; }
    // Datos y revisión forman una misma operación. Si falla la revisión, restaure el JSON anterior.
    const previousRaw = localStorage.getItem(KEY);
    localStorage.setItem(KEY, JSON.stringify(S));
    try { localStorage.setItem(REV_KEY, String(cur + 1)); }
    catch (revisionError) {
      try { if (previousRaw === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, previousRaw); }
      catch (_) { STORE.blocked = true; } // no siga escribiendo si el almacenamiento impide restaurar
      throw revisionError;
    }
    STORE.rev = cur + 1;
    if (STORE.error && !STORE.stale) { STORE.error = null; sysNotice(); }
    return true;
  } catch (e) {
    STORE.error = 'No se pudo guardar el último cambio (almacenamiento lleno o bloqueado). Descargue una copia de seguridad de inmediato.'; sysNotice(); return false;
  }
}
const sysNotice = () => { if (typeof renderSysBar === 'function') renderSysBar(); };
window.addEventListener('storage', e => { if (e.key === REV_KEY && +(e.newValue || 0) > STORE.rev) { STORE.stale = true; STORE.error = 'Los datos se modificaron en otra pestaña o ventana. Recargue la página para ver la versión más reciente; mientras tanto, esta pestaña no guardará cambios.'; sysNotice(); } });
function resetDemo() {
  const keepUsers = S?.users || [], keepSession = S?.session;   // los usuarios y la sesión no se pierden al restablecer
  S = seed(); S.users = keepUsers; S.session = keepSession; S.schema = SCHEMA; STORE.blocked = false; STORE.stale = false; STORE.error = null;
  try { STORE.rev = +(localStorage.getItem(REV_KEY) || 0); } catch (e) {}
  migrate(); save(); if (typeof runRecurrents === 'function') runRecurrents(); sysNotice();
}

// ---------- Utilidades ----------
const byId = (arr, id) => arr.find(x => x.id === id);
const prod = id => byId(S.products, id);
const svc = id => byId(S.services, id);
const pat = id => byId(S.patients, id);
const med = id => byId(MEDICOS, id);
const sup = id => byId(S.suppliers, id);
const metodo = id => byId(METODOS, id);
const r2 = n => Math.round(n * 100) / 100;
const fmt = (n, cur = 'USD') => n < 0 ? '-' + fmt(-n, cur) : cur === 'VES'
  ? 'Bs ' + Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '$' + Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const daysTo = s => s ? Math.round((new Date(s + 'T00:00') - TODAY) / DAY) : Infinity;
const fdate = s => new Date(s + 'T00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' });
const fday = s => new Date(s + 'T00:00').toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' });
const age = b => Math.floor((TODAY - new Date(b + 'T00:00')) / (365.25 * DAY));
// Edad para mostrar: los pacientes traídos del archivo escaneado no tienen fecha de nacimiento, solo la edad que consta en su historia
// Si solo se conoce la edad que tenía en un año (historias escaneadas), se calcula la de hoy sumando los años pasados
const ageTxt = p => p.birth ? `${age(p.birth)} años` : p.ageAt ? `${+p.ageAt.age + Math.max(0, +dAt(0).slice(0, 4) - (parseInt(p.ageAt.year, 10) || +dAt(0).slice(0, 4)))} años` : 'edad no registrada';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowStamp = () => { const d = new Date(); return iso(d) + ' ' + d.toTimeString().slice(0, 5); };
// Quién hace la acción: el médico, el laboratorio o rayos X que esté usando el sistema
const actor = () => { const s = S.session || {}; return s.name ? s.name : s.role === 'enfermeria' ? 'Enfermería' : ['medico', 'residente'].includes(s.role) ? (med(s.doc)?.name || 'Médico') : s.role === 'almacen' ? 'Almacén' : s.role === 'laboratorio' ? 'Laboratorio' : s.role === 'imagen' ? 'Rayos X e imagen' : s.role === 'recepcion' ? 'Recepción' : 'Administrador'; };
function log(action, ref) { S.audit.unshift({ at: nowStamp(), user: actor(), action, ref }); }

// ---------- Inventario (siempre por lote) ----------
const stock = p => (p?.lots || []).reduce((a, l) => a + l.qty, 0);
const fefo = p => (p?.lots || []).filter(l => l.qty > 0 && daysTo(l.exp) >= 0).sort((a, b) => daysTo(a.exp) - daysTo(b.exp));
const usable = p => fefo(p).reduce((a, l) => a + l.qty, 0);
const avgCost = p => { const q = stock(p); return q ? (p?.lots || []).reduce((a, l) => a + l.qty * l.cost, 0) / q : (p?.lots?.at(-1)?.cost || 0); };
const invValue = () => S.products.reduce((a, p) => a + p.lots.reduce((b, l) => b + l.qty * l.cost, 0), 0);
function stockState(p) {
  const q = usable(p);
  if (q === 0) return stock(p) > 0 ? { k: 'bad', t: 'Solo vencidos' } : { k: 'bad', t: 'Agotado' };   // lo que hay está vencido: no se despacha, hay que retirarlo
  if (q < p.min) return { k: 'warn', t: 'Bajo mínimo' };
  return { k: 'good', t: 'Disponible' };
}
function lotState(l) {
  const d = daysTo(l.exp);
  if (d < 0) return { k: 'bad', t: 'Vencido' };
  if (d <= 30) return { k: 'warn', t: `Vence en ${d} d` };
  if (d <= 90) return { k: 'info', t: `Vence en ${d} d` };
  return { k: 'good', t: l.exp ? 'Vigente' : 'No vence' };
}

function checkStock(lines) {
  const need = {};
  lines.forEach(l => { need[l.pid] = (need[l.pid] || 0) + l.qty; });
  return Object.entries(need).filter(([pid, q]) => usable(prod(pid)) < q)
    .map(([pid, q]) => ({ pid, need: q, have: usable(prod(pid)) }));
}

// Descuenta por FEFO (vence primero, sale primero). Devuelve los lotes usados y su costo.
function takeStock(pid, qty, type, ref) {
  const p = prod(pid); let left = qty; const used = [];
  for (const l of fefo(p)) {
    if (!left) break;
    const n = Math.min(l.qty, left); l.qty -= n; left -= n;
    used.push({ lot: l.num, qty: n, cost: l.cost });
  }
  const cost = r2(used.reduce((a, u) => a + u.qty * u.cost, 0));
  S.moves.unshift({ id: uid('mv'), date: dAt(0), type, pid, name: p.name, cat: p.cat, qty: -qty, cost, ref, user: S.user, lots: used.map(u => u.lot).join(', ') });
  return { used, cost };
}

function addLot(pid, { num, qty, cost, exp, sup: s, brand }, ref) {
  const p = prod(pid);
  p.lots.push({ id: uid('l'), num: num || ('L-' + Date.now().toString().slice(-5)), qty, cost, exp: exp || null, sup: s || null, brand: brand || '', recv: dAt(0) });
  S.moves.unshift({ id: uid('mv'), date: dAt(0), type: 'entrada', pid, name: p.name, cat: p.cat, qty, cost: r2(qty * cost), ref, user: S.user, lots: num });
}

function alerts() {
  const low = S.products.filter(p => usable(p) < p.min);
  const exp = [];
  S.products.forEach(p => p.lots.forEach(l => {
    const d = daysTo(l.exp);
    if (l.qty > 0 && d <= 90) exp.push({ p, l, d });
  }));
  exp.sort((a, b) => a.d - b.d);
  return { low, exp, expired: exp.filter(e => e.d < 0), soon: exp.filter(e => e.d >= 0 && e.d <= 30) };
}

function monthlyConsumption(months = 6) {
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1);
    const key = iso(d).slice(0, 7);
    const usd = S.moves.filter(m => (m.type === 'consumo' || m.type === 'salida') && m.date.slice(0, 7) === key).reduce((a, m) => a + m.cost, 0);
    out.push({ key, label: d.toLocaleDateString('es-VE', { month: 'short' }).replace('.', ''), usd: r2(usd) });
  }
  return out;
}

// ---------- Precios: unidad, tarifa escalonada, aumento por servicio (oculto) y cortesía (visible) ----------
const UNITS = { servicio: ['', ''], hora: ['hora', 'horas'], 'día': ['día', 'días'], turno: ['turno', 'turnos'] };
const unitWord = (s, n) => s.unit && s.unit !== 'servicio' ? `${n} ${UNITS[s.unit][n === 1 ? 0 : 1]}` : '';
// Tarifa escalonada: tiers[n-1] es el precio por n unidades; después de la última, "extra" por cada unidad adicional
function svcPrice(s, n = 1) {
  n = Math.max(1, Math.ceil(n));
  if (s.tiers?.length) return n <= s.tiers.length ? s.tiers[n - 1] : s.tiers.at(-1) + (n - s.tiers.length) * (s.extra || 0);
  return r2(s.price * (s.unit && s.unit !== 'servicio' ? n : 1));
}
const tierText = s => s.tiers?.length ? s.tiers.map((p, i) => `${i + 1} ${UNITS[s.unit][i ? 1 : 0]} $${p.toLocaleString('es-VE')}`).join(' · ') + (s.extra ? ` · cada ${UNITS[s.unit][0]} extra $${s.extra}` : '') : '';
// El aumento se suma al precio de la línea y nunca se muestra; la cortesía se muestra como descuento.
function buildItems(serviceIds, extras = [], adj = {}, qty = {}) {
  const items = serviceIds.map(sid => { const s = svc(sid); const a = +adj[sid] || 0; const n = qty[sid] || 1; const base = svcPrice(s, n);
    return { sid, qty: n, name: s.name + (unitWord(s, n) ? ` · ${unitWord(s, n)}` : ''), base, adj: a, price: r2(base * (1 + a / 100)), iva: false }; });
  extras.forEach(e => { const p = prod(e.pid); const unit = r2(avgCost(p) * 1.3);
    items.push({ pid: e.pid, name: `${p.name} ×${e.qty}`, base: r2(unit * e.qty), adj: 0, price: r2(unit * e.qty), iva: false }); });
  return items;
}
function totalsOf(items, disc = 0) {
  const k = 1 - (disc || 0) / 100;
  const sub = r2(items.reduce((a, i) => a + i.price, 0));
  // Servicios médicos: todo es exento de IVA (base imponible e IVA siempre en cero)
  const exSub = items.reduce((a, i) => a + i.price, 0);
  const baseSub = 0;
  const desc = r2(sub * (disc || 0) / 100);
  const exento = r2(exSub * k), base = r2(baseSub * k);
  const iva = r2(base * S.ivaRate / 100);
  return { sub, desc, disc: disc || 0, exento, base, iva, total: r2(exento + base + iva) };
}
function bundleLines(serviceIds, extras = [], qty = {}) {
  const lines = [];
  serviceIds.forEach(sid => { const s = svc(sid); const k = s.perUnit ? Math.max(1, Math.ceil(qty[sid] || 1)) : 1; s.items.forEach(it => lines.push({ pid: it.pid, qty: it.qty * k, from: s.name })); });
  extras.forEach(e => lines.push({ pid: e.pid, qty: e.qty, from: 'Agregado' }));
  return lines;
}

// ---------- Presupuesto (no toca inventario) ----------
function createBudget({ pid, doc, serviceIds, extras, adj, qty = {}, disc, proc, valid = 15 }) {
  const b = { id: uid('b'), num: 'P-' + String(S.budSeq++).padStart(4, '0'), pid, doc, date: dAt(0), valid, disc: +disc || 0, proc: proc || '', serviceIds: [...serviceIds], extras: extras.map(e => ({ ...e })), adj: { ...adj }, qty: { ...qty }, status: 'abierto', inv: null };
  S.budgets.unshift(b);
  log('Presupuesto creado', `${b.num} · ${pat(pid).name}`);
  save();
  return b;
}
// Un presupuesto emitido conserva sus precios (b.items); los cambios de tarifas no lo modifican
const budgetItems = b => b.items || (b.v2 ? pkgItems(b) : buildItems(b.serviceIds, b.extras, b.adj, b.qty || {}));
const budgetTotals = b => totalsOf(budgetItems(b), b.disc);

// ---------- Atención → factura (todo en una operación) ----------
function createAttention({ pid, doc, serviceIds, extras = [], adj = {}, qty = {}, disc = 0, proc = '', apptId, budgetId, fiscal = false, sheets, fiscalDetails = {} }) {
  if (budgetId && byId(S.budgets, budgetId)?.status === 'facturado') return { ok: false, msg: 'Este presupuesto ya tiene un cobro registrado.' };
  const lines = bundleLines(serviceIds, extras, qty);
  const missing = checkStock(lines);
  if (missing.length) return { ok: false, missing };
  if (fiscal) { const error = facturaSheetError(sheets); if (error) return { ok: false, msg: error }; }
  const n = chargeNumber(fiscal, sheets); const num = n.num;   // la factura fiscal es opcional
  let cost = 0;
  lines.forEach(l => { cost += takeStock(l.pid, l.qty, 'consumo', num).cost; });
  const inv = { id: uid('f'), ...n, pid, doc, date: dAt(0), disc: +disc || 0, proc, items: budgetId ? budgetItems(byId(S.budgets, budgetId)).map(x => ({ ...x })) : buildItems(serviceIds, extras, adj, qty), cost: r2(cost), payments: [], status: 'pendiente', budget: budgetId || null, ...(fiscal ? { rate: S.rate, issueDate: dAt(0), ...fiscalDetails } : {}) };
  S.invoices.unshift(inv);
  if (apptId) { const a = byId(S.appts, apptId); if (a) { a.status = 'atendida'; a.inv = inv.id; } }
  if (budgetId) { const b = byId(S.budgets, budgetId); if (b) { b.status = 'facturado'; b.inv = inv.id; } }
  log('Atención registrada', `${num} · ${pat(pid).name} · ${lines.length} insumos descontados`);
  save();
  return { ok: true, inv };
}

const invTotals = inv => totalsOf(inv.items, inv.disc || 0);
// Cuentas y facturas se expresan en Bs (los presupuestos siguen en dólares). Por dentro los montos se guardan en USD.
// Tasa de la cuenta: la factura fiscal queda fija a la tasa BCV del día en que se emite; una cuenta sin factura
// fiscal usa la tasa BCV del día mientras esté pendiente y queda fija con la tasa del cobro que la salda.
const invRate = inv => inv.rate || S.rate;
const bsOf = (usd, inv) => fmt(usd * invRate(inv), 'VES');
const bsSum = (list, f) => fmt(list.reduce((a, i) => a + f(i) * invRate(i), 0), 'VES');
const invPaid = inv => r2(inv.payments.reduce((a, p) => a + p.usd, 0));
const invDue = inv => r2(invTotals(inv).total - invPaid(inv));

// El IGTF solo se agrega si quien cobra marca "Incluir IGTF" (aunque el pago sea en dólares)
function pay(invId, { method, amount, igtf: withIgtf = false }) {
  const inv = byId(S.invoices, invId); const m = metodo(method); const rate = invRate(inv);
  const usd = m.cur === 'USD' ? r2(amount) : r2(amount / rate);
  if (!Number.isFinite(usd) || usd <= 0) return { ok: false, msg: 'Escriba un monto mayor que cero.' };
  if (usd - invDue(inv) > 0.01) return { ok: false, msg: `El monto supera el saldo pendiente (${bsOf(invDue(inv), inv)}).` };
  const igtf = withIgtf ? r2(usd * S.igtfRate / 100) : 0;
  inv.payments.push({ id: uid('pg'), method, amount: r2(amount), cur: m.cur, rate, usd, igtf, at: nowStamp() });
  inv.status = invDue(inv) <= 0.01 ? 'pagada' : 'parcial';
  if (inv.status === 'pagada' && !inv.rate) inv.rate = rate;   // saldada: el monto en Bs queda fijo
  log('Cobro registrado', `${inv.num} · ${m.name} ${fmt(amount, m.cur)}`);
  save();
  return { ok: true };
}

// ---------- Caja: solo hay efectivo en dólares; los Bs se concilian con el banco ----------
function cashExpected() {
  const c = S.cash; if (!c.open) return null;
  let usd = c.open.floatUSD; const byMethod = {};
  c.moves.forEach(m => {
    const sign = m.kind === 'egreso' ? -1 : 1;
    byMethod[m.method] = r2((byMethod[m.method] || 0) + sign * m.amount);
    if (m.method === 'usd') usd += sign * m.amount;
  });
  const digitalVES = r2(METODOS.filter(m => m.cur === 'VES').reduce((a, m) => a + (byMethod[m.id] || 0), 0));
  return { usd: r2(usd), byMethod, digitalVES };
}

// ---------- Compras ----------
function receiveOrder(oid, lots) {
  const o = byId(S.orders, oid);
  o.lines.forEach((ln, i) => addLot(ln.pid, { num: lots[i].num, qty: ln.qty, cost: ln.cost, exp: lots[i].exp, sup: o.sup, brand: lots[i].brand }, o.num));
  o.status = 'recibida'; o.recv = dAt(0);
  log('Orden de compra recibida', `${o.num} · ${o.lines.length} productos ingresados`);
  save();
}

// ---------- Migraciones: actualizan datos guardados por versiones anteriores sin perderlos ----------
function migrate() {
  let ch = false; const fix = (cond, fn) => { if (cond) { fn(); ch = true; } };
  fix(S.clinic && /^J-0+/.test(S.clinic.rif || ''), () => { S.clinic.rif = 'J-50213973'; S.clinic.name = 'Quirón Especialidades Médicas'; });
  fix(!S.packages && typeof seedPackages === 'function', () => { S.packages = seedPackages(); });
  fix(S.services?.some(x => x.iva), () => S.services.forEach(x => { x.iva = false; }));
  fix(!S.facturaPrint, () => { S.facturaPrint = { x: 0, y: 0 }; });
  fix(!S.facturaVoids, () => { S.facturaVoids = []; });
  fix(!S.dues, () => { S.dues = []; });
  fix(!S.clinicLab2026, () => importClinicLab2026(S));
  fix(!S.labRefs2026 && typeof applyLabStandard === 'function', () => applyLabStandard(S));   // unidades y valores de referencia estándar
  fix(!S.labRefs2026b && typeof applyLabAgeBands === 'function', () => applyLabAgeBands(S));   // tablas por edad (testosterona, PSA, DHEA-S…)
  fix(!S.imageStudiesV1, () => {
    (S.exams || []).filter(e => e.area === 'imagen').forEach(e => {
      if (!e.imageStudy) e.imageStudy = { type: null, region: '', date: e.date, requestingDoc: e.doc || null, legacy: true };
    }); S.imageStudiesV1 = true;
  });
  fix(!S.budgetPaymentV2, () => {
    (S.budgets || []).forEach(b => {
      const invoice = (S.invoices || []).find(i => i.id === b.inv || i.budget === b.id);
      if (invoice) { b.inv = invoice.id; b.status = 'facturado'; return; }
      if (['aceptado', 'aprobado', 'aprobado_paciente', 'aprobado_por_paciente', 'aprobado_por_el_paciente'].includes(b.status) || (b.status === 'abierto' && (b.patientApprovedAt || b.approvedByPatient))) {
        b.previousStatus = b.status; b.status = 'enviado';
        b.sentAt = b.sentAt || b.acceptedAt || b.patientApprovedAt || b.date;
      }
    }); S.budgetPaymentV2 = true;
  });
  fix(!S.kits, () => { S.kits = []; });   // kits de cirugía
  fix(!S.evolutions, () => { S.evolutions = []; });   // borradores y evoluciones guiadas
  fix(!S.indications, () => { S.indications = []; });   // indicaciones médicas de medicación
  // Personal real: médicos (los de ejemplo quedan inactivos) y enfermeras con sus días de guardia
  fix(!S.doctors, () => { S.doctors = [...REAL_DOCS, ...DEMO_DOCS].map(d => ({ ...d })); });
  fix(!S.nurseStaff, () => { const extra = (S.nurses || []).filter(n => typeof n === 'string' && !DEMO_NURSES.includes(n) && !REAL_NURSES.some(r => r.name === n));
    S.nurseStaff = [...REAL_NURSES.map(n => ({ ...n, days: [...n.days] })), ...extra.map(name => ({ name, days: [], active: true }))]; });
  // Guardias de hoy en adelante que apuntaban a personal de ejemplo: quedan sin asignar (la enfermera sale de su día fijo)
  fix(!S.staffV1, () => { Object.entries(S.duty || {}).forEach(([day, g]) => { if (day < dAt(0)) return;
    if (DEMO_DOCS.some(d => d.id === g.doc)) g.doc = ''; if (DEMO_NURSES.includes(g.nurse)) g.nurse = ''; }); S.staffV1 = true; });
  (S.doctors || []).forEach(d => fix(d.id === 'dr02' && d.name === 'Dr. Víctor Correo', () => { d.name = 'Dr. Víctor Correa'; }));   // corrección de la administración
  syncStaff();
  // Cuentas en Bs: las facturas fiscales y las cuentas saldadas fijan su tasa (la del primer/último cobro, o la de hoy)
  (S.invoices || []).forEach(i => fix(!i.rate && (isFiscal(i) || i.status === 'pagada'), () => { i.rate = (isFiscal(i) ? i.payments[0]?.rate : i.payments.at(-1)?.rate) || S.rate; }));
  // Solicitudes entregadas completas que quedaron marcadas como "parcial" por un error anterior
  (S.medOrders || []).forEach(o => fix(o.status === 'parcial' && o.items.every(it => it.short || it.qty >= (it.req ?? it.qty)), () => { o.status = 'despachada'; }));
  // Presupuestos: se congelan los precios con los que se emitieron
  (S.budgets || []).forEach(b => fix(!b.items && b.status !== 'facturado', () => { b.items = (b.v2 ? pkgItems(b) : buildItems(b.serviceIds, b.extras, b.adj, b.qty || {})).map(x => ({ ...x })); b.priceDate = b.date; }));
  // Versión 2: los recurrentes que antes se registraban solos pasan a "por confirmar"
  fix((S.schema || 1) < 2, () => {
    const auto = (S.ledger || []).filter(g => g.rec && g.source === 'Recurrente' && !g.confirmed);
    auto.forEach(g => S.dues.push({ id: uid('du'), rec: g.rec, date: g.date, type: g.type, cat: g.cat, concept: g.concept, amount: g.amount, cur: g.cur, method: g.method, status: 'pendiente' }));
    S.ledger = (S.ledger || []).filter(g => !auto.includes(g)); S.schema = 2;
  });
  if (typeof CONSULT !== 'undefined' && CONSULT.migrateState(S)) ch = true;
  if (ch) save();
}
migrate();
// Al abrir la app, los recurrentes vencidos quedan "por confirmar" en Contabilidad
if (typeof runRecurrents === 'function') runRecurrents();
// Cambio de día con la app abierta: las operaciones pasan a registrarse con la fecha nueva
setInterval(() => {
  const n = new Date(); n.setHours(0, 0, 0, 0); if (n.getTime() === TODAY.getTime()) return;
  TODAY = n; if (typeof runRecurrents === 'function') runRecurrents();
  if (typeof render === 'function') { render(); toast('Comenzó un nuevo día: las operaciones se registran con la fecha de hoy'); }
}, 60000);
