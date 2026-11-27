import { browserSessionPersistence, setPersistence, signInWithCustomToken } from 'firebase/auth'
import { firebaseAuth } from '@/shared/config/firebase'
import { env } from '@/shared/config/env'
import { stripQueryParams } from '@/features/session/lib/urlParams'

/**
 * Entrada pelo Hub Apps (iframe) — par do `server/hubSso.js`.
 *
 * O Hub abre o Splitters com `?sso_token=<token de 5 min, uso único>`. Antes do React montar,
 * a tela tira o token da URL, troca no BFF (`POST /api/auth/hub`) por um token personalizado do
 * Firebase e entra com `signInWithCustomToken`. Não há popup nem redirecionamento ao Google:
 * o Google se recusa a abrir dentro de um iframe, e era isso que deixava o quadro em branco.
 *
 * Rodar antes do React também evita o efeito duplo do StrictMode, que gastaria o token na
 * primeira chamada e falharia na segunda.
 */
const SSO_PARAM = 'sso_token'

let hubSsoError: string | null = null

/** Motivo de a entrada pelo Hub ter falhado nesta carga da página (para a tela de login). */
export function getHubSsoError(): string | null {
  return hubSsoError
}

export function isInsideIframe(): boolean {
  try {
    return window.self !== window.top
  } catch {
    // Acesso ao `top` bloqueado = estamos num quadro de outra origem.
    return true
  }
}

export async function consumeHubSsoToken(): Promise<void> {
  const token = new URLSearchParams(window.location.search).get(SSO_PARAM)?.trim() ?? ''
  if (token === '') return

  // Primeiro tira da URL: o token é de uso único e não deve ficar no histórico.
  stripQueryParams(SSO_PARAM)

  if (!firebaseAuth) {
    hubSsoError = 'O login do Splitters não está configurado neste ambiente.'
    return
  }

  try {
    const response = await fetch(`${env.localBffUrl}/api/auth/hub`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token }),
      // A tela só monta depois disto: sem limite, um BFF travado deixaria o quadro em branco.
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await response.json().catch(() => null)) as {
      customToken?: string
      message?: string
    } | null
    if (!response.ok || typeof body?.customToken !== 'string') {
      hubSsoError =
        body?.message ?? `Não foi possível entrar pelo Hub Apps (HTTP ${response.status}).`
      return
    }
    // Sessão só deste quadro: o Hub manda um token novo a cada abertura e a cada "Recarregar".
    await setPersistence(firebaseAuth, browserSessionPersistence)
    await signInWithCustomToken(firebaseAuth, body.customToken)
  } catch (error) {
    hubSsoError =
      error instanceof Error && error.message
        ? `Não foi possível entrar pelo Hub Apps: ${error.message}`
        : 'Não foi possível entrar pelo Hub Apps.'
  }
}

export type AuthConfig = { hubSso: boolean; hubOnly: boolean }

const AUTH_CONFIG_FALLBACK: AuthConfig = { hubSso: false, hubOnly: false }
let authConfigPromise: Promise<AuthConfig> | null = null

/** `GET /api/auth/config` (público). Falha de rede = sem trava: o BFF confere de novo a cada chamada. */
export function fetchAuthConfig(): Promise<AuthConfig> {
  authConfigPromise ??= fetch(`${env.localBffUrl}/api/auth/config`, {
    headers: { Accept: 'application/json' },
  })
    .then(async (r) => (r.ok ? ((await r.json()) as AuthConfig) : AUTH_CONFIG_FALLBACK))
    .catch(() => AUTH_CONFIG_FALLBACK)
  return authConfigPromise
}
