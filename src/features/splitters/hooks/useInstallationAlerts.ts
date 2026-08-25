import { useQuery } from '@tanstack/react-query'
import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { PendingFloorInfoItem } from '@/features/splitters/api/fetchCondoRedistributionFromLocalDb'

// ── Tipos ────────────────────────────────────────────────────────────────────

export type CategoriaProtocolo = 'INSTALACAO' | 'MANUTENCAO'

export type InstallationAlert = {
  protocolo: string
  pppoe: string
  cliente: string
  splitter: string
  tipoProtocolo: string
  categoria: CategoriaProtocolo
}

// ── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchInstallationAlerts(pppoes: string[]): Promise<InstallationAlert[]> {
  if (pppoes.length === 0) return []

  const url = `${env.bffBaseUrl}/api/v1/splitters/alertas-protocolo-pendente`

  const response = await fetchWithSessionAuth(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pppoes }),
  })

  if (!response.ok) {
    throw new Error(`Erro ao verificar alertas de protocolo: ${response.status}`)
  }

  return response.json() as Promise<InstallationAlert[]>
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Cruza a lista de pendências de andar com protocolos de instalação/manutenção
 * em aberto no Elleven. Atualiza automaticamente a cada 10 minutos.
 *
 * @param pendingItems - lista de pendências de andar (saída do endpoint de redistribuição)
 * @param enabled      - false desativa a query (ex: dados ainda carregando)
 */
export function useInstallationAlerts(
  pendingItems: PendingFloorInfoItem[] | undefined,
  enabled = true,
) {
  // Extrai todos os PPPoEs únicos da lista de pendências
  const pppoes = pendingItems
    ? [...new Set(pendingItems.map((p) => p.client.pppoeUser).filter(Boolean))]
    : []

  return useQuery<InstallationAlert[]>({
    queryKey: ['installation-alerts', pppoes],
    queryFn: () => fetchInstallationAlerts(pppoes),
    enabled: enabled && pppoes.length > 0,
    // Atualiza a cada 10 minutos — janela suficiente para o técnico ser notificado
    refetchInterval: 10 * 60_000,
    staleTime: 9 * 60_000,
    refetchOnWindowFocus: false,
    // Não propaga erro — alerta é best-effort, não pode quebrar a tela principal
    retry: 1,
  })
}
