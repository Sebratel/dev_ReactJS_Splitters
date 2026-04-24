import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  readHashParam,
  readQueryParam,
  stripHashParams,
  stripQueryParams,
} from '@/features/session/lib/urlParams'

describe('urlParams', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('readQueryParam e readHashParam', () => {
    vi.stubGlobal('window', {
      location: {
        search: '?x=1&y=  ',
        hash: '#a=2&b=3',
      },
    } as Window & typeof globalThis)
    expect(readQueryParam('x')).toBe('1')
    expect(readQueryParam('y')).toBeNull()
    expect(readHashParam('a')).toBe('2')
  })

  it('stripQueryParams e stripHashParams', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      location: {
        href: 'https://app.example/p?q=1#x=2',
        pathname: '/p',
        search: '?q=1',
        hash: '#x=2',
      },
      history: { replaceState },
    } as Window & typeof globalThis)
    stripQueryParams('q')
    expect(replaceState).toHaveBeenCalled()
    replaceState.mockClear()
    vi.stubGlobal('window', {
      location: {
        href: 'https://app.example/p#a=1&b=2',
        pathname: '/p',
        search: '',
        hash: '#a=1&b=2',
      },
      history: { replaceState },
    } as Window & typeof globalThis)
    stripHashParams('a')
    expect(replaceState).toHaveBeenCalled()
  })
})
