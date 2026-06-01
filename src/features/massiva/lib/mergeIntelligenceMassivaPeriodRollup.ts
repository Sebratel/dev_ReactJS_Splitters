import type { IntelligenceMassivaPeriodRollup } from '@/features/splitters/api/fetchMassivaPeriodRollupFromLocalDb'

/**
 * Painel da rede (período): o MySQL (`massiva_history` + vínculos) tem o histórico completo
 * de aberturas no intervalo. O BFF lista sobretudo massivas “vivas” na API — não substitui o total.
 */
export function mergeIntelligenceMassivaPeriodRollup(
  mysql: IntelligenceMassivaPeriodRollup,
  elleven: IntelligenceMassivaPeriodRollup,
): IntelligenceMassivaPeriodRollup {
  const hasMysqlHistory =
    mysql.distinctMassivaCount > 0 || mysql.affectedClientsDistinctSum > 0

  if (!hasMysqlHistory) {
    return elleven
  }

  const openMassivasCount = Math.min(mysql.openMassivasCount, elleven.openMassivasCount)

  return {
    distinctMassivaCount: mysql.distinctMassivaCount,
    affectedClientsDistinctSum: mysql.affectedClientsDistinctSum,
    openMassivasCount,
    closedMassivasCount: Math.max(
      mysql.closedMassivasCount,
      mysql.distinctMassivaCount - openMassivasCount,
    ),
  }
}
