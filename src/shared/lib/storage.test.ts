import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_STORAGE_KEY,
  SESSION_TTL_MS,
  clearPersistedSession,
  loadPersistedSession,
  parsePersistedSessionJson,
  persistSessionToken,
} from '@/shared/lib/storage'

describe('parsePersistedSessionJson', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna sessão válida dentro do TTL', () => {
    const now = Date.now()
    const raw = JSON.stringify({ token: 't1', storedAt: now - 1000 })
    expect(parsePersistedSessionJson(raw)).toEqual({
      token: 't1',
      storedAt: now - 1000,
      expiresAt: undefined,
    })
  })

  it('rejeita JSON inválido, formato errado, TTL expirado e expiresAt no passado', () => {
    expect(parsePersistedSessionJson('not json')).toBeNull()
    expect(parsePersistedSessionJson(JSON.stringify(null))).toBeNull()
    expect(parsePersistedSessionJson(JSON.stringify({ token: 1, storedAt: 1 }))).toBeNull()
    expect(
      parsePersistedSessionJson(
        JSON.stringify({ token: 'a', storedAt: Date.now() - SESSION_TTL_MS - 1 }),
      ),
    ).toBeNull()
    expect(
      parsePersistedSessionJson(
        JSON.stringify({
          token: 'a',
          storedAt: Date.now(),
          expiresAt: 'x' as unknown as number,
        }),
      ),
    ).toBeNull()
    expect(
      parsePersistedSessionJson(
        JSON.stringify({
          token: 'a',
          storedAt: Date.now(),
          expiresAt: Date.now() - 1,
        }),
      ),
    ).toBeNull()
  })

  it('aceita expiresAt futuro', () => {
    const storedAt = Date.now()
    const expiresAt = Date.now() + 60_000
    expect(
      parsePersistedSessionJson(
        JSON.stringify({ token: 'tok', storedAt, expiresAt }),
      ),
    ).toEqual({ token: 'tok', storedAt, expiresAt })
  })
})

describe('loadPersistedSession / persistSessionToken / clearPersistedSession', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('persiste, carrega e limpa', () => {
    expect(loadPersistedSession()).toBeNull()
    persistSessionToken('abc', null)
    expect(loadPersistedSession()?.expiresAt).toBeUndefined()
    clearPersistedSession()
    persistSessionToken('abc', Date.now() + 1000)
    const loaded = loadPersistedSession()
    expect(loaded?.token).toBe('abc')
    clearPersistedSession()
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('remove chave quando JSON está corrompido após TTL', () => {
    const old = Date.now() - SESSION_TTL_MS - 1
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 'x', storedAt: old }))
    expect(loadPersistedSession()).toBeNull()
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })
})
