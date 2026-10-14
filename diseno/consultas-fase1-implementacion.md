# Consultas médicas — implementación de fase 1

Fecha: 11 de octubre de 2026. Trabajo exclusivo en Quiron-Dos, sin commits. Se conservaron los cambios previos del proyecto. No se accedió a Software ni al puerto 8082. No se crearon perfiles de navegador ni archivos temporales.

## Archivos

Creados:
- quiron/data-consult.js: catálogo de motivos, diagnósticos con sinónimos, antecedentes, ROS, examen, signos, plantillas versionadas y funciones del motor.
- quiron/views-consult.js: panel y ruta de consulta, controles, guardado, firma, órdenes, documentos y resumen longitudinal.
- herramientas/pruebas-consultas.cjs: pruebas de modelo, acciones, permisos y persistencia. La opción --pdf agrega generación real de documentos y necesita descargar la misma biblioteca jsPDF de la app, comprobando su integridad.
- herramientas/pruebas-servidor-consultas.ps1: ejecuta el bloque real /__ia con contexto simulado, sin claves ni llamadas externas.
- Este documento.

Ajustados:
- quiron/data.js: migrate() incorpora consultas/antecedentes; save() restaura el JSON anterior si falla la escritura de su revisión.
- quiron/app.js: navegación y permisos; vaciado del debounce al navegar; protección de alergias en las bandas de pacientes para recepción.
- quiron/index.html: carga del motor/vistas y estilos de composición en escritorio/móvil.
- quiron/views-agenda.js: Comenzar consulta desde una cita.
- quiron/views-clin.js: apertura de notas enlazadas a Consultas, bloqueo de edición de firmadas y adendas con permiso/persistencia/traza.
- quiron/views-ops.js: compatibilidad del editor de pacientes con antecedentes longitudinales y ocultación/preservación de campos clínicos para recepción.
- quiron/views-exams.js: identificación y presentación de órdenes de categoría Otros.
- serve.ps1: endpoint POST /__ia. Se conserva la arquitectura HttpListener y los endpoints anteriores.

No se cambió pdf-kit.js durante esta tarea. Los documentos de Consultas llaman a sus primitivas existentes.

## Modelo y migraciones

S.consults es un arreglo independiente de S.hc. Cada registro contiene los datos de la especificación: paciente/médico, especialidad, tipo, modalidad, mode quick|complete, fecha/hora/zona Caracas, vínculos explícitos apptId/admId, motivos con char/answers/discarded, ROS, mediciones, examen, diagnósticos, órdenes, prescripción, plan, informe y auditoría. S.consultsSchema = 1 identifica la migración.

Cada motivo guarda una copia de su plantilla, su ID y su versión. Cambiar las plantillas futuras no cambia los interrogatorios ya registrados. Las respuestas condicionales ocultas se conservan en discarded y se excluyen del JSON/informe; no se restauran automáticamente al volver a cumplir la condición.

p.history guarda condiciones, cirugías, alergias en tres estados, medicación, familiares, hábitos, ginecoobstétricos y pediátricos. La migración conserva los arreglos originales. Alergias no vacías pasan a conocidas con verificación pendiente; vacío pasa a desconocido, nunca a niega. Una historia longitudinal ya existente no se reemplaza.

El motor proyecta actualizaciones hacia los arreglos de compatibilidad del paciente. La edición clínica desde la ficha anterior conserva los detalles de entradas que continúan y archiva versiones anteriores en history.archivedChanges. Borrar allí la lista de alergias cambia el estado a desconocido y conserva las entradas previas; no registra una negación. Recepción no puede modificar estos antecedentes al editar contacto/demografía.

La firma almacena texto, fecha real, médico/usuario y copias del médico, identificación local y antecedentes. Crea una nota firmada de tipo consulta en S.hc con consultId/noteId, enlaza las órdenes por ID y marca la cita atendida. Adendas se agregan en ambos registros, con fecha/autor, sin alterar signedText. No hay firma al salir.

El guardado se ejecuta con debounce de 350 ms; el estado visible depende del booleano real de save(). Se vacía al navegar o cerrar la página. Firma, aprobación, órdenes y citas usan guardado con reversión en memoria ante fallos. Si falla el contador de revisión, save() intenta restaurar el JSON previo; si también falla esa restauración, bloquea futuras escrituras.

## Alcance implementado

1–9 tienen implementación funcional en el código: panel, alta con documento opcional y revisión de duplicados/representante, configuración, ambas vistas sobre un registro, controles, antecedentes, plantillas de abdominal/cefalea/articular/lumbar/tos/fiebre/urinarios/IPSS y seguimiento/postoperatorio, alarmas revisables, diagnósticos, órdenes, tratamiento, plan/control, redacción y firma.

La consulta completa tiene los doce pasos y resumen persistente. Por debajo de 1024 px el resumen se abre como panel desplegable, cerrado inicialmente. La rápida contiene seis bloques, motivos de seguimiento primero y apartados opcionales desplegables.

La generación local está disponible sin servidor/IA. Si existe una clave, se intenta Gemini después de poner a disposición el borrador local. Los cambios médicos se conservan; los borradores nuevos se muestran al lado para elegir, combinar o mantener el texto revisado. Un hash de los datos clínicos vigentes invalida la aprobación si cambian. El hash es un detector de cambios, no una firma criptográfica.

Se generan informe, récipe, orden y referencia mediante pdf-kit. Son descargas independientes y se pueden reintentar desde la consulta firmada. Un error de descarga no deshace una firma guardada.

Las órdenes se crean SOLO al pulsar Solicitar examen y nacen como solicitado. El informe no confunde ese estado con realización o resultado. La prescripción no descuenta inventario ni registra administración.

El catálogo diagnóstico es inicial y reducido: admite texto libre sin códigos, y solo añade CIE-10 al elegir una entrada explícita del catálogo. No incluye todavía un catálogo CIE-10 completo ni sustitución de criterio clínico. Debe revisarse clínicamente antes de uso asistencial.

## Gemini: configuración para el usuario

Opción de archivo:
1. Cree la carpeta datos privados dentro de Quiron-Dos, si no existe.
2. Cree datos privados\gemini.key con únicamente su clave, sin comillas. La carpeta ya está ignorada por Git. No coloque el archivo dentro de quiron.
3. Cierre y reinicie el servidor del puerto de pruebas 8093 para cargar serve.ps1 actualizado. Desde Quiron-Dos:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1 -Port 8093
~~~

Alternativa: defina QUIRON_GEMINI_KEY en el entorno del proceso que inicia el servidor. Esta variable tiene prioridad sobre el archivo. El navegador nunca recibe ni almacena la clave.

El modelo se cambia con QUIRON_GEMINI_MODEL antes de iniciar el servidor; el valor por defecto es gemini-2.5-flash:

~~~powershell
$env:QUIRON_GEMINI_MODEL = 'gemini-2.5-flash'
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1 -Port 8093
~~~

Sin clave, POST /__ia debe devolver 503. La aplicación conserva el borrador por plantillas y avisa Informe redactado sin IA. Fallos de proveedor, timeout o respuesta truncada también conservan el respaldo local.

El gateway usa generateContent, systemInstruction con 16 reglas documentales, x-goog-api-key, timeout de 20 segundos y límite de entrada. No imprime contenido clínico ni devuelve errores crudos del proveedor. Rechaza orígenes ajenos y campos identificativos. Referencia del API: https://ai.google.dev/api/generate-content

El JSON usa una lista blanca; no contiene cédula, teléfono, dirección, IDs operativos ni nombre real. Solo iniciales, edad/sexo y datos clínicos. También se omiten coincidencias con identificadores conocidos de la ficha que aparezcan en texto libre. Esto no garantiza detectar datos personales de terceros o variantes no coincidentes: revise el texto libre antes de usar IA. El encabezado con identificación real se compone localmente.

## Verificación

Pruebas locales:

~~~powershell
node herramientas/pruebas-consultas.cjs
node herramientas/pruebas-cambios-2026.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File herramientas/pruebas-servidor-consultas.ps1
~~~

Resultados: 33 grupos de Consultas, 17 grupos de regresión existente y 12 comprobaciones del bloque PowerShell correctos. Los diez casos obligatorios del final de modulo-consultas.md están cubiertos. Se agrega cobertura de fallos de firma y contador de revisión, permisos de adendas, snapshots, compatibilidad de antecedentes, configuración, privacidad y categoría Otros.

node --check se ejecuta sobre todos los JavaScript cambiados y la prueba nueva. serve.ps1 pasa el parser de PowerShell.

Verificación parcial/bloqueada:
- GET http://localhost:8093/ responde 200 y contiene los scripts actualizados.
- El proceso que ya atendía 8093 conserva el script anterior y responde 404 en /__ia. No se logró reiniciarlo: iniciar HttpListener desde el entorno de ejecución devuelve Operación no permitida en esta plataforma, y la consulta de procesos por WMI/CIM devuelve Acceso denegado. No se detuvo ningún proceso por conjetura y no se tocó 8082.
- El 503 fue comprobado ejecutando el bloque real con objetos de solicitud/respuesta simulados; falta comprobarlo por HTTP después de reiniciar el servidor en un entorno que permita HttpListener.
- No hubo revisión visual de escritorio/móvil: no hay navegador disponible en las herramientas (inventario vacío).
- La prueba opcional node herramientas/pruebas-consultas.cjs --pdf no pudo descargar jsPDF por restricción de red EACCES. No se verificaron visualmente los PDF ni una respuesta Gemini real con clave. La descarga PDF depende de las bibliotecas CDN ya usadas por la app.

Antes de considerar cerrada la aceptación visual/HTTP, reinicie exclusivamente 8093, ejecute las pruebas y compruebe POST /__ia sin una clave configurada. Luego revise la captura/firma y los PDF con los datos de demostración. No pruebe con los datos del puerto 8082.

## Siguientes pasos: Emergencias y Hospitalización

Los puntos 10–11 se dejaron para la fase siguiente. No se modificó el formulario libre ni se añadieron botones a ingresos en esta entrega.

Emergencias: añadir Consulta rápida de emergencia en admissionView para area emerg; llamar consultStart con pid, admId y type urgencia. Validar ingreso vigente, que pid corresponda al ingreso y autoría del médico. La nota firmada queda en ese admId exclusivamente, sin inferir un ingreso por paciente/fecha.

Hospitalización: añadir tipo documental evolucion y plantilla de evolutivo diario, con evolución/cumplimiento/efectos adversos, múltiples mediciones, examen dirigido y plan. Usar el mismo borrador/aprobación/firma, crear nota type evolucion con admId y conservar Nota libre como opción. Probar dos ingresos del mismo paciente para demostrar aislamiento, además de ingreso cerrado y dos evoluciones del mismo día.

Otras fases: catálogos clínicos revisados más amplios, especialidades, preferencias por médico, comparación longitudinal, fotos/OCR y estadísticas. Los permisos y la firma de este prototipo siguen siendo controles locales en el navegador, no autorización de un backend ni firma criptográfica.
