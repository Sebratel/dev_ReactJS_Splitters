import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

export type SplitterCorpResInventory = { corporate: number; residential: number }

/**
 * Conta clientes corporativos vs residenciais por código de splitter (base local / listarConnections).
 */
export function countCorporateResidentialBySplitterCode(
  connections: readonly SplitterCliente[],
): Map<string, SplitterCorpResInventory> {
  const map = new Map<string, SplitterCorpResInventory>()
  for (const c of connections) {
    const code = c.splitterCode?.trim()
    if (!code) continue
    let bucket = map.get(code)
    if (bucket === undefined) {
      bucket = { corporate: 0, residential: 0 }
      map.set(code, bucket)
    }
    if (c.isCorporate === true) bucket.corporate += 1
    else bucket.residential += 1
  }
  return map
}

/**
 * Distribuição inteira proporcional (maiores restos após `floor` das quotas Hare).
 */
function allocateIntegerByWeights(n: number, wCorp: number, wRes: number): [number, number] {
  const w = wCorp + wRes
  if (w <= 0 || n <= 0) return [0, 0]

  const qc = (n * wCorp) / w
  const qr = (n * wRes) / w
  let corp = Math.floor(qc)
  let res = Math.floor(qr)
  let rem = n - corp - res

  while (rem > 0) {
    const fc = qc - corp
    const fr = qr - res
    if (fc >= fr && corp < wCorp) {
      corp += 1
      rem -= 1
    } else if (res < wRes) {
      res += 1
      rem -= 1
    } else if (corp < wCorp) {
      corp += 1
      rem -= 1
    } else {
      break
    }
  }

  return [corp, res]
}

/**
 * Estima discriminação quando a API de massiva não envia PF/PJ, mas conhecemos o inventário no splitter.
 *
 * - Se `n` ≥ total de clientes no splitter, assume indisponibilidade total do splitter e devolve o inventário.
 * - Caso contrário, repartição proporcional com arredondamento justo.
 */
export function inferAffectedResidentialCorporateFromSplitterInventory(
  affectedTotal: number,
  inventory: SplitterCorpResInventory | undefined,
): { residential: number; corporate: number } | null {
  if (inventory == null) return null
  const corpInv = Math.max(0, inventory.corporate)
  const resInv = Math.max(0, inventory.residential)
  const invTotal = corpInv + resInv
  if (invTotal <= 0 || affectedTotal <= 0) return null

  if (affectedTotal >= invTotal) {
    return { corporate: corpInv, residential: resInv }
  }

  const [corp, res] = allocateIntegerByWeights(affectedTotal, corpInv, resInv)
  return { corporate: corp, residential: res }
}
