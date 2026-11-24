import { describe, expect, it } from 'vitest'
import {
  buildMassivaSistemaTitle,
  MASSIVA_SISTEMA_TITLE_MAX_LENGTH,
} from '@/features/massiva/lib/buildMassivaSistemaTitle'

describe('buildMassivaSistemaTitle', () => {
  it('junta o assunto e o sistema escolhido', () => {
    expect(buildMassivaSistemaTitle('Sistemas Internos', 'Monitoramento Splitters')).toBe(
      'Sistemas Internos - Monitoramento Splitters',
    )
  })

  it('mantém só o assunto quando nenhum sistema foi escolhido', () => {
    expect(buildMassivaSistemaTitle('Sistemas Internos', '')).toBe('Sistemas Internos')
    expect(buildMassivaSistemaTitle('Sistemas Internos', '   ')).toBe('Sistemas Internos')
  })

  it('troca "Outro (especificar)" por "Outro"', () => {
    expect(buildMassivaSistemaTitle('Sistemas de Terceiros', 'Outro (especificar)')).toBe(
      'Sistemas de Terceiros - Outro',
    )
  })

  it('normaliza espaços e quebras de linha', () => {
    expect(buildMassivaSistemaTitle('Sistemas Internos', '  CRM \n  Comercial ')).toBe(
      'Sistemas Internos - CRM Comercial',
    )
  })

  it('limita o tamanho do título', () => {
    const title = buildMassivaSistemaTitle('Sistemas Internos', 'x'.repeat(500))
    expect(title.length).toBeLessThanOrEqual(MASSIVA_SISTEMA_TITLE_MAX_LENGTH)
    expect(title.endsWith('…')).toBe(true)
    expect(title.startsWith('Sistemas Internos - xxx')).toBe(true)
  })
})
