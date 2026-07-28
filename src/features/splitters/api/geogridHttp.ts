import { env } from '@/shared/config/env'

const GEOGRID_FETCH_TIMEOUT_MS = 10_000

type GeogridGetJsonOptions = {
  signal?: AbortSignal
  timeoutMs?: number
}

function normalizeBaseUrl(base: string): string {
  return base.replace(/\/+$/, '')
}

/**
 * GET JSON GeoGrid SEMPRE via BFF (`/api/geogrid/...`). A `api-key` fica no backend
 * (env `GEOGRID_API_KEY`) — nunca no bundle do frontend.
 */
export async function geogridGetJson(
  path: string,
  options?: AbortSignal | GeogridGetJsonOptions,
): Promise<unknown> {
  const rel = path.startsWith('/') ? path : `/${path}`
  const url = `${normalizeBaseUrl(env.localBffUrl)}/api/geogrid${rel}`

  const signal =
    options instanceof AbortSignal || options === undefined
      ? options
      : options.signal
  const timeoutMs =
    options instanceof AbortSignal || options === undefined
      ? GEOGRID_FETCH_TIMEOUT_MS
      : options.timeoutMs ?? GEOGRID_FETCH_TIMEOUT_MS

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  const onParentAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onParentAbort, { once: true })
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`GeoGrid HTTP ${response.status}`)
    }

    return (await response.json()) as unknown
  } finally {
    window.clearTimeout(timeoutId)
    if (signal) signal.removeEventListener('abort', onParentAbort)
  }
}
