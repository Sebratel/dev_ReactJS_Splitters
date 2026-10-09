import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { History, Layers, ListChecks } from 'lucide-react'
import type { GmudDetailLink, GmudDetailRequest } from '@/features/gmud/api/gmudDetail'
import type { TimelineItem, TimelineTone } from '@/features/gmud/lib/gmudTimeline'
import { formatWindow } from '@/features/gmud/lib/gmudSchedule'
import { GMUD_RECURSO_PAPEIS } from '@/features/gmud/model/gmudForm'
import { htmlToPlainText } from '@/features/gmud/lib/gmudText'
import { cn } from '@/shared/lib/utils'

import { CARD as DETAIL_CARD } from '@/features/gmud/ui/indicators/indicatorTheme'

const DOT: Record<TimelineTone, string> = {
  neutral: 'bg-neutral-400',
  primary: 'bg-primary',
  success: 'bg-emerald-500',
  danger: 'bg-rose-500',
  warning: 'bg-amber-500',
}

export function CardTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-bold text-on-surface">
      <span className="text-primary">{icon}</span>
      {children}
    </h3>
  )
}

export function GmudTimelineCard({ items }: { items: TimelineItem[] }) {
  return (
    <section className={cn(DETAIL_CARD, 'space-y-3 p-4')}>
      <CardTitle icon={<History size={16} />}>Linha do tempo</CardTitle>
      {items.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Sem eventos registrados.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-neutral-200 pl-5 dark:border-white/10">
          {items.map((i, idx) => (
            <li key={`${i.at}-${idx}`} className="relative">
              <span className={cn('absolute -left-[25px] top-1 size-2.5 rounded-full ring-4 ring-surface-container-lowest', DOT[i.tone])} />
              <p className="text-sm font-semibold text-on-surface">{i.title}</p>
              {i.detail ? <p className="text-xs text-on-surface-variant">{i.detail}</p> : null}
              <p className="text-[11px] text-on-surface-variant/80">
                {new Date(i.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                {i.actor ? ` · ${i.actor}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Field({ label, value, wide }: { label: string; value: string | null | undefined; wide?: boolean }) {
  const v = (value ?? '').toString().trim()
  if (v === '') return null
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant/70">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-on-surface">{v}</p>
    </div>
  )
}

function recursos(r: GmudDetailRequest['recursosAdministrativos']): string {
  return Object.entries(r ?? {})
    .filter(([, papel]) => papel && papel !== 'na')
    .map(([area, papel]) => `${area}: ${GMUD_RECURSO_PAPEIS.find((p) => p.value === papel)?.label ?? papel}`)
    .join('  •  ')
}

export function GmudScopeCard({ request, voalleDescription }: { request: GmudDetailRequest | null; voalleDescription: string }) {
  if (!request) {
    return (
      <section className={cn(DETAIL_CARD, 'space-y-3 p-4')}>
        <CardTitle icon={<ListChecks size={16} />}>Escopo</CardTitle>
        <p className="rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
          GMUD legado: aberta direto no Elleven, sem o formulário da plataforma. Abaixo, a descrição registrada no protocolo.
        </p>
        <p className="whitespace-pre-wrap text-sm text-on-surface">{htmlToPlainText(voalleDescription) || 'Sem descrição no protocolo.'}</p>
      </section>
    )
  }
  const janela =
    request.dataInicio && request.horaInicio
      ? formatWindow({
          dataInicio: request.dataInicio,
          horaInicio: request.horaInicio,
          dataFim: request.dataFim || request.dataInicio,
          horaFim: request.horaFim || request.horaInicio,
        })
      : null
  return (
    <section className={cn(DETAIL_CARD, 'space-y-4 p-4')}>
      <CardTitle icon={<ListChecks size={16} />}>Escopo da mudança</CardTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Descrição da atividade" value={request.descricao} wide />
        <Field label="Janela de execução" value={janela} />
        <Field label="POP / Site" value={request.popSite} />
        <Field label="Ambiente afetado" value={(request.ambienteAfetado ?? []).join('; ')} wide />
        <Field label="Impacto de parada?" value={request.impactoParada} />
        <Field label="Comunica cliente?" value={request.comunicaCliente} />
        <Field label="Plano de execução" value={request.planoExecucao} wide />
        <Field label="Plano de rollback" value={request.planoRollback} wide />
        <Field label="Risco durante a execução" value={request.riscoExecucao} wide />
        <Field label="Risco da não implementação" value={request.riscoNaoImplementacao} wide />
        <Field label="Recursos administrativos" value={recursos(request.recursosAdministrativos)} wide />
        <Field label="Lista de clientes ao COR?" value={request.listaClientesCor} />
        <Field label="Área do solicitante" value={request.areaSolicitante} />
      </div>
    </section>
  )
}

export function GmudLinkedMassivasCard({ links, onManage }: { links: GmudDetailLink[]; onManage: () => void }) {
  const totalAffected = links.reduce((s, l) => s + Math.max(0, l.affectedClients ?? 0), 0)
  return (
    <section className={cn(DETAIL_CARD, 'space-y-3 p-4')}>
      <div className="flex items-center justify-between gap-2">
        <CardTitle icon={<Layers size={16} />}>Massivas vinculadas</CardTitle>
        <button type="button" onClick={onManage} className="text-xs font-semibold text-primary hover:underline">
          Gerenciar
        </button>
      </div>
      {links.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nenhuma massiva vinculada.</p>
      ) : (
        <>
          <p className="text-xs text-on-surface-variant">
            {links.length} massiva{links.length === 1 ? '' : 's'} ·{' '}
            <span className="font-semibold text-rose-600 dark:text-rose-300">{totalAffected.toLocaleString('pt-BR')} clientes afetados</span>
          </p>
          <ul className="divide-y divide-neutral-200/60 dark:divide-white/5">
            {links.map((l) => (
              <li key={l.massivaProtocol} className="flex items-center justify-between gap-2 py-2 text-sm">
                <Link to="/massiva" className="min-w-0 hover:underline">
                  <span className="font-mono text-xs text-on-surface-variant">{l.massivaProtocol}</span>{' '}
                  <span className="truncate text-on-surface">{l.title || 'Massiva'}</span>
                </Link>
                <span className="shrink-0 text-xs tabular-nums text-on-surface-variant">
                  {l.affectedClients != null ? `${l.affectedClients} afetados` : '—'}
                  {l.status ? ` · ${l.status}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
