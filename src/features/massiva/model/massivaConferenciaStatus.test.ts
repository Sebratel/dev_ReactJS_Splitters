import { describe, expect, it } from 'vitest'
import { formatAberturaConferencia, parseMassivaConferenciaStatus } from '@/features/massiva/model/massivaConferenciaStatus'

describe('parseMassivaConferenciaStatus', () => {
  it('lê o contrato do backend (execução real, com criações)', () => {
    const s = parseMassivaConferenciaStatus({
      habilitada: true,
      dryRun: false,
      intervaloMinutos: 5,
      janelaDias: 30,
      gatewayConfigurado: true,
      emExecucao: false,
      recuperadasUltimos30Dias: 8,
      ultimaExecucao: {
        ok: true,
        erro: null,
        dryRun: false,
        iniciadoEm: '2026-11-12T12:00:00.000Z',
        duracaoMs: 900,
        elleven: { total: 339, abertos: 2 },
        plano: { criar: 2, semAssignment: 0, jaExistem: 330, foraDaJanela: 7, naCarencia: 0, invalidas: 0 },
        criadasTotal: 2,
        criariamTotal: 0,
        falhasTotal: 0,
        conflitosTotal: 0,
        divergencias: {
          abertaLocalFinalizadaElleven: { total: 1, itens: [] },
          fechadaLocalAbertaElleven: { total: 0, itens: [] },
        },
      },
    })
    expect(s.habilitada).toBe(true)
    expect(s.intervaloMinutos).toBe(5)
    expect(s.recuperadasUltimos30Dias).toBe(8)
    expect(s.ultimaExecucao?.ellevenAbertos).toBe(2)
    expect(s.ultimaExecucao?.ellevenTotal).toBe(339)
    expect(s.ultimaExecucao?.semRegistro).toBe(2)
    expect(s.ultimaExecucao?.criadas).toBe(2)
    expect(s.ultimaExecucao?.divergAbertaLocalFinalizadaElleven).toBe(1)
    expect(s.ultimaExecucao?.iniciadoEm?.toISOString()).toBe('2026-11-12T12:00:00.000Z')
  })

  it('em só relatório, "sem registro" vem de criariamTotal (nada foi criado)', () => {
    const s = parseMassivaConferenciaStatus({
      habilitada: true,
      dryRun: true,
      ultimaExecucao: { ok: true, dryRun: true, plano: { criar: 8 }, criariamTotal: 8, criadasTotal: 0 },
    })
    expect(s.ultimaExecucao?.dryRun).toBe(true)
    expect(s.ultimaExecucao?.semRegistro).toBe(8)
    expect(s.ultimaExecucao?.criadas).toBe(0)
  })

  it('nunca executou: ultimaExecucao null; contagem indisponível: recuperadas null', () => {
    const s = parseMassivaConferenciaStatus({ habilitada: true, ultimaExecucao: null, recuperadasUltimos30Dias: null })
    expect(s.ultimaExecucao).toBeNull()
    expect(s.recuperadasUltimos30Dias).toBeNull()
  })

  it('resposta vazia ou torta vira estado seguro (desligada, 5 min, 7 dias)', () => {
    for (const raw of [undefined, null, 'x', [], {}]) {
      const s = parseMassivaConferenciaStatus(raw)
      expect(s.habilitada).toBe(false)
      expect(s.intervaloMinutos).toBe(5)
      expect(s.janelaDias).toBe(7)
      expect(s.ultimaExecucao).toBeNull()
    }
  })

  it('lê as listas de protocolos (sem registro e fora da janela) com total real', () => {
    const s = parseMassivaConferenciaStatus({
      habilitada: true,
      janelaDias: 7,
      ultimaExecucao: {
        ok: true,
        plano: { criar: 1 },
        semRegistro: {
          total: 1,
          itens: [
            { protocolo: 10, assignmentId: 99, statusElleven: 'aberta', abertura: '2026-11-12 08:00:00', pontoDeAcesso: 'OLT 03 - SLEFT', desfecho: 'seria_criada' },
          ],
        },
        foraDaJanela: {
          total: 80,
          itens: [
            { protocolo: 20, assignmentId: 5, statusElleven: 'CANCELADA', abertura: '2026-10-28T10:43:00', pontoDeAcesso: 'OLT 04 - NHOPN', desfecho: 'fora_da_janela' },
            { protocolo: 'lixo' },
          ],
        },
      },
    })
    const u = s.ultimaExecucao!
    expect(u.protocolosSemRegistro?.total).toBe(1)
    expect(u.protocolosSemRegistro?.itens[0]).toMatchObject({ protocolo: 10, statusElleven: 'aberta', desfecho: 'seria_criada' })
    expect(u.protocolosForaDaJanela?.total).toBe(80)
    expect(u.protocolosForaDaJanela?.itens).toHaveLength(1)
    expect(u.protocolosForaDaJanela?.itens[0].statusElleven).toBe('cancelada')
  })

  it('backend antigo (sem as listas) não quebra: listas ficam nulas', () => {
    const s = parseMassivaConferenciaStatus({ habilitada: true, ultimaExecucao: { ok: true, plano: { criar: 3 }, semRegistro: 3 } })
    expect(s.ultimaExecucao?.protocolosSemRegistro).toBeNull()
    expect(s.ultimaExecucao?.protocolosForaDaJanela).toBeNull()
    expect(s.ultimaExecucao?.semRegistro).toBe(3)
  })

  it('formatAberturaConferencia mostra dd/MM HH:mm sem mexer no fuso', () => {
    expect(formatAberturaConferencia('2026-10-28 10:43:00')).toBe('28/10 10:43')
    expect(formatAberturaConferencia('2026-10-28T10:43:00.123')).toBe('28/10 10:43')
    expect(formatAberturaConferencia(null)).toBe('—')
    expect(formatAberturaConferencia('ontem')).toBe('ontem')
  })

  it('guarda o erro e as falhas da última execução', () => {
    const s = parseMassivaConferenciaStatus({
      habilitada: true,
      ultimaExecucao: { ok: false, erro: ' gateway fora ', falhasTotal: 2 },
    })
    expect(s.ultimaExecucao?.ok).toBe(false)
    expect(s.ultimaExecucao?.erro).toBe('gateway fora')
    expect(s.ultimaExecucao?.falhas).toBe(2)
  })
})
