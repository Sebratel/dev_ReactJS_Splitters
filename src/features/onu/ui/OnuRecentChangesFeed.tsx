import { Activity, ArrowDownCircle, ArrowUpCircle, RefreshCw, Zap, Search } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useOnuRecentChanges } from '@/features/onu/hooks/useOnuRecentChanges'
import { formatAgo } from '@/features/onu/model/onuDiagnostic'
import type { OnuStatusChange } from '@/features/onu/model/onuStatusChange'

function statusPt(s: string | null): string {
  switch ((s ?? '').toLowerCase()) {
    case 'down':
      return 'queda'
    case 'power_fail':
      return 'falta de energia'
    case 'loss_signal':
      return 'perda de sinal'
    case 'up':
    case 'ok':
      return 'online'
    default:
      return s ?? '—'
  }
}

/** Gatilho: alarme = trap (instantâneo); senão varredura de status. */
function TriggerTag({ trigger }: { trigger: string | null }) {
  const isAlarm = (trigger ?? '').toLowerCase() === 'alarm'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
        isAlarm ? 'bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-200' : 'bg-slate-100 text-on-surface-variant',
      )}
      title={isAlarm ? 'Detectado por trap/alarme da OLT (instantâneo)' : 'Detectado por varredura de status'}
    >
      {isAlarm ? <Zap size={9} /> : <Search size={9} />}
      {isAlarm ? 'alarme' : 'varredura'}
    </span>
  )
}

function EventRow({ e }: { e: OnuStatusChange }) {
  const isDrop = e.kind === 'drop'
  const Icon = isDrop ? ArrowDownCircle : ArrowUpCircle
  const ago = formatAgo(e.ageSeconds)
  return (
    <li className="flex items-center gap-3 py-2">
      <Icon
        size={18}
        strokeWidth={2}
        className={cn('shrink-0', isDrop ? 'text-rose-500' : 'text-emerald-500')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-xs font-semibold text-on-surface">
            {e.username ?? '—'}
          </span>
          <TriggerTag trigger={e.trigger} />
        </div>
        <p className="truncate text-[10px] text-on-surface-variant/60">
          {e.oltHostname ?? 'OLT —'} · {statusPt(e.previousStatus)} → {statusPt(e.newStatus)}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 text-[11px] font-bold tabular-nums',
          isDrop ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300',
        )}
      >
        {ago ?? '—'}
      </span>
    </li>
  )
}

/**
 * Feed near-real-time de quedas e recuperações de ONU (lê onu_status_changes).
 * Polling de 30s; o status no banco é atualizado por trap em ~1 min.
 */
export function OnuRecentChangesFeed() {
  const query = useOnuRecentChanges()
  const data = query.data ?? null

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-primary" />
          <h3 className="text-sm font-semibold tracking-tight text-on-surface">
            Quedas e recuperações recentes
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {data ? (
            <>
              <span className="rounded-full bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-200">
                {data.drops} quedas
              </span>
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-200">
                {data.recoveries} voltaram
              </span>
            </>
          ) : null}
          {query.isFetching ? (
            <RefreshCw size={13} className="animate-spin text-primary/50" aria-label="Atualizando" />
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-on-surface-variant/65">
        Eventos detectados por trap/alarme da OLT em ~tempo real. Atualiza a cada 30s.
      </p>

      {query.isPending ? (
        <p className="mt-4 py-6 text-center text-xs text-on-surface-variant/60">
          Carregando eventos recentes…
        </p>
      ) : query.isError ? (
        <div className="mt-4 py-6 text-center text-xs text-rose-700 dark:text-rose-200">
          <p>Não foi possível carregar o feed de eventos.</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-surface-container-lowest px-3 py-1.5 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            <RefreshCw size={12} /> Tentar novamente
          </button>
        </div>
      ) : !data || data.events.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/70 dark:bg-emerald-950/40 py-6 text-center text-xs text-emerald-800 dark:text-emerald-200">
          Sem quedas ou recuperações recentes. 🎉
        </p>
      ) : (
        <ul className="mt-2 max-h-[420px] divide-y divide-outline-variant/40 overflow-y-auto pr-1">
          {data.events.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </ul>
      )}
    </div>
  )
}
