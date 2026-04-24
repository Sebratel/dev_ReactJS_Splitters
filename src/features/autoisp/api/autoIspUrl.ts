/**
 * Path para `fetch` (pathname + search). Aceita URL absoluta ou path relativo (ex.: `/__autoisp/...`).
 */
export function resolveAutoIspUrlPath(endpoint: string): string {
  const t = endpoint.trim()
  if (t.includes('://')) {
    return new URL(t).pathname + new URL(t).search
  }
  return t.startsWith('/') ? t : `/${t}`
}
