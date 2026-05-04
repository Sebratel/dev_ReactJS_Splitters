import { describe, expect, it } from 'vitest'
import type { Solicitation } from '@/features/clientes/model/solicitation'
import {
  groupMaintenanceByMonth,
  isMaintenanceSolicitation,
  isSolicitationClosedForKpi,
  summarizeMaintenance,
} from '@/features/clientes/lib/maintenanceSolicitations'

function sol(partial: Partial<Solicitation>): Solicitation {
  return {
    assignmentId: 1,
    protocol: 1,
    title: '',
    status: '',
    team: '',
    sectorArea: '',
    beginningDate: null,
    finalDate: null,
    ...partial,
  }
}

describe('maintenanceSolicitations', () => {
  it('isMaintenanceSolicitation reconhece variantes comuns', () => {
    expect(isMaintenanceSolicitation(sol({ title: 'Manutenção preventiva na OLT' }))).toBe(true)
    expect(isMaintenanceSolicitation(sol({ sectorArea: 'CORRETIVA — rede' }))).toBe(true)
    expect(isMaintenanceSolicitation(sol({ team: 'Suporte técnico campo' }))).toBe(true)
    expect(isMaintenanceSolicitation(sol({ status: 'OSS aberto' }))).toBe(true)
    expect(isMaintenanceSolicitation(sol({ title: 'LOSS_SIGNAL slot 3' }))).toBe(true)
  })

  it('isSolicitationClosedForKpi usa finalDate ou fragmentos de status', () => {
    expect(isSolicitationClosedForKpi(sol({ finalDate: new Date('2026-01-01'), status: 'Aberto' }))).toBe(
      true,
    )
    expect(isSolicitationClosedForKpi(sol({ finalDate: null, status: 'Fechado' }))).toBe(true)
    expect(isSolicitationClosedForKpi(sol({ finalDate: null, status: 'Encerrado pela equipe' }))).toBe(true)
    expect(isSolicitationClosedForKpi(sol({ finalDate: null, status: 'Em análise' }))).toBe(false)
  })

  it('summarizeMaintenance separa aberto/fechado pelo KPI híbrido', () => {
    const items = [
      sol({
        title: 'Corretiva fibra',
        finalDate: null,
        status: 'Aberto',
      }),
      sol({
        title: 'Corretiva fibra',
        finalDate: null,
        status: 'Fechado',
      }),
      sol({
        title: 'Corretiva fibra',
        finalDate: new Date('2026-02-01'),
        status: 'Aberto',
      }),
    ]
    const s = summarizeMaintenance(items)
    expect(s.total).toBe(3)
    expect(s.open).toBe(1)
    expect(s.closed).toBe(2)
  })

  it('groupMaintenanceByMonth usa finalDate quando beginningDate é null', () => {
    const items = [
      sol({
        title: 'Manutenção',
        beginningDate: null,
        finalDate: new Date('2026-03-15T12:00:00.000Z'),
      }),
    ]
    const pts = groupMaintenanceByMonth(items)
    expect(pts.some((p) => p.count >= 1)).toBe(true)
  })

  it('groupMaintenanceByMonth inclui em aberto sem datas no mês de referência', () => {
    const referenceNow = new Date(2026, 4, 10)
    const items = [
      sol({
        title: 'Manutenção corretiva',
        beginningDate: null,
        finalDate: null,
        status: 'Em análise',
      }),
    ]
    const pts = groupMaintenanceByMonth(items, { referenceNow })
    const may = pts.find((p) => p.key === '2026-05')
    expect(may?.count).toBe(1)
  })
})
