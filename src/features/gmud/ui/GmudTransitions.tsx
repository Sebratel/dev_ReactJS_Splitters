import { Suspense } from 'react'
import { cn } from '@/shared/lib/utils'

const BLOCO = 'rounded-2xl border border-neutral-200/90 bg-surface-container-low dark:border-white/15'

/**
 * Esqueleto de página do módulo de GMUD, usado enquanto o código da tela (lazy) carrega: mantém a forma da
 * página (cabeçalho, cartões e bloco principal) em vez de uma tela em branco. Só aparece se a espera passar
 * de ~150 ms (classe gmud-skeleton), para um carregamento rápido não virar uma piscada. Sem animação em laço.
 */
export function GmudPageSkeleton({ variant = 'app' }: { variant?: 'app' | 'publica' }) {
  if (variant === 'publica') {
    return (
      <div role="status" aria-busy="true" className="gmud-skeleton min-h-dvh bg-surface px-4 py-8">
        <span className="sr-only">Carregando…</span>
        <div aria-hidden className="mx-auto w-full max-w-2xl space-y-4">
          <div className={cn(BLOCO, 'h-12 w-64')} />
          <div className={cn(BLOCO, 'h-72')} />
        </div>
      </div>
    )
  }
  return (
    <div role="status" aria-busy="true" className="gmud-skeleton mx-auto min-w-0 max-w-[1480px] space-y-4">
      <span className="sr-only">Carregando…</span>
      <div aria-hidden className="space-y-4">
        <div className={cn(BLOCO, 'h-24')} />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn(BLOCO, 'h-20')} />
          ))}
        </div>
        <div className={cn(BLOCO, 'h-80')} />
      </div>
    </div>
  )
}

/**
 * Envoltório das rotas do módulo de GMUD: enquanto a tela carrega mostra o esqueleto e, quando ela entra,
 * faz a transição de página (fade + 8 px, 200 ms; classe gmud-page-enter). `animate={false}` para telas
 * que já têm a própria entrada (o formulário de nova GMUD).
 */
export function GmudRoute({
  children,
  animate = true,
  variant = 'app',
}: {
  children: React.ReactNode
  animate?: boolean
  variant?: 'app' | 'publica'
}) {
  return <Suspense fallback={<GmudPageSkeleton variant={variant} />}>{animate ? <div className="gmud-page-enter">{children}</div> : children}</Suspense>
}

/**
 * Mantém o conteúdo anterior na tela enquanto o novo carrega (consultas com placeholderData): o conteúdo
 * fica levemente esmaecido, com aria-busy e uma linha fina no topo, sem mudar de altura. Quando os dados
 * chegam, a opacidade volta em 200 ms. `enter` faz um fade curto quando o bloco é montado.
 */
export function GmudBusy({
  busy,
  enter = false,
  className,
  contentClassName,
  children,
}: {
  busy: boolean
  enter?: boolean
  className?: string
  contentClassName?: string
  children: React.ReactNode
}) {
  return (
    <div aria-busy={busy} className={cn('relative', enter ? 'gmud-fade' : '', className)}>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-neutral-900 transition-opacity duration-150 motion-reduce:transition-none dark:bg-white',
          busy ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div className={cn('transition-opacity duration-200 ease-out motion-reduce:transition-none', busy ? 'opacity-60' : 'opacity-100', contentClassName)}>
        {children}
      </div>
      <span role="status" className="sr-only">
        {busy ? 'Atualizando…' : ''}
      </span>
    </div>
  )
}
