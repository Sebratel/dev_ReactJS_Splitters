import type {
  MassivaOpeningBasis,
  MassivaOpeningPlanDraft,
  MassivaOpeningPreparationView,
} from '@/features/massiva/model/massivaOpeningBasis'

/**
 * Contexto final antes do POST de abertura — tudo resolvido exceto a mutação em si.
 * Paridade com dados montados em `_buildApiGatewayRequests` + `openMassivaViaApiGateway` (sem enviar).
 */
export type MassivaOpenFinalContext = {
  personId: number
  operatorEmail: string
  basis: MassivaOpeningBasis
  plan: MassivaOpeningPlanDraft
  assignmentDescription: string
  /** `assignment.finalDate` em ISO UTC (paridade `closedAt.toUtc().toIso8601String()`). */
  assignmentFinalDateIsoUtc: string
  /** Path configurado para o POST futuro (relativo ao BFF). */
  massivaOpenPath: string
  /** Path do POST de afetados após abertura (relativo ao BFF). */
  massivaAfetadosPath: string
  affectedUsersQuantityFlutterParity: number
  descriptionAutoSyncEnabled: boolean
}

export type MassivaOpenReadinessView =
  | {
      status: 'blocked-preparation'
      preparation: MassivaOpeningPreparationView
    }
  | { status: 'missing-session'; reason: 'token' | 'user-profile' | 'email' }
  | { status: 'no-permission' }
  | { status: 'resolving-person-id' }
  | { status: 'person-id-error'; error: unknown }
  | { status: 'person-id-invalid' }
  | { status: 'missing-gateway-config' }
  | { status: 'missing-assignment'; issues: string[] }
  | { status: 'ready-to-open'; context: MassivaOpenFinalContext }
