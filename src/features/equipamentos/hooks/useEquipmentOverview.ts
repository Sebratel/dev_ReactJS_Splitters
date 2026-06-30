import { useQuery } from '@tanstack/react-query'
import { fetchEquipmentOverview } from '@/features/equipamentos/api/fetchEquipmentOverview'
import type { EquipmentOverview } from '@/features/equipamentos/model/equipmentOverview'

export const equipamentosKeys = {
  all: ['equipamentos'] as const,
  overview: () => [...equipamentosKeys.all, 'overview'] as const,
}

/**
 * Visão agregada da frota de equipamentos. Dado cadastral — muda devagar, então
 * cache longo (5 min) sem polling.
 */
export function useEquipmentOverview() {
  return useQuery<EquipmentOverview>({
    queryKey: equipamentosKeys.overview(),
    queryFn: ({ signal }) => fetchEquipmentOverview(signal),
    staleTime: 5 * 60_000,
  })
}
