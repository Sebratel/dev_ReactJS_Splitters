import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { collectOpenMassivaSplitterCodes } from '@/features/massiva/lib/collectOpenMassivaSplitterCodes'
import { isMassivaOpenForGlobalDashboard } from '@/features/massiva/lib/massivaDashboardEligibility'
import type { useOperationalMassivaTickets } from '@/features/massiva/hooks/useOperationalMassivaTickets'
import { fetchMassivaOpenFilterSplitterCodes } from '@/features/splitters/api/fetchMassivaOpenFilterSplitterCodes'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

type OperationalMassiva = ReturnType<typeof useOperationalMassivaTickets>

export function useOpenMassivaSplitterCodesForFilter(input: {
  enabled: boolean
  massivaOpenState: 'all' | 'with-open' | 'without-open'
  operationalMassiva: OperationalMassiva
}): {
  codes: string[]
  pending: boolean
  ready: boolean
} {
  const needsFilter = input.massivaOpenState !== 'all' && input.enabled
  const massivaReady = input.operationalMassiva.massivaView.status === 'success'

  const ticketDerived = useMemo(() => {
    if (!massivaReady) {
      return { protocols: [] as number[], apCodes: [] as string[], ticketCodes: [] as string[] }
    }

    const protocols = new Set<number>()
    const apCodes = new Set<string>()
    const ticketCodes = new Set<string>()
    const recent = input.operationalMassiva.recentProtocolSet

    const consider = (ticket: (typeof input.operationalMassiva.openTicketsNow)[number]) => {
      if (!isMassivaOpenForGlobalDashboard(ticket, recent)) return
      if (ticket.protocol > 0) protocols.add(ticket.protocol)
      const ap = String(ticket.apCode ?? '').trim()
      if (ap !== '') apCodes.add(ap)
      const splitter = String(ticket.splitterCode ?? '').trim()
      if (splitter !== '') ticketCodes.add(splitter)
    }

    for (const ticket of input.operationalMassiva.openTicketsNow) consider(ticket)
    for (const ticket of input.operationalMassiva.dashboardTickets) consider(ticket)

    return {
      protocols: [...protocols],
      apCodes: [...apCodes],
      ticketCodes: [...ticketCodes],
    }
  }, [input.operationalMassiva, massivaReady])

  const fromTicketsOnly = useMemo(() => {
    if (!massivaReady) return []
    return collectOpenMassivaSplitterCodes({
      openTicketsNow: input.operationalMassiva.openTicketsNow,
      dashboardTickets: input.operationalMassiva.dashboardTickets,
      recentProtocolSet: input.operationalMassiva.recentProtocolSet,
    })
  }, [input.operationalMassiva, massivaReady])

  const enrichQuery = useQuery({
    queryKey: splittersKeys.openFilterSplitterCodes(
      ticketDerived.protocols.join(','),
      ticketDerived.apCodes.join(','),
      ticketDerived.ticketCodes.join(','),
    ),
    queryFn: () =>
      fetchMassivaOpenFilterSplitterCodes({
        protocols: ticketDerived.protocols,
        accessPointCodes: ticketDerived.apCodes,
        ticketSplitterCodes: ticketDerived.ticketCodes,
      }),
    enabled:
      needsFilter &&
      massivaReady &&
      (ticketDerived.protocols.length > 0 ||
        ticketDerived.apCodes.length > 0 ||
        ticketDerived.ticketCodes.length > 0),
    staleTime: 30_000,
  })

  const codes = useMemo(() => {
    const merged = new Set(fromTicketsOnly)
    for (const code of enrichQuery.data ?? []) merged.add(code)
    return [...merged]
  }, [fromTicketsOnly, enrichQuery.data])

  const pending =
    needsFilter &&
    (input.operationalMassiva.pending ||
      !massivaReady ||
      (enrichQuery.isFetching && enrichQuery.data == null))

  const ready = !needsFilter || (!pending && massivaReady)

  return { codes, pending, ready }
}
