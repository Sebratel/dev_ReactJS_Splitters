import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'
import type { SplitterMassivaStats } from '@/features/splitters/model/splitterOperationalInsights'

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function canonicalToken(value: string | null | undefined): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, '')
}

function createEmptyStats(): SplitterMassivaStats {
  return {
    totalTickets: 0,
    openTickets: 0,
    closedTickets: 0,
    affectedClientsTotal: 0,
    latestOpenedAt: null,
  }
}

function collectMatcherKeys(code: string, title: string): string[] {
  const keys = new Set<string>()
  const normalizedCode = normalizeText(code)
  const normalizedTitle = normalizeText(title)
  const canonicalCode = canonicalToken(code)
  const canonicalTitle = canonicalToken(title)

  if (normalizedCode !== '') keys.add(`n:${normalizedCode}`)
  if (normalizedTitle !== '') keys.add(`n:${normalizedTitle}`)
  if (canonicalCode !== '') keys.add(`c:${canonicalCode}`)
  if (canonicalTitle !== '') keys.add(`c:${canonicalTitle}`)

  return [...keys]
}

function latestDate(a: Date | null, b: Date | null): Date | null {
  if (a === null) return b
  if (b === null) return a
  return a.getTime() >= b.getTime() ? a : b
}

export function buildMassivaStatsBySplitter(
  tickets: readonly MassivaTicket[],
): Map<string, SplitterMassivaStats> {
  const byMatcher = new Map<string, SplitterMassivaStats>()

  for (const ticket of tickets) {
    const rawSplitter = ticket.splitterCode.trim()
    if (rawSplitter === '') continue

    const keys = collectMatcherKeys(rawSplitter, rawSplitter)
    for (const key of keys) {
      const current = byMatcher.get(key) ?? createEmptyStats()
      current.totalTickets += 1
      if (ticket.status === 'aberta') current.openTickets += 1
      if (ticket.status === 'encerrada') current.closedTickets += 1
      current.affectedClientsTotal += Math.max(0, ticket.affectedClients)
      current.latestOpenedAt = latestDate(current.latestOpenedAt, ticket.openedAt)
      byMatcher.set(key, current)
    }
  }

  return byMatcher
}

export function findMassivaStatsForSplitter(
  statsByMatcher: ReadonlyMap<string, SplitterMassivaStats>,
  code: string,
  title: string,
): SplitterMassivaStats {
  const keys = collectMatcherKeys(code, title)
  for (const key of keys) {
    const found = statsByMatcher.get(key)
    if (found) return found
  }
  return createEmptyStats()
}
