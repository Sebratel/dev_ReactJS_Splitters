import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import type {
  OnuHeatPoint,
  OnuProblemMarker,
} from '@/features/onu/model/onuNetworkSummary'

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const BR_FALLBACK_CENTER: [number, number] = [-14.235, -51.9253]

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

/**
 * Gradiente da densidade de atenuados: amarelo → âmbar. Propositalmente NÃO
 * chega ao vermelho/laranja-forte — vermelho fica reservado aos marcadores de
 * OFFLINE real, para não dar a impressão de que sinal fraco = cliente caído.
 */
const HEAT_GRADIENT: Record<number, string> = {
  0.2: '#fef08a',
  0.5: '#fde047',
  0.8: '#fcd34d',
  1: '#f59e0b',
}

const MARKER_STYLE: Record<
  OnuProblemMarker['kind'],
  { color: string; fill: string; label: string; radius: number }
> = {
  offline: { color: '#9f1239', fill: '#e11d48', label: 'Offline', radius: 6 },
  critical: { color: '#9a3412', fill: '#f97316', label: 'Sinal crítico', radius: 5 },
}

function fmtDbm(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(1)} dBm`
}

function OnuHeatLayer({ latlngs, visible }: { latlngs: OnuHeatPoint[]; visible: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (!visible || latlngs.length === 0) return
    let layer: L.HeatLayer | null = null
    let cancelled = false
    void (async () => {
      await ensureLeafletHeat(L)
      if (cancelled) return
      const heat = L.heatLayer(latlngs, {
        radius: 22,
        blur: 16,
        maxZoom: 16,
        max: 1,
        minOpacity: 0.35,
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
  }, [map, latlngs, visible])
  return null
}

function MarkerLayer({ markers }: { markers: OnuProblemMarker[] }) {
  return (
    <>
      {markers.map((m, i) => {
        const style = MARKER_STYLE[m.kind]
        return (
          <CircleMarker
            key={`${m.username ?? 'cli'}-${i}`}
            center={[m.lat, m.lng]}
            radius={style.radius}
            pathOptions={{
              color: style.color,
              fillColor: style.fill,
              fillOpacity: 0.85,
              weight: 1.5,
            }}
          >
            <Popup>
              <div className="space-y-0.5 text-xs">
                <p className="font-bold uppercase tracking-wide" style={{ color: style.color }}>
                  {style.label}
                </p>
                <p className="font-mono font-semibold">{m.username ?? '—'}</p>
                <p className="text-on-surface-variant">{m.oltHostname ?? 'OLT —'}</p>
                {m.rxPower !== null ? (
                  <p className="text-on-surface-variant">
                    RX <span className="font-semibold tabular-nums">{fmtDbm(m.rxPower)}</span>
                  </p>
                ) : null}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    const valid = coords.filter(([a, b]) => Math.abs(a) <= 90 && Math.abs(b) <= 180)
    if (valid.length >= 2) {
      map.fitBounds(L.latLngBounds(valid), { padding: [40, 40], maxZoom: 14 })
    } else if (valid.length === 1) {
      map.setView(valid[0], 13)
    } else {
      map.setView(BR_FALLBACK_CENTER, 4)
    }
  }, [map, coords])
  return null
}

function LegendToggle({
  label,
  count,
  color,
  checked,
  onToggle,
}: {
  label: string
  count: number
  color: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-700">
      <input type="checkbox" checked={checked} onChange={onToggle} className="h-3 w-3 accent-slate-700" />
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span>
        {label} <span className="tabular-nums text-on-surface-variant">({count.toLocaleString('pt-BR')})</span>
      </span>
    </label>
  )
}

/**
 * Mapa dos clientes com problema de sinal: heat de densidade dos ATENUADOS +
 * marcadores individuais CLICÁVEIS de offline e crítico (com cliente/OLT/sinal).
 * Camadas alternáveis via legenda.
 */
export function OnuSignalHeatMap({
  heatPoints,
  problemMarkers,
}: {
  heatPoints: OnuHeatPoint[]
  problemMarkers: OnuProblemMarker[]
}) {
  const [showHeat, setShowHeat] = useState(true)
  const [showOffline, setShowOffline] = useState(true)
  const [showCritical, setShowCritical] = useState(true)

  const offlineMarkers = useMemo(
    () => problemMarkers.filter((m) => m.kind === 'offline'),
    [problemMarkers],
  )
  const criticalMarkers = useMemo(
    () => problemMarkers.filter((m) => m.kind === 'critical'),
    [problemMarkers],
  )

  const visibleMarkers = useMemo(() => {
    const out: OnuProblemMarker[] = []
    if (showOffline) out.push(...offlineMarkers)
    if (showCritical) out.push(...criticalMarkers)
    return out
  }, [showOffline, showCritical, offlineMarkers, criticalMarkers])

  // Bounds a partir de todos os pontos conhecidos (não muda com os toggles).
  const allCoords = useMemo<[number, number][]>(
    () => [
      ...heatPoints.map(([a, b]) => [a, b] as [number, number]),
      ...problemMarkers.map((m) => [m.lat, m.lng] as [number, number]),
    ],
    [heatPoints, problemMarkers],
  )

  const heatKey = useMemo(() => `${heatPoints.length}-${showHeat}`, [heatPoints, showHeat])

  if (heatPoints.length === 0 && problemMarkers.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/70 dark:bg-emerald-950/40 py-8 text-center text-sm text-emerald-800 dark:text-emerald-200">
        Nenhum cliente com sinal problemático e coordenadas válidas no momento. 🎉
      </p>
    )
  }

  return (
    <div className="relative h-[min(480px,58vh)] w-full overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-inner ring-1 ring-slate-200/60 dark:ring-white/10">
      <MapContainer
        center={BR_FALLBACK_CENTER}
        zoom={5}
        className="z-0 h-full w-full [&_.leaflet-control-attribution]:text-[10px]"
        scrollWheelZoom
      >
        <TileLayer
          attribution={OSM_ATTR}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0.92}
        />
        <OnuHeatLayer key={heatKey} latlngs={heatPoints} visible={showHeat} />
        <MarkerLayer markers={visibleMarkers} />
        <FitBounds coords={allCoords} />
      </MapContainer>

      {/* Legenda + filtros de camada */}
      <div className="pointer-events-auto absolute right-3 top-3 z-[1000] space-y-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-surface-container-lowest/95 px-3 py-2.5 shadow-md backdrop-blur-sm">
        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Camadas</p>
        <LegendToggle
          label="Offline"
          count={offlineMarkers.length}
          color={MARKER_STYLE.offline.fill}
          checked={showOffline}
          onToggle={() => setShowOffline((v) => !v)}
        />
        <LegendToggle
          label="Sinal crítico"
          count={criticalMarkers.length}
          color={MARKER_STYLE.critical.fill}
          checked={showCritical}
          onToggle={() => setShowCritical((v) => !v)}
        />
        <LegendToggle
          label="Sinal fraco — têm conexão"
          count={heatPoints.length}
          color="#f59e0b"
          checked={showHeat}
          onToggle={() => setShowHeat((v) => !v)}
        />
      </div>
    </div>
  )
}
