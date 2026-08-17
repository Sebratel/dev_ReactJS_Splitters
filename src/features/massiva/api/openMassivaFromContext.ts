import { closeMassivaTicket } from '@/features/massiva/api/closeMassivaTicket'
import {
  buildMassivaAfetadosRequestBody,
  collectMapeableAfetadosClientes,
  pickPrimaryOpenResult,
  resolveProtocolAndAssignment,
} from '@/features/massiva/lib/buildMassivaAfetadosRequestBody'
import { buildMassivaOpenRequestBody } from '@/features/massiva/lib/buildMassivaOpenRequestBody'
import { massivaLocalDateTimeToGatewayIso } from '@/features/massiva/lib/validateMassivaOpenDraft'
import { fetchMassivaConnectionsFromLocalDbByRoutes } from '@/features/splitters/api/fetchSplitterConnectionsFromLocalDb'
import { registerOpenedMassivaHistoryInLocalDb } from '@/features/massiva/api/registerOpenedMassivaHistoryInLocalDb'
import { registerMassivaAffectedClientsInLocalDb } from '@/features/massiva/api/registerMassivaAffectedClientsInLocalDb'
import { openInfraSolicitation } from '@/features/massiva/api/openInfraSolicitation'
import {
  buildInfraSolicitationDescription,
  type InfraMaskRoute,
} from '@/features/massiva/lib/buildInfraSolicitationDescription'
import { infraProtocolOption } from '@/features/massiva/model/massivaInfraProtocol'
import { useMassivaOpenDraftStore } from '@/features/massiva/store/massivaOpenDraftStore'
import { parseDateTimeLocalToDate } from '@/features/massiva/lib/formatMassivaListDate'
import { formatBrazilDateTimeShortDisplay } from '@/shared/lib/formatBrazilDisplayDate'
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
 * O preview usa uma amostra de 50 conexões (otimização para massivas grandes), mas a
 * abertura precisa registrar TODOS os afetados. Busca a lista completa por rota antes de
 * montar o payload de afetados. Em falha, mantém a amostra (degradação controlada).
 */
async function withFullCollectedClientes(
  context: MassivaOpenFinalContext,
): Promise<MassivaOpenFinalContext> {
  const routes = context.basis.topology.routes.map((route) => ({
    apCode: route.apCode,
    slot: route.slot,
    port: route.port,
    splitterCodes: [...route.effectiveSplitterCodes],
  }))
  if (routes.length === 0) return context

  try {
    const full = await fetchMassivaConnectionsFromLocalDbByRoutes(routes)
    if (full.length <= context.basis.collectedClientes.length) return context
    return { ...context, basis: { ...context.basis, collectedClientes: full } }
  } catch (error) {
    console.warn(
      '[Massiva] Falha ao buscar a lista completa de afetados; registrando com a amostra do preview.',
      error,
    )
    return context
  }
}

function formatLocalDateTimeShort(local: string | null): string {
  if (local == null || local.trim() === '') return ''
  const instant = parseDateTimeLocalToDate(local.slice(0, 16))
  if (instant === null) return ''
  return formatBrazilDateTimeShortDisplay(instant)
}

/**
 * Abre — quando o operador selecionou um tipo — 1 protocolo de infraestrutura agregando todos os APs.
 * Best-effort: qualquer falha vira aviso (`followUpWarning`) e NÃO derruba a massiva já aberta.
 */
async function openInfraProtocolIfSelected(
  context: MassivaOpenFinalContext,
  successes: MassivaOpenSingleResult[],
): Promise<{ infraProtocol: number | null; infraAssignmentId: number | null; warning: string | null }> {
  const draft = useMassivaOpenDraftStore.getState()
  const option = infraProtocolOption(draft.infraProtocolType)
  if (option === null) {
    return { infraProtocol: null, infraAssignmentId: null, warning: null }
  }

  const routes: InfraMaskRoute[] = context.basis.topology.routes.map((route) => ({
    apCode: route.apCode,
    apDisplayTitle: route.apDisplayTitle,
    slot: route.slot,
    port: route.port,
    affected: collectMapeableAfetadosClientes(
      clientesForAccessPoint(context.basis.collectedClientes, route.apCode),
    ).length,
  }))
  const totalAffected = routes.reduce((sum, route) => sum + route.affected, 0)

  const primary = pickPrimaryOpenResult(successes)
  const primaryIds = primary != null ? resolveProtocolAndAssignment(primary) : null

  const description = buildInfraSolicitationDescription({
    type: option.code,
    massivaProtocol: primaryIds?.protocol ?? null,
    routes,
    totalAffected,
    signalDbm: draft.infraSignalDbm,
    avaria: draft.infraAvaria,
    responsavel: context.operatorName,
    eventStartDisplay: formatLocalDateTimeShort(context.assignmentBeginningDateLocal),
    eventIdentifiedDisplay: formatLocalDateTimeShort(context.eventIdentifiedAtLocal),
  })

  const primaryAp =
    context.plan.requests[0]?.authenticationAccessPointCode?.trim() ||
    context.basis.topology.routes[0]?.apCode?.trim() ||
    null

  const finalDateIso =
    massivaLocalDateTimeToGatewayIso(context.assignmentFinalDateLocal) ??
    context.assignmentFinalDateLocal

  try {
    const result = await openInfraSolicitation({
      infraType: option.code,
      personId: context.personId,
      authenticationAccessPointCode: primaryAp,
      assignmentTitle: `Infra - ${option.label}`,
      assignmentDescription: description,
      assignmentFinalDateIso: finalDateIso,
    })

    if (result.protocol == null) {
      return {
        infraProtocol: null,
        infraAssignmentId: null,
        warning: `Protocolo de infraestrutura (${option.label}) foi solicitado, mas a resposta não trouxe o número do protocolo.`,
      }
    }
    return {
      infraProtocol: result.protocol,
      infraAssignmentId: result.assignmentId,
      warning: null,
    }
  } catch (e) {
    return {
      infraProtocol: null,
      infraAssignmentId: null,
      warning: `Falha ao abrir o protocolo de infraestrutura (${option.label}): ${formatQueryError(e)}. A massiva foi aberta normalmente.`,
    }
  }
}

/**
 * Um POST por entrada em `context.plan.requests` — paridade sequência em `_openMassiva`.
 * Em seguida: POST de afetados (seleção da rota) ou encerramento automático se não houver clientes mapeáveis.
 */
export async function openMassivaFromContext(
  inputContext: MassivaOpenFinalContext,
  signal?: AbortSignal,
): Promise<MassivaOpenMutationSuccessPayload> {
  const context = await withFullCollectedClientes(inputContext)
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

    // Cópia local (nosso MySQL) da mesma lista de afetados, independente do gateway —
    // viabiliza a verificação "ainda sem sinal?" pós-encerramento sem depender do DELETE
    // de limpeza do gateway. Best-effort: nunca bloqueia a abertura.
    try {
      await registerMassivaAffectedClientsInLocalDb({
        protocol: ids.protocol,
        assignmentId: ids.assignmentId,
        entities: afetadosBody.usuarioAfetadoEntities,
      })
    } catch (localAffectedError) {
      console.warn(
        `[Massiva] Falha ao gravar cópia local dos afetados para AP ${opened.accessPointCode}.`,
        localAffectedError,
      )
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

  // Protocolo de infraestrutura (opcional): 1 por evento, best-effort com aviso.
  const infra = await openInfraProtocolIfSelected(context, successes)
  if (infra.infraProtocol != null) {
    payload = {
      ...payload,
      infraProtocol: infra.infraProtocol,
      infraAssignmentId: infra.infraAssignmentId,
    }
  }
  if (infra.warning != null) {
    payload = appendFollowUpWarning(payload, infra.warning)
  }

  try {
    await registerOpenedMassivaHistoryInLocalDb(context, payload)
  } catch (localError) {
    console.warn('[Massiva] Falha ao registrar histórico local após abertura.', localError)
    payload = appendFollowUpWarning(payload, LOCAL_HISTORY_WARNING)
  }

  return payload
}
