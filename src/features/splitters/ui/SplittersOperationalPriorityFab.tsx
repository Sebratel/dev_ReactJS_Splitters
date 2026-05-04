import { useEffect, useMemo, useRef, useState } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Activity, KeyRound, Loader2, X } from 'lucide-react'
import type { OperationalPriorityQueueData } from '@/features/splitters/hooks/useSplittersOperationalPriorityQueue'
import { OperationalScoreHealthDots } from '@/features/splitters/ui/OperationalScoreHealthDots'
import { scoreToneClassName } from '@/features/splitters/ui/operationalScoreVisual'
import { resolveAccessRequestFabImageSrc } from '@/shared/lib/accessRequestFabImage'
import { useFabPhotoDecodedGate } from '@/shared/hooks/useFabPhotoDecodedGate'
import { cn } from '@/shared/lib/utils'
import { FabAttentionMotion } from '@/shared/ui/FabAttentionMotion'
import { FabHintBalloon } from '@/shared/ui/FabHintBalloon'

const ISA_PRIORITY_IDLE_HINT =
  'Fico de olho na operação o tempo todo — já cruzei a base e separei quem mais precisa da sua atenção neste momento. Abra quando quiser revisar.'

const ISA_PRIORITY_LOADING_MSG =
  '⚙️ Cruzando os dados da fila da priorização… só um instantinho.'
const ISA_PRIORITY_READY_MSG = '✨ Prontinho por aqui — pode abrir e dar uma olhada 🙂'

const ISA_READY_PULSE_MS = 3000

type Props = {
  enabled: boolean
  totalCount: number
  reduceMotion: boolean | null
  query: UseQueryResult<OperationalPriorityQueueData, Error>
  /** When the splitters filters drawer is open, lift FAB so it does not cover "Aplicar" (all breakpoints). */
  filtersDrawerOpen?: boolean
}

export function SplittersOperationalPriorityFab({
  enabled,
  totalCount,
  reduceMotion,
  query,
  filtersDrawerOpen = false,
}: Props) {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [fabImgBroken, setFabImgBroken] = useState(false)
  const [isaReadyPulse, setIsaReadyPulse] = useState(false)
  const prevPriorityLoadingRef = useRef<boolean | null>(null)

  const loadingPriorityIsa = useMemo(
    () =>
      query.isPending ||
      (query.fetchStatus === 'fetching' && query.dataUpdatedAt === 0),
    [query.isPending, query.fetchStatus, query.dataUpdatedAt],
  )

  useEffect(() => {
    const prev = prevPriorityLoadingRef.current
    prevPriorityLoadingRef.current = loadingPriorityIsa

    if (prev !== true || loadingPriorityIsa || !query.isSuccess) return

    setIsaReadyPulse(true)
    const id = window.setTimeout(() => setIsaReadyPulse(false), ISA_READY_PULSE_MS)
    return () => window.clearTimeout(id)
  }, [loadingPriorityIsa, query.isSuccess])

  const isaBalloonLabel = loadingPriorityIsa
    ? ISA_PRIORITY_LOADING_MSG
    : isaReadyPulse
      ? ISA_PRIORITY_READY_MSG
      : ISA_PRIORITY_IDLE_HINT

  const isaBalloonPinned = (loadingPriorityIsa || isaReadyPulse) && !open

  const fabImageSrc = useMemo(() => resolveAccessRequestFabImageSrc(), [])

  const showPhotoFab = Boolean(fabImageSrc && !fabImgBroken)
  const { fabImageDecoded, onFabPhotoLoad, onFabPhotoError } = useFabPhotoDecodedGate(
    showPhotoFab,
    fabImageSrc,
  )
  /** Círculo, badges e balão só aparecem com a foto pronta (evita “aro” vazio). */
  const fabChromeVisible = !showPhotoFab || fabImageDecoded

  useEffect(() => {
    setFabImgBroken(false)
  }, [fabImageSrc])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!enabled) return null

  const entries = query.data?.entries ?? []
  const meta = query.data
  const hasResults = entries.length > 0

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
          'fixed z-[60] flex w-[min(calc(100vw-2rem),42rem)] max-w-[calc(100vw-2rem)] flex-col items-end gap-2.5 right-[max(1.25rem,env(safe-area-inset-right))]',
          filtersDrawerOpen
            ? 'bottom-[max(10rem,calc(env(safe-area-inset-bottom)+8rem))]'
            : 'bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+3.25rem))]',
        )}
      >
        {open ? (
          <div
            id="splitters-priority-fab-panel"
            className="w-full min-w-0 overflow-hidden rounded-2xl border border-rose-200/90 bg-gradient-to-b from-rose-50/98 to-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-rose-950/[0.06]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="splitters-priority-fab-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-rose-100/90 bg-white/80 px-3.5 py-2.5">
              <h2
                id="splitters-priority-fab-title"
                className="min-w-0 flex-1 text-xs font-semibold tracking-tight text-rose-950"
              >
                {"Fila de prioriza\u00E7\u00E3o operacional"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-7 items-center justify-center rounded-lg text-rose-600/80 transition hover:bg-rose-100 hover:text-rose-950"
                aria-label="Fechar"
              >
                <X className="size-4" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="max-h-[min(72vh,32rem)] overflow-x-hidden overflow-y-auto overscroll-contain px-3.5 py-3">
              {query.isLoading ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-outline-variant/50 bg-white/90 px-3 py-2.5 text-[11px] text-on-surface shadow-sm">
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" aria-hidden />
                  <div>
                    <p className="font-semibold text-neutral-900">A calcular a fila…</p>
                    <p className="mt-1 leading-relaxed text-neutral-600">
                      Um pedido ao BFF sobre o universo filtrado; com muitos equipamentos pode levar alguns
                      segundos.
                    </p>
                  </div>
                </div>
              ) : null}

              {query.isError ? (
                <div
                  className="rounded-xl border border-amber-200/90 bg-amber-50/95 px-3 py-2.5 text-[11px] text-amber-950"
                  role="alert"
                >
                  <p className="font-semibold">Indisponível</p>
                  <p className="mt-1 leading-relaxed text-amber-950/90">
                    O pedido a{' '}
                    <code className="rounded bg-amber-100/90 px-1 py-0.5 font-mono text-[10px]">
                      /api/splitters/operational-priority
                    </code>{' '}
                    falhou. Confirme o BFF em{' '}
                    <code className="rounded bg-amber-100/90 px-1 py-0.5 font-mono text-[10px]">
                      server/
                    </code>{' '}
                    ou{' '}
                    <code className="rounded bg-amber-100/90 px-1 py-0.5 font-mono text-[10px]">
                      VITE_LOCAL_BFF_URL
                    </code>
                    .{' '}
                    {query.error instanceof Error ? `(${query.error.message})` : null}
                  </p>
                </div>
              ) : null}

              {query.isSuccess && !hasResults ? (
                <p className="rounded-xl border border-outline-variant/50 bg-surface-container-low/90 px-3 py-2.5 text-[11px] leading-relaxed text-on-surface-variant">
                  O BFF respondeu sem linhas para ordenar ou o universo filtrado está vazio no servidor.
                  Confirme filtros e a rota de prioridade no Node.
                </p>
              ) : null}

              {query.isSuccess && hasResults ? (
                <div className="min-w-0 space-y-3">
                  <p className="break-words text-[10px] leading-relaxed text-rose-900/75">
                    {meta?.truncated
                      ? `Top 5 com base em ${meta.scannedCount.toLocaleString('pt-BR')} equipamentos lidos (total filtrado no servidor: ${(
                          meta?.totalCountFiltered ?? totalCount
                        ).toLocaleString('pt-BR')}).`
                      : `Top 5 por pontuação entre os ${(
                          meta?.scannedCount ?? totalCount
                        ).toLocaleString('pt-BR')} equipamentos dos filtros atuais.`}
                    {meta?.massivaSource === 'none' ? (
                      <span className="mt-1 block text-rose-800/80">
                        Histórico de massivas não configurado no BFF; a pontuação pode não refletir todos os
                        tickets em aberto.
                      </span>
                    ) : null}
                  </p>
                  <div className="grid min-w-0 gap-2">
                    {entries.map((entry, index) => (
                      <motion.div
                        key={String(entry.splitter.code ?? '')}
                        className="min-w-0"
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }
                        }
                      >
                        <Link
                          to={`/splitters/${encodeURIComponent(entry.splitter.code)}`}
                          state={{ splittersListHref: location.pathname + location.search }}
                          onClick={() => setOpen(false)}
                          className="block max-w-full min-w-0 rounded-xl border border-rose-200/85 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-rose-300 hover:bg-rose-50/50"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                            Prioridade {index + 1}
                          </p>
                          <p className="mt-1 break-words text-sm font-semibold text-neutral-900">
                            {entry.splitter.title || entry.splitter.code}
                          </p>
                          <p className="break-all font-mono text-[10px] text-neutral-500">
                            {entry.splitter.code}
                          </p>
                          <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                                scoreToneClassName(entry.operationalScore.tone),
                              )}
                              title={`Criticidade ${entry.operationalScore.score}`}
                            >
                              <Activity size={10} strokeWidth={2.25} className="shrink-0 opacity-90" />
                              {entry.operationalScore.label}
                              <OperationalScoreHealthDots
                                key={`prio-dots-${entry.splitter.code}-${entry.operationalScore.score}`}
                                score={entry.operationalScore.score}
                                tone={entry.operationalScore.tone}
                                className="ml-0.5"
                              />
                              <span className="sr-only">{` Score ${entry.operationalScore.score}`}</span>
                            </span>
                            <span className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-on-surface-variant/70">
                              {entry.massivaStats.openTickets} abertas
                            </span>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
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
          <div className="relative">
          {hasResults && query.isSuccess ? (
            <span
              className="absolute -right-0.5 -top-0.5 z-[1] size-3 rounded-full border-2 border-white bg-rose-500 shadow-sm"
              aria-hidden
            />
          ) : query.isLoading ? (
            <span
              className="absolute -right-0.5 -top-0.5 z-[1] flex size-3.5 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm"
              aria-hidden
            >
              <span className="size-2 animate-pulse rounded-full bg-primary" />
            </span>
          ) : query.isError ? (
            <span
              className="absolute -right-0.5 -top-0.5 z-[1] size-3 rounded-full border-2 border-white bg-amber-500 shadow-sm"
              aria-hidden
            />
          ) : null}

          <FabHintBalloon
            label={isaBalloonLabel}
            gateReady={fabImageDecoded}
            pinned={isaBalloonPinned}
            suppress={open}
            reduceMotion={reduceMotion}
          >
            <FabAttentionMotion pause={open} className="rounded-full">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(
                  'relative flex size-[4.5rem] shrink-0 items-center justify-center rounded-full transition',
                  showPhotoFab
                    ? 'border-0 bg-transparent p-0 shadow-[0_10px_28px_-6px_rgba(15,23,42,0.35)] hover:opacity-95'
                    : cn(
                        'border border-neutral-200/95 bg-white text-neutral-700 shadow-lg',
                        'hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950',
                        open && 'border-amber-300/80 bg-amber-50 text-amber-950',
                      ),
                )}
                aria-expanded={open}
                aria-controls={open ? 'splitters-priority-fab-panel' : undefined}
                aria-label={
                  open
                    ? 'Fechar fila de priorização operacional'
                    : 'Abrir fila de priorização operacional'
                }
              >
                {showPhotoFab ? (
                  <img
                    src={fabImageSrc}
                    alt=""
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    className="max-h-[4.25rem] max-w-[4.25rem] object-contain drop-shadow-md"
                    onLoad={onFabPhotoLoad}
                    onError={() => {
                      setFabImgBroken(true)
                      onFabPhotoError()
                    }}
                  />
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
