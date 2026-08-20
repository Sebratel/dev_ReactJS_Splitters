import type {
  MassivaOpeningBasis,
  MassivaOpeningPlanDraft,
  MassivaOpeningPreparationView,
} from '@/features/massiva/model/massivaOpeningBasis'
import type { MassivaEventIdentifiedBy } from '@/features/massiva/store/massivaOpenDraftStore'

/**
 * Contexto final antes do POST de abertura — tudo resolvido exceto a mutação em si.
 * Paridade com dados montados em `_buildApiGatewayRequests` + `openMassivaViaApiGateway` (sem enviar).
 */
export type MassivaOpenFinalContext = {
  personId: number
  operatorEmail: string
  /** Nome do operador logado (para "Responsável pela identificação" no protocolo de infra). */
  operatorName: string
  basis: MassivaOpeningBasis
  plan: MassivaOpeningPlanDraft
  assignmentDescription: string
  /** Prazo no fuso do formulário (`yyyy-MM-dd'T'HH:mm:ss`) — histórico MySQL; o POST ao gateway converte para ISO UTC. */
  assignmentFinalDateLocal: string
  /** Início do evento no fuso do formulário; convertido para ISO UTC no POST ao gateway. */
  assignmentBeginningDateLocal: string | null
  /** Horário em que o evento foi identificado (campo operacional do formulário de abertura). */
  eventIdentifiedAtLocal: string | null
  /** Quem identificou o evento (tecnico/zabbix/int6) — persistido no histórico local para indicador. */
  eventIdentifiedBy: MassivaEventIdentifiedBy
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
