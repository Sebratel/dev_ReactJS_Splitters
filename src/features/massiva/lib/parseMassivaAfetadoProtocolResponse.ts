import { isJsonObject } from '@/shared/lib/typeGuards'

function pickInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

/** Campos comuns em BFF / Spring para “quantidade de afetados”. */
const COUNT_KEYS: readonly string[] = [
  'totalAfetados',
  'quantidadeAfetados',
  'qtdAfetados',
  'affectedClients',
  'affectedUsersQuantity',
  'total',
  'quantidade',
  'count',
  'size',
  'totalElements',
  'totalCount',
  'numberOfElements',
  'recordsTotal',
  'length',
  'numeroAfetados',
  'qtdeAfetados',
  'quantity',
  'qty',
  'amount',
]

const LIST_LIKE_KEYS: readonly string[] = [
  'usuarioAfetadoEntities',
  'entities',
  'afetados',
  'usuariosAfetados',
  'affectedUsers',
  /** Mapa `id -> { estimateTimeOfRestoration, … }` no BFF (impacted users). */
  'impactedUsers',
  'items',
  'lista',
  'registros',
]

/**
 * Percorre o JSON (objetos aninhados) sem tratar números soltos como total —
 * só aceita chaves conhecidas ou tamanho de arrays.
 */
function extractAfetadosCount(value: unknown, depth: number): number | null {
  if (depth > 12 || value === null || value === undefined) return null

  if (Array.isArray(value)) {
    return value.length
  }

  if (!isJsonObject(value)) {
    return null
  }

  const o = value

  if (Array.isArray(o.content)) {
    return o.content.length
  }

  for (const key of COUNT_KEYS) {
    if (!(key in o)) continue
    const v = o[key]
    if (Array.isArray(v)) return v.length
    const n = pickInt(v, -1)
    if (n >= 0) return n
  }

  for (const key of LIST_LIKE_KEYS) {
    if (!(key in o)) continue
    const v = o[key]
    if (Array.isArray(v)) return v.length
    if (isJsonObject(v) && !Array.isArray(v)) {
      return Object.keys(v).length
    }
  }

  for (const v of Object.values(o)) {
    if (v !== null && typeof v === 'object') {
      const found = extractAfetadosCount(v, depth + 1)
      if (found !== null) return found
    }
  }

  return null
}

/**
 * Extrai o total de afetados do GET `/api/v1/afetados/protocol/{protocol}`.
 * Aceita JSON aninhado (`data`, `result`, listas, `usuarioAfetadoEntities`, paginação Spring, etc.).
 */
function pickEtrHours(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const s = String(value).trim().replace(/,/g, '.')
  const n = typeof value === 'number' ? value : Number.parseFloat(s)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

const ETR_KEYS: readonly string[] = [
  'estimateTimeOfRestoration',
  'estimate_time_of_restoration',
  'EstimateTimeOfRestoration',
]

/**
 * Primeiro `estimateTimeOfRestoration` encontrado (ex. em `data.impactedUsers.{id}`).
 */
function extractEstimateTimeOfRestoration(value: unknown, depth: number): number | null {
  if (depth > 24 || value === null || value === undefined) return null

  if (Array.isArray(value)) {
    for (const item of value) {
      const n = extractEstimateTimeOfRestoration(item, depth + 1)
      if (n !== null) return n
    }
    return null
  }

  if (!isJsonObject(value)) return null

  for (const key of ETR_KEYS) {
    if (!(key in value)) continue
    const n = pickEtrHours(value[key])
    if (n !== null) return n
  }

  for (const v of Object.values(value)) {
    const n = extractEstimateTimeOfRestoration(v, depth + 1)
    if (n !== null) return n
  }

  return null
}

/**
 * Contagem de afetados + ETR (horas) quando o BFF expõe só no GET de protocolo, não na listagem.
 */
export function parseMassivaAfetadoProtocolEnrichment(data: unknown): {
  count: number | null
  estimateTimeOfRestoration: number | null
} {
  return {
    count: parseMassivaAfetadoProtocolResponse(data),
    estimateTimeOfRestoration: extractEstimateTimeOfRestoration(data, 0),
  }
}

export function parseMassivaAfetadoProtocolResponse(data: unknown): number | null {
  if (data === null || data === undefined) return null

  if (typeof data === 'string') {
    const t = data.trim()
    if (t === '') return null
    const direct = pickInt(t, -1)
    if (direct >= 0) return direct
    try {
      return parseMassivaAfetadoProtocolResponse(JSON.parse(t) as unknown)
    } catch {
      return null
    }
  }

  return extractAfetadosCount(data, 0)
}
