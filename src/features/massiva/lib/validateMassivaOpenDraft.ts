import { combineLocalDateAndTime } from '@/features/massiva/lib/buildMassivaOpeningTechnicalDescription'

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
  } else {
    const local = combineLocalDateAndTime(
      forecastCloseDate,
      forecastCloseTime || '00:00',
    )
    const d = new Date(local)
    if (Number.isNaN(d.getTime())) {
      issues.push('Data/hora de encerramento inválida.')
    }
  }

  return issues
}

export function massivaOpenDraftFinalDateIsoUtc(
  forecastCloseDate: string,
  forecastCloseTime: string,
): string | null {
  if (forecastCloseDate.trim() === '') return null
  const local = combineLocalDateAndTime(
    forecastCloseDate,
    forecastCloseTime || '00:00',
  )
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
