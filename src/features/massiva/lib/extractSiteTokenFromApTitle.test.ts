import { describe, expect, it } from 'vitest'
import { extractSiteTokenFromApTitle } from '@/features/massiva/lib/extractSiteTokenFromApTitle'

describe('extractSiteTokenFromApTitle', () => {
  it('extrai o site após o último traço', () => {
    expect(extractSiteTokenFromApTitle('OLT 04 - NHOPN')).toBe('NHOPN')
    expect(extractSiteTokenFromApTitle('OLT 01 - SPSCE')).toBe('SPSCE')
  })

  it('normaliza espaços e pontuação, sobe pra maiúsculas', () => {
    expect(extractSiteTokenFromApTitle('  olt 02 -  nhopn ')).toBe('NHOPN')
    expect(extractSiteTokenFromApTitle('OLT 04 - NHOPN/2')).toBe('NHOPN2')
  })

  it('sem traço, usa o último token', () => {
    expect(extractSiteTokenFromApTitle('NHOPN')).toBe('NHOPN')
  })

  it('vazio/nulo retorna string vazia', () => {
    expect(extractSiteTokenFromApTitle('')).toBe('')
    expect(extractSiteTokenFromApTitle(null)).toBe('')
    expect(extractSiteTokenFromApTitle(undefined)).toBe('')
  })
})
