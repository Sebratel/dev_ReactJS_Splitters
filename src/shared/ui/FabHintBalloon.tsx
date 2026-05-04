import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const DEFAULT_INTRO_MS = 5200
const DEFAULT_PEEK_MS = 3000
const DEFAULT_TYPING_SIMULATION_MS = 1480

function IsaTypingDots({ className }: { className?: string }) {
  const delaysMs = [0, 140, 280] as const
  return (
    <span
      className={cn('inline-flex items-center gap-[5px]', className)}
      aria-hidden
    >
      {delaysMs.map((delay) => (
        <span
          key={delay}
          className="fab-isa-typing-dot inline-block size-[5px] shrink-0 rounded-full bg-neutral-400"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}

type FabHintBalloonProps = {
  /** Mensagem na voz do agente (ex.: ISA). */
  label: string
  /** Só mostra o balão quando true (ex.: imagem do FAB carregada). */
  gateReady?: boolean
  /** Mantém o balão visível (carregamento, feedback rápido, etc.). */
  pinned?: boolean
  /** Tempo em ms da intro automática após `gateReady`; depois só peek/hover/clique. */
  introMs?: number
  /** Quanto tempo o balão fica aberto após hover ou clique no FAB (máx.). */
  peekMs?: number
  /** Esconde o balão (ex.: painel do FAB aberto). */
  suppress?: boolean
  /** Sobrescreve `useReducedMotion()` do sistema. */
  reduceMotion?: boolean | null
  /**
   * Ms com pontinhos “digitando…” antes da primeira vez que o texto aparece após `gateReady`.
   * `0` desativa. Com movimento reduzido do sistema, é ignorado.
   */
  typingSimulationMs?: number
  className?: string
  children: ReactNode
}

/**
 * Balão ISA: intro automática só depois de `gateReady`; hover ou clique mostram no máximo `peekMs`;
 * `pinned` cobre estados de IA (load/pronto).
 */
export function FabHintBalloon({
  label,
  gateReady = true,
  pinned = false,
  introMs = DEFAULT_INTRO_MS,
  peekMs = DEFAULT_PEEK_MS,
  suppress = false,
  reduceMotion: reduceMotionProp,
  typingSimulationMs = DEFAULT_TYPING_SIMULATION_MS,
  className,
  children,
}: FabHintBalloonProps) {
  const systemRm = useReducedMotion()
  const reduced = Boolean(reduceMotionProp ?? systemRm)
  const typingMs = reduced || typingSimulationMs <= 0 ? 0 : typingSimulationMs
  const [postIntro, setPostIntro] = useState(reduced)
  const [peekFlash, setPeekFlash] = useState(false)
  const [messageVisible, setMessageVisible] = useState(
    () => !gateReady || typingMs <= 0,
  )
  /** IDs de timer do navegador (`number`); evita colisão NodeJS.Timeout vs DOM ao usar `tsc -b`. */
  const peekTimerRef = useRef<number | null>(null)
  const typingTimerRef = useRef<number | null>(null)

  const clearTypingTimer = () => {
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current)
      typingTimerRef.current = null
    }
  }

  const clearPeekTimer = () => {
    if (peekTimerRef.current !== null) {
      window.clearTimeout(peekTimerRef.current)
      peekTimerRef.current = null
    }
  }

  const triggerPeek = () => {
    if (!gateReady || suppress) return
    clearPeekTimer()
    setPeekFlash(true)
    peekTimerRef.current = window.setTimeout(() => {
      setPeekFlash(false)
      peekTimerRef.current = null
    }, peekMs)
  }

  useEffect(() => () => clearPeekTimer(), [])

  useEffect(() => () => clearTypingTimer(), [])

  useEffect(() => {
    if (suppress || !gateReady) {
      clearPeekTimer()
      setPeekFlash(false)
    }
  }, [suppress, gateReady])

  useEffect(() => {
    clearTypingTimer()
    if (!gateReady) {
      setMessageVisible(true)
      return
    }
    if (typingMs <= 0) {
      setMessageVisible(true)
      return
    }
    setMessageVisible(false)
    typingTimerRef.current = window.setTimeout(() => {
      setMessageVisible(true)
      typingTimerRef.current = null
    }, typingMs)
    return () => clearTypingTimer()
  }, [gateReady, typingMs])

  useEffect(() => {
    if (!gateReady) return
    if (reduced) {
      setPostIntro(true)
      return
    }
    setPostIntro(false)
    const id = window.setTimeout(() => setPostIntro(true), introMs)
    return () => window.clearTimeout(id)
  }, [gateReady, introMs, reduced])

  const visible =
    gateReady &&
    !suppress &&
    (pinned || (!reduced && !postIntro) || peekFlash)

  return (
    <div
      className={cn('relative inline-flex flex-col items-end', className)}
      onMouseEnter={() => triggerPeek()}
      onClickCapture={() => triggerPeek()}
    >
      <motion.div
        role="tooltip"
        aria-hidden={!visible}
        className="pointer-events-none absolute bottom-full right-2 z-[2] mb-2.5 w-max max-w-[min(19rem,calc(100vw-2rem))]"
        initial={reduced ? false : { opacity: 0, y: 14, scale: 0.92 }}
        animate={
          reduced
            ? { opacity: visible ? 1 : 0 }
            : {
                opacity: visible ? 1 : 0,
                y: visible ? 0 : 10,
                scale: visible ? 1 : 0.93,
              }
        }
        transition={{
          duration: reduced ? 0.12 : 0.32,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div
          className={cn(
            'relative rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50',
            'px-3.5 pb-2.5 pt-2 text-left shadow-[0_14px_40px_-14px_rgba(15,23,42,0.52)] ring-1 ring-black/[0.08]',
          )}
        >
          <div className="mb-1.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/[0.1] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-primary shadow-sm">
              <Sparkles className="size-2.5 shrink-0 opacity-90" strokeWidth={2.25} aria-hidden />
              ISA
            </span>
            <span className="text-[9px] font-semibold tracking-tight text-neutral-400">
              assistente
            </span>
          </div>
          <div
            className="flex min-h-[2.65rem] items-center"
            aria-busy={gateReady && !messageVisible}
          >
            {messageVisible ? (
              <p className="text-[11px] font-medium leading-relaxed text-neutral-800">{label}</p>
            ) : (
              <IsaTypingDots className="py-0.5" />
            )}
          </div>
          <span
            className="absolute left-[calc(100%-1.75rem)] top-full -mt-px -translate-x-1/2 border-x-[8px] border-x-transparent border-t-[9px] border-t-neutral-50"
            aria-hidden
          />
          <span
            className="absolute left-[calc(100%-1.75rem)] top-full -translate-x-1/2 border-x-[9px] border-x-transparent border-t-[10px] border-t-neutral-200"
            aria-hidden
          />
        </div>
      </motion.div>

      <div className="inline-flex" onFocusCapture={() => triggerPeek()}>
        {children}
      </div>
    </div>
  )
}
