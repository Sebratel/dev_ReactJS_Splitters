/**
 * Visão de frota de equipamentos (patrimônios) — agregações do banco principal,
 * expostas pelo BFF em `GET /api/equipamentos/overview`.
 *
 * Fase 1: parque, tipo, geografia e qualidade de cadastro (só `patrimonies`).
 * Fase 2 (futura): saúde de sinal por modelo/bairro, cruzando com a ONU.
 */

export type EquipmentModelCount = { model: string; count: number }
export type EquipmentStatusCount = { status: string; count: number }

export type EquipmentOverviewTotals = {
  totalPatrimonies: number
  distinctClients: number
  distinctModels: number
  withoutSerial: number
  withoutMac: number
  duplicateMacGroups: number
  duplicateMacUnits: number
}

export type EquipmentOverview = {
  totals: EquipmentOverviewTotals
  byModel: EquipmentModelCount[]
  byContractStatus: EquipmentStatusCount[]
}

/** Tipo de equipamento derivado da descrição (title) do patrimônio. */
export type EquipmentType = 'onu' | 'roteador' | 'outros'

export const EQUIPMENT_TYPE_LABEL: Record<EquipmentType, string> = {
  onu: 'ONU / ONT',
  roteador: 'Roteador',
  outros: 'Outros',
}

const ONU_HINTS = ['onu', 'ont', 'fiberhome', 'gpon', 'epon']
const ROUTER_HINTS = [
  'roteador',
  'router',
  'wi-fi',
  'wifi',
  'wireless',
  'mesh',
  'rb',
  'mikrotik',
  'tp-link',
  'tplink',
  'archer',
  'ac12',
  'ac120',
  'huawei ws',
]

/** Classifica um modelo pela descrição. ONU tem prioridade sobre roteador. */
export function classifyEquipmentType(title: string | null | undefined): EquipmentType {
  const t = (title ?? '').toLowerCase()
  if (ONU_HINTS.some((h) => t.includes(h))) return 'onu'
  if (ROUTER_HINTS.some((h) => t.includes(h))) return 'roteador'
  return 'outros'
}

/** Agrega a contagem por modelo em tipos derivados. */
export function aggregateByType(
  byModel: readonly EquipmentModelCount[],
): Array<{ type: EquipmentType; count: number }> {
  const acc: Record<EquipmentType, number> = { onu: 0, roteador: 0, outros: 0 }
  for (const row of byModel) {
    acc[classifyEquipmentType(row.model)] += row.count
  }
  return (['onu', 'roteador', 'outros'] as EquipmentType[])
    .map((type) => ({ type, count: acc[type] }))
    .filter((r) => r.count > 0)
}

/**
 * Curva de Pareto sobre o ranking de modelos: cada item recebe o percentual
 * individual e o acumulado. Útil para "os N modelos no topo são X% da base".
 */
export type ParetoModelRow = EquipmentModelCount & {
  share: number
  cumulativeShare: number
}

export function buildModelPareto(
  byModel: readonly EquipmentModelCount[],
): ParetoModelRow[] {
  const total = byModel.reduce((sum, r) => sum + r.count, 0)
  if (total <= 0) return []
  let running = 0
  return byModel.map((row) => {
    running += row.count
    return {
      ...row,
      share: (row.count / total) * 100,
      cumulativeShare: (running / total) * 100,
    }
  })
}
