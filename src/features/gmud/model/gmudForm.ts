/** Opções do formulário de GMUD (espelham o Google Form atual). */

export const GMUD_TIPO_OPTIONS = ['Programada', 'Emergencial'] as const

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

export type GmudRecursoPapel = 'na' | 'executor' | 'validador'
export const GMUD_RECURSO_PAPEIS: { value: GmudRecursoPapel; label: string }[] = [
  { value: 'na', label: 'N/A' },
  { value: 'executor', label: 'Executor' },
  { value: 'validador', label: 'Validador' },
]

// ---------------------------------------------------------------------------
// ESTADO DO FORMULÁRIO
// ---------------------------------------------------------------------------

export type GmudFormState = {
  // Selector de categoria — o campo que guia todo o formulário dinâmico
  categoria: GmudCategoria
  voalleProtocol: string
  tipo: string
  /**
   * Para Rede Externa: natureza da mudança (persiste no DB como `assunto` para retrocompat).
   * Para Sistemas Internos/Externos: vazio (natureza fica em categoriaData.natureza).
   */
  assunto: string
  titulo: string
  descricao: string
  popSite: string
  solicitanteNome: string
  solicitanteEmail: string
  areaSolicitante: string
  riscoNaoImplementacao: string
  ambienteAfetado: string[]
  comunicaCliente: string
  impactoParada: string
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

/** Valida campos obrigatórios por categoria. Retorna rótulos dos campos faltando. */
export function validateGmudForm(
  form: GmudFormState,
  siData?: GmudSistemasInternosData | null,
  seData?: GmudSistemasExternosData | null,
): string[] {
  const missing: string[] = []
  const req = (ok: boolean, label: string) => { if (!ok) missing.push(label) }

  // Campos comuns a todas as categorias
  req(form.solicitanteEmail.trim() !== '', 'E-mail do solicitante')
  req(form.tipo !== '', 'Tipo da GMUD')
  req(form.titulo.trim() !== '', 'Título')
  req(form.dataInicio !== '' && form.horaInicio !== '', 'Janela de início (data e hora)')
  req(form.dataFim !== '' && form.horaFim !== '', 'Janela de fim (data e hora)')

  if (form.categoria === 'rede_externa') {
    // Campos obrigatórios de Rede Externa (comportamento original preservado)
    req(form.assunto !== '', 'Natureza da mudança')
    req(form.descricao.trim() !== '', 'Descrição da atividade')
    req(form.popSite.trim() !== '', 'POP/Site')
    req(form.riscoNaoImplementacao.trim() !== '', 'Risco da não implementação')
    req(collectAmbienteAfetado(form).length > 0, 'Ambiente afetado')
    req(form.comunicaCliente !== '', 'Comunica cliente?')
    req(form.impactoParada !== '', 'Impacto de parada?')
    req(form.planoExecucao.trim() !== '', 'Plano de execução')
    req(form.riscoExecucao.trim() !== '', 'Risco durante a execução')
    req(Object.keys(form.recursosAdministrativos).length > 0, 'Recursos administrativos')
    req(form.planoRollback.trim() !== '', 'Plano de rollback')
    req(form.listaClientesCor !== '', 'Lista de clientes ao COR')
  }

  if (form.categoria === 'sistemas_internos' && siData) {
    const si = siData
    const sistema = si.sistemaAfetado === 'Outro (especificar)'
      ? si.sistemaAfetadoOutro.trim()
      : si.sistemaAfetado.trim()
    req(sistema !== '', 'Sistema afetado')
    req(si.natureza !== '', 'Natureza da mudança')
    req(si.ambiente !== '', 'Ambiente')
    req(form.descricao.trim() !== '', 'Objetivo / Descrição')
    req(form.impactoParada !== '', 'Haverá indisponibilidade?')
    req(form.planoExecucao.trim() !== '', 'Plano de execução')
    req(form.planoRollback.trim() !== '', 'Plano de rollback')
  }

  if (form.categoria === 'sistemas_externos' && seData) {
    const se = seData
    const sistema = se.sistemaExterno === 'Outro (especificar)'
      ? se.sistemaExternoOutro.trim()
      : se.sistemaExterno.trim()
    req(sistema !== '', 'Sistema externo')
    req(se.natureza !== '', 'Natureza da mudança')
    req(form.descricao.trim() !== '', 'Mudança prevista')
    req(form.impactoParada !== '', 'Haverá indisponibilidade?')
    req(form.planoExecucao.trim() !== '', 'Plano de contingência/execução')
  }

  return missing
}

// ---------------------------------------------------------------------------
// ESTADO INICIAL
// ---------------------------------------------------------------------------

export function emptyGmudForm(prefillEmail = '', prefillName = ''): GmudFormState {
  return {
    categoria: 'rede_externa',
    voalleProtocol: '',
    tipo: '',
    assunto: '',
    titulo: '',
    descricao: '',
    popSite: '',
    solicitanteNome: prefillName,
    solicitanteEmail: prefillEmail,
    areaSolicitante: '',
    riscoNaoImplementacao: '',
    ambienteAfetado: [],
    comunicaCliente: '',
    impactoParada: '',
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
