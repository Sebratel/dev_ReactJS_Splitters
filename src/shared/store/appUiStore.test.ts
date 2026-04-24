import { describe, expect, it } from 'vitest'
import { useAppUiStore } from '@/shared/store/appUiStore'

describe('useAppUiStore', () => {
  it('atualiza loading e erro global', () => {
    const s = useAppUiStore.getState()
    s.setGlobalLoading(true)
    s.setGlobalError('e1')
    expect(useAppUiStore.getState().globalLoading).toBe(true)
    expect(useAppUiStore.getState().globalError).toBe('e1')
    s.setGlobalError(null)
    s.setGlobalLoading(false)
    expect(useAppUiStore.getState().globalError).toBeNull()
    expect(useAppUiStore.getState().globalLoading).toBe(false)
  })
})
