/**
 * Textos de aprovação do detalhe da GMUD. Comitê e áreas decidem em paralelo: a GMUD só é liberada quando os dois
 * aprovam. Protocolo já encerrado no Elleven não espera mais decisão nenhuma.
 */
export type AreasStatusForText = 'pendente' | 'aprovada' | 'negada'

export function describeAreasSummary(input: {
  statusAreas: AreasStatusForText
  statusComite: string | null | undefined
  /** Protocolo já encerrado (cancelado/concluído) no Elleven. */
  closed: boolean
}): string {
  const { statusAreas, statusComite, closed } = input
  if (closed && statusAreas === 'pendente') {
    return 'Protocolo encerrado no Elleven: as aprovações que faltavam não são mais necessárias.'
  }
  if (statusAreas === 'negada') return 'Uma área negou. A GMUD foi negada.'
  if (statusAreas === 'aprovada') {
    return statusComite === 'aprovada'
      ? 'Todas as áreas aprovaram. Com a aprovação do Comitê, a GMUD está liberada.'
      : 'Todas as áreas aprovaram. Falta a decisão do Comitê para liberar a GMUD.'
  }
  return 'Aguardando as áreas. A GMUD só é liberada quando todas as áreas e o Comitê aprovarem.'
}

/**
 * Rótulo do Comitê no resumo. Protocolo encerrado sem decisão do Comitê não fica "Pendente" para sempre.
 * Devolve null quando não há o que sobrescrever (a tela usa o rótulo padrão).
 */
export function committeeLabelOverride(input: {
  tipo: string | null | undefined
  statusComite: string | null | undefined
  closed: boolean
}): string | null {
  const { tipo, statusComite, closed } = input
  if (tipo === 'Pré-aprovada' && statusComite === 'aprovada') return 'Pré-aprovada (sem aprovação)'
  if (closed && statusComite === 'pendente') return 'Encerrada sem decisão'
  return null
}

/** Rótulo da execução no resumo; encerrada no Elleven sem ter sido executada mostra o desfecho real. */
export function executionLabelOverride(input: {
  statusExec: string | null | undefined
  encerradaStatus: string | null | undefined
  closed: boolean
}): string | null {
  const { statusExec, encerradaStatus, closed } = input
  if (!closed || (statusExec ?? 'pendente') !== 'pendente') return null
  if (encerradaStatus === 'cancelada') return 'Não executada (cancelada)'
  if (encerradaStatus === 'negada') return 'Não executada (negada)'
  return null
}
