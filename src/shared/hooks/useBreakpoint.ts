import { BREAKPOINT_PX } from '@/shared/lib/breakpoints'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'

export type BreakpointSnapshot = {
  /** &lt; 768px */
  isMobile: boolean
  /** 768px – 1023px */
  isTablet: boolean
  /** 1024px – 1279px */
  isNotebook: boolean
  /** ≥ 1280px — layout desktop “completo” (sidebar fixa como hoje) */
  isDesktop: boolean
  isMd: boolean
  isLg: boolean
  isXl: boolean
}

/**
 * Snapshots estáveis para reorganizar layout sem depender só de classes Tailwind.
 */
export function useBreakpoint(): BreakpointSnapshot {
  const isMd = useMediaQuery(`(min-width: ${BREAKPOINT_PX.md}px)`)
  const isLg = useMediaQuery(`(min-width: ${BREAKPOINT_PX.lg}px)`)
  const isXl = useMediaQuery(`(min-width: ${BREAKPOINT_PX.xl}px)`)

  return {
    isMobile: !isMd,
    isTablet: isMd && !isLg,
    isNotebook: isLg && !isXl,
    isDesktop: isXl,
    isMd,
    isLg,
    isXl,
  }
}
