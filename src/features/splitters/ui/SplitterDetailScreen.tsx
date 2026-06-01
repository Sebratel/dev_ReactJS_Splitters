import { useLocation, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import type { SplitterMapReliefInsight } from '@/features/splitters/lib/splitterStreetRelief'
import { useOperationalMassivaTickets } from '@/features/massiva/hooks/useOperationalMassivaTickets'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { findMassivaStatsForSplitter } from '@/features/splitters/lib/buildMassivaStatsBySplitter'
import { mergeSplitterMassivaStats } from '@/features/splitters/lib/mergeSplitterMassivaStats'
import { buildSplitterOperationalScore } from '@/features/splitters/lib/buildSplitterOperationalScore'
import { useSplitterMassivaStatsFromLocalDb } from '@/features/splitters/hooks/useSplitterMassivaStatsFromLocalDb'
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
import { Database } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'

export function SplitterDetailScreen() {
  const { code } = useParams<{ code: string }>()
  const location = useLocation()
  const { state, refetch, dataUpdatedAt: splitterUpdatedAt, isFetching: splitterIsFetching } = useSplitterDetail(code)
  const canViewMassiva = useAccessAuthStore((s) => s.hasPermission('canViewMassiva'))
  const operationalMassiva = useOperationalMassivaTickets({ enabled: canViewMassiva })
  const localMassivaStatsQuery = useSplitterMassivaStatsFromLocalDb(
    state.status === 'ready' ? [state.splitter.code] : [],
  )
  const rawListHref =
    location.state && typeof location.state === 'object' && 'splittersListHref' in location.state
      ? (location.state as { splittersListHref?: unknown }).splittersListHref
      : undefined
  const backTo =
    typeof rawListHref === 'string' &&
    rawListHref.trim() !== '' &&
    rawListHref.trim().startsWith('/') &&
    !rawListHref.trim().startsWith('//')
      ? rawListHref.trim()
      : '/splitters'
  const detailMassivaStats = useMemo(() => {
    if (state.status !== 'ready') return null
    const codeKey = String(state.splitter.code ?? '').trim()
    const localMassiva = localMassivaStatsQuery.data?.get(codeKey)
    const fromTickets = findMassivaStatsForSplitter(
      operationalMassiva.statsByMatcher,
      state.splitter.code,
      state.splitter.title,
    )
    return mergeSplitterMassivaStats(localMassiva, fromTickets)
  }, [state, localMassivaStatsQuery.data, operationalMassiva.statsByMatcher])
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
  const lastUpdatedAtMs = Math.max(
    0,
    Number(splitterUpdatedAt ?? 0),
    Number(connectionsQuery.dataUpdatedAt ?? 0),
    Number(localMassivaStatsQuery.dataUpdatedAt ?? 0),
  )
  const isRefreshingDetail =
    splitterIsFetching || connectionsQuery.isFetching || localMassivaStatsQuery.isFetching
  const refreshDetailNow = () => {
    void connectionsQuery.refetch()
    void localMassivaStatsQuery.refetch()
    void refetch()
  }

  const [mapReliefInsight, setMapReliefInsight] = useState<SplitterMapReliefInsight>({
    evaluationSettled: false,
    streetReliefNeighbor: null,
  })
  const mapReliefResetKey = state.status === 'ready' ? state.splitter.code : null
  useEffect(() => {
    setMapReliefInsight({ evaluationSettled: false, streetReliefNeighbor: null })
  }, [mapReliefResetKey])

  return (
    <>
      <AppPageHeader
        icon={Database}
        badge="Equipamento"
        title="Detalhamento do splitter"
        description={
          code
            ? `Código na rede secundária: ${code}. Visualize ocupação, clientes, mapa e massivas vinculadas.`
            : 'Carregando identificação do equipamento…'
        }
        primaryAction={{
          to: backTo,
          label: 'Voltar à lista',
          state: { splittersListHref: backTo },
        }}
      />

      <div className="space-y-5 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
            onRefreshNow={refreshDetailNow}
            isRefreshing={isRefreshingDetail}
            lastUpdatedAtMs={lastUpdatedAtMs}
            mapReliefInsight={mapReliefInsight}
          />

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
            <SplitterAddressSection
              splitterCode={state.splitter.code}
              latitude={state.splitter.latitude}
              longitude={state.splitter.longitude}
            />
            <SplitterOltSection oltCode={state.splitter.oltCode} />
          </div>

          <SplitterMapSection splitter={state.splitter} onMapReliefInsightChange={setMapReliefInsight} />

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
    </>
  )
}

