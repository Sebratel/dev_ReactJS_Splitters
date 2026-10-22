/**
 * Constantes de abertura da GMUD no Elleven (confirmadas no Voalle). O Elleven resolve a matriz
 * de atendimento pela CATEGORIA de serviço — e `solicitationServiceCategory1` deve ser o
 * **código da categoria**, não o código da matriz.
 *
 * Mapa validado no banco (erp): catálogo 1082 ("GMUD") + categoria 269 (code `infra - 39`,
 * "Infraestrutura (Gestão de Mudança de Rede (GMUD))") → matriz única 6950 (SLA 99, matrixType 2),
 * equipe 2.8 (team 1007, CGR). Na massiva funciona porque o código da matriz e o da categoria
 * coincidem ('MASSIVAS - 001'); na GMUD eles diferem: matriz=`infra - 42`, categoria=`infra - 39`.
 * Enviar o código da matriz ('infra - 42') aponta para a categoria 274 (Link Loss), sem matriz no
 * catálogo 1082 → Elleven recusa com "Não foi encontrado nenhuma matriz padrão configurada".
 */
export const GMUD_API_GATEWAY_DEFAULTS = {
  companyPlaceId: 1,
  incidentStatusId: 1,
  incidentTypeId: 1084,
  catalogServiceId: 1082,
  serviceLevelAgreementId: 99,
  matrixType: 2,
  teamCode: '2.8',
  // Código da CATEGORIA de serviço (categoria 269), não o código da matriz.
  solicitationServiceCategory1: 'infra - 39',
} as const

/** Endpoint dedicado da GMUD no gateway (roteado para o Elleven, com idempotência). */
export const GMUD_OPEN_PATH = '/api/v1/gmud/abrir-via-api' as const
