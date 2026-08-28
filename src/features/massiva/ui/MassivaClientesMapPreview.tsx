import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import clsx from 'clsx'
import { MapPin } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import {
  formatMassivaClienteLocationLine,
  hasMassivaClienteMapCoords,
} from '@/features/massiva/lib/formatMassivaClienteLocation'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

const BR_FALLBACK_CENTER: [number, number] = [-14.235, -51.9253]

function markerIcon(hasCorporate: boolean): L.DivIcon {
  const fill = hasCorporate ? '#7c3aed' : '#16a34a'
  return L.divIcon({
    className: 'massiva-cliente-map-marker',
    html: `<div style="width:20px;height:20px;border-radius:9999px;background:${fill};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
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

function MapLegend() {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-on-surface-variant">
      <span className="font-bold uppercase tracking-wide text-on-surface-variant">Legenda</span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full shadow-sm ring-2 ring-white"
          style={{ background: '#16a34a' }}
        />
        Splitter sem corporativo
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full shadow-sm ring-2 ring-white"
          style={{ background: '#7c3aed' }}
        />
        Splitter com corporativo
      </span>
    </div>
  )
}

function splitterDisplayName(cliente: SplitterCliente): string {
  const title = cliente.splitterTitle?.trim() ?? ''
  if (title !== '') return title
  const code = cliente.splitterCode?.trim() ?? ''
  return code !== '' ? code : 'Splitter'
}

type MassivaClientesMapPreviewProps = {
  clientes: readonly SplitterCliente[]
  /** Mapa mais alto (ex.: modal). */
  density?: 'default' | 'expanded'
  /** Moldura do painel: escura lembra mock / monitoramento. */
  mapChrome?: 'light' | 'dark'
  /** Esconde contagem e legenda (modal com cabeçalho próprio). */
  minimalChrome?: boolean
}

/**
 * Mapa OSM com pins nos clientes que tenham lat/lng no `address` (BFF conexoes).
 */
export function MassivaClientesMapPreview({
  clientes,
  density = 'default',
  mapChrome = 'light',
  minimalChrome = false,
}: MassivaClientesMapPreviewProps) {
  const totalSplitters = useMemo(() => {
    const keys = new Set<string>()
    for (const c of clientes) {
      const label = splitterDisplayName(c).trim()
      if (label !== '') keys.add(label)
    }
    return keys.size
  }, [clientes])

  const points = useMemo(() => {
    const grouped = new Map<string, {
      key: string
      splitterLabel: string
      splitterCode: string
      sumLat: number
      sumLng: number
      count: number
      affectedClients: number
      hasCorporate: boolean
      sampleAddress: string
    }>()

    for (const c of clientes) {
      if (!hasMassivaClienteMapCoords(c)) continue
      const lat = c.address!.latitude!
      const lng = c.address!.longitude!
      const splitterLabel = splitterDisplayName(c)
      const splitterCode = c.splitterCode?.trim() || '-'
      const groupKey = splitterCode !== '-' ? splitterCode : splitterLabel
      const existing = grouped.get(groupKey)

      if (existing) {
        existing.sumLat += lat
        existing.sumLng += lng
        existing.count += 1
        existing.affectedClients += 1
        if (c.isCorporate) existing.hasCorporate = true
      } else {
        grouped.set(groupKey, {
          key: groupKey,
          splitterLabel,
          splitterCode,
          sumLat: lat,
          sumLng: lng,
          count: 1,
          affectedClients: 1,
          hasCorporate: c.isCorporate,
          sampleAddress: formatMassivaClienteLocationLine(c),
        })
      }
    }

    const out: Array<{
      key: string
      lat: number
      lng: number
      splitterLabel: string
      splitterCode: string
      affectedClients: number
      hasCorporate: boolean
      endereco: string
    }> = []

    for (const group of grouped.values()) {
      out.push({
        key: group.key,
        lat: group.sumLat / group.count,
        lng: group.sumLng / group.count,
        splitterLabel: group.splitterLabel,
        splitterCode: group.splitterCode,
        affectedClients: group.affectedClients,
        hasCorporate: group.hasCorporate,
        endereco: group.sampleAddress,
      })
    }

    return out.sort((a, b) => a.splitterLabel.localeCompare(b.splitterLabel, 'pt-BR'))
  }, [clientes])

  const fitPoints: [number, number][] = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points],
  )

  if (clientes.length === 0) {
    return null
  }

  const mapHeightClass =
    density === 'expanded' ? 'h-[min(520px,75vh)]' : 'h-[min(280px,40vh)]'

  if (points.length === 0) {
    return (
      <div className="mt-1 overflow-hidden rounded-xl border border-dashed border-neutral-200/90 dark:border-white/10 bg-gradient-to-b from-neutral-50/80 dark:from-white/5 to-neutral-50 dark:to-white/5 px-3 py-4 text-xs text-on-surface-variant shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-xl bg-surface-container-lowest text-on-surface-variant/60 shadow-sm ring-1 ring-neutral-200/80 dark:ring-white/10">
            <MapPin className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-on-surface">Sem pins no mapa</p>
            <p className="mt-1.5 leading-relaxed text-on-surface-variant">
              Ninguém na seleção atual traz coordenadas (lat/lon) do BFF. A coluna{' '}
              <span className="font-medium text-on-surface-variant">Local</span> ainda exibe o endereço em
              texto, quando houver.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const mapShell = (
    <div
      className={clsx(
        'relative w-full max-w-full overflow-hidden rounded-lg bg-neutral-100 [&_.leaflet-control-attribution]:text-[9px] [&_.leaflet-popup-content-wrapper]:rounded-lg [&_.leaflet-popup-content-wrapper]:shadow-lg',
        mapHeightClass,
        mapChrome === 'dark'
          ? 'border border-slate-700/80 ring-1 ring-slate-600/50'
          : 'border border-neutral-200/80 dark:border-white/10 shadow-[0_1px_4px_rgba(15,23,42,0.08)] ring-1 ring-neutral-200/50 dark:ring-white/10',
      )}
      role="img"
      aria-label="Mapa de splitters afetados com coordenadas"
    >
      <MapContainer
        center={fitPoints[0] ?? BR_FALLBACK_CENTER}
        zoom={4}
        scrollWheelZoom
        className="z-0 h-full w-full"
      >
        <TileLayer
          attribution={OSM_ATTR}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          maxNativeZoom={19}
        />
        <FitBoundsController fitPoints={fitPoints} fallbackCenter={BR_FALLBACK_CENTER} />
        {points.map((p) => (
          <Marker key={p.key} position={[p.lat, p.lng]} icon={markerIcon(p.hasCorporate)}>
            <Popup className="!text-sm !font-sans">
              <p className="m-0 text-[13px] font-semibold leading-tight text-on-surface">
                {p.splitterLabel}
              </p>
              <p className="m-0 mt-1 font-mono text-[11px] text-on-surface-variant">
                {p.splitterCode}
              </p>
              <p className="m-0 mt-1 text-[12px] text-on-surface-variant">
                {p.affectedClients} cliente(s) nesta referência
              </p>
              <p
                className={clsx(
                  'm-0 mt-1 text-[11px] font-semibold',
                  p.hasCorporate ? 'text-violet-700 dark:text-violet-200' : 'text-emerald-700 dark:text-emerald-200',
                )}
              >
                {p.hasCorporate ? 'Contém corporativo' : 'Sem corporativo'}
              </p>
              <p className="m-0 mt-1.5 border-t border-neutral-200/80 dark:border-white/10 pt-1.5 text-[12px] leading-snug text-on-surface-variant">
                {p.endereco}
              </p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )

  return (
    <div className="mt-1 space-y-2">
      {!minimalChrome ? (
        <>
          <p className="text-xs text-on-surface-variant">
            <span className="font-semibold text-on-surface-variant">
              {points.length} de {totalSplitters}
            </span>{' '}
            splitters com coordenadas no mapa
            {points.some((p) => p.hasCorporate) ? (
              <span className="text-on-surface-variant"> · há splitters com corporativo</span>
            ) : null}
          </p>
          <MapLegend />
        </>
      ) : null}
      {mapChrome === 'dark' ? (
        <div className="rounded-xl bg-slate-900/95 p-1 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)] ring-1 ring-slate-700/80">
          {mapShell}
        </div>
      ) : (
        mapShell
      )}
    </div>
  )
}
