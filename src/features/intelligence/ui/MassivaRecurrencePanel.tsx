import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronDown, Ticket } from 'lucide-react'
import type { MassivaRecurrenceInsights } from '@/features/intelligence/lib/massivaRecurrenceInsights'
import { cn } from '@/shared/lib/utils'

type MassivaRecurrencePanelProps = {
  insights: MassivaRecurrenceInsights
  periodLabel: string
  deltaReferenceLabel: string
  distinctMassivaCountInPeriod: number
}

function usageCellClass(usagePercent: number): string {
  if (usagePercent >= 95) return 'text-rose-700 dark:text-rose-200 font-semibold'
  if (usagePercent >= 70) return 'text-amber-800 dark:text-amber-200 font-semibold'
  return 'text-on-surface-variant'
}

export function MassivaRecurrencePanel({
  insights,
  periodLabel,
  deltaReferenceLabel,
  distinctMassivaCountInPeriod,
}: MassivaRecurrencePanelProps) {
  const [histogramOpen, setHistogramOpen] = useState(true)

  const histogramMax = useMemo(
    () => Math.max(1, ...insights.histogram.map((row) => row.splitters)),
    [insights.histogram],
  )

  const shareWithMassivaPercent =
    insights.totalSplittersInScope > 0
      ? Number(
          ((insights.splittersWithMassiva / insights.totalSplittersInScope) * 100).toFixed(1),
        )
      : 0

  return (
    <article className="rounded-3xl border border-white/50 bg-surface-container-lowest/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <Ticket size={16} className="shrink-0 text-amber-600 dark:text-amber-300" />
          <div>
            <h2 className="text-sm font-bold text-on-surface">Onde as massivas mais aparecem</h2>
            <p className="mt-0.5 text-[11px] font-medium text-on-surface-variant">
              Concentração, ranking operacional e distribuição de recorrência no período.
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200 ring-1 ring-amber-200/80">
          Período: {periodLabel}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <KpiCard
          label="Massivas únicas (rede)"
          value={distinctMassivaCountInPeriod.toLocaleString('pt-BR')}
          hint="Ocorrências distintas no período — alinhado ao cartão «Massivas no período»."
          tone="amber"
        />
        <KpiCard
          label="Equipamentos com massiva"
          value={`${insights.splittersWithMassiva.toLocaleString('pt-BR')} (${shareWithMassivaPercent}%)`}
          hint={`De ${insights.totalSplittersInScope.toLocaleString('pt-BR')} com tendência no período; ${insights.splittersWithoutMassiva.toLocaleString('pt-BR')} sem vínculo.`}
          tone="slate"
        />
        <KpiCard
          label="Concentração no top 20"
          value={
            insights.totalMassivaLinkages > 0
              ? `${insights.concentrationTop20LinkagesPercent.toLocaleString('pt-BR')}% dos vínculos`
              : '—'
          }
          hint={
            insights.totalMassivaLinkages > 0
              ? `${insights.concentrationTop20Count} equipamentos concentram a maior parte das ligações massiva × splitter.`
              : 'Nenhum vínculo no período.'
          }
          tone="violet"
        />
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          Prioridade operacional — top 15 equipamentos
        </h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-on-surface-variant">
          Ordenado por massivas distintas no período; desempate por massivas abertas, uso de portas e{' '}
          {deltaReferenceLabel}. Cada linha é um splitter do cadastro com tendência no recorte.
        </p>

        {insights.ranking.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-surface-container-low/80 px-3 py-6 text-center text-sm text-on-surface-variant">
            Nenhum equipamento com massiva registrada no histórico local neste período.
          </p>
        ) : (
          <div className="mt-2 overflow-auto rounded-xl border border-slate-200/80 dark:border-white/10">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-slate-200/80 dark:border-white/10 bg-surface-container-low/90 text-[10px] uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Equipamento</th>
                  <th className="px-2 py-2">Massivas (ún.)</th>
                  <th className="px-2 py-2">Abertas</th>
                  <th className="px-2 py-2">Uso</th>
                  <th className="px-2 py-2">{deltaReferenceLabel}</th>
                  <th className="px-2 py-2">OLT</th>
                  <th className="px-2 py-2">Local</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {insights.ranking.map((row, index) => (
                  <tr key={row.splitterCode} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/40">
                    <td className="px-2 py-2 tabular-nums text-on-surface-variant">{index + 1}</td>
                    <td className="px-2 py-2">
                      <Link
                        to={`/splitters/${encodeURIComponent(row.splitterCode)}`}
                        className="font-semibold text-amber-900 dark:text-amber-200 hover:underline"
                      >
                        <span className="block max-w-[200px] truncate" title={row.splitterTitle}>
                          {row.splitterTitle}
                        </span>
                      </Link>
                      <span className="font-mono text-[10px] text-on-surface-variant">{row.splitterCode}</span>
                    </td>
                    <td className="px-2 py-2 tabular-nums font-bold text-amber-950 dark:text-amber-100">
                      {row.distinctMassivas}
                    </td>
                    <td className="px-2 py-2 tabular-nums">{row.openMassivas}</td>
                    <td className={cn('px-2 py-2 tabular-nums', usageCellClass(row.usagePercent))}>
                      {row.usagePercent.toFixed(1)}%
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {row.selectedDelta >= 0 ? '+' : ''}
                      {row.selectedDelta.toFixed(2)}%
                    </td>
                    <td className="max-w-[140px] truncate px-2 py-2 text-on-surface-variant" title={row.oltLabel}>
                      {row.oltLabel}
                    </td>
                    <td className="max-w-[160px] truncate px-2 py-2 text-on-surface-variant" title={row.locationLabel}>
                      {row.locationLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setHistogramOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-white/10 bg-surface-container-low/80 px-3 py-2 text-left text-xs font-semibold text-on-surface-variant hover:bg-slate-100/80 dark:hover:bg-white/5"
        >
          <span>Distribuição: quantos equipamentos por faixa de recorrência</span>
          <ChevronDown
            size={16}
            className={cn('shrink-0 transition', histogramOpen ? 'rotate-180' : '')}
          />
        </button>
        {histogramOpen ? (
          <div className="mt-2 space-y-2 rounded-xl border border-slate-200/80 dark:border-white/10 bg-surface-container-lowest px-3 py-3">
            <p className="text-[11px] text-on-surface-variant">
              A maioria costuma ficar em <span className="font-semibold">0 massivas</span>; a cauda
              longa concentra os reincidentes.
            </p>
            {insights.histogram.map((row) => {
              const widthPercent = (row.splitters / histogramMax) * 100
              return (
                <div key={row.bucket} className="grid grid-cols-[88px_1fr_48px] items-center gap-2">
                  <span className="text-[11px] font-medium text-on-surface-variant">{row.label}</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                  <span className="text-right text-[11px] font-bold tabular-nums text-on-surface">
                    {row.splitters.toLocaleString('pt-BR')}
                  </span>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>

      {insights.showBarChart ? (
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            Destaque visual — líderes com diferença clara
          </h3>
          <p className="mt-0.5 text-[11px] text-on-surface-variant">
            Gráfico só quando o 1º equipamento supera o 2º (evita barras todas iguais).
          </p>
          <div className="mt-2 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={insights.barChartLeaders}
                layout="vertical"
                margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="splitterTitle"
                  width={120}
                  tick={{ fontSize: 9, fill: '#475569' }}
                  tickFormatter={(v) => {
                    const s = String(v ?? '')
                    return s.length > 18 ? `${s.slice(0, 16)}…` : s
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as (typeof insights.barChartLeaders)[number]
                    return (
                      <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-surface-container-lowest px-2.5 py-2 text-xs shadow-lg">
                        <p className="font-bold text-on-surface">{d.splitterTitle}</p>
                        <p className="font-mono text-[10px] text-on-surface-variant">{d.splitterCode}</p>
                        <p className="mt-1 tabular-nums text-amber-800 dark:text-amber-200">
                          {d.totalTickets} massivas distintas
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="totalTickets" fill="#d97706" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : insights.splittersWithMassiva > 0 ? (
        <p className="mt-4 rounded-xl border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/40 px-3 py-2.5 text-[11px] leading-relaxed text-amber-950 dark:text-amber-100">
          Vários equipamentos empatam no mesmo número de massivas — use a tabela acima em vez do gráfico
          de barras. Isso costuma indicar as mesmas ocorrências compartilhadas entre splitters vizinhos.
        </p>
      ) : null}
    </article>
  )
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone: 'amber' | 'slate' | 'violet'
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-200/80 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-950/40'
      : tone === 'violet'
        ? 'border-violet-200/80 dark:border-violet-800/50 bg-violet-50/60 dark:bg-violet-950/40'
        : 'border-slate-200/80 dark:border-white/10 bg-surface-container-low/80'
  const valueClass =
    tone === 'amber' ? 'text-amber-950 dark:text-amber-100' : tone === 'violet' ? 'text-violet-950 dark:text-violet-100' : 'text-on-surface'

  return (
    <div className={cn('rounded-xl border px-3 py-2.5', toneClass)}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className={cn('mt-1 text-lg font-black tabular-nums leading-tight', valueClass)}>{value}</p>
      <p className="mt-1 text-[10px] leading-snug text-on-surface-variant">{hint}</p>
    </div>
  )
}
