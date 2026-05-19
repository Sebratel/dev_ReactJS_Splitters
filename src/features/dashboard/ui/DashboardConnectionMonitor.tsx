import { useNetworkStats } from '@/features/dashboard/hooks/useNetworkStats'
import { useMassivaTickets } from '@/features/massiva/hooks/useMassivaTickets'
import { formatBrazilDateTimeDisplay } from '@/shared/lib/formatBrazilDisplayDate'
import { cn } from '@/shared/lib/utils'
import { Activity, RefreshCw } from 'lucide-react'

/** Paridade com `useNetworkStats` (refetchInterval). */
const STATS_REFETCH_MS = 30_000
/** Paridade com `useMassivaTickets` (refetchInterval). */
const MASSIVA_REFETCH_MS = 5 * 60 * 1000

function formatUpdatedAt(ts: number): string {
  if (ts <= 0) return '—'
  return formatBrazilDateTimeDisplay(ts, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
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
      return 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]'
    case 'warn':
      return 'bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.28)]'
    case 'err':
      return 'bg-red-600 shadow-[0_0_0_4px_rgba(220,38,38,0.28)]'
    default:
      return 'bg-stone-300 shadow-[0_0_0_4px_rgba(168,162,158,0.35)]'
  }
}

export function DashboardConnectionMonitor() {
  const statsQ = useNetworkStats()
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
    <div className="relative overflow-hidden rounded-3xl border border-stone-200/70 bg-gradient-to-b from-white via-stone-50/40 to-amber-50/20 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.15)] ring-1 ring-white/80">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />

      <div className="relative p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100/90 to-stone-100/80 text-amber-900 shadow-inner ring-1 ring-amber-200/40">
              <Activity className="h-[1.05rem] w-[1.05rem]" strokeWidth={2} aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500 sm:text-[11px]">
                Integrações
              </p>
              <h3 className="text-lg font-semibold tracking-tight text-stone-900">
                Saúde das APIs
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefreshAll}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-stone-200/90 bg-white/90 px-4 py-2 text-[12px] font-semibold text-stone-800 shadow-sm transition-[transform,box-shadow,background] hover:bg-white hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} aria-hidden />
            Atualizar
          </button>
        </div>

        <ul className="mt-4 space-y-2.5">
          <li className="rounded-2xl border border-stone-100/90 bg-white/80 px-3.5 py-3 shadow-sm ring-1 ring-stone-900/[0.03] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0">
            <div className="flex items-start gap-3">
              <div
                className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', toneDot(statsTone))}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-stone-900">Dados Splitters</p>
                <dl className="mt-2 space-y-1 text-[12px] text-stone-600">
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-500">Última atualização</dt>
                    <dd className="shrink-0 font-medium tabular-nums text-stone-800">
                      {formatUpdatedAt(statsQ.dataUpdatedAt)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-500">Intervalo</dt>
                    <dd className="shrink-0 font-medium text-stone-800">
                      {formatRefetchEvery(STATS_REFETCH_MS)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </li>

          <li className="rounded-2xl border border-stone-100/90 bg-white/80 px-3.5 py-3 shadow-sm ring-1 ring-stone-900/[0.03] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0">
            <div className="flex items-start gap-3">
              <div
                className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', toneDot(massivaTone))}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-stone-900">Dados Massiva</p>
                <dl className="mt-2 space-y-1 text-[12px] text-stone-600">
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-500">Última atualização</dt>
                    <dd className="shrink-0 font-medium tabular-nums text-stone-800">
                      {!listConnectivity.configured
                        ? '—'
                        : formatUpdatedAt(listConnectivity.dataUpdatedAt)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-500">Intervalo</dt>
                    <dd className="shrink-0 font-medium text-stone-800">
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
