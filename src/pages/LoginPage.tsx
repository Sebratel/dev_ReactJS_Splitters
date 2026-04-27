import { FormEvent, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isFirebaseAuthConfigured } from '@/shared/config/env'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialize = useAccessAuthStore((s) => s.initialize)
  const status = useAccessAuthStore((s) => s.status)
  const error = useAccessAuthStore((s) => s.error)
  const signIn = useAccessAuthStore((s) => s.signIn)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (status === 'authenticated') {
      const target = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(target, { replace: true })
    }
  }, [status, navigate, location.state])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError(null)
    setSubmitting(true)

    try {
      await signIn(email, password)
    } catch (submitError) {
      setLocalError(submitError instanceof Error ? submitError.message : 'Falha ao autenticar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isFirebaseAuthConfigured()) {
    return (
      <div className="mx-auto mt-20 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <h1 className="text-lg font-semibold">Login do Splitters não configurado</h1>
        <p className="mt-2 text-sm">
          Defina as variáveis <code>VITE_FIREBASE_*</code> no ambiente para ativar autenticação e gestão de permissões no Firestore.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md items-center">
      <div className="w-full rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Splitters</p>
          <h1 className="mt-1 text-xl font-semibold text-neutral-900">Acessar plataforma</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Login de usuário para controle de permissões por módulo.
          </p>
        </div>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </label>

          {(localError || error) ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {localError ?? error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || status === 'loading'}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {submitting || status === 'loading' ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
