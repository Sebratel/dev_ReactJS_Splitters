import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
  type PlanningAssistantConversationTurn,
  type IsaCtoVizinhaAnalisada,
  normalizeIsaCapilaridade,
  normalizeIsaClassificacaoGeografica,
  normalizeIsaCtosVizinhasAnalisadas,
  normalizeIsaDecisaoOperacional,
  normalizeIsaGravidade,
  normalizeIsaScoreOperacional,
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
import { useShellFabLayout } from '@/shared/hooks/useShellFabLayout'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { cn } from '@/shared/lib/utils'
import { FabAttentionMotion } from '@/shared/ui/FabAttentionMotion'
import { FabHintBalloon } from '@/shared/ui/FabHintBalloon'
import { useSplittersFiltersStore } from '@/features/splitters/store/useSplittersFiltersStore'

const ISA_PRIORITY_IDLE_HINT =
  'Fico de olho na operação o tempo todo — já cruzei a base e separei quem mais precisa da sua atenção neste momento. Abra quando quiser revisar.'

const ISA_PRIORITY_LOADING_MSG =
  '⚙️ Cruzando os dados da fila da priorização… só um instantinho.'
const ISA_PRIORITY_READY_MSG = '✨ Prontinho por aqui — pode abrir e dar uma olhada 🙂'

const ISA_READY_PULSE_MS = 3000
const ISA_CONVERSATION_PROMPT_LIMIT = 20

function buildAssistantConversationTurn(
  prompt: string,
  reply: PlanningAssistantReply,
): PlanningAssistantConversationTurn {
  const structured = reply.structuredAnswer
  return {
    userPrompt: normalizeIsaText(prompt),
    assistantSummary: {
      conclusao: normalizeIsaText(structured?.conclusao),
      decisao_operacional: normalizeIsaDecisaoOperacional(structured?.decisao_operacional),
      acao_prioritaria: normalizeIsaText(structured?.acao_prioritaria),
      recomendacao: normalizeIsaText(structured?.recomendacao),
    },
  }
}

function getAssistantConversationWarning(promptCount: number): {
  tone: 'info' | 'warning' | 'danger'
  message: string
} | null {
  switch (promptCount) {
    case 15:
      return {
        tone: 'info',
        message:
          'Esta conversa está com 15 de 20 prompts. A ISA ainda mantém o contexto, mas já está perto do limite.',
      }
    case 18:
      return {
        tone: 'warning',
        message:
          'Atenção: esta conversa chegou a 18 de 20 prompts. Faltam poucas interações antes do reinício automático.',
      }
    case 19:
      return {
        tone: 'danger',
        message:
          'Você está no 19º prompt. Depois de completar o limite, a próxima pergunta reiniciará a conversa do zero.',
      }
    case 20:
      return {
        tone: 'danger',
        message:
          'Limite de 20 prompts atingido. A próxima pergunta reiniciará automaticamente a conversa.',
      }
    default:
      return null
  }
}

function AssistantConversationHistoryPreview(props: {
  history: PlanningAssistantConversationTurn[]
}) {
  if (props.history.length === 0) return null

  const recentTurns = props.history.slice(-3).reverse()

  return (
    <div className="rounded-xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-low/70 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          Últimas interações
        </p>
        <span className="text-[10px] text-on-surface-variant">
          mostrando {Math.min(props.history.length, 3)} de {props.history.length}
        </span>
      </div>

      <div className="mt-2 space-y-2">
        {recentTurns.map((turn, index) => (
          <div
            key={`${props.history.length - index}:${turn.userPrompt.slice(0, 48)}`}
            className="rounded-xl border border-white/80 dark:border-white/10 bg-surface-container-lowest/90 px-2.5 py-2 shadow-sm"
          >
            <p className="line-clamp-2 text-[11px] font-medium leading-relaxed text-on-surface">
              {turn.userPrompt}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {turn.assistantSummary?.decisao_operacional ? (
                <span className="rounded-full border border-sky-200 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-semibold text-sky-950 dark:text-sky-100">
                  {turn.assistantSummary.decisao_operacional.replaceAll('_', ' ')}
                </span>
              ) : null}
              {turn.assistantSummary?.acao_prioritaria ? (
                <span className="line-clamp-1 rounded-full border border-neutral-200 dark:border-white/10 bg-surface-container-low px-2 py-0.5 text-[10px] text-on-surface-variant">
                  {turn.assistantSummary.acao_prioritaria}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

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

function isaGravidadeBadgeClass(gravidade: string): string {
  switch (gravidade) {
    case 'critica':
      return 'border-rose-400/90 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100'
    case 'alta':
      return 'border-orange-300 bg-orange-50 dark:bg-orange-950/40 text-orange-950 dark:text-orange-100'
    case 'media':
      return 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100'
    case 'baixa':
      return 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100'
    default:
      return 'border-neutral-200 dark:border-white/10 bg-surface-container-low text-on-surface-variant'
  }
}

function isaCapilaridadeBadgeClass(capilaridade: string): string {
  switch (capilaridade) {
    case 'alta':
      return 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100'
    case 'media':
      return 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100'
    case 'baixa':
      return 'border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100'
    default:
      return 'border-neutral-200 dark:border-white/10 bg-surface-container-low text-on-surface-variant'
  }
}

function AssistantMetaPill(props: {
  label: string
  value?: string | number | null
  className?: string
}) {
  if (props.value == null || String(props.value).trim() === '') return null

  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide',
        props.className ?? 'border-neutral-200 dark:border-white/10 bg-surface-container-low text-on-surface-variant',
      )}
    >
      {props.label}: {props.value}
    </span>
  )
}

function AssistantMetricCard(props: {
  label: string
  value?: string | number | null
  tone?: 'sky' | 'violet' | 'emerald'
}) {
  if (props.value == null || String(props.value).trim() === '') return null

  const toneClassName =
    props.tone === 'violet'
      ? 'border-violet-200/90 dark:border-violet-800/50 bg-violet-50/55 dark:bg-violet-950/40'
      : props.tone === 'emerald'
        ? 'border-emerald-200/90 dark:border-emerald-800/50 bg-emerald-50/55 dark:bg-emerald-950/40'
        : 'border-sky-200/90 dark:border-sky-800/50 bg-sky-50/55 dark:bg-sky-950/40'

  return (
    <div className={cn('rounded-xl border px-3 py-2 shadow-sm', toneClassName)}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        {props.label}
      </p>
      <p className="mt-1 text-[12px] font-medium leading-relaxed text-on-surface">{props.value}</p>
    </div>
  )
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
          ? 'border-sky-200/85 dark:border-sky-800/50 bg-sky-50/60 dark:bg-sky-950/40'
          : 'border-neutral-200/85 dark:border-white/10 bg-surface-container-low/70',
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-900/80 dark:text-sky-200">
        {props.title}
      </p>
      {hasContent ? (
        <p className="mt-1.5 text-[12px] leading-relaxed text-on-surface">
          {props.content}
        </p>
      ) : null}
      {hasItems ? (
        <ul className="mt-1.5 space-y-1.5 text-[12px] leading-relaxed text-on-surface">
          {props.items?.map((item, index) => (
            <li key={`${index}:${item.slice(0, 120)}`} className="flex min-w-0 gap-2">
              <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-sky-500" />
              <span className="min-w-0 break-words">{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function AssistantNeighborCards(props: { rows: IsaCtoVizinhaAnalisada[] }) {
  if (props.rows.length === 0) return null

  return (
    <section className="rounded-xl border border-violet-200/90 dark:border-violet-800/50 bg-violet-50/45 dark:bg-violet-950/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-950/90 dark:text-violet-100">
          CTOs vizinhas analisadas
        </p>
        <span className="rounded-full border border-violet-200 dark:border-violet-800/50 bg-surface-container-lowest/80 px-2 py-0.5 text-[10px] font-medium text-violet-950 dark:text-violet-100">
          {props.rows.length} candidata(s)
        </span>
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-2">
        {props.rows.map((row, idx) => (
          <div
            key={`${idx}:${row.cto}`}
            className="rounded-xl border border-white/80 dark:border-white/10 bg-surface-container-lowest/85 px-3 py-2.5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 break-words text-[12px] font-semibold text-on-surface">
                {row.cto}
              </p>
              <span
                className={cn(
                  'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
                  isaCapilaridadeBadgeClass(row.viabilidade),
                )}
              >
                {row.viabilidade || 'N/A'}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              <span className="rounded-full border border-sky-200 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 font-medium text-sky-950 dark:text-sky-100">
                {row.distancia_operacional || 'Distância N/A'}
              </span>
              <span className="rounded-full border border-neutral-200 dark:border-white/10 bg-surface-container-low px-2 py-0.5 font-medium text-on-surface">
                Ocupação {row.ocupacao || 'N/A'}
              </span>
              <span className="rounded-full border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 font-medium text-emerald-950 dark:text-emerald-100">
                {row.capacidade_livre || 'Livre N/A'}
              </span>
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
              <span className="font-semibold text-on-surface">Geografia:</span>{' '}
              {row.classificacao_geografica
                ? row.classificacao_geografica.replaceAll('_', ' ')
                : 'N/A'}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function AssistantThinkingState(props: { splitterCode: string; question: string }) {
  const splitterCode = props.splitterCode.trim()
  const question = props.question.trim()

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-sky-200/90 dark:border-sky-800/50 bg-gradient-to-br from-sky-50/95 dark:from-sky-950/20 via-white dark:via-surface-container-lowest to-indigo-50/80 dark:to-indigo-950/20 px-3 py-3 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div
          className="relative mt-0.5 flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-sky-100 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200"
          aria-hidden
        >
          <motion.span
            className="absolute inset-0 rounded-2xl border border-sky-300/80"
            animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0.08, 0.55] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.span
            className="absolute inset-1 rounded-xl bg-gradient-to-br from-sky-200/70 dark:from-sky-900/30 to-indigo-200/70 dark:to-indigo-900/30"
            animate={{ rotate: [0, 180, 360] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          />
          <Bot className="relative z-[1] size-5" />
          <motion.span
            className="absolute right-1.5 top-1.5 z-[1] text-sky-700 dark:text-sky-200"
            animate={{ scale: [0.9, 1.15, 0.9], opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles className="size-3" />
          </motion.span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sky-950 dark:text-sky-100">ISA pensando na melhor leitura</p>
          <p className="mt-1 text-[11px] leading-relaxed text-sky-950/90 dark:text-sky-100">
            Cruzando contexto operacional, regra de ruas e histórico recente para responder com mais
            precisão.
          </p>
          {splitterCode ? (
            <p className="mt-1 text-[10px] text-on-surface-variant">
              Splitter em foco: <span className="font-semibold text-on-surface">{splitterCode}</span>
            </p>
          ) : null}
          {question ? (
            <p className="mt-1 line-clamp-2 text-[10px] text-on-surface-variant">
              Pergunta: {question}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="size-2 rounded-full bg-sky-500"
            animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.14 }}
          />
        ))}
        <span className="ml-1 text-[11px] text-on-surface-variant">
          Validando ruas, vizinhos e possibilidade de alívio...
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[
          'Lendo contexto do splitter',
          'Comparando rotas e ruas válidas',
          'Montando conclusão da ISA',
        ].map((step, index) => (
          <motion.div
            key={step}
            className="rounded-xl border border-white/80 dark:border-white/10 bg-surface-container-lowest/80 px-2.5 py-2 text-[10px] font-medium text-on-surface-variant shadow-sm"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.18 }}
          >
            {step}
          </motion.div>
        ))}
      </div>
    </motion.div>
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
  const canUsePlanningAssistant = useAccessAuthStore((s) =>
    s.hasPermission('canUsePlanningAssistant'),
  )
  const reliefExportOltSlot = useSplittersFiltersStore((s) =>
    typeof s.state.oltSlot === 'number' && Number.isFinite(s.state.oltSlot)
      ? s.state.oltSlot
      : null,
  )
  const reliefExportOltPort = useSplittersFiltersStore((s) =>
    typeof s.state.oltPort === 'number' && Number.isFinite(s.state.oltPort)
      ? s.state.oltPort
      : null,
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
  const [assistantConversationHistory, setAssistantConversationHistory] = useState<
    PlanningAssistantConversationTurn[]
  >([])
  const [assistantSessionNotice, setAssistantSessionNotice] = useState<string | null>(null)
  const prevPriorityLoadingRef = useRef<boolean | null>(null)
  const [assistantDockViewportW, setAssistantDockViewportW] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 0,
  )

  const isWideDesktop = useMediaQuery(`(min-width: ${BREAKPOINT_PX['2xl']}px)`)
  const isTallAssistantViewport = useMediaQuery('(min-height: 860px)')

  const assistantHasActivity =
    activePanel === 'assistant' &&
    (assistantLoading || assistantReply !== null || Boolean(assistantError))
  const assistantUsesWideDesktopLayout =
    activePanel === 'assistant' &&
    isWideDesktop &&
    isTallAssistantViewport &&
    assistantHasActivity

  const { fabPositionStyle, isDockedOnSidebar, isDesktopLayout, sidebarDockCenterX } =
    useShellFabLayout(sidebarCollapsed)

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if (!isDockedOnSidebar) return
    const snap = () => setAssistantDockViewportW(window.innerWidth)
    snap()
    window.addEventListener('resize', snap)
    return () => window.removeEventListener('resize', snap)
  }, [isDockedOnSidebar])

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
  const reliefSnapshotBuilding = reliefPages.some((page) => page.snapshotBuilding)
  const reliefSnapshotMissing = reliefPages.some((page) => page.snapshotMissing)
  const reliefSnapshotReady = Boolean(reliefMeta?.generatedAt)

  const fabAriaLabel = (() => {
    if (activePanel === 'operational') return 'Fechar fila de priorização operacional'
    if (activePanel === 'relief') return 'Fechar fila de planejamento de rede'
    if (activePanel === 'assistant') return 'Fechar assistente ISA'
    if (menuOpen) return 'Fechar menu de filas'
    return 'Abrir menu de filas'
  })()

  const fabShellWidthClass = (() => {
    if (activePanel === 'assistant') {
      if (assistantUsesWideDesktopLayout) return 'w-[min(calc(100vw-2rem),58rem)]'
      if (isDesktopLayout) {
        return assistantHasActivity
          ? 'w-[min(calc(100vw-2rem),44rem)]'
          : 'w-[min(calc(100vw-2rem),28rem)]'
      }
      return 'w-[min(calc(100vw-1rem),36rem)]'
    }
    if (isDockedOnSidebar) return 'w-[min(calc(100vw-2rem),20rem)]'
    return 'w-[min(calc(100vw-2rem),42rem)]'
  })()

  const isaAssistantPanelDockTranslateXp = useMemo(() => {
    if (
      !isDockedOnSidebar ||
      activePanel !== 'assistant' ||
      sidebarDockCenterX == null
    ) {
      return 0
    }
    const vw = assistantDockViewportW
    const pad = 20
    const maxRem = assistantUsesWideDesktopLayout ? 58 : assistantHasActivity ? 44 : 28
    const panelW = Math.min(vw - 32, maxRem * 16)
    if (panelW < 24) return 0

    const half = panelW / 2
    const naturalLeft = sidebarDockCenterX - half
    const naturalRight = sidebarDockCenterX + half
    const minShift = pad - naturalLeft
    const maxShift = vw - pad - naturalRight
    if (minShift <= maxShift) {
      if (minShift <= 0 && maxShift >= 0) return 0
      if (minShift > 0) return Math.round(minShift)
      return Math.round(maxShift)
    }
    return Math.round(minShift)
  }, [
    activePanel,
    assistantDockViewportW,
    assistantHasActivity,
    assistantUsesWideDesktopLayout,
    isDockedOnSidebar,
    sidebarDockCenterX,
  ])

  // Menu e painéis operacional/planejamento (largura ~20rem quando ancorados na
  // sidebar) não têm o auto-clamp do assistente. Com a sidebar estreita/encostada,
  // o popover centrado no FAB estourava para fora da tela à esquerda. Este shift
  // reposiciona para caber (mesma lógica do assistente, com a largura fixa deles).
  const dockNonAssistantTranslateXp = useMemo(() => {
    if (!isDockedOnSidebar || activePanel === 'assistant' || sidebarDockCenterX == null) return 0
    const vw = assistantDockViewportW
    const pad = 20
    const panelW = Math.min(vw - 32, 20 * 16)
    if (panelW < 24) return 0
    const half = panelW / 2
    const naturalLeft = sidebarDockCenterX - half
    const naturalRight = sidebarDockCenterX + half
    const minShift = pad - naturalLeft
    const maxShift = vw - pad - naturalRight
    if (minShift <= maxShift) {
      if (minShift <= 0 && maxShift >= 0) return 0
      if (minShift > 0) return Math.round(minShift)
      return Math.round(maxShift)
    }
    return Math.round(minShift)
  }, [isDockedOnSidebar, activePanel, sidebarDockCenterX, assistantDockViewportW])

  // Estilo do container dos popovers: no caso ancorado não-assistente, soma o
  // shift de clamp ao translateX(-50%) da posição base.
  const fabPanelContainerStyle: CSSProperties =
    isDockedOnSidebar && activePanel !== 'assistant' && dockNonAssistantTranslateXp !== 0
      ? { ...fabPositionStyle, transform: `translateX(-50%) translateX(${dockNonAssistantTranslateXp}px)` }
      : fabPositionStyle

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
          oltSlot: reliefExportOltSlot,
          oltPort: reliefExportOltPort,
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
          gravidade: normalizeIsaGravidade(assistantReply.structuredAnswer?.gravidade),
          classificacao_geografica: normalizeIsaClassificacaoGeografica(
            assistantReply.structuredAnswer?.classificacao_geografica,
          ),
          confianca: normalizeIsaText(assistantReply.structuredAnswer?.confianca),
          capilaridade: normalizeIsaCapilaridade(assistantReply.structuredAnswer?.capilaridade),
          distancia_operacional: normalizeIsaText(
            assistantReply.structuredAnswer?.distancia_operacional,
          ),
          distancia_cruzamento: normalizeIsaText(
            assistantReply.structuredAnswer?.distancia_cruzamento,
          ),
          angulo_vias: normalizeIsaText(assistantReply.structuredAnswer?.angulo_vias),
          decisao_operacional: normalizeIsaDecisaoOperacional(
            assistantReply.structuredAnswer?.decisao_operacional,
          ),
          viabilidade_remanejo: normalizeIsaCapilaridade(
            assistantReply.structuredAnswer?.viabilidade_remanejo,
          ),
          viabilidade_expansao: normalizeIsaCapilaridade(
            assistantReply.structuredAnswer?.viabilidade_expansao,
          ),
          justificativa_decisao: normalizeIsaText(
            assistantReply.structuredAnswer?.justificativa_decisao,
          ),
          acao_prioritaria: normalizeIsaText(assistantReply.structuredAnswer?.acao_prioritaria),
          score_operacional: normalizeIsaScoreOperacional(
            assistantReply.structuredAnswer?.score_operacional,
          ),
          justificativa_score: normalizeIsaText(
            assistantReply.structuredAnswer?.justificativa_score,
          ),
          ruas_identificadas: (assistantReply.structuredAnswer?.ruas_identificadas ?? []).map(
            (item) => normalizeIsaText(item),
          ),
          atendimento_prioritario: (
            assistantReply.structuredAnswer?.atendimento_prioritario ?? []
          ).map((item) => normalizeIsaText(item)),
          ctos_vizinhas_analisadas: normalizeIsaCtosVizinhasAnalisadas(
            assistantReply.structuredAnswer?.ctos_vizinhas_analisadas,
          ),
          fatores: (assistantReply.structuredAnswer?.fatores ?? []).map((item) =>
            normalizeIsaText(item),
          ),
          evidencias: (assistantReply.structuredAnswer?.evidencias ?? []).map((item) =>
            normalizeIsaText(item),
          ),
          inferencias: (assistantReply.structuredAnswer?.inferencias ?? []).map((item) =>
            normalizeIsaText(item),
          ),
          riscos: (assistantReply.structuredAnswer?.riscos ?? []).map((item) =>
            normalizeIsaText(item),
          ),
          lacunas: (assistantReply.structuredAnswer?.lacunas ?? []).map((item) =>
            normalizeIsaText(item),
          ),
          recomendacao: normalizeIsaText(assistantReply.structuredAnswer?.recomendacao),
        }
  const hasAssistantResponse = assistantReply !== null && assistantDisplayStructured !== null
  const assistantPromptCount = assistantConversationHistory.length
  const assistantLimitWarning = getAssistantConversationWarning(assistantPromptCount)

  const handleAssistantResetConversation = () => {
    setAssistantConversationHistory([])
    setAssistantReply(null)
    setAssistantError(null)
    setAssistantSessionNotice(
      'Conversa reiniciada. A próxima resposta da ISA vai considerar apenas a nova pergunta e o contexto atual.',
    )
  }

  const handleAssistantSubmit = async () => {
    const trimmedMessage = assistantInput.trim()
    if (trimmedMessage === '') {
      setAssistantError('Digite uma pergunta para a ISA.')
      return
    }

    let conversationHistoryForRequest = assistantConversationHistory
    let sessionNotice: string | null = null
    if (assistantConversationHistory.length >= ISA_CONVERSATION_PROMPT_LIMIT) {
      conversationHistoryForRequest = []
      sessionNotice =
        'A conversa anterior atingiu 20 prompts e foi reiniciada automaticamente antes desta nova pergunta.'
      setAssistantConversationHistory([])
      setAssistantReply(null)
    }

    setAssistantLoading(true)
    setAssistantError(null)
    setAssistantSessionNotice(sessionNotice)
    setAssistantInput('')
    try {
      const reply = await fetchPlanningAssistantReplyFromLocalDb({
        message: trimmedMessage,
        splitterCode: assistantSplitterCode.trim() || undefined,
        straightRadiusMeters: 500,
        maxRouteMeters: 200,
        conversationHistory: conversationHistoryForRequest,
      })
      setAssistantReply(reply)
      setAssistantConversationHistory([
        ...conversationHistoryForRequest,
        buildAssistantConversationTurn(trimmedMessage, reply),
      ])
    } catch (error) {
      setAssistantReply(null)
      setAssistantError(
        error instanceof Error ? error.message : 'Falha ao consultar a ISA.',
      )
    } finally {
      setAssistantLoading(false)
    }
  }

  if (!enabled || mobileNavOpen) return null

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
          'pointer-events-none fixed z-[60] flex max-w-[calc(100vw-2rem)] flex-col gap-2.5 motion-safe:transition-[max-width,width] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none',
          fabShellWidthClass,
          isDockedOnSidebar ? 'items-center' : isDesktopLayout ? 'items-start' : 'items-end',
          filtersDrawerOpen
            ? 'bottom-[max(10rem,calc(env(safe-area-inset-bottom)+8rem))]'
            : '',
        )}
        style={fabPanelContainerStyle}
      >
        {activePanel === 'operational' ? (
          <div
            id="splitters-priority-fab-panel"
            className="pointer-events-auto w-full min-w-0 overflow-hidden rounded-2xl border border-rose-200/90 dark:border-rose-800/50 bg-gradient-to-b from-rose-50/98 dark:from-rose-950/20 to-white dark:to-surface-container-lowest shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-rose-950/[0.06]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="splitters-priority-fab-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-rose-100/90 bg-surface-container-lowest/80 px-3.5 py-2.5">
              <h2
                id="splitters-priority-fab-title"
                className="min-w-0 flex-1 text-xs font-semibold tracking-tight text-rose-950 dark:text-rose-100"
              >
                {"Fila de prioriza\u00E7\u00E3o operacional"}
              </h2>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="flex size-7 items-center justify-center rounded-lg text-rose-600/80 dark:text-rose-300 transition hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:text-rose-950 dark:text-rose-100"
                aria-label="Fechar"
              >
                <X className="size-4" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="max-h-[min(72vh,32rem)] overflow-x-hidden overflow-y-auto overscroll-contain px-3.5 py-3">
              {operationalQuery.isLoading ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-lowest/90 px-3 py-2.5 text-[11px] text-on-surface shadow-sm">
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" aria-hidden />
                  <div>
                    <p className="font-semibold text-on-surface">A calcular a fila…</p>
                    <p className="mt-1 leading-relaxed text-on-surface-variant">
                      Um pedido ao BFF sobre o universo filtrado; com muitos equipamentos pode levar alguns
                      segundos.
                    </p>
                  </div>
                </div>
              ) : null}

              {operationalQuery.isError ? (
                <div
                  className="rounded-xl border border-amber-200/90 dark:border-amber-800/50 bg-amber-50/95 dark:bg-amber-950/40 px-3 py-2.5 text-[11px] text-amber-950 dark:text-amber-100"
                  role="alert"
                >
                  <p className="font-semibold">Indisponível</p>
                  <p className="mt-1 leading-relaxed text-amber-950/90 dark:text-amber-100">
                    O pedido a{' '}
                    <code className="rounded bg-amber-100/90 dark:bg-amber-950/50 px-1 py-0.5 font-mono text-[10px]">
                      /api/splitters/operational-priority
                    </code>{' '}
                    falhou. Confirme o BFF em{' '}
                    <code className="rounded bg-amber-100/90 dark:bg-amber-950/50 px-1 py-0.5 font-mono text-[10px]">
                      server/
                    </code>{' '}
                    ou{' '}
                    <code className="rounded bg-amber-100/90 dark:bg-amber-950/50 px-1 py-0.5 font-mono text-[10px]">
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
                  <p className="break-words text-[10px] leading-relaxed text-rose-900/75 dark:text-rose-200">
                    {operationalMeta?.truncated
                      ? `Top 5 com base em ${operationalMeta.scannedCount.toLocaleString('pt-BR')} equipamentos lidos (total filtrado no servidor: ${(
                          operationalMeta?.totalCountFiltered ?? totalCount
                        ).toLocaleString('pt-BR')}).`
                      : `Top 5 por pontuação entre os ${(
                          operationalMeta?.scannedCount ?? totalCount
                        ).toLocaleString('pt-BR')} equipamentos dos filtros atuais.`}
                    {operationalMeta?.massivaSource === 'none' ? (
                      <span className="mt-1 block text-rose-800/80 dark:text-rose-200">
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
                          className="block max-w-full min-w-0 rounded-xl border border-rose-200/85 dark:border-rose-800/50 bg-surface-container-lowest px-3 py-2.5 shadow-sm transition-colors hover:border-rose-300 hover:bg-rose-50/50 dark:hover:bg-rose-950/40"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-200">
                            Prioridade {index + 1}
                          </p>
                          <p className="mt-1 break-words text-sm font-semibold text-on-surface">
                            {entry.splitter.title || entry.splitter.code}
                          </p>
                          <p className="break-all font-mono text-[10px] text-on-surface-variant">
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
            className="pointer-events-auto w-full min-w-0 overflow-hidden rounded-2xl border border-amber-200/90 dark:border-amber-800/50 bg-gradient-to-b from-amber-50/98 dark:from-amber-950/20 to-white dark:to-surface-container-lowest shadow-[0_12px_40px_-12px_rgba(15,23,42,0.22)] ring-1 ring-amber-950/[0.06]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="splitters-relief-fab-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-amber-100/90 bg-surface-container-lowest/80 px-3.5 py-2.5">
              <h2
                id="splitters-relief-fab-title"
                className="min-w-0 flex-1 text-xs font-semibold tracking-tight text-amber-950 dark:text-amber-100"
              >
                Fila de planejamento de rede
              </h2>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="flex size-7 items-center justify-center rounded-lg text-amber-700/85 dark:text-amber-200 transition hover:bg-amber-100 dark:hover:bg-amber-950/50 hover:text-amber-950 dark:text-amber-100"
                aria-label="Fechar"
              >
                <X className="size-4" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="max-h-[min(72vh,32rem)] overflow-x-hidden overflow-y-auto overscroll-contain px-3.5 py-3">
              <p className="mb-3 rounded-xl border border-amber-100/90 bg-amber-50/60 dark:bg-amber-950/40 px-3 py-2 text-[11px] leading-snug text-amber-950/95 dark:text-amber-100">
                <span className="font-semibold">CTOs secundários lotados</span> onde não há alívio: nem outro
                equipamento no <span className="font-semibold">mesmo condomínio</span> no cadastro (texto após
                RES./COND./ED.) com porta livre, nem vizinho com porta livre a até{' '}
                <span className="font-semibold">{reliefMeta?.maxRouteMeters ?? 200} m</span> por calçada (raio{' '}
                <span className="font-semibold">{reliefMeta?.straightRadiusMeters ?? 200} m</span> em linha reta —
                mesma regra do mapa do splitter). A lista é espelho do alerta &quot;sem alívio&quot; do mapa (geocode + 200/30 m).
                Indica onde vale planejar novo ponto ou remanejo — não mede fibra.
              </p>

              {reliefQueueQuery.isLoading ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-lowest/90 px-3 py-2.5 text-[11px] text-on-surface shadow-sm">
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" aria-hidden />
                  <div>
                    <p className="font-semibold text-on-surface">Lendo a tabela…</p>
                    <p className="mt-1 leading-relaxed text-on-surface-variant">
                      Consulta rápida ao snapshot gravado no MySQL.
                    </p>
                  </div>
                </div>
              ) : null}

              {reliefQueueQuery.isSuccess && reliefSnapshotBuilding ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-lowest/90 px-3 py-2.5 text-[11px] text-on-surface shadow-sm">
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" aria-hidden />
                  <div>
                    <p className="font-semibold text-on-surface">Gravando snapshot no servidor…</p>
                    <p className="mt-1 leading-relaxed text-on-surface-variant">
                      {reliefMeta?.message ??
                        'Espelhando o mapa (OSRM + geocode de ruas + 200 m / 30 m). A captura em background pode levar mais tempo; a tela atualiza a cada poucos segundos.'}
                    </p>
                  </div>
                </div>
              ) : null}

              {reliefQueueQuery.isSuccess && reliefSnapshotMissing && !reliefSnapshotBuilding ? (
                <p className="rounded-xl border border-sky-200/90 dark:border-sky-800/50 bg-sky-50/95 dark:bg-sky-950/40 px-3 py-2.5 text-[11px] leading-relaxed text-sky-950 dark:text-sky-100">
                  {reliefMeta?.message ??
                    'Ainda não há snapshot na tabela (200 m). O servidor grava em background ao subir ou no cron; a primeira gravação leva alguns minutos (só OSRM, sem Nominatim).'}
                </p>
              ) : null}

              {reliefQueueQuery.isError ? (
                <div
                  className="rounded-xl border border-amber-200/90 dark:border-amber-800/50 bg-amber-50/95 dark:bg-amber-950/40 px-3 py-2.5 text-[11px] text-amber-950 dark:text-amber-100"
                  role="alert"
                >
                  <p className="font-semibold">Indisponível</p>
                  <p className="mt-1 leading-relaxed text-amber-950/90 dark:text-amber-100">
                    O pedido a{' '}
                    <code className="rounded bg-amber-100/90 dark:bg-amber-950/50 px-1 py-0.5 font-mono text-[10px]">
                      /api/splitters/network-relief-queue
                    </code>{' '}
                    falhou. Confirme OSRM (
                    <code className="rounded bg-amber-100/90 dark:bg-amber-950/50 px-1 py-0.5 font-mono text-[10px]">
                      OSRM_BASE_URL
                    </code>
                    ) no servidor.{' '}
                    {reliefQueueQuery.error instanceof Error
                      ? `(${reliefQueueQuery.error.message})`
                      : null}
                  </p>
                </div>
              ) : null}

              {reliefQueueQuery.isSuccess &&
              reliefSnapshotReady &&
              !reliefSnapshotBuilding &&
              !hasReliefResults ? (
                <p className="rounded-xl border border-outline-variant/50 bg-surface-container-low/90 px-3 py-2.5 text-[11px] leading-relaxed text-on-surface-variant">
                  Lista vazia: entre os equipamentos analisados, todos têm alívio (mesmo condomínio ou vizinho com
                  porta livre) ou nenhum encaixou na amostra.
                </p>
              ) : null}

              {reliefQueueQuery.isSuccess && reliefSnapshotReady && !reliefSnapshotBuilding && hasReliefResults ? (
                <div className="min-w-0 space-y-2">
                  <p className="text-[10px] leading-relaxed text-amber-900/80 dark:text-amber-200">
                    Exibindo {reliefEntries.length} caso(s) sem alívio em {reliefPages.length} rodada(s), com{' '}
                    <span className="tabular-nums">{reliefMeta?.scannedCount ?? reliefScannedCount}</span>{' '}
                    candidato(s) avaliados no snapshot global.
                    {reliefMeta?.ponFilterActive
                      ? ' Filtro de slot/PON OLT dos filtros da página aplicado aos casos da lista.'
                      : ' Demais filtros da listagem (cidade, rua, OLT primário…) não entraram neste painel.'}
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
                          className="block max-w-full min-w-0 rounded-xl border border-amber-200/85 dark:border-amber-800/50 bg-surface-container-lowest px-3 py-2.5 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/40 dark:hover:bg-amber-950/40"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                            #{index + 1}
                          </p>
                          <p className="mt-1 break-words text-sm font-semibold text-on-surface">
                            {entry.splitter.title || entry.splitter.code}
                          </p>
                          <p className="break-all font-mono text-[10px] text-on-surface-variant">
                            {entry.splitter.code}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900/85 dark:text-amber-200">
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5">
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
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-surface-container-lowest px-3 py-2 text-[11px] font-semibold text-amber-950 dark:text-amber-100 shadow-sm transition hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:cursor-not-allowed disabled:opacity-70"
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
                      className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-surface-container-lowest px-3 py-2 text-[11px] font-semibold text-amber-950 dark:text-amber-100 shadow-sm transition hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:cursor-not-allowed disabled:opacity-70"
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
            className="pointer-events-auto w-full min-w-0 overflow-hidden rounded-2xl border border-sky-200/90 dark:border-sky-800/50 bg-gradient-to-b from-sky-50/98 dark:from-sky-950/20 to-white dark:to-surface-container-lowest shadow-[0_12px_40px_-12px_rgba(15,23,42,0.22)] ring-1 ring-sky-950/[0.06]"
            style={
              isaAssistantPanelDockTranslateXp !== 0
                ? { transform: `translateX(${isaAssistantPanelDockTranslateXp}px)` }
                : undefined
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="splitters-assistant-fab-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-sky-100/90 bg-surface-container-lowest/80 px-3 py-2 sm:px-3.5 sm:py-2.5">
              <h2
                id="splitters-assistant-fab-title"
                className="min-w-0 flex-1 text-xs font-semibold tracking-tight text-sky-950 dark:text-sky-100"
              >
                Assistente ISA · Planejamento de rede
              </h2>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="flex size-7 items-center justify-center rounded-lg text-sky-700/85 dark:text-sky-200 transition hover:bg-sky-100 dark:hover:bg-sky-950/50 hover:text-sky-950 dark:text-sky-100"
                aria-label="Fechar"
              >
                <X className="size-4" strokeWidth={2} aria-hidden />
                </button>
              </div>

            <div className="max-h-[min(82dvh,44rem)] overflow-x-hidden overflow-y-auto overscroll-contain px-2.5 py-2.5 sm:px-3.5 sm:py-3">
              <div
                className={cn(
                  'grid gap-3',
                  assistantUsesWideDesktopLayout
                    ? '2xl:grid-cols-[minmax(18rem,21rem)_minmax(0,1fr)]'
                    : 'grid-cols-1',
                )}
              >
                <div
                  className={cn(
                    'space-y-3',
                    assistantUsesWideDesktopLayout && '2xl:sticky 2xl:top-0 2xl:self-start',
                  )}
                >
                  <div className="space-y-3 rounded-xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest px-3 py-3 text-[11px] text-on-surface-variant shadow-sm">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200">
                        <Bot size={15} strokeWidth={2} aria-hidden />
                      </span>
                      <div>
                        <p className="font-semibold text-on-surface">Consulta assistida por Gemini</p>
                        <p className="mt-1 leading-relaxed">
                          A ISA cruza contexto determinístico de rede e devolve uma análise mais objetiva
                          para planejamento.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-sky-100/90 bg-sky-50/75 dark:bg-sky-950/40 px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-900/80 dark:text-sky-200">
                            Conversa atual
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-sky-950/90 dark:text-sky-100">
                            A ISA reaproveita as perguntas anteriores desta conversa.
                          </p>
                        </div>
                        <span className="rounded-full border border-sky-200 dark:border-sky-800/50 bg-surface-container-lowest/85 px-2.5 py-1 text-[10px] font-semibold text-sky-950 dark:text-sky-100">
                          {assistantPromptCount}/{ISA_CONVERSATION_PROMPT_LIMIT} prompts
                        </span>
                      </div>
                      {assistantPromptCount > 0 ? (
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={handleAssistantResetConversation}
                            className="text-[10px] font-semibold text-sky-900 dark:text-sky-200 transition hover:text-sky-950 dark:text-sky-100"
                          >
                            Reiniciar conversa
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <label className="grid gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Splitter
                      </span>
                      <input
                        value={assistantSplitterCode}
                        onChange={(e) => setAssistantSplitterCode(e.target.value)}
                        placeholder="Opcional. Ex.: SLE-C-1966-4-9-12/5 ou 10675"
                        className="rounded-xl border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-[12px] text-on-surface shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-500/15"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Pergunta ao assistente
                      </span>
                      <textarea
                        value={assistantInput}
                        onChange={(e) => setAssistantInput(e.target.value)}
                        placeholder="Ex.: Este splitter realmente precisa expansão ou existe alternativa operacional?"
                        rows={4}
                        className="resize-y rounded-xl border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-[12px] leading-relaxed text-on-surface shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-500/15"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        void handleAssistantSubmit()
                      }}
                      disabled={assistantLoading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-950/40 px-3 py-2 text-[11px] font-semibold text-sky-950 dark:text-sky-100 shadow-sm transition hover:bg-sky-100 dark:hover:bg-sky-950/50 disabled:cursor-not-allowed disabled:opacity-70"
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

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800/80 dark:text-sky-200">
                      Perguntas iniciais sugeridas
                    </p>
                    <div className="grid gap-2">
                      {ISA_ASSISTANT_SUGGESTIONS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setAssistantInput(prompt)}
                          className="rounded-xl border border-sky-200/85 dark:border-sky-800/50 bg-surface-container-lowest px-3 py-2 text-left text-[11px] font-medium text-on-surface shadow-sm transition hover:bg-sky-50 dark:hover:bg-sky-950/40"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AssistantConversationHistoryPreview
                    history={assistantConversationHistory}
                  />
                </div>

                {assistantHasActivity ? (
                  <div className="min-w-0 space-y-3">
                  {assistantSessionNotice ? (
                    <div className="rounded-xl border border-sky-200 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-950/40 px-3 py-2 text-[11px] leading-relaxed text-sky-950 dark:text-sky-100">
                      {assistantSessionNotice}
                    </div>
                  ) : null}

                  {assistantLimitWarning ? (
                    <div
                      className={cn(
                        'rounded-xl border px-3 py-2 text-[11px] leading-relaxed',
                        assistantLimitWarning.tone === 'info'
                          ? 'border-sky-200 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100'
                          : assistantLimitWarning.tone === 'warning'
                            ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100'
                            : 'border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100',
                      )}
                    >
                      {assistantLimitWarning.message}
                    </div>
                  ) : null}

                  {assistantError ? (
                    <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-[11px] leading-relaxed text-rose-950 dark:text-rose-100">
                      {assistantError}
                    </div>
                  ) : null}

                  {assistantLoading ? (
                    <AssistantThinkingState
                      splitterCode={assistantSplitterCode}
                      question={assistantInput}
                    />
                  ) : null}

                  {hasAssistantResponse && assistantDisplayStructured ? (
                    <div className="space-y-3 rounded-xl border border-sky-200/85 dark:border-sky-800/50 bg-surface-container-lowest px-3 py-3 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-sky-800/80 dark:text-sky-200">
                        <span className="font-bold">Resposta da ISA</span>
                        <AssistantMetaPill
                          label="Modelo"
                          value={assistantReply.model}
                          className="border-sky-200 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100 normal-case tracking-normal"
                        />
                        <AssistantMetaPill
                          label="Contexto"
                          value={
                            assistantReply.contextPreview?.splitterTitle ||
                            assistantReply.contextPreview?.splitterCode
                          }
                          className="border-neutral-200 dark:border-white/10 bg-surface-container-low text-on-surface-variant normal-case tracking-normal"
                        />
                        <AssistantMetaPill
                          label="Gravidade"
                          value={assistantDisplayStructured.gravidade}
                          className={isaGravidadeBadgeClass(assistantDisplayStructured.gravidade)}
                        />
                        <AssistantMetaPill
                          label="Geo"
                          value={assistantDisplayStructured.classificacao_geografica.replaceAll('_', ' ')}
                          className="border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-950/40 text-violet-950 dark:text-violet-100"
                        />
                        <AssistantMetaPill
                          label="Capilaridade"
                          value={assistantDisplayStructured.capilaridade}
                          className={isaCapilaridadeBadgeClass(assistantDisplayStructured.capilaridade)}
                        />
                        <AssistantMetaPill
                          label="Confiança"
                          value={assistantDisplayStructured.confianca}
                          className="border-slate-200 dark:border-white/10 bg-surface-container-low text-on-surface"
                        />
                        <AssistantMetaPill
                          label="Score"
                          value={assistantDisplayStructured.score_operacional}
                          className="border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100"
                        />
                      </div>

                      <AssistantSection
                        title="Conclusão"
                        content={assistantDisplayStructured.conclusao}
                        tone="info"
                      />

                      {assistantDisplayStructured.decisao_operacional ||
                      assistantDisplayStructured.justificativa_decisao ||
                      assistantDisplayStructured.acao_prioritaria ||
                      assistantDisplayStructured.viabilidade_remanejo ||
                      assistantDisplayStructured.viabilidade_expansao ? (
                        <div className="rounded-xl border border-indigo-200/90 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/40 px-3 py-2.5 text-[11px] leading-relaxed text-on-surface">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-950/90 dark:text-indigo-100">
                            Decisão operacional
                          </p>
                          {assistantDisplayStructured.decisao_operacional ? (
                            <p className="mt-1.5 font-semibold text-indigo-950 dark:text-indigo-100">
                              {assistantDisplayStructured.decisao_operacional.replaceAll('_', ' ')}
                            </p>
                          ) : null}
                          <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-indigo-950/90 dark:text-indigo-100">
                            {assistantDisplayStructured.viabilidade_remanejo ? (
                              <span className="rounded-full border border-indigo-200 dark:border-indigo-800/50 bg-surface-container-lowest/80 px-2 py-0.5">
                                Remanejo: {assistantDisplayStructured.viabilidade_remanejo}
                              </span>
                            ) : null}
                            {assistantDisplayStructured.viabilidade_expansao ? (
                              <span className="rounded-full border border-indigo-200 dark:border-indigo-800/50 bg-surface-container-lowest/80 px-2 py-0.5">
                                Expansão: {assistantDisplayStructured.viabilidade_expansao}
                              </span>
                            ) : null}
                          </div>
                          {assistantDisplayStructured.justificativa_decisao ? (
                            <p className="mt-1.5">
                              <span className="font-semibold text-on-surface-variant">Justificativa:</span>{' '}
                              {assistantDisplayStructured.justificativa_decisao}
                            </p>
                          ) : null}
                          {assistantDisplayStructured.acao_prioritaria ? (
                            <p className="mt-1.5">
                              <span className="font-semibold text-on-surface-variant">Ação prioritária:</span>{' '}
                              {assistantDisplayStructured.acao_prioritaria}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="grid gap-2 sm:grid-cols-3">
                        <AssistantMetricCard
                          label="Distância operacional"
                          value={assistantDisplayStructured.distancia_operacional}
                        />
                        <AssistantMetricCard
                          label="Até cruzamento"
                          value={assistantDisplayStructured.distancia_cruzamento}
                          tone="violet"
                        />
                        <AssistantMetricCard
                          label="Ângulo entre vias"
                          value={assistantDisplayStructured.angulo_vias}
                          tone="emerald"
                        />
                      </div>

                      <AssistantSection
                        title="Justificativa do score operacional"
                        content={assistantDisplayStructured.justificativa_score}
                      />

                      <div className="grid gap-3 lg:grid-cols-2">
                        <AssistantSection
                          title="Ruas identificadas"
                          items={assistantDisplayStructured.ruas_identificadas}
                        />
                        <AssistantSection
                          title="Atendimento prioritário"
                          items={assistantDisplayStructured.atendimento_prioritario}
                        />
                      </div>

                      <AssistantNeighborCards
                        rows={assistantDisplayStructured.ctos_vizinhas_analisadas}
                      />

                      <div className="grid gap-3 lg:grid-cols-2">
                        <AssistantSection
                          title="Fatores considerados"
                          items={assistantDisplayStructured.fatores}
                        />
                        <AssistantSection
                          title="Evidências"
                          items={assistantDisplayStructured.evidencias}
                        />
                        <AssistantSection
                          title="Inferências"
                          items={assistantDisplayStructured.inferencias}
                        />
                        <AssistantSection
                          title="Riscos"
                          items={assistantDisplayStructured.riscos}
                        />
                        <AssistantSection
                          title="Lacunas"
                          items={assistantDisplayStructured.lacunas}
                        />
                        <AssistantSection
                          title="Recomendação prática"
                          content={assistantDisplayStructured.recomendacao}
                        />
                      </div>
                    </div>
                  ) : (
                    !assistantLoading &&
                    !assistantError && (
                      <div className="rounded-xl border border-dashed border-sky-200/90 dark:border-sky-800/50 bg-surface-container-lowest/70 px-4 py-5 text-[12px] leading-relaxed text-on-surface-variant shadow-sm">
                        <p className="font-semibold text-on-surface">A resposta da ISA aparece aqui</p>
                        <p className="mt-1">
                          Use uma pergunta objetiva sobre o splitter ou sobre planejamento de rede para
                          receber uma leitura estruturada, com decisão operacional, ruas e CTOs vizinhas.
                        </p>
                      </div>
                    )
                  )}
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
            className="pointer-events-auto w-[min(calc(100vw-2rem),20rem)] overflow-hidden rounded-2xl border border-neutral-200/95 dark:border-white/10 bg-surface-container-lowest shadow-[0_12px_36px_-10px_rgba(15,23,42,0.28)] ring-1 ring-neutral-950/[0.04]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-neutral-100 dark:border-white/5 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Painéis ISA</p>
            </div>
            <div className="flex flex-col p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={openOperationalPanel}
                className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200">
                  <ListOrdered size={16} strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-on-surface">
                    Priorização operacional
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-on-surface-variant">
                    Top equipamentos por criticidade e massivas (filtros da lista).
                  </span>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={openReliefPanel}
                className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-amber-50 dark:hover:bg-amber-950/40"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200">
                  <GitBranch size={16} strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-on-surface">
                    Planejamento de rede (sem alívio roteado)
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-on-surface-variant">
                    Lotados sem porta livre próxima por calçada (OSRM).
                  </span>
                </span>
              </button>
              {canUsePlanningAssistant ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={openAssistantPanel}
                  className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-sky-50 dark:hover:bg-sky-950/40"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200">
                    <Sparkles size={16} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-on-surface">
                      Assistente ISA
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-on-surface-variant">
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
                className="absolute -right-0.5 -top-0.5 z-[1] size-3 rounded-full border-2 border-white dark:border-white/10 bg-rose-500 shadow-sm"
                aria-hidden
              />
            ) : null}
            {hasReliefResults && reliefQueueQuery.isSuccess ? (
              <span
                className={cn(
                  'absolute z-[1] size-3 rounded-full border-2 border-white dark:border-white/10 bg-amber-500 shadow-sm',
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
                className="absolute -right-0.5 -top-0.5 z-[1] flex size-3.5 items-center justify-center rounded-full border-2 border-white dark:border-white/10 bg-surface-container-lowest shadow-sm"
                aria-hidden
              >
                <span className="size-2 animate-pulse rounded-full bg-primary" />
              </span>
            ) : null}
            {operationalQuery.isError ? (
              <span
                className="absolute -right-0.5 -top-0.5 z-[1] size-3 rounded-full border-2 border-white dark:border-white/10 bg-amber-500 shadow-sm"
                aria-hidden
              />
            ) : null}
            {reliefQueueQuery.isError && !operationalQuery.isError ? (
              <span
                className="absolute -left-0.5 bottom-0 z-[1] size-3 rounded-full border-2 border-white dark:border-white/10 bg-amber-600 shadow-sm"
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
                      ? 'border border-white/45 dark:border-white/10 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.82),rgba(198,226,255,0.34)_42%,rgba(157,187,255,0.18)_62%,rgba(120,146,214,0.12)_100%)] p-0 shadow-[0_18px_42px_-10px_rgba(15,23,42,0.42),inset_0_1px_0_rgba(255,255,255,0.75)] hover:scale-[1.02]'
                      : cn(
                          'border border-neutral-200/95 dark:border-white/10 bg-surface-container-lowest text-on-surface-variant shadow-lg',
                          'hover:border-neutral-300 hover:bg-surface-container-low hover:text-on-surface',
                          overlayOpen && 'border-amber-300/80 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100',
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
                        className="pointer-events-none absolute inset-[6%] rounded-full border border-white/35 dark:border-white/10 shadow-[inset_0_0_22px_rgba(255,255,255,0.32)]"
                      />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-[14%] top-[8%] h-[24%] w-[44%] rounded-full bg-surface-container-lowest/45 blur-[2px]"
                      />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute bottom-[12%] right-[16%] h-[22%] w-[30%] rounded-full bg-sky-200/25 dark:bg-sky-950/60 blur-[6px]"
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




