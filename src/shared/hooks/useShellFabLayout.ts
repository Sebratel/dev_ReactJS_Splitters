import { useLayoutEffect, useState, type CSSProperties } from 'react'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { BREAKPOINT_PX } from '@/shared/lib/breakpoints'

export type ShellFabLayoutOptions = {
  /** Eleva o FAB em relação ao cálculo base (útil quando um ecrã precisa alinhar com outro FAB). */
  translateUpPx?: number
}

function applyTranslateUp(style: CSSProperties, translateUpPx: number): CSSProperties {
  const px = Math.max(0, translateUpPx)
  if (!px) return style
  const lift = `translateY(-${px}px)`
  const existing = typeof style.transform === 'string' ? style.transform.trim() : ''
  const transform =
    !existing || existing === 'none' ? lift : `${existing} ${lift}`
  return { ...style, transform }
}

/**
 * Posição do FAB fixo alinhada à shell (sidebar + safe areas), igual em Splitters e Dashboard.
 * Dock em `#splitters-sidebar-fab-dock` em qualquer desktop (xl+) com sidebar expandida,
 * para o FAB ficar no mesmo nível vertical em monitores largos (antes o dock não valia a partir de 2xl).
 */
export function useShellFabLayout(sidebarCollapsed: boolean, options?: ShellFabLayoutOptions) {
  const translateUpPx = Math.max(0, options?.translateUpPx ?? 0)
  const isDesktopLayout = useMediaQuery(`(min-width: ${BREAKPOINT_PX.xl}px)`)

  const shouldLowerFabForNotebookSidebar = isDesktopLayout && !sidebarCollapsed

  const [sidebarDockMetrics, setSidebarDockMetrics] = useState<{
    centerX: number
    bottomOffset: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!shouldLowerFabForNotebookSidebar) {
      setSidebarDockMetrics(null)
      return
    }

    let pendingRaf = 0
    let deferredMeasureTimer = 0

    const measure = () => {
      const dock = document.getElementById('splitters-sidebar-fab-dock')
      if (!dock) {
        setSidebarDockMetrics(null)
        return
      }

      const rect = dock.getBoundingClientRect()
      /** Evita ficar com `centerX` antigo antes do próximo layout (ex.: transição da sidebar). */
      if (rect.width < 2 || rect.height < 2) {
        setSidebarDockMetrics(null)
        return
      }

      setSidebarDockMetrics({
        centerX: rect.left + rect.width / 2,
        bottomOffset: Math.max(12, window.innerHeight - rect.bottom),
      })
    }

    const scheduleMeasureNextFrame = () => {
      cancelAnimationFrame(pendingRaf)
      pendingRaf = requestAnimationFrame(measure)
    }

    const dockEl = document.getElementById('splitters-sidebar-fab-dock')
    const asideEl = document.getElementById('splitters-app-sidebar')

    measure()
    scheduleMeasureNextFrame()

    const ro = new ResizeObserver(scheduleMeasureNextFrame)
    if (dockEl) ro.observe(dockEl)
    if (asideEl) ro.observe(asideEl)

    const onResize = () => measure()
    window.addEventListener('resize', onResize)

    /** Sidebar usa `transition-[width,padding,...] duration-500` — atualiza no fim e entre frames via RO */
    const onAsideTransitionEnd = (e: TransitionEvent) => {
      if (e.target !== asideEl) return
      if (e.propertyName !== 'width' && e.propertyName !== 'padding') return
      scheduleMeasureNextFrame()
    }
    asideEl?.addEventListener('transitionend', onAsideTransitionEnd)

    deferredMeasureTimer = window.setTimeout(scheduleMeasureNextFrame, 560)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
      asideEl?.removeEventListener('transitionend', onAsideTransitionEnd)
      window.clearTimeout(deferredMeasureTimer)
      cancelAnimationFrame(pendingRaf)
    }
  }, [shouldLowerFabForNotebookSidebar])

  const isDockedOnSidebar = shouldLowerFabForNotebookSidebar && sidebarDockMetrics !== null

  const fabPositionStyle: CSSProperties = applyTranslateUp(
    (() => {
      if (isDockedOnSidebar && sidebarDockMetrics) {
        return {
          left: `${sidebarDockMetrics.centerX}px`,
          right: 'auto',
          top: 'auto',
          bottom: `${sidebarDockMetrics.bottomOffset}px`,
          transform: 'translateX(-50%)',
        }
      }

      if (isDesktopLayout) {
        return {
          left: sidebarCollapsed
            ? 'max(2.15rem, calc(env(safe-area-inset-left) + 1rem))'
            : 'max(8.15rem, calc(env(safe-area-inset-left) + 7rem))',
          right: 'auto',
          top: 'auto',
          bottom: 'max(0.75rem, calc(env(safe-area-inset-bottom) + 1rem))',
          transform: 'none',
        }
      }

      return {
        left: 'auto',
        right: 'max(1rem, calc(env(safe-area-inset-right) + 0.85rem))',
        top: 'auto',
        bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 3.25rem))',
        transform: 'none',
      }
    })(),
    translateUpPx,
  )

  return {
    fabPositionStyle,
    isDockedOnSidebar,
    isDesktopLayout,
    sidebarDockCenterX: sidebarDockMetrics?.centerX ?? null,
  }
}
