import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Activity, Bot, Download, GitBranch, KeyRound, Loader2, ListOrdered, Sparkles, X } from 'lucide-react'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import {
  fetchPlanningAssistantReplyFromLocalDb,
  normalizeIsaText,
  type PlanningAssistantReply,
} from '@/features/splitters/api/fetchPlanningAssistantReplyFromLocalDb'
import { fetchSplittersNetworkReliefQueueFromLocalDb } from '@/features/splitters/api/fetchSplittersNetworkReliefQueueFromLocalDb'
import type { OperationalPriorityQueueData } from '@/features/splitters/hooks/useSplittersOperationalPriorityQueue'
import type { NetworkReliefQueueData } from '@/features/splitters/hooks/useSplittersNetworkReliefQueue'
import { OperationalScoreHealthDots } from '@/features/splitters/ui/OperationalScoreHealthDots'
import { scoreToneClassName } from '@/features/splitters/ui/operationalScoreVisual'
import { BREAKPOINT_PX } from '@/shared/lib/breakpoints'
import { resolveAccessRequestFabImageSrc } from '@/shared/lib/accessRequestFabImage'
import { useFabPhotoDecodedGate } from '@/shared/hooks/useFabPhotoDecodedGate'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { cn } from '@/shared/lib/utils'
import { FabAttentionMotion } from '@/shared/ui/FabAttentionMotion'
import { FabHintBalloon } from '@/shared/ui/FabHintBalloon'

const ISA_PRIORITY_IDLE_HINT =
  'Fico de olho na operação o tempo todo — já cruzei a base e separei quem mais precisa da sua atenção neste momento. Abra quando quiser revisar.'

const ISA_PRIORITY_LOADING_MSG =
  '⚙️ Cruzando os dados da fila da priorização… só um instantinho.'
const ISA_PRIORITY_READY_MSG = '✨ Prontinho por aqui — pode abrir e dar uma olhada 🙂'

const ISA_READY_PULSE_MS = 3000

function csvEscape(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.setAttribute('download', filename)
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function AssistantSection(props: {
  title: string
  items?: string[]
  content?: string
  tone?: 'neutral' | 'info'
}) {
  const hasItems = Array.isArray(props.items) && props.items.length > 0
  const hasContent = Boolean(props.content?.trim())
  if (!hasItems && !hasContent) return null

  return (
    <section
      className={cn(
        'rounded-xl border px-3 py-2.5',
        props.tone === 'info'
          ? 'border-sky-200/85 bg-sky-50/60'
          : 'border-neutral-200/85 bg-neutral-50/70',
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-900/80">
        {props.title}
      </p>
      {hasContent ? (
        <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-800">
          {props.content}
        </p>
      ) : null}
      {hasItems ? (
        <ul className="mt-1.5 space-y-1.5 text-[12px] leading-relaxed text-neutral-800">
          {props.items?.map((item, index) => (
            <li key={`${index}:${item.slice(0, 120)}`} className="flex gap-2">
              <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-sky-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function buildNetworkReliefCsv(entries: readonly NetworkReliefQueueData['entries'][number][]): string {
  const header = [
    'Posicao',
    'Codigo',
    'Titulo',
    'TipoRegra',
    'Capacidade',
    'Ocupadas',
    'Livres',
    'VizinhosAmostrados',
    'RaioLinhaRetaMetros',
    'MaxRouteMetros',
  ]
  const rows = entries.map((entry, index) => {
    const ruleType = entry.ruleType === 'CONDOMINIUM' ? 'CONDOMINIO' : 'RUA'
    const freePorts = Math.max(0, entry.splitter.outPorts - entry.splitter.busyCount)
    return [
      String(index + 1),
      entry.splitter.code,
      entry.splitter.title,
      ruleType,
      String(entry.splitter.outPorts),
      String(entry.splitter.busyCount),
      String(freePorts),
      String(entry.straightNeighborsSampled),
      String(entry.neighborStraightRadiusScanned),
      String(entry.maxRouteMeters),
    ]
  })

  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
}

const ISA_ASSISTANT_SUGGESTIONS = [
  'Explique este splitter e diga se vale expansão ou remanejo.',
  'Quais fatores pesaram mais na fila de planejamento de rede?',
  'Compare os 3 casos mais críticos e sugira prioridade técnica.',
] as const

type ActiveFabPanel = 'operational' | 'relief' | 'assistant'

type Props = {
  enabled: boolean
  totalCount: number
  reduceMotion: boolean | null
  operationalQuery: UseQueryResult<OperationalPriorityQueueData, Error>
  reliefQueueQuery: UseInfiniteQueryResult<InfiniteData<NetworkReliefQueueData, unknown>, Error>
  /** When the splitters filters drawer is open, lift FAB so it does not cover "Aplicar" (all breakpoints). */
  filtersDrawerOpen?: boolean
  sidebarCollapsed?: boolean
  mobileNavOpen?: boolean
}

export function SplittersOperationalPriorityFab({
  enabled,
  totalCount,
  reduceMotion,
  operationalQuery,
  reliefQueueQuery,
  filtersDrawerOpen = false,
  sidebarCollapsed = false,
  mobileNavOpen = false,
}: Props) {
  const location = useLocation()
  const isDesktopLayout = useMediaQuery(`(min-width: ${BREAKPOINT_PX.xl}px)`)
  const isWideDesktop = useMediaQuery(`(min-width: ${BREAKPOINT_PX['2xl']}px)`)
  const canUsePlanningAssistant = useAccessAuthStore((s) =>
    s.hasPermission('canUsePlanningAssistant'),
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<ActiveFabPanel | null>(null)
  const [fabImgBroken, setFabImgBroken] = useState(false)
  const [isaReadyPulse, setIsaReadyPulse] = useState(false)
  const [reliefCsvExporting, setReliefCsvExporting] = useState(false)
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantSplitterCode, setAssistantSplitterCode] = useState('')
  const [assistantReply, setAssistantReply] = useState<PlanningAssistantReply | null>(null)
  const [assistantError, setAssistantError] = useState<string | null>(null)
  const [assistantLoading, setAssistantLoading] = useState(false)
  const prevPriorityLoadingRef = useRef<boolean | null>(null)

  const overlayOpen = menuOpen || activePanel !== null

  const loadingPriorityIsa = useMemo(
    () =>
      operationalQuery.isPending ||
      (operationalQuery.fetchStatus === 'fetching' && operationalQuery.dataUpdatedAt === 0),
    [
      operationalQuery.isPending,
      operationalQuery.fetchStatus,
      operationalQuery.dataUpdatedAt,
    ],
  )

  useEffect(() => {
    const prev = prevPriorityLoadingRef.current
    prevPriorityLoadingRef.current = loadingPriorityIsa

    if (prev !== true || loadingPriorityIsa || !operationalQuery.isSuccess) return

    setIsaReadyPulse(true)
    const id = window.setTimeout(() => setIsaReadyPulse(false), ISA_READY_PULSE_MS)
    return () => window.clearTimeout(id)
  }, [loadingPriorityIsa, operationalQuery.isSuccess])

  const isaBalloonLabel = loadingPriorityIsa
    ? ISA_PRIORITY_LOADING_MSG
    : isaReadyPulse
      ? ISA_PRIORITY_READY_MSG
      : ISA_PRIORITY_IDLE_HINT

  const isaBalloonPinned = (loadingPriorityIsa || isaReadyPulse) && !overlayOpen

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
    if (!overlayOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setActivePanel(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlayOpen])

  const operationalEntries = operationalQuery.data?.entries ?? []
  const operationalMeta = operationalQuery.data
  const hasOperationalResults = operationalEntries.length > 0

  const reliefPages: NetworkReliefQueueData[] = reliefQueueQuery.data?.pages ?? []
  const reliefEntries = reliefPages.flatMap((page) => page.entries)
  const reliefMeta = reliefPages[0]
  const reliefScannedCount = reliefPages.reduce(
    (sum, page) => sum + page.scannedCount,
    0,
  )
  const hasReliefResults = reliefEntries.length > 0

  const fabAriaLabel = (() => {
    if (activePanel === 'operational') return 'Fechar fila de priorização operacional'
    if (activePanel === 'relief') return 'Fechar fila de planejamento de rede'
    if (activePanel === 'assistant') return 'Fechar assistente ISA'
    if (menuOpen) return 'Fechar menu de filas'
    return 'Abrir menu de filas'
  })()

  const shouldLowerFabForNotebookSidebar =
    isDesktopLayout && !isWideDesktop && !sidebarCollapsed
  const [sidebarDockMetrics, setSidebarDockMetrics] = useState<{
    centerX: number
    bottomOffset: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!shouldLowerFabForNotebookSidebar) {
      setSidebarDockMetrics(null)
      return
    }

    const measure = () => {
      const dock = document.getElementById('splitters-sidebar-fab-dock')
      if (!dock) {
        setSidebarDockMetrics(null)
        return
      }

      const rect = dock.getBoundingClientRect()
      setSidebarDockMetrics({
        centerX: rect.left + rect.width / 2,
        bottomOffset: Math.max(12, window.innerHeight - rect.bottom),
      })
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [shouldLowerFabForNotebookSidebar])

  if (!enabled || mobileNavOpen) return null

  const isDockedOnSidebar = shouldLowerFabForNotebookSidebar && sidebarDockMetrics !== null

  const fabPositionStyle = (() => {
    if (isDockedOnSidebar && sidebarDockMetrics) {
      return {
        left: `${sidebarDockMetrics.centerX}px`,
        right: 'auto',
        top: 'auto',
        bottom: `${sidebarDockMetrics.bottomOffset}px`,
        transform: 'translateX(-50%)',
      }
    }

    if (isDesktopLayout) {
      return {
        left: sidebarCollapsed
          ? 'max(2.15rem, calc(env(safe-area-inset-left) + 1rem))'
          : 'max(8.15rem, calc(env(safe-area-inset-left) + 7rem))',
        right: 'auto',
        top: 'auto',
        bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 3.25rem))',
        transform: 'translateY(0)',
      }
    }

    return {
      left: 'auto',
      right: 'max(1rem, calc(env(safe-area-inset-right) + 0.85rem))',
      top: 'auto',
      bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 3.25rem))',
      transform: 'translateY(0)',
    }
  })()

  const handleFabPrimaryClick = () => {
    if (activePanel !== null) {
      setActivePanel(null)
      setMenuOpen(false)
      return
    }
    setMenuOpen((v) => !v)
  }

  const openOperationalPanel = () => {
    setMenuOpen(false)
    setActivePanel('operational')
  }

  const openReliefPanel = () => {
    setMenuOpen(false)
    setActivePanel('relief')
  }

  const openAssistantPanel = () => {
    setMenuOpen(false)
    setActivePanel('assistant')
  }

  const handleExportReliefCsv = async () => {
    if (reliefCsvExporting) return

    setReliefCsvExporting(true)
    try {
      const allEntries: NetworkReliefQueueData['entries'] = []
      let cursor = 0
      let hasMore = true

      while (hasMore) {
        const page = await fetchSplittersNetworkReliefQueueFromLocalDb({
          limit: 40,
          cursor,
          straightRadiusMeters: reliefMeta?.straightRadiusMeters ?? 500,
          maxRouteMeters: reliefMeta?.maxRouteMeters ?? 200,
        })
        allEntries.push(...page.entries)
        hasMore = page.hasMore && page.nextCursor !== null
        cursor = page.nextCursor ?? 0
      }

      const csv = buildNetworkReliefCsv(allEntries)
      downloadCsv(`planejamento-rede-sem-alivio-${Date.now()}.csv`, csv)
    } finally {
      setReliefCsvExporting(false)
    }
  }

  /** Recalculado a cada render: assim hot reload e upgrades da normalização aplicam ao estado atual. */
  const assistantDisplayStructured =
    assistantReply === null
      ? null
      : {
          conclusao: normalizeIsaText(assistantReply.structuredAnswer?.conclusao),
          fatores: (assistantReply.structuredAnswer?.fatores ?? []).map((item) =>
            normalizeIsaText(item),
          ),
          lacunas: (assistantReply.structuredAnswer?.lacunas ?? []).map((item) =>
            normalizeIsaText(item),
          ),
          recomendacao: normalizeIsaText(assistantReply.structuredAnswer?.recomendacao),
        }

  const handleAssistantSubmit = async () => {
    const trimmedMessage = assistantInput.trim()
    if (trimmedMessage === '') {
      setAssistantError('Digite uma pergunta para a ISA.')
      return
    }

    setAssistantLoading(true)
    setAssistantError(null)
    try {
      const reply = await fetchPlanningAssistantReplyFromLocalDb({
        message: trimmedMessage,
        splitterCode: assistantSplitterCode.trim() || undefined,
        straightRadiusMeters: 500,
        maxRouteMeters: 200,
      })
      setAssistantReply(reply)
    } catch (error) {
      setAssistantError(
        error instanceof Error ? error.message : 'Falha ao consultar a ISA.',
      )
    } finally {
      setAssistantLoading(false)
    }
  }

  return (
    <>
      {overlayOpen ? (
        <div
          className="fixed inset-0 z-[55] bg-neutral-950/[0.12] backdrop-blur-[1px]"
          aria-hidden
          onClick={() => {
            setMenuOpen(false)
            setActivePanel(null)
          }}
        />
      ) : null}

        <div
          className={cn(
          'pointer-events-none fixed z-[60] flex max-w-[calc(100vw-2rem)] flex-col gap-2.5 transition-[left,right,top,bottom,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
          isDockedOnSidebar ? 'w-[min(calc(100vw-2rem),20rem)] items-center' : 'w-[min(calc(100vw-2rem),42rem)]',
          !isDockedOnSidebar && (isDesktopLayout ? 'items-start' : 'items-end'),
          filtersDrawerOpen
            ? 'bottom-[max(10rem,calc(env(safe-area-inset-bottom)+8rem))]'
            : '',
        )}
        style={fabPositionStyle}
      >
        {activePanel === 'operational' ? (
          <div
            id="splitters-priority-fab-panel"
            className="pointer-events-auto w-full min-w-0 overflow-hidden rounded-2xl border border-rose-200/90 bg-gradient-to-b from-rose-50/98 to-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-rose-950/[0.06]"
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
                onClick={() => setActivePanel(null)}
                className="flex size-7 items-center justify-center rounded-lg text-rose-600/80 transition hover:bg-rose-100 hover:text-rose-950"
                aria-label="Fechar"
              >
                <X className="size-4" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="max-h-[min(72vh,32rem)] overflow-x-hidden overflow-y-auto overscroll-contain px-3.5 py-3">
              {operationalQuery.isLoading ? (
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

              {operationalQuery.isError ? (
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
                    {operationalQuery.error instanceof Error
                      ? `(${operationalQuery.error.message})`
                      : null}
                  </p>
                </div>
              ) : null}

              {operationalQuery.isSuccess && !hasOperationalResults ? (
                <p className="rounded-xl border border-outline-variant/50 bg-surface-container-low/90 px-3 py-2.5 text-[11px] leading-relaxed text-on-surface-variant">
                  O BFF respondeu sem linhas para ordenar ou o universo filtrado está vazio no servidor.
                  Confirme filtros e a rota de prioridade no Node.
                </p>
              ) : null}

              {operationalQuery.isSuccess && hasOperationalResults ? (
                <div className="min-w-0 space-y-3">
                  <p className="break-words text-[10px] leading-relaxed text-rose-900/75">
                    {operationalMeta?.truncated
                      ? `Top 5 com base em ${operationalMeta.scannedCount.toLocaleString('pt-BR')} equipamentos lidos (total filtrado no servidor: ${(
                          operationalMeta?.totalCountFiltered ?? totalCount
                        ).toLocaleString('pt-BR')}).`
                      : `Top 5 por pontuação entre os ${(
                          operationalMeta?.scannedCount ?? totalCount
                        ).toLocaleString('pt-BR')} equipamentos dos filtros atuais.`}
                    {operationalMeta?.massivaSource === 'none' ? (
                      <span className="mt-1 block text-rose-800/80">
                        Histórico de massivas não configurado no BFF; a pontuação pode não refletir todos os
                        tickets em aberto.
                      </span>
                    ) : null}
                  </p>
                  <div className="grid min-w-0 gap-2">
                    {operationalEntries.map((entry, index) => (
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
                          onClick={() => setActivePanel(null)}
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

        {activePanel === 'relief' ? (
          <div
            id="splitters-relief-fab-panel"
            className="pointer-events-auto w-full min-w-0 overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/98 to-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.22)] ring-1 ring-amber-950/[0.06]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="splitters-relief-fab-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-amber-100/90 bg-white/80 px-3.5 py-2.5">
              <h2
                id="splitters-relief-fab-title"
                className="min-w-0 flex-1 text-xs font-semibold tracking-tight text-amber-950"
              >
                Fila de planejamento de rede
              </h2>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="flex size-7 items-center justify-center rounded-lg text-amber-700/85 transition hover:bg-amber-100 hover:text-amber-950"
                aria-label="Fechar"
              >
                <X className="size-4" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="max-h-[min(72vh,32rem)] overflow-x-hidden overflow-y-auto overscroll-contain px-3.5 py-3">
              <p className="mb-3 rounded-xl border border-amber-100/90 bg-amber-50/60 px-3 py-2 text-[11px] leading-snug text-amber-950/95">
                <span className="font-semibold">CTOs secundários lotados</span> onde não há alívio: nem outro
                equipamento no <span className="font-semibold">mesmo condomínio</span> no cadastro (texto após
                RES./COND./ED.) com porta livre, nem vizinho com porta livre a até{' '}
                <span className="font-semibold">{reliefMeta?.maxRouteMeters ?? 200} m</span> por calçada (raio{' '}
                <span className="font-semibold">{reliefMeta?.straightRadiusMeters ?? 500} m</span> em linha reta).
                Indica onde vale planejar novo ponto ou remanejo — não mede fibra.
              </p>

              {reliefQueueQuery.isLoading ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-outline-variant/50 bg-white/90 px-3 py-2.5 text-[11px] text-on-surface shadow-sm">
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" aria-hidden />
                  <div>
                    <p className="font-semibold text-neutral-900">Carregando a lista…</p>
                    <p className="mt-1 leading-relaxed text-neutral-600">
                      Calcula distâncias no mapa; espere alguns segundos.
                    </p>
                  </div>
                </div>
              ) : null}

              {reliefQueueQuery.isError ? (
                <div
                  className="rounded-xl border border-amber-200/90 bg-amber-50/95 px-3 py-2.5 text-[11px] text-amber-950"
                  role="alert"
                >
                  <p className="font-semibold">Indisponível</p>
                  <p className="mt-1 leading-relaxed text-amber-950/90">
                    O pedido a{' '}
                    <code className="rounded bg-amber-100/90 px-1 py-0.5 font-mono text-[10px]">
                      /api/splitters/network-relief-queue
                    </code>{' '}
                    falhou. Confirme OSRM (
                    <code className="rounded bg-amber-100/90 px-1 py-0.5 font-mono text-[10px]">
                      OSRM_BASE_URL
                    </code>
                    ) no servidor.{' '}
                    {reliefQueueQuery.error instanceof Error
                      ? `(${reliefQueueQuery.error.message})`
                      : null}
                  </p>
                </div>
              ) : null}

              {reliefQueueQuery.isSuccess && !hasReliefResults ? (
                <p className="rounded-xl border border-outline-variant/50 bg-surface-container-low/90 px-3 py-2.5 text-[11px] leading-relaxed text-on-surface-variant">
                  Lista vazia: entre os equipamentos analisados, todos têm alívio (mesmo condomínio ou vizinho com
                  porta livre) ou nenhum encaixou na amostra.
                </p>
              ) : null}

              {reliefQueueQuery.isSuccess && hasReliefResults ? (
                <div className="min-w-0 space-y-2">
                  <p className="text-[10px] leading-relaxed text-amber-900/80">
                    Exibindo {reliefEntries.length} caso(s) sem alívio em {reliefPages.length} rodada(s),
                    com {reliefScannedCount} candidato(s) avaliados no total. Não usa filtros da listagem.
                  </p>
                  <div className="grid min-w-0 gap-2">
                    {reliefEntries.map((entry, index) => (
                      <motion.div
                        key={String(entry.splitter.code ?? '')}
                        className="min-w-0"
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: index * 0.04 }
                        }
                      >
                        <Link
                          to={`/splitters/${encodeURIComponent(entry.splitter.code)}`}
                          state={{ splittersListHref: location.pathname + location.search }}
                          onClick={() => setActivePanel(null)}
                          className="block max-w-full min-w-0 rounded-xl border border-amber-200/85 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/40"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                            #{index + 1}
                          </p>
                          <p className="mt-1 break-words text-sm font-semibold text-neutral-900">
                            {entry.splitter.title || entry.splitter.code}
                          </p>
                          <p className="break-all font-mono text-[10px] text-neutral-500">
                            {entry.splitter.code}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900/85">
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5">
                              <GitBranch size={10} strokeWidth={2.25} aria-hidden />
                              Lotado · {entry.splitter.busyCount}/{entry.splitter.outPorts}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-on-surface-variant/80">
                              Vizinhos amostrados: {entry.straightNeighborsSampled}
                            </span>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        void handleExportReliefCsv()
                      }}
                      disabled={reliefCsvExporting}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-[11px] font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {reliefCsvExporting ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          Exportando CSV...
                        </>
                      ) : (
                        <>
                          <Download className="size-4" aria-hidden />
                          Exportar CSV
                        </>
                      )}
                    </button>
                  </div>
                  {reliefQueueQuery.hasNextPage ? (
                    <button
                      type="button"
                      onClick={() => {
                        void reliefQueueQuery.fetchNextPage()
                      }}
                      disabled={reliefQueueQuery.isFetchingNextPage}
                      className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-[11px] font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {reliefQueueQuery.isFetchingNextPage ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          Carregando mais casos...
                        </>
                      ) : (
                        'Carregar mais'
                      )}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {activePanel === 'assistant' ? (
          <div
            id="splitters-assistant-fab-panel"
            className="pointer-events-auto w-full min-w-0 overflow-hidden rounded-2xl border border-sky-200/90 bg-gradient-to-b from-sky-50/98 to-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.22)] ring-1 ring-sky-950/[0.06]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="splitters-assistant-fab-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-sky-100/90 bg-white/80 px-3.5 py-2.5">
              <h2
                id="splitters-assistant-fab-title"
                className="min-w-0 flex-1 text-xs font-semibold tracking-tight text-sky-950"
              >
                Assistente ISA · Planejamento de rede
              </h2>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="flex size-7 items-center justify-center rounded-lg text-sky-700/85 transition hover:bg-sky-100 hover:text-sky-950"
                aria-label="Fechar"
              >
                <X className="size-4" strokeWidth={2} aria-hidden />
                </button>
              </div>

            <div className="max-h-[min(78vh,40rem)] overflow-x-hidden overflow-y-auto overscroll-contain px-3.5 py-3">
              <div className="space-y-3">
              <div className="rounded-xl border border-sky-100/90 bg-sky-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-sky-950/95">
                <p className="font-semibold">Modo restrito ao planejamento de rede</p>
                <p className="mt-1">
                  Este painel fica pronto para a conversa com a ISA usando Gemini pelo backend interno.
                  O token nao sera exposto no browser.
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-neutral-200/90 bg-white px-3 py-3 text-[11px] text-neutral-700 shadow-sm">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-900">
                    <Bot size={15} strokeWidth={2} aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-neutral-900">Consulta assistida por Gemini</p>
                    <p className="mt-1 leading-relaxed">
                      A ISA consulta o backend interno com contexto determinístico de rede e devolve uma análise
                      explicativa. O token fica só no servidor.
                    </p>
                  </div>
                </div>

                <label className="grid gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Código do splitter
                  </span>
                  <input
                    value={assistantSplitterCode}
                    onChange={(e) => setAssistantSplitterCode(e.target.value)}
                    placeholder="Opcional. Ex.: SLE-C-1966-4-9-12/5 ou 10675"
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[12px] text-neutral-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-500/15"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Pergunta ao assistente
                  </span>
                  <textarea
                    value={assistantInput}
                    onChange={(e) => setAssistantInput(e.target.value)}
                    placeholder="Ex.: Este splitter realmente precisa expansão ou existe alternativa operacional?"
                    rows={5}
                    className="resize-y rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[12px] leading-relaxed text-neutral-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-500/15"
                  />
                </label>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      void handleAssistantSubmit()
                    }}
                    disabled={assistantLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-950 shadow-sm transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {assistantLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Consultando ISA...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" aria-hidden />
                        Perguntar à ISA
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800/80">
                  Perguntas iniciais sugeridas
                </p>
                <div className="grid gap-2">
                  {ISA_ASSISTANT_SUGGESTIONS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setAssistantInput(prompt)}
                      className="rounded-xl border border-sky-200/85 bg-white px-3 py-2 text-left text-[11px] font-medium text-neutral-800 shadow-sm transition hover:bg-sky-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {assistantError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-relaxed text-rose-950">
                  {assistantError}
                </div>
              ) : null}

                {assistantReply && assistantDisplayStructured ? (
                  <div className="space-y-2 rounded-xl border border-sky-200/85 bg-white px-3 py-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-sky-800/80">
                      <span className="font-bold">Resposta da ISA</span>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 normal-case tracking-normal text-sky-950">
                      {assistantReply.model}
                    </span>
                    {assistantReply.contextPreview?.splitterCode ? (
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 normal-case tracking-normal text-neutral-700">
                        Contexto: {assistantReply.contextPreview.splitterCode}
                      </span>
                    ) : null}
                  </div>
                  <AssistantSection
                    title="Conclusao"
                    content={assistantDisplayStructured.conclusao}
                    tone="info"
                  />
                  <AssistantSection
                    title="Fatores considerados"
                    items={assistantDisplayStructured.fatores}
                  />
                  <AssistantSection
                    title="Lacunas ou riscos"
                    items={assistantDisplayStructured.lacunas}
                  />
                  <AssistantSection
                    title="Recomendacao pratica"
                    content={assistantDisplayStructured.recomendacao}
                  />
                </div>
              ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {menuOpen && activePanel === null ? (
          <div
            id="splitters-priority-fab-menu"
            role="menu"
            aria-label="Escolher painel da ISA"
            className="pointer-events-auto w-[min(calc(100vw-2rem),20rem)] overflow-hidden rounded-2xl border border-neutral-200/95 bg-white shadow-[0_12px_36px_-10px_rgba(15,23,42,0.28)] ring-1 ring-neutral-950/[0.04]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-neutral-100 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Painéis ISA</p>
            </div>
            <div className="flex flex-col p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={openOperationalPanel}
                className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-rose-50"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-800">
                  <ListOrdered size={16} strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-neutral-900">
                    Priorização operacional
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-neutral-600">
                    Top equipamentos por criticidade e massivas (filtros da lista).
                  </span>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={openReliefPanel}
                className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-amber-50"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-900">
                  <GitBranch size={16} strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-neutral-900">
                    Planejamento de rede (sem alívio roteado)
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-neutral-600">
                    Lotados sem porta livre próxima por calçada (OSRM).
                  </span>
                </span>
              </button>
              {canUsePlanningAssistant ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={openAssistantPanel}
                  className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-sky-50"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-900">
                    <Sparkles size={16} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-neutral-900">
                      Assistente ISA
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-neutral-600">
                      Análise assistida por IA para o time de planejamento de rede.
                    </span>
                  </span>
                </button>
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
            {hasOperationalResults && operationalQuery.isSuccess ? (
              <span
                className="absolute -right-0.5 -top-0.5 z-[1] size-3 rounded-full border-2 border-white bg-rose-500 shadow-sm"
                aria-hidden
              />
            ) : null}
            {hasReliefResults && reliefQueueQuery.isSuccess ? (
              <span
                className={cn(
                  'absolute z-[1] size-3 rounded-full border-2 border-white bg-amber-500 shadow-sm',
                  hasOperationalResults && operationalQuery.isSuccess
                    ? '-left-0.5 bottom-0'
                    : '-right-0.5 -top-0.5',
                )}
                aria-hidden
              />
            ) : null}
            {!hasOperationalResults &&
            !hasReliefResults &&
            (operationalQuery.isLoading || reliefQueueQuery.isLoading) &&
            !operationalQuery.isError &&
            !reliefQueueQuery.isError ? (
              <span
                className="absolute -right-0.5 -top-0.5 z-[1] flex size-3.5 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm"
                aria-hidden
              >
                <span className="size-2 animate-pulse rounded-full bg-primary" />
              </span>
            ) : null}
            {operationalQuery.isError ? (
              <span
                className="absolute -right-0.5 -top-0.5 z-[1] size-3 rounded-full border-2 border-white bg-amber-500 shadow-sm"
                aria-hidden
              />
            ) : null}
            {reliefQueueQuery.isError && !operationalQuery.isError ? (
              <span
                className="absolute -left-0.5 bottom-0 z-[1] size-3 rounded-full border-2 border-white bg-amber-600 shadow-sm"
                aria-hidden
              />
            ) : null}

            <FabHintBalloon
              label={isaBalloonLabel}
              gateReady={fabImageDecoded}
              pinned={isaBalloonPinned}
              suppress={overlayOpen}
              reduceMotion={reduceMotion}
              placement="right"
            >
              <FabAttentionMotion pause={overlayOpen} className="rounded-full">
                <button
                  type="button"
                  onClick={handleFabPrimaryClick}
                  className={cn(
                    'relative flex size-[5rem] shrink-0 items-center justify-center overflow-hidden rounded-full transition',
                    showPhotoFab
                      ? 'border border-white/45 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.82),rgba(198,226,255,0.34)_42%,rgba(157,187,255,0.18)_62%,rgba(120,146,214,0.12)_100%)] p-0 shadow-[0_18px_42px_-10px_rgba(15,23,42,0.42),inset_0_1px_0_rgba(255,255,255,0.75)] hover:scale-[1.02]'
                      : cn(
                          'border border-neutral-200/95 bg-white text-neutral-700 shadow-lg',
                          'hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950',
                          overlayOpen && 'border-amber-300/80 bg-amber-50 text-amber-950',
                        ),
                  )}
                  aria-expanded={overlayOpen}
                  aria-haspopup="true"
                  aria-controls={
                    activePanel === 'operational'
                      ? 'splitters-priority-fab-panel'
                      : activePanel === 'relief'
                        ? 'splitters-relief-fab-panel'
                        : activePanel === 'assistant'
                          ? 'splitters-assistant-fab-panel'
                          : menuOpen
                            ? 'splitters-priority-fab-menu'
                            : undefined
                  }
                  aria-label={fabAriaLabel}
                >
                  {showPhotoFab ? (
                    <>
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-[6%] rounded-full border border-white/35 shadow-[inset_0_0_22px_rgba(255,255,255,0.32)]"
                      />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-[14%] top-[8%] h-[24%] w-[44%] rounded-full bg-white/45 blur-[2px]"
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




