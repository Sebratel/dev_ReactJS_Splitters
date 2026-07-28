import type { HttpRequestParams } from '@/shared/api/httpClient'
import { ApiError } from '@/shared/api/apiError'
import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { useAutoIspStore } from '@/features/autoisp/store/autoIspStore'
import { autoIspClient } from '@/features/autoisp/api/autoIspClient'

/** TTL padrão (s) se o BFF não enviar `expiresIn`. */
const DEFAULT_EXPIRES_IN_SEC = 3600

/**
 * Momento em que passamos a considerar o token "velho" e pedir outro ao BFF.
 * Margem para não usar o JWT nos últimos segundos do TTL.
 */
function computeRefreshAfterMs(expiresInSec: number): number {
  const ttl = Math.max(60, expiresInSec)
  const slackSec = Math.min(300, Math.max(60, Math.floor(ttl * 0.15)))
  const usableSec = Math.max(30, ttl - slackSec)
  return Date.now() + usableSec * 1000
}

/**
 * Obtém um token do AutoISP via BFF local (`GET /api/autoisp/token`).
 * O usuário/senha do AutoISP ficam SÓ no backend — nunca no bundle do frontend.
 */
export async function authenticateAutoIsp(): Promise<string> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/autoisp/token`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`AutoISP indisponível (BFF HTTP ${response.status}).`)
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
  const root = payload && typeof payload === 'object' ? payload : {}
  const data =
    root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : {}
  const token = typeof data.token === 'string' ? data.token.trim() : ''

  if (root.success !== true || token === '') {
    throw new Error('BFF não retornou um token válido do AutoISP.')
  }

  const expiresIn =
    typeof data.expiresIn === 'number' && Number.isFinite(data.expiresIn) && data.expiresIn > 0
      ? Math.floor(data.expiresIn)
      : DEFAULT_EXPIRES_IN_SEC

  useAutoIspStore.getState().setAuthSession(token, computeRefreshAfterMs(expiresIn))
  return token
}

/**
 * Garante token válido: renova se não existe, expirou localmente ou está prestes a expirar.
 */
export async function ensureAutoIspToken(): Promise<string> {
  const { token, tokenExpiresAtMs } = useAutoIspStore.getState()
  if (token && tokenExpiresAtMs !== null && Date.now() < tokenExpiresAtMs) {
    return token
  }
  return authenticateAutoIsp()
}

/**
 * GET/POST no AutoISP com Bearer: obtém token fresco e, em 401/403, limpa a sessão e tenta de novo uma vez.
 */
export async function autoIspAuthorizedRequest<T>(params: HttpRequestParams): Promise<T> {
  await ensureAutoIspToken()
  try {
    return await autoIspClient.request<T>(params)
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      useAutoIspStore.getState().clearToken()
      await authenticateAutoIsp()
      return await autoIspClient.request<T>(params)
    }
    throw e
  }
}
