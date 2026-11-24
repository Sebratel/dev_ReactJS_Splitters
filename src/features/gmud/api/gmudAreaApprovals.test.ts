import { describe, expect, it } from 'vitest'
import { readApprovalTokenFromHash } from '@/features/gmud/api/gmudAreaApprovals'

describe('readApprovalTokenFromHash', () => {
  it('lê o código do fragmento do link', () => {
    expect(readApprovalTokenFromHash('#t=abc_DEF-123')).toBe('abc_DEF-123')
    expect(readApprovalTokenFromHash('t=abc')).toBe('abc')
  })

  it('devolve vazio quando não há código', () => {
    expect(readApprovalTokenFromHash('')).toBe('')
    expect(readApprovalTokenFromHash('#')).toBe('')
    expect(readApprovalTokenFromHash('#x=1')).toBe('')
    expect(readApprovalTokenFromHash('#t=')).toBe('')
  })
})
