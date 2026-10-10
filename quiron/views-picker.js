// Buscador de pacientes para usar dentro de cualquier ventana: escribir nombre o cédula, tocar el paciente,
// o registrar uno nuevo ahí mismo. Se usa en Hospitalización y Laboratorio.
// Uso: `<div id="pp-KEY">${patientPicker('KEY')}</div>`; al guardar: `const r = pickerCommit('KEY')` → { ok, pid } o { ok:false, msg }.

const ppState = (key, init = {}) => { UI.pp = UI.pp || {}; return (UI.pp[key] = UI.pp[key] || { pid: null, newPat: false, q: '', np: {}, exclude: [], ...init }); };
const ppReset = (key, init = {}) => { UI.pp = UI.pp || {}; UI.pp[key] = { pid: null, newPat: false, q: '', np: {}, exclude: [], ...init }; return UI.pp[key]; };
function ppResults(key) {
  const st = ppState(key); const q = st.q.trim().toLowerCase(); const qd = normDigits(q);
  const list = S.patients.filter(p => !st.exclude.includes(p.id) && (!q || p.name.toLowerCase().includes(q) || (qd.length > 2 && normDigits(p.ci).includes(qd)))).slice(0, 6);
  return list.map(p => `<button class="row pprow" data-act="ppPick" data-k="${key}" data-id="${p.id}"><span class="avatar">${initials(p.name)}</span><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.ci)} · ${ageTxt(p)}</div></div></button>`).join('')
    || `<div class="small muted" style="padding:10px 4px">No hay pacientes con "${esc(st.q)}". <button class="btn ghost sm" data-act="ppNew" data-k="${key}">Registrarlo como nuevo</button></div>`;
}
function patientPicker(key) {
  const st = ppState(key);
  if (st.newPat) { const np = st.np;
    return `<div class="between" style="margin-bottom:8px"><b class="small">Paciente nuevo</b><button class="btn ghost sm" data-act="ppBack" data-k="${key}">Buscar uno registrado</button></div>
    <div class="form"><div class="field full"><label for="pp-${key}-n">Nombre completo</label><input class="input" id="pp-${key}-n" value="${esc(np.name || '')}" data-in="ppDup" data-k="${key}"></div>
      <div class="field"><label for="pp-${key}-ci">Cédula</label><input class="input" id="pp-${key}-ci" placeholder="V-12.345.678" value="${esc(np.ci || '')}" data-in="ppDup" data-k="${key}"></div>
      <div class="field"><label for="pp-${key}-t">Teléfono</label><input class="input" id="pp-${key}-t" value="${esc(np.phone || '')}"></div>
      <div class="field"><label for="pp-${key}-b">Fecha de nacimiento</label><input class="input" type="date" id="pp-${key}-b" value="${esc(np.birth || '1990-01-01')}"></div>
      <div class="field"><label for="pp-${key}-s">Sexo</label><select class="input" id="pp-${key}-s"><option value="F" ${np.sex !== 'M' ? 'selected' : ''}>Femenino</option><option value="M" ${np.sex === 'M' ? 'selected' : ''}>Masculino</option></select></div>
      <div class="full small muted" id="pp-${key}-dup">Se crea su perfil y todo lo que registres queda guardado en él.</div></div>`; }
  const p = st.pid && pat(st.pid);
  if (p) return `<div class="ppsel"><span class="avatar">${initials(p.name)}</span><div class="grow"><div class="t">${esc(p.name)}</div><div class="small muted">${esc(p.ci)} · ${ageTxt(p)}${p.allergies.length ? ` · <span class="allergy-txt">⚠ Alergias: ${esc(p.allergies.join(', '))}</span>` : ''}</div></div><button class="btn sm" data-act="ppClear" data-k="${key}">Cambiar</button></div>`;
  return `<div class="search">${icon('buscar')}<input class="input" id="pp-${key}-q" placeholder="Escriba el nombre o la cédula del paciente" value="${esc(st.q)}" data-in="ppSearch" data-k="${key}" autocomplete="off" aria-label="Buscar paciente"></div>
    <div class="list" id="pp-${key}-res" style="margin-top:8px;box-shadow:none;border:1px solid var(--line)">${ppResults(key)}</div>
    <button class="btn sm" style="margin-top:8px" data-act="ppNew" data-k="${key}">+ Paciente nuevo</button>`;
}
const ppRedraw = key => { const box = document.getElementById('pp-' + key); if (box) box.innerHTML = patientPicker(key); UI.ppChanged?.[key]?.(); };
const ppKeepNew = key => { const st = ppState(key); const g = s => document.getElementById(`pp-${key}-${s}`); if (g('n')) st.np = { name: g('n').value, ci: g('ci').value, phone: g('t').value, birth: g('b').value, sex: g('s').value }; };
ACTIONS.ppSearch = el => { const k = el.dataset.k; ppState(k).q = el.value; document.getElementById(`pp-${k}-res`).innerHTML = ppResults(k); };
ACTIONS.ppPick = el => { const st = ppState(el.dataset.k); st.pid = el.dataset.id; st.newPat = false; ppRedraw(el.dataset.k); };
ACTIONS.ppClear = el => { const st = ppState(el.dataset.k); st.pid = null; ppRedraw(el.dataset.k); document.getElementById(`pp-${el.dataset.k}-q`)?.focus(); };
ACTIONS.ppNew = el => { const st = ppState(el.dataset.k); st.newPat = true; st.pid = null; if (st.q && !st.np.name) st.np = { [/\d/.test(st.q) ? 'ci' : 'name']: st.q }; ppRedraw(el.dataset.k); };
ACTIONS.ppBack = el => { ppKeepNew(el.dataset.k); ppState(el.dataset.k).newPat = false; ppRedraw(el.dataset.k); };
ACTIONS.ppDup = el => {
  const k = el.dataset.k; const ci = normDigits(document.getElementById(`pp-${k}-ci`).value); const hit = ci.length > 5 && S.patients.find(p => normDigits(p.ci) === ci);
  document.getElementById(`pp-${k}-dup`).innerHTML = hit ? `<span class="pill warn">Ya existe</span> ${esc(hit.name)} con esa cédula. <button class="btn ghost sm" data-act="ppPick" data-k="${k}" data-id="${hit.id}">Usar este paciente</button>` : 'Se crea su perfil y todo lo que registres queda guardado en él.';
};
// Devuelve el paciente elegido, o crea el nuevo (con su código QRN) si se llenó el formulario
function pickerCommit(key) {
  const st = ppState(key);
  if (!st.newPat) return st.pid ? { ok: true, pid: st.pid } : { ok: false, msg: 'Elija el paciente (búsquelo por nombre o cédula).' };
  ppKeepNew(key); const np = st.np;
  if (!np.name?.trim() || !np.ci?.trim()) return { ok: false, msg: 'Escriba el nombre y la cédula del paciente nuevo.' };
  const dup = S.patients.find(p => normDigits(p.ci) === normDigits(np.ci)); if (dup) return { ok: false, msg: `Ya existe ${dup.name} con esa cédula: pulse "Usar este paciente".` };
  const p = { id: uid('pt'), code: 'QRN-' + String(101 + S.patients.length).padStart(6, '0'), name: np.name.trim(), ci: np.ci.trim(), phone: np.phone || '', birth: np.birth, sex: np.sex, blood: '', address: '', emergency: '', allergies: [], conditions: [], meds: [], surgeries: [], notes: [], consents: [] };
  p.created = dAt(0);
  S.patients.push(p); log('Paciente registrado', `${p.code} · ${p.name}`); st.pid = p.id; st.newPat = false;
  return { ok: true, pid: p.id, created: true };
}
