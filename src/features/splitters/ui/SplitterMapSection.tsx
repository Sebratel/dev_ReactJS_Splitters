import { lazy, Suspense, useMemo } from 'react'
import { useSplitterClientes } from '@/features/splitters/hooks/useSplitterClientes'
import { useSplitterMapData } from '@/features/splitters/hooks/useSplitterMapData'
import { useSplitterOlt } from '@/features/splitters/hooks/useSplitterOlt'
import type { Splitter } from '@/features/splitters/model/splitter'
import type { SplitterMapClientPoint } from '@/features/splitters/model/splitterMap'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { EmptyState } from '@/shared/ui/states/EmptyState'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { MapPinned, RadioTower, CircleDot } from 'lucide-react'

const SplitterMapLeaflet = lazy(async () => {
  const mod = await import('@/features/splitters/ui/SplitterMapLeaflet')
  return { default: mod.SplitterMapLeaflet }
})

type SplitterMapSectionProps = {
  splitter: Splitter
}

function LegendDot({
  color,
  label,
}: {
  color: string
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-outline-variant bg-white/90 px-2 py-1 text-[10px] font-medium text-on-surface shadow-sm">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  )
}

export function SplitterMapSection({ splitter }: SplitterMapSectionProps) {
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
  const neighborCount = payload.neighbors.length
  const clientOnMapCount = payload.clientPoints.length

  return (
    <section
      className="overflow-hidden rounded-2xl border border-outline-variant bg-gradient-to-br from-white via-surface to-surface-container-low/40 shadow-sm"
      aria-labelledby="splitter-map-heading"
    >
      <div className="border-b border-outline-variant/50 bg-white/80 px-4 py-3 backdrop-blur-sm">
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
                  Splitter central, vizinhos em 200 m e assinantes com latitude/longitude na consulta.
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
          </div>

          <div className="grid gap-1.5 text-xs text-on-surface-variant/80">
            <div className="flex items-start gap-2 rounded-lg border border-outline-variant bg-white px-2.5 py-2 shadow-sm">
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
              <div className="flex items-start gap-2 rounded-lg border border-outline-variant bg-white px-2.5 py-2 shadow-sm">
                <RadioTower size={14} className="mt-0.5 shrink-0 text-secondary" strokeWidth={1.75} />
                <span className="leading-snug">
                  A linha laranja mostra a ligação entre a OLT e o splitter atual.
                </span>
              </div>
            ) : null}

            {clientOnMapCount > 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-outline-variant bg-white px-2.5 py-2 shadow-sm">
                <CircleDot size={14} className="mt-0.5 shrink-0 text-amber-700" strokeWidth={1.75} />
                <span className="leading-snug">
                  {clientOnMapCount} assinante(s) com coordenadas no mapa (campos na consulta SQL).
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {oltCodeTrim.length > 0 && oltState.type === 'loading' ? (
          <p className="mt-3 text-sm text-on-surface-variant/65">
            Carregando posição da OLT para desenhar a linha no mapa...
          </p>
        ) : null}

        {oltCodeTrim.length > 0 && oltState.type === 'error' ? (
          <p className="mt-3 rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-900">
            Não foi possível carregar a listagem de OLTs; o mapa aparece sem linha até a consulta funcionar.
          </p>
        ) : null}

        {showOltMissing ? (
          <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
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
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-white shadow-[0_8px_24px_rgba(26,26,26,0.05)]">
          <div className="flex items-center justify-between border-b border-outline-variant/50 bg-surface-container-low/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
            <span>Vista do mapa</span>
            <span>Raio 200 m</span>
          </div>

          <div className="h-[220px] w-full min-h-[200px] sm:h-[240px]">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center bg-surface-container-low text-sm text-on-surface-variant/65">
                  Carregando mapa…
                </div>
              }
            >
              <SplitterMapLeaflet payload={payload} />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  )
}
