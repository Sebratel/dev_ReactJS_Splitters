import { effectiveMassivaSplittersForRoute } from '@/features/massiva/lib/effectiveMassivaSplittersForRoute'
import {
  filterConnectionsBySplitterCode,
  type SplitterConnectionsIndex,
} from '@/features/massiva/lib/filterConnectionsBySplitterCode'
import { massivaClientDedupeKey } from '@/features/massiva/lib/massivaClientDedupeKey'
import type { MassivaRouteCatalog } from '@/features/massiva/model/massivaLocalPreview'
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
  if (actualNorm === '' || expectedNorm === '') return true

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

function hasRouteTopologyMatch(
  cliente: SplitterCliente,
  apCode: string,
  slot: number,
  port: number,
  options?: {
    enforceSlotPort?: boolean
  },
): boolean {
  const accessPoint = cliente.accessPoint
  if (accessPoint == null) return true

  const enforceSlotPort = options?.enforceSlotPort ?? true
  const sameAp =
    accessPoint.code.trim() !== '' || accessPoint.title.trim() !== ''
      ? apCodesMatch(
          accessPoint.code.trim() !== '' ? accessPoint.code : accessPoint.title,
          apCode,
        )
      : true

  if (!enforceSlotPort) {
    return sameAp
  }

  const sameSlot =
    Number.isFinite(accessPoint.slotOlt) && accessPoint.slotOlt > 0
      ? accessPoint.slotOlt === slot
      : true

  const samePort =
    Number.isFinite(accessPoint.portOlt) && accessPoint.portOlt > 0
      ? accessPoint.portOlt === port
      : true

  return sameAp && sameSlot && samePort
}

/**
 * Paridade `List<ClienteModel> _collectClientesForAp({ required String apCode })` no Flutter.
 */
export function collectMassivaClientesForAp(
  apCode: string,
  portsByApSlot: ReadonlyMap<string, ReadonlyMap<number, ReadonlySet<number>>>,
  explicitSplittersByRoute:
    | ReadonlyMap<
        string,
        ReadonlyMap<number, ReadonlyMap<number, ReadonlySet<string>>>
      >
    | undefined,
  catalog: MassivaRouteCatalog,
  connections: readonly SplitterCliente[],
  splitterIndex?: SplitterConnectionsIndex,
): SplitterCliente[] {
  const seenClientKeys = new Set<string>()
  const clientes: SplitterCliente[] = []
  const apTrim = apCode.trim()
  const routes = portsByApSlot.get(apTrim)
  if (routes === undefined) return clientes

  for (const [slot, portSet] of routes) {
    const ports = [...portSet].sort((a, b) => a - b)
    for (const port of ports) {
      const explicit = explicitSplittersByRoute
        ?.get(apTrim)
        ?.get(slot)
        ?.get(port)
      const hasExplicitSplitters =
        explicit !== undefined && explicit.size > 0
      const splitterCodes = effectiveMassivaSplittersForRoute(
        catalog,
        apTrim,
        slot,
        port,
        explicit,
      )
      const ordered = [...splitterCodes].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      )
      for (const splitterCode of ordered) {
        for (const cliente of filterConnectionsBySplitterCode(
          connections,
          splitterCode,
          splitterIndex,
        )) {
          if (
            !hasRouteTopologyMatch(cliente, apTrim, slot, port, {
              // Quando o operador restringe explicitamente por splitter,
              // priorizamos esse vínculo para evitar falso negativo em
              // slot/porta legados inconsistentes no dataset.
              enforceSlotPort: !hasExplicitSplitters,
            })
          ) {
            continue
          }

          const clientKey = massivaClientDedupeKey(cliente)
          if (seenClientKeys.has(clientKey)) continue
          seenClientKeys.add(clientKey)
          clientes.push(cliente)
        }
      }
    }
  }

  return clientes
}
