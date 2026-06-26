import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { OnuDiagnostic } from '@/features/onu/model/onuDiagnostic'

function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s.length > 0 ? s : null
}

/**
 * Normaliza o JSON do BFF (já em camelCase) num `OnuDiagnostic` tipado.
 * Defensivo quanto a numéricos vindos como string (PG `numeric`).
 */
export function parseOnuDiagnostic(raw: Record<string, unknown>): OnuDiagnostic {
  return {
    pppoeUsername: toText(raw.pppoeUsername),
    gponClientId: (raw.gponClientId as number | string | null) ?? null,
    gponMacId: (raw.gponMacId as number | string | null) ?? null,
    mac: toText(raw.mac),
    serialNumber: toText(raw.serialNumber),
    oltHostname: toText(raw.oltHostname),
    onuModel: toText(raw.onuModel),
    distance: toNum(raw.distance),
    temperature: toNum(raw.temperature),
    relatedGponMacId: (raw.relatedGponMacId as number | string | null) ?? null,
    relatedPonlink: toText(raw.relatedPonlink),
    relatedSerialNumber: toText(raw.relatedSerialNumber),
    onuStatusId: (raw.onuStatusId as number | string | null) ?? null,
    rxGood: toText(raw.rxGood),
    rxPower: toNum(raw.rxPower),
    oltOltRxPower: toNum(raw.oltOltRxPower),
    zabbixOltRxPower: toNum(raw.zabbixOltRxPower),
    zabbixOnuRxPower: toNum(raw.zabbixOnuRxPower),
    oltOnuStatus: toText(raw.oltOnuStatus),
    onuOperStatus: toText(raw.onuOperStatus),
    calculatedStatus: toText(raw.calculatedStatus),
    txPower: toNum(raw.txPower),
    lastOff: toText(raw.lastOff),
    statusUpdatedAt: toText(raw.statusUpdatedAt),
    statusSeenAgeSeconds: toNum(raw.statusSeenAgeSeconds),
    lastOffAgeSeconds: toNum(raw.lastOffAgeSeconds),
    powerThreshold: toNum(raw.powerThreshold),
    ponlink: toText(raw.ponlink),
    onuIndex: toNum(raw.onuIndex),
    gponSplitter: toText(raw.gponSplitter),
    projectedRxPower: toNum(raw.projectedRxPower),
  }
}

/** Diagnóstico de uma ONU pelo usuário PPPoE (= `cliente.user`). */
export async function fetchOnuDiagnostic(
  username: string,
): Promise<OnuDiagnostic | null> {
  const url = `${env.localBffUrl}/api/onu-diagnostics/by-username/${encodeURIComponent(username)}`
  const response = await fetchWithSessionAuth(url)

  if (response.status === 404 || response.status === 503) return null
  if (!response.ok) {
    throw new Error(`Erro ao consultar diagnóstico de ONU: ${response.status}`)
  }

  const result = await response.json()
  if (!result?.success) {
    throw new Error('Formato de resposta inesperado do BFF (ONU).')
  }
  if (!result.data) return null
  return parseOnuDiagnostic(result.data as Record<string, unknown>)
}

/**
 * Diagnóstico em lote. Retorna um `Map<username, OnuDiagnostic>` para casar
 * com a lista de clientes do card. Usuários sem ONU simplesmente não aparecem.
 */
export async function fetchOnuDiagnosticsBatch(
  usernames: readonly string[],
): Promise<Map<string, OnuDiagnostic>> {
  const list = Array.from(
    new Set(usernames.map((u) => String(u ?? '').trim()).filter(Boolean)),
  )
  const map = new Map<string, OnuDiagnostic>()
  if (list.length === 0) return map

  const url = `${env.localBffUrl}/api/onu-diagnostics/batch`
  const response = await fetchWithSessionAuth(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: list }),
  })

  if (response.status === 503) return map
  if (!response.ok) {
    throw new Error(`Erro ao consultar diagnóstico de ONU em lote: ${response.status}`)
  }

  const result = await response.json()
  if (!result?.success || !result.data) return map

  const data = result.data as Record<string, Record<string, unknown>>
  for (const [username, row] of Object.entries(data)) {
    map.set(username, parseOnuDiagnostic(row))
  }
  return map
}
