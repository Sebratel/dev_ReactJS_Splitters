import { env } from '@/shared/config/env'
import type { SplitterMapNeighbor } from '@/features/splitters/model/splitterMap'

type SplitterNeighborApiRow = {
  code?: unknown
  title?: unknown
  outPorts?: unknown
  busyCount?: unknown
  lat?: unknown
  lng?: unknown
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

export async function fetchSplitterNeighborsFromLocalDb(args: {
  code: string
  radiusMeters: number
}): Promise<Array<Omit<SplitterMapNeighbor, 'occupancyBand'>>> {
  const url = new URL(`${env.localBffUrl}/api/splitters/neighbors`)
  url.searchParams.set('code', args.code)
  url.searchParams.set('radius', String(args.radiusMeters))

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Erro ao consultar vizinhos do splitter: ${response.status}`)
  }

  const result = await response.json()
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('Formato de resposta inesperado ao listar vizinhos do splitter.')
  }

  const mapped: Array<Omit<SplitterMapNeighbor, 'occupancyBand'> | null> = (
    result.data as SplitterNeighborApiRow[]
  ).map((row) => {
    const lat = pickNumber(row.lat)
    const lng = pickNumber(row.lng)
    const outPorts = pickNumber(row.outPorts)
    const busyCount = pickNumber(row.busyCount)

    if (lat === null || lng === null) return null

    return {
      code: pickString(row.code),
      title: pickString(row.title).trim() || `Splitter ${pickString(row.code)}`,
      outPorts: outPorts === null ? 0 : Math.trunc(outPorts),
      busyCount: busyCount === null ? 0 : Math.trunc(busyCount),
      lat,
      lng,
    }
  })

  return mapped.filter(
    (item): item is Omit<SplitterMapNeighbor, 'occupancyBand'> => item !== null,
  )
}
