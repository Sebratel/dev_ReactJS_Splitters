import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

const STORAGE_KEY = 'nexaview.massiva.recent-opens.v1'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type StoredTicket = Omit<MassivaTicket, 'openedAt' | 'expectedCloseAt' | 'closedAt'> & {
  openedAt: string | null
  expectedCloseAt: string | null
  closedAt: string | null
}

function serialize(ticket: MassivaTicket): StoredTicket {
  return {
    ...ticket,
    openedAt: ticket.openedAt?.toISOString() ?? null,
    expectedCloseAt: ticket.expectedCloseAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
  }
}

function deserialize(raw: StoredTicket): MassivaTicket {
  const toDate = (value: string | null) => {
    if (value == null || value === '') return null
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return {
    ...raw,
    openedAt: toDate(raw.openedAt),
    expectedCloseAt: toDate(raw.expectedCloseAt),
    closedAt: toDate(raw.closedAt),
  }
}

export function readRecentOpenTicketsFromStorage(): MassivaTicket[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { savedAtMs?: number; tickets?: StoredTicket[] }
    const savedAtMs = typeof parsed.savedAtMs === 'number' ? parsed.savedAtMs : 0
    if (Date.now() - savedAtMs > MAX_AGE_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return []
    }
    if (!Array.isArray(parsed.tickets)) return []
    return parsed.tickets.map(deserialize).filter((t) => t.protocol > 0)
  } catch {
    return []
  }
}

export function appendRecentOpenTicketsToStorage(fresh: readonly MassivaTicket[]): void {
  if (typeof window === 'undefined' || fresh.length === 0) return
  const byProtocol = new Map<number, MassivaTicket>()
  for (const ticket of [...readRecentOpenTicketsFromStorage(), ...fresh]) {
    if (ticket.protocol > 0) byProtocol.set(ticket.protocol, ticket)
  }
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      savedAtMs: Date.now(),
      tickets: [...byProtocol.values()].map(serialize),
    }),
  )
}

export function removeRecentOpenTicketFromStorage(protocol: number): void {
  if (typeof window === 'undefined' || protocol <= 0) return
  const next = readRecentOpenTicketsFromStorage().filter((t) => t.protocol !== protocol)
  if (next.length === 0) {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return
  }
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      savedAtMs: Date.now(),
      tickets: next.map(serialize),
    }),
  )
}
