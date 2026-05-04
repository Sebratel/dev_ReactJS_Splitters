import { useQuery } from '@tanstack/react-query'
import { fetchSplittersOperationalPriorityFromLocalDb } from '@/features/splitters/api/fetchSplittersOperationalPriorityFromLocalDb'
import type { SplittersFetchParams } from '@/features/splitters/api/fetchSplittersFromLocalDb'
import type { SplitterMaintenanceStats } from '@/features/splitters/api/fetchSplitterMaintenanceStatsFromLocalDb'
import type { Splitter } from '@/features/splitters/model/splitter'
import type { SplitterMassivaStats } from '@/features/splitters/model/splitterOperationalInsights'
import {
  type SplitterRiskSortEntry,
} from '@/features/splitters/lib/splitterOperationalPriorityCompare'
import { SPLITTERS_LIST_STALE_TIME_MS } from '@/features/splitters/model/constants'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'
import { useSplittersFiltersStore } from '@/features/splitters/store/useSplittersFiltersStore'

const EMPTY_MAINTENANCE: SplitterMaintenanceStats = {
  totalMaintenances: 0,
  uniqueProtocols: 0,
  uniqueClients: 0,
  openMaintenances: 0,
  rompimentoCount: 0,
  trocaFlatCount: 0,
  latestCreatedAt: null,
}

function splitterStubFromPriorityApi(s: {
  code: string
  title: string
  busyCount: number
  outPorts: number
}): Splitter {
  return {
    id: 0,
    code: s.code,
    integrationCode: '',
    title: s.title,
    outPorts: s.outPorts,
    active: true,
    typeText: '',
    description: '',
    latitude: '',
    longitude: '',
    street: null,
    networkBoxCode: null,
    networkBoxTitle: null,
    networkBoxType: null,
    oltCode: null,
    oltIntegrationCode: null,
    oltDescription: null,
    createdAt: null,
    busyCount: s.busyCount,
    tipoLocal: undefined,
    nomeCondominio: null,
  }
}

function reviveMassivaStats(raw: SplitterMassivaStats): SplitterMassivaStats {
  const lo = raw.latestOpenedAt as unknown
  let latestOpenedAt: Date | null = null
  if (lo instanceof Date) latestOpenedAt = lo
  else if (typeof lo === 'string' && lo.trim() !== '') {
    const d = new Date(lo)
    latestOpenedAt = Number.isNaN(d.getTime()) ? null : d
  }
  return { ...raw, latestOpenedAt }
}

export type OperationalPriorityQueueData = {
  entries: SplitterRiskSortEntry[]
  scannedCount: number
  truncated: boolean
  totalCountFiltered: number
  massivaSource?: string
}

/**
 * Uma única chamada ao BFF: prioridade operacional sobre todo o universo filtrado.
 * Massivas vêm do histórico MySQL no servidor (quando configurado), não do hub no browser.
 */
export function useSplittersOperationalPriorityQueue(options: {
  totalCount: number
  openMassivaSplitterCodes: string[]
  maintenanceSplitterCodes: string[]
  maintenanceStatsByCode: Map<string, SplitterMaintenanceStats>
  listReady: boolean
}) {
  const {
    totalCount,
    openMassivaSplitterCodes,
    maintenanceSplitterCodes,
    maintenanceStatsByCode,
    listReady,
  } = options

  const { state } = useSplittersFiltersStore()

  const withOpenMassiva =
    state.massivaOpenState === 'all'
      ? undefined
      : state.massivaOpenState === 'with-open'

  return useQuery({
    queryKey: [
      ...splittersKeys.operationalPriorityQueue(),
      state.searchQuery,
      state.oltCodes,
      state.primarySplitterTitles,
      state.splitterStatuses,
      state.streetSelections,
      state.citySelections,
      state.condominiumSelections,
      state.massivaOpenState,
      state.corporateClientFilter,
      openMassivaSplitterCodes,
      state.maintenanceFilter,
      maintenanceSplitterCodes,
      totalCount,
      maintenanceStatsByCode.size,
      state.maintenanceWindowDays,
    ],
    queryFn: async (): Promise<OperationalPriorityQueueData> => {
      if (totalCount <= 0) {
        return {
          entries: [],
          scannedCount: 0,
          truncated: false,
          totalCountFiltered: 0,
          massivaSource: undefined,
        }
      }

      const baseParams: Omit<SplittersFetchParams, 'page' | 'limit'> = {
        search: state.searchQuery,
        olts: state.oltCodes,
        primarySplitters: state.primarySplitterTitles,
        statuses: state.splitterStatuses,
        streets: state.streetSelections,
        cities: state.citySelections,
        condominiums: state.condominiumSelections,
        withOpenMassiva,
        openMassivaSplitterCodes,
        corporateClientFilter: state.corporateClientFilter,
        withMaintenance:
          state.maintenanceFilter === 'all'
            ? undefined
            : state.maintenanceFilter === 'with-maintenance',
        maintenanceSplitterCodes,
      }

      const api = await fetchSplittersOperationalPriorityFromLocalDb(baseParams)

      const entries: SplitterRiskSortEntry[] = api.data.map((row) => {
        const code = String(row.splitter.code ?? '').trim()
        const splitter = splitterStubFromPriorityApi(row.splitter)
        const massivaStats = reviveMassivaStats(row.massivaStats)
        return {
          splitter,
          massivaStats,
          maintenanceStats: maintenanceStatsByCode.get(code) ?? EMPTY_MAINTENANCE,
          operationalScore: row.operationalScore,
        }
      })

      return {
        entries,
        scannedCount: api.scannedCount,
        truncated: api.truncated,
        totalCountFiltered: api.totalCount,
        massivaSource: api.massivaSource,
      }
    },
    enabled: listReady && Number(totalCount) > 0,
    staleTime: SPLITTERS_LIST_STALE_TIME_MS,
  })
}
