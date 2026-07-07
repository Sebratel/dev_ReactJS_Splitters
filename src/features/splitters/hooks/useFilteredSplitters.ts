import { useMemo } from 'react'
import { applySplittersListFilters } from '@/features/splitters/lib/applySplittersListFilters'
import type { ApplySplittersListFiltersOptions } from '@/features/splitters/model/splitterListFilterRowContext'
import type { Splitter } from '@/features/splitters/model/splitter'
import type { SplittersListFilterState } from '@/features/splitters/model/splittersListFilters'

/**
 * Lista filtrada derivada (memorizada) — mantém a composição fora da UI.
 * Dependências por campo de `filters` (primitivos + referências dos arrays do reducer) para alinhar o `useMemo` ao que mudou.
 */
export function useFilteredSplitters(
  splitters: Splitter[] | undefined,
  filters: SplittersListFilterState,
  options?: ApplySplittersListFiltersOptions,
): Splitter[] {
  const clientNamesIndex = options?.clientNamesIndex
  const occupancyCountBySplitterCode = options?.occupancyCountBySplitterCode
  const streetBySplitterCode = options?.streetBySplitterCode

  const searchQuery = filters.searchQuery
  const oltCodes = filters.oltCodes
  const primarySplitterTitles = filters.primarySplitterTitles
  const splitterStatuses = filters.splitterStatuses
  const streetSelections = filters.streetSelections
  const citySelections = filters.citySelections
  const condominiumSelections = filters.condominiumSelections
  const localKindFilter = filters.localKindFilter
  const massivaOpenState = filters.massivaOpenState
  const corporateClientFilter = filters.corporateClientFilter
  const maintenanceWindowDays = filters.maintenanceWindowDays
  const maintenanceFilter = filters.maintenanceFilter
  const oltSlot = filters.oltSlot ?? null
  const oltPort = filters.oltPort ?? null

  return useMemo(() => {
    if (!splitters?.length) return []
    const filterSlice: SplittersListFilterState = {
      searchQuery,
      oltCodes,
      primarySplitterTitles,
      splitterStatuses,
      streetSelections,
      citySelections,
      condominiumSelections,
      localKindFilter,
      massivaOpenState,
      corporateClientFilter,
      maintenanceWindowDays,
      maintenanceFilter,
      oltSlot,
      oltPort,
    }
    return applySplittersListFilters(splitters, filterSlice, {
      clientNamesIndex,
      occupancyCountBySplitterCode,
      streetBySplitterCode,
    })
  }, [
    splitters,
    searchQuery,
    oltCodes,
    primarySplitterTitles,
    splitterStatuses,
    streetSelections,
    citySelections,
    condominiumSelections,
    localKindFilter,
    massivaOpenState,
    corporateClientFilter,
    maintenanceWindowDays,
    maintenanceFilter,
    oltSlot,
    oltPort,
    clientNamesIndex,
    occupancyCountBySplitterCode,
    streetBySplitterCode,
  ])
}
