import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GoogleSignInButton } from '@/features/session/ui/GoogleSignInButton'
import { buildMassivaAssignmentDescriptionForRequest } from '@/features/massiva/lib/buildMassivaAssignmentDescriptionForRequest'
import { fetchMassivaConnectionsFromLocalDbByRoutes } from '@/features/splitters/api/fetchSplitterConnectionsFromLocalDb'
import type { MassivaOpeningPreparationView } from '@/features/massiva/model/massivaOpeningBasis'
import type {
  MassivaOpenFinalContext,
  MassivaOpenReadinessView,
} from '@/features/massiva/model/massivaOpenReadiness'
import { useMassivaOpenDraftStore } from '@/features/massiva/store/massivaOpenDraftStore'
import { MassivaOpenDraftFields } from '@/features/massiva/ui/MassivaOpenDraftFields'
import { isGoogleIdentityConfigured } from '@/shared/config/env'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type StepAberturaProps = {
  readiness: MassivaOpenReadinessView
  openingPreparation: MassivaOpeningPreparationView
  draftFormEnabled: boolean
  onRetryPersonId: () => void
}

function Notice({
  title,
  description,
  tone = 'neutral',
}: {
  title: string
  description: string
  tone?: 'neutral' | 'warning' | 'error'
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : tone === 'error'
        ? 'border-red-200 bg-red-50 text-red-950'
        : 'border-neutral-200 bg-neutral-50 text-neutral-900'

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-relaxed opacity-90">{description}</p>
    </div>
  )
}

export function StepAbertura({
  readiness,
  openingPreparation,
  draftFormEnabled,
  onRetryPersonId,
}: StepAberturaProps) {
  const assignmentDescription = useMassivaOpenDraftStore((s) => s.assignmentDescription)
  const descriptionAutoSync = useMassivaOpenDraftStore((s) => s.descriptionAutoSync)
  const eventIdentifiedBy = useMassivaOpenDraftStore((s) => s.eventIdentifiedBy)

  // Preview por AP usa amostra de 50 do batch-summary; na abertura buscamos a lista
  // completa por rota para a contagem de afetados bater com a validação.
  const preparedBasis =
    openingPreparation.status === 'prepared' ? openingPreparation.basis : null
  const fullRoutes = useMemo(
    () =>
      preparedBasis
        ? preparedBasis.topology.routes.map((route) => ({
            apCode: route.apCode,
            slot: route.slot,
            port: route.port,
            splitterCodes: [...route.effectiveSplitterCodes],
          }))
        : [],
    [preparedBasis],
  )
  const fullConnectionsQuery = useQuery({
    queryKey: ['massiva', 'open', 'full-connections', JSON.stringify(fullRoutes)],
    queryFn: () => fetchMassivaConnectionsFromLocalDbByRoutes(fullRoutes),
    enabled: fullRoutes.length > 0,
    staleTime: 60_000,
  })
  const fullConnections = fullConnectionsQuery.data ?? []

  const requestsByAp = readiness.status === 'ready-to-open'
    ? readiness.context.plan.requests
    : openingPreparation.status === 'prepared'
      ? openingPreparation.plan.requests
      : []

  const contextForPreview: MassivaOpenFinalContext | null = readiness.status === 'ready-to-open'
    ? readiness.context
    : openingPreparation.status === 'prepared'
      ? {
          personId: 0,
          operatorEmail: '',
          operatorName: '',
          basis: openingPreparation.basis,
          plan: openingPreparation.plan,
          assignmentDescription,
          assignmentFinalDateLocal: '',
          assignmentBeginningDateLocal: null,
          eventIdentifiedAtLocal: null,
          eventIdentifiedBy,
          massivaOpenPath: '',
          massivaAfetadosPath: '',
          affectedUsersQuantityFlutterParity: openingPreparation.plan.affectedUsersQuantityFlutterParity,
          descriptionAutoSyncEnabled: descriptionAutoSync,
        }
      : null

  const effectiveContextForPreview: MassivaOpenFinalContext | null =
    contextForPreview !== null &&
    fullConnections.length > contextForPreview.basis.collectedClientes.length
      ? {
          ...contextForPreview,
          basis: { ...contextForPreview.basis, collectedClientes: fullConnections },
        }
      : contextForPreview

  const descriptionByAp =
    effectiveContextForPreview !== null
      ? requestsByAp.map((request) => ({
          apCode: request.authenticationAccessPointCode,
          apTitle: request.assignmentTitle,
          description: buildMassivaAssignmentDescriptionForRequest(
            effectiveContextForPreview,
            request,
          ),
        }))
      : []

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-neutral-900">Abertura</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Complete dados operacionais, gere a descrição técnica e revise bloqueios antes do envio.
        </p>
      </div>

      {readiness.status === 'blocked-preparation' ? (
        <Notice
          tone="warning"
          title="Validação obrigatória"
          description="Conclua rota e validação antes de preencher a abertura final."
        />
      ) : null}

      {readiness.status === 'missing-session' ? (
        <div className="space-y-3">
          <Notice
            title="Sessão necessária"
            description={
              readiness.reason === 'token'
                ? 'Faça login para usar as APIs que exigem autorização.'
                : readiness.reason === 'email'
                  ? 'O perfil precisa de e-mail para resolver personId.'
                  : 'O perfil de sessão está incompleto.'
            }
          />
          {readiness.reason === 'token' && isGoogleIdentityConfigured() ? (
            <GoogleSignInButton />
          ) : null}
        </div>
      ) : null}

      {readiness.status === 'no-permission' ? (
        <Notice
          tone="error"
          title="Sem permissão"
          description="O usuário atual não pode abrir massiva neste ambiente."
        />
      ) : null}

      {readiness.status === 'resolving-person-id' ? (
        <LoadingState label="Resolvendo personId..." />
      ) : null}

      {readiness.status === 'person-id-error' ? (
        <ErrorState
          title="Falha ao obter personId"
          message={formatQueryError(readiness.error)}
          onRetry={onRetryPersonId}
        />
      ) : null}

      {readiness.status === 'person-id-invalid' ? (
        <Notice
          tone="error"
          title="personId inválido"
          description="Sessão ou endpoint de funcionário não retornou um identificador válido."
        />
      ) : null}

      {readiness.status === 'missing-gateway-config' ? (
        <Notice
          tone="warning"
          title="Configuração ausente"
          description="Defina VITE_MASSIVA_OPEN_PATH e VITE_MASSIVA_AFETADOS_PATH no ambiente."
        />
      ) : null}

      {readiness.status === 'missing-assignment' ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          <p className="text-sm font-semibold">Campos obrigatórios pendentes</p>
          <ul className="mt-2 space-y-1 text-sm">
            {readiness.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {requestsByAp.length > 0 ? (
        <div className="space-y-3">
          {readiness.status === 'ready-to-open' ? (
            <Notice
              title="Fluxo pronto"
              description="A abertura está pronta para envio. Revise a descrição e use a ação principal fixa no rodapé."
            />
          ) : null}
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950">
            <p className="text-sm font-semibold">
              Protocolos previstos: {requestsByAp.length} (1 por ponto de acesso)
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {requestsByAp.map((request) => (
                <li key={request.authenticationAccessPointCode}>
                  {request.assignmentTitle} ({request.authenticationAccessPointCode})
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <MassivaOpenDraftFields
        disabled={!draftFormEnabled}
        descriptionByAp={descriptionByAp}
      />
    </div>
  )
}
