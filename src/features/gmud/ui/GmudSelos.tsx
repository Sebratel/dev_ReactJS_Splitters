import { AlertTriangle, Ban, CalendarClock, CheckCheck, CircleCheck, CircleX, Hourglass, Repeat, type LucideIcon } from 'lucide-react'
import type { GmudSituacao, GmudSituacaoTone } from '@/features/gmud/lib/gmudSituacao'
import { GMUD_TIPO_CRITICIDADE, type GmudTipoCriticidade } from '@/features/gmud/lib/gmudTipoCriticidade'
import { cn } from '@/shared/lib/utils'

const PILL = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold'

const TIPO_ICON: Record<GmudTipoCriticidade['icon'], LucideIcon> = { alert: AlertTriangle, calendar: CalendarClock, repeat: Repeat }

/** Selo da Situação: cor + ícone + texto. "voalle" (status vindo do Voalle) é texto simples, sem selo. */
const SITUACAO_STYLE: Record<Exclude<GmudSituacaoTone, 'voalle'>, { tone: string; icon: LucideIcon }> = {
  cancelada: { tone: 'bg-neutral-200 text-neutral-800 dark:bg-white/10 dark:text-neutral-200', icon: Ban },
  concluida: { tone: 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900', icon: CheckCheck },
  negada: { tone: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200', icon: CircleX },
  liberada: { tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200', icon: CircleCheck },
  aguardando: { tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200', icon: Hourglass },
}

/** Selo do tipo da GMUD: nome do tipo com o ícone e a cor da criticidade. */
export function GmudTipoSelo({ tipo }: { tipo: string }) {
  const crit = GMUD_TIPO_CRITICIDADE[tipo]
  if (!crit) return <span className="text-[11px] text-on-surface-variant">{tipo}</span>
  const Icon = TIPO_ICON[crit.icon]
  return (
    <span className={cn(PILL, crit.tone)}>
      <Icon size={12} aria-hidden />
      {tipo}
    </span>
  )
}

/** Selo da situação (de gmudSituacao): com ícone e cor; o status do Voalle sai como texto simples. */
export function GmudSituacaoSelo({ situacao, wrap = false }: { situacao: GmudSituacao; wrap?: boolean }) {
  if (situacao.tone === 'voalle') return <span className="text-xs text-on-surface-variant">{situacao.label}</span>
  const { tone, icon: Icon } = SITUACAO_STYLE[situacao.tone]
  return (
    <span className={cn(PILL, tone, wrap ? 'whitespace-normal text-left' : '')} title={situacao.hint}>
      <Icon size={12} aria-hidden className="shrink-0" />
      {situacao.label}
    </span>
  )
}
