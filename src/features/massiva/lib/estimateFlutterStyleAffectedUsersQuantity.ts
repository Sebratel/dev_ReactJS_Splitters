import { filterConnectionsBySplitterCode } from '@/features/massiva/lib/filterConnectionsBySplitterCode'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/**
 * Paridade `_estimatedAffectedClients` em `massiva_screen.dart` (únicos `authenticationId` &gt; 0
 * entre todos os clientes dos splitters selecionados na descrição, **sem** filtrar por rota).
 */
export function estimateFlutterStyleAffectedUsersQuantity(
  effectiveSplitterCodes: readonly string[],
  connections: readonly SplitterCliente[],
): number {
  const seen = new Set<number>()
  const list = [...connections]
  for (const code of effectiveSplitterCodes) {
    for (const c of filterConnectionsBySplitterCode(list, code)) {
      if (c.authenticationId > 0) {
        seen.add(c.authenticationId)
      }
    }
  }
  return seen.size
}
