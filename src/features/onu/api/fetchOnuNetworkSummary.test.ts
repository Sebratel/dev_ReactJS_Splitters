import { describe, expect, it } from 'vitest'
import { parseOnuNetworkSummary } from './fetchOnuNetworkSummary'

// Payload representativo do BFF (camelCase), com numéricos como string (PG numeric).
function rawSummary(): Record<string, unknown> {
  return {
    generatedAt: '2026-06-25T12:00:00.000Z',
    totals: { total: 200000, online: '78000', degraded: 2500, offline: 99, noData: 119401, criticalSignal: '606' },
    signalStats: { sampled: 78000, avg: '-21.5', p10: '-26.1', p50: '-21.0', p90: '-17.2' },
    temperature: {
      sampled: 50000, warm: 120, hot: '8', avg: '46.3', max: '78.9',
      warmThreshold: 60, hotThreshold: 70,
      hottest: [{ username: 'cliente1', oltHostname: 'OLT_01', temperature: '78.9', rxPower: '-22.1' }],
    },
    oltCount: 42,
    oltBreakdown: [
      { olt: 'OLT_01', total: 5000, online: 4800, degraded: 150, offline: 50, unknown: 0, critical: 20, monitored: 5000, problemRate: 0.04, offlineRate: 0.01 },
    ],
    histogram: [{ label: '-30 a -25', count: '2246', band: 'warning' }],
    worst: [{ username: 'pior1', oltHostname: 'OLT_04', rxPower: '-35.2', oltOnuStatus: 'up', rxGood: 'critical' }],
    heatPoints: [[-29.5, -51.1, 0.8]],
    problemMarkers: [{ lat: -29.6, lng: -51.2, kind: 'offline', username: 'off1', oltHostname: 'OLT_02', rxPower: null }],
  }
}

describe('parseOnuNetworkSummary', () => {
  it('mapeia todos os campos NOVOS (regressão do bug de campos descartados)', () => {
    const s = parseOnuNetworkSummary(rawSummary())
    // signalStats
    expect(s.signalStats.p50).toBeCloseTo(-21.0)
    expect(s.signalStats.sampled).toBe(78000)
    // temperature
    expect(s.temperature.hot).toBe(8)
    expect(s.temperature.max).toBeCloseTo(78.9)
    expect(s.temperature.hottest).toHaveLength(1)
    expect(s.temperature.hottest[0].temperature).toBeCloseTo(78.9)
    // oltBreakdown / oltCount
    expect(s.oltCount).toBe(42)
    expect(s.oltBreakdown[0].olt).toBe('OLT_01')
    expect(s.oltBreakdown[0].offline).toBe(50)
    // problemMarkers
    expect(s.problemMarkers).toHaveLength(1)
    expect(s.problemMarkers[0].kind).toBe('offline')
    expect(s.problemMarkers[0].rxPower).toBeNull()
  })

  it('coage numéricos vindos como string', () => {
    const s = parseOnuNetworkSummary(rawSummary())
    expect(s.totals.online).toBe(78000)
    expect(s.totals.criticalSignal).toBe(606)
  })

  it('é resiliente a payload mínimo (campos ausentes viram defaults seguros)', () => {
    const s = parseOnuNetworkSummary({ totals: {} })
    expect(s.signalStats.p50).toBeNull()
    expect(s.temperature.hottest).toEqual([])
    expect(s.oltBreakdown).toEqual([])
    expect(s.problemMarkers).toEqual([])
    expect(s.histogram).toEqual([])
    expect(s.worst).toEqual([])
    expect(s.totals.online).toBe(0)
  })

  it('normaliza band inválida do histograma para "ok"', () => {
    const s = parseOnuNetworkSummary({ totals: {}, histogram: [{ label: 'x', count: 5, band: 'lixo' }] })
    expect(s.histogram[0].band).toBe('ok')
  })

  it('marca problemMarker desconhecido como "critical" por padrão', () => {
    const s = parseOnuNetworkSummary({
      totals: {},
      problemMarkers: [{ lat: -29, lng: -51, kind: 'xpto', username: 'a' }],
    })
    expect(s.problemMarkers[0].kind).toBe('critical')
  })
})
