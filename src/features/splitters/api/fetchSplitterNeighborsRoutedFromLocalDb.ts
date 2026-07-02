import type { SplitterMapNeighbor } from '@/features/splitters/model/splitterMap'
import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

type NeighborApiRow = {
  code?: unknown
  title?: unknown
  isCondominium?: unknown
  street?: unknown
  outPorts?: unknown
  busyCount?: unknown
  lat?: unknown
  lng?: unknown
  straightMeters?: unknown
  routeMeters?: unknown
}

function pickString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function pickNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number.parseFloat(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Vizinhos no raio em linha reta + distância OSRM foot (via BFF). */
export async function fetchSplitterNeighborsRoutedFromLocalDb(args: {
  code: string
  straightRadiusMeters: number
}): Promise<{
  neighbors: Array<Omit<SplitterMapNeighbor, 'occupancyBand'>>
  routingUnavailable: boolean
  isCondominium: boolean
  condominiumReliefAvailable: boolean
  originStreet: string | null
  originStreetRaw: string | null
}> {
  const url = new URL(`${env.localBffUrl}/api/splitters/neighbors-routed`, window.location.origin)
  url.searchParams.set('code', args.code)
  url.searchParams.set('straightRadius', String(args.straightRadiusMeters))

  const response = await fetchWithSessionAuth(url)
  if (!response.ok) {
    throw new Error(`Erro ao consultar vizinhos roteados: ${response.status}`)
  }

  const result = await response.json()
  if (!result.success || !Array.isArray(result.neighbors)) {
    throw new Error('Formato de resposta inesperado ao listar vizinhos roteados.')
  }

  const routingUnavailable = Boolean(result.routingUnavailable)
  const isCondominium = Boolean(result.isCondominium)
  const condominiumReliefAvailable = Boolean(result.condominiumReliefAvailable)
  const originStreet = pickString(result.originStreet).trim() || null
  const originStreetRaw = pickString(result.originStreetRaw).trim() || null

  const mapped: Array<Omit<SplitterMapNeighbor, 'occupancyBand'> | null> = (
    result.neighbors as NeighborApiRow[]
  ).map((row) => {
    const lat = pickNumber(row.lat)
    const lng = pickNumber(row.lng)
    const outPorts = pickNumber(row.outPorts)
    const busyCount = pickNumber(row.busyCount)
    const straightMeters = pickNumber(row.straightMeters)
    const routeRaw = row.routeMeters
    const routeMeters =
      routeRaw === null || routeRaw === undefined
        ? null
        : pickNumber(routeRaw)

    if (lat === null || lng === null) return null

    return {
      code: pickString(row.code),
      title: pickString(row.title).trim() || `Splitter ${pickString(row.code)}`,
      isCondominium: Boolean(row.isCondominium),
      street: pickString(row.street).trim() || null,
      outPorts: outPorts === null ? 0 : Math.trunc(outPorts),
      busyCount: busyCount === null ? 0 : Math.trunc(busyCount),
      lat,
      lng,
      straightMeters: straightMeters === null ? undefined : Math.round(straightMeters),
      routeMeters: routeMeters === null ? null : Math.round(routeMeters),
    }
  })

  const neighbors = mapped.filter(
    (item): item is Omit<SplitterMapNeighbor, 'occupancyBand'> => item !== null,
  )

  return { neighbors, routingUnavailable, isCondominium, condominiumReliefAvailable, originStreet, originStreetRaw }
}
