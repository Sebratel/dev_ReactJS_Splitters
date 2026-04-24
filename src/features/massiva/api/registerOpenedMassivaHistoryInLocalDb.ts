import type { MassivaOpenMutationSuccessPayload } from '@/features/massiva/model/massivaOpenMutation'
import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'
import { env } from '@/shared/config/env'

function flattenSplitterEntries(context: MassivaOpenFinalContext): Array<{ code: string; label: string }> {
  const merged = new Map<string, { code: string; label: string }>()

  for (const route of context.basis.topology.routes) {
    for (const entry of route.effectiveSplitterDisplay) {
      if (!merged.has(entry.code)) {
        merged.set(entry.code, entry)
      }
    }
  }

  return [...merged.values()].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'))
}

export async function registerOpenedMassivaHistoryInLocalDb(
  context: MassivaOpenFinalContext,
  result: MassivaOpenMutationSuccessPayload,
): Promise<void> {
  const response = await fetch(`${env.localBffUrl}/api/massiva/history/open`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify({
      operatorEmail: context.operatorEmail,
      title: context.plan.requests[0]?.assignmentTitle ?? '',
      splitterEntries: flattenSplitterEntries(context),
      results: result.results,
      affectedClients: context.basis.previewTotals.totalAffected,
      expectedCloseAt: context.assignmentFinalDateIsoUtc,
      openedAt: new Date().toISOString(),
      autoClosedWithoutClients: result.autoClosedWithoutClients === true,
      closeDescription: result.autoClosedWithoutClients === true
        ? 'Encerrada automaticamente sem clientes mapeaveis.'
        : '',
      closedAt: result.autoClosedWithoutClients === true
        ? new Date().toISOString()
        : null,
    }),
  })

  if (!response.ok) {
    throw new Error(`Erro ao registrar historico local da massiva: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success) {
    throw new Error('Resposta inesperada ao registrar historico local da massiva.')
  }
}
