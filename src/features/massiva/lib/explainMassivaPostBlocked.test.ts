import { describe, expect, it } from 'vitest'
import { explainMassivaPostBlocked } from '@/features/massiva/lib/explainMassivaPostBlocked'
import type { MassivaOpenReadinessView } from '@/features/massiva/model/massivaOpenReadiness'

describe('explainMassivaPostBlocked', () => {
  it('null quando ready; mensagens por status', () => {
    expect(
      explainMassivaPostBlocked({
        status: 'ready-to-open',
        context: {},
      } as MassivaOpenReadinessView),
    ).toBeNull()

    expect(
      explainMassivaPostBlocked({
        status: 'blocked-preparation',
        preparation: {} as never,
      }),
    ).toContain('Finalize')

    expect(
      explainMassivaPostBlocked({ status: 'missing-session', reason: 'token' }),
    ).toContain('credencial')

    expect(
      explainMassivaPostBlocked({ status: 'missing-session', reason: 'email' }),
    ).toContain('e-mail')

    expect(
      explainMassivaPostBlocked({
        status: 'missing-session',
        reason: 'user-profile',
      }),
    ).toContain('incompleto')

    expect(explainMassivaPostBlocked({ status: 'no-permission' })).toContain(
      'permissão',
    )

    expect(
      explainMassivaPostBlocked({ status: 'resolving-person-id' }),
    ).toContain('personId')

    expect(
      explainMassivaPostBlocked({ status: 'person-id-error', error: 'x' }),
    ).toContain('Tentar novamente')

    expect(
      explainMassivaPostBlocked({ status: 'person-id-invalid' }),
    ).toContain('inválido')

    expect(
      explainMassivaPostBlocked({ status: 'missing-gateway-config' }),
    ).toContain('VITE_MASSIVA_OPEN_PATH')

    expect(
      explainMassivaPostBlocked({
        status: 'missing-assignment',
        issues: ['a', 'b'],
      }),
    ).toBe('a b')

    expect(
      explainMassivaPostBlocked({ status: 'unknown' } as MassivaOpenReadinessView),
    ).toContain('Ainda não')
  })
})
