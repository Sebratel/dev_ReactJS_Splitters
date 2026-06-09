import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'
import { buildMassivaAssignmentDescriptionForRequest } from '@/features/massiva/lib/buildMassivaAssignmentDescriptionForRequest'
import { massivaLocalDateTimeToGatewayIso } from '@/features/massiva/lib/validateMassivaOpenDraft'

type PlanRequest = MassivaOpenFinalContext['plan']['requests'][number]

/**
 * Corpo JSON de um POST de abertura — paridade `ApiGatewayMassivaRequest.toJson` em
 * `massiva_models.dart` (`affectedUsers` vazio + `affectedUsersQuantity`).
 *
 * O app envia via `bffClient`: `Authorization: Bearer <token>` igual à listagem de massivas
 * e ao POST de afetados (OIDC `access_token`, token legado ou `VITE_DEV_SESSION_TOKEN`).
 */
export function buildMassivaOpenRequestBody(
  context: MassivaOpenFinalContext,
  request: PlanRequest,
): Record<string, unknown> {
  const d = context.plan.apiDefaults
  const assignmentDescription = buildMassivaAssignmentDescriptionForRequest(context, request)
  const finalDateGateway =
    massivaLocalDateTimeToGatewayIso(context.assignmentFinalDateLocal) ??
    context.assignmentFinalDateLocal

  return {
    incidentStatusId: d.incidentStatusId,
    personId: context.personId,
    incidentTypeId: d.incidentTypeId,
    catalogServiceId: d.catalogServiceId,
    serviceLevelAgreementId: d.serviceLevelAgreementId,
    matrixType: d.matrixType,
    teamCode: d.teamCode,
    solicitationServiceCategory1: d.solicitationServiceCategory1,
    solicitationServiceCategory2: '',
    solicitationServiceCategory3: '',
    solicitationServiceCategory4: '',
    solicitationServiceCategory5: '',
    authenticationAccessPointCode: request.authenticationAccessPointCode,
    assignment: {
      title: request.assignmentTitle,
      description: assignmentDescription,
      finalDate: finalDateGateway,
      companyPlaceId: d.companyPlaceId,
    },
    affectedUsersQuantity: context.affectedUsersQuantityFlutterParity,
    affectedUsers: [],
  }
}
