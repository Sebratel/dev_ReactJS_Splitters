import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, NetworkError } from '@/shared/api/apiError'
import { getOidcAccessToken } from '@/app/auth/oidcAccessToken'
import { useSessionStore } from '@/features/session/store/sessionStore'

vi.mock('@/features/session/store/sessionStore', () => ({
  useSessionStore: { getState: vi.fn() },
}))

vi.mock('@/app/auth/oidcAccessToken', () => ({
  getOidcAccessToken: vi.fn(),
}))

import { createBffClient, createHttpClient } from '@/shared/api/httpClient'

function jsonResponse(
  text: string,
  overrides: Partial<Response> = {},
): Response {
  const headers = new Headers({
    'content-type': 'application/json',
    ...(overrides.headers instanceof Headers
      ? Object.fromEntries(overrides.headers.entries())
      : {}),
  })
  return {
    ok: true,
    status: 200,
    headers: { get: (n: string) => headers.get(n) },
    text: async () => text,
    ...overrides,
  } as Response
}

describe('createHttpClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.mocked(useSessionStore.getState).mockReturnValue({
      sessionToken: null,
      setAuthStatus: vi.fn(),
    } as ReturnType<typeof useSessionStore.getState>)
    vi.mocked(getOidcAccessToken).mockReturnValue(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(useSessionStore.getState).mockReset()
    vi.mocked(getOidcAccessToken).mockReset()
  })

  it('GET com JSON e junta baseUrl/path', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse('{"a":1}'))
    const client = createHttpClient({ baseUrl: 'https://api/', getToken: () => 't' })
    const r = await client.request<{ a: number }>({ path: 'x' })
    expect(r).toEqual({ a: 1 })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://api/x')
    const h = init?.headers as Headers
    expect(h.get('Authorization')).toBe('Bearer t')
  })

  it('GET sem corpo retorna undefined e 204 idem', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse('  '))
    const client = createHttpClient({ baseUrl: 'https://api', getToken: () => null })
    expect(await client.request({ path: '/a' })).toBeUndefined()

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse('', { status: 204, ok: true }),
    )
    expect(await client.request({ path: '/b' })).toBeUndefined()
  })

  it('resposta não-JSON retorna texto', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/plain' },
      text: async () => 'plain',
    } as Response)
    const client = createHttpClient({ baseUrl: 'https://api', getToken: () => null })
    expect(await client.request<string>({ path: '/t' })).toBe('plain')
  })

  it('JSON inválido em resposta JSON lança ApiError', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse('not-json'))
    const client = createHttpClient({ baseUrl: 'https://api', getToken: () => null })
    await expect(client.request({ path: '/bad' })).rejects.toBeInstanceOf(ApiError)
  })

  it('401 e !ok', async () => {
    const onUnauthorized = vi.fn()
    const client = createHttpClient({
      baseUrl: 'https://api',
      getToken: () => null,
      onUnauthorized,
    })
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse('x', { ok: false, status: 401 }),
    )
    await expect(client.request({ path: '/u' })).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledOnce()

    vi.mocked(fetch).mockResolvedValue(jsonResponse('y', { ok: false, status: 503 }))
    await expect(client.request({ path: '/u2' })).rejects.toMatchObject({ status: 503 })
  })

  it('POST sem body envia corpo undefined', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse('{}'))
    const client = createHttpClient({ baseUrl: 'https://api', getToken: () => null })
    await client.request({ path: '/p', method: 'POST' })
    const init = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit
    expect(init.body).toBeUndefined()
  })

  it('serializa corpo: objeto, string, FormData, Blob, URLSearchParams', async () => {
    const client = createHttpClient({ baseUrl: 'https://api', getToken: () => null })
    vi.mocked(fetch).mockResolvedValue(jsonResponse('{}'))

    await client.request({ path: '/p', method: 'POST', body: { k: 1 } })
    let init = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit
    expect(init.body).toBe('{"k":1}')

    await client.request({ path: '/p', method: 'POST', body: 'raw' })
    init = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit
    expect(init.body).toBe('raw')

    const fd = new FormData()
    fd.set('a', '1')
    await client.request({ path: '/p', method: 'POST', body: fd })
    init = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit
    expect(init.body).toBe(fd)

    const blob = new Blob(['x'])
    await client.request({ path: '/p', method: 'POST', body: blob })
    init = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit
    expect(init.body).toBe(blob)

    const usp = new URLSearchParams({ a: '1' })
    await client.request({ path: '/p', method: 'POST', body: usp })
    init = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit
    expect(init.body).toBe(usp)
    const hdrs = init.headers as Headers
    expect(hdrs.get('Content-Type')).toContain('application/x-www-form-urlencoded')
  })

  it('corpo não serializável lança NetworkError', async () => {
    const client = createHttpClient({ baseUrl: 'https://api', getToken: () => null })
    const circular: Record<string, unknown> = {}
    circular.self = circular
    await expect(
      client.request({ path: '/c', method: 'POST', body: circular }),
    ).rejects.toBeInstanceOf(NetworkError)
  })

  it('timeout vira ApiError 408', async () => {
    vi.useFakeTimers()
    const client = createHttpClient({
      baseUrl: 'https://api',
      getToken: () => null,
      defaultTimeoutMs: 1000,
    })
    vi.mocked(fetch).mockImplementation((_url, init) => {
      const signal = init?.signal
      return new Promise<Response>((resolve, reject) => {
        if (!signal) return
        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    })
    const p = client.request({ path: '/slow' })
    const outcome = p.then(
      () => {
        throw new Error('expected request to reject')
      },
      (e: unknown) => e,
    )
    await vi.advanceTimersByTimeAsync(1000)
    expect(await outcome).toMatchObject({ status: 408 })
    vi.useRealTimers()
  })

  it('propaga erro genérico da fetch', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('oops'))
    const client = createHttpClient({ baseUrl: 'https://api', getToken: () => null })
    await expect(client.request({ path: '/z' })).rejects.toThrow('oops')
  })

  it('abort externo: NetworkError; fetch TypeError: NetworkError', async () => {
    const client = createHttpClient({ baseUrl: 'https://api', getToken: () => null })
    const ac = new AbortController()
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((_, rej) => {
          ac.signal.addEventListener('abort', () => rej(ac.signal.reason))
        }),
    )
    const p = client.request({ path: '/x', signal: ac.signal })
    ac.abort(new DOMException('Aborted', 'AbortError'))
    await expect(p).rejects.toBeInstanceOf(NetworkError)

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('cors'))
    await expect(client.request({ path: '/y' })).rejects.toBeInstanceOf(NetworkError)
  })
})

describe('createBffClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(useSessionStore.getState).mockReset()
    vi.mocked(getOidcAccessToken).mockReset()
  })

  it('prioriza access token OIDC no Authorization', async () => {
    vi.mocked(getOidcAccessToken).mockReturnValue('oidc-token')
    vi.mocked(useSessionStore.getState).mockReturnValue({
      sessionToken: 'sess',
      setAuthStatus: vi.fn(),
    } as ReturnType<typeof useSessionStore.getState>)
    vi.mocked(fetch).mockResolvedValue(jsonResponse('{}'))
    const bff = createBffClient()
    await bff.request({ path: '/z' })
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer oidc-token')
  })

  it('401 dispara setAuthStatus invalid-session', async () => {
    vi.mocked(getOidcAccessToken).mockReturnValue(null)
    const setAuthStatus = vi.fn()
    vi.mocked(useSessionStore.getState).mockReturnValue({
      sessionToken: 's',
      setAuthStatus,
    } as ReturnType<typeof useSessionStore.getState>)
    vi.mocked(fetch).mockResolvedValue(jsonResponse('', { ok: false, status: 401 }))
    const bff = createBffClient()
    await expect(bff.request({ path: '/z' })).rejects.toBeInstanceOf(ApiError)
    expect(setAuthStatus).toHaveBeenCalledWith('invalid-session')
  })
})
