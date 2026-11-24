import { describe, expect, it } from 'vitest'
import {
  conferenciaMode,
  evaluateConferenciaHealth,
  formatConferenciaRelative,
} from '@/features/massiva/lib/massivaConferenciaHealth'
import {
  parseMassivaConferenciaStatus,
  type MassivaConferenciaStatus,
} from '@/features/massiva/model/massivaConferenciaStatus'

const NOW = new Date('2026-11-12T12:00:00.000Z').getTime()
const minAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

function status(over: Record<string, unknown> = {}, ultima: Record<string, unknown> | null = {}): MassivaConferenciaStatus {
  return parseMassivaConferenciaStatus({
    habilitada: true,
    dryRun: false,
    intervaloMinutos: 5,
    gatewayConfigurado: true,
    ultimaExecucao: ultima === null ? null : { ok: true, iniciadoEm: minAgo(2), elleven: { total: 10, abertos: 1 }, ...ultima },
    ...over,
  })
}

describe('evaluateConferenciaHealth — regra de cor', () => {
  it('verde: ativa, verificada há menos de 3x o intervalo', () => {
    const h = evaluateConferenciaHealth(status({}, { iniciadoEm: minAgo(14) }), NOW)
    expect(h.tone).toBe('ok')
    expect(h.mode).toBe('ativa')
    expect(h.atrasada).toBe(false)
  })

  it('verde no limite: exatamente 3x o intervalo ainda não é atraso', () => {
    expect(evaluateConferenciaHealth(status({}, { iniciadoEm: minAgo(15) }), NOW).tone).toBe('ok')
  })

  it('vermelho: ativa e atrasada (mais de 3x o intervalo)', () => {
    const h = evaluateConferenciaHealth(status({}, { iniciadoEm: minAgo(16) }), NOW)
    expect(h.tone).toBe('err')
    expect(h.atrasada).toBe(true)
    expect(h.reason).toMatch(/3x o intervalo/)
  })

  it('o limite acompanha o intervalo configurado (10 min → 30 min)', () => {
    expect(evaluateConferenciaHealth(status({ intervaloMinutos: 10 }, { iniciadoEm: minAgo(29) }), NOW).tone).toBe('ok')
    expect(evaluateConferenciaHealth(status({ intervaloMinutos: 10 }, { iniciadoEm: minAgo(31) }), NOW).tone).toBe('err')
  })

  it('vermelho: última verificação com erro', () => {
    const h = evaluateConferenciaHealth(status({}, { ok: false, erro: 'Gateway fora do ar' }), NOW)
    expect(h.tone).toBe('err')
    expect(h.reason).toMatch(/Gateway fora do ar/)
  })

  it('vermelho: falha ao gravar protocolos', () => {
    const h = evaluateConferenciaHealth(status({}, { falhasTotal: 2 }), NOW)
    expect(h.tone).toBe('err')
    expect(h.reason).toMatch(/2 protocolo/)
  })

  it('execução ignorada (anterior em andamento) não é erro', () => {
    const h = evaluateConferenciaHealth(status({}, { ok: false, skipped: true, erro: 'Execução anterior ainda em andamento.' }), NOW)
    expect(h.tone).toBe('ok')
  })

  it('amarelo: desligada', () => {
    const h = evaluateConferenciaHealth(status({ habilitada: false }, null), NOW)
    expect(h.tone).toBe('warn')
    expect(h.mode).toBe('desligada')
    expect(h.modeLabel).toBe('Desligada')
    expect(h.reason).toBe('A conferência automática está desligada neste ambiente.')
  })

  it('amarelo: só relatório (mesmo em dia)', () => {
    const h = evaluateConferenciaHealth(status({ dryRun: true }, { dryRun: true }), NOW)
    expect(h.tone).toBe('warn')
    expect(h.mode).toBe('so_relatorio')
    expect(h.modeLabel).toBe('Só relatório')
  })

  it('amarelo: ativa mas ainda sem a primeira verificação', () => {
    const h = evaluateConferenciaHealth(status({}, null), NOW)
    expect(h.tone).toBe('warn')
    expect(h.executou).toBe(false)
    expect(h.reason).toBe('Aguardando a primeira verificação.')
  })

  it('amarelo: gateway do Elleven sem configuração', () => {
    const h = evaluateConferenciaHealth(status({ gatewayConfigurado: false }, null), NOW)
    expect(h.tone).toBe('warn')
    expect(h.reason).toMatch(/gateway/i)
  })

  it('conferenciaMode', () => {
    expect(conferenciaMode(status({ habilitada: false }, null))).toBe('desligada')
    expect(conferenciaMode(status({ dryRun: true }))).toBe('so_relatorio')
    expect(conferenciaMode(status())).toBe('ativa')
  })
})

describe('formatConferenciaRelative', () => {
  it('formata agora, minutos, horas e dias', () => {
    expect(formatConferenciaRelative(new Date(NOW - 20_000), NOW)).toBe('agora há pouco')
    expect(formatConferenciaRelative(new Date(NOW - 4 * 60_000), NOW)).toBe('há 4 min')
    expect(formatConferenciaRelative(new Date(NOW - 125 * 60_000), NOW)).toBe('há 2 h')
    expect(formatConferenciaRelative(new Date(NOW - 50 * 3_600_000), NOW)).toBe('há 2 d')
    expect(formatConferenciaRelative(null, NOW)).toBe('—')
  })
})
