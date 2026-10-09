/** Janela de execução da GMUD (datas YYYY-MM-DD, horas HH:mm), como gravada no nosso banco. */
export type GmudWindow = {
  dataInicio: string
  horaInicio: string
  dataFim: string
  horaFim: string
}

const DAY_MS = 24 * 60 * 60 * 1000

/** YYYY-MM-DD → Date em UTC (meia-noite), para aritmética de dias sem efeito de fuso. */
function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Date (UTC) → YYYY-MM-DD. */
export function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Data local → YYYY-MM-DD (para células do calendário montadas com datas locais). */
export function localDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Move a janela para começar em `newStartDay`, mantendo os horários e a duração em dias
 * (uma GMUD de 23:00 a 02:00 do dia seguinte continua atravessando a meia-noite).
 */
export function shiftWindowToDay(window: GmudWindow, newStartDay: string): GmudWindow {
  const deltaDays = Math.round((parseDay(newStartDay).getTime() - parseDay(window.dataInicio).getTime()) / DAY_MS)
  const newEnd = new Date(parseDay(window.dataFim).getTime() + deltaDays * DAY_MS)
  return { ...window, dataInicio: newStartDay, dataFim: toDayKey(newEnd) }
}

/** A janela é válida se o fim for depois do início. */
export function isWindowValid(window: GmudWindow): boolean {
  const ok = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
  const okT = (s: string) => /^\d{2}:\d{2}$/.test(s)
  if (!ok(window.dataInicio) || !ok(window.dataFim) || !okT(window.horaInicio) || !okT(window.horaFim)) {
    return false
  }
  return `${window.dataFim} ${window.horaFim}` > `${window.dataInicio} ${window.horaInicio}`
}

/** "2026-10-15" + "22:00" → "15/10/2026 22:00". */
export function formatWindowPoint(day: string, time: string): string {
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y} ${time}`
}

/** "15/10/2026 22:00 às 16/10/2026 02:00" (ou "15/10/2026 22:00 às 23:30" no mesmo dia). */
export function formatWindow(window: GmudWindow): string {
  const start = formatWindowPoint(window.dataInicio, window.horaInicio)
  const end =
    window.dataFim === window.dataInicio ? window.horaFim : formatWindowPoint(window.dataFim, window.horaFim)
  return `${start} às ${end}`
}

/** Relato padrão registrado no protocolo do Elleven ao reagendar. */
export function buildRescheduleReport(input: {
  previous: GmudWindow
  next: GmudWindow
  user: string
  motivo?: string
  now?: Date
}): string {
  const now = input.now ?? new Date()
  const quando = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const quem = input.user.trim() !== '' ? input.user.trim() : 'equipe Splitters'
  const motivo = input.motivo?.trim()
  return [
    'REAGENDAMENTO DA GMUD',
    `Janela anterior: ${formatWindow(input.previous)}`,
    `Nova janela: ${formatWindow(input.next)}`,
    ...(motivo ? [`Motivo: ${motivo}`] : []),
    `Reagendado via plataforma por ${quem} em ${quando}.`,
  ].join('\n')
}

/** Semanas (domingo→sábado) que cobrem o mês `monthIndex` (0–11) de `year`, em datas locais. */
export function buildMonthGrid(year: number, monthIndex: number): Date[][] {
  const first = new Date(year, monthIndex, 1)
  const start = new Date(year, monthIndex, 1 - first.getDay())
  const last = new Date(year, monthIndex + 1, 0)
  const weeks: Date[][] = []
  const cursor = new Date(start)
  while (cursor <= last || weeks.length === 0 || cursor.getDay() !== 0) {
    if (cursor.getDay() === 0) weeks.push([])
    weeks[weeks.length - 1].push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
    if (cursor > last && cursor.getDay() === 0) break
  }
  return weeks
}

/** A GMUD ocupa o dia `day` (YYYY-MM-DD) se ele estiver dentro da janela. */
export function windowCoversDay(window: Pick<GmudWindow, 'dataInicio' | 'dataFim'>, day: string): boolean {
  const end = window.dataFim || window.dataInicio
  return day >= window.dataInicio && day <= end
}
