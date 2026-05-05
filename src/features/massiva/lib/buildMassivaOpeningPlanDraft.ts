import { MASSIVA_API_GATEWAY_DEFAULTS } from '@/features/massiva/model/massivaApiGatewayConstants'
import type {
  MassivaOpeningBasis,
  MassivaOpeningPlanDraft,
} from '@/features/massiva/model/massivaOpeningBasis'

/**
 * Plano estatico por AP - uma requisicao por AP selecionado na topologia.
 */
export function buildMassivaOpeningPlanDraft(
  basis: MassivaOpeningBasis,
): MassivaOpeningPlanDraft {
  const apByCode = new Map<string, string>()

  for (const route of basis.topology.routes) {
    const title = route.apDisplayTitle.trim() !== ''
      ? route.apDisplayTitle.trim()
      : route.apCode

    if (!apByCode.has(route.apCode)) {
      apByCode.set(route.apCode, title)
    }
  }

  const requests = [...apByCode.entries()]
    .sort(([apA], [apB]) => apA.localeCompare(apB, 'pt-BR'))
    .map(([authenticationAccessPointCode, assignmentTitle]) => ({
      authenticationAccessPointCode,
      assignmentTitle,
    }))

  return {
    apiDefaults: MASSIVA_API_GATEWAY_DEFAULTS,
    requests,
    pendingBeforePost: [
      'personId',
      'assignmentDescription',
      'assignmentFinalDateLocal',
    ] as const,
    affectedUsersQuantityFlutterParity: basis.flutterStyleAffectedUsersQuantity,
    routeCollectedClientCount: basis.collectedClientes.length,
    routeUniqueAuthenticationIdCount: basis.uniqueAuthenticationIdsOnRoute.length,
  }
}
