import {
  collectAmbienteAfetado,
  GMUD_RECURSO_PAPEIS,
  type GmudFormState,
  type GmudSistemasInternosData,
  type GmudSistemasExternosData,
} from '@/features/gmud/model/gmudForm'

/** 'yyyy-mm-dd' → 'dd/mm/yyyy'. */
function fmtDate(iso: string): string {
  if (!iso || iso.length < 10) return iso || '-'
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

function fmtJanela(form: GmudFormState): string {
  const ini = form.dataInicio
    ? `${fmtDate(form.dataInicio)}${form.horaInicio ? ` ${form.horaInicio}` : ''}`
    : '-'
  const fim = form.dataFim
    ? `${fmtDate(form.dataFim)}${form.horaFim ? ` ${form.horaFim}` : ''}`
    : '-'
  return `${ini}  ->  ${fim}`
}

function section(out: string[], title: string, value: string) {
  const v = (value ?? '').trim()
  if (v === '') return
  out.push('')
  out.push(`>> ${title.toUpperCase()}`)
  out.push(v)
}

function field(out: string[], label: string, value: string) {
  const v = (value ?? '').trim()
  if (v !== '') out.push(`${label}: ${v}`)
}

const SEP = '----------------------------------------'

/** Título padronizado: "GMUD - {Tipo} - {Contexto} - {Título}". */
export function buildGmudTitle(form: GmudFormState, siData?: GmudSistemasInternosData | null, seData?: GmudSistemasExternosData | null): string {
  const parts = ['GMUD']
  if (form.tipo.trim()) parts.push(form.tipo.trim())

  if (form.categoria === 'rede_externa') {
    if (form.popSite.trim()) parts.push(form.popSite.trim())
  } else if (form.categoria === 'sistemas_internos' && siData) {
    const sistema = siData.sistemaAfetado === 'Outro (especificar)'
      ? siData.sistemaAfetadoOutro.trim()
      : siData.sistemaAfetado.trim()
    if (sistema) parts.push(sistema)
  } else if (form.categoria === 'sistemas_externos' && seData) {
    const sistema = seData.sistemaExterno === 'Outro (especificar)'
      ? seData.sistemaExternoOutro.trim()
      : seData.sistemaExterno.trim()
    if (sistema) parts.push(sistema)
  }

  const prefix = parts.join(' - ')
  return form.titulo.trim() ? `${prefix} - ${form.titulo.trim()}` : prefix
}

// ---------------------------------------------------------------------------
// Máscara — Rede Externa (comportamento original preservado)
// ---------------------------------------------------------------------------

function buildGmudDescriptionRedeExterna(form: GmudFormState): string {
  const out: string[] = []

  out.push(`GESTÃO DE MUDANÇA DE REDE (GMUD)${form.tipo.trim() ? ` - ${form.tipo.trim()}` : ''}`)
  out.push(SEP)
  field(out, 'Assunto', form.assunto)
  field(out, 'POP/Site', form.popSite)
  field(out, 'Janela de mudança', fmtJanela(form))
  field(out, 'Comunica cliente', form.comunicaCliente)
  field(out, 'Impacto de parada do serviço', form.impactoParada)
  const amb = collectAmbienteAfetado(form)
  if (amb.length > 0) field(out, 'Ambiente afetado', amb.join('; '))

  section(out, 'Descrição da atividade', form.descricao)
  section(out, 'Plano de execução', form.planoExecucao)
  section(out, 'Plano de rollback (retorno)', form.planoRollback)
  section(out, 'Observações', form.observacoes)

  const riscos: string[] = []
  if (form.riscoNaoImplementacao.trim() !== '')
    riscos.push(`Não implementação: ${form.riscoNaoImplementacao.trim()}`)
  if (form.riscoExecucao.trim() !== '')
    riscos.push(`Durante a execução: ${form.riscoExecucao.trim()}`)
  if (riscos.length > 0) {
    out.push('')
    out.push('>> RISCOS')
    riscos.forEach((r) => out.push(r))
  }

  const recursos = Object.entries(form.recursosAdministrativos)
    .filter(([, papel]) => papel && papel !== 'na')
    .map(([area, papel]) => {
      const label = GMUD_RECURSO_PAPEIS.find((p) => p.value === papel)?.label ?? papel
      return `${area}: ${label}`
    })
  if (recursos.length > 0) {
    out.push('')
    out.push('>> RECURSOS ADMINISTRATIVOS')
    out.push(recursos.join('  |  '))
  }

  out.push('')
  out.push(SEP)
  field(out, 'Lista de clientes impactados enviada ao COR', form.listaClientesCor)
  const solicNome = form.solicitanteNome.trim()
  const solicEmail = form.solicitanteEmail.trim()
  if (solicNome !== '' || solicEmail !== '') {
    const email = solicEmail !== '' ? ` (${solicEmail})` : ''
    const area = form.areaSolicitante.trim() !== '' ? ` - Área: ${form.areaSolicitante.trim()}` : ''
    out.push(`Solicitante: ${solicNome}${email}${area}`)
  }

  return out.join('\n')
}

// ---------------------------------------------------------------------------
// Máscara — Sistemas Internos
// ---------------------------------------------------------------------------

function buildGmudDescriptionSistemasInternos(form: GmudFormState, si: GmudSistemasInternosData): string {
  const out: string[] = []
  const sistema = si.sistemaAfetado === 'Outro (especificar)' ? si.sistemaAfetadoOutro : si.sistemaAfetado

  out.push(`GESTÃO DE MUDANÇA — SISTEMAS INTERNOS${form.tipo.trim() ? ` (${form.tipo.trim()})` : ''}`)
  out.push(SEP)
  field(out, 'Sistema afetado', sistema)
  field(out, 'Módulo/Funcionalidade', si.moduloFuncionalidade)
  field(out, 'Ambiente', si.ambiente)
  field(out, 'Natureza da mudança', si.natureza)
  field(out, 'Janela de execução', fmtJanela(form))
  field(out, 'Responsável técnico', si.responsavelTecnico)
  field(out, 'Equipe responsável', si.equipeResponsavel)

  section(out, 'Objetivo da mudança', si.objetivo)
  section(out, 'Descrição da atividade', form.descricao)
  section(out, 'Justificativa', si.justificativa)
  section(out, 'Resultado esperado', si.resultadoEsperado)

  // Impacto operacional
  const impactoLines: string[] = []
  if (si.areasImpactadas.length > 0) impactoLines.push(`Áreas impactadas: ${si.areasImpactadas.join(', ')}`)
  if (si.processosNegocio.length > 0) impactoLines.push(`Processos de negócio: ${si.processosNegocio.join(', ')}`)
  if (si.usuariosImpactados.trim()) impactoLines.push(`Usuários potencialmente afetados: ${si.usuariosImpactados.trim()}`)
  if (form.impactoParada) impactoLines.push(`Haverá indisponibilidade: ${form.impactoParada}`)
  if (si.tipoIndisponibilidade && form.impactoParada === 'Sim') impactoLines.push(`Tipo: ${si.tipoIndisponibilidade}`)
  if (si.duracaoEstimada.trim()) impactoLines.push(`Duração estimada: ${si.duracaoEstimada.trim()}`)
  if (si.impactoEsperado.trim()) impactoLines.push(`Impacto esperado: ${si.impactoEsperado.trim()}`)
  if (impactoLines.length > 0) {
    out.push('')
    out.push('>> IMPACTO OPERACIONAL')
    impactoLines.forEach((l) => out.push(l))
  }

  // Dependências
  const depLines: string[] = []
  if (si.apisEnvolvidas.trim()) depLines.push(`APIs envolvidas: ${si.apisEnvolvidas.trim()}`)
  if (si.integracoes.trim()) depLines.push(`Integrações: ${si.integracoes.trim()}`)
  if (si.automacoesN8n.trim()) depLines.push(`Automações n8n: ${si.automacoesN8n.trim()}`)
  if (si.bancoDados.trim()) depLines.push(`Banco de dados: ${si.bancoDados.trim()}`)
  if (si.servicosDependentes.trim()) depLines.push(`Serviços dependentes: ${si.servicosDependentes.trim()}`)
  if (depLines.length > 0) {
    out.push('')
    out.push('>> DEPENDÊNCIAS')
    depLines.forEach((l) => out.push(l))
  }

  if (si.prerequisitos.trim()) section(out, 'Pré-requisitos', si.prerequisitos)
  section(out, 'Plano de execução', form.planoExecucao)
  section(out, 'Plano de rollback', form.planoRollback)

  // Validação
  const valLines: string[] = []
  if (si.testesNecessarios.trim()) valLines.push(`Testes: ${si.testesNecessarios.trim()}`)
  if (si.criteriosSucesso.trim()) valLines.push(`Critérios de sucesso: ${si.criteriosSucesso.trim()}`)
  if (si.responsavelHomologacao.trim()) valLines.push(`Responsável pela homologação: ${si.responsavelHomologacao.trim()}`)
  if (si.procedimentoValidacao.trim()) valLines.push(`Procedimento pós-implantação: ${si.procedimentoValidacao.trim()}`)
  if (valLines.length > 0) {
    out.push('')
    out.push('>> VALIDAÇÃO')
    valLines.forEach((l) => out.push(l))
  }

  const comLines: string[] = []
  if (si.equipesInformadas.length > 0) comLines.push(`Equipes a notificar: ${si.equipesInformadas.join(', ')}`)
  if (si.comunicacaoPrevia) comLines.push(`Comunicação prévia necessária: ${si.comunicacaoPrevia}`)
  if (comLines.length > 0) {
    out.push('')
    out.push('>> COMUNICAÇÃO')
    comLines.forEach((l) => out.push(l))
  }

  section(out, 'Observações', si.observacoesAdicionais || form.observacoes)

  out.push('')
  out.push(SEP)
  const solicNome = form.solicitanteNome.trim()
  const solicEmail = form.solicitanteEmail.trim()
  if (solicNome !== '' || solicEmail !== '') {
    const email = solicEmail !== '' ? ` (${solicEmail})` : ''
    const area = form.areaSolicitante.trim() !== '' ? ` - Área: ${form.areaSolicitante.trim()}` : ''
    out.push(`Solicitante: ${solicNome}${email}${area}`)
  }

  return out.join('\n')
}

// ---------------------------------------------------------------------------
// Máscara — Sistemas Externos
// ---------------------------------------------------------------------------

function buildGmudDescriptionSistemasExternos(form: GmudFormState, se: GmudSistemasExternosData): string {
  const out: string[] = []
  const sistema = se.sistemaExterno === 'Outro (especificar)' ? se.sistemaExternoOutro : se.sistemaExterno

  out.push(`GESTÃO DE MUDANÇA — SISTEMAS EXTERNOS${form.tipo.trim() ? ` (${form.tipo.trim()})` : ''}`)
  out.push(SEP)
  field(out, 'Sistema externo', sistema)
  field(out, 'Fornecedor', se.fornecedor)
  field(out, 'Serviço/Funcionalidade', se.servicoFuncionalidade)
  field(out, 'Ambiente', se.ambienteSE)
  field(out, 'Natureza da mudança', se.natureza)
  field(out, 'Janela de execução', fmtJanela(form))
  field(out, 'Responsável interno', se.responsavelInterno)

  section(out, 'Mudança prevista', se.mudancaPrevista)
  section(out, 'Motivo da alteração', se.motivoAlteracao)
  section(out, 'Origem da solicitação', se.origemSolicitacao)
  if (se.comunicadoFornecedor.trim()) section(out, 'Comunicado do fornecedor', se.comunicadoFornecedor)

  // Impacto operacional
  const impactoLines: string[] = []
  if (se.areasAfetadas.length > 0) impactoLines.push(`Áreas internas afetadas: ${se.areasAfetadas.join(', ')}`)
  if (se.processosDependentes.length > 0) impactoLines.push(`Processos dependentes: ${se.processosDependentes.join(', ')}`)
  if (se.integracoesAfetadas.trim()) impactoLines.push(`Integrações que poderão ser afetadas: ${se.integracoesAfetadas.trim()}`)
  if (form.impactoParada) impactoLines.push(`Haverá indisponibilidade: ${form.impactoParada}`)
  if (se.tipoIndisponibilidade && form.impactoParada === 'Sim') impactoLines.push(`Tipo: ${se.tipoIndisponibilidade}`)
  if (se.duracaoEstimada.trim()) impactoLines.push(`Duração estimada: ${se.duracaoEstimada.trim()}`)
  if (se.impactoEsperado.trim()) impactoLines.push(`Impacto esperado: ${se.impactoEsperado.trim()}`)
  if (impactoLines.length > 0) {
    out.push('')
    out.push('>> IMPACTO OPERACIONAL')
    impactoLines.forEach((l) => out.push(l))
  }

  // Informações do fornecedor
  const fornLines: string[] = []
  if (se.chamadoFornecedor.trim()) fornLines.push(`Número do chamado no fornecedor: ${se.chamadoFornecedor.trim()}`)
  if (se.janelaFornecedor.trim()) fornLines.push(`Janela informada pelo fornecedor: ${se.janelaFornecedor.trim()}`)
  if (se.canalAcompanhamento.trim()) fornLines.push(`Canal de acompanhamento: ${se.canalAcompanhamento.trim()}`)
  if (fornLines.length > 0) {
    out.push('')
    out.push('>> INFORMAÇÕES DO FORNECEDOR')
    fornLines.forEach((l) => out.push(l))
  }

  // Contingência
  const contLines: string[] = []
  if (se.alternativaOperacional.trim()) contLines.push(`Alternativa operacional: ${se.alternativaOperacional.trim()}`)
  if (se.acoesMitigar.trim()) contLines.push(`Ações para reduzir o impacto: ${se.acoesMitigar.trim()}`)
  if (se.procedimentoRecuperacao.trim()) contLines.push(`Procedimento de recuperação: ${se.procedimentoRecuperacao.trim()}`)
  if (form.planoExecucao.trim()) contLines.push(`Plano de contingência/execução: ${form.planoExecucao.trim()}`)
  if (contLines.length > 0) {
    out.push('')
    out.push('>> CONTINGÊNCIA')
    contLines.forEach((l) => out.push(l))
  }

  // Validação
  const valLines: string[] = []
  if (se.testesPosMudanca.trim()) valLines.push(`Testes pós-mudança: ${se.testesPosMudanca.trim()}`)
  if (se.validacaoIntegracoes.trim()) valLines.push(`Validação das integrações: ${se.validacaoIntegracoes.trim()}`)
  if (se.criteriosNormalizacao.trim()) valLines.push(`Critérios de normalização: ${se.criteriosNormalizacao.trim()}`)
  if (se.responsavelValidacao.trim()) valLines.push(`Responsável pela validação interna: ${se.responsavelValidacao.trim()}`)
  if (valLines.length > 0) {
    out.push('')
    out.push('>> VALIDAÇÃO')
    valLines.forEach((l) => out.push(l))
  }

  const comLines: string[] = []
  if (se.areasNotificar.length > 0) comLines.push(`Áreas a notificar: ${se.areasNotificar.join(', ')}`)
  if (se.avisoUsuarios) comLines.push(`Aviso aos usuários necessário: ${se.avisoUsuarios}`)
  if (comLines.length > 0) {
    out.push('')
    out.push('>> COMUNICAÇÃO')
    comLines.forEach((l) => out.push(l))
  }

  section(out, 'Observações', se.observacoesAdicionais || form.observacoes)

  out.push('')
  out.push(SEP)
  const solicNome = form.solicitanteNome.trim()
  const solicEmail = form.solicitanteEmail.trim()
  if (solicNome !== '' || solicEmail !== '') {
    const email = solicEmail !== '' ? ` (${solicEmail})` : ''
    const area = form.areaSolicitante.trim() !== '' ? ` - Área: ${form.areaSolicitante.trim()}` : ''
    out.push(`Solicitante: ${solicNome}${email}${area}`)
  }

  return out.join('\n')
}

// ---------------------------------------------------------------------------
// Entrypoint público — roteia por categoria
// ---------------------------------------------------------------------------

/**
 * Gera a descrição estruturada do protocolo no Elleven, adaptada à categoria da GMUD.
 * Para Rede Externa: comportamento original preservado (retrocompat total).
 * Para Sistemas Internos/Externos: máscara específica.
 */
export function buildGmudDescription(
  form: GmudFormState,
  siData?: GmudSistemasInternosData | null,
  seData?: GmudSistemasExternosData | null,
): string {
  if (form.categoria === 'sistemas_internos' && siData) {
    return buildGmudDescriptionSistemasInternos(form, siData)
  }
  if (form.categoria === 'sistemas_externos' && seData) {
    return buildGmudDescriptionSistemasExternos(form, seData)
  }
  // Rede Externa — ou fallback para categorias desconhecidas (retrocompat)
  return buildGmudDescriptionRedeExterna(form)
}
