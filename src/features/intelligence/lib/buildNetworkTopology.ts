/**
 * Agrega o ranking de risco em uma árvore de topologia OLT → Slot → PON.
 *
 * O dado de slot/PON vem do cadastro do splitter (`SLOT[SPLT.SECUNDARIO]` /
 * `PORTA EXTRAÍDA[SPLT.SECUNDARIO]`), já presente na resposta do BFF — esta
 * agregação é 100% client-side, sem novas chamadas de rede.
 *
 * Cada nível carrega as mesmas métricas de pressão operacional (ocupação,
 * crescimento, massivas, pior faixa de risco) para sustentar o storytelling
 * "navegue até a PON exata que está sofrendo".
 */

export type TopologyRiskBand = 'critico' | 'alto' | 'moderado' | 'baixo'

/** Shape mínimo consumido — estruturalmente compatível com IntelligenceRiskRankingRow. */
export type TopologyInputRow = {
  splitterCode: string
  splitterTitle: string
  oltCode: string | null
  oltDescription: string | null
  oltSlot: number | null
  oltPort: number | null
  currentUsagePercent: number
  selectedDelta: number
  openTickets: number
  totalTickets: number
  affectedClientsTotal: number
  riskBand: TopologyRiskBand
}

/** Resumo de sinal ONU por splitter — shape mínimo (compatível com OnuSplitterSignalSummary). */
export type TopologySignalInput = {
  total: number
  online: number
  degraded: number
  offline: number
  avgRxPower: number | null
}

export type TopologyMetrics = {
  splitters: number
  criticalSplitters: number
  /** Ocupação média ponderada simples entre os splitters do nó. */
  avgUsagePercent: number
  /** Maior ocupação observada no nó (o "pior" splitter). */
  maxUsagePercent: number
  avgDeltaReference: number
  openTickets: number
  totalTickets: number
  affectedClientsTotal: number
  /** Pior faixa de risco encontrada no nó (para o badge agregado). */
  worstRiskBand: TopologyRiskBand
  /** ONUs monitoradas no nó (soma entre os splitters com dados de sinal). */
  monitoredOnus: number
  onlineOnus: number
  degradedOnus: number
  offlineOnus: number
  /** RX médio (dBm) ponderado pelo nº de ONUs com leitura; null se nenhum splitter tem sinal. */
  avgRxPower: number | null
}

export type TopologyPonNode = TopologyMetrics & {
  /** Rótulo da PON (porta extraída) ou sentinel quando ausente. */
  pon: string
  hasPon: boolean
  rows: TopologyInputRow[]
}

export type TopologySlotNode = TopologyMetrics & {
  slot: string
  hasSlot: boolean
  pons: TopologyPonNode[]
}

export type TopologyOltNode = TopologyMetrics & {
  oltCode: string
  oltDescription: string
  slots: TopologySlotNode[]
}

const RISK_SEVERITY: Record<TopologyRiskBand, number> = {
  baixo: 0,
  moderado: 1,
  alto: 2,
  critico: 3,
}

const NO_SLOT = 'SEM_SLOT'
const NO_PON = 'SEM_PON'
const NO_OLT = 'SEM_OLT'

function worseBand(a: TopologyRiskBand, b: TopologyRiskBand): TopologyRiskBand {
  return RISK_SEVERITY[b] > RISK_SEVERITY[a] ? b : a
}

/** Acumulador interno (somatórios) antes de calcular as médias. */
type Accumulator = {
  splitters: number
  criticalSplitters: number
  sumUsage: number
  maxUsagePercent: number
  sumDelta: number
  openTickets: number
  totalTickets: number
  affectedClientsTotal: number
  worstRiskBand: TopologyRiskBand
  monitoredOnus: number
  onlineOnus: number
  degradedOnus: number
  offlineOnus: number
  /** Σ (rx médio × peso) e Σ peso para a média ponderada de RX. */
  rxWeightedSum: number
  rxWeight: number
}

function newAccumulator(): Accumulator {
  return {
    splitters: 0,
    criticalSplitters: 0,
    sumUsage: 0,
    maxUsagePercent: 0,
    sumDelta: 0,
    openTickets: 0,
    totalTickets: 0,
    affectedClientsTotal: 0,
    worstRiskBand: 'baixo',
    monitoredOnus: 0,
    onlineOnus: 0,
    degradedOnus: 0,
    offlineOnus: 0,
    rxWeightedSum: 0,
    rxWeight: 0,
  }
}

function accumulate(acc: Accumulator, row: TopologyInputRow, signal: TopologySignalInput | undefined): void {
  acc.splitters += 1
  if (row.currentUsagePercent >= 95) acc.criticalSplitters += 1
  acc.sumUsage += row.currentUsagePercent
  if (row.currentUsagePercent > acc.maxUsagePercent) acc.maxUsagePercent = row.currentUsagePercent
  acc.sumDelta += row.selectedDelta
  acc.openTickets += row.openTickets
  acc.totalTickets += row.totalTickets
  acc.affectedClientsTotal += row.affectedClientsTotal
  acc.worstRiskBand = worseBand(acc.worstRiskBand, row.riskBand)
  if (signal) {
    acc.monitoredOnus += signal.total
    acc.onlineOnus += signal.online
    acc.degradedOnus += signal.degraded
    acc.offlineOnus += signal.offline
    // Peso = ONUs com leitura válida (operantes ≈ online + atenuado); offline não tem RX.
    const weight = signal.online + signal.degraded
    if (signal.avgRxPower != null && weight > 0) {
      acc.rxWeightedSum += signal.avgRxPower * weight
      acc.rxWeight += weight
    }
  }
}

function toMetrics(acc: Accumulator): TopologyMetrics {
  const denom = Math.max(1, acc.splitters)
  return {
    splitters: acc.splitters,
    criticalSplitters: acc.criticalSplitters,
    avgUsagePercent: Number((acc.sumUsage / denom).toFixed(1)),
    maxUsagePercent: Number(acc.maxUsagePercent.toFixed(1)),
    avgDeltaReference: Number((acc.sumDelta / denom).toFixed(2)),
    openTickets: acc.openTickets,
    totalTickets: acc.totalTickets,
    affectedClientsTotal: acc.affectedClientsTotal,
    worstRiskBand: acc.worstRiskBand,
    monitoredOnus: acc.monitoredOnus,
    onlineOnus: acc.onlineOnus,
    degradedOnus: acc.degradedOnus,
    offlineOnus: acc.offlineOnus,
    avgRxPower: acc.rxWeight > 0 ? Number((acc.rxWeightedSum / acc.rxWeight).toFixed(1)) : null,
  }
}

/** Ordena nós por pressão: críticos > ocupação máx > massivas abertas. */
function compareByPressure(a: TopologyMetrics, b: TopologyMetrics): number {
  return (
    b.criticalSplitters - a.criticalSplitters ||
    b.maxUsagePercent - a.maxUsagePercent ||
    b.openTickets - a.openTickets ||
    b.totalTickets - a.totalTickets ||
    b.splitters - a.splitters
  )
}

/** Slots/PONs numéricos ordenam naturalmente; sentinels vão para o fim. */
function compareLabelNumeric(a: string, b: string): number {
  const na = Number.parseInt(a, 10)
  const nb = Number.parseInt(b, 10)
  const aNum = Number.isFinite(na)
  const bNum = Number.isFinite(nb)
  if (aNum && bNum) return na - nb
  if (aNum) return -1
  if (bNum) return 1
  return a.localeCompare(b)
}

export function buildNetworkTopology(
  rows: readonly TopologyInputRow[],
  signalByCode?: ReadonlyMap<string, TopologySignalInput>,
): TopologyOltNode[] {
  type SlotBucket = { slot: string; hasSlot: boolean; acc: Accumulator; pons: Map<string, { pon: string; hasPon: boolean; acc: Accumulator; rows: TopologyInputRow[] }> }
  type OltBucket = { oltCode: string; oltDescription: string; acc: Accumulator; slots: Map<string, SlotBucket> }

  const olts = new Map<string, OltBucket>()

  for (const row of rows) {
    const signal = signalByCode?.get(row.splitterCode)
    const oltKey = row.oltCode?.trim() || row.oltDescription?.trim() || NO_OLT
    let olt = olts.get(oltKey)
    if (!olt) {
      olt = {
        oltCode: row.oltCode?.trim() || NO_OLT,
        oltDescription: row.oltDescription?.trim() || 'OLT não informada',
        acc: newAccumulator(),
        slots: new Map(),
      }
      olts.set(oltKey, olt)
    }
    accumulate(olt.acc, row, signal)

    const hasSlot = row.oltSlot != null && Number.isFinite(row.oltSlot)
    const slotKey = hasSlot ? String(row.oltSlot) : NO_SLOT
    let slot = olt.slots.get(slotKey)
    if (!slot) {
      slot = { slot: slotKey, hasSlot, acc: newAccumulator(), pons: new Map() }
      olt.slots.set(slotKey, slot)
    }
    accumulate(slot.acc, row, signal)

    const hasPon = row.oltPort != null && Number.isFinite(row.oltPort)
    const ponKey = hasPon ? String(row.oltPort) : NO_PON
    let pon = slot.pons.get(ponKey)
    if (!pon) {
      pon = { pon: ponKey, hasPon, acc: newAccumulator(), rows: [] }
      slot.pons.set(ponKey, pon)
    }
    accumulate(pon.acc, row, signal)
    pon.rows.push(row)
  }

  return [...olts.values()]
    .map((olt) => ({
      oltCode: olt.oltCode,
      oltDescription: olt.oltDescription,
      ...toMetrics(olt.acc),
      slots: [...olt.slots.values()]
        .map((slot) => ({
          slot: slot.slot,
          hasSlot: slot.hasSlot,
          ...toMetrics(slot.acc),
          pons: [...slot.pons.values()]
            .map((pon) => ({
              pon: pon.pon,
              hasPon: pon.hasPon,
              ...toMetrics(pon.acc),
              rows: [...pon.rows].sort((a, b) => b.currentUsagePercent - a.currentUsagePercent),
            }))
            .sort((a, b) => compareLabelNumeric(a.pon, b.pon)),
        }))
        .sort((a, b) => compareLabelNumeric(a.slot, b.slot)),
    }))
    .sort(compareByPressure)
}
