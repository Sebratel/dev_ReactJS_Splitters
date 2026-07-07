import type {
  CancellationBucket,
  CancellationCategory,
  CancellationCategoryCounts,
} from '@/features/cancellations/model/cancellationsSummary'

const EMPTY_MIX: CancellationCategoryCounts = {
  rede: 0,
  tecnico: 0,
  financeiro: 0,
  pre_instalacao: 0,
  mudanca: 0,
  operacional: 0,
  outros: 0,
}

export function sumBucketCategories(
  bucket: Pick<CancellationBucket, CancellationCategory | 'total'>,
  categories: readonly CancellationCategory[],
): number {
  if (categories.length === 0) return bucket.total
  return categories.reduce((sum, cat) => sum + (bucket[cat] ?? 0), 0)
}

export function bucketMatchesCategories(
  bucket: Pick<CancellationBucket, CancellationCategory | 'total'>,
  categories: readonly CancellationCategory[],
): boolean {
  return sumBucketCategories(bucket, categories) > 0
}

export function redeCountForCategories(
  bucket: Pick<CancellationBucket, 'rede'>,
  categories: readonly CancellationCategory[],
): number {
  if (categories.length === 0) return bucket.rede
  return categories.includes('rede') ? bucket.rede : 0
}

export function mixForCategories(
  bucket: CancellationBucket,
  categories: readonly CancellationCategory[],
): CancellationCategoryCounts {
  if (categories.length === 0) {
    return {
      rede: bucket.rede,
      tecnico: bucket.tecnico,
      financeiro: bucket.financeiro,
      pre_instalacao: bucket.pre_instalacao,
      mudanca: bucket.mudanca,
      operacional: bucket.operacional,
      outros: bucket.outros,
    }
  }
  const mix = { ...EMPTY_MIX }
  for (const cat of categories) mix[cat] = bucket[cat] ?? 0
  return mix
}

export function aggregateMix(
  buckets: readonly CancellationBucket[],
  categories: readonly CancellationCategory[],
): CancellationCategoryCounts {
  const mix = { ...EMPTY_MIX }
  for (const b of buckets) {
    const part = mixForCategories(b, categories)
    for (const cat of Object.keys(mix) as CancellationCategory[]) {
      mix[cat] += part[cat]
    }
  }
  return mix
}
