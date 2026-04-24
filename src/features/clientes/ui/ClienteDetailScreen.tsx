import { Link, useParams } from 'react-router-dom'
import { useClienteDetail } from '@/features/clientes/hooks/useClienteDetail'
import { ClienteDetailAccessPointSection } from '@/features/clientes/ui/ClienteDetailAccessPointSection'
import { ClienteDetailAddressSection } from '@/features/clientes/ui/ClienteDetailAddressSection'
import { ClienteDetailClienteSection } from '@/features/clientes/ui/ClienteDetailClienteSection'
import { ClienteDetailContractSection } from '@/features/clientes/ui/ClienteDetailContractSection'
import { ClienteDetailSolicitationsSection } from '@/features/clientes/ui/ClienteDetailSolicitationsSection'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { EmptyState } from '@/shared/ui/states/EmptyState'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { ChevronLeft, Server } from 'lucide-react'

export function ClienteDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { state, refetch } = useClienteDetail(id)

  return (
    <div className="space-y-5 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            to="/splitters"
            aria-label="Voltar para splitters"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-white text-on-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <ChevronLeft size={22} strokeWidth={2} />
          </Link>
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/55">
              Assinante
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface md:text-[1.75rem] md:leading-tight">
              Dados do cliente
            </h1>
            <p className="font-mono text-sm font-medium text-on-surface-variant/60">
              ID autenticação {id}
            </p>
          </div>
        </div>

        {state.status === 'ready' && state.cliente.splitterCode ? (
          <Link
            to={`/splitters/${encodeURIComponent(state.cliente.splitterCode)}`}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low/80 px-4 py-2.5 text-xs font-semibold text-on-surface shadow-sm transition-colors hover:border-primary/30 hover:bg-primary hover:text-on-surface"
          >
            <Server size={16} strokeWidth={1.75} />
            Ver splitter
          </Link>
        ) : null}
      </header>

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

          <ClienteDetailSolicitationsSection clientId={state.cliente.clientId} />
        </div>
      )}
    </div>
  )
}
