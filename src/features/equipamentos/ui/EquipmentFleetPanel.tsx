import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  Boxes,
  Router,
  Cpu,
  HardDrive,
  AlertTriangle,
  RefreshCw,
  Users,
  Layers,
  Fingerprint,
  HeartPulse,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useEquipmentOverview } from '@/features/equipamentos/hooks/useEquipmentOverview'
import {
  aggregateByType,
  buildModelPareto,
  EQUIPMENT_TYPE_LABEL,
  type EquipmentType,
} from '@/features/equipamentos/model/equipmentOverview'
import { useOnuSignalByModel } from '@/features/onu/hooks/useOnuSignalByModel'
import {
  analyzeOnuSignalByModel,
  type OnuModelSignalAnalyzed,
} from '@/features/onu/model/onuSignalByModel'

function fmtInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

function fmtPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

const TYPE_COLOR: Record<EquipmentType, string> = {
  onu: '#10b981',
  roteador: '#6366f1',
  outros: '#94a3b8',
}

const TYPE_ICON: Record<EquipmentType, typeof Cpu> = {
  onu: Cpu,
  roteador: Router,
  outros: HardDrive,
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Boxes
  tone?: 'neutral' | 'emerald' | 'amber' | 'rose' | 'primary'
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-700'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/60 text-amber-700'
        : tone === 'rose'
          ? 'border-rose-200 bg-rose-50/60 text-rose-700'
          : tone === 'primary'
            ? 'border-primary/20 bg-primary/[0.06] text-primary'
            : 'border-outline-variant bg-white text-on-surface-variant'
  return (
    <div className={cn('rounded-2xl border p-4 shadow-sm', toneClass)}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-80">
        <Icon size={13} strokeWidth={2} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums leading-none text-on-surface">{value}</p>
      {hint ? <p className="mt-1.5 text-[11px] leading-snug opacity-80">{hint}</p> : null}
    </div>
  )
}

/** Barra horizontal de ranking, com largura proporcional ao máximo. */
function RankBar({
  label,
  sub,
  count,
  max,
  colorClass = 'bg-primary',
}: {
  label: string
  sub?: string
  count: number
  max: number
  colorClass?: string
}) {
  const width = max > 0 ? Math.max(2, (count / max) * 100) : 0
  return (
    <li className="group">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] font-semibold text-on-surface" title={label}>
          {label}
          {sub ? <span className="ml-1.5 font-normal text-on-surface-variant/55">{sub}</span> : null}
        </span>
        <span className="shrink-0 text-[12px] font-bold tabular-nums text-on-surface-variant">
          {fmtInt(count)}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full', colorClass)} style={{ width: `${width}%` }} />
      </div>
    </li>
  )
}

function fmtDbm(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} dBm`
}

/** Linha de modelo com barra empilhada online/atenuado/offline + métricas. */
function SignalModelRow({ row }: { row: OnuModelSignalAnalyzed }) {
  const onlinePct = row.total > 0 ? (row.online / row.total) * 100 : 0
  const degradedPct = row.total > 0 ? (row.degraded / row.total) * 100 : 0
  const offlinePct = row.total > 0 ? (row.offline / row.total) * 100 : 0
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold text-on-surface" title={row.model}>
            {row.model}
          </span>
          {row.isOutlier ? (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-700"
              title="Atenuação acima de 1,5× a média da rede, com volume relevante"
            >
              <AlertTriangle size={9} strokeWidth={2.5} />
              Atípico
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-on-surface-variant/70">
          {fmtInt(row.total)} ONUs · RX {fmtDbm(row.avgRx)}
        </span>
      </div>
      <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-emerald-500" style={{ width: `${onlinePct}%` }} title={`Online: ${fmtPct(onlinePct)}`} />
        <div className="h-full bg-amber-500" style={{ width: `${degradedPct}%` }} title={`Atenuado: ${fmtPct(degradedPct)}`} />
        <div className="h-full bg-rose-500" style={{ width: `${offlinePct}%` }} title={`Offline: ${fmtPct(offlinePct)}`} />
      </div>
      <div className="mt-1 flex items-center gap-3 text-[10px] font-semibold tabular-nums">
        <span className="text-amber-600">{fmtPct(row.degradedRate * 100)} atenuado</span>
        <span className="text-rose-500">{fmtPct(row.offlineRate * 100)} offline</span>
      </div>
    </li>
  )
}

export function EquipmentFleetPanel() {
  const query = useEquipmentOverview()
  const data = query.data
  const [modelLimit, setModelLimit] = useState(12)

  const signalQuery = useOnuSignalByModel()
  const signalInsights = useMemo(
    () => analyzeOnuSignalByModel(signalQuery.data),
    [signalQuery.data],
  )

  const derived = useMemo(() => {
    if (!data) return null
    const pareto = buildModelPareto(data.byModel)
    const byType = aggregateByType(data.byModel)
    // Quantos modelos no topo cobrem 80% do parque (concentração de Pareto).
    let modelsTo80 = 0
    for (const row of pareto) {
      modelsTo80 += 1
      if (row.cumulativeShare >= 80) break
    }
    const top = pareto[0] ?? null
    const total = data.totals.totalPatrimonies
    const serialCoverage = total > 0 ? ((total - data.totals.withoutSerial) / total) * 100 : 0
    const macCoverage = total > 0 ? ((total - data.totals.withoutMac) / total) * 100 : 0
    // Status que indicam contrato não-ativo mas com equipamento ainda vinculado.
    const nonActive = data.byContractStatus
      .filter((s) => {
        const k = s.status.toLowerCase()
        return !k.includes('ativo') && !k.includes('sem status')
      })
      .reduce((sum, s) => sum + s.count, 0)
    return { pareto, byType, modelsTo80, top, total, serialCoverage, macCoverage, nonActive }
  }, [data])

  if (query.isPending) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-slate-50/80 py-10 text-center text-sm text-slate-500">
        Carregando frota de equipamentos…
      </p>
    )
  }

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-8 text-center text-sm text-rose-700">
        <AlertTriangle className="mx-auto mb-2" size={20} />
        Não foi possível carregar os equipamentos.
        <button
          type="button"
          onClick={() => query.refetch()}
          className="ml-2 font-semibold underline underline-offset-2"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!data || !derived || derived.total === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 py-10 text-center text-sm text-slate-500">
        Nenhum equipamento ativo encontrado no cadastro.
      </p>
    )
  }

  const { totals } = data
  const maxModel = derived.pareto[0]?.count ?? 0
  const typeTotal = derived.byType.reduce((s, t) => s + t.count, 0)
  const visibleModels = derived.pareto.slice(0, modelLimit)

  return (
    <div className="space-y-5">
      {/* ── Ato 1: dimensão da frota + narrativa ────────────────────────── */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Boxes size={16} className="text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-primary">
              Parque de equipamentos
            </h3>
          </div>
          {query.isFetching ? (
            <RefreshCw size={14} className="animate-spin text-primary/50" aria-label="Atualizando" />
          ) : null}
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-on-surface-variant">
          A rede tem <span className="font-semibold text-on-surface">{fmtInt(totals.totalPatrimonies)}</span>{' '}
          equipamentos ativos em <span className="font-semibold text-on-surface">{fmtInt(totals.distinctClients)}</span>{' '}
          clientes, somando <span className="font-semibold text-on-surface">{fmtInt(totals.distinctModels)}</span>{' '}
          modelos distintos.{' '}
          {derived.top ? (
            <>
              O modelo mais presente é{' '}
              <span className="font-semibold text-on-surface">{derived.top.model}</span>{' '}
              ({fmtPct(derived.top.share)} do parque), e os{' '}
              <span className="font-semibold text-on-surface">{derived.modelsTo80}</span> modelos no topo já
              cobrem <span className="font-semibold">80%</span> da base —{' '}
              {derived.modelsTo80 <= 5 ? 'parque concentrado' : 'parque pulverizado'}.
            </>
          ) : null}{' '}
          Cobertura de cadastro:{' '}
          <span className={cn('font-semibold', derived.serialCoverage >= 90 ? 'text-emerald-600' : 'text-amber-600')}>
            {fmtPct(derived.serialCoverage, 0)} com serial
          </span>{' '}
          ·{' '}
          <span className={cn('font-semibold', derived.macCoverage >= 90 ? 'text-emerald-600' : 'text-amber-600')}>
            {fmtPct(derived.macCoverage, 0)} com MAC
          </span>.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Equipamentos" value={fmtInt(totals.totalPatrimonies)} icon={Boxes} tone="primary" />
          <KpiCard label="Clientes equipados" value={fmtInt(totals.distinctClients)} icon={Users} />
          <KpiCard label="Modelos distintos" value={fmtInt(totals.distinctModels)} icon={Layers} />
          <KpiCard
            label="Cobertura serial"
            value={fmtPct(derived.serialCoverage, 0)}
            hint={`${fmtInt(totals.withoutSerial)} sem serial`}
            icon={Fingerprint}
            tone={derived.serialCoverage >= 90 ? 'emerald' : 'amber'}
          />
          <KpiCard
            label="Cobertura MAC"
            value={fmtPct(derived.macCoverage, 0)}
            hint={`${fmtInt(totals.withoutMac)} sem MAC`}
            icon={Fingerprint}
            tone={derived.macCoverage >= 90 ? 'emerald' : 'amber'}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ── Ato 2a: ranking de modelos (Pareto) ───────────────────────── */}
        <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
              <Layers size={15} className="text-primary" />
              Modelos mais presentes
            </h3>
            <span className="text-[11px] text-on-surface-variant/60">
              top {Math.min(modelLimit, derived.pareto.length)} de {fmtInt(derived.pareto.length)}
            </span>
          </div>
          <ul className="mt-4 space-y-3">
            {visibleModels.map((row) => (
              <RankBar
                key={row.model}
                label={row.model}
                sub={`${fmtPct(row.share)} · acum. ${fmtPct(row.cumulativeShare, 0)}`}
                count={row.count}
                max={maxModel}
              />
            ))}
          </ul>
          {derived.pareto.length > 12 ? (
            <button
              type="button"
              onClick={() => setModelLimit((v) => (v >= derived.pareto.length ? 12 : v + 18))}
              className="mt-4 text-[12px] font-semibold text-primary underline underline-offset-2"
            >
              {modelLimit >= derived.pareto.length ? 'Mostrar menos' : 'Mostrar mais modelos'}
            </button>
          ) : null}
        </div>

        {/* ── Ato 2b: composição por tipo (donut) ───────────────────────── */}
        <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
            <Router size={15} className="text-primary" />
            Composição por tipo
          </h3>
          <div className="mt-2 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={derived.byType}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {derived.byType.map((entry) => (
                    <Cell key={entry.type} fill={TYPE_COLOR[entry.type]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 10, borderColor: '#e5e7eb', fontSize: 12 }}
                  formatter={(value: unknown, _name: unknown, item: unknown) => {
                    const t = (item as { payload?: { type?: EquipmentType } })?.payload?.type
                    const n = Number(value ?? 0)
                    const share = typeTotal > 0 ? (n / typeTotal) * 100 : 0
                    return [`${fmtInt(n)} (${fmtPct(share)})`, t ? EQUIPMENT_TYPE_LABEL[t] : '']
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {derived.byType.map((entry) => {
              const Icon = TYPE_ICON[entry.type]
              const share = typeTotal > 0 ? (entry.count / typeTotal) * 100 : 0
              return (
                <li key={entry.type} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="flex items-center gap-1.5 font-semibold text-on-surface">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: TYPE_COLOR[entry.type] }}
                    />
                    <Icon size={13} className="text-on-surface-variant/60" />
                    {EQUIPMENT_TYPE_LABEL[entry.type]}
                  </span>
                  <span className="tabular-nums text-on-surface-variant">
                    {fmtInt(entry.count)} <span className="text-on-surface-variant/55">({fmtPct(share, 0)})</span>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-[10px] leading-snug text-on-surface-variant/55">
            Tipo inferido da descrição do equipamento — útil como panorama, não como inventário fiscal.
          </p>
        </div>
      </div>

      {/* ── Ato 3 (estrela): saúde de sinal por modelo de ONU ───────────── */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.05] to-transparent p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
            <HeartPulse size={15} className="text-primary" />
            Saúde de sinal por modelo de ONU
          </h3>
          {signalQuery.isFetching ? (
            <RefreshCw size={14} className="animate-spin text-primary/50" aria-label="Atualizando" />
          ) : null}
        </div>

        {signalQuery.isPending ? (
          <p className="mt-4 text-sm text-on-surface-variant/70">Consultando monitoramento das ONUs…</p>
        ) : !signalInsights ? (
          <p className="mt-4 text-sm text-on-surface-variant/70">
            Monitoramento de ONU indisponível — sem dados de sinal por modelo.
          </p>
        ) : (
          <>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-on-surface-variant">
              De <span className="font-semibold text-on-surface">{fmtInt(signalInsights.monitored)}</span> ONUs
              monitoradas, <span className="font-semibold text-emerald-600">{fmtPct(signalInsights.healthyRate * 100, 0)}</span>{' '}
              operam saudáveis. A média da rede é de{' '}
              <span className="font-semibold text-amber-600">{fmtPct(signalInsights.networkDegradedRate * 100)}</span>{' '}
              de clientes atenuados.{' '}
              {signalInsights.worstByDegraded[0] && signalInsights.worstByDegraded[0].isOutlier ? (
                <>
                  O modelo{' '}
                  <span className="font-semibold text-on-surface">{signalInsights.worstByDegraded[0].model}</span>{' '}
                  é o mais crítico: <span className="font-semibold text-amber-600">
                    {fmtPct(signalInsights.worstByDegraded[0].degradedRate * 100)}
                  </span>{' '}
                  dos seus clientes estão atenuados —{' '}
                  {(signalInsights.worstByDegraded[0].degradedRate / Math.max(signalInsights.networkDegradedRate, 0.0001)).toFixed(1)}× a média.
                  Vale auditar o parque desse modelo.
                </>
              ) : (
                <>Nenhum modelo com volume relevante destoa fortemente da média — o sinal ruim está distribuído, não concentrado num equipamento.</>
              )}
            </p>

            <ul className="mt-4 grid gap-x-8 gap-y-3.5 lg:grid-cols-2">
              {signalInsights.worstByDegraded.map((row) => (
                <SignalModelRow key={row.model} row={row} />
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-semibold text-on-surface-variant/65">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Online</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Atenuado</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Offline</span>
              <span className="font-normal text-on-surface-variant/55">
                Ranking pelos modelos com maior taxa de atenuação (mín. {fmtInt(signalInsights.minVolume)} ONUs). Offline inclui quedas de energia.
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Ato 4: qualidade de cadastro / ações ────────────────────────── */}
      <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
          <Fingerprint size={15} className="text-primary" />
          Qualidade de cadastro
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Sem serial"
            value={fmtInt(totals.withoutSerial)}
            hint="equipamentos sem nº de série"
            icon={Fingerprint}
            tone={totals.withoutSerial > 0 ? 'amber' : 'emerald'}
          />
          <KpiCard
            label="Sem MAC"
            value={fmtInt(totals.withoutMac)}
            hint="equipamentos sem MAC"
            icon={Fingerprint}
            tone={totals.withoutMac > 0 ? 'amber' : 'emerald'}
          />
          <KpiCard
            label="MACs duplicados"
            value={fmtInt(totals.duplicateMacGroups)}
            hint={`${fmtInt(totals.duplicateMacUnits)} equipamentos envolvidos`}
            icon={AlertTriangle}
            tone={totals.duplicateMacGroups > 0 ? 'rose' : 'emerald'}
          />
          <KpiCard
            label="Contrato não-ativo"
            value={fmtInt(derived.nonActive)}
            hint="com equipamento ainda vinculado"
            icon={AlertTriangle}
            tone={derived.nonActive > 0 ? 'amber' : 'emerald'}
          />
        </div>
        {totals.duplicateMacGroups > 0 ? (
          <p className="mt-3 text-[11px] leading-snug text-on-surface-variant/65">
            MACs duplicados podem indicar troca de equipamento sem baixa do anterior, erro de digitação ou clonagem —
            vale auditar os {fmtInt(totals.duplicateMacGroups)} grupos.
          </p>
        ) : null}
      </div>

      <p className="text-[11px] leading-snug text-on-surface-variant/55">
        Parque e cadastro vêm da base de patrimônios; a saúde de sinal por modelo vem do monitoramento das ONUs
        (modelo visto pela OLT), em tempo quase real. Próximo passo possível: recortar a atenuação por bairro/OLT
        para localizar onde um modelo problemático se concentra.
      </p>
    </div>
  )
}
