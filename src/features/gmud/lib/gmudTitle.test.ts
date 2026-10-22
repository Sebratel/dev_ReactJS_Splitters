import { describe, expect, it } from 'vitest'
import { cleanGmudTitle, gmudDisplayTitle } from '@/features/gmud/lib/gmudTitle'

describe('cleanGmudTitle', () => {
  it('remove protocolo, tipo e solicitante repetidos', () => {
    expect(
      cleanGmudTitle('Protocolo 1833914 - Gestão de Mudança de Rede / GMUD - Infraestrutura - Elétrica - Rafael Lima', 1833914, 'RAFAEL LIMA'),
    ).toBe('Infraestrutura - Elétrica')
  })

  it('quando só sobra o solicitante, indica que não há descrição', () => {
    expect(
      cleanGmudTitle('Protocolo 1846364 - Gestão de Mudança de Rede / GMUD - Lucas Scheuer', 1846364, 'LUCAS EDUARDO SCHEUER'),
    ).toBe('GMUD sem descrição')
  })

  it('mantém títulos livres', () => {
    expect(cleanGmudTitle('Protocolo 1823675 - MIGRAÇÃO COND. MONIQUE - ZORABEL DEL CARMEN APARICIO AVILEZ', 1823675, 'ZORABEL DEL CARMEN APARICIO AVILEZ')).toBe(
      'MIGRAÇÃO COND. MONIQUE',
    )
    expect(cleanGmudTitle('GMUD - Programada - NHOPN - Troca de OLT')).toBe('Programada - NHOPN - Troca de OLT')
  })

  it('título vazio', () => {
    expect(cleanGmudTitle('')).toBe('GMUD sem descrição')
  })
})

describe('gmudDisplayTitle', () => {
  it('usa a descrição quando o título não diz nada', () => {
    expect(
      gmudDisplayTitle({
        title: 'Protocolo 1846364 - Gestão de Mudança de Rede / GMUD - Lucas Scheuer',
        protocol: 1846364,
        requester: 'LUCAS EDUARDO SCHEUER',
        descriptionText: '\nAtualização do firmware das OLTs do POP NH\nJanela 23h',
      }),
    ).toBe('Atualização do firmware das OLTs do POP NH')
  })

  it('mantém o título limpo quando ele é informativo', () => {
    expect(gmudDisplayTitle({ title: 'Protocolo 1 - MIGRAÇÃO COND. MONIQUE - Fulano', protocol: 1, requester: 'Fulano', descriptionText: 'x' })).toBe(
      'MIGRAÇÃO COND. MONIQUE',
    )
  })

  it('pula linhas que são só rótulos', () => {
    expect(
      gmudDisplayTitle({ title: 'Protocolo 9 - Fulano', protocol: 9, requester: 'Fulano', descriptionText: 'DESCRIÇÃO DA MANUTENÇÃO:\nTroca de splitter na CTO 12' }),
    ).toBe('Troca de splitter na CTO 12')
  })
})
