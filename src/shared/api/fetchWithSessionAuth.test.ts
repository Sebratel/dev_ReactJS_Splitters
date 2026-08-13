import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getOidcAccessToken = vi.fn<() => string | null>()
const getSessionState = vi.fn<() => { sessionToken: string | null }>()

vi.mock('@/app/auth/oidcAccessToken', () => ({
  getOidcAccessToken: () => getOidcAccessToken(),
}))
vi.mock('@/features/session/store/sessionStore', () => ({
  useSessionStore: { getState: () => getSessionState() },
}))

const { fetchWithSessionAuth } = await import('@/shared/api/fetchWithSessionAuth')

/** Devolve os headers com que o `fetch` global foi chamado. */
function headersDaChamada(mock: ReturnType<typeof vi.fn>): Headers {
  return (mock.mock.calls[0][1] as RequestInit).headers as Headers
}

describe('fetchWithSessionAuth', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    getOidcAccessToken.mockReturnValue(null)
    getSessionState.mockReturnValue({ sessionToken: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('usa o token OIDC quando existe', async () => {
    getOidcAccessToken.mockReturnValue('token-oidc')
    await fetchWithSessionAuth('/api/x')
    expect(headersDaChamada(fetchSpy).get('Authorization')).toBe('Bearer token-oidc')
  })

  it('cai no token da sessão quando o OIDC está vazio', async () => {
    getOidcAccessToken.mockReturnValue('   ')
    getSessionState.mockReturnValue({ sessionToken: 'token-sessao' })
    await fetchWithSessionAuth('/api/x')
    expect(headersDaChamada(fetchSpy).get('Authorization')).toBe('Bearer token-sessao')
  })

  it('não inventa Authorization quando não há token nenhum', async () => {
    getSessionState.mockReturnValue({ sessionToken: '  ' })
    await fetchWithSessionAuth('/api/x')
    expect(headersDaChamada(fetchSpy).has('Authorization')).toBe(false)
  })

  it('respeita um Authorization já definido pelo chamador', async () => {
    getOidcAccessToken.mockReturnValue('token-oidc')
    await fetchWithSessionAuth('/api/x', { headers: { Authorization: 'Basic abc' } })
    expect(headersDaChamada(fetchSpy).get('Authorization')).toBe('Basic abc')
  })

  it('aborta de imediato se o signal recebido já vinha abortado', async () => {
    const controller = new AbortController()
    controller.abort()
    await fetchWithSessionAuth('/api/x', { signal: controller.signal })
    const usado = (fetchSpy.mock.calls[0][1] as RequestInit).signal as AbortSignal
    expect(usado.aborted).toBe(true)
  })

  it('propaga o abort externo que acontece durante o pedido', async () => {
    const controller = new AbortController()
    let sinalInterno: AbortSignal | undefined
    fetchSpy.mockImplementation(async (_input: unknown, init: RequestInit) => {
      sinalInterno = init.signal as AbortSignal
      controller.abort()
      return new Response('{}', { status: 200 })
    })

    await fetchWithSessionAuth('/api/x', { signal: controller.signal })
    expect(sinalInterno?.aborted).toBe(true)
  })

  // O timeout de 30s tem de ser limpo mesmo quando o fetch rejeita, senão fica um handle
  // pendurado por pedido falhado.
  it('limpa o timeout mesmo quando o fetch falha', async () => {
    const clearSpy = vi.spyOn(window, 'clearTimeout')
    fetchSpy.mockRejectedValue(new Error('rede em baixo'))

    await expect(fetchWithSessionAuth('/api/x')).rejects.toThrow('rede em baixo')
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })
})
