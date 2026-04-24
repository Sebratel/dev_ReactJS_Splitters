import { useClienteSolicitations } from '@/features/clientes/hooks/useClienteSolicitations'
import { ClienteSolicitationEntry } from '@/features/clientes/ui/ClienteSolicitationEntry'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { ClipboardList } from 'lucide-react'

type ClienteDetailSolicitationsSectionProps = {
  clientId: number
}

export function ClienteDetailSolicitationsSection({
  clientId,
}: ClienteDetailSolicitationsSectionProps) {
  const { view, refetch } = useClienteSolicitations(clientId)

  if (view.status === 'disabled') {
    return (
      <section
        className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm md:p-5"
        aria-labelledby="cliente-solicitations-heading"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low/50 text-on-surface-variant">
            <ClipboardList size={18} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h2
              id="cliente-solicitations-heading"
              className="text-base font-semibold tracking-tight text-on-surface"
            >
              Solicitações
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-on-surface-variant/75">
              ID de cliente indisponível para consultar solicitações.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm md:p-5"
      aria-labelledby="cliente-solicitations-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08] text-primary">
            <ClipboardList size={18} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              Histórico
            </p>
            <h2
              id="cliente-solicitations-heading"
              className="mt-0.5 text-base font-semibold tracking-tight text-on-surface"
            >
              Solicitações
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant/70">
              Dados do sistema de gestão. Se houver divergência contratual, confira a sincronização com o banco principal.
            </p>
          </div>
        </div>
      </div>

      {view.status === 'loading' ? (
        <div className="mt-4">
          <LoadingState label="Carregando solicitações…" />
        </div>
      ) : null}

      {view.status === 'error' ? (
        <div className="mt-4">
          <ErrorState
            title="Não foi possível carregar solicitações"
            message={formatQueryError(view.error)}
            onRetry={() => refetch()}
          />
        </div>
      ) : null}

      {view.status === 'empty' ? (
        <p className="mt-4 text-sm text-on-surface-variant/75">Nenhuma solicitação encontrada</p>
      ) : null}

      {view.status === 'success' ? (
        <div className="mt-4 divide-y divide-outline-variant/40">
          {view.items.map((s, i) => (
            <ClienteSolicitationEntry
              key={`${s.assignmentId}-${s.protocol}-${i}`}
              indexLabel={i + 1}
              solicitation={s}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
