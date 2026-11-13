import { describe, expect, it } from 'vitest'
import { gmudCancelada, gmudEncerrada, gmudPodeAvaliar } from '@/features/gmud/lib/gmudLifecycle'

const extra = (statusComite: string) => ({ statusComite }) as never

describe('GMUD cancelada no Voalle', () => {
  it('status do Voalle com "cancel" conta como cancelada, mesmo com o Comitê pendente', () => {
    const g = { extra: extra('pendente'), conclusionDate: null, status: 'Cancelado' }
    expect(gmudCancelada(g)).toBe(true)
    expect(gmudEncerrada(g)).toBe(true)
    expect(gmudPodeAvaliar(g)).toBe(false)
  })

  it('GMUD aberta com Comitê pendente continua avaliável', () => {
    const g = { extra: extra('pendente'), conclusionDate: null, status: 'Em andamento' }
    expect(gmudCancelada(g)).toBe(false)
    expect(gmudPodeAvaliar(g)).toBe(true)
  })
})
