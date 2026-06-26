import { describe, expect, it } from 'vitest'
import {
  deriveAttenuation,
  deriveOnuSignalStatus,
  deriveTempLevel,
  formatAgo,
  isNoOpticalSignal,
  type OnuDiagnostic,
} from './onuDiagnostic'

function makeDiag(overrides: Partial<OnuDiagnostic> = {}): OnuDiagnostic {
  return {
    pppoeUsername: 'cliente1',
    gponClientId: 1,
    gponMacId: 1,
    mac: '94:e3:ee:0e:10:55',
    serialNumber: null,
    oltHostname: 'OLT6',
    onuModel: 'F670L',
    distance: 1000,
    temperature: 45,
    relatedGponMacId: null,
    relatedPonlink: null,
    relatedSerialNumber: null,
    onuStatusId: 1,
    rxGood: 'OK',
    rxPower: -20,
    oltOltRxPower: -23,
    zabbixOltRxPower: -23,
    zabbixOnuRxPower: -20,
    oltOnuStatus: 'up',
    onuOperStatus: 'OK',
    // Default null → os testes de status exercitam o FALLBACK por campos brutos.
    // Os testes de prioridade do reconciliado setam calculatedStatus explicitamente.
    calculatedStatus: null,
    txPower: 2,
    lastOff: null,
    statusUpdatedAt: '2026-06-24T00:00:00Z',
    statusSeenAgeSeconds: 20,
    lastOffAgeSeconds: null,
    powerThreshold: null,
    ponlink: '1/1/2',
    onuIndex: 1,
    gponSplitter: null,
    projectedRxPower: null,
    ...overrides,
  }
}

describe('deriveOnuSignalStatus', () => {
  it('retorna "online" com OLT up e sinal saudável', () => {
    expect(deriveOnuSignalStatus(makeDiag())).toBe('online')
  })

  it('retorna "offline" quando a OLT reporta queda', () => {
    expect(deriveOnuSignalStatus(makeDiag({ oltOnuStatus: 'down' }))).toBe('offline')
    expect(deriveOnuSignalStatus(makeDiag({ oltOnuStatus: 'power_fail' }))).toBe('offline')
    expect(deriveOnuSignalStatus(makeDiag({ oltOnuStatus: 'loss_signal' }))).toBe('offline')
  })

  it('retorna "degraded" com sinal fraco ou qualidade em alerta', () => {
    expect(deriveOnuSignalStatus(makeDiag({ rxPower: -26 }))).toBe('degraded')
    expect(deriveOnuSignalStatus(makeDiag({ rxGood: 'warning' }))).toBe('degraded')
    expect(deriveOnuSignalStatus(makeDiag({ rxGood: 'critical' }))).toBe('degraded')
  })

  it('0.0 dBm (sem luz/LOS) é "offline", mesmo com OLT reportando "up"', () => {
    expect(deriveOnuSignalStatus(makeDiag({ rxPower: 0, oltOnuStatus: 'up', rxGood: 'OK' }))).toBe(
      'offline',
    )
  })

  it('retorna "unknown" sem dados ou sem diagnóstico', () => {
    expect(deriveOnuSignalStatus(null)).toBe('unknown')
    expect(
      deriveOnuSignalStatus(
        makeDiag({ oltOnuStatus: null, rxGood: null, onuOperStatus: null, rxPower: null }),
      ),
    ).toBe('unknown')
  })
})

describe('deriveOnuSignalStatus — prioridade do calculated_status (reconciliado)', () => {
  it('calc "ok" sobrepõe olt_onu_status "down" velho → online (o bug reportado)', () => {
    expect(
      deriveOnuSignalStatus(makeDiag({ calculatedStatus: 'ok', oltOnuStatus: 'down', rxPower: -22 })),
    ).toBe('online')
  })

  it('calc "up" com sinal bom → online', () => {
    expect(deriveOnuSignalStatus(makeDiag({ calculatedStatus: 'up', rxPower: -20 }))).toBe('online')
  })

  it('calc "ok" mas sinal fraco (<= -25) → degraded', () => {
    expect(deriveOnuSignalStatus(makeDiag({ calculatedStatus: 'ok', rxPower: -26 }))).toBe('degraded')
  })

  it('calc "down" → offline (mesmo com olt_onu_status "up")', () => {
    expect(
      deriveOnuSignalStatus(makeDiag({ calculatedStatus: 'down', oltOnuStatus: 'up', rxPower: -20 })),
    ).toBe('offline')
  })

  it('calc "warning"/"critical" → degraded', () => {
    expect(deriveOnuSignalStatus(makeDiag({ calculatedStatus: 'warning' }))).toBe('degraded')
    expect(deriveOnuSignalStatus(makeDiag({ calculatedStatus: 'critical' }))).toBe('degraded')
  })

  it('0.0 dBm continua offline mesmo com calc "ok" (LOS tem precedência)', () => {
    expect(deriveOnuSignalStatus(makeDiag({ calculatedStatus: 'ok', rxPower: 0 }))).toBe('offline')
  })
})

describe('deriveAttenuation (Fase 2)', () => {
  it('é "unknown" sem sinal projetado', () => {
    expect(deriveAttenuation(makeDiag({ projectedRxPower: null })).level).toBe('unknown')
  })

  it('é "unknown" sem rxPower', () => {
    expect(deriveAttenuation(makeDiag({ rxPower: null, projectedRxPower: -20 })).level).toBe('unknown')
  })

  it('é "unknown" quando rxPower é 0 (sem sinal) — não compara LOS com projetado', () => {
    expect(deriveAttenuation(makeDiag({ rxPower: 0, projectedRxPower: -20 })).level).toBe('unknown')
  })

  it('é "ok" exatamente na margem de 1 dB', () => {
    const r = deriveAttenuation(makeDiag({ rxPower: -21, projectedRxPower: -20 }))
    expect(r.level).toBe('ok')
    expect(r.deltaDb).toBeCloseTo(1)
  })

  it('é "ok" dentro da margem (< 1 dB)', () => {
    const r = deriveAttenuation(makeDiag({ rxPower: -20.5, projectedRxPower: -20 }))
    expect(r.level).toBe('ok')
    expect(r.deltaDb).toBeCloseTo(0.5)
  })

  it('é "ok" quando sinal atual é melhor que o projetado (delta negativo)', () => {
    const r = deriveAttenuation(makeDiag({ rxPower: -18, projectedRxPower: -20 }))
    expect(r.level).toBe('ok')
    expect(r.deltaDb).toBeCloseTo(-2)
  })

  it('dispara "warning" logo acima da margem (entre 1 e 3 dB)', () => {
    const r = deriveAttenuation(makeDiag({ rxPower: -22, projectedRxPower: -20 }))
    expect(r.level).toBe('warning')
    expect(r.deltaDb).toBeCloseTo(2)
  })

  it('é "warning" no limite superior da faixa (delta = 3 dB = margem + 2)', () => {
    // deltaDb = projectedRxPower - rxPower = -20 - (-23) = 3 → teto do warning
    const r = deriveAttenuation(makeDiag({ rxPower: -23, projectedRxPower: -20 }))
    expect(r.level).toBe('warning')
    expect(r.deltaDb).toBeCloseTo(3)
  })

  it('dispara "critical" quando o sinal atual está muito abaixo do projetado (> 3 dB)', () => {
    expect(deriveAttenuation(makeDiag({ rxPower: -27, projectedRxPower: -20 })).level).toBe(
      'critical',
    )
  })

  it('é "unknown" quando diagnostic é null', () => {
    expect(deriveAttenuation(null).level).toBe('unknown')
    expect(deriveAttenuation(undefined).level).toBe('unknown')
  })
})

describe('deriveTempLevel', () => {
  it('é "unknown" sem leitura', () => {
    expect(deriveTempLevel(null)).toBe('unknown')
    expect(deriveTempLevel(undefined)).toBe('unknown')
  })
  it('é "ok" abaixo de 60 °C', () => {
    expect(deriveTempLevel(45)).toBe('ok')
    expect(deriveTempLevel(59.9)).toBe('ok')
  })
  it('é "warm" entre 60 e 70 °C', () => {
    expect(deriveTempLevel(60)).toBe('warm')
    expect(deriveTempLevel(69.9)).toBe('warm')
  })
  it('é "hot" a partir de 70 °C', () => {
    expect(deriveTempLevel(70)).toBe('hot')
    expect(deriveTempLevel(85)).toBe('hot')
  })
})

describe('isNoOpticalSignal', () => {
  it('true apenas para rxPower === 0', () => {
    expect(isNoOpticalSignal(makeDiag({ rxPower: 0 }))).toBe(true)
  })
  it('false para sinal real negativo, null e diagnóstico ausente', () => {
    expect(isNoOpticalSignal(makeDiag({ rxPower: -22 }))).toBe(false)
    expect(isNoOpticalSignal(makeDiag({ rxPower: null }))).toBe(false)
    expect(isNoOpticalSignal(null)).toBe(false)
    expect(isNoOpticalSignal(undefined)).toBe(false)
  })
})

describe('formatAgo', () => {
  it('retorna null sem valor', () => {
    expect(formatAgo(null)).toBeNull()
    expect(formatAgo(undefined)).toBeNull()
  })
  it('"agora" para menos de 45s e para negativos (skew de relógio)', () => {
    expect(formatAgo(0)).toBe('agora')
    expect(formatAgo(44)).toBe('agora')
    expect(formatAgo(-10)).toBe('agora')
  })
  it('minutos', () => {
    expect(formatAgo(60)).toBe('há 1 min')
    expect(formatAgo(150)).toBe('há 3 min')
  })
  it('horas e minutos', () => {
    expect(formatAgo(3600)).toBe('há 1 h')
    expect(formatAgo(3600 + 600)).toBe('há 1 h 10 min')
  })
  it('dias', () => {
    expect(formatAgo(2 * 86400)).toBe('há 2 d')
  })
})

describe('deriveOnuSignalStatus — casos extras', () => {
  it('retorna "offline" quando rxGood é "inactive"', () => {
    expect(deriveOnuSignalStatus(makeDiag({ oltOnuStatus: null, rxGood: 'inactive' }))).toBe('offline')
  })

  it('retorna "offline" quando rxGood é "power_fail"', () => {
    expect(deriveOnuSignalStatus(makeDiag({ oltOnuStatus: null, rxGood: 'power_fail' }))).toBe('offline')
  })

  it('sinal exatamente em -25 dBm já é "degraded"', () => {
    expect(deriveOnuSignalStatus(makeDiag({ rxPower: -25 }))).toBe('degraded')
  })

  it('sinal acima de -25 dBm permanece "online"', () => {
    expect(deriveOnuSignalStatus(makeDiag({ rxPower: -24.9 }))).toBe('online')
  })
})
