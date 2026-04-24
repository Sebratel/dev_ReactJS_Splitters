import { describe, expect, it } from 'vitest'
import i18n from '@/shared/config/i18n'

describe('i18n', () => {
  it('inicializa com recurso pt-BR', () => {
    expect(i18n.isInitialized).toBe(true)
    expect(i18n.hasResourceBundle('pt-BR', 'translation')).toBe(true)
    expect(i18n.hasResourceBundle('en-US', 'translation')).toBe(true)
  })
})
