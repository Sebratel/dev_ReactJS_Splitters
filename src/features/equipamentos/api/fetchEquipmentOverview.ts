import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type {
  EquipmentOverview,
  EquipmentModelCount,
  EquipmentStatusCount,
} from '@/features/equipamentos/model/equipmentOverview'

function toNum(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function parseOverview(raw: Record<string, unknown>): EquipmentOverview {
  const totals = (raw.totals ?? {}) as Record<string, unknown>
  const byModel = Array.isArray(raw.byModel) ? raw.byModel : []
  const byContractStatus = Array.isArray(raw.byContractStatus) ? raw.byContractStatus : []

  return {
    totals: {
      totalPatrimonies: toNum(totals.totalPatrimonies),
      distinctClients: toNum(totals.distinctClients),
      distinctModels: toNum(totals.distinctModels),
      withoutSerial: toNum(totals.withoutSerial),
      withoutMac: toNum(totals.withoutMac),
      duplicateMacGroups: toNum(totals.duplicateMacGroups),
      duplicateMacUnits: toNum(totals.duplicateMacUnits),
    },
    byModel: byModel.map((r): EquipmentModelCount => ({
      model: toText((r as Record<string, unknown>).model) || '(sem descrição)',
      count: toNum((r as Record<string, unknown>).count),
    })),
    byContractStatus: byContractStatus.map((r): EquipmentStatusCount => ({
      status: toText((r as Record<string, unknown>).status) || '(sem status)',
      count: toNum((r as Record<string, unknown>).count),
    })),
  }
}

/** Visão agregada da frota de equipamentos (patrimônios) da rede. */
export async function fetchEquipmentOverview(
  signal?: AbortSignal,
): Promise<EquipmentOverview> {
  const url = `${env.localBffUrl}/api/equipamentos/overview`
  const response = await fetchWithSessionAuth(url, { signal })

  if (!response.ok) {
    throw new Error(`Erro ao consultar overview de equipamentos: ${response.status}`)
  }

  const result = await response.json()
  if (!result?.success || !result.data) {
    throw new Error('Formato de resposta inesperado do BFF (equipamentos).')
  }

  return parseOverview(result.data as Record<string, unknown>)
}
