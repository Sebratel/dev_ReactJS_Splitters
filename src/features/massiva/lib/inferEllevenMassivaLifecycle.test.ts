import { describe, expect, it } from 'vitest'
import { inferEllevenMassivaLifecycle } from '@/features/massiva/lib/inferEllevenMassivaLifecycle'

describe('inferEllevenMassivaLifecycle', () => {
  it('prioriza incidentStatusId encerrado sobre texto Em andamento', () => {
    expect(
      inferEllevenMassivaLifecycle({
        statusTexts: ['em andamento', 'aberto'],
        incidentStatusId: 4,
        closedAt: null,
        expectedCloseAt: null,
      }),
    ).toBe('closed')
  })

  it('detecta encerramento em situation mesmo com incidentStatusId aberto', () => {
    expect(
      inferEllevenMassivaLifecycle({
        statusTexts: ['encerrado'],
        incidentStatusId: 1,
        closedAt: null,
        expectedCloseAt: null,
      }),
    ).toBe('closed')
  })

  it('SLA vencido sem status conclusivo → unknown (atrasada, NÃO encerrada) — OCO-006', () => {
    // Regressão: previsão de encerramento vencida NÃO deve inferir encerramento. A massiva
    // pode estar apenas atrasada e ainda aberta no Elleven; marcá-la como closed a removia
    // do painel de abertas e ela nunca era encerrada de fato. 'unknown' é tratado como aberta.
    const now = new Date('2026-05-20T15:00:00Z').getTime()
    expect(
      inferEllevenMassivaLifecycle({
        statusTexts: [],
        incidentStatusId: null,
        closedAt: null,
        expectedCloseAt: new Date('2026-05-20T10:00:00Z'),
        nowMs: now,
      }),
    ).toBe('unknown')
  })

  it('texto de encerrado ainda encerra, mesmo com previsão vencida', () => {
    const now = new Date('2026-05-20T15:00:00Z').getTime()
    expect(
      inferEllevenMassivaLifecycle({
        statusTexts: ['encerrado'],
        incidentStatusId: null,
        closedAt: null,
        expectedCloseAt: new Date('2026-05-20T10:00:00Z'),
        nowMs: now,
      }),
    ).toBe('closed')
  })
})
