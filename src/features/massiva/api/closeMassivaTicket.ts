import { registerClosedMassivaHistoryInLocalDb } from '@/features/massiva/api/registerClosedMassivaHistoryInLocalDb'
import { bffClient } from '@/shared/api/bffClient'
import { env } from '@/shared/config/env'

type CloseMassivaInput = {
  assignmentId: number
  protocol: number
  closeDescription: string
  /** Usuário logado que está encerrando (registrado como autor no histórico local). */
  closedBy?: string
  /** Classificação operacional preenchida pelo operador no modal de encerramento. */
  tipoIncidente?: string | null
  impacto?: string | null
  area?: string | null
  tecnologia?: string | null
  classificacao?: string | null
  cnl?: string | null
}

export type CloseMassivaResult = {
  /** Encerrado com sucesso no Elleven. */
  ok: true
  /**
   * Presente quando o registro local (MySQL) falhou após o encerramento no Elleven.
   * O protocolo está encerrado no Elleven, mas o histórico local pode ficar inconsistente
   * até o próximo ciclo de sincronização automática.
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

export async function closeMassivaTicket(input: CloseMassivaInput): Promise<CloseMassivaResult> {
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
      // Encerramento concluído no Elleven; limpeza de afetados é auxiliar.
    }
  }

  try {
    await registerClosedMassivaHistoryInLocalDb({
      protocol: input.protocol,
      assignmentId: input.assignmentId,
      closeDescription: input.closeDescription,
      closedBy: input.closedBy,
      tipoIncidente: input.tipoIncidente,
      impacto: input.impacto,
      area: input.area,
      tecnologia: input.tecnologia,
      classificacao: input.classificacao,
      cnl: input.cnl,
    })
    return { ok: true }
  } catch (localError) {
    const msg =
      localError instanceof Error
        ? localError.message
        : 'Erro desconhecido ao salvar encerramento localmente.'
    console.warn('[Massiva] Falha ao registrar encerramento no histórico local.', localError)
    return {
      ok: true,
      localHistoryWarning: `Encerrado no Elleven, mas o registro local falhou: ${msg}. O histórico pode demorar a refletir.`,
    }
  }
}
