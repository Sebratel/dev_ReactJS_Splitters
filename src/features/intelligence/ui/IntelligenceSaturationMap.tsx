import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import { Link } from 'react-router-dom'
import type { IntelligenceSaturationCell } from '@/features/intelligence/hooks/useNetworkIntelligenceData'
import { formatBrazilDateTimeShortDisplay } from '@/shared/lib/formatBrazilDisplayDate'
import { cn } from '@/shared/lib/utils'

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

const BR_FALLBACK_CENTER: [number, number] = [-14.235, -51.9253]

/** Mesmo roxo dos mapas de splitter / legenda corporativo no app. */
export const CORPORATE_BRAND_PURPLE = '#7c3aed'

/** leaflet.heat é UMD e espera `global L`; no bundle Vite garantimos isso antes do import dinâmico. */
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/**
 * Intensidade do heatmap: uso base + reforço para corporativo e massivas abertas,
 * para não reduzir o mapa só à coordenada geográfica.
 */
function heatIntensityFromCell(c: IntelligenceSaturationCell): number {
  const u = clamp(c.usagePercent, 0, 100)
  let base: number
  if (u >= 95) base = 0.72 + ((u - 95) / 5) * 0.28
  else if (u >= 70) base = 0.34 + ((u - 70) / 25) * 0.34
  else base = 0.14 + (u / 70) * 0.26

  if (c.hasCorporateClients) base = Math.min(1, base + 0.12)
  if (c.openTickets > 0) base = Math.min(1, base + 0.045 * Math.min(c.openTickets, 6))

  return base
}

/** Gradient mais cedo para tons quentes — facilita ver concentração sem depender só do zoom. */
const HEAT_GRADIENT: Record<number, string> = {
  0.12: '#10b981',
  0.28: '#65a30d',
  0.42: '#ca8a04',
  0.58: '#ea580c',
  0.75: '#ef4444',
  0.9: '#dc2626',
  1: '#9f1239',
}

function SaturationHeatLayer({ latlngs }: { latlngs: [number, number, number][] }) {
  const map = useMap()

  useEffect(() => {
    let layer: L.HeatLayer | null = null
    let cancelled = false

    void (async () => {
      await ensureLeafletHeat(L)
      if (cancelled || latlngs.length === 0) return
      const heat = L.heatLayer(latlngs, {
        /** Raio maior + blur menor = manchas mais legíveis (menos “névoa” difusa). */
        radius: 44,
        blur: 18,
        maxZoom: 17,
        /** max menor amplifica o contraste das cores para a mesma intensidade numérica. */
        max: 0.78,
        minOpacity: 0.38,
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

function formatDeltaPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function saturationBand(usagePercent: number): 'critico' | 'alerta' | 'ok' {
  if (usagePercent >= 95) return 'critico'
  if (usagePercent >= 70) return 'alerta'
  return 'ok'
}

const BAND_COLOR: Record<ReturnType<typeof saturationBand>, string> = {
  critico: '#f43f5e',
  alerta: '#f59e0b',
  ok: '#10b981',
}

/** Halo proporcional a quantas massivas distintas envolvem o splitter no período (não há afetados por equipamento no cadastro). */
function haloRadiusPx(massivasDistinctCount: number): number {
  return Math.round(clamp(7 + Math.sqrt(massivasDistinctCount + 1) * 3.35, 9, 46))
}

function saturationMarkerDivIcon(cell: IntelligenceSaturationCell): L.DivIcon {
  const fill = BAND_COLOR[saturationBand(cell.usagePercent)]
  const score = cell.attentionScore
  const outer = Math.round(14 + (score / 100) * 26)
  const inner = Math.max(11, outer - 8)
  const corporate = cell.hasCorporateClients
  const shadow = corporate
    ? `0 0 0 3px ${CORPORATE_BRAND_PURPLE}, 0 2px 9px rgba(0,0,0,0.38)`
    : '0 2px 9px rgba(0,0,0,0.38)'
  const badge = corporate
    ? `<span style="position:absolute;right:-4px;bottom:-3px;z-index:3;font-size:7px;font-weight:900;line-height:1;padding:2px 4px;border-radius:4px;background:${CORPORATE_BRAND_PURPLE};color:#fff;font-family:system-ui,sans-serif;border:1px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.25)">PJ</span>`
    : ''
  const html = `<div style="position:relative;width:${outer}px;height:${outer}px;display:flex;align-items:center;justify-content:center">${badge}<div style="width:${inner}px;height:${inner}px;border-radius:50%;background:${fill};border:2px solid #fff;box-shadow:${shadow}"></div></div>`
  return L.divIcon({
    className: 'intel-map-marker-wrap',
    html,
    iconSize: [outer, outer],
    iconAnchor: [Math.round(outer / 2), Math.round(outer / 2)],
  })
}

function FitBoundsController({
  fitPoints,
  fallbackCenter,
  fallbackZoom = 4,
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
      map.fitBounds(L.latLngBounds(valid), { padding: [48, 48], maxZoom: 16 })
    } else if (valid.length === 1) {
      map.setView(valid[0], 14)
    } else {
      map.setView(fallbackCenter, fallbackZoom)
    }
  }, [map, fitPoints, fallbackCenter, fallbackZoom])

  return null
}

const TOOLTIP_CLASS =
  '!rounded-lg !border !border-slate-600 !bg-slate-900 !px-2.5 !py-2 !text-[11px] !leading-snug !text-white !shadow-xl !max-w-[20rem]'

function SaturationMapLegend() {
  return (
    <div className="mb-3 space-y-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Leitura do mapa</p>
        <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-on-surface-variant">
          Não é só GPS: o <span className="font-semibold text-slate-800">tamanho do marcador</span> reflete um índice de
          atenção (ocupação + massivas abertas + tendência de crescimento). O{' '}
          <span className="font-semibold text-slate-800">círculo semitransparente</span> ao redor estima a{' '}
          <span className="font-semibold text-slate-800">pegada de impacto</span> pelos clientes afetados em massivas no
          período. O calor de fundo agrega pressão regional e{' '}
          <span className="font-semibold" style={{ color: CORPORATE_BRAND_PURPLE }}>
            reforça violeta/corporativo + incidentes
          </span>{' '}
          onde aplicável.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-on-surface-variant">
        <span className="font-bold uppercase tracking-wide text-on-surface-variant">Calor</span>
        <span className="max-w-xl text-[11px] font-normal leading-snug text-on-surface-variant">
          Verde → âmbar → vermelho: concentração de pressão regional (uso + reforço por PJ e massivas). Quanto mais
          saturado o fundo, maior o acúmulo de pontos “quentes” naquela área.
        </span>
      </div>
      <div
        className="h-2.5 max-w-md rounded-full shadow-inner ring-1 ring-slate-200/80 dark:ring-white/10"
        style={{
          background:
            'linear-gradient(90deg, #10b981 0%, #65a30d 22%, #ca8a04 44%, #ea580c 62%, #ef4444 80%, #9f1239 100%)',
        }}
        role="img"
        aria-label="Escala do mapa de calor"
      />

      <div className="flex flex-wrap items-start gap-x-5 gap-y-2 text-[11px] text-on-surface-variant">
        <span className="font-bold uppercase tracking-wide text-on-surface-variant">Marcador</span>
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm ring-1 ring-slate-200 dark:ring-white/10" />
          &lt; 70%
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <span className="h-3 w-3 rounded-full bg-amber-500 shadow-sm ring-1 ring-slate-200 dark:ring-white/10" />
          70–94%
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <span className="h-3 w-3 rounded-full bg-rose-500 shadow-sm ring-1 ring-slate-200 dark:ring-white/10" />
          ≥ 95%
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <span
            className="inline-flex h-4 min-w-[1.25rem] items-center justify-center rounded px-1 text-[8px] font-black text-white shadow-sm ring-1 ring-white"
            style={{ backgroundColor: CORPORATE_BRAND_PURPLE }}
          >
            PJ
          </span>
          Corporativo (anel + selo)
        </span>
        <span className="font-normal text-on-surface-variant">
          Tamanho maior = índice de atenção mais alto · halo maior = mais vínculos com massivas distintas no período.
        </span>
      </div>
    </div>
  )
}

export type IntelligenceSaturationMapProps = {
  cells: IntelligenceSaturationCell[]
  /** Quando `cells` está vazio por filtro «só corporativo», evita mensagem genérica enganosa. */
  mapEmptyHint?: string | null
}

export function IntelligenceSaturationMap({ cells, mapEmptyHint }: IntelligenceSaturationMapProps) {
  const plotted = useMemo(
    () =>
      cells.filter((c) => {
        const { latitude: lat, longitude: lng } = c
        return (
          lat !== null &&
          lng !== null &&
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          Math.abs(lat) <= 90 &&
          Math.abs(lng) <= 180
        )
      }),
    [cells],
  )

  const heatLatLngs = useMemo(
    () =>
      plotted.map((c) => {
        const lat = c.latitude as number
        const lng = c.longitude as number
        return [lat, lng, heatIntensityFromCell(c)] as [number, number, number]
      }),
    [plotted],
  )

  const heatKey = useMemo(() => JSON.stringify(heatLatLngs), [heatLatLngs])

  const fitPoints = useMemo(
    () => plotted.map((c) => [c.latitude as number, c.longitude as number] as [number, number]),
    [plotted],
  )

  const skipped = cells.length - plotted.length

  if (cells.length === 0) {
    const hint =
      mapEmptyHint?.trim() ??
      'Nenhum splitter com tendência no período selecionado. Ajuste o intervalo de datas ou aguarde snapshots no BFF local.'
    const corporateEmpty = Boolean(mapEmptyHint?.trim())
    return (
      <p
        className={cn(
          'rounded-2xl border border-dashed py-8 text-center text-sm',
          corporateEmpty
            ? 'border-[#7c3aed]/40 bg-[#7c3aed]/[0.06] text-[#4c1d95]'
            : 'border-slate-200 dark:border-white/10 bg-surface-container-low/80 text-on-surface-variant',
        )}
      >
        {hint}
      </p>
    )
  }

  if (plotted.length === 0) {
    return (
      <div>
        <SaturationMapLegend />
        <p className="rounded-2xl border border-dashed border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/40 px-4 py-6 text-center text-sm text-amber-950">
          Há {cells.length} splitter(es) no período, mas nenhum tem coordenadas válidas (caixa de rede ou cadastro
          do splitter) na consulta base.
        </p>
      </div>
    )
  }

  return (
    <div>
      <SaturationMapLegend />
      {skipped > 0 ? (
        <p className="mb-2 text-[11px] font-medium text-on-surface-variant">
          {skipped} splitter(es) sem coordenadas — não aparecem no mapa.
        </p>
      ) : null}
      <div className="relative h-[min(420px,55vh)] w-full overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-inner ring-1 ring-slate-200/60 dark:ring-white/10">
        <MapContainer
          center={fitPoints[0] ?? BR_FALLBACK_CENTER}
          zoom={5}
          className="z-0 h-full w-full [&_.leaflet-control-attribution]:text-[10px]"
          scrollWheelZoom
        >
          <TileLayer
            attribution={OSM_ATTR}
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={0.92}
          />
          <SaturationHeatLayer key={heatKey} latlngs={heatLatLngs} />
          <FitBoundsController
            fitPoints={fitPoints}
            fallbackCenter={BR_FALLBACK_CENTER}
            fallbackZoom={4}
          />
          {plotted.map((cell) => {
            const lat = cell.latitude as number
            const lng = cell.longitude as number
            const bandColor = BAND_COLOR[saturationBand(cell.usagePercent)]
            const haloR = haloRadiusPx(cell.totalTickets)
            const haloStroke = cell.hasCorporateClients ? CORPORATE_BRAND_PURPLE : bandColor
            return (
              <CircleMarker
                key={`halo-${cell.splitterCode}`}
                center={[lat, lng]}
                radius={haloR}
                pathOptions={{
                  fillColor: cell.hasCorporateClients ? CORPORATE_BRAND_PURPLE : bandColor,
                  color: haloStroke,
                  fillOpacity: cell.hasCorporateClients ? 0.16 : 0.11,
                  weight: cell.hasCorporateClients ? 2 : 1,
                  opacity: 0.55,
                }}
              />
            )
          })}
          {plotted.map((cell) => {
            const title = cell.splitterTitle.trim()
            const captured =
              cell.capturedAt !== null
                ? formatBrazilDateTimeShortDisplay(cell.capturedAt)
                : '—'

            const lat = cell.latitude as number
            const lng = cell.longitude as number

            return (
              <Marker
                key={cell.splitterCode}
                position={[lat, lng]}
                icon={saturationMarkerDivIcon(cell)}
              >
                <Tooltip direction="top" offset={[0, -12]} opacity={1} className={TOOLTIP_CLASS}>
                  <div className="text-left">
                    {title !== '' ? (
                      <>
                        <p className="break-words font-semibold text-white">{title}</p>
                        <p className="mt-0.5 font-mono text-[10px] font-bold text-amber-300">
                          {cell.splitterCode}
                        </p>
                      </>
                    ) : (
                      <p className="font-mono font-bold text-amber-300">{cell.splitterCode}</p>
                    )}
                    {cell.hasCorporateClients ? (
                      <p className="mt-1 text-[10px] font-bold text-violet-200">
                        ● Cliente corporativo neste splitter
                      </p>
                    ) : null}
                    <p className="mt-1 text-white/95">
                      Atenção visual:{' '}
                      <span className="font-semibold tabular-nums">{cell.attentionScore.toFixed(0)}</span>
                      <span className="text-white/70"> /100</span>
                    </p>
                    <p className="text-white/95">
                      Uso:{' '}
                      <span className="font-semibold tabular-nums">{cell.usagePercent.toFixed(2)}%</span>
                    </p>
                    <p className="text-white/90">
                      Δ7d: <span className="tabular-nums">{formatDeltaPercent(cell.delta7d)}</span>
                      {' · '}
                      Δ30d: <span className="tabular-nums">{formatDeltaPercent(cell.delta30d)}</span>
                    </p>
                    <p className="mt-1 text-white/85">
                      Massivas abertas:{' '}
                      <span className="font-semibold tabular-nums">{cell.openTickets}</span>
                      {' · '}
                      Massivas no período (distintas):{' '}
                      <span className="font-semibold tabular-nums">
                        {cell.totalTickets.toLocaleString('pt-BR')}
                      </span>
                    </p>
                    <p className="mt-1 text-white/75">
                      Status: <span className="font-semibold">{cell.label}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/55">Referência: {captured}</p>
                  </div>
                </Tooltip>
                <Popup>
                  <div className="min-w-[220px] text-sm">
                    <p className="font-semibold text-on-surface">{title !== '' ? title : cell.splitterCode}</p>
                    <p className="font-mono text-xs text-on-surface-variant">{cell.splitterCode}</p>
                    {cell.hasCorporateClients ? (
                      <p
                        className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: CORPORATE_BRAND_PURPLE }}
                      >
                        Cliente corporativo (PJ)
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-700">
                      Índice de atenção:{' '}
                      <span className="font-semibold tabular-nums">{cell.attentionScore.toFixed(0)}</span>/100
                    </p>
                    <p className="text-xs text-slate-700">
                      Uso:{' '}
                      <span className="font-semibold tabular-nums">{cell.usagePercent.toFixed(1)}%</span>
                      {' · '}
                      {cell.label}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Massivas abertas: {cell.openTickets} · Distintas no período:{' '}
                      {cell.totalTickets.toLocaleString('pt-BR')}
                    </p>
                    <Link
                      to={`/splitters/${encodeURIComponent(cell.splitterCode)}`}
                      className="mt-2 inline-block text-xs font-bold text-amber-700 dark:text-amber-200 underline-offset-2 hover:underline"
                    >
                      Abrir splitter
                    </Link>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
