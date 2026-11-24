import { describe, expect, it } from 'vitest'
import { buildStatusTrail, closedPendingNotice, type TrailInput } from '@/features/gmud/lib/gmudStatusTrail'

const base: TrailInput = {
  tipo: 'Programada',
  statusAreas: 'pendente',
  statusComite: 'pendente',
  statusExec: 'pendente',
  closed: false,
  encerradaStatus: null,
  createdLabel: '09/11',
  windowLabel: '12/11 22:30',
}
const states = (i: Partial<TrailInput>) => buildStatusTrail({ ...base, ...i }).map((s) => s.state)

describe('buildStatusTrail', () => {
  it('Comitê e áreas pendentes em paralelo; execução ainda não liberada', () => {
    expect(states({})).toEqual(['done', 'current', 'current', 'pending', 'pending'])
  })
  it('Emergencial: áreas não se aplicam', () => {
    const t = buildStatusTrail({ ...base, tipo: 'Emergencial', statusAreas: 'nao_aplicavel' })
    expect(t[1]).toMatchObject({ state: 'skipped', hint: 'não se aplica' })
    expect(t[2]?.state).toBe('current')
  })
  it('liberada: execução fica como atual com a janela', () => {
    const t = buildStatusTrail({ ...base, statusAreas: 'aprovada', statusComite: 'aprovada' })
    expect(t.map((s) => s.state)).toEqual(['done', 'done', 'done', 'current', 'pending'])
    expect(t[3]?.hint).toBe('12/11 22:30')
  })
  it('Pré-aprovada nasce liberada', () => {
    const t = buildStatusTrail({ ...base, tipo: 'Pré-aprovada', statusAreas: 'nao_aplicavel', statusComite: 'aprovada' })
    expect(t[2]).toMatchObject({ state: 'done', hint: 'sem aprovação' })
    expect(t[3]?.state).toBe('current')
  })
  it('área negou', () => {
    expect(states({ statusAreas: 'negada' })[1]).toBe('failed')
  })
  it('cancelada no Elleven sem decisão', () => {
    const t = buildStatusTrail({ ...base, closed: true, encerradaStatus: 'cancelada' })
    expect(t.map((s) => s.state)).toEqual(['done', 'skipped', 'skipped', 'skipped', 'failed'])
    expect(t[4]).toMatchObject({ label: 'Encerrada', hint: 'cancelada' })
  })
  it('concluída', () => {
    const t = buildStatusTrail({ ...base, statusAreas: 'aprovada', statusComite: 'aprovada', statusExec: 'concluida', closed: true, encerradaStatus: 'concluida' })
    expect(t.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done'])
  })
})

describe('closedPendingNotice', () => {
  const n = { closed: true, statusComite: 'pendente', statusAreas: 'pendente', encerradaStatus: 'cancelada', closedAtLabel: '04/11/2026' }
  it('avisa quando encerrado com aprovação pendente', () => {
    expect(closedPendingNotice(n)).toBe('Protocolo cancelado no Elleven em 04/11/2026: as aprovações que faltavam não são mais necessárias.')
  })
  it('não avisa se aberto ou sem pendência', () => {
    expect(closedPendingNotice({ ...n, closed: false })).toBeNull()
    expect(closedPendingNotice({ ...n, statusComite: 'aprovada', statusAreas: 'aprovada' })).toBeNull()
  })
})
