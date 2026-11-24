import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchWithSessionAuth = vi.hoisted(() => vi.fn())
const mockEnv = vi.hoisted(() => ({ localBffUrl: 'http://bff.test' }))

vi.mock('@/shared/api/fetchWithSessionAuth', () => ({ fetchWithSessionAuth }))
vi.mock('@/shared/config/env', () => ({ env: mockEnv }))

import {
  fetchAutoIspRoutesByPppoe,
  rotaRowToConnectionRow,
} from '@/features/autoisp/api/fetchAutoIspRoutesByPppoe'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

const rotaRow = {
  pppoe: 'Fulano@prov',
  authenticationId: 10,
  splitterCode: 'C123',
  splitterTitle: 'SPL 7 2/4',
  splitterPort: 3,
  primaryPort: 5,
  slot: 1,
  portaExtraida: 7,
  accessPointCode: 'AP1',
  accessPointTitle: 'Ponto 1',
  concentratorCode: 'OLT1',
  concentratorTitle: 'OLT-X',
}

describe('fetchAutoIspRoutesByPppoe', () => {
  beforeEach(() => {
    fetchWithSessionAuth.mockReset()
  })

  it('lista vazia não chama o BFF', async () => {
    await expect(fetchAutoIspRoutesByPppoe([])).resolves.toEqual([])
    expect(fetchWithSessionAuth).not.toHaveBeenCalled()
  })

  it('faz POST só com os PPPoE e mapeia as linhas para clientes com rota', async () => {
    fetchWithSessionAuth.mockResolvedValue(jsonResponse({ success: true, data: [rotaRow] }))

    const out = await fetchAutoIspRoutesByPppoe(['fulano@prov'])

    const [url, init] = fetchWithSessionAuth.mock.calls[0]
    expect(url).toBe('http://bff.test/api/splitters/rotas-por-pppoe')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ pppoes: ['fulano@prov'] })

    expect(out).toHaveLength(1)
    expect(out[0].user).toBe('Fulano@prov')
    expect(out[0].splitterCode).toBe('C123')
    // slot/PON vêm do título do splitter ("SPL 7 2/4"), como na base de conexões
    expect(out[0].accessPoint).toMatchObject({ code: 'AP1', slotOlt: 7, portOlt: 2 })
  })

  it('status HTTP de erro vira exceção', async () => {
    fetchWithSessionAuth.mockResolvedValue(jsonResponse({}, false, 500))
    await expect(fetchAutoIspRoutesByPppoe(['a'])).rejects.toThrow(/500/)
  })

  it('formato inesperado vira exceção', async () => {
    fetchWithSessionAuth.mockResolvedValue(jsonResponse({ success: false }))
    await expect(fetchAutoIspRoutesByPppoe(['a'])).rejects.toThrow(/inesperado/)
  })
})

describe('rotaRowToConnectionRow', () => {
  it('traduz a linha para as colunas que o mapper de conexões conhece', () => {
    expect(rotaRowToConnectionRow(rotaRow)).toEqual({
      'ID CONEXAO[CLIENTE]': 10,
      'USUÁRIO[CLIENTE]': 'Fulano@prov',
      'SPLT.SECUNDARIO': 'SPL 7 2/4',
      'CÓDIGO[SPLT.SECUNDARIO]': 'C123',
      'PORTA SPLITTER[SPLT.SECUNDARIO]': 3,
      'SLOT[SPLT.SECUNDARIO]': 1,
      'PORTA EXTRAÍDA[SPLT.SECUNDARIO]': 7,
      'PORTA[SPLT.PRIMARIO]': 5,
      'PONTO DE ACESSO CODE': 'AP1',
      'PONTO DE ACESSO': 'Ponto 1',
      CONCENTRADOR: 'OLT-X',
    })
  })
})
