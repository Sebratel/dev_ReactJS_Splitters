import { create } from 'zustand'

/**
 * UI global reservada para fluxos que atravessam rotas (ex.: overlay de loading).
 * Features devem preferir estados locais ou TanStack Query quando possível.
 */
type AppUiState = {
  globalLoading: boolean
  globalError: string | null
  setGlobalLoading: (value: boolean) => void
  setGlobalError: (message: string | null) => void
}

export const useAppUiStore = create<AppUiState>((set) => ({
  globalLoading: false,
  globalError: null,
  setGlobalLoading: (globalLoading) => set({ globalLoading }),
  setGlobalError: (globalError) => set({ globalError }),
}))
