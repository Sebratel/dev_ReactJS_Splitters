import { isJsonObject } from '@/shared/lib/typeGuards'

const STORAGE_PREFIX = 'nexaview.geogrid-client-name.v1:'
const TTL_MS = 24 * 60 * 60 * 1000

type CacheRecord = {
  nome: string
  cachedAt: number
}

function storageKey(idCliente: string): string {
  return `${STORAGE_PREFIX}${idCliente}`
}

export function loadCachedGeogridClienteNome(idCliente: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(idCliente))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isJsonObject(parsed)) return null

    const nome =
      parsed.nome === null || parsed.nome === undefined
        ? ''
        : String(parsed.nome).trim()
    const cachedAt = Number(parsed.cachedAt ?? 0)
    if (nome === '' || !Number.isFinite(cachedAt) || cachedAt <= 0) return null

    if (Date.now() - cachedAt > TTL_MS) {
      window.localStorage.removeItem(storageKey(idCliente))
      return null
    }

    return nome
  } catch {
    return null
  }
}

export function saveCachedGeogridClienteNome(
  idCliente: string,
  nome: string,
): void {
  if (typeof window === 'undefined') return
  const normalizedId = idCliente.trim()
  const normalizedNome = nome.trim()
  if (normalizedId === '' || normalizedNome === '') return

  try {
    const record: CacheRecord = {
      nome: normalizedNome,
      cachedAt: Date.now(),
    }
    window.localStorage.setItem(storageKey(normalizedId), JSON.stringify(record))
  } catch {
    // ignora quota/private mode
  }
}
