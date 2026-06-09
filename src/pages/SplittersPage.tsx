import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import { Filter, Network, Search, X } from 'lucide-react'
import { useOperationalMassivaTickets } from '@/features/massiva/hooks/useOperationalMassivaTickets'
import { useOpenMassivaSplitterCodesForFilter } from '@/features/splitters/hooks/useOpenMassivaSplitterCodesForFilter'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { findMassivaStatsForSplitter } from '@/features/splitters/lib/buildMassivaStatsBySplitter'
import { mergeSplitterMassivaStats } from '@/features/splitters/lib/mergeSplitterMassivaStats'
import { buildSplitterOperationalScore } from '@/features/splitters/lib/buildSplitterOperationalScore'
import { useSplittersOperationalPriorityQueue } from '@/features/splitters/hooks/useSplittersOperationalPriorityQueue'
import { useSplittersNetworkReliefQueue } from '@/features/splitters/hooks/useSplittersNetworkReliefQueue'
import { useSplittersList } from '@/features/splitters/hooks/useSplittersList'
import { useAccessPointsForFilters } from '@/features/splitters/hooks/useAccessPointsForFilters'
import { useSplitterMassivaStatsFromLocalDb } from '@/features/splitters/hooks/useSplitterMassivaStatsFromLocalDb'
import { useSplitterTrendsFromLocalDb } from '@/features/splitters/hooks/useSplitterTrendsFromLocalDb'
import {
  type SplitterMaintenanceStats,
} from '@/features/splitters/api/fetchSplitterMaintenanceStatsFromLocalDb'
import {
  fetchMaintenanceBySplitter,
} from '@/features/intelligence/api/fetchMaintenanceBySplitter'
import type { Splitter } from '@/features/splitters/model/splitter'
import { SplittersList } from '@/features/splitters/ui/SplittersList'
import { SplittersOperationalPriorityFab } from '@/features/splitters/ui/SplittersOperationalPriorityFab'
import { SplittersFiltersDrawer } from '@/features/splitters/ui/SplittersFiltersDrawer'
import { useSplittersFiltersStore } from '@/features/splitters/store/useSplittersFiltersStore'
import { countActiveSplittersFilters } from '@/features/splitters/model/splittersListFilters'
import { SPLITTER_STATUS_LABEL } from '@/features/splitters/model/splitterStatus'
import {
  compareByRisk,
  occupancyPercent,
} from '@/features/splitters/lib/splitterOperationalPriorityCompare'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import { ResponsiveWrapper } from '@/shared/ui/ResponsiveWrapper'
import { cn } from '@/shared/lib/utils'
import type { SplitterMassivaStats, SplitterOperationalScore } from '@/features/splitters/model/splitterOperationalInsights'

type SplittersSortMode =
  | 'risk-desc'
  | 'risk-asc'
  | 'maintenance-desc'
  | 'maintenance-asc'
  | 'occupancy-desc'
  | 'occupancy-asc'
  | 'code-asc'
  | 'code-desc'

type SplitterListEntry = {
  splitter: Splitter
  massivaStats: SplitterMassivaStats
  maintenanceStats: SplitterMaintenanceStats
  operationalScore: SplitterOperationalScore
  trendLabel: string
}

const SPLITTERS_PAGE_UI_STATE_KEY = 'nexaview.splitters.page-ui.v1'

function readSplittersPageUiState(): {
  filtersOpen: boolean
  sortMode: SplittersSortMode
} {
  if (typeof window === 'undefined') {
    return { filtersOpen: false, sortMode: 'risk-desc' }
  }
  try {
    const raw = window.sessionStorage.getItem(SPLITTERS_PAGE_UI_STATE_KEY)
    if (!raw) return { filtersOpen: false, sortMode: 'risk-desc' }
    const parsed = JSON.parse(raw) as { filtersOpen?: unknown; sortMode?: unknown }
    const sortMode = typeof parsed.sortMode === 'string'
      ? parsed.sortMode as SplittersSortMode
      : 'risk-desc'
    const filtersOpen = parsed.filtersOpen === true
    return { filtersOpen, sortMode }
  } catch {
    return { filtersOpen: false, sortMode: 'risk-desc' }
  }
}

export function SplittersPage() {
  const outletContext = useOutletContext<{
    sidebarCollapsed?: boolean
    mobileNavOpen?: boolean
  } | undefined>()
  const sidebarCollapsed = outletContext?.sidebarCollapsed ?? false
  const mobileNavOpen = outletContext?.mobileNavOpen ?? false
  const reduceMotion = useReducedMotion()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pageUiState, setPageUiState] = useState(readSplittersPageUiState)
  const { filtersOpen, sortMode } = pageUiState
  const setFiltersOpen = (value: boolean) =>
    setPageUiState((prev) => ({ ...prev, filtersOpen: value }))
  const setSortMode = (value: SplittersSortMode) =>
    setPageUiState((prev) => ({ ...prev, sortMode: value }))
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
    setMaintenanceFilter,
    clearAll,
    setOltSlot,
    setOltPort,
  } = useSplittersFiltersStore()
  const { data: accessPoints } = useAccessPointsForFilters()
  const canViewMassiva = useAccessAuthStore((s) => s.hasPermission('canViewMassiva'))
  const operationalMassiva = useOperationalMassivaTickets({ enabled: canViewMassiva })

  const oltLabelByCode = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of accessPoints ?? []) {
      m.set(o.code, o.title || o.code)
    }
    return m
  }, [accessPoints])

  const openMassivaFilter = useOpenMassivaSplitterCodesForFilter({
    enabled: canViewMassiva,
    massivaOpenState: state.massivaOpenState,
    operationalMassiva,
  })
  const openMassivaSplitterCodes = openMassivaFilter.codes
  const massivaOpenFilterReady = openMassivaFilter.ready

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
    if (state.maintenanceFilter === 'with-maintenance') {
      chips.push({
        key: 'maintenance:with',
        label: `Manutenção: com ocorrências (${state.maintenanceWindowDays}d)`,
        onRemove: () => setMaintenanceFilter('all'),
      })
    }
    const hasOltSlot = typeof state.oltSlot === 'number' && Number.isFinite(state.oltSlot)
    const hasOltPort = typeof state.oltPort === 'number' && Number.isFinite(state.oltPort)
    if (hasOltSlot || hasOltPort) {
      const slotPart = hasOltSlot ? `slot ${state.oltSlot}` : null
      const portPart = hasOltPort ? `PON ${state.oltPort}` : null
      const ponLabel = [slotPart, portPart].filter(Boolean).join(' · ')
      chips.push({
        key: 'olt-pon',
        label: `OLT PON: ${ponLabel}`,
        onRemove: () => {
          setOltSlot(null)
          setOltPort(null)
        },
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
    state.maintenanceFilter,
    state.maintenanceWindowDays,
    state.oltSlot,
    state.oltPort,
    setOltSlot,
    setOltPort,
  ])

  const activeFilterCount = countActiveSplittersFilters(state)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(
      SPLITTERS_PAGE_UI_STATE_KEY,
      JSON.stringify(pageUiState),
    )
  }, [pageUiState])

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
    state.maintenanceFilter,
    state.maintenanceWindowDays,
    state.oltSlot,
    state.oltPort,
  ])

  const maintenanceWindow = useMemo(() => {
    const end = new Date()
    const start = new Date(end.getTime() - (state.maintenanceWindowDays - 1) * 24 * 60 * 60 * 1000)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }, [state.maintenanceWindowDays])
  const maintenanceUniverseQuery = useQuery({
    queryKey: [
      'splitters-maintenance-universe',
      state.maintenanceWindowDays,
      maintenanceWindow.start.toISOString(),
      maintenanceWindow.end.toISOString(),
    ],
    queryFn: () => fetchMaintenanceBySplitter(maintenanceWindow.start, maintenanceWindow.end),
    staleTime: 5 * 60_000,
    refetchInterval: false,
  })
  const maintenanceStatsByCode = useMemo(() => {
    const map = new Map<string, SplitterMaintenanceStats>()
    for (const row of maintenanceUniverseQuery.data?.rows ?? []) {
      const code = String(row.splitterCode ?? '').trim()
      if (code === '' || code === 'SEM_MAPEAMENTO') continue
      map.set(code, {
        totalMaintenances: row.totalMaintenances,
        uniqueProtocols: row.uniqueProtocols,
        uniqueClients: row.uniqueClients,
        openMaintenances: row.openMaintenances,
        rompimentoCount: row.rompimentoCount,
        trocaFlatCount: row.trocaFlatCount,
        latestCreatedAt: row.latestCreatedAt,
      })
    }
    return map
  }, [maintenanceUniverseQuery.data?.rows])
  const maintenanceSplitterCodes = useMemo(
    () => [...maintenanceStatsByCode.keys()],
    [maintenanceStatsByCode],
  )

  const splittersQuery = useSplittersList(page, {
    openMassivaSplitterCodes,
    maintenanceSplitterCodes:
      state.maintenanceFilter === 'with-maintenance' ? maintenanceSplitterCodes : [],
    enabled: massivaOpenFilterReady,
  })

  const splittersTotalCount = splittersQuery.data?.totalCount ?? 0
  /** Não depender só de `isSuccess`: ao voltar da rota do splitter a lista pode refetch com dados em placeholder. */
  const splittersListReadyForPriorityFab =
    splittersTotalCount > 0 && Boolean(splittersQuery.data) && !splittersQuery.isError

  const operationalPriorityQuery = useSplittersOperationalPriorityQueue({
    totalCount: splittersTotalCount,
    openMassivaSplitterCodes,
    maintenanceSplitterCodes:
      state.maintenanceFilter === 'with-maintenance' ? maintenanceSplitterCodes : [],
    maintenanceStatsByCode,
    listReady: splittersListReadyForPriorityFab,
    massivaFilterReady: massivaOpenFilterReady,
  })

  const networkReliefQueueQuery = useSplittersNetworkReliefQueue({
    enabled: splittersListReadyForPriorityFab,
  })

  const items = useMemo(
    () => splittersQuery.data?.items ?? [],
    [splittersQuery.data?.items],
  )
  const totalCount = splittersTotalCount

  const localMassivaStatsQuery = useSplitterMassivaStatsFromLocalDb(
    items.map((splitter) => String(splitter.code ?? '')),
  )
  const localTrendsQuery = useSplitterTrendsFromLocalDb(
    items.map((splitter) => String(splitter.code ?? '')),
  )
  const entries = useMemo<SplitterListEntry[]>(() => {
    return items.map((splitter) => {
      const code = String(splitter.code ?? '')
      const localMassiva = localMassivaStatsQuery.data?.get(code)
      const fromTickets = findMassivaStatsForSplitter(
        operationalMassiva.statsByMatcher,
        code,
        String(splitter.title ?? ''),
      )
      const massivaStats = mergeSplitterMassivaStats(localMassiva, fromTickets)
      const operationalScore = buildSplitterOperationalScore(splitter, massivaStats)
      const trendLabel =
        localTrendsQuery.data?.get(code)?.label ?? 'Estável'
      return {
        splitter,
        massivaStats,
        maintenanceStats: maintenanceStatsByCode.get(code) ?? {
          totalMaintenances: 0,
          uniqueProtocols: 0,
          uniqueClients: 0,
          openMaintenances: 0,
          rompimentoCount: 0,
          trocaFlatCount: 0,
          latestCreatedAt: null,
        },
        operationalScore,
        trendLabel,
      }
    })
  }, [items, localMassivaStatsQuery.data, localTrendsQuery.data, operationalMassiva.statsByMatcher, maintenanceStatsByCode])

  const orderedEntries = useMemo(() => {
    const next = [...entries]
    next.sort((a, b) => {
      switch (sortMode) {
        case 'risk-desc':
          return compareByRisk(a, b)
        case 'risk-asc':
          return compareByRisk(b, a)
        case 'maintenance-desc':
          return (
            b.maintenanceStats.totalMaintenances - a.maintenanceStats.totalMaintenances ||
            compareByRisk(a, b)
          )
        case 'maintenance-asc':
          return (
            a.maintenanceStats.totalMaintenances - b.maintenanceStats.totalMaintenances ||
            compareByRisk(a, b)
          )
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

  const getMaintenanceStats = (splitter: Splitter) =>
    maintenanceStatsByCode.get(String(splitter.code ?? '')) ?? {
      totalMaintenances: 0,
      uniqueProtocols: 0,
      uniqueClients: 0,
      openMaintenances: 0,
      rompimentoCount: 0,
      trocaFlatCount: 0,
      latestCreatedAt: null,
    }

  const showSummary =
    !splittersQuery.isPending &&
    !splittersQuery.isError &&
    totalCount > 0

  return (
    <ResponsiveWrapper className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <AppPageHeader
        icon={Network}
        badge="Infraestrutura"
        title="Splitters"
        description="Gerenciamento de infraestrutura secundária com carregamento inteligente e grade de visualização rápida."
        trailing={
          showSummary ? (
            <div className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-neutral-200/90 bg-white/90 px-4 py-3 shadow-sm sm:w-auto sm:max-w-[min(100%,20rem)]">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                <span className="absolute h-2 w-2 rounded-full bg-amber-600" />
                <span className="h-2 w-2 rounded-full bg-amber-500/40 animate-ping" aria-hidden />
              </div>
              <p className="text-sm text-neutral-600">
                Total de{' '}
                <span className="font-semibold tabular-nums text-neutral-900">{totalCount}</span> equipamentos
              </p>
            </div>
          ) : null
        }
      />

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
                <option value="maintenance-desc">Maior manutenção</option>
                <option value="maintenance-asc">Menor manutenção</option>
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
                onClick={() => {
                  clearAll()
                  setMaintenanceFilter('all')
                }}
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

      <SplittersOperationalPriorityFab
        enabled={splittersTotalCount > 0 && Boolean(splittersQuery.data) && !splittersQuery.isError}
        totalCount={totalCount}
        reduceMotion={reduceMotion}
        operationalQuery={operationalPriorityQuery}
        reliefQueueQuery={networkReliefQueueQuery}
        filtersDrawerOpen={filtersOpen}
        sidebarCollapsed={sidebarCollapsed}
        mobileNavOpen={mobileNavOpen}
      />

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
        getMaintenanceStats={getMaintenanceStats}
        getOperationalScore={getOperationalScore}
        getTrendLabel={getTrendLabel}
      />
    </ResponsiveWrapper>
  )
}







