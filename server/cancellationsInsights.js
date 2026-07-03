/**
 * Cancelamentos (churn) por área — agregação server-side.
 *
 * Fonte: authentication_contract_connection_occurrences (1 ocorrência ~ 1 contrato),
 * filtrada por contrato Cancelado. Cada linha traz data, AP, splitter (título/porta do
 * JSON), cidade/rua e o motivo do cancelamento.
 *
 * O motivo é categorizado em grupos; o grupo "rede" (insatisfação + concorrência) é o
 * churn que uma manutenção pode causar — foco do planejamento de redes.
 */
import { parseOltSlotPortFromSplitterTitulo } from './splitterTitleOltDerivation.js';
import { classifyLocationFromTitle } from './condominiumClassifier.js';

/** Categorias de motivo. `rede` = churn de qualidade/serviço (o que interessa). */
export const CANCELLATION_CATEGORIES = /** @type {const} */ ([
  'rede',
  'tecnico',
  'financeiro',
  'pre_instalacao',
  'mudanca',
  'operacional',
  'outros',
]);

function normalizeMotive(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Classifica o motivo do cancelamento num grupo. Ordem importa: os grupos mais
 * específicos primeiro. Baseado nos motivos reais da Voalle (jul/2026).
 *
 * @param {unknown} motive
 * @returns {typeof CANCELLATION_CATEGORIES[number]}
 */
export function categorizeCancellationMotive(motive) {
  const m = normalizeMotive(motive);
  if (m === '') return 'outros';

  // Rede/Qualidade — confirmado com o planejamento: insatisfação + foi p/ concorrência.
  if (m.includes('insatisfacao com os servicos')) return 'rede';
  if (m.includes('concorrencia') || m.includes('outra operadora')) return 'rede';

  // Operacional (não é churn real): venda em lote, contrato duplicado/gerado 2x.
  if (m.includes('venda operacao') || m.includes('venda em lote')) return 'operacional';
  if (m.includes('duplicad') || m.includes('gerado duas vezes')) return 'operacional';

  // Financeiro.
  if (
    m.includes('falta de pagamento') ||
    m.includes('sem condicoes de pagar') ||
    m.includes('inadimplenc') ||
    m.includes('pendencia financeira')
  ) {
    return 'financeiro';
  }

  // Mudança / fora de área de atendimento.
  if (m.includes('mudou') || m.includes('mudanca de endereco') || m.includes('nao atendemos')) {
    return 'mudanca';
  }

  // Técnico (viabilidade) — geralmente pré-ativação; separado de "rede" a pedido.
  if (m.includes('inviabilidade tecnica') || m.includes('motivo tecnico')) return 'tecnico';

  // Pré-instalação / cadastro.
  if (
    m.includes('endereco com pendencia') ||
    m.includes('cpf com pendencia') ||
    m.includes('falta de contato') ||
    m.includes('desist')
  ) {
    return 'pre_instalacao';
  }

  return 'outros';
}

/**
 * Sub-motivo dentro de "rede": distingue insatisfação com o serviço de migração para a
 * concorrência. Ajuda o planejamento a saber se o churn é de qualidade percebida ou de preço.
 * @param {unknown} motive
 * @returns {'insatisfacao' | 'concorrencia' | null}
 */
export function redeSubmotive(motive) {
  const m = normalizeMotive(motive);
  if (m.includes('insatisfacao com os servicos')) return 'insatisfacao';
  if (m.includes('concorrencia') || m.includes('outra operadora')) return 'concorrencia';
  return null;
}

function emptyCategoryCounts() {
  const out = {};
  for (const c of CANCELLATION_CATEGORIES) out[c] = 0;
  return out;
}

function pctDelta(recent, previous) {
  if (previous <= 0) return recent > 0 ? 100 : 0;
  return Math.round(((recent - previous) / previous) * 100);
}

/**
 * Concentração (Pareto) do churn de rede por área: quantas áreas concentram 80% do churn,
 * e qual a fatia das 5 maiores. Foca o esforço do planejamento.
 * @param {Map<string, { key: string, rede: number }>} map
 */
function buildRedeConcentration(map) {
  const items = [...map.values()]
    .filter((e) => e.rede > 0)
    .sort((a, b) => b.rede - a.rede);
  const redeTotal = items.reduce((s, e) => s + e.rede, 0);
  if (redeTotal === 0) {
    return { redeTotal: 0, totalAreas: 0, areasFor80pct: 0, top5Share: 0, cumulative: [] };
  }
  let cum = 0;
  const cumulative = items.slice(0, 20).map((e) => {
    cum += e.rede;
    return { key: e.key, rede: e.rede, cumPct: Math.round((cum / redeTotal) * 100) };
  });
  let acc = 0;
  let areasFor80pct = 0;
  for (const e of items) {
    acc += e.rede;
    areasFor80pct += 1;
    if (acc / redeTotal >= 0.8) break;
  }
  const top5 = items.slice(0, 5).reduce((s, e) => s + e.rede, 0);
  return {
    redeTotal,
    totalAreas: items.length,
    areasFor80pct,
    top5Share: Math.round((top5 / redeTotal) * 100),
    cumulative,
  };
}

/** Chave de mês YYYY-MM a partir de uma data (UTC-agnóstico: usa componentes locais). */
function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Agrega as linhas de cancelamento em recortes compactos para o frontend.
 *
 * @param {Array<{
 *   contractId: unknown, canceledAt: unknown, motive: unknown,
 *   accessPoint: unknown, splitterTitle: unknown, splitterPort: unknown,
 *   city: unknown, street: unknown
 * }>} rows
 * @param {{ topLimit?: number }} [options]
 */
export function aggregateCancellations(rows, options = {}) {
  const topLimit = options.topLimit ?? 100;
  const nowMs = options.now ?? Date.now();
  const trendWindowDays = options.trendWindowDays ?? 30;
  const trendWindowMs = trendWindowDays * 24 * 60 * 60 * 1000;

  // Dedup por contrato: mantém a ocorrência mais recente (data de cancelamento).
  const latestByContract = new Map();
  for (const row of rows) {
    const contractId = row.contractId == null ? null : Number(row.contractId);
    const at = row.canceledAt ? new Date(row.canceledAt) : null;
    if (at == null || Number.isNaN(at.getTime())) continue;
    const key = contractId ?? `row-${latestByContract.size}`;
    const prev = latestByContract.get(key);
    if (!prev || at.getTime() > prev._at.getTime()) {
      latestByContract.set(key, { ...row, _at: at });
    }
  }

  const totalsByCategory = emptyCategoryCounts();
  const byAp = new Map();
  const bySplitter = new Map();
  const byCity = new Map();
  const byMonth = new Map();
  const byTipoLocal = new Map();
  const byCondominio = new Map();
  const redeSubmotives = { insatisfacao: 0, concorrencia: 0, outros: 0 };
  let total = 0;
  let redeRecent = 0;
  let redePrevious = 0;

  const bump = (map, key, category, extra) => {
    if (!key) return;
    let entry = map.get(key);
    if (!entry) {
      entry = { key, total: 0, ...emptyCategoryCounts(), ...extra };
      map.set(key, entry);
    }
    entry.total += 1;
    entry[category] += 1;
  };

  for (const row of latestByContract.values()) {
    const category = categorizeCancellationMotive(row.motive);
    total += 1;
    totalsByCategory[category] += 1;

    const ap = String(row.accessPoint ?? '').trim();
    bump(byAp, ap || '(sem AP)', category);

    const splitterTitle = String(row.splitterTitle ?? '').trim();
    const { tipoLocal, nomeCondominio } = classifyLocationFromTitle(splitterTitle);
    if (splitterTitle) {
      const { slot, port } = parseOltSlotPortFromSplitterTitulo(splitterTitle);
      bump(bySplitter, splitterTitle, category, {
        slot,
        pon: port,
        accessPoint: ap || null,
        tipoLocal,
        nomeCondominio,
      });
    }

    const city = String(row.city ?? '').trim();
    bump(byCity, city || '(sem cidade)', category);

    bump(byMonth, monthKey(row._at), category);

    // Condomínio × Unidade — só classifica quando há título (sem título = sem classificação).
    const tipoKey = splitterTitle ? tipoLocal : 'SEM_CLASSIFICACAO';
    bump(byTipoLocal, tipoKey, category);
    if (tipoLocal === 'CONDOMÍNIO' && nomeCondominio) {
      bump(byCondominio, nomeCondominio, category, { tipoLocal: 'CONDOMÍNIO' });
    }

    if (category === 'rede') {
      const sub = redeSubmotive(row.motive);
      if (sub) redeSubmotives[sub] += 1;
      else redeSubmotives.outros += 1;

      const age = nowMs - row._at.getTime();
      if (age >= 0 && age < trendWindowMs) redeRecent += 1;
      else if (age >= trendWindowMs && age < 2 * trendWindowMs) redePrevious += 1;
    }
  }

  const topByRede = (map, limit = topLimit) =>
    [...map.values()]
      .sort((a, b) => (b.rede - a.rede) || (b.total - a.total))
      .slice(0, limit);

  const monthly = [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key));

  return {
    total,
    totalsByCategory,
    byAccessPoint: topByRede(byAp),
    bySplitter: topByRede(bySplitter),
    // Explorador: lista COMPACTA de todos os splitters com churn (só o necessário p/ o join;
    // OLT/slot/pon/coords vêm do riskRanking no cliente). Reduz o payload do summary.
    churnBySplitterFull: [...bySplitter.values()]
      .sort((a, b) => (b.rede - a.rede) || (b.total - a.total))
      .map((b) => ({
        key: b.key,
        total: b.total,
        rede: b.rede,
        tecnico: b.tecnico,
        financeiro: b.financeiro,
        pre_instalacao: b.pre_instalacao,
        mudanca: b.mudanca,
        operacional: b.operacional,
        outros: b.outros,
      })),
    byCity: topByRede(byCity),
    monthly,
    byTipoLocal: [...byTipoLocal.values()].sort((a, b) => b.total - a.total),
    byCondominio: topByRede(byCondominio),
    redeSubmotives,
    concentration: buildRedeConcentration(byAp),
    trend: {
      windowDays: trendWindowDays,
      redeRecent,
      redePrevious,
      deltaPct: pctDelta(redeRecent, redePrevious),
    },
  };
}

/**
 * Agregação focada num único splitter (tela de detalhe). Além dos totais por categoria e
 * série mensal, monta uma timeline enxuta e — se `eventAt` for informado (ex.: última
 * massiva do splitter) — conta o churn na janela de `windowDays` após o evento.
 *
 * @param {Array<{ contractId: unknown, canceledAt: unknown, motive: unknown, city: unknown }>} rows
 * @param {{ eventAt?: Date | null, windowDays?: number, timelineLimit?: number }} [options]
 */
export function aggregateSplitterCancellations(rows, options = {}) {
  const windowDays = options.windowDays ?? 30;
  const timelineLimit = options.timelineLimit ?? 50;
  const eventAt =
    options.eventAt instanceof Date && !Number.isNaN(options.eventAt.getTime())
      ? options.eventAt
      : null;

  // Dedup por contrato: mantém a ocorrência mais recente.
  const latestByContract = new Map();
  for (const row of rows) {
    const at = row.canceledAt ? new Date(row.canceledAt) : null;
    if (at == null || Number.isNaN(at.getTime())) continue;
    const contractId =
      row.contractId == null ? `row-${latestByContract.size}` : Number(row.contractId);
    const prev = latestByContract.get(contractId);
    if (!prev || at.getTime() > prev._at.getTime()) {
      latestByContract.set(contractId, { ...row, _at: at });
    }
  }

  const totalsByCategory = emptyCategoryCounts();
  const byMonth = new Map();
  const timeline = [];
  let total = 0;
  let postEventRede = 0;
  let postEventTotal = 0;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  for (const row of latestByContract.values()) {
    const category = categorizeCancellationMotive(row.motive);
    total += 1;
    totalsByCategory[category] += 1;

    const mk = monthKey(row._at);
    let m = byMonth.get(mk);
    if (!m) {
      m = { key: mk, total: 0, ...emptyCategoryCounts() };
      byMonth.set(mk, m);
    }
    m.total += 1;
    m[category] += 1;

    timeline.push({
      canceledAt: row._at.toISOString(),
      category,
      city: String(row.city ?? '').trim() || null,
    });

    if (eventAt) {
      const t = row._at.getTime();
      if (t >= eventAt.getTime() && t <= eventAt.getTime() + windowMs) {
        postEventTotal += 1;
        if (category === 'rede') postEventRede += 1;
      }
    }
  }

  timeline.sort((a, b) => b.canceledAt.localeCompare(a.canceledAt));
  const monthly = [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key));

  return {
    total,
    totalsByCategory,
    monthly,
    timeline: timeline.slice(0, timelineLimit),
    postEvent: eventAt
      ? { at: eventAt.toISOString(), windowDays, redeCount: postEventRede, totalCount: postEventTotal }
      : null,
  };
}

function normalizeTitleKey(title) {
  return String(title ?? '').trim().toLowerCase();
}

/**
 * Ranking de splitters/condomínios em risco: onde houve massiva e, na janela de N dias após
 * cada evento, ocorreu churn de rede. Cada cancelamento é contado UMA vez por splitter, mesmo
 * que caia em janelas de eventos sobrepostas.
 *
 * @param {Array<{ splitterTitle: unknown, canceledAt: unknown, motive: unknown }>} cancelRows
 * @param {Array<{ splitterTitle: unknown, openedAt: unknown }>} events
 * @param {{ windowDays?: number, topLimit?: number }} [options]
 */
export function correlateMassivaChurn(cancelRows, events, options = {}) {
  const windowDays = options.windowDays ?? 30;
  const topLimit = options.topLimit ?? 50;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  // Janelas [início, fim] por splitter (título), a partir dos eventos de massiva.
  const windowsByTitle = new Map();
  const latestEventByTitle = new Map();
  for (const ev of events) {
    const title = String(ev.splitterTitle ?? '').trim();
    if (title === '') continue;
    const at = ev.openedAt ? new Date(ev.openedAt) : null;
    if (at == null || Number.isNaN(at.getTime())) continue;
    const key = normalizeTitleKey(title);
    const list = windowsByTitle.get(key) ?? [];
    list.push([at.getTime(), at.getTime() + windowMs]);
    windowsByTitle.set(key, list);
    const prev = latestEventByTitle.get(key);
    if (!prev || at.getTime() > prev.at.getTime()) {
      latestEventByTitle.set(key, { title, at });
    }
  }

  if (windowsByTitle.size === 0) return [];

  // Dedup de cancelamentos por contrato-equivalente não é necessário aqui (contamos ocorrências
  // dentro das janelas), mas evitamos contar o mesmo cancelamento 2x pelo par (título+data).
  const ranking = new Map();
  for (const row of cancelRows) {
    const title = String(row.splitterTitle ?? '').trim();
    if (title === '') continue;
    const key = normalizeTitleKey(title);
    const windows = windowsByTitle.get(key);
    if (!windows) continue;
    const at = row.canceledAt ? new Date(row.canceledAt) : null;
    if (at == null || Number.isNaN(at.getTime())) continue;
    const t = at.getTime();
    const inWindow = windows.some(([start, end]) => t >= start && t <= end);
    if (!inWindow) continue;

    let entry = ranking.get(key);
    if (!entry) {
      const meta = latestEventByTitle.get(key);
      const { tipoLocal, nomeCondominio } = classifyLocationFromTitle(meta?.title ?? title);
      entry = {
        splitterTitle: meta?.title ?? title,
        tipoLocal,
        nomeCondominio,
        eventAt: meta ? meta.at.toISOString() : null,
        eventsCount: windows.length,
        redeCount: 0,
        totalCount: 0,
      };
      ranking.set(key, entry);
    }
    entry.totalCount += 1;
    if (categorizeCancellationMotive(row.motive) === 'rede') entry.redeCount += 1;
  }

  return [...ranking.values()]
    .filter((e) => e.totalCount > 0)
    .sort((a, b) => (b.redeCount - a.redeCount) || (b.totalCount - a.totalCount))
    .slice(0, topLimit);
}

/**
 * Correlação churn × manutenção: conta cancelamentos "rede" numa janela após cada evento.
 *
 * @param {Array<{ canceledAt: Date, category: string, accessPoint: string }>} normalizedRows
 * @param {Array<{ accessPoint: string, at: Date }>} events
 * @param {number} windowDays
 */
export function countPostEventCancellations(normalizedRows, events, windowDays = 30) {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return events.map((ev) => {
    const start = ev.at.getTime();
    const end = start + windowMs;
    let redeCount = 0;
    let totalCount = 0;
    for (const r of normalizedRows) {
      if (r.accessPoint !== ev.accessPoint) continue;
      const t = r.canceledAt.getTime();
      if (t >= start && t <= end) {
        totalCount += 1;
        if (r.category === 'rede') redeCount += 1;
      }
    }
    return { accessPoint: ev.accessPoint, at: ev.at, windowDays, redeCount, totalCount };
  });
}
