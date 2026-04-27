import { create } from 'zustand'
import type {
  MassivaLocalPreviewRouteSelection,
  MassivaRouteConnectionSelection,
  MassivaRouteSlotPortPair,
  MassivaSelectedSplitter,
} from '@/features/massiva/model/massivaLocalPreview'

function createEmptyConnection(): MassivaRouteConnectionSelection {
  return {
    apId: '',
    apLabel: '',
    slot: null,
    porta: null,
    splitters: [],
  }
}

function normalizeSplitters(
  splitters: readonly MassivaSelectedSplitter[],
): MassivaSelectedSplitter[] {
  const byId = new Map<string, MassivaSelectedSplitter>()
  for (const splitter of splitters) {
    const id = splitter.id.trim()
    if (id === '') continue
    const label = splitter.label.trim() !== '' ? splitter.label.trim() : id
    byId.set(id, { id, label })
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, 'pt-BR'))
}

function normalizeSelectedPairs(
  pairs: readonly MassivaRouteSlotPortPair[] | undefined,
): MassivaRouteSlotPortPair[] | undefined {
  if (!pairs || pairs.length === 0) return undefined
  const byKey = new Map<string, MassivaRouteSlotPortPair>()
  for (const pair of pairs) {
    if (!Number.isFinite(pair.slot) || !Number.isFinite(pair.port)) continue
    const slot = Math.trunc(pair.slot)
    const port = Math.trunc(pair.port)
    byKey.set(`${slot}|${port}`, { slot, port })
  }
  if (byKey.size === 0) return undefined
  return [...byKey.values()].sort((a, b) => (a.slot !== b.slot ? a.slot - b.slot : a.port - b.port))
}

function withConnectionAt(
  state: MassivaPreviewSelectionState,
  index: number,
  updater: (current: MassivaRouteConnectionSelection) => MassivaRouteConnectionSelection,
): Pick<MassivaPreviewSelectionState, 'connections'> {
  if (index < 0 || index >= state.connections.length) {
    return { connections: state.connections }
  }

  const next = state.connections.map((connection, currentIndex) =>
    currentIndex === index ? updater(connection) : connection,
  )

  return { connections: next }
}

type MassivaPreviewSelectionState = MassivaLocalPreviewRouteSelection & {
  addConnection: () => void
  removeConnection: (index: number) => void
  setConnectionAp: (index: number, apId: string | null, apLabel: string) => void
  setConnectionSlot: (index: number, slot: number | null) => void
  setConnectionPorta: (index: number, porta: number | null) => void
  toggleConnectionSplitter: (index: number, splitter: MassivaSelectedSplitter) => void
  setConnectionSplitters: (index: number, splitters: MassivaSelectedSplitter[]) => void
  clearConnectionSplitters: (index: number) => void
  setConnections: (connections: MassivaRouteConnectionSelection[]) => void
  clearRoute: () => void
}

const initial: MassivaLocalPreviewRouteSelection = {
  connections: [createEmptyConnection()],
}

export const useMassivaPreviewSelectionStore = create<MassivaPreviewSelectionState>(
  (set) => ({
    ...initial,

    addConnection: () =>
      set((state) => ({
        connections: [...state.connections, createEmptyConnection()],
      })),

    removeConnection: (index) =>
      set((state) => {
        if (state.connections.length <= 1) {
          return { connections: [createEmptyConnection()] }
        }
        return {
          connections: state.connections.filter((_, currentIndex) => currentIndex !== index),
        }
      }),

    setConnectionAp: (index, apId, apLabel) =>
      set((state) =>
        withConnectionAt(state, index, (current) => ({
          ...current,
          apId: (apId ?? '').trim(),
          apLabel: apLabel.trim(),
          selectedPairs: undefined,
        })),
      ),

    setConnectionSlot: (index, slot) =>
      set((state) =>
        withConnectionAt(state, index, (current) => ({
          ...current,
          slot,
          selectedPairs: undefined,
        })),
      ),

    setConnectionPorta: (index, porta) =>
      set((state) =>
        withConnectionAt(state, index, (current) => ({
          ...current,
          porta,
          selectedPairs: undefined,
        })),
      ),

    toggleConnectionSplitter: (index, splitter) =>
      set((state) =>
        withConnectionAt(state, index, (current) => {
          const id = splitter.id.trim()
          if (id === '') return current

          const has = current.splitters.some((entry) => entry.id === id)
          const next = has
            ? current.splitters.filter((entry) => entry.id !== id)
            : [...current.splitters, { id, label: splitter.label.trim() || id }]

          return {
            ...current,
            splitters: normalizeSplitters(next),
          }
        }),
      ),

    setConnectionSplitters: (index, splitters) =>
      set((state) =>
        withConnectionAt(state, index, (current) => ({
          ...current,
          splitters: normalizeSplitters(splitters),
        })),
      ),

    clearConnectionSplitters: (index) =>
      set((state) =>
        withConnectionAt(state, index, (current) => ({
          ...current,
          splitters: [],
        })),
      ),

    setConnections: (connections) => {
      const normalized = connections.map((connection) => ({
        apId: connection.apId.trim(),
        apLabel: connection.apLabel.trim(),
        slot: connection.slot,
        porta: connection.porta,
        splitters: normalizeSplitters(connection.splitters),
        selectedPairs: normalizeSelectedPairs(connection.selectedPairs),
      }))

      set({
        connections: normalized.length > 0 ? normalized : [createEmptyConnection()],
      })
    },

    clearRoute: () => set(initial),
  }),
)
