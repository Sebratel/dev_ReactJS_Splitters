import { describe, expect, it } from 'vitest'
import { resolveAutoIspUrlPath } from '@/features/autoisp/api/autoIspUrl'

describe('resolveAutoIspUrlPath', () => {
  it('extrai path de URL absoluta e normaliza relativo', () => {
    expect(resolveAutoIspUrlPath('https://x.com/a/b?c=1')).toBe('/a/b?c=1')
    expect(resolveAutoIspUrlPath('foo')).toBe('/foo')
    expect(resolveAutoIspUrlPath('/__autoisp/x')).toBe('/__autoisp/x')
  })
})
