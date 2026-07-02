import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Building2,
  Gauge,
  Lightbulb,
  Router,
  ShieldAlert,
  Target,
  TrendingDown,
  Zap,
} from 'lucide-react'
import type { IntelligenceRiskRankingRow } from '@/features/intelligence/hooks/useNetworkIntelligenceData'
import { useCancellationsSummary } from '@/features/cancellations/hooks/useCancellationsSummary'
import { useCancellationsActiveBase } from '@/features/cancellations/hooks/useCancellationsExtras'
import { useOnuSummaryBySplitter } from '@/features/onu/hooks/useOnuSummaryBySplitter'

type CondominiumsPanelProps = {
  riskRanking: IntelligenceRiskRankingRow[]
}

type CondoRow = {
  nome: string
  splitters: number
  cities: string[]
  activeClients: number
  avgUsage: number
  saturatedSplitters: number
  avgRisk: number
  criticalSplitters: number
  openTickets: number
  totalTickets: number
  affectedClients: number
  avgAge: number
  avgDelta: number
  redeChurn: number
  totalChurn: number
  onuTotal: number
  onuOnline: number
  onuDegraded: number
  onuOffline: number
}

type View = 'saturacao' | 'churn' | 'massivas' | 'risco' | 'sinal'

/** Faixas de ocupação para a distribuição da rede de condomínios. */
const USAGE_BANDS = [
  { key: 'baixa', label: '< 50%', min: 0, max: 50, color: 'bg-emerald-400' },
  { key: 'media', label: '50–70%', min: 50, max: 70, color: 'bg-sky-400' },
  { key: 'alta', label: '70–85%', min: 70, max: 85, color: 'bg-amber-400' },
  { key: 'saturada', label: '≥ 85%', min: 85, max: Infinity, color: 'bg-rose-500' },
] as const

/** Share de sinal degradado+offline a partir do qual um condomínio é "sinal crítico". */
const SIGNAL_PROBLEM_THRESHOLD = 15

/** % de ONUs com sinal degradado ou offline no condomínio; null se sem leitura. */
function signalProblemPct(c: CondoRow): number | null {
  return c.onuTotal > 0 ? ((c.onuDegraded + c.onuOffline) / c.onuTotal) * 100 : null
}

const SATURATION_THRESHOLD = 85

function startIso12mAgo(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 12)
  return d.toISOString().slice(0, 10)
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR')
}

function fmt1(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function CondominiumsPanel({ riskRanking }: CondominiumsPanelProps) {
  const [view, setView] = useState<View>('saturacao')
  const startIso = useMemo(startIso12mAgo, [])
  const summaryQuery = useCancellationsSummary(startIso)
  const activeBaseQuery = useCancellationsActiveBase()
  const onuQuery = useOnuSummaryBySplitter()

  const condos = useMemo((): CondoRow[] => {
    const churnByName = new Map<string, { rede: number; total: number }>()
    for (const b of summaryQuery.data?.byCondominio ?? []) {
      churnByName.set(b.key, { rede: b.rede, total: b.total })
    }
    const activeByName = activeBaseQuery.data?.byCondominio ?? {}
    const onuByCode = onuQuery.data

    type Acc = {
      splitters: number
      usageSum: number
      saturatedSplitters: number
      riskSum: number
      criticalSplitters: number
      openTickets: number
      totalTickets: number
      affectedClients: number
      ageSum: number
      deltaSum: number
      cities: Set<string>
      onuTotal: number
      onuOnline: number
      onuDegraded: number
      onuOffline: number
    }
    const map = new Map<string, Acc>()
    for (const r of riskRanking) {
      if (r.tipoLocal !== 'CONDOMÍNIO') continue
      const nome = r.nomeCondominio?.trim()
      if (!nome) continue
      let c = map.get(nome)
      if (!c) {
        c = {
          splitters: 0, usageSum: 0, saturatedSplitters: 0, riskSum: 0, criticalSplitters: 0,
          openTickets: 0, totalTickets: 0, affectedClients: 0, ageSum: 0, deltaSum: 0, cities: new Set(),
          onuTotal: 0, onuOnline: 0, onuDegraded: 0, onuOffline: 0,
        }
        map.set(nome, c)
      }
      c.splitters += 1
      c.usageSum += r.currentUsagePercent
      if (r.currentUsagePercent >= SATURATION_THRESHOLD) c.saturatedSplitters += 1
      c.riskSum += r.riskScore
      if (r.riskBand === 'critico') c.criticalSplitters += 1
      c.openTickets += r.openTickets
      c.totalTickets += r.totalTickets
      c.affectedClients += r.affectedClientsTotal
      c.ageSum += r.ageYears
      c.deltaSum += r.selectedDelta
      if (r.cityCadastro) c.cities.add(r.cityCadastro)
      const onu = onuByCode?.get(r.splitterCode)
      if (onu) {
        c.onuTotal += onu.total
        c.onuOnline += onu.online
        c.onuDegraded += onu.degraded
        c.onuOffline += onu.offline
      }
    }
    return [...map.entries()].map(([nome, c]) => {
      const churn = churnByName.get(nome)
      return {
        nome,
        splitters: c.splitters,
        cities: [...c.cities],
        activeClients: activeByName[nome] ?? 0,
        avgUsage: c.splitters > 0 ? c.usageSum / c.splitters : 0,
        saturatedSplitters: c.saturatedSplitters,
        avgRisk: c.splitters > 0 ? c.riskSum / c.splitters : 0,
        criticalSplitters: c.criticalSplitters,
        openTickets: c.openTickets,
        totalTickets: c.totalTickets,
        affectedClients: c.affectedClients,
        avgAge: c.splitters > 0 ? c.ageSum / c.splitters : 0,
        avgDelta: c.splitters > 0 ? c.deltaSum / c.splitters : 0,
        redeChurn: churn?.rede ?? 0,
        totalChurn: churn?.total ?? 0,
        onuTotal: c.onuTotal,
        onuOnline: c.onuOnline,
        onuDegraded: c.onuDegraded,
        onuOffline: c.onuOffline,
      }
    })
  }, [riskRanking, summaryQuery.data, activeBaseQuery.data, onuQuery.data])

  const totals = useMemo(() => {
    const splitters = condos.reduce((s, c) => s + c.splitters, 0)
    const usageSum = condos.reduce((s, c) => s + c.avgUsage * c.splitters, 0)
    const avgUsage = splitters > 0 ? usageSum / splitters : 0
    const saturatedCondos = condos.filter((c) => c.avgUsage >= SATURATION_THRESHOLD).length
    const churnCondos = condos.filter((c) => c.redeChurn > 0).length
    const doubleTrouble = condos.filter((c) => c.avgUsage >= SATURATION_THRESHOLD && c.redeChurn > 0)
    const withMassivas = condos.filter((c) => c.totalTickets > 0).length
    const onuHasData = condos.some((c) => c.onuTotal > 0)
    const signalCritical = condos.filter((c) => {
      const p = c.onuTotal > 0 ? ((c.onuDegraded + c.onuOffline) / c.onuTotal) * 100 : null
      return p != null && p >= SIGNAL_PROBLEM_THRESHOLD
    })
    const distribution = USAGE_BANDS.map((band) => ({
      ...band,
      count: condos.filter((c) => c.avgUsage >= band.min && c.avgUsage < band.max).length,
    }))
    return {
      splitters, avgUsage, saturatedCondos, churnCondos, doubleTrouble, withMassivas,
      onuHasData, signalCritical, distribution,
    }
  }, [condos])

  const activeBase = activeBaseQuery.data
  const condoActive = activeBase?.byTipoLocal['CONDOMÍNIO'] ?? 0
  const ruaActive = activeBase?.byTipoLocal.UNIDADE ?? 0
  const baseShare = condoActive + ruaActive > 0 ? Math.round((condoActive / (condoActive + ruaActive)) * 100) : 0

  const rankedRows = useMemo(() => {
    const rows = [...condos]
    if (view === 'saturacao') rows.sort((a, b) => b.avgUsage - a.avgUsage || b.splitters - a.splitters)
    else if (view === 'churn') rows.sort((a, b) => b.redeChurn - a.redeChurn || b.totalChurn - a.totalChurn)
    else if (view === 'massivas') rows.sort((a, b) => b.totalTickets - a.totalTickets || b.affectedClients - a.affectedClients)
    else if (view === 'sinal') {
      rows.sort((a, b) => {
        const pa = signalProblemPct(a) ?? -1
        const pb = signalProblemPct(b) ?? -1
        return pb - pa || (b.onuOffline - a.onuOffline)
      })
    } else rows.sort((a, b) => b.avgRisk - a.avgRisk || b.criticalSplitters - a.criticalSplitters)
    return rows.slice(0, 60)
  }, [condos, view])

  if (condos.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-8 text-center text-sm text-neutral-500">
        Nenhum condomínio identificado no recorte atual da rede.
      </div>
    )
  }

  const usageTone = (u: number) =>
    u >= 90 ? 'text-rose-700' : u >= SATURATION_THRESHOLD ? 'text-amber-700' : 'text-neutral-800'

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 to-white p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200/70">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold tracking-tight text-neutral-900">Condomínios na rede</p>
            <p className="mt-0.5 max-w-2xl text-sm leading-snug text-neutral-600">
              {condos.length.toLocaleString('pt-BR')} condomínios · {fmt(totals.splitters)} splitters ·{' '}
              {condoActive > 0 ? `${fmt(condoActive)} clientes ativos ` : ''}
              {baseShare > 0 ? <span className="font-semibold text-indigo-700">({baseShare}% da base)</span> : null}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${totals.onuHasData ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
        <Kpi label="Condomínios" value={condos.length.toLocaleString('pt-BR')} />
        <Kpi label="Splitters" value={fmt(totals.splitters)} />
        <Kpi label="Ocupação média" value={`${fmt1(totals.avgUsage)}%`} tone={totals.avgUsage >= SATURATION_THRESHOLD ? 'warn' : undefined} />
        <Kpi label="Saturados (≥85%)" value={totals.saturatedCondos.toLocaleString('pt-BR')} tone={totals.saturatedCondos > 0 ? 'warn' : undefined} />
        <Kpi label="Com churn de rede" value={totals.churnCondos.toLocaleString('pt-BR')} tone={totals.churnCondos > 0 ? 'danger' : undefined} />
        {totals.onuHasData ? (
          <Kpi label="Sinal crítico" value={totals.signalCritical.length.toLocaleString('pt-BR')} tone={totals.signalCritical.length > 0 ? 'danger' : undefined} />
        ) : null}
      </div>

      {/* Distribuição por faixa de ocupação */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-neutral-800">Distribuição por ocupação</p>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100">
          {totals.distribution.map((band) =>
            band.count > 0 ? (
              <div
                key={band.key}
                className={band.color}
                style={{ width: `${(band.count / condos.length) * 100}%` }}
                title={`${band.label}: ${band.count} condomínio(s)`}
              />
            ) : null,
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {totals.distribution.map((band) => (
            <span key={band.key} className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
              <span className={`size-2 rounded-full ${band.color}`} aria-hidden />
              {band.label}: <span className="font-semibold tabular-nums text-neutral-800">{band.count}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Leitura rápida */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
        <p className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500">
          <Lightbulb className="size-4 text-amber-500" aria-hidden />
          Leitura rápida
        </p>
        <ul className="space-y-2 text-sm leading-snug text-neutral-700">
          <li className="flex items-start gap-2">
            <Gauge className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
            <span>
              <span className="font-semibold text-neutral-900">{totals.saturatedCondos}</span> condomínio(s)
              estão saturados (ocupação média ≥ {SATURATION_THRESHOLD}%) — candidatos a expansão de porta.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <TrendingDown className="mt-0.5 size-4 shrink-0 text-rose-500" aria-hidden />
            <span>
              <span className="font-semibold text-neutral-900">{totals.churnCondos}</span> condomínio(s)
              têm churn de rede (insatisfação/concorrência) nos últimos 12 meses — possível problema de
              qualidade percebida.
            </span>
          </li>
          {totals.doubleTrouble.length > 0 ? (
            <li className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose-600" aria-hidden />
              <span>
                <span className="font-bold text-rose-700">
                  {totals.doubleTrouble.length} condomínio(s) em prioridade máxima
                </span>
                : saturados <em>e</em> com churn de rede ({totals.doubleTrouble.slice(0, 3).map((c) => c.nome).join(', ')}
                {totals.doubleTrouble.length > 3 ? '…' : ''}).
              </span>
            </li>
          ) : null}
          {totals.withMassivas > 0 ? (
            <li className="flex items-start gap-2">
              <Zap className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
              <span>
                <span className="font-semibold text-neutral-900">{totals.withMassivas}</span> condomínio(s)
                tiveram massivas no período — cruze com o churn abaixo.
              </span>
            </li>
          ) : null}
          {totals.onuHasData && totals.signalCritical.length > 0 ? (
            <li className="flex items-start gap-2">
              <Activity className="mt-0.5 size-4 shrink-0 text-rose-500" aria-hidden />
              <span>
                <span className="font-semibold text-neutral-900">{totals.signalCritical.length}</span>{' '}
                condomínio(s) com sinal ONU degradado/offline acima de {SIGNAL_PROBLEM_THRESHOLD}% —
                monitore antes que vire churn.
              </span>
            </li>
          ) : null}
        </ul>
      </div>

      {/* Ranking */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Router className="size-4 text-neutral-500" aria-hidden />
            Ranking de condomínios
          </p>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-neutral-200/90 bg-white p-0.5">
            {([
              { id: 'saturacao', label: 'Saturação' },
              { id: 'churn', label: 'Churn de rede' },
              { id: 'massivas', label: 'Massivas' },
              { id: 'risco', label: 'Risco' },
              ...(totals.onuHasData ? [{ id: 'sinal' as const, label: 'Sinal ONU' }] : []),
            ] as Array<{ id: View; label: string }>).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setView(opt.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  view === opt.id ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-white">
              <tr className="border-b border-neutral-200/90 text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5">Condomínio</th>
                <th className="px-3 py-2.5 text-right">Splitters</th>
                <th className="px-3 py-2.5 text-right">Clientes</th>
                {view === 'saturacao' ? (
                  <>
                    <th className="px-3 py-2.5 text-right">Ocup. média</th>
                    <th className="px-3 py-2.5 text-right">Saturados</th>
                  </>
                ) : null}
                {view === 'churn' ? (
                  <>
                    <th className="px-3 py-2.5 text-right">Churn rede</th>
                    <th className="px-3 py-2.5 text-right">Churn total</th>
                  </>
                ) : null}
                {view === 'massivas' ? (
                  <>
                    <th className="px-3 py-2.5 text-right">Massivas</th>
                    <th className="px-3 py-2.5 text-right">Afetados</th>
                  </>
                ) : null}
                {view === 'risco' ? (
                  <>
                    <th className="px-3 py-2.5 text-right">Score médio</th>
                    <th className="px-3 py-2.5 text-right">Críticos</th>
                  </>
                ) : null}
                {view === 'sinal' ? (
                  <>
                    <th className="px-3 py-2.5 text-right">Deg.+off.</th>
                    <th className="px-3 py-2.5 text-right">Offline</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rankedRows.map((c) => {
                const doubleTrouble = c.avgUsage >= SATURATION_THRESHOLD && c.redeChurn > 0
                return (
                  <tr key={c.nome} className="hover:bg-neutral-50/70">
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5 font-medium text-neutral-900">
                        <Building2 className="size-3.5 text-indigo-400" aria-hidden />
                        {c.nome}
                        {doubleTrouble ? (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700"
                            title="Saturado e com churn de rede"
                          >
                            <AlertTriangle className="size-2.5" aria-hidden />
                            prioridade
                          </span>
                        ) : null}
                      </span>
                      {c.cities.length > 0 ? (
                        <span className="ml-5 block text-[10px] text-neutral-400">{c.cities.join(' · ')}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-700">{c.splitters}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-700">
                      {c.activeClients > 0 ? fmt(c.activeClients) : '—'}
                    </td>
                    {view === 'saturacao' ? (
                      <>
                        <td className={`px-3 py-2 text-right font-bold tabular-nums ${usageTone(c.avgUsage)}`}>
                          {fmt1(c.avgUsage)}%
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                          {c.saturatedSplitters}/{c.splitters}
                        </td>
                      </>
                    ) : null}
                    {view === 'churn' ? (
                      <>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-700">
                          {c.redeChurn > 0 ? fmt(c.redeChurn) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                          {c.totalChurn > 0 ? fmt(c.totalChurn) : '—'}
                        </td>
                      </>
                    ) : null}
                    {view === 'massivas' ? (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-800">
                          {c.totalTickets > 0 ? `${c.openTickets} / ${c.totalTickets}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                          {c.affectedClients > 0 ? fmt(c.affectedClients) : '—'}
                        </td>
                      </>
                    ) : null}
                    {view === 'risco' ? (
                      <>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-neutral-900">
                          {fmt(c.avgRisk)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-700">
                          {c.criticalSplitters > 0 ? c.criticalSplitters : '—'}
                        </td>
                      </>
                    ) : null}
                    {view === 'sinal' ? (
                      (() => {
                        const p = signalProblemPct(c)
                        return (
                          <>
                            <td
                              className={`px-3 py-2 text-right font-bold tabular-nums ${
                                p != null && p >= SIGNAL_PROBLEM_THRESHOLD ? 'text-rose-700' : 'text-neutral-700'
                              }`}
                            >
                              {p != null ? `${fmt1(p)}%` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                              {c.onuTotal > 0 ? c.onuOffline : '—'}
                            </td>
                          </>
                        )
                      })()
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-400">
          <Target className="size-3.5" aria-hidden />
          {view === 'saturacao'
            ? 'Ocupação média das portas dos splitters do condomínio. ≥85% = candidato a expansão.'
            : view === 'churn'
              ? 'Cancelamentos de rede/qualidade (insatisfação + concorrência) nos últimos 12 meses.'
              : view === 'massivas'
                ? 'Massivas (abertas/total) e clientes afetados registrados no período.'
                : view === 'sinal'
                  ? 'Sinal ONU quase em tempo real: % de ONUs degradadas/offline e nº offline no condomínio.'
                  : 'Score de risco médio dos splitters do condomínio (ocupação + variação + massivas).'}
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'danger' }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        tone === 'danger'
          ? 'border-rose-300 bg-rose-50/70'
          : tone === 'warn'
            ? 'border-amber-300 bg-amber-50/70'
            : 'border-neutral-200/80 bg-white'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums ${
          tone === 'danger' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : 'text-neutral-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
