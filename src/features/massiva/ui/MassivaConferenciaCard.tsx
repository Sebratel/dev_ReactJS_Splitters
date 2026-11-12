import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { useMassivaConferenciaStatus } from '@/features/massiva/hooks/useMassivaConferenciaStatus'
import {
  evaluateConferenciaHealth,
  formatConferenciaRelative,
  type ConferenciaTone,
} from '@/features/massiva/lib/massivaConferenciaHealth'
import type { MassivaConferenciaStatus } from '@/features/massiva/model/massivaConferenciaStatus'
import { formatBrazilDateTimeDisplay } from '@/shared/lib/formatBrazilDisplayDate'
import { cn } from '@/shared/lib/utils'

// Mesmas classes dos demais cartões da aba Qualidade (MassivaDashboardScreen).
const CARD_SECTION_CLS =
  'rounded-xl bg-surface-container-lowest shadow-[0_2px_12px_-6px_rgba(15,23,42,0.08)] ring-1 ring-neutral-200/70 dark:ring-white/10'
const SECTION_HEADER_CLS = 'border-b border-neutral-200/80 dark:border-white/10 px-4 py-3 sm:px-5'
const INFO_BOX_CLS =
  'flex items-center gap-2 rounded-lg border border-neutral-200/70 dark:border-white/10 bg-surface-container-low/60 px-3 py-3 text-sm text-on-surface-variant'

const BADGE_TONE: Record<ConferenciaTone, string> = {
  ok: 'border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200',
  warn: 'border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200',
  err: 'border-rose-300/80 bg-rose-50 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200',
}

type TileTone = 'neutral' | 'bad' | 'good'

const TILE_TONE: Record<TileTone, { box: string; label: string; value: string; sub: string }> = {
  neutral: {
    box: 'border-neutral-200/80 dark:border-white/10 bg-surface-container-low/60',
    label: 'text-on-surface-variant',
    value: 'text-on-surface',
    sub: 'text-on-surface-variant/80',
  },
  bad: {
    box: 'border-rose-200/80 dark:border-rose-800/50 bg-rose-50/70 dark:bg-rose-950/40',
    label: 'text-rose-700 dark:text-rose-300',
    value: 'text-rose-800 dark:text-rose-200',
    sub: 'text-rose-700/80 dark:text-rose-300',
  },
  good: {
    box: 'border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/40',
    label: 'text-emerald-700 dark:text-emerald-300',
    value: 'text-emerald-800 dark:text-emerald-200',
    sub: 'text-emerald-700/80 dark:text-emerald-300',
  },
}

function Tile(props: { label: string; value: string; sub?: string; tone?: TileTone; testId: string }) {
  const t = TILE_TONE[props.tone ?? 'neutral']
  return (
    <div className={cn('rounded-lg border px-3 py-2.5', t.box)} data-testid={props.testId}>
      <p className={cn('text-[10px] font-semibold uppercase tracking-wide', t.label)}>{props.label}</p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums', t.value)}>{props.value}</p>
      {props.sub ? <p className={cn('mt-0.5 text-[10px] leading-snug', t.sub)}>{props.sub}</p> : null}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true" aria-label="Carregando a conferência">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[76px] animate-pulse rounded-lg bg-neutral-100 dark:bg-white/5" />
      ))}
    </div>
  )
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

export type MassivaConferenciaCardViewProps = {
  status: MassivaConferenciaStatus | undefined
  isLoading: boolean
  isError: boolean
  /** Relógio injetável (testes). */
  nowMs?: number
}

export function MassivaConferenciaCardView({
  status,
  isLoading,
  isError,
  nowMs = Date.now(),
}: MassivaConferenciaCardViewProps) {
  const health = status ? evaluateConferenciaHealth(status, nowMs) : null
  const ultima = status?.ultimaExecucao ?? null

  let state: string
  let body: ReactNode

  if (status == null && isLoading) {
    state = 'loading'
    body = <Skeleton />
  } else if (status == null) {
    state = isError ? 'error' : 'empty'
    body = (
      <div className={cn(INFO_BOX_CLS, 'border-rose-200/80 bg-rose-50/60 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-200')}>
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        Não foi possível consultar a conferência agora. Tente novamente em instantes.
      </div>
    )
  } else if (!status.habilitada) {
    state = 'desligada'
    body = (
      <div className={INFO_BOX_CLS}>
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        A conferência automática está desligada neste ambiente.
      </div>
    )
  } else if (ultima == null) {
    state = 'aguardando'
    body = (
      <div className={INFO_BOX_CLS}>
        <RefreshCw className={cn('h-4 w-4 shrink-0 text-on-surface-variant/60', status.emExecucao && 'animate-spin')} aria-hidden />
        {status.emExecucao ? 'Primeira verificação em andamento…' : 'Aguardando a primeira verificação.'}
      </div>
    )
  } else {
    const relatando = status.dryRun || ultima.dryRun
    const pendentes = relatando ? ultima.semRegistro : Math.max(0, ultima.semRegistro - ultima.criadas)
    const falhou = (ultima.erro != null && !ultima.skipped) || ultima.falhas > 0
    state = health?.tone === 'err' ? 'vermelho' : 'normal'
    const quando = formatBrazilDateTimeDisplay(ultima.iniciadoEm, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    body = (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            testId="conferencia-ultima"
            label="Última verificação"
            value={formatConferenciaRelative(ultima.iniciadoEm, nowMs)}
            sub={`${quando} · a cada ${status.intervaloMinutos} min`}
            tone={health?.atrasada ? 'bad' : 'neutral'}
          />
          <Tile
            testId="conferencia-abertas"
            label="Abertas no Elleven agora"
            value={ultima.ellevenAbertos.toLocaleString('pt-BR')}
            sub={`de ${ultima.ellevenTotal.toLocaleString('pt-BR')} na lista do Elleven`}
          />
          <Tile
            testId="conferencia-sem-registro"
            label="Sem registro na plataforma"
            value={ultima.semRegistro.toLocaleString('pt-BR')}
            tone={pendentes > 0 ? 'bad' : ultima.criadas > 0 ? 'good' : 'neutral'}
            sub={
              relatando
                ? ultima.semRegistro > 0
                  ? 'Só relatório: nada foi criado.'
                  : 'Nada faltando.'
                : ultima.criadas > 0
                  ? `${ultima.criadas.toLocaleString('pt-BR')} ${plural(ultima.criadas, 'registrada', 'registradas')} agora`
                  : 'Nada faltando.'
            }
          />
          <Tile
            testId="conferencia-recuperadas"
            label="Recuperadas em 30 dias"
            value={status.recuperadasUltimos30Dias == null ? '—' : status.recuperadasUltimos30Dias.toLocaleString('pt-BR')}
            sub="criadas pela conferência"
          />
        </div>

        {falhou ? (
          <div
            className="flex items-start gap-2 rounded-lg border border-rose-200/80 bg-rose-50/70 px-3 py-2 text-xs text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-200"
            role="alert"
            data-testid="conferencia-erro"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{health?.reason}</span>
          </div>
        ) : health?.atrasada ? (
          <div
            className="flex items-start gap-2 rounded-lg border border-rose-200/80 bg-rose-50/70 px-3 py-2 text-xs text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-200"
            role="alert"
            data-testid="conferencia-atrasada"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{health.reason}</span>
          </div>
        ) : null}

        {ultima.divergAbertaLocalFinalizadaElleven > 0 || ultima.divergFechadaLocalAbertaElleven > 0 ? (
          <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-[11px] leading-snug text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200" data-testid="conferencia-divergencias">
            Divergências de situação (só informativo, nada foi alterado):{' '}
            {ultima.divergAbertaLocalFinalizadaElleven > 0
              ? `${ultima.divergAbertaLocalFinalizadaElleven} aberta(s) na plataforma que o Elleven mostra finalizada(s)`
              : null}
            {ultima.divergAbertaLocalFinalizadaElleven > 0 && ultima.divergFechadaLocalAbertaElleven > 0 ? '; ' : null}
            {ultima.divergFechadaLocalAbertaElleven > 0
              ? `${ultima.divergFechadaLocalAbertaElleven} encerrada(s) na plataforma que o Elleven mostra aberta(s)`
              : null}
            .
          </p>
        ) : null}

        {relatando ? (
          <p className="flex items-center gap-1.5 text-[11px] text-on-surface-variant" data-testid="conferencia-so-relatorio">
            <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" aria-hidden />
            Modo só relatório: a conferência informa o que falta, mas não cria nada.
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={CARD_SECTION_CLS} data-testid="conferencia-card" data-state={state}>
      <div className={cn(SECTION_HEADER_CLS, 'flex flex-wrap items-start justify-between gap-2')}>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Integração com o Elleven</p>
          <h2 className="mt-1 text-sm font-semibold text-on-surface">Conferência com o Elleven</h2>
          <p className="mt-0.5 text-[11px] text-on-surface-variant">
            {status
              ? `A cada ${status.intervaloMinutos} min compara as massivas do Elleven com as da plataforma e registra aqui as que estiverem faltando.`
              : 'Compara as massivas do Elleven com as da plataforma e registra aqui as que estiverem faltando.'}
          </p>
        </div>
        {health ? (
          <span
            className={cn(
              'shrink-0 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              BADGE_TONE[health.tone],
            )}
            title={health.reason}
            data-testid="conferencia-modo"
          >
            {health.modeLabel}
          </span>
        ) : null}
      </div>
      <div className="px-4 py-4 sm:px-5">{body}</div>
    </div>
  )
}

/** Cartão da aba Qualidade: lê o estado do backend (polling de 60 s) e delega à visão. */
export function MassivaConferenciaCard() {
  const q = useMassivaConferenciaStatus()
  return (
    <MassivaConferenciaCardView status={q.data} isLoading={q.isPending && !q.isError} isError={q.isError} />
  )
}
