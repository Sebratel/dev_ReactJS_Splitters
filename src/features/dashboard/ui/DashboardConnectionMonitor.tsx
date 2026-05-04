import { useNetworkStats } from '@/features/dashboard/hooks/useNetworkStats'
import { useMassivaTickets } from '@/features/massiva/hooks/useMassivaTickets'
import { cn } from '@/shared/lib/utils'
import { RefreshCw } from 'lucide-react'

/** Paridade com `useNetworkStats` (refetchInterval). */
const STATS_REFETCH_MS = 30_000
/** Paridade com `useMassivaTickets` (refetchInterval). */
const MASSIVA_REFETCH_MS = 5 * 60 * 1000

function formatUpdatedAt(ts: number): string {
  if (ts <= 0) return '—'
  try {
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return '—'
  }
}

function formatRefetchEvery(ms: number): string {
  if (ms >= 60_000 && ms % 60_000 === 0) return `${ms / 60_000} min`
  if (ms % 1_000 === 0) return `${ms / 1_000} s`
  return `${Math.round(ms / 1_000)} s`
}

type RowTone = 'ok' | 'warn' | 'err' | 'idle'

function toneDot(tone: RowTone): string {
  switch (tone) {
    case 'ok':
      return 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.22)]'
    case 'warn':
      return 'bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]'
    case 'err':
      return 'bg-red-600 shadow-[0_0_0_3px_rgba(220,38,38,0.22)]'
    default:
      return 'bg-slate-300 shadow-[0_0_0_3px_rgba(148,163,184,0.35)]'
  }
}

export function DashboardConnectionMonitor() {
  const statsQ = useNetworkStats()
  /** Painel do dashboard: todos os utilizadores autenticados veem estado da API massiva. */
  const { listConnectivity, refetch: refetchMassivas } = useMassivaTickets({ enabled: true })

  const statsTone: RowTone = statsQ.isPending
    ? 'warn'
    : statsQ.isError
      ? 'err'
      : statsQ.isSuccess
        ? 'ok'
        : 'idle'

  const massivaTone: RowTone = !listConnectivity.configured
    ? 'idle'
    : listConnectivity.isPending
      ? 'warn'
      : listConnectivity.isError
        ? 'err'
        : 'ok'

  const onRefreshAll = () => {
    void statsQ.refetch()
    void refetchMassivas()
  }

  const busy = statsQ.isFetching || listConnectivity.isFetching

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/95 to-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.03]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/80 to-transparent" />

      <div className="relative p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Monitoramento
            </p>
            <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
              Dados e conexão
            </h3>
          </div>
          <button
            type="button"
            onClick={onRefreshAll}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} aria-hidden />
            Atualizar agora
          </button>
        </div>

        <ul className="mt-4 space-y-2.5">
          <li className="rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-3 shadow-sm">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                  toneDot(statsTone),
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Dados Splitters</p>
                <dl className="mt-2 space-y-1 text-[11px] text-slate-600">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Última atualização</dt>
                    <dd className="shrink-0 font-medium tabular-nums text-slate-800">
                      {formatUpdatedAt(statsQ.dataUpdatedAt)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Atualização a cada</dt>
                    <dd className="shrink-0 font-medium text-slate-800">
                      {formatRefetchEvery(STATS_REFETCH_MS)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </li>

          <li className="rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-3 shadow-sm">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                  toneDot(massivaTone),
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Dados Massiva</p>
                <dl className="mt-2 space-y-1 text-[11px] text-slate-600">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Última atualização</dt>
                    <dd className="shrink-0 font-medium tabular-nums text-slate-800">
                      {!listConnectivity.configured
                        ? '—'
                        : formatUpdatedAt(listConnectivity.dataUpdatedAt)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Atualização a cada</dt>
                    <dd className="shrink-0 font-medium text-slate-800">
                      {!listConnectivity.configured
                        ? '—'
                        : formatRefetchEvery(MASSIVA_REFETCH_MS)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  )
}
