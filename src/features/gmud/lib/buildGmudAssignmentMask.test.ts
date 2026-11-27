import { describe, expect, it } from 'vitest'
import { buildGmudDescription } from '@/features/gmud/lib/buildGmudAssignmentMask'
import { emptyGmudForm, emptyGmudSistemasExternosData, emptyGmudSistemasInternosData } from '@/features/gmud/model/gmudForm'

describe('relato da GMUD no protocolo', () => {
  const base = {
    ...emptyGmudForm('bruno@x.com', 'Bruno'),
    tipo: 'Pré-aprovada',
    popSite: 'NHOPN',
    dataInicio: '2026-12-09',
    horaInicio: '17:20',
    dataFim: '2026-12-10',
    horaFim: '18:20',
    descricao: 'Teste',
    planoExecucao: 'Passo 1',
    planoRollback: 'Voltar',
    riscoNaoImplementacao: 'Não!',
    riscoExecucao: 'Baixo',
  }

  it('Rede Externa: resumo no topo, detalhes e seções com emoji', () => {
    const t = buildGmudDescription({ ...base, impactoParada: 'Não', categoria: 'rede_externa' })
    const linhas = t.split('\n')
    expect(linhas[0]).toBe('🛠️ GMUD PRÉ-APROVADA · NHOPN')
    expect(linhas[1]).toBe('🕐 Quando: 09/12/2026 17:20 → 10/12/2026 18:20')
    expect(linhas[2]).toBe('🟢 Impacto: SEM PARADA DE SERVIÇO')
    expect(t).toContain('──────── DETALHES ────────')
    expect(t).toContain('📝 DESCRIÇÃO\nTeste')
    expect(t).toContain('⚙️ EXECUÇÃO\nPasso 1')
    expect(t).toContain('↩️ ROLLBACK\nVoltar')
    expect(t).toContain('⚠️ RISCOS\nSe não for feita: Não!\nDurante a execução: Baixo')
    expect(t).not.toContain('>>')
  })

  it('Rede Externa: clientes impactados aparecem no resumo, logo abaixo do impacto', () => {
    const t = buildGmudDescription({ ...base, impactoParada: 'Não', categoria: 'rede_externa' }, null, null, { total: 2116, corporativos: 24 })
    const linhas = t.split('\n')
    expect(linhas[2]).toBe('🟢 Impacto: SEM PARADA DE SERVIÇO')
    expect(linhas[3]).toBe('👥 Clientes impactados: 2.116 (2.092 residenciais · 24 corporativos)')
  })

  it('sem corporativos não mostra a divisão; sem estimativa a linha some', () => {
    const f = { ...base, impactoParada: 'Não' as const, categoria: 'rede_externa' as const }
    expect(buildGmudDescription(f, null, null, { total: 10, corporativos: 0 })).toContain('👥 Clientes impactados: 10\n')
    expect(buildGmudDescription(f, null, null, null)).not.toContain('Clientes impactados')
    expect(buildGmudDescription(f, null, null, { total: 0, corporativos: 0 })).not.toContain('Clientes impactados')
  })

  it('categorias sem clientes ignoram a estimativa', () => {
    const t = buildGmudDescription(
      { ...base, categoria: 'sistemas_internos' },
      emptyGmudSistemasInternosData(),
      null,
      { total: 50, corporativos: 1 },
    )
    expect(t).not.toContain('Clientes impactados')
  })

  it('impacto com parada fica vermelho', () => {
    const t = buildGmudDescription({ ...base, impactoParada: 'Sim', categoria: 'rede_externa' })
    expect(t).toContain('🔴 Impacto: COM PARADA DE SERVIÇO')
  })

  it('valor investido entra no relato quando preenchido e some quando vazio', () => {
    for (const categoria of ['rede_externa', 'sistemas_internos', 'sistemas_externos'] as const) {
      const com = buildGmudDescription({ ...base, valorInvestido: '1.234,56', categoria })
      expect(com).toContain('Valor investido: R$ 1.234,56')
      const sem = buildGmudDescription({ ...base, valorInvestido: '', categoria })
      expect(sem).not.toContain('Valor investido')
    }
  })

  it('seção vazia não aparece', () => {
    const t = buildGmudDescription({ ...base, observacoes: '', categoria: 'rede_externa' })
    expect(t).not.toContain('OBSERVAÇÕES')
  })

  it('Sistemas Internos e Externos seguem o mesmo formato', () => {
    const si = { ...emptyGmudSistemasInternosData(), sistemaAfetado: 'ERP' }
    const ti = buildGmudDescription({ ...base, categoria: 'sistemas_internos', impactoParada: 'Não' }, si)
    expect(ti.split('\n')[0]).toBe('🛠️ GMUD PRÉ-APROVADA · SISTEMAS INTERNOS')
    expect(ti).toContain('💻 Sistema: ERP')
    const se = { ...emptyGmudSistemasExternosData(), sistemaExterno: 'Voalle', fornecedor: 'Fornecedor X' }
    const te = buildGmudDescription({ ...base, categoria: 'sistemas_externos', impactoParada: 'Sim' }, null, se)
    expect(te).toContain('🌐 Sistema: Voalle (Fornecedor X)')
    expect(te).toContain('🔴 Impacto')
  })
})
