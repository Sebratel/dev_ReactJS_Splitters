/**
 * Faixas visuais de ocupação (somente UI): 0–25%, 26–60%, 61%+.
 */
export type OccupancyVisualTone = {
  bar: string
  barGlow: string
  text: string
  track: string
}

export function getOccupancyVisualTone(usagePercent: number): OccupancyVisualTone {
  const p = Math.min(100, Math.max(0, usagePercent))

  if (p <= 25) {
    return {
      bar: 'bg-emerald-500',
      barGlow: 'shadow-[0_0_0_1px_rgba(16,185,129,0.35)]',
      text: 'text-emerald-700',
      track: 'bg-emerald-500/15',
    }
  }

  if (p <= 60) {
    return {
      bar: 'bg-amber-500',
      barGlow: 'shadow-[0_0_0_1px_rgba(245,158,11,0.4)]',
      text: 'text-amber-800',
      track: 'bg-amber-500/15',
    }
  }

  if (p <= 84) {
    return {
      bar: 'bg-orange-600',
      barGlow: 'shadow-[0_0_0_1px_rgba(234,88,12,0.35)]',
      text: 'text-orange-800',
      track: 'bg-orange-500/15',
    }
  }

  return {
    bar: 'bg-red-600',
    barGlow: 'shadow-[0_0_0_1px_rgba(220,38,38,0.35)]',
    text: 'text-red-700',
    track: 'bg-red-500/15',
  }
}
