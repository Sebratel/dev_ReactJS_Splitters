import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { GmudFormState } from '@/features/gmud/model/gmudForm'

export type CreateGmudResult = { id: number | null; voalleProtocol: number | null }

/** Registra a GMUD no nosso banco (campos do formulário). Não abre protocolo no Elleven nesta etapa. */
export async function createGmud(form: GmudFormState): Promise<CreateGmudResult> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    const message =
      (result && typeof result.message === 'string' && result.message) ||
      'Falha ao registrar a GMUD.'
    const error = new Error(message) as Error & { statusCode?: number }
    error.statusCode = response.status
    throw error
  }
  return result.data as CreateGmudResult
}
