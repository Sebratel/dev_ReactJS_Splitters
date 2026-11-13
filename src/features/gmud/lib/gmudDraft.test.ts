import { describe, expect, it } from 'vitest'
import { clearGmudDraft, draftHasContent, gmudDraftKey, loadGmudDraft, saveGmudDraft } from '@/features/gmud/lib/gmudDraft'
import { emptyGmudForm, emptyGmudSistemasExternosData, emptyGmudSistemasInternosData } from '@/features/gmud/model/gmudForm'

function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}
const defaults = () => ({ form: emptyGmudForm('a@b.com', 'A'), si: emptyGmudSistemasInternosData(), se: emptyGmudSistemasExternosData() })

describe('rascunho da GMUD', () => {
  it('grava e recupera, misturando com os padrões', () => {
    const st = memoryStorage()
    const d = defaults()
    const key = gmudDraftKey(' A@B.com ')
    expect(key).toBe('gmud:rascunho:v1:a@b.com')
    saveGmudDraft(st, key, { etapa: 2, maxEtapa: 3, form: { ...d.form, titulo: 'Limpeza' }, si: d.si, se: d.se }, new Date('2026-11-13T10:00:00Z'))
    const back = loadGmudDraft(st, key, defaults())
    expect(back?.form.titulo).toBe('Limpeza')
    expect(back?.etapa).toBe(2)
    expect(back?.maxEtapa).toBe(3)
    expect(back?.savedAt).toBe('2026-11-13T10:00:00.000Z')
  })

  it('campos que não existiam no rascunho vêm do padrão', () => {
    const st = memoryStorage()
    const d = defaults()
    st.setItem('k', JSON.stringify({ v: 1, savedAt: '2026-11-13T10:00:00Z', etapa: 1, maxEtapa: 1, form: { titulo: 'X' } }))
    const back = loadGmudDraft(st, 'k', d)
    expect(back?.form.titulo).toBe('X')
    expect(back?.form.ambienteAfetado).toEqual(d.form.ambienteAfetado)
    expect(back?.si).toEqual(d.si)
  })

  it('ignora lixo, outra versão e etapas fora da faixa', () => {
    const st = memoryStorage()
    st.setItem('a', 'não é json')
    st.setItem('b', JSON.stringify({ v: 2, form: {} }))
    st.setItem('c', JSON.stringify({ v: 1, etapa: 99, maxEtapa: -3, form: {} }))
    expect(loadGmudDraft(st, 'a', defaults())).toBeNull()
    expect(loadGmudDraft(st, 'b', defaults())).toBeNull()
    expect(loadGmudDraft(st, 'nada', defaults())).toBeNull()
    const c = loadGmudDraft(st, 'c', defaults())
    expect(c?.etapa).toBe(4)
    expect(c?.maxEtapa).toBe(4)
  })

  it('apaga o rascunho', () => {
    const st = memoryStorage()
    st.setItem('k', '{}')
    clearGmudDraft(st, 'k')
    expect(st.getItem('k')).toBeNull()
  })

  it('armazenamento que falha não derruba', () => {
    const quebrado = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } }
    const d = defaults()
    expect(() => saveGmudDraft(quebrado, 'k', { etapa: 0, maxEtapa: 0, form: d.form, si: d.si, se: d.se })).not.toThrow()
    expect(loadGmudDraft(quebrado, 'k', d)).toBeNull()
    expect(() => clearGmudDraft(quebrado, 'k')).not.toThrow()
  })

  it('draftHasContent: formulário em branco não vira rascunho', () => {
    const d = defaults()
    expect(draftHasContent(d.form, d.form)).toBe(false)
    expect(draftHasContent({ ...d.form, titulo: 'a' }, d.form)).toBe(true)
  })
})
