/**
 * Equivalente a `ClienteModel` e tipos aninhados em `lib/models/cliente_model.dart`.
 */

import { isJsonObject } from '@/shared/lib/typeGuards'

export type ClienteAddress = {
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  postalCode: string
  complement: string | null
  latitude: number | null
  longitude: number | null
}

export type AuthenticationAccessPoint = {
  code: string
  title: string
  slotOlt: number
  portOlt: number
}

export type ContractInfo = {
  id: number
  status: number
  statusDescription: string
  stage: number
  stageDescription: string
}

export type SplitterPortState = {
  port: number
  blocked: boolean
  blockedDescription: string | null
}

export type SplitterCliente = {
  clientId: number
  authenticationId: number
  user: string
  name: string
  phone: string | null
  email: string | null
  status: number
  port: number | null
  blocked: boolean
  blockedDescription: string | null
  /** Cliente corporativo (PJ / contrato empresarial) — vem do BFF/SQL conforme aliases em `CORPORATE_CLIENT_FLAG_ROW_KEYS`. */
  isCorporate: boolean
  splitterCode: string | null
  splitterTitle: string | null
  address: ClienteAddress | null
  accessPoint: AuthenticationAccessPoint | null
  contract: ContractInfo | null
}

function safeMap(raw: unknown): Record<string, unknown> {
  return isJsonObject(raw) ? raw : {}
}

function pickInt(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function pickString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function pickOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function pickOptionalDouble(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim()
    if (normalized === '') return null
    const n = Number.parseFloat(normalized)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function parseClienteAddress(raw: unknown): ClienteAddress | null {
  if (!isJsonObject(raw)) return null
  return {
    street: pickString(raw.street),
    number: pickString(raw.number),
    neighborhood: pickString(raw.neighborhood),
    city: pickString(raw.city),
    state: pickString(raw.state),
    postalCode: pickString(raw.postalCode),
    complement:
      raw.addressComplement === null || raw.addressComplement === undefined
        ? null
        : pickString(raw.addressComplement),
    latitude: pickOptionalDouble(raw.latitude),
    longitude: pickOptionalDouble(raw.longitude),
  }
}

function parseAuthenticationAccessPoint(
  raw: unknown,
): AuthenticationAccessPoint | null {
  if (!isJsonObject(raw)) return null
  return {
    code: pickString(raw.code),
    title: pickString(raw.title),
    slotOlt: pickInt(raw.slotOlt),
    portOlt: pickInt(raw.portOlt),
  }
}

function parseContractInfo(raw: unknown): ContractInfo | null {
  if (!isJsonObject(raw)) return null
  return {
    id: pickInt(raw.id),
    status: pickInt(raw.status),
    statusDescription: pickString(raw.statusDescription),
    stage: pickInt(raw.stage),
    stageDescription: pickString(raw.stageDescription),
  }
}

/** Aliases usuais no resultado SQL (`SPLITTERS_BASE_QUERY` / listagem de conexões). Acrescente o nome da coluna da tua consulta aqui. */
export const CORPORATE_CLIENT_FLAG_ROW_KEYS: readonly string[] = [
  'CORPORATIVO',
  'CLIENTE CORPORATIVO',
  'FL_CORPORATIVO',
  'IS_CORPORATE',
  'corporativo',
]

const API_CORPORATE_KEYS: readonly string[] = [
  'isCorporate',
  'corporate',
  'corporativo',
  'clienteCorporativo',
  'Corporativo',
  'CORPORATIVO',
]

function interpretCorporateScalar(value: unknown): boolean {
  if (value === true) return true
  if (value === false) return false
  if (typeof value === 'number' && Number.isFinite(value)) return value === 1
  const t = String(value).trim().toLowerCase()
  return (
    t === '1' ||
    t === 'true' ||
    t === 't' ||
    t === 's' ||
    t === 'sim' ||
    t === 'y' ||
    t === 'yes' ||
    t === 'c' ||
    t === 'corp' ||
    t === 'corporativo' ||
    t === 'pj'
  )
}

function readCorporateFromRecord(rec: Record<string, unknown>): boolean | null {
  for (const key of API_CORPORATE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(rec, key)) continue
    const v = rec[key]
    if (v === undefined || v === null) continue
    return interpretCorporateScalar(v)
  }
  return null
}

export function pickIsCorporateFromRow(row: Record<string, unknown>): boolean {
  for (const key of CORPORATE_CLIENT_FLAG_ROW_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) continue
    const v = row[key]
    if (v === undefined || v === null) continue
    return interpretCorporateScalar(v)
  }
  return false
}

function mergeCorporateFromApi(json: Record<string, unknown>, client: Record<string, unknown>): boolean {
  return readCorporateFromRecord(json) ?? readCorporateFromRecord(client) ?? false
}

export function parseSplitterClienteFromApi(raw: unknown): SplitterCliente {
  const json = safeMap(raw)
  const client = safeMap(json.client)
  const splitter = safeMap(json.splitter)

  const splitterCodeRaw = splitter.code
  const splitterTitleRaw = splitter.title
  const splitterCode =
    splitterCodeRaw === null || splitterCodeRaw === undefined
      ? null
      : pickString(splitterCodeRaw)
  const splitterTitle =
    splitterTitleRaw === null || splitterTitleRaw === undefined
      ? null
      : pickString(splitterTitleRaw)

  return {
    authenticationId: pickInt(json.id),
    clientId: pickInt(client.id),
    user: pickString(json.user),
    name: pickString(client.name),
    phone: json.phone != null ? pickString(json.phone) : null,
    email: json.email != null ? pickString(json.email) : null,
    status: pickInt(json.status),
    port: pickOptionalInt(splitter.port),
    blocked: json.blocked === true,
    blockedDescription:
      json.blockedDescription === null || json.blockedDescription === undefined
        ? null
        : pickString(json.blockedDescription),
    isCorporate: mergeCorporateFromApi(json, client),
    splitterCode: splitterCode === '' ? null : splitterCode,
    splitterTitle: splitterTitle === '' ? null : splitterTitle,
    address: parseClienteAddress(json.address),
    accessPoint: parseAuthenticationAccessPoint(json.authenticationAccessPoint),
    contract: parseContractInfo(json.contract),
  }
}
