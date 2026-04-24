import type { MassivaLocalPreviewTotals } from '@/features/massiva/model/massivaLocalPreview'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

export function massivaPreviewTotalsFromClientes(
  clientes: readonly SplitterCliente[],
): MassivaLocalPreviewTotals {
  const seenPppoes = new Set<string>()
  let totalCorporateAffected = 0
  for (const c of clientes) {
    const p = c.user.trim().toLowerCase()
    if (p !== '') seenPppoes.add(p)
    if (c.isCorporate === true) totalCorporateAffected += 1
  }
  return {
    totalAffected: clientes.length,
    totalPppoes: seenPppoes.size,
    totalCorporateAffected,
  }
}
