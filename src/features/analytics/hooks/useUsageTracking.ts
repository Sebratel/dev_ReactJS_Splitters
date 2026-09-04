import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { resolveModuleFromPath } from '@/features/analytics/lib/resolveModuleFromPath'
import { setUsageContext } from '@/features/analytics/lib/usageContext'
import { trackUsageEvents } from '@/features/analytics/api/trackUsageEvent'

/** Duração máxima creditada a uma página (evita inflar com aba ociosa). */
const MAX_PAGE_DURATION_MS = 2 * 60 * 60 * 1000
const SESSION_KEY = 'splitters.usage.sessionId'

function getSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing && existing.trim() !== '') return existing
    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    window.sessionStorage.setItem(SESSION_KEY, fresh)
    return fresh
  } catch {
    return `s_${Date.now().toString(36)}`
  }
}

type PageState = { path: string; module: string; enteredAt: number; referrer: string | null; flushed: boolean }

/**
 * Registra os acessos aos módulos da plataforma (pageview + duração aproximada).
 * Um evento é emitido ao SAIR de cada página (com a duração real) e também ao
 * fechar/ocultar a aba (keepalive), para não perder a última tela. Best-effort:
 * qualquer falha é silenciosa e nunca afeta a navegação.
 */
export function useUsageTracking(): void {
  const { pathname } = useLocation()
  const currentRef = useRef<PageState | null>(null)
  const sessionIdRef = useRef<string>('')
  if (sessionIdRef.current === '') sessionIdRef.current = getSessionId()

  // Emite o evento da página atual (ao trocar de rota ou ao ocultar a aba).
  const flushCurrent = (keepalive: boolean) => {
    const page = currentRef.current
    if (!page || page.flushed) return
    page.flushed = true
    const durationMs = Math.min(MAX_PAGE_DURATION_MS, Math.max(0, Date.now() - page.enteredAt))
    trackUsageEvents(
      [
        {
          module: page.module as never,
          path: page.path,
          eventType: 'pageview',
          sessionId: sessionIdRef.current,
          durationMs,
          referrerPath: page.referrer,
        },
      ],
      { keepalive },
    )
  }

  // Troca de rota: fecha a página anterior e abre a nova.
  useEffect(() => {
    const previousPath = currentRef.current?.path ?? null
    flushCurrent(false)
    const nextModule = resolveModuleFromPath(pathname)
    currentRef.current = {
      path: pathname,
      module: nextModule,
      enteredAt: Date.now(),
      referrer: previousPath,
      flushed: false,
    }
    // Expõe o contexto atual para trackUsageAction() disparar de qualquer handler.
    setUsageContext({ module: nextModule, path: pathname, sessionId: sessionIdRef.current })
  }, [pathname])

  // Fechar/ocultar a aba: garante o envio do último acesso.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushCurrent(true)
    }
    const onPageHide = () => flushCurrent(true)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [])
}
