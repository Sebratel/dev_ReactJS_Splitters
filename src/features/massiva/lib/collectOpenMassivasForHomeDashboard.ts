import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import { collectMassivaPanelAbertasTickets } from '@/features/massiva/lib/massivaPanelAbertasList'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

/**
 * Fila operacional da Home — espelho da aba **Abertas** do painel de massivas
 * (mesma quantidade e mesmos protocolos com filtros padrão).
 */
export function collectOpenMassivasForHomeDashboard(input: {
  bffTickets: readonly MassivaTicket[]
  localRows: readonly MassivaHistoryListRow[]
  recentOpenTickets: readonly MassivaTicket[]
}): MassivaTicket[] {
  return collectMassivaPanelAbertasTickets(input)
}
