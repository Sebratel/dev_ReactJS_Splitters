import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, LayoutDashboard, Link2 } from 'lucide-react'
import type { GmudListItem, GmudSort, GmudSortKey } from '@/features/gmud/model/gmud'
import { gmudDisplayTitle } from '@/features/gmud/lib/gmudTitle'
import { htmlToPlainText } from '@/features/gmud/lib/gmudText'
import { gmudDeadline, type GmudDeadlineTone } from '@/features/gmud/lib/gmudDeadline'
import { gmudCancelada, gmudPodeAvaliar } from '@/features/gmud/lib/gmudLifecycle'
import { gmudSituacao } from '@/features/gmud/lib/gmudSituacao'
import { GmudSituacaoSelo, GmudTipoSelo } from '@/features/gmud/ui/GmudSelos'
import { requesterAvatarIndex, requesterInitials, shortRequesterName } from '@/features/gmud/lib/gmudRequester'
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

/** Cores do avatar do solicitante: fundo claro com texto bem escuro (e o inverso no tema escuro). */
const AVATAR_TONES = [
  'bg-sky-100 text-sky-900 dark:bg-sky-900/70 dark:text-sky-100',
  'bg-violet-100 text-violet-900 dark:bg-violet-900/70 dark:text-violet-100',
  'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-100',
  'bg-amber-100 text-amber-900 dark:bg-amber-900/70 dark:text-amber-100',
  'bg-rose-100 text-rose-900 dark:bg-rose-900/70 dark:text-rose-100',
  'bg-teal-100 text-teal-900 dark:bg-teal-900/70 dark:text-teal-100',
]

const PILL = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold'
/** Cabeçalho fixo: fica no topo da área de rolagem da tabela (a linha de baixo é uma sombra, que acompanha o sticky). */
const TH = 'sticky top-0 z-10 bg-surface-container-lowest px-4 py-2.5 shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)] dark:shadow-[inset_0_-1px_0_rgb(255_255_255/0.18)]'
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white'

function fmtDate(iso: string | null): string {
  return iso ? formatBrazilDateTimeShortDisplay(iso, '—') : '—'
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string
  column: GmudSortKey
  sort: GmudSort
  onSort: (key: GmudSortKey) => void
}) {
  const active = sort.key === column
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th scope="col" className={TH} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn('inline-flex items-center gap-1 rounded uppercase tracking-wide transition-colors hover:text-on-surface', FOCO, active ? 'text-on-surface' : '')}
        title={`Ordenar por ${label.toLowerCase()}`}
      >
        {label}
        <Icon size={12} aria-hidden />
      </button>
    </th>
  )
}

/** Tabela do painel de GMUDs: tipo, origem, solicitante, prazo e situação, com link para o detalhe. */
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
    <div className="max-h-[72vh] overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
            <SortHeader label="GMUD" column="protocolo" sort={sort} onSort={onSort} />
            <SortHeader label="Solicitante" column="solicitante" sort={sort} onSort={onSort} />
            <SortHeader label="Abertura" column="abertura" sort={sort} onSort={onSort} />
            <SortHeader label="Prazo" column="prazo" sort={sort} onSort={onSort} />
            <SortHeader label="Situação" column="status" sort={sort} onSort={onSort} />
            <th scope="col" className={cn(TH, 'text-right')}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((g) => {
            const deadline = gmudDeadline(g)
            const plataforma = g.extra != null
            const cancelada = gmudCancelada(g)
            const situacao = gmudSituacao(g)
            const links = g.massivaLinksCount
            return (
              <tr
                key={g.protocol}
                data-origem={plataforma ? 'plataforma' : 'legado'}
                className="group/row border-t border-neutral-200/80 transition-colors hover:bg-surface-container-low focus-within:bg-surface-container-low dark:border-white/10"
              >
                <td className="max-w-[34rem] px-4 py-2.5">
                  <Link to={`/gmud/${g.protocol}`} className={cn('group block rounded', FOCO)}>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs tabular-nums text-on-surface-variant">{g.protocol}</span>
                      {plataforma ? (
                        <span role="img" aria-label="Da plataforma" title="Da plataforma" className="inline-flex text-on-surface-variant">
                          <LayoutDashboard size={13} aria-hidden />
                        </span>
                      ) : (
                        <span className="text-[11px] text-on-surface-variant" title="Protocolo antigo, só no Voalle">
                          Legado
                        </span>
                      )}
                      {g.extra?.tipo ? <GmudTipoSelo tipo={g.extra.tipo} /> : null}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 line-clamp-2 group-hover:underline',
                        // Legado e cancelada ficam mais discretos pelo tom do texto (não por opacidade: o contraste continua acima de 4,5:1).
                        cancelada ? 'text-on-surface-variant line-through' : plataforma ? 'font-medium text-on-surface' : 'text-on-surface-variant',
                      )}
                      title={g.title}
                    >
                      {gmudDisplayTitle({ title: g.title, protocol: g.protocol, requester: g.requester, descriptionText: htmlToPlainText(g.description) })}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2" title={g.requester || undefined}>
                    <span
                      className={cn(
                        'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        AVATAR_TONES[requesterAvatarIndex(g.requesterEmail || g.requester, AVATAR_TONES.length)],
                      )}
                      aria-hidden
                    >
                      {requesterInitials(g.requester)}
                    </span>
                    <span className="whitespace-nowrap text-on-surface-variant">{shortRequesterName(g.requester)}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-on-surface-variant">{fmtDate(g.openedAt)}</td>
                <td className="px-4 py-2.5">
                  <span className={cn(PILL, DEADLINE_STYLE[deadline.tone])} title={g.slaDate ? `Prazo: ${fmtDate(g.slaDate)}` : undefined}>
                    {deadline.label}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-col items-start gap-0.5">
                    <GmudSituacaoSelo situacao={situacao} />
                    {situacao.voalle ? <span className="text-[11px] text-on-surface-variant">Voalle: {situacao.voalle}</span> : null}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onLink(g)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ring-1 transition hover:bg-surface-container-low focus-visible:opacity-100',
                        FOCO,
                        links > 0
                          ? 'text-on-surface ring-neutral-300 dark:ring-white/25'
                          : 'text-on-surface-variant opacity-0 ring-neutral-200/70 group-hover/row:opacity-100 group-focus-within/row:opacity-100 dark:ring-white/15',
                      )}
                      title={links > 0 ? 'Ver massivas vinculadas' : 'Vincular massiva'}
                      aria-label={links > 0 ? `${links} massiva${links === 1 ? '' : 's'} vinculada${links === 1 ? '' : 's'}` : undefined}
                    >
                      <Link2 size={13} aria-hidden />
                      {links > 0 ? <span className="tabular-nums">{links}</span> : 'Vincular'}
                    </button>
                    {canApprove && gmudPodeAvaliar(g) ? (
                      <button
                        type="button"
                        onClick={() => onApprove(g)}
                        title="Avaliação do Comitê"
                        className="rounded-md px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/30 transition hover:bg-primary/10"
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
