import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import { Link, useLocation } from 'react-router-dom'
import {
  SPLITTER_MAP_NEIGHBOR_RADIUS_METERS,
  type SplitterMapNeighbor,
  type SplitterMapSuccessPayload,
} from '@/features/splitters/model/splitterMap'

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

const BAND_COLOR: Record<SplitterMapNeighbor['occupancyBand'], string> = {
  critical: '#f87171',
  warning: '#fb923c',
  ok: '#4ade80',
  unknown: '#9ca3af',
}

const BAND_LABEL: Record<SplitterMapNeighbor['occupancyBand'], string> = {
  critical: 'Ocupação crítica',
  warning: 'Ocupação alta',
  ok: 'Ocupação normal',
  unknown: 'Ocupação indisponível',
}

function clientDisplayName(cl: {
  name: string
  user: string
  authenticationId: number
}): string {
  const name = cl.name.trim()
  const user = cl.user.trim()
  if (name !== '' && name !== 'Cliente Desconhecido') return name
  if (user !== '') return user
  return `Cliente (autenticação nº ${cl.authenticationId})`
}

/** Uma linha: largura acompanha o texto até ao limite da viewport; scroll X fino se necessário (padrão em todos os tooltips do mapa). */
const TOOLTIP_MAP_HORIZ_BASE =
  '!pointer-events-auto !box-border !rounded-lg !border !bg-white !px-2.5 !py-1.5 !text-[11px] !leading-snug !shadow-md !w-fit !max-w-[calc(100vw-2rem)] !whitespace-nowrap !overflow-x-auto !text-left [scrollbar-width:thin]'

const TOOLTIP_CLIENT =
  `client-map-tooltip ${TOOLTIP_MAP_HORIZ_BASE} !border-amber-300/90 !font-bold !text-amber-950`

const TOOLTIP_CLIENT_CORPORATE =
  `client-map-corporate-tooltip ${TOOLTIP_MAP_HORIZ_BASE} !border-violet-400/90 !font-bold !text-violet-950`

const TOOLTIP_CURRENT_SPLITTER =
  `map-splitter-current-tooltip ${TOOLTIP_MAP_HORIZ_BASE} !border-rose-200/90 !text-neutral-900`

const TOOLTIP_NEIGHBOR =
  `map-splitter-neighbor-tooltip ${TOOLTIP_MAP_HORIZ_BASE} !border-emerald-200/90 !text-neutral-900`

const TOOLTIP_OLT =
  `map-olt-hover-tooltip ${TOOLTIP_MAP_HORIZ_BASE} !border-blue-200/90 !text-neutral-900`

function neighborDivIcon(band: SplitterMapNeighbor['occupancyBand']): L.DivIcon {
  const fill = BAND_COLOR[band]
  return L.divIcon({
    className: 'splitter-map-neighbor-marker',
    html: `<div style="width:22px;height:22px;border-radius:9999px;background:${fill};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

const currentIcon = L.divIcon({
  className: 'splitter-map-current-marker',
  html:
    '<div style="width:24px;height:24px;border-radius:9999px 9999px 9999px 0;background:#ef4444;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
})

const oltIcon = L.divIcon({
  className: 'splitter-map-olt-marker',
  html:
    '<div style="width:20px;height:20px;border-radius:4px;background:#3b82f6;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

/** Casa em quadrado — âmbar (residencial) ou roxo (corporativo), mesmo SVG. */
const CLIENT_HOUSE_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" focusable="false">' +
  '<path fill="#fff" d="M12 2 2 11.5h3.5V21h6.5v-5h2v5H18.5V11.5H22L12 2z"/>' +
  '</svg>'

const clientIcon = L.divIcon({
  className: 'splitter-map-client-marker',
  html:
    `<div style="width:26px;height:26px;border-radius:7px;background:#ca8a04;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center" aria-hidden="true">${CLIENT_HOUSE_SVG}</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
})

const clientIconCorporate = L.divIcon({
  className: 'splitter-map-client-marker-corporate',
  html:
    `<div style="width:26px;height:26px;border-radius:7px;background:#7c3aed;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center" aria-hidden="true">${CLIENT_HOUSE_SVG}</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
})

function FitBoundsController({
  fitPoints,
  fallbackCenter,
  fallbackZoom = 16,
}: {
  fitPoints: [number, number][]
  fallbackCenter: [number, number]
  fallbackZoom?: number
}) {
  const map = useMap()

  useEffect(() => {
    const valid = fitPoints.filter(
      ([a, b]) =>
        Number.isFinite(a) &&
        Number.isFinite(b) &&
        Math.abs(a) <= 90 &&
        Math.abs(b) <= 180,
    )
    if (valid.length >= 2) {
      map.fitBounds(L.latLngBounds(valid), {
        padding: [44, 44],
        maxZoom: 17,
      })
    } else if (valid.length === 1) {
      map.setView(valid[0], fallbackZoom)
    } else {
      map.setView(fallbackCenter, fallbackZoom)
    }
  }, [map, fitPoints, fallbackCenter, fallbackZoom])

  return null
}

/** Leaflet mede o container na montagem; após abrir modal ou mudar layout chamar invalidateSize. */
function InvalidateSizeOnMountAndResize() {
  const map = useMap()
  useEffect(() => {
    const run = () => {
      map.invalidateSize()
    }
    run()
    const t1 = window.setTimeout(run, 120)
    const t2 = window.setTimeout(run, 450)
    window.addEventListener('resize', run)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', run)
    }
  }, [map])
  return null
}

type SplitterMapLeafletProps = {
  payload: SplitterMapSuccessPayload
  /** Quando false, oculta marcadores de assinantes (splitters, OLT e raio permanecem). Default: true. */
  showClientMarkers?: boolean
  /** Classes do container do mapa (altura/largura/borda). */
  mapClassName?: string
}

/**
 * Mapa OSM (Leaflet): splitter atual, raio 200 m (linha reta), vizinhos com distância roteada (OSRM foot) quando disponível.
 */
export function SplitterMapLeaflet({
  payload,
  showClientMarkers = true,
  mapClassName = 'z-0 h-full min-h-[200px] w-full rounded-2xl',
}: SplitterMapLeafletProps) {
  const location = useLocation()
  const {
    center,
    currentSplitterCode,
    currentSplitterTitle,
    currentStreet,
    neighbors,
    oltPoint,
    clientPoints,
    routingUnavailable,
  } = payload
  const c: [number, number] = [center.lat, center.lng]
  const oltPos = useMemo<[number, number] | null>(() => {
    const oltLat = oltPoint?.lat ?? null
    const oltLng = oltPoint?.lng ?? null
    return oltLat !== null && oltLng !== null ? [oltLat, oltLng] : null
  }, [oltPoint])

  const fitPoints = useMemo(() => {
    const pts: [number, number][] = [[center.lat, center.lng]]
    for (const n of neighbors) {
      pts.push([n.lat, n.lng])
    }
    if (oltPos !== null) {
      pts.push(oltPos)
    }
    if (showClientMarkers) {
      for (const cl of clientPoints) {
        pts.push([cl.lat, cl.lng])
      }
    }
    return pts
  }, [center.lat, center.lng, neighbors, oltPos, clientPoints, showClientMarkers])

  return (
    <MapContainer center={c} zoom={16} className={mapClassName} scrollWheelZoom>
      <InvalidateSizeOnMountAndResize />
      <FitBoundsController fitPoints={fitPoints} fallbackCenter={c} fallbackZoom={16} />
      <TileLayer attribution={OSM_ATTR} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Circle
        center={c}
        radius={SPLITTER_MAP_NEIGHBOR_RADIUS_METERS}
        pathOptions={{
          color: '#22c55e',
          fillColor: '#22c55e',
          fillOpacity: 0.15,
          weight: 2,
        }}
      />
      {oltPos !== null ? (
        <Polyline
          positions={[oltPos, c]}
          pathOptions={{ color: '#fb923c', weight: 3 }}
        />
      ) : null}
      <Marker position={c} icon={currentIcon}>
        <Tooltip
          direction="top"
          offset={[0, -10]}
          opacity={1}
          sticky
          className={TOOLTIP_CURRENT_SPLITTER}
        >
          <span className="inline-block whitespace-nowrap">
            {(() => {
              const code = currentSplitterCode.trim()
              const title = currentSplitterTitle.trim()
              const head = title || code || 'Equipamento atual'
              const showCode = code !== '' && head !== code
              return (
                <>
                  <span className="font-bold">{head}</span>
                  {showCode ? (
                    <span className="font-mono text-[10px] font-semibold text-neutral-600">
                      {' · '}
                      {code}
                    </span>
                  ) : null}
                </>
              )
            })()}
          </span>
        </Tooltip>
        <Popup>
          <div className="min-w-[220px] text-sm">
            <p className="font-semibold text-neutral-900">
              {currentSplitterTitle.trim() || currentSplitterCode.trim() || 'Equipamento atual'}
            </p>
            {currentSplitterCode.trim() !== '' && currentSplitterTitle.trim() !== currentSplitterCode.trim() ? (
              <p className="font-mono text-neutral-500">{currentSplitterCode}</p>
            ) : null}
            <p className="mt-2 text-xs text-neutral-600">
              Rua: <span className="font-semibold text-neutral-800">{currentStreet?.trim() || 'Não informada'}</span>
            </p>
          </div>
        </Popup>
      </Marker>
      {oltPos !== null && oltPoint !== null ? (
        <Marker position={oltPos} icon={oltIcon}>
          <Tooltip
            direction="top"
            offset={[0, -8]}
            opacity={1}
            sticky
            className={TOOLTIP_OLT}
          >
            <span className="inline-block whitespace-nowrap">
              <span className="text-[10px] font-bold uppercase tracking-wide text-blue-800/90">
                OLT
              </span>
              {(() => {
                const code = oltPoint.code.trim()
                const title = oltPoint.title.trim()
                const head = title || code || 'OLT'
                const showCode = code !== '' && head !== code
                return (
                  <>
                    <span className="text-neutral-400">{' · '}</span>
                    <span className="font-bold">{head}</span>
                    {showCode ? (
                      <span className="font-mono text-[10px] font-semibold text-neutral-600">
                        {' · '}
                        {code}
                      </span>
                    ) : null}
                  </>
                )
              })()}
            </span>
          </Tooltip>
        </Marker>
      ) : null}
      {showClientMarkers
        ? clientPoints.map((cl) => {
            const title = clientDisplayName(cl)
            const corporate = cl.isCorporate === true
            const markerIcon = corporate ? clientIconCorporate : clientIcon
            return (
              <Marker key={`client-${cl.authenticationId}`} position={[cl.lat, cl.lng]} icon={markerIcon}>
                <Tooltip
                  direction="top"
                  offset={[0, -12]}
                  opacity={1}
                  sticky
                  className={corporate ? TOOLTIP_CLIENT_CORPORATE : TOOLTIP_CLIENT}
                >
                  <span className="inline-block whitespace-nowrap">{title}</span>
                </Tooltip>
                <Popup>
                  <div className="min-w-[220px] text-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      {corporate ? 'Cliente corporativo' : 'Cliente'}
                    </p>
                    <p className="mt-0.5 text-base font-semibold leading-snug text-neutral-900">{title}</p>
                    {cl.user.trim() !== '' && cl.name.trim() !== '' && cl.user.trim() !== cl.name.trim() ? (
                      <p className="mt-1 font-mono text-xs text-neutral-600">Usuário: {cl.user.trim()}</p>
                    ) : null}
                    <p className="mt-1 font-mono text-xs text-neutral-500">Autenticação nº {cl.authenticationId}</p>
                    <Link
                      className={
                        corporate
                          ? 'mt-2 inline-flex text-sm font-semibold text-violet-800 underline'
                          : 'mt-2 inline-flex text-sm font-semibold text-amber-800 underline'
                      }
                      to={`/clientes/${cl.authenticationId}`}
                      state={location.state}
                    >
                      Abrir cliente
                    </Link>
                  </div>
                </Popup>
              </Marker>
            )
          })
        : null}
      {neighbors.map((n) => (
        <Marker
          key={n.code}
          position={[n.lat, n.lng]}
          icon={neighborDivIcon(n.occupancyBand)}
        >
          <Tooltip
            direction="top"
            offset={[0, -8]}
            opacity={1}
            sticky
            className={TOOLTIP_NEIGHBOR}
          >
            <span className="inline-block whitespace-nowrap">
              {(() => {
                const code = n.code.trim()
                const title = n.title.trim()
                const head = title || code || 'Splitter vizinho'
                const showCode = code !== '' && head !== code
                return (
                  <>
                    <span className="font-bold">{head}</span>
                    {showCode ? (
                      <span className="font-mono text-[10px] font-semibold text-neutral-600">
                        {' · '}
                        {code}
                      </span>
                    ) : null}
                  </>
                )
              })()}
            </span>
          </Tooltip>
          <Popup>
            <div className="min-w-[220px] text-sm">
              <p className="font-semibold text-neutral-900">{n.title}</p>
              <p className="font-mono text-neutral-500">{n.code}</p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: BAND_COLOR[n.occupancyBand] }}
                />
                <span className="text-xs font-semibold text-neutral-700">
                  {BAND_LABEL[n.occupancyBand]}
                </span>
              </div>
              <p className="mt-2 text-xs text-neutral-600">
                {n.busyCount} porta(s) ocupada(s) de {n.outPorts}
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                Rua: <span className="font-semibold text-neutral-800">{n.street?.trim() || 'Não informada'}</span>
              </p>
              {n.straightMeters !== undefined ? (
                <p className="mt-1 text-[11px] text-neutral-600">
                  Linha reta: ~{n.straightMeters.toLocaleString('pt-BR')} m
                  {routingUnavailable || n.routeMeters == null
                    ? ' · rota pedestre indisponível'
                    : ` · rota pedestre (OSRM): ~${n.routeMeters.toLocaleString('pt-BR')} m`}
                </p>
              ) : null}
              <Link
                className="mt-3 inline-flex items-center text-sm font-semibold text-emerald-700 underline"
                to={`/splitters/${encodeURIComponent(n.code)}`}
                state={location.state}
              >
                Abrir detalhe
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

