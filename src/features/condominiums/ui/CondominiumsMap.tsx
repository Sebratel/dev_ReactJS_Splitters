import 'leaflet/dist/leaflet.css'
import { memo, useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

export type CondoMapPoint = {
  nome: string
  lat: number
  lng: number
  splitters: number
  activeClients: number
  avgUsage: number
  redeChurn: number
  totalTickets: number
  signalPct: number | null
  /** Dias até saturar (95%) — menor ETA entre os splitters; null se não projetável. */
  etaSoonestDays: number | null
  color: string
  radius: number
}

/**
 * Reenquadra o mapa apenas quando o CONJUNTO de pontos (coordenadas) muda — não a cada
 * novo array (o resumo de ONU faz polling e recria os pontos). Assim o zoom/pan do usuário
 * não é resetado enquanto ele navega.
 */
function FitBounds({ points }: { points: CondoMapPoint[] }) {
  const map = useMap()
  const signature = useMemo(
    () =>
      points
        .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
        .sort()
        .join('|'),
    [points],
  )
  const lastSignature = useRef<string | null>(null)
  useEffect(() => {
    if (points.length === 0) return
    if (lastSignature.current === signature) return
    lastSignature.current = signature
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
    // `points` é intencionalmente omitido: só reenquadra quando a assinatura muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map])
  return null
}

/** Mapa de condomínios: um círculo por condomínio (centro dos seus splitters). */
export const CondominiumsMap = memo(function CondominiumsMap({ points }: { points: CondoMapPoint[] }) {
  const center: [number, number] =
    points.length > 0 ? [points[0].lat, points[0].lng] : [-3.71, -38.54]

  return (
    <MapContainer
      center={center}
      zoom={11}
      scrollWheelZoom
      style={{ height: 440, width: '100%', borderRadius: 12 }}
    >
      <TileLayer attribution={OSM_ATTR} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds points={points} />
      {points.map((p) => (
        <CircleMarker
          key={p.nome}
          center={[p.lat, p.lng]}
          radius={p.radius}
          pathOptions={{ color: p.color, fillColor: p.color, fillOpacity: 0.55, weight: 1.5 }}
        >
          <Popup>
            <div style={{ minWidth: 180 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{p.nome}</p>
              <table style={{ marginTop: 6, fontSize: 12, width: '100%' }}>
                <tbody>
                  <tr>
                    <td style={{ color: '#64748b' }}>Splitters</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.splitters}</td>
                  </tr>
                  {p.activeClients > 0 ? (
                    <tr>
                      <td style={{ color: '#64748b' }}>Clientes</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {p.activeClients.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <td style={{ color: '#64748b' }}>Ocupação média</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {p.avgUsage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: '#64748b' }}>Churn de rede</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: p.redeChurn > 0 ? '#e11d48' : undefined }}>
                      {p.redeChurn > 0 ? p.redeChurn.toLocaleString('pt-BR') : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: '#64748b' }}>Massivas</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {p.totalTickets > 0 ? p.totalTickets.toLocaleString('pt-BR') : '—'}
                    </td>
                  </tr>
                  {p.etaSoonestDays != null ? (
                    <tr>
                      <td style={{ color: '#64748b' }}>Satura em</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {p.etaSoonestDays <= 45
                          ? `~${Math.round(p.etaSoonestDays)} d`
                          : p.etaSoonestDays <= 365
                            ? `~${Math.round(p.etaSoonestDays / 30)} m`
                            : '> 1 a'}
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
    </MapContainer>
  )
})
