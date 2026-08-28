import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Briefcase,
  Building2,
  CalendarClock,
  Download,
  Gauge,
  Lightbulb,
  MapPin,
  Router,
  ShieldAlert,
  Target,
  TrendingDown,
  Zap,
} from 'lucide-react'
import type { IntelligenceRiskRankingRow } from '@/features/intelligence/hooks/useNetworkIntelligenceData'
import { useCancellationsSummary } from '@/features/cancellations/hooks/useCancellationsSummary'
import {
  useCancellationsActiveBase,
  useMassivaImpact,
} from '@/features/cancellations/hooks/useCancellationsExtras'
import { useOnuSummaryBySplitter } from '@/features/onu/hooks/useOnuSummaryBySplitter'
import { CondominiumsMap, type CondoMapPoint } from '@/features/condominiums/ui/CondominiumsMap'

type CondominiumsPanelProps = {
  riskRanking: IntelligenceRiskRankingRow[]
}

type CondoRow = {
  nome: string
  splitters: number
  cities: string[]
  neighborhoods: string[]
  activeClients: number
  avgUsage: number
  saturatedSplitters: number
  avgRisk: number
  criticalSplitters: number
  openTickets: number
  totalTickets: number
  affectedClients: number
  avgAge: number
  avgDelta: number
  redeChurn: number
  totalChurn: number
  /** Massivas do condomínio seguidas de churn de rede na janela pós-evento. */
  postMassivaEvents: number
  /** Cancelamentos de rede ocorridos na janela após as massivas do condomínio. */
  postMassivaChurn: number
  onuTotal: number
  onuOnline: number
  onuDegraded: number
  onuOffline: number
  /** Menor ETA (dias) até 95% entre os splitters projetáveis do condomínio; null se nenhum. */
  etaSoonestDays: number | null
  /** Nº de splitters projetados para saturar (≥95%) dentro do horizonte de planejamento. */
  splittersSaturatingSoon: number
  /** Quantidade de OLTs distintas que atendem o condomínio. */
  oltCount: number
  /** Quantidade de PONs distintas (OLT+slot+porta) que atendem o condomínio. */
  ponCount: number
  /** Nº de splitters com ao menos um cliente corporativo. */
  corporateSplitters: number
  lat: number | null
  lng: number | null
}

type View = 'saturacao' | 'capacidade' | 'churn' | 'massivas' | 'risco' | 'sinal'

/** Faixas de ocupação para a distribuição da rede de condomínios. */
const USAGE_BANDS = [
  { key: 'baixa', label: '< 50%', min: 0, max: 50, color: 'bg-emerald-400' },
  { key: 'media', label: '50–70%', min: 50, max: 70, color: 'bg-sky-400' },
  { key: 'alta', label: '70–85%', min: 70, max: 85, color: 'bg-amber-400' },
  { key: 'saturada', label: '≥ 85%', min: 85, max: Infinity, color: 'bg-rose-500' },
] as const

/** Horizonte (dias) para considerar um splitter "saturando em breve" no planejamento. */
const SATURATION_HORIZON_DAYS = 90
/** Faixas de urgência (dias até 95%) para a lente de Capacidade. */
const ETA_CRITICAL_DAYS = 30
const ETA_HIGH_DAYS = 90
const ETA_MODERATE_DAYS = 180

/** Share de sinal degradado+offline a partir do qual um condomínio é "sinal crítico". */
const SIGNAL_PROBLEM_THRESHOLD = 15
/** Mínimo de ONUs para a % de sinal ser confiável (evita 100% de 1 ONU dominar o ranking). */
const SIGNAL_MIN_SAMPLE = 5

/** % de ONUs com sinal degradado ou offline no condomínio; null se sem leitura. */
function signalProblemPct(c: CondoRow): number | null {
  return c.onuTotal > 0 ? ((c.onuDegraded + c.onuOffline) / c.onuTotal) * 100 : null
}

const MAP_NEUTRAL = '#cbd5e1'
const MAP_GOOD = '#10b981'
const MAP_INFO = '#38bdf8'
const MAP_WARN = '#f59e0b'
const MAP_BAD = '#f43f5e'

type CondoStatus = { key: string; label: string; color: string }

/** Status do condomínio (chave + rótulo + cor) conforme a lente selecionada. */
function statusForCondo(c: CondoRow, view: View): CondoStatus {
  if (view === 'churn') {
    return c.redeChurn > 0
      ? { key: 'com', label: 'Com churn de rede', color: MAP_BAD }
      : { key: 'sem', label: 'Sem churn', color: MAP_NEUTRAL }
  }
  if (view === 'massivas') {
    return c.totalTickets > 0
      ? { key: 'com', label: 'Com massiva', color: MAP_WARN }
      : { key: 'sem', label: 'Sem massiva', color: MAP_NEUTRAL }
  }
  if (view === 'sinal') {
    const p = signalProblemPct(c)
    if (p == null) return { key: 'sem-dado', label: 'Sem leitura', color: MAP_NEUTRAL }
    if (c.onuTotal < SIGNAL_MIN_SAMPLE) return { key: 'amostra-baixa', label: 'Amostra baixa', color: MAP_NEUTRAL }
    if (p >= SIGNAL_PROBLEM_THRESHOLD) return { key: 'critico', label: 'Crítico (≥15%)', color: MAP_BAD }
    if (p >= 5) return { key: 'atencao', label: 'Atenção (5–15%)', color: MAP_WARN }
    return { key: 'ok', label: 'OK (<5%)', color: MAP_GOOD }
  }
  if (view === 'capacidade') {
    const eta = c.etaSoonestDays
    if (eta == null) return { key: 'sem-proj', label: 'Sem projeção', color: MAP_GOOD }
    if (eta <= ETA_CRITICAL_DAYS) return { key: 'critico', label: `Satura ≤ ${ETA_CRITICAL_DAYS}d`, color: MAP_BAD }
    if (eta <= ETA_HIGH_DAYS) return { key: 'alto', label: `Satura ≤ ${ETA_HIGH_DAYS}d`, color: MAP_WARN }
    if (eta <= ETA_MODERATE_DAYS) return { key: 'moderado', label: `Satura ≤ ${ETA_MODERATE_DAYS}d`, color: MAP_INFO }
    return { key: 'baixo', label: `Satura > ${ETA_MODERATE_DAYS}d`, color: MAP_GOOD }
  }
  if (view === 'risco') {
    if (c.avgRisk >= 120) return { key: 'critico', label: 'Crítico', color: MAP_BAD }
    if (c.avgRisk >= 90) return { key: 'alto', label: 'Alto', color: MAP_WARN }
    if (c.avgRisk >= 60) return { key: 'moderado', label: 'Moderado', color: MAP_INFO }
    return { key: 'baixo', label: 'Baixo', color: MAP_GOOD }
  }
  if (c.avgUsage >= 85) return { key: 'saturada', label: 'Saturado (≥85%)', color: MAP_BAD }
  if (c.avgUsage >= 70) return { key: 'alta', label: 'Alta (70–85%)', color: MAP_WARN }
  if (c.avgUsage >= 50) return { key: 'media', label: 'Média (50–70%)', color: MAP_INFO }
  return { key: 'baixa', label: 'Baixa (<50%)', color: MAP_GOOD }
}

/** Ordem/rótulos dos status por lente, para os chips de filtro do mapa. */
const STATUS_ORDER: Record<View, CondoStatus[]> = {
  saturacao: [
    { key: 'saturada', label: 'Saturado (≥85%)', color: MAP_BAD },
    { key: 'alta', label: 'Alta (70–85%)', color: MAP_WARN },
    { key: 'media', label: 'Média (50–70%)', color: MAP_INFO },
    { key: 'baixa', label: 'Baixa (<50%)', color: MAP_GOOD },
  ],
  capacidade: [
    { key: 'critico', label: `Satura ≤ ${ETA_CRITICAL_DAYS}d`, color: MAP_BAD },
    { key: 'alto', label: `Satura ≤ ${ETA_HIGH_DAYS}d`, color: MAP_WARN },
    { key: 'moderado', label: `Satura ≤ ${ETA_MODERATE_DAYS}d`, color: MAP_INFO },
    { key: 'baixo', label: `Satura > ${ETA_MODERATE_DAYS}d`, color: MAP_GOOD },
    { key: 'sem-proj', label: 'Sem projeção', color: MAP_GOOD },
  ],
  churn: [
    { key: 'com', label: 'Com churn de rede', color: MAP_BAD },
    { key: 'sem', label: 'Sem churn', color: MAP_NEUTRAL },
  ],
  massivas: [
    { key: 'com', label: 'Com massiva', color: MAP_WARN },
    { key: 'sem', label: 'Sem massiva', color: MAP_NEUTRAL },
  ],
  risco: [
    { key: 'critico', label: 'Crítico', color: MAP_BAD },
    { key: 'alto', label: 'Alto', color: MAP_WARN },
    { key: 'moderado', label: 'Moderado', color: MAP_INFO },
    { key: 'baixo', label: 'Baixo', color: MAP_GOOD },
  ],
  sinal: [
    { key: 'critico', label: 'Crítico (≥15%)', color: MAP_BAD },
    { key: 'atencao', label: 'Atenção (5–15%)', color: MAP_WARN },
    { key: 'ok', label: 'OK (<5%)', color: MAP_GOOD },
    { key: 'amostra-baixa', label: 'Amostra baixa', color: MAP_NEUTRAL },
    { key: 'sem-dado', label: 'Sem leitura', color: MAP_NEUTRAL },
  ],
}

const VIEW_MAP_LEGEND: Record<View, string> = {
  saturacao: 'Cor = ocupação média (verde <50% · azul 50–70 · âmbar 70–85 · vermelho ≥85%)',
  capacidade: `Cor = tempo até saturar (vermelho ≤${ETA_CRITICAL_DAYS}d · âmbar ≤${ETA_HIGH_DAYS}d · azul ≤${ETA_MODERATE_DAYS}d · verde sem urgência)`,
  churn: 'Cor = tem churn de rede (vermelho) ou não (cinza)',
  massivas: 'Cor = teve massiva no período (âmbar) ou não (cinza)',
  risco: 'Cor = score de risco médio (verde baixo → vermelho crítico)',
  sinal: 'Cor = sinal degradado/offline (verde ok · âmbar · vermelho ≥15%; cinza = amostra baixa)',
}

const SATURATION_THRESHOLD = 85

function startIso12mAgo(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 12)
  return d.toISOString().slice(0, 10)
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR')
}

function fmt1(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** Formata dias até saturar em rótulo curto e legível (ex.: "~18 d", "~4 m", "> 1 a"). */
function fmtEta(days: number | null): string {
  if (days == null) return '—'
  if (days <= 45) return `~${Math.round(days)} d`
  if (days <= 365) return `~${Math.round(days / 30)} m`
  return '> 1 a'
}

/** Cor do texto do ETA por urgência (mesmas faixas do mapa). */
function etaTone(days: number | null): string {
  if (days == null) return 'text-on-surface-variant/60'
  if (days <= ETA_CRITICAL_DAYS) return 'text-rose-700 dark:text-rose-200'
  if (days <= ETA_HIGH_DAYS) return 'text-amber-700 dark:text-amber-200'
  if (days <= ETA_MODERATE_DAYS) return 'text-sky-700 dark:text-sky-200'
  return 'text-emerald-700 dark:text-emerald-200'
}

/** Número com vírgula decimal (Excel pt-BR); vazio para null. */
function csvNum(n: number | null, decimals = 0): string {
  if (n == null) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false })
}

/** Escapa um campo de texto para CSV (delimitador `;`). */
function csvText(value: string): string {
  const s = String(value ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Monta o CSV do ranking com todas as métricas por condomínio (delimitador `;` para Excel pt-BR). */
function buildCondosCsv(rows: CondoRow[]): string {
  const header = [
    'Condomínio', 'Cidades', 'Bairros', 'Splitters', 'Clientes ativos',
    'Ocupação média (%)', 'Splitters saturados (>=85%)', 'Crescimento médio (pp)',
    'Satura em (dias)', 'Splitters saturando <=90d', 'Idade média (anos)',
    'OLTs', 'PONs', 'Splitters corporativos', 'Score médio', 'Splitters críticos',
    'Massivas abertas', 'Massivas total', 'Clientes afetados', 'Churn pós-massiva (30d)',
    'Churn de rede (12m)', 'Churn total (12m)',
    'ONUs', 'ONUs degradadas', 'ONUs offline',
  ]
  const lines = rows.map((c) => [
    csvText(c.nome), csvText(c.cities.join(' · ')), csvText(c.neighborhoods.join(' · ')),
    csvNum(c.splitters), csvNum(c.activeClients),
    csvNum(c.avgUsage, 1), csvNum(c.saturatedSplitters), csvNum(c.avgDelta, 1),
    csvNum(c.etaSoonestDays), csvNum(c.splittersSaturatingSoon), csvNum(c.avgAge, 1),
    csvNum(c.oltCount), csvNum(c.ponCount), csvNum(c.corporateSplitters),
    csvNum(c.avgRisk), csvNum(c.criticalSplitters),
    csvNum(c.openTickets), csvNum(c.totalTickets), csvNum(c.affectedClients), csvNum(c.postMassivaChurn),
    csvNum(c.redeChurn), csvNum(c.totalChurn),
    csvNum(c.onuTotal), csvNum(c.onuDegraded), csvNum(c.onuOffline),
  ].join(';'))
  return [header.join(';'), ...lines].join('\r\n')
}

/** Dispara o download de um CSV (com BOM para acentuação correta no Excel). */
function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function CondominiumsPanel({ riskRanking }: CondominiumsPanelProps) {
  const [view, setView] = useState<View>('saturacao')
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set())
  // Ao trocar de lente os status mudam de significado — limpa o filtro do mapa.
  useEffect(() => {
    setHiddenStatuses(new Set())
  }, [view])
  const startIso = useMemo(startIso12mAgo, [])
  const summaryQuery = useCancellationsSummary(startIso)
  const activeBaseQuery = useCancellationsActiveBase()
  const onuQuery = useOnuSummaryBySplitter()
  const massivaImpactQuery = useMassivaImpact(startIso, 30)

  const condos = useMemo((): CondoRow[] => {
    const churnByName = new Map<string, { rede: number; total: number }>()
    for (const b of summaryQuery.data?.byCondominio ?? []) {
      churnByName.set(b.key, { rede: b.rede, total: b.total })
    }
    // Correlação massiva→churn agregada por condomínio (janela pós-evento do BFF).
    const impactByName = new Map<string, { events: number; rede: number }>()
    for (const row of massivaImpactQuery.data?.ranking ?? []) {
      if (row.tipoLocal !== 'CONDOMÍNIO') continue
      const nome = row.nomeCondominio?.trim()
      if (!nome) continue
      const prev = impactByName.get(nome) ?? { events: 0, rede: 0 }
      prev.events += row.eventsCount
      prev.rede += row.redeCount
      impactByName.set(nome, prev)
    }
    const activeByName = activeBaseQuery.data?.byCondominio ?? {}
    const onuByCode = onuQuery.data

    type Acc = {
      splitters: number
      usageSum: number
      saturatedSplitters: number
      riskSum: number
      criticalSplitters: number
      openTickets: number
      totalTickets: number
      affectedClients: number
      ageSum: number
      deltaSum: number
      cities: Set<string>
      neighborhoods: Set<string>
      onuTotal: number
      onuOnline: number
      onuDegraded: number
      onuOffline: number
      etaSoonestDays: number | null
      splittersSaturatingSoon: number
      olts: Set<string>
      pons: Set<string>
      corporateSplitters: number
      latSum: number
      lngSum: number
      geoCount: number
    }
    const map = new Map<string, Acc>()
    for (const r of riskRanking) {
      if (r.tipoLocal !== 'CONDOMÍNIO') continue
      const nome = r.nomeCondominio?.trim()
      if (!nome) continue
      let c = map.get(nome)
      if (!c) {
        c = {
          splitters: 0, usageSum: 0, saturatedSplitters: 0, riskSum: 0, criticalSplitters: 0,
          openTickets: 0, totalTickets: 0, affectedClients: 0, ageSum: 0, deltaSum: 0,
          cities: new Set(), neighborhoods: new Set(),
          onuTotal: 0, onuOnline: 0, onuDegraded: 0, onuOffline: 0,
          etaSoonestDays: null, splittersSaturatingSoon: 0, olts: new Set(), pons: new Set(),
          corporateSplitters: 0,
          latSum: 0, lngSum: 0, geoCount: 0,
        }
        map.set(nome, c)
      }
      c.splitters += 1
      c.usageSum += r.currentUsagePercent
      if (r.currentUsagePercent >= SATURATION_THRESHOLD) c.saturatedSplitters += 1
      c.riskSum += r.riskScore
      if (r.riskBand === 'critico') c.criticalSplitters += 1
      c.openTickets += r.openTickets
      c.totalTickets += r.totalTickets
      c.affectedClients += r.affectedClientsTotal
      c.ageSum += r.ageYears
      c.deltaSum += r.selectedDelta
      if (r.etaTo95Days != null) {
        c.etaSoonestDays = c.etaSoonestDays == null ? r.etaTo95Days : Math.min(c.etaSoonestDays, r.etaTo95Days)
        if (r.etaTo95Days <= SATURATION_HORIZON_DAYS) c.splittersSaturatingSoon += 1
      }
      if (r.hasCorporateClients) c.corporateSplitters += 1
      if (r.oltCode?.trim()) c.olts.add(r.oltCode.trim())
      if (r.oltCode?.trim() && r.oltSlot != null && r.oltPort != null) {
        c.pons.add(`${r.oltCode.trim()}/${r.oltSlot}/${r.oltPort}`)
      }
      if (r.cityCadastro) c.cities.add(r.cityCadastro)
      if (r.neighborhoodCadastro) c.neighborhoods.add(r.neighborhoodCadastro)
      const onu = onuByCode?.get(r.splitterCode)
      if (onu) {
        c.onuTotal += onu.total
        c.onuOnline += onu.online
        c.onuDegraded += onu.degraded
        c.onuOffline += onu.offline
      }
      if (r.latitude != null && r.longitude != null) {
        c.latSum += r.latitude
        c.lngSum += r.longitude
        c.geoCount += 1
      }
    }
    return [...map.entries()].map(([nome, c]) => {
      const churn = churnByName.get(nome)
      const impact = impactByName.get(nome)
      return {
        nome,
        splitters: c.splitters,
        cities: [...c.cities],
        neighborhoods: [...c.neighborhoods],
        activeClients: activeByName[nome] ?? 0,
        avgUsage: c.splitters > 0 ? c.usageSum / c.splitters : 0,
        saturatedSplitters: c.saturatedSplitters,
        avgRisk: c.splitters > 0 ? c.riskSum / c.splitters : 0,
        criticalSplitters: c.criticalSplitters,
        openTickets: c.openTickets,
        totalTickets: c.totalTickets,
        affectedClients: c.affectedClients,
        avgAge: c.splitters > 0 ? c.ageSum / c.splitters : 0,
        avgDelta: c.splitters > 0 ? c.deltaSum / c.splitters : 0,
        etaSoonestDays: c.etaSoonestDays,
        splittersSaturatingSoon: c.splittersSaturatingSoon,
        oltCount: c.olts.size,
        ponCount: c.pons.size,
        corporateSplitters: c.corporateSplitters,
        redeChurn: churn?.rede ?? 0,
        totalChurn: churn?.total ?? 0,
        postMassivaEvents: impact?.events ?? 0,
        postMassivaChurn: impact?.rede ?? 0,
        onuTotal: c.onuTotal,
        onuOnline: c.onuOnline,
        onuDegraded: c.onuDegraded,
        onuOffline: c.onuOffline,
        lat: c.geoCount > 0 ? c.latSum / c.geoCount : null,
        lng: c.geoCount > 0 ? c.lngSum / c.geoCount : null,
      }
    })
  }, [riskRanking, summaryQuery.data, activeBaseQuery.data, onuQuery.data, massivaImpactQuery.data])

  const totals = useMemo(() => {
    const splitters = condos.reduce((s, c) => s + c.splitters, 0)
    const usageSum = condos.reduce((s, c) => s + c.avgUsage * c.splitters, 0)
    const avgUsage = splitters > 0 ? usageSum / splitters : 0
    const saturatedCondos = condos.filter((c) => c.avgUsage >= SATURATION_THRESHOLD).length
    const churnCondos = condos.filter((c) => c.redeChurn > 0).length
    const doubleTrouble = condos.filter((c) => c.avgUsage >= SATURATION_THRESHOLD && c.redeChurn > 0)
    const withMassivas = condos.filter((c) => c.totalTickets > 0).length
    const onuHasData = condos.some((c) => c.onuTotal > 0)
    const signalCritical = condos.filter((c) => {
      if (c.onuTotal < SIGNAL_MIN_SAMPLE) return false
      const p = ((c.onuDegraded + c.onuOffline) / c.onuTotal) * 100
      return p >= SIGNAL_PROBLEM_THRESHOLD
    })
    const distribution = USAGE_BANDS.map((band) => ({
      ...band,
      count: condos.filter((c) => c.avgUsage >= band.min && c.avgUsage < band.max).length,
    }))
    // Planejamento: condomínios com ao menos um splitter projetado para saturar no horizonte.
    const saturatingSoon = condos.filter((c) => c.splittersSaturatingSoon > 0)
    const corporateCondos = condos.filter((c) => c.corporateSplitters > 0)
    // Massiva→churn: condomínios onde massiva foi seguida de cancelamento de rede.
    const postMassivaChurn = condos
      .filter((c) => c.postMassivaChurn > 0)
      .sort((a, b) => b.postMassivaChurn - a.postMassivaChurn)
    return {
      splitters, avgUsage, saturatedCondos, churnCondos, doubleTrouble, withMassivas,
      onuHasData, signalCritical, distribution, saturatingSoon, corporateCondos, postMassivaChurn,
    }
  }, [condos])

  const activeBase = activeBaseQuery.data
  const condoActive = activeBase?.byTipoLocal['CONDOMÍNIO'] ?? 0
  const ruaActive = activeBase?.byTipoLocal.UNIDADE ?? 0
  const baseShare = condoActive + ruaActive > 0 ? Math.round((condoActive / (condoActive + ruaActive)) * 100) : 0

  const sortedCondos = useMemo(() => {
    const rows = [...condos]
    if (view === 'saturacao') rows.sort((a, b) => b.avgUsage - a.avgUsage || b.splitters - a.splitters)
    else if (view === 'capacidade') {
      // ETA mais próximo primeiro; sem projeção (null) vai para o fim.
      const eta = (c: CondoRow) => c.etaSoonestDays ?? Infinity
      rows.sort((a, b) => eta(a) - eta(b) || b.splittersSaturatingSoon - a.splittersSaturatingSoon || b.avgDelta - a.avgDelta)
    }
    else if (view === 'churn') rows.sort((a, b) => b.redeChurn - a.redeChurn || b.totalChurn - a.totalChurn)
    else if (view === 'massivas') rows.sort((a, b) => b.totalTickets - a.totalTickets || b.affectedClients - a.affectedClients)
    else if (view === 'sinal') {
      // Condomínios com amostra confiável primeiro; abaixo do mínimo vão para o fim.
      const rank = (c: CondoRow) =>
        c.onuTotal >= SIGNAL_MIN_SAMPLE ? (signalProblemPct(c) ?? -1) : -1
      rows.sort((a, b) => rank(b) - rank(a) || b.onuTotal - a.onuTotal)
    } else rows.sort((a, b) => b.avgRisk - a.avgRisk || b.criticalSplitters - a.criticalSplitters)
    return rows
  }, [condos, view])

  const rankedRows = useMemo(() => sortedCondos.slice(0, 60), [sortedCondos])

  const handleExportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`condominios-rede-${view}-${stamp}.csv`, buildCondosCsv(sortedCondos))
  }

  const geoCondos = useMemo(() => condos.filter((c) => c.lat != null && c.lng != null), [condos])

  // Contagem por status (lente atual) para os chips do filtro do mapa.
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of geoCondos) {
      const s = statusForCondo(c, view)
      counts.set(s.key, (counts.get(s.key) ?? 0) + 1)
    }
    return counts
  }, [geoCondos, view])

  const mapPoints = useMemo((): CondoMapPoint[] => {
    return geoCondos
      .map((c) => ({ c, status: statusForCondo(c, view) }))
      .filter(({ status }) => !hiddenStatuses.has(status.key))
      .map(({ c, status }) => ({
        nome: c.nome,
        lat: c.lat as number,
        lng: c.lng as number,
        splitters: c.splitters,
        activeClients: c.activeClients,
        avgUsage: c.avgUsage,
        redeChurn: c.redeChurn,
        totalTickets: c.totalTickets,
        signalPct: signalProblemPct(c),
        etaSoonestDays: c.etaSoonestDays,
        color: status.color,
        radius: Math.max(5, Math.min(22, Math.sqrt(c.splitters) * 4)),
      }))
  }, [geoCondos, view, hiddenStatuses])

  // Adia a atualização do mapa (pesado no Leaflet) para a tabela/lente responderem na hora.
  const deferredMapPoints = useDeferredValue(mapPoints)

  const toggleStatus = (key: string) => {
    setHiddenStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (condos.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest p-8 text-center text-sm text-on-surface-variant">
        Nenhum condomínio identificado no recorte atual da rede.
      </div>
    )
  }

  const usageTone = (u: number) =>
    u >= 90 ? 'text-rose-700 dark:text-rose-200' : u >= SATURATION_THRESHOLD ? 'text-amber-700 dark:text-amber-200' : 'text-on-surface'

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-2xl border border-indigo-200/70 dark:border-indigo-800/50 bg-gradient-to-br from-indigo-50 dark:from-indigo-950/20 to-white dark:to-surface-container-lowest p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-200/70 dark:ring-indigo-800/50">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold tracking-tight text-on-surface">Condomínios na rede</p>
            <p className="mt-0.5 max-w-2xl text-sm leading-snug text-on-surface-variant">
              {condos.length.toLocaleString('pt-BR')} condomínios · {fmt(totals.splitters)} splitters ·{' '}
              {condoActive > 0 ? `${fmt(condoActive)} clientes ativos ` : ''}
              {baseShare > 0 ? <span className="font-semibold text-indigo-700 dark:text-indigo-200">({baseShare}% da base)</span> : null}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${totals.onuHasData ? 'lg:grid-cols-7' : 'lg:grid-cols-6'}`}>
        <Kpi label="Condomínios" value={condos.length.toLocaleString('pt-BR')} />
        <Kpi label="Splitters" value={fmt(totals.splitters)} />
        <Kpi label="Ocupação média" value={`${fmt1(totals.avgUsage)}%`} tone={totals.avgUsage >= SATURATION_THRESHOLD ? 'warn' : undefined} />
        <Kpi label="Saturados (≥85%)" value={totals.saturatedCondos.toLocaleString('pt-BR')} tone={totals.saturatedCondos > 0 ? 'warn' : undefined} />
        <Kpi
          label={`Satura ≤ ${SATURATION_HORIZON_DAYS}d`}
          value={totals.saturatingSoon.length.toLocaleString('pt-BR')}
          tone={totals.saturatingSoon.length > 0 ? 'warn' : undefined}
        />
        <Kpi label="Com churn de rede" value={totals.churnCondos.toLocaleString('pt-BR')} tone={totals.churnCondos > 0 ? 'danger' : undefined} />
        {totals.onuHasData ? (
          <Kpi label="Sinal crítico" value={totals.signalCritical.length.toLocaleString('pt-BR')} tone={totals.signalCritical.length > 0 ? 'danger' : undefined} />
        ) : null}
      </div>

      {/* Distribuição por faixa de ocupação */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-on-surface">Distribuição por ocupação</p>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/5">
          {totals.distribution.map((band) =>
            band.count > 0 ? (
              <div
                key={band.key}
                className={band.color}
                style={{ width: `${(band.count / condos.length) * 100}%` }}
                title={`${band.label}: ${band.count} condomínio(s)`}
              />
            ) : null,
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {totals.distribution.map((band) => (
            <span key={band.key} className="inline-flex items-center gap-1.5 text-[11px] text-on-surface-variant">
              <span className={`size-2 rounded-full ${band.color}`} aria-hidden />
              {band.label}: <span className="font-semibold tabular-nums text-on-surface">{band.count}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Leitura rápida */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest p-4 shadow-sm">
        <p className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          <Lightbulb className="size-4 text-amber-500" aria-hidden />
          Leitura rápida
        </p>
        <ul className="space-y-2 text-sm leading-snug text-on-surface-variant">
          <li className="flex items-start gap-2">
            <Gauge className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
            <span>
              <span className="font-semibold text-on-surface">{totals.saturatedCondos}</span> condomínio(s)
              estão saturados (ocupação média ≥ {SATURATION_THRESHOLD}%) — candidatos a expansão de porta.
            </span>
          </li>
          {totals.saturatingSoon.length > 0 ? (
            <li className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
              <span>
                <span className="font-semibold text-on-surface">{totals.saturatingSoon.length}</span>{' '}
                condomínio(s) têm splitter projetado para saturar (≥95%) em até {SATURATION_HORIZON_DAYS} dias
                se o ritmo atual se mantiver — antecipe a expansão na lente <em>Capacidade</em>.
              </span>
            </li>
          ) : null}
          <li className="flex items-start gap-2">
            <TrendingDown className="mt-0.5 size-4 shrink-0 text-rose-500" aria-hidden />
            <span>
              <span className="font-semibold text-on-surface">{totals.churnCondos}</span> condomínio(s)
              têm churn de rede (insatisfação/concorrência) nos últimos 12 meses — possível problema de
              qualidade percebida.
            </span>
          </li>
          {totals.doubleTrouble.length > 0 ? (
            <li className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden />
              <span>
                <span className="font-bold text-rose-700 dark:text-rose-200">
                  {totals.doubleTrouble.length} condomínio(s) em prioridade máxima
                </span>
                : saturados <em>e</em> com churn de rede ({totals.doubleTrouble.slice(0, 3).map((c) => c.nome).join(', ')}
                {totals.doubleTrouble.length > 3 ? '…' : ''}).
              </span>
            </li>
          ) : null}
          {totals.withMassivas > 0 ? (
            <li className="flex items-start gap-2">
              <Zap className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
              <span>
                <span className="font-semibold text-on-surface">{totals.withMassivas}</span> condomínio(s)
                tiveram massivas no período — cruze com o churn abaixo.
              </span>
            </li>
          ) : null}
          {totals.postMassivaChurn.length > 0 ? (
            <li className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden />
              <span>
                <span className="font-bold text-rose-700 dark:text-rose-200">{totals.postMassivaChurn.length}</span> condomínio(s)
                tiveram <span className="font-semibold">cancelamento de rede logo após uma massiva</span>{' '}
                (evidência de massiva puxando churn) —{' '}
                {totals.postMassivaChurn.slice(0, 3).map((c) => c.nome).join(', ')}
                {totals.postMassivaChurn.length > 3 ? '…' : ''}. Priorize estabilização nessas áreas.
              </span>
            </li>
          ) : null}
          {totals.onuHasData && totals.signalCritical.length > 0 ? (
            <li className="flex items-start gap-2">
              <Activity className="mt-0.5 size-4 shrink-0 text-rose-500" aria-hidden />
              <span>
                <span className="font-semibold text-on-surface">{totals.signalCritical.length}</span>{' '}
                condomínio(s) com sinal ONU degradado/offline acima de {SIGNAL_PROBLEM_THRESHOLD}% —
                monitore antes que vire churn.
              </span>
            </li>
          ) : null}
        </ul>
      </div>

      {/* Mapa dos condomínios (cor segue a lente do ranking) */}
      {geoCondos.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 dark:border-white/5 dark:border-white/10 px-4 py-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface">
              <MapPin className="size-4 text-indigo-500" aria-hidden />
              Mapa dos condomínios
            </p>
            <span className="text-[11px] text-on-surface-variant">
              {mapPoints.length} de {condos.length} com localização · {VIEW_MAP_LEGEND[view]}
            </span>
          </div>
          {/* Filtro por status da lente atual — clique para ocultar/mostrar no mapa. */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-100 dark:border-white/5 dark:border-white/10 px-4 py-2">
            {STATUS_ORDER[view]
              .filter((s) => (statusCounts.get(s.key) ?? 0) > 0)
              .map((s) => {
                const count = statusCounts.get(s.key) ?? 0
                const hidden = hiddenStatuses.has(s.key)
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleStatus(s.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                      hidden
                        ? 'border-neutral-200 dark:border-white/10 bg-surface-container-low text-on-surface-variant/60 line-through'
                        : 'border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                    }`}
                    title={hidden ? 'Mostrar no mapa' : 'Ocultar do mapa'}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                    {s.label}
                    <span className="tabular-nums text-on-surface-variant/60">{count}</span>
                  </button>
                )
              })}
            {hiddenStatuses.size > 0 ? (
              <button
                type="button"
                onClick={() => setHiddenStatuses(new Set())}
                className="ml-auto inline-flex items-center gap-1 rounded-full border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-200 transition hover:bg-indigo-100 dark:hover:bg-indigo-950/50"
              >
                Mostrar todos
              </button>
            ) : null}
          </div>
          <div className="relative">
            <CondominiumsMap points={deferredMapPoints} />
            {mapPoints.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center bg-surface-container-lowest/70">
                <span className="pointer-events-auto rounded-full border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-on-surface-variant shadow-sm">
                  Nenhum status selecionado — use os filtros acima para exibir condomínios.
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Ranking */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 dark:border-white/5 dark:border-white/10 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface">
            <Router className="size-4 text-on-surface-variant" aria-hidden />
            Ranking de condomínios
          </p>
          <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant transition hover:bg-surface-container-low"
            title="Exportar todos os condomínios (todas as métricas) em CSV"
          >
            <Download className="size-3.5" aria-hidden />
            Exportar CSV
          </button>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest p-0.5">
            {([
              { id: 'saturacao', label: 'Saturação' },
              { id: 'capacidade', label: 'Capacidade' },
              { id: 'churn', label: 'Churn de rede' },
              { id: 'massivas', label: 'Massivas' },
              { id: 'risco', label: 'Risco' },
              ...(totals.onuHasData ? [{ id: 'sinal' as const, label: 'Sinal ONU' }] : []),
            ] as Array<{ id: View; label: string }>).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setView(opt.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  view === opt.id ? 'bg-neutral-900 text-white' : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          </div>
        </div>
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-surface-container-lowest">
              <tr className="border-b border-neutral-200/90 dark:border-white/10 text-[11px] uppercase tracking-wide text-on-surface-variant">
                <th className="px-4 py-2.5">Condomínio</th>
                <th className="px-3 py-2.5 text-center">Splitters</th>
                <th className="px-3 py-2.5 text-center">Clientes</th>
                {view === 'saturacao' ? (
                  <>
                    <th className="px-3 py-2.5 text-center">Ocup. média</th>
                    <th className="px-3 py-2.5 text-center">Saturados</th>
                  </>
                ) : null}
                {view === 'capacidade' ? (
                  <>
                    <th className="px-3 py-2.5 text-center">Ocup. média</th>
                    <th className="px-3 py-2.5 text-center">Crescimento</th>
                    <th className="px-3 py-2.5 text-center">Satura em</th>
                    <th className="px-3 py-2.5 text-center">Idade média</th>
                  </>
                ) : null}
                {view === 'churn' ? (
                  <>
                    <th className="px-3 py-2.5 text-center">Churn rede</th>
                    <th className="px-3 py-2.5 text-center">Churn total</th>
                  </>
                ) : null}
                {view === 'massivas' ? (
                  <>
                    <th className="px-3 py-2.5 text-center">Massivas</th>
                    <th className="px-3 py-2.5 text-center">Afetados</th>
                    <th className="px-3 py-2.5 text-center">Churn pós-massiva</th>
                  </>
                ) : null}
                {view === 'risco' ? (
                  <>
                    <th className="px-3 py-2.5 text-center">Score médio</th>
                    <th className="px-3 py-2.5 text-center">Críticos</th>
                  </>
                ) : null}
                {view === 'sinal' ? (
                  <>
                    <th className="px-3 py-2.5 text-center">ONUs</th>
                    <th className="px-3 py-2.5 text-center">Deg.+off.</th>
                    <th className="px-3 py-2.5 text-center">Offline</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rankedRows.map((c) => {
                const doubleTrouble = c.avgUsage >= SATURATION_THRESHOLD && c.redeChurn > 0
                return (
                  <tr key={c.nome} className="hover:bg-surface-container-low/70">
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5 font-medium text-on-surface">
                        <Building2 className="size-3.5 text-indigo-400" aria-hidden />
                        {c.nome}
                        {doubleTrouble ? (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 dark:bg-rose-950/50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-200"
                            title="Saturado e com churn de rede"
                          >
                            <AlertTriangle className="size-2.5" aria-hidden />
                            prioridade
                          </span>
                        ) : null}
                        {c.corporateSplitters > 0 ? (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 dark:bg-violet-950/50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-200"
                            title={`${c.corporateSplitters} splitter(s) com cliente corporativo`}
                          >
                            <Briefcase className="size-2.5" aria-hidden />
                            corporativo
                          </span>
                        ) : null}
                      </span>
                      {c.cities.length > 0 || c.oltCount > 0 ? (
                        <span className="ml-5 block text-[10px] text-on-surface-variant/60">
                          {c.cities.join(' · ')}
                          {c.oltCount > 0 ? (
                            <span className="text-on-surface-variant/60">
                              {c.cities.length > 0 ? ' · ' : ''}
                              {c.oltCount} OLT{c.oltCount > 1 ? 's' : ''} · {c.ponCount} PON{c.ponCount > 1 ? 's' : ''}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums text-on-surface-variant">{c.splitters}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-on-surface-variant">
                      {c.activeClients > 0 ? fmt(c.activeClients) : '—'}
                    </td>
                    {view === 'saturacao' ? (
                      <>
                        <td className={`px-3 py-2 text-center font-bold tabular-nums ${usageTone(c.avgUsage)}`}>
                          {fmt1(c.avgUsage)}%
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums text-on-surface-variant">
                          {c.saturatedSplitters}/{c.splitters}
                        </td>
                      </>
                    ) : null}
                    {view === 'capacidade' ? (
                      <>
                        <td className={`px-3 py-2 text-center font-semibold tabular-nums ${usageTone(c.avgUsage)}`}>
                          {fmt1(c.avgUsage)}%
                        </td>
                        <td
                          className={`px-3 py-2 text-center tabular-nums ${
                            c.avgDelta > 0 ? 'text-amber-700 dark:text-amber-200' : c.avgDelta < 0 ? 'text-emerald-700 dark:text-emerald-200' : 'text-on-surface-variant'
                          }`}
                        >
                          {c.avgDelta > 0 ? '+' : ''}{fmt1(c.avgDelta)} pp
                        </td>
                        <td className={`px-3 py-2 text-center font-bold tabular-nums ${etaTone(c.etaSoonestDays)}`}>
                          {fmtEta(c.etaSoonestDays)}
                          {c.splittersSaturatingSoon > 0 ? (
                            <span className="ml-1 text-[9px] font-normal text-on-surface-variant/60">
                              {c.splittersSaturatingSoon} splt
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums text-on-surface-variant">
                          {c.avgAge > 0 ? `${fmt1(c.avgAge)} a` : '—'}
                        </td>
                      </>
                    ) : null}
                    {view === 'churn' ? (
                      <>
                        <td className="px-3 py-2 text-center font-bold tabular-nums text-rose-700 dark:text-rose-200">
                          {c.redeChurn > 0 ? fmt(c.redeChurn) : '—'}
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums text-on-surface-variant">
                          {c.totalChurn > 0 ? fmt(c.totalChurn) : '—'}
                        </td>
                      </>
                    ) : null}
                    {view === 'massivas' ? (
                      <>
                        <td className="px-3 py-2 text-center tabular-nums text-on-surface">
                          {c.totalTickets > 0 ? `${c.openTickets} / ${c.totalTickets}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums text-on-surface-variant">
                          {c.affectedClients > 0 ? fmt(c.affectedClients) : '—'}
                        </td>
                        <td
                          className={`px-3 py-2 text-center font-bold tabular-nums ${
                            c.postMassivaChurn > 0 ? 'text-rose-700 dark:text-rose-200' : 'text-on-surface-variant/60'
                          }`}
                          title={
                            c.postMassivaEvents > 0
                              ? `${c.postMassivaChurn} churn de rede em até 30d após ${c.postMassivaEvents} massiva(s)`
                              : undefined
                          }
                        >
                          {c.postMassivaChurn > 0 ? fmt(c.postMassivaChurn) : '—'}
                        </td>
                      </>
                    ) : null}
                    {view === 'risco' ? (
                      <>
                        <td className="px-3 py-2 text-center font-bold tabular-nums text-on-surface">
                          {fmt(c.avgRisk)}
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums text-rose-700 dark:text-rose-200">
                          {c.criticalSplitters > 0 ? c.criticalSplitters : '—'}
                        </td>
                      </>
                    ) : null}
                    {view === 'sinal' ? (
                      (() => {
                        const p = signalProblemPct(c)
                        const lowSample = c.onuTotal > 0 && c.onuTotal < SIGNAL_MIN_SAMPLE
                        return (
                          <>
                            <td className="px-3 py-2 text-center tabular-nums text-on-surface-variant">
                              {c.onuTotal > 0 ? fmt(c.onuTotal) : '—'}
                            </td>
                            <td
                              className={`px-3 py-2 text-center font-bold tabular-nums ${
                                lowSample
                                  ? 'text-on-surface-variant/60'
                                  : p != null && p >= SIGNAL_PROBLEM_THRESHOLD
                                    ? 'text-rose-700 dark:text-rose-200'
                                    : 'text-on-surface-variant'
                              }`}
                              title={lowSample ? `Amostra baixa (< ${SIGNAL_MIN_SAMPLE} ONUs) — % pouco confiável` : undefined}
                            >
                              {p != null ? `${fmt1(p)}%` : '—'}
                              {lowSample ? <span className="ml-1 text-[9px] font-normal">amostra baixa</span> : null}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums text-on-surface-variant">
                              {c.onuTotal > 0 ? c.onuOffline : '—'}
                            </td>
                          </>
                        )
                      })()
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 border-t border-neutral-100 dark:border-white/5 dark:border-white/10 px-4 py-2 text-[11px] text-on-surface-variant/60">
          <Target className="size-3.5" aria-hidden />
          {view === 'saturacao'
            ? 'Ocupação média das portas dos splitters do condomínio. ≥85% = candidato a expansão.'
            : view === 'capacidade'
              ? `"Satura em" = projeção linear até 95% pelo ritmo de crescimento atual (menor ETA entre os splitters do condomínio); "splt" = splitters que saturam em até ${SATURATION_HORIZON_DAYS} dias. Antecipe a expansão pelos de menor prazo e maior crescimento (pp).`
            : view === 'churn'
              ? 'Cancelamentos de rede/qualidade (insatisfação + concorrência) nos últimos 12 meses.'
              : view === 'massivas'
                ? '"Churn pós-massiva" = cancelamentos de rede ocorridos em até 30 dias após uma massiva do condomínio — evidência direta de evento de rede puxando churn.'
                : view === 'sinal'
                  ? `Sinal ONU quase em tempo real: % de ONUs degradadas/offline sobre o total do condomínio. Condomínios com menos de ${SIGNAL_MIN_SAMPLE} ONUs são marcados como "amostra baixa" e não entram no "sinal crítico".`
                  : 'Score de risco médio dos splitters do condomínio (ocupação + variação + massivas).'}
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'danger' }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        tone === 'danger'
          ? 'border-rose-300 bg-rose-50/70 dark:bg-rose-950/40'
          : tone === 'warn'
            ? 'border-amber-300 bg-amber-50/70 dark:bg-amber-950/40'
            : 'border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums ${
          tone === 'danger' ? 'text-rose-700 dark:text-rose-200' : tone === 'warn' ? 'text-amber-700 dark:text-amber-200' : 'text-on-surface'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
