import { describe, expect, it } from 'vitest'
import {
  getMassivaOpenDraftIssues,
  massivaLocalDateTimeToGatewayIso,
  massivaOpenDraftFinalDateLocal,
} from '@/features/massiva/lib/validateMassivaOpenDraft'

describe('validateMassivaOpenDraft', () => {
  it('getMassivaOpenDraftIssues', () => {
    const joined = (issues: string[]) => issues.join(' ')
    expect(joined(getMassivaOpenDraftIssues('', '', ''))).toContain('descrição')
    expect(joined(getMassivaOpenDraftIssues('ok', '', ''))).toContain('data prevista')
    expect(joined(getMassivaOpenDraftIssues('ok', 'not-a-date', '12:00'))).toContain(
      'inválida',
    )
    // hora é obrigatória: data válida sem hora deve acusar erro
    expect(joined(getMassivaOpenDraftIssues('ok', '2026-06-20', ''))).toContain('hora')
    expect(getMassivaOpenDraftIssues('ok', '2026-06-20', '10:00')).toEqual([])
  })

  it('massivaOpenDraftFinalDateLocal mantém horário de parede para MySQL', () => {
    expect(massivaOpenDraftFinalDateLocal('', '10:00')).toBeNull()
    expect(massivaOpenDraftFinalDateLocal('2026-06-08', '15:30')).toBe(
      '2026-06-08T15:30:00',
    )
    expect(massivaOpenDraftFinalDateLocal('2026-06-08', '15:30')).not.toContain('Z')
    expect(massivaOpenDraftFinalDateLocal('bad', '99:99')).toBeNull()
  })

  it('massivaLocalDateTimeToGatewayIso envia ISO UTC com .000Z no POST', () => {
    const iso = massivaLocalDateTimeToGatewayIso('2026-06-08T20:20:00')
    expect(iso).not.toBeNull()
    expect(iso).toMatch(/\.000Z$/)
    expect(iso).not.toBe('2026-06-08T20:20:00')
  })
})
