import { describe, expect, it } from 'vitest'
import {
  FILTROS_PADRAO,
  alternar,
  canceladasOcultas,
  etiquetasDosFiltros,
  filtrosDaUrl,
  filtrosParaUrl,
  limparFiltros,
  parametrosDaApi,
  queryDaApi,
  removerFiltro,
  temFiltros,
  type GmudPainelFiltros,
} from '@/features/gmud/lib/gmudPainelFiltros'

const url = (qs: string) => filtrosDaUrl(new URLSearchParams(qs))
const com = (over: Partial<GmudPainelFiltros>): GmudPainelFiltros => ({ ...FILTROS_PADRAO, ...over })

describe('filtros na URL', () => {
  it('URL vazia = padrão: aba Todas, origem na plataforma, canceladas ocultas', () => {
    expect(url('')).toEqual(FILTROS_PADRAO)
    expect(FILTROS_PADRAO.origem).toEqual(['plataforma'])
    expect(canceladasOcultas(FILTROS_PADRAO)).toBe(true)
    expect(filtrosParaUrl(FILTROS_PADRAO).toString()).toBe('')
  })

  it('lê todos os filtros', () => {
    expect(url('aba=vencidas&q=olt&situacao=liberada,negada&abertura=30&tipo=emergencial,pre_aprovada&origem=legado&solicitante=ANA+SOUZA&solicitante=BRUNO%2C+DA+SILVA&canceladas=1&kpi=vence7&ord=prazo&dir=asc&p=3')).toEqual({
      aba: 'vencidas',
      q: 'olt',
      situacao: ['liberada', 'negada'],
      abertura: 30,
      tipo: ['emergencial', 'pre_aprovada'],
      origem: ['legado'],
      solicitante: ['ANA SOUZA', 'BRUNO, DA SILVA'],
      mostrarCanceladas: true,
      kpi: 'vence7',
      sort: { key: 'prazo', dir: 'asc' },
      pagina: 2,
    })
  })

  it('valores desconhecidos são ignorados', () => {
    expect(url('aba=equipe&situacao=liberada,xyz&abertura=45&tipo=outro&origem=marte&kpi=tudo&ord=senha&p=-4&canceladas=sim')).toEqual({
      ...FILTROS_PADRAO,
      situacao: ['liberada'],
      origem: [],
    })
  })

  it('origem: ausente = plataforma; "todas" ou as duas = sem filtro', () => {
    expect(url('').origem).toEqual(['plataforma'])
    expect(url('origem=todas').origem).toEqual([])
    expect(url('origem=plataforma,legado').origem).toEqual([])
    expect(url('origem=legado').origem).toEqual(['legado'])
    expect(filtrosParaUrl(com({ origem: [] })).toString()).toBe('origem=todas')
    expect(filtrosParaUrl(com({ origem: ['plataforma', 'legado'] })).toString()).toBe('origem=todas')
    expect(filtrosParaUrl(com({ origem: ['legado'] })).toString()).toBe('origem=legado')
  })

  it('ida e volta: escrever e ler devolve o mesmo estado', () => {
    const estados = [
      FILTROS_PADRAO,
      com({ aba: 'semana', q: 'pop centro', pagina: 4 }),
      com({ situacao: ['aguardando', 'cancelada'], abertura: 7, tipo: ['programada'], origem: [], solicitante: ['ANA SOUZA', 'BRUNO, DA SILVA'] }),
      com({ kpi: 'abertas', mostrarCanceladas: true, sort: { key: 'solicitante', dir: 'asc' } }),
      com({ origem: ['legado'], sort: { key: 'abertura', dir: 'desc' } }),
    ]
    for (const estado of estados) expect(filtrosDaUrl(filtrosParaUrl(estado))).toEqual(estado)
  })
})

describe('parâmetros da API', () => {
  it('padrão: só a plataforma e sem as canceladas', () => {
    expect(parametrosDaApi(FILTROS_PADRAO)).toEqual({ origem: 'plataforma', ocultarCanceladas: '1' })
  })

  it('manda cada filtro; atalho de cartão vira o filter antigo', () => {
    expect(
      parametrosDaApi(com({ aba: 'minhas', q: ' olt ', situacao: ['liberada', 'negada'], abertura: 90, tipo: ['emergencial', 'programada'], origem: [], solicitante: ['ANA'], kpi: 'vence7' })),
    ).toEqual({ q: 'olt', aba: 'minhas', filter: 'vencem_semana', situacao: 'liberada,negada', aberturaDias: '90', tipo: 'emergencial,programada', solicitante: ['ANA'], ocultarCanceladas: '1' })
    expect(parametrosDaApi(com({ kpi: 'abertas' })).filter).toBe('abertas')
  })

  it('canceladas aparecem com "mostrar" ou quando a situação pede Cancelada', () => {
    expect(parametrosDaApi(com({ mostrarCanceladas: true })).ocultarCanceladas).toBeUndefined()
    expect(parametrosDaApi(com({ situacao: ['cancelada'] })).ocultarCanceladas).toBeUndefined()
    expect(canceladasOcultas(com({ situacao: ['liberada'] }))).toBe(true)
  })

  it('query string: solicitante repetido, um por nome (nome com vírgula não quebra)', () => {
    const qs = new URLSearchParams(queryDaApi({ tipo: 'programada', solicitante: ['ANA SOUZA', 'BRUNO, DA SILVA'] }, { limit: '20' }))
    expect(qs.get('limit')).toBe('20')
    expect(qs.get('tipo')).toBe('programada')
    expect(qs.getAll('solicitante')).toEqual(['ANA SOUZA', 'BRUNO, DA SILVA'])
  })
})

describe('etiquetas e limpar', () => {
  it('texto das etiquetas: "é" para um valor, "é um de" para vários', () => {
    expect(etiquetasDosFiltros(FILTROS_PADRAO)).toEqual([{ id: 'origem', campo: 'origem', rotulo: 'Origem', texto: 'é Plataforma' }])
    const etiquetas = etiquetasDosFiltros(
      com({ situacao: ['negada', 'liberada'], abertura: 30, tipo: ['pre_aprovada'], origem: [], solicitante: ['ANA PAULA SOUZA', 'BRUNO DA SILVA'], kpi: 'abertas' }),
    )
    expect(etiquetas.map((e) => `${e.rotulo} ${e.texto}`)).toEqual([
      'Atalho Em aberto',
      'Situação é um de Liberada, Negada', // na ordem das opções
      'Abertura nos últimos 30 dias',
      'Tipo é Pré-aprovada',
      'Solicitante é um de Ana Souza, Bruno Silva',
    ])
    expect(etiquetas[0]?.campo).toBeNull()
  })

  it('remover uma etiqueta tira só aquele filtro e volta para a primeira página', () => {
    const f = com({ situacao: ['liberada'], tipo: ['programada'], pagina: 3 })
    expect(removerFiltro(f, 'situacao')).toEqual({ ...f, situacao: [], pagina: 0 })
    expect(removerFiltro(f, 'origem').origem).toEqual([])
    expect(removerFiltro(com({ kpi: 'abertas' }), 'kpi').kpi).toBeNull()
    expect(removerFiltro(f, 'nada')).toBe(f)
  })

  it('temFiltros: a aba e a ordenação não contam; origem fora do padrão conta', () => {
    expect(temFiltros(FILTROS_PADRAO)).toBe(false)
    expect(temFiltros(com({ aba: 'minhas', sort: { key: 'prazo', dir: 'asc' }, pagina: 2 }))).toBe(false)
    for (const over of [{ q: 'x' }, { situacao: ['liberada' as const] }, { abertura: 7 as const }, { tipo: ['programada' as const] }, { solicitante: ['ANA'] }, { kpi: 'abertas' as const }, { mostrarCanceladas: true }, { origem: [] }, { origem: ['legado' as const] }]) {
      expect(temFiltros(com(over))).toBe(true)
    }
  })

  it('limpar volta ao padrão, mantendo a aba e a ordenação', () => {
    const f = com({ aba: 'vencidas', q: 'x', situacao: ['cancelada'], origem: [], kpi: 'abertas', mostrarCanceladas: true, pagina: 5, sort: { key: 'prazo', dir: 'asc' } })
    expect(limparFiltros(f)).toEqual({ ...FILTROS_PADRAO, aba: 'vencidas', sort: { key: 'prazo', dir: 'asc' } })
  })

  it('alternar liga e desliga um valor', () => {
    expect(alternar(['a'], 'b')).toEqual(['a', 'b'])
    expect(alternar(['a', 'b'], 'a')).toEqual(['b'])
  })
})
