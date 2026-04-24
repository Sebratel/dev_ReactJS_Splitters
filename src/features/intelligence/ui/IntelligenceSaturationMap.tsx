import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import type { IntelligenceSaturationCell } from '@/features/intelligence/hooks/useNetworkIntelligenceData'

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

const BR_FALLBACK_CENTER: [number, number] = [-14.235, -51.9253]

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

function saturationDivIcon(usagePercent: number): L.DivIcon {
  const fill = BAND_COLOR[saturationBand(usagePercent)]
  return L.divIcon({
    className: 'intelligence-sat-marker',
    html: `<div style="width:22px;height:22px;border-radius:9999px;background:${fill};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
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
  '!rounded-lg !border !border-slate-600 !bg-slate-900 !px-2.5 !py-2 !text-[11px] !leading-snug !text-white !shadow-xl !max-w-[18rem]'

function SaturationMapLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600">
      <span className="font-bold uppercase tracking-wide text-slate-500">Legenda</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm ring-1 ring-slate-200" />
        {'<'} 70% folga
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-amber-500 shadow-sm ring-1 ring-slate-200" />
        70–94% atenção
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-rose-500 shadow-sm ring-1 ring-slate-200" />
        ≥ 95% crítico
      </span>
    </div>
  )
}

export type IntelligenceSaturationMapProps = {
  cells: IntelligenceSaturationCell[]
}

export function IntelligenceSaturationMap({ cells }: IntelligenceSaturationMapProps) {
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

  const fitPoints = useMemo(
    () => plotted.map((c) => [c.latitude as number, c.longitude as number] as [number, number]),
    [plotted],
  )

  const skipped = cells.length - plotted.length

  if (cells.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 py-8 text-center text-sm text-slate-500">
        Nenhum splitter com tendência no período selecionado. Ajuste o intervalo de datas ou aguarde snapshots no BFF local.
      </p>
    )
  }

  if (plotted.length === 0) {
    return (
      <div>
        <SaturationMapLegend />
        <p className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/80 px-4 py-6 text-center text-sm text-amber-950">
          Há {cells.length} splitter(es) no período, mas nenhum tem latitude/longitude válidas no cadastro.
          Confira <span className="font-mono text-xs">LATITUDE[SPLT.SECUNDARIO]</span> e{' '}
          <span className="font-mono text-xs">LONGITUDE[SPLT.SECUNDARIO]</span> no BFF.
        </p>
      </div>
    )
  }

  return (
    <div>
      <SaturationMapLegend />
      {skipped > 0 ? (
        <p className="mb-2 text-[11px] font-medium text-slate-500">
          {skipped} splitter(es) sem coordenadas — não aparecem no mapa.
        </p>
      ) : null}
      <div className="relative h-[min(420px,55vh)] w-full overflow-hidden rounded-2xl border border-slate-200/80 shadow-inner ring-1 ring-slate-200/60">
        <MapContainer
          center={fitPoints[0] ?? BR_FALLBACK_CENTER}
          zoom={5}
          className="z-0 h-full w-full [&_.leaflet-control-attribution]:text-[10px]"
          scrollWheelZoom
        >
          <TileLayer attribution={OSM_ATTR} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBoundsController
            fitPoints={fitPoints}
            fallbackCenter={BR_FALLBACK_CENTER}
            fallbackZoom={4}
          />
          {plotted.map((cell) => {
            const title = cell.splitterTitle.trim()
            const captured =
              cell.capturedAt !== null
                ? new Intl.DateTimeFormat('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(cell.capturedAt)
                : '—'

            return (
              <Marker
                key={cell.splitterCode}
                position={[cell.latitude as number, cell.longitude as number]}
                icon={saturationDivIcon(cell.usagePercent)}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1} className={TOOLTIP_CLASS}>
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
                    <p className="mt-1 text-white/95">
                      Uso:{' '}
                      <span className="font-semibold tabular-nums">{cell.usagePercent.toFixed(2)}%</span>
                    </p>
                    <p className="text-white/90">
                      Δ7d: <span className="tabular-nums">{formatDeltaPercent(cell.delta7d)}</span>
                      {' · '}
                      Δ30d: <span className="tabular-nums">{formatDeltaPercent(cell.delta30d)}</span>
                    </p>
                    <p className="mt-1 text-white/75">
                      Status: <span className="font-semibold">{cell.label}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/55">Referência: {captured}</p>
                  </div>
                </Tooltip>
                <Popup>
                  <div className="min-w-[200px] text-sm">
                    <p className="font-semibold text-slate-900">{title !== '' ? title : cell.splitterCode}</p>
                    <p className="font-mono text-xs text-slate-600">{cell.splitterCode}</p>
                    <p className="mt-1 text-xs text-slate-700">
                      Uso:{' '}
                      <span className="font-semibold tabular-nums">{cell.usagePercent.toFixed(1)}%</span>
                      {' · '}
                      {cell.label}
                    </p>
                    <Link
                      to={`/splitters/${encodeURIComponent(cell.splitterCode)}`}
                      className="mt-2 inline-block text-xs font-bold text-amber-700 underline-offset-2 hover:underline"
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
