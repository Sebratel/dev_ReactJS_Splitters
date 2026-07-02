import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, Router, TrendingDown } from 'lucide-react'
import { useCancellationsSummary } from '@/features/cancellations/hooks/useCancellationsSummary'
import {
  CANCELLATION_CATEGORY_LABELS,
  CANCELLATION_CATEGORY_ORDER,
  type CancellationBucket,
} from '@/features/cancellations/model/cancellationsSummary'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type PeriodPreset = '3m' | '6m' | '12m'
type Dimension = 'accessPoint' | 'splitter' | 'city'

function startIsoForPreset(preset: PeriodPreset): string {
  const months = preset === '3m' ? 3 : preset === '6m' ? 6 : 12
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}

const CATEGORY_DOT: Record<string, string> = {
  rede: 'bg-rose-500',
  tecnico: 'bg-amber-500',
  financeiro: 'bg-slate-400',
  pre_instalacao: 'bg-sky-400',
  mudanca: 'bg-violet-400',
  operacional: 'bg-neutral-300',
  outros: 'bg-neutral-200',
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return '0%'
  return `${Math.round((part / whole) * 100)}%`
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const idx = Number.parseInt(m ?? '', 10) - 1
  return idx >= 0 && idx < 12 ? `${months[idx]}/${(y ?? '').slice(2)}` : key
}

export function CancellationsPanel() {
  const [preset, setPreset] = useState<PeriodPreset>('6m')
  const [dimension, setDimension] = useState<Dimension>('accessPoint')
  const startIso = useMemo(() => startIsoForPreset(preset), [preset])
  const query = useCancellationsSummary(startIso)

  const rankingRows = useMemo((): CancellationBucket[] => {
    const data = query.data
    if (!data) return []
    if (dimension === 'splitter') return data.bySplitter
    if (dimension === 'city') return data.byCity
    return data.byAccessPoint
  }, [query.data, dimension])

  const chartData = useMemo(
    () =>
      (query.data?.monthly ?? []).map((m) => ({
        label: monthLabel(m.key),
        rede: m.rede,
        outros: Math.max(0, m.total - m.rede),
      })),
    [query.data],
  )

  if (query.isPending) return <LoadingState label="Carregando cancelamentos..." />
  if (query.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar os cancelamentos"
        message={formatQueryError(query.error)}
        onRetry={() => query.refetch()}
      />
    )
  }

  const data = query.data
  const totalRede = data.totalsByCategory.rede
  const redeShare = pct(totalRede, data.total)

  return (
    <div className="space-y-4">
      {/* Narrativa + período */}
      <div className="rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50 to-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600 ring-1 ring-rose-200/70">
              <TrendingDown className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight text-neutral-900">
                Cancelamentos por área
              </p>
              <p className="mt-0.5 text-sm leading-snug text-neutral-600">
                {data.total.toLocaleString('pt-BR')} cancelamentos no período · destaque no churn de{' '}
                <span className="font-semibold text-rose-700">rede/qualidade</span> (insatisfação +
                concorrência): <span className="font-bold text-rose-700">
                  {totalRede.toLocaleString('pt-BR')}</span> ({redeShare}).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-neutral-200/90 bg-white p-1 shadow-sm">
            {(['3m', '6m', '12m'] as PeriodPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  preset === p ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Categorias */}
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {CANCELLATION_CATEGORY_ORDER.map((cat) => {
          const value = data.totalsByCategory[cat]
          const isRede = cat === 'rede'
          return (
            <div
              key={cat}
              className={`rounded-xl border px-3 py-2.5 ${
                isRede ? 'border-rose-300 bg-rose-50/70 ring-1 ring-rose-200' : 'border-neutral-200/80 bg-white'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${CATEGORY_DOT[cat]}`} aria-hidden />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  {CANCELLATION_CATEGORY_LABELS[cat]}
                </p>
              </div>
              <p className={`mt-1 text-xl font-bold tabular-nums ${isRede ? 'text-rose-700' : 'text-neutral-900'}`}>
                {value.toLocaleString('pt-BR')}
              </p>
              <p className="text-[10px] text-neutral-400">{pct(value, data.total)}</p>
            </div>
          )
        })}
      </div>

      {/* Tendência mensal */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-neutral-800">
          Tendência mensal — <span className="text-rose-600">rede</span> vs. demais motivos
        </p>
        <div className="h-52">
          {chartData.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-neutral-500">
              Sem dados no período.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, borderColor: '#e5e7eb' }}
                  formatter={(v: unknown, n: unknown) => [
                    Number(v ?? 0).toLocaleString('pt-BR'),
                    n === 'rede' ? 'Rede/Qualidade' : 'Demais motivos',
                  ]}
                />
                <Bar stackId="c" dataKey="outros" name="outros" fill="#cbd5e1" radius={[0, 0, 0, 0]} />
                <Bar stackId="c" dataKey="rede" name="rede" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Ranking por área */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Router className="size-4 text-neutral-500" aria-hidden />
            Áreas com mais churn de rede
          </p>
          <div className="flex items-center gap-1 rounded-lg border border-neutral-200/90 bg-white p-0.5">
            {([
              { id: 'accessPoint', label: 'Ponto de acesso' },
              { id: 'splitter', label: 'Splitter' },
              { id: 'city', label: 'Cidade' },
            ] as Array<{ id: Dimension; label: string }>).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDimension(opt.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  dimension === opt.id ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-white">
              <tr className="border-b border-neutral-200/90 text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5">Área</th>
                {dimension === 'splitter' ? <th className="px-3 py-2.5">Slot/PON</th> : null}
                <th className="px-3 py-2.5 text-right">Rede</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5 text-right">% rede</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rankingRows.slice(0, 50).map((row) => (
                <tr key={row.key} className="hover:bg-neutral-50/70">
                  <td className="px-4 py-2 font-medium text-neutral-900">{row.key}</td>
                  {dimension === 'splitter' ? (
                    <td className="px-3 py-2 font-mono text-[12px] text-neutral-600">
                      {row.slot != null && row.pon != null ? `${row.slot} / ${row.pon}` : '—'}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-700">
                    {row.rede.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-700">
                    {row.total.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                    {pct(row.rede, row.total)}
                  </td>
                </tr>
              ))}
              {rankingRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-500">
                    Sem cancelamentos no período/recorte.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-neutral-500">
        <AlertTriangle className="size-3.5 text-amber-500" aria-hidden />
        "Rede/Qualidade" = motivos de insatisfação e migração para concorrência — o churn que uma
        manutenção pode influenciar. Financeiro e pré-instalação não indicam problema de rede.
      </p>
    </div>
  )
}
