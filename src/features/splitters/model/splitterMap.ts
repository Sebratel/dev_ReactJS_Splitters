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
  lat: number
  lng: number
  outPorts: number
  busyCount: number
  occupancyBand: SplitterNeighborOccupancyBand
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
  neighbors: SplitterMapNeighbor[]
  oltPoint: SplitterMapOltPoint | null
  clientPoints: SplitterMapClientPoint[]
}
