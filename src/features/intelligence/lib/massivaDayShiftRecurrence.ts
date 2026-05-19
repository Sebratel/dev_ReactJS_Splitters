export const RECURRENCE_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'] as const
export const RECURRENCE_SHIFTS = ['Madrugada', 'Manha', 'Tarde', 'Noite'] as const

export type MassivaDayShiftRecurrenceCell = {
  weekday: (typeof RECURRENCE_WEEKDAYS)[number]
  shift: (typeof RECURRENCE_SHIFTS)[number]
  count: number
}

export function bucketMassivaOpenedAt(openedAt: Date): {
  weekday: MassivaDayShiftRecurrenceCell['weekday']
  shift: MassivaDayShiftRecurrenceCell['shift']
} {
  const weekday = RECURRENCE_WEEKDAYS[openedAt.getDay()] ?? 'Dom'
  const hour = openedAt.getHours()
  const shift =
    hour < 6 ? 'Madrugada' : hour < 12 ? 'Manha' : hour < 18 ? 'Tarde' : 'Noite'
  return { weekday, shift }
}

export function emptyMassivaDayShiftRecurrenceGrid(): MassivaDayShiftRecurrenceCell[] {
  const cells: MassivaDayShiftRecurrenceCell[] = []
  for (const weekday of RECURRENCE_WEEKDAYS) {
    for (const shift of RECURRENCE_SHIFTS) {
      cells.push({ weekday, shift, count: 0 })
    }
  }
  return cells
}

/** Conta massivas distintas por dia da semana × turno (data/hora de abertura). */
export function buildMassivaDayShiftRecurrenceFromOpenedAt(
  openedAtList: readonly Date[],
): MassivaDayShiftRecurrenceCell[] {
  const index = new Map<string, MassivaDayShiftRecurrenceCell>()
  for (const cell of emptyMassivaDayShiftRecurrenceGrid()) {
    index.set(`${cell.weekday}-${cell.shift}`, cell)
  }
  for (const openedAt of openedAtList) {
    if (Number.isNaN(openedAt.getTime())) continue
    const { weekday, shift } = bucketMassivaOpenedAt(openedAt)
    const cell = index.get(`${weekday}-${shift}`)
    if (cell) cell.count += 1
  }
  return [...index.values()]
}

/** Lógica antiga (incorreta para o rótulo): 1 por equipamento com última abertura no bucket. */
export function buildMassivaDayShiftRecurrenceFromSplitterLatestOpenedAt(
  rows: readonly { latestOpenedAt: Date | null }[],
): MassivaDayShiftRecurrenceCell[] {
  const dates: Date[] = []
  for (const row of rows) {
    if (row.latestOpenedAt && !Number.isNaN(row.latestOpenedAt.getTime())) {
      dates.push(row.latestOpenedAt)
    }
  }
  return buildMassivaDayShiftRecurrenceFromOpenedAt(dates)
}

export function mergeMassivaDayShiftRecurrenceCounts(
  partial: readonly { weekday: string; shift: string; count: number }[],
): MassivaDayShiftRecurrenceCell[] {
  const grid = emptyMassivaDayShiftRecurrenceGrid()
  const index = new Map(grid.map((cell) => [`${cell.weekday}-${cell.shift}`, cell]))
  for (const row of partial) {
    const weekday = RECURRENCE_WEEKDAYS.find((w) => w === row.weekday)
    const shift = RECURRENCE_SHIFTS.find((s) => s === row.shift)
    if (!weekday || !shift) continue
    const cell = index.get(`${weekday}-${shift}`)
    if (cell) cell.count = Math.max(0, Math.round(Number(row.count ?? 0)))
  }
  return grid
}
