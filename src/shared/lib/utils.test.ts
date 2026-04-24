import { describe, expect, it } from 'vitest'
import { cn } from '@/shared/lib/utils'

describe('cn', () => {
  it('mescla classes e resolve conflitos do tailwind-merge', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('ignora valores falsy', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })
})
