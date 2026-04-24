import { env } from '@/shared/config/env'

type RegisterClosedMassivaHistoryInput = {
  protocol: number
  assignmentId: number
  closeDescription: string
}

export async function registerClosedMassivaHistoryInLocalDb(
  input: RegisterClosedMassivaHistoryInput,
): Promise<void> {
  const response = await fetch(`${env.localBffUrl}/api/massiva/history/close`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify({
      protocol: input.protocol,
      assignmentId: input.assignmentId,
      closeDescription: input.closeDescription,
      closedAt: new Date().toISOString(),
    }),
  })

  if (!response.ok) {
    throw new Error(`Erro ao registrar encerramento local da massiva: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success) {
    throw new Error('Resposta inesperada ao registrar encerramento local da massiva.')
  }
}
