import { isGmudDisponivel, type GmudListItem } from '@/features/gmud/model/gmud'
import { gmudCancelada } from '@/features/gmud/lib/gmudLifecycle'

/** Tom do selo da coluna Situação (a cor acompanha um ícone e o texto; nunca é a única pista). */
export type GmudSituacaoTone = 'cancelada' | 'concluida' | 'negada' | 'liberada' | 'aguardando' | 'voalle'

export type GmudSituacao = {
  label: string
  tone: GmudSituacaoTone
  /** Explicação curta para o title do selo, quando ajuda. */
  hint?: string
  /** Status do Voalle para a linha pequena embaixo (só em GMUD da plataforma, quando o selo não é o próprio status). */
  voalle: string | null
}

type Item = Pick<GmudListItem, 'extra' | 'conclusionDate'> & { status?: string | null }

/**
 * Situação da GMUD na lista: o ESTADO em que ela está, nunca o tipo (Pré-aprovada é tipo; a situação dela,
 * quando já nasce aprovada, é "Liberada"). Ordem: cancelada → concluída → negada → encerrada → liberada →
 * aguardando aprovação. GMUD legada (só no Voalle) mostra o status do Voalle.
 */
export function gmudSituacao(g: Item): GmudSituacao {
  const status = (g.status ?? '').trim()
  const e = g.extra

  if (gmudCancelada(g)) {
    return { label: 'Cancelada', tone: 'cancelada', hint: 'Cancelada: aprovações pendentes não valem mais.', voalle: e && status ? status : null }
  }
  // Legado: não passou pela plataforma, então só existe o status do Voalle.
  if (e == null) return { label: status || '—', tone: 'voalle', voalle: null }

  const voalle = status || null
  if (e.statusExec === 'concluida' || e.ellevenEncerradoStatus === 'concluida') return { label: 'Concluída', tone: 'concluida', voalle }
  if (e.statusComite === 'negada' || e.ellevenEncerradoStatus === 'negada') return { label: 'Negada', tone: 'negada', voalle }
  if (e.ellevenEncerradoEm || g.conclusionDate) return { label: 'Encerrada', tone: 'concluida', hint: 'Protocolo já encerrado.', voalle }

  if (isGmudDisponivel(e.statusComite, e.statusAreas)) {
    return {
      label: 'Liberada',
      tone: 'liberada',
      hint: e.tipo === 'Pré-aprovada' ? 'Pré-aprovada: já nasce aprovada.' : 'Aprovada pelo Comitê e pelas áreas.',
      voalle,
    }
  }

  const areas = `(${e.areasAprovadas ?? 0}/${e.areasTotal ?? 0})`
  if ((e.statusComite === 'pendente' || e.statusComite === 'aprovada') && e.statusAreas === 'pendente') {
    return {
      label: e.statusComite === 'aprovada' ? `Comitê aprovou · aguardando áreas ${areas}` : `Aguardando Comitê e áreas ${areas}`,
      tone: 'aguardando',
      hint: 'O Comitê e as áreas decidem em paralelo; a GMUD só é liberada quando ambos aprovarem.',
      voalle,
    }
  }
  if (e.statusComite === 'pendente') return { label: 'Aguardando Comitê', tone: 'aguardando', voalle }
  // Comitê aprovou, mas as áreas não liberaram (ex.: uma área negou): ainda não está liberada.
  if (e.statusComite === 'aprovada') {
    return { label: 'Comitê aprovou · áreas não liberaram', tone: 'aguardando', hint: 'A GMUD só é liberada quando o Comitê e as áreas aprovam.', voalle }
  }
  // Registrada na plataforma sem decisão do Comitê gravada: vale o status do Voalle.
  return { label: status || '—', tone: 'voalle', voalle: null }
}
