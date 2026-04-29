import type { MassivaOpenMutationSuccessPayload } from '@/features/massiva/model/massivaOpenMutation'
import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'
import { formatInBrazilIsoLike, nowInBrazilIsoLike } from '@/features/massiva/lib/formatBrazilDateTime'
import { collectMapeableAfetadosClientes } from '@/features/massiva/lib/buildMassivaAfetadosRequestBody'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

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

function resolveTitleForAccessPoint(
  context: MassivaOpenFinalContext,
  accessPointCode: string,
): string {
  const byRequest = context.plan.requests.find((request) =>
    apCodesMatch(request.authenticationAccessPointCode, accessPointCode),
  )
  if (byRequest?.assignmentTitle?.trim()) return byRequest.assignmentTitle.trim()

  const byTopology = context.basis.topology.routes.find((route) =>
    apCodesMatch(route.apCode, accessPointCode),
  )
  if (byTopology?.apDisplayTitle?.trim()) return byTopology.apDisplayTitle.trim()

  return context.plan.requests[0]?.assignmentTitle?.trim() ?? ''
}

export async function registerOpenedMassivaHistoryInLocalDb(
  context: MassivaOpenFinalContext,
  result: MassivaOpenMutationSuccessPayload,
): Promise<void> {
  const nowBrazil = nowInBrazilIsoLike()
  const expectedCloseBrazil =
    formatInBrazilIsoLike(context.assignmentFinalDateIsoUtc) ??
    context.assignmentFinalDateIsoUtc
  const mapeableTotal = collectMapeableAfetadosClientes(context.basis.collectedClientes).length
  const historyResults = result.results.map((entry) => ({
    ...entry,
    title: resolveTitleForAccessPoint(context, entry.accessPointCode),
    affectedClients: collectMapeableAfetadosClientes(
      clientesForAccessPoint(context.basis.collectedClientes, entry.accessPointCode),
    ).length,
  }))

  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/massiva/history/open`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify({
      operatorEmail: context.operatorEmail,
      title: context.plan.requests[0]?.assignmentTitle ?? '',
      splitterEntries: flattenSplitterEntries(context),
      results: historyResults,
      affectedClients: mapeableTotal,
      expectedCloseAt: expectedCloseBrazil,
      openedAt: nowBrazil,
      autoClosedWithoutClients: result.autoClosedWithoutClients === true,
      closeDescription: result.autoClosedWithoutClients === true
        ? 'Encerrada automaticamente sem clientes mapeaveis.'
        : '',
      closedAt: result.autoClosedWithoutClients === true
        ? nowBrazil
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
