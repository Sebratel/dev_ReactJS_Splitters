import { Link } from 'react-router-dom'
import {
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
import type { GmudVoalleIndicators } from '@/features/gmud/api/gmudIndicators'
import { BarList, Heatmap, Panel } from '@/features/gmud/ui/indicators/IndicatorPrimitives'
import { COLORS } from '@/features/gmud/ui/indicators/indicatorTheme'
import { cleanGmudTitle } from '@/features/gmud/lib/gmudTitle'

const MONTH_FMT = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
const AGING_COLORS = [COLORS.closed, COLORS.opened, '#f97316', COLORS.overdue]
const AXIS = { fontSize: 11 }

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return MONTH_FMT.format(new Date(y, m - 1, 1)).replace('.', '')
}

export function GmudHistorySection({ data }: { data: GmudVoalleIndicators }) {
  const monthly = data.period.monthly.map((m) => ({ ...m, label: monthLabel(m.month) }))
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel
        className="lg:col-span-2"
        title="Abertas × encerradas por mês"
        subtitle="Barras: entrada e saída de protocolos. Linha: GMUDs em aberto no fim de cada mês (backlog)."
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-neutral-200 dark:text-white/10" />
              <XAxis dataKey="label" tick={AXIS} stroke="currentColor" className="text-on-surface-variant" />
              <YAxis yAxisId="flow" tick={AXIS} allowDecimals={false} stroke="currentColor" className="text-on-surface-variant" />
              <YAxis yAxisId="backlog" orientation="right" tick={AXIS} allowDecimals={false} stroke="currentColor" className="text-on-surface-variant" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="flow" dataKey="opened" name="Abertas" fill={COLORS.opened} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="flow" dataKey="closed" name="Encerradas" fill={COLORS.closed} radius={[4, 4, 0, 0]} />
              <Line yAxisId="backlog" type="monotone" dataKey="backlog" name="Em aberto (backlog)" stroke={COLORS.backlog} strokeWidth={2.5} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Idade das GMUDs em aberto" subtitle="Há quanto tempo cada protocolo está aberto no Voalle.">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.snapshot.aging} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" className="text-neutral-200 dark:text-white/10" />
              <XAxis dataKey="bucket" tick={AXIS} stroke="currentColor" className="text-on-surface-variant" />
              <YAxis tick={AXIS} allowDecimals={false} stroke="currentColor" className="text-on-surface-variant" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" name="GMUDs" radius={[6, 6, 0, 0]}>
                {data.snapshot.aging.map((a, i) => (
                  <Cell key={a.bucket} fill={AGING_COLORS[i] ?? COLORS.neutral} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel className="lg:col-span-2" title="Solicitantes" subtitle="Quem abriu GMUDs no período e quantas seguem abertas ou vencidas.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-on-surface-variant/70">
                <th className="py-1.5 pr-3">Solicitante</th>
                <th className="py-1.5 pr-3 text-right">Abertas no período</th>
                <th className="py-1.5 pr-3 text-right">Em aberto</th>
                <th className="py-1.5 pr-3 text-right">Vencidas</th>
                <th className="py-1.5 text-right">% encerradas</th>
              </tr>
            </thead>
            <tbody>
              {data.period.requesters.map((r) => (
                <tr key={r.requester} className="border-t border-neutral-200/60 dark:border-white/5">
                  <td className="py-1.5 pr-3 text-on-surface">{r.requester}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{r.opened}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{r.openNow}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {r.overdueNow > 0 ? <span className="font-semibold text-rose-600 dark:text-rose-300">{r.overdueNow}</span> : 0}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{r.closedRate == null ? '—' : `${r.closedRate}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Mais antigas em aberto" subtitle="Candidatas a encerramento ou revisão.">
        <ul className="divide-y divide-neutral-200/60 dark:divide-white/5">
          {data.snapshot.oldestOpen.map((g) => (
            <li key={g.protocol} className="py-2">
              <Link to={`/gmud/${g.protocol}`} className="group block">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs text-on-surface-variant group-hover:text-primary">{g.protocol}</span>
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-300">{g.ageDays} dias</span>
                </span>
                <span className="block truncate text-sm text-on-surface group-hover:underline" title={g.title}>
                  {cleanGmudTitle(g.title, g.protocol, g.requester)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="lg:col-span-2" title="Quando as GMUDs são abertas" subtitle="Dia da semana × hora de abertura no período.">
        <Heatmap matrix={data.period.heatmap} color={COLORS.opened} />
      </Panel>

      <Panel title="Status no Voalle" subtitle="Situação atual de todos os protocolos.">
        <BarList items={data.snapshot.statusNow.map((s) => ({ key: s.status, count: s.count }))} color={COLORS.neutral} />
      </Panel>
    </div>
  )
}
