import { env } from '@/shared/config/env'
import { formatInBrazilIsoLike } from '@/features/massiva/lib/formatBrazilDateTime'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

type RegisterMassivaExpectedCloseInput = {
  protocol: number
  assignmentId?: number | null
  /** Nova previsão de encerramento escolhida pelo usuário. */
  expectedCloseAt: Date
}

/**
 * Persiste a previsão de encerramento editada no banco local (`massiva_history`).
 * Essa coluna é a fonte de verdade da data exibida no painel para massivas abertas
 * (o merge prioriza o valor local sobre o Elleven), então sem isto a edição não
 * refletiria para os demais usuários.
 *
 * Retorna quantas linhas foram atualizadas (0 se a massiva não existe no histórico local).
 */
export async function registerMassivaExpectedCloseInLocalDb(
  input: RegisterMassivaExpectedCloseInput,
): Promise<{ updated: number }> {
  const expectedCloseBrazil =
    formatInBrazilIsoLike(input.expectedCloseAt) ?? input.expectedCloseAt.toISOString()

  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/update-expected-close`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify({
        protocol: input.protocol,
        assignmentId: input.assignmentId ?? null,
        expectedCloseAt: expectedCloseBrazil,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Erro ao atualizar previsão de encerramento local da massiva: ${response.status}`,
    )
  }

  const parsed = await response.json()
  if (!parsed?.success) {
    throw new Error('Resposta inesperada ao atualizar previsão de encerramento local da massiva.')
  }
  return { updated: Number(parsed?.data?.updated ?? 0) }
}
