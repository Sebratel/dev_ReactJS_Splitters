import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { MassivaAffectedClientSignal } from '@/features/massiva/api/fetchMassivaAffectedSignal'

export type DispatchMassivaHsmResult = {
  dispatched: number
}

/**
 * Dispara o HSM pós-massiva (WhatsApp via Matrix, automatizado no N8N) para os
 * clientes que não subiram. O BFF filtra quem tem telefone e repassa ao webhook.
 * Requer permissão de massiva.
 */
export async function dispatchMassivaHsm(input: {
  protocol: number
  clients: Pick<MassivaAffectedClientSignal, 'pppoe' | 'name' | 'phone' | 'contract'>[]
}): Promise<DispatchMassivaHsmResult> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/massivas/hsm`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify({ protocol: input.protocol, clients: input.clients }),
  })

  if (!response.ok) {
    let message = `Erro ao disparar HSM: ${response.status}`
    try {
      const parsed = await response.json()
      if (typeof parsed?.message === 'string' && parsed.message.trim() !== '') message = parsed.message
    } catch {
      // mantém a mensagem genérica
    }
    throw new Error(message)
  }

  const parsed = await response.json()
  if (!parsed?.success) {
    throw new Error('Resposta inesperada ao disparar HSM.')
  }

  return { dispatched: Number(parsed.dispatched ?? 0) }
}
