import { useCallback, useReducer } from 'react'
import {
  initialSplittersListFilters,
  type SplittersListFilterState,
} from '@/features/splitters/model/splittersListFilters'
import type { SplitterStatus } from '@/features/splitters/model/splitterStatus'
import { sortSplitterStatuses } from '@/features/splitters/model/splitterStatus'

type Action =
  | { type: 'setSearch'; payload: string }
  | { type: 'toggleOlt'; payload: string }
  | { type: 'setOltCodes'; payload: string[] }
  | { type: 'toggleSplitterStatus'; payload: SplitterStatus }
  | { type: 'setSplitterStatuses'; payload: SplitterStatus[] }
  | { type: 'toggleStreet'; payload: string }
  | { type: 'setStreetSelections'; payload: string[] }
  | { type: 'clearAll' }

function sortCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => a.localeCompare(b))
}

function sortStreets(streets: string[]): string[] {
  return [...streets].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

function reducer(
  state: SplittersListFilterState,
  action: Action,
): SplittersListFilterState {
  switch (action.type) {
    case 'setSearch':
      return { ...state, searchQuery: action.payload }
    case 'setOltCodes':
      return { ...state, oltCodes: sortCodes(action.payload) }
    case 'toggleOlt': {
      const next = new Set(state.oltCodes)
      if (next.has(action.payload)) next.delete(action.payload)
      else next.add(action.payload)
      return { ...state, oltCodes: sortCodes([...next]) }
    }
    case 'toggleSplitterStatus': {
      const next = new Set(state.splitterStatuses)
      if (next.has(action.payload)) next.delete(action.payload)
      else next.add(action.payload)
      return { ...state, splitterStatuses: sortSplitterStatuses([...next]) }
    }
    case 'setSplitterStatuses':
      return { ...state, splitterStatuses: sortSplitterStatuses(action.payload) }
    case 'toggleStreet': {
      const next = new Set(state.streetSelections)
      if (next.has(action.payload)) next.delete(action.payload)
      else next.add(action.payload)
      return { ...state, streetSelections: sortStreets([...next]) }
    }
    case 'setStreetSelections':
      return { ...state, streetSelections: sortStreets(action.payload) }
    case 'clearAll':
      return { ...initialSplittersListFilters }
  }
}

/**
 * Estado local dos filtros da listagem (sem I/O).
 */
export function useSplittersListFiltersState(): {
  state: SplittersListFilterState
  setSearchQuery: (value: string) => void
  toggleOltCode: (oltCode: string) => void
  setOltCodes: (codes: string[]) => void
  toggleSplitterStatus: (status: SplitterStatus) => void
  setSplitterStatuses: (statuses: SplitterStatus[]) => void
  toggleStreetSelection: (streetLine: string) => void
  setStreetSelections: (streets: string[]) => void
  clearAll: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialSplittersListFilters)

  const setSearchQuery = useCallback((value: string) => {
    dispatch({ type: 'setSearch', payload: value })
  }, [])

  const toggleOltCode = useCallback((oltCode: string) => {
    dispatch({ type: 'toggleOlt', payload: oltCode })
  }, [])

  const setOltCodes = useCallback((codes: string[]) => {
    dispatch({ type: 'setOltCodes', payload: codes })
  }, [])

  const toggleSplitterStatus = useCallback((status: SplitterStatus) => {
    dispatch({ type: 'toggleSplitterStatus', payload: status })
  }, [])

  const setSplitterStatuses = useCallback((statuses: SplitterStatus[]) => {
    dispatch({ type: 'setSplitterStatuses', payload: statuses })
  }, [])

  const toggleStreetSelection = useCallback((streetLine: string) => {
    dispatch({ type: 'toggleStreet', payload: streetLine })
  }, [])

  const setStreetSelections = useCallback((streets: string[]) => {
    dispatch({ type: 'setStreetSelections', payload: streets })
  }, [])

  const clearAll = useCallback(() => {
    dispatch({ type: 'clearAll' })
  }, [])

  return {
    state,
    setSearchQuery,
    toggleOltCode,
    setOltCodes,
    toggleSplitterStatus,
    setSplitterStatuses,
    toggleStreetSelection,
    setStreetSelections,
    clearAll,
  }
}
