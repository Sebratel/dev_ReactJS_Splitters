import { QueryClient } from '@tanstack/react-query'

/**
 * Instância única do QueryClient (testes podem substituir via wrapper ou mock).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
