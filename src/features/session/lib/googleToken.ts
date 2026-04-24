const REFRESH_SKEW_MS = 5 * 60 * 1000
const CORPORATE_DOMAIN = 'sebratel.com.br'

export type GoogleIdTokenPayload = {
  aud: string
  email: string
  email_verified?: boolean
  exp: number
  hd?: string
  iat?: number
  iss?: string
  name?: string
  nonce?: string
  picture?: string
  sub?: string
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding =
    normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return atob(normalized + padding)
}

export function decodeGoogleIdToken(token: string): GoogleIdTokenPayload {
  const parts = token.split('.')
  if (parts.length < 2) {
    throw new Error('Token Google em formato invalido.')
  }

  return JSON.parse(base64UrlDecode(parts[1])) as GoogleIdTokenPayload
}

export function getGoogleIdTokenExpiryMs(token: string): number | null {
  try {
    const payload = decodeGoogleIdToken(token)
    if (typeof payload.exp !== 'number') return null
    return payload.exp * 1000
  } catch {
    return null
  }
}

export function isGoogleIdTokenExpired(token: string, nowMs = Date.now()): boolean {
  const expMs = getGoogleIdTokenExpiryMs(token)
  if (expMs === null) return true
  return nowMs >= expMs
}

export function shouldRefreshGoogleIdToken(token: string, nowMs = Date.now()): boolean {
  const expMs = getGoogleIdTokenExpiryMs(token)
  if (expMs === null) return true
  return nowMs >= expMs - REFRESH_SKEW_MS
}

export function validateCorporateGoogleIdToken(
  token: string,
  expectedAudience: string,
): GoogleIdTokenPayload {
  const payload = decodeGoogleIdToken(token)

  if (payload.aud !== expectedAudience) {
    throw new Error('O token Google retornou para outro client ID.')
  }

  if (typeof payload.exp !== 'number' || Date.now() >= payload.exp * 1000) {
    throw new Error('O token Google retornou expirado.')
  }

  const email = String(payload.email ?? '').trim().toLowerCase()
  if (!email.endsWith(`@${CORPORATE_DOMAIN}`)) {
    throw new Error('Use sua conta corporativa @sebratel.com.br para entrar.')
  }

  const hostedDomain = String(payload.hd ?? '').trim().toLowerCase()
  if (hostedDomain !== CORPORATE_DOMAIN) {
    throw new Error('A conta Google precisa pertencer ao dominio sebratel.com.br.')
  }

  if (payload.email_verified !== true) {
    throw new Error('A conta Google precisa ter e-mail verificado.')
  }

  return payload
}

export function getGoogleTokenRefreshDelayMs(token: string): number | null {
  const expMs = getGoogleIdTokenExpiryMs(token)
  if (expMs === null) return null
  return Math.max(expMs - REFRESH_SKEW_MS - Date.now(), 0)
}
