import { describe, expect, it } from 'vitest'
import { queryClient } from '@/app/queryClient'

describe('queryClient', () => {
  it('defaults de retry e staleTime', () => {
    const q = queryClient.getDefaultOptions()
    expect(q.queries?.retry).toBe(1)
    expect(q.queries?.staleTime).toBe(60_000)
    expect(q.mutations?.retry).toBe(0)
  })
})
