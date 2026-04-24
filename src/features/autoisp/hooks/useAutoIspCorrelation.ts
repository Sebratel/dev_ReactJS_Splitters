import { useMemo } from 'react'
import type { AutoIspEvent } from '@/features/autoisp/model/autoIsp.types'
import type { ResolvedAutoIspRoute, TopologyIndices } from '@/features/autoisp/model/topology.types'
import type { Splitter } from '@/features/splitters/model/splitter'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import { buildTopologyIndices } from '@/features/autoisp/lib/buildTopologyIndices'
import { resolveRouteFromEvent } from '@/features/autoisp/lib/correlation'

type UseAutoIspCorrelationProps = {
  events: AutoIspEvent[]
  /**
   * Índices já montados a partir de conexões (ex.: Massiva com `listarConnections`).
   * Quando informado, `splitters` / `getClientesForSplitter` são ignorados.
   */
  topologyIndices?: TopologyIndices
  splitters?: Splitter[]
  getClientesForSplitter?: (splitterCode: string) => SplitterCliente[]
}

export interface CorrelatedEvent {
  event: AutoIspEvent
  route: ResolvedAutoIspRoute
}

/**
 * Hook que correlaciona eventos do AutoISP com a topologia conhecida.
 * Retorna os eventos "casados" com uma rota técnica (AP/Slot/Port).
 */
export function useAutoIspCorrelation({
  events,
  topologyIndices,
  splitters = [],
  getClientesForSplitter = () => [],
}: UseAutoIspCorrelationProps) {
  // 1. Índices: conexões prontas (Massiva) ou catálogo splitters + clientes (outras telas)
  const indices = useMemo<TopologyIndices>(() => {
    if (topologyIndices) return topologyIndices
    return buildTopologyIndices(splitters, getClientesForSplitter)
  }, [topologyIndices, splitters, getClientesForSplitter])

  // 2. Correlaciona os eventos atuais com a topologia indexada
  const correlatedEvents = useMemo<CorrelatedEvent[]>(() => {
    if (events.length === 0) return []

    const results: CorrelatedEvent[] = []
    
    for (const event of events) {
      const route = resolveRouteFromEvent(event, indices)
      if (route) {
        results.push({ event, route })
      }
    }

    return results
  }, [events, indices])

  return {
    indices,
    correlatedEvents,
    hasMatches: correlatedEvents.length > 0,
  }
}
