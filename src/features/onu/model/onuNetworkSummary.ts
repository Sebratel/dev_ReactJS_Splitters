/**
 * Resumo agregado da saúde de sinal da rede (Painel da Rede), vindo do BFF em
 * `/api/onu-diagnostics/summary`. Calculado e cacheado no servidor.
 */

export type OnuSummaryTotals = {
  total: number
  online: number
  degraded: number
  offline: number
  noData: number
  /** ONUs com potência <= -28 dBm (sinal crítico). */
  criticalSignal: number
}

export type OnuHistogramBucket = {
  label: string
  count: number
  band: 'ok' | 'warning' | 'critical'
}

/** Estatísticas de distribuição do sinal RX das ONUs online (dBm). */
export type OnuSignalStats = {
  /** Quantidade de ONUs online com leitura de potência usadas no cálculo. */
  sampled: number
  /** Média de recepção. */
  avg: number | null
  /** Percentil 10 — 10% dos clientes recebem sinal pior que este valor. */
  p10: number | null
  /** Mediana (P50) — o cliente "típico". */
  p50: number | null
  /** Percentil 90 — os 10% melhores. */
  p90: number | null
}

/** Uma ONU quente para a lista de superaquecimento. */
export type OnuHotClient = {
  username: string | null
  oltHostname: string | null
  /** Temperatura da ONU (°C). */
  temperature: number | null
  rxPower: number | null
}

/** Estatísticas de temperatura das ONUs online (°C). */
export type OnuTemperatureStats = {
  /** ONUs online com leitura de temperatura válida. */
  sampled: number
  /** ONUs com temperatura ≥ warmThreshold (atenção). */
  warm: number
  /** ONUs com temperatura ≥ hotThreshold (crítico). */
  hot: number
  avg: number | null
  max: number | null
  warmThreshold: number
  hotThreshold: number
  /** As ONUs mais quentes (≥ warmThreshold), ordenadas decrescente. */
  hottest: OnuHotClient[]
}

/** Saúde de sinal agregada por OLT (para apontar onde estão os problemas). */
export type OnuOltBreakdown = {
  olt: string
  total: number
  online: number
  degraded: number
  offline: number
  unknown: number
  /** ONUs em nível crítico (≤ -28 dBm) nesta OLT. */
  critical: number
  /** online + degraded + offline (exclui sem dados). */
  monitored: number
  /** (offline + degraded) / monitored. */
  problemRate: number
  /** offline / monitored. */
  offlineRate: number
}

export type OnuWorstClient = {
  username: string | null
  oltHostname: string | null
  rxPower: number | null
  oltOnuStatus: string | null
  rxGood: string | null
}

/** [lat, lng, peso 0..1] — densidade dos clientes ATENUADOS. */
export type OnuHeatPoint = [number, number, number]

/** Marcador individual clicável no mapa (offline ou crítico). */
export type OnuProblemMarker = {
  lat: number
  lng: number
  kind: 'offline' | 'critical'
  username: string | null
  oltHostname: string | null
  rxPower: number | null
}

export type OnuNetworkSummary = {
  generatedAt: string
  totals: OnuSummaryTotals
  signalStats: OnuSignalStats
  temperature: OnuTemperatureStats
  /** Número total de OLTs com ao menos uma ONU monitorada. */
  oltCount: number
  /** OLTs mais afetadas (ordenadas por volume de problemas). */
  oltBreakdown: OnuOltBreakdown[]
  histogram: OnuHistogramBucket[]
  worst: OnuWorstClient[]
  heatPoints: OnuHeatPoint[]
  problemMarkers: OnuProblemMarker[]
}
