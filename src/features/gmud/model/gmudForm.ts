/** Opções do formulário de GMUD (espelham o Google Form atual). */

export const GMUD_TIPO_OPTIONS = ['Programada', 'Emergencial'] as const

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

export type GmudFormState = {
  voalleProtocol: string
  tipo: string
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
  /** Texto livre do "Outro" em Ambiente afetado (opção que existe no Google Form). */
  ambienteOutro: string
}

/** Junta o ambiente selecionado com o "Outro" (se preenchido) — o que vai pro banco. */
export function collectAmbienteAfetado(form: GmudFormState): string[] {
  const outro = form.ambienteOutro.trim()
  return outro !== '' ? [...form.ambienteAfetado, `Outro: ${outro}`] : [...form.ambienteAfetado]
}

/** Valida os campos obrigatórios (paridade com o Google Form). Retorna os rótulos faltando. */
export function validateGmudForm(form: GmudFormState): string[] {
  const missing: string[] = []
  const req = (ok: boolean, label: string) => {
    if (!ok) missing.push(label)
  }
  // A GMUD sempre abre o protocolo no Elleven — o e-mail define o solicitante.
  req(form.solicitanteEmail.trim() !== '', 'E-mail do solicitante')
  req(form.tipo !== '', 'Tipo da GMUD')
  req(form.titulo.trim() !== '', 'Título')
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
  req(form.dataInicio !== '' && form.horaInicio !== '', 'Janela de início (data e hora)')
  req(form.dataFim !== '' && form.horaFim !== '', 'Janela de fim (data e hora)')
  req(form.listaClientesCor !== '', 'Lista de clientes ao COR')
  return missing
}

export function emptyGmudForm(prefillEmail = '', prefillName = ''): GmudFormState {
  return {
    voalleProtocol: '',
    tipo: '',
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
  }
}
