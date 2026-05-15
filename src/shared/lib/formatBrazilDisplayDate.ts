export const BRAZIL_DISPLAY_TIME_ZONE = 'America/Sao_Paulo'

export function parseDisplayDate(
  input: Date | string | number | null | undefined,
): Date | null {
  if (input == null) return null
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return null
  return date
}

type FormatBrazilDateTimeDisplayOptions = Intl.DateTimeFormatOptions & {
  fallback?: string
}

function formatWithBrazilTimeZone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_DISPLAY_TIME_ZONE,
    ...options,
  }).format(date)
}

/**
 * Formata data/hora para exibição na UI sempre no fuso de São Paulo.
 */
export function formatBrazilDateTimeDisplay(
  input: Date | string | number | null | undefined,
  options: FormatBrazilDateTimeDisplayOptions = {},
): string {
  const { fallback = '—', ...formatOptions } = options
  const date = parseDisplayDate(input)
  if (!date) return fallback
  try {
    return formatWithBrazilTimeZone(date, formatOptions)
  } catch {
    return fallback
  }
}

/** dd/MM/yyyy */
export function formatBrazilDateDisplay(
  input: Date | string | number | null | undefined,
  fallback = '—',
): string {
  return formatBrazilDateTimeDisplay(input, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    fallback,
  })
}

/** dd/MM/yyyy HH:mm */
export function formatBrazilDateTimeShortDisplay(
  input: Date | string | number | null | undefined,
  fallback = '—',
): string {
  return formatBrazilDateTimeDisplay(input, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    fallback,
  })
}

/** dd/MM HH:mm (sem ano) */
export function formatBrazilDayMonthTimeDisplay(
  input: Date | string | number | null | undefined,
  fallback = '—',
): string {
  return formatBrazilDateTimeDisplay(input, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    fallback,
  })
}

/** dd mmm, HH:mm */
export function formatBrazilCompactDateTimeDisplay(
  input: Date | string | number | null | undefined,
  fallback = '—',
): string {
  return formatBrazilDateTimeDisplay(input, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    fallback,
  })
}

/** dd/MM (rótulos de gráfico) */
export function formatBrazilDayMonthDisplay(
  input: Date | string | number | null | undefined,
  fallback = '—',
): string {
  return formatBrazilDateTimeDisplay(input, {
    day: '2-digit',
    month: '2-digit',
    fallback,
  })
}
