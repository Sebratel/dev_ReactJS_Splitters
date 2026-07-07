import type { Solicitation } from '@/features/clientes/model/solicitation'
import { formatSolicitationDateDisplay } from '@/features/clientes/lib/formatSolicitationDate'

type ClienteSolicitationEntryProps = {
  /** Rótulo “Solicitação 1”, “Solicitação 2”, … (paridade Flutter). */
  indexLabel: number
  solicitation: Solicitation
}

export function ClienteSolicitationEntry({
  indexLabel,
  solicitation,
}: ClienteSolicitationEntryProps) {
  const fechamento =
    solicitation.finalDate !== null
      ? formatSolicitationDateDisplay(solicitation.finalDate)
      : 'Em andamento'

  return (
    <article
      className="py-3 first:pt-0"
      aria-labelledby={`solicitation-${indexLabel}-heading`}
    >
      <h3
        id={`solicitation-${indexLabel}-heading`}
        className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/60"
      >
        Solicitação {indexLabel}
      </h3>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
            Título
          </dt>
          <dd className="mt-0.5 font-medium leading-snug text-on-surface">
            {solicitation.title || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
            Protocolo
          </dt>
          <dd className="mt-0.5 break-all font-mono text-xs font-medium text-on-surface">
            {solicitation.protocol || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
            Status
          </dt>
          <dd className="mt-0.5 text-on-surface">{solicitation.status || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
            Equipe
          </dt>
          <dd className="mt-0.5 text-on-surface">{solicitation.team || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
            Área
          </dt>
          <dd className="mt-0.5 text-on-surface">{solicitation.sectorArea || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
            Abertura
          </dt>
          <dd className="mt-0.5 text-on-surface">
            {formatSolicitationDateDisplay(solicitation.beginningDate)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
            Fechamento
          </dt>
          <dd className="mt-0.5 text-on-surface">{fechamento}</dd>
        </div>
      </dl>
    </article>
  )
}
