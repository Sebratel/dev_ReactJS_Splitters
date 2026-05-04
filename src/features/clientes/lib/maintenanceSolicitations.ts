import type { Solicitation } from '@/features/clientes/model/solicitation'

/**
 * Palavras-chave para identificar protocolos de manutenção / OSS nas solicitações do ERP.
 * Expanda conforme os textos reais do backend (título, área, equipe).
 */
const MAINTENANCE_MARKERS = [
  'manuten',
  'manutencao',
  'maintenance',
  'manut.',
  'corretiva',
  'preventiva',
  'rompimento',
  'rompi',
  'reparo',
  'reparacao',
  'reparação',
  'loss_signal',
  'loss signal',
  'loss-signal',
  'oss/',
  ' oss ',
  'oss-',
  '-oss',
  ' suporte tecnico',
  'suporte técnico',
  'atendimento tecnico',
  'atendimento técnico',
  ' campo ',
  ' rede externa',
]

/** Status que no ERP costumam significar "já tratado / encerrado" mesmo sem finalDate preenchido. */
const CLOSED_STATUS_FRAGMENTS = [
  'fechado',
  'encerr',
  'conclu',
  'finaliz',
  'cancel',
  'baixa',
]

function normalizeForMatch(raw: string): string {
  const s = raw.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  return ` ${s.replace(/\s+/g, ' ').trim()} `
}

export function isMaintenanceSolicitation(s: Solicitation): boolean {
  const haystack = normalizeForMatch(
    `${s.title ?? ''} ${s.sectorArea ?? ''} ${s.team ?? ''} ${s.status ?? ''}`,
  )
  return MAINTENANCE_MARKERS.some((needle) =>
    haystack.includes(normalizeForMatch(needle).trim()),
  )
}

/** Considera encerrado pelo backend quando há data final OU status textual típico de encerramento. */
export function isSolicitationClosedForKpi(s: Solicitation): boolean {
  if (s.finalDate !== null) return true
  const st = normalizeForMatch(s.status ?? '')
  return CLOSED_STATUS_FRAGMENTS.some((frag) => st.includes(frag))
}

export type MaintenanceSummary = {
  total: number
  open: number
  closed: number
  latest: Date | null
}

export function summarizeMaintenance(items: Solicitation[]): MaintenanceSummary {
  let total = 0
  let open = 0
  let closed = 0
  let latest: Date | null = null

  for (const item of items) {
    if (!isMaintenanceSolicitation(item)) continue
    total += 1
    if (isSolicitationClosedForKpi(item)) closed += 1
    else open += 1

    const ref = item.beginningDate ?? item.finalDate
    if (ref !== null && (latest === null || ref.getTime() > latest.getTime())) {
      latest = ref
    }
  }

  return { total, open, closed, latest }
}

export type MaintenanceMonthlyPoint = {
  /** chave estavel `YYYY-MM` para Recharts */
  key: string
  /** rotulo curto MM/YY para o eixo X */
  label: string
  count: number
}

const MONTH_LABELS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

function monthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function monthLabel(date: Date): string {
  return `${MONTH_LABELS_SHORT[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`
}

export type GroupMaintenanceByMonthOptions = {
  /** Data “hoje” para testes e para protocolos em aberto sem nenhuma data no ERP (caem no mês corrente). */
  referenceNow?: Date
}

/**
 * Agrupa por mês usando `beginningDate`, ou `finalDate` se a abertura vier vazia.
 * Protocolos **em aberto** sem as duas datas costumam vir assim no ERP; nesse caso usam o mês de `referenceNow`
 * para ainda aparecerem na linha do tempo (normalmente a barra/ponto do mês atual).
 */
export function groupMaintenanceByMonth(
  items: Solicitation[],
  options?: GroupMaintenanceByMonthOptions,
): MaintenanceMonthlyPoint[] {
  const referenceNow = options?.referenceNow ?? new Date()
  const counts = new Map<string, { date: Date; count: number }>()

  for (const item of items) {
    if (!isMaintenanceSolicitation(item)) continue
    const ref =
      item.beginningDate ??
      item.finalDate ??
      (!isSolicitationClosedForKpi(item) ? referenceNow : null)
    if (ref === null) continue
    const key = monthKey(ref)
    const bucket = counts.get(key)
    if (bucket === undefined) {
      counts.set(key, {
        date: new Date(ref.getFullYear(), ref.getMonth(), 1),
        count: 1,
      })
    } else {
      bucket.count += 1
    }
  }

  if (counts.size === 0) return []

  const sortedKeys = [...counts.keys()].sort()
  const firstBucket = counts.get(sortedKeys[0])!
  const cursor = new Date(firstBucket.date)
  const end = new Date(referenceNow.getFullYear(), referenceNow.getMonth(), 1)

  const points: MaintenanceMonthlyPoint[] = []
  while (cursor.getTime() <= end.getTime()) {
    const key = monthKey(cursor)
    const bucket = counts.get(key)
    points.push({
      key,
      label: monthLabel(cursor),
      count: bucket?.count ?? 0,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return points
}
