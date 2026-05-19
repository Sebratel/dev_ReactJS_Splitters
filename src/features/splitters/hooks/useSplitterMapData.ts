import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSplitterNeighborsRoutedFromLocalDb } from '@/features/splitters/api/fetchSplitterNeighborsRoutedFromLocalDb'
import { occupancyBandForUsage } from '@/features/splitters/lib/splitterNeighborOccupancyBand'
import { parseSplitterLatLng } from '@/features/splitters/lib/parseSplitterCoordinates'
import { SPLITTERS_LIST_STALE_TIME_MS } from '@/features/splitters/model/constants'
import type { Olt } from '@/features/splitters/model/olt'
import {
  SPLITTER_MAP_NEIGHBOR_RADIUS_METERS,
  type SplitterMapClientPoint,
  type SplitterMapOltPoint,
  type SplitterMapSuccessPayload,
} from '@/features/splitters/model/splitterMap'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

/** Vizinhos roteados: mesmo TTL da lista (evita refetch/OSRM ao reabrir o detalhe). */
const SPLITTER_MAP_NEIGHBORS_STALE_TIME_MS = SPLITTERS_LIST_STALE_TIME_MS

export type SplitterMapDataState =
  | { type: 'no-coordinates' }
  | { type: 'loading' }
  | { type: 'error'; error: unknown }
  | { type: 'success'; payload: SplitterMapSuccessPayload }

function resolveOltPoint(olt: Olt | null): SplitterMapOltPoint | null {
  if (olt === null) return null
  if (olt.lat === null || olt.lng === null) return null
  return {
    lat: olt.lat,
    lng: olt.lng,
    code: olt.code,
    title: olt.title,
  }
}

export function useSplitterMapData(args: {
  splitterCode: string
  splitterTitle: string
  latitude: string
  longitude: string
  olt: Olt | null
  clientPoints: SplitterMapClientPoint[]
}): { state: SplitterMapDataState; refetch: () => void } {
  const center = useMemo(
    () => parseSplitterLatLng(args.latitude, args.longitude),
    [args.latitude, args.longitude],
  )
  const hasCenter = center !== null

  const neighborsQuery = useQuery({
    queryKey: splittersKeys.mapNeighborsRouted(
      args.splitterCode,
      SPLITTER_MAP_NEIGHBOR_RADIUS_METERS,
    ),
    queryFn: () =>
      fetchSplitterNeighborsRoutedFromLocalDb({
        code: args.splitterCode,
        straightRadiusMeters: SPLITTER_MAP_NEIGHBOR_RADIUS_METERS,
      }),
    staleTime: SPLITTER_MAP_NEIGHBORS_STALE_TIME_MS,
    enabled: hasCenter,
  })

  const refetch = useCallback(() => {
    void neighborsQuery.refetch()
  }, [neighborsQuery])

  const successPayload = useMemo((): SplitterMapSuccessPayload | null => {
    if (center === null || neighborsQuery.data === undefined) {
      return null
    }
    const rawNeighbors = neighborsQuery.data.neighbors ?? []
    const routingUnavailable = Boolean(neighborsQuery.data.routingUnavailable)
    const isCondominium = Boolean(neighborsQuery.data.isCondominium)
    const condominiumReliefAvailable = Boolean(neighborsQuery.data.condominiumReliefAvailable)
    const currentStreet = neighborsQuery.data.originStreet ?? null
    const originStreetRaw = neighborsQuery.data.originStreetRaw ?? null

    const neighbors = rawNeighbors.map((neighbor) => ({
      ...neighbor,
      occupancyBand: occupancyBandForUsage(
        neighbor.busyCount,
        neighbor.outPorts,
      ),
    }))

    return {
      center,
      currentSplitterCode: args.splitterCode.trim(),
      currentSplitterTitle: args.splitterTitle.trim(),
      currentStreet,
      originStreetRaw,
      neighbors,
      oltPoint: resolveOltPoint(args.olt),
      clientPoints: args.clientPoints,
      routingUnavailable,
      isCondominium,
      condominiumReliefAvailable,
    }
  }, [
    center,
    neighborsQuery.data,
    args.splitterCode,
    args.splitterTitle,
    args.olt,
    args.clientPoints,
  ])

  const state = useMemo((): SplitterMapDataState => {
    if (center === null) {
      return { type: 'no-coordinates' }
    }
    if (neighborsQuery.isPending) {
      return { type: 'loading' }
    }
    if (neighborsQuery.isError) {
      return { type: 'error', error: neighborsQuery.error }
    }
    if (successPayload === null) {
      return { type: 'loading' }
    }
    return { type: 'success', payload: successPayload }
  }, [
    center,
    neighborsQuery.isPending,
    neighborsQuery.isError,
    neighborsQuery.error,
    successPayload,
  ])

  return { state, refetch }
}
