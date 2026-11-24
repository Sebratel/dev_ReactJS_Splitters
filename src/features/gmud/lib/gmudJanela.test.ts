import { describe, expect, it } from 'vitest'
import {
  aplicarMudancaNaJanela,
  datasDasOcorrencias,
  duracaoEmMinutos,
  formatarDiaCurto,
  formatarMomento,
  posicaoNaBarraDoDia,
  resumoDaJanela,
  rotuloDaDuracao,
  somarDuracao,
  viraODia,
  type GmudJanela,
} from '@/features/gmud/lib/gmudJanela'

const j = (dataInicio: string, horaInicio: string, dataFim: string, horaFim: string): GmudJanela => ({ dataInicio, horaInicio, dataFim, horaFim })

describe('duração da janela', () => {
  it('no mesmo dia, virando o dia, o mês e o ano', () => {
    expect(duracaoEmMinutos(j('2026-11-24', '22:00', '2026-11-24', '22:45'))).toBe(45)
    expect(duracaoEmMinutos(j('2026-11-24', '22:00', '2026-11-25', '01:00'))).toBe(180)
    expect(duracaoEmMinutos(j('2026-11-30', '23:00', '2026-12-01', '02:30'))).toBe(210)
    expect(duracaoEmMinutos(j('2026-12-31', '23:00', '2027-01-01', '01:00'))).toBe(120)
    expect(duracaoEmMinutos(j('2028-02-28', '12:00', '2028-03-01', '12:00'))).toBe(2 * 24 * 60) // ano bissexto
  })

  it('janela de vários dias', () => {
    expect(duracaoEmMinutos(j('2026-11-24', '08:00', '2026-11-27', '10:00'))).toBe(3 * 24 * 60 + 120)
  })

  it('fim antes ou igual ao início dá zero ou negativo; incompleta dá null', () => {
    expect(duracaoEmMinutos(j('2026-11-24', '22:00', '2026-11-24', '22:00'))).toBe(0)
    expect(duracaoEmMinutos(j('2026-11-24', '22:00', '2026-11-24', '20:00'))).toBe(-120)
    expect(duracaoEmMinutos(j('2026-11-24', '22:00', '2026-11-23', '23:00'))).toBeLessThan(0)
    expect(duracaoEmMinutos(j('2026-11-24', '', '2026-11-24', '23:00'))).toBeNull()
    expect(duracaoEmMinutos(j('', '22:00', '2026-11-24', '23:00'))).toBeNull()
    expect(duracaoEmMinutos(j('2026-11-24', '25:00', '2026-11-24', '23:00'))).toBeNull()
    expect(duracaoEmMinutos(j('24/11/2026', '22:00', '2026-11-24', '23:00'))).toBeNull()
  })

  it('rótulo: minutos, horas, horas e minutos, dias', () => {
    expect(rotuloDaDuracao(45)).toBe('45 min')
    expect(rotuloDaDuracao(180)).toBe('3 h')
    expect(rotuloDaDuracao(210)).toBe('3 h 30 min')
    expect(rotuloDaDuracao(26 * 60)).toBe('1 dia 2 h')
    expect(rotuloDaDuracao(2 * 24 * 60)).toBe('2 dias')
    expect(rotuloDaDuracao(24 * 60 + 5)).toBe('1 dia 5 min')
    expect(rotuloDaDuracao(3 * 24 * 60 + 150)).toBe('3 dias 2 h 30 min')
    expect(rotuloDaDuracao(0)).toBe('')
    expect(rotuloDaDuracao(-30)).toBe('')
  })
})

describe('somar duração ao início', () => {
  it('no mesmo dia e virando dia, mês e ano', () => {
    expect(somarDuracao('2026-11-24', '09:00', 60)).toEqual({ dataFim: '2026-11-24', horaFim: '10:00' })
    expect(somarDuracao('2026-11-24', '22:00', 180)).toEqual({ dataFim: '2026-11-25', horaFim: '01:00' })
    expect(somarDuracao('2026-11-30', '23:30', 60)).toEqual({ dataFim: '2026-12-01', horaFim: '00:30' })
    expect(somarDuracao('2026-12-31', '20:00', 480)).toEqual({ dataFim: '2027-01-01', horaFim: '04:00' })
    expect(somarDuracao('2026-02-28', '23:00', 120)).toEqual({ dataFim: '2026-03-01', horaFim: '01:00' })
  })
  it('sem início completo não calcula', () => {
    expect(somarDuracao('', '09:00', 60)).toBeNull()
    expect(somarDuracao('2026-11-24', '', 60)).toBeNull()
  })
})

describe('vira o dia e preenchimento inteligente', () => {
  it('viraODia: só quando o fim é em outro dia', () => {
    expect(viraODia({ dataInicio: '2026-11-24', dataFim: '2026-11-25' })).toBe(true)
    expect(viraODia({ dataInicio: '2026-11-24', dataFim: '2026-11-24' })).toBe(false)
    expect(viraODia({ dataInicio: '2026-11-24', dataFim: '' })).toBe(false)
  })

  it('escolher a data de início preenche a data de fim vazia ou anterior', () => {
    expect(aplicarMudancaNaJanela(j('', '', '', ''), 'dataInicio', '2026-11-24').dataFim).toBe('2026-11-24')
    expect(aplicarMudancaNaJanela(j('2026-11-20', '22:00', '2026-11-20', '23:00'), 'dataInicio', '2026-11-24').dataFim).toBe('2026-11-24')
  })

  it('não sobrescreve uma data de fim válida que a pessoa já escolheu', () => {
    expect(aplicarMudancaNaJanela(j('2026-11-20', '08:00', '2026-11-27', '10:00'), 'dataInicio', '2026-11-24').dataFim).toBe('2026-11-27')
  })

  it('mesmo dia com fim antes do início: assume o dia seguinte (inclusive na virada de mês e de ano)', () => {
    expect(aplicarMudancaNaJanela(j('2026-11-24', '22:00', '2026-11-24', ''), 'horaFim', '01:00')).toEqual(j('2026-11-24', '22:00', '2026-11-25', '01:00'))
    expect(aplicarMudancaNaJanela(j('2026-11-30', '', '2026-11-30', '01:00'), 'horaInicio', '22:00').dataFim).toBe('2026-12-01')
    expect(aplicarMudancaNaJanela(j('2026-12-30', '22:00', '2026-12-30', '01:00'), 'dataInicio', '2026-12-31').dataFim).toBe('2027-01-01')
  })

  it('horário igual ou fim depois do início não mexe na data', () => {
    expect(aplicarMudancaNaJanela(j('2026-11-24', '22:00', '2026-11-24', ''), 'horaFim', '23:00').dataFim).toBe('2026-11-24')
    expect(aplicarMudancaNaJanela(j('2026-11-24', '22:00', '2026-11-24', ''), 'horaFim', '22:00').dataFim).toBe('2026-11-24')
  })

  it('editar a data de fim à mão vale o que a pessoa escolheu (pode voltar para o mesmo dia)', () => {
    expect(aplicarMudancaNaJanela(j('2026-11-24', '22:00', '2026-11-25', '01:00'), 'dataFim', '2026-11-24')).toEqual(j('2026-11-24', '22:00', '2026-11-24', '01:00'))
    expect(aplicarMudancaNaJanela(j('2026-11-24', '22:00', '2026-11-25', '01:00'), 'dataFim', '2026-11-28').dataFim).toBe('2026-11-28')
  })
})

describe('textos', () => {
  it('momento com o dia da semana por extenso', () => {
    expect(formatarMomento('2026-11-24', '22:00')).toBe('Terça 24/11, 22:00')
    expect(formatarMomento('2027-01-01', '01:00')).toBe('Sexta 01/01, 01:00')
    expect(formatarMomento('', '22:00')).toBe('')
    expect(formatarMomento('2026-11-24', '')).toBe('')
    expect(formatarDiaCurto('2026-11-24')).toBe('Ter 24/11')
  })

  it('resumo: "Terça 24/11, 22:00 até quarta 25/11, 01:00"', () => {
    expect(resumoDaJanela(j('2026-11-24', '22:00', '2026-11-25', '01:00'))).toBe('Terça 24/11, 22:00 até quarta 25/11, 01:00')
    expect(resumoDaJanela(j('2026-11-28', '08:00', '2026-11-28', '12:00'))).toBe('Sábado 28/11, 08:00 até sábado 28/11, 12:00')
    expect(resumoDaJanela(j('2026-11-24', '22:00', '', ''))).toBe('')
  })
})

describe('barra do dia', () => {
  it('janela no mesmo dia', () => {
    expect(posicaoNaBarraDoDia(j('2026-11-24', '06:00', '2026-11-24', '12:00'))).toEqual({ inicioPct: 25, larguraPct: 25, continua: false })
    expect(posicaoNaBarraDoDia(j('2026-11-24', '00:00', '2026-11-25', '00:00'))).toEqual({ inicioPct: 0, larguraPct: 100, continua: false })
  })
  it('virando o dia vai até o fim da faixa e avisa que continua', () => {
    expect(posicaoNaBarraDoDia(j('2026-11-24', '22:00', '2026-11-25', '01:00'))).toEqual({ inicioPct: 91.67, larguraPct: 8.33, continua: true })
    expect(posicaoNaBarraDoDia(j('2026-12-31', '18:00', '2027-01-01', '06:00'))).toEqual({ inicioPct: 75, larguraPct: 25, continua: true })
  })
  it('não aparece para janela inválida, incompleta ou com mais de 2 dias', () => {
    expect(posicaoNaBarraDoDia(j('2026-11-24', '22:00', '2026-11-24', '20:00'))).toBeNull()
    expect(posicaoNaBarraDoDia(j('2026-11-24', '22:00', '', ''))).toBeNull()
    expect(posicaoNaBarraDoDia(j('2026-11-24', '08:00', '2026-11-26', '08:00'))).not.toBeNull() // exatamente 2 dias
    expect(posicaoNaBarraDoDia(j('2026-11-24', '08:00', '2026-11-26', '08:01'))).toBeNull()
  })
})

describe('prévia das ocorrências da Pré-aprovada', () => {
  it('desloca a data de início pelo intervalo, virando mês e ano', () => {
    expect(datasDasOcorrencias({ dataInicio: '2026-11-24', dataFim: '2026-11-25' }, { vezes: 4, intervaloDias: 15 })).toEqual([
      '2026-11-24', '2026-12-09', '2026-12-24', '2027-01-08',
    ])
    expect(datasDasOcorrencias({ dataInicio: '2026-11-24', dataFim: '' }, { vezes: 2, intervaloDias: 7 })).toEqual(['2026-11-24', '2026-12-01'])
  })
  it('sem repetição, sem data ou com repetição inválida não há prévia', () => {
    expect(datasDasOcorrencias({ dataInicio: '2026-11-24', dataFim: '2026-11-24' }, { vezes: 1, intervaloDias: 0 })).toEqual([])
    expect(datasDasOcorrencias({ dataInicio: '', dataFim: '' }, { vezes: 3, intervaloDias: 7 })).toEqual([])
    expect(datasDasOcorrencias({ dataInicio: '2026-11-24', dataFim: '2026-11-24' }, null)).toEqual([])
  })
})
