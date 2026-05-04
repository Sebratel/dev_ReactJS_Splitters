/**
 * Alinhado ao Tailwind (`screens`): mobile-first.
 * Desktop “cheio” = `xl` (1280px), conforme pedido do produto.
 */
export const BREAKPOINT_PX = {
  /** Mobile / base */
  md: 768,
  /** Tablet → */
  lg: 1024,
  /** Notebook → … */
  xl: 1280,
  /** Desktop largo */
  '2xl': 1536,
} as const

export type BreakpointName = keyof typeof BREAKPOINT_PX
