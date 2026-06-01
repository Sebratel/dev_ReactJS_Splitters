import { SPLITTER_MAP_NEIGHBOR_RADIUS_METERS } from '@/features/splitters/model/splitterMap'
import { SPLITTER_ROUTE_RELIEF_MAX_METERS } from '@/features/splitters/lib/splitterStreetRelief'
import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type NetworkReliefQueueSplitter = {
  code: string
  title: string
  outPorts: number
  busyCount: number
}

export type NetworkReliefQueueEntry = {
  splitter: NetworkReliefQueueSplitter
  neighborStraightRadiusScanned: number
  maxRouteMeters: number
  straightNeighborsSampled: number
  ruleType?: 'CONDOMINIUM' | 'STREET'
}

export type NetworkReliefQueueData = {
  entries: NetworkReliefQueueEntry[]
  scannedCount: number
  maxRouteMeters: number
  straightRadiusMeters: number
  hasMore: boolean
  nextCursor: number | null
  totalEntries?: number
  generatedAt?: string | null
  /** `true` quando a API aplicou slot/porta PON vindos dos filtros da listagem */
  ponFilterActive?: boolean
  /** Snapshot global ainda em geração no servidor (não bloqueia o HTTP). */
  snapshotBuilding?: boolean
  /** Nenhuma linha na tabela para os parâmetros pedidos (200 m / 200 m). */
  snapshotMissing?: boolean
  message?: string | null
}

export async function fetchSplittersNetworkReliefQueueFromLocalDb(options?: {
  limit?: number
  cursor?: number
  straightRadiusMeters?: number
  maxRouteMeters?: number
  oltSlot?: number | null
  oltPort?: number | null
}): Promise<NetworkReliefQueueData> {
  const url = new URL(`${env.localBffUrl}/api/splitters/network-relief-queue`)
  if (options?.limit != null) url.searchParams.set('limit', String(options.limit))
  if (options?.cursor != null) url.searchParams.set('cursor', String(options.cursor))
  if (options?.straightRadiusMeters != null) {
    url.searchParams.set('straightRadius', String(options.straightRadiusMeters))
  }
  if (options?.maxRouteMeters != null) {
    url.searchParams.set('maxRouteMeters', String(options.maxRouteMeters))
  }
  if (options?.oltSlot != null && Number.isFinite(options.oltSlot)) {
    url.searchParams.set('oltSlot', String(Math.trunc(options.oltSlot)))
  }
  if (options?.oltPort != null && Number.isFinite(options.oltPort)) {
    url.searchParams.set('oltPort', String(Math.trunc(options.oltPort)))
  }

  const response = await fetchWithSessionAuth(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Erro ao consultar fila de alívio de rede: ${response.status}`)
  }

  const result = await response.json()
  if (!result.success || !Array.isArray(result.entries)) {
    throw new Error('Formato de resposta inesperado na fila de alívio de rede.')
  }

  const entries: NetworkReliefQueueEntry[] = (result.entries as unknown[]).map((raw) => {
    const row = raw as Record<string, unknown>
    const sp = row.splitter as Record<string, unknown> | undefined
    return {
      splitter: {
        code: String(sp?.code ?? '').trim(),
        title: String(sp?.title ?? '').trim(),
        outPorts: Number(sp?.outPorts ?? 0),
        busyCount: Number(sp?.busyCount ?? 0),
      },
      neighborStraightRadiusScanned: Number(row.neighborStraightRadiusScanned ?? 0),
      maxRouteMeters: Number(row.maxRouteMeters ?? SPLITTER_ROUTE_RELIEF_MAX_METERS),
      straightNeighborsSampled: Number(row.straightNeighborsSampled ?? 0),
      ruleType:
        String(row.ruleType ?? '').trim().toUpperCase() === 'CONDOMINIUM'
          ? 'CONDOMINIUM'
          : 'STREET',
    }
  })

  return {
    entries,
    scannedCount: Number(result.scannedCount ?? 0),
    maxRouteMeters: Number(result.maxRouteMeters ?? SPLITTER_ROUTE_RELIEF_MAX_METERS),
    straightRadiusMeters: Number(
      result.straightRadiusMeters ?? SPLITTER_MAP_NEIGHBOR_RADIUS_METERS,
    ),
    hasMore: Boolean(result.hasMore),
    nextCursor:
      result.nextCursor === null || result.nextCursor === undefined
        ? null
        : Number(result.nextCursor),
    totalEntries:
      result.totalEntries === null || result.totalEntries === undefined
        ? undefined
        : Number(result.totalEntries),
    generatedAt:
      result.generatedAt === null || result.generatedAt === undefined
        ? null
        : String(result.generatedAt),
    ponFilterActive: Boolean(result.ponFilterActive),
    snapshotBuilding: Boolean(result.snapshotBuilding),
    snapshotMissing: Boolean(result.snapshotMissing),
    message:
      result.message === null || result.message === undefined
        ? null
        : String(result.message),
  }
}
