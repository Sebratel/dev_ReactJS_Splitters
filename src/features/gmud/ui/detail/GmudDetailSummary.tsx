import { Info } from 'lucide-react'
import type { GmudDetail } from '@/features/gmud/api/gmudDetail'
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

/** Resumo lateral: prazo, status no Voalle, Comitê e execução. */
export function GmudDetailSummary({ detail, deadline }: { detail: GmudDetail; deadline: GmudDeadline }) {
  const r = detail.request
  const comite = r?.statusComite ?? null
  return (
    <section className={cn(CARD, 'p-4')}>
      <CardTitle icon={<Info size={16} />}>Resumo</CardTitle>
      <div className="mt-2 divide-y divide-neutral-200/60 dark:divide-white/5">
        <Row label="Prazo">
          <span className={TONE[deadline.tone]}>{deadline.label}</span>
        </Row>
        <Row label="Abertura">{fmt(detail.voalle.openedAt)}</Row>
        <Row label="Prazo (SLA)">{fmt(detail.voalle.slaDate)}</Row>
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
