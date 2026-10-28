import type { AutoIspEvent } from '@/features/autoisp/model/autoIsp.types'

type CollectOptions = {
  /** Eventos de PON/OLT podem listar centenas de ONUs; poucos PPPoE já bastam para o consenso. */
  maxPerEvent?: number
  max?: number
}

/**
 * PPPoE dos recursos dos eventos, sem repetição (sem diferenciar caixa) e em ordem estável —
 * a ordenação mantém a chave da query do React Query igual enquanto o conjunto não muda.
 */
export function collectPppoeUsernamesFromEvents(
  events: readonly AutoIspEvent[],
  { maxPerEvent = 20, max = 500 }: CollectOptions = {},
): string[] {
  const byKey = new Map<string, string>()

  for (const event of events) {
    let fromThisEvent = 0
    for (const resource of event.resources) {
      if (fromThisEvent >= maxPerEvent || byKey.size >= max) break
      const username = (resource.pppoeUsername ?? '').trim()
      if (username === '') continue
      const key = username.toLowerCase()
      if (!byKey.has(key)) {
        byKey.set(key, username)
        fromThisEvent += 1
      }
    }
    if (byKey.size >= max) break
  }

  return [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, username]) => username)
}
