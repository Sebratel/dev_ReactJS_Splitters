import { beforeEach, describe, expect, it, vi } from 'vitest'

const finalizeOnServer = vi.fn()
const bffRequest = vi.fn()
const registerCancelled = vi.fn()

vi.mock('@/features/massiva/api/finalizeMassivaOnServer', () => ({
  finalizeMassivaOnServer: (...a: unknown[]) => finalizeOnServer(...a),
}))
vi.mock('@/features/massiva/api/registerCancelledMassivaHistoryInLocalDb', () => ({
  registerCancelledMassivaHistoryInLocalDb: (...a: unknown[]) => registerCancelled(...a),
}))
vi.mock('@/shared/api/bffClient', () => ({ bffClient: { request: (...a: unknown[]) => bffRequest(...a) } }))
vi.mock('@/shared/config/env', () => ({
  env: {
    massivaClosePath: '/api/v1/massivas/finalizar-chamado-via-api',
    massivaCancelIncidentStatusId: '8',
    massivaCloseProgress: '0',
    massivaClosePriority: '35',
    massivaCloseNotificationTarget: '0',
    massivaClosePrivateReport: 'true',
    massivaAffectedUsersPath: '',
    massivaAfetadosPath: '/api/v1/afetados',
  },
}))

import { buildInfraCancelWarning, cancelMassivaTicket } from '@/features/massiva/api/cancelMassivaTicket'

const base = { assignmentId: 777, protocol: 1888, cancelDescription: 'Abertura equivocada' }

describe('buildInfraCancelWarning', () => {
  it('cita o protocolo de infra e o motivo', () => {
    expect(buildInfraCancelWarning(1900, 'HTTP 409')).toBe(
      'A massiva foi cancelada, mas o protocolo de infra 1900 não foi cancelado automaticamente (HTTP 409). Cancele-o manualmente.',
    )
    expect(buildInfraCancelWarning(null)).toContain('protocolo de infra não foi cancelado')
  })
})

describe('cancelMassivaTicket — protocolo de infra junto (backend)', () => {
  beforeEach(() => {
    finalizeOnServer.mockReset()
    bffRequest.mockReset()
    registerCancelled.mockReset()
  })

  it('infra cancelado junto: informa o protocolo, sem aviso', async () => {
    finalizeOnServer.mockResolvedValue({ handled: true, infraCancel: { protocol: 1900, ok: true } })
    const r = await cancelMassivaTicket(base)
    expect(r).toEqual({ ok: true, infraCancelledProtocol: 1900 })
  })

  it('infra não cancelado: a massiva fica cancelada e vem um aviso para cancelar à mão', async () => {
    finalizeOnServer.mockResolvedValue({ handled: true, infraCancel: { protocol: 1900, ok: false, reason: 'HTTP 409' } })
    const r = await cancelMassivaTicket(base)
    expect(r.ok).toBe(true)
    expect(r.localHistoryWarning).toContain('1900')
    expect(r.localHistoryWarning).toContain('HTTP 409')
    expect(r.infraCancelledProtocol).toBeUndefined()
  })

  it('junta o aviso do histórico local com o do infra', async () => {
    finalizeOnServer.mockResolvedValue({ handled: true, localHistoryWarning: 'histórico atrasado', infraCancel: { protocol: 1900, ok: false } })
    const r = await cancelMassivaTicket(base)
    expect(r.localHistoryWarning).toContain('histórico atrasado')
    expect(r.localHistoryWarning).toContain('1900')
  })

  it('massiva sem infra: resultado simples como antes', async () => {
    finalizeOnServer.mockResolvedValue({ handled: true })
    expect(await cancelMassivaTicket(base)).toEqual({ ok: true })
  })
})

describe('cancelMassivaTicket — fallback pelo navegador (backend sem gateway)', () => {
  beforeEach(() => {
    finalizeOnServer.mockReset()
    bffRequest.mockReset()
    registerCancelled.mockReset()
    finalizeOnServer.mockResolvedValue({ handled: false })
    bffRequest.mockResolvedValue({})
    registerCancelled.mockResolvedValue(undefined)
  })

  it('cancela a massiva e depois o infra, com o status de cancelamento', async () => {
    const r = await cancelMassivaTicket({ ...base, infraProtocol: 1900, infraAssignmentId: 555 })
    const closeCalls = bffRequest.mock.calls.map((c) => c[0] as { path: string; method: string; body?: { assignmentId?: string; incidentStatusId?: string; description?: string } })
      .filter((c) => c.path === '/api/v1/massivas/finalizar-chamado-via-api')
    expect(closeCalls.map((c) => c.body?.assignmentId)).toEqual(['777', '555'])
    expect(closeCalls[1]?.body?.incidentStatusId).toBe('8')
    expect(closeCalls[1]?.body?.description).toContain('Cancelado junto com a massiva 1888')
    expect(r).toEqual({ ok: true, infraCancelledProtocol: 1900 })
  })

  it('falha ao cancelar o infra vira aviso e a massiva continua cancelada', async () => {
    bffRequest.mockImplementation(async (arg: { body?: { assignmentId?: string } }) => {
      if (arg.body?.assignmentId === '555') throw new Error('Elleven recusou')
      return {}
    })
    const r = await cancelMassivaTicket({ ...base, infraProtocol: 1900, infraAssignmentId: 555 })
    expect(r.ok).toBe(true)
    expect(r.localHistoryWarning).toContain('1900')
    expect(r.localHistoryWarning).toContain('Elleven recusou')
    expect(registerCancelled).toHaveBeenCalledTimes(1)
  })

  it('sem infra, só a massiva é cancelada', async () => {
    const r = await cancelMassivaTicket(base)
    const closeCalls = bffRequest.mock.calls.filter((c) => (c[0] as { path: string }).path === '/api/v1/massivas/finalizar-chamado-via-api')
    expect(closeCalls).toHaveLength(1)
    expect(r).toEqual({ ok: true })
  })
})
