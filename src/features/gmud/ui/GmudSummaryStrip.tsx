import { AlarmClock, CalendarClock, FolderOpen, Users, type LucideIcon } from 'lucide-react'
import type { GmudListFilter } from '@/features/gmud/model/gmud'
import type { GmudListSummary } from '@/features/gmud/api/fetchGmudListSummary'
import { cn } from '@/shared/lib/utils'

type Card = {
  key: GmudListFilter
  label: string
  icon: LucideIcon
  value: number | undefined
  /** Linha de apoio embaixo do número. */
  support: string
  danger?: boolean
}

const n = (v: number) => v.toLocaleString('pt-BR')

/** "Plataforma N · Legado M" quando o servidor mandou a divisão; senão, o texto de apoio padrão. */
function origemSupport(plataforma: number | null | undefined, legado: number | null | undefined, fallback: string): string {
  return typeof plataforma === 'number' && typeof legado === 'number' ? `Plataforma ${n(plataforma)} · Legado ${n(legado)}` : fallback
}

/** Quatro números do topo do painel; cada um é um atalho da lista (clicar aplica, clicar de novo desfaz). */
export function GmudSummaryStrip({
  summary,
  ativos,
  onToggle,
}: {
  summary: GmudListSummary | undefined
  /** Cartões cujo atalho está aplicado na lista. */
  ativos: ReadonlySet<GmudListFilter>
  /** Liga ou desliga o atalho do cartão. */
  onToggle: (key: GmudListFilter) => void
}) {
  const cards: Card[] = [
    {
      key: 'abertas',
      label: 'Em aberto',
      icon: FolderOpen,
      value: summary?.abertas,
      support: origemSupport(summary?.abertasPlataforma, summary?.abertasLegado, 'Protocolos ainda não encerrados'),
    },
    {
      key: 'vencidas',
      label: 'Prazo vencido',
      icon: AlarmClock,
      value: summary?.vencidas,
      support: origemSupport(summary?.vencidasPlataforma, summary?.vencidasLegado, 'Abertas com o prazo estourado'),
      danger: true,
    },
    { key: 'comite_pendente', label: 'Aguardando Comitê', icon: Users, value: summary?.comitePendente, support: 'Esperando a decisão do Comitê' },
    { key: 'vencem_semana', label: 'Vencem em 7 dias', icon: CalendarClock, value: summary?.vencemSemana, support: 'Abertas, ainda dentro do prazo' },
  ]
  return (
    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const active = ativos.has(c.key)
        const alarming = Boolean(c.danger) && (c.value ?? 0) > 0
        const Icon = c.icon
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={active}
            title={active ? 'Clique para tirar este filtro' : 'Clique para filtrar a lista'}
            onClick={() => onToggle(c.key)}
            className={cn(
              'flex items-start gap-3 rounded-xl border px-3 py-3 text-left shadow-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:focus-visible:ring-white',
              alarming
                ? 'border-rose-300 bg-rose-50 hover:bg-rose-100 dark:border-rose-500/50 dark:bg-rose-950/40 dark:hover:bg-rose-950/60'
                : 'border-neutral-200/90 bg-surface-container-lowest hover:bg-surface-container-low dark:border-white/15',
              active ? 'border-neutral-900 ring-2 ring-primary dark:border-white' : '',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                active
                  ? 'bg-primary text-neutral-900'
                  : alarming
                    ? 'bg-rose-200 text-rose-900 dark:bg-rose-900/70 dark:text-rose-100'
                    : 'bg-surface-container-low text-on-surface',
              )}
            >
              <Icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className={cn('text-xs font-semibold', alarming ? 'text-rose-800 dark:text-rose-200' : 'text-on-surface-variant')}>{c.label}</span>
                {active ? (
                  <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-neutral-900">Filtrando</span>
                ) : null}
              </span>
              <span className={cn('block text-2xl font-bold leading-tight tabular-nums', alarming ? 'text-rose-800 dark:text-rose-200' : 'text-on-surface')}>
                {c.value === undefined ? '—' : n(c.value)}
              </span>
              <span className={cn('mt-0.5 block text-xs', alarming ? 'text-rose-800 dark:text-rose-200' : 'text-on-surface-variant')}>{c.support}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
