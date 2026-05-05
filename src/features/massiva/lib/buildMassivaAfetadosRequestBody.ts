import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'
import type { MassivaOpenSingleResult } from '@/features/massiva/model/massivaOpenMutation'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import { formatInBrazilIsoLike, nowInBrazilIsoLike } from '@/features/massiva/lib/formatBrazilDateTime'

/** Corpo do POST `/api/v1/afetados` (paridade curl manual). */
export type UsuarioAfetadoEntity = {
  pppoe: string
  protocol: number
  reason: string
  finishDate: string
  created: string
  createdBy: string
  contractId: number
}

export type MassivaAfetadosRequestBody = {
  usuarioAfetadoEntities: UsuarioAfetadoEntity[]
  assignmentId: number
}

const REASON_MAX_LEN = 2000

/** Parte local do e-mail para `createdBy` (ex.: israel.barcelos@... → israel.barcelos). */
export function massivaCreatedByFromOperatorEmail(operatorEmail: string): string {
  const t = operatorEmail.trim().toLowerCase()
  if (t === '') return 'sistema'
  const at = t.indexOf('@')
  return at > 0 ? t.slice(0, at) : t
}

function trimReason(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= REASON_MAX_LEN) return t
  return `${t.slice(0, REASON_MAX_LEN - 1)}…`
}

/**
 * Clientes da rota com PPPoE e contrato válidos para o POST de afetados.
 */
export function collectMapeableAfetadosClientes(
  clientes: SplitterCliente[],
): SplitterCliente[] {
  return clientes.filter((c) => {
    const pppoe = c.user.trim()
    const contractId = c.contract?.id
    return pppoe !== '' && contractId != null && contractId > 0
  })
}

export function buildUsuarioAfetadoEntities(params: {
  clientes: SplitterCliente[]
  protocol: number
  reason: string
  finishDateIsoUtc: string
  createdIsoUtc: string
  createdBy: string
}): UsuarioAfetadoEntity[] {
  const reason = trimReason(params.reason !== '' ? params.reason : 'Massiva — notificação de afetados')
  return collectMapeableAfetadosClientes(params.clientes).map((c) => ({
    pppoe: c.user.trim(),
    protocol: params.protocol,
    reason,
    finishDate: params.finishDateIsoUtc,
    created: params.createdIsoUtc,
    createdBy: params.createdBy,
    contractId: c.contract!.id,
  }))
}

export function pickPrimaryOpenResult(
  results: MassivaOpenSingleResult[],
): MassivaOpenSingleResult | null {
  if (results.length === 0) return null
  const withBoth = results.find(
    (r) =>
      r.protocol != null &&
      r.protocol > 0 &&
      r.assignmentId != null &&
      r.assignmentId > 0,
  )
  if (withBoth) return withBoth
  return results[0] ?? null
}

export function resolveProtocolAndAssignment(
  r: MassivaOpenSingleResult,
): { protocol: number; assignmentId: number } | null {
  let protocol = r.protocol
  if ((protocol == null || protocol <= 0) && r.createdProtocols.length > 0) {
    const p = r.createdProtocols[0]
    if (p != null && p > 0) protocol = p
  }
  const assignmentId = r.assignmentId
  if (
    assignmentId == null ||
    assignmentId <= 0 ||
    protocol == null ||
    protocol <= 0
  ) {
    return null
  }
  return { protocol, assignmentId }
}

export function buildMassivaAfetadosRequestBody(
  context: MassivaOpenFinalContext,
  protocol: number,
  assignmentId: number,
  clientesOverride?: SplitterCliente[],
): MassivaAfetadosRequestBody {
  const createdIso = nowInBrazilIsoLike()
  const finishDateBrazil =
    formatInBrazilIsoLike(context.assignmentFinalDateLocal) ??
    context.assignmentFinalDateLocal
  const createdBy = massivaCreatedByFromOperatorEmail(context.operatorEmail)
  const entities = buildUsuarioAfetadoEntities({
    clientes: clientesOverride ?? context.basis.collectedClientes,
    protocol,
    reason: context.assignmentDescription,
    finishDateIsoUtc: finishDateBrazil,
    createdIsoUtc: createdIso,
    createdBy,
  })
  return {
    usuarioAfetadoEntities: entities,
    assignmentId,
  }
}
