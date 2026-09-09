import { SplitterCard } from '@/features/splitters/ui/SplitterCard'
import type { Splitter } from '@/features/splitters/model/splitter'
import type {
  SplitterMassivaStats,
  SplitterOperationalScore,
} from '@/features/splitters/model/splitterOperationalInsights'
import type { SplitterMaintenanceStats } from '@/features/splitters/api/fetchSplitterMaintenanceStatsFromLocalDb'
import type { OnuSplitterSignalSummary } from '@/features/onu/model/onuSplitterSummary'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { EmptyState } from '@/shared/ui/states/EmptyState'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type SplittersListProps = {
  items: Splitter[]
  totalCount: number
  currentPage: number
  onPageChange: (page: number) => void
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: () => void
  isRefetching: boolean
  getMassivaStats: (splitter: Splitter) => SplitterMassivaStats
  getMaintenanceStats: (splitter: Splitter) => SplitterMaintenanceStats
  getOperationalScore: (splitter: Splitter) => SplitterOperationalScore
  getTrendLabel: (splitter: Splitter) => string
  getOnuSignal?: (splitter: Splitter) => OnuSplitterSignalSummary | null | undefined
}

function getPaginationRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const delta = 1
  const range: number[] = [1]

  for (let i = current - delta; i <= current + delta; i++) {
    if (i > 1 && i < total) {
      range.push(i)
    }
  }

  if (total > 1) range.push(total)

  const result: (number | '...')[] = []
  let prev: number | undefined

  for (const page of range) {
    if (prev !== undefined) {
      if (page - prev === 2) {
        result.push(prev + 1)
      } else if (page - prev > 2) {
        result.push('...')
      }
    }
    result.push(page)
    prev = page
  }

  return result
}

export function SplittersList({
  items,
  totalCount,
  currentPage,
  onPageChange,
  isPending,
  isError,
  error,
  refetch,
  isRefetching,
  getMassivaStats,
  getMaintenanceStats,
  getOperationalScore,
  getTrendLabel,
  getOnuSignal,
}: SplittersListProps) {
  const limit = 20
  const totalPages = Math.ceil(totalCount / limit)

  if (isPending) {
    return (
      <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="min-h-[16rem] w-full animate-pulse rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm"
          >
            <div className="flex justify-between gap-3">
              <div className="h-11 w-11 rounded-xl bg-surface-container-low" />
              <div className="h-12 w-16 rounded-lg bg-surface-container-low" />
            </div>
            <div className="mt-5 space-y-2">
              <div className="h-5 w-4/5 max-w-[14rem] rounded-md bg-surface-container-low" />
              <div className="h-3 w-24 rounded bg-surface-container-low/80" />
            </div>
            <div className="mt-5 h-3 w-full rounded-full bg-surface-container-low" />
            <div className="mt-6 space-y-2 border-t border-outline-variant/30 pt-4">
              <div className="h-3 w-full rounded bg-surface-container-low/90" />
              <div className="h-3 w-11/12 rounded bg-surface-container-low/70" />
            </div>
            <div className="mt-5 flex justify-between border-t border-outline-variant/30 pt-4">
              <div className="space-y-2">
                <div className="h-2 w-20 rounded bg-surface-container-low/80" />
                <div className="h-6 w-16 rounded-md bg-surface-container-low" />
              </div>
              <div className="h-10 w-28 rounded-xl bg-surface-container-low" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        message={formatQueryError(error)}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  if (totalCount === 0) {
    return (
      <EmptyState
        title="Nenhum resultado"
        description="Ajuste os filtros ou a busca para encontrar o que procura."
      />
    )
  }

  const pageNumbers = getPaginationRange(currentPage, totalPages)

  return (
    <div className="space-y-8">
      {isRefetching && (
        <div className="fixed top-24 right-10 z-50 animate-in fade-in slide-in-from-right-4">
          <div className="bg-primary text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-2xl">
            Sincronizando...
          </div>
        </div>
      )}

      <ul className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((splitter) => (
          <SplitterCard
            key={splitter.code ? splitter.code : `id-${splitter.id}`}
            splitter={splitter}
            massivaStats={getMassivaStats(splitter)}
            maintenanceStats={getMaintenanceStats(splitter)}
            operationalScore={getOperationalScore(splitter)}
            trendLabel={getTrendLabel(splitter)}
            onuSignal={getOnuSignal?.(splitter)}
          />
        ))}
      </ul>

      <footer className="flex flex-col items-center justify-between gap-6 border-t border-outline-variant/30 pt-10 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-on-surface">{'P\u00E1gina'} {currentPage}</span>
          <span className="text-xs font-bold text-on-surface-variant/40 uppercase tracking-widest">
            {'de'} {totalPages || 1} {'\u00B7'} {totalCount} splitters
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || isRefetching}
            aria-label={'P\u00E1gina anterior'}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-lowest text-neutral-900 shadow-sm border border-outline-variant transition-all hover:bg-primary hover:text-white disabled:opacity-30 disabled:pointer-events-none active:scale-95"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-1">
            {pageNumbers.map((item, idx) => {
              if (item === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="flex h-10 w-8 items-center justify-center text-sm font-bold text-on-surface-variant/40 select-none"
                  >
                    ...
                  </span>
                )
              }

              const isActive = currentPage === item
              return (
                <button
                  key={item}
                  onClick={() => onPageChange(item)}
                  disabled={isRefetching}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'h-10 min-w-[2.5rem] px-2 rounded-xl text-xs font-black transition-all active:scale-95 disabled:pointer-events-none',
                    isActive
                      ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-[1.08]'
                      : 'bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-primary hover:text-primary',
                  )}
                >
                  {item}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages || isRefetching}
            aria-label={'Pr\u00F3xima p\u00E1gina'}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-lowest text-neutral-900 shadow-sm border border-outline-variant transition-all hover:bg-primary hover:text-white disabled:opacity-30 disabled:pointer-events-none active:scale-95"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>
    </div>
  )
}
