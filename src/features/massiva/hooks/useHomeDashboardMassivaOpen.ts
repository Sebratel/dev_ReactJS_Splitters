import { useMemo } from 'react'
import { useOperationalMassivaTickets } from '@/features/massiva/hooks/useOperationalMassivaTickets'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

export function useHomeDashboardMassivaOpen(): {
  pending: boolean
  notConfigured: boolean
  openMassivas: MassivaTicket[]
  openCount: number
  affectedClientsTotal: number
} {
  const operational = useOperationalMassivaTickets({ enabled: true })

  const affectedClientsTotal = useMemo(
    () =>
      operational.openTicketsNow.reduce(
        (sum, ticket) => sum + Math.max(0, ticket.affectedClients),
        0,
      ),
    [operational.openTicketsNow],
  )

  return {
    pending: operational.pending,
    notConfigured: operational.massivaView.status === 'not-configured',
    openMassivas: operational.openTicketsNow,
    openCount: operational.openTicketsNow.length,
    affectedClientsTotal,
  }
}
