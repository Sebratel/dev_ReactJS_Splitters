import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import type { SplitterNeighborOccupancyBand } from '@/features/splitters/model/splitterMap'

function countConnectionsForSplitter(
  connections: SplitterCliente[],
  splitterCode: string,
): number {
  let n = 0
  for (const c of connections) {
    if (c.splitterCode === splitterCode) n += 1
  }
  return n
}

export function occupancyBandForUsage(
  busyCount: number,
  outPorts: number,
): SplitterNeighborOccupancyBand {
  if (outPorts <= 0) return 'unknown'

  const percentual = (busyCount / outPorts) * 100

  if (percentual >= 90) return 'critical'
  if (percentual >= 70) return 'warning'
  return 'ok'
}

export function occupancyBandForNeighbor(
  splitterCode: string,
  outPorts: number,
  connections: SplitterCliente[] | undefined,
): SplitterNeighborOccupancyBand {
  if (connections === undefined) return 'unknown'
  return occupancyBandForUsage(
    countConnectionsForSplitter(connections, splitterCode),
    outPorts,
  )
}
