import type { SplitterOperationalScore } from '@/features/splitters/model/splitterOperationalInsights'

export function scoreToneClassName(tone: SplitterOperationalScore['tone']): string {
  switch (tone) {
    case 'critical':
      return 'border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-200'
    case 'attention':
      return 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-200'
    default:
      return 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-200'
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
