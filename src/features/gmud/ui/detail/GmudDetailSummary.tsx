import { useState } from 'react'
import { Check, Copy, ExternalLink, Info } from 'lucide-react'
import type { GmudDetail } from '@/features/gmud/api/gmudDetail'
import { env } from '@/shared/config/env'
import type { GmudDeadline, GmudDeadlineTone } from '@/features/gmud/lib/gmudDeadline'
import { GMUD_STATUS_COMITE_LABEL, type GmudStatusComite } from '@/features/gmud/api/updateGmudApproval'
import { formatBrazilDateTimeShortDisplay } from '@/shared/lib/formatBrazilDisplayDate'
import { CARD } from '@/features/gmud/ui/indicators/indicatorTheme'
import { CardTitle } from '@/features/gmud/ui/detail/GmudDetailCards'
import { cn } from '@/shared/lib/utils'

const TONE: Record<GmudDeadlineTone, string> = {
  overdue: 'text-rose-600 dark:text-rose-300',
  soon: 'text-amber-600 dark:text-amber-300',
  ok: 'text-on-surface',
  done: 'text-emerald-600 dark:text-emerald-300',
  cancelled: 'text-on-surface-variant',
  none: 'text-on-surface-variant',
}

const EXEC_LABEL: Record<string, string> = { pendente: 'Pendente', em_execucao: 'Em execução', concluida: 'Concluída' }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="text-right font-medium text-on-surface">{children}</span>
    </div>
  )
}

function fmt(iso: string | null | undefined): string {
  return iso ? formatBrazilDateTimeShortDisplay(iso, '—') : '—'
}

/** Número do protocolo em destaque, com copiar e link direto para o Elleven. */
function ProtocolBadge({ protocol }: { protocol: number }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(protocol))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard indisponível — número continua visível para cópia manual
    }
  }
  const ellevenUrl = env.ellevenProtocolUrlTemplate.trim()
    ? env.ellevenProtocolUrlTemplate.replace('{protocol}', String(protocol))
    : ''
  const BTN =
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/30 transition hover:bg-primary/10'
  return (
    <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Protocolo Voalle</p>
        <p className="font-mono text-2xl font-bold leading-tight tabular-nums text-on-surface">{protocol}</p>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-1">
        <button type="button" onClick={copy} aria-label="Copiar número do protocolo" title={copied ? 'Copiado!' : 'Copiar'} className={BTN}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        {ellevenUrl ? (
          <a href={ellevenUrl} target="_blank" rel="noopener noreferrer" title="Abrir este protocolo no Elleven" className={cn(BTN, 'no-underline')}>
            <ExternalLink size={14} /> Elleven
          </a>
        ) : null}
      </div>
    </div>
  )
}

/** Janela de execução (dd/mm hh:mm → dd/mm hh:mm) a partir dos campos da requisição. */
function fmtWindow(r: GmudDetail['request']): string {
  if (!r?.dataInicio) return ''
  const d = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '')
  const ini = `${d(r.dataInicio)}${r.horaInicio ? ` ${r.horaInicio}` : ''}`
  const fim = `${d(r.dataFim || r.dataInicio)}${r.horaFim ? ` ${r.horaFim}` : ''}`
  return `${ini} → ${fim}`
}

/** Resumo lateral: prazo, status no Voalle, Comitê e execução. */
export function GmudDetailSummary({ detail, deadline }: { detail: GmudDetail; deadline: GmudDeadline }) {
  const r = detail.request
  const comite = r?.statusComite ?? null
  return (
    <section className={cn(CARD, 'p-4')}>
      <CardTitle icon={<Info size={16} />}>Resumo</CardTitle>
      <ProtocolBadge protocol={detail.voalle.protocol} />
      <div className="divide-y divide-neutral-200/60 dark:divide-white/5">
        <Row label="Prazo">
          <span className={TONE[deadline.tone]}>{deadline.label}</span>
        </Row>
        <Row label="Abertura">{fmt(detail.voalle.openedAt)}</Row>
        <Row label="Prazo (SLA)">{fmt(detail.voalle.slaDate)}</Row>
        {fmtWindow(r) ? <Row label="Janela de execução">{fmtWindow(r)}</Row> : null}
        <Row label="Status no Voalle">{detail.voalle.status || '—'}</Row>
        {detail.voalle.conclusionDate ? <Row label="Encerramento">{fmt(detail.voalle.conclusionDate)}</Row> : null}
        <Row label="Solicitante">{detail.voalle.requester || '—'}</Row>
        {r ? (
          <>
            <Row label="Tipo">{r.tipo || '—'}</Row>
            <Row label="Assunto">{r.assunto || '—'}</Row>
            <Row label="Comitê">{comite ? GMUD_STATUS_COMITE_LABEL[comite as GmudStatusComite] ?? comite : '—'}</Row>
            {r.decididoEm ? (
              <Row label="Decisão">
                {fmt(r.decididoEm)}
                {r.aprovadoPor ? ` · ${r.aprovadoPor}` : ''}
              </Row>
            ) : null}
            <Row label="Execução">{EXEC_LABEL[r.statusExec ?? ''] ?? r.statusExec ?? '—'}</Row>
            {r.dataCab ? <Row label="Data CAB">{r.dataCab.split('-').reverse().join('/')}</Row> : null}
            {r.rnc ? <Row label="RNC">{r.rnc}</Row> : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
