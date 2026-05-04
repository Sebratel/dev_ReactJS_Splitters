import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * Evita overflow horizontal em grelhas flex; use no conteúdo da página quando necessário.
 */
export function ResponsiveWrapper({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('min-w-0 max-w-full', className)}>{children}</div>
}
