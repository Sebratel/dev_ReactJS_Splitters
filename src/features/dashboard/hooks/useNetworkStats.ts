import { useQuery } from '@tanstack/react-query';
import { fetchNetworkStats } from '@/shared/api/fetchNetworkStats';

export function useNetworkStats() {
  return useQuery({
    queryKey: ['network', 'stats'],
    queryFn: fetchNetworkStats,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
}
