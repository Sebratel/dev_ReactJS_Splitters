import { Link, useLocation, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { useMassivaTickets } from '@/features/massiva/hooks/useMassivaTickets'
import { buildMassivaStatsBySplitter, findMassivaStatsForSplitter } from '@/features/splitters/lib/buildMassivaStatsBySplitter'
import { buildSplitterOperationalScore } from '@/features/splitters/lib/buildSplitterOperationalScore'
import { useSplitterDetail } from '@/features/splitters/hooks/useSplitterDetail'
import { useSplitterClientes } from '@/features/splitters/hooks/useSplitterClientes'
import { SplitterAddressSection } from '@/features/splitters/ui/SplitterAddressSection'
import { SplitterClientesSection } from '@/features/splitters/ui/SplitterClientesSection'
import { SplitterDetailSummary } from '@/features/splitters/ui/SplitterDetailSummary'
import { SplitterMapSection } from '@/features/splitters/ui/SplitterMapSection'
import { SplitterOltSection } from '@/features/splitters/ui/SplitterOltSection'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { EmptyState } from '@/shared/ui/states/EmptyState'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { ChevronLeft, Database } from 'lucide-react'

export function SplitterDetailScreen() {
  const { code } = useParams<{ code: string }>()
  const location = useLocation()
  const { state, refetch } = useSplitterDetail(code)
  const { view: massivaView } = useMassivaTickets()
  const backTo =
    typeof location.state?.splittersListHref === 'string'
      ? location.state.splittersListHref
      : '/splitters'
  const massivaStatsByMatcher = useMemo(
    () =>
      massivaView.status === 'success'
        ? buildMassivaStatsBySplitter(massivaView.tickets)
        : new Map(),
    [massivaView],
  )
  const detailMassivaStats =
    state.status === 'ready'
      ? findMassivaStatsForSplitter(
          massivaStatsByMatcher,
          state.splitter.code,
          state.splitter.title,
        )
      : null
  const detailOperationalScore =
    state.status === 'ready' && detailMassivaStats !== null
      ? buildSplitterOperationalScore(state.splitter, detailMassivaStats)
      : null

  const splitterCodeForConnections =
    state.status === 'ready' ? state.splitter.code : undefined
  const connectionsQuery = useSplitterClientes(splitterCodeForConnections)
  const connectionsLoadState =
    connectionsQuery.isPending
      ? ('pending' as const)
      : connectionsQuery.isError
        ? ('error' as const)
        : ('success' as const)

  return (
    <div className="space-y-5 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            to={backTo}
            state={location.state}
            aria-label="Voltar para a listagem de equipamentos"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-white text-on-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <ChevronLeft size={22} strokeWidth={2} />
          </Link>
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/55">
              Equipamento
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface md:text-[1.75rem] md:leading-tight">
              Detalhamento
            </h1>
            <p className="font-mono text-sm font-medium text-on-surface-variant/60">
              {code}
            </p>
          </div>
        </div>
      </header>

      {state.status === 'invalid-param' ? (
        <EmptyState
          title="Código inválido"
          description="A rota não inclui o código do equipamento (parâmetro obrigatório na URL)."
        />
      ) : null}

      {state.status === 'loading' ? (
        <LoadingState label="Sincronizando dados técnicos…" />
      ) : null}

      {state.status === 'error' ? (
        <ErrorState
          message={formatQueryError(state.error)}
          onRetry={() => refetch()}
        />
      ) : null}

      {state.status === 'not-found' ? (
        <EmptyState
          title="Splitter não encontrado"
          description="Não há item com esse código na lista atual do backend. Confira o código ou atualize a listagem."
        />
      ) : null}

      {state.status === 'ready' && (
        <div className="grid gap-5 lg:gap-6">
          <SplitterDetailSummary
            splitter={state.splitter}
            massivaStats={detailMassivaStats!}
            operationalScore={detailOperationalScore!}
            connectionsLoadState={connectionsLoadState}
            connectionClientes={connectionsQuery.data?.clientes ?? []}
          />

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
            <SplitterAddressSection
              splitterCode={state.splitter.code}
              latitude={state.splitter.latitude}
              longitude={state.splitter.longitude}
            />
            <SplitterOltSection oltCode={state.splitter.oltCode} />
          </div>

          <SplitterMapSection splitter={state.splitter} />

          <SplitterClientesSection
            splitterCode={state.splitter.code}
            splitterTitle={state.splitter.title}
            capacity={state.splitter.outPorts}
            integrationCode={state.splitter.integrationCode}
          />

          <section
            className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] p-4 shadow-sm"
            aria-label="Informação de Sincronização"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/15 text-primary">
              <Database size={18} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-on-surface">
                Origem dos dados: ERP Elleven
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant/80">
                Fonte: ERP Elleven (base principal). Complemento: plataforma Geogrid para reservas de portas e contexto operacional. Atualização: refletida em cerca de 30 segundos.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

