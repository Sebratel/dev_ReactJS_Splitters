/**
 * Diagnóstico de ONU por cliente — dados do banco de monitoramento
 * (app-splitters-monitoring), expostos pelo BFF em `/api/onu-diagnostics`.
 *
 * O elo com o resto do app é o `pppoeUsername`, equivalente a
 * `SplitterCliente.user` / `ClienteDetail.user` (coluna `auth_contract.user`
 * no sistema principal).
 *
 * Fase 1 (atual): sinal/estado atual da ONU.
 * Fase 2 (futura): `projectedRxPower` (sinal projetado da porta, de outra
 * plataforma) habilita o comparativo de atenuação — ver `deriveAttenuation`.
 */

export type OnuDiagnostic = {
  pppoeUsername: string | null
  gponClientId: number | string | null
  gponMacId: number | string | null
  mac: string | null
  serialNumber: string | null
  oltHostname: string | null
  onuModel: string | null
  /** Distância da ONU até a OLT, em metros. */
  distance: number | null
  /** Temperatura da ONU, em °C. */
  temperature: number | null
  relatedGponMacId: number | string | null
  relatedPonlink: string | null
  relatedSerialNumber: string | null
  onuStatusId: number | string | null
  /** Qualidade do sinal reportada pelo coletor: 'OK' | 'warning' | 'critical' | ... */
  rxGood: string | null
  /** Potência de recepção no lado da ONU (dBm). */
  rxPower: number | null
  /** Potência de recepção no lado da OLT (dBm). */
  oltOltRxPower: number | null
  zabbixOltRxPower: number | null
  zabbixOnuRxPower: number | null
  /** Estado operacional reportado pela OLT: 'up' | 'down' | 'power_fail' | 'loss_signal'. */
  oltOnuStatus: string | null
  /** Estado operacional consolidado: 'OK' | 'warning' | 'critical' | 'unavailable' | ... */
  onuOperStatus: string | null
  calculatedStatus: string | null
  /** Potência de transmissão (dBm). */
  txPower: number | null
  /** Último horário em que a ONU caiu (ISO 8601). */
  lastOff: string | null
  /** Última atualização do status (ISO 8601) — reflete a leitura das métricas. */
  statusUpdatedAt: string | null
  /**
   * Idade (segundos) do estado up/down — atualizado por trap/alarme da OLT,
   * em ~tempo real. É o frescor REAL do status, distinto de `statusUpdatedAt`
   * (que é o horário da leitura das métricas, atualizado em ondas lentas).
   */
  statusSeenAgeSeconds: number | null
  /** Idade (segundos) desde a última queda (`lastOff`). */
  lastOffAgeSeconds: number | null
  /** Limite de potência cadastrado para o cliente, quando houver (dBm). */
  powerThreshold: number | null
  ponlink: string | null
  onuIndex: number | null
  gponSplitter: string | null
  /**
   * Fase 2: sinal projetado da porta alocada (de outra plataforma). `null` até
   * a integração existir — o contrato já está pronto para recebê-lo.
   */
  projectedRxPower: number | null
}

/** Estado operacional da ONU para os badges/cards. */
export type OnuSignalStatus = 'online' | 'degraded' | 'offline' | 'unknown'

/**
 * Heurística de potência (dBm) usada na Fase 1, enquanto não há sinal
 * projetado. Faixas típicas de GPON. Na Fase 2 a classificação de atenuação
 * passa a ser relativa ao `projectedRxPower` (ver `deriveAttenuation`).
 */
export const RX_POWER_DEGRADED_DBM = -25
export const RX_POWER_CRITICAL_DBM = -28

/**
 * Limiares de temperatura da ONU (°C), espelhando os do BFF
 * (`buildOnuNetworkSummary`). Faixa de operação típica de ONU GPON vai até
 * ~65 °C; acima disso cresce o risco térmico de falha de hardware.
 */
export const ONU_TEMP_WARM_C = 60
export const ONU_TEMP_HOT_C = 70

export type OnuTempLevel = 'ok' | 'warm' | 'hot' | 'unknown'

/** Classifica a temperatura da ONU para alerta visual. */
export function deriveTempLevel(celsius: number | null | undefined): OnuTempLevel {
  if (celsius === null || celsius === undefined) return 'unknown'
  if (celsius >= ONU_TEMP_HOT_C) return 'hot'
  if (celsius >= ONU_TEMP_WARM_C) return 'warm'
  return 'ok'
}

const OFFLINE_OLT_STATES = new Set(['down', 'power_fail', 'loss_signal'])
const OFFLINE_RX_GOOD = new Set(['inactive', 'power_fail', 'down', 'loss_signal'])
const DEGRADED_RX_GOOD = new Set(['warning', 'critical', 'unavailable'])

// `calculated_status` é o estado RECONCILIADO pela monitoração (Zabbix/OLT/
// alarme), e é fresco (~min). O `olt_onu_status` bruto pode ficar horas velho —
// por isso o reconciliado tem prioridade quando disponível e reconhecido.
const CALC_OFFLINE = new Set(['down', 'offline', 'power_fail', 'loss_signal', 'inactive'])
const CALC_ONLINE = new Set(['ok', 'up'])
const CALC_DEGRADED = new Set(['warning', 'critical'])

function norm(value: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

/**
 * `rxPower === 0` é o valor-sentinela de **ausência de luz óptica (LOS)** — não
 * é um sinal real (a recepção GPON é sempre negativa, ~-8 a -28 dBm). Em alguns
 * casos a OLT ainda reporta `up` (estado antigo) enquanto a luz já zerou, então
 * tratamos 0.0 como "sem sinal" para não pintar de online um cliente caído.
 */
export function isNoOpticalSignal(d: OnuDiagnostic | null | undefined): boolean {
  return d?.rxPower === 0
}

/**
 * Deriva o estado operacional atual da ONU (Fase 1). Combina o estado reportado
 * pela OLT, a qualidade do sinal e a potência de recepção.
 */
export function deriveOnuSignalStatus(
  d: OnuDiagnostic | null | undefined,
): OnuSignalStatus {
  if (!d) return 'unknown'

  const calc = norm(d.calculatedStatus)
  const oltState = norm(d.oltOnuStatus)
  const rxGood = norm(d.rxGood)
  const operStatus = norm(d.onuOperStatus)

  // Sem nenhum sinal de vida coletado → desconhecido (cinza), não "offline".
  const hasAnySignal =
    d.calculatedStatus != null ||
    d.oltOnuStatus != null ||
    d.rxGood != null ||
    d.onuOperStatus != null ||
    d.rxPower != null
  if (!hasAnySignal) return 'unknown'

  // 0.0 dBm = ausência de luz óptica (LOS). Nunca é "online".
  if (d.rxPower === 0) return 'offline'

  // PRIORIDADE: estado reconciliado (fresco). Só cai na heurística bruta abaixo
  // quando o calculated_status é nulo/desconhecido.
  if (CALC_OFFLINE.has(calc)) return 'offline'
  if (CALC_ONLINE.has(calc)) {
    // Reconciliado diz operante; refina por qualidade de sinal (fraco = atenuado).
    if (d.rxPower != null && d.rxPower <= RX_POWER_DEGRADED_DBM) return 'degraded'
    return 'online'
  }
  if (CALC_DEGRADED.has(calc)) return 'degraded'

  // Fallback (sem calculated_status confiável): campos brutos da OLT/coletor.
  if (OFFLINE_OLT_STATES.has(oltState)) return 'offline'
  if (OFFLINE_RX_GOOD.has(rxGood)) return 'offline'

  const isUp = oltState === 'up' || operStatus === 'ok' || rxGood === 'ok'
  if (!isUp) return 'unknown'

  if (DEGRADED_RX_GOOD.has(rxGood) || DEGRADED_RX_GOOD.has(operStatus)) return 'degraded'
  if (d.rxPower != null && d.rxPower <= RX_POWER_DEGRADED_DBM) return 'degraded'

  return 'online'
}

/** Nível de atenuação relativo ao sinal projetado (Fase 2). */
export type OnuAttenuationLevel = 'ok' | 'warning' | 'critical' | 'unknown'

/**
 * Margem máxima aceitável (dB) entre o sinal atual e o projetado antes de
 * disparar alerta. Definido pelo time: até 1 dB de margem.
 */
export const ATTENUATION_MAX_MARGIN_DB = 1

/**
 * Fase 2: compara o sinal atual (`rxPower`) com o projetado da porta.
 * Retorna 'unknown' enquanto não houver `projectedRxPower`.
 * Mais negativo que o projetado além da margem → atenuação (alerta).
 */
export function deriveAttenuation(
  d: OnuDiagnostic | null | undefined,
): { level: OnuAttenuationLevel; deltaDb: number | null } {
  // rxPower === 0 = sem sinal (LOS): comparar com o projetado não faz sentido.
  if (!d || d.rxPower == null || d.rxPower === 0 || d.projectedRxPower == null) {
    return { level: 'unknown', deltaDb: null }
  }
  // Quanto o sinal atual está abaixo do projetado (perda em dB, positivo = pior).
  const deltaDb = d.projectedRxPower - d.rxPower
  if (deltaDb <= ATTENUATION_MAX_MARGIN_DB) return { level: 'ok', deltaDb }
  if (deltaDb <= ATTENUATION_MAX_MARGIN_DB + 2) return { level: 'warning', deltaDb }
  return { level: 'critical', deltaDb }
}

/**
 * Formata uma idade em segundos como "agora", "há 3 min", "há 2 h 10 min",
 * "há 4 d". Negativos (pequena diferença de relógio) viram "agora".
 */
export function formatAgo(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null
  const s = Math.max(0, Math.round(seconds))
  if (s < 45) return 'agora'
  const min = Math.round(s / 60)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  const remMin = min % 60
  if (h < 24) return remMin > 0 ? `há ${h} h ${remMin} min` : `há ${h} h`
  const d = Math.floor(h / 24)
  return `há ${d} d`
}

/** Rótulo curto em pt-BR para o estado da ONU. */
export function onuStatusLabel(status: OnuSignalStatus): string {
  switch (status) {
    case 'online':
      return 'Online'
    case 'degraded':
      return 'Sinal atenuado'
    case 'offline':
      return 'Offline'
    default:
      return 'Sem dados'
  }
}
