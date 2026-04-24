import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSplitterNeighborsFromLocalDb } from '@/features/splitters/api/fetchSplitterNeighborsFromLocalDb'
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
    queryKey: splittersKeys.mapNeighbors(
      args.splitterCode,
      SPLITTER_MAP_NEIGHBOR_RADIUS_METERS,
    ),
    queryFn: () =>
      fetchSplitterNeighborsFromLocalDb({
        code: args.splitterCode,
        radiusMeters: SPLITTER_MAP_NEIGHBOR_RADIUS_METERS,
      }),
    staleTime: SPLITTERS_LIST_STALE_TIME_MS,
    enabled: hasCenter,
  })

  const refetch = () => {
    void neighborsQuery.refetch()
  }

  if (center === null) {
    return { state: { type: 'no-coordinates' }, refetch }
  }

  if (neighborsQuery.isPending) {
    return { state: { type: 'loading' }, refetch }
  }

  if (neighborsQuery.isError) {
    return { state: { type: 'error', error: neighborsQuery.error }, refetch }
  }

  const neighbors = (neighborsQuery.data ?? []).map((neighbor) => ({
    ...neighbor,
    occupancyBand: occupancyBandForUsage(
      neighbor.busyCount,
      neighbor.outPorts,
    ),
  }))

  const payload: SplitterMapSuccessPayload = {
    center,
    currentSplitterCode: args.splitterCode.trim(),
    currentSplitterTitle: args.splitterTitle.trim(),
    neighbors,
    oltPoint: resolveOltPoint(args.olt),
    clientPoints: args.clientPoints,
  }

  return { state: { type: 'success', payload }, refetch }
}
