import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMassivaLocalPreview } from '@/features/massiva/hooks/useMassivaLocalPreview'
import { useMassivaOpenReadiness } from '@/features/massiva/hooks/useMassivaOpenReadiness'
import { useMassivaOpenMutation } from '@/features/massiva/hooks/useMassivaOpenMutation'
import { explainMassivaPostBlocked } from '@/features/massiva/lib/explainMassivaPostBlocked'
import { BottomActionBar } from '@/features/massiva/ui/BottomActionBar'
import {
  MassivaStepper,
  type MassivaStepId,
  type MassivaStepItem,
} from '@/features/massiva/ui/MassivaStepper'
import { RightPanel } from '@/features/massiva/ui/RightPanel'
import { MassivaTicketsSection } from '@/features/massiva/ui/MassivaTicketsSection'
import { StepAbertura } from '@/features/massiva/ui/StepAbertura'
import { StepRota } from '@/features/massiva/ui/StepRota'
import { StepSplitters } from '@/features/massiva/ui/StepSplitters'
import { StepValidacao } from '@/features/massiva/ui/StepValidacao'
import type { MassivaRouteConnectionSelection } from '@/features/massiva/model/massivaLocalPreview'

function countConfiguredRoutes(
  connections: ReturnType<typeof useMassivaLocalPreview>['selection']['connections'],
): number {
  return connections.filter(
    (connection) =>
      connection.apId.trim() !== '' &&
      connection.slot !== null &&
      connection.porta !== null,
  ).length
}

function countRoutesWithExplicitSplitters(
  connections: ReturnType<typeof useMassivaLocalPreview>['selection']['connections'],
): number {
  return connections.filter((connection) => connection.splitters.length > 0).length
}

type MassivaPageProps = {
  canOpenMassiva?: boolean
}

const MASSIVA_PAGE_UI_STATE_KEY = 'nexaview.massiva.page-ui.v1'

function readMassivaPageUiState(): { currentStep: MassivaStepId } {
  if (typeof window === 'undefined') {
    return { currentStep: 'rota' }
  }

  try {
    const raw = window.sessionStorage.getItem(MASSIVA_PAGE_UI_STATE_KEY)
    if (!raw) throw new Error('empty')
    const parsed = JSON.parse(raw) as Partial<{ currentStep: MassivaStepId }>
    return {
      currentStep:
        parsed.currentStep === 'rota' ||
        parsed.currentStep === 'splitters' ||
        parsed.currentStep === 'validacao' ||
        parsed.currentStep === 'abertura'
          ? parsed.currentStep
          : 'rota',
    }
  } catch {
    return { currentStep: 'rota' }
  }
}

export function MassivaPage({ canOpenMassiva = true }: MassivaPageProps) {
  const location = useLocation()
  const [pageUiState, setPageUiState] = useState(readMassivaPageUiState)
  const { currentStep } = pageUiState
  const setCurrentStep = (
    value: MassivaStepId | ((previous: MassivaStepId) => MassivaStepId),
  ) =>
    setPageUiState((previous) => ({
      ...previous,
      currentStep:
        typeof value === 'function'
          ? value(previous.currentStep)
          : value,
    }))
  const enableImpactComputation =
    currentStep === 'validacao' || currentStep === 'abertura'
  const localPreview = useMassivaLocalPreview({ enableImpactComputation })
  const { readiness, draftFormEnabled, refetchPersonId } =
    useMassivaOpenReadiness(localPreview.openingPreparation)
  const openMutation = useMassivaOpenMutation(readiness)

  const configuredRoutes = countConfiguredRoutes(localPreview.selection.connections)
  const routesWithExplicitSplitters = countRoutesWithExplicitSplitters(
    localPreview.selection.connections,
  )

  const steps = useMemo<MassivaStepItem[]>(() => {
    const rotaStatus: MassivaStepItem['status'] =
      configuredRoutes > 0 ? 'success' : currentStep === 'rota' ? 'current' : 'warning'

    const splittersStatus: MassivaStepItem['status'] =
      configuredRoutes === 0
        ? 'idle'
        : routesWithExplicitSplitters > 0
          ? 'success'
          : currentStep === 'splitters'
            ? 'current'
            : 'warning'

    const validacaoStatus: MassivaStepItem['status'] =
      localPreview.view.status === 'success'
        ? 'success'
        : localPreview.view.status === 'empty-selection'
          ? 'warning'
          : localPreview.view.status === 'connections-error'
            ? 'error'
            : currentStep === 'validacao'
              ? 'current'
              : 'idle'

    const aberturaStatus: MassivaStepItem['status'] =
      readiness.status === 'ready-to-open'
        ? 'success'
        : readiness.status === 'missing-assignment' ||
            readiness.status === 'blocked-preparation'
          ? 'warning'
          : readiness.status === 'person-id-error' ||
              readiness.status === 'person-id-invalid' ||
              readiness.status === 'missing-gateway-config' ||
              readiness.status === 'no-permission'
            ? 'error'
            : currentStep === 'abertura'
              ? 'current'
              : 'idle'

    return [
      {
        id: 'rota',
        title: 'Rota',
        description: 'AP, slot e PON',
        status: currentStep === 'rota' ? 'current' : rotaStatus,
      },
      {
        id: 'splitters',
        title: 'Splitters',
        description: 'Busca e seleção',
        status: currentStep === 'splitters' ? 'current' : splittersStatus,
      },
      {
        id: 'validacao',
        title: 'Validação',
        description: 'Impacto e topologia',
        status: currentStep === 'validacao' ? 'current' : validacaoStatus,
      },
      {
        id: 'abertura',
        title: 'Abertura',
        description: 'Formulário e envio',
        status: currentStep === 'abertura' ? 'current' : aberturaStatus,
      },
    ]
  }, [configuredRoutes, currentStep, localPreview.view.status, readiness.status, routesWithExplicitSplitters])

  const summary =
    localPreview.view.status === 'success'
      ? `${localPreview.view.totals.totalAffected} clientes afetados - ${localPreview.view.totals.totalPppoes} PPPoEs - ${localPreview.view.totals.totalCorporateAffected} corporativos`
      : configuredRoutes > 0
        ? `${configuredRoutes} rota(s) configurada(s)`
        : 'Nenhuma rota pronta para abertura'

  const openPermissionReason = canOpenMassiva
    ? null
    : 'Seu perfil tem acesso de leitura em massivas, mas não pode abrir novos chamados.'

  const apTitleByCode = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {}

    if (localPreview.openingPreparation.status === 'prepared') {
      for (const route of localPreview.openingPreparation.basis.topology.routes) {
        if (map[route.apCode] == null) {
          map[route.apCode] = route.apDisplayTitle.trim() !== '' ? route.apDisplayTitle : route.apCode
        }
      }
    }

    if (readiness.status === 'ready-to-open') {
      for (const request of readiness.context.plan.requests) {
        if (map[request.authenticationAccessPointCode] == null) {
          map[request.authenticationAccessPointCode] = request.assignmentTitle
        }
      }
    }

    return map
  }, [localPreview.openingPreparation, readiness])

  const didApplyPrefillRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(
      MASSIVA_PAGE_UI_STATE_KEY,
      JSON.stringify(pageUiState),
    )
  }, [pageUiState])

  useEffect(() => {
    if (didApplyPrefillRef.current) return
    const raw = (location.state as { massivaPrefill?: { splitterCode?: string; splitterLabel?: string } } | null)?.massivaPrefill
    const splitterCode = String(raw?.splitterCode ?? '').trim()
    if (splitterCode === '') {
      didApplyPrefillRef.current = true
      return
    }
    if (localPreview.isRoutesCatalogPending) return
    const candidates = localPreview.findRoutesBySplitterCode(splitterCode, 1)
    if (candidates.length === 0) {
      didApplyPrefillRef.current = true
      return
    }
    const first = candidates[0]
    localPreview.setConnections([{
      apId: first.apCode,
      apLabel: first.apLabel,
      slot: first.slot,
      porta: first.port,
      splitters: [{
        id: splitterCode,
        label: String(raw?.splitterLabel ?? '').trim() || splitterCode,
      }],
    }])
    setCurrentStep('splitters')
    didApplyPrefillRef.current = true
  }, [
    location.state,
    localPreview.findRoutesBySplitterCode,
    localPreview.isRoutesCatalogPending,
    localPreview.setConnections,
  ])

  const activeStep = (() => {
    const applyMultiplePairsAtRoute = (
      routeIndex: number,
      pairs: Array<{ slot: number; port: number }>,
    ) => {
      const current = localPreview.selection.connections
      if (routeIndex < 0 || routeIndex >= current.length) return

      const base = current[routeIndex]
      if (pairs.length === 0) {
        localPreview.setConnections([
          ...current.slice(0, routeIndex),
          { ...base, slot: null, porta: null, selectedPairs: undefined },
          ...current.slice(routeIndex + 1),
        ])
        return
      }
      const normalizedPairs = [...new Map(
        pairs.map((pair) => [`${pair.slot}|${pair.port}`, { slot: pair.slot, port: pair.port }]),
      ).values()]
      if (normalizedPairs.length === 0) return

      const primary = normalizedPairs[0]
      const groupedAtRoute: MassivaRouteConnectionSelection = {
        ...base,
        slot: primary.slot,
        porta: primary.port,
        selectedPairs: normalizedPairs,
      }

      const replaced = [
        ...current.slice(0, routeIndex),
        groupedAtRoute,
        ...current.slice(routeIndex + 1),
      ]

      const oneRoutePerAp = new Map<string, MassivaRouteConnectionSelection>()
      for (const connection of replaced) {
        const apKey = connection.apId.trim()
        if (apKey === '') continue
        const slotPortKey =
          connection.selectedPairs != null && connection.selectedPairs.length > 0
            ? connection.selectedPairs
                .map((pair) => `${pair.slot}/${pair.port}`)
                .sort((a, b) => a.localeCompare(b, 'pt-BR'))
                .join(';')
            : connection.slot !== null && connection.porta !== null
              ? `${connection.slot}/${connection.porta}`
              : 'sem-rota'
        const splittersKey = connection.splitters
          .map((splitter) => splitter.id.trim())
          .filter((id) => id !== '')
          .sort((a, b) => a.localeCompare(b, 'pt-BR'))
          .join(',')
        // Nao colapsa rotas distintas da mesma AP (ex.: AP igual, slot/porta diferentes).
        const key = `${apKey}|${slotPortKey}|${splittersKey}`
        if (!oneRoutePerAp.has(key)) oneRoutePerAp.set(key, connection)
      }

      localPreview.setConnections(
        oneRoutePerAp.size > 0 ? [...oneRoutePerAp.values()] : replaced,
      )
    }

    if (currentStep === 'rota') {
      return (
        <StepRota
          connections={localPreview.selection.connections}
          apDisplayLabel={localPreview.apDisplayLabel}
          apOptionsForConnection={localPreview.apOptionsForConnection}
          slotOptionsForConnection={localPreview.slotOptionsForConnection}
          portOptionsForConnection={localPreview.portOptionsForConnection}
          slotPortOptionsForConnection={localPreview.slotPortOptionsForConnection}
          isRoutesCatalogPending={localPreview.isRoutesCatalogPending}
          isRoutesCatalogError={localPreview.isRoutesCatalogError}
          onRefetchRoutesCatalog={localPreview.refetchRoutesCatalog}
          onAddConnection={localPreview.addConnection}
          onRemoveConnection={localPreview.removeConnection}
          onSetConnectionAp={localPreview.setConnectionAp}
          onApplyMultiplePairsAtRoute={applyMultiplePairsAtRoute}
          onClearRoute={localPreview.clearRoute}
        />
      )
    }

    if (currentStep === 'splitters') {
      return (
        <StepSplitters
          connections={localPreview.selection.connections}
          onToggleConnectionSplitter={localPreview.toggleConnectionSplitter}
          searchSplitterOptionsForConnection={
            localPreview.searchSplitterOptionsForConnection
          }
        />
      )
    }

    if (currentStep === 'validacao') {
      return (
        <StepValidacao
          view={localPreview.view}
          openingPreparation={localPreview.openingPreparation}
          onRetryConnections={localPreview.refetchConnections}
          totalConnectionsCount={localPreview.totalConnectionsCount}
        />
      )
    }

    return (
      <StepAbertura
        readiness={readiness}
        openingPreparation={localPreview.openingPreparation}
        draftFormEnabled={draftFormEnabled}
        onRetryPersonId={refetchPersonId}
      />
    )
  })()

  return (
    <div className="space-y-4 lg:space-y-5 xl:space-y-6">
      <div className="grid min-h-0 gap-4 lg:gap-5 xl:gap-6 min-[1700px]:grid-cols-[minmax(0,7fr)_minmax(380px,3fr)]">
        <section className="flex min-h-0 min-w-0 flex-col rounded-xl bg-white shadow-[0_2px_12px_-6px_rgba(15,23,42,0.08)] ring-1 ring-neutral-200/70">
          <div className="space-y-5 px-3 py-4 sm:px-4 sm:py-5 lg:px-5">
            <MassivaStepper
              currentStep={currentStep}
              steps={steps}
              onStepChange={setCurrentStep}
            />
            {(localPreview.isConnectionsLoading || localPreview.isApplyingFilters) ? (
              <div
                className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900"
                role="status"
                aria-live="polite"
              >
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-500" />
                {localPreview.isConnectionsLoading
                  ? (enableImpactComputation
                    ? 'Carregando conexões e clientes afetados...'
                    : 'Carregando catálogo de rotas/splitters...')
                  : 'Aplicando filtros da rota e atualizando clientes...'}
              </div>
            ) : null}
            <div className="min-h-[360px] sm:min-h-[420px]">{activeStep}</div>
          </div>

          <BottomActionBar
            summary={summary}
            disabledReason={openPermissionReason ?? explainMassivaPostBlocked(readiness)}
            canSubmit={canOpenMassiva && openMutation.canSubmitOpen}
            isPending={openMutation.isPending}
            isSuccess={openMutation.isSuccess}
            isError={openMutation.isError}
            error={openMutation.error}
            successPayload={openMutation.data}
            apTitleByCode={apTitleByCode}
            onSubmit={canOpenMassiva ? openMutation.submitOpen : () => {}}
            onDismiss={openMutation.dismissMutation}
          />
        </section>

        <RightPanel showProtocolsTab={false} />
      </div>

      <section className="rounded-xl bg-white shadow-[0_2px_12px_-6px_rgba(15,23,42,0.08)] ring-1 ring-neutral-200/70">
        <div className="border-b border-neutral-200/80 px-4 py-3 sm:px-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
            Monitoramento de impacto
          </p>
          <h2 className="mt-1 text-base font-semibold text-neutral-900 sm:text-lg">
            Protocolos de massiva
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Acompanhamento completo com indicadores, série de afetados por período e lista paginada para operação.
          </p>
        </div>
        <MassivaTicketsSection />
      </section>
    </div>
  )
}
