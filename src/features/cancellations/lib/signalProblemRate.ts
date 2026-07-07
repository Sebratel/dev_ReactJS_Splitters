export type SignalProblemLevel = 'ok' | 'attention' | 'critical' | 'unknown'

/** % de ONUs degradadas + offline sobre o total monitorado (amostra mín. no explorador). */
export const SIGNAL_PROBLEM_ATTENTION_PCT = 8
export const SIGNAL_PROBLEM_CRITICAL_PCT = 15

export function classifySignalProblemRate(pct: number | null | undefined): SignalProblemLevel {
  if (pct == null || !Number.isFinite(pct)) return 'unknown'
  if (pct >= SIGNAL_PROBLEM_CRITICAL_PCT) return 'critical'
  if (pct >= SIGNAL_PROBLEM_ATTENTION_PCT) return 'attention'
  return 'ok'
}

export function signalProblemLevelLabel(level: SignalProblemLevel): string {
  switch (level) {
    case 'ok':
      return 'Saudável'
    case 'attention':
      return 'Atenção'
    case 'critical':
      return 'Crítico'
    default:
      return '—'
  }
}

export type SignalProblemPresentation = {
  level: SignalProblemLevel
  label: string
  valueColor: string
  badgeColor: string
  borderColor: string
  backgroundColor: string
  hint: string
}

const PRESENTATION: Record<Exclude<SignalProblemLevel, 'unknown'>, Omit<SignalProblemPresentation, 'level' | 'label'>> = {
  ok: {
    valueColor: '#047857',
    badgeColor: '#059669',
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
    hint: 'Baixa incidência de atenuação/offline.',
  },
  attention: {
    valueColor: '#b45309',
    badgeColor: '#d97706',
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    hint: 'Vale monitorar — acima de 8% das ONUs com problema.',
  },
  critical: {
    valueColor: '#be123c',
    badgeColor: '#e11d48',
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    hint: 'Alta incidência — verificar fibra/portas (≥ 15%).',
  },
}

export function describeSignalProblemRate(pct: number | null | undefined): SignalProblemPresentation {
  const level = classifySignalProblemRate(pct)
  if (level === 'unknown') {
    return {
      level,
      label: '—',
      valueColor: '#64748b',
      badgeColor: '#94a3b8',
      borderColor: '#e2e8f0',
      backgroundColor: '#f8fafc',
      hint: 'Sem amostra suficiente de ONUs.',
    }
  }
  const tone = PRESENTATION[level]
  return {
    level,
    label: signalProblemLevelLabel(level),
    ...tone,
  }
}

export function formatSignalProblemCount(
  degraded: number | null | undefined,
  offline: number | null | undefined,
  total: number | null | undefined,
): string | null {
  if (total == null || !Number.isFinite(total) || total <= 0) return null
  const problem = Math.max(0, (degraded ?? 0) + (offline ?? 0))
  return `${problem.toLocaleString('pt-BR')} de ${Math.round(total).toLocaleString('pt-BR')} ONUs`
}
