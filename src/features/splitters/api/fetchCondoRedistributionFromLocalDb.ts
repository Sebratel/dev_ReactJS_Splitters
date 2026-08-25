import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

// ── Types ───────────────────────────────────────────────────────────────────────

export type CondoRedistributionClient = {
  name: string
  pppoeUser: string
  complement: string
  floor: number
  block: string | null
  street: string
  number: string
  phone: string
  connectionId: number | null
}

export type CondoRedistributionSplitter = {
  code: string
  title: string
  floor: number | null
  block: string | null
  availablePorts?: number
}

export type CondoRedistributionOpportunity = {
  client: CondoRedistributionClient
  currentSplitter: CondoRedistributionSplitter
  suggestedSplitter: CondoRedistributionSplitter & { availablePorts: number }
  floorDifference: {
    current: number
    suggested: number
    improvement: number
  }
  condoName: string
}

export type CondoRedistributionStats = {
  condos: number
  splitters: number
  clientsAnalyzed: number
  opportunitiesFound: number
  pendingCount: number
}

export type PendingFloorInfoReason = 'splitter_sem_andar' | 'cliente_sem_complemento'

export type PendingFloorInfoItem = {
  client: {
    name: string
    pppoeUser: string
    complement: string
    phone: string
    connectionId: number | null
  }
  currentSplitter: {
    code: string
    title: string
  }
  condoName: string
  pendingReason: PendingFloorInfoReason
}

export type CondoRedistributionData = {
  opportunities: CondoRedistributionOpportunity[]
  pendingFloorInfo: PendingFloorInfoItem[]
  stats: CondoRedistributionStats
}

// ── Fetcher ─────────────────────────────────────────────────────────────────────

export async function fetchCondoRedistributionFromLocalDb(): Promise<CondoRedistributionData> {
  const url = new URL(
    `${env.localBffUrl}/api/splitters/condo-redistribution`,
    window.location.origin,
  )

  const response = await fetchWithSessionAuth(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Erro ao consultar redistribuição de condomínio: ${response.status}`)
  }

  const result = await response.json()
  if (!result.success) {
    throw new Error(result.error ?? 'Formato de resposta inesperado na análise de redistribuição.')
  }

  const opportunities: CondoRedistributionOpportunity[] = (
    (result.opportunities ?? []) as unknown[]
  ).map((raw) => {
    const row = raw as Record<string, unknown>
    const client = row.client as Record<string, unknown>
    const current = row.currentSplitter as Record<string, unknown>
    const suggested = row.suggestedSplitter as Record<string, unknown>
    const diff = row.floorDifference as Record<string, unknown>

    return {
      client: {
        name: String(client?.name ?? '').trim(),
        pppoeUser: String(client?.pppoeUser ?? '').trim(),
        complement: String(client?.complement ?? '').trim(),
        floor: Number(client?.floor ?? 0),
        block: client?.block ? String(client.block).trim() : null,
        street: String(client?.street ?? '').trim(),
        number: String(client?.number ?? '').trim(),
        phone: String(client?.phone ?? '').trim(),
        connectionId: client?.connectionId != null ? Number(client.connectionId) : null,
      },
      currentSplitter: {
        code: String(current?.code ?? '').trim(),
        title: String(current?.title ?? '').trim(),
        floor: Number(current?.floor ?? 0),
        block: current?.block ? String(current.block).trim() : null,
      },
      suggestedSplitter: {
        code: String(suggested?.code ?? '').trim(),
        title: String(suggested?.title ?? '').trim(),
        floor: Number(suggested?.floor ?? 0),
        block: suggested?.block ? String(suggested.block).trim() : null,
        availablePorts: Number(suggested?.availablePorts ?? 0),
      },
      floorDifference: {
        current: Number(diff?.current ?? 0),
        suggested: Number(diff?.suggested ?? 0),
        improvement: Number(diff?.improvement ?? 0),
      },
      condoName: String(row.condoName ?? '').trim(),
    }
  })

  const pendingFloorInfo: PendingFloorInfoItem[] = (
    (result.pendingFloorInfo ?? []) as unknown[]
  ).map((raw) => {
    const row = raw as Record<string, unknown>
    const client = row.client as Record<string, unknown>
    const current = row.currentSplitter as Record<string, unknown>
    return {
      client: {
        name: String(client?.name ?? '').trim(),
        pppoeUser: String(client?.pppoeUser ?? '').trim(),
        complement: String(client?.complement ?? '').trim(),
        phone: String(client?.phone ?? '').trim(),
        connectionId: client?.connectionId != null ? Number(client.connectionId) : null,
      },
      currentSplitter: {
        code: String(current?.code ?? '').trim(),
        title: String(current?.title ?? '').trim(),
      },
      condoName: String(row.condoName ?? '').trim(),
      pendingReason: (row.pendingReason as PendingFloorInfoReason) ?? 'cliente_sem_complemento',
    }
  })

  return {
    opportunities,
    pendingFloorInfo,
    stats: {
      condos: Number(result.stats?.condos ?? 0),
      splitters: Number(result.stats?.splitters ?? 0),
      clientsAnalyzed: Number(result.stats?.clientsAnalyzed ?? 0),
      opportunitiesFound: Number(result.stats?.opportunitiesFound ?? 0),
      pendingCount: Number(result.stats?.pendingCount ?? 0),
    },
  }
}
