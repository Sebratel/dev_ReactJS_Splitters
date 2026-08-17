import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type VerifyMassivaAffectedClientsResult = {
  total: number
  stillOffline: number
  stillDegraded: number
  checkedAt: Date | null
}

/**
 * Verificação sob demanda: "os clientes desta massiva encerrada continuam sem sinal?".
 * Cruza a lista de clientes afetados (gravada na abertura) com o monitoramento de ONU.
 * Só roda quando o usuário aciona explicitamente — nada dispara isso sozinho, e o
 * resultado fica persistido (é a única fonte do painel de parede).
 */
export async function verifyMassivaAffectedClients(input: {
  protocol: number
  assignmentId: number | null
  /** Usuário logado que está verificando. */
  verifiedBy?: string
}): Promise<VerifyMassivaAffectedClientsResult> {
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/verify-affected-clients`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify({
        protocol: input.protocol,
        assignmentId: input.assignmentId,
        verifiedBy: input.verifiedBy ?? '',
      }),
    },
  )

  if (!response.ok) {
    let message = `Erro ao verificar clientes afetados: ${response.status}`
    try {
      const parsed = await response.json()
      if (typeof parsed?.message === 'string' && parsed.message.trim() !== '') {
        message = parsed.message
      }
    } catch {
      // mantém a mensagem genérica
    }
    throw new Error(message)
  }

  const parsed = await response.json()
  if (!parsed?.success || parsed?.data == null) {
    throw new Error('Resposta inesperada ao verificar clientes afetados.')
  }

  const data = parsed.data as Record<string, unknown>
  const checkedAtRaw = typeof data.checkedAt === 'string' ? new Date(data.checkedAt) : null
  return {
    total: Number(data.total ?? 0),
    stillOffline: Number(data.stillOffline ?? 0),
    stillDegraded: Number(data.stillDegraded ?? 0),
    checkedAt: checkedAtRaw != null && !Number.isNaN(checkedAtRaw.getTime()) ? checkedAtRaw : null,
  }
}
