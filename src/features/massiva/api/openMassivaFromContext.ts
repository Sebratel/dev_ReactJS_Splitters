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
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

const AUTO_CLOSE_NO_CLIENTS = 'Não foi acionado nenhum cliente na abertura.'

const LOCAL_HISTORY_WARNING =
  'A massiva foi aberta, mas o historico local por splitter nao foi registrado. O painel da rede e os indicadores locais podem ficar inconsistentes ate corrigir essa gravacao.'

function appendFollowUpWarning(
  payload: MassivaOpenMutationSuccessPayload,
  warning: string,
): MassivaOpenMutationSuccessPayload {
  const normalized = warning.trim()
  if (normalized === '') return payload

  const current = payload.followUpWarning?.trim() ?? ''
  if (current === '') {
    return {
      ...payload,
      followUpWarning: normalized,
    }
  }

  if (current.includes(normalized)) return payload

  return {
    ...payload,
    followUpWarning: `${current}\n${normalized}`,
  }
}

function closePathConfigured(): boolean {
  return env.massivaClosePath.trim() !== ''
}

function normalizeAp(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

function canonicalAp(value: string | null | undefined): string {
  return normalizeAp(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function apNumericTokens(value: string | null | undefined): Set<string> {
  const tokens = String(value ?? '').match(/\d+/g) ?? []
  return new Set(tokens.filter((token) => token.length >= 3))
}

function apCodesMatch(actual: string, expected: string): boolean {
  const actualNorm = normalizeAp(actual)
  const expectedNorm = normalizeAp(expected)
  if (actualNorm === '' || expectedNorm === '') return false
  const actualCanonical = canonicalAp(actualNorm)
  const expectedCanonical = canonicalAp(expectedNorm)
  if (
    actualCanonical === expectedCanonical ||
    actualCanonical.includes(expectedCanonical) ||
    expectedCanonical.includes(actualCanonical)
  ) {
    return true
  }

  const actualTokens = apNumericTokens(actualNorm)
  const expectedTokens = apNumericTokens(expectedNorm)
  if (actualTokens.size === 0 || expectedTokens.size === 0) return false
  for (const token of actualTokens) {
    if (expectedTokens.has(token)) return true
  }
  return false
}

function clientesForAccessPoint(
  clientes: readonly SplitterCliente[],
  accessPointCode: string,
): SplitterCliente[] {
  return clientes.filter((cliente) => {
    const access = cliente.accessPoint
    if (access == null) return false
    const codeOrTitle = access.code.trim() !== '' ? access.code : access.title
    return apCodesMatch(codeOrTitle, accessPointCode)
  })
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
        let payload: MassivaOpenMutationSuccessPayload = { ...base, autoClosedWithoutClients: true }
        try {
          await registerOpenedMassivaHistoryInLocalDb(context, payload)
        } catch (localError) {
          console.warn('[Massiva] Falha ao registrar histórico local após autoencerramento.', localError)
          payload = appendFollowUpWarning(payload, LOCAL_HISTORY_WARNING)
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

    let payload = followUpWarning !== ''
      ? { ...base, followUpWarning }
      : base

    try {
      await registerOpenedMassivaHistoryInLocalDb(context, payload)
    } catch (localError) {
      console.warn('[Massiva] Falha ao registrar histórico local após abertura.', localError)
      payload = appendFollowUpWarning(payload, LOCAL_HISTORY_WARNING)
    }

    return payload
  }

  let afetadosPostedCount = 0
  const afetadosWarnings: string[] = []

  for (const opened of successes) {
    const ids = resolveProtocolAndAssignment(opened)
    if (ids == null) {
      afetadosWarnings.push(
        `AP ${opened.accessPointCode}: resposta da abertura não trouxe protocolo/assignmentId — afetados não registrados.`,
      )
      continue
    }

    const scopedClientes = clientesForAccessPoint(
      context.basis.collectedClientes,
      opened.accessPointCode,
    )
    const afetadosBody = buildMassivaAfetadosRequestBody(
      context,
      ids.protocol,
      ids.assignmentId,
      scopedClientes,
    )

    try {
      await bffClient.request({
        path: afetadosPath,
        method: 'POST',
        body: afetadosBody,
        signal,
      })
      afetadosPostedCount += afetadosBody.usuarioAfetadoEntities.length
    } catch (afetadosError) {
      const msg = afetadosError instanceof Error ? afetadosError.message : String(afetadosError)
      console.warn(`[Massiva] Falha ao registrar afetados para AP ${opened.accessPointCode}.`, afetadosError)
      afetadosWarnings.push(`AP ${opened.accessPointCode}: falha ao registrar afetados — ${msg}.`)
    }
  }

  let payload: MassivaOpenMutationSuccessPayload = {
    ...base,
    afetadosPostedCount,
  }

  if (afetadosWarnings.length > 0) {
    payload = appendFollowUpWarning(
      payload,
      `Afetados não registrados em alguns pontos de acesso:\n${afetadosWarnings.join('\n')}`,
    )
  }

  try {
    await registerOpenedMassivaHistoryInLocalDb(context, payload)
  } catch (localError) {
    console.warn('[Massiva] Falha ao registrar histórico local após abertura.', localError)
    payload = appendFollowUpWarning(payload, LOCAL_HISTORY_WARNING)
  }

  return payload
}
