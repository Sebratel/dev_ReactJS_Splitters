import { useMemo } from 'react'
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import {
  fetchNetworkStats,
  NETWORK_STATS_QUERY_KEY,
  type NetworkStats,
} from '@/shared/api/fetchNetworkStats'
import { fetchSplittersFromLocalDb } from '@/features/splitters/api/fetchSplittersFromLocalDb'
import { fetchMassivaPeriodSplitterLinksFromLocalDb } from '@/features/massiva/api/fetchMassivaPeriodSplitterLinksFromLocalDb'
import { fetchMassivaDayShiftRecurrenceFromLocalDb } from '@/features/massiva/api/fetchMassivaDayShiftRecurrenceFromLocalDb'
import type { MassivaDayShiftRecurrenceCell } from '@/features/intelligence/lib/massivaDayShiftRecurrence'
import {
  countDistinctMassivasByLifecycleBucket,
  toLifecycleBucket,
  type LifecycleBucketKey,
  type MassivaPeriodSplitterLink,
} from '@/features/massiva/lib/lifecycleMassivaBuckets'
import {
  fetchMassivaPeriodRollupFromLocalDb,
  type IntelligenceMassivaPeriodRollup,
} from '@/features/splitters/api/fetchMassivaPeriodRollupFromLocalDb'
import { fetchSplitterIntelligenceBatchFromLocalDb } from '@/features/splitters/api/fetchSplitterIntelligenceBatchFromLocalDb'
import {
  fetchMaintenanceBySplitter,
  type MaintenanceBySplitterRow,
  type MaintenanceBySplitterTotals,
} from '@/features/intelligence/api/fetchMaintenanceBySplitter'
import {
  computeMassivaRecurrenceInsights,
  type MassivaRecurrenceInsights,
} from '@/features/intelligence/lib/massivaRecurrenceInsights'
import type { Splitter } from '@/features/splitters/model/splitter'
import type { SplitterMassivaStats } from '@/features/splitters/model/splitterOperationalInsights'
import type { SplitterTrend } from '@/features/splitters/model/splitterTrend'

export type IntelligenceDateRangePreset = '7d' | '30d' | '90d' | 'custom'

export type TrendLabel = 'Estavel' | 'Em crescimento' | 'Em queda' | 'Quase saturando'

export type IntelligenceTrendRow = {
  splitterCode: string
  splitterTitle: string
  /** Coordenadas do cadastro do splitter (BFF); null se ausentes ou inválidas. */
  latitude: number | null
  longitude: number | null
  label: TrendLabel
  currentUsagePercent: number
  delta7d: number
  delta30d: number
  capturedAt: Date | null
}

export type IntelligenceMassivaRow = {
  splitterCode: string
  totalTickets: number
  openTickets: number
  closedTickets: number
  affectedClientsTotal: number
  latestOpenedAt: Date | null
}

export type IntelligenceKpis = {
  totalEquipments: number
  occupiedPorts: number
  /** Soma de portas (capacidade) no catálogo — denominador da ocupação geral. */
  totalPortCapacity: number
  overallOccupancyPercent: number
  oltCount: number
}

export type IntelligenceAreaPoint = {
  at: Date
  usagePercent: number
}

export type IntelligenceBarPoint = {
  splitterCode: string
  /** Nome do equipamento (cadastro / tendência); útil para eixo e tooltip. */
  splitterTitle: string
  totalTickets: number
  affectedClientsTotal: number
}

export type IntelligenceRecurrenceCell = {
  weekday: string
  shift: string
  count: number
}

export type IntelligenceSaturationCell = {
  splitterCode: string
  splitterTitle: string
  latitude: number | null
  longitude: number | null
  usagePercent: number
  label: TrendLabel
  delta7d: number
  delta30d: number
  capturedAt: Date | null
  /** Índice 0–100: pressão operacional visual no mapa (uso + massivas + tendência). */
  attentionScore: number
  hasCorporateClients: boolean
  openTickets: number
  /** Massivas distintas ligadas ao splitter no período (efeito visual no halo). */
  totalTickets: number
  affectedClientsTotal: number
}

export type IntelligenceDecisionKpis = {
  totalSplittersInWindow: number
  criticalSplitters: number
  growthSplitters: number
  openMassivas: number
  affectedClientsTotal: number
  /** Σ tickets de massiva nos splitters em faixa de risco alto/crítico (mesma massiva pode aparecer em mais de um). */
  highRiskMassivaTickets: number
  attentionSharePercent: number
}

export type IntelligenceRiskRankingRow = {
  splitterCode: string
  splitterTitle: string
  oltCode: string | null
  oltDescription: string | null
  street: string | null
  tipoLocal: Splitter['tipoLocal']
  nomeCondominio: string | null
  /** Cidade no cadastro do splitter (regionalização para decisão). */
  cityCadastro: string | null
  /** Bairro no cadastro do splitter. */
  neighborhoodCadastro: string | null
  /** Pelo menos um cliente corporativo neste equipamento. */
  hasCorporateClients: boolean
  currentUsagePercent: number
  ageYears: number
  delta7d: number
  delta30d: number
  selectedDelta: number
  /** Dias até ~95% de ocupação se `selectedDelta` (pp / período de referência) for ritmo linear constante; `null` se não projetável. */
  etaTo95Days: number | null
  openTickets: number
  totalTickets: number
  affectedClientsTotal: number
  riskScore: number
  riskBand: 'critico' | 'alto' | 'moderado' | 'baixo'
}

export type IntelligenceImpactUrgencyCell = {
  key: 'altoImpactoAltaUrgencia' | 'altoImpactoBaixaUrgencia' | 'baixoImpactoAltaUrgencia' | 'baixoImpactoBaixaUrgencia'
  label: string
  count: number
  splitters: IntelligenceRiskRankingRow[]
}

export type IntelligenceOltDrilldownRow = {
  oltCode: string
  oltDescription: string
  splitters: number
  criticalSplitters: number
  avgUsagePercent: number
  avgDeltaReference: number
  openTickets: number
  totalTickets: number
  affectedClientsTotal: number
}

export type IntelligenceGeoDrilldown = {
  tipoLocal: Array<{ key: 'CONDOMÍNIO' | 'UNIDADE' | 'SEM_CLASSIFICACAO'; count: number }>
  topCondominios: Array<{ nome: string; splitters: number; massivaTickets: number }>
  topStreets: Array<{ nome: string; splitters: number; criticalSplitters: number }>
}

export type { LifecycleBucketKey } from '@/features/massiva/lib/lifecycleMassivaBuckets'

export type IntelligenceLifecycleKpis = {
  avgAgeYears: number
  agedSplitters: number
  agedCriticalSplitters: number
  agedPressurePercent: number
}

export type IntelligenceLifecycleBucketRow = {
  bucket: LifecycleBucketKey
  splitters: number
  avgUsagePercent: number
  avgDeltaReference: number
  /** Soma de vínculos massiva × splitter (pode repetir a mesma massiva). */
  massivaLinkages: number
  /** Massivas distintas com ao menos um splitter da faixa no período. */
  distinctMassivas: number
}

export type IntelligenceLifecycleHeatmapCell = {
  bucket: LifecycleBucketKey
  usageBand: '<70' | '70-94' | '95+'
  count: number
}

export type IntelligenceLifecycleReplacementRow = {
  splitterCode: string
  splitterTitle: string
  ageYears: number
  lifecycleRiskScore: number
  etaTo95Days: number | null
  currentUsagePercent: number
  selectedDelta: number
  affectedClientsTotal: number
}

export type IntelligenceLifecycleCohortRow = {
  cohortYear: number
  splitters: number
  avgUsagePercent: number
  incidentsPerYear: number
}

export type IntelligenceLifecycleAlertRow = {
  splitterCode: string
  splitterTitle: string
  reason: string
}

export type IntelligenceMaintenanceBySplitterRow = MaintenanceBySplitterRow

export type IntelligenceMaintenanceBySplitterTotals = MaintenanceBySplitterTotals

export type IntelligenceDataset = {
  trends: IntelligenceTrendRow[]
  massivaStats: IntelligenceMassivaRow[]
  kpis: IntelligenceKpis
  splittersMeta: Splitter[]
  source: 'live' | 'mock'
  massivaRollup: IntelligenceMassivaPeriodRollup
  massivaPeriodLinks: MassivaPeriodSplitterLink[]
  massivaDayShiftRecurrence: MassivaDayShiftRecurrenceCell[]
}

const EMPTY_MASSIVA_ROLLUP: IntelligenceMassivaPeriodRollup = {
  distinctMassivaCount: 0,
  affectedClientsDistinctSum: 0,
  openMassivasCount: 0,
  closedMassivasCount: 0,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Combina ocupação, incidentes e ritmo de crescimento para codificar tamanho/intensidade no mapa. */
function computeMapAttentionScore(
  usagePercent: number,
  openTickets: number,
  totalMassivaTickets: number,
  delta7d: number,
  delta30d: number,
): number {
  const growthSignal = Math.max(0, delta7d, delta30d * 0.35)
  const massivaSignal = clamp(
    openTickets * 14 + Math.log10(totalMassivaTickets + 1) * 16,
    0,
    46,
  )
  const usageSignal = usagePercent * 0.52
  const growthContribution = clamp(growthSignal * 3.4, 0, 28)
  return Number(clamp(usageSignal + massivaSignal + growthContribution, 0, 100).toFixed(1))
}

function diffDays(a: Date, b: Date): number {
  const ms = Math.max(0, b.getTime() - a.getTime())
  return ms / (24 * 60 * 60 * 1000)
}

function asTrendLabel(label: string): TrendLabel {
  if (label === 'Quase saturando') return label
  if (label === 'Em crescimento') return label
  if (label === 'Em queda') return label
  return 'Estavel'
}

function parseSplitterCoord(raw: string): number | null {
  const s = String(raw ?? '').trim().replace(',', '.')
  if (s === '') return null
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return null
  return n
}

/** Páginas maiores reduzem roundtrips na carga inicial do painel. */
const INTELLIGENCE_SPLITTER_PAGE_SIZE = 1600
/** Lote de códigos por request (URL `codes=` — não ultrapassar ~8k chars no servidor). */
const INTELLIGENCE_CODE_QUERY_CHUNK = 400
const INTELLIGENCE_MAX_SPLITTER_PAGES = 500
/** Requisições simultâneas ao BFF (lotes combinados trends+massiva por worker). */
const INTELLIGENCE_HTTP_CONCURRENCY = 18
const INTELLIGENCE_SPLITTER_PAGE_CONCURRENCY = 12

function chunkBy<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return [items.slice() as T[]]
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size) as T[])
  }
  return out
}

async function mergeInsightsFromConcurrentChunks(
  chunks: string[][],
  concurrency: number,
  massivaOpenedRange?: { start: Date; end: Date },
): Promise<{ trends: Map<string, SplitterTrend>; massiva: Map<string, SplitterMassivaStats> }> {
  const trends = new Map<string, SplitterTrend>()
  const massiva = new Map<string, SplitterMassivaStats>()
  const queue = chunks.filter((c) => c.length > 0)

  async function worker() {
    for (;;) {
      const chunk = queue.shift()
      if (!chunk) break
      const part = await fetchSplitterIntelligenceBatchFromLocalDb(chunk, massivaOpenedRange)
      for (const [k, v] of part.trends) trends.set(k, v)
      for (const [k, v] of part.massiva) massiva.set(k, v)
    }
  }

  const workers = Math.max(1, Math.min(concurrency, queue.length))
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return { trends, massiva }
}

async function fetchSplitterInsightsBatched(
  splitterCodes: readonly string[],
  massivaOpenedRange?: { start: Date; end: Date },
): Promise<{
  trends: Map<string, SplitterTrend>
  massiva: Map<string, SplitterMassivaStats>
}> {
  const chunks = chunkBy(splitterCodes, INTELLIGENCE_CODE_QUERY_CHUNK)
  return mergeInsightsFromConcurrentChunks(chunks, INTELLIGENCE_HTTP_CONCURRENCY, massivaOpenedRange)
}

async function fetchAllSplittersCatalogForIntelligence(): Promise<{
  items: Splitter[]
  totalCount: number
}> {
  const pageSize = INTELLIGENCE_SPLITTER_PAGE_SIZE
  const first = await fetchSplittersFromLocalDb({ page: 1, limit: pageSize })
  const reportedTotal = Number(first.totalCount ?? 0)

  if (first.items.length === 0) {
    return { items: [], totalCount: reportedTotal }
  }

  if (first.items.length < pageSize) {
    return { items: [...first.items], totalCount: Math.max(reportedTotal, first.items.length) }
  }

  if (reportedTotal > first.items.length) {
    const totalPages = Math.min(
      INTELLIGENCE_MAX_SPLITTER_PAGES,
      Math.max(1, Math.ceil(reportedTotal / pageSize)),
    )
    const rest: Splitter[] = []
    const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)

    for (let i = 0; i < pageNums.length; i += INTELLIGENCE_SPLITTER_PAGE_CONCURRENCY) {
      const batch = pageNums.slice(i, i + INTELLIGENCE_SPLITTER_PAGE_CONCURRENCY)
      const pages = await Promise.all(
        batch.map((page) => fetchSplittersFromLocalDb({ page, limit: pageSize })),
      )
      for (const p of pages) rest.push(...p.items)
    }

    const items = [...first.items, ...rest]
    return { items, totalCount: Math.max(reportedTotal, items.length) }
  }

  const items: Splitter[] = [...first.items]
  let page = 2
  while (page <= INTELLIGENCE_MAX_SPLITTER_PAGES) {
    const next = await fetchSplittersFromLocalDb({ page, limit: pageSize })
    if (next.items.length === 0) break
    items.push(...next.items)
    page += 1
    if (next.items.length < pageSize) break
  }

  return {
    items,
    totalCount: Math.max(reportedTotal, items.length),
  }
}

function normalizeSplitterLatLng(
  latRaw: string,
  lngRaw: string,
): { latitude: number | null; longitude: number | null } {
  const latitude = parseSplitterCoord(latRaw)
  const longitude = parseSplitterCoord(lngRaw)
  if (
    latitude === null ||
    longitude === null ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return { latitude: null, longitude: null }
  }
  return { latitude, longitude }
}

/** Limite de marcadores no mapa de saturação (evita sobrecarga do Leaflet). */
const MAP_SATURATION_POINT_LIMIT = 80

export type StratifiedSaturationMapOptions = {
  /** Dentro de cada faixa de uso, estes códigos aparecem antes (ex.: corporativo no mapa). */
  preferCorporateCodes?: ReadonlySet<string> | null
}

/**
 * Monta a lista do mapa: em rodízio entre crítico (≥95%), atenção (70–94%) e folga (&lt;70%),
 * para não mostrar só os de maior uso (que tendem a ser todos críticos). Completa até o limite
 * pelos maiores usos entre os que faltaram.
 */
export function stratifiedSaturationTrendsForMap(
  trends: IntelligenceTrendRow[],
  limit: number,
  options?: StratifiedSaturationMapOptions,
): IntelligenceTrendRow[] {
  if (trends.length === 0) return []

  const prefer = options?.preferCorporateCodes ?? null

  const sortBand = (a: IntelligenceTrendRow, b: IntelligenceTrendRow): number => {
    if (prefer && prefer.size > 0) {
      const ap = prefer.has(a.splitterCode) ? 1 : 0
      const bp = prefer.has(b.splitterCode) ? 1 : 0
      if (ap !== bp) return bp - ap
    }
    return b.currentUsagePercent - a.currentUsagePercent
  }

  const crit = trends.filter((t) => t.currentUsagePercent >= 95).sort(sortBand)
  const alert = trends
    .filter((t) => t.currentUsagePercent >= 70 && t.currentUsagePercent < 95)
    .sort(sortBand)
  const ok = trends.filter((t) => t.currentUsagePercent < 70).sort(sortBand)

  const bands: IntelligenceTrendRow[][] = [crit, alert, ok]
  const idx = [0, 0, 0]
  const out: IntelligenceTrendRow[] = []
  const seen = new Set<string>()

  while (out.length < limit) {
    let progress = false
    for (let b = 0; b < 3; b++) {
      if (out.length >= limit) break
      while (idx[b] < bands[b].length) {
        const row = bands[b][idx[b]++]
        if (!row || seen.has(row.splitterCode)) continue
        seen.add(row.splitterCode)
        out.push(row)
        progress = true
        break
      }
    }
    if (!progress) break
  }

  if (out.length < limit) {
    const rest = [...trends].sort(sortBand).filter((t) => !seen.has(t.splitterCode))
    for (const row of rest) {
      if (out.length >= limit) break
      seen.add(row.splitterCode)
      out.push(row)
    }
  }

  return out
}

function makeMockDataset(): IntelligenceDataset {
  const trends: IntelligenceTrendRow[] = []
  const massivaStats: IntelligenceMassivaRow[] = []
  const splittersMeta: Splitter[] = []
  const now = new Date()

  for (let i = 1; i <= 40; i++) {
    const splitterCode = `SPL-${String(i).padStart(4, '0')}`
    const swing = Math.sin(i / 4) * 12
    const baseline = 52 + swing + (i % 7)
    const currentUsagePercent = clamp(Number(baseline.toFixed(2)), 20, 99)
    const delta7d = Number((Math.cos(i / 3) * 4).toFixed(2))
    const delta30d = Number((Math.sin(i / 5) * 7).toFixed(2))
    const label: TrendLabel =
      currentUsagePercent >= 85 && delta30d >= 5
        ? 'Quase saturando'
        : delta30d >= 5 || delta7d >= 3
          ? 'Em crescimento'
          : delta30d <= -5 || delta7d <= -3
            ? 'Em queda'
            : 'Estavel'

    const capturedAt = new Date(now)
    capturedAt.setDate(now.getDate() - (i % 15))
    capturedAt.setHours(8 + (i % 12), 10, 0, 0)

    const angle = i * 0.55
    const radius = 0.012 * Math.sqrt(i)
    const { latitude, longitude } = normalizeSplitterLatLng(
      String(-19.9167 + radius * Math.cos(angle)),
      String(-43.9345 + radius * Math.sin(angle)),
    )

    trends.push({
      splitterCode,
      splitterTitle: `Splitter mock · ${splitterCode}`,
      latitude,
      longitude,
      label,
      currentUsagePercent,
      delta7d,
      delta30d,
      capturedAt,
    })

    const latestOpenedAt = new Date(now)
    latestOpenedAt.setDate(now.getDate() - (i % 20))
    latestOpenedAt.setHours((i * 3) % 24, 5, 0, 0)

    const totalTickets = 3 + (i % 12)
    massivaStats.push({
      splitterCode,
      totalTickets,
      openTickets: i % 4 === 0 ? 1 : 0,
      closedTickets: totalTickets - (i % 4 === 0 ? 1 : 0),
      affectedClientsTotal: 0,
      latestOpenedAt,
    })

    splittersMeta.push({
      id: i,
      code: splitterCode,
      integrationCode: splitterCode,
      title: `Splitter mock · ${splitterCode}`,
      outPorts: 16,
      active: true,
      typeText: 'Distribuição',
      description: 'Mock',
      latitude: latitude == null ? '' : String(latitude),
      longitude: longitude == null ? '' : String(longitude),
      street: i % 2 === 0 ? `Rua ${i}` : null,
      networkBoxCode: null,
      networkBoxTitle: null,
      networkBoxType: null,
      oltCode: `OLT-${(i % 6) + 1}`,
      oltIntegrationCode: `OLT-${(i % 6) + 1}`,
      oltDescription: `OLT ${(i % 6) + 1}`,
      createdAt: new Date(now.getTime() - ((i % 12) + 1) * 365 * 24 * 60 * 60 * 1000),
      busyCount: Math.round((currentUsagePercent / 100) * 16),
      tipoLocal: i % 3 === 0 ? 'CONDOMÍNIO' : 'UNIDADE',
      nomeCondominio: i % 3 === 0 ? `Condomínio ${Math.ceil(i / 3)}` : null,
      cityCadastro: ['Belo Horizonte', 'Contagem', 'Nova Lima', 'Betim'][i % 4],
      neighborhoodCadastro:
        i % 5 === 0 ? null : [`Centro`, `Savassi`, `Funcionários`, `Barreiro`, `Pampulha`][i % 5],
      hasCorporateClients: i % 7 === 0,
    })
  }

  const totalPortCapacity = 17342 * 16
  const occupiedPorts = Math.round(totalPortCapacity * 0.569)
  const kpis: IntelligenceKpis = {
    totalEquipments: 17342,
    occupiedPorts,
    totalPortCapacity,
    overallOccupancyPercent:
      totalPortCapacity > 0
        ? Number(((occupiedPorts / totalPortCapacity) * 100).toFixed(2))
        : 0,
    oltCount: 214,
  }

  return {
    trends,
    massivaStats,
    splittersMeta,
    kpis,
    source: 'mock',
    massivaRollup: {
      distinctMassivaCount: 186,
      affectedClientsDistinctSum: 42150,
      openMassivasCount: 14,
      closedMassivasCount: 172,
    },
    massivaPeriodLinks: [],
    massivaDayShiftRecurrence: [],
  }
}

const NETWORK_STATS_STALE_MS = 3 * 60_000
const SPLITTERS_CATALOG_QUERY_KEY = ['network-intelligence', 'splitters-catalog'] as const
const SPLITTERS_CATALOG_STALE_MS = 30 * 60_000

const EMPTY_NETWORK_STATS: NetworkStats = {
  activeSplitters: 0,
  onlineClients: 0,
  totalPortCapacity: 0,
  oltCount: 0,
  equipmentOccupancy: { green: 0, yellow: 0, red: 0 },
  trends: null,
}

async function fetchLiveDataset(
  queryClient: QueryClient,
  splitters: { items: Splitter[]; totalCount: number },
  /** Quando já obtido em paralelo ao catálogo no `queryFn` do dataset. */
  prefetchedNetworkStats?: NetworkStats,
  massivaOpenedRange?: { start: Date; end: Date },
): Promise<IntelligenceDataset> {
  const codes = splitters.items.map((item) => item.code).filter((value) => value.trim() !== '')

  const statsPromise: Promise<NetworkStats | undefined> = prefetchedNetworkStats
    ? Promise.resolve(prefetchedNetworkStats)
    : queryClient.fetchQuery({
        queryKey: NETWORK_STATS_QUERY_KEY,
        queryFn: fetchNetworkStats,
        staleTime: NETWORK_STATS_STALE_MS,
      })

  const insightsPromise =
    codes.length === 0
      ? Promise.resolve({
          trends: new Map<string, SplitterTrend>(),
          massiva: new Map<string, SplitterMassivaStats>(),
        })
      : fetchSplitterInsightsBatched(codes, massivaOpenedRange)

  const rollupPromise = fetchMassivaPeriodRollupFromLocalDb([], massivaOpenedRange, {
    scope: 'all_linked',
  }).catch((error) => {
    console.warn('[network-intelligence] Falha ao agregar massivas do período:', error)
    return EMPTY_MASSIVA_ROLLUP
  })

  const linksPromise = fetchMassivaPeriodSplitterLinksFromLocalDb(massivaOpenedRange).catch(
    (error) => {
      console.warn('[network-intelligence] Falha ao listar vínculos de massivas do período:', error)
      return [] as MassivaPeriodSplitterLink[]
    },
  )

  const recurrencePromise = fetchMassivaDayShiftRecurrenceFromLocalDb(massivaOpenedRange).catch(
    (error) => {
      console.warn('[network-intelligence] Falha na recorrência dia×turno:', error)
      return [] as MassivaDayShiftRecurrenceCell[]
    },
  )

  const [
    networkStatsRaw,
    { trends: trendsByCode, massiva: statsByCode },
    massivaRollup,
    massivaPeriodLinks,
    massivaDayShiftRecurrence,
  ] = await Promise.all([
    statsPromise,
    insightsPromise,
    rollupPromise,
    linksPromise,
    recurrencePromise,
  ])

  const networkStats: NetworkStats = networkStatsRaw ?? EMPTY_NETWORK_STATS

  const titleByCode = new Map(
    splitters.items.map((item) => [item.code, String(item.title ?? '').trim()]),
  )
  const geoByCode = new Map(
    splitters.items.map((item) => {
      const { latitude, longitude } = normalizeSplitterLatLng(item.latitude, item.longitude)
      return [item.code, { latitude, longitude }] as const
    }),
  )

  const trends: IntelligenceTrendRow[] = codes.map((code) => {
    const row = trendsByCode.get(code)
    const geo = geoByCode.get(code)
    return {
      splitterCode: code,
      splitterTitle: titleByCode.get(code) ?? '',
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      label: asTrendLabel(row?.label ?? 'Estavel'),
      currentUsagePercent: Number(row?.currentUsagePercent ?? 0),
      delta7d: Number(row?.delta7d ?? 0),
      delta30d: Number(row?.delta30d ?? 0),
      capturedAt: row?.capturedAt ?? null,
    }
  })

  const massivaStats: IntelligenceMassivaRow[] = codes.map((code) => {
    const row = statsByCode.get(code)
    return {
      splitterCode: code,
      totalTickets: Number(row?.totalTickets ?? 0),
      openTickets: Number(row?.openTickets ?? 0),
      closedTickets: Number(row?.closedTickets ?? 0),
      affectedClientsTotal: Number(row?.affectedClientsTotal ?? 0),
      latestOpenedAt: row?.latestOpenedAt ?? null,
    }
  })

  const totalEquipments = networkStats.activeSplitters
  const occupiedPorts = networkStats.onlineClients
  const totalPortCapacity = networkStats.totalPortCapacity
  const overallOccupancyPercent =
    totalPortCapacity > 0
      ? Number(((occupiedPorts / totalPortCapacity) * 100).toFixed(2))
      : 0

  return {
    trends,
    massivaStats,
    kpis: {
      totalEquipments,
      occupiedPorts,
      totalPortCapacity,
      overallOccupancyPercent,
      oltCount: networkStats.oltCount,
    },
    splittersMeta: splitters.items,
    source: 'live',
    massivaRollup,
    massivaPeriodLinks,
    massivaDayShiftRecurrence,
  }
}

async function fetchIntelligenceDataset(
  queryClient: QueryClient,
  splitters: { items: Splitter[]; totalCount: number },
  prefetchedNetworkStats?: NetworkStats,
  massivaOpenedRange?: { start: Date; end: Date },
): Promise<IntelligenceDataset> {
  try {
    return await fetchLiveDataset(queryClient, splitters, prefetchedNetworkStats, massivaOpenedRange)
  } catch {
    return makeMockDataset()
  }
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function buildDateWindow(
  preset: IntelligenceDateRangePreset,
  customStart: Date | null,
  customEnd: Date | null,
): { start: Date; end: Date } {
  const now = new Date()
  const end = endOfDay(now)

  if (preset === 'custom' && customStart && customEnd) {
    return {
      start: startOfDay(customStart),
      end: endOfDay(customEnd),
    }
  }

  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
  const start = startOfDay(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000))
  return { start, end }
}

type DeltaReference = '7d' | '30d'

function resolveDeltaReference(
  preset: IntelligenceDateRangePreset,
  window: { start: Date; end: Date },
): DeltaReference {
  if (preset === '7d') return '7d'
  if (preset === '30d' || preset === '90d') return '30d'
  const ms = Math.max(0, window.end.getTime() - window.start.getTime())
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000))
  return days <= 14 ? '7d' : '30d'
}

export function useNetworkIntelligenceData(
  preset: IntelligenceDateRangePreset,
  customStart: Date | null,
  customEnd: Date | null,
  /** Mapa: só splitters com cliente corporativo (cadastro). */
  mapCorporateOnly = false,
) {
  const queryClient = useQueryClient()

  const statsQuery = useQuery({
    queryKey: NETWORK_STATS_QUERY_KEY,
    queryFn: fetchNetworkStats,
    staleTime: NETWORK_STATS_STALE_MS,
    refetchInterval: false,
  })

  const splittersCatalogQuery = useQuery({
    queryKey: SPLITTERS_CATALOG_QUERY_KEY,
    queryFn: fetchAllSplittersCatalogForIntelligence,
    staleTime: SPLITTERS_CATALOG_STALE_MS,
    gcTime: 2 * 60 * 60_000,
    refetchInterval: false,
  })

  const window = useMemo(
    () => buildDateWindow(preset, customStart, customEnd),
    [preset, customStart, customEnd],
  )

  const query = useQuery({
    queryKey: [
      'network-intelligence',
      'dataset',
      preset,
      customStart?.toISOString() ?? null,
      customEnd?.toISOString() ?? null,
    ],
    queryFn: async () => {
      const catalogPromise =
        splittersCatalogQuery.data !== undefined
          ? Promise.resolve(splittersCatalogQuery.data)
          : queryClient.fetchQuery({
              queryKey: SPLITTERS_CATALOG_QUERY_KEY,
              queryFn: fetchAllSplittersCatalogForIntelligence,
              staleTime: SPLITTERS_CATALOG_STALE_MS,
            })

      const statsPromise = queryClient.fetchQuery({
        queryKey: NETWORK_STATS_QUERY_KEY,
        queryFn: fetchNetworkStats,
        staleTime: NETWORK_STATS_STALE_MS,
      })

      const [splitters, networkStats] = await Promise.all([catalogPromise, statsPromise])
      const massivaOpenedRange = buildDateWindow(preset, customStart, customEnd)

      return fetchIntelligenceDataset(queryClient, splitters, networkStats, massivaOpenedRange)
    },
    placeholderData: keepPreviousData,
    /** Dataset é pesado; cache longo. Sem polling automático (evita reexecutar centenas de requests). */
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    refetchInterval: false,
  })

  const maintenanceQuery = useQuery({
    queryKey: [
      'network-intelligence',
      'maintenance-by-splitter',
      window.start.toISOString(),
      window.end.toISOString(),
    ],
    queryFn: () => fetchMaintenanceBySplitter(window.start, window.end),
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    refetchInterval: false,
    placeholderData: keepPreviousData,
    /** Evita disputar o BFF com centenas de GET de trends/massivas na primeira carga. */
    enabled: query.data !== undefined,
  })

  const filtered = useMemo(() => {
    const data = query.data
    if (!data) return null

    const trends = data.trends.filter((row) => {
      if (!row.capturedAt) return false
      return row.capturedAt >= window.start && row.capturedAt <= window.end
    })

    const massivaStats = data.massivaStats.filter((row) => {
      if (!row.latestOpenedAt) return false
      return row.latestOpenedAt >= window.start && row.latestOpenedAt <= window.end
    })

    return { ...data, trends, massivaStats }
  }, [query.data, window.end, window.start])

  const splittersMetaByCode = useMemo(() => {
    const out = new Map<string, Splitter>()
    if (!filtered) return out
    for (const splitter of filtered.splittersMeta) {
      if (splitter.code.trim() !== '') out.set(splitter.code, splitter)
    }
    return out
  }, [filtered])

  const deltaReference = useMemo(() => resolveDeltaReference(preset, window), [preset, window])
  const deltaReferenceLabel = deltaReference === '7d' ? 'Δ7d' : 'Δ30d'

  const areaPoints = useMemo<IntelligenceAreaPoint[]>(() => {
    if (!filtered || filtered.trends.length === 0) return []
    const points: { at: Date; usagePercent: number }[] = []

    for (const row of filtered.trends) {
      if (!row.capturedAt) continue
      const atNow = row.capturedAt
      const at7d = new Date(atNow)
      at7d.setDate(at7d.getDate() - 7)
      const at30d = new Date(atNow)
      at30d.setDate(at30d.getDate() - 30)

      points.push(
        { at: at30d, usagePercent: row.currentUsagePercent - row.delta30d },
        { at: at7d, usagePercent: row.currentUsagePercent - row.delta7d },
        { at: atNow, usagePercent: row.currentUsagePercent },
      )
    }

    const bucket = new Map<string, { at: Date; sum: number; count: number }>()
    for (const point of points) {
      const key = point.at.toISOString().slice(0, 10)
      const current = bucket.get(key) ?? { at: startOfDay(point.at), sum: 0, count: 0 }
      current.sum += point.usagePercent
      current.count += 1
      bucket.set(key, current)
    }

    return [...bucket.values()]
      .map((entry) => ({
        at: entry.at,
        usagePercent: Number((entry.sum / Math.max(1, entry.count)).toFixed(2)),
      }))
      .sort((a, b) => a.at.getTime() - b.at.getTime())
  }, [filtered])

  const barPoints = useMemo<IntelligenceBarPoint[]>(() => {
    if (!filtered) return []
    const titleByTrend = new Map(
      filtered.trends.map((t) => [t.splitterCode, t.splitterTitle.trim()] as const),
    )
    return [...filtered.massivaStats]
      .sort((a, b) => b.totalTickets - a.totalTickets)
      .slice(0, 10)
      .map((row) => {
        const meta = splittersMetaByCode.get(row.splitterCode)
        const fromMeta = (meta?.title ?? '').trim()
        const fromTrend = titleByTrend.get(row.splitterCode) ?? ''
        const splitterTitle =
          fromMeta !== '' ? fromMeta : fromTrend !== '' ? fromTrend : row.splitterCode
        return {
          splitterCode: row.splitterCode,
          splitterTitle,
          totalTickets: row.totalTickets,
          affectedClientsTotal: row.affectedClientsTotal,
        }
      })
  }, [filtered, splittersMetaByCode])

  const recurrenceCells = useMemo<IntelligenceRecurrenceCell[]>(() => {
    if (!filtered) return []
    return filtered.massivaDayShiftRecurrence.map((cell) => ({
      weekday: cell.weekday,
      shift: cell.shift,
      count: cell.count,
    }))
  }, [filtered])

  const corporateSplitterCodes = useMemo(() => {
    const set = new Set<string>()
    if (!filtered) return set
    for (const s of filtered.splittersMeta) {
      if (s.code.trim() !== '' && s.hasCorporateClients === true) set.add(s.code)
    }
    return set
  }, [filtered])

  const saturationCells = useMemo<IntelligenceSaturationCell[]>(() => {
    if (!filtered) return []
    const massivaByCode = new Map(filtered.massivaStats.map((r) => [r.splitterCode, r]))

    const trendsForMap = mapCorporateOnly
      ? filtered.trends.filter((t) => corporateSplitterCodes.has(t.splitterCode))
      : filtered.trends

    /** Sem «só corporativo»: só estratificação por uso; ordenação por PJ antes ocupava quase todos os 80 pontos. */
    const stratified = stratifiedSaturationTrendsForMap(trendsForMap, MAP_SATURATION_POINT_LIMIT)

    return stratified.map((row) => {
      const massiva = massivaByCode.get(row.splitterCode)
      const meta = splittersMetaByCode.get(row.splitterCode)
      const openTickets = massiva?.openTickets ?? 0
      const totalMassivaTickets = massiva?.totalTickets ?? 0
      const affectedClientsTotal = massiva?.affectedClientsTotal ?? 0
      const hasCorporateClients = meta?.hasCorporateClients === true
      const attentionScore = computeMapAttentionScore(
        row.currentUsagePercent,
        openTickets,
        totalMassivaTickets,
        row.delta7d,
        row.delta30d,
      )
      return {
        splitterCode: row.splitterCode,
        splitterTitle: row.splitterTitle,
        latitude: row.latitude,
        longitude: row.longitude,
        usagePercent: row.currentUsagePercent,
        label: row.label,
        delta7d: row.delta7d,
        delta30d: row.delta30d,
        capturedAt: row.capturedAt,
        attentionScore,
        hasCorporateClients,
        openTickets,
        totalTickets: massiva?.totalTickets ?? 0,
        affectedClientsTotal,
      }
    })
  }, [filtered, splittersMetaByCode, mapCorporateOnly, corporateSplitterCodes])

  const riskRanking = useMemo<IntelligenceRiskRankingRow[]>(() => {
    if (!filtered) return []
    const massivaByCode = new Map(filtered.massivaStats.map((row) => [row.splitterCode, row]))
    return filtered.trends
      .map((trend) => {
        const massiva = massivaByCode.get(trend.splitterCode)
        const meta = splittersMetaByCode.get(trend.splitterCode)
        const ageYears =
          meta?.createdAt != null
            ? Number((diffDays(meta.createdAt, new Date()) / 365.25).toFixed(2))
            : 0
        const selectedDelta = deltaReference === '7d' ? trend.delta7d : trend.delta30d
        const referenceDays = deltaReference === '7d' ? 7 : 30
        const dailyDeltaPP =
          referenceDays > 0 ? selectedDelta / referenceDays : 0
        let etaTo95Days: number | null = null
        if (trend.currentUsagePercent < 95 && dailyDeltaPP > 0) {
          const rawDays = (95 - trend.currentUsagePercent) / dailyDeltaPP
          if (Number.isFinite(rawDays) && rawDays > 0) {
            etaTo95Days = Math.max(1, Math.ceil(rawDays))
          }
        }
        const usageScore = clamp(trend.currentUsagePercent, 0, 100)
        const growthScore = clamp(selectedDelta * 4, -20, 40)
        const openMassivaScore = clamp((massiva?.openTickets ?? 0) * 8, 0, 24)
        const affectedScore = clamp(Math.log10((massiva?.totalTickets ?? 0) + 1) * 12, 0, 36)
        const score = clamp(usageScore + growthScore + openMassivaScore + affectedScore, 0, 200)
        const riskBand: IntelligenceRiskRankingRow['riskBand'] =
          score >= 120 ? 'critico' : score >= 90 ? 'alto' : score >= 60 ? 'moderado' : 'baixo'
        return {
          splitterCode: trend.splitterCode,
          splitterTitle: trend.splitterTitle,
          oltCode: meta?.oltCode ?? null,
          oltDescription: meta?.oltDescription ?? null,
          street: meta?.street ?? null,
          tipoLocal: meta?.tipoLocal,
          nomeCondominio: meta?.nomeCondominio ?? null,
          cityCadastro: meta?.cityCadastro?.trim() ? meta.cityCadastro.trim() : null,
          neighborhoodCadastro: meta?.neighborhoodCadastro?.trim()
            ? meta.neighborhoodCadastro.trim()
            : null,
          hasCorporateClients: meta?.hasCorporateClients === true,
          currentUsagePercent: trend.currentUsagePercent,
          ageYears,
          delta7d: trend.delta7d,
          delta30d: trend.delta30d,
          selectedDelta,
          etaTo95Days,
          openTickets: massiva?.openTickets ?? 0,
          totalTickets: massiva?.totalTickets ?? 0,
          affectedClientsTotal: massiva?.affectedClientsTotal ?? 0,
          riskScore: Number(score.toFixed(2)),
          riskBand,
        }
      })
      .sort((a, b) => b.riskScore - a.riskScore)
  }, [filtered, splittersMetaByCode, deltaReference])

  const massivaRecurrenceInsights = useMemo<MassivaRecurrenceInsights>(
    () => computeMassivaRecurrenceInsights(riskRanking),
    [riskRanking],
  )

  const decisionKpis = useMemo<IntelligenceDecisionKpis>(() => {
    const totalSplittersInWindow = riskRanking.length
    const criticalSplitters = riskRanking.filter((row) => row.currentUsagePercent >= 95).length
    const growthSplitters = riskRanking.filter((row) => row.selectedDelta >= 5).length
    const rollup = filtered?.massivaRollup ?? EMPTY_MASSIVA_ROLLUP
    const openMassivas = rollup.openMassivasCount
    const affectedClientsTotal = rollup.affectedClientsDistinctSum
    const highRiskMassivaTickets = riskRanking
      .filter((row) => row.riskBand === 'critico' || row.riskBand === 'alto')
      .reduce((sum, row) => sum + row.totalTickets, 0)
    const attentionSharePercent =
      totalSplittersInWindow > 0
        ? Number((((criticalSplitters + growthSplitters) / totalSplittersInWindow) * 100).toFixed(1))
        : 0

    return {
      totalSplittersInWindow,
      criticalSplitters,
      growthSplitters,
      openMassivas,
      affectedClientsTotal,
      highRiskMassivaTickets,
      attentionSharePercent,
    }
  }, [riskRanking, filtered])

  const impactUrgencyMatrix = useMemo<IntelligenceImpactUrgencyCell[]>(() => {
    const quadrants: IntelligenceImpactUrgencyCell[] = [
      { key: 'altoImpactoAltaUrgencia', label: 'Alto impacto · Alta urgência', count: 0, splitters: [] },
      { key: 'altoImpactoBaixaUrgencia', label: 'Alto impacto · Baixa urgência', count: 0, splitters: [] },
      { key: 'baixoImpactoAltaUrgencia', label: 'Baixo impacto · Alta urgência', count: 0, splitters: [] },
      { key: 'baixoImpactoBaixaUrgencia', label: 'Baixo impacto · Baixa urgência', count: 0, splitters: [] },
    ]
    const index = new Map(quadrants.map((q) => [q.key, q]))
    for (const row of riskRanking) {
      const highImpact = row.totalTickets >= 4 || row.openTickets > 0
      const highUrgency = row.currentUsagePercent >= 85 || row.selectedDelta >= 5 || row.openTickets > 0
      const key: IntelligenceImpactUrgencyCell['key'] = highImpact
        ? highUrgency
          ? 'altoImpactoAltaUrgencia'
          : 'altoImpactoBaixaUrgencia'
        : highUrgency
          ? 'baixoImpactoAltaUrgencia'
          : 'baixoImpactoBaixaUrgencia'
      const bucket = index.get(key)
      if (!bucket) continue
      bucket.count += 1
      if (bucket.splitters.length < 6) bucket.splitters.push(row)
    }
    return quadrants
  }, [riskRanking])

  const oltDrilldown = useMemo<IntelligenceOltDrilldownRow[]>(() => {
    const grouped = new Map<string, {
      oltCode: string
      oltDescription: string
      splitters: number
      criticalSplitters: number
      sumUsage: number
      sumDeltaReference: number
      openTickets: number
      totalTickets: number
      affectedClientsTotal: number
    }>()
    for (const row of riskRanking) {
      const key = row.oltCode?.trim() || row.oltDescription?.trim() || 'SEM_OLT'
      const current = grouped.get(key) ?? {
        oltCode: row.oltCode?.trim() || 'SEM_OLT',
        oltDescription: row.oltDescription?.trim() || 'OLT não informada',
        splitters: 0,
        criticalSplitters: 0,
        sumUsage: 0,
        sumDeltaReference: 0,
        openTickets: 0,
        totalTickets: 0,
        affectedClientsTotal: 0,
      }
      current.splitters += 1
      if (row.currentUsagePercent >= 95) current.criticalSplitters += 1
      current.sumUsage += row.currentUsagePercent
      current.sumDeltaReference += row.selectedDelta
      current.openTickets += row.openTickets
      current.totalTickets += row.totalTickets
      current.affectedClientsTotal += row.affectedClientsTotal
      grouped.set(key, current)
    }

    return [...grouped.values()]
      .map((entry) => ({
        oltCode: entry.oltCode,
        oltDescription: entry.oltDescription,
        splitters: entry.splitters,
        criticalSplitters: entry.criticalSplitters,
        avgUsagePercent: Number((entry.sumUsage / Math.max(1, entry.splitters)).toFixed(1)),
        avgDeltaReference: Number((entry.sumDeltaReference / Math.max(1, entry.splitters)).toFixed(2)),
        openTickets: entry.openTickets,
        totalTickets: entry.totalTickets,
        affectedClientsTotal: entry.affectedClientsTotal,
      }))
      .sort((a, b) => b.criticalSplitters - a.criticalSplitters || b.avgUsagePercent - a.avgUsagePercent)
      .slice(0, 8)
  }, [riskRanking])

  const geoDrilldown = useMemo<IntelligenceGeoDrilldown>(() => {
    const tipoCounts = new Map<'CONDOMÍNIO' | 'UNIDADE' | 'SEM_CLASSIFICACAO', number>([
      ['CONDOMÍNIO', 0],
      ['UNIDADE', 0],
      ['SEM_CLASSIFICACAO', 0],
    ])
    const condos = new Map<string, { nome: string; splitters: number; massivaTickets: number }>()
    const streets = new Map<string, { nome: string; splitters: number; criticalSplitters: number }>()
    for (const row of riskRanking) {
      const tipo = row.tipoLocal ?? 'SEM_CLASSIFICACAO'
      tipoCounts.set(tipo, (tipoCounts.get(tipo) ?? 0) + 1)

      const condoName = row.nomeCondominio?.trim() ?? ''
      if (condoName !== '') {
        const c = condos.get(condoName) ?? { nome: condoName, splitters: 0, massivaTickets: 0 }
        c.splitters += 1
        c.massivaTickets += row.totalTickets
        condos.set(condoName, c)
      }

      const streetName = row.street?.trim() ?? ''
      if (streetName !== '') {
        const s = streets.get(streetName) ?? { nome: streetName, splitters: 0, criticalSplitters: 0 }
        s.splitters += 1
        if (row.currentUsagePercent >= 95) s.criticalSplitters += 1
        streets.set(streetName, s)
      }
    }

    return {
      tipoLocal: [
        { key: 'CONDOMÍNIO', count: tipoCounts.get('CONDOMÍNIO') ?? 0 },
        { key: 'UNIDADE', count: tipoCounts.get('UNIDADE') ?? 0 },
        { key: 'SEM_CLASSIFICACAO', count: tipoCounts.get('SEM_CLASSIFICACAO') ?? 0 },
      ],
      topCondominios: [...condos.values()]
        .sort((a, b) => b.massivaTickets - a.massivaTickets || b.splitters - a.splitters)
        .slice(0, 6),
      topStreets: [...streets.values()]
        .sort((a, b) => b.criticalSplitters - a.criticalSplitters || b.splitters - a.splitters)
        .slice(0, 6),
    }
  }, [riskRanking])

  const lifecycleAnalytics = useMemo(() => {
    const metaByCode = splittersMetaByCode
    const rows = riskRanking.map((row) => {
      const createdAt = metaByCode.get(row.splitterCode)?.createdAt ?? null
      const incidentsPerYear =
        row.ageYears > 0 ? Number((row.totalTickets / Math.max(0.25, row.ageYears)).toFixed(2)) : row.totalTickets
      const lifecycleRiskScore = clamp(
        row.riskScore * 0.6 + clamp(row.ageYears * 10, 0, 80) + clamp(incidentsPerYear * 2.5, 0, 40),
        0,
        240,
      )
      return { ...row, createdAt, incidentsPerYear, lifecycleRiskScore }
    })

    const lifecycleKpis: IntelligenceLifecycleKpis = {
      avgAgeYears:
        rows.length > 0
          ? Number((rows.reduce((sum, row) => sum + row.ageYears, 0) / rows.length).toFixed(2))
          : 0,
      agedSplitters: rows.filter((row) => row.ageYears >= 5).length,
      agedCriticalSplitters: rows.filter((row) => row.ageYears >= 5 && row.currentUsagePercent >= 95).length,
      agedPressurePercent:
        rows.length > 0
          ? Number(
              (
                (rows.filter((row) => row.ageYears >= 5 && row.currentUsagePercent >= 85).length / rows.length) *
                100
              ).toFixed(1),
            )
          : 0,
    }

    const bucketOrder: LifecycleBucketKey[] = ['0-1', '1-3', '3-5', '5+']
    const bucketMap = new Map<LifecycleBucketKey, {
      splitters: number
      sumUsage: number
      sumDelta: number
      massivaLinkages: number
    }>(bucketOrder.map((bucket) => [bucket, { splitters: 0, sumUsage: 0, sumDelta: 0, massivaLinkages: 0 }]))

    const codeToBucket = new Map<string, LifecycleBucketKey>()
    for (const row of rows) {
      codeToBucket.set(row.splitterCode, toLifecycleBucket(row.ageYears))
    }

    const distinctByBucket = countDistinctMassivasByLifecycleBucket(
      filtered?.massivaPeriodLinks ?? [],
      codeToBucket,
    )

    for (const row of rows) {
      const bucket = toLifecycleBucket(row.ageYears)
      const current = bucketMap.get(bucket)
      if (!current) continue
      current.splitters += 1
      current.sumUsage += row.currentUsagePercent
      current.sumDelta += row.selectedDelta
      current.massivaLinkages += row.totalTickets
    }
    const lifecycleBuckets: IntelligenceLifecycleBucketRow[] = bucketOrder.map((bucket) => {
      const current = bucketMap.get(bucket) ?? { splitters: 0, sumUsage: 0, sumDelta: 0, massivaLinkages: 0 }
      return {
        bucket,
        splitters: current.splitters,
        avgUsagePercent: Number((current.sumUsage / Math.max(1, current.splitters)).toFixed(1)),
        avgDeltaReference: Number((current.sumDelta / Math.max(1, current.splitters)).toFixed(2)),
        massivaLinkages: current.massivaLinkages,
        distinctMassivas: distinctByBucket[bucket] ?? 0,
      }
    })

    const heatmapCounts = new Map<string, number>()
    for (const row of rows) {
      const bucket = toLifecycleBucket(row.ageYears)
      const usageBand: IntelligenceLifecycleHeatmapCell['usageBand'] =
        row.currentUsagePercent >= 95 ? '95+' : row.currentUsagePercent >= 70 ? '70-94' : '<70'
      const key = `${bucket}|${usageBand}`
      heatmapCounts.set(key, (heatmapCounts.get(key) ?? 0) + 1)
    }
    const usageBands: IntelligenceLifecycleHeatmapCell['usageBand'][] = ['<70', '70-94', '95+']
    const lifecycleHeatmap: IntelligenceLifecycleHeatmapCell[] = bucketOrder.flatMap((bucket) =>
      usageBands.map((usageBand) => ({
        bucket,
        usageBand,
        count: heatmapCounts.get(`${bucket}|${usageBand}`) ?? 0,
      })),
    )

    const lifecycleReplacementRanking: IntelligenceLifecycleReplacementRow[] = [...rows]
      .sort((a, b) => b.lifecycleRiskScore - a.lifecycleRiskScore)
      .slice(0, 12)
      .map((row) => ({
        splitterCode: row.splitterCode,
        splitterTitle: row.splitterTitle,
        ageYears: row.ageYears,
        lifecycleRiskScore: Number(row.lifecycleRiskScore.toFixed(1)),
        etaTo95Days: row.etaTo95Days,
        currentUsagePercent: row.currentUsagePercent,
        selectedDelta: row.selectedDelta,
        affectedClientsTotal: row.affectedClientsTotal,
      }))

    const cohortMap = new Map<number, { splitters: number; sumUsage: number; sumIncidentsPerYear: number }>()
    for (const row of rows) {
      if (!row.createdAt) continue
      const cohortYear = row.createdAt.getFullYear()
      const current = cohortMap.get(cohortYear) ?? { splitters: 0, sumUsage: 0, sumIncidentsPerYear: 0 }
      current.splitters += 1
      current.sumUsage += row.currentUsagePercent
      current.sumIncidentsPerYear += row.incidentsPerYear
      cohortMap.set(cohortYear, current)
    }
    const lifecycleCohorts: IntelligenceLifecycleCohortRow[] = [...cohortMap.entries()]
      .map(([cohortYear, row]) => ({
        cohortYear,
        splitters: row.splitters,
        avgUsagePercent: Number((row.sumUsage / Math.max(1, row.splitters)).toFixed(1)),
        incidentsPerYear: Number((row.sumIncidentsPerYear / Math.max(1, row.splitters)).toFixed(2)),
      }))
      .sort((a, b) => a.cohortYear - b.cohortYear)
      .slice(-8)

    const lifecycleAlerts: IntelligenceLifecycleAlertRow[] = rows
      .filter((row) => row.ageYears >= 5 && row.currentUsagePercent >= 85 && row.selectedDelta >= 3)
      .sort((a, b) => b.currentUsagePercent - a.currentUsagePercent)
      .slice(0, 8)
      .map((row) => ({
        splitterCode: row.splitterCode,
        splitterTitle: row.splitterTitle,
        reason: `>${row.ageYears.toFixed(1)} anos, uso ${row.currentUsagePercent.toFixed(1)}% e ${deltaReferenceLabel} ${row.selectedDelta.toFixed(2)}%`,
      }))

    return {
      lifecycleKpis,
      lifecycleBuckets,
      lifecycleHeatmap,
      lifecycleReplacementRanking,
      lifecycleCohorts,
      lifecycleAlerts,
    }
  }, [riskRanking, splittersMetaByCode, deltaReference, deltaReferenceLabel, filtered?.massivaPeriodLinks])

  return {
    query,
    maintenanceQuery,
    /** `/api/stats` — costuma concluir antes do dataset; útil para prévia na UI. */
    networkStatsPreview: statsQuery.data ?? null,
    source: filtered?.source ?? null,
    kpis: filtered?.kpis ?? null,
    trends: filtered?.trends ?? [],
    massivaStats: filtered?.massivaStats ?? [],
    areaPoints,
    barPoints,
    massivaRecurrenceInsights,
    recurrenceCells,
    saturationCells,
    decisionKpis,
    riskRanking,
    impactUrgencyMatrix,
    oltDrilldown,
    geoDrilldown,
    ...lifecycleAnalytics,
    maintenanceBySplitter: maintenanceQuery.data?.rows ?? [],
    maintenanceTotals: maintenanceQuery.data?.totals ?? {
      totalMaintenances: 0,
      totalProtocols: 0,
      totalClients: 0,
      openMaintenances: 0,
      splittersWithMaintenances: 0,
      unmappedMaintenances: 0,
    },
    massivaRollup: filtered?.massivaRollup ?? EMPTY_MASSIVA_ROLLUP,
    massivaPeriodLinks: filtered?.massivaPeriodLinks ?? [],
    deltaReference,
    deltaReferenceLabel,
    dateWindow: window,
  }
}

/** Hover no menu «Painel da rede» — começa a baixar o catálogo antes do clique (menos tempo em skeleton). */
export function prefetchIntelligenceSplittersCatalog(queryClient: QueryClient): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: SPLITTERS_CATALOG_QUERY_KEY,
    queryFn: fetchAllSplittersCatalogForIntelligence,
    staleTime: SPLITTERS_CATALOG_STALE_MS,
  })
}

/** Catálogo + `/api/stats` em paralelo (alinha com o `queryFn` do dataset). */
export function prefetchIntelligencePanelPrerequisites(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    prefetchIntelligenceSplittersCatalog(queryClient),
    queryClient.prefetchQuery({
      queryKey: NETWORK_STATS_QUERY_KEY,
      queryFn: fetchNetworkStats,
      staleTime: NETWORK_STATS_STALE_MS,
    }),
  ]).then(() => undefined)
}
