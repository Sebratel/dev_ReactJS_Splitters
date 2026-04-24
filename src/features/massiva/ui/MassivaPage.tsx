import { useMemo, useState } from 'react'
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

export function MassivaPage() {
  const [currentStep, setCurrentStep] = useState<MassivaStepId>('rota')
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
        description: 'AP, slot e porta',
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

  const activeStep = (() => {
    const applyMultiplePairsAtRoute = (
      routeIndex: number,
      pairs: Array<{ slot: number; port: number }>,
    ) => {
      if (pairs.length === 0) return
      const current = localPreview.selection.connections
      if (routeIndex < 0 || routeIndex >= current.length) return

      const base = current[routeIndex]
      const expanded: MassivaRouteConnectionSelection[] = pairs.map((pair) => ({
        ...base,
        slot: pair.slot,
        porta: pair.port,
      }))

      const merged = [
        ...current.slice(0, routeIndex),
        ...expanded,
        ...current.slice(routeIndex + 1),
      ]

      const deduped = new Map<string, MassivaRouteConnectionSelection>()
      for (const connection of merged) {
        const splittersKey = connection.splitters
          .map((splitter) => splitter.id.trim())
          .filter((id) => id !== '')
          .sort((a, b) => a.localeCompare(b, 'pt-BR'))
          .join(',')
        const key = `${connection.apId.trim()}|${connection.slot ?? ''}|${connection.porta ?? ''}|${splittersKey}`
        if (!deduped.has(key)) deduped.set(key, connection)
      }

      localPreview.setConnections([...deduped.values()])
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
          onClearConnectionSplitters={localPreview.clearConnectionSplitters}
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
    <div className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
      <section className="flex min-h-0 flex-col rounded-xl bg-white shadow-[0_2px_12px_-6px_rgba(15,23,42,0.08)] ring-1 ring-neutral-200/70">
        <div className="space-y-5 px-5 py-5">
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
          <div className="min-h-[420px]">{activeStep}</div>
        </div>

        <BottomActionBar
          summary={summary}
          disabledReason={explainMassivaPostBlocked(readiness)}
          canSubmit={openMutation.canSubmitOpen}
          isPending={openMutation.isPending}
          isSuccess={openMutation.isSuccess}
          isError={openMutation.isError}
          error={openMutation.error}
          successPayload={openMutation.data}
          apTitleByCode={apTitleByCode}
          onSubmit={openMutation.submitOpen}
          onDismiss={openMutation.dismissMutation}
        />
      </section>

      <RightPanel />
    </div>
  )
}
