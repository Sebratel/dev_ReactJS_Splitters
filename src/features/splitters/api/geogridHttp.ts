import { env, isLocalDevHostname } from '@/shared/config/env'

const GEOGRID_FETCH_TIMEOUT_MS = 10_000

type GeogridGetJsonOptions = {
  signal?: AbortSignal
  timeoutMs?: number
}

function normalizeBaseUrl(base: string): string {
  return base.replace(/\/+$/, '')
}

/**
 * GET JSON na API GeoGrid com `api-key` e timeout (fora do BFF).
 */
export async function geogridGetJson(
  path: string,
  options?: AbortSignal | GeogridGetJsonOptions,
): Promise<unknown> {
  const rel = path.startsWith('/') ? path : `/${path}`
  const useLocalProxy = isLocalDevHostname() && env.localBffUrl.trim().length > 0
  const url = useLocalProxy
    ? `${normalizeBaseUrl(env.localBffUrl)}/api/geogrid${rel}`
    : `${normalizeBaseUrl(env.geogridBaseUrl)}${rel}`

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
      headers: useLocalProxy
        ? {
            Accept: 'application/json',
          }
        : {
            Accept: 'application/json',
            'api-key': env.geogridApiKey,
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
