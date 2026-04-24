import type { AuthContextProps } from 'react-oidc-context'

const STORAGE_KEY = 'nexaview.oidc.returnPath.v1'

function persistOidcReturnPath(path: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, path)
  } catch {
    // ignore quota / private mode
  }
}

function peekOidcReturnPathFromStorage(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function clearOidcReturnPathStorage(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Caminho interno seguro para voltar após OIDC (sem open-redirect).
 */
export function buildOidcReturnPath(pathname: string, search: string): string {
  const path = `${pathname}${search ?? ''}`
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
    return '/'
  }
  if (pathname === '/callback' || pathname.startsWith('/callback/')) {
    return '/'
  }
  return path
}

function trySafeInternalPath(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) return null
  if (raw === '/callback' || raw.startsWith('/callback/') || raw.startsWith('/callback?')) {
    return null
  }
  return raw
}

/**
 * Resolve destino pós-login: `User.state` da lib OIDC, com fallback ao que foi guardado antes do redirect.
 */
export function pathAfterOidcSignIn(userState: unknown): string {
  const fromUser = trySafeInternalPath(typeof userState === 'string' ? userState : null)
  if (fromUser) {
    clearOidcReturnPathStorage()
    return fromUser
  }
  const stored = trySafeInternalPath(peekOidcReturnPathFromStorage())
  clearOidcReturnPathStorage()
  return stored ?? '/'
}

export function signinRedirectWithReturnPath(
  signinRedirect: AuthContextProps['signinRedirect'],
  pathname: string,
  search: string,
): ReturnType<AuthContextProps['signinRedirect']> {
  const path = buildOidcReturnPath(pathname, search)
  persistOidcReturnPath(path)
  return signinRedirect({ state: path })
}

/** Na rota `/callback` com erro: reenvia ao IdP mantendo o destino guardado antes do redirect. */
export function signinRedirectRetryPreserveStored(
  signinRedirect: AuthContextProps['signinRedirect'],
): ReturnType<AuthContextProps['signinRedirect']> {
  const stored = trySafeInternalPath(peekOidcReturnPathFromStorage()) ?? '/'
  persistOidcReturnPath(stored)
  return signinRedirect({ state: stored })
}
