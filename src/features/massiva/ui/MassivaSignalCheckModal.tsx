import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  SignalLow,
  WifiOff,
  X,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import {
  fetchMassivaAffectedSignal,
  type MassivaAffectedSignalBucket,
} from '@/features/massiva/api/fetchMassivaAffectedSignal'

type MassivaSignalCheckModalProps = {
  protocol: number
  assignmentId: number | null
  onClose: () => void
}

const BUCKET_META: Record<
  MassivaAffectedSignalBucket,
  { label: string; cls: string; Icon: typeof WifiOff }
> = {
  offline: { label: 'Sem sinal', cls: 'text-rose-700 dark:text-rose-200', Icon: WifiOff },
  degraded: { label: 'Sinal ruim', cls: 'text-amber-700 dark:text-amber-200', Icon: SignalLow },
  unknown: { label: 'Sem leitura', cls: 'text-on-surface-variant', Icon: AlertTriangle },
  online: { label: 'No ar', cls: 'text-emerald-700 dark:text-emerald-200', Icon: CheckCircle2 },
}

export function MassivaSignalCheckModal({ protocol, assignmentId, onClose }: MassivaSignalCheckModalProps) {
  const query = useQuery({
    queryKey: ['massiva-affected-signal', protocol, assignmentId],
    queryFn: () => fetchMassivaAffectedSignal({ protocol, assignmentId }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const data = query.data

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Validação de sinal — protocolo ${protocol}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-surface-container-lowest shadow-2xl sm:rounded-2xl dark:ring-1 dark:ring-white/10">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 dark:border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/70">
              Validação de sinal pós-massiva
            </p>
            <h2 className="text-lg font-bold tracking-tight text-on-surface">
              Protocolo <span className="font-mono">{protocol}</span>
            </h2>
            {data ? (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-200">
                  <CheckCircle2 className="size-3.5" /> {data.recovered} de {data.total} subiram
                </span>
                {data.notRecoveredCount > 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-200">
                    <WifiOff className="size-3.5" /> {data.notRecoveredCount} não subiram
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-low disabled:opacity-50"
              title="Reconsultar o sinal agora (a ONU atualiza em ondas)"
            >
              <RefreshCw className={cn('size-3.5', query.isFetching && 'animate-spin')} />
              <span className="hidden sm:inline">Revalidar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg text-on-surface-variant/60 transition hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-on-surface-variant"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="min-h-0 flex-1 overflow-auto">
          {query.isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="size-8 animate-spin text-amber-500" />
              <p className="text-sm text-on-surface-variant">Consultando o sinal dos clientes…</p>
            </div>
          ) : query.isError ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-rose-700 dark:text-rose-200">
                {query.error instanceof Error ? query.error.message : 'Erro ao consultar o sinal.'}
              </p>
              <button
                type="button"
                onClick={() => query.refetch()}
                className="mt-3 rounded-lg bg-rose-100 dark:bg-rose-950/50 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-200 transition hover:bg-rose-200 dark:hover:bg-rose-950/60"
              >
                Tentar novamente
              </button>
            </div>
          ) : data && data.notRecovered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="size-6" />
              </span>
              <p className="text-base font-bold text-on-surface">Todos os clientes subiram 🎉</p>
              <p className="max-w-sm text-sm text-on-surface-variant">
                Nenhum dos {data.total} clientes afetados está sem sinal agora. Nada a disparar.
              </p>
            </div>
          ) : data ? (
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-surface-container-low">
                <tr className="border-b border-neutral-200 dark:border-white/10">
                  <th className="px-4 py-3 font-semibold text-on-surface-variant">Cliente</th>
                  <th className="px-4 py-3 font-semibold text-on-surface-variant">Telefone</th>
                  <th className="px-4 py-3 font-semibold text-on-surface-variant">Sinal atual</th>
                  <th className="px-4 py-3 text-right font-semibold text-on-surface-variant">Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.notRecovered.map((c) => {
                  const meta = BUCKET_META[c.bucket]
                  const hasPhone = Boolean(c.phone)
                  return (
                    <tr
                      key={c.pppoe}
                      className="border-b border-neutral-50 dark:border-white/5 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-on-surface">{c.name ?? '—'}</p>
                        <p className="text-[11px] text-on-surface-variant/70">
                          {c.pppoe}
                          {c.contract ? ` · contrato ${c.contract}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-on-surface-variant">
                        {hasPhone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="size-3 text-on-surface-variant/60" />
                            {c.phone}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant/50">sem telefone</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 font-semibold', meta.cls)}>
                          <meta.Icon className="size-3.5" />
                          {meta.label}
                          {c.rxPower != null && c.rxPower !== 0 ? (
                            <span className="tabular-nums">· {Math.round(c.rxPower)} dBm</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled
                          title="Disparo de HSM chega na próxima etapa"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-low px-2.5 py-1.5 text-[11px] font-semibold text-on-surface-variant opacity-60"
                        >
                          <MessageSquare className="size-3.5" />
                          Disparar HSM
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : null}
        </div>

        {/* Rodapé */}
        {data && data.notRecovered.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 dark:border-white/10 px-5 py-3">
            <p className="text-[11px] text-on-surface-variant/70">
              O disparo de HSM (WhatsApp via Matrix) entra na próxima etapa.
            </p>
            <button
              type="button"
              disabled
              title="Disparo de HSM chega na próxima etapa"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-neutral-900 opacity-60"
            >
              <MessageSquare className="size-4" />
              Disparar para todos ({data.notRecoveredCount})
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
