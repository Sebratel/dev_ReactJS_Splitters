import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import {
  CLIENT_LATITUDE_ROW_KEYS,
  CLIENT_LONGITUDE_ROW_KEYS,
  pickCoordinateFromRow,
} from '@/features/splitters/lib/pickClienteCoordinatesFromRow'
import {
  pickIsCorporateFromRow,
  type SplitterCliente,
  type SplitterPortState,
} from '@/features/splitters/model/splitterCliente'

type MassivaConnectionFilters = {
  apCode?: string | null
  slot?: number | null
  port?: number | null
  splitterCodes?: string[]
}

type FetchConnectionsInput =
  | string
  | {
      code?: string
      filters?: MassivaConnectionFilters
    }

export type SplitterConnectionsBundle = {
  clientes: SplitterCliente[]
  portStates: SplitterPortState[]
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? n : fallback
}

function toNullableText(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

function toBool(value: unknown): boolean {
  if (value === true) return true
  const normalized = String(value ?? '').trim().toLowerCase()
  return (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 's' ||
    normalized === 'sim' ||
    normalized === 'y' ||
    normalized === 'yes'
  )
}

function pickRowValue(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] != null) {
      return row[key]
    }
  }
  return undefined
}

function extractSlotAndPortFromSplitterTitle(
  splitterTitle: unknown,
): { slot: number | null; port: number | null } {
  const title = String(splitterTitle ?? '').trim()
  if (title === '') return { slot: null, port: null }
  const beforeSlash = title.split('/')[0] ?? ''
  const numbers = beforeSlash.match(/\d+/g) ?? []
  if (numbers.length < 2) return { slot: null, port: null }
  const slot = Number.parseInt(numbers[numbers.length - 2] ?? '', 10)
  const port = Number.parseInt(numbers[numbers.length - 1] ?? '', 10)
  return {
    slot: Number.isFinite(slot) ? slot : null,
    port: Number.isFinite(port) ? port : null,
  }
}

function buildRequestUrl(input?: FetchConnectionsInput): string {
  const code =
    typeof input === 'string'
      ? input
      : typeof input?.code === 'string'
        ? input.code
        : undefined
  const filters = typeof input === 'object' && input !== null ? input.filters : undefined

  let url = code
    ? `${env.localBffUrl}/api/splitters/connections?code=${encodeURIComponent(code)}`
    : `${env.localBffUrl}/api/massiva/connections`

  if (!code && filters) {
    const params = new URLSearchParams()
    if (filters.apCode && filters.apCode.trim() !== '') {
      params.set('apCode', filters.apCode.trim())
    }
    if (typeof filters.slot === 'number' && Number.isFinite(filters.slot)) {
      params.set('slot', String(filters.slot))
    }
    if (typeof filters.port === 'number' && Number.isFinite(filters.port)) {
      params.set('port', String(filters.port))
    }
    if (Array.isArray(filters.splitterCodes) && filters.splitterCodes.length > 0) {
      const clean = filters.splitterCodes.map((v) => v.trim()).filter((v) => v !== '')
      if (clean.length > 0) {
        params.set('splitterCodes', clean.join(','))
      }
    }
    const query = params.toString()
    if (query !== '') {
      url = `${url}?${query}`
    }
  }

  return url
}

async function fetchConnectionsRows(input?: FetchConnectionsInput): Promise<Record<string, unknown>[]> {
  const response = await fetchWithSessionAuth(buildRequestUrl(input))
  if (!response.ok) {
    throw new Error(`Erro ao consultar BFF Local para Conexoes: ${response.status}`)
  }

  const result = await response.json()
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('Formato de resposta inesperado do BFF Local.')
  }

  return result.data as Record<string, unknown>[]
}

/** Mapeia as linhas brutas do BFF (mesma forma que GET/POST de conexões da massiva) para o modelo da UI. */
export function mapConnectionRowsToSplitterBundle(
  rawRows: Record<string, unknown>[],
): SplitterConnectionsBundle {
  const portStatesMap = new Map<number, SplitterPortState>()

  for (const row of rawRows) {
    const port = toInt(row['PORTA SPLITTER[SPLT.SECUNDARIO]'], 0)
    if (port <= 0) continue

    portStatesMap.set(port, {
      port,
      blocked: toBool(row['BLOQUEIO']),
      blockedDescription: toNullableText(row['DESCRICAO_PORTA']),
    })
  }

  const connections: SplitterCliente[] = []

  for (const row of rawRows) {
    const authId = row['ID CONEXAO[CLIENTE]']
    if (!authId) continue

    const rowRecord = row as Record<string, unknown>
    const splitterTitle = row['SPLT.SECUNDARIO']
    const parsedRoute = extractSlotAndPortFromSplitterTitle(splitterTitle)
    let slotOlt = toInt(
      pickRowValue(row, ['SLOT[SPLT.SECUNDARIO]', 'SLOT OLT', 'SLOT[OLT]']) ??
        parsedRoute.slot ??
        0,
      0,
    )
    let portOlt = toInt(
      pickRowValue(row, ['PORTA EXTRAÍDA[SPLT.SECUNDARIO]', 'PORTA OLT', 'PORTA[OLT]']) ??
        parsedRoute.port ??
        0,
      0,
    )

    if (slotOlt <= 0 && parsedRoute.slot != null && parsedRoute.slot > 0) {
      slotOlt = parsedRoute.slot
    }
    if (portOlt <= 0 && parsedRoute.port != null && parsedRoute.port > 0) {
      portOlt = parsedRoute.port
    }

    const accessPointCode = String(
      pickRowValue(row, ['PONTO DE ACESSO CODE', 'PONTO DE ACESSO']) ?? '',
    ).trim()
    const accessPointTitle = String(row['PONTO DE ACESSO'] ?? '').trim()
    const concentradorTitle = String(row['CONCENTRADOR'] ?? '').trim()
    const accessPointLabel =
      concentradorTitle !== '' && accessPointTitle !== ''
        ? `${concentradorTitle} / ${accessPointTitle}`
        : accessPointTitle

    const resolvedClientId = toInt(
      pickRowValue(row, [
        'ID[CLIENTE]',
        'ID CLIENTE',
        'CLIENTE ID',
        'CONTRATO ID[CLIENTE]',
      ]),
      0,
    )

    connections.push({
      authenticationId: toInt(authId, 0),
      clientId: resolvedClientId,
      user: String(pickRowValue(row, ['USUARIO[CLIENTE]', 'USUÁRIO[CLIENTE]']) ?? ''),
      name: String(row['NOME CLIENTE'] || row['NOME[CLIENTE]'] || 'Cliente Desconhecido'),
      phone: toNullableText(row['CELULAR']),
      email: toNullableText(row['EMAIL']),
      status: 1,
      port: toInt(row['PORTA SPLITTER[SPLT.SECUNDARIO]'], 0),
      blocked: toBool(row['BLOQUEIO']),
      blockedDescription: toNullableText(row['DESCRICAO_PORTA']),
      isCorporate: pickIsCorporateFromRow(rowRecord),
      splitterCode: toNullableText(
        pickRowValue(row, ['CÓDIGO[SPLT.SECUNDARIO]', 'CÃ“DIGO[SPLT.SECUNDARIO]']),
      ),
      splitterTitle: toNullableText(row['SPLT.SECUNDARIO']),
      address: {
        street: String(row['RUA'] || ''),
        number: String(row['NUMERO'] || ''),
        neighborhood: String(row['BAIRRO'] || ''),
        city: String(row['CIDADE CLIENTE'] || ''),
        state: String(row['UF'] || '').trim(),
        postalCode: '',
        complement: row['ENDERECO COMPLE.'] ? String(row['ENDERECO COMPLE.']) : null,
        latitude: pickCoordinateFromRow(rowRecord, CLIENT_LATITUDE_ROW_KEYS),
        longitude: pickCoordinateFromRow(rowRecord, CLIENT_LONGITUDE_ROW_KEYS),
      },
      accessPoint: {
        code: accessPointCode !== '' ? accessPointCode : accessPointTitle,
        title: accessPointLabel,
        slotOlt,
        portOlt,
      },
      contract: {
        id: toInt(row['CONTRATO ID[CLIENTE]'], 0),
        status: toInt(pickRowValue(row, ['STATUS[CONTRATO]', 'STATUS_CONTRATO']), 0),
        statusDescription:
          toNullableText(
            pickRowValue(row, ['STATUS_DESC[CONTRATO]', 'STATUS_CONTRATO']),
          ) ?? '',
        stage: toInt(pickRowValue(row, ['ETAPA[CONTRATO]', 'ESTAGIO_CONTRATO']), 0),
        stageDescription:
          toNullableText(
            pickRowValue(row, ['ETAPA_DESC[CONTRATO]', 'ESTAGIO_CONTRATO']),
          ) ?? '',
      },
    })
  }

  return {
    clientes: connections,
    portStates: Array.from(portStatesMap.values()).sort((a, b) => a.port - b.port),
  }
}

export async function fetchSplitterConnectionsBundleFromLocalDb(
  input?: FetchConnectionsInput,
): Promise<SplitterConnectionsBundle> {
  const rawRows = await fetchConnectionsRows(input)
  return mapConnectionRowsToSplitterBundle(rawRows)
}

export type MassivaConnectionBatchRoute = {
  apCode: string
  slot: number
  port: number
  /** Enviado pelo preview; o BFF filtra só por AP/slot/porta (paridade com o pipeline cliente). */
  splitterCodes: string[]
}

/** Conexões filtradas por rota (POST batch) — usado no preview/validação da massiva, sem varrer a base inteira. */
export async function fetchMassivaConnectionsFromLocalDbByRoutes(
  routes: MassivaConnectionBatchRoute[],
): Promise<SplitterCliente[]> {
  if (routes.length === 0) return []
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/massiva/connections/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routes }),
  })
  if (!response.ok) {
    throw new Error(`Erro ao consultar BFF Local para Conexoes (batch): ${response.status}`)
  }
  const result = (await response.json()) as { success?: boolean; data?: unknown }
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('Formato de resposta inesperado do BFF Local (batch).')
  }
  return mapConnectionRowsToSplitterBundle(result.data as Record<string, unknown>[])
    .clientes
}

export async function fetchSplitterConnectionsFromLocalDb(
  input?: FetchConnectionsInput,
): Promise<SplitterCliente[]> {
  const bundle = await fetchSplitterConnectionsBundleFromLocalDb(input)
  return bundle.clientes
}


