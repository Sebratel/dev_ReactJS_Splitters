import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchWithSessionAuth = vi.hoisted(() => vi.fn())
const bffRequest = vi.hoisted(() => vi.fn())
const mockEnv = vi.hoisted(() => ({
  localBffUrl: 'http://bff.test',
  autoIspRouteLookupViaGateway: false,
}))

vi.mock('@/shared/api/fetchWithSessionAuth', () => ({ fetchWithSessionAuth }))
vi.mock('@/shared/api/bffClient', () => ({ bffClient: { request: bffRequest } }))
vi.mock('@/shared/config/env', () => ({ env: mockEnv }))

import {
  ROTAS_POR_PPPOE_PATH,
  fetchAutoIspRoutesByPppoe,
  rotaDtoToConnectionRow,
} from '@/features/autoisp/api/fetchAutoIspRoutesByPppoe'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

const localRow = {
  'ID CONEXAO[CLIENTE]': 10,
  'USUÁRIO[CLIENTE]': 'Fulano@prov',
  'SPLT.SECUNDARIO': 'SPL 7 2/4',
  'CÓDIGO[SPLT.SECUNDARIO]': 'C123',
  'PORTA SPLITTER[SPLT.SECUNDARIO]': 3,
  'PONTO DE ACESSO CODE': 'AP1',
  'PONTO DE ACESSO': 'Ponto 1',
  CONCENTRADOR: 'OLT-X',
}

const gatewayDto = {
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
    bffRequest.mockReset()
    mockEnv.autoIspRouteLookupViaGateway = false
    vi.restoreAllMocks()
  })

  it('lista vazia não chama ninguém', async () => {
    mockEnv.autoIspRouteLookupViaGateway = true
    await expect(fetchAutoIspRoutesByPppoe([])).resolves.toEqual([])
    expect(fetchWithSessionAuth).not.toHaveBeenCalled()
    expect(bffRequest).not.toHaveBeenCalled()
  })

  describe('com a flag desligada (padrão)', () => {
    it('faz POST no BFF local só com os PPPoE e mapeia as linhas para clientes com rota', async () => {
      fetchWithSessionAuth.mockResolvedValue(jsonResponse({ success: true, data: [localRow] }))

      const out = await fetchAutoIspRoutesByPppoe(['fulano@prov'])

      const [url, init] = fetchWithSessionAuth.mock.calls[0]
      expect(url).toBe('http://bff.test/api/massiva/connections/lookup-by-pppoe')
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body)).toEqual({ pppoeUsernames: ['fulano@prov'] })
      expect(bffRequest).not.toHaveBeenCalled()

      expect(out).toHaveLength(1)
      expect(out[0].user).toBe('Fulano@prov')
      expect(out[0].splitterCode).toBe('C123')
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

  describe('com a flag ligada', () => {
    beforeEach(() => {
      mockEnv.autoIspRouteLookupViaGateway = true
    })

    it('chama o gateway (splitters-service) com { pppoes } e NÃO toca no BFF local', async () => {
      bffRequest.mockResolvedValue([gatewayDto])

      const out = await fetchAutoIspRoutesByPppoe(['fulano@prov'])

      expect(bffRequest).toHaveBeenCalledWith({
        path: ROTAS_POR_PPPOE_PATH,
        method: 'POST',
        body: { pppoes: ['fulano@prov'] },
      })
      expect(ROTAS_POR_PPPOE_PATH).toBe('/api/v1/splitters/rotas-por-pppoe')
      expect(fetchWithSessionAuth).not.toHaveBeenCalled()
      expect(out).toHaveLength(1)
      expect(out[0].user).toBe('Fulano@prov')
      expect(out[0].splitterCode).toBe('C123')
      // slot/PON vêm do título do splitter ("SPL 7 2/4"), como no BFF local
      expect(out[0].accessPoint).toMatchObject({ code: 'AP1', slotOlt: 7, portOlt: 2 })
    })

    it('sem título utilizável, usa slot/porta que o serviço derivou', async () => {
      bffRequest.mockResolvedValue([{ ...gatewayDto, splitterTitle: 'SPL SEM NUMEROS' }])
      const out = await fetchAutoIspRoutesByPppoe(['fulano@prov'])
      expect(out[0].accessPoint).toMatchObject({ slotOlt: 1, portOlt: 7 })
    })

    it('gateway sem a rota (404) ou fora do ar: cai no BFF local', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      bffRequest.mockRejectedValue(new Error('HTTP 404'))
      fetchWithSessionAuth.mockResolvedValue(jsonResponse({ success: true, data: [localRow] }))

      const out = await fetchAutoIspRoutesByPppoe(['fulano@prov'])

      expect(bffRequest).toHaveBeenCalledTimes(1)
      expect(fetchWithSessionAuth).toHaveBeenCalledTimes(1)
      expect(out[0].splitterCode).toBe('C123')
      expect(warn).toHaveBeenCalled()
    })

    it('resposta do gateway que não é lista também cai no BFF local', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      bffRequest.mockResolvedValue({ erro: 'x' })
      fetchWithSessionAuth.mockResolvedValue(jsonResponse({ success: true, data: [localRow] }))

      const out = await fetchAutoIspRoutesByPppoe(['fulano@prov'])
      expect(out).toHaveLength(1)
    })

    it('se o gateway E o BFF local falham, o erro do BFF local sobe', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      bffRequest.mockRejectedValue(new Error('gateway fora'))
      fetchWithSessionAuth.mockResolvedValue(jsonResponse({}, false, 503))
      await expect(fetchAutoIspRoutesByPppoe(['a'])).rejects.toThrow(/503/)
    })

    it('gateway devolve lista vazia: sem rotas, sem cair no BFF local', async () => {
      bffRequest.mockResolvedValue([])
      await expect(fetchAutoIspRoutesByPppoe(['ghost'])).resolves.toEqual([])
      expect(fetchWithSessionAuth).not.toHaveBeenCalled()
    })
  })
})

describe('rotaDtoToConnectionRow', () => {
  it('traduz o DTO para as colunas que o mapper de conexões conhece', () => {
    expect(rotaDtoToConnectionRow(gatewayDto)).toEqual({
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
