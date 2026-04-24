import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/apiError'
import {
  formatMassivaOpenApiFailure,
  parseMassivaOpenHttpResult,
  parseMassivaOpenResponseToResult,
} from '@/features/massiva/lib/parseMassivaOpenResponse'

describe('parseMassivaOpenResponse', () => {
  it('parseMassivaOpenResponseToResult extrai protocol e assignment', () => {
    const r = parseMassivaOpenResponseToResult(
      {
        success: true,
        protocol: '42',
        assignmentId: 7,
        message: 'ok',
      },
      'AP1',
    )
    expect(r).toMatchObject({
      accessPointCode: 'AP1',
      protocol: 42,
      assignmentId: 7,
      message: 'ok',
    })
    const r2 = parseMassivaOpenResponseToResult(
      { success: true, createdProtocols: ['99'] },
      'AP2',
    )
    expect(r2.protocol).toBe(99)
  })

  it('lança quando success false', () => {
    expect(() =>
      parseMassivaOpenResponseToResult({ success: false, message: 'falhou' }, 'AP'),
    ).toThrow('falhou')
  })

  it('parseMassivaOpenHttpResult repassa mensagem', () => {
    expect(() => parseMassivaOpenHttpResult({ success: false }, 'AP')).toThrow()
  })

  it('formatMassivaOpenApiFailure', () => {
    expect(
      formatMassivaOpenApiFailure(new ApiError(500, 'm', 'corpo')),
    ).toBe('corpo')
    expect(formatMassivaOpenApiFailure(new ApiError(500, 'm', '  '))).toBe('m')
    expect(formatMassivaOpenApiFailure(new Error('e'))).toBe('e')
    expect(formatMassivaOpenApiFailure(1)).toBe('1')
  })
})
