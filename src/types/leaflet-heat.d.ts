import 'leaflet'

/**
 * Tipos do `leaflet.heat`, que não traz os seus nem tem pacote em `@types`.
 *
 * O plugin estende o objeto global `L` em runtime (é UMD), por isso a declaração certa é
 * aumentar o módulo 'leaflet' — assim `L.heatLayer(...)` e `L.HeatLayer` passam a existir
 * para o TypeScript exatamente como existem em runtime, sem `any` espalhado pelos mapas.
 *
 * As opções cobrem o que a biblioteca aceita; os três mapas do projeto (ChurnHeatMap,
 * IntelligenceSaturationMap e OnuSignalHeatMap) usam radius, blur, maxZoom, max,
 * minOpacity e gradient.
 */
declare module 'leaflet' {
  interface HeatMapOptions {
    /** Raio de cada ponto, em píxeis. */
    radius?: number
    /** Desfoque aplicado ao ponto, em píxeis. */
    blur?: number
    /** Zoom em que os pontos atingem a intensidade máxima. */
    maxZoom?: number
    /** Intensidade máxima da escala (1 = valores já normalizados). */
    max?: number
    /** Opacidade mínima do ponto menos intenso. */
    minOpacity?: number
    /** Mapa de paragem (0 a 1) para cor, ex.: `{ 0.4: 'blue', 1: 'red' }`. */
    gradient?: Record<number, string>
  }

  /** Camada devolvida por `L.heatLayer`. Aceita-se onde uma `Layer` é esperada. */
  class HeatLayer extends Layer {
    constructor(latlngs: HeatLatLngTuple[], options?: HeatMapOptions)
    setOptions(options: HeatMapOptions): this
    addLatLng(latlng: HeatLatLngTuple): this
    setLatLngs(latlngs: HeatLatLngTuple[]): this
    redraw(): this
  }

  /** `[lat, lng]` ou `[lat, lng, intensidade]`. */
  type HeatLatLngTuple = [number, number] | [number, number, number]

  function heatLayer(latlngs: HeatLatLngTuple[], options?: HeatMapOptions): HeatLayer
}
