import type { MassivaOpenSingleResult } from '@/features/massiva/model/massivaOpenMutation'
import { isJsonObject } from '@/shared/lib/typeGuards'
import { ApiError } from '@/shared/api/apiError'

function nestedMap(raw: unknown): Record<string, unknown> {
  if (isJsonObject(raw)) {
    return { ...raw }
  }
  return {}
}

/**
 * Paridade `EllevenMassivaResponse.fromJson` + falha quando `success === false`
 * (como `_parseOpenMassivaResponse` no Flutter).
 */
export function parseMassivaOpenResponseToResult(
  json: unknown,
  accessPointCode: string,
): MassivaOpenSingleResult {
  const root = nestedMap(json)
  const data = nestedMap(root.data)
  const dataResponse = nestedMap(data.response)
  const response = nestedMap(root.response)
  const result = nestedMap(root.result)

  const merged: Record<string, unknown> = {
    ...dataResponse,
    ...result,
    ...response,
    ...data,
    ...root,
  }

  const success = merged.success !== false

  const createdRaw = merged.createdProtocols
  const createdProtocols = Array.isArray(createdRaw)
    ? createdRaw
        .map((e) => Number.parseInt(String(e), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    : []

  const keyPart = merged.protocol ?? merged.protocolo ?? merged.id ?? ''
  const protocolFromKeys = Number.parseInt(String(keyPart), 10)
  const protocolParsed =
    Number.isFinite(protocolFromKeys) && protocolFromKeys > 0 ? protocolFromKeys : null
  const protocol =
    protocolParsed ??
    (createdProtocols.length > 0 ? (createdProtocols[0] ?? null) : null)

  const assignmentParsed = Number.parseInt(String(merged.assignmentId ?? ''), 10)
  const assignmentId =
    Number.isFinite(assignmentParsed) && assignmentParsed > 0
      ? assignmentParsed
      : null

  const message = String(
    dataResponse.message ?? merged.message ?? merged.mensagem ?? '',
  )

  if (!success) {
    const detail =
      message.trim() !== ''
        ? message
        : 'O backend indicou success=false sem mensagem.'
    throw new Error(detail)
  }

  return {
    accessPointCode,
    protocol,
    assignmentId,
    message,
    createdProtocols,
  }
}

export function parseMassivaOpenHttpResult(
  data: unknown,
  accessPointCode: string,
): MassivaOpenSingleResult {
  try {
    return parseMassivaOpenResponseToResult(data, accessPointCode)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(msg)
  }
}

export function formatMassivaOpenApiFailure(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body.trim()
    return body !== '' ? body : err.message
  }
  if (err instanceof Error) return err.message
  return String(err)
}
