import { useEffect, useState } from 'react'

/**
 * `matches` atualiza quando a media query cruza o breakpoint (resize / orientação).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = () => setMatches(mql.matches)
    mql.addEventListener('change', handler)
    handler()
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
