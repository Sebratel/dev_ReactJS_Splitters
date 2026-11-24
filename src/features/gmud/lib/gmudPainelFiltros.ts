import { shortRequesterName } from '@/features/gmud/lib/gmudRequester'
import type { GmudSort, GmudSortKey } from '@/features/gmud/model/gmud'

/**
 * Filtros do painel de GMUDs: abas rápidas, construtor de filtros, canceladas ocultas, atalhos dos cartões,
 * ordenação e página. O estado mora na URL (query string), para compartilhar o link e voltar com o navegador.
 * Tudo função pura: ler a URL, escrever a URL, montar os parâmetros da API e os textos das etiquetas.
 */

export type GmudAba = 'todas' | 'minhas' | 'aguardando' | 'vencidas' | 'semana'
export type GmudSituacaoFiltro = 'aguardando' | 'liberada' | 'concluida' | 'encerrada' | 'negada' | 'cancelada'
export type GmudTipoSlug = 'emergencial' | 'programada' | 'pre_aprovada'
export type GmudOrigemSlug = 'plataforma' | 'legado'
export type GmudAberturaDias = 7 | 30 | 90
/** Atalhos dos cartões do topo que não são abas. */
export type GmudKpi = 'abertas' | 'vence7'
export type GmudCampoFiltro = 'situacao' | 'abertura' | 'tipo' | 'origem' | 'solicitante'

export type GmudPainelFiltros = {
  aba: GmudAba
  q: string
  situacao: GmudSituacaoFiltro[]
  abertura: GmudAberturaDias | null
  tipo: GmudTipoSlug[]
  /** Vazio (ou os dois) = todas as origens. Padrão: só a plataforma. */
  origem: GmudOrigemSlug[]
  solicitante: string[]
  /** Canceladas ficam ocultas por padrão; `true` mostra. */
  mostrarCanceladas: boolean
  kpi: GmudKpi | null
  sort: GmudSort
  /** Página, começando em 0. */
  pagina: number
}

export const ABAS: { key: GmudAba; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'minhas', label: 'Minhas' },
  { key: 'aguardando', label: 'Aguardando decisão' },
  { key: 'vencidas', label: 'Vencidas' },
  { key: 'semana', label: 'Esta semana' },
]
export const SITUACAO_OPCOES: { key: GmudSituacaoFiltro; label: string }[] = [
  { key: 'aguardando', label: 'Aguardando aprovação' },
  { key: 'liberada', label: 'Liberada' },
  { key: 'concluida', label: 'Concluída' },
  { key: 'encerrada', label: 'Encerrada' },
  { key: 'negada', label: 'Negada' },
  { key: 'cancelada', label: 'Cancelada' },
]
export const ABERTURA_OPCOES: { key: GmudAberturaDias; label: string }[] = [
  { key: 7, label: 'Últimos 7 dias' },
  { key: 30, label: 'Últimos 30 dias' },
  { key: 90, label: 'Últimos 90 dias' },
]
export const TIPO_OPCOES: { key: GmudTipoSlug; label: string }[] = [
  { key: 'emergencial', label: 'Emergencial' },
  { key: 'programada', label: 'Programada' },
  { key: 'pre_aprovada', label: 'Pré-aprovada' },
]
export const ORIGEM_OPCOES: { key: GmudOrigemSlug; label: string }[] = [
  { key: 'plataforma', label: 'Plataforma' },
  { key: 'legado', label: 'Legado' },
]
export const CAMPOS: { key: GmudCampoFiltro; label: string }[] = [
  { key: 'situacao', label: 'Situação' },
  { key: 'abertura', label: 'Abertura' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'origem', label: 'Origem' },
  { key: 'solicitante', label: 'Solicitante' },
]
const KPI_LABEL: Record<GmudKpi, string> = { abertas: 'Em aberto', vence7: 'Vencem em 7 dias' }

const SORT_PADRAO: GmudSort = { key: 'protocolo', dir: 'desc' }
const ORIGEM_PADRAO: GmudOrigemSlug[] = ['plataforma']
const SORT_KEYS: GmudSortKey[] = ['protocolo', 'solicitante', 'abertura', 'prazo', 'status']

export const FILTROS_PADRAO: GmudPainelFiltros = {
  aba: 'todas',
  q: '',
  situacao: [],
  abertura: null,
  tipo: [],
  origem: ORIGEM_PADRAO,
  solicitante: [],
  mostrarCanceladas: false,
  kpi: null,
  sort: SORT_PADRAO,
  pagina: 0,
}

const dentre = <T extends string>(valores: readonly string[], opcoes: readonly { key: T }[]): T[] =>
  opcoes.map((o) => o.key).filter((k) => valores.includes(k))
const csv = (valor: string | null) => (valor ?? '').split(',').map((v) => v.trim()).filter((v) => v !== '')

/** Lê os filtros da query string. Valor desconhecido é ignorado (vale o padrão). */
export function filtrosDaUrl(params: URLSearchParams): GmudPainelFiltros {
  const aba = ABAS.find((a) => a.key === params.get('aba'))?.key ?? 'todas'
  const abertura = ABERTURA_OPCOES.find((o) => String(o.key) === params.get('abertura'))?.key ?? null
  const origemRaw = params.get('origem')
  const origem = origemRaw === null ? ORIGEM_PADRAO : origemRaw === 'todas' ? [] : dentre(csv(origemRaw), ORIGEM_OPCOES)
  const kpi = params.get('kpi')
  const ord = params.get('ord')
  const pagina = Number.parseInt(params.get('p') ?? '', 10)
  return {
    aba,
    q: (params.get('q') ?? '').trim(),
    situacao: dentre(csv(params.get('situacao')), SITUACAO_OPCOES),
    abertura,
    tipo: dentre(csv(params.get('tipo')), TIPO_OPCOES),
    origem: origem.length === ORIGEM_OPCOES.length ? [] : origem,
    solicitante: [...new Set(params.getAll('solicitante').map((s) => s.trim()).filter((s) => s !== ''))],
    mostrarCanceladas: params.get('canceladas') === '1',
    kpi: kpi === 'abertas' || kpi === 'vence7' ? kpi : null,
    sort: SORT_KEYS.includes(ord as GmudSortKey) ? { key: ord as GmudSortKey, dir: params.get('dir') === 'asc' ? 'asc' : 'desc' } : SORT_PADRAO,
    pagina: Number.isInteger(pagina) && pagina > 1 ? pagina - 1 : 0,
  }
}

/** Escreve os filtros na query string: só o que difere do padrão (URL limpa quando não há filtro). */
export function filtrosParaUrl(f: GmudPainelFiltros): URLSearchParams {
  const p = new URLSearchParams()
  if (f.aba !== 'todas') p.set('aba', f.aba)
  if (f.q.trim() !== '') p.set('q', f.q.trim())
  if (f.situacao.length > 0) p.set('situacao', f.situacao.join(','))
  if (f.abertura !== null) p.set('abertura', String(f.abertura))
  if (f.tipo.length > 0) p.set('tipo', f.tipo.join(','))
  const todasOrigens = f.origem.length === 0 || f.origem.length === ORIGEM_OPCOES.length
  if (todasOrigens) p.set('origem', 'todas')
  else if (f.origem[0] !== 'plataforma') p.set('origem', f.origem[0] as string)
  for (const nome of f.solicitante) p.append('solicitante', nome)
  if (f.mostrarCanceladas) p.set('canceladas', '1')
  if (f.kpi) p.set('kpi', f.kpi)
  if (f.sort.key !== SORT_PADRAO.key || f.sort.dir !== SORT_PADRAO.dir) {
    p.set('ord', f.sort.key)
    p.set('dir', f.sort.dir)
  }
  if (f.pagina > 0) p.set('p', String(f.pagina + 1))
  return p
}

/** As canceladas estão ocultas? (Pedir a situação "Cancelada" mostra, mesmo sem clicar em "mostrar".) */
export function canceladasOcultas(f: GmudPainelFiltros): boolean {
  return !f.mostrarCanceladas && !f.situacao.includes('cancelada')
}

/** Parâmetros de filtro enviados a /api/gmud/list e /api/gmud/list-counts. */
export type GmudPainelApiParams = {
  q?: string
  aba?: Exclude<GmudAba, 'todas'>
  /** Filtro antigo dos cartões (o servidor continua aceitando). */
  filter?: 'abertas' | 'vencem_semana'
  situacao?: string
  aberturaDias?: string
  tipo?: string
  origem?: GmudOrigemSlug
  solicitante?: string[]
  ocultarCanceladas?: '1'
}

export function parametrosDaApi(f: GmudPainelFiltros): GmudPainelApiParams {
  const api: GmudPainelApiParams = {}
  if (f.q.trim() !== '') api.q = f.q.trim()
  if (f.aba !== 'todas') api.aba = f.aba
  if (f.kpi) api.filter = f.kpi === 'abertas' ? 'abertas' : 'vencem_semana'
  if (f.situacao.length > 0) api.situacao = f.situacao.join(',')
  if (f.abertura !== null) api.aberturaDias = String(f.abertura)
  if (f.tipo.length > 0) api.tipo = f.tipo.join(',')
  if (f.origem.length === 1) api.origem = f.origem[0]
  if (f.solicitante.length > 0) api.solicitante = f.solicitante
  if (canceladasOcultas(f)) api.ocultarCanceladas = '1'
  return api
}

/** Query string da API a partir dos parâmetros (o solicitante vai repetido, um por nome). */
export function queryDaApi(api: GmudPainelApiParams, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams(extra)
  for (const [chave, valor] of Object.entries(api)) {
    if (Array.isArray(valor)) for (const v of valor) qs.append(chave, v)
    else if (typeof valor === 'string') qs.set(chave, valor)
  }
  return qs.toString()
}

/** Liga ou desliga um valor numa lista, mantendo a ordem das opções. */
export function alternar<T>(lista: readonly T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]
}

/** Etiqueta de um filtro ativo: "Situação é um de Liberada, Negada". `campo` nulo = atalho de cartão. */
export type GmudEtiqueta = { id: string; campo: GmudCampoFiltro | null; rotulo: string; texto: string }

const rotulos = <T extends string | number>(valores: readonly T[], opcoes: readonly { key: T; label: string }[]) =>
  opcoes.filter((o) => valores.includes(o.key)).map((o) => o.label)
const eUmDe = (itens: string[]) => (itens.length === 1 ? `é ${itens[0]}` : `é um de ${itens.join(', ')}`)

export function etiquetasDosFiltros(f: GmudPainelFiltros): GmudEtiqueta[] {
  const etiquetas: GmudEtiqueta[] = []
  if (f.kpi) etiquetas.push({ id: 'kpi', campo: null, rotulo: 'Atalho', texto: KPI_LABEL[f.kpi] })
  if (f.situacao.length > 0) etiquetas.push({ id: 'situacao', campo: 'situacao', rotulo: 'Situação', texto: eUmDe(rotulos(f.situacao, SITUACAO_OPCOES)) })
  if (f.abertura !== null) etiquetas.push({ id: 'abertura', campo: 'abertura', rotulo: 'Abertura', texto: `nos últimos ${f.abertura} dias` })
  if (f.tipo.length > 0) etiquetas.push({ id: 'tipo', campo: 'tipo', rotulo: 'Tipo', texto: eUmDe(rotulos(f.tipo, TIPO_OPCOES)) })
  if (f.origem.length === 1) etiquetas.push({ id: 'origem', campo: 'origem', rotulo: 'Origem', texto: eUmDe(rotulos(f.origem, ORIGEM_OPCOES)) })
  if (f.solicitante.length > 0) etiquetas.push({ id: 'solicitante', campo: 'solicitante', rotulo: 'Solicitante', texto: eUmDe(f.solicitante.map((s) => shortRequesterName(s))) })
  return etiquetas
}

/** Tira um filtro (a etiqueta). Tirar a origem mostra todas as origens. */
export function removerFiltro(f: GmudPainelFiltros, id: string): GmudPainelFiltros {
  const base = { ...f, pagina: 0 }
  if (id === 'kpi') return { ...base, kpi: null }
  if (id === 'situacao') return { ...base, situacao: [] }
  if (id === 'abertura') return { ...base, abertura: null }
  if (id === 'tipo') return { ...base, tipo: [] }
  if (id === 'origem') return { ...base, origem: [] }
  if (id === 'solicitante') return { ...base, solicitante: [] }
  return f
}

const mesmaLista = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v) => b.includes(v))

/** Há algo para o "Limpar filtros" desfazer? (A aba e a ordenação não contam.) */
export function temFiltros(f: GmudPainelFiltros): boolean {
  return (
    f.q.trim() !== '' || f.situacao.length > 0 || f.abertura !== null || f.tipo.length > 0 || f.solicitante.length > 0 ||
    f.kpi !== null || f.mostrarCanceladas || !mesmaLista(f.origem, ORIGEM_PADRAO)
  )
}

/** "Limpar filtros": volta ao padrão (origem na plataforma, canceladas ocultas), mantendo a aba e a ordenação. */
export function limparFiltros(f: GmudPainelFiltros): GmudPainelFiltros {
  return { ...FILTROS_PADRAO, aba: f.aba, sort: f.sort }
}
