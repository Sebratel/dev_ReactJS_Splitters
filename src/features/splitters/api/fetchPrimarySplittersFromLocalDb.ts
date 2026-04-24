import { env } from '@/shared/config/env'

export async function fetchPrimarySplittersFromLocalDb(): Promise<string[]> {
  const url = `${env.localBffUrl}/api/splitters/primarios`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Erro ao consultar splitters primários no BFF Local: ${response.status}`,
    )
  }

  const result = await response.json()
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('Formato de resposta inesperado ao listar splitters primários.')
  }

  return result.data
     .map((row: Record<string, unknown>) => String(row.title ?? '').trim())
    .filter((title: string) => title !== '')
}

