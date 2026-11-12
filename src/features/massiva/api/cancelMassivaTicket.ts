import { finalizeMassivaOnServer } from '@/features/massiva/api/finalizeMassivaOnServer'
import { registerCancelledMassivaHistoryInLocalDb } from '@/features/massiva/api/registerCancelledMassivaHistoryInLocalDb'
import { bffClient } from '@/shared/api/bffClient'
import { env } from '@/shared/config/env'

type CancelMassivaInput = {
  assignmentId: number
  protocol: number
  cancelDescription: string
  /** Usuário logado que está cancelando (registrado como autor no histórico local). */
  cancelledBy?: string
  /** Protocolo de infra aberto junto com a massiva: é cancelado também (o backend o localiza sozinho; no fluxo pelo navegador usa este id). */
  infraProtocol?: number | null
  infraAssignmentId?: number | null
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
  /** Protocolo de infra cancelado junto com a massiva (quando havia um). */
  infraCancelledProtocol?: number | null
}

/** Texto de aviso quando a massiva foi cancelada mas o protocolo de infra não. */
export function buildInfraCancelWarning(infraProtocol: number | null | undefined, reason?: string): string {
  const which = infraProtocol ? ` ${infraProtocol}` : ''
  return `A massiva foi cancelada, mas o protocolo de infra${which} não foi cancelado automaticamente${reason ? ` (${reason})` : ''}. Cancele-o manualmente.`
}

function joinWarnings(...parts: Array<string | undefined>): string | undefined {
  const text = parts.filter((p): p is string => Boolean(p)).join('\n')
  return text === '' ? undefined : text
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
  // Caminho preferido: o backend faz tudo (Elleven, afetados e histórico local) numa só requisição.
  const onServer = await finalizeMassivaOnServer({
    mode: 'cancelar',
    protocol: input.protocol,
    assignmentId: input.assignmentId,
    description: input.cancelDescription,
  })
  if (onServer.handled) {
    const infra = onServer.infraCancel
    const warning = joinWarnings(
      onServer.localHistoryWarning,
      infra && !infra.ok ? buildInfraCancelWarning(infra.protocol, infra.reason) : undefined,
    )
    return {
      ok: true,
      ...(warning !== undefined ? { localHistoryWarning: warning } : {}),
      ...(infra?.ok ? { infraCancelledProtocol: infra.protocol } : {}),
    }
  }

  // Fallback (backend sem gateway configurado): fluxo antigo, feito pelo navegador.
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

  // Protocolo de infra aberto junto: cancela também. A massiva já foi cancelada; falha aqui vira aviso.
  let infraWarning: string | undefined
  let infraCancelledProtocol: number | null | undefined
  if (input.infraAssignmentId != null && input.infraAssignmentId > 0) {
    try {
      await bffClient.request({
        path: closePath,
        method: 'DELETE',
        body: {
          assignmentId: String(input.infraAssignmentId),
          incidentStatusId: env.massivaCancelIncidentStatusId,
          description: `Cancelado junto com a massiva ${input.protocol}: ${input.cancelDescription}`,
          progress: env.massivaCloseProgress,
          priority: env.massivaClosePriority,
          notificationTarget: env.massivaCloseNotificationTarget,
          privateReport: env.massivaClosePrivateReport,
        },
      })
      infraCancelledProtocol = input.infraProtocol ?? null
    } catch (infraError) {
      infraWarning = buildInfraCancelWarning(input.infraProtocol, infraError instanceof Error ? infraError.message : undefined)
    }
  }

  try {
    await registerCancelledMassivaHistoryInLocalDb({
      protocol: input.protocol,
      assignmentId: input.assignmentId,
      cancelDescription: input.cancelDescription,
      cancelledBy: input.cancelledBy,
    })
    return {
      ok: true,
      ...(infraWarning !== undefined ? { localHistoryWarning: infraWarning } : {}),
      ...(infraCancelledProtocol !== undefined ? { infraCancelledProtocol } : {}),
    }
  } catch (localError) {
    const msg =
      localError instanceof Error
        ? localError.message
        : 'Erro desconhecido ao salvar cancelamento localmente.'
    console.warn('[Massiva] Falha ao registrar cancelamento no histórico local.', localError)
    return {
      ok: true,
      localHistoryWarning: joinWarnings(
        `Cancelado no Elleven, mas o registro local falhou: ${msg}. O histórico pode demorar a refletir.`,
        infraWarning,
      ),
      ...(infraCancelledProtocol !== undefined ? { infraCancelledProtocol } : {}),
    }
  }
}
