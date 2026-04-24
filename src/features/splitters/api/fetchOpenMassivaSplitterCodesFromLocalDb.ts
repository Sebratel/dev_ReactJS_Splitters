import { env } from '@/shared/config/env'

export async function fetchOpenMassivaSplitterCodesFromLocalDb(): Promise<string[]> {
  const response = await fetch(`${env.localBffUrl}/api/massiva/history/open-splitter-codes`)
  if (!response.ok) {
    throw new Error(`Erro ao consultar splitters com massiva aberta no BFF Local: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success || !Array.isArray(parsed.data)) {
    throw new Error('Formato de resposta inesperado ao consultar splitters com massiva aberta.')
  }

  return parsed.data
    .map((item: unknown) => String(item ?? '').trim())
    .filter((item: string) => item !== '')
}
