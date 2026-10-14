// Valores de referencia estándar de laboratorio (adultos), en las unidades usadas en Venezuela y EE. UU.
// Fuentes: rangos de referencia más citados (Mayo Clinic Laboratories, MedlinePlus/NIH y los reactivos Roche usados
// por muchos laboratorios venezolanos). Son un punto de partida: cada laboratorio puede ajustarlos a su método en
// Exámenes › Catálogo y valores de referencia. Los resultados ya validados conservan el rango con que se emitieron.
//
// Formato de cada parámetro: [nombre, unidad, referencia]
//   · "a–b", "<x" o ">x"                     → el sistema marca alto / bajo
//   · "Hombres: a–b · Mujeres: c–d"          → se usa el del sexo del paciente
//   · "Negativo", "No reactivo", "Ausente"…  → se marca "anormal" si el resultado es positivo / reactivo / presente
//   · Texto ("Según fase del ciclo…")        → se muestra como guía; no se marca solo

const HS = (h, m) => `Hombres: ${h} · Mujeres: ${m}`;
const NEG = 'Negativo', NR = 'No reactivo';
// Tramos por edad: [etiqueta, rango] → "etiqueta: rango · etiqueta: rango"
const AGE = (...t) => t.map(([l, r]) => `${l}: ${r}`).join(' · ');
const PSA_EDAD = AGE(['Hombres <50 años', '<2,5'], ['Hombres 50–59 años', '<3,5'], ['Hombres 60–69 años', '<4,5'], ['Hombres ≥70 años', '<6,5']);
const LAB_STANDARD = {
  'Hematología completa': [
    ['Glóbulos rojos', 'x10⁶/µL', HS('4,5–5,9', '4,0–5,2')],
    ['Hemoglobina', 'g/dL', HS('13,5–17,5', '12,0–15,5')],
    ['Hematocrito', '%', HS('41–53', '36–46')],
    ['VCM', 'fL', '80–100'],
    ['HCM', 'pg', '27–33'],
    ['CHCM', 'g/dL', '32–36'],
    ['RDW', '%', '11,5–14,5'],
    ['Leucocitos', 'x10³/µL', '4,5–11,0'],
    ['Neutrófilos', '%', '40–70'],
    ['Linfocitos', '%', '20–40'],
    ['Monocitos', '%', '2–8'],
    ['Eosinófilos', '%', '1–4'],
    ['Basófilos', '%', '0–1'],
    ['Plaquetas', 'x10³/µL', '150–450'],
    ['VPM', 'fL', '7,5–11,5']],
  'VSG': [['VSG', 'mm/h', AGE(['Hombres <50 años', '0–15'], ['Hombres ≥50 años', '0–20'], ['Mujeres <50 años', '0–20'], ['Mujeres ≥50 años', '0–30'])]],
  'Grupo sanguíneo (tipiaje)': [['Grupo ABO', '', ''], ['Factor Rh', '', '']],
  'Frotis de sangre periférica': [['Serie roja', '', 'Sin alteraciones'], ['Serie blanca', '', 'Sin alteraciones'], ['Plaquetas', '', 'Sin alteraciones']],
  'Reticulocitos': [['Reticulocitos', '%', '0,5–2,5']],
  'Glicemia basal': [['Glicemia basal', 'mg/dL', '70–99']],
  'Glicemia posprandial': [['Glicemia posprandial (2 h)', 'mg/dL', '<140']],
  'Urea': [['Urea', 'mg/dL', '15–45']],
  'Creatinina': [['Creatinina', 'mg/dL', HS('0,7–1,3', '0,6–1,1')]],
  'Ácido úrico': [['Ácido úrico', 'mg/dL', HS('3,4–7,0', '2,4–6,0')]],
  'Colesterol total': [['Colesterol total', 'mg/dL', '<200']],
  'Triglicéridos': [['Triglicéridos', 'mg/dL', '<150']],
  'AST/TGO': [['AST (TGO)', 'U/L', '10–40']],
  'ALT/TGP': [['ALT (TGP)', 'U/L', '7–56']],
  'HDL-colesterol': [['HDL-colesterol', 'mg/dL', HS('>40', '>50')]],
  'Perfil lipídico': [
    ['Colesterol total', 'mg/dL', '<200'],
    ['Triglicéridos', 'mg/dL', '<150'],
    ['HDL-colesterol', 'mg/dL', HS('>40', '>50')],
    ['LDL-colesterol', 'mg/dL', '<100'],
    ['VLDL-colesterol', 'mg/dL', '5–40']],
  'Bilirrubina total': [['Bilirrubina total', 'mg/dL', '0,1–1,2']],
  'Bilirrubina directa': [['Bilirrubina directa', 'mg/dL', '0–0,3']],
  'Bilirrubina total y fraccionada': [['Bilirrubina total', 'mg/dL', '0,1–1,2'], ['Bilirrubina directa', 'mg/dL', '0–0,3'], ['Bilirrubina indirecta', 'mg/dL', '0,1–0,9']],
  'Proteínas totales': [['Proteínas totales', 'g/dL', '6,0–8,3']],
  'Albúmina': [['Albúmina', 'g/dL', '3,5–5,0']],
  'Proteínas totales y fraccionadas': [['Proteínas totales', 'g/dL', '6,0–8,3'], ['Albúmina', 'g/dL', '3,5–5,0'], ['Globulinas', 'g/dL', '2,0–3,5'], ['Relación albúmina/globulina', '', '1,1–2,5']],
  'Deshidrogenasa láctica (LDH)': [['LDH', 'U/L', '140–280']],
  'Fosfatasa alcalina (ALP)': [['Fosfatasa alcalina', 'U/L', '44–147']],
  'Calcio sérico/orina': [['Calcio sérico', 'mg/dL', '8,5–10,5'], ['Calcio en orina de 24 horas', 'mg/24 h', '100–300']],
  'Electrolitos séricos (sodio, potasio y cloro)': [['Sodio', 'mmol/L', '135–145'], ['Potasio', 'mmol/L', '3,5–5,1'], ['Cloro', 'mmol/L', '98–107']],
  'Fósforo sérico/orina': [['Fósforo sérico', 'mg/dL', '2,5–4,5'], ['Fósforo en orina de 24 horas', 'g/24 h', '0,4–1,3']],
  'Magnesio': [['Magnesio', 'mg/dL', '1,7–2,2']],
  'Amilasa sérica': [['Amilasa', 'U/L', '30–110']],
  'Lipasa sérica': [['Lipasa', 'U/L', '0–160']],
  'Gammaglutamil transpeptidasa (GGT)': [['GGT', 'U/L', HS('8–61', '5–36')]],
  'PCR cuantitativa (proteína C reactiva)': [['Proteína C reactiva', 'mg/L', '<5']],
  'Procalcitonina': [['Procalcitonina', 'ng/mL', '<0,5']],
  'CK total': [['CK total', 'U/L', HS('39–308', '26–192')]],
  'CK-MB': [['CK-MB', 'U/L', '<25']],
  'Troponina I cualitativa': [['Troponina I', '', NEG]],
  'ASTO cuantitativo (antiestreptolisina O)': [['Antiestreptolisina O', 'UI/mL', '<200']],
  'RA test (factor reumatoideo)': [['Factor reumatoideo', 'UI/mL', '<14']],
  'HCG cualitativa (prueba de embarazo en sangre/orina)': [['HCG cualitativa', '', NEG]],
  'HCG cuantitativa (prueba de embarazo)': [['β-hCG (mujer no embarazada)', 'mUI/mL', '<5']],
  'HIV prueba rápida': [['HIV 1 y 2 (prueba rápida)', '', NR]],
  'HIV por ELISA': [['HIV 1 y 2 (ELISA)', '', NR]],
  'Dengue (IgG/IgM, antígeno NS1)': [['Antígeno NS1', '', NEG], ['Dengue IgM', '', NEG], ['Dengue IgG', '', '']],
  'Hepatitis A (IgM)': [['Hepatitis A IgM', '', NR]],
  'Hepatitis A (IgG)': [['Hepatitis A IgG', '', 'Reactivo = infección pasada o vacuna']],
  'Hepatitis B (core total)': [['Anti-HBc total', '', NR]],
  'Hepatitis B (antígeno de superficie)': [['HBsAg', '', NR]],
  'Hepatitis C': [['Anti-VHC', '', NR]],
  'Mycoplasma pneumoniae (IgG/IgM)': [['Mycoplasma IgM', '', NEG], ['Mycoplasma IgG', '', '']],
  'Toxoplasma (IgM)': [['Toxoplasma IgM', '', NEG]],
  'Toxoplasma (IgG)': [['Toxoplasma IgG', 'UI/mL', 'Reactivo = infección pasada']],
  'VDRL cualitativo': [['VDRL', '', NR]],
  'VDRL cuantitativo': [['VDRL (título)', 'dils', NR]],
  'PT (coagulación)': [['Tiempo de protrombina (PT)', 's', '11,0–13,5'], ['INR', '', '0,8–1,2']],
  'PTT (coagulación)': [['Tiempo parcial de tromboplastina (PTT)', 's', '25–35']],
  'Dímero D': [['Dímero D', 'ng/mL FEU', '<500']],
  'Orina': [
    ['Color', '', 'Amarillo'], ['Aspecto', '', 'Límpido'], ['Densidad', '', '1,005–1,030'], ['pH', '', '5,0–8,0'],
    ['Proteínas', '', NEG], ['Glucosa', '', NEG], ['Cetonas', '', NEG], ['Bilirrubina', '', NEG], ['Urobilinógeno', 'mg/dL', '0,2–1,0'],
    ['Sangre (hemoglobina)', '', NEG], ['Nitritos', '', NEG], ['Esterasa leucocitaria', '', NEG],
    ['Leucocitos', '/campo', '0–5'], ['Hematíes', '/campo', '0–2'], ['Células epiteliales', '', 'Escasas'], ['Bacterias', '', 'Escasas'],
    ['Cilindros', '', 'Ausentes'], ['Cristales', '', 'Ausentes']],
  'Urocultivo': [['Resultado', '', 'Sin crecimiento'], ['Germen aislado', '', ''], ['Recuento de colonias', 'UFC/mL', ''], ['Antibiograma', '', '']],
  'Heces': [
    ['Color', '', ''], ['Consistencia', '', ''], ['Moco', '', 'Ausente'], ['Sangre', '', 'Ausente'],
    ['Leucocitos', '/campo', '0–2'], ['Restos alimenticios', '', ''], ['Parásitos', '', 'No se observan']],
  'Azúcares reductores en heces': [['Azúcares reductores', '%', '<0,25']],
  'Leucograma fecal': [['Leucocitos fecales', '/campo', '0–5'], ['Polimorfonucleares', '%', ''], ['Mononucleares', '%', '']],
  'Sangre oculta en heces': [['Sangre oculta', '', NEG]],
  'Depuración de creatinina 24 horas': [
    ['Depuración de creatinina', 'mL/min', HS('97–137', '88–128')], ['Volumen urinario', 'mL/24 h', '800–2000'],
    ['Creatinina en orina', 'mg/24 h', HS('1000–2000', '800–1800')], ['Creatinina sérica', 'mg/dL', HS('0,7–1,3', '0,6–1,1')]],
  'Proteinuria en orina aislada': [['Proteínas en orina', 'mg/dL', '<15'], ['Relación proteína/creatinina', 'mg/mg', '<0,2']],
  'Proteinuria en orina 24 horas': [['Proteínas en orina de 24 horas', 'mg/24 h', '<150'], ['Volumen urinario', 'mL/24 h', '800–2000']],
  'Relación calcio/creatinina en orina parcial': [['Relación calcio/creatinina', 'mg/mg', '<0,2']],
  'Relación ácido úrico/creatinina en orina parcial': [['Relación ácido úrico/creatinina', 'mg/mg', '']],
  'Relación fósforo/creatinina en orina parcial': [['Relación fósforo/creatinina', 'mg/mg', '']],
  'Citrato en orina de 24 horas': [['Citrato en orina', 'mg/24 h', '>320']],
  'Oxalato en orina de 24 horas': [['Oxalato en orina', 'mg/24 h', '<45']],
  'Cocaína en orina': [['Cocaína', '', NEG]],
  'Marihuana en orina': [['Marihuana (THC)', '', NEG]],
  'Monotest': [['Anticuerpos heterófilos', '', NEG]],
  'CEA (antígeno carcinoembrionario)': [['CEA', 'ng/mL', '<5,0']],
  'Chagas': [['Anticuerpos contra Trypanosoma cruzi', '', NR]],
  'CA 125': [['CA 125', 'U/mL', '<35']],
  'CA 15-3': [['CA 15-3', 'U/mL', '<30']],
  'CA 19-9': [['CA 19-9', 'U/mL', '<37']],
  'Alfafetoproteína': [['Alfafetoproteína', 'ng/mL', '<10']],
  'Anticuerpo antitiroideo (anti-TPO)': [['Anti-TPO', 'UI/mL', '<35']],
  'Anticuerpo antitiroideo (anti-TG)': [['Anti-tiroglobulina', 'UI/mL', '<115']],
  'Tiroglobulina': [['Tiroglobulina', 'ng/mL', '1,4–78']],
  'Hemoglobina glicosilada': [['Hemoglobina glicosilada (HbA1c)', '%', '<5,7']],
  'Helicobacter pylori (antígeno en heces)': [['Antígeno de H. pylori', '', NEG]],
  'Helicobacter pylori en suero (IgG)': [['H. pylori IgG', '', NEG]],
  'Helicobacter pylori en suero (IgM)': [['H. pylori IgM', '', NEG]],
  'FTA-ABS': [['FTA-ABS', '', NR]],
  'Fibrinógeno': [['Fibrinógeno', 'mg/dL', '200–400']],
  'Anticuerpos COVID-19 (IgG/IgM)': [['COVID-19 IgM', '', NEG], ['COVID-19 IgG', '', '']],
  'IgE sérica': [['IgE total', 'UI/mL', '<100']],
  'Citomegalovirus (IgG)': [['Citomegalovirus IgG', '', 'Reactivo = infección pasada']],
  'Citomegalovirus (IgM)': [['Citomegalovirus IgM', '', NEG]],
  'Electrolitos en orina (sodio, potasio y cloro)': [['Sodio en orina', 'mmol/24 h', '40–220'], ['Potasio en orina', 'mmol/24 h', '25–125'], ['Cloro en orina', 'mmol/24 h', '110–250']],
  'Epstein-Barr (IgG)': [['Epstein-Barr IgG', '', 'Reactivo = infección pasada']],
  'Epstein-Barr (IgM)': [['Epstein-Barr IgM', '', NEG]],
  'Pro-BNP': [['NT-proBNP', 'pg/mL', AGE(['<75 años', '<125'], ['≥75 años', '<450'])]],
  'Rubéola (IgG)': [['Rubéola IgG', 'UI/mL', '≥10 = inmune']],
  'Rubéola (IgM)': [['Rubéola IgM', '', NEG]],
  'Herpes simplex I (IgG)': [['Herpes simplex I IgG', '', 'Reactivo = infección pasada']],
  'Herpes simplex I (IgM)': [['Herpes simplex I IgM', '', NEG]],
  'Herpes simplex II (IgG)': [['Herpes simplex II IgG', '', 'Reactivo = infección pasada']],
  'Herpes simplex II (IgM)': [['Herpes simplex II IgM', '', NEG]],
  'TSH': [['TSH', 'µUI/mL', '0,4–4,5']],
  'T4 libre': [['T4 libre', 'ng/dL', '0,9–1,7']],
  'T3 libre': [['T3 libre', 'pg/mL', '2,3–4,2']],
  'PSA total': [['PSA total', 'ng/mL', PSA_EDAD]],
  'PSA libre': [['PSA libre', 'ng/mL', ''], ['Relación PSA libre/total', '%', '>25']],
  'Antígeno prostático': [['PSA total (antígeno prostático específico)', 'ng/mL', PSA_EDAD]],
  'Saturación de transferrina': [['Saturación de transferrina', '%', '20–50']],
  'Transferrina': [['Transferrina', 'mg/dL', '200–360']],
  'Ferritina': [['Ferritina', 'ng/mL', HS('24–336', '11–307')]],
  'Captación de hierro': [['Hierro sérico', 'µg/dL', '60–170'], ['Capacidad total de fijación de hierro (TIBC)', 'µg/dL', '250–450']],
  'Ácido fólico o folato': [['Ácido fólico', 'ng/mL', '3,0–17,0']],
  'Ácido láctico': [['Ácido láctico', 'mmol/L', '0,5–2,2']],
  'Ácido láctico posprandial': [['Ácido láctico posprandial', 'mmol/L', '']],
  'Insulina (basal, 30 minutos, 1 hora o 2 horas)': [['Insulina basal', 'µUI/mL', '2,6–24,9'], ['Insulina 30 minutos', 'µUI/mL', ''], ['Insulina 1 hora', 'µUI/mL', ''], ['Insulina 2 horas', 'µUI/mL', '']],
  'Litio': [['Litio (rango terapéutico)', 'mmol/L', '0,6–1,2']],
  'Péptido C': [['Péptido C', 'ng/mL', '1,1–4,4']],
  'Somatomedina C': [['IGF-1 (somatomedina C)', 'ng/mL', 'Según edad']],
  'Homocisteína': [['Homocisteína', 'µmol/L', '5–15']],
  'Hormona antimülleriana': [['Hormona antimülleriana', 'ng/mL', AGE(['Mujeres 20–24 años', '1,22–11,7'], ['Mujeres 25–29 años', '0,89–9,85'], ['Mujeres 30–34 años', '0,58–8,13'], ['Mujeres 35–39 años', '0,15–7,49'], ['Mujeres 40–44 años', '0,03–5,47'], ['Mujeres 45–50 años', '0,01–2,71'], ['Hombres', '0,77–14,5'])]],
  'Estrógeno': [['Estrógenos totales', 'pg/mL', 'Según sexo y fase del ciclo']],
  'Anticuerpos antinucleares (ANA)': [['ANA', '', 'Negativo (<1:80)']],
  'Anti-DNA': [['Anti-DNA de doble cadena', '', NEG]],
  'Anticuerpos anti-CCP': [['Anti-CCP', 'U/mL', '<20']],
  'Paratohormona (PTH)': [['PTH intacta', 'pg/mL', '15–65']],
  'Hormona de crecimiento (hGH)': [['Hormona de crecimiento', 'ng/mL', HS('<3', '<8')]],
  'SHBG (globulina fijadora de hormona sexual)': [['SHBG', 'nmol/L', HS('10–57', '18–144')]],
  'Vitamina D': [['25-hidroxivitamina D', 'ng/mL', '30–100']],
  'Vitamina D3': [['25-hidroxivitamina D3', 'ng/mL', '30–100']],
  'Amonio (muestra plasma citratado)': [['Amonio', 'µg/dL', '15–45']],
  'Complemento C3': [['C3', 'mg/dL', '90–180']],
  'Complemento C4': [['C4', 'mg/dL', '10–40']],
  'Complemento CH50': [['CH50', 'U/mL', '30–75']],
  'Coombs directo': [['Coombs directo', '', NEG]],
  'Coombs indirecto': [['Coombs indirecto', '', NEG]],
  'Androstenediona': [['Androstenediona', 'ng/dL', HS('40–150', '30–200')]],
  'Prolactina': [['Prolactina', 'ng/mL', HS('4,0–15,2', '4,8–23,3')]],
  'Estradiol': [['Estradiol', 'pg/mL', HS('11–44', 'según fase (folicular 12,5–166; ovulatoria 85,8–498; lútea 43,8–211; posmenopausia <54,7)')]],
  'Progesterona': [['Progesterona', 'ng/mL', HS('0,2–1,4', 'según fase (folicular 0,2–1,5; lútea 1,7–27; posmenopausia <0,8)')]],
  'FSH': [['FSH', 'mUI/mL', HS('1,5–12,4', 'según fase (folicular 3,5–12,5; ovulatoria 4,7–21,5; lútea 1,7–7,7; posmenopausia 25,8–134,8)')]],
  'LH': [['LH', 'mUI/mL', HS('1,7–8,6', 'según fase (folicular 2,4–12,6; ovulatoria 14–95,6; lútea 1,0–11,4; posmenopausia 7,7–58,5)')]],
  '17-OH progesterona': [['17-OH progesterona', 'ng/mL', HS('0,5–2,1', 'según fase (folicular 0,1–0,8; lútea 0,6–2,3)')]],
  'DHEA-S': [['DHEA-S', 'µg/dL', AGE(
    ['Hombres 15–19 años', '70,2–492'], ['Hombres 20–24 años', '211–492'], ['Hombres 25–34 años', '160–449'], ['Hombres 35–44 años', '88,9–427'],
    ['Hombres 45–54 años', '44,3–331'], ['Hombres 55–64 años', '51,7–295'], ['Hombres 65–74 años', '33,6–249'], ['Hombres ≥75 años', '16,2–123'],
    ['Mujeres 15–19 años', '65,1–368'], ['Mujeres 20–24 años', '148–407'], ['Mujeres 25–34 años', '98,8–340'], ['Mujeres 35–44 años', '60,9–337'],
    ['Mujeres 45–54 años', '35,4–256'], ['Mujeres 55–64 años', '18,9–205'], ['Mujeres 65–74 años', '9,4–246'], ['Mujeres ≥75 años', '12,0–154'])]],
  'Testosterona total': [['Testosterona total', 'ng/dL', AGE(
    ['1–9 años', '0–20'],
    ['Hombres 10–11 años', '0–130'], ['Hombres 12–13 años', '0–800'], ['Hombres 14 años', '0–1200'], ['Hombres 15–16 años', '100–1200'], ['Hombres 17–18 años', '300–1200'], ['Hombres ≥19 años', '264–916'],
    ['Mujeres 10–11 años', '0–44'], ['Mujeres 12–16 años', '0–75'], ['Mujeres 17–18 años', '20–75'], ['Mujeres ≥19 años', '8–60'])]],
  'Testosterona libre': [['Testosterona libre', 'pg/mL', AGE(
    ['Hombres 18–29 años', '9,3–26,5'], ['Hombres 30–39 años', '8,7–25,1'], ['Hombres 40–49 años', '6,8–21,5'], ['Hombres 50–59 años', '7,2–24,0'], ['Hombres ≥60 años', '6,6–18,1'],
    ['Mujeres ≥18 años', '0,0–4,2'])]],
  'Cortisol AM o PM': [['Cortisol (mañana)', 'µg/dL', '6,2–19,4'], ['Cortisol (tarde)', 'µg/dL', '2,3–11,9']],
  'Adenovirus en heces': [['Adenovirus', '', NEG]],
  'Rotavirus en heces': [['Rotavirus', '', NEG]],
  'Calprotectina en heces': [['Calprotectina fecal', 'µg/g', '<50']],
  // Paneles del arranque del sistema (los usan órdenes antiguas)
  'Química sanguínea': [['Glicemia basal', 'mg/dL', '70–99'], ['Urea', 'mg/dL', '15–45'], ['Creatinina', 'mg/dL', HS('0,7–1,3', '0,6–1,1')]],
  'Perfil de coagulación': [['Tiempo de protrombina (PT)', 's', '11,0–13,5'], ['INR', '', '0,8–1,2'], ['Tiempo parcial de tromboplastina (PTT)', 's', '25–35']],
  'Grupo sanguíneo y Rh': [['Grupo ABO', '', ''], ['Factor Rh', '', '']],
  'Prueba de embarazo (β-hCG)': [['β-hCG (mujer no embarazada)', 'mUI/mL', '<5']]
};
LAB_STANDARD['Uroanálisis'] = LAB_STANDARD['Orina'];

// Perfiles: se arman con los exámenes que incluyen (cada uno con sus propios parámetros y referencias)
const HEM = 'Hematología completa', ORINA = 'Orina', HECES = 'Heces', VDRL = 'VDRL cualitativo', HIV = 'HIV prueba rápida';
const QUIM = ['Glicemia basal', 'Urea', 'Creatinina'], HEP = ['AST/TGO', 'ALT/TGP', 'Proteínas totales y fraccionadas', 'Bilirrubina total y fraccionada'];
const LAB_PROFILE_PARTS = {
  'Perfil 20': [HEM, ...QUIM, 'Ácido úrico', 'Colesterol total', 'Triglicéridos', ...HEP, VDRL, ORINA, HECES],
  'Perfil 21': [HEM, ...QUIM, 'Ácido úrico', 'Perfil lipídico', ...HEP, ORINA, HECES],
  'Perfil hepático': [HEM, ...HEP, 'Gammaglutamil transpeptidasa (GGT)', 'Fosfatasa alcalina (ALP)', 'Deshidrogenasa láctica (LDH)'],
  'Perfil preoperatorio': [HEM, ...QUIM, 'PT (coagulación)', 'PTT (coagulación)', HIV, VDRL, ORINA],
  'Perfil prenatal básico 1': [HEM, 'Grupo sanguíneo (tipiaje)', ...QUIM, VDRL, HIV, ORINA, HECES],
  'Perfil prenatal 2': [HEM, 'Glicemia basal', 'PT (coagulación)', 'PTT (coagulación)', VDRL, HIV, ORINA],
  'Perfil hormonal femenino': ['Progesterona', 'Prolactina', 'LH', 'FSH', 'Estradiol'],
  'Perfil hormonal masculino': ['Testosterona total', 'Testosterona libre', 'LH', 'FSH', 'Prolactina'],
  'Perfil diarreico': [HECES, 'Leucograma fecal', 'Adenovirus en heces', 'Rotavirus en heces'],
  'Perfil TORCH I (IgG/IgM)': ['Toxoplasma (IgG)', 'Toxoplasma (IgM)', 'Rubéola (IgG)', 'Rubéola (IgM)', 'Citomegalovirus (IgG)', 'Citomegalovirus (IgM)'],
  'Perfil TORCH II (IgG/IgM)': ['Toxoplasma (IgG)', 'Toxoplasma (IgM)', 'Rubéola (IgG)', 'Rubéola (IgM)', 'Citomegalovirus (IgG)', 'Citomegalovirus (IgM)',
    'Herpes simplex I (IgG)', 'Herpes simplex I (IgM)', 'Herpes simplex II (IgG)', 'Herpes simplex II (IgM)'],
  'Perfil tiroideo libre': ['TSH', 'T4 libre', 'T3 libre']
};
// Exámenes que los perfiles necesitan y que no estaban en la lista de la clínica
const LAB_SUPPORT = ['Proteínas totales y fraccionadas', 'Bilirrubina total y fraccionada', 'LH'];

// Primera versión (sin tramos por edad): si el laboratorio no la cambió, se reemplaza por la tabla por edad
const LAB_V1_REFS = { 'VSG': HS('0–15', '0–20'), 'NT-proBNP': '<125', 'PSA total': '<4,0', 'PSA total (antígeno prostático específico)': '<4,0',
  'Hormona antimülleriana': 'Según edad', 'DHEA-S': 'Según edad y sexo', 'Testosterona total': HS('264–916', '8–60'), 'Testosterona libre': HS('8,7–25,1', '0,0–4,2') };
function applyLabAgeBands(state) {
  Object.entries(state.labCatalog || {}).forEach(([panel, rows]) => rows.forEach(r => {
    const std = (LAB_STANDARD[panel] || []).find(x => x[0] === r[0]);
    if (std && LAB_V1_REFS[r[0]] !== undefined && r[2] === LAB_V1_REFS[r[0]]) r[2] = std[2];
  }));
  state.labRefs2026b = true; return state;
}
// Un panel "sin tocar" es el que vino vacío de la lista de la clínica o igual al de arranque: ese se reemplaza.
// Lo que el laboratorio ya editó a mano se respeta.
const labUntouched = (rows, name) => !rows || !rows.length || rows.every(r => !r[1] && !r[2]) ||
  (typeof LAB_PANELS !== 'undefined' && LAB_PANELS[name] && JSON.stringify(rows) === JSON.stringify(LAB_PANELS[name]));
function applyLabStandard(state) {
  const cat = state.labCatalog = state.labCatalog || {};
  const meta = state.labCatalogMeta = state.labCatalogMeta || {};
  const keyOf = name => Object.keys(cat).find(n => labNameKey(n) === labNameKey(name)) || name;
  Object.entries(LAB_STANDARD).forEach(([name, rows]) => {
    const k = keyOf(name);
    if (!Object.hasOwn(cat, k) && !LAB_SUPPORT.includes(name)) return;   // solo los exámenes que la clínica tiene
    if (labUntouched(cat[k], k)) cat[k] = JSON.parse(JSON.stringify(rows));
  });
  Object.entries(LAB_PROFILE_PARTS).forEach(([name, parts]) => {
    const k = keyOf(name);
    if (Object.hasOwn(cat, k) && !labUntouched(cat[k], k) && !(meta[k]?.parts)) return;   // perfil editado a mano: se deja
    cat[k] = []; meta[k] = { ...meta[k], kind: 'perfil', parts: parts.map(keyOf) };
  });
  state.labRefs2026 = true; state.labRefs2026b = true;
  return state;
}

// ---------- Rango que corresponde al paciente ----------
// La referencia puede venir en tramos separados por " · ", cada uno con su etiqueta, como en los informes de laboratorio:
//   "Hombres: 13,5–17,5 · Mujeres: 12,0–15,5"                       (por sexo)
//   "<75 años: <125 · ≥75 años: <450"                                (por edad)
//   "Hombres 10–11 años: 0–130 · Hombres ≥19 años: 264–916 · Mujeres ≥19 años: 8–60"   (por sexo y edad)
// También "meses" para lactantes ("0–6 meses: …"). Se elige el tramo del paciente; si no hay datos para elegir, se
// muestra el texto completo y el sistema no marca alto/bajo por su cuenta.
const LAB_NUM = t => parseFloat(String(t).replace(',', '.'));
function refBand(label) {
  const l = labNameKey(label), out = { sex: /^hombres?\b/.test(l) ? 'M' : /^mujer(es)?\b/.test(l) ? 'F' : null, min: null, max: null };
  const unit = /mes/.test(l) ? 1 / 12 : 1;
  let m;
  if ((m = l.match(/(\d+(?:,\d+)?)\s*[–-]\s*(\d+(?:,\d+)?)\s*(anos|ano|meses|mes)/))) { out.min = LAB_NUM(m[1]) * unit; out.max = (LAB_NUM(m[2]) + 1) * unit; }   // "20–29 años" incluye hasta el día antes de cumplir 30
  else if ((m = l.match(/(?:≥|>=|mayores de|desde)\s*(\d+(?:,\d+)?)\s*(anos|ano|meses|mes)/))) out.min = LAB_NUM(m[1]) * unit;
  else if ((m = l.match(/(?:<|menores de)\s*(\d+(?:,\d+)?)\s*(anos|ano|meses|mes)/))) out.max = LAB_NUM(m[1]) * unit;
  else if ((m = l.match(/(\d+(?:,\d+)?)\s*(anos|ano)\b/))) { out.min = LAB_NUM(m[1]); out.max = LAB_NUM(m[1]) + 1; }
  out.age = out.min !== null || out.max !== null;
  return out;
}
// Edad en años (con decimales) en la fecha del examen; null si no está registrada
function labAge(p, date) {
  if (!p) return null;
  const on = new Date((date || (typeof dAt === 'function' ? dAt(0) : new Date().toISOString().slice(0, 10))) + 'T12:00');
  if (p.birth) return (on - new Date(p.birth + 'T12:00')) / (365.25 * 864e5);
  if (p.ageAt?.age != null) return +p.ageAt.age + Math.max(0, on.getFullYear() - (parseInt(p.ageAt.year, 10) || on.getFullYear()));
  return null;
}
// Devuelve { ref, band }: el rango que se usa y la etiqueta del tramo elegido (para mostrarla junto al resultado)
function refPick(ref, sex, ageY) {
  ref = String(ref || '');
  const segs = ref.split(' · ').map(t => { const k = t.indexOf(':'); return k > 0 ? { label: t.slice(0, k).trim(), value: t.slice(k + 1).trim(), band: refBand(t.slice(0, k)) } : null; });
  if (!segs.length || segs.some(x => !x) || !segs.some(x => x.band.sex || x.band.age)) return { ref, band: '' };
  const fits = segs.filter(x => (!x.band.sex || x.band.sex === sex) && (!x.band.age || (ageY != null && (x.band.min === null || ageY >= x.band.min) && (x.band.max === null || ageY < x.band.max))));
  // Si el tramo exige un dato que falta (sexo o edad), no se adivina
  const ok = fits.filter(x => (!x.band.sex || sex) && (!x.band.age || ageY != null));
  if (!ok.length) return { ref, band: '' };
  ok.sort((a, b) => (+!!b.band.age + +!!b.band.sex) - (+!!a.band.age + +!!a.band.sex));   // el tramo más específico primero
  return { ref: ok[0].value, band: ok[0].label };
}
const refFor = (ref, sex, ageY) => refPick(ref, sex, ageY).ref;

// ¿La referencia es numérica? (para el teclado del teléfono)
const refNumeric = ref => /^\s*[<>]?\s*\d/.test(String(ref || '')) || /\d\s*–\s*\d/.test(String(ref || '')) && !/[a-zA-Z]{3,}/.test(String(ref || ''));
