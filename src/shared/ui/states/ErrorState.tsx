type ErrorStateProps = {
  title?: string
  message: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Algo deu errado',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 px-6 py-6 text-left dark:border-red-900 dark:bg-red-950/40"
      role="alert"
    >
      <p className="font-medium text-red-900 dark:text-red-100">{title}</p>
      <p className="mt-2 text-sm text-red-800 dark:text-red-200">{message}</p>
      {onRetry ? (
        <button
          type="button"
          className="mt-4 rounded-md bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-800"
          onClick={onRetry}
        >
          Tentar novamente
        </button>
      ) : null}
    </div>
  )
}
