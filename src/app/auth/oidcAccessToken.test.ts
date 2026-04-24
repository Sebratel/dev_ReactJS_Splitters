import { describe, expect, it } from 'vitest'
import {
  getOidcAccessToken,
  setOidcAccessToken,
} from '@/app/auth/oidcAccessToken'

describe('oidcAccessToken', () => {
  it('armazena token não vazio e limpa com null ou string vazia', () => {
    setOidcAccessToken('  abc  ')
    expect(getOidcAccessToken()).toBe('  abc  ')
    setOidcAccessToken(null)
    expect(getOidcAccessToken()).toBeNull()
    setOidcAccessToken('   ')
    expect(getOidcAccessToken()).toBeNull()
    setOidcAccessToken('')
    expect(getOidcAccessToken()).toBeNull()
  })
})
