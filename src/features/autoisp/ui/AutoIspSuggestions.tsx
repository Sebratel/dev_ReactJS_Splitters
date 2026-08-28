import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAutoIspEvents } from '@/features/autoisp/hooks/useAutoIspEvents'
import { useAutoIspCorrelation } from '@/features/autoisp/hooks/useAutoIspCorrelation'
import { resolveRouteFromEventStandalone } from '@/features/autoisp/lib/correlation'
import type { AutoIspEvent } from '@/features/autoisp/model/autoIsp.types'
import type { ResolvedAutoIspRoute } from '@/features/autoisp/model/topology.types'
import { buildTopologyIndicesFromConnections } from '@/features/autoisp/lib/buildTopologyIndices'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import { fetchSplitterConnectionsFromLocalDb } from '@/features/splitters/api/fetchSplitterConnectionsFromLocalDb'
import { SPLITTERS_CONNECTIONS_STALE_TIME_MS } from '@/features/splitters/model/constants'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import { isAutoIspBrowserReady, isAutoIspConfigured } from '@/shared/config/env'
import { formatQueryError } from '@/shared/lib/formatQueryError'

interface AutoIspSuggestionsProps {
  /** Conexões do preview (fallback do índice PPPoE enquanto a base global carrega). */
  connections: SplitterCliente[]
  onApplyFromAutoIsp: (
    event: AutoIspEvent,
    route: ResolvedAutoIspRoute | null,
  ) => void
}

function resourceSummary(event: AutoIspEvent): string {
  const bits: string[] = []
  for (const r of event.resources) {
    if (r.pppoeUsername?.trim()) bits.push(r.pppoeUsername.trim())
    if (r.ponlink?.trim()) bits.push(r.ponlink.trim())
  }
  if (bits.length === 0) return '—'
  const unique = [...new Set(bits)]
  return unique.slice(0, 4).join(' · ') + (unique.length > 4 ? '…' : '')
}

const AUTO_ISP_EVENTS_PAGE_SIZE = 6

function sortEventsForDisplay(events: AutoIspEvent[]): AutoIspEvent[] {
  return [...events].sort((a, b) => {
    const ta = a.startAt ? Date.parse(a.startAt) : 0
    const tb = b.startAt ? Date.parse(b.startAt) : 0
    if (tb !== ta) return tb - ta
    return b.id - a.id
  })
}

/**
 * Lista eventos do AutoISP. A rota preferencial vem dos PPPoE dos recursos do evento cruzados
 * com GET `/api/massiva/connections` (base inteira). Ponlink + catálogo e ponlink “standalone”
 * são fallback; o preview local só entra no índice enquanto a base global ainda não carregou.
 */
export function AutoIspSuggestions({
  connections,
  onApplyFromAutoIsp,
}: AutoIspSuggestionsProps) {
  const configured = isAutoIspConfigured()
  const browserReady = isAutoIspBrowserReady()
  const { data: events, isLoading, isError, error, isFetched } = useAutoIspEvents()

  const connectionsIndexQuery = useQuery({
    queryKey: massivaKeys.connectionsForAutoIspIndex(),
    queryFn: () => fetchSplitterConnectionsFromLocalDb(),
    staleTime: SPLITTERS_CONNECTIONS_STALE_TIME_MS,
    enabled: configured && browserReady,
    refetchOnWindowFocus: false,
  })

  const topologyIndices = useMemo(() => {
    const full = connectionsIndexQuery.data
    if (full !== undefined && full.length > 0) {
      return buildTopologyIndicesFromConnections(full)
    }
    return buildTopologyIndicesFromConnections(connections)
  }, [connectionsIndexQuery.data, connections])

  const { correlatedEvents } = useAutoIspCorrelation({
    events: events ?? [],
    topologyIndices,
  })

  const routeByEventId = useMemo(() => {
    const m = new Map<number, ResolvedAutoIspRoute>()
    for (const { event, route } of correlatedEvents) {
      m.set(event.id, route)
    }
    return m
  }, [correlatedEvents])

  const effectiveRoute = (event: AutoIspEvent): ResolvedAutoIspRoute | null =>
    routeByEventId.get(event.id) ?? resolveRouteFromEventStandalone(event)

  const list = useMemo(() => sortEventsForDisplay(events ?? []), [events])
  const totalPages = Math.max(1, Math.ceil(list.length / AUTO_ISP_EVENTS_PAGE_SIZE))
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  const paginatedList = useMemo(() => {
    const start = (page - 1) * AUTO_ISP_EVENTS_PAGE_SIZE
    return list.slice(start, start + AUTO_ISP_EVENTS_PAGE_SIZE)
  }, [list, page])

  if (!configured) {
    return (
      <p className="text-xs text-on-surface-variant">
        AutoISP inativo: defina{' '}
        <code className="rounded bg-neutral-100 dark:bg-white/5 px-1 text-[11px]">VITE_AUTOISP_EVENTS_ENDPOINT</code> no
        frontend e as credenciais{' '}
        <code className="rounded bg-neutral-100 dark:bg-white/5 px-1 text-[11px]">AUTOISP_AUTH_ENDPOINT</code>,{' '}
        <code className="rounded bg-neutral-100 dark:bg-white/5 px-1 text-[11px]">AUTOISP_USERNAME</code> e{' '}
        <code className="rounded bg-neutral-100 dark:bg-white/5 px-1 text-[11px]">AUTOISP_PASSWORD</code> no backend.
      </p>
    )
  }

  if (!browserReady) {
    return (
      <p className="text-xs text-amber-900 dark:text-amber-200">
        AutoISP: defina endpoints absolutos (<code className="text-[11px]">https://...</code>) ou use o proxy do
        Vite: <code className="rounded bg-amber-100 dark:bg-amber-950/50 px-1 text-[11px]">/__autoisp/api/...</code> (evita CORS em{' '}
        <code className="text-[11px]">npm run dev</code>). Veja <code className="text-[11px]">.env.example</code>.
      </p>
    )
  }

  if (isLoading) {
    return (
      <div className="flex animate-pulse items-center gap-3 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-surface-container-low/80 p-5 shadow-sm">
        <div className="h-4 w-4 rounded-full bg-neutral-300 dark:bg-white/15" />
        <div className="h-4 w-48 rounded-md bg-neutral-200/80 dark:bg-white/10" />
      </div>
    )
  }

  if (isError) {
    return (
      <p className="text-xs text-red-700 dark:text-red-200">
        Falha ao buscar eventos do AutoISP: {formatQueryError(error)}
      </p>
    )
  }

  if (list.length === 0 && isFetched) {
    return (
      <p className="text-xs text-on-surface-variant">
        Nenhum evento ativo retornado pelo AutoISP para os status consultados.
      </p>
    )
  }

  if (list.length === 0) {
    return null
  }

  const routeCount = list.filter((e) => effectiveRoute(e) !== null).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-gradient-to-r from-neutral-900/[0.03] to-transparent px-4 py-3 shadow-sm ring-1 ring-black/[0.03]">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
          </span>
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface">
            Eventos ao vivo
          </h3>
          <span className="inline-flex items-center rounded-full bg-neutral-900 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-white shadow-sm">
            {list.length}
          </span>
        </div>
        {routeCount > 0 ? (
          <p className="text-[11px] text-on-surface-variant">
            <span className="font-semibold text-on-surface-variant">{routeCount}</span> com rota (PPPoE na base ou{' '}
            <code className="rounded bg-neutral-100 dark:bg-white/5 px-1 py-0.5 text-[10px] font-medium text-on-surface">ponlink</code>)
          </p>
        ) : (
          <p className="text-[11px] text-on-surface-variant">Correlação em andamento ou via ponlink</p>
        )}
      </div>

      {connectionsIndexQuery.isPending ? (
        <p className="text-[11px] text-sky-800 dark:text-sky-200">
          Carregando <code className="text-[10px]">/api/massiva/connections</code> para correlacionar os PPPoE dos
          eventos com AP, slot e PON…
        </p>
      ) : null}
      {connectionsIndexQuery.isError ? (
        <p className="text-[11px] text-amber-900 dark:text-amber-200">
          Não foi possível carregar a base de conexões para correlacionar PPPoE; usando só o preview local ou{' '}
          <code className="text-[10px]">ponlink</code>. {formatQueryError(connectionsIndexQuery.error)}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 overflow-x-hidden sm:grid-cols-2">
        {paginatedList.map((event) => {
            const route = effectiveRoute(event)
            return (
              <div
                key={`autoisp-event-${event.id}`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/85 dark:border-white/10 bg-surface-container-lowest p-4 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.03] transition-all hover:border-amber-300/60 hover:shadow-[0_8px_24px_-8px_rgba(245,158,11,0.2)]"
              >
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-400 to-amber-500 opacity-90"
                  aria-hidden
                />
                <div className="absolute -right-4 -top-4 h-20 w-20 rotate-12 bg-amber-400/10 blur-2xl transition-all group-hover:bg-amber-400/18" />

                <div className="space-y-2 pl-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-on-surface-variant/60">
                      ID {event.id}
                    </span>
                    <span className="shrink-0 rounded-md bg-neutral-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
                      {event.eventType || event.adminStatus || 'evento'}
                    </span>
                  </div>

                  {route ? (
                    <div className="pt-0.5">
                      <div className="text-lg font-semibold tabular-nums tracking-tight text-on-surface">
                        {route.ap}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-on-surface-variant">
                        <span>
                          Slot <span className="font-medium text-on-surface-variant">{route.slot}</span>
                        </span>
                        <span className="text-on-surface-variant/60">·</span>
                        <span>
                          PON <span className="font-medium text-on-surface-variant">{route.port}</span>
                        </span>
                        {route.splitterCode ? (
                          <>
                            <span className="text-on-surface-variant/60">·</span>
                            <span className="font-mono text-on-surface-variant">{route.splitterCode}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-1">
                      <p className="text-[11px] leading-snug text-on-surface-variant">
                        {resourceSummary(event)}
                      </p>
                      {event.countOnus > 0 || event.countCircuits > 0 ? (
                        <p className="mt-1 text-[10px] text-on-surface-variant/60">
                          {event.countOnus > 0 ? `${event.countOnus} ONUs` : null}
                          {event.countOnus > 0 && event.countCircuits > 0 ? ' · ' : null}
                          {event.countCircuits > 0 ? `${event.countCircuits} circuitos` : null}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[10px] text-amber-800/90">
                        Sem rota automática: escolha AP, slot e PON no preview; o restante do formulário será preenchido.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onApplyFromAutoIsp(event, route)}
                  className="mt-4 w-full rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-amber-500/25 transition-all hover:from-amber-500 hover:to-amber-700 hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
                >
                  Aplicar na abertura
                </button>
              </div>
            )
          })}
      </div>

      {list.length > AUTO_ISP_EVENTS_PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/70 dark:border-white/10 pt-3">
          <p className="text-[11px] text-on-surface-variant">
            <span className="font-semibold text-on-surface-variant">
              {(page - 1) * AUTO_ISP_EVENTS_PAGE_SIZE + 1}–
              {Math.min(page * AUTO_ISP_EVENTS_PAGE_SIZE, list.length)}
            </span>{' '}
            de <span className="font-semibold text-on-surface-variant">{list.length}</span> eventos
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-2.5 py-1.5 text-[11px] font-semibold text-on-surface-variant shadow-sm transition hover:bg-surface-container-low disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
              Anterior
            </button>
            <span className="min-w-[4.5rem] text-center text-[11px] font-semibold tabular-nums text-on-surface-variant">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-2.5 py-1.5 text-[11px] font-semibold text-on-surface-variant shadow-sm transition hover:bg-surface-container-low disabled:pointer-events-none disabled:opacity-40"
            >
              Próxima
              <ChevronRight className="size-3.5 shrink-0" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
