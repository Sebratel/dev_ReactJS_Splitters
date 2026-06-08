import type { MassivaOpeningBasis } from '@/features/massiva/model/massivaOpeningBasis'
import { parseDateTimeLocalToDate } from '@/features/massiva/lib/formatMassivaListDate'
import { formatBrazilDateTimeShortDisplay } from '@/shared/lib/formatBrazilDisplayDate'

export const MASSIVA_SOLICITATION_TYPE_LABEL = 'Registro Massivas'

const COL_W = 48

function displaySplitterLine(entry: { code: string; label: string }): string {
  const title = entry.label.trim() || entry.code
  return title
}

/** Lista CTOs/splitters em duas colunas (textarea monoespacada). */
export function formatSplitterLabelsTwoColumns(
  entries: ReadonlyArray<{ code: string; label: string }>,
): string {
  if (entries.length === 0) return ''

  const sorted = [...entries].sort((a, b) => {
    const left = (a.label || a.code).toLowerCase()
    const right = (b.label || b.code).toLowerCase()
    return left.localeCompare(right, 'pt-BR', { sensitivity: 'base' })
  })

  const rows: string[] = []
  for (let index = 0; index < sorted.length; index += 2) {
    const left = displaySplitterLine(sorted[index]!)
    const rightEntry = sorted[index + 1]

    if (rightEntry) {
      const right = displaySplitterLine(rightEntry)
      rows.push(`${left.padEnd(COL_W, ' ')} | ${right}`)
      continue
    }

    rows.push(left)
  }

  return rows.join('\n')
}

export function combineLocalDateAndTime(
  date: string,
  time: string,
): string {
  const normalizedDate = date.trim()
  if (!normalizedDate) return ''

  const rawTime = time.trim() || '00:00'
  const hhmm = rawTime.length >= 5 && rawTime.includes(':') ? rawTime.slice(0, 5) : '00:00'
  return `${normalizedDate}T${hhmm}:00`
}

function formatPtLocalDateTimeFromParts(
  date: string,
  time: string,
): string {
  const combined = combineLocalDateAndTime(date, time)
  if (!combined) return '-'

  const instant = parseDateTimeLocalToDate(combined.slice(0, 16))
  if (instant === null) return '-'

  return formatBrazilDateTimeShortDisplay(instant)
}

function formatNormalizationDeadline(
  forecastDate: string,
  forecastTime: string,
): string {
  const line = formatPtLocalDateTimeFromParts(forecastDate, forecastTime)
  if (line === '-') return 'aguardando infra'
  return line
}

function flattenSplitterDisplayEntries(
  basis: MassivaOpeningBasis,
): Array<{ code: string; label: string }> {
  const byCode = new Map<string, { code: string; label: string }>()

  for (const route of basis.topology.routes) {
    for (const entry of route.effectiveSplitterDisplay) {
      if (!byCode.has(entry.code)) {
        byCode.set(entry.code, entry)
      }
    }
  }

  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'))
}

export function buildTopologySummaryLine(
  basis: MassivaOpeningBasis | null,
): string {
  if (!basis) return 'Nao informada'

  if (basis.topology.routes.length === 0) {
    return 'Nenhuma rota completa selecionada'
  }

  const parts = basis.topology.routes.map((route) => {
    const splitterCount = route.effectiveSplitterDisplay.length
    return `PA ${route.apCode} (${route.apDisplayTitle}) / slot ${route.slot} / porta ${route.port} / ${splitterCount} splitter(s)`
  })

  return parts.join(' ; ')
}

export function buildCtosAfetadasBlock(basis: MassivaOpeningBasis | null): string {
  if (!basis) return 'aguardando definicao da topologia afetada'

  const entries = flattenSplitterDisplayEntries(basis)
  if (entries.length === 0) {
    return 'aguardando definicao da topologia afetada'
  }

  return formatSplitterLabelsTwoColumns(entries)
}

export type MassivaTechnicalDescriptionDraft = {
  requesterDisplayName: string
  initialReport: string
  fieldTechnicianRequesting: boolean
  basis: MassivaOpeningBasis | null
  affectedClientsCount: number
  eventStartDate: string
  eventStartTime: string
  eventIdentifiedDate: string
  eventIdentifiedTime: string
  forecastCloseDate: string
  forecastCloseTime: string
}

export function buildMassivaOpeningTechnicalDescription(
  params: MassivaTechnicalDescriptionDraft,
): string {
  const relato = params.initialReport.trim() || 'Nao informado'
  const origem = params.fieldTechnicianRequesting
    ? 'tecnico em campo solicitando abertura'
    : 'evento de rompimento'

  const topologyLine = buildTopologySummaryLine(params.basis)
  const ctosLine = buildCtosAfetadasBlock(params.basis)

  const eventStartedLine = formatPtLocalDateTimeFromParts(
    params.eventStartDate,
    params.eventStartTime,
  )
  const eventIdentifiedLine = formatPtLocalDateTimeFromParts(
    params.eventIdentifiedDate,
    params.eventIdentifiedTime,
  )
  const normalizationDeadlineLine = formatNormalizationDeadline(
    params.forecastCloseDate,
    params.forecastCloseTime,
  )

  return [
    '🧾 INFORMACOES OBRIGATORIAS - ABERTURA',
    '',
    `👤 Nome do solicitante: ${params.requesterDisplayName}`,
    '',
    `📝 Relato inicial: ${relato}`,
    '',
    `🚨 Origem massiva: ${origem}`,
    '',
    '🧩 CTOs afetadas:',
    ctosLine,
    '',
    '🗺️ Topologia:',
    topologyLine,
    '',
    `👥 Clientes afetados: ${params.affectedClientsCount}`,
    '',
    `⏱️ Horario que iniciou o evento: ${eventStartedLine}`,
    '',
    `🔎 Horario que o evento foi identificado: ${eventIdentifiedLine}`,
    '',
    `📅 Prazo inicial de normalização: ${normalizationDeadlineLine}`,
  ].join('\n')
}
