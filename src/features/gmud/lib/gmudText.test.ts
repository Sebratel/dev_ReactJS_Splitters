import { describe, expect, it } from 'vitest'
import { htmlToPlainText } from '@/features/gmud/lib/gmudText'

describe('htmlToPlainText', () => {
  it('remove tags e preserva parágrafos', () => {
    expect(htmlToPlainText('<p>Realizar troca da CE.</p><p>Retorno às 18h&nbsp;&amp; teste.</p>')).toBe(
      'Realizar troca da CE.\nRetorno às 18h & teste.',
    )
  })

  it('listas e quebras de linha', () => {
    expect(htmlToPlainText('<ul><li>Um</li><li>Dois</li></ul>Fim<br/>linha')).toBe('• Um\n• Dois\nFim\nlinha')
  })

  it('texto puro e vazio', () => {
    expect(htmlToPlainText('Sem HTML')).toBe('Sem HTML')
    expect(htmlToPlainText(null)).toBe('')
  })

  it('não executa nem preserva scripts', () => {
    expect(htmlToPlainText('<script>alert(1)</script>ok')).toBe('alert(1)ok')
  })
})
