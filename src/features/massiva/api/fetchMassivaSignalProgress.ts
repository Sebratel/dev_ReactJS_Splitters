import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type MassivaSignalProgress = { recovered: number; total: number }

/**
 * Progresso de recuperação de sinal por massiva (batch, leve): dado o conjunto de
 * protocolos abertos, retorna { recovered, total } de cada — sem nome/telefone.
 * Uma única consulta ao banco de ONU para todos os pppoe. Para o painel ao vivo.
 */
export async function fetchMassivaSignalProgress(
  items: { protocol: number; assignmentId: number | null }[],
): Promise<Map<number, MassivaSignalProgress>> {
  const out = new Map<number, MassivaSignalProgress>()
  if (items.length === 0) return out

  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/affected-signal-progress`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify({ items }),
    },
  )

  if (!response.ok) throw new Error(`Erro ao consultar progresso de sinal: ${response.status}`)
  const parsed = await response.json()
  if (!parsed?.success || parsed?.data == null) return out

  for (const [key, value] of Object.entries(
    parsed.data as Record<string, { total?: unknown; recovered?: unknown }>,
  )) {
    const protocol = Number(key)
    if (!Number.isFinite(protocol)) continue
    out.set(protocol, {
      total: Number(value?.total ?? 0),
      recovered: Number(value?.recovered ?? 0),
    })
  }
  return out
}
