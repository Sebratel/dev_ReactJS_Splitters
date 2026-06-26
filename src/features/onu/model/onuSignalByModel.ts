/**
 * Saúde de sinal agregada por MODELO de ONU — vem do banco de monitoramento
 * (`onu_infos.onu_model`, o modelo real visto pela OLT), exposto pelo BFF em
 * `GET /api/onu-diagnostics/by-model`.
 *
 * Responde à pergunta: "os clientes com sinal ruim usam algum modelo específico?"
 */
export type OnuModelSignalRow = {
  model: string
  total: number
  online: number
  degraded: number
  offline: number
  unknown: number
  critical: number
  /** Média de RX (dBm) entre as ONUs operantes do modelo. */
  avgRx: number | null
}

export type OnuSignalByModel = {
  generatedAt: string | null
  models: OnuModelSignalRow[]
}

/** Linha enriquecida com taxas e flag de outlier para o storytelling. */
export type OnuModelSignalAnalyzed = OnuModelSignalRow & {
  /** atenuados ÷ total — indicador óptico atribuível ao equipamento. */
  degradedRate: number
  /** offline ÷ total — inclui quedas de energia (nem sempre culpa do modelo). */
  offlineRate: number
  /** (atenuados + offline) ÷ total — "taxa de problema" geral. */
  problemRate: number
  /** Modelo cuja atenuação supera com folga a média da rede e tem volume relevante. */
  isOutlier: boolean
}

export type OnuSignalByModelInsights = {
  monitored: number
  classifiedModels: number
  networkDegradedRate: number
  networkOfflineRate: number
  healthyRate: number
  /** Linhas analisadas (ordem original por volume). */
  rows: OnuModelSignalAnalyzed[]
  /** Piores modelos por taxa de atenuação, com volume relevante. */
  worstByDegraded: OnuModelSignalAnalyzed[]
  /** Volume mínimo aplicado para evitar ruído de amostra pequena. */
  minVolume: number
}

/**
 * Calcula taxas por modelo, a média da rede e sinaliza outliers (modelos que
 * atenuam bem acima da média com volume relevante). `minVolume` evita que um
 * modelo com 3 ONUs e 1 atenuada apareça como "100% problemático".
 */
export function analyzeOnuSignalByModel(
  data: OnuSignalByModel | undefined | null,
): OnuSignalByModelInsights | null {
  if (!data || data.models.length === 0) return null

  const monitored = data.models.reduce((s, m) => s + m.total, 0)
  if (monitored === 0) return null

  const netDegraded = data.models.reduce((s, m) => s + m.degraded, 0)
  const netOffline = data.models.reduce((s, m) => s + m.offline, 0)
  const netOnline = data.models.reduce((s, m) => s + m.online, 0)
  const networkDegradedRate = netDegraded / monitored
  const networkOfflineRate = netOffline / monitored
  const healthyRate = netOnline / monitored

  // 0,3% da base monitorada, mínimo 30 ONUs — corta cauda de amostra pequena.
  const minVolume = Math.max(30, Math.round(monitored * 0.003))

  const rows: OnuModelSignalAnalyzed[] = data.models.map((m) => {
    const degradedRate = m.total > 0 ? m.degraded / m.total : 0
    const offlineRate = m.total > 0 ? m.offline / m.total : 0
    const problemRate = m.total > 0 ? (m.degraded + m.offline) / m.total : 0
    const isOutlier =
      m.total >= minVolume &&
      networkDegradedRate > 0 &&
      degradedRate >= networkDegradedRate * 1.5
    return { ...m, degradedRate, offlineRate, problemRate, isOutlier }
  })

  const worstByDegraded = rows
    .filter((r) => r.total >= minVolume)
    .sort((a, b) => b.degradedRate - a.degradedRate || b.total - a.total)
    .slice(0, 12)

  return {
    monitored,
    classifiedModels: rows.length,
    networkDegradedRate,
    networkOfflineRate,
    healthyRate,
    rows,
    worstByDegraded,
    minVolume,
  }
}
