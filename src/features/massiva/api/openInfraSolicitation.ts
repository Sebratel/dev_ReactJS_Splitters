import { bffClient } from '@/shared/api/bffClient'
import { env } from '@/shared/config/env'
import type { MassivaInfraProtocolCode } from '@/features/massiva/model/massivaInfraProtocol'

type OpenInfraSolicitationInput = {
  infraType: MassivaInfraProtocolCode
  personId: number
  /** AP principal da massiva (a lista completa vai na descrição). Pode ser vazio. */
  authenticationAccessPointCode: string | null
  assignmentTitle: string
  /** Máscara já montada pelo frontend. */
  assignmentDescription: string
  /** Prazo em ISO UTC (mesmo formato do POST de abertura da massiva). */
  assignmentFinalDateIso: string
}

export type OpenInfraSolicitationResult = {
  protocol: number | null
  assignmentId: number | null
}

function pickPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

/**
 * Abre um protocolo de infraestrutura vinculado à massiva no gateway
 * (`abrir-protocolo-infra-via-api` → Voalle `opendetailedsolicitation`).
 * A resposta vem embrulhada no `ApiResponse` do BFF: `{ success, data: { response: { protocol, assignmentId } } }`.
 */
export async function openInfraSolicitation(
  input: OpenInfraSolicitationInput,
): Promise<OpenInfraSolicitationResult> {
  const path = env.massivaInfraOpenPath.trim()
  if (path === '') {
    throw new Error('Defina VITE_MASSIVA_INFRA_OPEN_PATH para abrir protocolo de infraestrutura.')
  }

  const data = await bffClient.request<Record<string, unknown>>({
    path,
    method: 'POST',
    body: {
      infraType: input.infraType,
      personId: input.personId,
      authenticationAccessPointCode:
        input.authenticationAccessPointCode && input.authenticationAccessPointCode.trim() !== ''
          ? input.authenticationAccessPointCode
          : undefined,
      assignment: {
        title: input.assignmentTitle,
        description: input.assignmentDescription,
        finalDate: input.assignmentFinalDateIso,
      },
    },
  })

  // Desembrulha ApiResponse<AberturaRegistroMassivoOutputDTO> → response.{protocol, assignmentId}
  const inner = (data?.data ?? data) as Record<string, unknown> | undefined
  const response = (inner?.response ?? undefined) as Record<string, unknown> | undefined

  return {
    protocol: pickPositiveInt(response?.protocol),
    assignmentId: pickPositiveInt(response?.assignmentId),
  }
}
