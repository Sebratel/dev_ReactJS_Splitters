/** Mesma chave em todas as abas: logout/login em uma aba reflete nas outras via `storage`. */
export const SESSION_STORAGE_KEY = 'nexaview.session.v1'

/** TTL alinhado ao cache de token de 1h no Flutter (Hive). */
export const SESSION_TTL_MS = 60 * 60 * 1000

export type PersistedSession = {
  token: string
  storedAt: number
  expiresAt?: number
}

/**
 * Valida JSON persistido (forma + TTL). Não lê/escreve localStorage.
 */
export function parsePersistedSessionJson(raw: string): PersistedSession | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const rec = parsed as Record<string, unknown>
    const token = rec.token
    const storedAt = rec.storedAt
    const expiresAt = rec.expiresAt
    if (typeof token !== 'string' || typeof storedAt !== 'number') return null
    if (Date.now() - storedAt > SESSION_TTL_MS) return null
    if (expiresAt !== undefined && typeof expiresAt !== 'number') return null
    if (typeof expiresAt === 'number' && Date.now() >= expiresAt) return null
    return { token, storedAt, expiresAt: typeof expiresAt === 'number' ? expiresAt : undefined }
  } catch {
    return null
  }
}

export function loadPersistedSession(): PersistedSession | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null
  const parsed = parsePersistedSessionJson(raw)
  if (!parsed) {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
  return parsed
}

export function persistSessionToken(token: string, expiresAt?: number | null): void {
  const payload: PersistedSession = {
    token,
    storedAt: Date.now(),
    expiresAt: typeof expiresAt === 'number' ? expiresAt : undefined,
  }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload))
}

export function clearPersistedSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY)
}
