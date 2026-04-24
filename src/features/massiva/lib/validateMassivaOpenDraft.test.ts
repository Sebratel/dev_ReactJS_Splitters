import { describe, expect, it } from 'vitest'
import {
  getMassivaOpenDraftIssues,
  massivaOpenDraftFinalDateIsoUtc,
} from '@/features/massiva/lib/validateMassivaOpenDraft'

describe('validateMassivaOpenDraft', () => {
  it('getMassivaOpenDraftIssues', () => {
    const joined = (issues: string[]) => issues.join(' ')
    expect(joined(getMassivaOpenDraftIssues('', '', ''))).toContain('descrição')
    expect(joined(getMassivaOpenDraftIssues('ok', '', ''))).toContain('data prevista')
    expect(joined(getMassivaOpenDraftIssues('ok', 'not-a-date', '12:00'))).toContain(
      'inválida',
    )
    expect(getMassivaOpenDraftIssues('ok', '2026-06-20', '10:00')).toEqual([])
  })

  it('massivaOpenDraftFinalDateIsoUtc', () => {
    expect(massivaOpenDraftFinalDateIsoUtc('', '10:00')).toBeNull()
    const iso = massivaOpenDraftFinalDateIsoUtc('2026-06-20', '15:30')
    expect(iso).not.toBeNull()
    expect(iso).toContain('2026')
    expect(massivaOpenDraftFinalDateIsoUtc('bad', '99:99')).toBeNull()
  })
})
