import { describe, expect, it } from 'vitest'
import {
  formatOltSlotPonPair,
  formatOltSlotWithPonNumbers,
  formatOltTopologyDescriptionLine,
  formatOltTopologySegment,
} from '@/shared/lib/oltTopologyLabels'

describe('oltTopologyLabels', () => {
  it('formata o par slot/PON com os rótulos de interface', () => {
    expect(formatOltSlotPonPair(2, 7)).toBe('Slot 2 / PON 7')
  })

  it('usa minúsculas no segmento técnico', () => {
    expect(formatOltTopologySegment(2, 7)).toBe('slot 2 / pon 7')
  })

  it('monta a linha de descrição com PA, topologia e contagem', () => {
    const linha = formatOltTopologyDescriptionLine({
      apCode: 'AP-01',
      apDisplayTitle: 'Centro',
      slot: 2,
      pon: 7,
      splitterCount: 3,
    })
    expect(linha).toBe('PA AP-01 (Centro) / slot 2 / pon 7 / 3 splitter(s)')
  })

  describe('lista de PONs', () => {
    it('mostra travessão quando não há PONs', () => {
      expect(formatOltSlotWithPonNumbers(1, [], 3)).toBe('Slot 1: —')
    })

    it('lista todos quando cabem no limite', () => {
      expect(formatOltSlotWithPonNumbers(1, [1, 2, 3], 3)).toBe('Slot 1: 1, 2, 3')
    })

    // Acima do limite corta em maxPonsShown - 1 e resume o resto: com 5 PONs e limite 3
    // mostra os 2 primeiros e sinaliza os 3 que ficaram de fora.
    it('resume o excedente quando passa do limite', () => {
      expect(formatOltSlotWithPonNumbers(1, [1, 2, 3, 4, 5], 3)).toBe('Slot 1: 1, 2, +3')
    })
  })
})
