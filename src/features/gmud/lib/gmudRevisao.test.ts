import { describe, expect, it } from 'vitest'
import {
  LIMITE_HORAS_JANELA_PROXIMA,
  areasMarcadasNaGmud,
  minutosAteOInicio,
  motivosDeAtencao,
  numeroDeProtocolos,
  passosAoAbrirGmud,
  precisaConfirmarAbertura,
  quemAprovaAGmud,
  textoDoBotaoAbrir,
} from '@/features/gmud/lib/gmudRevisao'

const MATRIZ = { NOC: 'executor', Engenharia: 'validador', Comercial: 'observador', Financeiro: 'na' }
const TIPOS = ['Programada', 'Emergencial', 'Pré-aprovada'] as const
const CATEGORIAS = ['rede_externa', 'sistemas_internos', 'sistemas_externos'] as const

describe('áreas marcadas (espelho de deriveNotificationAreas do servidor)', () => {
  it('rede externa: só a matriz, sem N/A', () => {
    expect(areasMarcadasNaGmud({ categoria: 'rede_externa', recursosAdministrativos: MATRIZ, areasImpactadas: ['TI'], areasAfetadas: ['RH'] })).toEqual([
      'NOC', 'Engenharia', 'Comercial',
    ])
  })
  it('sistemas internos: áreas impactadas + matriz', () => {
    expect(areasMarcadasNaGmud({ categoria: 'sistemas_internos', areasImpactadas: ['TI', 'NOC'], areasAfetadas: ['RH'], recursosAdministrativos: MATRIZ })).toEqual([
      'TI', 'NOC', 'Engenharia', 'Comercial',
    ])
  })
  it('sistemas externos: áreas afetadas + matriz', () => {
    expect(areasMarcadasNaGmud({ categoria: 'sistemas_externos', areasImpactadas: ['TI'], areasAfetadas: ['RH'], recursosAdministrativos: MATRIZ })).toEqual([
      'RH', 'NOC', 'Engenharia', 'Comercial',
    ])
  })
  it('tira repetidas, vazias e espaços; aguenta dados ausentes', () => {
    expect(areasMarcadasNaGmud({ categoria: 'sistemas_internos', areasImpactadas: [' TI ', '', 'TI'], recursosAdministrativos: { TI: 'executor' } })).toEqual(['TI'])
    expect(areasMarcadasNaGmud({ categoria: 'rede_externa' })).toEqual([])
    expect(areasMarcadasNaGmud({ categoria: 'rede_externa', recursosAdministrativos: null })).toEqual([])
  })
})

describe('quem aprova, por tipo e categoria', () => {
  const dados = { areasImpactadas: ['TI'], areasAfetadas: ['RH'], recursosAdministrativos: MATRIZ }
  const marcadas = { rede_externa: ['NOC', 'Engenharia', 'Comercial'], sistemas_internos: ['TI', 'NOC', 'Engenharia', 'Comercial'], sistemas_externos: ['RH', 'NOC', 'Engenharia', 'Comercial'] }

  for (const categoria of CATEGORIAS) {
    it(`${categoria}: Programada = Comitê + áreas marcadas`, () => {
      expect(quemAprovaAGmud({ tipo: 'Programada', categoria, ...dados })).toEqual({ comite: true, areasQueAprovam: marcadas[categoria], areasSoAvisadas: [] })
    })
    it(`${categoria}: Emergencial = só o Comitê; áreas só avisadas`, () => {
      expect(quemAprovaAGmud({ tipo: 'Emergencial', categoria, ...dados })).toEqual({ comite: true, areasQueAprovam: [], areasSoAvisadas: marcadas[categoria] })
    })
    it(`${categoria}: Pré-aprovada = ninguém aprova; áreas só avisadas`, () => {
      expect(quemAprovaAGmud({ tipo: 'Pré-aprovada', categoria, ...dados })).toEqual({ comite: false, areasQueAprovam: [], areasSoAvisadas: marcadas[categoria] })
    })
  }

  it('Programada sem área marcada: só o Comitê', () => {
    expect(quemAprovaAGmud({ tipo: 'Programada', categoria: 'rede_externa' })).toEqual({ comite: true, areasQueAprovam: [], areasSoAvisadas: [] })
  })
})

describe('protocolos, botão e confirmação', () => {
  it('só a Pré-aprovada com repetição válida abre mais de um', () => {
    expect(numeroDeProtocolos('Pré-aprovada', '4', '15')).toBe(4)
    expect(numeroDeProtocolos('Pré-aprovada', '1', '')).toBe(1)
    expect(numeroDeProtocolos('Pré-aprovada', '4', '')).toBe(1) // repetição inválida: a pendência cuida disso
    expect(numeroDeProtocolos('Pré-aprovada', '99', '7')).toBe(1)
    expect(numeroDeProtocolos('Programada', '4', '15')).toBe(1)
    expect(numeroDeProtocolos('Emergencial', '4', '15')).toBe(1)
  })
  it('texto do botão diz a consequência', () => {
    expect(textoDoBotaoAbrir(1)).toBe('Abrir GMUD no Elleven')
    expect(textoDoBotaoAbrir(4)).toBe('Abrir 4 protocolos no Elleven')
  })
  it('confirmação só para Emergencial e Pré-aprovada com mais de um protocolo', () => {
    expect(precisaConfirmarAbertura('Emergencial', 1)).toBe(true)
    expect(precisaConfirmarAbertura('Pré-aprovada', 3)).toBe(true)
    expect(precisaConfirmarAbertura('Pré-aprovada', 1)).toBe(false)
    expect(precisaConfirmarAbertura('Programada', 1)).toBe(false)
    expect(precisaConfirmarAbertura('', 1)).toBe(false)
  })
})

describe('o que acontece ao abrir, por tipo e categoria', () => {
  for (const tipo of TIPOS) {
    it(`${tipo}: o passo dos clientes e do COR só existe na rede externa`, () => {
      const rede = passosAoAbrirGmud({ tipo, categoria: 'rede_externa', protocolos: 1 })
      expect(rede).toHaveLength(3)
      expect(rede[2]).toMatch(/clientes afetados.*COR.*quando essas rotinas estão ativadas/)
      for (const categoria of ['sistemas_internos', 'sistemas_externos']) {
        const passos = passosAoAbrirGmud({ tipo, categoria, protocolos: 1 })
        expect(passos).toHaveLength(2)
        expect(passos.join(' ')).not.toMatch(/clientes|COR/)
      }
    })
  }
  it('Programada: Comitê e áreas em paralelo', () => {
    const [um, dois] = passosAoAbrirGmud({ tipo: 'Programada', categoria: 'sistemas_internos', protocolos: 1 })
    expect(um).toBe('Abre o protocolo no Elleven e registra a GMUD na plataforma.')
    expect(dois).toMatch(/Comitê e as áreas.*em paralelo.*só é liberada quando todos aprovarem/)
  })
  it('Emergencial: só o Comitê decide', () => {
    expect(passosAoAbrirGmud({ tipo: 'Emergencial', categoria: 'sistemas_externos', protocolos: 1 })[1]).toMatch(/Só o Comitê decide.*só recebem um e-mail/)
  })
  it('Pré-aprovada: N protocolos numerados, já liberados', () => {
    const [um, dois] = passosAoAbrirGmud({ tipo: 'Pré-aprovada', categoria: 'sistemas_internos', protocolos: 4 })
    expect(um).toMatch(/Abre 4 protocolos no Elleven agora.*\(1\/4\) a \(4\/4\)/)
    expect(dois).toMatch(/já ficam liberados, sem aprovação/)
    expect(passosAoAbrirGmud({ tipo: 'Pré-aprovada', categoria: 'sistemas_internos', protocolos: 1 })[1]).toMatch(/já fica liberada, sem aprovação/)
  })
})

describe('atenção antes de abrir', () => {
  const agora = new Date(2026, 10, 20, 10, 0) // 20/11/2026 10:00, hora local
  const longe = { dataInicio: '2026-12-01', horaInicio: '22:00' }
  const base = { tipo: 'Programada', impactoParada: 'Não', janela: longe, protocolos: 1, agora }

  it('sem nenhum caso, não há aviso', () => {
    expect(motivosDeAtencao(base)).toEqual([])
    expect(motivosDeAtencao({ ...base, janela: { dataInicio: '', horaInicio: '' } })).toEqual([])
  })
  it('parada de serviço', () => {
    expect(motivosDeAtencao({ ...base, impactoParada: 'Sim' })).toEqual(['Há parada do serviço durante a execução.'])
  })
  it('janela próxima: menos de 48 horas (limite isolado na constante)', () => {
    expect(LIMITE_HORAS_JANELA_PROXIMA).toBe(48)
    expect(minutosAteOInicio({ dataInicio: '2026-11-22', horaInicio: '10:00' }, agora)).toBe(48 * 60)
    expect(motivosDeAtencao({ ...base, janela: { dataInicio: '2026-11-22', horaInicio: '10:00' } })).toEqual([]) // exatamente 48 h
    expect(motivosDeAtencao({ ...base, janela: { dataInicio: '2026-11-22', horaInicio: '09:59' } })).toEqual(['A janela começa em menos de 48 horas.'])
    expect(motivosDeAtencao({ ...base, janela: { dataInicio: '2026-11-20', horaInicio: '09:00' } })).toEqual(['O início da janela já passou.'])
  })
  it('emergencial e pré-aprovada com repetição', () => {
    expect(motivosDeAtencao({ ...base, tipo: 'Emergencial' })).toEqual(['É uma GMUD emergencial: só o Comitê decide.'])
    expect(motivosDeAtencao({ ...base, tipo: 'Pré-aprovada', protocolos: 4 })).toEqual(['Serão abertos 4 protocolos agora, já liberados.'])
    expect(motivosDeAtencao({ ...base, tipo: 'Pré-aprovada', protocolos: 1 })).toEqual([])
  })
  it('vários motivos, um por linha', () => {
    expect(motivosDeAtencao({ tipo: 'Emergencial', impactoParada: 'Sim', janela: { dataInicio: '2026-11-20', horaInicio: '23:00' }, protocolos: 1, agora })).toEqual([
      'Há parada do serviço durante a execução.',
      'A janela começa em menos de 48 horas.',
      'É uma GMUD emergencial: só o Comitê decide.',
    ])
  })
})
