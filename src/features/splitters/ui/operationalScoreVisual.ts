import type { SplitterOperationalScore } from '@/features/splitters/model/splitterOperationalInsights'

export function scoreToneClassName(tone: SplitterOperationalScore['tone']): string {
  switch (tone) {
    case 'critical':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case 'attention':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
}

export function scoreDotToneClassName(tone: SplitterOperationalScore['tone']): string {
  switch (tone) {
    case 'critical':
      return 'bg-rose-500'
    case 'attention':
      return 'bg-amber-500'
    default:
      return 'bg-emerald-500'
  }
}

export function criticalityDotsFromScore(score: number): number {
  const clampedScore = Math.min(100, Math.max(0, score))
  return Math.max(1, Math.ceil(clampedScore / 20))
}
