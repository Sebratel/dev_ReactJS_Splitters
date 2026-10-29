import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Clock, Loader2, ShieldCheck, XCircle } from 'lucide-react'
import { overrideAreaApproval, type GmudAreaApproval, type GmudAreasStatus } from '@/features/gmud/api/gmudAreaApprovals'
import { CardTitle } from '@/features/gmud/ui/detail/GmudDetailCards'
import { CARD as DETAIL_CARD } from '@/features/gmud/ui/indicators/indicatorTheme'
import { cn } from '@/shared/lib/utils'
import { showGmudError } from '@/features/gmud/lib/gmudFeedback'

const STATUS_STYLE: Record<GmudAreaApproval['status'], { label: string; cls: string; Icon: typeof Clock }> = {
  pendente: {
    label: 'Pendente',
    cls: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50',
    Icon: Clock,
  },
  aprovada: {
    label: 'Aprovada',
    cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/50',
    Icon: CheckCircle2,
  },
  negada: {
    label: 'Negada',
    cls: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-800/50',
    Icon: XCircle,
  },
}

const SUMMARY: Record<Exclude<GmudAreasStatus, 'nao_aplicavel'>, string> = {
  pendente: 'Aguardando as áreas. O Comitê só avalia depois que todas aprovarem.',
  aprovada: 'Todas as áreas aprovaram. A GMUD segue para o Comitê.',
  negada: 'Uma área negou. A GMUD foi negada.',
}

function formatWhen(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

export function GmudAreaApprovalsCard({
  protocol,
  areas,
  statusAreas,
  canOverride,
  onChanged,
}: {
  protocol: number
  areas: GmudAreaApproval[]
  statusAreas: GmudAreasStatus
  canOverride: boolean
  onChanged: () => void
}) {
  const override = useMutation({
    onError: (error) => showGmudError(error, 'Não foi possível aprovar em nome da área'),
    mutationFn: (areaId: number) => overrideAreaApproval(protocol, areaId),
    onSuccess: onChanged,
  })

  if (areas.length === 0 || statusAreas === 'nao_aplicavel') return null

  return (
    <section className={cn(DETAIL_CARD, 'space-y-3 p-4')}>
      <CardTitle icon={<ShieldCheck size={16} />}>Aprovação das áreas</CardTitle>
      <p className="text-xs text-on-surface-variant">{SUMMARY[statusAreas]}</p>

      <ul className="divide-y divide-neutral-200/70 dark:divide-white/10">
        {areas.map((a) => {
          const st = STATUS_STYLE[a.status]
          return (
            <li key={a.id} className="space-y-1 py-2.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-on-surface">{a.areaLabel}</p>
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1', st.cls)}>
                  <st.Icon size={11} aria-hidden /> {st.label}
                </span>
              </div>
              {a.status === 'pendente' ? (
                <p className="text-xs text-on-surface-variant">
                  Aguardando uma de {a.pessoas.length} pessoa{a.pessoas.length === 1 ? '' : 's'}:{' '}
                  {a.pessoas.map((p) => p.nome).join(', ')}
                </p>
              ) : (
                <p className="text-xs text-on-surface-variant">
                  {a.decidedByName ?? 'Responsável'} · {formatWhen(a.decidedAt)}
                  {a.motivo ? ` — ${a.motivo}` : ''}
                </p>
              )}
              {a.status === 'pendente' && canOverride ? (
                <button
                  type="button"
                  disabled={override.isPending}
                  onClick={() => {
                    if (window.confirm(`Aprovar em nome da área "${a.areaLabel}"? Isso fica registrado na linha do tempo.`)) {
                      override.mutate(a.areaId)
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-on-surface ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low disabled:opacity-60 dark:ring-white/10"
                >
                  {override.isPending ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                  Aprovar em nome da área
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>

    </section>
  )
}
