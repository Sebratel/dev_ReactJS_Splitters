import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { UsuarioAfetadoEntity } from '@/features/massiva/lib/buildMassivaAfetadosRequestBody'

/**
 * Grava, no nosso MySQL local, a lista de clientes afetados (pppoe + contractId) de uma
 * massiva — a mesma lista que já mandamos ao gateway (`usuarioAfetadoEntities`), só que
 * uma cópia nossa. Existe pra viabilizar a verificação de sinal pós-encerramento sem
 * depender do DELETE de limpeza do gateway (que apaga a lista dele assim que a massiva
 * fecha ou é cancelada).
 *
 * Best-effort: falha aqui não deve derrubar a abertura da massiva — é chamada dentro de
 * um try/catch no fluxo de abertura, igual ao registro de afetados no gateway.
 */
export async function registerMassivaAffectedClientsInLocalDb(input: {
  protocol: number
  assignmentId: number
  entities: readonly UsuarioAfetadoEntity[]
}): Promise<void> {
  if (input.entities.length === 0) return

  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/massiva/history/affected-clients`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify({
      protocol: input.protocol,
      assignmentId: input.assignmentId,
      clients: input.entities.map((e) => ({ pppoe: e.pppoe, contractId: e.contractId })),
    }),
  })

  if (!response.ok) {
    throw new Error(`Erro ao registrar clientes afetados localmente: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success) {
    throw new Error('Resposta inesperada ao registrar clientes afetados localmente.')
  }
}
