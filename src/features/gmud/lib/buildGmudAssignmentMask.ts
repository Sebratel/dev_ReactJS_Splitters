import {
  collectAmbienteAfetado,
  GMUD_RECURSO_PAPEIS,
  type GmudFormState,
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

/** Título padronizado: "GMUD - {Tipo} - {POP} - {Título}". */
export function buildGmudTitle(form: GmudFormState): string {
  const parts = ['GMUD']
  if (form.tipo.trim()) parts.push(form.tipo.trim())
  if (form.popSite.trim()) parts.push(form.popSite.trim())
  const prefix = parts.join(' - ')
  return form.titulo.trim() ? `${prefix} - ${form.titulo.trim()}` : prefix
}

/**
 * Máscara estruturada da descrição que vai no protocolo do Elleven - organizada em blocos,
 * com todos os campos da GMUD. Elleven usa texto puro, então formatamos com rótulos/seções.
 */
export function buildGmudDescription(form: GmudFormState): string {
  const out: string[] = []
  const sep = '----------------------------------------'

  const field = (label: string, value: string) => {
    const v = (value ?? '').trim()
    if (v !== '') out.push(`${label}: ${v}`)
  }
  const section = (title: string, value: string) => {
    const v = (value ?? '').trim()
    if (v === '') return
    out.push('')
    out.push(`>> ${title.toUpperCase()}`)
    out.push(v)
  }

  // Cabeçalho + resumo
  out.push(`GESTÃO DE MUDANÇA DE REDE (GMUD)${form.tipo.trim() ? ` - ${form.tipo.trim()}` : ''}`)
  out.push(sep)
  field('Assunto', form.assunto)
  field('POP/Site', form.popSite)
  field('Janela de mudança', fmtJanela(form))
  field('Comunica cliente', form.comunicaCliente)
  field('Impacto de parada do serviço', form.impactoParada)
  const amb = collectAmbienteAfetado(form)
  if (amb.length > 0) field('Ambiente afetado', amb.join('; '))

  // Blocos de texto
  section('Descrição da atividade', form.descricao)
  section('Plano de execução', form.planoExecucao)
  section('Plano de rollback (retorno)', form.planoRollback)

  // Riscos
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

  // Recursos administrativos (só os papéis atribuídos)
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

  // Alinhamento + solicitante
  out.push('')
  out.push(sep)
  field('Lista de clientes impactados enviada ao COR', form.listaClientesCor)
  const solicNome = form.solicitanteNome.trim()
  const solicEmail = form.solicitanteEmail.trim()
  if (solicNome !== '' || solicEmail !== '') {
    const email = solicEmail !== '' ? ` (${solicEmail})` : ''
    const area = form.areaSolicitante.trim() !== '' ? ` - Área: ${form.areaSolicitante.trim()}` : ''
    out.push(`Solicitante: ${solicNome}${email}${area}`)
  }

  return out.join('\n')
}
