import { Link, useParams } from 'react-router-dom'
import { useClienteDetail } from '@/features/clientes/hooks/useClienteDetail'
import { ClienteDetailAccessPointSection } from '@/features/clientes/ui/ClienteDetailAccessPointSection'
import { ClienteDetailAddressSection } from '@/features/clientes/ui/ClienteDetailAddressSection'
import { ClienteDetailClienteSection } from '@/features/clientes/ui/ClienteDetailClienteSection'
import { ClienteDetailContractSection } from '@/features/clientes/ui/ClienteDetailContractSection'
import { ClienteDetailMaintenanceSection } from '@/features/clientes/ui/ClienteDetailMaintenanceSection'
import { ClienteDetailSolicitationsSection } from '@/features/clientes/ui/ClienteDetailSolicitationsSection'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { EmptyState } from '@/shared/ui/states/EmptyState'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { Server } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'

export function ClienteDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { state, refetch } = useClienteDetail(id)

  return (
    <div className="space-y-5 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <AppPageHeader
        icon={Server}
        badge="Assinante"
        title="Dados do cliente"
        description={
          id
            ? `Identificador de autenticação (BFF): ${id}. Contrato, endereço e ponto de acesso quando disponíveis.`
            : undefined
        }
        trailing={
          state.status === 'ready' && state.cliente.splitterCode ? (
            <Link
              to={`/splitters/${encodeURIComponent(state.cliente.splitterCode)}`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-neutral-200/90 bg-white/90 px-4 py-2.5 text-xs font-semibold text-neutral-800 shadow-sm transition hover:border-amber-300/70 hover:bg-amber-50/90"
            >
              <Server size={16} strokeWidth={1.75} aria-hidden />
              Ver splitter
            </Link>
          ) : null
        }
      />

      {state.status === 'invalid-param' ? (
        <EmptyState
          title="ID inválido"
          description="Use um número positivo na URL (authenticationId do BFF), por exemplo /clientes/111581."
        />
      ) : null}

      {state.status === 'loading' ? (
        <LoadingState label="Sincronizando perfil do cliente…" />
      ) : null}

      {state.status === 'error' ? (
        <ErrorState
          message={formatQueryError(state.error)}
          onRetry={() => refetch()}
        />
      ) : null}

      {state.status === 'not-found' ? (
        <EmptyState
          title="Cliente não encontrado"
          description="Não há autenticação com esse id na lista atual de conexões. Abra a partir de um splitter ou atualize os dados."
        />
      ) : null}

      {state.status === 'ready' && (
        <div className="grid gap-5 lg:gap-6">
          <ClienteDetailClienteSection cliente={state.cliente} />

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
            {state.cliente.address && (
              <ClienteDetailAddressSection address={state.cliente.address} />
            )}
            {state.cliente.contract ? (
              <ClienteDetailContractSection contract={state.cliente.contract} />
            ) : (
              <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 shadow-sm">
                <h2 className="text-sm font-semibold tracking-tight text-on-surface">Contrato</h2>
                <p className="mt-2 text-xs leading-relaxed text-on-surface-variant/75">
                  Não foi possível identificar os dados contratuais para este cliente.
                </p>
              </section>
            )}
          </div>

          {state.cliente.accessPoint && (
            <ClienteDetailAccessPointSection accessPoint={state.cliente.accessPoint} />
          )}

          <ClienteDetailMaintenanceSection clientId={state.cliente.clientId} />

          <ClienteDetailSolicitationsSection clientId={state.cliente.clientId} />
        </div>
      )}
    </div>
  )
}
