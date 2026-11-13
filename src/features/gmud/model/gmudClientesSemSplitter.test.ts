import { describe, expect, it } from 'vitest'
import {
  GMUD_CLIENTES_SEM_SPLITTER_MAX,
  composeClientesTexto,
  formatClienteSemSplitter,
  normalizeClientesSemSplitter,
  type GmudClienteSemSplitter,
} from '@/features/gmud/model/gmudClientesSemSplitter'

const c = (contractId: number, extra: Partial<GmudClienteSemSplitter> = {}): GmudClienteSemSplitter => ({
  contractId,
  nome: `Cliente ${contractId}`,
  pppoe: '',
  tipo: 'ponto_a_ponto',
  ...extra,
})

describe('clientes sem splitter', () => {
  it('normaliza: contrato válido, sem repetir, texto aparado, tipo padrão', () => {
    const lista = normalizeClientesSemSplitter([
      c(10, { nome: '  Empresa A ', pppoe: ' usu ' }),
      c(10, { nome: 'repetido' }),
      c(0),
      c(Number.NaN),
      { ...c(20), tipo: 'invalido' as never },
    ])
    expect(lista).toEqual([
      { contractId: 10, nome: 'Empresa A', pppoe: 'usu', tipo: 'ponto_a_ponto' },
      { contractId: 20, nome: 'Cliente 20', pppoe: '', tipo: 'ponto_a_ponto' },
    ])
    expect(normalizeClientesSemSplitter(null)).toEqual([])
  })

  it('respeita o limite por GMUD', () => {
    const muitos = Array.from({ length: GMUD_CLIENTES_SEM_SPLITTER_MAX + 10 }, (_, i) => c(i + 1))
    expect(normalizeClientesSemSplitter(muitos)).toHaveLength(GMUD_CLIENTES_SEM_SPLITTER_MAX)
  })

  it('formata para a máscara: escolhidos e depois a observação, uma frase por item', () => {
    expect(formatClienteSemSplitter(c(7, { nome: 'Fibra Ltda', tipo: 'fibra_apagada' }))).toBe('Fibra Ltda (contrato 7, fibra apagada)')
    expect(composeClientesTexto([c(1), c(2, { tipo: 'fibra_apagada' })], 'avisar o gerente\n\nligar antes')).toBe(
      'Cliente 1 (contrato 1, ponto a ponto); Cliente 2 (contrato 2, fibra apagada); avisar o gerente; ligar antes',
    )
    expect(composeClientesTexto([], '')).toBe('')
    expect(composeClientesTexto(undefined, 'só texto')).toBe('só texto')
  })
})
