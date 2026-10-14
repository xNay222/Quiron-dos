Tarea para Codex (escritura). Trabaja SOLO en C:\Users\user\Documents\Quiron\Quiron-Dos. NO toques C:\Users\user\Documents\Quiron\Software. NO hagas commits. Respeta todos los cambios sin commit (no reviertas nada). Español de Venezuela, trato de usted. Código legible (funciones con saltos de línea, comentarios breves en español), nunca líneas minificadas.

Contexto: módulo Consultas en quiron/data-consult.js (motor CONSULT), quiron/views-consult.js (panel y acciones cc*), quiron/data-guided.js (GUIDE y EVOLUTION: pasos del asistente) y quiron/views-guided.js (asistente guiado de consulta y de evolución de ingresados). Pruebas: herramientas/pruebas-consultas.cjs (33), herramientas/pruebas-asistente-evolucion.cjs (23), herramientas/pruebas-cambios-2026.cjs (17). App: globales VIEWS/ACTIONS/UI, render(), go(), openSheet()/requestCloseSheet()/closeSheet(), toast(); S en localStorage con migrate(); permisos can()/isClin(). Estilo al final del <style> de quiron/index.html.

El dueño de la clínica probó el asistente y dice que sigue siendo poco intuitivo: lo quiere "para dummies". Pidió exactamente esto:

## 1. Una pregunta por pantalla (estilo cuestionario)
Rediseña la PRESENTACIÓN del asistente de consulta (rápida y completa) y del asistente de evolución, sin cambiar el modelo de datos ni las reglas clínicas:
- Cada pantalla muestra UNA sola pregunta, con el texto grande (≈24–28 px), y sus respuestas como botones grandes a lo ancho (una opción por fila en teléfono; en computadora, filas o rejilla de 2 columnas), altura ≥ 56 px.
  Ejemplo: "¿Cómo empezó el dolor?" → [Súbito] [Gradual] [Progresivo] [No sabe].
- Selección única (single, Sí/No/Desconocido, Normal/Alterado/No examinado, escala 0–10): al tocar la respuesta se guarda y pasa SOLA a la siguiente pregunta (con una transición corta de deslizamiento; respeta prefers-reduced-motion). Volver atrás muestra la respuesta marcada y permite cambiarla.
- Selección múltiple: botones que se marcan/desmarcan + botón grande "Continuar".
- Número, fecha, duración (número + unidad como botones), texto: el campo grande enfocado + "Continuar" (Enter también continúa).
- Escala 0–10: once botones grandes 0…10 (no un deslizador).
- Siempre visibles abajo: "‹ Anterior" y "Omitir ›" (omitir deja la pregunta como no documentada; NUNCA normal ni negada). Arriba: barra de progreso fina y "Pregunta N de M" + nombre de la sección en pequeño (p. ej. "Cefalea · Pregunta 3 de 18"). El texto libre de cada pregunta ("_free"/Observaciones) NO es una pantalla aparte: es un enlace pequeño "Agregar observación" bajo los botones que abre un campo en la misma pantalla.
- Preguntas condicionales: se insertan en la secuencia justo después de la que las activa (al marcar "Vómitos" aparecen a continuación sus preguntas); si se desactivan, salen de la secuencia y su respuesta queda descartada como ya hace el motor.
- Bloques que no son una sola pregunta, adaptados al estilo:
  · Motivo: pantalla "¿Por qué consulta hoy?" con buscador grande y los motivos frecuentes como botones; tras elegir uno: "¿Algún otro motivo?" [No, continuar] [Agregar otro].
  · Alergias (MUY importante): "¿El paciente tiene alergias?" [Sí, tiene alergias] [No tiene / las niega] [No sabe]. Si "Sí": pantalla para agregar con botones de alergias frecuentes (Penicilina, Amoxicilina, Cefalosporinas, Sulfas, AINEs / Ibuprofeno, Aspirina, Diclofenac, Metamizol (Dipirona), Yodo / medio de contraste, Látex, Mariscos, Huevo, Maní) + buscador en S.products + texto libre; por cada una, reacción y gravedad como botones (Leve/Moderada/Grave/No sabe). Se guardan en el antecedente longitudinal del paciente.
  · Si el paciente ya tiene antecedentes registrados: una pantalla por grupo "¿Sigue igual?" mostrando lo registrado → [Sí, sigue igual] [Actualizar].
  · Revisión por sistemas: una pantalla por sistema: "¿Interrogó el sistema respiratorio?" [Sí] [No, omitir]; si Sí, una pantalla con los síntomas de ese sistema como filas con [Presente] [Ausente] grandes y "Continuar".
  · Signos vitales: una pantalla por signo con teclado numérico grande (PAS/PAD juntas en una pantalla "Presión arterial"), unidad visible, aviso inmediato de valor imposible; el IMC se muestra solo al tener peso y talla. "Agregar otra medición" al final.
  · Examen físico: una pantalla por región: "¿Cómo encontró el abdomen?" [Normal] [Alterado] [No lo examiné]. Normal → pantalla "¿Qué verificó como normal?" (multi). Alterado → hallazgos (multi + observación).
  · Diagnóstico, exámenes y tratamiento: buscador grande + resultados como botones; después de cada elección, "¿Agregar otro?" [No, continuar] [Sí].
  · Al final: pantalla "Revisar" con un resumen legible de todas las respuestas por sección, cada sección con "Cambiar" (lleva a su primera pregunta), luego Generar informe → editar → aprobar → firmar (reutiliza lo existente).
- Quita "Ir a…" como menú desplegable: la pantalla "Revisar" cumple esa función. Mantén "Ampliar a consulta completa" en la rápida como enlace visible.
- Retomar un borrador abre en la última pregunta visitada. Guardado automático con indicador discreto.
- Teléfono, tableta y computadora sin desplazamiento horizontal; la pregunta y sus botones caben sin hacer scroll en una pantalla normal.

## 2. "Nueva consulta" abre un mini menú
En el panel de Consultas (que al usuario le gusta y se mantiene), el botón "Nueva consulta" abre una ventana pequeña (openSheet) con dos opciones grandes: [Buscar paciente] (buscador inmediato por cédula/nombre/teléfono/QRN con resultados como botones) y [Registrar paciente nuevo] (el alta existente). Elegido el paciente, empieza el asistente. La lista de pacientes visible en el panel se puede quedar.

## 3. Alergias fáciles de agregar en cualquier momento
- En la pulsera del paciente (patient-band) y en el perfil del paciente, las alergias se ven claras con su estado (conocidas / niega / desconocido) y un botón "+ Alergia" que abre la misma pantalla rápida del punto 1 (botones de alergias frecuentes). Debe funcionar también fuera de una consulta (perfil, ficha de ingreso), para médicos, residentes y enfermería (enfermería puede registrar alergias referidas, marcadas como "sin verificar"); recepción no.
- Mantén la compatibilidad con p.allergies (array de texto) que usan otras vistas: al agregar, actualiza ambos (history.allergies.items y p.allergies) para que las alertas existentes (pill "Alergias", aviso al pedir medicación) sigan funcionando.

## 4. Evolución desde la tarjeta de cama
- En Hospitalización y Emergencias, cada tarjeta de cama ocupada (views-hosp.js, junto a "Ver ingreso" y "Solicitar medicación") tiene un botón "Generar informe evolutivo" (solo médicos y residentes) que abre directamente el asistente de evolución de ese ingreso (o retoma su borrador: entonces el botón dice "Continuar informe evolutivo").
- El documento resultante NO se titula "Informe evolutivo": la nota firmada y su PDF se titulan "Evolución médica" (o "Valoración inicial del ingreso" si es la primera nota del ingreso). Se guarda en la historia del paciente como hoy (S.hc, tipo evolucion/ingreso, admId).
- El asistente de evolución usa también el estilo de una pregunta por pantalla.

## Verificación obligatoria
node --check en todos los .js tocados; las tres suites de pruebas deben pasar (adáptalas si cambian claves de pasos, sin debilitar lo que comprueban) y añade pruebas para: auto-avance en selección única, inserción/retiro de condicionales en la secuencia, omitir = no documentado, alergias rápidas (estado conocidas, p.allergies sincronizado, enfermería marca sin verificar, recepción no puede), mini menú de nueva consulta, botón de evolución en la tarjeta de cama y título "Evolución médica". Servidor de pruebas: http://localhost:8093/ (datos de demostración; entrar como médico en consola: const d=activeDocs().find(m=>!m.resident); const u={id:'uM',name:d.name,role:'medico',doc:d.id,status:'activo'}; S.users=[u]; applyUser(u); document.getElementById('auth')&&(document.getElementById('auth').hidden=true); document.querySelector('.app').hidden=false; go('consultas')). NO uses el puerto 8082. No dejes temporales en el proyecto.

Entrega en español: archivos tocados, cómo es ahora cada flujo (consulta, alergias, evolución), resultados de pruebas, qué quedó parcial y riesgos.
