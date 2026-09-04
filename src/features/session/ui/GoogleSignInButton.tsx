import { useState } from 'react'
import {
  beginGoogleLoginRedirect,
  clearInteractiveLoginFailure,
} from '@/features/session/lib/googleIdentity'

export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null)

  const handleClick = () => {
    try {
      setError(null)
      clearInteractiveLoginFailure()
      beginGoogleLoginRedirect()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Falha ao iniciar login com Google.'
      setError(message)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Entrar com Google
      </button>
      {error ? <p className="text-center text-xs text-red-600 dark:text-red-300">{error}</p> : null}
    </div>
  )
}
