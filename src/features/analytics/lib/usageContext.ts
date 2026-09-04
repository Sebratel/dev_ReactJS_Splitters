import type { UsageModuleKey } from '@/features/analytics/lib/resolveModuleFromPath'

/**
 * Contexto de uso "atual" (módulo/rota/sessão) mantido pelo useUsageTracking.
 * Permite disparar eventos de ação (trackUsageAction) de qualquer handler sem
 * precisar passar rota/sessão manualmente.
 */
type UsageContext = {
  module: UsageModuleKey
  path: string
  sessionId: string
}

let current: UsageContext | null = null

export function setUsageContext(ctx: UsageContext): void {
  current = ctx
}

export function getUsageContext(): UsageContext | null {
  return current
}
