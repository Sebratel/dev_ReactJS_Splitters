export function readQueryParam(name: string): string | null {
  const params = new URLSearchParams(window.location.search)
  const value = params.get(name)
  return value && value.trim() ? value.trim() : null
}

export function readHashParam(name: string): string | null {
  const raw = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  const params = new URLSearchParams(raw)
  const value = params.get(name)
  return value && value.trim() ? value.trim() : null
}

export function stripQueryParams(...names: string[]): void {
  const url = new URL(window.location.href)
  let changed = false
  for (const name of names) {
    if (url.searchParams.has(name)) {
      url.searchParams.delete(name)
      changed = true
    }
  }
  if (changed) {
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState({}, '', next)
  }
}

export function stripHashParams(...names: string[]): void {
  const raw = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  const params = new URLSearchParams(raw)
  let changed = false
  for (const name of names) {
    if (params.has(name)) {
      params.delete(name)
      changed = true
    }
  }

  if (changed) {
    const nextHash = params.toString()
    const next = `${window.location.pathname}${window.location.search}${nextHash ? `#${nextHash}` : ''}`
    window.history.replaceState({}, '', next)
  }
}
