import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import {
  buildTrendStatusCapacityGroups,
  TREND_NEAR_LIMIT_USAGE_PERCENT,
  TREND_RISING_DELTA_THRESHOLD_PP,
} from '@/features/intelligence/lib/trendStatusCapacityGroups'
import {
  selectedDeltaForTrend,
  type TrendDeltaReference,
  type TrendRowForHighlight,
} from '@/features/intelligence/lib/trendStatusHighlights'
import {
  deltaPpLineTitle,
  formatDeltaPp,
} from '@/features/intelligence/lib/percentagePointsHelp'
import { PercentagePointsCallout } from '@/features/intelligence/ui/PercentagePointsCallout'
import { cn } from '@/shared/lib/utils'

type TrendStatusCapacityPanelProps = {
  trends: readonly TrendRowForHighlight[]
  deltaReferenceLabel: string
  trendDeltaReference: TrendDeltaReference
  trendBadgeClass: (label: string) => string
}

function TrendStatusRow({
  row,
  deltaReferenceLabel,
  trendDeltaReference,
  trendBadgeClass,
}: {
  row: TrendRowForHighlight
  deltaReferenceLabel: string
  trendDeltaReference: TrendDeltaReference
  trendBadgeClass: (label: string) => string
}) {
  const selectedDelta = selectedDeltaForTrend(row, trendDeltaReference)

  return (
    <li className="flex items-center justify-between gap-2 rounded-xl bg-surface-container-low/80 px-2.5 py-2">
      <div className="min-w-0 flex-1">
        {row.splitterTitle.trim() !== '' ? (
          <>
            <Link
              to={`/splitters/${encodeURIComponent(row.splitterCode)}`}
              className="block truncate text-xs font-bold text-amber-900 dark:text-amber-200 hover:underline"
              title={row.splitterTitle.trim()}
            >
              {row.splitterTitle.trim()}
            </Link>
            <p className="font-mono text-[10px] font-semibold text-on-surface-variant">{row.splitterCode}</p>
          </>
        ) : (
          <Link
            to={`/splitters/${encodeURIComponent(row.splitterCode)}`}
            className="text-xs font-bold text-amber-900 dark:text-amber-200 hover:underline"
          >
            {row.splitterCode}
          </Link>
        )}
        <p
          className="text-[11px] text-on-surface-variant"
          title={deltaPpLineTitle(row.currentUsagePercent, selectedDelta, deltaReferenceLabel)}
        >
          Uso {row.currentUsagePercent.toFixed(1)}% · {deltaReferenceLabel}:{' '}
          <span className="cursor-help border-b border-dotted border-slate-400 font-semibold text-on-surface-variant">
            {formatDeltaPp(selectedDelta)}
          </span>
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold',
          trendBadgeClass(row.label),
        )}
      >
        {row.label}
      </span>
    </li>
  )
}

function SectionBlock({
  title,
  hint,
  rows,
  emptyText,
  deltaReferenceLabel,
  trendDeltaReference,
  trendBadgeClass,
}: {
  title: string
  hint: string
  rows: readonly TrendRowForHighlight[]
  emptyText: string
  deltaReferenceLabel: string
  trendDeltaReference: TrendDeltaReference
  trendBadgeClass: (label: string) => string
}) {
  return (
    <section>
      <h3 className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{title}</h3>
      <p className="mt-0.5 text-[10px] leading-snug text-on-surface-variant">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-slate-200 dark:border-white/10 bg-surface-container-lowest/60 px-2.5 py-2 text-[11px] text-on-surface-variant">
          {emptyText}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rows.map((row) => (
            <TrendStatusRow
              key={row.splitterCode}
              row={row}
              deltaReferenceLabel={deltaReferenceLabel}
              trendDeltaReference={trendDeltaReference}
              trendBadgeClass={trendBadgeClass}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

export function TrendStatusCapacityPanel({
  trends,
  deltaReferenceLabel,
  trendDeltaReference,
  trendBadgeClass,
}: TrendStatusCapacityPanelProps) {
  const [stableOpen, setStableOpen] = useState(false)
  const groups = buildTrendStatusCapacityGroups(trends, trendDeltaReference)
  const { labelCounts } = groups

  const outsideHighlightsCount = useMemo(() => {
    const highlighted = new Set<string>()
    for (const row of groups.nearLimit) highlighted.add(row.splitterCode)
    for (const row of groups.rising) highlighted.add(row.splitterCode)
    return Math.max(0, trends.length - highlighted.size)
  }, [groups.nearLimit, groups.rising, trends.length])

  return (
    <div className="space-y-4">
      <PercentagePointsCallout periodLabel={deltaReferenceLabel} />
      <p className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-surface-container-low/90 px-2.5 py-2 text-[11px] leading-relaxed text-on-surface-variant">
        <span className="font-semibold text-on-surface">Resumo do recorte:</span>{' '}
        {labelCounts['Quase saturando']} quase saturando · {labelCounts['Em crescimento']} em crescimento ·{' '}
        {labelCounts['Em queda']} em queda · {labelCounts.Estavel} estáveis ({groups.totalWithTrend} com tendência).
        Foco em <span className="font-semibold">capacidade</span> — não repete massivas nem o ranking composto.
      </p>

      <SectionBlock
        title={`Quase no limite (≥ ${TREND_NEAR_LIMIT_USAGE_PERCENT}% de uso)`}
        hint="Prioridade de planejamento — mesmo com Δ zerado."
        rows={groups.nearLimit}
        emptyText="Nenhum equipamento acima do limiar de uso neste recorte."
        deltaReferenceLabel={deltaReferenceLabel}
        trendDeltaReference={trendDeltaReference}
        trendBadgeClass={trendBadgeClass}
      />

      <SectionBlock
        title={`Subindo (${deltaReferenceLabel} ou classificação ativa)`}
        hint={`Mudança ≥ ${TREND_RISING_DELTA_THRESHOLD_PP} pontos percentuais (pp) ou selo diferente de Estável.`}
        rows={groups.rising}
        emptyText={`Nenhum destaque de variação no ${deltaReferenceLabel} — rede calma em ocupação ou histórico curto.`}
        deltaReferenceLabel={deltaReferenceLabel}
        trendDeltaReference={trendDeltaReference}
        trendBadgeClass={trendBadgeClass}
      />

      <div>
        <button
          type="button"
          onClick={() => setStableOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-white/10 bg-surface-container-lowest/80 px-3 py-2 text-left text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container-low"
        >
          <span>
            Rede calma em capacidade — {outsideHighlightsCount.toLocaleString('pt-BR')} equipamentos fora dos destaques
            acima
          </span>
          <ChevronDown size={16} className={cn('shrink-0 transition', stableOpen ? 'rotate-180' : '')} />
        </button>
        {stableOpen ? (
          <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
            Para visão agregada use a pizza de tendências (acima no painel). Para priorização completa use o{' '}
            <span className="font-semibold">ranking de risco</span> e o mapa.
          </p>
        ) : null}
      </div>
    </div>
  )
}
