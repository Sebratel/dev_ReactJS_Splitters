import type { MassivaLocalPreviewRouteSelection } from '@/features/massiva/model/massivaLocalPreview'

function isCompleteConnection(connection: {
  apId: string
  slot: number | null
  porta: number | null
}): connection is { apId: string; slot: number; porta: number } {
  return (
    connection.apId.trim() !== '' &&
    typeof connection.slot === 'number' &&
    Number.isFinite(connection.slot) &&
    typeof connection.porta === 'number' &&
    Number.isFinite(connection.porta)
  )
}

/** Rotas unicas por AP+slot+porta em ordem de selecao. */
export function massivaPreviewNormalizedRoutes(
  s: MassivaLocalPreviewRouteSelection,
): Array<{
  apCode: string
  slot: number
  port: number
  splitterCodes: string[]
}> {
  const seen = new Set<string>()
  const routes: Array<{
    apCode: string
    slot: number
    port: number
    splitterCodes: string[]
  }> = []

  for (const connection of s.connections) {
    if (!isCompleteConnection(connection)) continue

    const apCode = connection.apId.trim()
    const routeKey = `${apCode}|${connection.slot}|${connection.porta}`
    if (seen.has(routeKey)) continue
    seen.add(routeKey)

    const splitterCodes = [...new Set(
      connection.splitters
        .map((splitter) => splitter.id.trim())
        .filter((code) => code !== ''),
    )].sort((a, b) => a.localeCompare(b, 'pt-BR'))

    routes.push({
      apCode,
      slot: connection.slot,
      port: connection.porta,
      splitterCodes,
    })
  }

  return routes
}

/** APs unicos com pelo menos uma rota completa selecionada. */
export function massivaPreviewSelectedAps(
  s: MassivaLocalPreviewRouteSelection,
): string[] {
  const aps = new Set<string>()
  for (const route of massivaPreviewNormalizedRoutes(s)) {
    aps.add(route.apCode)
  }
  return [...aps].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function massivaPreviewSelectionToPortsByApSlot(
  s: MassivaLocalPreviewRouteSelection,
): Map<string, Map<number, Set<number>>> {
  const map = new Map<string, Map<number, Set<number>>>()

  for (const route of massivaPreviewNormalizedRoutes(s)) {
    if (!map.has(route.apCode)) map.set(route.apCode, new Map())
    const slots = map.get(route.apCode)!
    if (!slots.has(route.slot)) slots.set(route.slot, new Set())
    slots.get(route.slot)!.add(route.port)
  }

  return map
}

/**
 * So inclui rotas com restricao explicita de splitters.
 * `undefined` = usar catalogo completo de splitters para as rotas selecionadas.
 */
export function massivaPreviewSelectionToExplicitSplitters(
  s: MassivaLocalPreviewRouteSelection,
):
  | Map<string, Map<number, Map<number, Set<string>>>>
  | undefined {
  const out = new Map<string, Map<number, Map<number, Set<string>>>>()

  for (const route of massivaPreviewNormalizedRoutes(s)) {
    if (route.splitterCodes.length === 0) continue

    if (!out.has(route.apCode)) out.set(route.apCode, new Map())
    const bySlot = out.get(route.apCode)!
    if (!bySlot.has(route.slot)) bySlot.set(route.slot, new Map())
    const byPort = bySlot.get(route.slot)!
    byPort.set(route.port, new Set(route.splitterCodes))
  }

  return out.size > 0 ? out : undefined
}
