/**
 * Equivalente a `OltModel` (`lib/models/olt_model.dart`).
 */

import { isJsonObject } from '@/shared/lib/typeGuards'

export type Olt = {
  id: number
  code: string
  title: string
  ip: string
  slotsNumber: number
  portsNumber: number
  portsFirstNumber: number
  active: boolean
  integrationCodeMap: string | null
  postalCode: string | null
  street: string | null
  streetNumber: string | null
  neighborhood: string | null
  city: string | null
  uf: string | null
  lat: number | null
  lng: number | null
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

function pickBool(value: unknown): boolean {
  return value === true
}

function pickOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

function pickOptionalDouble(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = Number.parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function parseOltFromApi(raw: unknown): Olt {
  const json = safeMap(raw)

  return {
    id: pickInt(json.id),
    code: pickString(json.code),
    title: pickString(json.title),
    ip: pickString(json.ip),
    slotsNumber: pickInt(json.slotsNumber),
    portsNumber: pickInt(json.portsNumber),
    portsFirstNumber: pickInt(json.portsFirstNumber),
    active: pickBool(json.active),
    integrationCodeMap: pickOptionalString(json.integrationCodeMap),
    postalCode: pickOptionalString(json.postalCode),
    street: pickOptionalString(json.street),
    streetNumber: pickOptionalString(json.streetNumber),
    neighborhood: pickOptionalString(json.neighborhood),
    city: pickOptionalString(json.city),
    uf: pickOptionalString(json.uf),
    lat: pickOptionalDouble(json.lat),
    lng: pickOptionalDouble(json.lng),
  }
}
