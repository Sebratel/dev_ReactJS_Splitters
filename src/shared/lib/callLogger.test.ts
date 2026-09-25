import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getOidcAccessToken = vi.fn<() => string | null>()
const getSessionState = vi.fn<() => { sessionToken: string | null }>()

vi.mock('@/app/auth/oidcAccessToken', () => ({
  getOidcAccessToken: () => getOidcAccessToken(),
}))
vi.mock('@/features/session/store/sessionStore', () => ({
  useSessionStore: { getState: () => getSessionState() },
}))

const { logApiCall, logBoundaryError, stripQueryString, __resetCallLoggerForTests } = await import(
  '@/shared/lib/callLogger'
)

describe('callLogger', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn(async () => new Response('{}', { status: 202 }))
    vi.stubGlobal('fetch', fetchSpy)
    getOidcAccessToken.mockReturnValue(null)
    getSessionState.mockReturnValue({ sessionToken: null })
    __resetCallLoggerForTests()
    delete (window as unknown as { __callLoggerUnloadWired?: boolean }).__callLoggerUnloadWired
  })

  afterEach(() => {
    __resetCallLoggerForTests()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  describe('stripQueryString', () => {
    it('remove a querystring quando existe', () => {
      expect(stripQueryString('/api/splitters?limit=5000')).toBe('/api/splitters')
    })

    it('devolve o path como veio quando não há querystring', () => {
      expect(stripQueryString('/api/splitters')).toBe('/api/splitters')
    })
  })

  describe('logApiCall', () => {
    it('marca level info numa chamada bem-sucedida e limpa a querystring do path', async () => {
      logApiCall({ method: 'get', path: '/api/x?token=abc', status: 200, durationMs: 12 })
      logBoundaryError('força o flush') // flush síncrono para inspecionar o corpo enviado

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
      const apiEvent = body.events.find((e: { type: string }) => e.type === 'api_call')
      expect(apiEvent).toMatchObject({
        level: 'info',
        method: 'get',
        path: '/api/x',
        status: 200,
        durationMs: 12,
      })
    })

    it('marca level error quando o status é >= 500', () => {
      logApiCall({ method: 'GET', path: '/api/x', status: 503, durationMs: 5 })
      logBoundaryError('flush')
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
      const apiEvent = body.events.find((e: { type: string }) => e.type === 'api_call')
      expect(apiEvent.level).toBe('error')
    })

    it('marca level error quando há mensagem de erro, mesmo sem status', () => {
      logApiCall({ method: 'GET', path: '/api/x', durationMs: 5, error: 'falha de rede' })
      logBoundaryError('flush')
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
      const apiEvent = body.events.find((e: { type: string }) => e.type === 'api_call')
      expect(apiEvent.level).toBe('error')
      expect(apiEvent.error).toBe('falha de rede')
    })

    it('inclui o campo client quando informado', () => {
      logApiCall({ method: 'GET', path: '/api/x', status: 200, durationMs: 1, client: 'https://gateway' })
      logBoundaryError('flush')
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
      const apiEvent = body.events.find((e: { type: string }) => e.type === 'api_call')
      expect(apiEvent.client).toBe('https://gateway')
    })
  })

  describe('logBoundaryError', () => {
    it('usa a mensagem do Error quando é uma instância de Error', () => {
      logBoundaryError(new Error('quebrou tudo'))
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
      expect(body.events[0]).toMatchObject({ type: 'error_boundary', level: 'error', error: 'quebrou tudo' })
    })

    it('converte para string quando não é uma instância de Error', () => {
      logBoundaryError('string qualquer')
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
      expect(body.events[0].error).toBe('string qualquer')
    })

    it('flusha imediatamente, sem esperar o timer', () => {
      logBoundaryError(new Error('x'))
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('flush / transporte', () => {
    it('não envia nada quando o buffer está vazio (timer dispara sem eventos)', () => {
      vi.useFakeTimers()
      logApiCall({ method: 'GET', path: '/api/x', status: 200, durationMs: 1 })
      logBoundaryError('flush') // esvazia o buffer
      fetchSpy.mockClear()
      vi.advanceTimersByTime(10_000)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('usa o token OIDC quando existe', () => {
      getOidcAccessToken.mockReturnValue('token-oidc')
      logBoundaryError(new Error('x'))
      const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer token-oidc')
    })

    it('cai no token da sessão quando o OIDC está vazio', () => {
      getOidcAccessToken.mockReturnValue('   ')
      getSessionState.mockReturnValue({ sessionToken: 'token-sessao' })
      logBoundaryError(new Error('x'))
      const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer token-sessao')
    })

    it('não inventa Authorization quando não há token nenhum', () => {
      logBoundaryError(new Error('x'))
      const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>
      expect(headers.Authorization).toBeUndefined()
    })

    it('não lança quando getOidcAccessToken lança (readToken cai no catch)', () => {
      getOidcAccessToken.mockImplementation(() => {
        throw new Error('sem contexto oidc')
      })
      expect(() => logBoundaryError(new Error('x'))).not.toThrow()
    })

    it('nunca lança quando o fetch de envio rejeita', async () => {
      fetchSpy.mockRejectedValue(new Error('rede fora'))
      expect(() => logBoundaryError(new Error('x'))).not.toThrow()
      await Promise.resolve()
    })

    it('usa sendBeacon (via unload) quando disponível, sem cair no fetch', () => {
      const beaconSpy = vi.fn(() => true)
      vi.stubGlobal('navigator', { ...navigator, sendBeacon: beaconSpy })

      logApiCall({ method: 'GET', path: '/api/x', status: 200, durationMs: 1 })
      window.dispatchEvent(new Event('pagehide'))

      expect(beaconSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('cai no fetch quando sendBeacon existe mas devolve false', () => {
      const beaconSpy = vi.fn(() => false)
      vi.stubGlobal('navigator', { ...navigator, sendBeacon: beaconSpy })

      logApiCall({ method: 'GET', path: '/api/x', status: 200, durationMs: 1 })
      window.dispatchEvent(new Event('pagehide'))

      expect(beaconSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('cai no fetch quando sendBeacon lança', () => {
      const beaconSpy = vi.fn(() => {
        throw new Error('beacon indisponível')
      })
      vi.stubGlobal('navigator', { ...navigator, sendBeacon: beaconSpy })

      logApiCall({ method: 'GET', path: '/api/x', status: 200, durationMs: 1 })
      window.dispatchEvent(new Event('pagehide'))

      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('cai no fetch quando navigator.sendBeacon não existe', () => {
      vi.stubGlobal('navigator', { ...navigator, sendBeacon: undefined })

      logApiCall({ method: 'GET', path: '/api/x', status: 200, durationMs: 1 })
      window.dispatchEvent(new Event('pagehide'))

      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('também flusha via beacon quando a página fica oculta (visibilitychange)', () => {
      const beaconSpy = vi.fn(() => true)
      vi.stubGlobal('navigator', { ...navigator, sendBeacon: beaconSpy })
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

      logApiCall({ method: 'GET', path: '/api/x', status: 200, durationMs: 1 })
      document.dispatchEvent(new Event('visibilitychange'))

      expect(beaconSpy).toHaveBeenCalledTimes(1)
    })

    it('não flusha em visibilitychange quando a página continua visível', () => {
      const beaconSpy = vi.fn(() => true)
      vi.stubGlobal('navigator', { ...navigator, sendBeacon: beaconSpy })
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')

      logApiCall({ method: 'GET', path: '/api/x', status: 200, durationMs: 1 })
      document.dispatchEvent(new Event('visibilitychange'))

      expect(beaconSpy).not.toHaveBeenCalled()
    })

    it('flusha sozinho ao atingir o tamanho do lote, sem esperar o timer', () => {
      for (let i = 0; i < 20; i += 1) {
        logApiCall({ method: 'GET', path: `/api/x/${i}`, status: 200, durationMs: 1 })
      }
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
      expect(body.events).toHaveLength(20)
    })

    it('flusha pelo timer periódico quando o lote não enche', () => {
      vi.useFakeTimers()
      logApiCall({ method: 'GET', path: '/api/x', status: 200, durationMs: 1 })
      expect(fetchSpy).not.toHaveBeenCalled()
      vi.advanceTimersByTime(10_000)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('registra o listener de unload só uma vez, mesmo com múltiplos eventos', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      logApiCall({ method: 'GET', path: '/api/a', status: 200, durationMs: 1 })
      logApiCall({ method: 'GET', path: '/api/b', status: 200, durationMs: 1 })
      const pagehideCalls = addSpy.mock.calls.filter((c) => c[0] === 'pagehide')
      expect(pagehideCalls).toHaveLength(1)
      addSpy.mockRestore()
    })
  })
})
