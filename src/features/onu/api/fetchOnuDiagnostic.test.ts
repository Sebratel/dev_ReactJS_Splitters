import { describe, expect, it } from 'vitest'
import { parseOnuDiagnostic } from './fetchOnuDiagnostic'

describe('parseOnuDiagnostic', () => {
  it('mapeia os campos de frescor de status (novos)', () => {
    const d = parseOnuDiagnostic({
      pppoeUsername: 'cliente1',
      oltOnuStatus: 'down',
      statusSeenAgeSeconds: '45',
      lastOffAgeSeconds: '120',
    })
    expect(d.statusSeenAgeSeconds).toBe(45)
    expect(d.lastOffAgeSeconds).toBe(120)
    expect(d.oltOnuStatus).toBe('down')
  })

  it('coage numéricos string (PG numeric) e trata vazio/null', () => {
    const d = parseOnuDiagnostic({
      rxPower: '-22.69',
      temperature: '',
      txPower: null,
      projectedRxPower: '-20',
    })
    expect(d.rxPower).toBeCloseTo(-22.69)
    expect(d.temperature).toBeNull()
    expect(d.txPower).toBeNull()
    expect(d.projectedRxPower).toBeCloseTo(-20)
  })

  it('campos ausentes viram null sem quebrar', () => {
    const d = parseOnuDiagnostic({})
    expect(d.pppoeUsername).toBeNull()
    expect(d.statusSeenAgeSeconds).toBeNull()
    expect(d.lastOffAgeSeconds).toBeNull()
    expect(d.rxPower).toBeNull()
  })

  it('normaliza "null"/"" textuais e espaços', () => {
    const d = parseOnuDiagnostic({ mac: '  ', oltHostname: 'OLT_01 ', serialNumber: '' })
    expect(d.mac).toBeNull()
    expect(d.oltHostname).toBe('OLT_01')
    expect(d.serialNumber).toBeNull()
  })
})
