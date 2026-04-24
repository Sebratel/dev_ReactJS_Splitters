import { describe, expect, it, vi } from 'vitest'
import {
  decodeGoogleIdToken,
  getGoogleIdTokenExpiryMs,
  getGoogleTokenRefreshDelayMs,
  isGoogleIdTokenExpired,
  shouldRefreshGoogleIdToken,
  validateCorporateGoogleIdToken,
} from '@/features/session/lib/googleToken'

function b64url(obj: object): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function tokenWithPayload(payload: object): string {
  return `e.${b64url(payload)}.s`
}

describe('googleToken', () => {
  it('decodeGoogleIdToken e erros', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const p = decodeGoogleIdToken(
      tokenWithPayload({ exp, email: 'a@sebratel.com.br', aud: 'cid' }),
    )
    expect(p.email).toBe('a@sebratel.com.br')
    expect(() => decodeGoogleIdToken('bad')).toThrow('formato')
  })

  it('getGoogleIdTokenExpiryMs e expirado', () => {
    const t = tokenWithPayload({ exp: 2000000000 })
    expect(getGoogleIdTokenExpiryMs(t)).toBe(2000000000_000)
    expect(getGoogleIdTokenExpiryMs('x.y')).toBeNull()
  })

  it('isGoogleIdTokenExpired e shouldRefreshGoogleIdToken', () => {
    const future = tokenWithPayload({ exp: Math.floor(Date.now() / 1000) + 10_000 })
    const past = tokenWithPayload({ exp: Math.floor(Date.now() / 1000) - 10 })
    expect(isGoogleIdTokenExpired(future, Date.now())).toBe(false)
    expect(isGoogleIdTokenExpired(past, Date.now())).toBe(true)
    expect(shouldRefreshGoogleIdToken('bad')).toBe(true)
    expect(shouldRefreshGoogleIdToken(future, Date.now())).toBe(false)
  })

  it('validateCorporateGoogleIdToken', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const ok = tokenWithPayload({
      exp,
      aud: 'expected',
      email: 'user@sebratel.com.br',
      hd: 'sebratel.com.br',
      email_verified: true,
    })
    expect(validateCorporateGoogleIdToken(ok, 'expected').email).toContain(
      'sebratel',
    )
    expect(() =>
      validateCorporateGoogleIdToken(ok, 'other'),
    ).toThrow('client ID')
    vi.useFakeTimers()
    vi.setSystemTime(new Date((exp + 100) * 1000))
    expect(() => validateCorporateGoogleIdToken(ok, 'expected')).toThrow(
      'expirado',
    )
    vi.useRealTimers()
  })

  it('getGoogleTokenRefreshDelayMs', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const t = tokenWithPayload({ exp })
    expect(getGoogleTokenRefreshDelayMs(t)).toBeGreaterThanOrEqual(0)
    expect(getGoogleTokenRefreshDelayMs('nope')).toBeNull()
  })
})
