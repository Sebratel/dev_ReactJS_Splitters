import { env } from '@/shared/config/env';
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

/** Mesma chave em `useNetworkStats` e no painel de inteligência — evita GET duplicado ao mudar de rota. */
export const NETWORK_STATS_QUERY_KEY = ['network', 'stats'] as const

/** Faixas de ocupação no catálogo (paridade `resolveSplitterStatus` / filtros da lista). */
export type EquipmentOccupancyBands = {
  /** Normal — até 70% */
  green: number
  /** Alerta — 71% a 99% */
  yellow: number
  /** Crítico (100%) ou excedente (>100%) */
  red: number
}

/** % vs última captura diária anterior (BFF: `dashboard_kpi_daily`). Ausente até existir histórico. */
export type NetworkStatsTrends = {
  occupiedPortsPct: number
  activeSplittersPct: number
  oltCountPct: number
  massivaOpenPct: number
  massivaAffectedOpenPct: number
}

export type NetworkStats = {
  activeSplitters: number
  onlineClients: number
  /** OLTs ativos com código (paridade critérios GET /api/olts). */
  oltCount: number
  equipmentOccupancy: EquipmentOccupancyBands
  trends: NetworkStatsTrends | null
}

export async function fetchNetworkStats(): Promise<NetworkStats> {
  const url = `${env.localBffUrl}/api/stats`;
  const response = await fetchWithSessionAuth(url);
  if (!response.ok) throw new Error('Falha ao buscar estatísticas de rede');
  
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Erro desconhecido nas estatísticas');

  const d = result.data as Record<string, unknown>
  const n = (v: unknown) => {
    const x = Number(v ?? 0)
    return Number.isFinite(x) ? x : 0
  }
  const tRaw = result.trends as Record<string, unknown> | null | undefined
  const trends: NetworkStatsTrends | null =
    tRaw != null && typeof tRaw === 'object'
      ? {
          occupiedPortsPct: n(tRaw.occupied_ports_pct),
          activeSplittersPct: n(tRaw.active_splitters_pct),
          oltCountPct: n(tRaw.olt_count_pct),
          massivaOpenPct: n(tRaw.massiva_open_pct),
          massivaAffectedOpenPct: n(tRaw.massiva_affected_open_pct),
        }
      : null

  return {
    activeSplitters: n(d.catalog_equipment ?? d.active_splitters),
    onlineClients: n(d.occupied_ports ?? d.online_clients),
    oltCount: n(d.olt_count ?? d.oltCount),
    equipmentOccupancy: {
      green: n(d.equipment_occupancy_green ?? d.equipmentOccupancyGreen),
      yellow: n(d.equipment_occupancy_yellow ?? d.equipmentOccupancyYellow),
      red: n(d.equipment_occupancy_red ?? d.equipmentOccupancyRed),
    },
    trends,
  }
}
