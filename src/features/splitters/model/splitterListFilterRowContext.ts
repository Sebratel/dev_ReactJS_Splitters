import type { Splitter } from '@/features/splitters/model/splitter'

/**
 * Texto de busca já normalizado (`trim` + minúsculas), equivalente ao `query` em `_applyFilters` no Flutter.
 */
export type NormalizedSplittersSearch = string

/**
 * Índice código do splitter → nomes de clientes em minúsculas.
 * Paridade com `_clientesPorSplitter` / `matchCliente` na Home Flutter.
 *
 * Quando `undefined`, a busca textual ignora nomes (comportamento atual da primeira etapa).
 */
export type SplittersClientNamesIndex = ReadonlyMap<string, readonly string[]>

/**
 * Contexto por splitter na avaliação dos filtros — evita refator grande quando o índice de clientes existir.
 */
export type SplitterListFilterRowContext = {
  splitter: Splitter
  normalizedSearch: NormalizedSplittersSearch
  clientNamesIndex: SplittersClientNamesIndex | undefined
}

export type ApplySplittersListFiltersOptions = {
  clientNamesIndex?: SplittersClientNamesIndex
  /**
   * Ocupação (nº de conexões) por código de splitter — paridade `_ocupacaoSnapshot` + `_getStatus` no Flutter.
   * Se `undefined`, há filtro de status selecionado mas dados ausentes: `matchStatus` não restringe (modo degradado).
   */
  occupancyCountBySplitterCode?: ReadonlyMap<string, number>
  /**
   * Rua resolvida por código — paridade `_streetBySplitter` no Flutter.
   * Se `undefined`, o filtro por rua não restringe (modo degradado).
   */
  streetBySplitterCode?: ReadonlyMap<string, string | null>
}
