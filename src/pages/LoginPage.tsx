import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ModernLoginScreen,
  parseLoginBackgroundVariant,
} from '@/features/access/ui/login/ModernLoginScreen'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { env, isFirebaseAuthConfigured } from '@/shared/config/env'

function loginBackgroundFromEnv(): string {
  const v = import.meta.env.VITE_LOGIN_BACKGROUND
  return typeof v === 'string' ? v.trim() : ''
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const initialize = useAccessAuthStore((s) => s.initialize)
  const status = useAccessAuthStore((s) => s.status)
  const error = useAccessAuthStore((s) => s.error)
  const signInWithGoogle = useAccessAuthStore((s) => s.signInWithGoogle)
  const navigateTimerRef = useRef<number | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const bgVariant = useMemo(() => {
    const fromQuery = searchParams.get('bg')
    return parseLoginBackgroundVariant(fromQuery ?? loginBackgroundFromEnv())
  }, [searchParams])

  const domainPill = useMemo(() => {
    const d = env.accessAllowedEmailDomain.trim()
    if (d === '') return null
    return d.startsWith('@') ? d : `@${d}`
  }, [])

  const emailsWhitelistLabel = useMemo(() => {
    if (domainPill != null) return null
    if (env.accessAllowedEmails.length === 0) return null
    return env.accessAllowedEmails.join(', ')
  }, [domainPill])

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (status !== 'authenticated') return
    const id = window.setTimeout(() => {
      const target = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(target, { replace: true })
    }, 360)
    navigateTimerRef.current = id
    return () => {
      if (navigateTimerRef.current !== null) {
        window.clearTimeout(navigateTimerRef.current)
        navigateTimerRef.current = null
      }
    }
  }, [status, navigate, location.state])

  const handleGoogleSignIn = async () => {
    setLocalError(null)
    setSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (submitError) {
      setLocalError(submitError instanceof Error ? submitError.message : 'Falha ao autenticar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isFirebaseAuthConfigured()) {
    return (
      <div className="mx-auto mt-20 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <h1 className="text-lg font-semibold">Login da Operação Sebratel não configurado</h1>
        <p className="mt-2 text-sm">
          Defina as variáveis <code>VITE_FIREBASE_*</code> no ambiente para ativar autenticação e
          gestão de permissões no Firestore.
        </p>
      </div>
    )
  }

  return (
    <ModernLoginScreen
      backgroundVariant={bgVariant}
      submitting={submitting}
      authBusy={status === 'loading'}
      localError={localError}
      storeError={error}
      onGoogleSignIn={handleGoogleSignIn}
      domainPill={domainPill}
      emailsWhitelistLabel={emailsWhitelistLabel}
      authSuccess={status === 'authenticated'}
    />
  )
}
