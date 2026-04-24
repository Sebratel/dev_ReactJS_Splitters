import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('env', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolve paths de massiva em DEV quando variáveis vazias', async () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_MASSIVA_OPEN_PATH', '')
    vi.stubEnv('VITE_MASSIVA_CLOSE_PATH', '')
    vi.stubEnv('VITE_MASSIVA_AFETADOS_PATH', '')
    vi.stubEnv('VITE_MASSIVA_LIST_PATH', '')
    const { env } = await import('@/shared/config/env')
    expect(env.massivaOpenPath).toBe('/api/v1/massivas/salvar-massiva-via-api')
    expect(env.massivaClosePath).toBe('/api/v1/massivas/finalizar-chamado-via-api')
    expect(env.massivaAfetadosPath).toBe('/api/v1/afetados')
    expect(env.massivaListPath).toBe('/api/v1/massivas/recuperar-pelo-banco')
  })

  it('massiva paths usam valor explícito da env quando preenchido', async () => {
    vi.stubEnv('VITE_MASSIVA_OPEN_PATH', '/open')
    vi.stubEnv('VITE_MASSIVA_CLOSE_PATH', '/close')
    vi.stubEnv('VITE_MASSIVA_AFETADOS_PATH', '/af')
    vi.stubEnv('VITE_MASSIVA_LIST_PATH', '/list')
    const { env } = await import('@/shared/config/env')
    expect(env.massivaOpenPath).toBe('/open')
    expect(env.massivaClosePath).toBe('/close')
    expect(env.massivaAfetadosPath).toBe('/af')
    expect(env.massivaListPath).toBe('/list')
  })

  it('isOidcConfigured e isAutoIspConfigured', async () => {
    vi.stubEnv('VITE_OIDC_AUTHORITY', ' https://idp ')
    vi.stubEnv('VITE_OIDC_CLIENT_ID', 'cid')
    vi.stubEnv('VITE_AUTOISP_AUTH_ENDPOINT', '')
    vi.stubEnv('VITE_AUTOISP_EVENTS_ENDPOINT', '')
    vi.stubEnv('VITE_AUTOISP_USERNAME', '')
    vi.stubEnv('VITE_AUTOISP_PASSWORD', '')
    const m = await import('@/shared/config/env')
    expect(m.isOidcConfigured()).toBe(true)
    expect(m.isAutoIspConfigured()).toBe(false)

    vi.resetModules()
    vi.stubEnv('VITE_OIDC_AUTHORITY', '')
    vi.stubEnv('VITE_OIDC_CLIENT_ID', 'x')
    const m2 = await import('@/shared/config/env')
    expect(m2.isOidcConfigured()).toBe(false)

    vi.resetModules()
    vi.stubEnv('VITE_AUTOISP_AUTH_ENDPOINT', 'https://a')
    vi.stubEnv('VITE_AUTOISP_EVENTS_ENDPOINT', 'https://e')
    vi.stubEnv('VITE_AUTOISP_USERNAME', 'u')
    vi.stubEnv('VITE_AUTOISP_PASSWORD', 'p')
    const m3 = await import('@/shared/config/env')
    expect(m3.isAutoIspConfigured()).toBe(true)
  })

  it('isGoogleIdentityConfigured', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    let m = await import('@/shared/config/env')
    expect(m.isGoogleIdentityConfigured()).toBe(false)

    vi.resetModules()
    vi.stubEnv(
      'VITE_GOOGLE_CLIENT_ID',
      'seu_client_id_web_do_google.apps.googleusercontent.com',
    )
    m = await import('@/shared/config/env')
    expect(m.isGoogleIdentityConfigured()).toBe(false)

    vi.resetModules()
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'abc.apps.googleusercontent.com')
    m = await import('@/shared/config/env')
    expect(m.isGoogleIdentityConfigured()).toBe(true)
  })

  it('isAutoIspBrowserReady', async () => {
    vi.stubEnv('VITE_AUTOISP_AUTH_ENDPOINT', '')
    vi.stubEnv('VITE_AUTOISP_EVENTS_ENDPOINT', '')
    vi.stubEnv('VITE_AUTOISP_USERNAME', '')
    vi.stubEnv('VITE_AUTOISP_PASSWORD', '')
    let m = await import('@/shared/config/env')
    expect(m.isAutoIspBrowserReady()).toBe(false)

    vi.resetModules()
    vi.stubEnv('VITE_AUTOISP_AUTH_ENDPOINT', 'https://auth')
    vi.stubEnv('VITE_AUTOISP_EVENTS_ENDPOINT', '/api/events')
    vi.stubEnv('VITE_AUTOISP_USERNAME', 'u')
    vi.stubEnv('VITE_AUTOISP_PASSWORD', 'p')
    m = await import('@/shared/config/env')
    expect(m.isAutoIspBrowserReady()).toBe(false)

    vi.resetModules()
    vi.stubEnv('VITE_AUTOISP_AUTH_ENDPOINT', '/__autoisp/a')
    vi.stubEnv('VITE_AUTOISP_EVENTS_ENDPOINT', '/__autoisp/e')
    vi.stubEnv('VITE_AUTOISP_USERNAME', 'u')
    vi.stubEnv('VITE_AUTOISP_PASSWORD', 'p')
    m = await import('@/shared/config/env')
    expect(m.isAutoIspBrowserReady()).toBe(true)
  })

  it('isLocalDevHostname', async () => {
    const m = await import('@/shared/config/env')
    const orig = globalThis.window
    try {
      expect(m.isLocalDevHostname()).toBe(true)
      const mk = (hostname: string) =>
        ({ location: { hostname } }) as unknown as Window
      vi.stubGlobal('window', mk('prod.example'))
      expect(m.isLocalDevHostname()).toBe(false)
      vi.stubGlobal('window', mk('192.168.1.1'))
      expect(m.isLocalDevHostname()).toBe(true)
      vi.stubGlobal('window', mk('10.0.0.1'))
      expect(m.isLocalDevHostname()).toBe(true)
      vi.stubGlobal('window', mk('172.16.0.1'))
      expect(m.isLocalDevHostname()).toBe(true)
      vi.stubGlobal('window', mk('x.trycloudflare.com'))
      expect(m.isLocalDevHostname()).toBe(true)
    } finally {
      vi.stubGlobal('window', orig)
    }
  })
})
