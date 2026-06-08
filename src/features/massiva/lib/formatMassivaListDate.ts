import { formatBrazilDateTimeShortDisplay } from '@/shared/lib/formatBrazilDisplayDate'

/**
 * Exibição na tabela (pt-BR). Valores nulos viram "—".
 */
export function formatMassivaListDateDisplay(date: Date | null): string {
  return formatBrazilDateTimeShortDisplay(date)
}

/**
 * `estimateTimeOfRestoration` no BFF (unidade: **horas**) → texto em pt-BR. Retorna `null` se sem valor.
 */
export function formatRestorationHoursLabel(
  totalHours: number | null | undefined,
): string | null {
  if (totalHours === null || totalHours === undefined) return null
  if (!Number.isFinite(totalHours) || totalHours < 0) return null
  if (totalHours === 0) return '0 h'
  const h = totalHours
  const nearInt = Math.abs(h - Math.trunc(h)) < 1e-6
  if (nearInt) {
    return `${Math.trunc(h)} h`
  }
  return `${h.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })} h`
}

/** Tolerância para considerar previsão alinhada com abertura + ETR (paridade com editor local). */
const PREVISAO_SLA_ALIGN_TOLERANCE_MS = 2 * 60 * 1000

/** Horas entre abertura e previsão; `null` se inválido. */
export function restorationHoursBetweenDates(
  openedAt: Date | null,
  expectedCloseAt: Date | null,
): number | null {
  if (openedAt === null || expectedCloseAt === null) return null
  if (Number.isNaN(openedAt.getTime()) || Number.isNaN(expectedCloseAt.getTime())) {
    return null
  }
  const diffMs = expectedCloseAt.getTime() - openedAt.getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return null
  return diffMs / (60 * 60 * 1000)
}

/**
 * ETR do Elleven pode vir distorcido (ex.: ~1400 h por data enviada em UTC).
 * Quando abertura + previsão existem, prioriza a diferença entre datas se o ETR da API
 * divergir demais (>3× ou <¼).
 */
export function pickRestorationHoursForDisplay(
  openedAt: Date | null,
  expectedCloseAt: Date | null,
  estimateTimeOfRestoration: number | null,
): number | null {
  const fromDates = restorationHoursBetweenDates(openedAt, expectedCloseAt)
  if (fromDates === null) {
    return estimateTimeOfRestoration
  }
  if (
    estimateTimeOfRestoration === null ||
    !Number.isFinite(estimateTimeOfRestoration) ||
    estimateTimeOfRestoration < 0
  ) {
    return fromDates
  }

  const projectedClose = computeProjectedRestorationAt(openedAt, estimateTimeOfRestoration)
  const previsaoAjustadaManualmente =
    expectedCloseAt != null &&
    projectedClose != null &&
    Math.abs(expectedCloseAt.getTime() - projectedClose.getTime()) >
      PREVISAO_SLA_ALIGN_TOLERANCE_MS
  if (previsaoAjustadaManualmente) {
    return fromDates
  }

  if (estimateTimeOfRestoration > fromDates * 3 || estimateTimeOfRestoration < fromDates * 0.25) {
    return fromDates
  }
  return estimateTimeOfRestoration
}

/** Linha "Previsão" no card/CSV: prioriza o prazo (ETR em h); se não houver, mostra a data. */
export function formatPrevisaoEncerramentoDisplay(
  expectedCloseAt: Date | null,
  estimateTimeOfRestoration: number | null,
  openedAt: Date | null = null,
): string {
  const hours = pickRestorationHoursForDisplay(
    openedAt,
    expectedCloseAt,
    estimateTimeOfRestoration,
  )
  const fromHours = formatRestorationHoursLabel(hours)
  if (fromHours !== null) {
    return fromHours
  }
  return formatMassivaListDateDisplay(expectedCloseAt)
}

/**
 * `abertura` + ETR (horas) em fuso local — referência de projeção (pode divergir do SLA
 * se o utilizador ajustar a data/hora fim com **Editar**).
 */
export function computeProjectedRestorationAt(
  openedAt: Date | null,
  estimateTimeOfRestorationHours: number | null,
): Date | null {
  if (openedAt === null || Number.isNaN(openedAt.getTime())) return null
  if (
    estimateTimeOfRestorationHours === null ||
    !Number.isFinite(estimateTimeOfRestorationHours) ||
    estimateTimeOfRestorationHours < 0
  ) {
    return null
  }
  return new Date(
    openedAt.getTime() + estimateTimeOfRestorationHours * 60 * 60 * 1000,
  )
}

/**
 * Valor de `<input type="datetime-local" />` no fuso do navegador.
 */
export function toDateTimeLocalInputValue(d: Date | null): string {
  if (d === null || Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const DT_LOCAL_RE =
  /^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.\d+)?$/

/**
 * Normaliza o valor vindo de `datetime-local` (ex. alguns browsers enviam `T10:0` em vez
 * de `T10:00`, o que quebra `new Date(s)` e o envio ao BFF).
 */
export function normalizeDateTimeLocalString(raw: string): string {
  const t = raw.trim()
  if (t === '') return ''
  const m = t.match(DT_LOCAL_RE)
  if (m) {
    const pad = (s: string) => s.padStart(2, '0')
    return `${m[1]}-${pad(m[2])}-${pad(m[3])}T${pad(m[4])}:${pad(m[5])}`
  }
  return t
}

/**
 * Parse explícito em **hora local** (evita ambiguidade de `new Date('…T…')` em ISO).
 */
export function parseDateTimeLocalToDate(iso: string): Date | null {
  const n = normalizeDateTimeLocalString(iso)
  if (n === '') return null
  const m = n.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{1,2})$/,
  )
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const h = Number(m[4])
  const min = Number(m[5])
  if (
    [y, mo, d, h, min].some((v) => !Number.isFinite(v))
  ) {
    return null
  }
  const out = new Date(y, mo - 1, d, h, min, 0, 0)
  if (Number.isNaN(out.getTime())) {
    return null
  }
  return out
}
