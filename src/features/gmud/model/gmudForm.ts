import { normalizeEscopoRotas, type GmudEscopoRede } from '@/features/gmud/model/gmudEscopoRede'
import { parseRepeticao, type GmudSerie } from '@/features/gmud/lib/gmudRecurrence'

/** Opções do formulário de GMUD (espelham o Google Form atual). */

export const GMUD_TIPO_OPTIONS = ['Programada', 'Emergencial', 'Pré-aprovada'] as const

/**
 * Pré-aprovada: mesmo formulário da Rede Externa, sem aprovação (do Comitê nem das áreas) — o protocolo já nasce
 * liberado. Pode ser aberta repetida (a cada N dias, M vezes): cada ocorrência vira uma GMUD independente.
 * Só para Rede Externa.
 */
export const GMUD_TIPO_PRE_APROVADA = 'Pré-aprovada' as const

// ---------------------------------------------------------------------------
// CATEGORIA (área afetada) — selector principal do formulário dinâmico
// ---------------------------------------------------------------------------

export type GmudCategoria = 'rede_externa' | 'sistemas_internos' | 'sistemas_externos'

export const GMUD_CATEGORIA_LABEL: Record<GmudCategoria, string> = {
  rede_externa: 'Rede externa',
  sistemas_internos: 'Sistemas internos',
  sistemas_externos: 'Sistemas externos',
}

// ---------------------------------------------------------------------------
// NATUREZA DA MUDANÇA — específica por categoria
// ---------------------------------------------------------------------------

/** Natureza da mudança para Rede Externa (persiste no campo `assunto` — retrocompat). */
export const GMUD_NATUREZA_RE_OPTIONS = [
  'Alteração de infraestrutura',
  'Manutenção programada',
  'Substituição de equipamento',
  'Atualização de firmware/sistema',
  'Mudança emergencial',
  'Outros',
] as const

export const GMUD_NATUREZA_SI_OPTIONS = [
  'Atualização de sistema',
  'Implantação de funcionalidade',
  'Correção técnica',
  'Manutenção programada',
  'Mudança emergencial',
  'Outros',
] as const

export const GMUD_NATUREZA_SE_OPTIONS = [
  'Manutenção programada do fornecedor',
  'Atualização de sistema do fornecedor',
  'Migração de dados/infraestrutura',
  'Alteração de integração',
  'Mudança emergencial',
  'Outros',
] as const

/**
 * Mantido para compatibilidade de exibição de registros antigos — o campo `assunto` do DB
 * pode conter qualquer um desses valores históricos. Novos registros usam GMUD_NATUREZA_RE_OPTIONS.
 */
export const GMUD_ASSUNTO_OPTIONS = [
  'Rede externa',
  'Sistemas internos',
  'Manutenção/atualização com indisponibilidade temporária',
  'Outros motivos internos',
] as const

// ---------------------------------------------------------------------------
// CATÁLOGOS DE SISTEMAS
// ---------------------------------------------------------------------------

export const GMUD_SISTEMAS_INTERNOS_OPTIONS = [
  'Sebratel Hub Apps',
  'Monitoramento Splitters',
  'CRM Comercial',
  'Outro (especificar)',
] as const

export const GMUD_SISTEMAS_EXTERNOS_OPTIONS = [
  'Voalle/Elleven',
  'GeoGrid',
  'Native',
  'Matrix',
  'Outro (especificar)',
] as const

export const GMUD_AMBIENTE_SI_OPTIONS = ['Produção', 'Homologação', 'Desenvolvimento'] as const
export const GMUD_TIPO_INDISPONIBILIDADE_OPTIONS = ['Parcial', 'Total'] as const

// ---------------------------------------------------------------------------
// TIPOS DE DADOS POR CATEGORIA
// ---------------------------------------------------------------------------

/** Campos específicos de Sistemas Internos — persistidos como JSON em `categoria_data`. */
export type GmudSistemasInternosData = {
  sistemaAfetado: string
  sistemaAfetadoOutro: string
  ambiente: string
  natureza: string
  tipoIndisponibilidade: string
  duracaoEstimada: string
  areasImpactadas: string[]
}

/** Campos específicos de Sistemas Externos — persistidos como JSON em `categoria_data`. */
export type GmudSistemasExternosData = {
  sistemaExterno: string
  sistemaExternoOutro: string
  fornecedor: string
  natureza: string
  tipoIndisponibilidade: string
  duracaoEstimada: string
  areasAfetadas: string[]
  chamadoFornecedor: string
}

/** Tamanho máximo do texto de clientes ponto a ponto / fibra apagada. */
export const GMUD_CLIENTES_MANUAIS_MAX = 2000

/** Impacto de parada e abrangência da Rede Externa — persistido como JSON em `categoria_data`. */
export type GmudRedeExternaImpactoData = {
  tipoIndisponibilidade: string
  duracaoEstimada: string
  /** Abrangência em rotas (ponto de acesso/slot/PON/splitter) dentro do POP/Site; ausente = site inteiro. */
  escopoRotas?: GmudEscopoRede[]
  /** Clientes corporativos ponto a ponto e de fibra apagada, informados à mão (o sistema não os localiza). */
  clientesManuais?: string
  /** GMUDs antigas: um único afunilamento (lido como uma rota). */
  escopoRede?: GmudEscopoRede
  /** Pré-aprovada repetida: ligação informativa entre as ocorrências da série. */
  serie?: GmudSerie
}

/** Dados de impacto da Rede Externa para gravar; null quando não há impacto ou nada foi informado. */
export function redeExternaImpactoData(form: Pick<GmudFormState, 'impactoParada' | 'tipoIndisponibilidade' | 'duracaoEstimada'>): GmudRedeExternaImpactoData | null {
  if (form.impactoParada !== 'Sim') return null
  const tipo = (form.tipoIndisponibilidade ?? '').trim()
  const duracao = (form.duracaoEstimada ?? '').trim()
  return tipo === '' && duracao === '' ? null : { tipoIndisponibilidade: tipo, duracaoEstimada: duracao }
}

/** `categoria_data` da Rede Externa: impacto de parada + afunilamento na rede; null quando não há nenhum. */
export function redeExternaCategoriaData(
  form: Pick<GmudFormState, 'impactoParada' | 'tipoIndisponibilidade' | 'duracaoEstimada' | 'escopoRotas' | 'clientesManuais'>,
): GmudRedeExternaImpactoData | null {
  const impacto = redeExternaImpactoData(form)
  const rotas = normalizeEscopoRotas(form.escopoRotas)
  const manuais = (form.clientesManuais ?? '').trim().slice(0, GMUD_CLIENTES_MANUAIS_MAX)
  if (!impacto && rotas.length === 0 && manuais === '') return null
  return {
    tipoIndisponibilidade: impacto?.tipoIndisponibilidade ?? '',
    duracaoEstimada: impacto?.duracaoEstimada ?? '',
    ...(rotas.length > 0 ? { escopoRotas: rotas } : {}),
    ...(manuais !== '' ? { clientesManuais: manuais } : {}),
  }
}

// ---------------------------------------------------------------------------
// CAMPOS COMPARTILHADOS (Rede Externa — preservados integralmente)
// ---------------------------------------------------------------------------

export const GMUD_AREA_OPTIONS = [
  'Oper/Infra',
  'Oper/Reparo',
  'T&TI/CGR',
  'T&TI/COR',
  'T&TI/Suporte',
  'T&TI/TI-Dev',
  'T&TI/TI-Infra',
  'Dir/Projetos',
] as const

export const GMUD_AMBIENTE_OPTIONS = [
  'Backbone físico/troca de cabo/rotas',
  'Backbone IP/Roteamento/BGP',
  'Rede de acesso/OLTs',
  'Infraestrutura de Site/elétrica/ar/civil',
  'Serviço: Telefonia interna/clientes',
  'Serviço: Voalle/upgrade/update de base',
  'Sistemas: Geogrid',
  'Sistemas: APPs',
] as const

export const GMUD_SIM_NAO = ['Sim', 'Não'] as const
export const GMUD_LISTA_COR = ['Sim', 'Não', 'N/A'] as const

/** Linhas da matriz "Recursos administrativos" (área → papel). */
export const GMUD_RECURSO_AREAS = [
  'Oper/Reparo',
  'Oper/Infra',
  'T&TI/COR',
  'T&TI/CGR',
  'T&TI/Suporte',
  'T&TI/TI-Dev',
  'T&TI/TI-Infra',
  'Dir/Projetos',
] as const

export type GmudRecursoPapel = 'na' | 'executor' | 'validador' | 'observador'
export const GMUD_RECURSO_PAPEIS: { value: GmudRecursoPapel; label: string }[] = [
  { value: 'na', label: 'N/A' },
  { value: 'executor', label: 'Executor' },
  { value: 'validador', label: 'Validador' },
  { value: 'observador', label: 'Observador' },
]

// ---------------------------------------------------------------------------
// ESTADO DO FORMULÁRIO
// ---------------------------------------------------------------------------

export type GmudFormState = {
  // Selector de categoria — o campo que guia todo o formulário dinâmico
  categoria: GmudCategoria
  voalleProtocol: string
  tipo: string
  /** Pré-aprovada: quantos protocolos abrir (1 = sem repetição). Texto, como o campo da tela. */
  repeticaoVezes: string
  /** Pré-aprovada: intervalo em dias entre as ocorrências. */
  repeticaoIntervaloDias: string
  /**
   * Para Rede Externa: natureza da mudança (persiste no DB como `assunto` para retrocompat).
   * Para Sistemas Internos/Externos: vazio (natureza fica em categoriaData.natureza).
   */
  assunto: string
  titulo: string
  descricao: string
  popSite: string
  /** Rede Externa: afunilamento opcional dentro do POP/Site (ponto de acesso, slot, PON, splitter). */
  escopoRotas: GmudEscopoRede[]
  solicitanteNome: string
  solicitanteEmail: string
  areaSolicitante: string
  riscoNaoImplementacao: string
  ambienteAfetado: string[]
  comunicaCliente: string
  /** Texto livre; só Rede Externa. */
  clientesManuais: string
  impactoParada: string
  /** Rede Externa, quando há impacto de parada: 'Parcial' | 'Total'. Persistido em `categoria_data`. */
  tipoIndisponibilidade: string
  /** Rede Externa, quando há impacto de parada: tempo estimado de indisponibilidade (texto livre). */
  duracaoEstimada: string
  planoExecucao: string
  riscoExecucao: string
  recursosAdministrativos: Record<string, GmudRecursoPapel>
  planoRollback: string
  dataInicio: string
  horaInicio: string
  dataFim: string
  horaFim: string
  listaClientesCor: string
  /** Texto livre do "Outro" em Ambiente afetado. */
  ambienteOutro: string
  /** Observações livres — entram na máscara do protocolo no Elleven. */
  observacoes: string
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Junta o ambiente selecionado com o "Outro" (se preenchido) — o que vai pro banco. */
export function collectAmbienteAfetado(form: GmudFormState): string[] {
  const outro = form.ambienteOutro.trim()
  return outro !== '' ? [...form.ambienteAfetado, `Outro: ${outro}`] : [...form.ambienteAfetado]
}

/** Estado inicial vazio para Sistemas Internos. */
export function emptyGmudSistemasInternosData(): GmudSistemasInternosData {
  return {
    sistemaAfetado: '',
    sistemaAfetadoOutro: '',
    ambiente: '',
    natureza: '',
    tipoIndisponibilidade: '',
    duracaoEstimada: '',
    areasImpactadas: [],
  }
}

/** Estado inicial vazio para Sistemas Externos. */
export function emptyGmudSistemasExternosData(): GmudSistemasExternosData {
  return {
    sistemaExterno: '',
    sistemaExternoOutro: '',
    fornecedor: '',
    natureza: '',
    tipoIndisponibilidade: '',
    duracaoEstimada: '',
    areasAfetadas: [],
    chamadoFornecedor: '',
  }
}

// ---------------------------------------------------------------------------
// VALIDAÇÃO — condicional por categoria
// ---------------------------------------------------------------------------

function toYmd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * GMUDs são apresentadas toda terça-feira e só podem ser executadas 7 dias depois da apresentação.
 * A apresentação é a próxima terça estritamente depois de hoje (aberta numa terça, vale a da semana seguinte).
 * Retorna `yyyy-MM-dd`. Mesma regra em `minDataProgramada` de `server/gmudStore.js`.
 */
export function minDataProgramada(hoje: Date = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const diasAteTerca = ((2 - d.getDay() + 7) % 7) || 7
  d.setDate(d.getDate() + diasAteTerca + 7)
  return toYmd(d)
}

function formatYmdBr(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

/** Valida campos obrigatórios por categoria. Retorna rótulos dos campos faltando. */
/** Pendência do formulário e a seção (título exato do cartão na tela) onde ela se resolve. */
export type GmudPendencia = { section: string; message: string }

export function validateGmudFormBySection(
  form: GmudFormState,
  siData?: GmudSistemasInternosData | null,
  seData?: GmudSistemasExternosData | null,
): GmudPendencia[] {
  const missing: GmudPendencia[] = []
  const req = (ok: boolean, message: string, section: string) => { if (!ok) missing.push({ section, message }) }

  // Campos comuns a todas as categorias
  req(form.solicitanteEmail.trim() !== '', 'E-mail do solicitante', 'Identificação')
  req(form.tipo !== '', 'Tipo da GMUD', 'Identificação')
  req(form.titulo.trim() !== '', 'Título', 'Identificação')
  req(form.dataInicio !== '' && form.horaInicio !== '', 'Janela de início (data e hora)', 'Janela de mudança')
  req(form.dataFim !== '' && form.horaFim !== '', 'Janela de fim (data e hora)', 'Janela de mudança')

  if (form.dataInicio !== '' && form.dataFim !== '') {
    const inicio = `${form.dataInicio} ${form.horaInicio || '00:00'}`
    const fim = `${form.dataFim} ${form.horaFim || '00:00'}`
    req(fim > inicio, 'Fim da janela deve ser depois do início', 'Janela de mudança')
  }

  if ((form.tipo === 'Programada' || form.tipo === GMUD_TIPO_PRE_APROVADA) && form.dataInicio !== '') {
    const minimo = minDataProgramada()
    req(
      form.dataInicio >= minimo,
      `Data de início da GMUD ${form.tipo}: a partir de ${formatYmdBr(minimo)} (apresentação na terça + 7 dias)`,
      'Janela de mudança',
    )
  }

  if (form.tipo === GMUD_TIPO_PRE_APROVADA) {
    req(form.categoria === 'rede_externa', 'GMUD Pré-aprovada só está disponível para Rede Externa', 'Identificação')
    req(
      parseRepeticao(form.repeticaoVezes, form.repeticaoIntervaloDias) !== null,
      'Repetição: quantidade de 1 a 12 e, repetindo, intervalo de 1 a 365 dias',
      'Identificação',
    )
  }

  if (form.categoria === 'rede_externa') {
    // Campos obrigatórios de Rede Externa (comportamento original preservado)
    req(form.assunto !== '', 'Natureza da mudança', 'Identificação')
    req(form.descricao.trim() !== '', 'Descrição da atividade', 'Atividade')
    req(form.popSite.trim() !== '', 'POP/Site', 'Atividade')
    req(form.riscoNaoImplementacao.trim() !== '', 'Risco da não implementação', 'Atividade')
    req(collectAmbienteAfetado(form).length > 0, 'Ambiente afetado', 'Ambiente afetado')
    req(form.impactoParada !== '', 'Impacto de parada?', 'Impacto')
    req(form.planoExecucao.trim() !== '', 'Plano de execução', 'Execução')
    req(form.riscoExecucao.trim() !== '', 'Risco durante a execução', 'Execução')
    req(
      Object.values(form.recursosAdministrativos).some((papel) => papel === 'executor' || papel === 'validador'),
      'Recursos administrativos (ao menos uma área como Executor ou Validador)',
      'Recursos administrativos',
    )
    req(form.planoRollback.trim() !== '', 'Plano de rollback', 'Execução')
    req(form.listaClientesCor !== '', 'Lista de clientes ao COR', 'Alinhamento')
  }

  if (form.categoria === 'sistemas_internos' && siData) {
    const si = siData
    const sistema = si.sistemaAfetado === 'Outro (especificar)'
      ? si.sistemaAfetadoOutro.trim()
      : si.sistemaAfetado.trim()
    req(sistema !== '', 'Sistema afetado', 'Sistema')
    req(si.natureza !== '', 'Natureza da mudança', 'Sistema')
    req(si.ambiente !== '', 'Ambiente', 'Sistema')
    req(si.areasImpactadas.length > 0, 'Áreas impactadas (quem será avisado)', 'Impacto')
    req(form.descricao.trim() !== '', 'Objetivo / Descrição', 'Descrição')
    req(form.impactoParada !== '', 'Haverá indisponibilidade?', 'Impacto')
    req(form.planoExecucao.trim() !== '', 'Plano de execução', 'Execução')
    req(form.planoRollback.trim() !== '', 'Plano de rollback', 'Execução')
  }

  if (form.categoria === 'sistemas_externos' && seData) {
    const se = seData
    const sistema = se.sistemaExterno === 'Outro (especificar)'
      ? se.sistemaExternoOutro.trim()
      : se.sistemaExterno.trim()
    req(sistema !== '', 'Sistema externo', 'Sistema e fornecedor')
    req(se.natureza !== '', 'Natureza da mudança', 'Sistema e fornecedor')
    req(se.areasAfetadas.length > 0, 'Áreas afetadas (quem será avisado)', 'Impacto')
    req(form.descricao.trim() !== '', 'Mudança prevista', 'Mudança prevista')
    req(form.impactoParada !== '', 'Haverá indisponibilidade?', 'Impacto')
    req(form.planoExecucao.trim() !== '', 'Plano de contingência/execução', 'Contingência')
  }

  return missing
}

export function validateGmudForm(
  form: GmudFormState,
  siData?: GmudSistemasInternosData | null,
  seData?: GmudSistemasExternosData | null,
): string[] {
  return validateGmudFormBySection(form, siData, seData).map((p) => p.message)
}

// ---------------------------------------------------------------------------
// ESTADO INICIAL
// ---------------------------------------------------------------------------

export function emptyGmudForm(prefillEmail = '', prefillName = ''): GmudFormState {
  return {
    categoria: 'rede_externa',
    voalleProtocol: '',
    tipo: '',
    repeticaoVezes: '1',
    repeticaoIntervaloDias: '15',
    assunto: '',
    titulo: '',
    descricao: '',
    popSite: '',
    escopoRotas: [],
    solicitanteNome: prefillName,
    solicitanteEmail: prefillEmail,
    areaSolicitante: '',
    riscoNaoImplementacao: '',
    ambienteAfetado: [],
    comunicaCliente: '',
    clientesManuais: '',
    impactoParada: '',
    tipoIndisponibilidade: '',
    duracaoEstimada: '',
    planoExecucao: '',
    riscoExecucao: '',
    recursosAdministrativos: {},
    planoRollback: '',
    dataInicio: '',
    horaInicio: '',
    dataFim: '',
    horaFim: '',
    listaClientesCor: '',
    ambienteOutro: '',
    observacoes: '',
  }
}
