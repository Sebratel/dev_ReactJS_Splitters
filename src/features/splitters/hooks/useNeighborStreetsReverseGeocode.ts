import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { resolveGeocodedAddressForSplitter } from '@/features/splitters/api/reverseGeocode'
import type { SplitterMapNeighbor } from '@/features/splitters/model/splitterMap'

/** Limite de chamadas Nominatim/proxy por abertura do mapa (vizinhos sem rua no BFF). */
const NEIGHBOR_CLIENT_GEOCODE_MAX = 14
/** Pausa curta entre requisições; ruas já vêm do cadastro quando possível (BFF não bloqueia mais no enrich). */
const NEIGHBOR_GEOCODE_GAP_MS = 450

function sortNeighborTargetsForStreet(
  neighbors: ReadonlyArray<SplitterMapNeighbor>,
  routingUnavailable: boolean,
): SplitterMapNeighbor[] {
  const empty = neighbors.filter(
    (n) => !(n.street ?? '').trim() && Number.isFinite(n.lat) && Number.isFinite(n.lng),
  )
  const routeDist = (n: SplitterMapNeighbor) => {
    if (!routingUnavailable && n.routeMeters != null) return n.routeMeters
    return n.straightMeters ?? 1e9
  }
  const hasFreePort = (n: SplitterMapNeighbor) => n.outPorts > 0 && n.busyCount < n.outPorts
  const tier = (n: SplitterMapNeighbor) => {
    if (n.isCondominium) return 2
    return hasFreePort(n) ? 0 : 1
  }
  /**
   * Ordenar primeiro por distância (vizinhos mais próximos primeiro).
   * Antes: tier (porta livre) vinha antes da distância — splitters lotados sem rua no cadastro
   * (ex.: alívio em CTO cheia) ficavam fora dos 4 geocodes e apareciam "Não informada" no popup,
   * enquanto no marcador "splitter atual" a rua vinha do detalhe + geocode do centro.
   */
  return [...empty].sort((a, b) => {
    const d = routeDist(a) - routeDist(b)
    if (d !== 0) return d
    return tier(a) - tier(b)
  }).slice(0, NEIGHBOR_CLIENT_GEOCODE_MAX)
}

/**
 * Reverse geocode no browser para vizinhos ainda sem `street` na resposta do BFF
 * (fallback quando o servidor não enriquece ou cache/proxy está desatualizado).
 * Ordem: mais próximos primeiro (até NEIGHBOR_CLIENT_GEOCODE_MAX), para o popup coincidir com o contexto do equipamento atual.
 */
export function useNeighborStreetsReverseGeocode(args: {
  enabled: boolean
  neighbors: ReadonlyArray<SplitterMapNeighbor>
  routingUnavailable: boolean
}) {
  const targets = useMemo(
    () =>
      args.enabled ? sortNeighborTargetsForStreet(args.neighbors, args.routingUnavailable) : [],
    [args.enabled, args.neighbors, args.routingUnavailable],
  )

  const codesKey = useMemo(() => targets.map((t) => t.code).join('|'), [targets])

  return useQuery({
    queryKey: ['splitter-map-neighbor-streets', 'v1', codesKey] as const,
    queryFn: async (): Promise<Map<string, string>> => {
      const out = new Map<string, string>()
      for (let i = 0; i < targets.length; i += 1) {
        const n = targets[i]
        const addr = await resolveGeocodedAddressForSplitter({
          splitterCode: n.code,
          lat: n.lat,
          lng: n.lng,
        })
        const s = addr?.street?.trim()
        if (s) out.set(n.code, s)
        if (i < targets.length - 1 && NEIGHBOR_GEOCODE_GAP_MS > 0) {
          await new Promise<void>((r) => {
            window.setTimeout(r, NEIGHBOR_GEOCODE_GAP_MS)
          })
        }
      }
      return out
    },
    enabled: args.enabled && targets.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 48 * 60 * 60 * 1000,
  })
}
