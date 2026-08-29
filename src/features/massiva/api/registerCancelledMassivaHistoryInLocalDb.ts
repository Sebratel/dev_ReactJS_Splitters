import { env } from '@/shared/config/env'
import { nowInBrazilIsoLike } from '@/features/massiva/lib/formatBrazilDateTime'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

type RegisterCancelledMassivaHistoryInput = {
  protocol: number
  assignmentId: number
  /** Motivo do cancelamento (relato enviado à Voalle e gravado no histórico local). */
  cancelDescription: string
  /** Quem cancelou (usuário logado na plataforma). */
  cancelledBy?: string
}

/**
 * Marca a massiva como `cancelada` no histórico local (MySQL).
 * Espelha `registerClosedMassivaHistoryInLocalDb`, mas atinge a rota de cancelamento.
 */
export async function registerCancelledMassivaHistoryInLocalDb(
  input: RegisterCancelledMassivaHistoryInput,
): Promise<void> {
  const nowBrazil = nowInBrazilIsoLike()
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/massiva/history/cancel`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify({
      protocol: input.protocol,
      assignmentId: input.assignmentId,
      closeDescription: input.cancelDescription,
      closedBy: input.cancelledBy ?? '',
      closedAt: nowBrazil,
    }),
  })

  if (!response.ok) {
    throw new Error(`Erro ao registrar cancelamento local da massiva: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success) {
    throw new Error('Resposta inesperada ao registrar cancelamento local da massiva.')
  }
}
