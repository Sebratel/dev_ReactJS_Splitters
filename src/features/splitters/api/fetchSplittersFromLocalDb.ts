import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import {
  mapSplitterTypeText,
  type Splitter,
} from '@/features/splitters/model/splitter'

export type SplittersFetchResult = {
  items: Splitter[]
  totalCount: number
}

export type SplittersFetchParams = {
  page?: number
  limit?: number
  search?: string
  olts?: string[]
  primarySplitters?: string[]
  statuses?: string[]
  streets?: string[]
  cities?: string[]
  condominiums?: string[]
  withOpenMassiva?: boolean
  openMassivaSplitterCodes?: string[]
  corporateClientFilter?: 'all' | 'with-corporate' | 'without-corporate'
  withMaintenance?: boolean
  maintenanceSplitterCodes?: string[]
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toStringValue(value: unknown): string {
  return value == null ? '' : String(value)
}

function toNullableString(value: unknown): string | null {
  const text = toStringValue(value).trim()
  return text === '' ? null : text
}

function toNullableDate(value: unknown): Date | null {
  const text = toStringValue(value).trim()
  if (text === '') return null
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function pickRowValue(
  row: Record<string, unknown>,
  ...possibleKeys: string[]
): unknown {
  for (const key of possibleKeys) {
    if (Object.hasOwn(row, key)) {
      return row[key]
    }
  }
  return undefined
}

function toTipoLocal(value: unknown): Splitter['tipoLocal'] {
  const normalized = toStringValue(value)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (normalized === 'CONDOMINIO') return 'CONDOM\u00CDNIO'
  if (normalized === 'UNIDADE') return 'UNIDADE'
  return undefined
}

export async function fetchSplittersFromLocalDb({
  page = 1,
  limit = 20,
  search = '',
  olts = [],
  primarySplitters = [],
  statuses = [],
  streets = [],
  cities = [],
  condominiums = [],
  withOpenMassiva,
  openMassivaSplitterCodes = [],
  corporateClientFilter = 'all',
  withMaintenance,
  maintenanceSplitterCodes = [],
}: SplittersFetchParams = {}): Promise<SplittersFetchResult> {
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    search,
  })

  if (olts.length > 0) queryParams.append('olts', olts.join(','))
  if (primarySplitters.length > 0) {
    queryParams.append('primarySplitters', primarySplitters.join(','))
  }
  if (statuses.length > 0) queryParams.append('statuses', statuses.join(','))
  if (streets.length > 0) queryParams.append('streets', streets.join(','))
  if (cities.length > 0) queryParams.append('cities', cities.join(','))
  if (condominiums.length > 0) {
    queryParams.append('condominiums', condominiums.join(','))
  }
  if (withOpenMassiva !== undefined) {
    queryParams.append('withOpenMassiva', withOpenMassiva ? '1' : '0')
  }
  if (openMassivaSplitterCodes.length > 0) {
    queryParams.append('openMassivaSplitterCodes', openMassivaSplitterCodes.join(','))
  }
  if (corporateClientFilter === 'with-corporate') {
    queryParams.append('corporateClients', 'with')
  } else if (corporateClientFilter === 'without-corporate') {
    queryParams.append('corporateClients', 'without')
  }
  if (withMaintenance !== undefined) {
    queryParams.append('withMaintenance', withMaintenance ? '1' : '0')
  }
  if (maintenanceSplitterCodes.length > 0) {
    queryParams.append('maintenanceSplitterCodes', maintenanceSplitterCodes.join(','))
  }

  const url = `${env.localBffUrl}/api/splitters?${queryParams.toString()}`

  const response = await fetchWithSessionAuth(url)
  if (!response.ok) {
    throw new Error(`Erro ao consultar BFF Local: ${response.status}`)
  }

  const result = await response.json()
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('Formato de resposta inesperado do BFF Local.')
  }

  const rawRows = result.data as Record<string, unknown>[]

  function parseTotalCount(raw: unknown, itemsLength: number): number {
    const n =
      typeof raw === 'number' && Number.isFinite(raw)
        ? Math.trunc(raw)
        : Number.parseInt(String(raw ?? '').trim(), 10)
    const parsed = Number.isFinite(n) && n >= 0 ? n : 0
    return Math.max(parsed, itemsLength)
  }

  const items: Splitter[] = rawRows.map((row) => {
    const splitterCode = toStringValue(
      pickRowValue(
        row,
        'CÓDIGO[SPLT.SECUNDARIO]',
        'C�DIGO[SPLT.SECUNDARIO]',
      ),
    )

    return {
      id: toNumber(row['ID[SPLT.SECUNDARIO]']),
      code: splitterCode,
      title: toStringValue(row['SPLT.SECUNDARIO']),
      integrationCode: splitterCode,
      outPorts: toNumber(row['CAPACIDADE[SPLT.SECUNDARIO]']),
      active: row['ATIVO[SPLT.SECUNDARIO]'] === true,
      typeText: mapSplitterTypeText(
        toStringValue(row['TIPO EQUIPAMENTO[SPLT.SECUNDARIO]']),
      ),
      description: `Splitter Secundario derivado de ${toStringValue(row['SPLT.PRIMARIO'])}`,
      latitude: toStringValue(row['LATITUDE[SPLT.SECUNDARIO]']),
      longitude: toStringValue(row['LONGITUDE[SPLT.SECUNDARIO]']),
      street: toNullableString(row['RUA[SPLT.SECUNDARIO]']),
      networkBoxCode: null,
      networkBoxTitle: null,
      networkBoxType: null,
      oltCode: toStringValue(row['CONCENTRADOR_CODE']),
      oltIntegrationCode: toStringValue(row['CONCENTRADOR_CODE']),
      oltDescription: toStringValue(row['CONCENTRADOR']),
      createdAt: toNullableDate(row['CRIADO EM[SPLT.SECUNDARIO]']),
      busyCount: toNumber(row['BUSY_COUNT']),
      tipoLocal: toTipoLocal(row['TIPO LOCAL']),
      nomeCondominio: toNullableString(
        pickRowValue(row, 'NOME CONDOMÍNIO', 'NOME CONDOM�NIO'),
      ),
      cityCadastro: toNullableString(row['CIDADE[SPLT.SECUNDARIO]']),
      neighborhoodCadastro: toNullableString(row['BAIRRO[SPLT.SECUNDARIO]']),
      hasCorporateClients: row['TEM_CORPORATIVO_SPLITTER'] === true,
    }
  })

  return {
    items,
    totalCount: parseTotalCount(result.totalCount, items.length),
  }
}

