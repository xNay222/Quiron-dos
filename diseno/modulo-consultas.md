# Módulo "Consultas médicas" — especificación (resumen del encargo del usuario)

Integrado en Quirón Dos (no app aparte): mismos pacientes (S.patients), médicos (S.doctors/MEDICOS), usuarios/roles (ROLES, PERMS, can()), agenda (S.appts), historia (S.hc / notas firmadas), exámenes (S.exams), inventario/medicamentos (S.products), estilo "Espacios". La IA ayuda a redactar; nunca decide ni firma.

## Principios no negociables
- Datos estructurados, no un bloque de texto. Un campo vacío = "no documentado", NUNCA "normal" ni "negado".
- Estados por ítem: Presente / Ausente / No interrogado / Desconocido; examen físico: Normal / Alterado / No examinado.
- Alergias: tres estados distintos — alergias conocidas (lista), "niega alergias conocidas", "desconocido / no confirmado". Vacío ≠ niega.
- Diagnóstico: prioridad (principal/secundario) y certeza (presuntivo/confirmado/diferencial/pendiente de estudio) son campos separados.
- Solicitado ≠ realizado ≠ resultado recibido. Prescrito ≠ administrado.
- Respuestas ocultas por una condición que dejó de cumplirse no entran al informe (se conservan marcadas como descartadas).
- Plantillas no rellenan resultados: solo muestran preguntas.
- Firmado = inalterable; correcciones por adenda con traza (quién, cuándo, qué).
- Guardado automático con indicador visible: "Guardando…", "Guardado", "Error al guardar" (nunca mentir).
- Retomar borradores; salir de la pantalla nunca firma.

## Modelo de datos (S.consults, con migrate())
consulta: { id, pid, doc, specialty, type (primera|control|seguimiento|preoperatoria|postoperatoria|urgencia|interconsulta|otra), modality (presencial|teleconsulta|domiciliaria), mode: 'quick'|'complete', apptId?, admId? (emergencia), date/time (zona America/Caracas), status: programada|en_espera|en_curso|borrador|pendiente_revision|firmada|cancelada,
  reasons: [{ key, label, main:bool, char:{onset, durN, durU, startDate, freq, evolution, intensity, location, side, quality, radiation, triggers[], relievers[], prevTx, txResponse, impact}, answers:{qid: value}, discarded:{qid:value} }],
  ros: { system: { item: 'presente'|'ausente'|'no_interrogado'|'desconocido' } },
  vitals: [{ at, sys, dia, hr, rr, temp, spo2, weight, height, bmi(auto), pain, glucose }]  (varias mediciones, nunca sobrescribir),
  exam: { region: { state:'normal'|'alterado'|'no_examinado', findings:{...}, note } },
  dx: [{ label, code?, codeSource?, priority, certainty }],
  orders: [{ examId|label, category: lab|imagen|otro, indication, priority, status }]  → se crean también en S.exams vinculados,
  rx: [{ productId?, drug, presentation, dose, unit, route, freq, duration, qty, notes }],
  plan: { conducts[], instructions[], nextControl, alarmSigns[], notes, referral? },
  report: { draft, edited, generatedAt, sourceHash, stale:bool, signedAt, signedBy, signedText, addenda:[] },
  audit: [{ at, user, action }] }
Antecedentes longitudinales del paciente (no por consulta): S.patients[i].history = { conditions[{name,state,since,tx,note,updatedAt}], surgeries[], allergies:{status:'conocidas'|'niega'|'desconocido', items[{substance,type,reaction,severity,verified}]}, meds[{drug,dose,freq,route,active}], family[], habits{}, gyneco{}, pediatric{} } con fecha de última confirmación. Migrar p.allergies existente a allergies.items con status 'conocidas' si hay, 'desconocido' si vacío.

## Plantillas clínicas (datos, no código de vista)
Archivo propio (p.ej. quiron/data-consult.js): catálogo de motivos por grupo (generales, neurológicos, respiratorios, cardiovasculares, digestivos, urológicos, musculoesqueléticos, dermatológicos, ginecológicos) + "Otro (texto libre)".
Cada plantilla: { id, name, version, active, specialties[], reasons[], questions:[{ id, label, type: single|multi|yesno|yesnounk|scale010|number|duration|date|text|search, options[], showIf:{qid, op, value} }], alarms:[{ id, when, text }] }.
Fase 1 con interrogatorio completo para: dolor abdominal, cefalea, dolor lumbar, dolor articular (rodilla como ejemplo), tos, fiebre, síntomas urinarios (con IPSS opcional). Otros motivos → formulario genérico de caracterización.
Ejemplo condicional: dolor abdominal → localización (epigastrio, hipocondrios, mesogastrio, hipogastrio, FID, FII, flancos, generalizado), carácter, síntomas asociados; si "Vómitos" → desde cuándo, nº episodios, hematemesis, tolera líquidos, signos de deshidratación.
Alertas: solo de reglas declaradas en la plantilla, mensaje informativo ("requiere valoración clínica prioritaria"), botón "Revisado" que queda en auditoría. Nunca diagnosticar.

## Pantallas
1. Sección "Consultas" en la navegación (médicos, residentes, admin; recepción solo ve agenda/estado sin contenido clínico). Panel: Consultas de hoy (hora, paciente, edad, especialidad, médico, tipo, estado, botón Comenzar/Continuar), Nueva consulta (buscador por cédula, nombre, apellido, teléfono, QRN; aviso de posibles duplicados; crear paciente sin cédula permitido), Pendientes (borradores), Anteriores (filtros paciente, médico, fecha, especialidad, diagnóstico).
2. Configuración: especialidad, médico (el de la sesión; cambiar solo si can()), tipo, modalidad, fecha/hora automática Caracas. Elegir CONSULTA RÁPIDA o CONSULTA COMPLETA (sugerida por tipo: control/post-op → rápida; primera/preop → completa).
3. Consulta COMPLETA: tres zonas — izquierda pasos con estado (Identificación, Motivo, Enfermedad actual, Antecedentes, Revisión por sistemas, Signos vitales, Examen físico, Diagnóstico, Exámenes, Tratamiento, Plan, Informe); centro solo la sección activa; derecha resumen persistente (nombre, edad, alergias destacadas, enfermedades, medicación activa, motivo, signos vitales, alertas). En tablet/móvil el resumen es un panel desplegable. Navegación libre, sin perder datos.
4. Consulta RÁPIDA: una pantalla compacta con 6 bloques (Paciente y contexto con última consulta/diagnósticos/alergias/medicación + "Ver historia completa"; Motivo y evolución: control, revisión de resultados, seguimiento, control postoperatorio, revisión de herida, etc. con Resuelto/Mejoría completa/parcial/Sin cambios/Empeoramiento/Reaparición/Nuevo síntoma; Signos vitales; Examen dirigido según motivo (p.ej. herida: cicatrización adecuada, eritema, edema, secreción, dehiscencia, sangrado, dolor); Diagnóstico y conducta (diagnósticos previos sugeridos sin confirmar); Informe rápido). Botón visible "Ampliar a consulta completa" y "Volver a vista rápida": mismo registro, nada se borra. Si aparecen señales de alarma (p.ej. fiebre + dolor progresivo + secreción en post-op) sugerir ampliar.
5. Controles: pocas opciones → botones (chips); muchas → selector con buscador; escala 0–10 deslizante; duración = número + unidad. Sin ventanas emergentes por cada selección. Texto libre siempre disponible como alternativa.
6. Diagnósticos: buscador en catálogo local (nombre + sinónimos + CIE-10 solo si está en el catálogo; nunca inventar códigos) + texto libre.
7. Exámenes: catálogo existente de Exámenes (incluye el del laboratorio de la clínica) + imagen y otros; crea órdenes en S.exams vinculadas a la consulta; orden imprimible.
8. Tratamiento: buscar en S.products (inventario) o texto libre; presentación, dosis, unidad, vía, frecuencia, duración, cantidad; mostrar alergias antes de añadir; NO calcular dosis ni interacciones con IA. Récipe en PDF aparte.
9. Plan: conductas (ambulatorio, observación, seguimiento, interconsulta, referencia, hospitalización, evaluación quirúrgica, exámenes, rehabilitación, urgencia, otro), indicaciones, próximo control (puede crear cita en Agenda), signos de alarma elegidos por el médico, referencia con especialidad destino.
10. Informe: "Generar informe" → borrador en editor; el médico edita, regenera (sin perder sus correcciones: si existen, mostrar el nuevo borrador al lado y dejar elegir), aprueba, firma, PDF. Si la consulta cambia tras generar, aviso "el borrador puede estar desactualizado". Al firmar: fecha/hora, médico, texto congelado, PDF, nota en la historia clínica del paciente (como las notas firmadas actuales) y la cita pasa a "atendida".

## IA: Gemini Flash vía el servidor local
- El navegador NUNCA ve la clave. serve.ps1 añade POST /__ia que lee la clave de la variable de entorno QUIRON_GEMINI_KEY (o de un archivo fuera del repo, p.ej. "datos privados/gemini.key", ignorado por git) y llama a la API de Gemini (modelo flash vigente). Si no hay clave, responde 503 y la app usa el redactor por plantillas.
- Enviar solo lo necesario: sin cédula, teléfono ni dirección; nombre opcional (por defecto iniciales). No registrar el contenido clínico en logs.
- Prompt del sistema: redactor médico documental en español; reglas del encargo (no inventar signos, hallazgos, diagnósticos, recetas ni dosis; vacío ≠ negativo; conservar incertidumbre; separar subjetivo/objetivo; orden cronológico; señalar información incompleta). Entrada = JSON estructurado de la consulta; salida = informe con las secciones del formato (rápido: identificación, motivo, evolución, hallazgos, impresión diagnóstica, conducta, seguimiento; completo: + enfermedad actual, antecedentes, revisión por sistemas, signos vitales, examen físico, exámenes, tratamiento).
- Redactor por plantillas (sin IA) siempre disponible como respaldo, con las mismas reglas.

## Después (no en esta entrega)
Emergencias: consulta rápida desde la ficha de cama. Hospitalización: evolutivo diario guiado con el mismo motor. Especialidades (gineco, uro, cirugía, plástica, pediatría, cardio, endocrino), preferencias por médico, fotos clínicas, comparación entre consultas, OCR de historias antiguas, estadísticas.

## Pruebas mínimas
Paciente nuevo completo hasta firma; paciente recurrente recupera antecedentes sin sobrescribir; condicional de vómitos (aparece/desaparece y no entra al informe); respiratorio no examinado no sale como "normal"; alergia desconocida no sale como "niega"; borrador retomado; corrección del médico conservada al regenerar; firmado no editable (solo adenda); recepción no ve contenido clínico; cambio rápida↔completa sin pérdida.
