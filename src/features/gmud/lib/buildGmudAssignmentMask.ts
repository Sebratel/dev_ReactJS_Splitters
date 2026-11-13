import {
  collectAmbienteAfetado,
  GMUD_RECURSO_PAPEIS,
  type GmudFormState,
  type GmudSistemasInternosData,
  type GmudSistemasExternosData,
} from '@/features/gmud/model/gmudForm'
import { formatEscopoRotas } from '@/features/gmud/model/gmudEscopoRede'
import { composeClientesTexto } from '@/features/gmud/model/gmudClientesSemSplitter'

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
  return `${ini} → ${fim}`
}

/**
 * Bloco com título: linha em branco, "EMOJI TÍTULO" e o texto. Some quando o texto está vazio.
 * O relato é texto puro (vai para o protocolo do Elleven); o emoji só marca a seção.
 */
function section(out: string[], emoji: string, title: string, value: string) {
  const v = (value ?? '').trim()
  if (v === '') return
  out.push('')
  out.push(`${emoji} ${title.toUpperCase()}`)
  out.push(v)
}

/** Linha "rótulo: valor" dos detalhes; some quando vazia. */
function field(out: string[], label: string, value: string) {
  const v = (value ?? '').trim()
  if (v !== '') out.push(`${label}: ${v}`)
}

const SEP = '──────────────────────────'
const SEP_DETALHES = '──────── DETALHES ────────'

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
// Peças comuns do relato
// ---------------------------------------------------------------------------

/** Primeira linha: "🛠️ GMUD {TIPO} · {contexto}". */
function tituloRelato(form: GmudFormState, contexto: string): string {
  const tipo = form.tipo.trim() !== '' ? ` ${form.tipo.trim().toUpperCase()}` : ''
  const ctx = contexto.trim() !== '' ? ` · ${contexto.trim()}` : ''
  return `🛠️ GMUD${tipo}${ctx}`
}

/** Impacto em destaque: verde sem parada, vermelho com parada; some se ainda não respondido. */
function linhaImpacto(form: GmudFormState): string | null {
  if (form.impactoParada === 'Sim') return '🔴 Impacto: COM PARADA DE SERVIÇO'
  if (form.impactoParada === 'Não') return '🟢 Impacto: SEM PARADA DE SERVIÇO'
  return null
}

/** Resumo do topo (quando, impacto e onde), para quem só passa o olho. */
function pushResumo(out: string[], form: GmudFormState, onde: string, ondeEmoji = '📍', ondeLabel = 'Onde') {
  out.push(`🕐 Quando: ${fmtJanela(form)}`)
  const impacto = linhaImpacto(form)
  if (impacto) out.push(impacto)
  const o = onde.trim()
  if (o !== '') {
    const partes = o.split('; ').filter((p) => p.trim() !== '')
    if (partes.length > 1) {
      out.push(`${ondeEmoji} ${ondeLabel}:`)
      partes.forEach((p) => out.push(`   • ${p}`))
    } else {
      out.push(`${ondeEmoji} ${ondeLabel}: ${o}`)
    }
  }
}

/** Matriz "Recursos administrativos" (Executor/Validador/Observador); vale para as 3 categorias. */
function pushRecursosAdministrativos(out: string[], form: GmudFormState) {
  const recursos = Object.entries(form.recursosAdministrativos)
    .filter(([, papel]) => papel && papel !== 'na')
    .map(([area, papel]) => {
      const label = GMUD_RECURSO_PAPEIS.find((p) => p.value === papel)?.label ?? papel
      return `${area} → ${label}`
    })
  if (recursos.length > 0) {
    out.push('')
    out.push('👥 RECURSOS ADMINISTRATIVOS')
    recursos.forEach((r) => out.push(r))
  }
}

function pushRodape(out: string[], form: GmudFormState) {
  out.push('')
  out.push(SEP)
  const solicNome = form.solicitanteNome.trim()
  const solicEmail = form.solicitanteEmail.trim()
  if (solicNome !== '' || solicEmail !== '') {
    const email = solicEmail !== '' ? ` (${solicEmail})` : ''
    const area = form.areaSolicitante.trim() !== '' ? ` · ${form.areaSolicitante.trim()}` : ''
    out.push(`👤 Solicitante: ${solicNome}${email}${area}`)
  }
}

// ---------------------------------------------------------------------------
// Relato — Rede Externa
// ---------------------------------------------------------------------------

function buildGmudDescriptionRedeExterna(form: GmudFormState): string {
  const out: string[] = []

  out.push(tituloRelato(form, form.popSite))
  pushResumo(out, form, formatEscopoRotas(form.escopoRotas))

  out.push('')
  out.push(SEP_DETALHES)
  field(out, 'Assunto', form.assunto)
  field(out, 'Comunica cliente', form.comunicaCliente)
  field(out, 'Clientes ponto a ponto e fibra apagada', composeClientesTexto(form.clientesSemSplitter, form.clientesManuais))
  if (form.impactoParada === 'Sim') {
    field(out, 'Indisponibilidade', form.tipoIndisponibilidade)
    field(out, 'Duração estimada', form.duracaoEstimada)
  }
  const amb = collectAmbienteAfetado(form)
  if (amb.length > 0) field(out, 'Ambiente afetado', amb.join('; '))

  section(out, '📝', 'Descrição', form.descricao)
  section(out, '⚙️', 'Execução', form.planoExecucao)
  section(out, '↩️', 'Rollback', form.planoRollback)

  const riscos: string[] = []
  if (form.riscoNaoImplementacao.trim() !== '')
    riscos.push(`Se não for feita: ${form.riscoNaoImplementacao.trim()}`)
  if (form.riscoExecucao.trim() !== '')
    riscos.push(`Durante a execução: ${form.riscoExecucao.trim()}`)
  if (riscos.length > 0) {
    out.push('')
    out.push('⚠️ RISCOS')
    riscos.forEach((r) => out.push(r))
  }

  pushRecursosAdministrativos(out, form)
  section(out, '💬', 'Observações', form.observacoes)
  pushRodape(out, form)

  return out.join('\n')
}

// ---------------------------------------------------------------------------
// Relato — Sistemas Internos
// ---------------------------------------------------------------------------

function buildGmudDescriptionSistemasInternos(form: GmudFormState, si: GmudSistemasInternosData): string {
  const out: string[] = []
  const sistema = si.sistemaAfetado === 'Outro (especificar)' ? si.sistemaAfetadoOutro : si.sistemaAfetado

  out.push(tituloRelato(form, 'SISTEMAS INTERNOS'))
  pushResumo(out, form, sistema, '💻', 'Sistema')

  out.push('')
  out.push(SEP_DETALHES)
  field(out, 'Assunto', form.assunto)
  field(out, 'Ambiente', si.ambiente)
  field(out, 'Natureza da mudança', si.natureza)
  if (si.areasImpactadas.length > 0) field(out, 'Áreas impactadas', si.areasImpactadas.join(', '))
  if (si.tipoIndisponibilidade && form.impactoParada === 'Sim') field(out, 'Tipo de indisponibilidade', si.tipoIndisponibilidade)
  if (si.duracaoEstimada.trim()) field(out, 'Duração estimada', si.duracaoEstimada)

  section(out, '📝', 'Objetivo / Descrição', form.descricao)
  section(out, '⚙️', 'Execução', form.planoExecucao)
  section(out, '↩️', 'Rollback', form.planoRollback)
  pushRecursosAdministrativos(out, form)
  section(out, '💬', 'Observações', form.observacoes)
  pushRodape(out, form)

  return out.join('\n')
}

// ---------------------------------------------------------------------------
// Relato — Sistemas Externos
// ---------------------------------------------------------------------------

function buildGmudDescriptionSistemasExternos(form: GmudFormState, se: GmudSistemasExternosData): string {
  const out: string[] = []
  const sistema = se.sistemaExterno === 'Outro (especificar)' ? se.sistemaExternoOutro : se.sistemaExterno
  const fornecedor = se.fornecedor.trim()
  const sistemaEFornecedor = fornecedor !== '' ? `${sistema.trim()} (${fornecedor})` : sistema

  out.push(tituloRelato(form, 'SISTEMAS EXTERNOS'))
  pushResumo(out, form, sistemaEFornecedor, '🌐', 'Sistema')

  out.push('')
  out.push(SEP_DETALHES)
  field(out, 'Assunto', form.assunto)
  field(out, 'Natureza da mudança', se.natureza)
  if (se.chamadoFornecedor.trim()) field(out, 'Chamado no fornecedor', se.chamadoFornecedor)
  if (se.areasAfetadas.length > 0) field(out, 'Áreas afetadas', se.areasAfetadas.join(', '))
  if (se.tipoIndisponibilidade && form.impactoParada === 'Sim') field(out, 'Tipo de indisponibilidade', se.tipoIndisponibilidade)
  if (se.duracaoEstimada.trim()) field(out, 'Duração estimada', se.duracaoEstimada)

  section(out, '📝', 'Mudança prevista', form.descricao)
  section(out, '⚙️', 'Plano de contingência/execução', form.planoExecucao)
  pushRecursosAdministrativos(out, form)
  section(out, '💬', 'Observações', form.observacoes)
  pushRodape(out, form)

  return out.join('\n')
}

// ---------------------------------------------------------------------------
// Entrypoint público — roteia por categoria
// ---------------------------------------------------------------------------

/**
 * Gera a descrição estruturada do protocolo no Elleven, adaptada à categoria da GMUD.
 * Formato: resumo no topo (quando, impacto, onde), detalhes e seções com um emoji por bloco.
 * É texto puro; nada no sistema lê esse texto de volta (os dados vêm do cadastro estruturado).
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
