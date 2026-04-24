import type { MassivaRouteCatalog } from '@/features/massiva/model/massivaLocalPreview'
import type { MassivaRouteRow } from '@/features/massiva/api/fetchMassivaRoutesFromLocalDb'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/**
 * Paridade com `_ensureRouteCatalog` em `massiva_screen.dart` (sem `_routeByUsername` / AutoISP).
 * Usa apenas `listarConnections`: AP/slot/porta/splitter por cliente com `accessPoint`.
 */
export function buildMassivaRouteCatalog(
  connections: SplitterCliente[],
): MassivaRouteCatalog {
  const splitters: MassivaRouteCatalog['splitters'] = new Map()
  const apTitles: MassivaRouteCatalog['apTitles'] = new Map()
  const splitterTitles: MassivaRouteCatalog['splitterTitles'] = new Map()

  for (const cliente of connections) {
    const access = cliente.accessPoint
    if (access === null) continue

    const apCode = access.code.trim()
    const apTitle = access.title.trim()
    if (apCode === '' || apTitle === '') continue

    const slot = access.slotOlt
    const port = access.portOlt
    const rawSplitter = cliente.splitterCode?.trim() ?? ''
    const rawSplitterTitle = cliente.splitterTitle?.trim() ?? ''
    if (rawSplitter === '') continue

    if (!splitters.has(apCode)) splitters.set(apCode, new Map())
    const bySlot = splitters.get(apCode)!
    if (!bySlot.has(slot)) bySlot.set(slot, new Map())
    const byPort = bySlot.get(slot)!
    if (!byPort.has(port)) byPort.set(port, new Set())
    byPort.get(port)!.add(rawSplitter)
    apTitles.set(apCode, apTitle)
    splitterTitles.set(rawSplitter, rawSplitterTitle !== '' ? rawSplitterTitle : rawSplitter)
  }

  return { splitters, apTitles, splitterTitles }
}

export function buildMassivaRouteCatalogFromRows(
  rows: MassivaRouteRow[],
): MassivaRouteCatalog {
  const splitters: MassivaRouteCatalog['splitters'] = new Map()
  const apTitles: MassivaRouteCatalog['apTitles'] = new Map()
  const splitterTitles: MassivaRouteCatalog['splitterTitles'] = new Map()

  for (const row of rows) {
    const apCode = row.apCode.trim()
    const apTitle = row.apTitle.trim()
    const splitterCode = row.splitterCode.trim()
    const splitterTitle = row.splitterTitle.trim()
    if (apCode === '' || splitterCode === '') continue

    if (!splitters.has(apCode)) splitters.set(apCode, new Map())
    const bySlot = splitters.get(apCode)!
    if (!bySlot.has(row.slot)) bySlot.set(row.slot, new Map())
    const byPort = bySlot.get(row.slot)!
    if (!byPort.has(row.port)) byPort.set(row.port, new Set())
    byPort.get(row.port)!.add(splitterCode)

    apTitles.set(apCode, apTitle !== '' ? apTitle : apCode)
    splitterTitles.set(
      splitterCode,
      splitterTitle !== '' ? splitterTitle : splitterCode,
    )
  }

  return { splitters, apTitles, splitterTitles }
}

export function listMassivaApCodes(catalog: MassivaRouteCatalog): string[] {
  return [...catalog.splitters.keys()].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  )
}

export function listMassivaSlotsForAp(
  catalog: MassivaRouteCatalog,
  apCode: string,
): number[] {
  const slots = catalog.splitters.get(apCode)
  if (slots === undefined) return []
  return [...slots.keys()].sort((a, b) => a - b)
}

export function listMassivaPortsForApSlot(
  catalog: MassivaRouteCatalog,
  apCode: string,
  slot: number,
): number[] {
  const ports = catalog.splitters.get(apCode)?.get(slot)
  if (ports === undefined) return []
  return [...ports.keys()].sort((a, b) => a - b)
}

export function listMassivaSplittersForRoute(
  catalog: MassivaRouteCatalog,
  apCode: string,
  slot: number,
  port: number,
): string[] {
  const set = catalog.splitters.get(apCode)?.get(slot)?.get(port)
  if (set === undefined) return []
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
