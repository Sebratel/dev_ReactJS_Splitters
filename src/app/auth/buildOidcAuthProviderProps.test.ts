import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('buildOidcAuthProviderProps', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_OIDC_AUTHORITY', 'https://issuer.example/')
    vi.stubEnv('VITE_OIDC_CLIENT_ID', 'client-id')
    vi.stubEnv('VITE_OIDC_REDIRECT_PATH', 'callback')
    vi.stubEnv('VITE_OIDC_POST_LOGOUT_REDIRECT_URI', '')
    vi.stubEnv('VITE_OIDC_SCOPE', 'openid')
  })

  it('monta redirect_uri, post_logout e onSigninCallback', async () => {
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      ...window,
      location: { origin: 'https://app.example', pathname: '/y' },
      history: { replaceState },
    } as Window & typeof globalThis)

    const { buildOidcAuthProviderProps } = await import(
      '@/app/auth/buildOidcAuthProviderProps'
    )
    const props = buildOidcAuthProviderProps()
    expect(props.redirect_uri).toBe('https://app.example/callback')
    expect(props.post_logout_redirect_uri).toBe('https://app.example')
    expect(props.authority).toBe('https://issuer.example/')
    expect(props.client_id).toBe('client-id')
    expect(props.scope).toBe('openid')
    props.onSigninCallback?.()
    expect(replaceState).toHaveBeenCalledWith({}, document.title, window.location.pathname)
  })

  it('normaliza redirect path sem barra inicial', async () => {
    vi.stubEnv('VITE_OIDC_REDIRECT_PATH', 'auth/callback')
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      ...window,
      location: { origin: 'https://app.example', pathname: '/' },
      history: { replaceState },
    } as Window & typeof globalThis)

    const { buildOidcAuthProviderProps } = await import(
      '@/app/auth/buildOidcAuthProviderProps'
    )
    const props = buildOidcAuthProviderProps()
    expect(props.redirect_uri).toBe('https://app.example/auth/callback')
  })

  it('post_logout_redirect_uri absoluto e path com barra inicial', async () => {
    vi.stubEnv('VITE_OIDC_POST_LOGOUT_REDIRECT_URI', 'https://logout.example/out')
    vi.stubEnv('VITE_OIDC_REDIRECT_PATH', 'cb')
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      ...window,
      location: { origin: 'https://app.example', pathname: '/' },
      history: { replaceState },
    } as Window & typeof globalThis)

    const { buildOidcAuthProviderProps } = await import(
      '@/app/auth/buildOidcAuthProviderProps'
    )
    const props = buildOidcAuthProviderProps()
    expect(props.redirect_uri).toBe('https://app.example/cb')
    expect(props.post_logout_redirect_uri).toBe('https://logout.example/out')
  })

  it('scope vazio usa fallback openid profile email', async () => {
    vi.stubEnv('VITE_OIDC_SCOPE', '  ')
    const { buildOidcAuthProviderProps } = await import(
      '@/app/auth/buildOidcAuthProviderProps'
    )
    vi.stubGlobal('window', {
      ...window,
      location: { origin: 'https://app.example', pathname: '/' },
      history: { replaceState: vi.fn() },
    } as Window & typeof globalThis)
    const props = buildOidcAuthProviderProps()
    expect(props.scope).toBe('openid profile email')
  })
})
