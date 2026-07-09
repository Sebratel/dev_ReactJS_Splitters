import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download, Filter, MapPin, Radio, Search, Zap } from 'lucide-react'
import type { IntelligenceRiskRankingRow } from '@/features/intelligence/hooks/useNetworkIntelligenceData'
import type { CancellationBucket, CancellationCategory } from '@/features/cancellations/model/cancellationsSummary'
import type { MassivaImpactRow } from '@/features/cancellations/model/cancellationsExtras'
import { formatOltLabel } from '@/features/splitters/lib/formatOltLabel'
import type { ChurnHeatPoint, HeatMetric } from '@/features/cancellations/ui/ChurnHeatMap'
import { describeSignalProblemRate } from '@/features/cancellations/lib/signalProblemRate'
import {
  aggregateMix,
  bucketMatchesCategories,
  redeCountForCategories,
  sumBucketCategories,
} from '@/features/cancellations/lib/cancellationCategoryFilter'
import { CancellationMotiveFilter } from '@/features/cancellations/ui/CancellationMotiveFilter'

// Code-split do mapa: o bundle do Leaflet/leaflet.heat só é baixado quando o mapa monta.
const ChurnHeatMap = lazy(async () => ({
  default: (await import('@/features/cancellations/ui/ChurnHeatMap')).ChurnHeatMap,
}))

const MapPlaceholder = () => (
  <div className="flex h-[min(460px,56vh)] w-full items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 text-sm text-neutral-400">
    Carregando mapa…
  </div>
)

type OnuLite = { total: number; degraded: number; offline: number }

type CancellationsExplorerProps = {
  riskRanking: IntelligenceRiskRankingRow[]
  bySplitter: CancellationBucket[]
  onuByCode?: Map<string, OnuLite>
  massivaImpact?: MassivaImpactRow[]
  categoryFilter?: CancellationCategory[]
  onCategoryFilterChange?: (next: CancellationCategory[]) => void
}

type ExplorerRow = {
  splitterTitle: string
  splitterCode: string
  oltLabel: string
  slot: number | null
  pon: number | null
  lat: number | null
  lng: number | null
  usage: number
  activeClients: number
  signalPct: number | null
  rede: number
  total: number
  postMassivaRede: number
}

const SIGNAL_MIN_SAMPLE = 5

function norm(v: string | null | undefined): string {
  return String(v ?? '').trim().toLowerCase()
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR')
}

function ratePer100(rede: number, base: number): number | null {
  return base > 0 ? (rede / base) * 100 : null
}

export function CancellationsExplorer({
  riskRanking,
  bySplitter,
  onuByCode,
  massivaImpact,
  categoryFilter: categoryFilterProp,
  onCategoryFilterChange,
}: CancellationsExplorerProps) {
  const [olt, setOlt] = useState('all')
  const [slot, setSlot] = useState('all')
  const [pon, setPon] = useState('all')
  const [search, setSearch] = useState('')
  const [heatMetric, setHeatMetric] = useState<HeatMetric>('churn')
  const [internalCategoryFilter, setInternalCategoryFilter] = useState<CancellationCategory[]>([])
  const categoryFilter = categoryFilterProp ?? internalCategoryFilter
  const setCategoryFilter = onCategoryFilterChange ?? setInternalCategoryFilter
  // Monta o mapa só após o primeiro paint (tira o Leaflet do caminho crítico da aba).
  const [mapMounted, setMapMounted] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setMapMounted(true), 250)
    return () => window.clearTimeout(id)
  }, [])

  const churnByTitle = useMemo(() => {
    const m = new Map<string, CancellationBucket>()
    for (const b of bySplitter) m.set(norm(b.key), b)
    return m
  }, [bySplitter])

  const impactByTitle = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of massivaImpact ?? []) m.set(norm(r.splitterTitle), r.redeCount)
    return m
  }, [massivaImpact])

  // Universo = rede inteira (riskRanking), com churn/sinal/massiva juntados por título/código.
  const rows = useMemo((): ExplorerRow[] => {
    return riskRanking.map((r) => {
      const churn = churnByTitle.get(norm(r.splitterTitle))
      const onu = onuByCode?.get(r.splitterCode)
      const signalPct =
        onu && onu.total >= SIGNAL_MIN_SAMPLE
          ? ((onu.degraded + onu.offline) / onu.total) * 100
          : null
      return {
        splitterTitle: r.splitterTitle || r.splitterCode,
        splitterCode: r.splitterCode,
        oltLabel:
          formatOltLabel(
            r.accessPointTitle ?? r.accessPointCode ?? r.oltDescription ?? r.oltCode,
          ) ?? '—',
        slot: r.oltSlot,
        pon: r.oltPort,
        lat: r.latitude,
        lng: r.longitude,
        usage: r.currentUsagePercent,
        activeClients: r.activeClients,
        signalPct,
        rede: churn?.rede ?? 0,
        total: churn?.total ?? 0,
        postMassivaRede: impactByTitle.get(norm(r.splitterTitle)) ?? 0,
      }
    })
  }, [riskRanking, churnByTitle, onuByCode, impactByTitle])

  // Opções em cascata (toda a rede, para poder vasculhar qualquer ponto).
  const oltOptions = useMemo(
    () => [...new Set(rows.map((r) => r.oltLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [rows],
  )
  const slotOptions = useMemo(() => {
    const set = new Set<number>()
    for (const r of rows) {
      if (olt !== 'all' && r.oltLabel !== olt) continue
      if (r.slot != null) set.add(r.slot)
    }
    return [...set].sort((a, b) => a - b)
  }, [rows, olt])
  const ponOptions = useMemo(() => {
    const set = new Set<number>()
    for (const r of rows) {
      if (olt !== 'all' && r.oltLabel !== olt) continue
      if (slot !== 'all' && String(r.slot) !== slot) continue
      if (r.pon != null) set.add(r.pon)
    }
    return [...set].sort((a, b) => a - b)
  }, [rows, olt, slot])

  const geoFiltered = useMemo(() => {
    const q = norm(search)
    return rows.filter((r) => {
      if (olt !== 'all' && r.oltLabel !== olt) return false
      if (slot !== 'all' && String(r.slot) !== slot) return false
      if (pon !== 'all' && String(r.pon) !== pon) return false
      if (q !== '') {
        const hay = `${r.splitterTitle} ${r.splitterCode} ${r.oltLabel}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, olt, slot, pon, search])

  const motiveCounts = useMemo(() => {
    const buckets: CancellationBucket[] = []
    for (const r of geoFiltered) {
      const b = churnByTitle.get(norm(r.splitterTitle))
      if (b) buckets.push(b)
    }
    return aggregateMix(buckets, [])
  }, [geoFiltered, churnByTitle])

  const filtered = useMemo(() => {
    return geoFiltered
      .map((r) => {
        const bucket = churnByTitle.get(norm(r.splitterTitle))
        if (!bucket) return { ...r, rede: 0, total: 0, postMassivaRede: 0 }
        if (!bucketMatchesCategories(bucket, categoryFilter)) {
          return { ...r, rede: 0, total: 0, postMassivaRede: 0 }
        }
        const total = sumBucketCategories(bucket, categoryFilter)
        const rede = redeCountForCategories(bucket, categoryFilter)
        const postMassivaRede =
          categoryFilter.length === 0 || categoryFilter.includes('rede') ? r.postMassivaRede : 0
        return { ...r, rede, total, postMassivaRede }
      })
      .filter((r) => r.total > 0)
  }, [geoFiltered, churnByTitle, categoryFilter])

  const scope = useMemo(() => {
    let rede = 0
    let total = 0
    let active = 0
    let churnedSplitters = 0
    let postMassiva = 0
    for (const r of filtered) {
      rede += r.rede
      total += r.total
      active += r.activeClients
      if (r.rede > 0) churnedSplitters += 1
      postMassiva += r.postMassivaRede
    }
    const buckets: CancellationBucket[] = []
    for (const r of filtered) {
      const b = churnByTitle.get(norm(r.splitterTitle))
      if (b) buckets.push(b)
    }
    const mix = aggregateMix(buckets, categoryFilter)
    return {
      rede, total, active, churnedSplitters, postMassiva,
      splitters: filtered.length,
      rate: ratePer100(rede, active),
      mix,
    }
  }, [filtered, churnByTitle, categoryFilter])

  const ranking = useMemo(() => {
    const redeSort = categoryFilter.length === 0 || categoryFilter.includes('rede')
    return [...filtered]
      .sort((a, b) =>
        redeSort ? b.rede - a.rede || b.total - a.total : b.total - a.total || b.rede - a.rede,
      )
      .slice(0, 100)
  }, [filtered, categoryFilter])

  // Nível de agregação conforme o drill atual: OLT → Slot → PON → (splitter = ranking).
  const level: 'olt' | 'slot' | 'pon' | 'splitter' =
    pon !== 'all' ? 'splitter' : slot !== 'all' ? 'pon' : olt !== 'all' ? 'slot' : 'olt'

  const levelGroups = useMemo(() => {
    if (level === 'splitter') return []
    const map = new Map<string, { key: string; label: string; rede: number; total: number; active: number; splitters: number; drill: () => void }>()
    for (const r of filtered) {
      let key: string
      let label: string
      let drill: () => void
      if (level === 'olt') {
        key = r.oltLabel; label = r.oltLabel
        drill = () => { setOlt(r.oltLabel); setSlot('all'); setPon('all') }
      } else if (level === 'slot') {
        if (r.slot == null) continue
        key = String(r.slot); label = `Slot ${r.slot}`
        drill = () => { setSlot(String(r.slot)); setPon('all') }
      } else {
        if (r.pon == null) continue
        key = String(r.pon); label = `PON ${r.pon}`
        drill = () => setPon(String(r.pon))
      }
      let g = map.get(key)
      if (!g) { g = { key, label, rede: 0, total: 0, active: 0, splitters: 0, drill }; map.set(key, g) }
      g.rede += r.rede; g.total += r.total; g.active += r.activeClients
      if (r.rede > 0) g.splitters += 1
    }
    return [...map.values()].sort((a, b) => b.rede - a.rede || b.total - a.total).slice(0, 15)
  }, [filtered, level])

  const heatPoints = useMemo<ChurnHeatPoint[]>(
    () =>
      filtered
        .filter((r) => r.lat != null && r.lng != null)
        .map((r) => {
          const onu = onuByCode?.get(r.splitterCode)
          return {
            splitterTitle: r.splitterTitle,
            oltLabel: r.oltLabel,
            lat: r.lat as number,
            lng: r.lng as number,
            rede: r.rede,
            total: r.total,
            usage: r.usage,
            signalPct: r.signalPct,
            onuTotal: onu?.total ?? null,
            onuDegraded: onu?.degraded ?? null,
            onuOffline: onu?.offline ?? null,
          }
        }),
    [filtered, onuByCode],
  )

  // Adia o recomputo pesado do mapa para não travar troca de filtro/camada.
  const deferredHeat = useDeferredValue(heatPoints)

  const hasFilter =
    olt !== 'all' || slot !== 'all' || pon !== 'all' || search.trim() !== '' || categoryFilter.length > 0
  const clearFilters = () => {
    setOlt('all'); setSlot('all'); setPon('all'); setSearch(''); setCategoryFilter([])
  }

  const exportCsv = () => {
    const header = ['Splitter', 'Codigo', 'OLT', 'Slot', 'PON', 'Ocupacao(%)', 'Clientes ativos', 'Sinal deg+off(%)', 'Churn rede', 'Churn total', 'Churn pos-massiva']
    const lines = ranking.map((r) =>
      [r.splitterTitle, r.splitterCode, r.oltLabel, r.slot ?? '', r.pon ?? '',
        Math.round(r.usage), r.activeClients, r.signalPct != null ? r.signalPct.toFixed(1).replace('.', ',') : '',
        r.rede, r.total, r.postMassivaRede]
        .map((v) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s })
        .join(';'),
    )
    const csv = [header.join(';'), ...lines].join('\r\n')
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `churn-explorer-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const selectCls = 'rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700'

  return (
    <div className="space-y-4">
      {/* Filtros / drill-down */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
        <p className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500">
          <Radio className="size-4 text-indigo-500" aria-hidden />
          Explorar a rede
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar splitter, código ou OLT…"
              className="w-full rounded-lg border border-neutral-200 bg-white py-1.5 pl-7 pr-2 text-xs text-neutral-700"
            />
          </div>
          <select value={olt} onChange={(e) => { setOlt(e.target.value); setSlot('all'); setPon('all') }} className={selectCls}>
            <option value="all">OLT: todas</option>
            {oltOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={slot} onChange={(e) => { setSlot(e.target.value); setPon('all') }} className={selectCls}>
            <option value="all">Slot: todos</option>
            {slotOptions.map((s) => <option key={s} value={String(s)}>Slot {s}</option>)}
          </select>
          <select value={pon} onChange={(e) => setPon(e.target.value)} className={selectCls}>
            <option value="all">PON: todas</option>
            {ponOptions.map((p) => <option key={p} value={String(p)}>PON {p}</option>)}
          </select>
          <div className="flex items-center gap-1.5 sm:ml-auto">
            <span className="text-lg font-bold tabular-nums text-neutral-800">{fmt(scope.churnedSplitters)}</span>
            <span className="text-[10px] leading-tight text-neutral-500">splitters<br />com churn</span>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilter}
            className={`rounded-lg border px-2 py-1.5 text-xs font-bold transition ${
              hasFilter ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100' : 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400'
            }`}
          >
            Limpar
          </button>
        </div>
        <CancellationMotiveFilter
          className="mt-3 border-t border-neutral-100 pt-3"
          selected={categoryFilter}
          onChange={setCategoryFilter}
          counts={motiveCounts}
        />
      </div>

      {/* KPIs do recorte + mix de motivos */}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Churn de rede" value={fmt(scope.rede)} tone="danger" />
          <Kpi label="Churn total" value={fmt(scope.total)} />
          <Kpi
            label="Taxa / 100 ativos"
            value={scope.rate != null ? scope.rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}
            tone={scope.rate != null && scope.rate >= 2 ? 'danger' : undefined}
          />
          <Kpi label="Pós-massiva (rede)" value={fmt(scope.postMassiva)} tone={scope.postMassiva > 0 ? 'warn' : undefined} />
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white p-3 lg:w-64">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Mix de motivos no recorte</p>
          {scope.total > 0 ? (
            <div className="space-y-1">
              {(categoryFilter.length === 0 || categoryFilter.includes('rede')) && scope.mix.rede > 0 ? (
                <MixBar label="Rede/qualidade" value={scope.mix.rede} total={scope.total} color="bg-rose-500" />
              ) : null}
              {(categoryFilter.length === 0 || categoryFilter.includes('financeiro')) && scope.mix.financeiro > 0 ? (
                <MixBar label="Financeiro" value={scope.mix.financeiro} total={scope.total} color="bg-slate-400" />
              ) : null}
              {(categoryFilter.length === 0 || categoryFilter.includes('mudanca')) && scope.mix.mudanca > 0 ? (
                <MixBar label="Mudança" value={scope.mix.mudanca} total={scope.total} color="bg-violet-400" />
              ) : null}
              {(categoryFilter.length === 0 || categoryFilter.includes('tecnico')) && scope.mix.tecnico > 0 ? (
                <MixBar label="Técnico" value={scope.mix.tecnico} total={scope.total} color="bg-amber-500" />
              ) : null}
              {(categoryFilter.length === 0 || categoryFilter.includes('pre_instalacao')) && scope.mix.pre_instalacao > 0 ? (
                <MixBar label="Pré-instalação" value={scope.mix.pre_instalacao} total={scope.total} color="bg-sky-400" />
              ) : null}
              {(categoryFilter.length === 0 || categoryFilter.includes('operacional')) && scope.mix.operacional > 0 ? (
                <MixBar label="Operacional" value={scope.mix.operacional} total={scope.total} color="bg-neutral-400" />
              ) : null}
              {(categoryFilter.length === 0 || categoryFilter.includes('outros')) && scope.mix.outros > 0 ? (
                <MixBar label="Outros" value={scope.mix.outros} total={scope.total} color="bg-neutral-300" />
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-neutral-400">Sem cancelamentos no recorte.</p>
          )}
        </div>
      </div>

      {/* Mapa de calor com camadas */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-3 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
            <MapPin className="size-4 text-rose-500" aria-hidden />
            Mapa de calor {hasFilter ? '(recorte filtrado)' : '(rede toda)'}
          </p>
          <div className="flex items-center gap-1 rounded-lg border border-neutral-200/90 bg-white p-0.5">
            {([
              { id: 'churn', label: 'Churn de rede' },
              { id: 'saturacao', label: 'Saturação' },
              { id: 'sinal', label: 'Sinal' },
            ] as Array<{ id: HeatMetric; label: string }>).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setHeatMetric(opt.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  heatMetric === opt.id ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {mapMounted ? (
          <Suspense fallback={<MapPlaceholder />}>
            <ChurnHeatMap points={deferredHeat} metric={heatMetric} />
          </Suspense>
        ) : (
          <MapPlaceholder />
        )}
        <p className="mt-1.5 text-[11px] text-neutral-400">
          {heatMetric === 'churn'
            ? 'Intensidade = cancelamentos de rede por splitter.'
            : heatMetric === 'saturacao'
              ? 'Intensidade = ocupação das portas (onde a rede está cheia).'
              : 'Intensidade = % de ONUs degradadas/offline (onde o sinal está ruim).'}
        </p>
      </div>

      {/* Resumo agregado por nível (acompanha o drill) */}
      {levelGroups.length > 0 ? (
        <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-neutral-900">
              Churn por {level === 'olt' ? 'OLT' : level === 'slot' ? 'Slot' : 'PON'}
              <span className="ml-2 text-[11px] font-normal text-neutral-500">clique para descer o nível</span>
            </p>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-white">
                <tr className="border-b border-neutral-200/90 text-[11px] uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-2">{level === 'olt' ? 'OLT' : level === 'slot' ? 'Slot' : 'PON'}</th>
                  <th className="px-3 py-2 text-center">Splitters c/ churn</th>
                  <th className="px-3 py-2 text-center">Rede</th>
                  <th className="px-3 py-2 text-center">Total</th>
                  <th className="px-3 py-2 text-center">Taxa/100</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {levelGroups.map((g) => {
                  const rate = ratePer100(g.rede, g.active)
                  return (
                    <tr key={g.key} className="cursor-pointer hover:bg-indigo-50/50" onClick={g.drill}>
                      <td className="px-4 py-2 font-medium text-indigo-700 hover:underline">{g.label}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-neutral-600">{g.splitters}</td>
                      <td className="px-3 py-2 text-center font-bold tabular-nums text-rose-700">{g.rede > 0 ? fmt(g.rede) : '—'}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-neutral-700">{fmt(g.total)}</td>
                      <td className={`px-3 py-2 text-center tabular-nums ${rate != null && rate >= 2 ? 'font-bold text-rose-700' : 'text-neutral-500'}`}>
                        {rate != null ? rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Ranking / drill */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Filter className="size-4 text-neutral-500" aria-hidden />
            Splitters no recorte {ranking.length > 0 ? `(top ${ranking.length})` : ''}
          </p>
          <button
            type="button"
            onClick={exportCsv}
            disabled={ranking.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
          >
            <Download className="size-3.5" aria-hidden />
            Exportar CSV
          </button>
        </div>
        <div className="max-h-[30rem] overflow-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-white">
              <tr className="border-b border-neutral-200/90 text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5">Splitter</th>
                <th className="px-3 py-2.5">OLT</th>
                <th className="px-3 py-2.5">Slot/PON</th>
                <th className="px-3 py-2.5 text-center">Ocup.</th>
                <th className="px-3 py-2.5 text-center" title="% de ONUs atenuadas ou offline (≥8% atenção, ≥15% crítico)">
                  Sinal
                </th>
                <th className="px-3 py-2.5 text-center">Rede</th>
                <th className="px-3 py-2.5 text-center">Total</th>
                <th className="px-3 py-2.5 text-center">Pós-massiva</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {ranking.map((r) => (
                <tr key={r.splitterCode || r.splitterTitle} className="hover:bg-neutral-50/70">
                  <td className="px-4 py-2 font-medium text-neutral-900">{r.splitterTitle}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => { setOlt(r.oltLabel); setSlot('all'); setPon('all') }} className="text-indigo-600 hover:underline">
                      {r.oltLabel}
                    </button>
                  </td>
                  <td className="px-3 py-2 font-mono text-[12px] text-neutral-600">
                    {r.slot != null && r.pon != null ? (
                      <button type="button" onClick={() => { setOlt(r.oltLabel); setSlot(String(r.slot)); setPon(String(r.pon)) }} className="hover:underline">
                        {r.slot} / {r.pon}
                      </button>
                    ) : '—'}
                  </td>
                  <td className={`px-3 py-2 text-center tabular-nums ${r.usage >= 85 ? 'font-bold text-amber-700' : 'text-neutral-600'}`}>
                    {Math.round(r.usage)}%
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {r.signalPct != null ? (() => {
                      const tone = describeSignalProblemRate(r.signalPct)
                      const cellClass =
                        tone.level === 'critical'
                          ? 'font-bold text-rose-700'
                          : tone.level === 'attention'
                            ? 'font-semibold text-amber-700'
                            : 'font-medium text-emerald-700'
                      return (
                        <span className={cellClass} title={`${tone.label} — ${tone.hint}`}>
                          {r.signalPct.toFixed(1)}%
                        </span>
                      )
                    })() : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center font-bold tabular-nums text-rose-700">{r.rede > 0 ? fmt(r.rede) : '—'}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-neutral-700">{fmt(r.total)}</td>
                  <td className={`px-3 py-2 text-center tabular-nums ${r.postMassivaRede > 0 ? 'font-semibold text-amber-700' : 'text-neutral-400'}`}>
                    {r.postMassivaRede > 0 ? (
                      <span className="inline-flex items-center gap-1" title="Churn de rede em até 30d após massiva">
                        <Zap className="size-3" aria-hidden />{r.postMassivaRede}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-neutral-500">
                    Nenhum cancelamento no recorte selecionado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="flex items-center gap-1.5 border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-400">
          <AlertTriangle className="size-3.5 text-amber-500" aria-hidden />
          Clique na OLT ou no Slot/PON para descer o recorte. &quot;Sinal&quot; = % de ONUs atenuadas ou offline (verde saudável, âmbar ≥8%, vermelho ≥15%). &quot;Pós-massiva&quot; = churn de rede em até 30 dias após uma massiva do splitter.
        </p>
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'warn' }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tone === 'danger' ? 'border-rose-300 bg-rose-50/70' : tone === 'warn' ? 'border-amber-300 bg-amber-50/70' : 'border-neutral-200/80 bg-white'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tone === 'danger' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : 'text-neutral-900'}`}>{value}</p>
    </div>
  )
}

function MixBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-neutral-600">{label}</span>
        <span className="font-semibold tabular-nums text-neutral-800">{value.toLocaleString('pt-BR')} ({pct}%)</span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
