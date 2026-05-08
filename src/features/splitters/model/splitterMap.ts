/**
 * Tipos para o mapa do detalhe do splitter (paridade `SplitterDetailPage` — Flutter).
 */

/** Mesmo raio fixo de `_isWithinRadius(..., radiusInMeters: 200)` no Flutter. */
export const SPLITTER_MAP_NEIGHBOR_RADIUS_METERS = 200 as const

/**
 * Faixa de ocupação para cor do marcador de vizinho — paridade `_getSplitterColor` no Flutter.
 */
export type SplitterNeighborOccupancyBand = 'critical' | 'warning' | 'ok' | 'unknown'

export type SplitterMapNeighbor = {
  code: string
  title: string
  isCondominium?: boolean
  street?: string | null
  lat: number
  lng: number
  outPorts: number
  busyCount: number
  occupancyBand: SplitterNeighborOccupancyBand
  /** Distância geográfica (Haversine) até o splitter central em metros. */
  straightMeters?: number
  /** Distância aproximada por rede viária (OSRM foot), metros — pode ser null se o roteamento falhar. */
  routeMeters?: number | null
}

export type SplitterMapCenter = {
  lat: number
  lng: number
}

export type SplitterMapOltPoint = {
  lat: number
  lng: number
  code: string
  title: string
}

/** Assinante com coordenadas no cadastro (mesma linha da consulta de conexões). */
export type SplitterMapClientPoint = {
  authenticationId: number
  /** Nome cadastral (`NOME CLIENTE` / people). */
  name: string
  /** PPPoE / usuário da conexão — fallback quando o nome estiver vazio. */
  user: string
  lat: number
  lng: number
  /** Cliente corporativo (insígnia / `CORPORATIVO` na consulta). */
  isCorporate?: boolean
}

export type SplitterMapSuccessPayload = {
  center: SplitterMapCenter
  /** Splitter central (detalhe atual) — para tooltip. */
  currentSplitterCode: string
  currentSplitterTitle: string
  currentStreet?: string | null
  neighbors: SplitterMapNeighbor[]
  oltPoint: SplitterMapOltPoint | null
  clientPoints: SplitterMapClientPoint[]
  /** OSRM indisponível: só há distância em linha reta. */
  routingUnavailable?: boolean
  /** Classificação do splitter atual pelo título (RES./COND./ED. => condomínio). */
  isCondominium?: boolean
  /**
   * Outro splitter secundário no mesmo condomínio (título RES./COND./ED. com mesma chave normalizada)
   * possui porta livre — alívio sem depender de vizinhança geográfica/OSRM.
   */
  condominiumReliefAvailable?: boolean
}
