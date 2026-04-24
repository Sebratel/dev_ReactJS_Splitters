import { useMemo } from 'react'
import type { Olt } from '@/features/splitters/model/olt'
import type { SplittersListClientSearchMode } from '@/features/splitters/model/splittersListClientSearch'
import type { SplittersListFilterState } from '@/features/splitters/model/splittersListFilters'
import { countActiveSplittersFilters } from '@/features/splitters/model/splittersListFilters'
import {
  SPLITTER_STATUS_LABEL,
  SPLITTER_STATUS_ORDER,
  type SplitterStatus,
} from '@/features/splitters/model/splitterStatus'
import { SplittersFiltersStreetFieldset } from '@/features/splitters/ui/SplittersFiltersStreetFieldset'
import { Search, RotateCcw, Filter } from 'lucide-react'

type SplittersFiltersBarProps = {
  filterState: SplittersListFilterState
  onSearchChange: (value: string) => void
  onToggleOlt: (oltCode: string) => void
  onToggleSplitterStatus: (status: SplitterStatus) => void
  onToggleStreetSelection: (streetLine: string) => void
  onClearFilters: () => void
  olts: Olt[] | undefined
  oltsLoading: boolean
  oltsError: boolean
  streetOptions: string[]
  knownStreetCount: number
  totalSplitters: number
  clientSearchMode: SplittersListClientSearchMode
  onRetryConnections?: () => void
  connectionsFetching?: boolean
}

export function SplittersFiltersBar({
  filterState,
  onSearchChange,
  onToggleOlt,
  onToggleSplitterStatus,
  onToggleStreetSelection,
  onClearFilters,
  olts,
  oltsLoading,
  oltsError,
  streetOptions,
  knownStreetCount,
  totalSplitters,
  clientSearchMode,  connectionsFetching = false,
}: SplittersFiltersBarProps) {
  const activeCount = countActiveSplittersFilters(filterState)
  const selectedOlts = useMemo(
    () => new Set(filterState.oltCodes),
    [filterState.oltCodes],
  )
  const selectedStatuses = useMemo(
    () => new Set(filterState.splitterStatuses),
    [filterState.splitterStatuses],
  )
  const sortedOlts = useMemo(() => {
    if (!olts?.length) return []
    return [...olts].sort((a, b) => {
      const ta = (a.title || a.code).toLowerCase()
      const tb = (b.title || b.code).toLowerCase()
      return ta.localeCompare(tb, 'pt-BR')
    })
  }, [olts])


  return (
    <section
      className="rounded-3xl bg-surface-container-low p-6"
      aria-labelledby="splitters-filters-heading"
    >
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-primary" />
          <h2 id="splitters-filters-heading" className="font-bold text-on-surface">
            Refinar Busca
          </h2>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClearFilters}
            className="flex items-center gap-1.5 text-sm font-bold text-primary transition-all hover:scale-[0.98]"
          >
            <RotateCcw size={14} />
            Limpar ({activeCount})
          </button>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-3">
          <label htmlFor="splitters-search" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            <Search size={14} />
            Termo de Busca
          </label>
          <input
            id="splitters-search"
            type="search"
            value={filterState.searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Splitter, cliente, integração…"
            className="w-full rounded-2xl bg-surface px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
            autoComplete="off"
          />
          {clientSearchMode === 'loading' && (
            <p className="text-[10px] italic text-on-surface-variant/70">
              Sincronizando base de clientes…
            </p>
          )}
          {clientSearchMode === 'ready' && (
            <p className="text-[10px] text-on-surface-variant/70 italic">
              Busca avançada ativa (Nomes de clientes e rotas).
              {connectionsFetching ? ' Atualizando delta…' : ''}
            </p>
          )}
        </div>

        <fieldset className="min-w-0">
          <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Filtrar por OLT
          </legend>
          {oltsLoading && <p className="text-sm italic opacity-50">Carregando infraestrutura…</p>}
          {oltsError && <p className="text-sm text-tertiary">Erro ao sincronizar OLTs.</p>}
          
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-2xl bg-surface p-2 scrollbar-thin scrollbar-thumb-outline-variant">
            {sortedOlts.map((olt) => {
              const checked = selectedOlts.has(olt.code)
              return (
                <li key={olt.code}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-surface-container-low">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded-lg border-outline-variant text-primary focus:ring-primary/20"
                      checked={checked}
                      onChange={() => onToggleOlt(olt.code)}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{olt.title || olt.code}</p>
                      <p className="text-[10px] font-mono opacity-50">{olt.code}</p>
                    </div>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Status de Ocupação
          </legend>
          <ul className="space-y-1 rounded-2xl bg-surface p-2">
            {SPLITTER_STATUS_ORDER.map((status) => {
              const checked = selectedStatuses.has(status)
              return (
                <li key={status}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-surface-container-low">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded-lg border-outline-variant text-primary focus:ring-primary/20"
                      checked={checked}
                      onChange={() => onToggleSplitterStatus(status)}
                    />
                    <span className="text-sm font-medium">{SPLITTER_STATUS_LABEL[status]}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>
      </div>

      <div className="mt-8 pt-6 border-t border-outline-variant/30">
        <SplittersFiltersStreetFieldset
          streetSelections={filterState.streetSelections}
          streetOptions={streetOptions}
          knownStreetCount={knownStreetCount}
          totalSplitters={totalSplitters}
          onToggleStreetSelection={onToggleStreetSelection}
        />
      </div>
    </section>
  )
}

