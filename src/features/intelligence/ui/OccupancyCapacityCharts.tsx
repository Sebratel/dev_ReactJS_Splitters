import { useMemo } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  buildDeltaDistributionHistogram,
  buildOccupancyTimeSeries,
  DELTA_DISTRIBUTION_COLORS,
  type TrendDeltaReference,
  type TrendRowForOccupancyCharts,
} from '@/features/intelligence/lib/networkOccupancyCharts'
import { PercentagePointsCallout } from '@/features/intelligence/ui/PercentagePointsCallout'

type OccupancyCapacityChartsProps = {
  trends: readonly TrendRowForOccupancyCharts[]
  formatDateLabel: (date: Date) => string
  deltaReferenceLabel: string
  trendDeltaReference: TrendDeltaReference
}

const TIME_SERIES_LABELS: Record<string, string> = {
  averageUsagePercent: 'Ocupação média',
  criticalSharePercent: '% críticos (≥95%)',
  attentionSharePercent: '% em atenção (70–94%)',
}

export function OccupancyCapacityCharts({
  trends,
  formatDateLabel,
  deltaReferenceLabel,
  trendDeltaReference,
}: OccupancyCapacityChartsProps) {
  const timeSeries = useMemo(() => buildOccupancyTimeSeries(trends), [trends])
  const deltaHistogram = useMemo(
    () => buildDeltaDistributionHistogram(trends, trendDeltaReference),
    [trends, trendDeltaReference],
  )

  const chartData = useMemo(
    () =>
      timeSeries.map((point) => ({
        ...point,
        date: formatDateLabel(point.at),
      })),
    [timeSeries, formatDateLabel],
  )

  const deltaHistogramTotal = useMemo(
    () => deltaHistogram.reduce((sum, bucket) => sum + bucket.count, 0),
    [deltaHistogram],
  )

  if (trends.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-surface-container-low/80 px-3 py-8 text-center text-sm text-on-surface-variant">
        Sem splitters com tendência neste período para montar pressão e variação.
      </p>
    )
  }

  return (
    <div className="mt-5 space-y-5 border-t border-slate-200/80 dark:border-white/10 pt-5">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          Pressão na rede — média, atenção e críticos
        </h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-on-surface-variant">
          Área e linhas usam a mesma estimação temporal do gráfico acima. Vermelho = já no limite; âmbar claro = faixa
          de atenção (70–94%) — a “onda” antes da saturação. Não repete os cards folga/atenção/crítico do topo (só
          snapshot de hoje).
        </p>
        <div className="mt-2 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="avgUsageGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis
                stroke="#64748b"
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }}
                formatter={(value: unknown, name) => {
                  const key = String(name ?? '')
                  const label = TIME_SERIES_LABELS[key] ?? key
                  return [`${Number(value ?? 0).toFixed(2)}%`, label]
                }}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Legend
                wrapperStyle={{ fontSize: 10 }}
                formatter={(value) => TIME_SERIES_LABELS[String(value)] ?? String(value)}
              />
              <Area
                type="monotone"
                dataKey="averageUsagePercent"
                name="averageUsagePercent"
                stroke="#d97706"
                strokeWidth={2}
                fill="url(#avgUsageGradient)"
              />
              <Line
                type="monotone"
                dataKey="attentionSharePercent"
                name="attentionSharePercent"
                stroke="#fbbf24"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 2.5, fill: '#fbbf24' }}
              />
              <Line
                type="monotone"
                dataKey="criticalSharePercent"
                name="criticalSharePercent"
                stroke="#e11d48"
                strokeWidth={2.2}
                dot={{ r: 3, fill: '#e11d48' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          Variação de ocupação ({deltaReferenceLabel})
        </h3>
        <PercentagePointsCallout periodLabel={deltaReferenceLabel} className="mt-2" />
        <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
          Quantos equipamentos estão em cada faixa de mudança de uso (<span className="font-semibold">pp</span>) no
          período — rede parada (centro) vs subindo ou caindo (pontas). Complementa o selo “Estável” da lista ao lado.
        </p>
        <div className="mt-2 h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={deltaHistogram}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="label"
                width={148}
                tick={{ fontSize: 9, fill: '#475569' }}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }}
                formatter={(value: unknown) => {
                  const count = Number(value ?? 0)
                  const pct =
                    deltaHistogramTotal > 0
                      ? ((count / deltaHistogramTotal) * 100).toFixed(1)
                      : '0'
                  return [`${count.toLocaleString('pt-BR')} (${pct}%)`, 'Equipamentos']
                }}
              />
              <Bar dataKey="count" name="Equipamentos" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {deltaHistogram.map((entry) => (
                  <Cell key={entry.key} fill={DELTA_DISTRIBUTION_COLORS[entry.key]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
