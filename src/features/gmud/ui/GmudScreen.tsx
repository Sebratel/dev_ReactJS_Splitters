import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ClipboardList, RefreshCw, Search } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import { useGmudList } from '@/features/gmud/hooks/useGmudList'
import { formatBrazilDateTimeShortDisplay } from '@/shared/lib/formatBrazilDisplayDate'
import { cn } from '@/shared/lib/utils'

const CARD =
  'rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest'
const PAGE_SIZE = 20

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return formatBrazilDateTimeShortDisplay(iso, '—')
}

export function GmudScreen() {
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(0)

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
  })

  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = data?.items ?? []
  const firstShown = total === 0 ? 0 : page * PAGE_SIZE + 1
  const lastShown = Math.min(total, page * PAGE_SIZE + items.length)

  const headerTrailing = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2">
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

      <div className={cn(CARD, 'overflow-hidden')}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/70 p-4 dark:border-white/10">
          <p className="text-sm font-bold text-on-surface">
            Painel de GMUDs
            <span className="ml-2 text-xs font-normal text-on-surface-variant">
              {total.toLocaleString('pt-BR')} protocolo{total === 1 ? '' : 's'}
              {appliedSearch !== '' ? ' (filtrado)' : ''}
            </span>
          </p>
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
            {appliedSearch !== '' ? 'Nenhuma GMUD corresponde à busca.' : 'Nenhuma GMUD encontrada.'}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-on-surface-variant/70">
                    <th className="px-4 py-2">Protocolo</th>
                    <th className="px-4 py-2">Título</th>
                    <th className="px-4 py-2">Solicitante</th>
                    <th className="px-4 py-2">Abertura</th>
                    <th className="px-4 py-2">Prazo (SLA)</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((g) => (
                    <tr key={g.protocol} className="border-t border-neutral-200/60 dark:border-white/5">
                      <td className="px-4 py-2.5 font-mono tabular-nums text-on-surface">{g.protocol}</td>
                      <td className="px-4 py-2.5 text-on-surface">
                        <span className="line-clamp-2 max-w-[38rem]" title={g.title}>
                          {g.title || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-on-surface-variant">{g.requester || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-on-surface-variant">{fmtDate(g.openedAt)}</td>
                      <td className="px-4 py-2.5 text-xs text-on-surface-variant">{fmtDate(g.slaDate)}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center rounded-full border border-neutral-200 dark:border-white/10 bg-surface-container-low px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
                          {g.status || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    </div>
  )
}
