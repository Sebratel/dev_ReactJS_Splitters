import { describe, expect, it } from 'vitest'
import { ApiError, NetworkError } from '@/shared/api/apiError'

describe('ApiError', () => {
  it('preserva status, body e name', () => {
    const e = new ApiError(404, 'não encontrado', '{}')
    expect(e).toBeInstanceOf(Error)
    expect(e.name).toBe('ApiError')
    expect(e.status).toBe(404)
    expect(e.body).toBe('{}')
    expect(e.message).toBe('não encontrado')
  })
})

describe('NetworkError', () => {
  it('preserva underlying opcional', () => {
    const cause = new Error('c')
    const e = new NetworkError('falha', cause)
    expect(e.name).toBe('NetworkError')
    expect(e.message).toBe('falha')
    expect(e.underlying).toBe(cause)
  })
})
