import { formatOltLabel } from '@/features/splitters/lib/formatOltLabel'

type RiskRowForMassivaInsights = {
  splitterCode: string
  splitterTitle: string
  oltCode: string | null
  oltDescription: string | null
  accessPointCode: string | null
  accessPointTitle: string | null
  street: string | null
  cityCadastro: string | null
  totalTickets: number
  openTickets: number
  currentUsagePercent: number
  selectedDelta: number
}

export type MassivaRecurrenceBucketKey = '0' | '1' | '2' | '3-5' | '6+'

export type MassivaRecurrenceHistogramRow = {
  bucket: MassivaRecurrenceBucketKey
  label: string
  splitters: number
}

export type MassivaEquipmentRankingRow = {
  splitterCode: string
  splitterTitle: string
  distinctMassivas: number
  openMassivas: number
  usagePercent: number
  selectedDelta: number
  oltLabel: string
  locationLabel: string
}

export type MassivaRecurrenceInsights = {
  totalSplittersInScope: number
  splittersWithMassiva: number
  splittersWithoutMassiva: number
  totalMassivaLinkages: number
  concentrationTop20Count: number
  concentrationTop20LinkagesPercent: number
  histogram: MassivaRecurrenceHistogramRow[]
  ranking: MassivaEquipmentRankingRow[]
  showBarChart: boolean
  barChartLeaders: Array<{
    splitterCode: string
    splitterTitle: string
    totalTickets: number
  }>
}

const HISTOGRAM_ORDER: MassivaRecurrenceBucketKey[] = ['0', '1', '2', '3-5', '6+']

const HISTOGRAM_LABELS: Record<MassivaRecurrenceBucketKey, string> = {
  '0': '0 massivas',
  '1': '1 massiva',
  '2': '2 massivas',
  '3-5': '3 a 5',
  '6+': '6 ou mais',
}

function ticketBucket(totalTickets: number): MassivaRecurrenceBucketKey {
  if (totalTickets <= 0) return '0'
  if (totalTickets === 1) return '1'
  if (totalTickets === 2) return '2'
  if (totalTickets <= 5) return '3-5'
  return '6+'
}

function compareRanking(a: RiskRowForMassivaInsights, b: RiskRowForMassivaInsights): number {
  if (b.totalTickets !== a.totalTickets) return b.totalTickets - a.totalTickets
  if (b.openTickets !== a.openTickets) return b.openTickets - a.openTickets
  if (b.currentUsagePercent !== a.currentUsagePercent) {
    return b.currentUsagePercent - a.currentUsagePercent
  }
  return a.splitterCode.localeCompare(b.splitterCode, 'pt-BR')
}

function oltLabel(row: RiskRowForMassivaInsights): string {
  return formatOltLabel(row.accessPointTitle ?? row.accessPointCode) ?? '—'
}

function locationLabel(row: RiskRowForMassivaInsights): string {
  const street = (row.street ?? '').trim()
  const city = (row.cityCadastro ?? '').trim()
  if (street !== '' && city !== '') return `${street}, ${city}`
  return street || city || '—'
}

export function computeMassivaRecurrenceInsights(
  riskRanking: readonly RiskRowForMassivaInsights[],
): MassivaRecurrenceInsights {
  const totalSplittersInScope = riskRanking.length
  const histCounts = Object.fromEntries(
    HISTOGRAM_ORDER.map((bucket) => [bucket, 0]),
  ) as Record<MassivaRecurrenceBucketKey, number>

  for (const row of riskRanking) {
    const bucket = ticketBucket(row.totalTickets)
    histCounts[bucket] += 1
  }

  const withMassiva = riskRanking.filter((row) => row.totalTickets > 0)
  const splittersWithMassiva = withMassiva.length
  const splittersWithoutMassiva = Math.max(0, totalSplittersInScope - splittersWithMassiva)
  const totalMassivaLinkages = withMassiva.reduce((sum, row) => sum + row.totalTickets, 0)

  const sortedByTickets = [...withMassiva].sort(compareRanking)
  const top20 = sortedByTickets.slice(0, 20)
  const top20LinkageSum = top20.reduce((sum, row) => sum + row.totalTickets, 0)
  const concentrationTop20LinkagesPercent =
    totalMassivaLinkages > 0
      ? Number(((top20LinkageSum / totalMassivaLinkages) * 100).toFixed(1))
      : 0

  const ranking: MassivaEquipmentRankingRow[] = sortedByTickets.slice(0, 15).map((row) => ({
    splitterCode: row.splitterCode,
    splitterTitle: row.splitterTitle.trim() !== '' ? row.splitterTitle : row.splitterCode,
    distinctMassivas: row.totalTickets,
    openMassivas: row.openTickets,
    usagePercent: row.currentUsagePercent,
    selectedDelta: row.selectedDelta,
    oltLabel: oltLabel(row),
    locationLabel: locationLabel(row),
  }))

  const leaderTickets = sortedByTickets[0]?.totalTickets ?? 0
  const secondTickets = sortedByTickets[1]?.totalTickets ?? 0
  const showBarChart =
    sortedByTickets.length >= 2 && leaderTickets >= 2 && leaderTickets > secondTickets

  const barChartLeaders = showBarChart
    ? sortedByTickets.slice(0, 7).map((row) => ({
        splitterCode: row.splitterCode,
        splitterTitle: row.splitterTitle.trim() !== '' ? row.splitterTitle : row.splitterCode,
        totalTickets: row.totalTickets,
      }))
    : []

  return {
    totalSplittersInScope,
    splittersWithMassiva,
    splittersWithoutMassiva,
    totalMassivaLinkages,
    concentrationTop20Count: top20.length,
    concentrationTop20LinkagesPercent,
    histogram: HISTOGRAM_ORDER.map((bucket) => ({
      bucket,
      label: HISTOGRAM_LABELS[bucket],
      splitters: histCounts[bucket],
    })),
    ranking,
    showBarChart,
    barChartLeaders,
  }
}
