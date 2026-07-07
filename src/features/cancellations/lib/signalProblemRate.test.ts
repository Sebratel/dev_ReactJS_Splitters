import { describe, expect, it } from 'vitest'
import {
  classifySignalProblemRate,
  describeSignalProblemRate,
  signalProblemLevelLabel,
} from '@/features/cancellations/lib/signalProblemRate'

describe('signalProblemRate', () => {
  it('classifica faixas de problema de sinal', () => {
    expect(classifySignalProblemRate(5)).toBe('ok')
    expect(classifySignalProblemRate(10)).toBe('attention')
    expect(classifySignalProblemRate(37.5)).toBe('critical')
    expect(classifySignalProblemRate(null)).toBe('unknown')
  })

  it('rotula apresentação para popup e tabela', () => {
    expect(signalProblemLevelLabel('critical')).toBe('Crítico')
    expect(describeSignalProblemRate(37.5).label).toBe('Crítico')
    expect(describeSignalProblemRate(37.5).valueColor).toMatch(/^#/)
  })
})
