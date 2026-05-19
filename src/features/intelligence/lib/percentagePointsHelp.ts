/** Explicação curta para tooltip nativo (title). */
export const PP_TOOLTIP =
  'pp = pontos percentuais: diferença direta entre dois percentuais de ocupação. Ex.: 70% → 78% = +8 pp (não é +11% relativo).'

export const PP_TOOLTIP_DELTA_PERIOD = (periodLabel: string) =>
  `${PP_TOOLTIP} O ${periodLabel} compara a ocupação de hoje com a estimada há ${periodLabel === 'Δ7d' ? '7 dias' : '30 dias'} atrás (snapshots).`

export function formatDeltaPp(delta: number): string {
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} pp`
}

/** Exemplo numérico a partir do uso atual e do Δ (mesma fórmula do backend). */
export function usageDeltaExample(currentUsagePercent: number, deltaPp: number): string {
  const before = Number((currentUsagePercent - deltaPp).toFixed(1))
  const after = Number(currentUsagePercent.toFixed(1))
  return `${before}% → ${after}%`
}

export function deltaPpLineTitle(
  currentUsagePercent: number,
  deltaPp: number,
  periodLabel: string,
): string {
  return `${PP_TOOLTIP_DELTA_PERIOD(periodLabel)} Neste equipamento: ${usageDeltaExample(currentUsagePercent, deltaPp)} (${formatDeltaPp(deltaPp)}).`
}
