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
  field(out, 'Ambiente', si.ambiente)
  field(out, 'Natureza da mudança', si.natureza)
  field(out, 'Janela de execução', fmtJanela(form))

  section(out, 'Objetivo / Descrição', form.descricao)

  const impactoLines: string[] = []
  if (si.areasImpactadas.length > 0) impactoLines.push(`Áreas impactadas: ${si.areasImpactadas.join(', ')}`)
  if (form.impactoParada) impactoLines.push(`Haverá indisponibilidade: ${form.impactoParada}`)
  if (si.tipoIndisponibilidade && form.impactoParada === 'Sim') impactoLines.push(`Tipo: ${si.tipoIndisponibilidade}`)
  if (si.duracaoEstimada.trim()) impactoLines.push(`Duração estimada: ${si.duracaoEstimada.trim()}`)
  if (impactoLines.length > 0) {
    out.push('')
    out.push('>> IMPACTO')
    impactoLines.forEach((l) => out.push(l))
  }

  section(out, 'Plano de execução', form.planoExecucao)
  section(out, 'Plano de rollback', form.planoRollback)
  section(out, 'Observações', form.observacoes)

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
  field(out, 'Natureza da mudança', se.natureza)
  field(out, 'Janela de execução', fmtJanela(form))
  if (se.chamadoFornecedor.trim()) field(out, 'Chamado no fornecedor', se.chamadoFornecedor)

  section(out, 'Mudança prevista', form.descricao)

  const impactoLines: string[] = []
  if (se.areasAfetadas.length > 0) impactoLines.push(`Áreas afetadas: ${se.areasAfetadas.join(', ')}`)
  if (form.impactoParada) impactoLines.push(`Haverá indisponibilidade: ${form.impactoParada}`)
  if (se.tipoIndisponibilidade && form.impactoParada === 'Sim') impactoLines.push(`Tipo: ${se.tipoIndisponibilidade}`)
  if (se.duracaoEstimada.trim()) impactoLines.push(`Duração estimada: ${se.duracaoEstimada.trim()}`)
  if (impactoLines.length > 0) {
    out.push('')
    out.push('>> IMPACTO')
    impactoLines.forEach((l) => out.push(l))
  }

  section(out, 'Plano de contingência/execução', form.planoExecucao)
  section(out, 'Observações', form.observacoes)

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
