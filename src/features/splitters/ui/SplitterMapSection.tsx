import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { resolveGeocodedAddressForSplitter } from '@/features/splitters/api/reverseGeocode'
import { useSplitterClientes } from '@/features/splitters/hooks/useSplitterClientes'
import { useNeighborStreetsReverseGeocode } from '@/features/splitters/hooks/useNeighborStreetsReverseGeocode'
import { useSplitterMapData } from '@/features/splitters/hooks/useSplitterMapData'
import { useSplitterOlt } from '@/features/splitters/hooks/useSplitterOlt'
import {
  findFirstStreetReliefNeighbor,
  normalizeStreetForRelief,
  SPLITTER_ROUTE_RELIEF_MAX_METERS,
  type SplitterMapReliefInsight,
} from '@/features/splitters/lib/splitterStreetRelief'
import type { Splitter } from '@/features/splitters/model/splitter'
import type { SplitterMapClientPoint, SplitterMapSuccessPayload } from '@/features/splitters/model/splitterMap'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/states/EmptyState'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { MapPinned, RadioTower, CircleDot, Maximize2, X, ExternalLink } from 'lucide-react'

const SplitterMapLeaflet = lazy(async () => {
  const mod = await import('@/features/splitters/ui/SplitterMapLeaflet')
  return { default: mod.SplitterMapLeaflet }
})

type SplitterMapSectionProps = {
  splitter: Splitter
  /** Atualiza o header do detalhe com vizinho de alívio (rua) após geocodes relevantes. */
  onMapReliefInsightChange?: (insight: SplitterMapReliefInsight) => void
}

function LegendDot({
  color,
  label,
}: {
  color: string
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest/90 px-2 py-1 text-[10px] font-medium text-on-surface shadow-sm">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  )
}

export function SplitterMapSection({ splitter, onMapReliefInsightChange }: SplitterMapSectionProps) {
  const [showClientsOnMap, setShowClientsOnMap] = useState(true)
  const [mapExpandedOpen, setMapExpandedOpen] = useState(false)

  /** Ao trocar de equipamento na mesma tela (ex.: link no mapa), evita modal “fantasma” com outro código. */
  useEffect(() => {
    setMapExpandedOpen(false)
  }, [splitter.code])

  /** Fechar com Escape — o overlay fica abaixo da sidebar, mas isso cobre teclado e hábito de outros modais. */
  useEffect(() => {
    if (!mapExpandedOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMapExpandedOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mapExpandedOpen])

  const oltCode = splitter.oltCode
  const { state: oltState } = useSplitterOlt(oltCode)
  const { data: connectionsBundle } = useSplitterClientes(splitter.code)

  const olt = oltState.type === 'ready' ? oltState.olt : null

  const clientPoints = useMemo<SplitterMapClientPoint[]>(() => {
    const clientes = connectionsBundle?.clientes ?? []
    const byAuth = new Map<number, SplitterMapClientPoint>()
    for (const c of clientes) {
      const lat = c.address?.latitude ?? null
      const lng = c.address?.longitude ?? null
      if (
        lat === null ||
        lng === null ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        continue
      }
      const point: SplitterMapClientPoint = {
        authenticationId: c.authenticationId,
        name: c.name,
        user: c.user,
        lat,
        lng,
        isCorporate: c.isCorporate,
      }
      const prev = byAuth.get(c.authenticationId)
      if (!prev) {
        byAuth.set(c.authenticationId, point)
      } else if (c.isCorporate && !prev.isCorporate) {
        byAuth.set(c.authenticationId, { ...prev, isCorporate: true })
      }
    }
    return [...byAuth.values()]
  }, [connectionsBundle?.clientes])

  const { state: mapState, refetch } = useSplitterMapData({
    splitterCode: splitter.code,
    splitterTitle: splitter.title,
    latitude: splitter.latitude,
    longitude: splitter.longitude,
    olt,
    clientPoints,
  })

  const needsClientReverseStreet =
    mapState.type === 'success' &&
    !splitter.street?.trim() &&
    !mapState.payload.originStreetRaw?.trim() &&
    !mapState.payload.currentStreet?.trim()

  const reverseStreetLat = mapState.type === 'success' ? mapState.payload.center.lat : 0
  const reverseStreetLng = mapState.type === 'success' ? mapState.payload.center.lng : 0

  const clientReverseStreetQuery = useQuery({
    queryKey: ['splitter-map-reverse-street', splitter.code, reverseStreetLat, reverseStreetLng] as const,
    queryFn: () =>
      resolveGeocodedAddressForSplitter({
        splitterCode: splitter.code,
        lat: reverseStreetLat,
        lng: reverseStreetLng,
      }),
    enabled:
      needsClientReverseStreet &&
      Number.isFinite(reverseStreetLat) &&
      Number.isFinite(reverseStreetLng),
    staleTime: 7 * 24 * 60 * 60 * 1000,
  })

  const splitterMapSuccessPayload =
    mapState.type === 'success' ? mapState.payload : null

  const neighborStreetsQuery = useNeighborStreetsReverseGeocode({
    enabled: splitterMapSuccessPayload !== null,
    neighbors: splitterMapSuccessPayload?.neighbors ?? [],
    routingUnavailable: Boolean(splitterMapSuccessPayload?.routingUnavailable),
  })

  const leafletMergedPayload = useMemo((): SplitterMapSuccessPayload | null => {
    const p = splitterMapSuccessPayload
    if (!p) return null
    const m = neighborStreetsQuery.data
    if (!m || m.size === 0) return p
    return {
      ...p,
      neighbors: p.neighbors.map((n) => {
        const fromClient = m.get(n.code)?.trim()
        const merged = n.street?.trim() || fromClient
        return {
          ...n,
          street: merged || (n.street ?? null),
        }
      }),
    }
  }, [splitterMapSuccessPayload, neighborStreetsQuery.data])

  useEffect(() => {
    if (!onMapReliefInsightChange) return
    if (mapState.type !== 'success') {
      onMapReliefInsightChange({ evaluationSettled: false, streetReliefNeighbor: null })
      return
    }
    const p = mapState.payload
    const merged = leafletMergedPayload ?? p
    const mapStreet =
      splitter.street?.trim() ||
      p.originStreetRaw?.trim() ||
      clientReverseStreetQuery.data?.street?.trim() ||
      p.currentStreet?.trim() ||
      null
    const curNorm = normalizeStreetForRelief(mapStreet)
    const isCondo = Boolean(p.isCondominium)
    const needClientGeo =
      !splitter.street?.trim() &&
      !p.originStreetRaw?.trim() &&
      !p.currentStreet?.trim()
    const clientBlock =
      needClientGeo &&
      !clientReverseStreetQuery.isError &&
      (clientReverseStreetQuery.isPending || clientReverseStreetQuery.isFetching)
    const neighborBlock =
      neighborStreetsQuery.isEnabled &&
      !neighborStreetsQuery.isError &&
      (neighborStreetsQuery.isPending || neighborStreetsQuery.isFetching)
    const pending = !isCondo && (clientBlock || neighborBlock)
    const n = pending
      ? null
      : findFirstStreetReliefNeighbor({
          neighbors: merged.neighbors,
          currentStreetNormalized: curNorm,
          currentIsCondominium: isCondo,
        })
    onMapReliefInsightChange({
      evaluationSettled: isCondo || !pending,
      streetReliefNeighbor:
        pending || !n ? null : { code: String(n.code).trim(), title: String(n.title || n.code).trim() },
    })
  }, [
    onMapReliefInsightChange,
    mapState,
    leafletMergedPayload,
    splitter.street,
    clientReverseStreetQuery.data,
    clientReverseStreetQuery.isPending,
    clientReverseStreetQuery.isFetching,
    clientReverseStreetQuery.isError,
    neighborStreetsQuery.isEnabled,
    neighborStreetsQuery.isPending,
    neighborStreetsQuery.isFetching,
    neighborStreetsQuery.isError,
  ])

  const oltCodeTrim = (oltCode ?? '').trim()
  const showOltMissing =
    oltCodeTrim.length > 0 && oltState.type === 'not-found'

  if (mapState.type === 'no-coordinates') {
    return (
      <EmptyState
        title="Localização indisponível"
        description="Este splitter não possui latitude e longitude válidas no cadastro; o mapa não pode ser exibido."
      />
    )
  }

  if (mapState.type === 'loading') {
    return <LoadingState label="Carregando dados do mapa…" />
  }

  if (mapState.type === 'error') {
    return (
      <ErrorState
        message={formatQueryError(mapState.error)}
        onRetry={() => refetch()}
      />
    )
  }

  const { payload } = mapState
  const mapLeafletPayload = leafletMergedPayload ?? payload
  const neighborCount = payload.neighbors.length
  const clientOnMapCount = payload.clientPoints.length
  const routingUnavailable = Boolean(payload.routingUnavailable)
  const currentIsCondominium = Boolean(payload.isCondominium)
  const condominiumReliefAvailable = Boolean(payload.condominiumReliefAvailable)
  /** Mesma prioridade do texto do mapa — alívio “mesma rua” precisa disso quando cadastro/BFF não têm rua. */
  const mapCurrentStreetDisplay =
    splitter.street?.trim() ||
    payload.originStreetRaw?.trim() ||
    clientReverseStreetQuery.data?.street?.trim() ||
    payload.currentStreet?.trim() ||
    null
  const currentStreet = normalizeStreetForRelief(mapCurrentStreetDisplay)
  const reliefGeoPendingForStreetRule =
    !currentIsCondominium &&
    ((needsClientReverseStreet &&
      !clientReverseStreetQuery.isError &&
      (clientReverseStreetQuery.isPending || clientReverseStreetQuery.isFetching)) ||
      (neighborStreetsQuery.isEnabled &&
        !neighborStreetsQuery.isError &&
        (neighborStreetsQuery.isPending || neighborStreetsQuery.isFetching)))
  const streetReliefNeighbor = findFirstStreetReliefNeighbor({
    neighbors: mapLeafletPayload.neighbors,
    currentStreetNormalized: currentStreet,
    currentIsCondominium,
  })
  const hasReliefNeighborWithinRoute = streetReliefNeighbor !== null
  const reliefFootPathPositions: [[number, number], [number, number]] | null =
    reliefGeoPendingForStreetRule || currentIsCondominium || streetReliefNeighbor === null
      ? null
      : [
          [payload.center.lat, payload.center.lng],
          [streetReliefNeighbor.lat, streetReliefNeighbor.lng],
        ]
  const splitterFullOccupancy =
    splitter.outPorts > 0 && splitter.busyCount >= splitter.outPorts
  const showNetworkPlanningAlert = (() => {
    if (!splitterFullOccupancy) return false
    if (currentIsCondominium) {
      return !condominiumReliefAvailable
    }
    if (reliefGeoPendingForStreetRule) return false
    return !routingUnavailable && !hasReliefNeighborWithinRoute
  })()

  const openStreetMapHref = `https://www.openstreetmap.org/#map=17/${payload.center.lat}/${payload.center.lng}`

  return (
    <section
      className={cn(
        'relative rounded-2xl border border-outline-variant bg-gradient-to-br from-white dark:from-surface-container-lowest via-surface to-surface-container-low/40 shadow-sm',
        mapExpandedOpen
          ? 'z-[1] min-h-[min(92dvh,900px)] overflow-visible'
          : 'overflow-hidden',
      )}
      aria-labelledby="splitter-map-heading"
    >
      <div className="border-b border-outline-variant/50 bg-surface-container-lowest/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.09] text-primary">
                <MapPinned size={18} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
                  Mapa operacional
                </p>
                <h2
                  id="splitter-map-heading"
                  className="mt-0.5 text-base font-semibold tracking-tight text-on-surface"
                >
                  Localização e vizinhança
                </h2>
                <p className="mt-0.5 text-xs leading-snug text-on-surface-variant/75">
                  Splitter central e vizinhos dentro de 200 m em linha reta; distância por calçada (OSRM foot) aparece no
                  marcador para planejamento (não é metro de cabo).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <LegendDot color="#ef4444" label="Equipamento atual" />
              <LegendDot color="#4ade80" label="Ocupação normal" />
              <LegendDot color="#fb923c" label="Ocupação alta" />
              <LegendDot color="#f87171" label="Ocupação crítica" />
              <LegendDot color="#3b82f6" label="OLT" />
              <LegendDot color="#ca8a04" label="Cliente" />
              <LegendDot color="#7c3aed" label="Cliente corporativo" />
            </div>
            <p className="text-[10px] leading-snug text-on-surface-variant/70">
              Para abrir o card: clique no <span className="font-semibold text-on-surface/85">círculo colorido</span>{' '}
              (vizinho) ou no <span className="font-semibold text-on-surface/85">quadrado com casa</span> (assinante).
            </p>
          </div>

          <div className="grid gap-1.5 text-xs text-on-surface-variant/80">
            <div className="flex items-start gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-2 shadow-sm">
              <CircleDot size={14} className="mt-0.5 shrink-0 text-primary" strokeWidth={1.75} />
              <span className="leading-snug">
                {neighborCount === 0
                  ? 'Nenhum outro splitter com coordenadas válidas dentro de 200 m.'
                  : `${neighborCount} splitter(es) encontrado(s) dentro do raio de 200 m.`}
              </span>
            </div>

            {olt !== null &&
            olt.lat !== null &&
            olt.lng !== null &&
            oltCodeTrim.length > 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-2 shadow-sm">
                <RadioTower size={14} className="mt-0.5 shrink-0 text-secondary" strokeWidth={1.75} />
                <span className="leading-snug">
                  A linha laranja mostra a ligação entre a OLT e o splitter atual.
                </span>
              </div>
            ) : null}

            {reliefFootPathPositions !== null ? (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200/90 dark:border-emerald-800/50 bg-emerald-50/90 dark:bg-emerald-950/40 px-2.5 py-2 shadow-sm">
                <CircleDot size={14} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-200" strokeWidth={1.75} />
                <span className="leading-snug text-emerald-950">
                  A linha verde liga este splitter a um vizinho com{' '}
                  <span className="font-semibold">porta livre</span> dentro da regra de planejamento (mesma rua até{' '}
                  {SPLITTER_ROUTE_RELIEF_MAX_METERS} m de rota pedestre, ou até 30 m entre ruas).
                </span>
              </div>
            ) : null}

            {clientOnMapCount > 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-2 shadow-sm">
                <CircleDot size={14} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-200" strokeWidth={1.75} />
                <span className="leading-snug">
                  {clientOnMapCount} assinante(s) com coordenadas no mapa (campos na consulta SQL).
                </span>
              </div>
            ) : null}

            {routingUnavailable ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200/90 dark:border-amber-800/50 bg-amber-50/90 dark:bg-amber-950/40 px-2.5 py-2 shadow-sm">
                <CircleDot size={14} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-200" strokeWidth={1.75} />
                <span className="leading-snug text-amber-950">
                  Roteamento pedestre temporariamente indisponível — apenas distância em linha reta neste mapa.
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {splitterFullOccupancy && currentIsCondominium && condominiumReliefAvailable ? (
          <div
            className="mt-3 rounded-xl border border-emerald-200/90 dark:border-emerald-800/50 bg-emerald-50/95 dark:bg-emerald-950/40 px-3 py-2.5 text-sm text-emerald-950 shadow-sm"
            role="status"
          >
            <p className="font-bold text-emerald-900 dark:text-emerald-200">Condomínio — alívio por outro splitter</p>
            <p className="mt-1 text-[13px] leading-relaxed text-emerald-900/95">
              Há outro splitter secundário com o mesmo trecho de título após{' '}
              <span className="font-semibold">RES.</span>, <span className="font-semibold">COND.</span> ou{' '}
              <span className="font-semibold">ED.</span> (mesmo condomínio/bloco no cadastro textual) e com{' '}
              <span className="font-semibold">porta livre</span>. Esse caso não entra na fila de planejamento por
              vizinhança OSRM.
            </p>
          </div>
        ) : null}

        {splitterFullOccupancy && !currentIsCondominium && reliefGeoPendingForStreetRule ? (
          <div
            className="mt-3 rounded-xl border border-slate-200/90 dark:border-white/10 bg-surface-container-low/95 px-3 py-2 text-xs text-slate-700 shadow-sm"
            role="status"
          >
            A confirmar nomes de via no mapa para o aviso de planejamento…
          </div>
        ) : null}

        {showNetworkPlanningAlert ? (
          <div
            className="mt-3 rounded-xl border border-rose-300/90 bg-gradient-to-r from-rose-50 dark:from-rose-950/20 to-amber-50 dark:to-amber-950/20 px-3 py-2.5 text-sm text-rose-950 shadow-sm ring-1 ring-rose-200/60"
            role="alert"
          >
            <p className="font-bold text-rose-900 dark:text-rose-200">Planejamento de rede — sem alívio disponível</p>
            <p className="mt-1 text-[13px] leading-relaxed text-rose-900/95">
              {currentIsCondominium
                ? 'Este splitter de condomínio está com todas as portas ocupadas e não há outro splitter secundário do mesmo condomínio/bloco com porta livre.'
                : `Este splitter de rua está com todas as portas ocupadas e não há outro splitter de rua com porta livre a até ${SPLITTER_ROUTE_RELIEF_MAX_METERS} m de percurso pedestre nas ruas (OSRM).`}
            </p>
          </div>
        ) : null}

        {oltCodeTrim.length > 0 && oltState.type === 'loading' ? (
          <p className="mt-3 text-sm text-on-surface-variant/65">
            Carregando posição da OLT para desenhar a linha no mapa...
          </p>
        ) : null}

        {oltCodeTrim.length > 0 && oltState.type === 'error' ? (
          <p className="mt-3 rounded-xl border border-red-200/80 dark:border-red-800/50 bg-red-50/90 dark:bg-red-950/40 px-3 py-2 text-sm text-red-900 dark:text-red-200">
            Não foi possível carregar a listagem de OLTs; o mapa aparece sem linha até a consulta funcionar.
          </p>
        ) : null}

        {showOltMissing ? (
          <p className="mt-3 rounded-xl border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/90 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-950">
            O código OLT deste splitter não foi resolvido na listagem de OLTs; por isso o mapa segue sem linha e sem marcador da OLT.
          </p>
        ) : null}

        {olt !== null &&
        olt.lat === null &&
        olt.lng === null &&
        oltCodeTrim.length > 0 ? (
          <p className="mt-3 rounded-xl border border-outline-variant bg-surface-container-low/50 px-3 py-2 text-sm text-on-surface-variant">
            A OLT vinculada existe, mas não possui coordenadas válidas no cadastro. O mapa segue funcional para os vizinhos.
          </p>
        ) : null}
      </div>

      <div className="p-3 pt-2">
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_8px_24px_rgba(26,26,26,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/50 bg-surface-container-low/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
            <span>Vista do mapa</span>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              {clientOnMapCount > 0 ? (
                <label className="flex cursor-pointer items-center gap-1.5 normal-case tracking-normal">
                  <input
                    type="checkbox"
                    checked={showClientsOnMap}
                    onChange={(e) => setShowClientsOnMap(e.target.checked)}
                    className="size-3.5 rounded border-outline-variant text-primary focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="max-w-[10rem] text-[10px] font-semibold leading-tight text-on-surface sm:max-w-none">
                    Mostrar assinantes
                  </span>
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => setMapExpandedOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-on-surface shadow-sm transition hover:bg-surface-container-low"
              >
                <Maximize2 size={12} strokeWidth={2} aria-hidden />
                Abrir mapa
              </button>
              <span className="hidden text-on-surface-variant/55 lg:inline">Raio 200 m · rota no popup</span>
            </div>
          </div>

          <div className="h-[220px] w-full min-h-[200px] sm:h-[240px]">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center bg-surface-container-low text-sm text-on-surface-variant/65">
                  Carregando mapa…
                </div>
              }
            >
              {mapExpandedOpen ? (
                <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-surface-container-low/80 px-4 text-center text-xs text-on-surface-variant">
                  <span className="font-semibold text-on-surface-variant/80">Mapa na janela ampliada</span>
                  <span className="text-on-surface-variant/65">Feche o modal para voltar ao mapa aqui.</span>
                </div>
              ) : (
                <div
                  key={`splitter-map-leaflet-${splitter.code}`}
                  className="relative z-0 h-full min-h-0 w-full max-w-full overflow-hidden"
                >
                  <SplitterMapLeaflet
                    payload={mapLeafletPayload}
                    currentStreetDisplay={mapCurrentStreetDisplay}
                    showClientMarkers={showClientsOnMap}
                    reliefFootPath={reliefFootPathPositions}
                  />
                </div>
              )}
            </Suspense>
          </div>
        </div>
      </div>

      {/*
        Modal só sobre este card (`absolute` no section `relative`): `fixed` cobria a viewport inteira
        e, com ancestral com transform (animate-in na página), podia interceptar cliques fora do mapa.
      */}
      {mapExpandedOpen ? (
        <div className="absolute inset-0 z-50 grid min-h-0 place-items-center p-2 sm:p-4 md:p-5">
          <button
            type="button"
            className="absolute inset-0 bg-neutral-950/45 backdrop-blur-[1px]"
            aria-label="Fechar mapa ampliado"
            onClick={() => setMapExpandedOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="splitter-map-expanded-title"
            className="relative flex h-[min(88dvh,860px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl"
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-low/35 px-3 py-2.5">
              <h3
                id="splitter-map-expanded-title"
                className="text-sm font-semibold tracking-tight text-on-surface"
              >
                Mapa ampliado · {splitter.code}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={openStreetMapHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-[11px] font-semibold text-primary underline-offset-2 hover:bg-surface-container-low hover:underline"
                >
                  <ExternalLink size={12} aria-hidden />
                  OpenStreetMap
                </a>
                {clientOnMapCount > 0 ? (
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={showClientsOnMap}
                      onChange={(e) => setShowClientsOnMap(e.target.checked)}
                      className="size-3.5 rounded border-outline-variant text-primary focus:ring-2 focus:ring-primary/30"
                    />
                    <span className="text-[11px] font-semibold text-on-surface">Assinantes</span>
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={() => setMapExpandedOpen(false)}
                  className="flex size-9 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface shadow-sm transition hover:bg-surface-container-low"
                  aria-label="Fechar"
                >
                  <X size={18} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low/30">
                <Suspense
                  fallback={
                    <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-on-surface-variant/65">
                      Carregando mapa…
                    </div>
                  }
                >
                  <div
                    key={`splitter-map-leaflet-expanded-${splitter.code}`}
                    className="relative z-0 h-full min-h-0 w-full max-w-full overflow-hidden"
                  >
                    <SplitterMapLeaflet
                      payload={mapLeafletPayload}
                      currentStreetDisplay={mapCurrentStreetDisplay}
                      showClientMarkers={showClientsOnMap}
                      mapClassName="absolute inset-0 h-full w-full rounded-xl"
                      reliefFootPath={reliefFootPathPositions}
                    />
                  </div>
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
