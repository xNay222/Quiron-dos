// Resumen del día (Inicio, solo Administración): dinero, pacientes e inventario de hoy o de ayer, en una tarjeta,
// con un botón para copiarlo como texto y mandarlo por WhatsApp.

function dailySummary(day) {
  const isToday = day === dAt(0); const on = s => String(s || '').startsWith(day);
  const moves = acctMoves(day, day).filter(m => !m.example);
  const sum = (list, cur) => r2(list.filter(m => m.cur === cur).reduce((s, m) => s + m.amount, 0));
  const cobros = moves.filter(m => m.type === 'entrada' && m.cat === 'Cobros a pacientes');
  const otrasIn = moves.filter(m => m.type === 'entrada' && m.cat !== 'Cobros a pacientes');
  const salidas = moves.filter(m => m.type === 'salida');
  const appts = (S.appts || []).filter(a => a.date === day);
  const cons = appts.filter(a => a.kind === 'consulta' && isActive(a)).length;
  const signed = (S.consults || []).filter(c => c.status === 'firmada' && on(c.signedAt || c.date)).length;
  const qx = appts.filter(a => a.kind === 'cirugia');
  const adm = (S.admissions || []).filter(a => on(a.admittedAt)); const alt = (S.admissions || []).filter(a => on(a.dischargedAt));
  const tri = (S.triage || []).filter(t => on(t.arrivedAt));
  const triBy = TRI_COLORS.map(c => [c, tri.filter(t => t.color === c.k).length]).filter(x => x[1]);
  const waited = tri.filter(t => t.attendedAt).map(t => Math.max(0, Math.round((new Date(t.attendedAt.replace(' ', 'T')) - new Date(t.arrivedAt.replace(' ', 'T'))) / 60000)));
  const out = (S.moves || []).filter(m => (m.type === 'salida' || m.type === 'consumo') && m.date === day && m.pid);
  const outUnits = out.reduce((s, m) => s + Math.abs(m.qty || 0), 0); const outUsd = r2(out.reduce((s, m) => s + moveUsd(m), 0));
  const top = Object.values(out.reduce((g, m) => { const e = g[m.pid] = g[m.pid] || { name: prod(m.pid)?.name || m.name, n: 0 }; e.n += Math.abs(m.qty || 0); return g; }, {})).sort((a, b) => b.n - a.n).slice(0, 3);
  const ins = (S.moves || []).filter(m => m.type === 'entrada' && m.date === day && m.pid).length;
  const agotados = isToday ? S.products.filter(p => p.min > 0 && usable(p) === 0).length : null;
  const vencen7 = isToday ? S.products.reduce((s, p) => s + p.lots.filter(l => l.qty > 0 && l.exp && daysTo(l.exp) >= 0 && daysTo(l.exp) <= 7).length, 0) : null;
  const exams = (S.exams || []).filter(e => e.date === day);
  return { day, isToday, cobrosUSD: sum(cobros, 'USD'), cobrosVES: sum(cobros, 'VES'), nCobros: cobros.length, otrasUSD: sum(otrasIn, 'USD'), otrasVES: sum(otrasIn, 'VES'),
    gastosUSD: sum(salidas, 'USD'), gastosVES: sum(salidas, 'VES'), cons, signed, qxDone: qx.filter(a => a.done).length, qxPend: qx.filter(a => !a.done && isActive(a)).length, qxCanc: qx.filter(a => !isActive(a)).length,
    ingresos: adm.length, ingEmerg: adm.filter(a => a.emerg).length, altas: alt.length, enCama: isToday ? S.admissions.filter(a => a.status === 'ingresado').length : null,
    tri: tri.length, triBy, triAvg: waited.length ? Math.round(waited.reduce((a, b) => a + b, 0) / waited.length) : null, retirados: tri.filter(t => t.status === 'retirado').length,
    outUnits, outUsd, top, ins, agotados, vencen7, exams: exams.length, examsReady: exams.filter(e => e.status === 'listo').length };
}

function dailySummaryCard() {
  if (!can('*')) return '';
  const day = UI.dsDay === 'ayer' ? dAt(-1) : dAt(0); const d = dailySummary(day);
  const money = (usd, ves) => [usd ? fmt(usd) : '', ves ? fmt(ves, 'VES') : ''].filter(Boolean).join(' + ') || '—';
  const stat = (label, value, sub = '') => `<div class="ds-stat"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  return `<section class="card sec ds-card" aria-label="Resumen del día"><div class="between" style="gap:10px;flex-wrap:wrap">
      <div><h2 style="margin:0">Resumen del día</h2><div class="small muted">${fday(day).replace(/^./, c => c.toUpperCase())}${d.isToday ? ' · hasta ahora' : ''}</div></div>
      <div class="hstack"><div class="seg" role="group" aria-label="Día del resumen"><button data-act="dsDay" data-k="hoy" aria-pressed="${d.isToday}">Hoy</button><button data-act="dsDay" data-k="ayer" aria-pressed="${!d.isToday}">Ayer</button></div>
      <button class="btn sm" data-act="dsCopy">Copiar para WhatsApp</button></div></div>
    <div class="ds-grid">
      <div class="ds-col"><h3>Dinero</h3>
        ${stat('Cobros a pacientes', money(d.cobrosUSD, d.cobrosVES), `${d.nCobros} pago(s)`)}
        ${d.otrasUSD || d.otrasVES ? stat('Otras entradas', money(d.otrasUSD, d.otrasVES)) : ''}
        ${stat('Gastos', money(d.gastosUSD, d.gastosVES))}</div>
      <div class="ds-col"><h3>Pacientes</h3>
        ${stat('Consultas', d.cons, d.signed ? `${d.signed} informe(s) firmado(s)` : 'en agenda')}
        ${stat('Cirugías', d.qxDone + d.qxPend, `${d.qxDone} realizada(s)${d.qxPend ? ` · ${d.qxPend} pendiente(s)` : ''}${d.qxCanc ? ` · ${d.qxCanc} cancelada(s)` : ''}`)}
        ${stat('Ingresos y altas', `${d.ingresos} / ${d.altas}`, `${d.ingEmerg ? d.ingEmerg + ' por emergencia · ' : ''}${d.enCama !== null ? d.enCama + ' en cama ahora' : 'ingresos / altas'}`)}
        ${stat('Emergencias (triaje)', d.tri, d.tri ? `${d.triBy.map(([c, n]) => `${n} ${c.name.toLowerCase()}`).join(' · ')}${d.triAvg !== null ? ` · espera media ${d.triAvg} min` : ''}${d.retirados ? ` · ${d.retirados} se retiró` : ''}` : 'sin llegadas')}</div>
      <div class="ds-col"><h3>Inventario</h3>
        ${stat('Salió del almacén', `${d.outUnits} unid.`, `${fmt(d.outUsd)}${d.top.length ? ' · más: ' + d.top.map(t => `${esc(t.name.split(' (')[0].slice(0, 26))} (${t.n})`).join(', ') : ''}`)}
        ${stat('Entradas registradas', d.ins)}
        ${d.agotados !== null ? stat('Agotados / vencen en 7 días', `${d.agotados} / ${d.vencen7}`, 'productos con mínimo · lotes') : ''}
        ${stat('Exámenes', d.exams, d.exams ? `${d.examsReady} con resultado` : '')}</div>
    </div></section>`;
}
ACTIONS.dsDay = el => { UI.dsDay = el.dataset.k; render(); };
// Texto para pegar en WhatsApp (negritas con *asteriscos*)
function dailySummaryText(d) {
  const money = (usd, ves) => [usd ? fmt(usd) : '', ves ? fmt(ves, 'VES') : ''].filter(Boolean).join(' + ') || '0';
  return [`*Resumen ${S.clinic?.name || 'Quirón'} · ${fday(d.day)}*${d.isToday ? ' (hasta ' + new Date().toTimeString().slice(0, 5) + ')' : ''}`, '',
    '*Dinero*', `• Cobros: ${money(d.cobrosUSD, d.cobrosVES)} (${d.nCobros} pagos)`, ...(d.otrasUSD || d.otrasVES ? [`• Otras entradas: ${money(d.otrasUSD, d.otrasVES)}`] : []), `• Gastos: ${money(d.gastosUSD, d.gastosVES)}`, '',
    '*Pacientes*', `• Consultas: ${d.cons}`, `• Cirugías: ${d.qxDone} realizadas${d.qxPend ? `, ${d.qxPend} pendientes` : ''}${d.qxCanc ? `, ${d.qxCanc} canceladas` : ''}`,
    `• Ingresos: ${d.ingresos} · Altas: ${d.altas}${d.enCama !== null ? ` · En cama: ${d.enCama}` : ''}`, `• Emergencias: ${d.tri}${d.triBy.length ? ' (' + d.triBy.map(([c, n]) => `${n} ${c.name.toLowerCase()}`).join(', ') + ')' : ''}`, '',
    '*Inventario*', `• Salió: ${d.outUnits} unid. (${fmt(d.outUsd)})${d.top.length ? ' · más: ' + d.top.map(t => `${t.name.split(' (')[0]} ${t.n}`).join(', ') : ''}`, ...(d.agotados !== null ? [`• Agotados: ${d.agotados} · Lotes que vencen en 7 días: ${d.vencen7}`] : [])].join('\n');
}
ACTIONS.dsCopy = async () => { const d = dailySummary(UI.dsDay === 'ayer' ? dAt(-1) : dAt(0)); const t = dailySummaryText(d);
  try { await navigator.clipboard.writeText(t); toast('Resumen copiado: péguelo en WhatsApp'); }
  catch (e) { openSheet('Resumen para WhatsApp', `<textarea class="input" id="ds-txt" rows="16" readonly>${esc(t)}</textarea><div class="small muted">Seleccione el texto y cópielo.</div>`, '<button class="btn" data-act="close">Cerrar</button>'); setTimeout(() => document.getElementById('ds-txt')?.select(), 50); } };
