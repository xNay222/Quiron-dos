// Mapa del almacén, dibujado a escala (centímetros) a partir del plano de la clínica, orientado como se ve desde la entrada.
// Tres sectores: la sala de la entrada, el tramo central y la sala del fondo.
const SECTORS = [
  { id: 1, name: 'Sector 1', desc: 'Entrada', size: '3,6 × 3,6 m', x: 270, y: 127, w: 360, h: 360, dx: -40 },
  { id: 2, name: 'Sector 2', desc: 'Central', size: '2,4 × 2,8 m', x: 270, y: 487, w: 240, h: 280, dx: 20, dy: 41, fs: 0.75 },
  { id: 3, name: 'Sector 3', desc: 'Fondo', size: '2,7 × 3,6 m', x: 0, y: 640, w: 270, h: 360, dy: -75 },
];
// Estanterías A, B y C: en el Sector 1, detrás de la puerta de entrada, contra la pared derecha. La A es la más cercana a la puerta.
// Cada una tiene 6 niveles (EST-A-01 … EST-A-06) y en cada nivel recipientes numerados donde se guardan las medicinas.
const SHELVES = [
  { id: 'A', sector: 1, name: 'Estantería A', x: 582, y: 138, w: 40, h: 90 },
  { id: 'B', sector: 1, name: 'Estantería B', x: 582, y: 228, w: 40, h: 90 },
  { id: 'C', sector: 1, name: 'Estantería C', x: 582, y: 318, w: 40, h: 90 },
  // Nevera, al lado de la C (cadena de frío): 4 niveles (N-01 a N-04), gaveta (N-05) y 3 niveles en la puerta (N-06 a N-08)
  { id: 'N', sector: 1, name: 'Nevera', x: 584, y: 416, w: 36, h: 62, fridge: true, levels: [1, 2, 3, 4, 5, 6, 7, 8],
    levelNames: { 1: 'Nivel 1 (arriba)', 2: 'Nivel 2', 3: 'Nivel 3', 4: 'Nivel 4', 5: 'Gaveta', 6: 'Puerta · arriba', 7: 'Puerta · medio', 8: 'Puerta · abajo' } },
  // Sector 2 (central): F y G contra la pared izquierda, D contra la derecha, E bajo la D y H junto a la puerta del Sector 3
  { id: 'D', sector: 2, name: 'Estantería D', x: 464, y: 500, w: 40, h: 84, levels: [1, 2, 3, 4, 5] },
  { id: 'E', sector: 2, name: 'Estantería E', x: 410, y: 594, w: 94, h: 40, levels: [1, 2, 3, 4] },
  { id: 'F', sector: 2, name: 'Estantería F', x: 276, y: 508, w: 40, h: 56, levels: [1, 2, 3, 4] },
  { id: 'G', sector: 2, name: 'Estantería G', x: 276, y: 566, w: 40, h: 56 },
  { id: 'H', sector: 2, name: 'Estantería H', x: 278, y: 718, w: 80, h: 40 },
];
const LEVELS = [1, 2, 3, 4, 5, 6];        // el nivel 01 es la repisa de arriba
const sectorOf = n => SECTORS.find(s => s.id === +n);
const shelfOf = id => SHELVES.find(s => s.id === id);
const levelsOf = id => shelfOf(id)?.levels || LEVELS;
const levelCode = (shelf, level) => `${shelfOf(shelf)?.fridge ? '' : 'EST-'}${shelf}-${String(level).padStart(2, '0')}`;
// Texto corto de la ubicación dentro del sector: "EST-A-02 · Recipiente 3"
const spotText = l => [l.shelf && (l.level ? levelCode(l.shelf, l.level) : shelfOf(l.shelf)?.name), l.bin && 'Recipiente ' + l.bin, l.spot].filter(Boolean).join(' · ');
const locText = p => p.loc?.sector ? [sectorOf(p.loc.sector).name, spotText(p.loc)].filter(Boolean).join(' · ') : '';
// Unidades vencidas que siguen físicamente en el recipiente (no se despachan, pero hay que verlas)
const expiredNote = (p, plain = false) => { const n = stock(p) - usable(p); return n > 0 ? (plain ? ` · ${n} vencidas` : ` <span class="pill bad" style="font-size:11px;padding:0 6px">+${n} vencidas</span>`) : ''; };
const byBin = (a, b) => (+a.loc.bin || 1e9) - (+b.loc.bin || 1e9) || a.name.localeCompare(b.name);

// active: sector resaltado · shelf: estantería resaltada · counts: {sector: n} · act / shelfAct: acción al tocar (null = solo lectura)
function warehouseMap({ active = null, shelf = null, counts = null, act = null, shelfAct = null, pid = '' } = {}) {
  const sec = s => { const on = +active === s.id; const cx = s.x + s.w / 2 + (s.dx || 0), cy = s.y + s.h / 2 + (s.dy || 0); const k = s.fs || 1;   // fs: texto más chico donde hay estanterías
    return `<g class="sector${act ? ' pick' : ''}" ${act ? `data-act="${act}" data-s="${s.id}" data-id="${pid}" role="button" tabindex="0" aria-label="${s.name}, ${s.desc}"` : ''} aria-pressed="${on}">
      <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${on ? 'var(--accent)' : 'var(--fill)'}" fill-opacity="${on ? 0.28 : 1}"/>
      ${on ? `<rect x="${s.x + 6}" y="${s.y + 6}" width="${s.w - 12}" height="${s.h - 12}" fill="none" stroke="var(--accent)" stroke-width="6" rx="4"/>` : ''}
      <text x="${cx}" y="${cy - 8 * k}" text-anchor="middle" font-size="${34 * k}" font-weight="600" fill="${on ? 'var(--accent)' : 'var(--fg)'}">${s.name}</text>
      <text x="${cx}" y="${cy + 26 * k}" text-anchor="middle" font-size="${22 * k}" fill="var(--fg2)">${s.desc} · ${s.size}</text>
      ${counts ? `<text x="${cx}" y="${cy + 58 * k}" text-anchor="middle" font-size="${22 * k}" font-weight="600" fill="var(--fg2)">${counts[s.id] || 0} productos</text>` : ''}
    </g>`; };
  // Las estanterías van aparte de los sectores para que el resaltado de uno no pinte al otro
  const sh = e => { const on = shelf === e.id;
    return `<g class="shelf${shelfAct ? ' pick' : ''}" ${shelfAct ? `data-act="${shelfAct}" data-e="${e.id}" data-id="${pid}" role="button" tabindex="0" aria-label="${e.name}"` : ''} aria-pressed="${on}">
      <rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" ${e.fridge ? 'rx="6"' : ''} fill="${on ? 'var(--accent)' : e.fridge ? 'var(--accent-soft)' : 'var(--card)'}" stroke="${on ? 'var(--accent)' : 'var(--fg2)'}" stroke-width="3"/>
      ${e.fridge ? `<path d="M${e.x + 4} ${e.y + 22}H${e.x + e.w - 4}" stroke="${on ? '#fff' : 'var(--fg2)'}" stroke-width="2"/>` : ''}
      <text x="${e.x + e.w / 2}" y="${e.y + e.h / 2 + 9}" text-anchor="middle" font-size="26" font-weight="700" fill="${on ? '#fff' : 'var(--fg)'}">${e.id}</text>
    </g>`; };
  return `<svg viewBox="-30 20 700 1010" role="img" aria-label="Mapa del almacén con tres sectores y las estanterías A, B, C y la nevera N del Sector 1 y las estanterías D a H del Sector 2" style="display:block;width:100%;max-width:440px;height:auto;margin:0 auto">
    ${SECTORS.map(sec).join('')}
    <path d="M510 487H270M270 767V640" stroke="var(--fg3)" stroke-width="3" stroke-dasharray="10 8" fill="none"/>
    <path d="M630 127V487H510V767H270V1000H0V640H270V127Z" fill="none" stroke="var(--fg)" stroke-width="12" stroke-linejoin="miter"/>
    <path d="M565 127H507M270 847V794" stroke="var(--card)" stroke-width="16"/>
    <path d="M565 127V185A58 58 0 0 1 507 127" fill="none" stroke="var(--fg2)" stroke-width="3"/>
    <path d="M270 794H217A53 53 0 0 0 270 847" fill="none" stroke="var(--fg2)" stroke-width="3"/>
    <g class="shelves">${SHELVES.map(sh).join('')}</g>
    <path d="M536 75l14 0l-14 20l-14 -20z" fill="var(--fg)"/>
    <text x="536" y="58" text-anchor="middle" font-size="22" font-weight="600" fill="var(--fg)">ENTRADA</text>
  </svg>`;
}

// Vista de frente de una estantería: sus 6 niveles con los productos de cada uno.
// pick: nivel elegido · act: acción al tocar un nivel · open: si los productos se pueden abrir
function shelfFront(id, { pick = null, act = null, pid = '', open = true } = {}) {
  const items = S.products.filter(p => p.loc?.shelf === id);
  return `<div class="shelf-front" role="group" aria-label="${shelfOf(id).name}, vista de frente">${levelsOf(id).map(n => {
    const here = items.filter(p => +p.loc.level === n).sort(byBin); const on = +pick === n;
    return `<div class="lvl${act ? ' pick' : ''}" ${act ? `data-act="${act}" data-e="${id}" data-l="${n}" data-id="${pid}" role="button" tabindex="0"` : ''} aria-pressed="${on}">
      <div class="lvl-code">${levelCode(id, n)}${shelfOf(id).levelNames?.[n] ? `<div style="font-weight:400;margin-top:3px">${shelfOf(id).levelNames[n]}</div>` : ''}</div>
      <div class="lvl-items">${here.map(p => `<${open ? `button data-act="openProduct" data-id="${p.id}"` : 'span'} class="bin-chip">${p.loc.bin ? `<b>${esc(p.loc.bin)}</b>` : ''}${esc(p.name)} <span class="muted">· ${usable(p)}</span>${expiredNote(p)}</${open ? 'button' : 'span'}>`).join('') || '<span class="muted small">Vacío</span>'}</div></div>`; }).join('')}</div>`;
}

// Bloque de ubicación dentro de la ficha de un producto
function locationBlock(p) {
  const l = p.loc || {};
  return `<div class="card" style="display:grid;gap:12px"><div class="between"><h2 style="margin:0">Dónde está</h2>${l.sector ? `<span class="pill info">${esc(locText(p))}</span>` : '<span class="pill warn">Sin ubicación asignada</span>'}</div>
    ${warehouseMap({ active: l.sector, shelf: l.shelf, act: 'pickSector', shelfAct: 'pickShelf', pid: p.id })}
    <div class="small muted" style="text-align:center">Toque un sector del mapa, o una estantería (A a H) o la nevera (N), para asignarle o cambiarle la ubicación.</div>
    ${l.shelf ? `<div class="small muted">Elija el nivel de la ${shelfOf(l.shelf).name}:</div>${shelfFront(l.shelf, { pick: l.level, act: 'pickLevel', pid: p.id, open: false })}` : ''}
    <div class="hstack" style="flex-wrap:nowrap">${l.shelf ? `<input class="input" id="loc-bin" inputmode="numeric" placeholder="Recipiente nº" value="${esc(l.bin || '')}" aria-label="Número del recipiente" style="max-width:140px">` : ''}<input class="input" id="loc-spot" placeholder="Detalle (opcional)" value="${esc(l.spot || '')}" aria-label="Detalle de la ubicación"><button class="btn" data-act="saveSpot" data-id="${p.id}" ${l.sector ? '' : 'disabled'}>Guardar</button></div></div>`;
}
const setLoc = (p, loc, msg) => { p.loc = loc; log('Ubicación asignada', `${p.name} → ${locText(p)}`); save(); ACTIONS.openProduct({ dataset: { id: p.id } }); toast(msg); };
ACTIONS.pickSector = el => {
  const p = prod(el.dataset.id); const s = +el.dataset.s; const l = p.loc || {};
  setLoc(p, +l.sector === s ? l : { sector: s, spot: l.spot || '' }, `${p.name}: ${sectorOf(s).name}`);
};
ACTIONS.pickShelf = el => {
  const p = prod(el.dataset.id); const e = shelfOf(el.dataset.e); const l = p.loc || {};
  setLoc(p, l.shelf === e.id ? l : { sector: e.sector, shelf: e.id, level: null, bin: l.bin || '', spot: l.spot || '' }, `${p.name}: ${e.name}`);
};
ACTIONS.pickLevel = el => {
  const p = prod(el.dataset.id); const n = +el.dataset.l;
  setLoc(p, { ...p.loc, level: n, bin: document.getElementById('loc-bin')?.value.trim() ?? p.loc.bin }, `${p.name}: ${levelCode(el.dataset.e, n)}`);
};
ACTIONS.saveSpot = el => {
  const p = prod(el.dataset.id); const bin = document.getElementById('loc-bin');
  p.loc = { ...(p.loc || {}), spot: val('loc-spot').trim(), ...(bin ? { bin: bin.value.trim() } : {}) };
  log('Ubicación actualizada', `${p.name} → ${locText(p)}`); save(); toast('Ubicación guardada'); ACTIONS.openProduct({ dataset: { id: p.id } });
};
document.addEventListener('keydown', e => { const g = e.target.closest?.('.sector.pick, .shelf.pick, .lvl.pick'); if (g && e.target === g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });

// Pestaña "Mapa" del inventario. Al tocar una estantería se abre su vista de frente (zoom) con todos sus medicamentos.
function mapTab() {
  if (UI.mapShelf) return shelfZoom(UI.mapShelf);
  const counts = {}; S.products.forEach(p => { if (p.loc?.sector) counts[p.loc.sector] = (counts[p.loc.sector] || 0) + 1; });
  const sel = UI.mapSel; const none = S.products.filter(p => !p.loc?.sector);
  const here = sel ? S.products.filter(p => +p.loc?.sector === +sel).sort(byBin) : [];
  return `<div class="grid g2"><div class="card">${warehouseMap({ active: sel, counts, act: 'mapSel', shelfAct: 'mapShelf' })}<div class="small muted" style="text-align:center;margin-top:8px">Toque un sector para ver qué hay en él, o una estantería (A a H) o la nevera (N) para verla de cerca.</div></div>
    <div class="stack">${sel ? `<div class="list"><div class="row"><div class="grow"><div class="t">${sectorOf(sel).name} · ${sectorOf(sel).desc}</div><div class="s">${here.length} productos</div></div></div>
      ${here.map(p => `<button class="row" data-act="openProduct" data-id="${p.id}"><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(spotText(p.loc) || 'Sin detalle')} · ${usable(p)} disponibles${expiredNote(p, true)}</div></div><span class="pill ${stockState(p).k}">${stockState(p).t}</span></button>`).join('') || '<div class="empty">Todavía no hay productos en este sector.</div>'}</div>`
      : '<div class="card muted small">Elija un sector en el mapa.</div>'}
      ${none.length ? `<div class="banner warn">${none.length} de ${S.products.length} productos no tienen ubicación. Abra cada producto y toque su sector en el mapa.</div>` : ''}</div></div>`;
}
function shelfZoom(id) {
  const e = shelfOf(id); const items = S.products.filter(p => p.loc?.shelf === id).sort((a, b) => (a.loc.level || 9) - (b.loc.level || 9) || byBin(a, b));
  return `<div class="stack"><div class="between"><button class="btn" data-act="mapBack">‹ Volver al mapa</button>
      <div class="seg" role="group" aria-label="Estantería">${SHELVES.map(s => `<button data-act="mapShelf" data-e="${s.id}" aria-pressed="${s.id === id}">${s.name}</button>`).join('')}</div></div>
    <div class="grid g2"><div class="card"><h2 style="margin:0 0 4px">${e.name}</h2><div class="small muted" style="margin-bottom:12px">${sectorOf(e.sector).name} · detrás de la puerta · ${items.length} productos</div>${shelfFront(id)}</div>
    <div class="stack"><div class="field"><label for="shelf-pick">Medicamentos en esta estantería</label>
      <select class="input" id="shelf-pick"${items.length ? '' : ' disabled'}><option value="">${items.length ? 'Elija un medicamento…' : 'Todavía no hay productos'}</option>${items.map(p => `<option value="${p.id}">${esc(p.name)} — ${esc(spotText(p.loc))}</option>`).join('')}</select></div>
      <div class="list">${items.map(p => `<button class="row" data-act="openProduct" data-id="${p.id}"><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(spotText(p.loc) || 'Sin nivel')} · ${usable(p)} ${esc(p.unit.toLowerCase())} disponibles${expiredNote(p, true)}</div></div><span class="pill ${stockState(p).k}">${stockState(p).t}</span></button>`).join('') || '<div class="empty">Para ubicar un producto aquí, ábralo y toque esta estantería en su mapa.</div>'}</div></div></div></div>`;
}
ACTIONS.mapSel = el => { UI.mapSel = +el.dataset.s; render(); };
ACTIONS.mapShelf = el => { UI.mapShelf = el.dataset.e; UI.mapSel = shelfOf(el.dataset.e).sector; render(); };
ACTIONS.mapBack = () => { UI.mapShelf = null; render(); };
document.addEventListener('change', e => { if (e.target.id === 'shelf-pick' && e.target.value) ACTIONS.openProduct({ dataset: { id: e.target.value } }); });
