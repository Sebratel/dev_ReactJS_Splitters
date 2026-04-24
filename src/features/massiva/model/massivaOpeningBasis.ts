import type { MassivaApiGatewayDefaults } from '@/features/massiva/model/massivaApiGatewayConstants'
import type { MassivaLocalPreviewTotals } from '@/features/massiva/model/massivaLocalPreview'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/** Entrada para exibir CTO/splitter: codigo interno + nomenclatura (`ss.title` / catalogo). */
export type MassivaSplitterDisplayEntry = {
  code: string
  label: string
}

export type MassivaRouteConnectionResolved = {
  apCode: string
  apDisplayTitle: string
  slot: number
  port: number
  effectiveSplitterCodes: string[]
  effectiveSplitterDisplay: MassivaSplitterDisplayEntry[]
}

/** Rotas resolvidas (AP + slot + porta + splitters efetivos) para abertura. */
export type MassivaRouteTopologyResolved = {
  routes: MassivaRouteConnectionResolved[]
}

/**
 * Dados derivados da selecao/preview reutilizaveis pela abertura e por `notifyAffectedUsers` futuros.
 */
export type MassivaOpeningBasis = {
  topology: MassivaRouteTopologyResolved
  /** Clientes unicos nas rotas (dedupe `auth:` / `user:`). */
  collectedClientes: SplitterCliente[]
  previewTotals: MassivaLocalPreviewTotals
  /** `authenticationId` unicos > 0 entre os coletados nas rotas. */
  uniqueAuthenticationIdsOnRoute: number[]
  /**
   * Paridade `_estimatedAffectedClients` no Flutter: por codigo de splitter,
   * sem filtrar slot/porta/AP.
   */
  flutterStyleAffectedUsersQuantity: number
}

/**
 * Esqueleto estatico do que vira `ApiGatewayMassivaRequest` (sem mutacao, sem rede).
 */
export type MassivaOpeningPlanDraft = {
  apiDefaults: MassivaApiGatewayDefaults
  requests: Array<{
    authenticationAccessPointCode: string
    assignmentTitle: string
  }>
  pendingBeforePost: readonly [
    'personId',
    'assignmentDescription',
    'assignmentFinalDateIsoUtc',
  ]
  affectedUsersQuantityFlutterParity: number
  routeCollectedClientCount: number
  routeUniqueAuthenticationIdCount: number
}

export type MassivaOpeningPreparationView =
  | { status: 'unavailable'; reason: 'connections-loading' }
  | { status: 'unavailable'; reason: 'connections-error'; error: unknown }
  | { status: 'invalid'; issues: string[] }
  | { status: 'prepared'; basis: MassivaOpeningBasis; plan: MassivaOpeningPlanDraft }
