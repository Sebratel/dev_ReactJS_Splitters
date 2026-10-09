export const CARD = 'rounded-2xl bg-surface-container-lowest ring-1 ring-neutral-200/70 dark:ring-white/10'

/** Paleta dos indicadores (legível no claro e no escuro). */
export const COLORS = {
  opened: '#f59e0b',
  closed: '#10b981',
  backlog: '#b44a32',
  overdue: '#e11d48',
  neutral: '#94a3b8',
  primary: '#ffb000',
} as const

export function formatHours(hours: number | null): string {
  if (hours == null) return '—'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${Math.round(hours)} h`
  return `${Math.round(hours / 24)} dias`
}
