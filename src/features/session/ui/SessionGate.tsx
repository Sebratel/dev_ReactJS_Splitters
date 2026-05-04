import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { GoogleSignInButton } from '@/features/session/ui/GoogleSignInButton'
import { isAuthMockEnabled } from "@/shared/config/env"
import { env, isGoogleIdentityConfigured, isLocalDevHostname } from '@/shared/config/env'
import { useSessionStore } from '@/features/session/store/sessionStore'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type SessionGateProps = {
  children: ReactNode
}

/**
 * Controla o acesso às rotas protegidas baseando-se no status de autenticação.
 */
export function SessionGate({ children }: SessionGateProps) {
  const { t } = useTranslation()
  const status = useSessionStore((s) => s.status)
  const clearSession = useSessionStore((s) => s.clearSession)
  const googleConfigured = isGoogleIdentityConfigured()

  useEffect(() => {
    if (status === 'invalid-session') {
      clearSession()
    }

    if (isAuthMockEnabled()) return
    if (isLocalDevHostname()) return

    if (!googleConfigured && (status === 'invalid-session' || status === 'unauthenticated')) {
      window.location.replace(env.hubOrigin)
    }
  }, [status, clearSession, googleConfigured])

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingState label={t('session.authenticating')} />
      </div>
    )
  }

  if ((!googleConfigured && isLocalDevHostname()) || status === 'authenticated') {
    return <>{children}</>
  }

  if (googleConfigured) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">Sessao necessaria</h1>
          <p className="max-w-md text-sm text-slate-600">
            Entre com sua conta Google para reutilizar o token do usuario nas chamadas do Hub e nas
            APIs de massiva.
          </p>
        </div>
        <GoogleSignInButton />
        <a
          href={env.hubOrigin}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
        >
          {t('session.login_button')}
        </a>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-neutral-500">
      <div className="h-2 w-2 animate-bounce rounded-full bg-violet-500" />
      {t('session.redirecting')}
    </div>
  )
}
