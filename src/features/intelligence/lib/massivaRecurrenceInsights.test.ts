import { describe, expect, it } from 'vitest'
import { computeMassivaRecurrenceInsights } from '@/features/intelligence/lib/massivaRecurrenceInsights'

function row(
  code: string,
  tickets: number,
  open = 0,
  usage = 50,
): Parameters<typeof computeMassivaRecurrenceInsights>[0][number] {
  return {
    splitterCode: code,
    splitterTitle: code,
    oltCode: 'OLT1',
    oltDescription: 'OLT Test',
    street: 'Rua A',
    cityCadastro: 'Cidade',
    totalTickets: tickets,
    openTickets: open,
    currentUsagePercent: usage,
    selectedDelta: 1,
  }
}

describe('computeMassivaRecurrenceInsights', () => {
  it('builds histogram and concentration', () => {
    const insights = computeMassivaRecurrenceInsights([
      row('A', 0),
      row('B', 1),
      row('C', 4),
      row('D', 4),
      row('E', 10),
    ])
    expect(insights.totalSplittersInScope).toBe(5)
    expect(insights.splittersWithMassiva).toBe(4)
    expect(insights.histogram.find((h) => h.bucket === '0')?.splitters).toBe(1)
    expect(insights.totalMassivaLinkages).toBe(19)
    expect(insights.ranking[0]?.splitterCode).toBe('E')
  })

  it('hides bar chart when top values tie', () => {
    const insights = computeMassivaRecurrenceInsights([
      row('A', 4),
      row('B', 4),
      row('C', 4),
    ])
    expect(insights.showBarChart).toBe(false)
    expect(insights.barChartLeaders).toHaveLength(0)
  })

  it('shows bar chart when leader is ahead', () => {
    const insights = computeMassivaRecurrenceInsights([
      row('A', 6),
      row('B', 4),
      row('C', 2),
    ])
    expect(insights.showBarChart).toBe(true)
    expect(insights.barChartLeaders[0]?.splitterCode).toBe('A')
  })
})
