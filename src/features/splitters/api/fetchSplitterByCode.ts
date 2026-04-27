import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import {
  mapSplitterTypeText,
  type Splitter,
} from '@/features/splitters/model/splitter'

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

/**
 * Busca um unico splitter pelo seu codigo via endpoint dedicado.
 * Retorna `null` se nao encontrado (404).
 */
export async function fetchSplitterByCode(code: string): Promise<Splitter | null> {
  const url = new URL(`${env.localBffUrl}/api/splitters-by-code`)
  url.searchParams.set('code', code)

  const response = await fetchWithSessionAuth(url)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Erro ao buscar splitter por codigo: ${response.status}`)
  }

  const result = await response.json()
  if (!result.success || !result.data) {
    throw new Error('Formato de resposta inesperado do BFF Local.')
  }

  const row = result.data as Record<string, unknown>
  const splitterCode = toStringValue(
    pickRowValue(
      row,
      'C”DIGO[SPLT.SECUNDARIO]',
      'CùDIGO[SPLT.SECUNDARIO]',
      'C?DIGO[SPLT.SECUNDARIO]',
    ),
  )
  const resolvedSplitterCode = splitterCode.trim() !== '' ? splitterCode : code.trim()

  return {
    id: toNumber(row['ID[SPLT.SECUNDARIO]']),
    code: resolvedSplitterCode,
    title: toStringValue(row['SPLT.SECUNDARIO']),
    integrationCode: resolvedSplitterCode,
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
    busyCount: toNumber(row['BUSY_COUNT']),
    tipoLocal: toTipoLocal(row['TIPO LOCAL']),
    nomeCondominio: toNullableString(
      pickRowValue(row, 'NOME CONDOMùNIO', 'NOME CONDOMùNIO', 'NOME CONDOM?NIO'),
    ),
  }
}

