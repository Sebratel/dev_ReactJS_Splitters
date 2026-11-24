import { describe, expect, it } from 'vitest'
import { filterPopSites } from '@/features/gmud/lib/gmudPopSites'

const sites = [
  { id: 1, title: 'CANNT', city: 'Canoas', neighborhood: 'Niterói' },
  { id: 2, title: 'NHOPN', city: 'Novo Hamburgo', neighborhood: null },
  { id: 3, title: 'XCAN', city: 'São Leopoldo', neighborhood: 'Centro' },
  { id: 4, title: 'ABCDE', city: 'Canela', neighborhood: null },
]

describe('filterPopSites', () => {
  it('sem texto devolve todos, na ordem recebida', () => {
    expect(filterPopSites(sites, '').map((s) => s.id)).toEqual([1, 2, 3, 4])
    expect(filterPopSites(sites, '   ').map((s) => s.id)).toEqual([1, 2, 3, 4])
  })
  it('quem começa com o texto vem antes de quem só contém (código, cidade ou bairro)', () => {
    expect(filterPopSites(sites, 'can').map((s) => s.id)).toEqual([1, 3, 4])
  })
  it('ignora acento e caixa', () => {
    expect(filterPopSites(sites, 'niteroi').map((s) => s.id)).toEqual([1])
    expect(filterPopSites(sites, 'SAO leopoldo').map((s) => s.id)).toEqual([3])
  })
  it('sem resultado devolve lista vazia', () => {
    expect(filterPopSites(sites, 'zzz')).toEqual([])
  })
})
