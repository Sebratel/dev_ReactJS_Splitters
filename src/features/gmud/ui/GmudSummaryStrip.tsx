import type { GmudListFilter } from '@/features/gmud/model/gmud'
import type { GmudListSummary } from '@/features/gmud/api/fetchGmudListSummary'
import { cn } from '@/shared/lib/utils'

type Card = { key: GmudListFilter; label: string; value: number | undefined; danger?: boolean }

/** Quatro números do topo do painel; cada um é um filtro da lista (clicar aplica, clicar de novo limpa). */
export function GmudSummaryStrip({
  summary,
  filter,
  onSelect,
}: {
  summary: GmudListSummary | undefined
  filter: GmudListFilter
  onSelect: (next: GmudListFilter) => void
}) {
  const cards: Card[] = [
    { key: 'abertas', label: 'Em aberto', value: summary?.abertas },
    { key: 'vencidas', label: 'Prazo vencido', value: summary?.vencidas, danger: true },
    { key: 'comite_pendente', label: 'Aguardando Comitê', value: summary?.comitePendente },
    { key: 'vencem_semana', label: 'Vencem em 7 dias', value: summary?.vencemSemana },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {cards.map((c) => {
        const active = filter === c.key
        const alarming = Boolean(c.danger) && (c.value ?? 0) > 0
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? 'todas' : c.key)}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              alarming
                ? 'border-rose-300/70 bg-rose-50 dark:border-rose-800/50 dark:bg-rose-950/30'
                : 'border-neutral-200/90 bg-surface-container-lowest hover:bg-surface-container-low dark:border-white/10',
              active ? 'ring-2 ring-primary' : '',
            )}
          >
            <p className={cn('text-[11px] font-semibold', alarming ? 'text-rose-700 dark:text-rose-300' : 'text-on-surface-variant')}>
              {c.label}
            </p>
            <p className={cn('text-2xl font-semibold tabular-nums', alarming ? 'text-rose-700 dark:text-rose-300' : 'text-on-surface')}>
              {c.value === undefined ? '—' : c.value.toLocaleString('pt-BR')}
            </p>
          </button>
        )
      })}
    </div>
  )
}
