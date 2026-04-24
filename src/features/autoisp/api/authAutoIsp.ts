import { createHttpClient } from '@/shared/api/httpClient'
import type { HttpRequestParams } from '@/shared/api/httpClient'
import { ApiError } from '@/shared/api/apiError'
import { env } from '@/shared/config/env'
import { useAutoIspStore } from '@/features/autoisp/store/autoIspStore'
import type { AutoIspAuthPayload } from '@/features/autoisp/model/autoIsp.types'
import { autoIspClient } from '@/features/autoisp/api/autoIspClient'
import { resolveAutoIspUrlPath } from '@/features/autoisp/api/autoIspUrl'
import { isJsonObject } from '@/shared/lib/typeGuards'

const authClient = createHttpClient({
  baseUrl: env.autoIspAuthEndpoint.includes('://')
    ? new URL(env.autoIspAuthEndpoint).origin
    : '',
  getToken: () => null,
})

/** TTL padrão (s) se a API não enviar `expires_in` — típico ~1h. */
const DEFAULT_EXPIRES_IN_SEC = 3600

function pickExpiresInSeconds(data: AutoIspAuthPayload): number {
  const raw =
    data.expires_in ??
    data.response?.expires_in ??
    (data as Record<string, unknown>).expiresIn
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw)
  }
  if (typeof raw === 'string') {
    const n = Number.parseInt(raw, 10)
    if (Number.isFinite(n) && n > 0) return n
  }
  return DEFAULT_EXPIRES_IN_SEC
}

/**
 * Momento em que passamos a considerar o token “velho” e pedir outro `request_token`.
 * Margem para não usar JWT nos últimos segundos do TTL.
 */
function computeRefreshAfterMs(expiresInSec: number): number {
  const ttl = Math.max(60, expiresInSec)
  const slackSec = Math.min(300, Math.max(60, Math.floor(ttl * 0.15)))
  const usableSec = Math.max(30, ttl - slackSec)
  return Date.now() + usableSec * 1000
}

function extractTokenFromAuthBody(data: unknown): string | null {
  if (typeof data === 'string') {
    const s = data.trim()
    if (s.length > 20) return s
    return null
  }
  if (!isJsonObject(data)) return null

  const queue: unknown[] = [data]
  const seen = new Set<unknown>()

  while (queue.length > 0) {
    const cur = queue.pop()
    if (cur === null || cur === undefined) continue
    if (typeof cur !== 'object') continue
    if (seen.has(cur)) continue
    seen.add(cur)

    if (Array.isArray(cur)) {
      for (const x of cur) queue.push(x)
      continue
    }

    const o = cur as Record<string, unknown>
    for (const key of [
      'token',
      'access_token',
      'accessToken',
      'jwt',
      'id_token',
      'idToken',
      'bearer',
    ]) {
      const v = o[key]
      if (typeof v === 'string' && v.trim().length > 12) return v.trim()
    }

    for (const v of Object.values(o)) {
      if (v !== null && typeof v === 'object') queue.push(v)
    }
  }

  return null
}

/**
 * POST `request_token` com username/password (paridade com curl / Flutter).
 */
export async function authenticateAutoIsp(): Promise<string> {
  const { autoIspAuthEndpoint, autoIspUsername, autoIspPassword } = env

  if (!autoIspUsername || !autoIspPassword) {
    throw new Error('Credenciais do AutoISP não configuradas no ambiente.')
  }

  const path = resolveAutoIspUrlPath(autoIspAuthEndpoint)

  try {
    const data = await authClient.request<AutoIspAuthPayload | Record<string, unknown>>({
      path,
      method: 'POST',
      body: {
        username: autoIspUsername,
        password: autoIspPassword,
      },
    })

    const token = extractTokenFromAuthBody(data)
    if (!token) {
      throw new Error(
        'AutoISP não retornou um token válido (verifique o JSON de request_token).',
      )
    }

    const expiresIn = isJsonObject(data)
      ? pickExpiresInSeconds(data as AutoIspAuthPayload)
      : DEFAULT_EXPIRES_IN_SEC
    const refreshAfterMs = computeRefreshAfterMs(expiresIn)
    useAutoIspStore.getState().setAuthSession(token, refreshAfterMs)
    return token
  } catch (error) {
    console.error('[AutoISP Auth Error]', error)
    throw error
  }
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
 * GET/POST no AutoISP com Bearer: obtém token fresco e, em 401, limpa sessão e tenta de novo uma vez.
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
