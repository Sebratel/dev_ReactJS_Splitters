import { useCallback, useDeferredValue, useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMassivaRoutesFromLocalDb } from '@/features/massiva/api/fetchMassivaRoutesFromLocalDb'
import { buildMassivaLocalPreview } from '@/features/massiva/lib/buildMassivaLocalPreview'
import { buildMassivaOpeningBasis } from '@/features/massiva/lib/buildMassivaOpeningBasis'
import { buildMassivaOpeningPlanDraft } from '@/features/massiva/lib/buildMassivaOpeningPlanDraft'
import {
  buildMassivaRouteCatalogFromRows,
  listMassivaApCodes,
} from '@/features/massiva/lib/buildMassivaRouteCatalog'
import {
  massivaPreviewNormalizedRoutes,
} from '@/features/massiva/lib/massivaPreviewSelectionMaps'
import { getMassivaRouteSelectionIssues } from '@/features/massiva/lib/validateMassivaRouteSelection'
import type { MassivaOpeningPreparationView } from '@/features/massiva/model/massivaOpeningBasis'
import type {
  MassivaLocalPreviewRouteSelection,
  MassivaLocalPreviewViewState,
  MassivaRouteConnectionSelection,
  MassivaSelectedSplitter,
} from '@/features/massiva/model/massivaLocalPreview'
import { useMassivaOpenDraftStore } from '@/features/massiva/store/massivaOpenDraftStore'
import { useMassivaPreviewSelectionStore } from '@/features/massiva/store/massivaPreviewSelectionStore'
import { fetchMassivaConnectionsFromLocalDbByRoutes } from '@/features/splitters/api/fetchSplitterConnectionsFromLocalDb'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import { SPLITTERS_CONNECTIONS_STALE_TIME_MS } from '@/features/splitters/model/constants'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

type CatalogRouteEntry = {
  apCode: string
  slot: number
  port: number
  splitterCode: string
}

type SplitterOption = { code: string; label: string }
type SlotPortOption = { slot: number; port: number }

type ConnectionFilters = {
  apCode: string | null
  slot: number | null
  port: number | null
  splitterCodes: string[]
}

function sortStrings(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

function sortNumbers(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((a, b) => a - b)
}

function normalizeSplitterCodes(connection: MassivaRouteConnectionSelection): string[] {
  return sortStrings(
    connection.splitters
      .map((splitter) => splitter.id.trim())
      .filter((id) => id !== ''),
  )
}

function connectionToFilters(
  connection: MassivaRouteConnectionSelection,
): ConnectionFilters {
  const apCode = connection.apId.trim()
  return {
    apCode: apCode !== '' ? apCode : null,
    slot: connection.slot,
    port: connection.porta,
    splitterCodes: normalizeSplitterCodes(connection),
  }
}

function matchesFilters(
  entry: CatalogRouteEntry,
  filters: ConnectionFilters,
): boolean {
  if (filters.apCode !== null && entry.apCode !== filters.apCode) return false
  if (filters.slot !== null && entry.slot !== filters.slot) return false
  if (filters.port !== null && entry.port !== filters.port) return false
  if (
    filters.splitterCodes.length > 0 &&
    !filters.splitterCodes.includes(entry.splitterCode)
  ) {
    return false
  }
  return true
}

/**
 * Preview local de afetados - `listarConnections` + catalogo em memoria (sem middleware / sem mutacao).
 */
export function useMassivaLocalPreview(options?: {
  enableImpactComputation?: boolean
}): {
  view: MassivaLocalPreviewViewState
  openingPreparation: MassivaOpeningPreparationView
  apCodes: string[]
  selection: MassivaLocalPreviewRouteSelection
  addConnection: () => void
  removeConnection: (index: number) => void
  setConnectionAp: (index: number, ap: string | null) => void
  setConnectionSlot: (index: number, slot: number | null) => void
  setConnectionPorta: (index: number, porta: number | null) => void
  toggleConnectionSplitter: (index: number, splitter: MassivaSelectedSplitter) => void
  clearConnectionSplitters: (index: number) => void
  setConnections: (connections: MassivaRouteConnectionSelection[]) => void
  clearRoute: () => void
  apOptionsForConnection: (connection: MassivaRouteConnectionSelection) => string[]
  slotOptionsForConnection: (connection: MassivaRouteConnectionSelection) => number[]
  portOptionsForConnection: (connection: MassivaRouteConnectionSelection) => number[]
  slotPortOptionsForConnection: (
    connection: MassivaRouteConnectionSelection,
  ) => SlotPortOption[]
  searchSplitterOptionsForConnection: (
    connection: MassivaRouteConnectionSelection,
    search: string,
    limit?: number,
  ) => SplitterOption[]
  apDisplayLabel: (code: string) => string
  findRoutesBySplitterCode: (
    splitterCode: string,
    limit?: number,
  ) => Array<{ apCode: string; apLabel: string; slot: number; port: number }>
  refetchConnections: () => void
  connections: SplitterCliente[]
  isApplyingFilters: boolean
  isConnectionsLoading: boolean
  /** `GET /api/massiva/routes` ainda nao concluiu — AP/slot/splitters no catalogo ainda vazios. */
  isRoutesCatalogPending: boolean
  isRoutesCatalogError: boolean
  refetchRoutesCatalog: () => void
  previewDebug: {
    apForConnections: string | null
    connectionsCount: number
    selectedRoutesCount: number
    selectedAps: string[]
    selectedSplitterCodes: string[]
    matchedBySelectedSplitters: number
    mergedAfterTopologyFilters: number
  }
} {
  const enableImpactComputation = options?.enableImpactComputation ?? true
  const connectionsSelection = useMassivaPreviewSelectionStore(
    (state) => state.connections,
  )
  const selection = useMemo<MassivaLocalPreviewRouteSelection>(
    () => ({ connections: connectionsSelection }),
    [connectionsSelection],
  )
  const deferredSelection = useDeferredValue(selection)
  const addConnection = useMassivaPreviewSelectionStore((state) => state.addConnection)
  const removeConnection = useMassivaPreviewSelectionStore((state) => state.removeConnection)
  const setConnectionApRaw = useMassivaPreviewSelectionStore((state) => state.setConnectionAp)
  const setConnectionSlot = useMassivaPreviewSelectionStore((state) => state.setConnectionSlot)
  const setConnectionPorta = useMassivaPreviewSelectionStore((state) => state.setConnectionPorta)
  const toggleConnectionSplitter = useMassivaPreviewSelectionStore(
    (state) => state.toggleConnectionSplitter,
  )
  const clearConnectionSplitters = useMassivaPreviewSelectionStore(
    (state) => state.clearConnectionSplitters,
  )
  const setConnections = useMassivaPreviewSelectionStore((state) => state.setConnections)
  const clearRouteSelection = useMassivaPreviewSelectionStore((state) => state.clearRoute)

  const setAffectedUsersQuantityAutoIspOverride = useMassivaOpenDraftStore(
    (state) => state.setAffectedUsersQuantityAutoIspOverride,
  )

  const clearRoute = () => {
    clearRouteSelection()
    setAffectedUsersQuantityAutoIspOverride(null)
  }

  const routesQuery = useQuery({
    queryKey: ['massiva', 'routes'],
    queryFn: () => fetchMassivaRoutesFromLocalDb(),
    staleTime: SPLITTERS_CONNECTIONS_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  })

  const catalog = useMemo(
    () => buildMassivaRouteCatalogFromRows(routesQuery.data ?? []),
    [routesQuery.data],
  )

  const routeEntries = useMemo<CatalogRouteEntry[]>(() => {
    const entries: CatalogRouteEntry[] = []

    for (const [apCode, bySlot] of catalog.splitters.entries()) {
      for (const [slot, byPort] of bySlot.entries()) {
        for (const [port, splitters] of byPort.entries()) {
          for (const splitterCode of splitters.values()) {
            entries.push({
              apCode,
              slot,
              port,
              splitterCode,
            })
          }
        }
      }
    }

    return entries
  }, [catalog])

  const apCodes = useMemo(() => listMassivaApCodes(catalog), [catalog])

  const normalizedRoutes = useMemo(
    () => massivaPreviewNormalizedRoutes(deferredSelection),
    [deferredSelection],
  )
  const topologySelection = useMemo(() => {
    const selectedApsSet = new Set<string>()
    const portsByApSlot = new Map<string, Map<number, Set<number>>>()
    const explicit = new Map<string, Map<number, Map<number, Set<string>>>>()

    for (const route of normalizedRoutes) {
      selectedApsSet.add(route.apCode)

      if (!portsByApSlot.has(route.apCode)) portsByApSlot.set(route.apCode, new Map())
      const bySlot = portsByApSlot.get(route.apCode)!
      if (!bySlot.has(route.slot)) bySlot.set(route.slot, new Set())
      bySlot.get(route.slot)!.add(route.port)

      if (route.splitterCodes.length > 0) {
        if (!explicit.has(route.apCode)) explicit.set(route.apCode, new Map())
        const explicitBySlot = explicit.get(route.apCode)!
        if (!explicitBySlot.has(route.slot)) explicitBySlot.set(route.slot, new Map())
        explicitBySlot.get(route.slot)!.set(route.port, new Set(route.splitterCodes))
      }
    }

    const selectedAps = [...selectedApsSet].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return {
      selectedAps,
      portsByApSlot,
      explicitSplittersByRoute: explicit.size > 0 ? explicit : undefined,
    }
  }, [normalizedRoutes])

  const hasCompleteRoutes = normalizedRoutes.length > 0
  const isApplyingFilters = deferredSelection !== selection

  const massivaBatchQueryKey = useMemo(
    () => [
      ...splittersKeys.connections(),
      'massiva-batch',
      ...normalizedRoutes.map(
        (r) => `${r.apCode}|${r.slot}|${r.port}|${r.splitterCodes.join(',')}`,
      ),
    ],
    [normalizedRoutes],
  )

  const connectionsQuery = useQuery({
    queryKey: massivaBatchQueryKey,
    queryFn: () => fetchMassivaConnectionsFromLocalDbByRoutes(normalizedRoutes),
    staleTime: SPLITTERS_CONNECTIONS_STALE_TIME_MS,
    // Prefetch no passo Splitters (batch leve); o banner de loading só em validação/abertura.
    enabled: hasCompleteRoutes,
    refetchOnWindowFocus: false,
  })
  const isConnectionsLoading =
    routesQuery.isPending ||
    (enableImpactComputation && hasCompleteRoutes && connectionsQuery.isPending)

  const apDisplayLabel = useCallback((code: string): string => {
    const title = catalog.apTitles.get(code)?.trim() ?? ''
    return title !== '' ? title : code
  }, [catalog])

  const findRoutesBySplitterCode = useCallback((
    splitterCode: string,
    limit = 10,
  ): Array<{ apCode: string; apLabel: string; slot: number; port: number }> => {
    const normalized = splitterCode.trim().toLowerCase()
    if (normalized === '') return []
    const unique = new Map<string, { apCode: string; apLabel: string; slot: number; port: number }>()
    for (const entry of routeEntries) {
      if (entry.splitterCode.trim().toLowerCase() !== normalized) continue
      const key = `${entry.apCode}|${entry.slot}|${entry.port}`
      if (unique.has(key)) continue
      unique.set(key, {
        apCode: entry.apCode,
        apLabel: apDisplayLabel(entry.apCode),
        slot: entry.slot,
        port: entry.port,
      })
      if (unique.size >= limit) break
    }
    return [...unique.values()].sort((a, b) =>
      a.apCode !== b.apCode
        ? a.apCode.localeCompare(b.apCode, 'pt-BR')
        : a.slot !== b.slot
          ? a.slot - b.slot
          : a.port - b.port,
    )
  }, [apDisplayLabel, routeEntries])

  const setConnectionAp = (index: number, apCode: string | null) => {
    const normalized = (apCode ?? '').trim()
    const label = normalized !== '' ? apDisplayLabel(normalized) : ''
    setConnectionApRaw(index, normalized === '' ? null : normalized, label)
  }

  const apOptionsCacheRef = useRef<Map<string, string[]>>(new Map())
  const slotOptionsCacheRef = useRef<Map<string, number[]>>(new Map())
  const portOptionsCacheRef = useRef<Map<string, number[]>>(new Map())
  const slotPortOptionsCacheRef = useRef<Map<string, SlotPortOption[]>>(new Map())
  const splitterSearchCacheRef = useRef<Map<string, SplitterOption[]>>(new Map())

  useEffect(() => {
    apOptionsCacheRef.current.clear()
    slotOptionsCacheRef.current.clear()
    portOptionsCacheRef.current.clear()
    slotPortOptionsCacheRef.current.clear()
    splitterSearchCacheRef.current.clear()
  }, [routeEntries, catalog])

  const apOptionsForConnection = (
    connection: MassivaRouteConnectionSelection,
  ): string[] => {
    const filters = connectionToFilters(connection)
    const cacheKey = `${filters.slot ?? '*'}|${filters.port ?? '*'}|${filters.splitterCodes.join(',')}`
    const cached = apOptionsCacheRef.current.get(cacheKey)
    if (cached) return cached

    const filtered = routeEntries.filter((entry) =>
      matchesFilters(entry, {
        apCode: null,
        slot: filters.slot,
        port: filters.port,
        splitterCodes: filters.splitterCodes,
      }),
    )

    const options = sortStrings(filtered.map((entry) => entry.apCode))
    apOptionsCacheRef.current.set(cacheKey, options)
    return options
  }

  const slotOptionsForConnection = (
    connection: MassivaRouteConnectionSelection,
  ): number[] => {
    const filters = connectionToFilters(connection)
    const cacheKey = `${filters.apCode ?? '*'}|${filters.port ?? '*'}|${filters.splitterCodes.join(',')}`
    const cached = slotOptionsCacheRef.current.get(cacheKey)
    if (cached) return cached

    const filtered = routeEntries.filter((entry) =>
      matchesFilters(entry, {
        apCode: filters.apCode,
        slot: null,
        port: filters.port,
        splitterCodes: filters.splitterCodes,
      }),
    )

    const options = sortNumbers(filtered.map((entry) => entry.slot))
    slotOptionsCacheRef.current.set(cacheKey, options)
    return options
  }

  const portOptionsForConnection = (
    connection: MassivaRouteConnectionSelection,
  ): number[] => {
    const filters = connectionToFilters(connection)
    const cacheKey = `${filters.apCode ?? '*'}|${filters.slot ?? '*'}|${filters.splitterCodes.join(',')}`
    const cached = portOptionsCacheRef.current.get(cacheKey)
    if (cached) return cached

    const filtered = routeEntries.filter((entry) =>
      matchesFilters(entry, {
        apCode: filters.apCode,
        slot: filters.slot,
        port: null,
        splitterCodes: filters.splitterCodes,
      }),
    )

    const options = sortNumbers(filtered.map((entry) => entry.port))
    portOptionsCacheRef.current.set(cacheKey, options)
    return options
  }

  const slotPortOptionsForConnection = (
    connection: MassivaRouteConnectionSelection,
  ): SlotPortOption[] => {
    const filters = connectionToFilters(connection)
    const cacheKey = `${filters.apCode ?? '*'}|${filters.splitterCodes.join(',')}`
    const cached = slotPortOptionsCacheRef.current.get(cacheKey)
    if (cached) return cached

    const filtered = routeEntries.filter((entry) =>
      matchesFilters(entry, {
        apCode: filters.apCode,
        slot: null,
        port: null,
        splitterCodes: filters.splitterCodes,
      }),
    )

    const pairsMap = new Map<string, SlotPortOption>()
    for (const entry of filtered) {
      const key = `${entry.slot}|${entry.port}`
      if (!pairsMap.has(key)) {
        pairsMap.set(key, { slot: entry.slot, port: entry.port })
      }
    }

    const options = [...pairsMap.values()].sort((a, b) =>
      a.slot !== b.slot ? a.slot - b.slot : a.port - b.port,
    )
    slotPortOptionsCacheRef.current.set(cacheKey, options)
    return options
  }

  const selectionIssues = useMemo(
    () => getMassivaRouteSelectionIssues(deferredSelection, apCodes.length, catalog),
    [deferredSelection, apCodes.length, catalog],
  )

  const preparedComputation = useMemo(() => {
    if (!enableImpactComputation) return null
    if (routesQuery.isPending || (hasCompleteRoutes && connectionsQuery.isPending)) {
      return null
    }
    if (routesQuery.isError || (hasCompleteRoutes && connectionsQuery.isError)) {
      return null
    }
    if (selectionIssues.length > 0) return null

    const allConnections = connectionsQuery.data ?? []
    const basis = buildMassivaOpeningBasis(
      deferredSelection,
      catalog,
      allConnections,
      apDisplayLabel,
    )
    const plan = buildMassivaOpeningPlanDraft(basis)
    return {
      basis,
      plan,
      sampleClientes: basis.collectedClientes.slice(0, 12),
    }
  }, [
    enableImpactComputation,
    routesQuery.isPending,
    routesQuery.isError,
    hasCompleteRoutes,
    connectionsQuery.isPending,
    connectionsQuery.isError,
    connectionsQuery.data,
    selectionIssues,
    deferredSelection,
    catalog,
    apDisplayLabel,
  ])

  const searchSplitterOptionsForConnection = (
    connection: MassivaRouteConnectionSelection,
    search: string,
    limit = 60,
  ): SplitterOption[] => {
    const searchToken = search.trim().toLowerCase()
    if (searchToken === '') return []

    const filters = connectionToFilters(connection)
    // Evita varrer o catálogo inteiro quando a rota ainda não está completa.
    if (filters.apCode === null || filters.slot === null || filters.port === null) {
      return []
    }
    const cacheKey = `${filters.apCode ?? '*'}|${filters.slot ?? '*'}|${filters.port ?? '*'}|${searchToken}|${limit}`
    const cached = splitterSearchCacheRef.current.get(cacheKey)
    if (cached) return cached

    const filtered = routeEntries.filter((entry) =>
      matchesFilters(entry, {
        apCode: filters.apCode,
        slot: filters.slot,
        port: filters.port,
        splitterCodes: [],
      }),
    )

    const byCode = new Map<string, SplitterOption>()
    for (const entry of filtered) {
      const code = entry.splitterCode
      const label = catalog.splitterTitles.get(code)?.trim() || code
      const haystack = `${code} ${label}`.toLowerCase()
      if (!haystack.includes(searchToken)) continue
      if (!byCode.has(code)) {
        byCode.set(code, { code, label })
      }
      if (byCode.size >= limit) break
    }

    const options = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'))
    splitterSearchCacheRef.current.set(cacheKey, options)
    return options
  }

  const view: MassivaLocalPreviewViewState = useMemo(() => {
    if (!enableImpactComputation) {
      return {
        status: 'empty-selection',
        totals: { totalAffected: 0, totalPppoes: 0, totalCorporateAffected: 0 },
      }
    }

    if (routesQuery.isPending || (hasCompleteRoutes && connectionsQuery.isPending)) {
      return { status: 'connections-loading' }
    }

    if (routesQuery.isError) {
      return { status: 'connections-error', error: routesQuery.error }
    }

    if (hasCompleteRoutes && connectionsQuery.isError) {
      return { status: 'connections-error', error: connectionsQuery.error }
    }

    if (selectionIssues.length > 0) {
      return { status: 'incomplete', message: selectionIssues.join(' ') }
    }

    const totals =
      preparedComputation?.basis.previewTotals ??
      { totalAffected: 0, totalPppoes: 0, totalCorporateAffected: 0 }
    const sampleClientes = preparedComputation?.sampleClientes ?? []

    if (totals.totalAffected === 0 && totals.totalPppoes === 0) {
      return {
        status: 'empty-selection',
        totals,
      }
    }

    return {
      status: 'success',
      totals,
      sampleClientes,
    }
  }, [
    routesQuery.isPending,
    routesQuery.isError,
    routesQuery.error,
    hasCompleteRoutes,
    connectionsQuery.isPending,
    connectionsQuery.isError,
    connectionsQuery.error,
    enableImpactComputation,
    selectionIssues,
    preparedComputation,
  ])

  const openingPreparation: MassivaOpeningPreparationView = useMemo(() => {
    if (!enableImpactComputation) {
      return { status: 'unavailable', reason: 'connections-loading' }
    }

    if (routesQuery.isPending || (hasCompleteRoutes && connectionsQuery.isPending)) {
      return { status: 'unavailable', reason: 'connections-loading' }
    }

    if (routesQuery.isError) {
      return {
        status: 'unavailable',
        reason: 'connections-error',
        error: routesQuery.error,
      }
    }

    if (hasCompleteRoutes && connectionsQuery.isError) {
      return {
        status: 'unavailable',
        reason: 'connections-error',
        error: connectionsQuery.error,
      }
    }

    if (selectionIssues.length > 0) {
      return { status: 'invalid', issues: selectionIssues }
    }

    if (!preparedComputation) {
      return { status: 'unavailable', reason: 'connections-loading' }
    }

    return {
      status: 'prepared',
      basis: preparedComputation.basis,
      plan: preparedComputation.plan,
    }
  }, [
    routesQuery.isPending,
    routesQuery.isError,
    routesQuery.error,
    hasCompleteRoutes,
    connectionsQuery.isPending,
    connectionsQuery.isError,
    connectionsQuery.error,
    enableImpactComputation,
    selectionIssues,
    preparedComputation,
  ])

  const previewDebug = useMemo(() => {
    const allConnections = connectionsQuery.data ?? []
    const selectedAps = topologySelection.selectedAps
    const selectedSplitterCodes = [...new Set(
      normalizedRoutes.flatMap((route) => route.splitterCodes),
    )].sort((a, b) => a.localeCompare(b, 'pt-BR'))

    // Evita custo alto de debug durante seleção normal de rotas.
    if (!import.meta.env.DEV || view.status !== 'empty-selection') {
      return {
        apForConnections: null,
        connectionsCount: allConnections.length,
        selectedRoutesCount: normalizedRoutes.length,
        selectedAps,
        selectedSplitterCodes,
        matchedBySelectedSplitters: allConnections.length,
        mergedAfterTopologyFilters: allConnections.length,
      }
    }

    const portsByApSlot = topologySelection.portsByApSlot
    const explicit = topologySelection.explicitSplittersByRoute
    const mergedAfterTopologyFilters = buildMassivaLocalPreview(
      selectedAps,
      portsByApSlot,
      explicit,
      catalog,
      allConnections,
      1,
    ).totals.totalAffected

    return {
      apForConnections: null,
      connectionsCount: allConnections.length,
      selectedRoutesCount: normalizedRoutes.length,
      selectedAps,
      selectedSplitterCodes,
      matchedBySelectedSplitters: allConnections.length,
      mergedAfterTopologyFilters,
    }
  }, [connectionsQuery.data, normalizedRoutes, catalog, view.status, topologySelection])

  const refetchConnections = () => {
    void routesQuery.refetch()
    void connectionsQuery.refetch()
  }

  const refetchRoutesCatalog = () => {
    void routesQuery.refetch()
  }

  return {
    view,
    openingPreparation,
    apCodes,
    selection,
    addConnection,
    removeConnection,
    setConnectionAp,
    setConnectionSlot,
    setConnectionPorta,
    toggleConnectionSplitter,
    clearConnectionSplitters,
    setConnections,
    clearRoute,
    apOptionsForConnection,
    slotOptionsForConnection,
    portOptionsForConnection,
    slotPortOptionsForConnection,
    searchSplitterOptionsForConnection,
    apDisplayLabel,
    findRoutesBySplitterCode,
    refetchConnections,
    connections: connectionsQuery.data ?? [],
    isApplyingFilters,
    isConnectionsLoading,
    isRoutesCatalogPending: routesQuery.isPending,
    isRoutesCatalogError: routesQuery.isError,
    refetchRoutesCatalog,
    previewDebug,
  }
}
