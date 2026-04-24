import { useQuery } from '@tanstack/react-query'
import { resolveGeocodedAddressForSplitter } from '@/features/splitters/api/reverseGeocode'
import { parseSplitterLatLng } from '@/features/splitters/lib/parseSplitterCoordinates'
import type { GeocodedAddress } from '@/features/splitters/model/geocodedAddress'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

/**
 * Entrada mínima: código do splitter + coordenadas textuais (como no modelo BFF).
 */
export type SplitterAddressInput = {
  splitterCode: string
  latitude: string
  longitude: string
}

/**
 * Reverse geocode com cache em `localStorage` (Hive no Flutter) + cache TanStack.
 *
 * `staleTime: Infinity` evita re-chamar a rede enquanto a query estiver quente;
 * persistência entre sessões vem do `splitterAddressCache`.
 */
export type SplitterAddressState =
  | { type: 'no-coordinates' }
  | { type: 'loading' }
  | { type: 'error'; error: unknown }
  | { type: 'empty' }
  | { type: 'ready'; address: GeocodedAddress }

export function useSplitterAddress(
  input: SplitterAddressInput,
): {
  state: SplitterAddressState
  refetch: () => void
} {
  const code = input.splitterCode.trim()
  const coords = parseSplitterLatLng(input.latitude, input.longitude)
  const canRun = code.length > 0 && coords !== null

  const query = useQuery({
    queryKey: splittersKeys.geocode(canRun ? code : '__disabled__'),
    queryFn: () =>
      resolveGeocodedAddressForSplitter({
        splitterCode: code,
        lat: coords!.lat,
        lng: coords!.lng,
      }),
    enabled: canRun,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
  })

  const refetch = () => {
    void query.refetch()
  }

  if (!canRun) {
    return { state: { type: 'no-coordinates' }, refetch }
  }

  if (query.isPending) {
    return { state: { type: 'loading' }, refetch }
  }

  if (query.isError) {
    return { state: { type: 'error', error: query.error }, refetch }
  }

  if (query.data === null || query.data === undefined) {
    return { state: { type: 'empty' }, refetch }
  }

  return {
    state: { type: 'ready', address: query.data },
    refetch,
  }
}
