import { bffClient } from '@/shared/api/bffClient'
import { isJsonObject } from '@/shared/lib/typeGuards'

/**
 * Paridade `getPersonEllevenId` em `massiva_screen.dart` — GET BFF com Bearer da sessão.
 */
export const EMPLOYEE_GET_PERSON_ID_BY_EMAIL_PATH =
  '/api/v1/employee/get-person-id-by-email' as const

export async function fetchEmployeePersonIdByEmail(
  email: string,
  signal?: AbortSignal,
): Promise<number> {
  const trimmed = email.trim()
  if (trimmed === '') {
    throw new Error('E-mail vazio ao resolver personId.')
  }

  const path = `${EMPLOYEE_GET_PERSON_ID_BY_EMAIL_PATH}?email=${encodeURIComponent(trimmed)}`

  const data: unknown = await bffClient.request({
    path,
    method: 'GET',
    signal,
  })

  if (!isJsonObject(data) || !('data' in data)) {
    throw new Error('Resposta do BFF sem campo data (personId).')
  }

  const raw = data.data
  const n =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.trunc(raw)
      : typeof raw === 'string'
        ? Number.parseInt(raw, 10)
        : Number.NaN

  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('personId inválido ou ausente na resposta do BFF.')
  }

  return n
}
