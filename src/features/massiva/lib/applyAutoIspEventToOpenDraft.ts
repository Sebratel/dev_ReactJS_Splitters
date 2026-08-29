import type { AutoIspEvent } from '@/features/autoisp/model/autoIsp.types'
import { useMassivaOpenDraftStore } from '@/features/massiva/store/massivaOpenDraftStore'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Partes `YYYY-MM-DD` e `HH:mm` no fuso local a partir de ISO (ex.: `startAt` do AutoISP). */
export function isoToLocalDateTimeParts(
  iso: string | null,
): { date: string; time: string } | null {
  if (iso == null || iso.trim() === '') return null
  const inst = new Date(iso)
  if (Number.isNaN(inst.getTime())) return null
  return {
    date: `${inst.getFullYear()}-${pad2(inst.getMonth() + 1)}-${pad2(inst.getDate())}`,
    time: `${pad2(inst.getHours())}:${pad2(inst.getMinutes())}`,
  }
}

/** Quantidade sugerida para “Clientes afetados” / POST a partir do evento. */
export function autoIspSuggestedAffectedCount(event: AutoIspEvent): number | null {
  const onu = Number.isFinite(event.countOnus) ? event.countOnus : 0
  const circ = Number.isFinite(event.countCircuits) ? event.countCircuits : 0
  const n = Math.max(onu, circ)
  return n > 0 ? n : null
}

/**
 * Preenche o rascunho de abertura a partir de um evento AutoISP (paridade com o app antigo):
 * relato, origem rompimento, horários, previsão vazia (“aguardando infra”), quantidade ONUs/circuitos.
 */
export function applyAutoIspEventToOpenDraft(event: AutoIspEvent): void {
  const s = useMassivaOpenDraftStore.getState()
  const start = isoToLocalDateTimeParts(event.startAt)
  const now = new Date()

  s.setDescriptionAutoSync(true)
  s.setInitialReport((event.eventType ?? '').trim())
  s.setEventIdentifiedBy('zabbix')
  s.setAssignmentForecastDate('')
  s.setAssignmentForecastTime('')

  if (start) {
    s.setEventStartDate(start.date)
    s.setEventStartTime(start.time)
  } else {
    s.setEventStartDate('')
    s.setEventStartTime('')
  }

  s.setEventIdentifiedDate(
    `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
  )
  s.setEventIdentifiedTime(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`)

  s.setAffectedUsersQuantityAutoIspOverride(autoIspSuggestedAffectedCount(event))
}
