import type { GeogridClienteAtendimento } from '@/features/splitters/model/geogridClienteAtendimento'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import type { SplitterGeoGridComparisonRow } from '@/features/splitters/model/splitterGeoGridComparison'

type Candidate = {
  geogridClientId: string
  equipamentoSigla: string | null
  itemRedeSigla: string | null
  geogridPort: number | null
  oltSigla: string | null
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function normalizeCode(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function buildSplitterMatchers(
  splitterCode: string,
  splitterTitle: string | null | undefined,
  clientes: readonly SplitterCliente[],
): string[] {
  const out = new Set<string>()
  const add = (value: string | null | undefined) => {
    const normalized = normalizeCode(value)
    if (normalized !== '') out.add(normalized)
  }

  add(splitterCode)
  add(splitterTitle)
  for (const cliente of clientes) add(cliente.splitterTitle)

  return [...out]
}

function siglaMatchesCurrentSplitter(
  sigla: string | null | undefined,
  matcherValues: readonly string[],
): boolean {
  const incoming = normalizeCode(sigla)
  if (incoming === '') return false

  return matcherValues.some((current) => {
    if (current === '') return false
    return (
      incoming === current
      || incoming.startsWith(`${current} `)
      || incoming.includes(current)
    )
  })
}

function matchesSplitter(candidate: Candidate, matcherValues: readonly string[]): boolean {
  return (
    siglaMatchesCurrentSplitter(candidate.equipamentoSigla, matcherValues)
    || siglaMatchesCurrentSplitter(candidate.itemRedeSigla, matcherValues)
  )
}

function flattenCandidates(records: readonly GeogridClienteAtendimento[]): Candidate[] {
  const out: Candidate[] = []
  for (const record of records) {
    for (const atendimento of record.atendimentos) {
      out.push({
        geogridClientId: record.clientId,
        equipamentoSigla: atendimento.equipamentoSigla,
        itemRedeSigla: atendimento.itemRedeSigla,
        geogridPort: atendimento.equipamentoPorta,
        oltSigla: atendimento.oltSigla,
      })
    }
  }
  return out
}

function buildBaseRow(cliente: SplitterCliente): Omit<SplitterGeoGridComparisonRow, 'status' | 'note'> {
  return {
    clientId: cliente.clientId,
    authenticationId: cliente.authenticationId,
    name: cliente.name,
    pppoe: cliente.user,
    splitterPort: cliente.port,
    geogridPort: null,
    geogridEquipmentSigla: null,
    geogridClientId: null,
    oltSigla: null,
  }
}

function buildResolvedRow(
  cliente: SplitterCliente,
  candidate: Candidate,
): SplitterGeoGridComparisonRow {
  const samePort = cliente.port !== null && candidate.geogridPort === cliente.port

  return {
    ...buildBaseRow(cliente),
    geogridPort: candidate.geogridPort,
    geogridEquipmentSigla: candidate.equipamentoSigla ?? candidate.itemRedeSigla,
    geogridClientId: candidate.geogridClientId,
    oltSigla: candidate.oltSigla,
    status: samePort ? 'match' : 'port-mismatch',
    note: samePort
      ? 'Porta igual nos dois lados dentro do splitter atual.'
      : 'Cliente encontrado no splitter atual, mas em outra porta.',
  }
}

export function buildSplitterGeoGridComparison(
  clientes: readonly SplitterCliente[],
  geogridRecords: readonly GeogridClienteAtendimento[],
  splitterCode: string,
  splitterTitle?: string | null,
): SplitterGeoGridComparisonRow[] {
  const byName = new Map<string, GeogridClienteAtendimento[]>()
  for (const record of geogridRecords) {
    const key = normalizeName(record.nome)
    if (key === '') continue
    const list = byName.get(key)
    if (list) list.push(record)
    else byName.set(key, [record])
  }

  const matcherValues = buildSplitterMatchers(splitterCode, splitterTitle, clientes)

  return clientes.map((cliente) => {
    const matches = byName.get(normalizeName(cliente.name)) ?? []
    if (matches.length === 0) {
      return {
        ...buildBaseRow(cliente),
        status: 'not-found',
        note: 'Nome não localizado na consulta do GeoGrid.',
      }
    }

    const candidates = flattenCandidates(matches)
    if (candidates.length === 0) {
      return {
        ...buildBaseRow(cliente),
        geogridClientId: matches[0]?.clientId ?? null,
        status: 'no-attendance',
        note: 'Nome encontrado, mas sem atendimento vinculado no GeoGrid.',
      }
    }

    const currentSplitterCandidates = candidates.filter((candidate) =>
      matchesSplitter(candidate, matcherValues),
    )

    if (currentSplitterCandidates.length === 0) {
      return {
        ...buildBaseRow(cliente),
        status: 'not-found',
        note: 'Nome encontrado no GeoGrid, mas não há atendimento no splitter atual.',
      }
    }

    if (cliente.port !== null) {
      const samePort = currentSplitterCandidates.filter(
        (candidate) => candidate.geogridPort === cliente.port,
      )

      if (samePort.length === 1) {
        return buildResolvedRow(cliente, samePort[0])
      }

      if (samePort.length > 1) {
        return {
          ...buildBaseRow(cliente),
          geogridPort: cliente.port,
          geogridEquipmentSigla: samePort[0].equipamentoSigla ?? samePort[0].itemRedeSigla,
          geogridClientId: samePort[0].geogridClientId,
          oltSigla: samePort[0].oltSigla,
          status: 'ambiguous',
          note: 'Mais de um atendimento no splitter atual bate com o mesmo nome e a mesma porta.',
        }
      }
    }

    if (currentSplitterCandidates.length === 1) {
      return buildResolvedRow(cliente, currentSplitterCandidates[0])
    }

    return {
      ...buildBaseRow(cliente),
      status: 'ambiguous',
      note: 'Há mais de um atendimento possível para este nome dentro do splitter atual.',
    }
  })
}
