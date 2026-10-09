import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Plus, RefreshCw, Search } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { useGmudList } from '@/features/gmud/hooks/useGmudList'
import { GmudApprovalModal } from '@/features/gmud/ui/GmudApprovalModal'
import { GmudApprovalQueue } from '@/features/gmud/ui/GmudApprovalQueue'
import { GmudCalendar } from '@/features/gmud/ui/GmudCalendar'
import { GmudLinksModal } from '@/features/gmud/ui/GmudLinksModal'
import { useGmudPendingCount } from '@/features/gmud/hooks/useGmudApprovals'
import { GmudListTable } from '@/features/gmud/ui/GmudListTable'
import type { GmudListFilter, GmudListItem } from '@/features/gmud/model/gmud'
import { cn } from '@/shared/lib/utils'

const CARD =
  'rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest'
const PAGE_SIZE = 20

const FILTERS: { key: GmudListFilter; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'abertas', label: 'Abertas' },
  { key: 'vencidas', label: 'Prazo vencido' },
  { key: 'comite_pendente', label: 'Aguardando Comitê' },
  { key: 'aprovadas', label: 'Aprovadas' },
  { key: 'plataforma', label: 'Abertas pela plataforma' },
  { key: 'minhas', label: 'Minhas' },
]

export function GmudScreen() {
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [approving, setApproving] = useState<GmudListItem | null>(null)
  const [linking, setLinking] = useState<GmudListItem | null>(null)
  const [view, setView] = useState<'all' | 'pending' | 'agenda'>('all')
  const [filter, setFilter] = useState<GmudListFilter>('todas')
  const canApprove = useAccessAuthStore((s) => s.hasPermission('canApproveGmud'))
  const pendingCount = useGmudPendingCount()

  // Debounce simples da busca (reseta pra página 0 quando muda).
  useEffect(() => {
    const t = window.setTimeout(() => {
      setAppliedSearch(searchInput.trim())
      setPage(0)
    }, 400)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, isError, error, isFetching, refetch } = useGmudList({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    q: appliedSearch,
    filter,
  })

  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = data?.items ?? []
  const firstShown = total === 0 ? 0 : page * PAGE_SIZE + 1
  const lastShown = Math.min(total, page * PAGE_SIZE + items.length)

  const headerTrailing = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/gmud/nova"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90"
        >
          <Plus size={15} /> Nova GMUD
        </Link>
        <Link
          to="/gmud/indicadores"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-on-surface ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low dark:ring-white/10"
        >
          <BarChart3 size={15} /> Indicadores
        </Link>
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar protocolo, título ou solicitante…"
            className="h-9 w-64 rounded-lg bg-surface-container-lowest pl-8 pr-2.5 text-xs text-on-surface ring-1 ring-neutral-200/70 focus:outline-none focus:ring-primary dark:ring-white/10"
            aria-label="Buscar GMUD"
          />
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex size-9 items-center justify-center rounded-lg text-on-surface-variant ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low dark:ring-white/10"
          aria-label="Atualizar"
          title="Atualizar"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>
    ),
    [searchInput, isFetching, refetch],
  )

  return (
    <div className="mx-auto min-w-0 max-w-[1480px] space-y-4">
      <AppPageHeader
        badge="Gestão de Mudança de Rede"
        title="GMUD"
        description="Requisição, acompanhamento e aprovação de mudanças de rede — integrado ao Elleven."
        icon={ClipboardList}
        primaryAction={{ to: '/', label: 'Voltar ao painel' }}
        trailing={headerTrailing}
      />

      <div className="flex rounded-lg bg-surface-container-low p-0.5 ring-1 ring-neutral-200/70 dark:ring-white/10">
          <button
            type="button"
            onClick={() => setView('all')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition',
              view === 'all'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            Todas as GMUDs
          </button>
          <button
            type="button"
            onClick={() => setView('agenda')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition',
              view === 'agenda'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <CalendarDays size={14} /> Agenda
          </button>
          {canApprove ? (
          <button
            type="button"
            onClick={() => setView('pending')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition',
              view === 'pending'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            Pendentes de aprovação
            {pendingCount > 0 ? (
              <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                {pendingCount}
              </span>
            ) : null}
          </button>
          ) : null}
      </div>

      {view === 'pending' && canApprove ? (
        <GmudApprovalQueue />
      ) : view === 'agenda' ? (
        <GmudCalendar />
      ) : (
      <div className={cn(CARD, 'overflow-hidden')}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/70 p-4 dark:border-white/10">
          <p className="text-sm font-bold text-on-surface">
            Painel de GMUDs
            <span className="ml-2 text-xs font-normal text-on-surface-variant">
              {total.toLocaleString('pt-BR')} protocolo{total === 1 ? '' : 's'}
              {appliedSearch !== '' || filter !== 'todas' ? ' (filtrado)' : ''}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setFilter(f.key)
                  setPage(0)
                }}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold ring-1 transition',
                  filter === f.key
                    ? 'bg-primary text-white ring-primary'
                    : 'text-on-surface-variant ring-neutral-200/70 hover:bg-surface-container-low dark:ring-white/10',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-on-surface-variant">Carregando GMUDs…</p>
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-red-600 dark:text-red-300">
              {error instanceof Error ? error.message : 'Falha ao carregar as GMUDs.'}
            </p>
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-on-surface-variant">
            {appliedSearch !== '' || filter !== 'todas' ? 'Nenhuma GMUD corresponde ao filtro.' : 'Nenhuma GMUD encontrada.'}
          </p>
        ) : (
          <>
            <GmudListTable items={items} canApprove={canApprove} onLink={setLinking} onApprove={setApproving} />
            {pageCount > 1 ? (
              <div className="flex items-center justify-between gap-2 border-t border-neutral-200/60 px-4 py-2.5 dark:border-white/5">
                <span className="text-xs text-on-surface-variant">
                  {firstShown}–{lastShown} de {total.toLocaleString('pt-BR')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="inline-flex size-7 items-center justify-center rounded-md text-on-surface-variant ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40 dark:ring-white/10"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-1 text-xs font-semibold tabular-nums text-on-surface">
                    {page + 1}/{pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={page >= pageCount - 1}
                    className="inline-flex size-7 items-center justify-center rounded-md text-on-surface-variant ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40 dark:ring-white/10"
                    aria-label="Próxima página"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
      )}

      {approving ? (
        <GmudApprovalModal
          gmud={approving}
          onClose={() => setApproving(null)}
          onSaved={() => {
            setApproving(null)
            void refetch()
          }}
        />
      ) : null}

      {linking ? <GmudLinksModal gmud={linking} onClose={() => setLinking(null)} /> : null}
    </div>
  )
}
