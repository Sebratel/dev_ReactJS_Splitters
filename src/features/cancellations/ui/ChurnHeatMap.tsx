import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const BR_FALLBACK_CENTER: [number, number] = [-3.71, -38.54]

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

const HEAT_GRADIENT: Record<number, string> = {
  0.2: '#fecaca',
  0.5: '#f87171',
  0.8: '#ef4444',
  1: '#b91c1c',
}

function ChurnHeatLayer({ latlngs }: { latlngs: [number, number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (latlngs.length === 0) return
    let layer: L.HeatLayer | null = null
    let cancelled = false
    void (async () => {
      await ensureLeafletHeat(L)
      if (cancelled) return
      const heat = L.heatLayer(latlngs, {
        radius: 24,
        blur: 18,
        maxZoom: 16,
        max: 1,
        minOpacity: 0.3,
        gradient: HEAT_GRADIENT,
      }).addTo(map)
      if (cancelled) {
        map.removeLayer(heat)
        return
      }
      layer = heat
    })()
    return () => {
      cancelled = true
      if (layer) map.removeLayer(layer)
    }
  }, [map, latlngs])
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
    if (valid.length >= 2) {
      map.fitBounds(L.latLngBounds(valid), { padding: [36, 36], maxZoom: 15 })
    } else if (valid.length === 1) {
      map.setView(valid[0], 14)
    }
    // só reenquadra quando o conjunto de coordenadas muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map])
  return null
}

/** Mapa de calor do churn de rede por splitter + marcadores clicáveis dos piores pontos. */
export function ChurnHeatMap({ points }: { points: ChurnHeatPoint[] }) {
  const withCoords = useMemo(
    () => points.filter((p) => p.rede > 0 && Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [points],
  )
  const maxRede = useMemo(
    () => withCoords.reduce((m, p) => Math.max(m, p.rede), 0),
    [withCoords],
  )
  const latlngs = useMemo<[number, number, number][]>(
    () =>
      withCoords.map((p) => [p.lat, p.lng, maxRede > 0 ? Math.min(1, p.rede / maxRede) : 0.5]),
    [withCoords, maxRede],
  )
  // Marcadores só dos piores pontos (evita centenas de círculos sobre o heat).
  const markers = useMemo(
    () => [...withCoords].sort((a, b) => b.rede - a.rede).slice(0, 200),
    [withCoords],
  )
  const allCoords = useMemo<[number, number][]>(
    () => withCoords.map((p) => [p.lat, p.lng]),
    [withCoords],
  )
  const heatKey = useMemo(() => `${withCoords.length}-${maxRede}`, [withCoords.length, maxRede])

  if (withCoords.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/70 py-8 text-center text-sm text-neutral-500">
        Nenhum churn de rede com coordenada no recorte atual.
      </p>
    )
  }

  return (
    <div className="relative h-[min(460px,56vh)] w-full overflow-hidden rounded-xl border border-neutral-200/80 ring-1 ring-neutral-200/60">
      <MapContainer
        center={BR_FALLBACK_CENTER}
        zoom={11}
        className="z-0 h-full w-full [&_.leaflet-control-attribution]:text-[10px]"
        scrollWheelZoom
      >
        <TileLayer attribution={OSM_ATTR} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" opacity={0.92} />
        <ChurnHeatLayer key={heatKey} latlngs={latlngs} />
        {markers.map((p) => (
          <CircleMarker
            key={p.splitterTitle}
            center={[p.lat, p.lng]}
            radius={Math.max(4, Math.min(16, Math.sqrt(p.rede) * 2.5))}
            pathOptions={{ color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.5, weight: 1 }}
          >
            <Popup>
              <div style={{ minWidth: 170 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{p.splitterTitle}</p>
                <p style={{ margin: '2px 0 6px', color: '#64748b', fontSize: 11 }}>{p.oltLabel}</p>
                <table style={{ fontSize: 12, width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ color: '#64748b' }}>Churn de rede</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#e11d48' }}>{p.rede}</td>
                    </tr>
                    <tr>
                      <td style={{ color: '#64748b' }}>Churn total</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.total}</td>
                    </tr>
                    {p.usage != null ? (
                      <tr>
                        <td style={{ color: '#64748b' }}>Ocupação</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {p.usage.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
                        </td>
                      </tr>
                    ) : null}
                    {p.signalPct != null ? (
                      <tr>
                        <td style={{ color: '#64748b' }}>Sinal deg.+off.</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {p.signalPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                        </td>
                      </tr>
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
