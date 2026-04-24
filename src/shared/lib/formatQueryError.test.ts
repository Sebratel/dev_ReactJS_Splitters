import { describe, expect, it } from 'vitest'
import { ApiError, NetworkError } from '@/shared/api/apiError'
import { formatQueryError } from '@/shared/lib/formatQueryError'

describe('formatQueryError', () => {
  it('formata ApiError com corpo truncado', () => {
    const body = 'a'.repeat(1000)
    const err = new ApiError(500, 'Falha', body)
    const s = formatQueryError(err)
    expect(s.startsWith('Falha — ')).toBe(true)
    expect(s.length).toBeLessThan(body.length + 50)
    expect(s.endsWith('…')).toBe(true)
  })

  it('ApiError com corpo curto não adiciona reticências', () => {
    const err = new ApiError(500, 'Falha', 'curto')
    expect(formatQueryError(err)).toBe('Falha — curto')
  })

  it('ApiError sem corpo retorna só a mensagem', () => {
    expect(formatQueryError(new ApiError(400, 'Bad', '  \n  '))).toBe('Bad')
  })

  it('NetworkError, Error genérico e unknown', () => {
    expect(formatQueryError(new NetworkError('rede'))).toBe('rede')
    expect(formatQueryError(new Error('x'))).toBe('x')
    expect(formatQueryError(123)).toBe('Erro desconhecido.')
  })
})
