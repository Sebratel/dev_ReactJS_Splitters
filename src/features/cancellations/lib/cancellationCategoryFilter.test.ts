import { describe, expect, it } from 'vitest'
import {
  aggregateMix,
  bucketMatchesCategories,
  mixForCategories,
  redeCountForCategories,
  sumBucketCategories,
} from '@/features/cancellations/lib/cancellationCategoryFilter'
import type { CancellationBucket } from '@/features/cancellations/model/cancellationsSummary'

const bucket: CancellationBucket = {
  key: 'SPL-1',
  total: 10,
  rede: 4,
  tecnico: 1,
  financeiro: 3,
  pre_instalacao: 0,
  mudanca: 1,
  operacional: 1,
  outros: 0,
}

describe('cancellationCategoryFilter', () => {
  it('returns full total when no categories selected', () => {
    expect(sumBucketCategories(bucket, [])).toBe(10)
    expect(redeCountForCategories(bucket, [])).toBe(4)
    expect(bucketMatchesCategories(bucket, [])).toBe(true)
  })

  it('sums only selected categories', () => {
    expect(sumBucketCategories(bucket, ['financeiro', 'mudanca'])).toBe(4)
    expect(redeCountForCategories(bucket, ['financeiro'])).toBe(0)
    expect(redeCountForCategories(bucket, ['rede', 'financeiro'])).toBe(4)
    expect(bucketMatchesCategories(bucket, ['tecnico'])).toBe(true)
    expect(bucketMatchesCategories({ ...bucket, tecnico: 0 }, ['tecnico'])).toBe(false)
  })

  it('builds mix for selected categories', () => {
    expect(mixForCategories(bucket, ['financeiro'])).toEqual({
      rede: 0,
      tecnico: 0,
      financeiro: 3,
      pre_instalacao: 0,
      mudanca: 0,
      operacional: 0,
      outros: 0,
    })
  })

  it('aggregates mix across buckets', () => {
    const other: CancellationBucket = { ...bucket, key: 'SPL-2', financeiro: 2, total: 6 }
    const mix = aggregateMix([bucket, other], ['financeiro', 'rede'])
    expect(mix.financeiro).toBe(5)
    expect(mix.rede).toBe(8)
  })
})
