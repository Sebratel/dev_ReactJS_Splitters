import { isJsonObject } from '@/shared/lib/typeGuards'

/**
 * Paridade com `SolicitationModel` / `lib/models/solicitation_model.dart`.
 * JSON usa `beginningData` e `finalData` (nomes do BFF).
 */
export type Solicitation = {
  assignmentId: number
  protocol: number
  title: string
  status: string
  team: string
  sectorArea: string
  beginningDate: Date | null
  finalDate: Date | null
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

function parseApiDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function parseSolicitationFromApi(raw: unknown): Solicitation {
  const json = isJsonObject(raw) ? raw : {}
  return {
    assignmentId: pickInt(json.assignmentId),
    protocol: pickInt(json.protocol),
    title: pickString(json.title),
    status: pickString(json.status),
    team: pickString(json.team),
    sectorArea: pickString(json.sectorArea),
    beginningDate: parseApiDate(json.beginningData),
    finalDate: parseApiDate(json.finalData),
  }
}
