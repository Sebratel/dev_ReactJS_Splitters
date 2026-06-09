import { combineLocalDateAndTime } from '@/features/massiva/lib/buildMassivaOpeningTechnicalDescription'
import { parseDateTimeLocalToDate } from '@/features/massiva/lib/formatMassivaListDate'

const DATE_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_INPUT_RE = /^(\d{1,2}):(\d{1,2})$/

/**
 * Horário “de parede” do formulário (`yyyy-MM-dd'T'HH:mm:ss`) — usado no histórico MySQL local.
 */
export function massivaOpenDraftFinalDateLocal(
  forecastCloseDate: string,
  forecastCloseTime: string,
): string | null {
  const date = forecastCloseDate.trim()
  const dateMatch = DATE_INPUT_RE.exec(date)
  if (dateMatch === null) return null

  const rawTime = (forecastCloseTime || '00:00').trim()
  const timeMatch = TIME_INPUT_RE.exec(rawTime.length >= 5 ? rawTime.slice(0, 5) : rawTime)
  if (timeMatch === null) return null

  const hour = Number.parseInt(timeMatch[1] ?? '', 10)
  const minute = Number.parseInt(timeMatch[2] ?? '', 10)
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null
  }

  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${hh}:${mm}:00`
}

/**
 * POST `salvar-massiva-via-api`: o gateway espera ISO UTC com milissegundos (ex. `.env.example`).
 * Converte o horário local do formulário sem alterar o instante civil digitado.
 */
export function massivaLocalDateTimeToGatewayIso(localDateTime: string): string | null {
  const trimmed = localDateTime.trim()
  if (trimmed === '') return null
  const d = parseDateTimeLocalToDate(trimmed.slice(0, 16))
  if (d === null) return null
  return d.toISOString()
}

/** @deprecated Alias de {@link massivaLocalDateTimeToGatewayIso} via campos do rascunho. */
export function massivaOpenDraftFinalDateIsoUtc(
  forecastCloseDate: string,
  forecastCloseTime: string,
): string | null {
  const local = massivaOpenDraftFinalDateLocal(forecastCloseDate, forecastCloseTime)
  if (local === null) return null
  return massivaLocalDateTimeToGatewayIso(local)
}

/**
 * Paridade `_validateOpenMassivaSelection` (descrição + prazo) em `massiva_screen.dart`.
 */
export function getMassivaOpenDraftIssues(
  assignmentDescription: string,
  forecastCloseDate: string,
  forecastCloseTime: string,
): string[] {
  const issues: string[] = []

  if (assignmentDescription.trim() === '') {
    issues.push('Informe a descrição técnica antes de abrir a massiva.')
  }

  if (forecastCloseDate.trim() === '') {
    issues.push('Informe a data prevista de normalização (prazo).')
  } else if (massivaOpenDraftFinalDateLocal(forecastCloseDate, forecastCloseTime) === null) {
    issues.push('Data/hora de encerramento inválida.')
  }

  return issues
}
