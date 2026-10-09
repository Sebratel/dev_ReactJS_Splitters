/**
 * Indicadores de GMUD — agregações puras (sem I/O), testáveis.
 *
 * Duas fontes:
 *  - Voalle (histórico completo): protocolo, abertura, prazo (SLA), encerramento, status, solicitante.
 *  - Plataforma (gmud_requests + gmud_events + vínculos): tipo, assunto, ambiente, POP, Comitê,
 *    execução, reagendamentos e impacto (clientes afetados das massivas vinculadas).
 *
 * Período: [from, to] em datas YYYY-MM-DD (inclusive). Métricas de "agora" (abertas, vencidas,
 * idade do backlog) ignoram o período — são a foto do momento.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function toDate(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fim do dia `to` (exclusivo): to + 1 dia, meia-noite local. */
function periodBounds(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return { start: new Date(fy, fm - 1, fd), end: new Date(ty, tm - 1, td + 1) };
}

function inPeriod(date, bounds) {
  return date != null && date >= bounds.start && date < bounds.end;
}

export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function round1(x) {
  return x == null ? null : Math.round(x * 10) / 10;
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Meses (YYYY-MM) entre o início e o fim do período. */
export function monthsBetween(from, to) {
  const out = [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function emptyHeatmap() {
  return Array.from({ length: 7 }, () => Array(24).fill(0));
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (key == null || key === '') continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

const AGING_BUCKETS = [
  { key: '<7d', maxDays: 7 },
  { key: '7–30d', maxDays: 30 },
  { key: '30–90d', maxDays: 90 },
  { key: '>90d', maxDays: Infinity },
];

/**
 * @param {Array<{protocol:number,title:string,requester:string,status:string,openedAt:any,slaDate:any,conclusionDate:any}>} rows
 */
export function aggregateVoalle(rows, { from, to, now = new Date() }) {
  const bounds = periodBounds(from, to);
  const items = rows.map((r) => ({
    ...r,
    openedAt: toDate(r.openedAt),
    slaDate: toDate(r.slaDate),
    conclusionDate: toDate(r.conclusionDate),
    cancelled: /cancel/i.test(String(r.status ?? '')),
  }));

  // --- Foto de agora -------------------------------------------------------
  const openNow = items.filter((i) => i.conclusionDate == null && !i.cancelled);
  const overdueNow = openNow.filter((i) => i.slaDate != null && i.slaDate < now);
  const aging = AGING_BUCKETS.map((b) => ({ bucket: b.key, count: 0 }));
  for (const i of openNow) {
    if (!i.openedAt) continue;
    const days = (now - i.openedAt) / DAY_MS;
    const idx = AGING_BUCKETS.findIndex((b) => days < b.maxDays);
    aging[idx].count += 1;
  }
  const oldestOpen = [...openNow]
    .filter((i) => i.openedAt)
    .sort((a, b) => a.openedAt - b.openedAt)
    .slice(0, 10)
    .map((i) => ({
      protocol: i.protocol,
      title: i.title,
      requester: i.requester,
      openedAt: i.openedAt.toISOString(),
      ageDays: Math.floor((now - i.openedAt) / DAY_MS),
      overdueDays: i.slaDate && i.slaDate < now ? Math.floor((now - i.slaDate) / DAY_MS) : 0,
    }));
  const statusNow = countBy(items, (i) => i.status || 'Sem status').map((s) => ({ status: s.key, count: s.count }));

  // --- Fluxo no período ----------------------------------------------------
  const openedInPeriod = items.filter((i) => inPeriod(i.openedAt, bounds));
  const closedInPeriod = items.filter((i) => !i.cancelled && inPeriod(i.conclusionDate, bounds));
  const cancelledInPeriod = items.filter((i) => i.cancelled && inPeriod(i.conclusionDate ?? i.openedAt, bounds));
  const closedOnTime = closedInPeriod.filter((i) => i.slaDate && i.conclusionDate <= i.slaDate);
  const hoursToClose = closedInPeriod
    .filter((i) => i.openedAt)
    .map((i) => (i.conclusionDate - i.openedAt) / HOUR_MS);

  const months = monthsBetween(from, to);
  const monthly = months.map((month) => {
    const [y, m] = month.split('-').map(Number);
    const monthEnd = new Date(y, m, 1);
    const backlog = items.filter(
      (i) =>
        !i.cancelled &&
        i.openedAt &&
        i.openedAt < monthEnd &&
        (i.conclusionDate == null || i.conclusionDate >= monthEnd),
    ).length;
    return {
      month,
      opened: openedInPeriod.filter((i) => monthKey(i.openedAt) === month).length,
      closed: closedInPeriod.filter((i) => monthKey(i.conclusionDate) === month).length,
      backlog,
    };
  });

  const heatmap = emptyHeatmap();
  for (const i of openedInPeriod) heatmap[i.openedAt.getDay()][i.openedAt.getHours()] += 1;

  const byRequester = new Map();
  for (const i of openedInPeriod) {
    const key = (i.requester || 'Não informado').trim();
    const acc = byRequester.get(key) ?? { requester: key, opened: 0, closed: 0, openNow: 0, overdueNow: 0 };
    acc.opened += 1;
    if (i.conclusionDate != null && !i.cancelled) acc.closed += 1;
    if (i.conclusionDate == null && !i.cancelled) {
      acc.openNow += 1;
      if (i.slaDate && i.slaDate < now) acc.overdueNow += 1;
    }
    byRequester.set(key, acc);
  }
  const requesters = [...byRequester.values()]
    .map((r) => ({ ...r, closedRate: r.opened ? round1((r.closed / r.opened) * 100) : null }))
    .sort((a, b) => b.opened - a.opened)
    .slice(0, 15);

  return {
    snapshot: {
      total: items.length,
      openNow: openNow.length,
      overdueNow: overdueNow.length,
      aging,
      oldestOpen,
      statusNow,
    },
    period: {
      opened: openedInPeriod.length,
      closed: closedInPeriod.length,
      cancelled: cancelledInPeriod.length,
      closedOnTime: closedOnTime.length,
      onTimeRate: closedInPeriod.length ? round1((closedOnTime.length / closedInPeriod.length) * 100) : null,
      medianHoursToClose: round1(median(hoursToClose)),
      monthly,
      heatmap,
      requesters,
    },
  };
}

/**
 * @param {Array<object>} requests linhas mapeadas de gmud_requests (mapGmudRow), criadas no período
 * @param {Array<{type:string, voalleProtocol:number}>} events eventos do período
 * @param {Array<{gmudProtocol:number, massivaProtocol:number, affectedClients:number|null}>} links
 */
export function aggregatePlatform(requests, events, links, { now = new Date() } = {}) {
  const total = requests.length;
  const comite = { pendente: 0, aprovada: 0, negada: 0 };
  for (const r of requests) {
    const s = r.statusComite ?? 'pendente';
    if (s in comite) comite[s] += 1;
  }
  const decided = comite.aprovada + comite.negada;
  const hoursToDecision = requests
    .filter((r) => r.decididoEm && r.createdAt)
    .map((r) => (new Date(r.decididoEm) - new Date(r.createdAt)) / HOUR_MS);

  const exec = { pendente: 0, em_execucao: 0, concluida: 0 };
  for (const r of requests) {
    const s = r.statusExec ?? 'pendente';
    if (s in exec) exec[s] += 1;
  }

  const ambientes = countBy(
    requests.flatMap((r) => (Array.isArray(r.ambienteAfetado) ? r.ambienteAfetado : [])),
    (a) => String(a).trim(),
  );

  const windowHeatmap = emptyHeatmap();
  for (const r of requests) {
    if (!r.dataInicio || !r.horaInicio) continue;
    const [y, m, d] = r.dataInicio.split('-').map(Number);
    const hour = Number(r.horaInicio.slice(0, 2));
    const day = new Date(y, m - 1, d).getDay();
    if (Number.isFinite(hour)) windowHeatmap[day][hour] += 1;
  }

  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const pastWindowNotClosed = requests.filter(
    (r) =>
      r.statusComite === 'aprovada' &&
      (r.dataFim || r.dataInicio) &&
      (r.dataFim || r.dataInicio) < todayKey &&
      !r.ellevenEncerradoEm,
  );

  const rescheduleEvents = events.filter((e) => e.type === 'reagendada');
  const protocols = new Set(requests.map((r) => r.voalleProtocol));
  const relevantLinks = links.filter((l) => protocols.has(l.gmudProtocol));
  const impactByGmud = new Map();
  for (const l of relevantLinks) {
    const acc = impactByGmud.get(l.gmudProtocol) ?? { gmudProtocol: l.gmudProtocol, massivas: 0, affectedClients: 0 };
    acc.massivas += 1;
    acc.affectedClients += Math.max(0, Number(l.affectedClients) || 0);
    impactByGmud.set(l.gmudProtocol, acc);
  }
  const titleByProtocol = new Map(requests.map((r) => [r.voalleProtocol, r.titulo || r.popSite || '']));
  const topImpact = [...impactByGmud.values()]
    .sort((a, b) => b.affectedClients - a.affectedClients || b.massivas - a.massivas)
    .slice(0, 10)
    .map((i) => ({ ...i, title: titleByProtocol.get(i.gmudProtocol) ?? '' }));

  return {
    total,
    comite,
    approvalRate: decided ? round1((comite.aprovada / decided) * 100) : null,
    medianHoursToDecision: round1(median(hoursToDecision)),
    exec,
    tipos: countBy(requests, (r) => r.tipo),
    assuntos: countBy(requests, (r) => r.assunto),
    ambientes,
    pops: countBy(requests, (r) => r.popSite).slice(0, 10),
    impactoParada: countBy(requests, (r) => r.impactoParada),
    comunicaCliente: countBy(requests, (r) => r.comunicaCliente),
    rnc: requests.filter((r) => r.rnc).length,
    encerradas: {
      concluida: requests.filter((r) => r.ellevenEncerradoStatus === 'concluida').length,
      negada: requests.filter((r) => r.ellevenEncerradoStatus === 'negada').length,
    },
    reagendamentos: {
      total: rescheduleEvents.length,
      gmuds: new Set(rescheduleEvents.map((e) => e.voalleProtocol)).size,
    },
    pastWindowNotClosed: pastWindowNotClosed.map((r) => ({
      voalleProtocol: r.voalleProtocol,
      title: r.titulo ?? '',
      dataFim: r.dataFim || r.dataInicio,
    })),
    windowHeatmap,
    impacto: {
      gmudsComMassiva: impactByGmud.size,
      massivasVinculadas: relevantLinks.length,
      clientesAfetados: [...impactByGmud.values()].reduce((s, i) => s + i.affectedClients, 0),
      topImpact,
    },
  };
}
