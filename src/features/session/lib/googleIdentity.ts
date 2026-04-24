import { env } from '@/shared/config/env'
import {
  decodeGoogleIdToken,
  validateCorporateGoogleIdToken,
} from '@/features/session/lib/googleToken'

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_NONCE_STORAGE_KEY = 'nexaview.google.nonce.v1'
const GOOGLE_REDIRECT_MODE_STORAGE_KEY = 'nexaview.google.mode.v1'
const GOOGLE_SILENT_FAILURE_AT_STORAGE_KEY = 'nexaview.google.silent-failure-at.v1'
const GOOGLE_INTERACTIVE_FAILURE_AT_STORAGE_KEY = 'nexaview.google.interactive-failure-at.v1'

function randomNonce(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function redirectUri(): string {
  const configured = env.googleRedirectUri.trim()
  if (configured !== '') return configured
  return `${window.location.origin}/`
}

function returnPath(): string {
  return `${window.location.pathname}${window.location.search}`
}

function configuredGoogleClientId(): string {
  const clientId = env.googleClientId.trim()
  if (
    !clientId ||
    clientId === 'seu_client_id_web_do_google.apps.googleusercontent.com'
  ) {
    throw new Error('VITE_GOOGLE_CLIENT_ID nao esta configurado com um client ID real.')
  }
  return clientId
}

export type GoogleRedirectMode = 'interactive' | 'silent'

export type GoogleCallbackResult =
  | { kind: 'token'; token: string; expiresAtMs: number; email: string }
  | { kind: 'error'; error: string; mode: GoogleRedirectMode }
  | null

export function beginGoogleLoginRedirect(mode: GoogleRedirectMode = 'interactive'): void {
  const clientId = configuredGoogleClientId()
  const nonce = randomNonce()
  sessionStorage.setItem(GOOGLE_NONCE_STORAGE_KEY, nonce)
  sessionStorage.setItem(GOOGLE_REDIRECT_MODE_STORAGE_KEY, mode)
  if (mode === 'interactive') {
    sessionStorage.removeItem(GOOGLE_INTERACTIVE_FAILURE_AT_STORAGE_KEY)
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce,
    prompt: mode === 'silent' ? 'none' : 'select_account',
    state: returnPath(),
    hd: 'sebratel.com.br',
  })

  window.location.assign(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`)
}

export function registerSilentRefreshFailure(): void {
  sessionStorage.setItem(GOOGLE_SILENT_FAILURE_AT_STORAGE_KEY, String(Date.now()))
}

export function clearSilentRefreshFailure(): void {
  sessionStorage.removeItem(GOOGLE_SILENT_FAILURE_AT_STORAGE_KEY)
}

export function registerInteractiveLoginFailure(): void {
  sessionStorage.setItem(GOOGLE_INTERACTIVE_FAILURE_AT_STORAGE_KEY, String(Date.now()))
}

export function clearInteractiveLoginFailure(): void {
  sessionStorage.removeItem(GOOGLE_INTERACTIVE_FAILURE_AT_STORAGE_KEY)
}

export function shouldBackoffSilentRefresh(nowMs = Date.now()): boolean {
  const raw = sessionStorage.getItem(GOOGLE_SILENT_FAILURE_AT_STORAGE_KEY)
  if (!raw) return false

  const lastFailureAt = Number(raw)
  if (!Number.isFinite(lastFailureAt)) return false
  return nowMs - lastFailureAt < 60_000
}

export function shouldBackoffInteractiveLogin(nowMs = Date.now()): boolean {
  const raw = sessionStorage.getItem(GOOGLE_INTERACTIVE_FAILURE_AT_STORAGE_KEY)
  if (!raw) return false

  const lastFailureAt = Number(raw)
  if (!Number.isFinite(lastFailureAt)) return false
  return nowMs - lastFailureAt < 10_000
}

export function readGoogleIdTokenFromCallback(): GoogleCallbackResult {
  const raw = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  if (!raw) return null

  const params = new URLSearchParams(raw)
  const mode =
    sessionStorage.getItem(GOOGLE_REDIRECT_MODE_STORAGE_KEY) === 'silent'
      ? 'silent'
      : 'interactive'
  const idToken = params.get('id_token')?.trim() ?? ''
  const error = params.get('error')?.trim() ?? ''

  if (error) {
    sessionStorage.removeItem(GOOGLE_NONCE_STORAGE_KEY)
    sessionStorage.removeItem(GOOGLE_REDIRECT_MODE_STORAGE_KEY)
    if (mode === 'silent') {
      registerSilentRefreshFailure()
    } else {
      registerInteractiveLoginFailure()
    }
    return { kind: 'error', error, mode }
  }

  if (!idToken) return null

  const expectedNonce = sessionStorage.getItem(GOOGLE_NONCE_STORAGE_KEY)
  sessionStorage.removeItem(GOOGLE_NONCE_STORAGE_KEY)
  sessionStorage.removeItem(GOOGLE_REDIRECT_MODE_STORAGE_KEY)

  const decoded = decodeGoogleIdToken(idToken)
  const nonce = typeof decoded.nonce === 'string' ? decoded.nonce : ''
  if (!expectedNonce || !nonce || nonce !== expectedNonce) {
    throw new Error('O nonce do token Google nao corresponde ao login iniciado.')
  }

  const payload = validateCorporateGoogleIdToken(idToken, configuredGoogleClientId())
  clearSilentRefreshFailure()
  clearInteractiveLoginFailure()

  const state = params.get('state')?.trim() ?? ''
  if (state && state.startsWith('/')) {
    window.history.replaceState({}, '', state)
  }

  return {
    kind: 'token',
    token: idToken,
    expiresAtMs: payload.exp * 1000,
    email: payload.email,
  }
}
