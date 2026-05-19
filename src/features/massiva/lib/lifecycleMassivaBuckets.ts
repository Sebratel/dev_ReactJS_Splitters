export type LifecycleBucketKey = '0-1' | '1-3' | '3-5' | '5+'

export type MassivaPeriodSplitterLink = {
  massivaHistoryId: number
  splitterCodes: readonly string[]
}

export function toLifecycleBucket(ageYears: number): LifecycleBucketKey {
  if (ageYears < 1) return '0-1'
  if (ageYears < 3) return '1-3'
  if (ageYears < 5) return '3-5'
  return '5+'
}

/**
 * Conta massivas distintas por faixa etária: a ocorrência entra na faixa se algum splitter
 * vinculado (e presente no mapa de idade) pertence àquela faixa.
 */
export function countDistinctMassivasByLifecycleBucket(
  links: readonly MassivaPeriodSplitterLink[],
  splitterCodeToBucket: ReadonlyMap<string, LifecycleBucketKey>,
): Record<LifecycleBucketKey, number> {
  const bucketOrder: LifecycleBucketKey[] = ['0-1', '1-3', '3-5', '5+']
  const sets = Object.fromEntries(
    bucketOrder.map((bucket) => [bucket, new Set<number>()]),
  ) as Record<LifecycleBucketKey, Set<number>>

  for (const link of links) {
    const bucketsForMassiva = new Set<LifecycleBucketKey>()
    for (const rawCode of link.splitterCodes) {
      const code = String(rawCode ?? '').trim()
      if (code === '') continue
      const bucket = splitterCodeToBucket.get(code)
      if (bucket) bucketsForMassiva.add(bucket)
    }
    for (const bucket of bucketsForMassiva) {
      sets[bucket].add(link.massivaHistoryId)
    }
  }

  return Object.fromEntries(
    bucketOrder.map((bucket) => [bucket, sets[bucket].size]),
  ) as Record<LifecycleBucketKey, number>
}
