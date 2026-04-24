let currentAccessToken: string | null = null

export function setOidcAccessToken(token: string | null): void {
  currentAccessToken = typeof token === 'string' && token.trim() !== '' ? token : null
}

export function getOidcAccessToken(): string | null {
  return currentAccessToken
}
