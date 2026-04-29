/**
 * Equivalente a `SplitterModel` no Flutter (`lib/models/splitter_model.dart`).
 */

import { isJsonObject } from '@/shared/lib/typeGuards'

export type Splitter = {
  id: number
  code: string
  integrationCode: string
  title: string
  outPorts: number
  active: boolean
  typeText: string
  description: string
  latitude: string
  longitude: string
  street: string | null
  networkBoxCode: string | null
  networkBoxTitle: string | null
  networkBoxType: string | null
  oltCode: string | null
  oltIntegrationCode: string | null
  oltDescription: string | null
  createdAt: Date | null
  /** Informação de ocupação real vinda do banco local. */
  busyCount: number
  /** Informação de condomínio extraída via SQL no BFF Local. */
  tipoLocal?: 'CONDOMÍNIO' | 'UNIDADE'
  nomeCondominio?: string | null
}

export function mapSplitterTypeText(raw: string): string {
  const normalized = raw.trim()
  if (normalized === '1') return 'Atendimento'
  if (normalized === '2') return 'Distribuição'
  if (normalized === '3') return 'Em projeto'
  return normalized.length > 0 ? normalized : 'Não definido'
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

/**
 * Mesma regra de `SplitterModel.fromJson` no Flutter.
 */
export function parseSplitterFromApi(raw: unknown): Splitter {
  const json = safeMap(raw)
  const address = safeMap(json.address)
  const networkBox = safeMap(json.networkBox)
  const olt = safeMap(json.olt)
  const typeObj = safeMap(json.type)

  const streetCandidate =
    address.street ??
    address.road ??
    address.pedestrian ??
    address.residential
  const streetTrim = pickString(streetCandidate).trim()

  const networkBoxTypeObj = safeMap(networkBox.type)

  return {
    id: pickInt(json.id),
    code: pickString(json.code),
    integrationCode: pickString(json.integrationCode),
    title: pickString(json.title),
    outPorts: pickInt(json.outPorts),
    active: pickBool(json.active),
    typeText: mapSplitterTypeText(pickString(typeObj.text)),
    description: pickString(json.description),
    latitude: pickString(address.latitude).trim(),
    longitude: pickString(address.longitude).trim(),
    street: streetTrim === '' ? null : streetTrim,
    networkBoxCode:
      networkBox.code === null || networkBox.code === undefined
        ? null
        : pickString(networkBox.code),
    networkBoxTitle:
      networkBox.title === null || networkBox.title === undefined
        ? null
        : pickString(networkBox.title),
    networkBoxType:
      networkBoxTypeObj.text === null || networkBoxTypeObj.text === undefined
        ? null
        : pickString(networkBoxTypeObj.text),
    oltCode:
      olt.code === null || olt.code === undefined ? null : pickString(olt.code),
    oltIntegrationCode:
      olt.integrationCode === null || olt.integrationCode === undefined
        ? null
        : pickString(olt.integrationCode),
    oltDescription:
      olt.description === null || olt.description === undefined
        ? null
        : pickString(olt.description),
    createdAt: null,
    busyCount: 0,
  }
}
