/**
 * Constantes de abertura da GMUD no Elleven (confirmadas no Voalle — matrix 6950,
 * validadas pela massiva cujo matrix 8790.code == 'MASSIVAS - 001'). Espelham
 * MASSIVA_API_GATEWAY_DEFAULTS, trocando a classificação para a da GMUD.
 */
export const GMUD_API_GATEWAY_DEFAULTS = {
  companyPlaceId: 1,
  incidentStatusId: 1,
  incidentTypeId: 1084,
  catalogServiceId: 1082,
  serviceLevelAgreementId: 99,
  matrixType: 2,
  teamCode: '2.8',
  solicitationServiceCategory1: 'infra - 42',
} as const

/** Endpoint dedicado da GMUD no gateway (roteado para o Elleven, com idempotência). */
export const GMUD_OPEN_PATH = '/api/v1/gmud/abrir-via-api' as const
