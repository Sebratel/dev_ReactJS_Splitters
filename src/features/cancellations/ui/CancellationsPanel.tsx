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
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Home,
  Lightbulb,
  Minus,
  Router,
  Target,
  TrendingDown,
  Zap,
} from 'lucide-react'
import type { IntelligenceRiskRankingRow } from '@/features/intelligence/hooks/useNetworkIntelligenceData'
import { useCancellationsSummary } from '@/features/cancellations/hooks/useCancellationsSummary'
import {
  useCancellationsActiveBase,
  useMassivaImpact,
} from '@/features/cancellations/hooks/useCancellationsExtras'
import { useOnuSummaryBySplitter } from '@/features/onu/hooks/useOnuSummaryBySplitter'
import { CancellationsExplorer } from '@/features/cancellations/ui/CancellationsExplorer'
import {
  CANCELLATION_CATEGORY_LABELS,
  CANCELLATION_CATEGORY_ORDER,
  type CancellationBucket,
  type CancellationCategory,
} from '@/features/cancellations/model/cancellationsSummary'
import {
  aggregateMix,
  bucketMatchesCategories,
  redeCountForCategories,
  sumBucketCategories,
} from '@/features/cancellations/lib/cancellationCategoryFilter'
import { CancellationMotiveFilter } from '@/features/cancellations/ui/CancellationMotiveFilter'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type PeriodPreset = '3m' | '6m' | '12m'
type Dimension = 'accessPoint' | 'splitter' | 'city' | 'condominio'
type TipoFilter = 'all' | 'CONDOMÍNIO' | 'UNIDADE'

const WINDOW_DAYS = 30

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

/** Cancelamentos de rede por 100 clientes ativos. null = sem base para normalizar. */
function ratePer100(count: number, base: number): number | null {
  if (base <= 0) return null
  return (count / base) * 100
}

function fmtRate(rate: number | null): string {
  if (rate == null) return '—'
  return rate.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const idx = Number.parseInt(m ?? '', 10) - 1
  return idx >= 0 && idx < 12 ? `${months[idx]}/${(y ?? '').slice(2)}` : key
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

type CancellationsPanelProps = {
  riskRanking?: IntelligenceRiskRankingRow[]
}

export function CancellationsPanel({ riskRanking }: CancellationsPanelProps = {}) {
  const [preset, setPreset] = useState<PeriodPreset>('6m')
  const [dimension, setDimension] = useState<Dimension>('accessPoint')
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CancellationCategory[]>([])
  const startIso = useMemo(() => startIsoForPreset(preset), [preset])

  const query = useCancellationsSummary(startIso)
  const activeBaseQuery = useCancellationsActiveBase()
  const impactQuery = useMassivaImpact(startIso, WINDOW_DAYS)
  const onuQuery = useOnuSummaryBySplitter()

  const rankingRows = useMemo((): CancellationBucket[] => {
    const data = query.data
    if (!data) return []
    let rows: CancellationBucket[]
    if (dimension === 'splitter') rows = data.bySplitter
    else if (dimension === 'city') rows = data.byCity
    else if (dimension === 'condominio') rows = data.byCondominio
    else rows = data.byAccessPoint
    if (tipoFilter !== 'all' && dimension === 'splitter') {
      rows = rows.filter((r) => (r.tipoLocal ?? 'UNIDADE') === tipoFilter)
    }
    if (categoryFilter.length > 0) {
      rows = rows
        .filter((r) => bucketMatchesCategories(r, categoryFilter))
        .map((r) => ({
          ...r,
          total: sumBucketCategories(r, categoryFilter),
          rede: redeCountForCategories(r, categoryFilter),
        }))
    }
    return rows
  }, [query.data, dimension, tipoFilter, categoryFilter])

  const rankingMotiveCounts = useMemo(() => {
    const data = query.data
    if (!data) return undefined
    let rows: CancellationBucket[]
    if (dimension === 'splitter') rows = data.bySplitter
    else if (dimension === 'city') rows = data.byCity
    else if (dimension === 'condominio') rows = data.byCondominio
    else rows = data.byAccessPoint
    if (tipoFilter !== 'all' && dimension === 'splitter') {
      rows = rows.filter((r) => (r.tipoLocal ?? 'UNIDADE') === tipoFilter)
    }
    return aggregateMix(rows, [])
  }, [query.data, dimension, tipoFilter])

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
  const trend = data.trend
  const sub = data.redeSubmotives
  const conc = data.concentration

  const activeBase = activeBaseQuery.data
  const condoRede = data.byTipoLocal.find((t) => t.key === 'CONDOMÍNIO')?.rede ?? 0
  const ruaRede = data.byTipoLocal.find((t) => t.key === 'UNIDADE')?.rede ?? 0
  const condoTotal = data.byTipoLocal.find((t) => t.key === 'CONDOMÍNIO')?.total ?? 0
  const ruaTotal = data.byTipoLocal.find((t) => t.key === 'UNIDADE')?.total ?? 0
  const condoRate = ratePer100(condoRede, activeBase?.byTipoLocal['CONDOMÍNIO'] ?? 0)
  const ruaRate = ratePer100(ruaRede, activeBase?.byTipoLocal.UNIDADE ?? 0)

  const rateVerdict =
    condoRate != null && ruaRate != null && ruaRate > 0
      ? condoRate > ruaRate
        ? `Condomínios cancelam por rede a uma taxa ${Math.round(((condoRate - ruaRate) / ruaRate) * 100)}% maior que ruas — priorize inspeção de rede interna dos prédios.`
        : condoRate < ruaRate
          ? `Ruas cancelam por rede a uma taxa ${Math.round(((ruaRate - condoRate) / condoRate) * 100)}% maior que condomínios.`
          : 'Condomínios e ruas cancelam por rede em taxas equivalentes.'
      : null

  const impact = impactQuery.data
  const impactRows = (impact?.ranking ?? []).filter((r) => r.redeCount > 0).slice(0, 25)

  // ---- Narrativa "Leitura rápida": interpreta os números em linguagem simples ----
  const periodLabel = preset === '3m' ? '3 meses' : preset === '6m' ? '6 meses' : '12 meses'

  const trendStory: { tone: 'bad' | 'good' | 'neutral'; text: string } =
    trend.deltaPct >= 15
      ? {
          tone: 'bad',
          text: `O churn de rede está subindo: +${trend.deltaPct}% frente aos ${trend.windowDays} dias anteriores. Vale atenção.`,
        }
      : trend.deltaPct <= -15
        ? {
            tone: 'good',
            text: `O churn de rede está caindo: ${trend.deltaPct}% frente aos ${trend.windowDays} dias anteriores.`,
          }
        : {
            tone: 'neutral',
            text: `O churn de rede está estável frente aos ${trend.windowDays} dias anteriores (${trend.deltaPct > 0 ? '+' : ''}${trend.deltaPct}%).`,
          }

  const condoStory =
    rateVerdict ??
    (condoRede === ruaRede
      ? 'Condomínios e ruas puxam o churn de rede de forma parecida.'
      : condoRede > ruaRede
        ? 'Em volume, os condomínios concentram mais churn de rede que as ruas.'
        : 'Em volume, as ruas concentram mais churn de rede que os condomínios.')

  const concStory =
    conc.redeTotal > 0
      ? `${conc.areasFor80pct} área(s) concentram 80% do churn de rede (as 5 maiores já somam ${conc.top5Share}%). É onde focar o esforço.`
      : null

  const massivaStory = impactQuery.isSuccess
    ? impactRows.length > 0
      ? `Em ${impactRows.length} área(s), uma massiva foi seguida de cancelamentos de rede em até ${WINDOW_DAYS} dias — investigue se o evento causou o churn (lista no fim).`
      : `Nenhuma massiva recente foi seguida de churn de rede na janela de ${WINDOW_DAYS} dias — bom sinal.`
    : null

  return (
    <div className="space-y-4">
      {/* Narrativa + período + tendência */}
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
              <p className="mt-0.5 max-w-2xl text-sm leading-snug text-neutral-600">
                {data.total.toLocaleString('pt-BR')} cancelamentos no período · churn de{' '}
                <span className="font-semibold text-rose-700">rede/qualidade</span>:{' '}
                <span className="font-bold text-rose-700">{totalRede.toLocaleString('pt-BR')}</span>{' '}
                ({redeShare}) — insatisfação + concorrência, o churn que a rede influencia.
              </p>
              {/* Tendência */}
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1 text-xs ring-1 ring-rose-200/60">
                {trend.deltaPct > 0 ? (
                  <ArrowUpRight className="size-3.5 text-rose-600" aria-hidden />
                ) : trend.deltaPct < 0 ? (
                  <ArrowDownRight className="size-3.5 text-emerald-600" aria-hidden />
                ) : (
                  <Minus className="size-3.5 text-neutral-400" aria-hidden />
                )}
                <span className="font-semibold text-neutral-700">
                  Churn de rede {trend.deltaPct > 0 ? '+' : ''}
                  {trend.deltaPct}%
                </span>
                <span className="text-neutral-500">
                  nos últimos {trend.windowDays}d ({trend.redeRecent}) vs. {trend.windowDays}d
                  anteriores ({trend.redePrevious})
                </span>
              </div>
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

      {/* Leitura rápida — o "e daí?" em linguagem simples */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
        <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500">
          <Lightbulb className="size-4 text-amber-500" aria-hidden />
          Leitura rápida
          <span className="ml-1 font-medium normal-case tracking-normal text-neutral-400">
            · últimos {periodLabel}
          </span>
        </p>
        <ul className="space-y-2 text-sm leading-snug text-neutral-700">
          <li className="flex items-start gap-2">
            {trendStory.tone === 'bad' ? (
              <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-rose-500" aria-hidden />
            ) : trendStory.tone === 'good' ? (
              <ArrowDownRight className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
            ) : (
              <Minus className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
            )}
            <span>{trendStory.text}</span>
          </li>
          <li className="flex items-start gap-2">
            <Building2 className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden />
            <span>{condoStory}</span>
          </li>
          {concStory ? (
            <li className="flex items-start gap-2">
              <Target className="mt-0.5 size-4 shrink-0 text-neutral-500" aria-hidden />
              <span>{concStory}</span>
            </li>
          ) : null}
          {massivaStory ? (
            <li className="flex items-start gap-2">
              <Zap className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
              <span>{massivaStory}</span>
            </li>
          ) : null}
        </ul>
      </div>

      {/* Condomínio × Rua — distinção central */}
      <p className="pt-1 text-sm font-bold text-neutral-800">
        Condomínio ou rua? <span className="font-normal text-neutral-500">Onde o churn de rede pesa mais</span>
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <TipoLocalCard
          icon={<Building2 className="size-5" aria-hidden />}
          label="Condomínios"
          rede={condoRede}
          total={condoTotal}
          rate={condoRate}
          activeBase={activeBase?.byTipoLocal['CONDOMÍNIO'] ?? null}
          highlight
        />
        <TipoLocalCard
          icon={<Home className="size-5" aria-hidden />}
          label="Ruas / unidades"
          rede={ruaRede}
          total={ruaTotal}
          rate={ruaRate}
          activeBase={activeBase?.byTipoLocal.UNIDADE ?? null}
        />
      </div>
      {rateVerdict ? (
        <p className="flex items-start gap-1.5 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-xs leading-snug text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden />
          {rateVerdict}
        </p>
      ) : activeBaseQuery.isError ? (
        <p className="px-1 text-[11px] text-neutral-400">
          Taxa normalizada indisponível (base ativa não pôde ser carregada).
        </p>
      ) : null}

      {/* Categorias + submotivos de rede */}
      <p className="pt-1 text-sm font-bold text-neutral-800">
        Por que os clientes cancelam?{' '}
        <span className="font-normal text-neutral-500">Motivos agrupados — rede/qualidade em destaque</span>
      </p>
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
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
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
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

        {/* Submotivos de rede */}
        {totalRede > 0 ? (
          <div className="rounded-xl border border-rose-200/70 bg-white p-3 lg:w-56">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Dentro de rede/qualidade
            </p>
            <SubmotiveBar label="Insatisfação (qualidade)" value={sub.insatisfacao} total={totalRede} color="bg-rose-500" />
            <SubmotiveBar label="Foi p/ concorrência (preço)" value={sub.concorrencia} total={totalRede} color="bg-fuchsia-500" />
            {sub.outros > 0 ? (
              <SubmotiveBar label="Outros" value={sub.outros} total={totalRede} color="bg-neutral-300" />
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Concentração (Pareto) */}
      {conc.redeTotal > 0 ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-neutral-200/80 bg-white px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-neutral-800">
            <Router className="size-4 text-neutral-400" aria-hidden />
            Concentração do churn de rede
          </span>
          <span className="text-neutral-600">
            <span className="font-bold text-neutral-900">{conc.areasFor80pct}</span> área(s)
            concentram 80% do churn de rede
          </span>
          <span className="text-neutral-600">
            Top 5 = <span className="font-bold text-rose-700">{conc.top5Share}%</span> do total
          </span>
          <span className="text-[11px] text-neutral-400">de {conc.totalAreas} áreas com churn de rede</span>
        </div>
      ) : null}

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

      {/* Áreas em risco: massiva → churn */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Zap className="size-4 text-amber-500" aria-hidden />
            Áreas em risco — churn de rede após massiva ({WINDOW_DAYS}d)
          </p>
          {impact ? (
            <span className="text-[11px] text-neutral-400">
              {impact.eventsCount.toLocaleString('pt-BR')} eventos analisados
            </span>
          ) : null}
        </div>
        <div className="max-h-[22rem] overflow-auto">
          {impactQuery.isPending ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">Correlacionando massivas…</p>
          ) : impactQuery.isError || impact?.massivaAvailable === false ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">
              Histórico de massivas indisponível — verifique a integração de massivas (MySQL).
              O restante do módulo não depende disso.
            </p>
          ) : impactRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">
              Nenhuma massiva foi seguida de churn de rede na janela — bom sinal. 🎉
            </p>
          ) : (
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-white">
                <tr className="border-b border-neutral-200/90 text-[11px] uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-2.5">Splitter / condomínio</th>
                  <th className="px-3 py-2.5">Tipo</th>
                  <th className="px-3 py-2.5">Última massiva</th>
                  <th className="px-3 py-2.5 text-right">Rede pós-evento</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {impactRows.map((row) => (
                  <tr key={row.splitterTitle} className="hover:bg-neutral-50/70">
                    <td className="px-4 py-2 font-medium text-neutral-900">
                      {row.nomeCondominio ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-rose-400" aria-hidden />
                          {row.nomeCondominio}
                        </span>
                      ) : (
                        row.splitterTitle
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500">
                      {row.tipoLocal === 'CONDOMÍNIO' ? 'Condomínio' : 'Rua'}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500">{fmtDate(row.eventAt)}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-700">
                      {row.redeCount.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-700">
                      {row.totalCount.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Explorador da rede — filtro/drill OLT→Slot→PON→splitter + heatmap + correlações */}
      {riskRanking && riskRanking.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-indigo-200/60 bg-indigo-50/30 p-3">
          <p className="px-1 text-sm font-bold text-neutral-800">
            Explorador da rede{' '}
            <span className="font-normal text-neutral-500">
              — filtre por OLT, Slot, PON, splitter ou motivo de cancelamento
            </span>
          </p>
          <CancellationsExplorer
            riskRanking={riskRanking}
            bySplitter={data.churnBySplitterFull ?? data.bySplitter}
            onuByCode={onuQuery.data}
            massivaImpact={impact?.ranking}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
          />
        </div>
      ) : null}

      {/* Ranking por área */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Router className="size-4 text-neutral-500" aria-hidden />
            Áreas com mais churn de rede
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {dimension === 'splitter' ? (
              <div className="flex items-center gap-1 rounded-lg border border-neutral-200/90 bg-white p-0.5">
                {([
                  { id: 'all', label: 'Todos' },
                  { id: 'CONDOMÍNIO', label: 'Condo' },
                  { id: 'UNIDADE', label: 'Rua' },
                ] as Array<{ id: TipoFilter; label: string }>).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTipoFilter(opt.id)}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                      tipoFilter === opt.id ? 'bg-rose-600 text-white' : 'text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex items-center gap-1 rounded-lg border border-neutral-200/90 bg-white p-0.5">
              {([
                { id: 'accessPoint', label: 'Ponto de acesso' },
                { id: 'condominio', label: 'Condomínio' },
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
        </div>
        <div className="border-b border-neutral-100 px-4 py-3">
          <CancellationMotiveFilter
            selected={categoryFilter}
            onChange={setCategoryFilter}
            counts={rankingMotiveCounts}
          />
        </div>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-white">
              <tr className="border-b border-neutral-200/90 text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5">{dimension === 'condominio' ? 'Condomínio' : 'Área'}</th>
                {dimension === 'splitter' ? <th className="px-3 py-2.5">Slot/PON</th> : null}
                <th className="px-3 py-2.5 text-right">Rede</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5 text-right">% rede</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rankingRows
                .slice(0, 50)
                .sort((a, b) =>
                  categoryFilter.length === 0 || categoryFilter.includes('rede')
                    ? b.rede - a.rede || b.total - a.total
                    : b.total - a.total || b.rede - a.rede,
                )
                .map((row) => (
                <tr key={row.key} className="hover:bg-neutral-50/70">
                  <td className="px-4 py-2 font-medium text-neutral-900">{row.key}</td>
                  {dimension === 'splitter' ? (
                    <td className="px-3 py-2 font-mono text-[12px] text-neutral-600">
                      {row.slot != null && row.pon != null ? `${row.slot} / ${row.pon}` : '—'}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-700">
                    {row.rede > 0 ? row.rede.toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-700">
                    {row.total.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                    {row.rede > 0 ? pct(row.rede, row.total) : '—'}
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
        "Rede/Qualidade" = insatisfação com o serviço + migração para a concorrência — o churn que
        uma manutenção pode influenciar. A taxa normaliza pelo nº de clientes ativos, permitindo
        comparar áreas de tamanhos diferentes.
      </p>
    </div>
  )
}

function TipoLocalCard({
  icon,
  label,
  rede,
  total,
  rate,
  activeBase,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  rede: number
  total: number
  rate: number | null
  activeBase: number | null
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight ? 'border-rose-300 bg-rose-50/60' : 'border-neutral-200/80 bg-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex size-8 items-center justify-center rounded-lg ${
            highlight ? 'bg-rose-100 text-rose-600' : 'bg-neutral-100 text-neutral-500'
          }`}
        >
          {icon}
        </span>
        <p className="text-sm font-semibold text-neutral-800">{label}</p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tabular-nums text-rose-700">
            {rede.toLocaleString('pt-BR')}
          </p>
          <p className="text-[11px] text-neutral-500">
            cancelam. de rede · {pct(rede, total)} do churn desta base
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-neutral-900">{fmtRate(rate)}</p>
          <p className="text-[10px] text-neutral-400">por 100 ativos</p>
        </div>
      </div>
      {activeBase != null && activeBase > 0 ? (
        <p className="mt-1 text-[10px] text-neutral-400">
          base ativa: {activeBase.toLocaleString('pt-BR')} clientes
        </p>
      ) : null}
    </div>
  )
}

function SubmotiveBar({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const width = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-neutral-600">{label}</span>
        <span className="font-semibold tabular-nums text-neutral-800">
          {value.toLocaleString('pt-BR')} ({width}%)
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}
