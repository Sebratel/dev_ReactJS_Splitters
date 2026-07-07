import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const BR_FALLBACK_CENTER: [number, number] = [-3.71, -38.54]

export type HeatMetric = 'churn' | 'saturacao' | 'sinal'

export type ChurnHeatPoint = {
  splitterTitle: string
  oltLabel: string
  lat: number
  lng: number
  rede: number
  total: number
  usage: number | null
  signalPct: number | null
}

/** leaflet.heat é UMD e espera `global L`; garantimos antes do import dinâmico. */
let leafletHeatLoader: Promise<void> | null = null
function ensureLeafletHeat(leafletRef: typeof L): Promise<void> {
  if (!leafletHeatLoader) {
    leafletHeatLoader = (async () => {
      const g = globalThis as unknown as { L?: typeof L }
      g.L = leafletRef
      await import('leaflet.heat/dist/leaflet-heat.js')
    })()
  }
  return leafletHeatLoader
}

const GRADIENTS: Record<HeatMetric, Record<number, string>> = {
  churn: { 0.2: '#fecaca', 0.5: '#f87171', 0.8: '#ef4444', 1: '#b91c1c' },
  saturacao: { 0.2: '#bbf7d0', 0.5: '#fde047', 0.8: '#f59e0b', 1: '#dc2626' },
  sinal: { 0.2: '#fce7f3', 0.5: '#f9a8d4', 0.8: '#ec4899', 1: '#9d174e' },
}
const MARKER_COLOR: Record<HeatMetric, { stroke: string; fill: string }> = {
  churn: { stroke: '#b91c1c', fill: '#ef4444' },
  saturacao: { stroke: '#b45309', fill: '#f59e0b' },
  sinal: { stroke: '#9d174e', fill: '#ec4899' },
}

/** Valor do ponto conforme a métrica (0 quando indisponível). */
function metricValue(p: ChurnHeatPoint, metric: HeatMetric): number {
  if (metric === 'saturacao') return p.usage ?? 0
  if (metric === 'sinal') return p.signalPct ?? 0
  return p.rede
}
/** Peso normalizado 0..1 para o heat. */
function metricWeight(p: ChurnHeatPoint, metric: HeatMetric, maxChurn: number): number {
  if (metric === 'saturacao') return Math.min(1, (p.usage ?? 0) / 100)
  if (metric === 'sinal') return Math.min(1, (p.signalPct ?? 0) / 100)
  return maxChurn > 0 ? Math.min(1, p.rede / maxChurn) : 0
}
/** O ponto entra na camada da métrica? */
function hasMetric(p: ChurnHeatPoint, metric: HeatMetric): boolean {
  if (metric === 'saturacao') return p.usage != null && p.usage > 0
  if (metric === 'sinal') return p.signalPct != null && p.signalPct > 0
  return p.rede > 0
}

function HeatLayer({ latlngs, gradient }: { latlngs: [number, number, number][]; gradient: Record<number, string> }) {
  const map = useMap()
  useEffect(() => {
    if (latlngs.length === 0) return
    let layer: L.HeatLayer | null = null
    let cancelled = false
    void (async () => {
      await ensureLeafletHeat(L)
      if (cancelled) return
      const heat = L.heatLayer(latlngs, {
        radius: 24, blur: 18, maxZoom: 16, max: 1, minOpacity: 0.3, gradient,
      }).addTo(map)
      if (cancelled) { map.removeLayer(heat); return }
      layer = heat
    })()
    return () => {
      cancelled = true
      if (layer) map.removeLayer(layer)
    }
  }, [map, latlngs, gradient])
  return null
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  const signature = useMemo(
    () => coords.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).sort().join('|'),
    [coords],
  )
  useEffect(() => {
    const valid = coords.filter(([a, b]) => Math.abs(a) <= 90 && Math.abs(b) <= 180)
    if (valid.length >= 2) map.fitBounds(L.latLngBounds(valid), { padding: [36, 36], maxZoom: 15 })
    else if (valid.length === 1) map.setView(valid[0], 14)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map])
  return null
}

/** Mapa de calor com camada selecionável: churn de rede, saturação ou sinal. */
export function ChurnHeatMap({ points, metric }: { points: ChurnHeatPoint[]; metric: HeatMetric }) {
  const withMetric = useMemo(
    () => points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && hasMetric(p, metric)),
    [points, metric],
  )
  const maxChurn = useMemo(() => points.reduce((m, p) => Math.max(m, p.rede), 0), [points])
  const latlngs = useMemo<[number, number, number][]>(
    () => withMetric.map((p) => [p.lat, p.lng, metricWeight(p, metric, maxChurn)]),
    [withMetric, metric, maxChurn],
  )
  const markers = useMemo(
    () => [...withMetric].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)).slice(0, 200),
    [withMetric, metric],
  )
  const allCoords = useMemo<[number, number][]>(() => withMetric.map((p) => [p.lat, p.lng]), [withMetric])
  const heatKey = useMemo(() => `${metric}-${withMetric.length}-${maxChurn}`, [metric, withMetric.length, maxChurn])

  if (withMetric.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/70 py-8 text-center text-sm text-neutral-500">
        Sem dados desta camada no recorte atual.
      </p>
    )
  }

  const mk = MARKER_COLOR[metric]
  return (
    <div className="relative h-[min(460px,56vh)] w-full overflow-hidden rounded-xl border border-neutral-200/80 ring-1 ring-neutral-200/60">
      <MapContainer center={BR_FALLBACK_CENTER} zoom={11} className="z-0 h-full w-full [&_.leaflet-control-attribution]:text-[10px]" scrollWheelZoom>
        <TileLayer attribution={OSM_ATTR} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" opacity={0.92} />
        <HeatLayer key={heatKey} latlngs={latlngs} gradient={GRADIENTS[metric]} />
        {markers.map((p) => (
          <CircleMarker
            key={p.splitterTitle}
            center={[p.lat, p.lng]}
            radius={Math.max(4, Math.min(16, Math.sqrt(Math.max(1, metricValue(p, metric))) * (metric === 'churn' ? 2.5 : 1.2)))}
            pathOptions={{ color: mk.stroke, fillColor: mk.fill, fillOpacity: 0.5, weight: 1 }}
          >
            <Popup>
              <div style={{ minWidth: 170 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{p.splitterTitle}</p>
                <p style={{ margin: '2px 0 6px', color: '#64748b', fontSize: 11 }}>{p.oltLabel}</p>
                <table style={{ fontSize: 12, width: '100%' }}>
                  <tbody>
                    <tr><td style={{ color: '#64748b' }}>Churn de rede</td><td style={{ textAlign: 'right', fontWeight: 700, color: '#e11d48' }}>{p.rede}</td></tr>
                    <tr><td style={{ color: '#64748b' }}>Churn total</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{p.total}</td></tr>
                    {p.usage != null ? (
                      <tr><td style={{ color: '#64748b' }}>Ocupação</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{p.usage.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</td></tr>
                    ) : null}
                    {p.signalPct != null ? (
                      <tr><td style={{ color: '#64748b' }}>Sinal deg.+off.</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{p.signalPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        <FitBounds coords={allCoords} />
      </MapContainer>
    </div>
  )
}
