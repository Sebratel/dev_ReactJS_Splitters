/** Cor de cada GMUD na agenda, pelo tipo: o que importa para quem olha é saber se foi aprovada ou é urgência. */
export type AgendaTone = 'programada' | 'emergencial' | 'pre_aprovada' | 'encerrada'

export function agendaTone(item: { tipo: string | null | undefined; ellevenEncerradoEm: string | null | undefined }): AgendaTone {
  if (item.ellevenEncerradoEm) return 'encerrada'
  if (item.tipo === 'Emergencial') return 'emergencial'
  if (item.tipo === 'Pré-aprovada') return 'pre_aprovada'
  return 'programada'
}

export const AGENDA_TONE_LABEL: Record<AgendaTone, string> = {
  programada: 'Programada',
  emergencial: 'Emergencial',
  pre_aprovada: 'Pré-aprovada',
  encerrada: 'Encerrada',
}

/** Classes do chip: primeiro dia da janela (cheio) e dias seguintes (suave). */
export const AGENDA_TONE_CLASS: Record<AgendaTone, { start: string; cont: string; dot: string }> = {
  programada: {
    start: 'bg-sky-600 text-white hover:bg-sky-700',
    cont: 'bg-sky-600/15 text-sky-800 dark:text-sky-200',
    dot: 'bg-sky-600',
  },
  emergencial: {
    start: 'bg-amber-500 text-neutral-900 hover:bg-amber-600',
    cont: 'bg-amber-500/20 text-amber-900 dark:text-amber-200',
    dot: 'bg-amber-500',
  },
  pre_aprovada: {
    start: 'bg-emerald-600 text-white hover:bg-emerald-700',
    cont: 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-200',
    dot: 'bg-emerald-600',
  },
  encerrada: {
    start: 'bg-neutral-200 text-neutral-600 dark:bg-white/10 dark:text-neutral-300',
    cont: 'bg-neutral-200/60 text-neutral-500 dark:bg-white/5 dark:text-neutral-400',
    dot: 'bg-neutral-400',
  },
}

/** GMUDs cuja janela cobre algum dia entre `from` e `to` (YYYY-MM-DD, inclusive), em ordem de início. */
export function upcomingInRange<T extends { dataInicio: string; dataFim: string; horaInicio: string }>(
  items: T[],
  from: string,
  to: string,
): T[] {
  return items
    .filter((i) => i.dataInicio <= to && (i.dataFim || i.dataInicio) >= from)
    .sort((a, b) => (a.dataInicio + a.horaInicio).localeCompare(b.dataInicio + b.horaInicio))
}
