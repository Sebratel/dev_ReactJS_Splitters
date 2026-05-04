import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CalendarClock, Wrench } from 'lucide-react'
import { useClienteSolicitations } from '@/features/clientes/hooks/useClienteSolicitations'
import { formatSolicitationDateDisplay } from '@/features/clientes/lib/formatSolicitationDate'
import {
  groupMaintenanceByMonth,
  summarizeMaintenance,
} from '@/features/clientes/lib/maintenanceSolicitations'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type ClienteDetailMaintenanceSectionProps = {
  clientId: number
}

function KpiChip({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone: 'neutral' | 'amber' | 'emerald' | 'sky'
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : tone === 'sky'
          ? 'border-sky-200 bg-sky-50 text-sky-900'
          : 'border-outline-variant bg-surface-container-low text-on-surface'

  return (
    <div
      className={`flex min-w-[7.5rem] flex-col gap-0.5 rounded-xl border px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${toneClass}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </span>
      <span className="text-base font-bold tabular-nums">{value}</span>
    </div>
  )
}

export function ClienteDetailMaintenanceSection({
  clientId,
}: ClienteDetailMaintenanceSectionProps) {
  const { view, refetch } = useClienteSolicitations(clientId)

  const items = view.status === 'success' ? view.items : []
  const summary = useMemo(() => summarizeMaintenance(items), [items])
  const points = useMemo(() => groupMaintenanceByMonth(items), [items])

  if (view.status === 'disabled') return null

  return (
    <section
      className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm md:p-5"
      aria-labelledby="cliente-detail-maintenance-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
            <Wrench size={18} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              Histórico operacional
            </p>
            <h2
              id="cliente-detail-maintenance-heading"
              className="mt-0.5 text-base font-semibold tracking-tight text-on-surface"
            >
              Manutenções
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant/70">
              Total e linha do tempo das solicitações de manutenção registradas para este cliente.
            </p>
          </div>
        </div>
      </div>

      {view.status === 'loading' ? (
        <div className="mt-4">
          <LoadingState label="Calculando histórico de manutenções…" />
        </div>
      ) : null}

      {view.status === 'error' ? (
        <div className="mt-4">
          <ErrorState
            title="Não foi possível calcular as manutenções"
            message={formatQueryError(view.error)}
            onRetry={() => refetch()}
          />
        </div>
      ) : null}

      {view.status === 'empty' ? (
        <p className="mt-4 text-sm text-on-surface-variant/75">
          Nenhuma solicitação retornada pelo sistema para este cliente.
        </p>
      ) : null}

      {view.status === 'success' && summary.total === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-amber-900/85">
          Nenhuma solicitação foi classificada como manutenção pelos textos de título, área, equipe ou status.
          Os protocolos continuam listados na secção <strong>Solicitações</strong>; se faltar alguma palavra-chave do
          seu ERP, podemos incluir no filtro.
        </p>
      ) : null}

      {view.status === 'success' && summary.total > 0 ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <KpiChip label="Total" value={summary.total} tone="neutral" />
            <KpiChip label="Em aberto" value={summary.open} tone="amber" />
            <KpiChip label="Concluídas" value={summary.closed} tone="emerald" />
            <KpiChip
              label="Última"
              value={summary.latest ? formatSolicitationDateDisplay(summary.latest) : '—'}
              tone="sky"
            />
          </div>

          <div className="mt-4">
            <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
                <CalendarClock size={13} strokeWidth={2} aria-hidden />
                Linha do tempo (mensal)
              </div>
              <p className="text-[10px] leading-snug text-on-surface-variant/55 normal-case font-normal tracking-normal">
                Em aberto sem data de abertura ou encerramento no ERP entram no mês atual neste gráfico.
              </p>
            </div>
            <div className="h-44 w-full">
              {points.length === 0 ? (
                <p className="flex h-full items-center justify-center text-center text-xs text-on-surface-variant/70">
                  Sem datas válidas para montar a linha do tempo.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 6, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      stroke="#6b7280"
                      interval="preserveStartEnd"
                      minTickGap={16}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      stroke="#6b7280"
                      width={32}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, borderColor: '#e5e7eb' }}
                      formatter={(value: unknown) => [
                        Number(value ?? 0).toLocaleString('pt-BR'),
                        'Manutenções',
                      ]}
                      labelFormatter={(label: unknown) => String(label ?? '')}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#b45309"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#b45309', strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
