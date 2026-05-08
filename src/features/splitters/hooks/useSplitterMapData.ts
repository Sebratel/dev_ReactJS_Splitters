import { useMemo } from 'react'
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

  const rawNeighbors = neighborsQuery.data?.neighbors ?? []
  const routingUnavailable = Boolean(neighborsQuery.data?.routingUnavailable)
  const isCondominium = Boolean(neighborsQuery.data?.isCondominium)
  const condominiumReliefAvailable = Boolean(
    neighborsQuery.data?.condominiumReliefAvailable,
  )
  const currentStreet = neighborsQuery.data?.originStreet ?? null

  const neighbors = rawNeighbors.map((neighbor) => ({
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
    currentStreet,
    neighbors,
    oltPoint: resolveOltPoint(args.olt),
    clientPoints: args.clientPoints,
    routingUnavailable,
    isCondominium,
    condominiumReliefAvailable,
  }

  return { state: { type: 'success', payload }, refetch }
}
