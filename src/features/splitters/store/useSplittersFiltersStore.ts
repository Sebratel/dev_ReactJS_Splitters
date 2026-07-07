import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  initialSplittersListFilters,
  type SplittersListFilterState,
} from '@/features/splitters/model/splittersListFilters'
import { type SplitterStatus, sortSplitterStatuses } from '@/features/splitters/model/splitterStatus'

interface SplittersFiltersStore {
  state: SplittersListFilterState
  setSearchQuery: (value: string) => void
  toggleCitySelection: (city: string) => void
  setCitySelections: (cities: string[]) => void
  toggleCondominiumSelection: (name: string) => void
  setCondominiumSelections: (names: string[]) => void
  setLocalKindFilter: (value: SplittersListFilterState['localKindFilter']) => void
  setMassivaOpenState: (
    value: SplittersListFilterState['massivaOpenState'],
  ) => void
  setCorporateClientFilter: (
    value: SplittersListFilterState['corporateClientFilter'],
  ) => void
  setMaintenanceWindowDays: (
    value: SplittersListFilterState['maintenanceWindowDays'],
  ) => void
  setMaintenanceFilter: (
    value: SplittersListFilterState['maintenanceFilter'],
  ) => void
  setOltSlot: (value: number | null) => void
  setOltPort: (value: number | null) => void
  toggleOltCode: (oltCode: string) => void
  setOltCodes: (codes: string[]) => void
  togglePrimarySplitterTitle: (title: string) => void
  setPrimarySplitterTitles: (titles: string[]) => void
  toggleSplitterStatus: (status: SplitterStatus) => void
  setSplitterStatuses: (statuses: SplitterStatus[]) => void
  toggleStreetSelection: (streetLine: string) => void
  setStreetSelections: (streets: string[]) => void
  clearAll: () => void
}

function sortCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => a.localeCompare(b))
}

function sortStreets(streets: string[]): string[] {
  return [...streets].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

function sortTitles(titles: string[]): string[] {
  return [...titles].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export const useSplittersFiltersStore = create<SplittersFiltersStore>()(
  persist(
    (set) => ({
      state: initialSplittersListFilters,

  setSearchQuery: (value) =>
    set((s) => ({ state: { ...s.state, searchQuery: value } })),
  setCitySelections: (cities) =>
    set((s) => ({ state: { ...s.state, citySelections: sortTitles(cities) } })),
  toggleCitySelection: (city) =>
    set((s) => {
      const next = new Set(s.state.citySelections)
      if (next.has(city)) next.delete(city)
      else next.add(city)
      return { state: { ...s.state, citySelections: sortTitles([...next]) } }
    }),
  setCondominiumSelections: (names) =>
    set((s) => ({
      state: { ...s.state, condominiumSelections: sortTitles(names) },
    })),
  toggleCondominiumSelection: (name) =>
    set((s) => {
      const next = new Set(s.state.condominiumSelections)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return {
        state: { ...s.state, condominiumSelections: sortTitles([...next]) },
      }
    }),
  setLocalKindFilter: (value) =>
    set((s) => ({ state: { ...s.state, localKindFilter: value } })),

  setMassivaOpenState: (value) =>
    set((s) => ({ state: { ...s.state, massivaOpenState: value } })),

  setCorporateClientFilter: (value) =>
    set((s) => ({ state: { ...s.state, corporateClientFilter: value } })),

  setMaintenanceWindowDays: (value) =>
    set((s) => ({ state: { ...s.state, maintenanceWindowDays: value } })),

  setMaintenanceFilter: (value) =>
    set((s) => ({ state: { ...s.state, maintenanceFilter: value } })),

  setOltSlot: (value) =>
    set((s) => ({ state: { ...s.state, oltSlot: value } })),

  setOltPort: (value) =>
    set((s) => ({ state: { ...s.state, oltPort: value } })),

  setOltCodes: (codes) =>
    set((s) => ({ state: { ...s.state, oltCodes: sortCodes(codes) } })),

  setPrimarySplitterTitles: (titles) =>
    set((s) => ({
      state: { ...s.state, primarySplitterTitles: sortTitles(titles) },
    })),

  toggleOltCode: (oltCode) =>
    set((s) => {
      const next = new Set(s.state.oltCodes)
      if (next.has(oltCode)) next.delete(oltCode)
      else next.add(oltCode)
      return { state: { ...s.state, oltCodes: sortCodes([...next]) } }
    }),

  togglePrimarySplitterTitle: (title) =>
    set((s) => {
      const next = new Set(s.state.primarySplitterTitles)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return {
        state: {
          ...s.state,
          primarySplitterTitles: sortTitles([...next]),
        },
      }
    }),

  toggleSplitterStatus: (status) =>
    set((s) => {
      const next = new Set(s.state.splitterStatuses)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return { state: { ...s.state, splitterStatuses: sortSplitterStatuses([...next]) } }
    }),

  setSplitterStatuses: (statuses) =>
    set((s) => ({ state: { ...s.state, splitterStatuses: sortSplitterStatuses(statuses) } })),

  toggleStreetSelection: (streetLine) =>
    set((s) => {
      const next = new Set(s.state.streetSelections)
      if (next.has(streetLine)) next.delete(streetLine)
      else next.add(streetLine)
      return { state: { ...s.state, streetSelections: sortStreets([...next]) } }
    }),

  setStreetSelections: (streets) =>
    set((s) => ({ state: { ...s.state, streetSelections: sortStreets(streets) } })),

      clearAll: () => set({ state: initialSplittersListFilters }),
    }),
    {
      name: 'nexaview.splitters.filters.v1',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (store) => ({ state: store.state }),
    },
  ),
)
