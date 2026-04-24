import { autoIspAuthorizedRequest } from '@/features/autoisp/api/authAutoIsp'
import { resolveAutoIspUrlPath } from '@/features/autoisp/api/autoIspUrl'
import { env } from '@/shared/config/env'
import { isJsonObject } from '@/shared/lib/typeGuards'
import type {
  AutoIspEvent,
  AutoIspAdminStatus,
  AutoIspResource,
} from '@/features/autoisp/model/autoIsp.types'

function pickInt(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function pickString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function pickStringOrNull(value: unknown): string | null {
  const s = pickString(value).trim()
  return s === '' ? null : s
}

function pickOptionalId(value: unknown): number | null {
  const n = pickInt(value, 0)
  return n > 0 ? n : null
}

function parseEventId(raw: Record<string, unknown>): number {
  const idRaw =
    raw.id ??
    raw.ID ??
    raw.event_id ??
    raw.eventId ??
    raw.massive_id ??
    raw.massiveId
  if (typeof idRaw === 'number' && Number.isFinite(idRaw)) return Math.trunc(idRaw)
  if (typeof idRaw === 'string') {
    const n = Number.parseInt(idRaw, 10)
    if (Number.isFinite(n) && n > 0) return n
    let h = 0
    for (let i = 0; i < idRaw.length; i++) {
      h = Math.imul(31, h) + idRaw.charCodeAt(i)
    }
    return Math.abs(h) || 1
  }
  return 0
}

function normalizeResource(raw: Record<string, unknown>): AutoIspResource {
  return {
    ponlink: pickStringOrNull(raw.ponlink ?? raw.pon_link),
    pppoeUsername: pickStringOrNull(
      raw.pppoeUsername ?? raw.pppoe_username ?? raw.username,
    ),
    networkStatus: pickStringOrNull(raw.networkStatus ?? raw.network_status),
    contractId: pickOptionalId(raw.contractId ?? raw.contract_id),
    onuId: pickOptionalId(raw.onuId ?? raw.onu_id),
  }
}

/** API costuma devolver snake_case; normaliza para o modelo usado na correlação. */
function normalizeAutoIspEvent(raw: unknown): AutoIspEvent | null {
  if (!isJsonObject(raw)) return null
  const id = parseEventId(raw)
  if (id <= 0) return null

  const resourcesRaw = raw.resources
  const resources: AutoIspResource[] = []
  if (Array.isArray(resourcesRaw)) {
    for (const item of resourcesRaw) {
      if (!isJsonObject(item)) continue
      resources.push(normalizeResource(item))
    }
  }

  return {
    id,
    eventType: pickString(raw.eventType ?? raw.event_type ?? raw.type),
    adminStatus: pickString(raw.adminStatus ?? raw.admin_status),
    startAt: pickStringOrNull(raw.startAt ?? raw.start_at),
    endAt: pickStringOrNull(raw.endAt ?? raw.end_at),
    countOnus: pickInt(raw.countOnus ?? raw.count_onus, 0),
    countCircuits: pickInt(raw.countCircuits ?? raw.count_circuits, 0),
    resources,
  }
}

/**
 * Busca eventos ativos no AutoISP unificando múltiplos status.
 * Paridade estrita com `AutoIspEventService.fetchEvents` do Flutter.
 */
const DEFAULT_STATUSES: AutoIspAdminStatus[] = [
  'new',
  'acknowledged',
  'open',
  'in_progress',
]

/** Variações comuns se a API usar caixa diferente. */
const ALT_STATUS_STRINGS = [
  'NEW',
  'OPEN',
  'IN_PROGRESS',
  'ACKNOWLEDGED',
  'PENDING',
  'ACTIVE',
]

export async function fetchAutoIspEvents(
  statuses: AutoIspAdminStatus[] = DEFAULT_STATUSES,
  page = 1,
  perPage = 1000
): Promise<AutoIspEvent[]> {
  const merged = new Map<number, AutoIspEvent>()

  const runStatuses = async (list: string[]) => {
    for (const status of list) {
      try {
        const events = await fetchEventsByStatus(status, page, perPage)
        events.forEach((ev) => merged.set(ev.id, ev))
      } catch (error) {
        console.warn(`[AutoISP] Falha ao buscar eventos com status ${status}:`, error)
      }
    }
  }

  await runStatuses(statuses)

  if (merged.size === 0) {
    await runStatuses(ALT_STATUS_STRINGS)
  }

  if (merged.size === 0) {
    try {
      const events = await fetchEventsUnfiltered(page, perPage)
      events.forEach((ev) => merged.set(ev.id, ev))
    } catch (error) {
      console.warn('[AutoISP] Falha na listagem sem filtro de status:', error)
    }
  }

  return Array.from(merged.values())
}

/**
 * Busca eventos para um status administrativo específico.
 */
async function fetchEventsByStatus(
  adminStatus: string,
  page: number,
  perPage: number
): Promise<AutoIspEvent[]> {
  const filters = JSON.stringify([
    {
      field: 'admin_status',
      op: '==',
      value: adminStatus,
    },
  ])

  const path = resolveAutoIspUrlPath(env.autoIspEventsEndpoint)

  const queryString = `filters=${encodeURIComponent(filters)}&page=${page}&per_page=${perPage}`
  const separator = path.includes('?') ? '&' : '?'

  const response = await autoIspAuthorizedRequest<unknown>({
    path: `${path}${separator}${queryString}`,
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  return extractEventsFromResponse(response)
}

async function fetchEventsUnfiltered(
  page: number,
  perPage: number,
): Promise<AutoIspEvent[]> {
  const path = resolveAutoIspUrlPath(env.autoIspEventsEndpoint)
  const qs = `page=${page}&per_page=${perPage}`
  const separator = path.includes('?') ? '&' : '?'
  const response = await autoIspAuthorizedRequest<unknown>({
    path: `${path}${separator}${qs}`,
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })
  return extractEventsFromResponse(response)
}

function collectEventArraysFromObject(data: Record<string, unknown>): unknown[] {
  const keys = [
    'data',
    'items',
    'list',
    'results',
    'events',
    'records',
    'content',
    'massives',
    'massive_events',
    'rows',
  ]
  for (const k of keys) {
    const v = data[k]
    if (Array.isArray(v)) {
      if (v.length > 0) return v
      continue
    }
    if (isJsonObject(v)) {
      const inner = collectEventArraysFromObject(v)
      if (inner.length > 0) return inner
    }
  }
  for (const k of keys) {
    const v = data[k]
    if (Array.isArray(v)) return v
  }
  return []
}

/**
 * Normaliza a resposta da API do AutoISP.
 * Pode vir como Array direto ou objeto paginado com várias chaves.
 */
function extractEventsFromResponse(data: unknown): AutoIspEvent[] {
  let rawList: unknown[] = []
  if (Array.isArray(data)) {
    rawList = data
  } else if (isJsonObject(data)) {
    rawList = collectEventArraysFromObject(data)
  }

  const out: AutoIspEvent[] = []
  for (const raw of rawList) {
    const ev = normalizeAutoIspEvent(raw)
    if (ev) out.push(ev)
  }
  return out
}
