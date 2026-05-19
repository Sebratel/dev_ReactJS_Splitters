import type { SplitterMapNeighbor } from '@/features/splitters/model/splitterMap'

/** Mesmos limites do detalhe do splitter / BFF `evaluateReliefForSplitter` (rua vs cruzamento). */
export const SPLITTER_ROUTE_RELIEF_MAX_METERS = 200
export const SPLITTER_CROSS_STREET_RELIEF_MAX_METERS = 30

export function normalizeStreetForRelief(street: string | null | undefined): string | null {
  const normalized = String(street ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const withoutPrefix = normalized.replace(
    /^(rua|r|avenida|av|travessa|trav|alameda|estrada|rodovia|beco|largo|praca|praça)\s+/,
    '',
  )
  const withoutJoiners = withoutPrefix
    .replace(/\b(de|da|do|das|dos)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return withoutJoiners === '' ? null : withoutJoiners
}

/** Estado para o header do detalhe (alívio por rua após geocodes relevantes). */
export type SplitterMapReliefInsight = {
  evaluationSettled: boolean
  streetReliefNeighbor: { code: string; title: string } | null
}

/**
 * Primeiro vizinho de rua (não condomínio) com porta livre e rota OSRM dentro do limite,
 * usando ruas já resolvidas (cadastro + merge de geocode no cliente).
 */
export function findFirstStreetReliefNeighbor(args: {
  neighbors: readonly SplitterMapNeighbor[]
  currentStreetNormalized: string | null
  currentIsCondominium: boolean
}): SplitterMapNeighbor | null {
  const { neighbors, currentStreetNormalized, currentIsCondominium } = args
  if (currentIsCondominium) return null
  const currentStreet = currentStreetNormalized

  for (const neighbor of neighbors) {
    if (neighbor.isCondominium) continue
    if (neighbor.outPorts <= 0 || neighbor.busyCount >= neighbor.outPorts) continue
    if (neighbor.routeMeters == null) continue
    const neighborStreet = normalizeStreetForRelief(neighbor.street)
    const sameStreet =
      currentStreet !== null &&
      neighborStreet !== null &&
      currentStreet === neighborStreet
    const routeLimit = sameStreet
      ? SPLITTER_ROUTE_RELIEF_MAX_METERS
      : Math.min(SPLITTER_ROUTE_RELIEF_MAX_METERS, SPLITTER_CROSS_STREET_RELIEF_MAX_METERS)
    if (neighbor.routeMeters <= routeLimit) return neighbor
  }
  return null
}
