import { describe, expect, it } from 'vitest'
import { buildGmudTimeline } from '@/features/gmud/lib/gmudTimeline'

describe('buildGmudTimeline', () => {
  it('junta abertura do Voalle e trilha da plataforma em ordem cronológica', () => {
    const items = buildGmudTimeline({
      openedAt: '2026-10-01T10:00:00Z',
      conclusionDate: null,
      voalleStatus: 'Abertura',
      events: [
        { type: 'comite_aprovada', actor: 'Comitê', payload: { dataCab: '2026-10-02', rnc: null }, at: '2026-10-02T15:00:00Z' },
        { type: 'criada', actor: 'Bruno', payload: { tipo: 'Programada' }, at: '2026-10-01T10:01:00Z' },
        {
          type: 'reagendada',
          actor: 'Bruno',
          payload: {
            previous: { dataInicio: '2026-10-05', horaInicio: '22:00', dataFim: '2026-10-06', horaFim: '02:00' },
            next: { dataInicio: '2026-10-07', horaInicio: '22:00', dataFim: '2026-10-08', horaFim: '02:00' },
          },
          at: '2026-10-03T09:00:00Z',
        },
      ],
    })
    expect(items.map((i) => i.title)).toEqual([
      'Protocolo aberto no Elleven',
      'Registrada na plataforma',
      'Aprovada pelo Comitê',
      'Janela reagendada',
    ])
    expect(items[1].detail).toBe('Programada')
    expect(items[2].detail).toBe('CAB 02/10/2026')
    expect(items[3].detail).toBe('05/10/2026 22:00 às 06/10/2026 02:00 → 07/10/2026 22:00 às 08/10/2026 02:00')
  })

  it('usa o encerramento do Voalle só quando a plataforma não encerrou', () => {
    const legado = buildGmudTimeline({ openedAt: '2026-01-01T10:00:00Z', conclusionDate: '2026-02-01T10:00:00Z', voalleStatus: 'Cancelado', events: [] })
    expect(legado.at(-1)).toMatchObject({ title: 'Protocolo cancelado no Elleven', tone: 'danger' })

    const plataforma = buildGmudTimeline({
      openedAt: '2026-01-01T10:00:00Z',
      conclusionDate: '2026-02-01T10:00:00Z',
      voalleStatus: 'Encerrado',
      events: [{ type: 'encerrada_elleven', actor: 'Bruno', payload: { motivo: 'concluida' }, at: '2026-02-01T09:59:00Z' }],
    })
    expect(plataforma.filter((i) => i.title.includes('encerrado'))).toHaveLength(1)
    expect(plataforma.at(-1)?.detail).toBe('Encerramento (GMUD concluída)')
  })
})
