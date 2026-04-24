import { isJsonObject } from '@/shared/lib/typeGuards'

/**
 * Paridade com `_extractRows` em `massiva_gateway_service.dart` — tolera lista na raiz,
 * `response.data`, `data.items`, objeto único, etc.
 */
function safeMap(raw: unknown): Record<string, unknown> {
  if (isJsonObject(raw)) return raw
  if (Array.isArray(raw)) return { data: raw }
  return {}
}

export function extractMassivaListRows(decoded: unknown): Record<string, unknown>[] {
  if (Array.isArray(decoded)) {
    return decoded.filter(isJsonObject)
  }

  if (!isJsonObject(decoded)) {
    return []
  }

  const root = decoded
  const response = safeMap(root.response)
  const data = safeMap(root.data)
  const result = safeMap(root.result)

  if (Array.isArray(response.data)) {
    return response.data.filter(isJsonObject) as Record<string, unknown>[]
  }

  const candidates: unknown[] = [
    root.data,
    response.data,
    result.data,
    root.items,
    root.content,
    root.results,
    root.massivas,
    root.rows,
    root.records,
    data.items,
    data.content,
    data.results,
    data.massivas,
    data.rows,
    data.records,
    response.items,
    response.content,
    response.results,
    response.massivas,
    response.rows,
    response.records,
    result.items,
    result.content,
    result.results,
    result.massivas,
    result.rows,
    result.records,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isJsonObject) as Record<string, unknown>[]
    }
  }

  if (Object.keys(data).length > 0) {
    return [data]
  }
  if (Object.keys(response).length > 0) {
    return [response]
  }
  if (Object.keys(result).length > 0) {
    return [result]
  }

  const protocolHint = root.protocol ?? root.protocolo ?? root.id
  if (protocolHint != null) {
    return [root]
  }

  return []
}
