import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, Link2 } from 'lucide-react'
import type { GmudListItem, GmudSort, GmudSortKey } from '@/features/gmud/model/gmud'
import { gmudDisplayTitle } from '@/features/gmud/lib/gmudTitle'
import { htmlToPlainText } from '@/features/gmud/lib/gmudText'
import { gmudDeadline, type GmudDeadlineTone } from '@/features/gmud/lib/gmudDeadline'
import { GMUD_STATUS_COMITE_LABEL, type GmudStatusComite } from '@/features/gmud/api/updateGmudApproval'
import { formatBrazilDateTimeShortDisplay } from '@/shared/lib/formatBrazilDisplayDate'
import { cn } from '@/shared/lib/utils'

const DEADLINE_STYLE: Record<GmudDeadlineTone, string> = {
  overdue: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
  soon: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  ok: 'bg-surface-container-low text-on-surface-variant',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  cancelled: 'bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-neutral-300',
  none: 'bg-surface-container-low text-on-surface-variant',
}

const COMITE_STYLE: Record<string, string> = {
  aprovada: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  negada: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
  pendente: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
}

const PILL = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold'

function fmtDate(iso: string | null): string {
  return iso ? formatBrazilDateTimeShortDisplay(iso, '—') : '—'
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string
  column: GmudSortKey
  sort: GmudSort
  onSort: (key: GmudSortKey) => void
  className?: string
}) {
  const active = sort.key === column
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={cn('px-4 py-2', className)} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-on-surface',
          active ? 'text-primary' : '',
        )}
        title={`Ordenar por ${label.toLowerCase()}`}
      >
        {label}
        <Icon size={12} className={active ? '' : 'opacity-50'} />
      </button>
    </th>
  )
}

/** Tabela do painel de GMUDs: título limpo, origem, prazo e Comitê, com link para o detalhe. */
export function GmudListTable({
  items,
  canApprove,
  onLink,
  onApprove,
  sort,
  onSort,
}: {
  items: GmudListItem[]
  canApprove: boolean
  onLink: (g: GmudListItem) => void
  onApprove: (g: GmudListItem) => void
  sort: GmudSort
  onSort: (key: GmudSortKey) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-on-surface-variant/70">
            <SortHeader label="GMUD" column="protocolo" sort={sort} onSort={onSort} />
            <SortHeader label="Solicitante" column="solicitante" sort={sort} onSort={onSort} />
            <SortHeader label="Abertura" column="abertura" sort={sort} onSort={onSort} />
            <SortHeader label="Prazo" column="prazo" sort={sort} onSort={onSort} />
            <SortHeader label="Voalle" column="status" sort={sort} onSort={onSort} />
            <th className="px-4 py-2">Comitê</th>
            <th className="px-4 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((g) => {
            const deadline = gmudDeadline(g)
            const plataforma = g.extra != null
            const comite = g.extra?.statusComite ?? null
            return (
              <tr key={g.protocol} className="border-t border-neutral-200/60 transition hover:bg-surface-container-low/60 dark:border-white/5">
                <td className="max-w-[34rem] px-4 py-2.5">
                  <Link to={`/gmud/${g.protocol}`} className="group block">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs tabular-nums text-on-surface-variant group-hover:text-primary">{g.protocol}</span>
                      <span
                        className={cn(
                          PILL,
                          'px-1.5 py-0 text-[10px] uppercase tracking-wide',
                          plataforma ? 'bg-primary/15 text-primary' : 'bg-surface-container-low text-on-surface-variant/80',
                        )}
                        title={plataforma ? 'Aberta/registrada pela plataforma' : 'Protocolo antigo, só no Voalle'}
                      >
                        {plataforma ? 'Plataforma' : 'Legado'}
                      </span>
                      {g.extra?.tipo ? <span className="text-[11px] text-on-surface-variant">{g.extra.tipo}</span> : null}
                    </span>
                    <span className="mt-0.5 line-clamp-2 font-medium text-on-surface group-hover:underline" title={g.title}>
                      {gmudDisplayTitle({ title: g.title, protocol: g.protocol, requester: g.requester, descriptionText: htmlToPlainText(g.description) })}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-on-surface-variant">{g.requester || '—'}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-on-surface-variant">{fmtDate(g.openedAt)}</td>
                <td className="px-4 py-2.5">
                  <span className={cn(PILL, DEADLINE_STYLE[deadline.tone])} title={g.slaDate ? `Prazo: ${fmtDate(g.slaDate)}` : undefined}>
                    {deadline.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-on-surface-variant">{g.status || '—'}</td>
                <td className="px-4 py-2.5">
                  {comite ? (
                    <span className={cn(PILL, COMITE_STYLE[comite] ?? 'bg-surface-container-low text-on-surface-variant')}>
                      {GMUD_STATUS_COMITE_LABEL[comite as GmudStatusComite] ?? comite}
                    </span>
                  ) : (
                    <span className="text-xs text-on-surface-variant/60">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onLink(g)}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-on-surface-variant ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low dark:ring-white/10"
                      title="Massivas vinculadas"
                    >
                      <Link2 size={13} />
                      {g.massivaLinksCount > 0 ? g.massivaLinksCount : 'Vincular'}
                    </button>
                    {canApprove ? (
                      <button
                        type="button"
                        onClick={() => onApprove(g)}
                        disabled={!plataforma}
                        title={plataforma ? 'Avaliação do Comitê' : 'GMUD legado: sem escopo registrado para o Comitê avaliar'}
                        className="rounded-md px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/30 transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        Avaliar
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
