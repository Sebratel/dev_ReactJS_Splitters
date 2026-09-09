import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

/**
 * Tela de erro de rota — substitui o "Unexpected Application Error" cru do React Router.
 * Trata dois casos: 404 (rota inexistente) e erro genérico (inclui falha de carregamento
 * de chunk após um novo deploy, onde recarregar resolve).
 */
export function RouteErrorBoundary() {
  const error = useRouteError()
  // Sem objeto de erro = renderizado como catch-all (rota inexistente) → tratar como 404.
  const is404 = !error || (isRouteErrorResponse(error) && error.status === 404)

  const message = is404
    ? 'A página que você tentou acessar não existe ou foi movida.'
    : 'Ocorreu um erro inesperado ao carregar esta página. Se você acabou de atualizar o sistema, recarregar costuma resolver.'

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-surface px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300">
        <AlertTriangle className="size-8" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight text-on-surface">
          {is404 ? 'Página não encontrada' : 'Algo deu errado'}
        </h1>
        <p className="mx-auto max-w-md text-sm text-on-surface-variant">{message}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary/90"
        >
          <Home className="size-4" />
          Voltar ao início
        </Link>
        {!is404 && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-white/10 px-5 py-2.5 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-low"
          >
            <RefreshCw className="size-4" />
            Recarregar
          </button>
        )}
      </div>
    </div>
  )
}
