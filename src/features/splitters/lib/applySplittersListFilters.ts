import type { Splitter } from '@/features/splitters/model/splitter'
import type {
  ApplySplittersListFiltersOptions,
  NormalizedSplittersSearch,
  SplitterListFilterRowContext,
} from '@/features/splitters/model/splitterListFilterRowContext'
import type { SplittersListFilterState } from '@/features/splitters/model/splittersListFilters'
import type { SplitterStatus } from '@/features/splitters/model/splitterStatus'
import { resolveSplitterStatus } from '@/features/splitters/model/splitterStatus'
import { resolveOltSlotPortFromSplitterTitleAndCode } from '@/features/splitters/lib/parseOltPonFromSplitterLabels'

function buildRowContext(
  splitter: Splitter,
  normalizedSearch: NormalizedSplittersSearch,
  clientNamesIndex: SplitterListFilterRowContext['clientNamesIndex'],
): SplitterListFilterRowContext {
  return {
    splitter,
    normalizedSearch,
    clientNamesIndex,
  }
}

function matchesSearch(ctx: SplitterListFilterRowContext): boolean {
  const q = ctx.normalizedSearch
  if (q.length === 0) return true

  const s = ctx.splitter
  if (s.code.toLowerCase().includes(q)) return true
  if (s.title.toLowerCase().includes(q)) return true
  if (s.description.toLowerCase().includes(q)) return true
  if (s.typeText.toLowerCase().includes(q)) return true
  if (s.integrationCode.toLowerCase().includes(q)) return true

  // `matchCliente` no Flutter: clientes.any((n) => n.contains(query)) com nomes já em minúsculas.
  const names = ctx.clientNamesIndex?.get(s.code)
  if (names !== undefined) {
    for (const n of names) {
      if (n.includes(q)) return true
    }
  }

  return false
}

function matchesOlt(
  splitter: Splitter,
  oltSet: ReadonlySet<string> | null,
): boolean {
  if (oltSet === null) return true
  const code = splitter.oltCode?.trim()
  if (!code) return false
  return oltSet.has(code)
}

/**
 * `matchStatus` no Flutter: `_statusSelecionados.isEmpty || _statusSelecionados.contains(_getStatus(s))`.
 * Sem índice de ocupação, não aplicamos o filtro (lista não fica vazia por falha auxiliar).
 */
function matchesStatus(
  splitter: Splitter,
  selected: ReadonlySet<SplitterStatus>,
  occupancyCountBySplitterCode: ReadonlyMap<string, number> | undefined,
): boolean {
  if (selected.size === 0) return true
  if (occupancyCountBySplitterCode === undefined) return true

  const ocupacaoReal = occupancyCountBySplitterCode.get(splitter.code) ?? 0
  const status = resolveSplitterStatus(ocupacaoReal, splitter.outPorts)
  return selected.has(status)
}

/**
 * `matchRua` no Flutter: rua vazia ou street != null && selected.any((r) => street.contains(r)).
 * Sem índice de ruas: não restringe (lista continua utilizável).
 */
function matchesStreet(
  splitter: Splitter,
  selectedStreets: readonly string[],
  streetBySplitterCode: ReadonlyMap<string, string | null> | undefined,
): boolean {
  if (selectedStreets.length === 0) return true
  if (streetBySplitterCode === undefined) return true

  const street = streetBySplitterCode.get(splitter.code) ?? null
  if (street === null || street.trim() === '') return false

  const sl = street.toLowerCase()
  for (const rua of selectedStreets) {
    const fragment = rua.trim().toLowerCase()
    if (fragment.length > 0 && sl.includes(fragment)) return true
  }
  return false
}

function matchesCondominium(
  splitter: Splitter,
  condominiumSelections: readonly string[],
): boolean {
  if (condominiumSelections.length === 0) return true
  const name = String(splitter.nomeCondominio ?? '').trim()
  if (name === '') return false
  return condominiumSelections.includes(name)
}

/** Prefixo canônico de condomínio no título (RES./COND./ED.) — paridade com condominiumClassifier.js. */
const CONDOMINIUM_TITLE_PREFIX_REGEX = /\b(?:RES|COND|ED)\./i

/**
 * Classifica o splitter em CONDOMÍNIO × UNIDADE: usa `tipoLocal` do backend quando presente,
 * senão cai no prefixo do título (fonte canônica), para o filtro nunca ficar cego.
 */
function resolveSplitterLocalKind(splitter: Splitter): 'CONDOMÍNIO' | 'UNIDADE' {
  if (splitter.tipoLocal === 'CONDOMÍNIO' || splitter.tipoLocal === 'UNIDADE') {
    return splitter.tipoLocal
  }
  return CONDOMINIUM_TITLE_PREFIX_REGEX.test(splitter.title) ? 'CONDOMÍNIO' : 'UNIDADE'
}

function matchesLocalKind(
  splitter: Splitter,
  localKindFilter: 'all' | 'CONDOMÍNIO' | 'UNIDADE',
): boolean {
  if (localKindFilter === 'all') return true
  return resolveSplitterLocalKind(splitter) === localKindFilter
}

/**
 * Slot/porta derivados do nome/código do splitter (sem fallback SQL no modelo `Splitter`).
 * Sem dois números válidos no texto, não restringe no cliente.
 */
function matchesResolvedOltPon(
  splitter: Splitter,
  filters: SplittersListFilterState,
): boolean {
  const slotWant =
    typeof filters.oltSlot === 'number' && Number.isFinite(filters.oltSlot)
      ? Math.trunc(filters.oltSlot)
      : null
  const portWant =
    typeof filters.oltPort === 'number' && Number.isFinite(filters.oltPort)
      ? Math.trunc(filters.oltPort)
      : null
  if (slotWant === null && portWant === null) return true

  const resolved = resolveOltSlotPortFromSplitterTitleAndCode(splitter.title, splitter.code)
  const rSlot = resolved.slot
  const rPort = resolved.port
  if (rSlot === null || rPort === null) return true
  if (slotWant !== null && rSlot !== slotWant) return false
  if (portWant !== null && rPort !== portWant) return false
  return true
}

function passesAllFilters(
  ctx: SplitterListFilterRowContext,
  oltSet: ReadonlySet<string> | null,
  statusSet: ReadonlySet<SplitterStatus>,
  occupancyCountBySplitterCode: ReadonlyMap<string, number> | undefined,
  streetSelections: readonly string[],
  streetBySplitterCode: ReadonlyMap<string, string | null> | undefined,
): boolean {
  if (!matchesSearch(ctx)) return false
  if (!matchesOlt(ctx.splitter, oltSet)) return false
  if (!matchesStatus(ctx.splitter, statusSet, occupancyCountBySplitterCode)) return false
  if (!matchesStreet(ctx.splitter, streetSelections, streetBySplitterCode)) return false
  return true
}

/**
 * Filtros da listagem com contexto por linha para busca; OLT, status, ocupação e rua via opções.
 */
export function applySplittersListFilters(
  splitters: readonly Splitter[],
  filters: SplittersListFilterState,
  options?: ApplySplittersListFiltersOptions,
): Splitter[] {
  const normalizedSearch = filters.searchQuery
    .trim()
    .toLowerCase() as NormalizedSplittersSearch
  const clientNamesIndex = options?.clientNamesIndex
  const occupancyCountBySplitterCode = options?.occupancyCountBySplitterCode
  const streetBySplitterCode = options?.streetBySplitterCode
  const oltSet =
    filters.oltCodes.length > 0 ? new Set(filters.oltCodes) : null
  const statusSet =
    filters.splitterStatuses.length > 0
      ? new Set(filters.splitterStatuses)
      : new Set<SplitterStatus>()
  const streetSelections = filters.streetSelections
  const condominiumSelections = filters.condominiumSelections

  const out: Splitter[] = []
  for (const splitter of splitters) {
    const ctx = buildRowContext(splitter, normalizedSearch, clientNamesIndex)
    if (
      !passesAllFilters(
        ctx,
        oltSet,
        statusSet,
        occupancyCountBySplitterCode,
        streetSelections,
        streetBySplitterCode,
      )
    ) {
      continue
    }
    if (!matchesCondominium(splitter, condominiumSelections)) continue
    if (!matchesLocalKind(splitter, filters.localKindFilter)) continue
    if (!matchesResolvedOltPon(splitter, filters)) continue
    out.push(splitter)
  }
  return out
}
