import { collectMapeableAfetadosClientes } from '@/features/massiva/lib/buildMassivaAfetadosRequestBody'
import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

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

export function resolveMassivaTitleForAccessPoint(
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

export function resolveMassivaSplitterCodeForAccessPoint(
  context: MassivaOpenFinalContext,
  accessPointCode: string,
): string {
  const route = context.basis.topology.routes.find((r) =>
    apCodesMatch(r.apCode, accessPointCode),
  )
  const fromRoute = route?.effectiveSplitterDisplay?.[0]?.code?.trim() ?? ''
  if (fromRoute !== '') return fromRoute

  for (const r of context.basis.topology.routes) {
    for (const entry of r.effectiveSplitterDisplay) {
      const code = entry.code?.trim() ?? ''
      if (code !== '') return code
    }
  }
  return ''
}

export function countMapeableAfetadosForAccessPoint(
  context: MassivaOpenFinalContext,
  accessPointCode: string,
): number {
  return collectMapeableAfetadosClientes(
    clientesForAccessPoint(context.basis.collectedClientes, accessPointCode),
  ).length
}
