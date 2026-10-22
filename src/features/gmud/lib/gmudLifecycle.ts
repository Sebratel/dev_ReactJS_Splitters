import type { GmudListItem } from '@/features/gmud/model/gmud'

/**
 * Regras de ciclo de vida da GMUD para habilitar/esconder as ações da tela.
 *
 * - **Avaliar** (decisão do Comitê) é um ato ÚNICO: aparece só enquanto o Comitê não decidiu
 *   (pendente) e o protocolo está aberto. Depois de Aprovada/Negada, some.
 * - **Concluir** só faz sentido numa GMUD aprovada e com protocolo aberto.
 * - **Cancelar** vale para qualquer GMUD com protocolo aberto (até pendente).
 * - **Encerrada** (terminal) = concluída, negada, cancelada ou já fechada no Elleven/Voalle.
 */

/** O Comitê já decidiu (aprovou ou negou) — não dá pra reavaliar. */
export function gmudComiteDecidido(g: Pick<GmudListItem, 'extra'>): boolean {
  const s = g.extra?.statusComite
  return s === 'aprovada' || s === 'negada'
}

/** Protocolo encerrado/terminal (concluída, negada, cancelada ou fechado no Elleven/Voalle). */
export function gmudEncerrada(g: Pick<GmudListItem, 'extra' | 'conclusionDate'>): boolean {
  const e = g.extra
  return (
    Boolean(e?.ellevenEncerradoEm) ||
    e?.statusExec === 'concluida' ||
    e?.statusComite === 'negada' ||
    e?.ellevenEncerradoStatus === 'cancelada' ||
    Boolean(g.conclusionDate)
  )
}

/** Mostra o botão "Avaliar": GMUD da plataforma, Comitê ainda pendente e protocolo aberto. */
export function gmudPodeAvaliar(g: Pick<GmudListItem, 'extra' | 'conclusionDate'>): boolean {
  return g.extra != null && !gmudComiteDecidido(g) && !gmudEncerrada(g)
}

/** Mostra o botão "Concluir": aprovada e protocolo aberto. */
export function gmudPodeConcluir(g: Pick<GmudListItem, 'extra' | 'conclusionDate'>): boolean {
  return g.extra?.statusComite === 'aprovada' && !gmudEncerrada(g)
}

/** Mostra o botão "Cancelar": GMUD da plataforma com protocolo aberto (inclusive pendente). */
export function gmudPodeCancelar(g: Pick<GmudListItem, 'extra' | 'conclusionDate'>): boolean {
  return g.extra != null && !gmudEncerrada(g)
}

/** Rótulo do motivo de encerramento, quando houver. */
export function gmudEncerramentoLabel(g: Pick<GmudListItem, 'extra'>): string | null {
  switch (g.extra?.ellevenEncerradoStatus) {
    case 'concluida':
      return 'Concluída'
    case 'negada':
      return 'Negada'
    case 'cancelada':
      return 'Cancelada'
    default:
      return null
  }
}
