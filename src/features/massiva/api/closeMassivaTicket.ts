import { registerClosedMassivaHistoryInLocalDb } from '@/features/massiva/api/registerClosedMassivaHistoryInLocalDb'
import { bffClient } from '@/shared/api/bffClient'
import { env } from '@/shared/config/env'

type CloseMassivaInput = {
  assignmentId: number
  protocol: number
  closeDescription: string
}

function normalizePath(path: string): string {
  const trimmed = path.trim()
  if (trimmed === '') return ''
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function affectedUsersCleanupBasePath(): string {
  const fromDedicated = normalizePath(env.massivaAffectedUsersPath)
  if (fromDedicated !== '') return fromDedicated
  return normalizePath(env.massivaAfetadosPath)
}

export async function closeMassivaTicket(input: CloseMassivaInput): Promise<void> {
  const closePath = normalizePath(env.massivaClosePath)
  if (closePath === '') {
    throw new Error('Defina VITE_MASSIVA_CLOSE_PATH para encerrar massivas.')
  }

  await bffClient.request({
    path: closePath,
    method: 'DELETE',
    body: {
      assignmentId: String(input.assignmentId),
      incidentStatusId: env.massivaCloseIncidentStatusId,
      description: input.closeDescription,
      progress: env.massivaCloseProgress,
      priority: env.massivaClosePriority,
      notificationTarget: env.massivaCloseNotificationTarget,
      privateReport: env.massivaClosePrivateReport,
    },
  })

  const affectedBasePath = affectedUsersCleanupBasePath()
  if (affectedBasePath !== '' && input.protocol > 0) {
    try {
      await bffClient.request({
        path: `${affectedBasePath}/protocol/${encodeURIComponent(String(input.protocol))}`,
        method: 'DELETE',
      })
    } catch {
      // Encerramento já concluído no BFF; limpeza de afetados é auxiliar.
    }
  }

  try {
    await registerClosedMassivaHistoryInLocalDb(input)
  } catch (localError) {
    console.warn('[Massiva] Falha ao registrar encerramento no histórico local.', localError)
  }
}
