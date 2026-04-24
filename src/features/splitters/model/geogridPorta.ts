import { isJsonObject } from '@/shared/lib/typeGuards'

/**
 * Paridade com `PortaGeoGrid` no Flutter (`lib/models/porta_geogrid_model.dart`).
 */
export type GeogridPorta = {
  porta: number
  hasReserva: boolean
  reservaEmAtendimento: boolean
  /** ISO 8601 ou null (mesmo que `DateTime?` serializado). */
  dataReserva: string | null
  idCliente: string | null
}

export type GeogridPortaWithDerived = GeogridPorta & {
  hasReservaComCadeado: boolean
}

function normalizeFlag(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function parseDataReserva(value: unknown): string | null {
  const raw = value === null || value === undefined ? '' : String(value).trim()
  if (raw.length === 0) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Equivalente a `PortaGeoGrid.fromGeoGrid` — item bruto da lista `portas` da API.
 */
export function parseGeogridPortaFromApi(raw: unknown): GeogridPortaWithDerived {
  const root = isJsonObject(raw) ? raw : {}
  const dados = isJsonObject(root.dados) ? root.dados : root

  const portaParsed = Number.parseInt(
    String(dados.porta ?? root.porta ?? dados.numeroPorta ?? root.numeroPorta ?? ''),
    10,
  )
  const porta = Number.isFinite(portaParsed) ? portaParsed : -1

  const reservaStatus = normalizeFlag(
    dados.reservaStatus ?? root.reservaStatus ?? dados.statusReserva ?? root.statusReserva,
  )
  const reservaAtendimento = normalizeFlag(
    dados.reservaAtendimento ??
      root.reservaAtendimento ??
      dados.emAtendimento ??
      root.emAtendimento,
  )
  const idClienteValue =
    dados.idCliente ?? root.idCliente ?? dados.clienteId ?? root.clienteId
  const idClienteRaw = idClienteValue === null || idClienteValue === undefined
    ? ''
    : String(idClienteValue).trim()
  const idCliente = idClienteRaw.length > 0 ? idClienteRaw : null
  const dataReserva = parseDataReserva(
    dados.dataReserva ?? root.dataReserva ?? dados.reservedAt ?? root.reservedAt,
  )

  // Regra de negocio: somente status explicito de reserva conta como reserva.
  const hasReserva = (
    reservaStatus === 'reserva'
    || reservaStatus === 'reservado'
    || reservaStatus === 'lock'
    || reservaStatus === 'bloqueado'
  )
  const reservaEmAtendimento = (
    reservaAtendimento === 's'
    || reservaAtendimento === 'sim'
    || reservaAtendimento === 'true'
    || reservaAtendimento === '1'
  )

  const base: GeogridPorta = {
    porta,
    hasReserva,
    reservaEmAtendimento,
    dataReserva,
    idCliente,
  }

  return {
    ...base,
    hasReservaComCadeado: hasReserva && !reservaEmAtendimento,
  }
}

/**
 * Mesma regra de `GeoGridService.fetchReservasPorSplitter` (merge por número de porta).
 */
export function mergeGeogridPortasIntoMap(
  rawList: unknown[],
): Map<number, GeogridPortaWithDerived> {
  const result = new Map<number, GeogridPortaWithDerived>()

  for (const raw of rawList) {
    const porta = parseGeogridPortaFromApi(raw)
    if (porta.porta <= 0) continue

    const existing = result.get(porta.porta)
    if (
      existing === undefined
      || (!existing.hasReserva && porta.hasReserva)
      || (!existing.idCliente && !!porta.idCliente)
      || (!existing.dataReserva && !!porta.dataReserva)
      || (!existing.hasReservaComCadeado && porta.hasReservaComCadeado)
    ) {
      result.set(porta.porta, porta)
    }
  }

  return result
}
