function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Data/hora atual no fuso de Sao Paulo, sem sufixo UTC.
 * Ex.: 2026-04-28T10:17:00
 */
export function nowInBrazilIsoLike(): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(new Date())
  const map = new Map(parts.map((part) => [part.type, part.value]))

  const year = map.get('year') ?? '1970'
  const month = map.get('month') ?? '01'
  const day = map.get('day') ?? '01'
  const hour = map.get('hour') ?? '00'
  const minute = map.get('minute') ?? '00'
  const second = map.get('second') ?? '00'

  return `${year}-${month}-${day}T${pad2(Number(hour))}:${pad2(Number(minute))}:${pad2(Number(second))}`
}

/**
 * Converte qualquer data valida para representacao local de Sao Paulo.
 * Retorna null para entradas invalidas.
 */
export function formatInBrazilIsoLike(input: Date | string | number | null | undefined): string | null {
  if (input == null) return null
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return null

  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const map = new Map(parts.map((part) => [part.type, part.value]))
  const year = map.get('year') ?? '1970'
  const month = map.get('month') ?? '01'
  const day = map.get('day') ?? '01'
  const hour = map.get('hour') ?? '00'
  const minute = map.get('minute') ?? '00'
  const second = map.get('second') ?? '00'

  return `${year}-${month}-${day}T${pad2(Number(hour))}:${pad2(Number(minute))}:${pad2(Number(second))}`
}
