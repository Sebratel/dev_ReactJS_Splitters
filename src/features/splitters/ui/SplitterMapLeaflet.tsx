import 'leaflet/dist/leaflet.css'

import L, { type PopupOptions } from 'leaflet'
import { useEffect, useMemo, useRef } from 'react'
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
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

function escapeAttr(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

/** Leaflet usa z-index ≈ posição Y + offset; diferenças grandes evitam assinantes “por cima” dos vizinhos. */
const Z_CLIENT = 100
const Z_OLT = 2_000
const Z_NEIGHBOR = 50_000
const Z_CURRENT = 60_000

/** Card compacto: altura limitada com scroll; sem auto-pan para não “prender” o arraste do mapa. */
const MAP_HOST_CLASS = 'splitter-map-leaflet-host'
const MAP_CARD_POPUP: Pick<
  PopupOptions,
  'className' | 'maxWidth' | 'minWidth' | 'maxHeight' | 'autoPan' | 'autoPanPadding' | 'keepInView'
> = {
  className: 'splitter-map-card-popup',
  maxWidth: 268,
  minWidth: 200,
  maxHeight: 280,
  autoPan: false,
  autoPanPadding: [32, 32],
  keepInView: false,
}

function neighborDivIcon(band: SplitterMapNeighbor['occupancyBand'], hoverTitle: string): L.DivIcon {
  const fill = BAND_COLOR[band]
  const t = escapeAttr(hoverTitle.trim() || 'Vizinho')
  const sz = 28
  const r = Math.round(sz / 2)
  return L.divIcon({
    className: 'splitter-map-neighbor-marker',
    html: `<div role="img" aria-label="${t}" title="${t}" style="width:${sz}px;height:${sz}px;border-radius:9999px;background:${fill};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);pointer-events:auto;cursor:pointer"></div>`,
    iconSize: [sz, sz],
    iconAnchor: [r, r],
  })
}

function buildCurrentSplitterIcon(hoverTitle: string): L.DivIcon {
  const t = escapeAttr(hoverTitle.trim() || 'Splitter atual')
  return L.divIcon({
    className: 'splitter-map-current-marker',
    html: `<div role="img" aria-label="${t}" title="${t}" style="width:24px;height:24px;border-radius:9999px 9999px 9999px 0;background:#ef4444;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.4);pointer-events:auto;cursor:pointer"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  })
}

function buildOltIcon(hoverTitle: string): L.DivIcon {
  const t = escapeAttr(hoverTitle.trim() || 'OLT')
  return L.divIcon({
    className: 'splitter-map-olt-marker',
    html: `<div role="img" aria-label="${t}" title="${t}" style="width:20px;height:20px;border-radius:4px;background:#3b82f6;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);pointer-events:auto;cursor:pointer"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

/** Casa em quadrado — âmbar (residencial) ou roxo (corporativo), mesmo SVG. */
const CLIENT_HOUSE_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" focusable="false">' +
  '<path fill="#fff" d="M12 2 2 11.5h3.5V21h6.5v-5h2v5H18.5V11.5H22L12 2z"/>' +
  '</svg>'

function buildClientIcon(corporate: boolean, hoverTitle: string): L.DivIcon {
  const bg = corporate ? '#7c3aed' : '#ca8a04'
  const t = escapeAttr(hoverTitle.trim() || 'Cliente')
  return L.divIcon({
    className: corporate ? 'splitter-map-client-marker-corporate' : 'splitter-map-client-marker',
    html: `<div role="img" aria-label="${t}" title="${t}" style="width:26px;height:26px;border-radius:7px;background:${bg};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;pointer-events:auto;cursor:pointer">${CLIENT_HOUSE_SVG}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  })
}

function FitBoundsController({
  fitPoints,
  fitBoundsKey,
  fallbackCenter,
  fallbackZoom = 16,
}: {
  fitPoints: [number, number][]
  /** Só refaz fit quando a geometria mudar (evita reset ao atualizar só texto dos vizinhos / ruas). */
  fitBoundsKey: string
  fallbackCenter: [number, number]
  fallbackZoom?: number
}) {
  const map = useMap()
  const fitPointsRef = useRef(fitPoints)
  fitPointsRef.current = fitPoints

  useEffect(() => {
    const pts = fitPointsRef.current
    const valid = pts.filter(
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
  }, [map, fitBoundsKey, fallbackCenter, fallbackZoom])

  return null
}

/** Leaflet pode deixar `leaflet-dragging` / `pointer-events` no body; isso bloqueia cliques fora do mapa. */
function LeafletDocumentGuards() {
  const map = useMap()
  useEffect(() => {
    const sync = () => {
      document.body.classList.remove('leaflet-dragging')
      document.body.style.removeProperty('pointer-events')
      document.querySelectorAll('.leaflet-drag-target').forEach((el) => {
        el.classList.remove('leaflet-drag-target')
      })
    }
    sync()
    map.on('dragend', sync)
    map.on('zoomend', sync)
    window.addEventListener('mouseup', sync)
    window.addEventListener('touchend', sync, { passive: true })
    window.addEventListener('blur', sync)
    return () => {
      map.off('dragend', sync)
      map.off('zoomend', sync)
      window.removeEventListener('mouseup', sync)
      window.removeEventListener('touchend', sync)
      window.removeEventListener('blur', sync)
      sync()
    }
  }, [map])
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
  /**
   * Texto da rua no popup do splitter atual (lista/detalhe), quando o BFF devolve `originStreet` vazio
   * mas `splitter.street` da SPLITTERS_BASE_QUERY está preenchido.
   */
  currentStreetDisplay?: string | null
  /** Quando false, oculta marcadores de assinantes (splitters, OLT e raio permanecem). Default: true. */
  showClientMarkers?: boolean
  /** Classes do container do mapa (altura/largura/borda). */
  mapClassName?: string
  /** Linha verde centro → vizinho de alívio (regra de planejamento por rua + OSRM). */
  reliefFootPath?: [[number, number], [number, number]] | null
}

/**
 * Mapa OSM (Leaflet): splitter atual, raio 200 m (linha reta), vizinhos com distância roteada (OSRM foot) quando disponível.
 */
export function SplitterMapLeaflet({
  payload,
  currentStreetDisplay,
  showClientMarkers = true,
  mapClassName = 'relative h-full min-h-[200px] w-full rounded-2xl',
  reliefFootPath = null,
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
    isCondominium,
    condominiumReliefAvailable,
    originStreetRaw,
  } = payload
  const streetLineForCurrentMarker = (currentStreetDisplay ?? currentStreet)?.trim() || 'Não informada'
  const c = useMemo(
    () => [center.lat, center.lng] as [number, number],
    [center.lat, center.lng],
  )
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

  const fitBoundsGeometryKey = useMemo(() => {
    const nKey = [...neighbors]
      .map((n) => `${String(n.code).trim()}:${Number(n.lat).toFixed(5)},${Number(n.lng).toFixed(5)}`)
      .sort()
      .join('|')
    const clKey = showClientMarkers
      ? [...clientPoints]
          .map((cl) => `${cl.authenticationId}:${Number(cl.lat).toFixed(5)},${Number(cl.lng).toFixed(5)}`)
          .sort((a, b) => a.localeCompare(b))
          .join('|')
      : ''
    const oltKey =
      oltPos !== null ? `${Number(oltPos[0]).toFixed(5)},${Number(oltPos[1]).toFixed(5)}` : ''
    return [
      `${Number(center.lat).toFixed(6)},${Number(center.lng).toFixed(6)}`,
      nKey,
      oltKey,
      showClientMarkers ? `cl:${clKey}` : 'cl:off',
    ].join('::')
  }, [center.lat, center.lng, neighbors, oltPos, clientPoints, showClientMarkers])

  const reliefLinePositions = useMemo(() => {
    if (reliefFootPath === null || reliefFootPath.length !== 2) return null
    const [a, b] = reliefFootPath
    if (
      !Array.isArray(a) ||
      !Array.isArray(b) ||
      a.length !== 2 ||
      b.length !== 2 ||
      !Number.isFinite(a[0]) ||
      !Number.isFinite(a[1]) ||
      !Number.isFinite(b[0]) ||
      !Number.isFinite(b[1])
    ) {
      return null
    }
    return [
      [a[0], a[1]] as [number, number],
      [b[0], b[1]] as [number, number],
    ]
  }, [reliefFootPath])

  const currentMarkerIcon = useMemo(() => {
    const code = currentSplitterCode.trim()
    const title = currentSplitterTitle.trim()
    const head = title || code || 'Equipamento atual'
    const label = code !== '' && head !== code ? `${head} (${code})` : head
    return buildCurrentSplitterIcon(label)
  }, [currentSplitterCode, currentSplitterTitle])

  const oltMarkerIcon = useMemo(() => {
    if (!oltPoint) return null
    const code = oltPoint.code.trim()
    const title = oltPoint.title.trim()
    const head = title || code || 'OLT'
    const label = code !== '' && head !== code ? `OLT · ${head} (${code})` : `OLT · ${head}`
    return buildOltIcon(label)
  }, [oltPoint])

  const clientPointsSignature = useMemo(
    () =>
      [...clientPoints]
        .map(
          (cl) =>
            `${cl.authenticationId}:${Number(cl.lat).toFixed(6)},${Number(cl.lng).toFixed(6)}:${cl.isCorporate === true ? 1 : 0}:${cl.name.trim()}:${cl.user.trim()}`,
        )
        .sort()
        .join('|'),
    [clientPoints],
  )

  const neighborsSignature = useMemo(
    () =>
      [...neighbors]
        .map((n) =>
          [
            String(n.code).trim(),
            Number(n.lat).toFixed(6),
            Number(n.lng).toFixed(6),
            n.occupancyBand,
            String(n.title ?? '').trim(),
            n.busyCount,
            n.outPorts,
            String(n.street ?? '').trim(),
            n.routeMeters ?? 'nr',
            n.straightMeters ?? 'ns',
          ].join(':'),
        )
        .sort()
        .join('|'),
    [neighbors],
  )

  /**
   * Novas instâncias de L.DivIcon a cada render fazem o Marker chamar setIcon sempre;
   * isso reinicia o ícone e pode quebrar clique/bindPopup. Manter referências estáveis.
   */
  const clientMarkerEntries = useMemo(
    () =>
      clientPoints.map((cl) => {
        const title = clientDisplayName(cl)
        const corporate = cl.isCorporate === true
        return {
          cl,
          title,
          corporate,
          icon: buildClientIcon(corporate, title),
        }
      }),
    [clientPointsSignature],
  )

  const neighborMarkerEntries = useMemo(
    () =>
      neighbors.map((n) => {
        const code = n.code.trim()
        const title = n.title.trim()
        const head = title || code || 'Splitter vizinho'
        const hoverLabel = code !== '' && head !== code ? `${head} (${code})` : head
        return { n, icon: neighborDivIcon(n.occupancyBand, hoverLabel) }
      }),
    [neighborsSignature],
  )

  return (
    <MapContainer
      center={c}
      zoom={16}
      className={`${MAP_HOST_CLASS} ${mapClassName}`.trim()}
      scrollWheelZoom
    >
      <LeafletDocumentGuards />
      <InvalidateSizeOnMountAndResize />
      <FitBoundsController
        fitPoints={fitPoints}
        fitBoundsKey={fitBoundsGeometryKey}
        fallbackCenter={c}
        fallbackZoom={16}
      />
      <TileLayer attribution={OSM_ATTR} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Circle
        center={c}
        radius={SPLITTER_MAP_NEIGHBOR_RADIUS_METERS}
        interactive={false}
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
          pathOptions={{ color: '#fb923c', weight: 3, interactive: false }}
        />
      ) : null}
      {reliefLinePositions !== null ? (
        <Polyline
          positions={reliefLinePositions}
          pathOptions={{
            color: '#15803d',
            weight: 3,
            opacity: 0.88,
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false,
          }}
        />
      ) : null}
      {showClientMarkers
        ? clientMarkerEntries.map(({ cl, title, corporate, icon }) => (
            <Marker
              key={`client-${cl.authenticationId}`}
              position={[cl.lat, cl.lng]}
              icon={icon}
              zIndexOffset={Z_CLIENT}
            >
              <Popup {...MAP_CARD_POPUP}>
                <div className="min-w-0 max-w-full text-sm leading-snug">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                    {corporate ? 'Cliente corporativo' : 'Cliente'}
                  </p>
                  <p className="mt-0.5 text-base font-semibold leading-snug text-on-surface">{title}</p>
                  {cl.user.trim() !== '' && cl.name.trim() !== '' && cl.user.trim() !== cl.name.trim() ? (
                    <p className="mt-1 font-mono text-xs text-on-surface-variant">Usuário: {cl.user.trim()}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-xs text-on-surface-variant">Autenticação nº {cl.authenticationId}</p>
                  <Link
                    className={
                      corporate
                        ? 'mt-2 inline-flex text-sm font-semibold text-violet-800 dark:text-violet-200 underline'
                        : 'mt-2 inline-flex text-sm font-semibold text-amber-800 dark:text-amber-200 underline'
                    }
                    to={`/clientes/${cl.authenticationId}`}
                    state={location.state}
                  >
                    Abrir cliente
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))
        : null}
      {oltPos !== null && oltPoint !== null && oltMarkerIcon !== null ? (
        <Marker position={oltPos} icon={oltMarkerIcon} zIndexOffset={Z_OLT}>
          <Popup {...MAP_CARD_POPUP}>
            <div className="min-w-0 max-w-full text-sm leading-snug">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-800/90">OLT</p>
              <p className="mt-0.5 font-semibold text-on-surface">
                {oltPoint.title.trim() || oltPoint.code.trim() || 'OLT'}
              </p>
              {oltPoint.code.trim() !== '' && oltPoint.title.trim() !== oltPoint.code.trim() ? (
                <p className="font-mono text-on-surface-variant">{oltPoint.code}</p>
              ) : null}
            </div>
          </Popup>
        </Marker>
      ) : null}
      {neighborMarkerEntries.map(({ n, icon }) => {
        const code = n.code.trim()
        return (
          <Marker key={`neighbor-${code}:${n.lat}:${n.lng}`} position={[n.lat, n.lng]} icon={icon} zIndexOffset={Z_NEIGHBOR}>
            <Popup {...MAP_CARD_POPUP}>
              <div className="min-w-0 max-w-full text-sm leading-snug">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/90">
                  Splitter vizinho
                </p>
                <p className="mt-1 font-semibold leading-snug text-on-surface">{n.title.trim() || n.code}</p>
                <Link
                  className="mt-2 inline-flex items-center text-sm font-semibold text-emerald-700 dark:text-emerald-200 underline"
                  to={`/splitters/${encodeURIComponent(n.code)}`}
                  state={location.state}
                >
                  Abrir detalhe
                </Link>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: BAND_COLOR[n.occupancyBand] }}
                  />
                  <span className="text-xs font-semibold text-on-surface-variant">{BAND_LABEL[n.occupancyBand]}</span>
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                  {n.busyCount} porta(s) ocupada(s) de {n.outPorts}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Rua: <span className="font-semibold text-on-surface">{n.street?.trim() || 'Não informada'}</span>
                </p>
                {n.straightMeters !== undefined ? (
                  <p className="mt-1 text-[11px] text-on-surface-variant">
                    Linha reta: ~{n.straightMeters.toLocaleString('pt-BR')} m
                    {routingUnavailable || n.routeMeters == null
                      ? ' · rota pedestre indisponível'
                      : ` · rota pedestre (OSRM): ~${n.routeMeters.toLocaleString('pt-BR')} m`}
                  </p>
                ) : null}
              </div>
            </Popup>
          </Marker>
        )
      })}
      <Marker position={c} icon={currentMarkerIcon} zIndexOffset={Z_CURRENT}>
        <Popup {...MAP_CARD_POPUP}>
          <div className="min-w-0 max-w-full text-sm leading-snug">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-800/90">Splitter atual</p>
            <p className="mt-1 font-semibold leading-snug text-on-surface">
              {currentSplitterTitle.trim() || currentSplitterCode.trim() || 'Equipamento atual'}
            </p>
            {currentSplitterCode.trim() !== '' && currentSplitterTitle.trim() !== currentSplitterCode.trim() ? (
              <p className="mt-0.5 font-mono text-xs text-on-surface-variant">{currentSplitterCode}</p>
            ) : null}
            <p className="mt-2 text-xs text-on-surface-variant">
              Rua: <span className="font-semibold text-on-surface">{streetLineForCurrentMarker}</span>
            </p>
            {originStreetRaw != null &&
            String(originStreetRaw).trim() !== '' &&
            String(originStreetRaw).trim() !== streetLineForCurrentMarker ? (
              <p className="mt-1 text-[11px] text-on-surface-variant">
                Via (geocodificação):{' '}
                <span className="font-medium text-on-surface-variant">{String(originStreetRaw).trim()}</span>
              </p>
            ) : null}
            {isCondominium === true ? (
              <p className="mt-2 text-[11px] font-medium text-on-surface-variant">Classificação: condomínio (título)</p>
            ) : null}
            {condominiumReliefAvailable === true ? (
              <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-200">
                Há porta livre em outro splitter do mesmo condomínio (alívio interna).
              </p>
            ) : null}
            {routingUnavailable === true ? (
              <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-200">Rota pedestre (vizinhos) indisponível neste momento.</p>
            ) : null}
            {currentSplitterCode.trim() !== '' ? (
              <Link
                className="mt-3 inline-flex text-sm font-semibold text-rose-700 dark:text-rose-200 underline"
                to={`/splitters/${encodeURIComponent(currentSplitterCode.trim())}`}
                state={location.state}
              >
                Abrir ficha do splitter
              </Link>
            ) : null}
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  )
}

