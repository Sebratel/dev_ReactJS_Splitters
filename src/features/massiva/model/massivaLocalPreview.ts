/**
 * Preview local de afetados - paridade `_LocalMassivaPreview` / selecao de rota em `massiva_screen.dart`.
 */

import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/** Catalogo AP -> slot -> porta -> codigos de splitter (memoria, como `_routeCatalog` no Flutter). */
export type MassivaRouteCatalog = {
  splitters: Map<string, Map<number, Map<number, Set<string>>>>
  apTitles: Map<string, string>
  splitterTitles: Map<string, string>
}

export type MassivaLocalPreviewTotals = {
  totalAffected: number
  totalPppoes: number
  /** Dentro da seleção atual (mesma base que `totalAffected`), clientes com `isCorporate`. */
  totalCorporateAffected: number
}

export type MassivaSelectedSplitter = {
  id: string
  label: string
}

export type MassivaRouteSlotPortPair = {
  slot: number
  port: number
}

export type MassivaRouteConnectionSelection = {
  apId: string
  apLabel: string
  slot: number | null
  porta: number | null
  splitters: MassivaSelectedSplitter[]
  selectedPairs?: MassivaRouteSlotPortPair[]
}

export type MassivaLocalPreviewRouteSelection = {
  connections: MassivaRouteConnectionSelection[]
}

export type MassivaLocalPreviewViewState =
  | { status: 'connections-loading' }
  | { status: 'connections-error'; error: unknown }
  | { status: 'incomplete'; message: string }
  | {
      status: 'empty-selection'
      totals: MassivaLocalPreviewTotals
    }
  | {
      status: 'success'
      totals: MassivaLocalPreviewTotals
      sampleClientes: SplitterCliente[]
    }
