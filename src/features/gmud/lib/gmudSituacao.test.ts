import { describe, expect, it } from 'vitest'
import { gmudSituacao } from '@/features/gmud/lib/gmudSituacao'
import type { GmudExtra } from '@/features/gmud/model/gmud'

const extra = (over: Partial<GmudExtra> = {}): GmudExtra => ({
  assignmentId: 1,
  tipo: 'Programada',
  assunto: null,
  categoria: null,
  popSite: null,
  impactoParada: null,
  comunicaCliente: null,
  statusComite: 'pendente',
  statusAreas: 'nao_aplicavel',
  areasTotal: 0,
  areasAprovadas: 0,
  statusExec: null,
  rnc: null,
  dataCab: null,
  ambienteAfetado: null,
  ellevenEncerradoEm: null,
  ellevenEncerradoStatus: null,
  ...over,
})
const gmud = (over: Partial<GmudExtra> | null, status = 'Abertura', conclusionDate: string | null = null) => ({
  extra: over === null ? null : extra(over),
  status,
  conclusionDate,
})

describe('gmudSituacao', () => {
  it('cancelada vence qualquer outro estado (plataforma ou Voalle)', () => {
    expect(gmudSituacao(gmud({ ellevenEncerradoStatus: 'cancelada', statusComite: 'aprovada' }))).toMatchObject({ label: 'Cancelada', tone: 'cancelada' })
    expect(gmudSituacao(gmud({ statusComite: 'pendente' }, 'Cancelado'))).toMatchObject({ label: 'Cancelada', tone: 'cancelada', voalle: 'Cancelado' })
    expect(gmudSituacao(gmud(null, 'Cancelado'))).toMatchObject({ label: 'Cancelada', tone: 'cancelada', voalle: null })
  })

  it('legado mostra o status do Voalle, sem linha extra', () => {
    expect(gmudSituacao(gmud(null, 'Em andamento'))).toEqual({ label: 'Em andamento', tone: 'voalle', voalle: null })
    expect(gmudSituacao(gmud(null, '')).label).toBe('—')
  })

  it('concluída, negada e encerrada', () => {
    expect(gmudSituacao(gmud({ statusComite: 'aprovada', statusExec: 'concluida' }))).toMatchObject({ label: 'Concluída', tone: 'concluida', voalle: 'Abertura' })
    expect(gmudSituacao(gmud({ statusComite: 'aprovada', ellevenEncerradoStatus: 'concluida' })).label).toBe('Concluída')
    expect(gmudSituacao(gmud({ statusComite: 'negada' }))).toMatchObject({ label: 'Negada', tone: 'negada' })
    expect(gmudSituacao(gmud({ statusComite: 'pendente', ellevenEncerradoStatus: 'negada' })).label).toBe('Negada')
    expect(gmudSituacao(gmud({ statusComite: 'aprovada' }, 'Encerrado', '2026-10-01T10:00:00.000Z'))).toMatchObject({ label: 'Encerrada', tone: 'concluida' })
    expect(gmudSituacao(gmud({ statusComite: 'pendente', ellevenEncerradoEm: '2026-10-01T10:00:00.000Z' })).label).toBe('Encerrada')
  })

  it('liberada: Comitê e áreas aprovaram; Pré-aprovada é tipo, a situação dela é Liberada', () => {
    expect(gmudSituacao(gmud({ statusComite: 'aprovada', statusAreas: 'aprovada' }))).toMatchObject({ label: 'Liberada', tone: 'liberada' })
    expect(gmudSituacao(gmud({ statusComite: 'aprovada', statusAreas: null })).label).toBe('Liberada')
    const pre = gmudSituacao(gmud({ tipo: 'Pré-aprovada', statusComite: 'aprovada', statusAreas: 'nao_aplicavel' }))
    expect(pre.label).toBe('Liberada')
    expect(pre.label).not.toContain('Pré-aprovada')
    expect(pre.hint).toContain('Pré-aprovada')
  })

  it('aguardando: Comitê, Comitê e áreas, e Comitê aprovou aguardando áreas (x/y)', () => {
    expect(gmudSituacao(gmud({ statusComite: 'pendente', statusAreas: 'nao_aplicavel' }))).toMatchObject({ label: 'Aguardando Comitê', tone: 'aguardando', voalle: 'Abertura' })
    expect(gmudSituacao(gmud({ statusComite: 'pendente', statusAreas: 'pendente', areasAprovadas: 1, areasTotal: 3 })).label).toBe('Aguardando Comitê e áreas (1/3)')
    expect(gmudSituacao(gmud({ statusComite: 'aprovada', statusAreas: 'pendente', areasAprovadas: 2, areasTotal: 3 }))).toMatchObject({
      label: 'Comitê aprovou · aguardando áreas (2/3)',
      tone: 'aguardando',
    })
    expect(gmudSituacao(gmud({ statusComite: 'pendente', statusAreas: 'aprovada' })).label).toBe('Aguardando Comitê')
  })

  it('Comitê aprovou mas uma área negou: não aparece como liberada', () => {
    const s = gmudSituacao(gmud({ statusComite: 'aprovada', statusAreas: 'negada' }))
    expect(s.tone).toBe('aguardando')
    expect(s.label).not.toBe('Liberada')
  })

  it('registrada sem decisão do Comitê gravada cai no status do Voalle', () => {
    expect(gmudSituacao(gmud({ statusComite: null }, 'Em andamento'))).toEqual({ label: 'Em andamento', tone: 'voalle', voalle: null })
  })
})
