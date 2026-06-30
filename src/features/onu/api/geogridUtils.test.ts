import { describe, expect, it } from 'vitest'
import { pickProjected, toNum, toText, type GeogridRegistro } from './geogridUtils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReg(
  nome: string,
  potenciaFinal: number | null,
  extra?: { oltSigla?: string; porta?: string },
): GeogridRegistro {
  return {
    nome,
    atendimentos: potenciaFinal !== null
      ? [
          {
            potencia: { potenciaFinal, potenciaInicial: -5, perdaTotal: 17 },
            olt: { sigla: extra?.oltSigla ?? 'OLT 01', porta: '1/5/3' },
            equipamentoAtendimento: { sigla: 'SLE-C-001', porta: extra?.porta ?? '1/5/3/1' },
          },
        ]
      : [],
  }
}

function makeEmptyReg(nome: string): GeogridRegistro {
  return { nome, atendimentos: [] }
}

// ---------------------------------------------------------------------------
// toNum
// ---------------------------------------------------------------------------

describe('toNum', () => {
  it('converte número válido', () => expect(toNum(-22.69)).toBe(-22.69))
  it('retorna null para string vazia', () => expect(toNum('')).toBeNull())
  it('retorna null para null', () => expect(toNum(null)).toBeNull())
  it('retorna null para undefined', () => expect(toNum(undefined)).toBeNull())
  it('converte string numérica', () => expect(toNum('-22.69')).toBeCloseTo(-22.69))
  it('retorna null para NaN', () => expect(toNum('abc')).toBeNull())
})

// ---------------------------------------------------------------------------
// toText
// ---------------------------------------------------------------------------

describe('toText', () => {
  it('retorna string com trim', () => expect(toText('  OLT 01  ')).toBe('OLT 01'))
  it('retorna null para string vazia após trim', () => expect(toText('  ')).toBeNull())
  it('retorna null para null', () => expect(toText(null)).toBeNull())
  it('retorna null para undefined', () => expect(toText(undefined)).toBeNull())
})

// ---------------------------------------------------------------------------
// pickProjected — casos principais
// ---------------------------------------------------------------------------

describe('pickProjected', () => {
  it('retorna null quando registros está vazio', () => {
    expect(pickProjected([], 'JOAO DA SILVA')).toBeNull()
  })

  it('retorna null quando nenhum registro casa com o nome alvo', () => {
    const regs = [makeReg('MARIA DE SOUZA', -22)]
    expect(pickProjected(regs, 'JOAO DA SILVA')).toBeNull()
  })

  it('não usa fallback — nome diferente nunca vira resultado', () => {
    // Antes do fix: retornaria MARIA DE SOUZA como "projeção" de JOAO DA SILVA.
    // Depois do fix: retorna null.
    const regs = [makeReg('MARIA DE SOUZA', -22)]
    expect(pickProjected(regs, 'JOAO DA SILVA')).toBeNull()
  })

  it('retorna projeção quando nome casa exato (normalizado)', () => {
    const regs = [makeReg('ZENAIDE DE OLIVEIRA', -22.69)]
    const result = pickProjected(regs, 'ZENAIDE DE OLIVEIRA')
    expect(result).not.toBeNull()
    expect(result?.projectedRxPower).toBeCloseTo(-22.69)
    expect(result?.ambiguous).toBeFalsy()
  })

  it('match é case-insensitive e sem acento — normalização cobre os dois lados', () => {
    // O nome no registro vem com acento; o alvo já foi normalizado pelo caller.
    const regs = [makeReg('Zenaide de Oliveira', -22.69)]
    const result = pickProjected(regs, 'ZENAIDE DE OLIVEIRA')
    expect(result?.projectedRxPower).toBeCloseTo(-22.69)
  })

  it('varre todos os registros do nome (caso ZENAIDE: registro vazio antes do válido)', () => {
    const regs: GeogridRegistro[] = [
      makeEmptyReg('ZENAIDE DE OLIVEIRA'), // sem atendimentos — vem primeiro
      makeReg('ZENAIDE DE OLIVEIRA', -22.69), // tem potenciaFinal
    ]
    const result = pickProjected(regs, 'ZENAIDE DE OLIVEIRA')
    expect(result?.projectedRxPower).toBeCloseTo(-22.69)
  })

  it('retorna null quando todos os registros do nome têm atendimentos vazios', () => {
    const regs = [makeEmptyReg('ZENAIDE DE OLIVEIRA'), makeEmptyReg('ZENAIDE DE OLIVEIRA')]
    expect(pickProjected(regs, 'ZENAIDE DE OLIVEIRA')).toBeNull()
  })

  it('retorna o primeiro válido SEM ambiguous quando há só um valor de potenciaFinal distinto', () => {
    // Dois registros do mesmo cliente, mesmo valor — não é homônimo.
    const regs: GeogridRegistro[] = [
      makeReg('JOSE DA SILVA', -22),
      makeReg('JOSE DA SILVA', -22),
    ]
    const result = pickProjected(regs, 'JOSE DA SILVA')
    expect(result?.projectedRxPower).toBeCloseTo(-22)
    expect(result?.ambiguous).toBeFalsy()
  })

  it('retorna ambiguous: true quando o mesmo nome tem dois valores distintos (possível homônimo)', () => {
    // Dois "JOSE DA SILVA" com sinais projetados diferentes — provavelmente
    // são clientes diferentes com o mesmo nome.
    const regs: GeogridRegistro[] = [
      makeReg('JOSE DA SILVA', -20),
      makeReg('JOSE DA SILVA', -28),
    ]
    const result = pickProjected(regs, 'JOSE DA SILVA')
    expect(result).not.toBeNull()
    expect(result?.ambiguous).toBe(true)
    // Ainda retorna o primeiro para exibição, mas sem disparar alarme.
    expect(result?.projectedRxPower).toBeCloseTo(-20)
  })

  it('preenche os campos de OLT e porta do atendimento escolhido', () => {
    const regs = [makeReg('ZENAIDE DE OLIVEIRA', -22.69, { oltSigla: 'OLT 05', porta: '1/5/3/2' })]
    const result = pickProjected(regs, 'ZENAIDE DE OLIVEIRA')
    expect(result?.oltSigla).toBe('OLT 05')
    expect(result?.porta).toBe('1/5/3/2')
    expect(result?.lossTotal).toBeCloseTo(17)
  })

  it('ignora registro de outro nome mesmo que venha antes no array', () => {
    const regs: GeogridRegistro[] = [
      makeReg('CARLOS OUTRO', -15),     // outro cliente
      makeReg('ZENAIDE DE OLIVEIRA', -22.69),
    ]
    const result = pickProjected(regs, 'ZENAIDE DE OLIVEIRA')
    expect(result?.projectedRxPower).toBeCloseTo(-22.69)
    expect(result?.matchedName).toBe('ZENAIDE DE OLIVEIRA')
  })
})
