import { useQuery } from '@tanstack/react-query'
import { fetchSplittersFromLocalDb } from '@/features/splitters/api/fetchSplittersFromLocalDb'
import { SPLITTERS_LIST_STALE_TIME_MS } from '@/features/splitters/model/constants'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'
import { useSplittersFiltersStore } from '@/features/splitters/store/useSplittersFiltersStore'

type UseSplittersListMassivaOptions = {
  openMassivaSplitterCodes?: string[]
}

/**
 * Lista de splitters vinda diretamente do banco de dados operacional.
 * Consome o estado global de filtros e página.
 */
export function useSplittersList(
  page: number = 1,
  options?: UseSplittersListMassivaOptions,
) {
  const { state } = useSplittersFiltersStore()
  const openMassivaSplitterCodes = options?.openMassivaSplitterCodes ?? []
  const withOpenMassiva =
    state.massivaOpenState === 'all'
      ? undefined
      : state.massivaOpenState === 'with-open'
  
  return useQuery({
    queryKey: [
      ...splittersKeys.list(),
      page,
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
    ],
    queryFn: () => fetchSplittersFromLocalDb({
      page,
      limit: 20,
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
    }),
    staleTime: SPLITTERS_LIST_STALE_TIME_MS,
  })
}
