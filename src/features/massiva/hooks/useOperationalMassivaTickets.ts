import { useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMassivaHistoryListFromLocalDb } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import { reconcileMassivaLocalClosedProtocols } from '@/features/massiva/api/reconcileMassivaLocalClosedProtocols'
import { useMassivaTickets } from '@/features/massiva/hooks/useMassivaTickets'
import { buildDashboardMassivaTickets } from '@/features/massiva/lib/buildDashboardMassivaTickets'
import { collectOpenMassivasForHomeDashboard } from '@/features/massiva/lib/collectOpenMassivasForHomeDashboard'
import { pruneRecentOpensClosedByBff } from '@/features/massiva/lib/pruneRecentOpensAgainstBff'
import { collectProtocolsForLocalCloseSync } from '@/features/massiva/lib/syncOutOfCatalogMassivaFromBff'
import { readRecentOpenTicketsFromStorage } from '@/features/massiva/lib/massivaRecentOpensStorage'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import type { MassivaTicketsViewState } from '@/features/massiva/hooks/useMassivaTickets'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'
import { buildMassivaStatsBySplitter } from '@/features/splitters/lib/buildMassivaStatsBySplitter'
import type { SplitterMassivaStats } from '@/features/splitters/model/splitterOperationalInsights'

const OPERATIONAL_HISTORY_START = new Date(2000, 0, 1)

export function useOperationalMassivaTickets(options?: { enabled?: boolean }): {
  massivaView: MassivaTicketsViewState
  dashboardTickets: MassivaTicket[]
  openTicketsNow: MassivaTicket[]
  statsByMatcher: Map<string, SplitterMassivaStats>
  recentProtocolSet: Set<number>
  pending: boolean
  refetch: () => void
} {
  const userEnabled = options?.enabled !== false
  const queryClient = useQueryClient()
  const { view: massivaView, refetch: refetchBff } = useMassivaTickets({
    enabled: userEnabled,
  })

  const historyQuery = useQuery({
    queryKey: massivaKeys.historyList(
      'all',
      OPERATIONAL_HISTORY_START.toISOString(),
      'operational',
      5000,
    ),
    queryFn: () =>
      fetchMassivaHistoryListFromLocalDb({
        status: null,
        startDate: OPERATIONAL_HISTORY_START,
        limit: 5000,
      }),
    staleTime: 60_000,
    enabled: userEnabled && massivaView.status !== 'not-configured',
  })

  const recentOpensQuery = useQuery({
    queryKey: massivaKeys.recentOpens(),
    queryFn: () => readRecentOpenTicketsFromStorage(),
    staleTime: 0,
    enabled: userEnabled,
  })

  const bffTickets = massivaView.status === 'success' ? massivaView.tickets : []
  const localRows = historyQuery.data ?? []
  const recentOpenTickets = recentOpensQuery.data ?? []

  const reconcileOotClosedRef = useRef<string>('')

  useEffect(() => {
    if (massivaView.status !== 'success') return
    pruneRecentOpensClosedByBff(bffTickets, localRows)
    void queryClient.invalidateQueries({ queryKey: massivaKeys.recentOpens() })
  }, [massivaView.status, bffTickets, localRows, queryClient])

  useEffect(() => {
    if (massivaView.status !== 'success') return
    const protocols = collectProtocolsForLocalCloseSync(bffTickets, localRows)
    const key = protocols.slice().sort((a, b) => a - b).join(',')
    if (key === '' || reconcileOotClosedRef.current === key) return
    reconcileOotClosedRef.current = key
    void reconcileMassivaLocalClosedProtocols(protocols, {
      closeDescription:
        'Encerrado automaticamente: protocolo confirmado como encerrado pelo Elleven ou removido do catálogo BFF.',
    })
      .then(() => historyQuery.refetch())
      .catch(() => {
        reconcileOotClosedRef.current = ''
      })
  }, [massivaView.status, bffTickets, localRows, historyQuery])

  const recentProtocolSet = useMemo(() => {
    const set = new Set<number>()
    for (const ticket of recentOpenTickets) {
      if (ticket.protocol > 0) set.add(ticket.protocol)
    }
    return set
  }, [recentOpenTickets])

  const dashboardTickets = useMemo(
    () =>
      buildDashboardMassivaTickets({
        bffTickets,
        localRows,
        recentOpenTickets,
        periodStart: OPERATIONAL_HISTORY_START,
      }),
    [bffTickets, localRows, recentOpenTickets],
  )

  const openTicketsNow = useMemo(
    () =>
      collectOpenMassivasForHomeDashboard({
        bffTickets,
        localRows,
        recentOpenTickets,
      }),
    [bffTickets, localRows, recentOpenTickets],
  )

  const statsByMatcher = useMemo(
    () => buildMassivaStatsBySplitter(dashboardTickets, recentProtocolSet),
    [dashboardTickets, recentProtocolSet],
  )

  const pending =
    massivaView.status === 'loading' ||
    massivaView.status === 'error' ||
    massivaView.status === 'not-configured'

  const refetch = () => {
    refetchBff()
    void historyQuery.refetch()
    void recentOpensQuery.refetch()
  }

  return {
    massivaView,
    dashboardTickets,
    openTicketsNow,
    statsByMatcher,
    recentProtocolSet,
    pending,
    refetch,
  }
}
