import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export async function reconcileMassivaLocalClosedProtocols(
  protocols: readonly number[],
  options?: { closeDescription?: string },
): Promise<number> {
  const unique = [...new Set(protocols.filter((p) => Number.isFinite(p) && p > 0).map(Math.trunc))]
  if (unique.length === 0) return 0

  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/mark-closed-by-protocols`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify({
        protocols: unique,
        closeDescription:
          options?.closeDescription?.trim() ||
          'Sincronizado com status encerrado no Elleven (listagem BFF).',
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Erro ao sincronizar encerramentos locais: ${response.status}`)
  }

  const parsed = await response.json()
  return Number(parsed?.data?.updated ?? 0)
}
