/**
 * Constantes do payload API Gateway — paridade campos estáticos em `MassivaPage` /
 * `ApiGatewayMassivaRequest` (`lib/screens/massiva_screen.dart` / `massiva_models.dart`).
 * Usado em `buildMassivaOpeningPlanDraft` e `buildMassivaOpenRequestBody` (payload do POST).
 */
export const MASSIVA_API_GATEWAY_DEFAULTS = {
  companyPlaceId: 1,
  incidentStatusId: 1,
  incidentTypeId: 1257,
  catalogServiceId: 1173,
  serviceLevelAgreementId: 99,
  matrixType: 2,
  teamCode: '8.0',
  solicitationServiceCategory1: 'MASSIVAS - 001',
} as const

export type MassivaApiGatewayDefaults = typeof MASSIVA_API_GATEWAY_DEFAULTS
