import { describe, expect, it } from 'vitest'
import type { User } from 'oidc-client-ts'
import { getOidcUserDisplayName } from '@/app/auth/oidcUserDisplayName'

/** Só o `profile` importa para o nome a mostrar. */
const usuario = (profile: unknown) => ({ profile }) as unknown as User

describe('getOidcUserDisplayName', () => {
  it('sem usuário, devolve null', () => {
    expect(getOidcUserDisplayName(null)).toBeNull()
    expect(getOidcUserDisplayName(undefined)).toBeNull()
  })

  it('perfil ausente ou que não é objeto, devolve null', () => {
    expect(getOidcUserDisplayName(usuario(null))).toBeNull()
    expect(getOidcUserDisplayName(usuario(undefined))).toBeNull()
    expect(getOidcUserDisplayName(usuario('texto'))).toBeNull()
  })

  it('com nome e e-mail, mostra "nome (e-mail)" e ignora espaços nas pontas', () => {
    expect(getOidcUserDisplayName(usuario({ name: '  Bruno Soares ', email: ' bruno@sebratel.com.br ' }))).toBe(
      'Bruno Soares (bruno@sebratel.com.br)',
    )
  })

  it('só com nome, mostra o nome', () => {
    expect(getOidcUserDisplayName(usuario({ name: 'Bruno Soares' }))).toBe('Bruno Soares')
  })

  it('só com e-mail, mostra o e-mail', () => {
    expect(getOidcUserDisplayName(usuario({ email: 'bruno@sebratel.com.br' }))).toBe('bruno@sebratel.com.br')
  })

  it('sem nome nem e-mail, usa o preferred_username', () => {
    expect(getOidcUserDisplayName(usuario({ preferred_username: ' bruno.soares ' }))).toBe('bruno.soares')
  })

  it('campos vazios ou de outro tipo são ignorados; sem nada utilizável, devolve null', () => {
    expect(getOidcUserDisplayName(usuario({ name: '   ', email: 42, preferred_username: '' }))).toBeNull()
    expect(getOidcUserDisplayName(usuario({}))).toBeNull()
  })
})
