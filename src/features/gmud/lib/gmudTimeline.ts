import { formatWindow, type GmudWindow } from '@/features/gmud/lib/gmudSchedule'

export type TimelineTone = 'neutral' | 'success' | 'danger' | 'warning' | 'primary'

export type TimelineItem = {
  at: string
  title: string
  detail: string | null
  actor: string | null
  tone: TimelineTone
}

type EventLike = { type: string; actor: string | null; payload: Record<string, unknown> | null; at: string | null }

const EVENT_LABEL: Record<string, { title: string; tone: TimelineTone }> = {
  criada: { title: 'Registrada na plataforma', tone: 'primary' },
  comite_aprovada: { title: 'Aprovada pelo Comitê', tone: 'success' },
  comite_negada: { title: 'Negada pelo Comitê', tone: 'danger' },
  comite_pendente: { title: 'Voltou para pendente no Comitê', tone: 'warning' },
  execucao_em_execucao: { title: 'Execução iniciada', tone: 'primary' },
  execucao_concluida: { title: 'Execução concluída', tone: 'success' },
  execucao_pendente: { title: 'Execução voltou para pendente', tone: 'warning' },
  encerrada_elleven: { title: 'Protocolo encerrado no Elleven', tone: 'success' },
  reagendada: { title: 'Janela reagendada', tone: 'warning' },
  massiva_vinculada: { title: 'Massiva vinculada', tone: 'neutral' },
  massiva_desvinculada: { title: 'Massiva desvinculada', tone: 'neutral' },
}

function isWindow(value: unknown): value is GmudWindow {
  const w = value as GmudWindow | null
  return Boolean(w && typeof w.dataInicio === 'string' && typeof w.horaInicio === 'string')
}

function detailFor(e: EventLike): string | null {
  const p = e.payload ?? {}
  if (e.type === 'reagendada' && isWindow(p.previous) && isWindow(p.next)) {
    return `${formatWindow(p.previous)} → ${formatWindow(p.next)}`
  }
  if (e.type === 'massiva_vinculada' || e.type === 'massiva_desvinculada') {
    return p.massivaProtocol ? `Massiva ${String(p.massivaProtocol)}` : null
  }
  if (e.type === 'encerrada_elleven') {
    return p.motivo === 'negada' ? 'Cancelamento (GMUD negada)' : p.motivo === 'concluida' ? 'Encerramento (GMUD concluída)' : null
  }
  if (e.type.startsWith('comite_')) {
    const parts = [p.dataCab ? `CAB ${String(p.dataCab).split('-').reverse().join('/')}` : null, p.rnc ? `RNC ${String(p.rnc)}` : null]
    const text = parts.filter(Boolean).join(' · ')
    return text || null
  }
  if (e.type === 'criada' && p.tipo) return String(p.tipo)
  return null
}

/**
 * Linha do tempo da GMUD: abertura e encerramento do protocolo (Voalle) + a trilha da plataforma,
 * em ordem cronológica.
 */
export function buildGmudTimeline(input: {
  openedAt: string | null
  conclusionDate: string | null
  voalleStatus: string
  events: EventLike[]
}): TimelineItem[] {
  const items: TimelineItem[] = []
  if (input.openedAt) {
    items.push({ at: input.openedAt, title: 'Protocolo aberto no Elleven', detail: null, actor: null, tone: 'neutral' })
  }
  for (const e of input.events) {
    if (!e.at) continue
    const meta = EVENT_LABEL[e.type] ?? { title: e.type, tone: 'neutral' as TimelineTone }
    items.push({ at: e.at, title: meta.title, detail: detailFor(e), actor: e.actor, tone: meta.tone })
  }
  const closedByPlatform = input.events.some((e) => e.type === 'encerrada_elleven')
  if (input.conclusionDate && !closedByPlatform) {
    const cancelled = /cancel/i.test(input.voalleStatus)
    items.push({
      at: input.conclusionDate,
      title: cancelled ? 'Protocolo cancelado no Elleven' : 'Protocolo encerrado no Elleven',
      detail: null,
      actor: null,
      tone: cancelled ? 'danger' : 'success',
    })
  }
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}
