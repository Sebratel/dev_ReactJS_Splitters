import {
  parseMassivaConferenciaStatus,
  type MassivaConferenciaStatus,
} from '@/features/massiva/model/massivaConferenciaStatus'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { env } from '@/shared/config/env'

/** GET no backend local: estado da conferência com o Elleven (somente leitura). */
export async function fetchMassivaConferenciaStatus(): Promise<MassivaConferenciaStatus> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/massiva/conferencia/status`)
  if (!response.ok) {
    throw new Error(`Erro ao consultar a conferência com o Elleven: ${response.status}`)
  }
  const parsed: unknown = await response.json()
  const body = parsed as { success?: unknown; data?: unknown } | null
  if (body == null || body.success !== true || body.data == null || typeof body.data !== 'object') {
    throw new Error('Formato de resposta inesperado ao consultar a conferência com o Elleven.')
  }
  return parseMassivaConferenciaStatus(body.data)
}
