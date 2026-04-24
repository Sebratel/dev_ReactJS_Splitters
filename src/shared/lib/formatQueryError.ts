import { ApiError, NetworkError } from '@/shared/api/apiError'

const API_ERROR_BODY_MAX = 900

export function formatQueryError(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body.trim().replace(/\s+/g, ' ')
    if (body.length === 0) return error.message
    const snippet =
      body.length > API_ERROR_BODY_MAX
        ? `${body.slice(0, API_ERROR_BODY_MAX)}…`
        : body
    return `${error.message} — ${snippet}`
  }
  if (error instanceof NetworkError) return error.message
  if (error instanceof Error) return error.message
  return 'Erro desconhecido.'
}
