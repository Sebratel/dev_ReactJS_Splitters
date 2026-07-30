import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { ExternalLink, Lightbulb, Search } from 'lucide-react'
import {
  fetchPlatformSuggestions,
  type PlatformSuggestionStatus,
} from '@/features/suggestions/api/platformSuggestions'
import { SuggestionCard } from '@/features/suggestions/ui/SuggestionCard'
import { cn } from '@/shared/lib/utils'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import { ResponsiveWrapper } from '@/shared/ui/ResponsiveWrapper'

const platformSuggestionsQueryKey = ['platform-suggestions'] as const

const SORT_OPTIONS = [
  { value: 'top', label: 'Top votos' },
  { value: 'recent', label: 'Recentes' },
] as const

const STATUS_FILTER_OPTIONS: Array<{ value: 'all' | PlatformSuggestionStatus; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Em análise' },
  { value: 'planned', label: 'Aprovadas' },
  { value: 'in_progress', label: 'Em desenvolvimento' },
  { value: 'done', label: 'Concluídas' },
  { value: 'rejected', label: 'Não serão implementadas' },
]

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR')
}

export function PlatformSuggestionsPage() {
  const reduceMotion = useReducedMotion()
  const [searchQuery, setSearchQuery] = useState('')
  const [sectorFilter, setSectorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | PlatformSuggestionStatus>('all')
  const [sortMode, setSortMode] = useState<(typeof SORT_OPTIONS)[number]['value']>('top')

  const suggestionsQuery = useQuery({
    queryKey: platformSuggestionsQueryKey,
    queryFn: fetchPlatformSuggestions,
    staleTime: 20_000,
  })

  const suggestions = suggestionsQuery.data?.suggestions ?? []
  const hubSuggestionsUrl = 'https://hub-apps.sebratel.net.br/sugestoes'

  const sectors = useMemo(() => {
    const set = new Set<string>()
    for (const suggestion of suggestions) {
      const normalized = suggestion.sector.trim()
      if (normalized !== '') set.add(normalized)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [suggestions])

  const visibleSuggestions = useMemo(() => {
    const text = normalizeText(searchQuery)
    const rows = suggestions.filter((suggestion) => {
      const sameSector = sectorFilter === 'all' || suggestion.sector === sectorFilter
      const sameStatus = statusFilter === 'all' || suggestion.status === statusFilter
      if (!sameSector || !sameStatus) return false
      if (text === '') return true
      const haystack = normalizeText(
        [
          suggestion.title,
          suggestion.description,
          suggestion.sector,
          suggestion.category ?? '',
          suggestion.authorName,
          ...suggestion.comments.map((comment) => comment.message),
        ].join(' '),
      )
      return haystack.includes(text)
    })

    rows.sort((a, b) => {
      if (sortMode === 'recent') {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tb - ta
      }
      if (b.score !== a.score) return b.score - a.score
      if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount
      return (b.commentsCount ?? 0) - (a.commentsCount ?? 0)
    })
    return rows
  }, [searchQuery, sectorFilter, sortMode, statusFilter, suggestions])

  const totals = useMemo(() => {
    const rows = suggestions
    return rows.reduce(
      (acc, suggestion) => {
        acc.votes += suggestion.likesCount + suggestion.dislikesCount
        acc.comments += suggestion.commentsCount
        return acc
      },
      { votes: 0, comments: 0 },
    )
  }, [suggestions])

  return (
    <ResponsiveWrapper>
      <div className="mx-auto max-w-[1600px] min-w-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <AppPageHeader
          icon={Lightbulb}
          badge="Colaboração"
          title="Sugestões da plataforma"
          description="Visualize as ideias da comunidade. Para enviar sugestões, votar ou comentar, acesse o Hub Apps."
          primaryAction={{ to: '/', label: 'Voltar ao painel' }}
          trailing={
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-amber-200/90 bg-white/85 px-3 py-2 text-xs font-semibold text-amber-950 shadow-sm">
                {suggestions.length} ideias
              </span>
              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white/85 px-3 py-2 text-xs font-semibold text-neutral-700 shadow-sm">
                {totals.votes} votos
              </span>
              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white/85 px-3 py-2 text-xs font-semibold text-neutral-700 shadow-sm">
                {totals.comments} comentários
              </span>
            </div>
          }
        />

        <section>
          <div className="space-y-4">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
              className="rounded-[28px] border border-amber-200/70 bg-gradient-to-br from-white via-amber-50/35 to-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-3">
                <div className="flex min-h-[46px] items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3 shadow-sm">
                  <Search className="size-4 text-neutral-500" aria-hidden />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Pesquisar sugestões, comentários ou setores"
                    className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSortMode(option.value)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                        sortMode === option.value
                          ? 'border-amber-700 bg-amber-700 text-white shadow-sm'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-amber-200 hover:bg-amber-50',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                  <a
                    href={hubSuggestionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Abrir no Hub Apps
                  </a>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <select
                    value={sectorFilter}
                    onChange={(event) => setSectorFilter(event.target.value)}
                    className="min-h-[46px] rounded-2xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200/70"
                  >
                    <option value="all">Todos os setores</option>
                    {sectors.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as 'all' | PlatformSuggestionStatus)
                    }
                    className="min-h-[46px] rounded-2xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200/70"
                  >
                    {STATUS_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>

            {suggestionsQuery.isLoading ? (
              <div className="rounded-[28px] border border-neutral-200 bg-white px-4 py-10 text-sm text-neutral-600 shadow-sm">
                Carregando sugestões...
              </div>
            ) : suggestionsQuery.isError ? (
              <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm">
                {suggestionsQuery.error instanceof Error
                  ? suggestionsQuery.error.message
                  : 'Falha ao carregar sugestões.'}
              </div>
            ) : visibleSuggestions.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-600 shadow-sm">
                Nenhuma sugestão encontrada com os filtros atuais.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleSuggestions.map((suggestion, index) => (
                  <motion.div
                    key={suggestion.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: reduceMotion ? 0 : index * 0.03 }}
                  >
                    <SuggestionCard
                      suggestion={suggestion}
                      readOnly
                      isAdmin={false}
                      voteBusy={false}
                      commentBusy={false}
                      statusBusy={false}
                      onVote={() => undefined}
                      onComment={() => undefined}
                      onStatusChange={() => undefined}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </ResponsiveWrapper>
  )
}
