import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Filter, Search, X } from 'lucide-react'
import { useMassivaTickets } from '@/features/massiva/hooks/useMassivaTickets'
import { buildMassivaStatsBySplitter, findMassivaStatsForSplitter } from '@/features/splitters/lib/buildMassivaStatsBySplitter'
import { buildSplitterOperationalScore } from '@/features/splitters/lib/buildSplitterOperationalScore'
import { useSplittersList } from '@/features/splitters/hooks/useSplittersList'
import { useAccessPointsForFilters } from '@/features/splitters/hooks/useAccessPointsForFilters'
import { useOpenMassivaSplitterCodesFromLocalDb } from '@/features/splitters/hooks/useOpenMassivaSplitterCodesFromLocalDb'
import { useSplitterMassivaStatsFromLocalDb } from '@/features/splitters/hooks/useSplitterMassivaStatsFromLocalDb'
import { useSplitterTrendsFromLocalDb } from '@/features/splitters/hooks/useSplitterTrendsFromLocalDb'
import type { Splitter } from '@/features/splitters/model/splitter'
import { SplittersList } from '@/features/splitters/ui/SplittersList'
import { SplittersFiltersDrawer } from '@/features/splitters/ui/SplittersFiltersDrawer'
import { useSplittersFiltersStore } from '@/features/splitters/store/useSplittersFiltersStore'
import { countActiveSplittersFilters } from '@/features/splitters/model/splittersListFilters'
import { SPLITTER_STATUS_LABEL } from '@/features/splitters/model/splitterStatus'
import { cn } from '@/shared/lib/utils'
import type { SplitterMassivaStats, SplitterOperationalScore } from '@/features/splitters/model/splitterOperationalInsights'

type SplittersSortMode =
  | 'risk-desc'
  | 'risk-asc'
  | 'occupancy-desc'
  | 'occupancy-asc'
  | 'code-asc'
  | 'code-desc'

type SplitterListEntry = {
  splitter: Splitter
  massivaStats: SplitterMassivaStats
  operationalScore: SplitterOperationalScore
  trendLabel: string
}

function occupancyPercent(splitter: { busyCount: number; outPorts: number }): number {
  if (splitter.outPorts <= 0) return 0
  return (splitter.busyCount / splitter.outPorts) * 100
}

function compareByRisk(a: SplitterListEntry, b: SplitterListEntry): number {
  if (b.operationalScore.score !== a.operationalScore.score) {
    return b.operationalScore.score - a.operationalScore.score
  }
  if (b.massivaStats.openTickets !== a.massivaStats.openTickets) {
    return b.massivaStats.openTickets - a.massivaStats.openTickets
  }
  if (b.massivaStats.affectedClientsTotal !== a.massivaStats.affectedClientsTotal) {
    return b.massivaStats.affectedClientsTotal - a.massivaStats.affectedClientsTotal
  }
  const occDelta = occupancyPercent(b.splitter) - occupancyPercent(a.splitter)
  if (Math.abs(occDelta) > 0.001) return occDelta
  return String(a.splitter.code ?? '').localeCompare(String(b.splitter.code ?? ''), 'pt-BR')
}

export function SplittersPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortMode, setSortMode] = useState<SplittersSortMode>('risk-desc')
  const {
    state,
    setSearchQuery,
    toggleOltCode,
    togglePrimarySplitterTitle,
    toggleSplitterStatus,
    toggleCitySelection,
    toggleCondominiumSelection,
    toggleStreetSelection,
    setMassivaOpenState,
    setCorporateClientFilter,
    clearAll,
  } = useSplittersFiltersStore()
  const { data: accessPoints } = useAccessPointsForFilters()
  const { view: massivaView } = useMassivaTickets()
  const openMassivaSplitterCodesQuery = useOpenMassivaSplitterCodesFromLocalDb()

  const oltLabelByCode = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of accessPoints ?? []) {
      m.set(o.code, o.title || o.code)
    }
    return m
  }, [accessPoints])

  const openMassivaSplitterCodes = useMemo(() => {
    if (Array.isArray(openMassivaSplitterCodesQuery.data)) {
      return openMassivaSplitterCodesQuery.data
    }
    if (massivaView.status !== 'success') return []
    const codes = new Set<string>()
    for (const ticket of massivaView.tickets) {
      if (ticket.status !== 'aberta') continue
      const code = String(ticket.splitterCode ?? '').trim()
      if (code !== '') codes.add(code)
    }
    return [...codes]
  }, [massivaView, openMassivaSplitterCodesQuery.data])

  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = []
    const sq = state.searchQuery.trim()
    if (sq !== '') {
      const short = sq.length > 28 ? `${sq.slice(0, 28)}...` : sq
      chips.push({
        key: 'search',
        label: `Busca: ${short}`,
        onRemove: () => setSearchQuery(''),
      })
    }
    for (const code of state.oltCodes) {
      const label = oltLabelByCode.get(code) ?? code
      chips.push({
        key: `olt:${code}`,
        label: `Ponto de acesso: ${label}`,
        onRemove: () => toggleOltCode(code),
      })
    }
    for (const title of state.primarySplitterTitles) {
      chips.push({
        key: `primary:${title}`,
        label: `Primário: ${title}`,
        onRemove: () => togglePrimarySplitterTitle(title),
      })
    }
    for (const st of state.splitterStatuses) {
      chips.push({
        key: `status:${st}`,
        label: `Status: ${SPLITTER_STATUS_LABEL[st]}`,
        onRemove: () => toggleSplitterStatus(st),
      })
    }
    for (const city of state.citySelections) {
      chips.push({
        key: `city:${city}`,
        label: `Cidade: ${city}`,
        onRemove: () => toggleCitySelection(city),
      })
    }
    for (const name of state.condominiumSelections) {
      chips.push({
        key: `condo:${name}`,
        label: `Condomínio: ${name}`,
        onRemove: () => toggleCondominiumSelection(name),
      })
    }
    for (const street of state.streetSelections) {
      chips.push({
        key: `street:${street}`,
        label: `Rua: ${street}`,
        onRemove: () => toggleStreetSelection(street),
      })
    }
    if (state.massivaOpenState === 'with-open') {
      chips.push({
        key: 'massiva:with',
        label: 'Massiva: com aberta',
        onRemove: () => setMassivaOpenState('all'),
      })
    } else if (state.massivaOpenState === 'without-open') {
      chips.push({
        key: 'massiva:without',
        label: 'Massiva: sem aberta',
        onRemove: () => setMassivaOpenState('all'),
      })
    }
    if (state.corporateClientFilter === 'with-corporate') {
      chips.push({
        key: 'corporate:with',
        label: 'Corporativo: com cliente',
        onRemove: () => setCorporateClientFilter('all'),
      })
    } else if (state.corporateClientFilter === 'without-corporate') {
      chips.push({
        key: 'corporate:without',
        label: 'Corporativo: sem cliente',
        onRemove: () => setCorporateClientFilter('all'),
      })
    }
    return chips
  }, [
    state.searchQuery,
    state.oltCodes,
    state.primarySplitterTitles,
    state.splitterStatuses,
    state.citySelections,
    state.condominiumSelections,
    state.streetSelections,
    state.massivaOpenState,
    state.corporateClientFilter,
    oltLabelByCode,
    setSearchQuery,
    toggleOltCode,
    togglePrimarySplitterTitle,
    toggleSplitterStatus,
    toggleCitySelection,
    toggleCondominiumSelection,
    toggleStreetSelection,
    setMassivaOpenState,
    setCorporateClientFilter,
  ])

  const activeFilterCount = countActiveSplittersFilters(state)

  // Lê a página da URL (?page=3); padrão 1 se ausente ou inválido
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)

  function handlePageChange(newPage: number) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (newPage === 1) {
          next.delete('page')
        } else {
          next.set('page', String(newPage))
        }
        return next
      },
      { replace: true }, // não empilha no histórico ao paginar
    )
  }

  // Resetar para página 1 quando os filtros mudarem
  useEffect(() => {
    handlePageChange(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.searchQuery,
    state.oltCodes,
    state.primarySplitterTitles,
    state.splitterStatuses,
    state.streetSelections,
    state.citySelections,
    state.condominiumSelections,
    state.massivaOpenState,
    state.corporateClientFilter,
  ])

  const splittersQuery = useSplittersList(page, { openMassivaSplitterCodes })

  const items = useMemo(
    () => splittersQuery.data?.items ?? [],
    [splittersQuery.data?.items],
  )
  const totalCount = splittersQuery.data?.totalCount ?? 0
  const localMassivaStatsQuery = useSplitterMassivaStatsFromLocalDb(
    items.map((splitter) => String(splitter.code ?? '')),
  )
  const localTrendsQuery = useSplitterTrendsFromLocalDb(
    items.map((splitter) => String(splitter.code ?? '')),
  )
  const massivaStatsByMatcher = useMemo(
    () =>
      massivaView.status === 'success'
        ? buildMassivaStatsBySplitter(massivaView.tickets)
        : new Map(),
    [massivaView],
  )

  const entries = useMemo<SplitterListEntry[]>(() => {
    return items.map((splitter) => {
      const code = String(splitter.code ?? '')
      const localMassiva = localMassivaStatsQuery.data?.get(code)
      const massivaStats =
        localMassiva && localMassiva.totalTickets > 0
          ? localMassiva
          : findMassivaStatsForSplitter(
              massivaStatsByMatcher,
              code,
              String(splitter.title ?? ''),
            )
      const operationalScore = buildSplitterOperationalScore(splitter, massivaStats)
      const trendLabel =
        localTrendsQuery.data?.get(code)?.label ?? 'Estável'
      return {
        splitter,
        massivaStats,
        operationalScore,
        trendLabel,
      }
    })
  }, [items, localMassivaStatsQuery.data, localTrendsQuery.data, massivaStatsByMatcher])

  const orderedEntries = useMemo(() => {
    const next = [...entries]
    next.sort((a, b) => {
      switch (sortMode) {
        case 'risk-desc':
          return compareByRisk(a, b)
        case 'risk-asc':
          return compareByRisk(b, a)
        case 'occupancy-desc':
          return occupancyPercent(b.splitter) - occupancyPercent(a.splitter)
        case 'occupancy-asc':
          return occupancyPercent(a.splitter) - occupancyPercent(b.splitter)
        case 'code-desc':
          return String(b.splitter.code ?? '').localeCompare(String(a.splitter.code ?? ''), 'pt-BR')
        default:
          return String(a.splitter.code ?? '').localeCompare(String(b.splitter.code ?? ''), 'pt-BR')
      }
    })
    return next
  }, [entries, sortMode])

  const prioritizedEntries = useMemo(() => {
    const prioritized = orderedEntries.filter(
      (entry) => entry.operationalScore.tone !== 'ok',
    )
    return prioritized.slice(0, 5)
  }, [orderedEntries])

  const orderedItems = useMemo(
    () => orderedEntries.map((entry) => entry.splitter),
    [orderedEntries],
  )

  const massivaStatsByCode = useMemo(
    () =>
      new Map(
        entries.map((entry) => [String(entry.splitter.code ?? ''), entry.massivaStats]),
      ),
    [entries],
  )

  const operationalScoreByCode = useMemo(
    () =>
      new Map(
        entries.map((entry) => [String(entry.splitter.code ?? ''), entry.operationalScore]),
      ),
    [entries],
  )

  const trendLabelByCode = useMemo(
    () =>
      new Map(entries.map((entry) => [String(entry.splitter.code ?? ''), entry.trendLabel])),
    [entries],
  )

  const fallbackMassivaStats: SplitterMassivaStats = {
    totalTickets: 0,
    openTickets: 0,
    closedTickets: 0,
    affectedClientsTotal: 0,
    latestOpenedAt: null,
  }
  const fallbackOperationalScore: SplitterOperationalScore = {
    score: 0,
    tone: 'ok',
    label: 'Estável',
  }

  const getMassivaStats = (splitter: Splitter) =>
    massivaStatsByCode.get(String(splitter.code ?? '')) ?? fallbackMassivaStats

  const getOperationalScore = (splitter: Splitter) =>
    operationalScoreByCode.get(String(splitter.code ?? '')) ?? fallbackOperationalScore

  const getTrendLabel = (splitter: Splitter) =>
    trendLabelByCode.get(String(splitter.code ?? '')) ?? 'Estável'

  const showSummary =
    !splittersQuery.isPending &&
    !splittersQuery.isError &&
    totalCount > 0

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/55">
            Infraestrutura
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface md:text-[2.5rem] md:leading-[1.1]">
            Splitters
          </h1>
          <p className="text-sm leading-relaxed text-on-surface-variant/75">
            {"Gerenciamento de infraestrutura secund\u00E1ria com carregamento inteligente e grade de visualiza\u00E7\u00E3o r\u00E1pida."}
          </p>
        </div>

        {showSummary && (
          <div className="flex w-full shrink-0 items-center gap-3 rounded-2xl border border-outline-variant bg-white px-5 py-3.5 shadow-sm sm:w-auto">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12">
              <span className="absolute h-2 w-2 rounded-full bg-primary" />
              <span className="h-2 w-2 rounded-full bg-primary/40 animate-ping" aria-hidden />
            </div>
            <p className="text-sm text-on-surface-variant">
              Total de{' '}
              <span className="font-semibold tabular-nums text-on-surface">{totalCount}</span> equipamentos
            </p>
          </div>
        )}
      </header>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-outline-variant/50 to-transparent" />

      <section className="rounded-2xl border border-outline-variant/40 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1 sm:min-w-[14rem]">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/45"
            />
            <input
              type="search"
              value={state.searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={"Buscar splitter, cliente, usu\u00E1rio PPPoE, c\u00F3digo..."}
              className="w-full rounded-xl border border-outline-variant bg-surface py-2.5 pl-10 pr-3 text-sm focus:border-primary/40 focus:outline-none"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface-variant">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
                {"Ordena\u00E7\u00E3o"}
              </span>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SplittersSortMode)}
                className="bg-transparent text-sm font-semibold text-on-surface outline-none"
              >
                <option value="risk-desc">Maior risco primeiro</option>
                <option value="risk-asc">Menor risco primeiro</option>
                <option value="occupancy-desc">{'Maior ocupa\u00E7\u00E3o'}</option>
                <option value="occupancy-asc">{'Menor ocupa\u00E7\u00E3o'}</option>
                <option value="code-asc">{'C\u00F3digo A-Z'}</option>
                <option value="code-desc">{'C\u00F3digo Z-A'}</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition',
                activeFilterCount > 0
                  ? 'border-primary/25 bg-primary/10 text-primary'
                  : 'border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low',
              )}
            >
              <Filter size={16} />
              Filtros
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-black text-white tabular-nums">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => clearAll()}
                className="rounded-xl border border-transparent px-3 py-2.5 text-sm font-semibold text-tertiary underline-offset-2 hover:underline"
              >
                Limpar tudo
              </button>
            ) : null}
          </div>
        </div>

        {filterChips.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-outline-variant/30 pt-4">
            {filterChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-outline-variant/60 bg-surface-container-low/80 py-1 pl-3 pr-1 text-xs font-semibold text-on-surface"
              >
                <span className="min-w-0 truncate">{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onRemove}
                  aria-label={`Remover filtro ${chip.label}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-white hover:text-on-surface"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <SplittersFiltersDrawer open={filtersOpen} onOpenChange={setFiltersOpen} />

      {!splittersQuery.isPending && !splittersQuery.isError && prioritizedEntries.length > 0 ? (
        <section className="rounded-2xl border border-rose-200/80 bg-rose-50/55 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-100 text-rose-700">
                <AlertTriangle size={17} strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm font-bold tracking-tight text-rose-900">
                  {"Fila de prioriza\u00E7\u00E3o operacional"}
                </p>
                <p className="text-xs text-rose-800/80">
                  {"Splitters com maior risco para atuar primeiro nesta p\u00E1gina."}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {prioritizedEntries.map((entry, index) => (
              <Link
                key={String(entry.splitter.code ?? '')}
                to={`/splitters/${encodeURIComponent(entry.splitter.code)}`}
                state={{ splittersListHref: location.pathname + location.search }}
                className="rounded-xl border border-rose-200/80 bg-white px-3 py-2 shadow-sm transition-colors hover:border-rose-300 hover:bg-rose-50/40"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Prioridade {index + 1}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-on-surface">
                  {entry.splitter.title || entry.splitter.code}
                </p>
                <p className="font-mono text-[11px] text-on-surface-variant/60">
                  {entry.splitter.code}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                    {entry.operationalScore.label} {entry.operationalScore.score}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/70">
                    {entry.massivaStats.openTickets} abertas
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <SplittersList
        items={orderedItems}
        totalCount={totalCount}
        currentPage={page}
        onPageChange={handlePageChange}
        isPending={splittersQuery.isPending}
        isError={splittersQuery.isError}
        error={splittersQuery.error}
        refetch={() => {
          void splittersQuery.refetch()
        }}
        isRefetching={splittersQuery.isRefetching}
        getMassivaStats={getMassivaStats}
        getOperationalScore={getOperationalScore}
        getTrendLabel={getTrendLabel}
      />
    </div>
  )
}







