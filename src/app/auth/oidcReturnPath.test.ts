import { describe, expect, it, vi } from 'vitest'
import {
  buildOidcReturnPath,
  clearOidcReturnPathStorage,
  pathAfterOidcSignIn,
  signinRedirectRetryPreserveStored,
  signinRedirectWithReturnPath,
} from '@/app/auth/oidcReturnPath'

describe('buildOidcReturnPath', () => {
  it('preserva path e query internos seguros', () => {
    expect(buildOidcReturnPath('/intelligence', '')).toBe('/intelligence')
    expect(buildOidcReturnPath('/splitters', '?page=2')).toBe('/splitters?page=2')
    expect(buildOidcReturnPath('/splitters', null as unknown as string)).toBe(
      '/splitters',
    )
  })

  it('rejeita open-redirect e normaliza para home', () => {
    expect(buildOidcReturnPath('//evil.com', '')).toBe('/')
    expect(buildOidcReturnPath('https://evil.com', '')).toBe('/')
    expect(buildOidcReturnPath('/callback', '')).toBe('/')
    expect(buildOidcReturnPath('/callback/foo', '')).toBe('/')
    expect(buildOidcReturnPath('', '')).toBe('/')
    expect(buildOidcReturnPath('', '?q=1')).toBe('/')
  })
})

describe('pathAfterOidcSignIn', () => {
  it('prioriza state do usuário quando string interna válida', () => {
    expect(pathAfterOidcSignIn('/massiva')).toBe('/massiva')
    expect(pathAfterOidcSignIn('/intelligence')).toBe('/intelligence')
  })

  it('ignora state inseguro e usa storage ou /', () => {
    expect(pathAfterOidcSignIn('https://x')).toBe('/')
    expect(pathAfterOidcSignIn('//x')).toBe('/')
    clearOidcReturnPathStorage()
    expect(pathAfterOidcSignIn('/callback?code=1')).toBe('/')
  })

  it('usa sessionStorage quando state ausente', () => {
    clearOidcReturnPathStorage()
    sessionStorage.setItem('nexaview.oidc.returnPath.v1', '/clientes/99')
    expect(pathAfterOidcSignIn(undefined)).toBe('/clientes/99')
    expect(sessionStorage.getItem('nexaview.oidc.returnPath.v1')).toBeNull()
  })

  it('fallback / quando não há state nem storage válido', () => {
    clearOidcReturnPathStorage()
    expect(pathAfterOidcSignIn(undefined)).toBe('/')
  })
})

describe('signinRedirectWithReturnPath', () => {
  it('persiste path seguro e chama signinRedirect com state', () => {
    clearOidcReturnPathStorage()
    const signinRedirect = vi.fn().mockResolvedValue(undefined)
    signinRedirectWithReturnPath(signinRedirect, '/intel', '?x=1')
    expect(signinRedirect).toHaveBeenCalledWith({ state: '/intel?x=1' })
    expect(sessionStorage.getItem('nexaview.oidc.returnPath.v1')).toBe('/intel?x=1')
    clearOidcReturnPathStorage()
  })
})

describe('sessionStorage tolerante a falha', () => {
  it('ignora quota ao persistir, ler e limpar', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota')
      })
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('quota')
      })
    const removeItem = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('quota')
      })
    signinRedirectWithReturnPath(vi.fn(), '/ok', '')
    expect(pathAfterOidcSignIn(undefined)).toBe('/')
    clearOidcReturnPathStorage()
    setItem.mockRestore()
    getItem.mockRestore()
    removeItem.mockRestore()
    clearOidcReturnPathStorage()
  })
})

describe('signinRedirectRetryPreserveStored', () => {
  it('reenvia state guardado ou /', () => {
    clearOidcReturnPathStorage()
    const signinRedirect = vi.fn().mockResolvedValue(undefined)
    sessionStorage.setItem('nexaview.oidc.returnPath.v1', '/massiva')
    signinRedirectRetryPreserveStored(signinRedirect)
    expect(signinRedirect).toHaveBeenCalledWith({ state: '/massiva' })

    clearOidcReturnPathStorage()
    signinRedirectRetryPreserveStored(signinRedirect)
    expect(signinRedirect).toHaveBeenLastCalledWith({ state: '/' })
  })
})
