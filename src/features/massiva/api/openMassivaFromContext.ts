import { closeMassivaTicket } from '@/features/massiva/api/closeMassivaTicket'
import {
  buildMassivaAfetadosRequestBody,
  collectMapeableAfetadosClientes,
  pickPrimaryOpenResult,
  resolveProtocolAndAssignment,
} from '@/features/massiva/lib/buildMassivaAfetadosRequestBody'
import { buildMassivaOpenRequestBody } from '@/features/massiva/lib/buildMassivaOpenRequestBody'
import { registerOpenedMassivaHistoryInLocalDb } from '@/features/massiva/api/registerOpenedMassivaHistoryInLocalDb'
import {
  formatMassivaOpenApiFailure,
  parseMassivaOpenHttpResult,
} from '@/features/massiva/lib/parseMassivaOpenResponse'
import {
  MassivaOpenAggregateError,
  type MassivaOpenMutationSuccessPayload,
  type MassivaOpenSingleResult,
} from '@/features/massiva/model/massivaOpenMutation'
import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'
import { bffClient } from '@/shared/api/bffClient'
import { env } from '@/shared/config/env'
import { formatQueryError } from '@/shared/lib/formatQueryError'

const AUTO_CLOSE_NO_CLIENTS = 'Não foi acionado nenhum cliente na abertura.'

function closePathConfigured(): boolean {
  return env.massivaClosePath.trim() !== ''
}

/**
 * Um POST por entrada em `context.plan.requests` — paridade sequência em `_openMassiva`.
 * Em seguida: POST de afetados (seleção da rota) ou encerramento automático se não houver clientes mapeáveis.
 */
export async function openMassivaFromContext(
  context: MassivaOpenFinalContext,
  signal?: AbortSignal,
): Promise<MassivaOpenMutationSuccessPayload> {
  const path = context.massivaOpenPath.trim()
  if (path === '') {
    throw new Error('Path de abertura vazio no contexto.')
  }

  const afetadosPath = context.massivaAfetadosPath.trim()
  if (afetadosPath === '') {
    throw new Error('Path de afetados vazio no contexto.')
  }

  const successes: MassivaOpenSingleResult[] = []
  const failures: Array<{ accessPointCode: string; message: string }> = []

  for (const req of context.plan.requests) {
    const body = buildMassivaOpenRequestBody(context, req)

    try {
      const data: unknown = await bffClient.request({
        path,
        method: 'POST',
        body,
        signal,
      })
      const parsed = parseMassivaOpenHttpResult(data, req.authenticationAccessPointCode)
      successes.push(parsed)
    } catch (e) {
      console.error(`[Massiva] Falha no AP: ${req.authenticationAccessPointCode}`, e)
      failures.push({
        accessPointCode: req.authenticationAccessPointCode,
        message: formatMassivaOpenApiFailure(e),
      })
    }
  }

  if (failures.length > 0) {
    throw new MassivaOpenAggregateError(successes, failures)
  }

  const base: MassivaOpenMutationSuccessPayload = { results: successes }
  const primary = pickPrimaryOpenResult(successes)
  const ids = primary != null ? resolveProtocolAndAssignment(primary) : null
  const mapeableCount = collectMapeableAfetadosClientes(context.basis.collectedClientes).length

  if (mapeableCount === 0) {
    if (ids != null && closePathConfigured()) {
      try {
        await closeMassivaTicket({
          assignmentId: ids.assignmentId,
          protocol: ids.protocol,
          closeDescription: AUTO_CLOSE_NO_CLIENTS,
        })
        const payload = { ...base, autoClosedWithoutClients: true }
        try {
          await registerOpenedMassivaHistoryInLocalDb(context, payload)
        } catch (localError) {
          console.warn('[Massiva] Falha ao registrar histórico local após autoencerramento.', localError)
        }
        return payload
      } catch (e) {
        throw new Error(
          `Massiva aberta, mas o encerramento automático (sem clientes na seleção) falhou: ${formatQueryError(e)}`,
        )
      }
    }

    const followUpWarning =
      ids == null
        ? 'Nenhum cliente com PPPoE e contrato na seleção; a resposta da abertura não trouxe protocolo/assignment para encerrar automaticamente.'
        : closePathConfigured()
          ? ''
          : 'Nenhum cliente com PPPoE e contrato na seleção. Defina VITE_MASSIVA_CLOSE_PATH para permitir encerramento automático do protocolo.'

    const payload = followUpWarning !== ''
      ? { ...base, followUpWarning }
      : base

    try {
      await registerOpenedMassivaHistoryInLocalDb(context, payload)
    } catch (localError) {
      console.warn('[Massiva] Falha ao registrar histórico local após abertura.', localError)
    }

    return payload
  }

  if (ids == null) {
    throw new Error(
      'Abertura concluída, mas a resposta não trouxe protocolo e assignmentId para registrar os afetados.',
    )
  }

  const afetadosBody = buildMassivaAfetadosRequestBody(
    context,
    ids.protocol,
    ids.assignmentId,
  )

  await bffClient.request({
    path: afetadosPath,
    method: 'POST',
    body: afetadosBody,
    signal,
  })

  const payload = {
    ...base,
    afetadosPostedCount: afetadosBody.usuarioAfetadoEntities.length,
  }

  try {
    await registerOpenedMassivaHistoryInLocalDb(context, payload)
  } catch (localError) {
    console.warn('[Massiva] Falha ao registrar histórico local após abertura.', localError)
  }

  return payload
}
