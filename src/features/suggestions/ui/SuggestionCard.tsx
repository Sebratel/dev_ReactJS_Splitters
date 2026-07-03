import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ChevronDown,
  Loader2,
  MessageCircle,
  Send,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import {
  type PlatformSuggestion,
  type PlatformSuggestionStatus,
  type PlatformSuggestionVoteType,
} from '@/features/suggestions/api/platformSuggestions'
import { SuggestionUserAvatar } from '@/features/suggestions/ui/SuggestionUserAvatar'
import { formatBrazilDateTimeShortDisplay } from '@/shared/lib/formatBrazilDisplayDate'
import { cn } from '@/shared/lib/utils'

type SuggestionCardProps = {
  suggestion: PlatformSuggestion
  readOnly?: boolean
  isAdmin: boolean
  voteBusy: boolean
  commentBusy: boolean
  statusBusy: boolean
  onVote: (suggestionId: number, voteType: PlatformSuggestionVoteType | 'none') => void
  onComment: (suggestionId: number, message: string) => void
  onStatusChange: (suggestionId: number, status: PlatformSuggestionStatus) => void
}

const STATUS_OPTIONS: Array<{ value: PlatformSuggestionStatus; label: string }> = [
  { value: 'open', label: 'Em análise' },
  { value: 'planned', label: 'Aprovada' },
  { value: 'in_progress', label: 'Em desenvolvimento' },
  { value: 'done', label: 'Concluída' },
  { value: 'rejected', label: 'Não será implementada' },
]

function formatSuggestionTimestamp(value: string | null): string {
  return formatBrazilDateTimeShortDisplay(value, 'Agora')
}

function statusMeta(status: PlatformSuggestionStatus): {
  label: string
  className: string
  accentClassName: string
} {
  switch (status) {
    case 'planned':
      return {
        label: 'Aprovada',
        className: 'border-sky-200 bg-sky-50 text-sky-800',
        accentClassName: 'from-sky-100/90 via-white to-white',
      }
    case 'in_progress':
      return {
        label: 'Em desenvolvimento',
        className: 'border-violet-200 bg-violet-50 text-violet-800',
        accentClassName: 'from-violet-100/90 via-white to-white',
      }
    case 'done':
      return {
        label: 'Concluída',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        accentClassName: 'from-emerald-100/90 via-white to-white',
      }
    case 'rejected':
      return {
        label: 'Não será implementada',
        className: 'border-rose-200 bg-rose-50 text-rose-800',
        accentClassName: 'from-rose-100/90 via-white to-white',
      }
    default:
      return {
        label: 'Em análise',
        className: 'border-amber-200 bg-amber-50 text-amber-900',
        accentClassName: 'from-amber-100/90 via-white to-white',
      }
  }
}

function buildNextVoteType(
  currentVote: PlatformSuggestionVoteType | null,
  requested: PlatformSuggestionVoteType,
): PlatformSuggestionVoteType | 'none' {
  return currentVote === requested ? 'none' : requested
}

export function SuggestionCard({
  suggestion,
  readOnly = false,
  isAdmin,
  voteBusy,
  commentBusy,
  statusBusy,
  onVote,
  onComment,
  onStatusChange,
}: SuggestionCardProps) {
  const reduceMotion = useReducedMotion()
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const meta = statusMeta(suggestion.status)
  const visibleSupporters = suggestion.supporters.slice(0, 5)

  return (
    <motion.article
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      className={cn(
        'overflow-hidden rounded-[28px] border border-amber-200/60 bg-gradient-to-br p-4 shadow-sm ring-1 ring-amber-100/60 transition sm:p-5',
        meta.accentClassName,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                meta.className,
              )}
            >
              {meta.label}
            </span>
            <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
              {suggestion.sector}
            </span>
            {suggestion.category ? (
              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                {suggestion.category}
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-950">
              {suggestion.title}
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
              {suggestion.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-neutral-500">
            <SuggestionUserAvatar
              user={{
                uid: suggestion.authorUid,
                email: suggestion.authorEmail,
                name: suggestion.authorName,
                photoURL: suggestion.authorPhotoURL,
              }}
              size="xs"
            />
            <span>
              Enviado por{' '}
              <span className="font-semibold text-neutral-700">
                {suggestion.authorName || suggestion.authorEmail}
              </span>{' '}
              em {formatSuggestionTimestamp(suggestion.createdAt)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center">
              {visibleSupporters.map((supporter, index) => (
                <SuggestionUserAvatar
                  key={`${suggestion.id}-${supporter.uid || supporter.email || supporter.name}-${index}`}
                  user={supporter}
                  size="xs"
                  className={index > 0 ? '-ml-2.5' : ''}
                />
              ))}
              {suggestion.likesCount > 0 ? (
                <span className="ml-2 text-xs text-neutral-600">
                  {suggestion.likesCount === 1
                    ? '1 pessoa apoiou'
                    : `${suggestion.likesCount} pessoas apoiaram`}
                </span>
              ) : (
                <span className="text-xs text-neutral-500">
                  {readOnly ? 'Nenhum apoio registrado' : 'Seja a primeira pessoa a apoiar'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCommentsOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/85 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-amber-300 hover:bg-amber-50"
            >
              <MessageCircle className="size-3.5" aria-hidden />
              {suggestion.commentsCount}{' '}
              {suggestion.commentsCount === 1 ? 'comentário' : 'comentários'}
              <ChevronDown
                className={cn(
                  'size-3.5 transition-transform',
                  commentsOpen ? 'rotate-180' : 'rotate-0',
                )}
                aria-hidden
              />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 rounded-3xl border border-neutral-200/80 bg-white/85 p-2.5 shadow-sm lg:w-[15rem]">
          <div className="rounded-2xl bg-neutral-50 px-3 py-2 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Score
            </p>
            <p
              className={cn(
                'text-2xl font-semibold',
                suggestion.score > 0
                  ? 'text-emerald-700'
                  : suggestion.score < 0
                    ? 'text-rose-700'
                    : 'text-neutral-800',
              )}
            >
              {suggestion.score > 0 ? `+${suggestion.score}` : suggestion.score}
            </p>
          </div>

          {isAdmin && !readOnly ? (
            <label className="space-y-1">
              <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Status
              </span>
              <select
                value={suggestion.status}
                disabled={statusBusy}
                onChange={(event) =>
                  onStatusChange(suggestion.id, event.target.value as PlatformSuggestionStatus)
                }
                className="min-h-[42px] w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200/70 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {!readOnly ? (
          <>
          <button
            type="button"
            disabled={voteBusy}
            onClick={() =>
              onVote(suggestion.id, buildNextVoteType(suggestion.viewerVote, 'like'))
            }
            className={cn(
              'inline-flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
              suggestion.viewerVote === 'like'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-emerald-200 hover:bg-emerald-50/60',
            )}
          >
            <span className="inline-flex items-center gap-2">
              {voteBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ThumbsUp className="size-4" aria-hidden />
              )}
              Apoiar
            </span>
            <span>{suggestion.likesCount}</span>
          </button>

          <button
            type="button"
            disabled={voteBusy}
            onClick={() =>
              onVote(suggestion.id, buildNextVoteType(suggestion.viewerVote, 'dislike'))
            }
            className={cn(
              'inline-flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
              suggestion.viewerVote === 'dislike'
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-rose-200 hover:bg-rose-50/60',
            )}
          >
            <span className="inline-flex items-center gap-2">
              {voteBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ThumbsDown className="size-4" aria-hidden />
              )}
              Não apoiar
            </span>
            <span>{suggestion.dislikesCount}</span>
          </button>
          </>
          ) : (
            <div className="space-y-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-center text-xs text-neutral-600">
              <p>
                <span className="font-semibold text-emerald-700">{suggestion.likesCount}</span> apoios
              </p>
              <p>
                <span className="font-semibold text-rose-700">{suggestion.dislikesCount}</span> não apoios
              </p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {commentsOpen ? (
          <motion.div
            key="comments"
            initial={reduceMotion ? false : { opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={reduceMotion ? undefined : { opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden border-t border-amber-100/90 pt-4"
          >
            <div className="space-y-3">
              <div className="space-y-2">
                {suggestion.comments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/80 px-4 py-3 text-sm text-neutral-500">
                    {readOnly
                      ? 'Ainda não há comentários nesta sugestão.'
                      : 'Ainda não há comentários. Seja a primeira pessoa a interagir.'}
                  </div>
                ) : (
                  suggestion.comments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-neutral-200/80 bg-white/90 px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <SuggestionUserAvatar user={comment.author} size="xs" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-neutral-800">
                              {comment.author.name || comment.author.email}
                            </span>
                            <span className="text-xs text-neutral-400">
                              {formatSuggestionTimestamp(comment.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">
                            {comment.message}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {!readOnly ? (
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const trimmed = commentDraft.trim()
                  setCommentError(null)
                  if (trimmed.length < 2) {
                    setCommentError('Escreva ao menos 2 caracteres para comentar.')
                    return
                  }
                  onComment(suggestion.id, trimmed)
                  setCommentDraft('')
                }}
              >
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder="Compartilhe contexto, complemente a ideia ou diga como isso impacta seu setor."
                  className="min-h-[110px] w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200/70"
                />
                {commentError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {commentError}
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={commentBusy}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-2xl bg-amber-400 px-4 py-2 text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {commentBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                    Comentar
                  </button>
                </div>
              </form>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  )
}
