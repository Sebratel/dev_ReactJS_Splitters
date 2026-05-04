import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useNetworkStats } from '@/features/dashboard/hooks/useNetworkStats'

vi.mock('@/shared/api/fetchNetworkStats', () => ({
  NETWORK_STATS_QUERY_KEY: ['network', 'stats'],
  fetchNetworkStats: vi.fn(() =>
    Promise.resolve({
      activeSplitters: 1,
      onlineClients: 2,
      oltCount: 3,
      equipmentOccupancy: { green: 0, yellow: 0, red: 0 },
      trends: null,
    }),
  ),
}))

describe('useNetworkStats', () => {
  it('usa queryKey e fetchNetworkStats', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useNetworkStats(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.activeSplitters).toBe(1)
  })
})
