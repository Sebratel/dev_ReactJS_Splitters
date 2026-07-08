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
   * Tipo de local do splitter (classificação canônica por prefixo RES./COND./ED.):
   * - `all`: indiferente
   * - `CONDOMÍNIO`: somente splitters de condomínio
   * - `UNIDADE`: somente splitters de rua/unidade
   */
  localKindFilter: 'all' | 'CONDOMÍNIO' | 'UNIDADE'
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
  /** Janela temporal para análise de manutenção por splitter. */
  maintenanceWindowDays: 7 | 30 | 90
  /** Filtro de manutenção por splitter no período selecionado. */
  maintenanceFilter: 'all' | 'with-maintenance'
  /**
   * Filtro por slot da OLT derivado do título/código do splitter (regra PON: dois últimos
   * grupos numéricos antes de `/`), com fallback às colunas SQL. `null` = sem filtro nessa dimensão.
   */
  oltSlot: number | null
  /** Filtro por porta da OLT (mesma regra que `oltSlot`). */
  oltPort: number | null
  /**
   * Filtro por nível de sinal ONU (RX médio do splitter):
   * - `all`: indiferente
   * - `critico` / `atenuado`: pela faixa de RX médio
   * - `offline`: tem ONU mas sem leitura válida
   * "Normal" e "sem medição" ficam de fora de propósito (seriam quase toda a base).
   */
  signalLevelFilter: 'all' | 'critico' | 'atenuado' | 'offline'
}

export const initialSplittersListFilters: SplittersListFilterState = {
  searchQuery: '',
  oltCodes: [],
  primarySplitterTitles: [],
  splitterStatuses: [],
  streetSelections: [],
  citySelections: [],
  condominiumSelections: [],
  localKindFilter: 'all',
  massivaOpenState: 'all',
  corporateClientFilter: 'all',
  maintenanceWindowDays: 30,
  maintenanceFilter: 'all',
  oltSlot: null,
  oltPort: null,
  signalLevelFilter: 'all',
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
  if (state.localKindFilter !== 'all') n += 1
  if (state.massivaOpenState !== 'all') n += 1
  if (state.corporateClientFilter !== 'all') n += 1
  if (state.maintenanceFilter !== 'all') n += 1
  const hasOltSlot = typeof state.oltSlot === 'number' && Number.isFinite(state.oltSlot)
  const hasOltPort = typeof state.oltPort === 'number' && Number.isFinite(state.oltPort)
  if (hasOltSlot || hasOltPort) n += 1
  if (state.signalLevelFilter !== 'all') n += 1
  return n
}

export function hasActiveSplittersFilters(state: SplittersListFilterState): boolean {
  return countActiveSplittersFilters(state) > 0
}
