import { env } from '@/shared/config/env'
import type { Olt } from '@/features/splitters/model/olt'

type OltApiRow = {
  id?: unknown
  code?: unknown
  title?: unknown
  ip?: unknown
  active?: unknown
  slotsNumber?: unknown
  portsNumber?: unknown
  portsFirstNumber?: unknown
  integrationCodeMap?: unknown
  postalCode?: unknown
  street?: unknown
  streetNumber?: unknown
  neighborhood?: unknown
  city?: unknown
  uf?: unknown
  lat?: unknown
  lng?: unknown
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

function pickBool(value: unknown): boolean {
  return value === true
}

function pickOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text === '' ? null : text
}

function pickOptionalDouble(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const normalized = String(value).replace(',', '.').trim()
  if (normalized === '') return null
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export async function fetchOltsFromLocalDb(): Promise<Olt[]> {
  const url = `${env.localBffUrl}/api/olts`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Erro ao consultar BFF Local para OLTs: ${response.status}`)
  }

  const result = await response.json()
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('Formato de resposta inesperado ao listar OLTs locais.')
  }

  return result.data.map((row: OltApiRow) => ({
    id: pickInt(row.id),
    code: pickString(row.code),
    title: pickString(row.title),
    ip: pickString(row.ip),
    slotsNumber: pickInt(row.slotsNumber),
    portsNumber: pickInt(row.portsNumber),
    portsFirstNumber: pickInt(row.portsFirstNumber),
    active: pickBool(row.active),
    integrationCodeMap: pickOptionalString(row.integrationCodeMap),
    postalCode: pickOptionalString(row.postalCode),
    street: pickOptionalString(row.street),
    streetNumber: pickOptionalString(row.streetNumber),
    neighborhood: pickOptionalString(row.neighborhood),
    city: pickOptionalString(row.city),
    uf: pickOptionalString(row.uf),
    lat: pickOptionalDouble(row.lat),
    lng: pickOptionalDouble(row.lng),
  }))
}
