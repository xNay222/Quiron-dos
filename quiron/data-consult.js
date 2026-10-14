// Motor documental compartido. Datos versionados y funciones puras; ninguna regla diagnostica.
const CONSULT = (() => {
  const version = 1;
  const clone = x => JSON.parse(JSON.stringify(x));
  const filled = x => x !== undefined && x !== null && x !== '' && (!Array.isArray(x) || x.length > 0) && (typeof x !== 'object' || Array.isArray(x) || Object.keys(x).length > 0);
  const key = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const groups = {
    'Generales': 'Fiebre|Malestar general|Fatiga|Pérdida de peso|Aumento de peso|Debilidad|Mareos|Desmayos|Dolor no especificado',
    'Neurológicos': 'Cefalea|Vértigo|Alteración de sensibilidad|Debilidad muscular|Convulsiones|Alteraciones visuales|Alteraciones de conciencia',
    'Respiratorios': 'Tos|Dificultad respiratoria|Dolor torácico|Congestión nasal|Dolor de garganta|Expectoración|Sibilancias',
    'Cardiovasculares': 'Palpitaciones|Dolor torácico|Edemas|Hipertensión arterial|Síncope|Disnea de esfuerzo',
    'Digestivos': 'Dolor abdominal|Náuseas|Vómitos|Diarrea|Estreñimiento|Reflujo|Sangrado digestivo|Distensión abdominal',
    'Urológicos': 'Ardor al orinar|Aumento de frecuencia urinaria|Sangre en orina|Dolor lumbar|Dolor testicular|Dificultad para orinar|Incontinencia|Retención urinaria|Alteraciones prostáticas',
    'Musculoesqueléticos': 'Dolor lumbar|Dolor cervical|Dolor articular|Dolor muscular|Traumatismo|Limitación de movimiento|Inflamación articular',
    'Dermatológicos': 'Erupciones|Prurito|Lesiones cutáneas|Cambios de pigmentación|Heridas|Infecciones cutáneas',
    'Ginecológicos': 'Dolor pélvico|Alteraciones menstruales|Sangrado vaginal|Flujo vaginal|Control prenatal|Control ginecológico|Dolor mamario|Consulta anticonceptiva',
    'Rápida': 'Control médico|Revisión de resultados|Seguimiento de tratamiento|Control postoperatorio|Revisión de herida|Reevaluación de síntomas|Renovación de tratamiento|Nuevo síntoma|Otro'
  };
  const reasons = Object.entries(groups).flatMap(([group, labels]) => labels.split('|').map(label => ({
    key: key(label),
    label,
    group
  }))).concat({
    key: 'otro_motivo',
    label: 'Otro motivo (texto libre)',
    group: 'Otro'
  });
  const types = {
    primera: 'Primera consulta',
    control: 'Control',
    seguimiento: 'Seguimiento',
    preoperatoria: 'Preoperatoria',
    postoperatoria: 'Postoperatoria',
    urgencia: 'Urgencia',
    interconsulta: 'Interconsulta',
    otra: 'Otra'
  };
  const modes = {
    presencial: 'Presencial',
    teleconsulta: 'Teleconsulta',
    domiciliaria: 'Domiciliaria'
  };
  const evolution = ['Resuelto', 'Mejoría completa', 'Mejoría parcial', 'Sin cambios', 'Empeoramiento', 'Reaparición', 'Nuevo síntoma'];
  const conducts = ['Tratamiento ambulatorio', 'Observación', 'Seguimiento', 'Interconsulta', 'Referencia a especialista', 'Hospitalización', 'Evaluación quirúrgica', 'Solicitud de exámenes', 'Rehabilitación', 'Manejo de urgencia', 'Otro'];
  const instructions = ['Reposo relativo', 'Hidratación según indicación médica', 'Cumplir el tratamiento indicado', 'Acudir al control', 'Traer resultados al control'];
  const alarmSigns = ['Fiebre persistente', 'Dificultad respiratoria', 'Dolor progresivo', 'Sangrado', 'Alteración de conciencia', 'Intolerancia a líquidos', 'Empeoramiento general'];
  const conditions = 'Hipertensión arterial|Diabetes mellitus|Asma|EPOC|Cardiopatía isquémica|Insuficiencia cardíaca|Arritmias|Enfermedad renal|Litiasis renal|Enfermedad hepática|Enfermedades tiroideas|Autoinmunes|Epilepsia|Neurológicas|Psiquiátricas|Infecciosas relevantes|Cáncer|Trastornos de coagulación|Otras'.split('|');
  const ros = {
    Constitucional: 'Fiebre|Escalofríos|Pérdida de peso|Astenia|Sudoración nocturna',
    Cardiovascular: 'Dolor torácico|Palpitaciones|Síncope|Edemas|Disnea de esfuerzo|Ortopnea',
    Respiratorio: 'Tos|Expectoración|Disnea|Sibilancias|Hemoptisis',
    Gastrointestinal: 'Náuseas|Vómitos|Diarrea|Estreñimiento|Dolor abdominal|Sangrado|Pirosis',
    Genitourinario: 'Disuria|Polaquiuria|Hematuria|Nicturia|Incontinencia',
    Neurológico: 'Cefalea|Mareo|Debilidad focal|Parestesias|Convulsiones',
    Musculoesquelético: 'Artralgias|Mialgias|Rigidez|Lumbalgia',
    Endocrino: 'Poliuria|Polidipsia|Intolerancia al frío/calor',
    Dermatológico: 'Erupción|Prurito|Lesiones',
    Hematológico: 'Sangrados|Hematomas|Adenopatías',
    Psiquiátrico: 'Ánimo bajo|Ansiedad|Insomnio',
    ORL: 'Odinofagia|Otalgia|Rinorrea|Epistaxis',
    Oftalmológico: 'Visión borrosa|Ojo rojo|Dolor ocular',
    Otros: 'Otros síntomas'
  };
  const exam = {
    'Estado general': 'Conciencia|Orientación|Apariencia|Hidratación|Estado nutricional|Dificultad respiratoria',
    'Cabeza y cuello': 'Pupilas|Conjuntivas|Mucosas|Orofaringe|Adenopatías|Tiroides|Movilidad cervical',
    Cardiovascular: 'Ritmo|Frecuencia|Ruidos|Soplos|Pulsos|Perfusión|Edemas',
    Respiratorio: 'Esfuerzo|Expansión|Murmullo vesicular|Sibilancias|Crepitantes|Roncus',
    Abdomen: 'Aspecto|Distensión|Ruidos|Dolor a la palpación|Localización|Intensidad|Superficial/profundo|Defensa|Irritación peritoneal|Masas',
    Neurológico: 'Estado mental|Lenguaje|Pares craneales|Fuerza|Sensibilidad|Reflejos|Coordinación|Marcha',
    Musculoesquelético: 'Región|Dolor|Edema|Deformidad|Rango de movimiento|Fuerza|Estabilidad|Limitación',
    Piel: 'Coloración|Temperatura|Humedad|Integridad|Lesiones|Eritema|Equimosis|Heridas|Cicatrices',
    'Herida quirúrgica': 'Cicatrización adecuada|Eritema|Edema|Secreción|Dehiscencia|Sangrado|Dolor',
    'Exploraciones íntimas': 'Consentimiento|Acompañante|Exploración realizada|Hallazgos'
  };
  const vitals = [['sys', 'PAS', 'mmHg', 40, 300], ['dia', 'PAD', 'mmHg', 20, 200], ['hr', 'FC', 'lpm', 20, 250], ['rr', 'FR', 'rpm', 4, 100], ['temp', 'Temperatura', '°C', 30, 45], ['spo2', 'SatO₂', '%', 50, 100], ['weight', 'Peso', 'kg', 0.5, 400], ['height', 'Talla', 'cm', 30, 250], ['pain', 'Dolor', '0–10', 0, 10], ['glucose', 'Glucemia capilar', 'mg/dL', 10, 1000]];
  // Solo códigos presentes aquí: no se interpreta un código escrito en texto libre.
  const diagnoses = [['Hipertensión esencial', 'I10', 'HTA|presión alta'], ['Diabetes mellitus tipo 2', 'E11.9', 'DM2|diabetes tipo dos'], ['Asma', 'J45.9', 'asma bronquial'], ['Dolor abdominal', 'R10.4', 'dolor de barriga|abdominalgia'], ['Cefalea', 'R51', 'dolor de cabeza'], ['Lumbalgia', 'M54.5', 'dolor lumbar'], ['Tos', 'R05', 'tos seca|tos productiva'], ['Fiebre', 'R50.9', 'hipertermia'], ['Disuria', 'R30.0', 'ardor al orinar'], ['Dolor articular', 'M25.5', 'artralgia|dolor de rodilla'], ['Migraña', 'G43.9', 'jaqueca'], ['Infección urinaria', 'N39.0', 'ITU|infección de orina'], ['Hipotiroidismo', 'E03.9', 'tiroides baja'], ['Control postoperatorio', null, 'revisión postoperatoria'], ['Apendicitis aguda', 'K35.8', 'apendicitis'], ['Colelitiasis sin colecistitis', 'K80.2', 'cálculos en la vesícula|piedras en la vesícula'], ['Colelitiasis con colecistitis aguda', 'K80.0', 'colecistitis litiásica'], ['Colecistitis aguda', 'K81.0', 'vesícula inflamada'], ['Hernia inguinal unilateral sin obstrucción ni gangrena', 'K40.9', 'hernia inguinal'], ['Hernia umbilical sin obstrucción ni gangrena', 'K42.9', 'hernia umbilical'], ['Hernia ventral sin obstrucción ni gangrena', 'K43.9', 'eventración|hernia incisional'], ['Gastritis no especificada', 'K29.7', 'gastritis'], ['Enfermedad por reflujo gastroesofágico sin esofagitis', 'K21.9', 'reflujo|ERGE'], ['Estreñimiento', 'K59.0', 'constipación'], ['Gastroenteritis y colitis de origen no especificado', 'A09.9', 'gastroenteritis|diarrea aguda'], ['Síndrome del colon irritable sin diarrea', 'K58.9', 'colon irritable'], ['Hemorroides no especificadas', 'K64.9', 'hemorroides'], ['Fisura anal no especificada', 'K60.2', 'fisura anal'], ['Absceso anal', 'K61.0', 'absceso perianal'], ['Náusea y vómito', 'R11', 'vómitos|náuseas'], ['Dolor localizado en parte superior del abdomen', 'R10.1', 'epigastralgia|dolor epigástrico'], ['Dolor localizado en otras partes inferiores del abdomen', 'R10.3', 'dolor en fosa ilíaca|dolor hipogástrico'], ['Cálculo del riñón', 'N20.0', 'litiasis renal|piedra en el riñón'], ['Cálculo del uréter', 'N20.1', 'litiasis ureteral|cólico nefrítico'], ['Hiperplasia de la próstata', 'N40', 'HPB|próstata agrandada'], ['Cistitis aguda', 'N30.0', 'cistitis'], ['Hidrocele no especificado', 'N43.3', 'hidrocele'], ['Hematuria no especificada', 'R31', 'sangre en la orina'], ['Infección aguda de las vías respiratorias superiores no especificada', 'J06.9', 'resfriado|IRA alta'], ['Faringitis aguda no especificada', 'J02.9', 'faringitis|dolor de garganta'], ['Neumonía no especificada', 'J18.9', 'neumonía'], ['Bronquitis aguda no especificada', 'J20.9', 'bronquitis'], ['Rinitis alérgica no especificada', 'J30.4', 'rinitis alérgica'], ['Sinusitis aguda no especificada', 'J01.9', 'sinusitis'], ['Otitis media no especificada', 'H66.9', 'otitis'], ['Amigdalitis crónica', 'J35.0', 'amígdalas'], ['Desviación del tabique nasal', 'J34.2', 'tabique desviado'], ['Várices de los miembros inferiores sin úlcera ni inflamación', 'I83.9', 'várices'], ['Insuficiencia cardíaca no especificada', 'I50.9', 'insuficiencia cardíaca'], ['Dolor en el pecho no especificado', 'R07.4', 'dolor torácico'], ['Obesidad no especificada', 'E66.9', 'obesidad'], ['Hiperlipidemia no especificada', 'E78.5', 'dislipidemia|colesterol alto'], ['Bocio nodular no tóxico, nódulo tiroideo solitario', 'E04.1', 'nódulo tiroideo'], ['Leiomioma del útero sin otra especificación', 'D25.9', 'mioma|fibroma uterino'], ['Otros quistes ováricos y los no especificados', 'N83.2', 'quiste de ovario'], ['Menstruación excesiva y frecuente con ciclo regular', 'N92.0', 'menorragia'], ['Vaginitis aguda', 'N76.0', 'vaginitis'], ['Masa no especificada en la mama', 'N63', 'nódulo mamario'], ['Gonartrosis no especificada', 'M17.9', 'artrosis de rodilla'], ['Cervicalgia', 'M54.2', 'dolor cervical'], ['Lumbago con ciática', 'M54.4', 'lumbociática'], ['Síndrome del manguito rotatorio', 'M75.1', 'manguito rotador|hombro doloroso'], ['Síndrome del túnel carpiano', 'G56.0', 'túnel carpiano'], ['Dedo en gatillo', 'M65.3', 'dedo en resorte'], ['Esguince y torcedura del tobillo', 'S93.4', 'esguince de tobillo'], ['Desgarro de meniscos, presente', 'S83.2', 'lesión de menisco'], ['Absceso cutáneo, furúnculo y carbunco de sitio no especificado', 'L02.9', 'absceso|furúnculo'], ['Celulitis de sitio no especificado', 'L03.9', 'celulitis'], ['Uña encarnada', 'L60.0', 'onicocriptosis'], ['Quiste tricolemal', 'L72.1', 'quiste sebáceo'], ['Tumor benigno lipomatoso, sin otra especificación', 'D17.9', 'lipoma'], ['Mareo y desvanecimiento', 'R42', 'mareo|vértigo inespecífico'], ['Trastorno de ansiedad generalizada', 'F41.1', 'ansiedad'], ['Episodio depresivo no especificado', 'F32.9', 'depresión'], ['Examen de seguimiento consecutivo a tratamiento', 'Z09', 'control|seguimiento'], ['Atención de los apósitos y suturas quirúrgicas', 'Z48.0', 'cura|retiro de puntos']].map(([label, code, synonyms]) => ({
    label,
    ...(code ? {
      code,
      codeSource: 'CIE-10 OMS (catálogo local)'
    } : {}),
    synonyms: synonyms.split('|')
  }));
  const Q = (id, label, type = 'yesnounk', options = [], showIf) => ({
    id,
    label,
    type,
    options,
    ...(showIf ? {
      showIf
    } : {})
  });
  const common = [Q('onset', 'Inicio', 'single', ['Súbito', 'Gradual', 'Progresivo', 'Desconocido']), Q('duration', 'Tiempo de evolución', 'duration'), Q('startDate', 'Fecha aproximada de inicio', 'date'), Q('frequency', 'Frecuencia', 'single', ['Constante', 'Intermitente', 'Recurrente', 'Episódico', 'Otro']), Q('evolution', 'Evolución', 'single', ['Mejorando', 'Empeorando', 'Sin cambios', 'Fluctuante']), Q('intensity', 'Intensidad', 'scale010'), Q('location', 'Localización', 'text'), Q('side', 'Lado', 'single', ['Derecho', 'Izquierdo', 'Bilateral', 'Central', 'Generalizado', 'Específica']), Q('quality', 'Carácter', 'single', ['Punzante', 'Opresivo', 'Urente', 'Cólico', 'Pulsátil', 'Sordo', 'Eléctrico', 'Otro']), Q('radiates', '¿Se irradia?'), Q('radiation', 'Localización de irradiación', 'text', [], {
    qid: 'radiates',
    op: 'eq',
    value: 'Sí'
  }), Q('triggers', 'Desencadenantes', 'multi', ['Movimiento', 'Esfuerzo', 'Alimentación', 'Posición corporal', 'Respiración', 'Estrés', 'Exposición ambiental', 'Otros']), Q('relievers', 'Alivio', 'multi', ['Reposo', 'Cambio de posición', 'Medicamentos', 'Alimentación', 'Frío o calor', 'Otros']), Q('previousTreatment', 'Tratamiento previo', 'single', ['Ninguno', 'Medicamentos', 'Medidas físicas', 'Procedimientos', 'Otros']), Q('previousTreatmentDetail', 'Especifique tratamiento previo', 'text', [], { any: ['Medicamentos', 'Medidas físicas', 'Procedimientos', 'Otros'].map(value => ({ qid: 'previousTreatment', op: 'eq', value })) }), Q('response', 'Respuesta', 'single', ['Mejoría completa', 'Mejoría parcial', 'Sin mejoría', 'Empeoramiento', 'No evaluable']), Q('impact', 'Impacto funcional', 'single', ['Sin limitación', 'Leve', 'Moderada', 'Severa']), Q('free', 'Observaciones / texto libre', 'text')];
  const yes = labels => labels.split('|').map(label => Q(key(label), label));
  const templates = {};
  const T = (id, name, questions, alarms = [], useCommon = true) => templates[id] = {
    id,
    name,
    version,
    active: true,
    specialties: ['Todas'],
    reasons: [id],
    questions: [...(useCommon ? common.filter(q => !questions.some(s => s.id === q.id) && (!['tos', 'fiebre'].includes(id) || !['intensity', 'location', 'side', 'quality', 'radiates', 'radiation'].includes(q.id))) : []), ...questions],
    alarms
  };
  const eq = (qid, value = 'Sí') => ({
    qid,
    op: 'eq',
    value
  });
  const all = (...rules) => ({
    all: rules
  });
  const A = (id, when, text) => ({
    id,
    when,
    text: text + ' — requiere valoración clínica prioritaria.'
  });
  T('generic', 'Caracterización general', []);
  const vomiting = ['vomitDuration', 'vomitEpisodes', 'hematemesis', 'liquids', 'dehydration'];
  T('dolor_abdominal', 'Dolor abdominal', [Q('location', 'Localización', 'single', ['Epigastrio', 'Hipocondrio derecho', 'Hipocondrio izquierdo', 'Mesogastrio', 'Hipogastrio', 'FID', 'FII', 'Flanco derecho', 'Flanco izquierdo', 'Generalizado']), Q('quality', 'Carácter', 'single', ['Cólico', 'Punzante', 'Opresivo', 'Quemante', 'Continuo', 'Otro']), Q('associated', 'Síntomas asociados', 'multi', ['Náuseas', 'Vómitos', 'Diarrea', 'Estreñimiento', 'Fiebre', 'Distensión', 'Pérdida de apetito', 'Sangrado digestivo', 'Síntomas urinarios', 'Otros']), Q('food', 'Relación con alimentación', 'text'), Q('bowel', 'Relación con evacuación', 'text'), ...yes('Episodios similares|Cirugías abdominales previas'), Q('alarmDetail', 'Signos de alarma interrogados', 'text'), Q('pregnancy', 'Posibilidad de embarazo', 'yesnounk', [], {
    context: 'fertile',
    op: 'eq',
    value: true
  }), Q('vomitDuration', 'Vómitos: desde cuándo', 'duration', [], {
    qid: 'associated',
    op: 'includes',
    value: 'Vómitos'
  }), Q('vomitEpisodes', 'Vómitos: número de episodios', 'number', [], {
    qid: 'associated',
    op: 'includes',
    value: 'Vómitos'
  }), Q('hematemesis', 'Vómitos con sangre', 'yesnounk', [], {
    qid: 'associated',
    op: 'includes',
    value: 'Vómitos'
  }), Q('liquids', 'Tolera líquidos', 'yesnounk', [], {
    qid: 'associated',
    op: 'includes',
    value: 'Vómitos'
  }), Q('dehydration', 'Signos de deshidratación', 'yesnounk', [], {
    qid: 'associated',
    op: 'includes',
    value: 'Vómitos'
  })], [A('hematemesis', eq('hematemesis'), 'Sangre en vómitos'), A('intolerance', all(eq('liquids', 'No'), {
    qid: 'associated',
    op: 'includes',
    value: 'Vómitos'
  }), 'Intolerancia a líquidos')]);
  T('dolor_articular', 'Dolor articular / rodilla', [Q('side', 'Lado', 'single', ['Derecho', 'Izquierdo', 'Ambas']), Q('trauma', '¿Traumático?'), Q('mechanism', 'Mecanismo', 'text', [], eq('trauma')), Q('postFunction', 'Capacidad funcional posterior', 'text', [], eq('trauma')), Q('location', 'Localización en rodilla', 'single', ['Anterior', 'Posterior', 'Medial', 'Lateral', 'Otra región']), ...yes('Inflamación|Chasquidos|Bloqueo|Inestabilidad|Limitación|Dolor con carga|Dificultad para caminar|Lesiones previas|Cirugías previas'), Q('activity', 'Actividad física habitual', 'text')]);
  T('cefalea', 'Cefalea', [Q('quality', 'Carácter', 'single', ['Pulsátil', 'Opresiva', 'Otro']), ...yes('Fotofobia|Fonofobia|Náuseas|Vómitos|Alteraciones visuales|Fiebre|Rigidez de nuca|Déficit neurológico|Antecedente de migraña'), Q('medicines', 'Medicamentos usados', 'text')], [A('thunder', all(eq('onset', 'Súbito'), eq('intensity', 10)), 'Cefalea súbita de máxima intensidad'), A('meningeal', all(eq('fiebre'), eq('rigidez_de_nuca')), 'Fiebre y rigidez de nuca'), A('focal', eq('deficit_neurologico'), 'Déficit neurológico')]);
  const ipssNames = ['Vaciado incompleto', 'Frecuencia', 'Intermitencia', 'Urgencia', 'Chorro débil', 'Esfuerzo', 'Nicturia'];
  T('urinarios', 'Síntomas urinarios', [...yes('Disuria|Polaquiuria|Urgencia|Nicturia|Hematuria|Chorro disminuido|Vaciado incompleto|Retención|Incontinencia|Dolor lumbar|Fiebre|Litiasis previa|Infecciones previas'), Q('ipss', 'Aplicar IPSS opcional', 'yesno'), ...ipssNames.map((s, i) => ({
    ...Q('ipss' + i, 'IPSS · ' + s, 'single', [0, 1, 2, 3, 4, 5], eq('ipss')),
    help: i === 6 ? 'Número de veces por noche (5 = cinco o más).' : 'Último mes: 0 nunca; 1 menos de 1/5; 2 menos de la mitad; 3 la mitad; 4 más de la mitad; 5 casi siempre.'
  })), Q('ipssQoL', 'IPSS · calidad de vida (0 encantado – 6 terrible)', 'single', [0, 1, 2, 3, 4, 5, 6], eq('ipss'))]);
  T('dolor_lumbar', 'Dolor lumbar', [...yes('Irradiación a miembros|Déficit motor|Déficit sensitivo|Alteración de esfínteres|Trauma|Fiebre')], [A('sphincter', eq('alteracion_de_esfinteres'), 'Alteración de esfínteres'), A('motor', eq('deficit_motor'), 'Déficit motor')]);
  T('tos', 'Tos', [Q('kind', 'Tipo de tos', 'single', ['Seca', 'Productiva', 'Desconocido']), Q('sputum', 'Expectoración: características', 'text', [], eq('kind', 'Productiva')), ...yes('Disnea|Fiebre|Hemoptisis|Sibilancias'), Q('contact', 'Contacto / exposición', 'text')], [A('blood', eq('hemoptisis'), 'Hemoptisis'), A('dyspnea', eq('disnea'), 'Disnea documentada')]);
  T('fiebre', 'Fiebre', [{
    ...Q('maxTemp', 'Máxima registrada', 'number'),
    unit: '°C'
  }, Q('pattern', 'Patrón', 'text'), Q('focus', 'Foco aparente', 'text'), ...yes('Escalofríos'), Q('travel', 'Viajes', 'text'), Q('contact', 'Contactos', 'text')]);
  T('followup', 'Evolución en seguimiento', [Q('evolution', 'Evolución', 'single', evolution), Q('since', 'Desde cuándo', 'duration'), Q('adherence', 'Cumplimiento del tratamiento', 'single', ['Completo', 'Parcial', 'No cumplido', 'Desconocido']), Q('adverse', 'Efectos adversos', 'text'), Q('newSymptoms', 'Síntomas nuevos', 'text'), Q('alarms', 'Signos de alarma interrogados', 'text'), Q('free', 'Observaciones / texto libre', 'text')], [], false);
  T('postop', 'Control postoperatorio', [Q('procedure', 'Procedimiento', 'text'), Q('surgeryDate', 'Fecha de intervención', 'date'), Q('intensity', 'Dolor', 'scale010'), Q('progressivePain', 'Dolor progresivo'), Q('wound', 'Estado de herida', 'single', ['Cicatrización adecuada', 'Alterada', 'No examinada']), ...yes('Secreción|Sangrado|Fiebre|Inflamación|Apertura'), Q('evolution', 'Evolución general', 'single', evolution), Q('complications', 'Complicaciones', 'text'), Q('free', 'Observaciones / texto libre', 'text')], [A('postop', all(eq('fiebre'), eq('progressivePain'), eq('secrecion')), 'Fiebre, dolor progresivo y secreción')], false);
  Object.values(templates).forEach(t => {
    t.questions = t.questions.flatMap(q => ['single', 'multi', 'yesno', 'yesnounk', 'search'].includes(q.type) ? [q, Q(q.id + '_free', q.label + ' · texto libre', 'text', [], q.showIf)] : [q]);
  });
  function templateFor(k) {
    if (['ardor_al_orinar', 'aumento_de_frecuencia_urinaria', 'sangre_en_orina', 'dificultad_para_orinar', 'incontinencia', 'retencion_urinaria', 'alteraciones_prostaticas'].includes(k)) return templates.urinarios;
    if (['control_postoperatorio', 'revision_de_herida'].includes(k)) return templates.postop;
    if (reasons.some(r => r.key === k && r.group === 'Rápida')) return templates.followup;
    return templates[k] || templates.generic;
  }
  function matches(rule, answers, context = {}) {
    if (!rule) return true;
    if (rule.all) return rule.all.every(r => matches(r, answers, context));
    if (rule.any) return rule.any.some(r => matches(r, answers, context));
    const v = rule.context ? context[rule.context] : answers[rule.qid];
    if (rule.op === 'includes') return Array.isArray(v) && v.includes(rule.value);
    return v === rule.value;
  }
  function visibleQuestions(t, answers = {}, context = {}) {
    const visible = new Set();
    return t.questions.filter(q => {
      const ok = matches(q.showIf, answers, context) && (!q.showIf?.qid || visible.has(q.showIf.qid));
      if (ok) visible.add(q.id);
      return ok;
    });
  }
  const charMap = {
    onset: 'onset',
    startDate: 'startDate',
    frequency: 'freq',
    evolution: 'evolution',
    intensity: 'intensity',
    location: 'location',
    side: 'side',
    quality: 'quality',
    radiation: 'radiation',
    triggers: 'triggers',
    relievers: 'relievers',
    previousTreatment: 'prevTx',
    response: 'txResponse',
    impact: 'impact'
  };
  const charNames = {
    onset: 'Inicio',
    durN: 'Duración (número)',
    durU: 'Duración (unidad)',
    startDate: 'Fecha de inicio',
    freq: 'Frecuencia',
    evolution: 'Evolución',
    intensity: 'Intensidad 0–10',
    location: 'Localización',
    side: 'Lado',
    quality: 'Carácter',
    radiation: 'Irradiación',
    triggers: 'Desencadenantes',
    relievers: 'Alivio',
    prevTx: 'Tratamiento previo',
    txResponse: 'Respuesta',
    impact: 'Impacto funcional'
  };
  function reconcile(r, context = {}) {
    const out = clone(r);
    const t = out.template || templateFor(out.key);
    out.answers ||= {};
    out.discarded ||= {};
    const visible = new Set(visibleQuestions(t, out.answers, context).map(q => q.id));
    for (const q of Object.keys(out.answers)) if (!visible.has(q)) {
      out.discarded[q] = out.answers[q];
      delete out.answers[q];
    }
    out.char ||= {};
    for (const [qid, k] of Object.entries(charMap)) {
      if (t.questions.some(q => q.id === qid) && !visible.has(qid)) {
        if (filled(out.char[k])) out.discarded['char.' + k] = out.char[k];
        delete out.char[k];
      } else if (filled(out.answers[qid])) out.char[k] = out.answers[qid];else if (qid in out.discarded || qid in out.answers) delete out.char[k];
    }
    if (out.answers.duration) {
      if (filled(out.answers.duration.n)) out.char.durN = out.answers.duration.n;else delete out.char.durN;
      if (filled(out.answers.duration.unit)) out.char.durU = out.answers.duration.unit;else delete out.char.durU;
    }
    return out;
  } // no restaurar respuestas descartadas sin confirmación
  const bmi = (weight, height) => filled(weight) && filled(height) && +weight > 0 && +height > 0 ? Math.round(+weight / (+height / 100) ** 2 * 10) / 10 : null;
  function validateVitals(v) {
    const errors = [];
    vitals.forEach(([k, l, u, min, max]) => {
      if (filled(v[k]) && (!Number.isFinite(+v[k]) || +v[k] < min || +v[k] > max)) errors.push(l + ': rango permitido ' + min + '–' + max + ' ' + u);
    });
    if (filled(v.sys) && filled(v.dia) && +v.dia >= +v.sys) errors.push('La PAD debe ser menor que la PAS.');
    return errors;
  }
  const caracas = (d = new Date()) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(d).map(p => [p.type, p.value]));
    return {
      date: parts.year + '-' + parts.month + '-' + parts.day,
      time: parts.hour + ':' + parts.minute,
      timezone: 'America/Caracas'
    };
  };
  const age = (birth, date = caracas().date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth || '') || birth > date || Number.isNaN(new Date(birth + 'T12:00:00Z').getTime()) || new Date(birth + 'T12:00:00Z').toISOString().slice(0, 10) !== birth) return null;
    const b = birth.split('-').map(Number),
      d = date.split('-').map(Number);
    return d[0] - b[0] - (d[1] < b[1] || d[1] === b[1] && d[2] < b[2] ? 1 : 0);
  };
  const context = (p, c) => ({
    fertile: p?.sex === 'F' && age(p.birth, c.date) !== null && age(p.birth, c.date) >= 10 && age(p.birth, c.date) <= 55
  });
  function migratePatient(p) {
    const before = JSON.stringify(p);
    p.history ||= {};
    const h = p.history;
    h.conditions ||= (p.conditions || []).map(x => typeof x === 'string' ? {
      name: x,
      state: 'presente',
      note: 'Migrado; pendiente de confirmar'
    } : clone(x));
    h.surgeries ||= (p.surgeries || []).map(x => typeof x === 'string' ? {
      name: x
    } : clone(x));
    h.meds ||= (p.meds || []).map(x => typeof x === 'string' ? {
      drug: x,
      active: true,
      note: 'Migrado; pendiente de confirmar'
    } : clone(x));
    if (!h.allergies) {
      const items = (Array.isArray(p.allergies) ? p.allergies : typeof p.allergies === 'string' ? [p.allergies] : []).filter(x => typeof x === 'string' ? x.trim() : x?.substance).map(x => typeof x === 'string' ? {
        substance: x,
        type: 'otra',
        reaction: '',
        severity: 'desconocida',
        verified: false
      } : clone(x));
      h.allergies = {
        status: items.length ? 'conocidas' : 'desconocido',
        items
      };
    }
    h.allergies.items ||= [];
    h.allergies.status ||= h.allergies.items.length ? 'conocidas' : 'desconocido';
    h.family ||= [];
    h.habits ||= {};
    h.gyneco ||= {};
    h.pediatric ||= {};
    h.confirmations ||= [];
    p.allergies ||= [];
    return before !== JSON.stringify(p);
  }
  // Proyección de compatibilidad para los módulos existentes; history conserva los datos ricos.
  function syncLegacy(p) {
    const h = p.history;
    if (!h) return;
    p.allergies = h.allergies.status === 'conocidas' ? h.allergies.items.map(i => i.substance).filter(Boolean) : [];
    p.conditions = h.conditions.filter(i => i.state === 'presente').map(i => i.name).filter(Boolean);
    p.surgeries = h.surgeries.map(i => i.name).filter(Boolean);
    p.meds = h.meds.filter(i => i.active === true).map(i => [i.drug, i.dose].filter(Boolean).join(' '));
  }
  function applyLegacyClinical(p, data, at, by) {
    migratePatient(p);
    const h = p.history;
    h.archivedChanges ||= [];
    for (const [legacy, list, field] of [['allergies', 'allergies', 'substance'], ['conditions', 'conditions', 'name'], ['meds', 'meds', 'drug'], ['surgeries', 'surgeries', 'name']]) {
      if (JSON.stringify(data[legacy] || []) === JSON.stringify(p[legacy] || [])) continue;
      const previous = list === 'allergies' ? clone(h.allergies) : clone(h[list]);
      h.archivedChanges.push({
        at,
        by,
        source: 'ficha_anterior',
        field: legacy,
        previous
      });
      const old = list === 'allergies' ? h.allergies.items : h[list];
      const items = (data[legacy] || []).map(label => {
        const found = old.find(x => key(x[field]) === key(label) || list === 'meds' && key([x.drug, x.dose].filter(Boolean).join(' ')) === key(label));
        return found ? {
          ...found,
          updatedAt: at
        } : {
          [field]: label,
          ...(list === 'conditions' ? {
            state: 'presente'
          } : list === 'meds' ? {
            active: true
          } : list === 'allergies' ? {
            verified: false
          } : {}),
          updatedAt: at
        };
      });
      if (list === 'allergies') {
        h.allergies.status = items.length ? 'conocidas' : 'desconocido';
        if (items.length) h.allergies.items = items;
      } else h[list] = items;
      h.updatedAt = at;
      delete h.confirmedAt;
    }
  }
  function migrateState(s) {
    let changed = false;
    if (!s.consults) {
      s.consults = [];
      changed = true;
    }
    for (const p of s.patients || []) changed = migratePatient(p) || changed;
    for (const c of s.consults) {
      const defaults = newConsult({
        id: c.id,
        pid: c.pid,
        doc: c.doc
      });
      for (const [k, v] of Object.entries(defaults)) if (c[k] === undefined) {
        c[k] = v;
        changed = true;
      }
    }
    if (s.consultsSchema !== version) {
      s.consultsSchema = version;
      changed = true;
    }
    return changed;
  }
  function newConsult({
    id,
    pid,
    doc,
    apptId = null,
    admId = null,
    type = 'primera',
    specialty = '',
    mode,
    ...clock
  }) {
    return {
      id,
      pid,
      doc,
      apptId,
      admId,
      specialty,
      type,
      modality: 'presencial',
      mode: mode || (['control', 'postoperatoria', 'seguimiento', 'urgencia'].includes(type) ? 'quick' : 'complete'),
      ...caracas(),
      ...clock,
      version,
      status: 'borrador',
      reasons: [],
      ros: {},
      vitals: [],
      exam: {},
      dx: [],
      orders: [],
      rx: [],
      plan: {
        conducts: [],
        instructions: [],
        alarmSigns: [],
        nextControl: '',
        notes: '',
        referral: ''
      },
      report: {
        draft: '',
        edited: false,
        generatedAt: null,
        sourceHash: null,
        stale: false,
        signedAt: null,
        signedBy: null,
        signedText: null,
        addenda: []
      },
      audit: [],
      steps: {}
    };
  }
  function newReason(k, label, main = false) {
    const t = clone(templateFor(k));
    return {
      key: k,
      label,
      main,
      char: {},
      answers: {},
      discarded: {},
      template: t,
      templateId: t.id,
      templateVersion: t.version
    };
  }
  function alarms(c, p) {
    return c.reasons.flatMap((r, i) => {
      const rr = reconcile(r, context(p, c));
      return (rr.template || templateFor(rr.key)).alarms.filter(a => matches(a.when, rr.answers, context(p, c))).map(a => ({
        ...a,
        reason: i,
        ref: i + ':' + a.id
      }));
    });
  }
  function ipss(a) {
    const nums = ipssNames.map((_, i) => a['ipss' + i]);
    if (a.ipss !== 'Sí' || nums.some(v => !filled(v) || +v < 0 || +v > 5)) return null;
    const total = nums.reduce((s, v) => s + +v, 0);
    return {
      total,
      range: total <= 7 ? 'leve' : total <= 19 ? 'moderado' : 'severo',
      quality: filled(a.ipssQoL) ? +a.ipssQoL : null
    };
  }
  // Tipo de alergia deducido de la sustancia (medicamento, alimento, látex, contraste); el resto queda como "otra"
  const allergyKind = name => {
    const n = String(name || '').toLowerCase();
    if (/l[aá]tex/.test(n)) return 'látex';
    if (/yodo|contraste/.test(n)) return 'contraste';
    if (/marisco|huevo|man[ií]|leche|pescado|nuez|soya|trigo/.test(n)) return 'alimento';
    if (/cilina|cefal|sulfa|aine|ibuprof|aspirin|diclof|metamiz|dipiron|naprox|ketoro|tramad|morfin|codein|antibi|mg|tableta|ampolla/.test(n) ||
      (typeof S !== 'undefined' && (S.products || []).some(p => p.name && p.name.toLowerCase() === n && /medic/i.test(p.cat || '')))) return 'medicamento';
    return 'otra';
  };
  const frequentAllergies = ['Penicilina', 'Amoxicilina', 'Cefalosporinas', 'Sulfas', 'AINEs / Ibuprofeno', 'Aspirina', 'Diclofenac', 'Metamizol (Dipirona)', 'Yodo / medio de contraste', 'Látex', 'Mariscos', 'Huevo', 'Maní'];
  function addAllergy(p, data, {
    role,
    at,
    by
  }) {
    if (!['medico', 'residente', 'enfermeria', 'admin'].includes(role) || !data.substance?.trim()) return false;
    migratePatient(p);
    const h = p.history,
      substance = data.substance.trim();
    const previous = h.allergies.items.find(i => key(i.substance) === key(substance));
    const item = {
      substance,
      type: data.type || allergyKind(data.substance),
      reaction: data.reaction || '',
      severity: ['leve', 'moderada', 'grave', 'desconocida'].includes(data.severity) ? data.severity : 'desconocida',
      verified: false,
      updatedAt: at,
      by
    };
    // Lo referido queda sin verificar; agregar no certifica la alergia.
    if (previous) Object.assign(previous, item);else h.allergies.items.push(item);
    h.allergies.status = 'conocidas';
    h.updatedAt = at;
    delete h.confirmedAt;
    syncLegacy(p);
    return true;
  }
  function allergyText(h) {
    const a = h?.allergies;
    if (a?.status === 'niega') return 'Niega alergias conocidas (declarado).';
    if (a?.status === 'conocidas') return 'Alergias conocidas: ' + (a.items || []).map(i => {
      const d = [i.reaction ? 'reacción: ' + i.reaction : '', i.severity && i.severity !== 'desconocida' ? 'gravedad ' + i.severity : '', i.verified ? 'verificada' : 'sin verificar'].filter(Boolean);
      return (i.substance || 'sustancia no documentada') + ' (' + d.join(', ') + ')';
    }).join('; ') + '.';
    return 'Alergias: desconocidas / no confirmadas.';
  }
  // Lista blanca, sin identificadores de paciente, cita, ingreso, inventario ni usuarios.
  function clean(c, p) {
    if (c.status === 'firmada' && c.patientSnapshot) p = {
      ...p,
      ...c.patientSnapshot
    };
    const h = c.status === 'firmada' && c.historySnapshot ? c.historySnapshot : p.history;
    const pick = (o, keys) => Object.fromEntries(keys.filter(k => filled(o?.[k])).map(k => [k, clone(o[k])]));
    const history = {
      conditions: (h?.conditions || []).map(x => pick(x, ['name', 'state', 'since', 'tx', 'note'])),
      surgeries: (h?.surgeries || []).map(x => pick(x, ['name', 'date', 'institution', 'complications', 'anesthesia', 'note'])),
      allergies: {
        status: h?.allergies?.status || 'desconocido',
        items: (h?.allergies?.status === 'conocidas' ? h.allergies.items : []).map(x => pick(x, ['substance', 'type', 'reaction', 'severity', 'verified', 'date']))
      },
      meds: (h?.meds || []).map(x => pick(x, ['drug', 'ingredient', 'presentation', 'dose', 'freq', 'route', 'start', 'end', 'active', 'note'])),
      family: (h?.family || []).map(x => pick(x, ['disease', 'relative', 'age', 'note'])),
      habits: pick(h?.habits, ['tabaco', 'alcohol', 'sustancias', 'actividad', 'alimentacion', 'ocupacion', 'exposiciones', 'sueno', 'social']),
      gyneco: p.sex === 'F' ? pick(h?.gyneco, ['menarquia', 'fum', 'regularidad', 'duracion', 'g', 'p', 'c', 'a', 'menopausia', 'anticoncepcion', 'embarazo', 'nota']) : {},
      pediatric: age(p.birth, c.date) !== null && age(p.birth, c.date) < 18 ? pick(h?.pediatric, ['embarazo', 'nacimiento', 'prematuridad', 'peso', 'desarrollo', 'vacunacion', 'alimentacion', 'crecimiento', 'enfermedades', 'nota']) : {}
    };
    const data = {
      version,
      patient: {
        initials: String(p.name || '').split(/\s+/).filter(Boolean).map(s => s[0].toUpperCase() + '.').join(''),
        age: age(p.birth, c.date),
        sex: p.sex || 'no documentado'
      },
      ...pick(c, ['specialty', 'type', 'modality', 'mode', 'date', 'time', 'timezone']),
      reasons: c.reasons.map(r => {
        const rr = reconcile(r, context(p, c));
        return {
          label: rr.label,
          main: rr.main,
          characterization: pick(rr.char, Object.values(charMap).concat(['durN', 'durU'])),
          answers: visibleQuestions(rr.template || templateFor(rr.key), rr.answers, context(p, c)).filter(q => filled(rr.answers[q.id]) && !charMap[q.id] && q.id !== 'duration').map(q => ({
            label: q.label,
            value: rr.answers[q.id]
          })),
          ipss: ipss(rr.answers)
        };
      }),
      history,
      ros: clone(c.ros),
      rosNotes: clone(c.rosNotes || {}),
      vitals: c.vitals.map(v => ({
        ...pick(v, ['at', ...vitals.map(v => v[0])]),
        bmi: bmi(v.weight, v.height)
      })),
      exam: clone(c.exam),
      dx: c.dx.map(d => pick(d, ['label', 'code', 'codeSource', 'priority', 'certainty'])),
      orders: c.orders.map(o => pick(o, ['label', 'category', 'indication', 'priority', 'status'])),
      rx: c.rx.map(r => ({
        ...pick(r, ['drug', 'presentation', 'dose', 'unit', 'route', 'freq', 'duration', 'qty', 'notes']),
        status: 'prescrito'
      })),
      plan: pick(c.plan, ['conducts', 'instructions', 'nextControl', 'alarmSigns', 'alarmFree', 'conductFree', 'instructionFree', 'notes', 'referral', 'controlInterval', 'controlTime']),
      steps: Object.fromEntries(Array.from({
        length: 12
      }, (_, i) => [i, stepState(c, p, i)]))
    };
    // Omisiones del asistente, sin incluir su posición ni sus botones.
    Object.assign(data.steps, c.guide?.omissions || {});
    // Oculta hallazgos de una región que dejó de estar alterada; Normal incluye únicamente ítems confirmados.
    for (const e of Object.values(data.exam)) {
      if (e.state !== 'alterado') {
        delete e.findings;
        delete e.note;
      }
      if (e.state !== 'normal') delete e.confirmed;
    }
    // También se depuran identificadores escritos en campos libres cuando coinciden con la ficha local.
    const ids = [p.name, p.ci, p.phone, p.address, p.code, typeof p.emergency === 'string' ? p.emergency : '', p.emergencyContact?.name, p.emergencyContact?.phone, p.representative?.name, p.representative?.ci, p.representative?.phone].filter(s => s && s.length >= 3);
    const redact = x => typeof x === 'string' ? ids.reduce((s, id) => s.replace(new RegExp(id.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&'), 'gi'), '[dato identificativo omitido]'), x) : Array.isArray(x) ? x.map(redact) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, redact(v)])) : x;
    const clinical = x => typeof x === 'string' ? clinicalText(x) : Array.isArray(x) ? x.map(clinical) :
      x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, clinical(v)])) : x;
    return redact(clinical(data));
  }
  const stable = x => Array.isArray(x) ? '[' + x.map(stable).join(',') + ']' : x && typeof x === 'object' ? '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + stable(x[k])).join(',') + '}' : JSON.stringify(x);
  function hash(c, p) {
    const data = clean(c, p);
    delete data.steps[11];
    const s = stable(data);
    let h = 2166136261,
      h2 = 5381;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 16777619);
      h2 = Math.imul(h2, 33) ^ s.charCodeAt(i);
    }
    return (h >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }
  const steps = ['Identificación', 'Motivo', 'Enfermedad actual', 'Antecedentes', 'Revisión por sistemas', 'Signos vitales', 'Examen físico', 'Diagnóstico', 'Exámenes', 'Tratamiento', 'Plan', 'Informe'];
  function stepState(c, p, i) {
    if (['no aplica', 'no evaluado'].includes(c.steps?.[i])) return c.steps[i];
    const checked = [!!c.pid && !!c.doc && !!c.specialty, c.reasons.length > 0 && c.reasons.filter(r => r.main).length === 1, c.reasons.length > 0 && c.reasons.every(r => Object.values(reconcile(r, context(p, c)).answers).some(filled)), !!c.historyConfirmedAt, Object.values(c.ros).some(s => Object.values(s).some(v => ['presente', 'ausente'].includes(v))), c.vitals.length > 0 && !c.vitals.some(v => validateVitals(v).length), Object.values(c.exam).some(e => e.state === 'normal' && e.confirmed?.length || e.state === 'alterado' && (e.note || Object.values(e.findings || {}).some(filled))), c.dx.length > 0 && c.dx.filter(d => d.priority === 'principal').length === 1, c.orders.length > 0, c.rx.length > 0, c.plan.conducts.length > 0 || c.plan.instructions.length > 0 || !!c.plan.notes, !!c.report.draft];
    if (checked[i]) return 'completado';
    if (i === 4 || i === 6) return 'no evaluado';
    return 'pendiente';
  }
  function clinicalText(value) {
    return value == null ? '' : String(value).replace(/Migrado;?\s*pendiente de confirmar\.?/gi, '').trim();
  }
  function diagnosisText(d, index = 0) {
    return clinicalText(d.label) + (d.code ? ' (' + clinicalText(d.code) + ')' : '') +
      ' · ' + (d.priority || (index === 0 ? 'principal' : 'secundario')) + ' · ' +
      (d.certainty || 'certeza no documentada');
  }
  function report(data) {
    // Texto clínico legible: nombre primero, luego datos con su etiqueta en español; sin claves internas.
    const LBL = {
      name: '',
      drug: '',
      disease: '',
      label: '',
      state: 'estado',
      since: 'desde',
      tx: 'tratamiento',
      note: 'nota',
      notes: 'indicaciones',
      date: 'fecha',
      institution: 'institución',
      complications: 'complicaciones',
      anesthesia: 'anestesia',
      presentation: 'presentación',
      dose: 'dosis',
      unit: '',
      route: 'vía',
      freq: 'frecuencia',
      duration: 'duración',
      qty: 'cantidad',
      start: 'inicio',
      end: 'fin',
      relative: 'familiar',
      age: 'edad al diagnóstico',
      conducts: 'Conducta',
      conductFree: 'Otra conducta',
      instructions: 'Indicaciones',
      instructionFree: 'Otras indicaciones',
      nextControl: 'Próximo control',
      controlInterval: 'Control en',
      controlTime: 'Hora del control',
      alarmSigns: 'Signos de alarma',
      alarmFree: 'Otros signos de alarma',
      referral: 'Referencia'
    };
    const SKIP = new Set(['id', 'updatedAt', 'confirmedAt', 'createdAt', 'source']);
    const display = v => {
      if (Array.isArray(v)) return v.map(display).filter(Boolean).join(', ');
      if (v === true) return 'sí';
      if (v === false) return 'no';
      if (!v || typeof v !== 'object') return clinicalText(v); 
      const e = Object.entries(v).filter(([k, x]) => !SKIP.has(k) && filled(x) && (typeof x !== 'string' || clinicalText(x)) && !(k === 'active' && x === true));
      const head = e.filter(([k]) => LBL[k] === '').map(([k, x]) => display(x)).join(' ');
      const rest = e.filter(([k]) => LBL[k] !== '').map(([k, x]) => k === 'active' ? 'suspendido' : (LBL[k] || k) + ': ' + display(x));
      return head && rest.length ? head + ' (' + rest.join('; ') + ')' : head || rest.join('; ');
    };
    const out = [];
    const section = (name, lines) => out.push(name + '\n' + (lines.filter(Boolean).join('\n') || 'No documentado.'));
    section('Identificación', [(data.patient.initials || 'Paciente') + ' · ' + (data.patient.age == null ? 'Edad no documentada' : data.patient.age + ' años') + ' · ' + (data.date || 'Fecha no documentada') + ' ' + (data.time || '') + ' (Caracas)', (types[data.type] || 'Tipo no documentado') + ' · ' + (data.specialty || 'Especialidad no documentada') + ' · ' + (data.modality || 'Modalidad no documentada')]);
    section('Motivo', data.reasons.map(r => (r.main ? 'Principal: ' : 'Secundario: ') + r.label));
    section(data.mode === 'quick' ? 'Evolución' : 'Enfermedad actual', data.reasons.map(r => r.label + ': ' + (r.answers.map(a => a.label + ': ' + display(a.value)).concat(r.ipss ? 'IPSS: ' + display(r.ipss) : [], filled(r.characterization) ? Object.entries(r.characterization).filter(([, v]) => filled(v)).map(([k, v]) => (charNames[k] || k) + ': ' + display(v)).join('; ') : []).join('; ') || 'No documentado.')));
    const h = data.history;
    section('Antecedentes', [allergyText(h), ...h.conditions.map(x => 'Patológico: ' + display(x)), ...h.surgeries.map(x => 'Cirugía: ' + display(x)), ...h.meds.map(x => 'Medicación habitual: ' + display(x)), ...h.family.map(x => 'Familiar: ' + display(x)), filled(h.habits) ? 'Hábitos: ' + display(h.habits) : '', filled(h.gyneco) ? 'Ginecoobstétricos: ' + display(h.gyneco) : '', filled(h.pediatric) ? 'Pediátricos: ' + display(h.pediatric) : '']);
    section('Revisión por sistemas', Object.entries(data.ros).map(([s, items]) => s + ': ' + Object.entries(items).map(([item, state]) => item + ': ' + state.replace(/_/g, ' ')).join('; ')).concat(Object.entries(data.rosNotes || {}).filter(([, v]) => filled(v)).map(([s, n]) => s + ' · Observaciones: ' + n)));
    section('Signos vitales', data.vitals.map(v => (v.at || 'Hora no documentada') + ' · ' + vitals.filter(([k]) => filled(v[k])).map(([k, label, unit]) => label + ' ' + v[k] + ' ' + unit).concat(v.bmi != null ? 'IMC ' + v.bmi : []).join('; ')));
    section(data.mode === 'quick' ? 'Hallazgos / examen dirigido' : 'Examen físico', Object.entries(data.exam).map(([r, e]) => r + ': ' + (e.state === 'normal' ? 'Normal en ítems confirmados: ' + ((e.confirmed || []).join(', ') || 'ítems no documentados') : e.state === 'no_examinado' ? 'No examinado' : e.state === 'alterado' ? 'Alterado · ' + (display(e.findings || {}) || (!e.note ? 'Hallazgos no documentados.' : '')) + (e.note ? ' · ' + e.note : '') : 'No documentado') + (e.consent ? ' · Consentimiento: ' + e.consent : '') + (e.chaperone ? ' · Acompañante: ' + e.chaperone : '')));
    section('Impresión diagnóstica', data.dx.map(diagnosisText));
    section('Exámenes', data.orders.map(o => o.label + ' · ' + (o.status || 'estado no documentado') + (o.indication ? ' · Indicación: ' + o.indication : '')));
    section('Tratamiento prescrito', data.rx.map(r => display(r)));
    section('Conducta y seguimiento', Object.entries(data.plan || {}).filter(([k, x]) => filled(x)).map(([k, x]) => (LBL[k] || k) + ': ' + display(x)));
    const omissions = Object.entries(data.steps || {}).filter(([, v]) => ['no aplica', 'no evaluado'].includes(v)).map(([i, v]) => (steps[i] || i) + ': ' + v);
    if (omissions.length) section('Evaluación documentada', omissions);
    return clinicalText(out.join('\n\n'));
  }
  function receiveReport(c, text, sourceHash, source, at) {
    if (c.status === 'firmada') return clone(c);
    const out = clone(c);
    const candidate = {
      text,
      sourceHash,
      source,
      generatedAt: at
    };
    if (out.report.edited && out.report.draft) {
      out.report.candidate = candidate;
    } else Object.assign(out.report, {
      draft: text,
      edited: false,
      sourceHash,
      source,
      generatedAt: at,
      candidate: null
    });
    delete out.report.approvedHash;
    out.status = 'pendiente_revision';
    return out;
  }
  function signProblems(c, p) {
    const errors = [];
    if (c.status === 'firmada') errors.push('La consulta ya está firmada.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date || '') || Number.isNaN(new Date(c.date + 'T12:00:00Z').getTime()) || new Date(c.date + 'T12:00:00Z').toISOString().slice(0, 10) !== c.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.time || '') || !types[c.type] || !modes[c.modality]) errors.push('Verifique tipo, modalidad, fecha y hora Caracas.');
    if (!c.doc || !c.specialty?.trim()) errors.push('Seleccione médico y especialidad.');
    if (!c.reasons.length || c.reasons.filter(r => r.main).length !== 1) errors.push('Indique un motivo principal.');
    if (!c.dx.length || c.dx.filter(d => d.priority === 'principal').length !== 1 || c.dx.some(d => !d.label || !d.certainty)) errors.push('Indique un diagnóstico principal, prioridad y certeza.');
    errors.push(...c.vitals.flatMap(validateVitals));
    if (p.history?.allergies?.status === 'conocidas' && !p.history.allergies.items.length) errors.push('Registre la sustancia de las alergias conocidas.');
    if (c.guide?.started && p.history?.allergies?.status === 'desconocido' && !c.guide.allergyReviewed) errors.push('Confirme el estado desconocido de alergias.');
    if (c.rx.some(r => !r.drug?.trim())) errors.push('Complete o quite los medicamentos sin nombre.');
    const normalEmpty = Object.entries(c.exam).filter(([, e]) => e.state === 'normal' && !e.confirmed?.length).map(([r]) => r);
    if (normalEmpty.length) errors.push('Indique qué verificó como normal en: ' + normalEmpty.join(', ') + '.');
    if (!c.report.draft?.trim() || c.report.candidate || c.report.sourceHash !== hash(c, p) || c.report.approvedHash !== hash(c, p)) errors.push('Revise y apruebe el borrador vigente antes de firmar.');
    return errors;
  }
  return {
    version,
    clone,
    filled,
    key,
    groups,
    reasons,
    types,
    modes,
    evolution,
    conducts,
    instructions,
    alarmSigns,
    conditions,
    ros,
    exam,
    vitals,
    diagnoses,
    templates,
    templateFor,
    matches,
    visibleQuestions,
    reconcile,
    bmi,
    validateVitals,
    caracas,
    age,
    context,
    migratePatient,
    migrateState,
    syncLegacy,
    applyLegacyClinical,
    newConsult,
    newReason,
    alarms,
    ipss,
    frequentAllergies,
    addAllergy,
    allergyText,
    clean,
    hash,
    steps,
    stepState,
    report,
    receiveReport,
    signProblems,
    clinicalText,
    diagnosisText
  };
})();
