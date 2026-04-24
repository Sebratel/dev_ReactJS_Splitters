import type { User } from 'oidc-client-ts'

/**
 * Nome a mostrar a partir do perfil OIDC (uso em UI / registo de quem fez ação).
 */
export function getOidcUserDisplayName(user: User | null | undefined): string | null {
  if (user == null) return null
  const p = user.profile
  if (p == null || typeof p !== 'object') return null
  const rec = p as Record<string, unknown>
  const name = typeof rec.name === 'string' ? rec.name.trim() : ''
  const email = typeof rec.email === 'string' ? rec.email.trim() : ''
  if (name !== '' && email !== '') return `${name} (${email})`
  if (name !== '') return name
  if (email !== '') return email
  const pu = typeof rec.preferred_username === 'string' ? rec.preferred_username.trim() : ''
  if (pu !== '') return pu
  return null
}
