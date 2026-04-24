import { useSessionStore } from '@/features/session/store/sessionStore'
import { env } from '@/shared/config/env'
import { ApiError, NetworkError } from '@/shared/api/apiError'
import { getOidcAccessToken } from '@/app/auth/oidcAccessToken'

export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000

export type HttpRequestParams = {
  path: string
  method?: string
  body?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
  timeoutMs?: number
}

export type HttpClientConfig = {
  baseUrl: string
  getToken: () => string | null
  onUnauthorized?: () => void
  defaultTimeoutMs?: number
}

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path : `/${path}`
  return `${b}${p}`
}

function buildBodyAndHeaders(
  rawBody: unknown,
  baseHeaders: Headers,
): { body: BodyInit | undefined; headers: Headers } {
  const headers = new Headers(baseHeaders)
  if (rawBody === undefined || rawBody === null) {
    return { body: undefined, headers }
  }
  if (typeof FormData !== 'undefined' && rawBody instanceof FormData) {
    return { body: rawBody, headers }
  }
  if (typeof Blob !== 'undefined' && rawBody instanceof Blob) {
    return { body: rawBody, headers }
  }
  if (typeof URLSearchParams !== 'undefined' && rawBody instanceof URLSearchParams) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8')
    }
    return { body: rawBody, headers }
  }
  if (typeof rawBody === 'string') {
    return { body: rawBody, headers }
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json;charset=UTF-8')
  }
  try {
    return { body: JSON.stringify(rawBody), headers }
  } catch (e) {
    throw new NetworkError('Corpo da requisicao nao e serializavel em JSON.', e)
  }
}

function parseJsonResponseBody<T>(status: number, path: string, text: string): T {
  const trimmed = text.trim()
  if (trimmed === '') return undefined as T
  try {
    return JSON.parse(trimmed) as T
  } catch {
    throw new ApiError(status, `JSON invalido na resposta (${path})`, text)
  }
}

export function createHttpClient(config: HttpClientConfig) {
  const defaultTimeout = config.defaultTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS

  async function request<T>(params: HttpRequestParams): Promise<T> {
    const {
      path,
      method = 'GET',
      body: rawBody,
      headers: headerInit,
      signal: externalSignal,
      timeoutMs = defaultTimeout,
    } = params

    const methodUpper = method.toUpperCase()
    const isBodyless = methodUpper === 'GET' || methodUpper === 'HEAD'

    const controller = new AbortController()
    const state = { timedOut: false }
    const timeoutId = window.setTimeout(() => {
      state.timedOut = true
      controller.abort()
    }, timeoutMs)

    const onExternalAbort = () => controller.abort()
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort()
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
    }

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort)
      }
    }

    const token = config.getToken()
    const headers = new Headers(headerInit)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')

    const { body: serializedBody, headers: mergedHeaders } = isBodyless
      ? { body: undefined as BodyInit | undefined, headers }
      : buildBodyAndHeaders(rawBody, headers)

    const url = joinUrl(config.baseUrl, path)

    try {
      const response = await fetch(url, {
        method: methodUpper,
        headers: mergedHeaders,
        body: isBodyless ? undefined : serializedBody,
        signal: controller.signal,
      })

      const text = await response.text()

      if (response.status === 401) {
        config.onUnauthorized?.()
        throw new ApiError(401, 'Sessao expirada ou nao autorizada', text)
      }

      if (!response.ok) {
        throw new ApiError(response.status, `HTTP ${response.status} em ${path}`, text)
      }

      if (response.status === 204) {
        return undefined as T
      }

      const trimmed = text.trim()
      if (trimmed === '') {
        return undefined as T
      }

      const ct = response.headers.get('content-type') ?? ''
      if (ct.includes('application/json')) {
        return parseJsonResponseBody<T>(response.status, path, text)
      }

      return text as T
    } catch (e) {
      if (e instanceof ApiError) throw e
      if (e instanceof NetworkError) throw e

      if (e instanceof DOMException && e.name === 'AbortError') {
        if (state.timedOut) {
          throw new ApiError(408, 'Tempo limite da requisicao excedido', '')
        }
        throw new NetworkError('Requisicao cancelada.', e)
      }

      if (e instanceof TypeError) {
        throw new NetworkError('Falha de rede. Verifique conexao, CORS e URL.', e)
      }

      throw e
    } finally {
      cleanup()
    }
  }

  return { request }
}

export function createBffClient() {
  return createHttpClient({
    baseUrl: env.bffBaseUrl,
    getToken: () => {
      const oidc = getOidcAccessToken()
      if (typeof oidc === 'string' && oidc.trim() !== '') return oidc
      return useSessionStore.getState().sessionToken
    },
    onUnauthorized: () => useSessionStore.getState().setAuthStatus('invalid-session'),
    defaultTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  })
}
