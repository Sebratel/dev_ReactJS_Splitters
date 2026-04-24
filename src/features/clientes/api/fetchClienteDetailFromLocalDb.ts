import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { ClienteDetail } from '@/features/clientes/model/clienteDetail'
import { pickIsCorporateFromRow } from '@/features/splitters/model/splitterCliente'
import {
  CLIENT_LATITUDE_ROW_KEYS,
  CLIENT_LONGITUDE_ROW_KEYS,
  pickCoordinateFromRow,
} from '@/features/splitters/lib/pickClienteCoordinatesFromRow'

function toInt(value: unknown, fallback = 0): number {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? n : fallback
}

function toNullableText(value: unknown): string | null {
  const txt = String(value ?? '').trim()
  return txt.length > 0 ? txt : null
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

function mapLocalDbRowToClienteDetail(row: Record<string, unknown>): ClienteDetail {
  const splitterCodeRaw =
    row['CÓDIGO[SPLT.SECUNDARIO]'] ?? row['CÃ“DIGO[SPLT.SECUNDARIO]']
  const splitterTitleRaw = row['SPLT.SECUNDARIO'] ?? row['TITULO[SPLT.SECUNDARIO]']
  const accessPointCodeRaw = row['PONTO DE ACESSO CODE'] ?? row['PONTO DE ACESSO'] ?? ''
  const contractId = toInt(row['CONTRATO ID[CLIENTE]'], 0)
  const clientId = toInt(
    row['ID[CLIENTE]'] ??
      row['ID CLIENTE'] ??
      row['CLIENTE ID'] ??
      row['CONTRATO ID[CLIENTE]'],
    0,
  )
  const contractStatus = toInt(row['STATUS[CONTRATO]'] ?? row['STATUS_CONTRATO'], 0)
  const contractStage = toInt(row['ETAPA[CONTRATO]'] ?? row['ESTAGIO_CONTRATO'], 0)
  const contractStatusDescription = toNullableText(
    row['STATUS_DESC[CONTRATO]'] ?? row['STATUS_CONTRATO'],
  )
  const contractStageDescription = toNullableText(
    row['ETAPA_DESC[CONTRATO]'] ?? row['ESTAGIO_CONTRATO'],
  )

  return {
    authenticationId: toInt(row['ID CONEXAO[CLIENTE]'], 0),
    clientId,
    user: String(row['USUARIO[CLIENTE]'] ?? row['USUÁRIO[CLIENTE]'] ?? ''),
    name: String(row['NOME CLIENTE'] || row['NOME[CLIENTE]'] || 'Cliente Desconhecido'),
    phone: toNullableText(row['CELULAR']),
    email: toNullableText(row['EMAIL']),
    status: 1,
    port: toInt(row['PORTA SPLITTER[SPLT.SECUNDARIO]'], 0),
    blocked: toBool(row['BLOQUEIO']),
    blockedDescription: toNullableText(row['DESCRICAO_PORTA']),
    isCorporate: pickIsCorporateFromRow(row),
    splitterCode: splitterCodeRaw ? String(splitterCodeRaw) : null,
    splitterTitle: splitterTitleRaw ? String(splitterTitleRaw) : null,
    address: {
      street: String(row['RUA'] || ''),
      number: String(row['NUMERO'] || ''),
      neighborhood: String(row['BAIRRO'] || ''),
      city: String(row['CIDADE CLIENTE'] || ''),
      state: String(row['UF'] || '').trim(),
      postalCode: '',
      complement: row['ENDERECO COMPLE.'] ? String(row['ENDERECO COMPLE.']) : null,
      latitude: pickCoordinateFromRow(row, CLIENT_LATITUDE_ROW_KEYS),
      longitude: pickCoordinateFromRow(row, CLIENT_LONGITUDE_ROW_KEYS),
    },
    accessPoint: {
      code: String(accessPointCodeRaw),
      title: String(row['PONTO DE ACESSO'] || ''),
      slotOlt: 0,
      portOlt: 0,
    },
    contract:
      contractId > 0
        ? {
            id: contractId,
            status: contractStatus,
            statusDescription: contractStatusDescription ?? '',
            stage: contractStage,
            stageDescription: contractStageDescription ?? '',
          }
        : null,
  }
}

export async function fetchClienteDetailFromLocalDb(
  authenticationId: number,
): Promise<ClienteDetail | null> {
  const url = `${env.localBffUrl}/api/clientes/${authenticationId}`
  const response = await fetchWithSessionAuth(url)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Erro ao consultar cliente no BFF Local: ${response.status}`)
  }

  const result = await response.json()
  if (!result.success || !result.data) {
    throw new Error('Formato de resposta inesperado do BFF Local.')
  }

  return mapLocalDbRowToClienteDetail(result.data as Record<string, unknown>)
}
