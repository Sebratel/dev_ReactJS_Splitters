import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useReducedMotion } from 'framer-motion'
import { useOutletContext } from 'react-router-dom'
import { KeyRound, Loader2, RefreshCw, Send, X } from 'lucide-react'
import {
  createSplittersAccessRequest,
  listSplittersAccessRequestsForUser,
} from '@/features/access/api/firestoreAccessRequests'
import { accessRequestQueryKeys } from '@/features/access/model/accessRequestKeys'
import type { SplittersAccessRequest, SplittersAccessRequestModuleId } from '@/features/access/model/access.types'
import {
  labelForRequestedModule,
  missingAccessRequestModuleOptions,
} from '@/features/access/model/accessRequestModules'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { cn } from '@/shared/lib/utils'
import { useFabPhotoDecodedGate } from '@/shared/hooks/useFabPhotoDecodedGate'
import { resolveAccessRequestFabImageSrc } from '@/shared/lib/accessRequestFabImage'
import { FabAttentionMotion } from '@/shared/ui/FabAttentionMotion'
import { FabHintBalloon } from '@/shared/ui/FabHintBalloon'
import { useShellFabLayout } from '@/shared/hooks/useShellFabLayout'

export function DashboardAccessRequestSection() {
  const user = useAccessAuthStore((s) => s.user)
  const profile = useAccessAuthStore((s) => s.profile)
  const isAdmin = useAccessAuthStore((s) => s.hasPermission('isAdmin'))
  const refreshProfile = useAccessAuthStore((s) => s.refreshProfile)
  const queryClient = useQueryClient()

  const outletContext = useOutletContext<{
    sidebarCollapsed?: boolean
    mobileNavOpen?: boolean
  }>()
  const sidebarCollapsed = outletContext?.sidebarCollapsed ?? false
  const mobileNavOpen = outletContext?.mobileNavOpen ?? false
  const { fabPositionStyle, isDockedOnSidebar, isDesktopLayout } = useShellFabLayout(sidebarCollapsed, {
    translateUpPx: 16,
  })
  const reduceMotion = useReducedMotion()

  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<Set<SplittersAccessRequestModuleId>>(() => new Set())
  const [formError, setFormError] = useState<string | null>(null)
  const [fabImgBroken, setFabImgBroken] = useState(false)

  const uid = user?.uid

  const fabImageSrc = useMemo(() => resolveAccessRequestFabImageSrc(), [])

  const moduleOptions = useMemo(
    () => (profile?.permissions ? missingAccessRequestModuleOptions(profile.permissions) : []),
    [profile?.permissions],
  )
  const allowedModuleIds = useMemo(() => new Set(moduleOptions.map((o) => o.id)), [moduleOptions])

  const showAccessCompleteMessage =
    isAdmin || (profile !== null && moduleOptions.length === 0)

  const fabHintLabel = useMemo(
    () =>
      showAccessCompleteMessage
        ? 'Oi! ✨ Você já está com acesso a tudo por aqui — pode usar a plataforma tranquilo(a).'
        : 'Oi — quando faltar alguma tela no seu perfil, me chama por aqui. Eu preparo o pedido de acesso e encaminho para o time analisar.',
    [showAccessCompleteMessage],
  )

  const mineQuery = useQuery({
    queryKey: accessRequestQueryKeys.mine(uid ?? ''),
    queryFn: () => listSplittersAccessRequestsForUser(uid!),
    enabled: Boolean(uid) && !isAdmin,
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: createSplittersAccessRequest,
    onSuccess: async () => {
      setMessage('')
      setSelected(new Set())
      setFormError(null)
      setOpen(false)
      if (uid) {
        await queryClient.invalidateQueries({ queryKey: accessRequestQueryKeys.mine(uid) })
      }
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : 'Não foi possível enviar a solicitação.')
    },
  })

  const pending = useMemo(
    () => mineQuery.data?.find((r) => r.status === 'pending') ?? null,
    [mineQuery.data],
  )

  const latestResolved = useMemo(() => {
    const list = mineQuery.data ?? []
    let best: SplittersAccessRequest | null = null
    let bestT = 0
    for (const r of list) {
      if (r.status !== 'approved' && r.status !== 'rejected') continue
      const t = r.reviewedAt?.getTime() ?? r.updatedAt?.getTime() ?? 0
      if (t >= bestT) {
        best = r
        bestT = t
      }
    }
    return best
  }, [mineQuery.data])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    setFabImgBroken(false)
  }, [fabImageSrc])

  const showPhotoFab = Boolean(uid && fabImageSrc && !fabImgBroken)
  const { fabImageDecoded, onFabPhotoLoad, onFabPhotoError } = useFabPhotoDecodedGate(
    showPhotoFab,
    fabImageSrc,
  )
  const fabChromeVisible = !showPhotoFab || fabImageDecoded

  if (!uid) return null

  if (mobileNavOpen) return null

  const showForm =
    !showAccessCompleteMessage && !pending && !mineQuery.isLoading && moduleOptions.length > 0

  const toggleModule = (id: SplittersAccessRequestModuleId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[55] bg-neutral-950/[0.12] backdrop-blur-[1px]"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          'pointer-events-none fixed z-[60] flex max-w-[calc(100vw-2rem)] flex-col gap-2.5 motion-safe:transition-[max-width,width] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none',
          isDockedOnSidebar
            ? 'w-[min(calc(100vw-2rem),20rem)] items-center'
            : 'w-[min(calc(100vw-2rem),20.5rem)]',
          !isDockedOnSidebar && (isDesktopLayout ? 'items-start' : 'items-end'),
        )}
        style={fabPositionStyle}
      >
        {open ? (
          <div
            id="access-request-fab-panel"
            className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-neutral-200/95 dark:border-white/10 bg-surface-container-lowest shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-neutral-950/[0.04]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-fab-panel-title"
          >
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 dark:border-white/5 px-3.5 py-2.5">
              <h2 id="access-fab-panel-title" className="text-xs font-semibold tracking-tight text-on-surface">
                Solicitar acesso
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-7 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-neutral-100 hover:text-on-surface"
                aria-label="Fechar"
              >
                <X className="size-4" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="max-h-[min(70vh,26rem)] overflow-y-auto overscroll-contain px-3.5 py-3 space-y-3">
              {mineQuery.isError ? (
                <p className="rounded-lg border border-rose-100 bg-rose-50/90 dark:bg-rose-950/40 px-2.5 py-2 text-[11px] leading-snug text-rose-900 dark:text-rose-200">
                  {mineQuery.error instanceof Error ? mineQuery.error.message : 'Erro ao carregar.'}
                </p>
              ) : null}

              {pending ? (
                <div className="rounded-lg border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/90 dark:bg-amber-950/40 px-2.5 py-2 text-[11px] text-amber-950">
                  <p className="font-semibold">Em análise</p>
                  <p className="mt-0.5 leading-relaxed text-amber-950/90">
                    Aguarde a resposta da administração.
                  </p>
                  {pending.requestedModules.length > 0 ? (
                    <ul className="mt-1.5 flex flex-wrap gap-1">
                      {pending.requestedModules.map((id) => (
                        <li
                          key={id}
                          className="rounded-md border border-amber-200/70 dark:border-amber-800/50 bg-surface-container-lowest/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-950"
                        >
                          {labelForRequestedModule(id)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {pending.message ? (
                    <p className="mt-1.5 border-t border-amber-200/50 dark:border-amber-800/50 pt-1.5 text-[10px] leading-relaxed text-on-surface-variant">
                      {pending.message}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {!pending && latestResolved?.status === 'approved' ? (
                <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/90 dark:bg-emerald-950/40 px-2.5 py-2 text-[11px] text-emerald-950">
                  <p className="font-semibold">Aprovado</p>
                  {latestResolved.adminNote ? (
                    <p className="mt-0.5 leading-relaxed">{latestResolved.adminNote}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void refreshProfile()}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-800/15 bg-surface-container-lowest px-2 py-1 text-[10px] font-bold text-emerald-950 shadow-sm hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40"
                  >
                    <RefreshCw className="size-3" aria-hidden />
                    Atualizar perfil
                  </button>
                </div>
              ) : null}

              {!pending && latestResolved?.status === 'rejected' ? (
                <div className="rounded-lg border border-rose-200/80 dark:border-rose-800/50 bg-rose-50/90 dark:bg-rose-950/40 px-2.5 py-2 text-[11px] text-rose-950">
                  <p className="font-semibold">Não aprovado</p>
                  {latestResolved.adminNote ? (
                    <p className="mt-0.5 leading-relaxed">{latestResolved.adminNote}</p>
                  ) : null}
                </div>
              ) : null}

              {showAccessCompleteMessage && !pending && !mineQuery.isLoading ? (
                <div className="rounded-lg border border-emerald-200/85 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50/95 dark:from-emerald-950/20 to-sky-50/60 dark:to-sky-950/20 px-2.5 py-3 text-[11px] leading-relaxed text-emerald-950 shadow-sm">
                  <p className="text-[12px] font-semibold tracking-tight">
                    {isAdmin ? '✨ Acesso completo' : '🎉 Tudo certo por aqui!'}
                  </p>
                  <p className="mt-2 text-emerald-950/[0.92]">
                    {isAdmin
                      ? 'Como administrador(a), você já dispõe de todos os módulos da plataforma — explore e gerencie à vontade.'
                      : 'Você já possui todos os módulos liberados para o seu perfil na plataforma. Aproveita e, se pintar algo fora da rotina, o time de apoio tá por perto também. 🙂'}
                  </p>
                </div>
              ) : null}

              {showForm ? (
                <form
                  className="space-y-2.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setFormError(null)
                    const trimmed = message.trim()
                    if (trimmed.length < 8) {
                      setFormError('Use pelo menos 8 caracteres na descrição.')
                      return
                    }
                    const modulesToSend = [...selected].filter((id) => allowedModuleIds.has(id))
                    if (modulesToSend.length === 0) {
                      setFormError('Marque ao menos um módulo.')
                      return
                    }
                    const displayName = profile?.displayName ?? ''
                    const email = user?.email ?? ''
                    createMutation.mutate({
                      uid,
                      email,
                      displayName,
                      message: trimmed,
                      requestedModules: modulesToSend,
                    })
                  }}
                >
                  <p className="text-[10px] font-medium leading-snug text-on-surface-variant">
                    Marque as <span className="font-semibold text-on-surface-variant">telas</span> que precisa
                    e descreva o contexto. A administração vê tudo na gestão de usuários.
                  </p>
                  <fieldset className="space-y-1.5">
                    <legend className="sr-only">Telas solicitadas</legend>
                    {moduleOptions.map((opt) => (
                      <label
                        key={opt.id}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-neutral-100 dark:border-white/5 bg-surface-container-low/40 px-2 py-1.5 transition hover:border-neutral-200 dark:hover:border-white/10 hover:bg-surface-container-low/90"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(opt.id)}
                          onChange={() => toggleModule(opt.id)}
                          className="mt-0.5 size-3.5 shrink-0 rounded border-neutral-300 text-amber-600 dark:text-amber-300 focus:ring-amber-500/30"
                        />
                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold leading-snug text-on-surface">
                            {opt.label}
                          </span>
                          {opt.hint ? (
                            <span className="mt-0.5 block text-[10px] leading-snug text-on-surface-variant">
                              {opt.hint}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <div>
                    <label className="text-[10px] font-semibold text-on-surface-variant" htmlFor="access-fab-message">
                      Descrição
                    </label>
                    <textarea
                      id="access-fab-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Motivo, equipe, urgência…"
                      className={cn(
                        'mt-1 w-full resize-none rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-2 py-1.5 text-[12px] text-on-surface placeholder:text-on-surface-variant/60',
                        'focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500/25',
                      )}
                    />
                    <p className="mt-0.5 text-[9px] tabular-nums text-on-surface-variant/60">
                      {message.trim().length}/2000
                    </p>
                  </div>
                  {formError ? (
                    <p className="text-[11px] text-rose-700 dark:text-rose-200" role="alert">
                      {formError}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-900/10 bg-amber-400 py-2 text-[11px] font-bold text-neutral-900 shadow-sm transition hover:bg-amber-500 disabled:opacity-55"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-3.5" aria-hidden />
                    )}
                    Enviar
                  </button>
                </form>
              ) : null}

              {!showForm && mineQuery.isLoading ? (
                <div className="flex items-center gap-2 py-2 text-[11px] text-on-surface-variant">
                  <Loader2 className="size-3.5 animate-spin text-amber-700 dark:text-amber-200" aria-hidden />
                  Carregando…
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {showPhotoFab && !fabImageDecoded ? (
          <img
            src={fabImageSrc}
            alt=""
            aria-hidden
            className="sr-only"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onLoad={onFabPhotoLoad}
            onError={() => {
              setFabImgBroken(true)
              onFabPhotoError()
            }}
          />
        ) : null}

        {fabChromeVisible ? (
          <div className="pointer-events-auto relative">
          {pending ? (
            <span
              className="absolute -right-0.5 -top-0.5 z-[1] size-3 rounded-full border-2 border-white bg-amber-500 shadow-sm"
              aria-hidden
            />
          ) : latestResolved?.status === 'rejected' ? (
            <span
              className="absolute -right-0.5 -top-0.5 z-[1] size-3 rounded-full border-2 border-white bg-rose-400 shadow-sm"
              aria-hidden
            />
          ) : null}
          <FabHintBalloon
            label={fabHintLabel}
            gateReady={fabImageDecoded}
            suppress={open}
            reduceMotion={reduceMotion}
            placement="right"
          >
            <FabAttentionMotion pause={open} className="rounded-full">
              <button
                type="button"
                onClick={() => {
                  setOpen((v) => !v)
                  setFormError(null)
                }}
                className={cn(
                  'relative flex size-[5rem] shrink-0 items-center justify-center overflow-hidden rounded-full transition',
                  showPhotoFab
                    ? 'border border-white/45 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.82),rgba(198,226,255,0.34)_42%,rgba(157,187,255,0.18)_62%,rgba(120,146,214,0.12)_100%)] p-0 shadow-[0_18px_42px_-10px_rgba(15,23,42,0.42),inset_0_1px_0_rgba(255,255,255,0.75)] hover:scale-[1.02]'
                    : cn(
                        'border border-neutral-200/95 dark:border-white/10 bg-surface-container-lowest text-on-surface-variant shadow-lg',
                        'hover:border-neutral-300 hover:bg-surface-container-low hover:text-neutral-950',
                        open && 'border-amber-300/80 bg-amber-50 dark:bg-amber-950/40 text-amber-950',
                      ),
                )}
                aria-expanded={open}
                aria-controls={open ? 'access-request-fab-panel' : undefined}
                aria-label={open ? 'Fechar solicitação de acesso' : 'Abrir solicitação de acesso'}
              >
                {showPhotoFab ? (
                  <>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-[6%] rounded-full border border-white/35 shadow-[inset_0_0_22px_rgba(255,255,255,0.32)]"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-[14%] top-[8%] h-[24%] w-[44%] rounded-full bg-surface-container-lowest/45 blur-[2px]"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute bottom-[12%] right-[16%] h-[22%] w-[30%] rounded-full bg-sky-200/25 blur-[6px]"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-[14%] rounded-full border border-sky-100/25"
                    />
                    <div className="relative z-[1] flex size-[4.15rem] items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.22),rgba(170,203,255,0.08)_48%,rgba(255,255,255,0)_76%)]">
                      <img
                        src={fabImageSrc}
                        alt=""
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                        className="max-h-[3.9rem] max-w-[3.9rem] object-contain drop-shadow-[0_6px_14px_rgba(64,85,140,0.22)]"
                        onLoad={onFabPhotoLoad}
                        onError={() => {
                          setFabImgBroken(true)
                          onFabPhotoError()
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <KeyRound className="size-9" strokeWidth={1.75} aria-hidden />
                )}
              </button>
            </FabAttentionMotion>
          </FabHintBalloon>
          </div>
        ) : null}
      </div>
    </>
  )
}
