/**
 * Trilha de 5 passos do detalhe da GMUD: Registrada → Áreas → Comitê → Execução → Concluída.
 * Áreas e Comitê decidem em paralelo. Protocolo encerrado sem decisão deixa os passos que faltavam como "sem decisão".
 */
export type TrailState = 'done' | 'current' | 'pending' | 'failed' | 'skipped'
export type TrailStep = {
  key: 'registrada' | 'areas' | 'comite' | 'execucao' | 'concluida'
  label: string
  state: TrailState
  hint: string
}

export type TrailInput = {
  tipo: string | null | undefined
  statusAreas: string | null | undefined
  statusComite: string | null | undefined
  statusExec: string | null | undefined
  /** Protocolo já encerrado (cancelado/concluído) no Elleven. */
  closed: boolean
  encerradaStatus: string | null | undefined
  /** Textos já formatados pela tela. */
  createdLabel: string
  windowLabel: string
}

export function buildStatusTrail(i: TrailInput): TrailStep[] {
  const areasStatus = i.statusAreas ?? 'nao_aplicavel'
  const comite = i.statusComite ?? 'pendente'
  const preAprovada = i.tipo === 'Pré-aprovada'

  const areas: TrailStep =
    areasStatus === 'nao_aplicavel'
      ? { key: 'areas', label: 'Áreas', state: 'skipped', hint: 'não se aplica' }
      : areasStatus === 'aprovada'
        ? { key: 'areas', label: 'Áreas', state: 'done', hint: 'aprovadas' }
        : areasStatus === 'negada'
          ? { key: 'areas', label: 'Áreas', state: 'failed', hint: 'negada' }
          : i.closed
            ? { key: 'areas', label: 'Áreas', state: 'skipped', hint: 'sem decisão' }
            : { key: 'areas', label: 'Áreas', state: 'current', hint: 'pendente' }

  const comiteStep: TrailStep =
    comite === 'aprovada'
      ? { key: 'comite', label: 'Comitê', state: 'done', hint: preAprovada ? 'sem aprovação' : 'aprovado' }
      : comite === 'negada'
        ? { key: 'comite', label: 'Comitê', state: 'failed', hint: 'negado' }
        : i.closed
          ? { key: 'comite', label: 'Comitê', state: 'skipped', hint: 'sem decisão' }
          : { key: 'comite', label: 'Comitê', state: 'current', hint: 'pendente' }

  const liberada = comiteStep.state === 'done' && (areas.state === 'done' || areas.state === 'skipped')
  const exec = i.statusExec ?? 'pendente'
  const execucao: TrailStep =
    exec === 'concluida'
      ? { key: 'execucao', label: 'Execução', state: 'done', hint: 'concluída' }
      : exec === 'em_execucao'
        ? { key: 'execucao', label: 'Execução', state: 'current', hint: 'em execução' }
        : i.closed
          ? { key: 'execucao', label: 'Execução', state: 'skipped', hint: 'não executada' }
          : { key: 'execucao', label: 'Execução', state: liberada ? 'current' : 'pending', hint: i.windowLabel || 'aguardando' }

  const concluida: TrailStep = !i.closed
    ? { key: 'concluida', label: 'Concluída', state: 'pending', hint: '—' }
    : i.encerradaStatus === 'cancelada'
      ? { key: 'concluida', label: 'Encerrada', state: 'failed', hint: 'cancelada' }
      : i.encerradaStatus === 'negada'
        ? { key: 'concluida', label: 'Encerrada', state: 'failed', hint: 'negada' }
        : { key: 'concluida', label: 'Concluída', state: 'done', hint: 'encerrada' }

  return [{ key: 'registrada', label: 'Registrada', state: 'done', hint: i.createdLabel }, areas, comiteStep, execucao, concluida]
}

/** Aviso quando o protocolo foi encerrado no Elleven com aprovação ainda pendente; null quando não se aplica. */
export function closedPendingNotice(input: {
  closed: boolean
  statusComite: string | null | undefined
  statusAreas: string | null | undefined
  encerradaStatus: string | null | undefined
  closedAtLabel: string
}): string | null {
  const pendente = input.statusComite === 'pendente' || input.statusAreas === 'pendente'
  if (!input.closed || !pendente) return null
  const como =
    input.encerradaStatus === 'cancelada' ? 'cancelado' : input.encerradaStatus === 'negada' ? 'negado' : 'encerrado'
  return `Protocolo ${como} no Elleven${input.closedAtLabel ? ` em ${input.closedAtLabel}` : ''}: as aprovações que faltavam não são mais necessárias.`
}
