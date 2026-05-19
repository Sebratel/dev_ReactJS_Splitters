import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { Lightbulb, Loader2, MessageSquareText, Search, Send, Sparkles } from 'lucide-react'
import {
  commentPlatformSuggestion,
  createPlatformSuggestion,
  fetchPlatformSuggestions,
  updatePlatformSuggestionStatus,
  votePlatformSuggestion,
  type PlatformSuggestionStatus,
  type PlatformSuggestionVoteType,
} from '@/features/suggestions/api/platformSuggestions'
import { SuggestionCard } from '@/features/suggestions/ui/SuggestionCard'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
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
  const queryClient = useQueryClient()
  const reduceMotion = useReducedMotion()
  const profile = useAccessAuthStore((s) => s.profile)
  const isAdmin = useAccessAuthStore((s) => s.hasPermission('isAdmin'))
  const [title, setTitle] = useState('')
  const [sector, setSector] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sectorFilter, setSectorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | PlatformSuggestionStatus>('all')
  const [sortMode, setSortMode] = useState<(typeof SORT_OPTIONS)[number]['value']>('top')

  const suggestionsQuery = useQuery({
    queryKey: platformSuggestionsQueryKey,
    queryFn: fetchPlatformSuggestions,
    staleTime: 20_000,
  })

  const refreshSuggestions = async () => {
    await queryClient.invalidateQueries({ queryKey: platformSuggestionsQueryKey })
  }

  const createMutation = useMutation({
    mutationFn: createPlatformSuggestion,
    onSuccess: async () => {
      setTitle('')
      setSector('')
      setCategory('')
      setDescription('')
      setFormError(null)
      await refreshSuggestions()
    },
    onError: (error) => {
      setFormError(
        error instanceof Error ? error.message : 'Nao foi possivel registrar a sugestao.',
      )
    },
  })

  const voteMutation = useMutation({
    mutationFn: votePlatformSuggestion,
    onSuccess: refreshSuggestions,
  })

  const commentMutation = useMutation({
    mutationFn: commentPlatformSuggestion,
    onSuccess: refreshSuggestions,
  })

  const statusMutation = useMutation({
    mutationFn: updatePlatformSuggestionStatus,
    onSuccess: refreshSuggestions,
  })

  const sectors = useMemo(() => {
    const set = new Set<string>()
    for (const suggestion of suggestionsQuery.data ?? []) {
      const normalized = suggestion.sector.trim()
      if (normalized !== '') set.add(normalized)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [suggestionsQuery.data])

  const visibleSuggestions = useMemo(() => {
    const text = normalizeText(searchQuery)
    const rows = (suggestionsQuery.data ?? []).filter((suggestion) => {
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
  }, [searchQuery, sectorFilter, sortMode, statusFilter, suggestionsQuery.data])

  const totals = useMemo(() => {
    const rows = suggestionsQuery.data ?? []
    return rows.reduce(
      (acc, suggestion) => {
        acc.votes += suggestion.likesCount + suggestion.dislikesCount
        acc.comments += suggestion.commentsCount
        return acc
      },
      { votes: 0, comments: 0 },
    )
  }, [suggestionsQuery.data])

  const pendingVoteId =
    voteMutation.isPending && typeof voteMutation.variables?.suggestionId === 'number'
      ? voteMutation.variables.suggestionId
      : null
  const pendingCommentId =
    commentMutation.isPending && typeof commentMutation.variables?.suggestionId === 'number'
      ? commentMutation.variables.suggestionId
      : null
  const pendingStatusId =
    statusMutation.isPending && typeof statusMutation.variables?.suggestionId === 'number'
      ? statusMutation.variables.suggestionId
      : null

  return (
    <ResponsiveWrapper>
      <div className="mx-auto max-w-[1600px] min-w-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <AppPageHeader
          icon={Lightbulb}
          badge="Colaboração"
          title="Sugestões da plataforma"
          description="Registre dores, melhorias e ideias. Agora com apoio visual, comentários e status para mostrar o que já entrou na fila do time."
          primaryAction={{ to: '/', label: 'Voltar ao painel' }}
          trailing={
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-amber-200/90 bg-white/85 px-3 py-2 text-xs font-semibold text-amber-950 shadow-sm">
                {suggestionsQuery.data?.length ?? 0} ideias
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

        <section className="grid gap-4 xl:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)]">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.24 }}
            className="space-y-4"
          >
            <div className="rounded-[28px] border border-amber-200/70 bg-gradient-to-br from-white via-amber-50/45 to-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-900">
                  <MessageSquareText className="size-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
                    Nova sugestão
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                    Compartilhe sua visão para melhorar a plataforma e o dia a dia dos setores.
                  </p>
                </div>
              </div>

              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  setFormError(null)

                  const trimmedTitle = title.trim()
                  const trimmedSector = sector.trim()
                  const trimmedCategory = category.trim()
                  const trimmedDescription = description.trim()

                  if (trimmedTitle.length < 5) {
                    setFormError('Use pelo menos 5 caracteres no título.')
                    return
                  }
                  if (trimmedSector.length < 2) {
                    setFormError('Informe o setor ou área impactada.')
                    return
                  }
                  if (trimmedDescription.length < 15) {
                    setFormError('Descreva a ideia com pelo menos 15 caracteres.')
                    return
                  }

                  createMutation.mutate({
                    title: trimmedTitle,
                    sector: trimmedSector,
                    category: trimmedCategory || undefined,
                    description: trimmedDescription,
                  })
                }}
              >
                <div className="space-y-1.5">
                  <label htmlFor="suggestion-title" className="text-xs font-semibold text-neutral-700">
                    Título da sugestão
                  </label>
                  <input
                    id="suggestion-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={191}
                    placeholder="Ex.: Atualização automática dos relatórios"
                    className="min-h-[46px] w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200/70"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="suggestion-sector" className="text-xs font-semibold text-neutral-700">
                      Departamento
                    </label>
                    <input
                      id="suggestion-sector"
                      value={sector}
                      onChange={(event) => setSector(event.target.value)}
                      maxLength={120}
                      placeholder="Ex.: Operações, NOC, Comercial"
                      className="min-h-[46px] w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200/70"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="suggestion-category" className="text-xs font-semibold text-neutral-700">
                      Categoria
                    </label>
                    <input
                      id="suggestion-category"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      maxLength={120}
                      placeholder="Ex.: Automação, UX, Infraestrutura"
                      className="min-h-[46px] w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200/70"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="suggestion-description"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    Descrição detalhada
                  </label>
                  <textarea
                    id="suggestion-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={6}
                    maxLength={8000}
                    placeholder="Descreva a dor atual, o impacto esperado e como isso ajudaria a equipe."
                    className="min-h-[160px] w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200/70"
                  />
                </div>

                {formError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {formError}
                  </div>
                ) : null}

                {createMutation.isSuccess ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    Sugestão enviada com sucesso.
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-neutral-500">
                    Publicando como{' '}
                    <span className="font-semibold text-neutral-700">
                      {profile?.displayName || profile?.email || 'usuário autenticado'}
                    </span>
                    .
                  </p>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-2 text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                    Enviar sugestão
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-[28px] border border-sky-200/70 bg-white/90 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
                  <Sparkles className="size-4" aria-hidden />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">Dica de sucesso</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                    Sugestões com contexto claro, impacto esperado e participação da comunidade
                    ajudam a priorizar o que entra em desenvolvimento primeiro.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

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
                      isAdmin={isAdmin}
                      voteBusy={pendingVoteId === suggestion.id}
                      commentBusy={pendingCommentId === suggestion.id}
                      statusBusy={pendingStatusId === suggestion.id}
                      onVote={(suggestionId, voteType) =>
                        voteMutation.mutate({ suggestionId, voteType: voteType as PlatformSuggestionVoteType | 'none' })
                      }
                      onComment={(suggestionId, message) =>
                        commentMutation.mutate({ suggestionId, message })
                      }
                      onStatusChange={(suggestionId, status) =>
                        statusMutation.mutate({ suggestionId, status })
                      }
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
