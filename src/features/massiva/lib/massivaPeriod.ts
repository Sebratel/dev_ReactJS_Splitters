/**
 * Resolução do período do painel de massivas: presets rolantes (7/30/90 dias,
 * 6/12 meses) e seleção de um mês específico. Define também a granularidade das
 * barras do gráfico (dia/semana/mês) e a janela anterior equivalente para
 * comparação de tendência.
 */

export type MassivaPeriodPreset = '7d' | '30d' | '90d' | '6m' | '12m' | 'month' | 'custom'
export type MassivaBucketGranularity = 'day' | 'week' | 'month'

/** Intervalo personalizado (calendário De/Até), datas "YYYY-MM-DD". */
export type MassivaCustomRange = { start: string; end: string }

export type MassivaPeriodRange = {
  /** Início (inclusive) da janela exibida. */
  start: Date
  /** Fim (inclusive) da janela exibida. */
  end: Date
  /** Início do fetch de histórico — cobre período atual + anterior (comparação). */
  fetchStart: Date
  /** Granularidade das barras do gráfico. */
  bucket: MassivaBucketGranularity
  /** Janela imediatamente anterior, de mesmo tamanho (comparação de tendência). */
  previousStart: Date
  previousEnd: Date
  /** Rótulo legível do período (ex.: "Últimos 30 dias", "jun/2026"). */
  label: string
  /** Dias equivalentes da janela — usado pela aba Abertas (janela rolante). */
  spanDays: number
}

const MONTHS_SHORT_PT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

const DAY_MS = 24 * 60 * 60 * 1000

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

/** Segunda-feira da semana da data (início de semana ISO). */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  const dow = (d.getDay() + 6) % 7 // 0 = segunda
  return new Date(d.getTime() - dow * DAY_MS)
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function subtractMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() - months, date.getDate())
}

/** Rótulo "jun/2026" a partir de um Date. */
export function formatMonthLabel(date: Date): string {
  return `${MONTHS_SHORT_PT[date.getMonth()]}/${date.getFullYear()}`
}

/** Valor "YYYY-MM" para o seletor de mês. */
export function toMonthValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Valor "YYYY-MM-DD" (fuso local) para <input type="date">. */
export function toDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Converte "YYYY-MM-DD" em Date local (00:00). `null` se inválido. */
export function parseDateValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (m === null) return null
  const y = Number.parseInt(m[1] ?? '', 10)
  const mo = Number.parseInt(m[2] ?? '', 10)
  const d = Number.parseInt(m[3] ?? '', 10)
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const date = new Date(y, mo - 1, d)
  return date.getMonth() === mo - 1 && date.getDate() === d ? date : null
}

function formatShortDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${MONTHS_SHORT_PT[date.getMonth()]}`
}

/** Converte "YYYY-MM" em Date no primeiro dia do mês (00:00). `null` se inválido. */
export function parseMonthValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value.trim())
  if (m === null) return null
  const year = Number.parseInt(m[1] ?? '', 10)
  const month = Number.parseInt(m[2] ?? '', 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null
  }
  return new Date(year, month - 1, 1)
}

/** Lista os últimos `count` meses (do mais recente ao mais antigo) para o seletor. */
export function listRecentMonths(
  now: Date = new Date(),
  count = 12,
): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = []
  const base = startOfMonth(now)
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    out.push({ value: toMonthValue(d), label: formatMonthLabel(d) })
  }
  return out
}

function bucketForSpanDays(spanDays: number): MassivaBucketGranularity {
  if (spanDays <= 31) return 'day'
  if (spanDays <= 92) return 'week'
  return 'month'
}

/**
 * Resolve a janela do período a partir do preset selecionado.
 * Para `month`, `selectedMonth` deve ser "YYYY-MM"; cai no mês corrente se ausente/ inválido.
 */
export function resolveMassivaPeriod(
  preset: MassivaPeriodPreset,
  selectedMonth: string | null,
  now: Date = new Date(),
  customRange: MassivaCustomRange | null = null,
): MassivaPeriodRange {
  if (preset === 'custom') {
    const parsedStart = parseDateValue(customRange?.start ?? '')
    const parsedEnd = parseDateValue(customRange?.end ?? '')
    // Intervalo inválido/incompleto → cai em 30d para nunca quebrar a tela.
    if (parsedStart === null || parsedEnd === null) {
      return resolveMassivaPeriod('30d', null, now)
    }
    const orderedStart = parsedStart.getTime() <= parsedEnd.getTime() ? parsedStart : parsedEnd
    const orderedEnd = parsedStart.getTime() <= parsedEnd.getTime() ? parsedEnd : parsedStart
    const start = startOfDay(orderedStart)
    const rawEnd = endOfDay(orderedEnd)
    // Não projeta além de hoje.
    const end = rawEnd.getTime() > endOfDay(now).getTime() ? endOfDay(now) : rawEnd
    const durationMs = Math.max(end.getTime() - start.getTime(), DAY_MS - 1)
    const spanDays = Math.max(1, Math.round(durationMs / DAY_MS))
    const previousEnd = new Date(start.getTime() - 1)
    const previousStart = new Date(start.getTime() - durationMs)
    return {
      start,
      end,
      fetchStart: startOfDay(new Date(previousStart.getTime() - DAY_MS)),
      bucket: bucketForSpanDays(spanDays),
      previousStart,
      previousEnd,
      label: `${formatShortDate(start)} – ${formatShortDate(end)}`,
      spanDays,
    }
  }

  if (preset === 'month') {
    const monthBase = parseMonthValue(selectedMonth ?? '') ?? startOfMonth(now)
    const start = startOfMonth(monthBase)
    const monthEnd = endOfMonth(monthBase)
    // Mês corrente: não projeta além de hoje.
    const end = monthEnd.getTime() > now.getTime() ? endOfDay(now) : monthEnd
    const previousBase = subtractMonths(start, 1)
    const previousStart = startOfMonth(previousBase)
    const previousEnd = endOfMonth(previousBase)
    const spanDays = Math.max(1, Math.round((monthEnd.getTime() - start.getTime()) / DAY_MS))
    return {
      start,
      end,
      fetchStart: startOfDay(new Date(previousStart.getTime() - DAY_MS)),
      bucket: 'day',
      previousStart,
      previousEnd,
      label: formatMonthLabel(start),
      spanDays,
    }
  }

  const end = endOfDay(now)
  let start: Date
  let label: string

  if (preset === '6m' || preset === '12m') {
    const months = preset === '6m' ? 6 : 12
    start = startOfDay(subtractMonths(now, months))
    label = `Últimos ${months} meses`
  } else {
    const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 30
    start = startOfDay(new Date(now.getTime() - (days - 1) * DAY_MS))
    label = `Últimos ${days} dias`
  }

  const durationMs = end.getTime() - start.getTime()
  const spanDays = Math.max(1, Math.round(durationMs / DAY_MS))
  const previousEnd = new Date(start.getTime() - 1)
  const previousStart = new Date(start.getTime() - durationMs)

  return {
    start,
    end,
    fetchStart: startOfDay(new Date(previousStart.getTime() - DAY_MS)),
    bucket: bucketForSpanDays(spanDays),
    previousStart,
    previousEnd,
    label,
    spanDays,
  }
}

/** Limite de linhas do histórico local conforme o tamanho do período. */
export function massivaHistoryLimitForRange(range: MassivaPeriodRange): number {
  if (range.spanDays > 180) return 12000
  if (range.spanDays > 90) return 8000
  return 4000
}
