import { describe, expect, it } from 'vitest'
import { buildConferenciaRowView } from '@/features/dashboard/ui/DashboardConnectionMonitor'
import {
  parseMassivaConferenciaStatus,
  type MassivaConferenciaStatus,
} from '@/features/massiva/model/massivaConferenciaStatus'

const NOW = new Date('2026-11-12T12:00:00.000Z').getTime()
const minAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()
const ready = { isPending: false, isError: false }

function status(over: Record<string, unknown> = {}, ultima: Record<string, unknown> | null = {}): MassivaConferenciaStatus {
  return parseMassivaConferenciaStatus({
    habilitada: true,
    dryRun: false,
    intervaloMinutos: 5,
    gatewayConfigurado: true,
    ultimaExecucao: ultima === null ? null : { ok: true, iniciadoEm: minAgo(2), ...ultima },
    ...over,
  })
}

describe('buildConferenciaRowView — linha "Conferência Elleven" em Saúde das APIs', () => {
  it('verde: habilitada e verificada há menos de 3x o intervalo', () => {
    const v = buildConferenciaRowView(status({}, { iniciadoEm: minAgo(12) }), ready, NOW)
    expect(v.tone).toBe('ok')
    expect(v.note).toBeNull()
    expect(v.interval).toBe('5 min')
    expect(v.updated).not.toBe('—')
  })

  it('vermelho: atrasada (mais de 3x o intervalo)', () => {
    const v = buildConferenciaRowView(status({}, { iniciadoEm: minAgo(20) }), ready, NOW)
    expect(v.tone).toBe('err')
    expect(v.note).toMatch(/3x o intervalo/)
  })

  it('vermelho: última verificação com erro', () => {
    const v = buildConferenciaRowView(status({}, { ok: false, erro: 'timeout' }), ready, NOW)
    expect(v.tone).toBe('err')
    expect(v.note).toMatch(/timeout/)
  })

  it('amarelo: desligada, e o intervalo não é exibido', () => {
    const v = buildConferenciaRowView(status({ habilitada: false }, null), ready, NOW)
    expect(v.tone).toBe('warn')
    expect(v.interval).toBe('—')
    expect(v.updated).toBe('—')
    expect(v.note).toBe('A conferência automática está desligada neste ambiente.')
  })

  it('amarelo: só relatório', () => {
    const v = buildConferenciaRowView(status({ dryRun: true }, { dryRun: true }), ready, NOW)
    expect(v.tone).toBe('warn')
    expect(v.note).toMatch(/só relatório/i)
  })

  it('amarelo: ativa aguardando a primeira verificação', () => {
    const v = buildConferenciaRowView(status({}, null), ready, NOW)
    expect(v.tone).toBe('warn')
    expect(v.note).toBe('Aguardando a primeira verificação.')
  })

  it('endpoint indisponível: cinza, "Indisponível", sem quebrar', () => {
    const v = buildConferenciaRowView(undefined, { isPending: false, isError: true }, NOW)
    expect(v.tone).toBe('idle')
    expect(v.note).toBe('Indisponível no momento.')
    expect(v.updated).toBe('—')
    expect(v.interval).toBe('—')
  })

  it('carregando: amarelo, como as demais linhas enquanto pendentes', () => {
    const v = buildConferenciaRowView(undefined, { isPending: true, isError: false }, NOW)
    expect(v.tone).toBe('warn')
    expect(v.note).toBeNull()
  })
})
