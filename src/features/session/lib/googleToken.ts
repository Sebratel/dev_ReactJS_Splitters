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

/**
 * JWT emitido por **Firebase Auth** (`getIdToken`), não aceito pelo gateway como Bearer Google.
 */
export function isFirebaseAuthIdTokenJwt(token: string): boolean {
  try {
    const aud = String(decodeGoogleIdToken(token).aud ?? '')
    return aud.includes('securetoken.google.com')
  } catch {
    return false
  }
}

/**
 * Google **OAuth** ID token (vários Web clients `.apps.googleusercontent.com` no mesmo projeto).
 * `expectedWebClientId` opcional: se preenchido, exige `aud` exatamente igual (validação estrita).
 */
export function isLikelyGoogleOAuthWebClientJwt(
  token: string,
  expectedWebClientId: string,
): boolean {
  try {
    const p = decodeGoogleIdToken(token)
    const aud = String(p.aud ?? '')
    if (aud.includes('securetoken.google.com')) return false
    const expected = expectedWebClientId.trim()
    if (expected !== '') return aud === expected
    return aud.endsWith('.apps.googleusercontent.com')
  } catch {
    return false
  }
}

/** Bearer aceitável pelo gateway: JWT com payload Google e `aud` não é o do Firebase Auth. */
export function isBffGatewayGoogleBearerToken(token: string): boolean {
  try {
    const aud = String(decodeGoogleIdToken(token).aud ?? '')
    return !aud.includes('securetoken.google.com')
  } catch {
    return false
  }
}

/**
 * O gateway valida o `aud` do JWT. O popup Firebase pode emitir id_token com **outro** Web Client
 * que o definido em `VITE_GOOGLE_CLIENT_ID` (o que o openresty espera). Se `expectedGoogleClientId`
 * estiver vazio, aceita qualquer JWT Google que não seja do Firebase Auth.
 */
export function isSessionTokenAlignedWithGatewayGoogleAudience(
  token: string,
  expectedGoogleClientId: string,
): boolean {
  if (!isBffGatewayGoogleBearerToken(token)) return false
  const expected = expectedGoogleClientId.trim()
  if (expected === '') return true
  try {
    return String(decodeGoogleIdToken(token).aud ?? '') === expected
  } catch {
    return false
  }
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
