# Quirón Dos · rediseño

Copia del programa Quirón (versión 1, repositorio `quiron`, que no se modifica) para aplicar el diseño nuevo
"Espacios" aprobado por el dueño el 10 de octubre de 2026. La maqueta aprobada está en `diseno/maqueta-concepto-b.html`.

- Se abre con `serve.ps1` en **http://localhost:8082** (la versión 1 usa el 8080): los datos del navegador quedan separados.
- Para probar con los datos reales: Ajustes › Copias de seguridad › Restaurar, con una copia descargada de la versión 1.
- Toda la funcionalidad, roles, permisos y circuitos de la versión 1 se mantienen; solo cambia el diseño.

# Contexto del proyecto Quirón (para continuar en otra sesión)

Resumen de lo construido y decidido con el dueño de la clínica. Léalo antes de modificar el software.

## Cómo se trabaja con el dueño
- **Idioma:** español formal (usted). Nada coloquial: por ejemplo, "Cirugía aprobada / Cirugía descartada", nunca "la cirugía va".
- **Filosofía:** software "para dummies": simple, guiado, pocos pasos. Corregir fallos y mejorar lo existente; no rehacer módulos sin que lo pida.
- Probar cada cambio con datos de ejemplo antes de entregarlo y explicar en lenguaje sencillo qué cambió.

## Qué es
Aplicación web estática (`quiron/`: HTML + JavaScript, sin compilación). Estado global `S` guardado en `localStorage`
(clave `quiron-demo-v18`, con migraciones en `migrate()` de `data.js`; ya no se cambia la clave entre versiones).
Versión publicada para pruebas en claude.ai: https://claude.ai/artifact/RJ1Dfu7FpCWhjvBx7YMWP2

## Módulos (todos funcionando)
- **Inicio de sesión y Usuarios** (`views-auth.js`): primer uso crea administrador; invitación por código o contraseña temporal; contraseñas con PBKDF2. Validación en el navegador (no es seguridad real hasta la fase nube).
- **Permisos por rol** (`app.js`: `ROLES` = menú, `PERMS` + `can()` = acciones). Roles: administrador (todo), recepción (agenda completa, fichas, consentimientos), médico (su agenda y sus citas/cirugías, historias, informes), residente (hospitalización; consulta de pacientes/exámenes/historias), enfermería (solicita medicación/material, registra aplicaciones), almacén (inventario; ve quirófano/hospitalización solo para consulta; no ve valor total del inventario), laboratorio (laboratorio + pacientes), rayos X (imagen).
- **Tutorial** (`views-tour.js`): recorridos guiados por rol con resaltado; el administrador puede verlos "como" cada rol.
- **Agenda** (general, quirúrgica, consultas por médico, guardias, horarios), **Quirófano** (`views-qx.js`: solicitudes al almacén, cirugía realizada, devoluciones por lote), **Hospitalización** (camas H-01…H-05, UCI-01, UCI-02; evoluciones, medicación con frecuencia y despacho parcial, aplicaciones, alta conciliada con el presupuesto del ingreso).
- **Pacientes e historias** (historia estructurada, nota libre, informe médico, consentimiento médico-quirúrgico imprimible y firmado subido, preoperatorio externo, avisos de pendientes antes de cirugía). Todo lo firmado entra a **Historias** y a las estadísticas (`data-hist.js nativeRecords`).
- **Exámenes** (laboratorio e imagen, catálogo y valores de referencia).
- **Presupuestos por paquete** (`data-budget.js`, `views-budget.js`): quirúrgico/emergencia/procedimiento; precios congelados al emitir; flujo paciente → Contabilidad → cobro.
- **Contabilidad**: cobro sin factura obligatoria (cuenta C-), factura fiscal opcional (F- con número de control); IVA exento (servicios médicos); recurrentes por confirmar con tasa del día; libro de ventas SENIAT solo con facturas fiscales.
- **Inventario** por lotes (FEFO), compras aprobadas por Contabilidad, despacho con − / + y faltantes.
- **Ajustes**: tasa BCV, datos de la clínica, copias de seguridad reales (descargar, probar, restaurar), **Empezar en limpio**.
- **PDF A4** (`pdf-kit.js`): logo, RIF J-50213973, metadatos, comprimidos (~20 KB).

## Pendiente del dueño
- Listado real de médicos, residentes y enfermeras (`MEDICOS` está fijo en `data.js`: hay que reemplazarlo).
- Precios reales (muchos servicios en $1, día de UCI en $1, paquetes con montos de ejemplo), dirección y teléfono de la clínica.
- Revisión legal del consentimiento; confirmar con el contador la emisión de factura fiscal (requisitos SENIAT).

## Plan inmediato
1. Prueba en **Vercel plan gratuito** (Root Directory `quiron`, Framework Other) para cargar inventario inicial en una sola computadora, descargando la copia diaria (JSON) que luego se importará a la nube.
2. Ofrecido, sin confirmar: importador de inventario desde Excel.

## Fase nube (decidida: 100 % en la nube)
- **Supabase** (región São Paulo): base de datos, usuarios/permisos en el servidor, almacenamiento de archivos; copia de archivos a un segundo proveedor (Backblaze o Cloudflare R2).
- **Vercel Pro** para la aplicación. **IA por API intercambiable**: probar Claude Haiku y Gemini Flash con las mismas 50 historias; prepago con límite de gasto.
- **Rayos X digitales (DICOM)**: visor en el navegador y subida de `.dcm` ligada a la orden.
- **1.500–2.000 historias antiguas ya escaneadas**: importador masivo ligado por cédula; lectura con IA opcional por lotes.
- Pendiente de preguntar: volumen mensual de estudios de rayos X, cómo exporta el equipo (USB/carpeta/PACS), formato y organización de las historias escaneadas.
- Uso estimado: 6–10 personas a la vez. Tienen planta eléctrica; el internet cae a veces (recomendado 4G de respaldo).

## Sesión del 6 de octubre de 2026: carga del inventario real
**Cómo se trabaja en local:** `serve.ps1` (PowerShell, sin Python ni Node) sirve `quiron/` en http://localhost:8080 y guarda copias
con `PUT /__copia` en `copias de seguridad/`. Los datos viven en el navegador (localStorage de localhost:8080: no cambiar el puerto
o se "pierden"). Última copia: `copias de seguridad/Inventario Quiron 2026-10-06.json` (27 productos, 932 unidades).

**Almacén (Sector 1, detrás de la puerta):** estanterías A, B, C; 6 niveles cada una (EST-A-01 arriba … EST-A-06).
Cajas numeradas: 1–10 en EST-A-02, 11–20 en EST-A-03, 21–30 en EST-A-04. Misma presentación de distintos laboratorios = un producto
con varios lotes en la misma caja; dosis distinta = producto aparte. Cajas cerradas de viales = 1 vial cada una. El dueño exige conteo
minucioso: nunca estimar lo que no se ve; preguntar. Correcciones como "Ajuste por conteo físico".
Los productos vencidos se dejan a propósito para que el almacén practique el retiro.

**Cajas cargadas:** 1–9, 11–26 y 28. Libres: 10 y 27 (la 10 quedó libre al pasar la hioscina a la 11).

**Cambios al software hoy:** mapa girado 180° con estanterías A/B/C y vista de frente (zoom) con menú de medicamentos; ubicación
estantería·nivel·caja en la ficha y columna "Estantería · caja" en Inventario; "+N vencidas" y estado "Solo vencidos"; botón
"Retirar" para lotes vencidos (y motivo "Vencido, retirado"); recorridos de tutorial "Estanterías…" y "Retirar productos vencidos";
corregido "Solicitar medicación" (Quirófano/Hospitalización/Nueva atención usaban productos de ejemplo borrados); frecuencia opcional;
alergias en amarillo; menú lateral desplazable y etiqueta viewport (en el teléfono se veía la versión de escritorio reducida).

**Pendientes de datos (del dueño):**
- Hioscina + Dipirona (caja 28): cantidad del lote A240775 (vence 30/06/2027).
- Diazepam (caja 19): concentración. Efedrina (21), Tramadol (26), Sulfato de magnesio (25), Midazolam (18): laboratorio.
- Lotes incompletos: Flumazenil Livealth "…25C-05"; Biofenap "PAI241…"; Sulfato de magnesio "…05.5628"; Hioscina Kwality "GN326…"
  (¿mismo lote que la "sin marca" GN3023?); clorfeniramina Bioglass y "…young" (sin lote).
- Flumazenil caja vinotinto (1 vial): marca, lote y vencimiento. Naloxona rusa (2): lote y vencimiento.
- Costos y stock mínimo de todos los productos (están en $0 y 0).
- Cefazolina: confirmar marca de la tapa azul oscuro (vial dice Etipress S.A.).
- Solicitud de prueba SM-0009 (firmada "Guyaasra ASdas"): decidir si se elimina.

## Sesión del 7 de octubre de 2026: historias escaneadas
- Carpeta: Escritorio › HISTORIAS MEDICAS QUIRON › HISTORIAS MEDICAS QUIRON (ambos nombres terminan en un carácter invisible U+F028,
  copiados desde una Mac: se ubican por comodín). Subcarpetas 2022-2023 (sin meses), 2024, 2025, 2026 › MES AÑO › "NOMBRE CÉDULA.pdf".
- 1.046 PDF escaneados (sin texto), 5,2 GB, ~13 páginas c/u, 937 pacientes. Los PDF NO se copian: serve.ps1 los sirve en /historias/...
  y /__historias lista nombre, cédula, año y mes. En el software: Historias › "Actualizar historias escaneadas" registra las nuevas
  (estado "escaneada", tipo "Historia escaneada"); no entran en estadísticas hasta leerlas. Se vinculan al paciente por cédula.
- Se eliminaron las 290 historias y 3 notas de ejemplo (copia previa: copias de seguridad/Antes de historias 2026-10-07.json).
- Análisis detallado (con nombres): datos privados/analisis-historias.md (fuera de Git). Hallazgos: faltan abril 2024 y diciembre 2025;
  32 sin cédula (casi todos niños); 24 cédulas con nombres distintos (niños con la cédula de la madre, errores de tipeo).
- Cada PDF = una hospitalización: historia de ingreso (manuscrita), órdenes médicas, informe de egreso (a máquina: diagnósticos,
  procedimiento, cirujano, medicación al alta), consentimiento, evoluciones de enfermería (anestesia y medicación del acto).
- Próximo paso propuesto: lectura con IA por lotes (fase nube), priorizando el informe de egreso a máquina; campo "cédula del representante"
  para menores.

## Datos privados (decisión del dueño, 7 de octubre de 2026)
Los datos de pacientes se mantienen SOLO en esta computadora, listos para subirlos cuando haga falta (fase nube):
- `copias de seguridad/`: estado completo del software (inventario, 937 pacientes, 1.046 historias, usuarios). Restaurable en
  Ajustes › Copias de seguridad, o con `GET /__copia?nombre=...` del servidor local.
- `datos privados/`: texto leído de las historias (ocr/), lectura manual de 828 historias (lectura-manual.tsv), datos automáticos
  (extraccion-auto.json), exámenes detectados (examenes-detectados.json), datos de pacientes (pacientes-datos.json) y análisis.
  `recortes/` se regenera con herramientas/recortes-historias.ps1.
Ambas carpetas están en .gitignore. Para subirlas, la decisión y el comando los toma el dueño (o se suben cifradas).

## Sesión del 8 de octubre de 2026: buscador, kits, consumo y emergencias
- **Buscador de medicamentos** en "Solicitar medicación" (Hospitalización, Emergencias y Quirófano): se escribe parte del nombre
  y la lista filtra (`prodPicker` / `prodList` / `pickProd` en `views-hosp.js`). Cada línea nueva empieza vacía y es obligatorio elegir.
- **Cirugías sin precios ni cobro**: al programar ya no aparece el costo del quirófano; la ficha de la cirugía ofrece
  "Ver en Quirófano" en lugar de "Atender y cobrar" (las consultas siguen igual).
- **Kits de cirugía** (`S.kits`, administrador: Quirófano › Kits de cirugía). Los arma el dueño (no se cargaron kits).
  Es OBLIGATORIO al programar la cirugía (se cambia desde la ficha de la cirugía › Cambiar); no se elimina un kit en uso. La primera solicitud al almacén de esa cirugía llega precargada y se puede ajustar.
- **Consumo del paciente** (pestaña "Consumo" del perfil, solo administrador): lo despachado menos lo devuelto, por episodio,
  al costo de cada lote (`patientConsumption` en `data-hosp.js`). Los costos del inventario real aún están en $0.
- **Emergencias**: camas EM-01…EM-03 (`BEDS[].area = 'emerg'`), mismo flujo que hospitalización; "Pasar a hospitalización"
  cambia la cama sin perder nada. Alta desde emergencia cobra el servicio v9 (Atención 24h) si no hay paquete.
- **Corregido:** un despacho completo quedaba como "parcial" y enfermería no podía registrar aplicaciones (migración lo repara).
- `serve.ps1` envía `Cache-Control: no-cache` para que el navegador cargue siempre la versión nueva.
- **IGTF opcional:** ya no se suma solo por pagar en dólares; en la pantalla de cobro hay una casilla "Incluir IGTF" (desmarcada).
- **Cuentas y facturas en Bs** (los presupuestos siguen en USD). Por dentro se guardan en USD; `invRate(inv)` da la tasa:
  la factura fiscal la fija al emitirse; una cuenta sin factura usa la tasa del día y queda fija al saldarse. Libro de ventas en Bs
  con columna de tasa. Helpers `bsOf`, `bsSum` en `data.js`; documentos y PDF usan `m.money`.
- **Tasa BCV = la que muestra bcv.org.ve** (la última publicada, aunque su fecha valor sea el día hábil siguiente). Se consulta al
  iniciar sesión y cada hora; sin `serve.ps1` (Vercel) usa DolarAPI de respaldo. Se muestra con 4 decimales.
- **Pantalla de acceso rediseñada** (concepto del dueño): título grande, formulario a la izquierda, "/" y opciones con borde degradado a la derecha, botón verde→dorado, selector de tema arriba.
- **Temas:** Día, Noche y **Esmeralda** (negro con verde, `data-theme="verde"`). `THEMES` y `themeSeg()` en `app.js`; `--on-accent` para el texto sobre el acento.
- **Se eliminó la sección Reportes** (libro de ventas, ventas por servicio, inventario valorizado) a pedido del dueño. `toCSV` se conserva porque lo usa Contabilidad.

## Sesión del 8 de octubre de 2026 (tarde): auditoría por roles y correcciones
- **Personal real:** 19 médicos + Dr. Pedro (residente, falta apellido) + Dr. José Vivas (anestesiólogo) en `REAL_DOCS` (`data.js`);
  `S.doctors` alimenta `MEDICOS` (`syncStaff`); los médicos de ejemplo quedan inactivos (`example`, `active:false`). Enfermeras en
  `S.nurseStaff` con días fijos (Rosario Peña lun/jue, Mileidy Soto mar/mié, Daniela Tovar vie) → `S.nurses` y `S.nurseWeek`.
  Se gestionan en **Usuarios › Médicos y residentes / Enfermeras** (solo administrador).
- **Guardia:** `dutyOf(día)` (médico asignado; enfermera por día fijo si no se asignó otra). La cambian Administración y almacén
  (`guardia.editar`); se ve arriba en Hospitalización y Emergencias.
- **Médico sin horario cargado:** se agenda de 07:00 a 19:00 (`availOf`), hasta que se cargue en Horarios de médicos.
- **Citas:** Reservada → Confirmada → Llegó → Atendida, sin volver atrás; "No asistió", "Posponer"/"Reprogramar" (`a.moved`).
  Firmar la historia de una consulta agendada la marca Atendida. Choques en `apptConflict`.
- **Cirugía realizada:** solo médico tratante, enfermería y Administración (`canQxDone`).
- **Médico que solicita:** lista desplegable de médicos (ya no texto libre).
- **Inventario › Cargar factura** (`views-factura.js`): IA (solo en claude.ai por ahora) o carga manual; lo completo entra al
  inventario y lo incompleto queda en "Facturas por completar" (`S.invPending`).
- `.claude/launch.json` tiene `quiron-pruebas` (puerto 8091) para probar con datos de ejemplo sin tocar los datos reales (8080).
- **Alta en Emergencias:** además del tratante y Administración, el médico de guardia del día (`canDischarge`). Dr. Víctor Correa (corregido).
- **Mapa de camas:** cada cama ocupada tiene "Ver ingreso" y "Solicitar medicación" (pedir sin entrar al ingreso).
- **Historias clínicas:** el residente puede crearlas (`pac.escribir`). Tipo nuevo "Historia de ingreso" (`ingreso`), primera nota de cada hospitalización/emergencia; luego evoluciones. "Nueva historia" sin paciente abre el buscador (ya no toma el primer paciente de la lista). Un solo botón "Nueva historia" en la pestaña del perfil.
- **Pacientes por año:** carpetas por año de la última atención (cita, ingreso, historia, examen, cobro, presupuesto o historia escaneada; `lastActivity`), orden "Más recientes" o A–Z; la búsqueda recorre todos los años. Pacientes nuevos guardan `created`.
- **Historias:** botón "Nueva historia" también en el módulo Historias. Una historia firmada admite "Subir copia firmada y sellada" (`n.scans`, varias hojas). Los archivos subidos (historias y consentimientos firmados) se guardan con `storeFile`: en la nube (assets), o en la carpeta `archivos/` vía `serve.ps1` (`PUT /__archivo`, fuera de Git), o dentro de los datos si es pequeño.
- **Eliminar paciente** (solo Administración, en Editar ficha): muestra todo lo vinculado, pide escribir ELIMINAR, guarda antes una copia completa en "copias de seguridad", borra citas/ingresos/historias/exámenes/presupuestos/cobros/solicitudes, desvincula (no borra) historias escaneadas y puede devolver al inventario lo despachado no aplicado.
- **Prueba de flujo completo (8 oct):** recepción → médico → laboratorio/rayos X → cirugía (kit, consentimiento, preoperatorio, presupuesto, cobro) → quirófano → hospitalización → alta → emergencia nocturna. Correcciones: avisos del médico solo de sus pacientes; inventario cuenta entregas parciales; consentimiento y presupuesto proponen al médico de la cirugía; "Solicitar preoperatorio" ya marcado; al alta se devuelve lo no aplicado (`returnUnits`, `unusedOfAdm`). **Examen externo** (`extExam`): laboratorio o rayos X de otro centro, sin orden, con fotos/PDF, desde Exámenes o el perfil.
- **Indicaciones médicas** (`views-indic.js`, `S.indications`): el médico/residente indica medicamento, dosis y vía, frecuencia (o "Según necesidad"), primera dosis, duración. Enfermería ve en la cama la próxima dosis (verde/amarillo/rojo) y el menú cuenta las atrasadas o próximas; registra "Aplicada" (descuenta de lo entregado por el almacén) o "No se aplicó" con motivo. El pedido al almacén ya no pide frecuencia ni indicación (pestaña "Pedidos al almacén").
- **Rediseño estilo Apple (9 oct):** capa al final de `index.html`: sombras en capas y radios de 18 px, títulos grandes, barra lateral translúcida con selección suave, campos con anillo de enfoque, selects con chevron, control segmentado nativo, ventanas con vidrio esmerilado y resorte, avisos tipo cápsula, oscuros casi negros con filo de luz.
- **Inicio = resumen en vivo** (solo admin): ocupación de hospitalización/emergencias, quirófano (en curso, próximas, sin registrar), consultas, "Requiere atención" (guardia sin médico, dosis atrasadas, solicitudes al almacén, cirugías sin consentimiento/preoperatorio, exámenes urgentes, lotes vencidos) y solo las camas ocupadas; se actualiza cada minuto. **Buscadores:** lista propia pegada al campo (`comboRender` en `app.js`) en lugar del datalist del navegador.

## Rediseño "Espacios" (Quirón Dos, desde el 10 de octubre de 2026)
Aprobado por el dueño (maqueta en `diseno/`): fuente Geist; menú lateral con icono + nombre en >=1024 px; debajo, barra
inferior solo con iconos y botón de tres rayas (☰) que abre "Más secciones"; botón de tema en la barra superior que rota
Día → Noche → Esmeralda; Inicio con frase de estado + línea "Hoy en la clínica" (pendientes arriba, "Ahora", lo próximo;
lo pasado plegado); Camas como fichas grandes por paciente; ventanas paso a paso (aprobado: "Pedir medicación").
Descartado: estilo "Tablero de turno" (clínico sobrio). Trabajo con Codex para partes del código; Claude revisa y prueba.

## Sesión del 14 de octubre de 2026: carga del Excel e inventario
- Datos cargados desde "Quiron - toda la informacion 2026-10-14.xlsx" (inventario, pacientes, historias escaneadas y exámenes encontrados en ellas).
  Copia: `copias de seguridad/Quiron Dos - carga inicial 2026-10-14.json`.
- Las 223 historias que faltaban se leyeron a mano (`datos privados/lectura-pendientes.tsv`); la medicación de las 300 cirugías más recientes
  (`datos privados/medicamentos-muestra.tsv`) quedó en `record.meds`. Informe: `../Estadisticas historias Quiron 2026-10-14.md`.
- Correcciones del dueño: Kit de obstetricia 5 (EST-D-01); Pleurevac 1 (EST-D-01); de "Traje (bata) de paciente" 60 eran
  "Traje de acompañante quirúrgico" (producto nuevo, EST-E-03; quedan 30 batas).
- **Almacén sin entradas ni salidas manuales** ("Entrada / salida" solo Administración). Saca con la orden del médico o con
  **"Hacer una solicitud extraordinaria"** (`views-extra.js`, permiso `inv.extra`): productos, motivo (cirugía, hospitalización,
  emergencia, consulta, otro), médico que atendía y paciente. Se guarda como solicitud `kind: 'extra'` despachada al instante (FEFO),
  ligada al ingreso o a la cirugía del paciente si los tiene; historial en Inventario › Órdenes pendientes.
- **"Cambiar ubicación"** en la ficha del producto: sector, estantería, nivel, recipiente y detalle con listas simples.
- **Facturas solo Administración** ("Cargar factura" y "Facturas por completar"). El almacén registra la mercancía que llega con
  **"Producto o lote nuevo (con foto)"**: 1 a 3 fotos obligatorias para el almacén (caja, lote/vencimiento, nota de entrega), guardadas
  con `storeFile` en `lot.photos` (carpeta `archivos/` con serve.ps1) y visibles en la ficha del producto; la lectura con IA es opcional.
- Tutorial del almacén actualizado (qué puede hacer, foto obligatoria, solicitud extraordinaria, "Cambiar ubicación").
- Tema Esmeralda: rojos más intensos (`--bad:#ff5c5c`, `--bad-soft:#421c24`, `--badge-bg:#d92d36`).
- **Exoneración de gastos** (solo Administración): `exonerate(invId, motivo)` en `data.js`. La cuenta conserva conceptos y montos
  (lo que representó la atención) y queda `status: 'exonerada'` con `inv.exon = { at, by, reason, usd, total, paid }`; `invDue` = 0,
  sin ingreso en caja ni factura fiscal (no se exonera una cuenta con factura fiscal). Se ofrece al final del **alta** (casilla +
  motivo obligatorio; exonera la cuenta del alta o la del paquete), en la ficha de la cuenta y en la ventana de cobro ("Exonerar gastos").
  Filtro "Exoneradas" en Contabilidad › Cobros; el documento sale como "Constancia de exoneración" con lo exonerado y "A pagar 0".

### Sincronización entre navegadores (14/10/2026)
- Con serve.ps1 cada guardado se copia a `copias de seguridad/_estado-servidor.json` (+ `.meta.json` con `savedAt`). Al abrir, el navegador toma la versión del servidor si es más reciente (`serverPull` en data.js, llamado desde `start()` en app.js); `/__ping` responde 204 para detectar el servidor.
- Cada minuto revisa si otro equipo guardó: recarga sola si la pestaña está oculta, si no avisa. Si otro equipo guardó antes, no sobrescribe (aviso "Otro equipo guardó cambios más recientes").

### Ubicación por lote y almacén (15/10/2026)
- `lot.loc` (opcional) sobrescribe `p.loc`. Helpers en views-map.js: `lotLoc`, `locTextOf`, `locKeyOf`, `placements(p)` (sitios con existencia), `placedIn(test)`. Mapa, tablas (`locCells(p, lot?)`) y ficha usan estos. "Mover" en cada lote → `locEdit` con `data-l`; `moveLot()` en views-extra.js separa una parte o junta mitades del mismo lote.
- Sector 3: "Reserva" y "Cuarentena (vencidos)" como `spot`. Se unieron 7 productos duplicados (cefazolina, clorfeniramina, ampicilina+sulbactam, gentamicina, meropenem, llave de 3 vías, tubo de extensión).
- Mínimos: top 10 de medicamentos = 10 (presentación principal), demás medicamentos = 2, insumos según uso.
- Valor del inventario (`invValue`) excluye lotes vencidos; `expiredValue()` aparte.

### Fondos, pacientes eliminados e inventario (17/10/2026)
- views-funds.js: tarjetas de fondos en Contabilidad (USDT, Zelle, Bs Banesco, Bs Banco Plaza, dólares en efectivo, euros, euros España). Saldo = último conteo (`S.fundAdj`) + movimientos posteriores (`acctMoves` con `at`, fondo por `m.fund` o por método según `S.fundMap`) + cambios entre fondos (`S.fundTx`). Sellos con segundos (`nowStampS`). Euro: serve.ps1 `/__tasa` devuelve `eur` (Bs/€) → `S.ratesEUR`/`S.rateEUR`.
- Eliminar paciente: motivo obligatorio, borra también consultas, botón en el expediente (admin), registro `S.deletedPatients` en Ajustes.
- Inventario: gráfico con 3 vistas (`UI.invChart`: top del mes, USD por mes, USD del mes por medicamento; `monthUsage`, `moveUsd`), aviso de alertas arriba y alertas agrupadas por gravedad.
- Movimiento (17/10/2026): bloque final de estilos "Movimiento cinematográfico" en index.html (enfoque con blur al entrar `focusIn/focusRow/focusSoft`, curva `--expo`, ventanas `cineSheetIn` en computadora, reflejo en `.btn.primary`, inclinación 3D en `.wcard`, resplandor `critGlow` en alertas, brillo `--glow` en lo seleccionado). Todo bajo `prefers-reduced-motion:no-preference`. `countUp` también anima `.wcard .wbal` y `.bh-val`.
- Animaciones por equipo (17/10/2026): app.js `applyMotion()` pone `motion-lite`/`motion-off` en <html>. Automático: ≤4 núcleos, ≤4 GB o <45 fps medidos (una vez, con la pantalla visible) → ligero. Preferencia en localStorage `quiron-motion` (auto/full/lite/off), tarjeta "Animaciones" en Ajustes. Ligero quita desenfoques (también el vidrio esmerilado) y efectos continuos; conserva movimientos simples y la pastilla deslizante de `.seg` (app.js `segPills`).
- Revisión general (17/10/2026): pruebas de herramientas/ actualizadas (diagnóstico libre, ✓ por CSS) → 110 grupos OK. app.js arranca sin esperar al servidor cuando no hay fetch/http (pruebas). Modo teléfono (≤600 px) al final de index.html. IA fuera de Claude: `getCap('sample')` usa `/__ia` de serve.ps1 (Gemini, clave `GEMINI_API_KEY` y opcional `GEMINI_MODEL` en variables de usuario de Windows); `getCap('sample-clin')` (historias, resultados) solo si `localStorage['quiron-ia-clinica']==='1'` (casilla en Ajustes → IA para leer fotos).
- Protecciones de datos (17/10/2026): `serverPush` no envía si este equipo tiene <60 % de pacientes/productos/historias/consultas que el servidor (meta guarda `n`). serve.ps1 guarda historial comprimido en `copias de seguridad/historial` (hora-* 48 h, dia-* 60 días) antes de cada reemplazo de `_estado-servidor.json`.
- Informe de egreso (epicrisis): views-egreso.js (`a.epicrisis`, `pdfEgreso`), botón en la ficha del ingreso, aviso al dar de alta y marca "Sin informe de egreso" en altas recientes.
- Triaje (17/10/2026): views-triaje.js (`S.triage`, colores Manchester simplificados, `triSuggest`, sala de espera arriba de las camas de Emergencias, "Recibir en cama" enlaza el ingreso: `a.triage`).
- Código de barras: views-scan.js (`p.barcodes`, escáner con BarcodeDetector o ZXing, lector USB por teclado, GS1 con lote/vencimiento `parseGS1`, etiquetas propias `Q-<ID>` en Code 128 con JsBarcode, tamaños 50×25/60×40/40×30 mm).
- Plantillas de órdenes: views-plantillas.js (`S.orderTemplates`, borrador inicial con los 5 medicamentos más indicados tras cirugía, sin dosis; "Aplicar plantilla de órdenes" en el ingreso crea indicaciones + una solicitud al almacén).
- Resumen del día (17/10/2026): views-resumen.js, tarjeta en Inicio solo para Administración (`can('*')`), Hoy/Ayer, "Copiar para WhatsApp" (`dailySummaryText`).

## Personal: credenciales y amonestaciones (19/10/2026)
- views-personal.js: COLEGIOS (24 colegios de médicos de Venezuela), credsFields/credsRead (cédula, n.º de colegiado, colegio, MPPS). docCreds imprime "C.M. n (CM Estado) · MPPS n".
- Perfiles (médico, enfermera, usuario) con pestañas Datos / Amonestaciones y destacados. S.staffNotes {who:"doc:|nurse:|user:<id>", kind, title, text, date, by, at, void}. No se borran: se anulan con motivo. AMON_LIMIT=3 muestra aviso.
- Las enfermeras ahora tienen id (migración en data.js).

## Seguridad (19/10/2026, revisión según "20 formas de que tu app acabe hackeada")
- serve.ps1: rechaza peticiones de otro origen (Origin / Sec-Fetch-Site) en /__*, archivos/ e historias/; cabeceras CSP, nosniff, X-Frame-Options, Referrer-Policy; subidas con tamaño máximo y tipo real comprobado (bytes mágicos), escritura atómica (.subiendo → definitivo); /__ia limitado a 15 lecturas por minuto; los errores no envían detalles internos (van a la consola).
- La CSP exige: nada de onclick/onsubmit en el HTML (usar data-act); scripts externos solo de cdnjs y unpkg; fetch externos solo a ve.dolarapi.com y api.pwnedpasswords.com. Si se añade un servicio nuevo, añadirlo a $Csp.
- safeUrl() (data.js) para todo href/src dinámico; esc() en todo texto de datos. Prueba de inyección: llenar S en memoria con '"><xss-probe>' y abrir todas las pantallas y fichas (0 hallazgos al cerrar).
- Contraseñas: passCheck = longitud + passWeak (más usadas, nombre/correo/clínica) + passLeaked (HIBP por k-anonimato, solo 5 caracteres de SHA-1; sin internet no bloquea).
- SRI en ZXing y JsBarcode (views-scan.js). Si se cambia la versión, recalcular la huella.
- Pendiente para Supabase: RLS, permisos en el servidor (hoy can() es solo del navegador), sesión con cookie httpOnly, verificación de correo, IDs no predecibles (uid usa Math.random), límite de intentos de acceso en el servidor.
