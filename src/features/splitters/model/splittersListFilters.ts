/**
 * Estado de filtros da listagem de splitters (paridade incremental com `HomePage` / `_applyFilters` no Flutter).
 *
 * A avaliação por linha usa `SplitterListFilterRowContext` em `splitterListFilterRowContext.ts`.
 *
 * Inclui: busca (splitter + clientes), OLT, status/ocupação, ruas.
 */

import type { SplitterStatus } from '@/features/splitters/model/splitterStatus'

export type SplittersListFilterState = {
  /** Texto livre — equivalente a `_searchController.text.trim()`. */
  searchQuery: string
  /**
   * Códigos OLT selecionados — equivalente a `_oltsSelecionadas` (conjunto de `oltCode`).
   * Vazio = nenhum filtro de OLT (todos passam).
   */
  oltCodes: string[]
  /**
   * Títulos de splitters primários selecionados.
   * Vazio = sem filtro de splitter primário.
   */
  primarySplitterTitles: string[]
  /**
   * Status de ocupação selecionados — equivalente a `_statusSelecionados` (`SplitterStatus` no Flutter).
   * Vazio = sem filtro de status.
   */
  splitterStatuses: SplitterStatus[]
  /**
   * Textos de rua selecionados — equivalente a `_ruasSelecionadas` (substring em `street.toLowerCase()`).
   */
  streetSelections: string[]
  /** Cidades selecionadas (multi-seleção). */
  citySelections: string[]
  /** Condomínios selecionados (multi-seleção). */
  condominiumSelections: string[]
  /**
   * Filtro de massiva:
   * - `all`: indiferente
   * - `with-open`: somente splitters com massiva aberta
   * - `without-open`: somente splitters sem massiva aberta
   */
  massivaOpenState: 'all' | 'with-open' | 'without-open'
  /**
   * Cliente corporativo (insígnia Contrato Corporativo / PME na consulta base).
   * - `all`: indiferente
   * - `with-corporate`: pelo menos um cliente corporativo no splitter
   * - `without-corporate`: nenhum cliente corporativo
   */
  corporateClientFilter: 'all' | 'with-corporate' | 'without-corporate'
}

export const initialSplittersListFilters: SplittersListFilterState = {
  searchQuery: '',
  oltCodes: [],
  primarySplitterTitles: [],
  splitterStatuses: [],
  streetSelections: [],
  citySelections: [],
  condominiumSelections: [],
  massivaOpenState: 'all',
  corporateClientFilter: 'all',
}

export function countActiveSplittersFilters(state: SplittersListFilterState): number {
  let n = 0
  if (state.searchQuery.trim().length > 0) n += 1
  if (state.oltCodes.length > 0) n += 1
  if (state.primarySplitterTitles.length > 0) n += 1
  if (state.splitterStatuses.length > 0) n += 1
  if (state.streetSelections.length > 0) n += 1
  if (state.citySelections.length > 0) n += 1
  if (state.condominiumSelections.length > 0) n += 1
  if (state.massivaOpenState !== 'all') n += 1
  if (state.corporateClientFilter !== 'all') n += 1
  return n
}

export function hasActiveSplittersFilters(state: SplittersListFilterState): boolean {
  return countActiveSplittersFilters(state) > 0
}
