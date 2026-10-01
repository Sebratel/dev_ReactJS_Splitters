import { bffClient } from '@/shared/api/bffClient'
import { fetchEmployeePersonIdByEmail } from '@/features/massiva/api/fetchEmployeePersonIdByEmail'
import { massivaLocalDateTimeToGatewayIso } from '@/features/massiva/lib/validateMassivaOpenDraft'
import { GMUD_API_GATEWAY_DEFAULTS, GMUD_OPEN_PATH } from '@/features/gmud/model/gmudApiGateway'

export type OpenGmudResult = { protocol: number | null; assignmentId: number | null }

function pickPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

/**
 * Abre o protocolo da GMUD no Elleven (via gateway dedicado — não usa o endpoint da massiva,
 * que sobrescreveria a classificação). Resolve o personId do solicitante, monta o payload com
 * a classificação da GMUD e envia com Idempotency-Key (retry não duplica).
 *
 * `finalDateLocal`: 'yyyy-MM-ddTHH:mm:ss' (data/hora fim da janela) — convertido p/ ISO do gateway.
 */
export async function openGmudInElleven(input: {
  solicitanteEmail: string
  titulo: string
  descricao: string
  finalDateLocal: string
  idempotencyKey?: string
}): Promise<OpenGmudResult> {
  const personId = await fetchEmployeePersonIdByEmail(input.solicitanteEmail)
  const finalDate =
    massivaLocalDateTimeToGatewayIso(input.finalDateLocal) ?? input.finalDateLocal

  const body = {
    incidentStatusId: GMUD_API_GATEWAY_DEFAULTS.incidentStatusId,
    personId,
    incidentTypeId: GMUD_API_GATEWAY_DEFAULTS.incidentTypeId,
    catalogServiceId: GMUD_API_GATEWAY_DEFAULTS.catalogServiceId,
    serviceLevelAgreementId: GMUD_API_GATEWAY_DEFAULTS.serviceLevelAgreementId,
    matrixType: GMUD_API_GATEWAY_DEFAULTS.matrixType,
    teamCode: GMUD_API_GATEWAY_DEFAULTS.teamCode,
    solicitationServiceCategory1: GMUD_API_GATEWAY_DEFAULTS.solicitationServiceCategory1,
    solicitationServiceCategory2: '',
    solicitationServiceCategory3: '',
    solicitationServiceCategory4: '',
    solicitationServiceCategory5: '',
    assignment: {
      title: input.titulo,
      description: input.descricao,
      finalDate,
      companyPlaceId: GMUD_API_GATEWAY_DEFAULTS.companyPlaceId,
    },
    affectedUsersQuantity: 0,
    affectedUsers: [],
  }

  const data = await bffClient.request<Record<string, unknown>>({
    path: GMUD_OPEN_PATH,
    method: 'POST',
    headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : undefined,
    body,
  })

  const inner = (data?.data ?? data) as Record<string, unknown> | undefined
  if (inner?.success === false) {
    const messages = Array.isArray(inner.messages)
      ? (inner.messages as Array<Record<string, unknown>>)
          .map((m) => String(m.message ?? '').trim())
          .filter((s) => s !== '')
      : []
    throw new Error(
      messages.length > 0
        ? messages.join('; ')
        : 'O Elleven recusou a abertura da GMUD sem detalhar o motivo.',
    )
  }
  const response = (inner?.response ?? undefined) as Record<string, unknown> | undefined
  return {
    protocol: pickPositiveInt(response?.protocol),
    assignmentId: pickPositiveInt(response?.assignmentId),
  }
}
