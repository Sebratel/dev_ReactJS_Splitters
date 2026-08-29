import { registerCancelledMassivaHistoryInLocalDb } from '@/features/massiva/api/registerCancelledMassivaHistoryInLocalDb'
import { bffClient } from '@/shared/api/bffClient'
import { env } from '@/shared/config/env'

type CancelMassivaInput = {
  assignmentId: number
  protocol: number
  cancelDescription: string
  /** Usuário logado que está cancelando (registrado como autor no histórico local). */
  cancelledBy?: string
}

export type CancelMassivaResult = {
  /** Cancelado com sucesso no Elleven/Voalle (incidentStatusId 8). */
  ok: true
  /**
   * Presente quando o registro local (MySQL) falhou após o cancelamento no Elleven.
   * O protocolo está cancelado no Elleven, mas o histórico local pode ficar inconsistente
   * até o próximo ciclo de sincronização.
   */
  localHistoryWarning?: string
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

/**
 * Cancela um protocolo de massiva na Voalle usando o mesmo endpoint do encerramento
 * (`createsolicitationreport` via gateway), porém com `incidentStatusId` de cancelamento (8).
 * Depois limpa afetados e grava o cancelamento no histórico local como `cancelada`.
 */
export async function cancelMassivaTicket(input: CancelMassivaInput): Promise<CancelMassivaResult> {
  const closePath = normalizePath(env.massivaClosePath)
  if (closePath === '') {
    throw new Error('Defina VITE_MASSIVA_CLOSE_PATH para cancelar massivas.')
  }

  await bffClient.request({
    path: closePath,
    method: 'DELETE',
    body: {
      assignmentId: String(input.assignmentId),
      incidentStatusId: env.massivaCancelIncidentStatusId,
      description: input.cancelDescription,
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
      // Cancelamento concluído no Elleven; limpeza de afetados é auxiliar.
    }
  }

  try {
    await registerCancelledMassivaHistoryInLocalDb({
      protocol: input.protocol,
      assignmentId: input.assignmentId,
      cancelDescription: input.cancelDescription,
      cancelledBy: input.cancelledBy,
    })
    return { ok: true }
  } catch (localError) {
    const msg =
      localError instanceof Error
        ? localError.message
        : 'Erro desconhecido ao salvar cancelamento localmente.'
    console.warn('[Massiva] Falha ao registrar cancelamento no histórico local.', localError)
    return {
      ok: true,
      localHistoryWarning: `Cancelado no Elleven, mas o registro local falhou: ${msg}. O histórico pode demorar a refletir.`,
    }
  }
}
