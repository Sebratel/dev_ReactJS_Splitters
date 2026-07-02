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

function emptyCategoryCounts() {
  const out = {};
  for (const c of CANCELLATION_CATEGORIES) out[c] = 0;
  return out;
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
  let total = 0;

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
    if (splitterTitle) {
      const { slot, port } = parseOltSlotPortFromSplitterTitulo(splitterTitle);
      bump(bySplitter, splitterTitle, category, { slot, pon: port, accessPoint: ap || null });
    }

    const city = String(row.city ?? '').trim();
    bump(byCity, city || '(sem cidade)', category);

    bump(byMonth, monthKey(row._at), category);
  }

  const topByRede = (map) =>
    [...map.values()]
      .sort((a, b) => (b.rede - a.rede) || (b.total - a.total))
      .slice(0, topLimit);

  const monthly = [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key));

  return {
    total,
    totalsByCategory,
    byAccessPoint: topByRede(byAp),
    bySplitter: topByRede(bySplitter),
    byCity: topByRede(byCity),
    monthly,
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
