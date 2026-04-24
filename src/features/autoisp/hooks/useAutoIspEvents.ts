import { useQuery } from '@tanstack/react-query'
import { fetchAutoIspEvents } from '@/features/autoisp/api/fetchAutoIspEvents'
import { isAutoIspBrowserReady } from '@/shared/config/env'

/**
 * Hook para monitoramento de eventos operacionais ativos no AutoISP.
 * Implementa polling automático para paridade com o Timer.periodic do Flutter.
 */
export function useAutoIspEvents() {
  const ready = isAutoIspBrowserReady()

  return useQuery({
    queryKey: ['autoisp', 'events'],
    queryFn: () => fetchAutoIspEvents(),
    enabled: ready,
    
    // Polling de 5 minutos (300.000 ms) - paridade com Flutter
    refetchInterval: 5 * 60 * 1000,
    
    // Mantém os dados "frescos" por 1 minuto para evitar re-fetches agressivos
    staleTime: 60 * 1000,
    
    // Continua tentando em caso de falha de rede (retries padrão do TanStack Query)
    retry: 2,

    // Metadata para depuração facilitada
    meta: {
      feature: 'AutoISP',
      description: 'Active network events polling',
    },
  })
}
