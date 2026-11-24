import { useState, type ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Copy, RefreshCw, X } from 'lucide-react'
import { useMassivaConferenciaStatus } from '@/features/massiva/hooks/useMassivaConferenciaStatus'
import {
  evaluateConferenciaHealth,
  formatConferenciaRelative,
  type ConferenciaTone,
} from '@/features/massiva/lib/massivaConferenciaHealth'
import {
  formatAberturaConferencia,
  type MassivaConferenciaDesfecho,
  type MassivaConferenciaProtocolo,
  type MassivaConferenciaProtocolos,
  type MassivaConferenciaStatus,
  type MassivaConferenciaStatusElleven,
} from '@/features/massiva/model/massivaConferenciaStatus'
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

function Tile(props: { label: string; value: string; sub?: string; tone?: TileTone; testId: string; action?: ReactNode }) {
  const t = TILE_TONE[props.tone ?? 'neutral']
  return (
    <div className={cn('rounded-lg border px-3 py-2.5', t.box)} data-testid={props.testId}>
      <p className={cn('text-[10px] font-semibold uppercase tracking-wide', t.label)}>{props.label}</p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums', t.value)}>{props.value}</p>
      {props.sub ? <p className={cn('mt-0.5 text-[10px] leading-snug', t.sub)}>{props.sub}</p> : null}
      {props.action ? <div className="mt-1.5">{props.action}</div> : null}
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

type PainelId = 'semRegistro' | 'foraDaJanela'

const STATUS_ELLEVEN_LABEL: Record<MassivaConferenciaStatusElleven, string> = {
  aberta: 'Aberta',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
}

const STATUS_ELLEVEN_TONE: Record<MassivaConferenciaStatusElleven, string> = {
  aberta: 'border-sky-300/80 bg-sky-50 text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200',
  encerrada:
    'border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200',
  cancelada:
    'border-neutral-300/80 bg-neutral-100 text-neutral-700 dark:border-white/15 dark:bg-white/10 dark:text-neutral-200',
}

const DESFECHO_LABEL: Record<MassivaConferenciaDesfecho, string> = {
  seria_criada: 'Seria criada',
  criada: 'Criada',
  falhou: 'Falhou',
  ja_existia: 'Já existia',
  sem_assignment: 'Não criada (sem assignment)',
  fora_da_janela: 'Fora da janela, não será criada',
}

const DESFECHO_TONE: Record<MassivaConferenciaDesfecho, string> = {
  seria_criada: 'text-amber-800 dark:text-amber-200',
  criada: 'text-emerald-800 dark:text-emerald-200',
  falhou: 'text-rose-800 dark:text-rose-200',
  ja_existia: 'text-on-surface-variant',
  sem_assignment: 'text-rose-800 dark:text-rose-200',
  fora_da_janela: 'text-on-surface-variant',
}

/** Copia texto: Clipboard API quando existe; senão, textarea + execCommand (HTTP sem contexto seguro). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // cai no plano B
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

function ProtocolosLink(props: { label: string; onClick: () => void; testId: string; expanded: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-expanded={props.expanded}
      data-testid={props.testId}
      className="rounded-md border border-current/30 px-2 py-0.5 text-[11px] font-semibold underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {props.label}
    </button>
  )
}

function ProtocolosPanel(props: {
  title: string
  description: string
  lista: MassivaConferenciaProtocolos
  onClose: () => void
}) {
  const [copied, setCopied] = useState<'ok' | 'erro' | null>(null)
  const { lista } = props
  const restantes = Math.max(0, lista.total - lista.itens.length)

  async function handleCopy() {
    const ok = await copyText(lista.itens.map((i) => i.protocolo).join('\n'))
    setCopied(ok ? 'ok' : 'erro')
    window.setTimeout(() => setCopied(null), 2500)
  }

  return (
    <section
      className="rounded-lg border border-neutral-200/80 bg-surface-container-low/40 dark:border-white/10"
      aria-label={props.title}
      data-testid="conferencia-painel"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200/80 px-3 py-2 dark:border-white/10">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-on-surface">{props.title}</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-on-surface-variant">{props.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={lista.itens.length === 0}
            data-testid="conferencia-copiar"
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300/80 px-2 py-1 text-[11px] font-semibold text-on-surface hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15"
          >
            <Copy className="h-3 w-3" aria-hidden />
            {copied === 'ok' ? 'Copiado!' : copied === 'erro' ? 'Não foi possível copiar' : 'Copiar protocolos'}
          </button>
          <button
            type="button"
            onClick={props.onClose}
            data-testid="conferencia-fechar"
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300/80 px-2 py-1 text-[11px] font-semibold text-on-surface hover:bg-surface-container dark:border-white/15"
          >
            <X className="h-3 w-3" aria-hidden />
            Fechar
          </button>
        </div>
      </div>

      {lista.itens.length === 0 ? (
        <p className="px-3 py-4 text-sm text-on-surface-variant" data-testid="conferencia-painel-vazio">
          Nada faltando.
        </p>
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-surface-container-low text-[10px] uppercase tracking-wide text-on-surface-variant">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Protocolo</th>
                <th scope="col" className="px-3 py-2 font-semibold">No Elleven</th>
                <th scope="col" className="px-3 py-2 font-semibold">Abertura</th>
                <th scope="col" className="px-3 py-2 font-semibold">Ponto de acesso</th>
                <th scope="col" className="px-3 py-2 font-semibold">O que a conferência faz</th>
              </tr>
            </thead>
            <tbody>
              {lista.itens.map((i: MassivaConferenciaProtocolo) => (
                <tr key={i.protocolo} className="border-t border-neutral-200/70 dark:border-white/10" data-testid="conferencia-protocolo-linha">
                  <td className="px-3 py-1.5 font-semibold tabular-nums text-on-surface">{i.protocolo}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className={cn(
                        'inline-block whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        STATUS_ELLEVEN_TONE[i.statusElleven],
                      )}
                    >
                      {STATUS_ELLEVEN_LABEL[i.statusElleven]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-on-surface">{formatAberturaConferencia(i.abertura)}</td>
                  <td className="px-3 py-1.5 text-on-surface">{i.pontoDeAcesso || '—'}</td>
                  <td className={cn('px-3 py-1.5 font-medium', i.desfecho ? DESFECHO_TONE[i.desfecho] : 'text-on-surface-variant')}>
                    {i.desfecho ? DESFECHO_LABEL[i.desfecho] : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {restantes > 0 ? (
        <p className="border-t border-neutral-200/70 px-3 py-2 text-[11px] text-on-surface-variant dark:border-white/10" data-testid="conferencia-painel-mais">
          e mais {restantes.toLocaleString('pt-BR')}
        </p>
      ) : null}
    </section>
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
  const [painel, setPainel] = useState<PainelId | null>(null)
  const alternarPainel = (id: PainelId) => setPainel((atual) => (atual === id ? null : id))

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
    const listaSem = ultima.protocolosSemRegistro
    const listaFora = ultima.protocolosForaDaJanela
    const painelAtivo =
      painel === 'semRegistro' && listaSem
        ? {
            lista: listaSem,
            title: 'Protocolos sem registro na plataforma',
            description: relatando
              ? 'Estão no Elleven, passaram da carência e não existem na plataforma. Modo só relatório: nada foi criado.'
              : 'Estão no Elleven, passaram da carência e não existiam na plataforma. A coluna da direita mostra o que a conferência fez.',
          }
        : painel === 'foraDaJanela' && listaFora
          ? {
              lista: listaFora,
              title: `Protocolos fora da janela de ${status.janelaDias} ${plural(status.janelaDias, 'dia', 'dias')}`,
              description:
                'Estão no Elleven, não existem na plataforma e são mais antigos que a janela da conferência. Não serão criados automaticamente.',
            }
          : null
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
            action={
              listaSem ? (
                <ProtocolosLink
                  testId="conferencia-ver-sem-registro"
                  label={`Ver protocolos (${listaSem.total.toLocaleString('pt-BR')})`}
                  expanded={painel === 'semRegistro'}
                  onClick={() => alternarPainel('semRegistro')}
                />
              ) : null
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

        {listaFora && listaFora.total > 0 ? (
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-neutral-200/70 bg-surface-container-low/60 px-3 py-2 text-[11px] leading-snug text-on-surface-variant dark:border-white/10"
            data-testid="conferencia-fora-da-janela"
          >
            <span>
              Fora da janela de {status.janelaDias} {plural(status.janelaDias, 'dia', 'dias')}:{' '}
              <strong className="tabular-nums text-on-surface">{listaFora.total.toLocaleString('pt-BR')}</strong>{' '}
              {plural(
                listaFora.total,
                'protocolo antigo está só no Elleven e não será criado.',
                'protocolos antigos estão só no Elleven e não serão criados.',
              )}
            </span>
            <ProtocolosLink
              testId="conferencia-ver-fora-da-janela"
              label={`Ver protocolos fora da janela (${listaFora.total.toLocaleString('pt-BR')})`}
              expanded={painel === 'foraDaJanela'}
              onClick={() => alternarPainel('foraDaJanela')}
            />
          </div>
        ) : null}

        {painelAtivo ? (
          <ProtocolosPanel
            title={painelAtivo.title}
            description={painelAtivo.description}
            lista={painelAtivo.lista}
            onClose={() => setPainel(null)}
          />
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
