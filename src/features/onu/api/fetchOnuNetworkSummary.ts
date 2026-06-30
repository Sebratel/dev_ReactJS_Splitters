import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type {
  OnuHeatPoint,
  OnuNetworkSummary,
  OnuOltBreakdown,
  OnuProblemMarker,
} from '@/features/onu/model/onuNetworkSummary'

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parseHeatPoints(raw: unknown): OnuHeatPoint[] {
  if (!Array.isArray(raw)) return []
  const out: OnuHeatPoint[] = []
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 3) continue
    const lat = Number(p[0])
    const lng = Number(p[1])
    const w = Number(p[2])
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      out.push([lat, lng, Number.isFinite(w) ? w : 0.5])
    }
  }
  return out
}

function parseProblemMarkers(raw: unknown): OnuProblemMarker[] {
  if (!Array.isArray(raw)) return []
  const out: OnuProblemMarker[] = []
  for (const m of raw as Record<string, unknown>[]) {
    const lat = Number(m.lat)
    const lng = Number(m.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    out.push({
      lat,
      lng,
      kind: m.kind === 'offline' ? 'offline' : 'critical',
      username: m.username ? String(m.username) : null,
      oltHostname: m.oltHostname ? String(m.oltHostname) : null,
      rxPower: numOrNull(m.rxPower),
    })
  }
  return out
}

function parseOltBreakdown(raw: unknown): OnuOltBreakdown[] {
  if (!Array.isArray(raw)) return []
  return (raw as Record<string, unknown>[]).map((o) => ({
    olt: String(o.olt ?? 'Sem OLT'),
    total: num(o.total),
    online: num(o.online),
    degraded: num(o.degraded),
    offline: num(o.offline),
    unknown: num(o.unknown),
    critical: num(o.critical),
    monitored: num(o.monitored),
    problemRate: num(o.problemRate),
    offlineRate: num(o.offlineRate),
  }))
}

export async function fetchOnuNetworkSummary(): Promise<OnuNetworkSummary | null> {
  const url = `${env.localBffUrl}/api/onu-diagnostics/summary`
  const response = await fetchWithSessionAuth(url)

  if (response.status === 503) return null
  if (!response.ok) {
    throw new Error(`Erro ao consultar resumo de ONU: ${response.status}`)
  }

  const result = await response.json()
  if (!result?.success || !result.data) return null

  return parseOnuNetworkSummary(result.data as Record<string, unknown>)
}

/**
 * Converte o payload bruto do BFF num `OnuNetworkSummary` tipado. Exportado e
 * puro para testes — guarda contra regressão do bug em que campos novos
 * (signalStats/oltBreakdown/temperature/problemMarkers) eram descartados aqui.
 */
export function parseOnuNetworkSummary(d: Record<string, unknown>): OnuNetworkSummary {
  const t = (d.totals ?? {}) as Record<string, unknown>
  const s = (d.signalStats ?? {}) as Record<string, unknown>
  const tp = (d.temperature ?? {}) as Record<string, unknown>

  return {
    generatedAt: String(d.generatedAt ?? ''),
    totals: {
      total: num(t.total),
      online: num(t.online),
      degraded: num(t.degraded),
      offline: num(t.offline),
      noData: num(t.noData),
      criticalSignal: num(t.criticalSignal),
    },
    signalStats: {
      sampled: num(s.sampled),
      avg: numOrNull(s.avg),
      p10: numOrNull(s.p10),
      p50: numOrNull(s.p50),
      p90: numOrNull(s.p90),
    },
    temperature: {
      sampled: num(tp.sampled),
      warm: num(tp.warm),
      hot: num(tp.hot),
      avg: numOrNull(tp.avg),
      max: numOrNull(tp.max),
      warmThreshold: num(tp.warmThreshold) || 60,
      hotThreshold: num(tp.hotThreshold) || 70,
      hottest: Array.isArray(tp.hottest)
        ? (tp.hottest as Record<string, unknown>[]).map((h) => ({
            username: h.username ? String(h.username) : null,
            oltHostname: h.oltHostname ? String(h.oltHostname) : null,
            temperature: numOrNull(h.temperature),
            rxPower: numOrNull(h.rxPower),
          }))
        : [],
    },
    oltCount: num(d.oltCount),
    oltBreakdown: parseOltBreakdown(d.oltBreakdown),
    histogram: Array.isArray(d.histogram)
      ? (d.histogram as Record<string, unknown>[]).map((h) => ({
          label: String(h.label ?? ''),
          count: num(h.count),
          band:
            h.band === 'critical' || h.band === 'warning' ? h.band : 'ok',
        }))
      : [],
    worst: Array.isArray(d.worst)
      ? (d.worst as Record<string, unknown>[]).map((w) => ({
          username: w.username ? String(w.username) : null,
          oltHostname: w.oltHostname ? String(w.oltHostname) : null,
          rxPower: w.rxPower === null || w.rxPower === undefined ? null : num(w.rxPower),
          oltOnuStatus: w.oltOnuStatus ? String(w.oltOnuStatus) : null,
          rxGood: w.rxGood ? String(w.rxGood) : null,
        }))
      : [],
    heatPoints: parseHeatPoints(d.heatPoints),
    problemMarkers: parseProblemMarkers(d.problemMarkers),
  }
}
