import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const fetchWithSessionAuth = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()

vi.mock('@/shared/api/fetchWithSessionAuth', () => ({
  fetchWithSessionAuth: (url: string, init?: RequestInit) => fetchWithSessionAuth(url, init),
}))

const { useGmudList } = await import('@/features/gmud/hooks/useGmudList')
const { useGmudReuniaoSemanal } = await import('@/features/gmud/api/gmudReuniaoSemanal')
const { semanasDaReuniao } = await import('@/features/gmud/lib/gmudReuniaoSemana')

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

/** Resposta que só chega quando o teste mandar. */
function pendente() {
  let liberar: (r: Response) => void = () => {}
  const promise = new Promise<Response>((resolve) => {
    liberar = resolve
  })
  return { promise, liberar }
}

describe('consultas do módulo de GMUD mantêm o dado anterior ao trocar a chave', () => {
  beforeEach(() => {
    fetchWithSessionAuth.mockReset()
  })

  it('reunião semanal: ao trocar de semana, a anterior continua na tela até a nova chegar', async () => {
    const semanaA = { feito: [{ protocolo: 1 }], vem: [] }
    const semanaB = { feito: [], vem: [{ protocolo: 2 }] }
    fetchWithSessionAuth.mockResolvedValueOnce(json({ success: true, data: semanaA }))
    const { result, rerender } = renderHook(({ segunda }: { segunda: string }) => useGmudReuniaoSemanal(semanasDaReuniao(segunda)), {
      wrapper: wrapper(),
      initialProps: { segunda: '2026-11-09' },
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(semanaA)
    expect(result.current.isPlaceholderData).toBe(false)

    const espera = pendente()
    fetchWithSessionAuth.mockReturnValueOnce(espera.promise)
    rerender({ segunda: '2026-11-16' })
    // Carregando a semana nova: nada de "sumir e reaparecer".
    expect(result.current.data).toEqual(semanaA)
    expect(result.current.isPlaceholderData).toBe(true)
    expect(result.current.isLoading).toBe(false)

    espera.liberar(json({ success: true, data: semanaB }))
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false))
    expect(result.current.data).toEqual(semanaB)
    expect(String(fetchWithSessionAuth.mock.calls[1]?.[0])).toContain('feitoDe=2026-11-16')
  })

  it('lista: ao trocar o filtro, a lista anterior continua na tela até a nova chegar', async () => {
    const pagina = (protocol: number) => ({ items: [{ protocol }], total: 1, limit: 20, offset: 0 })
    fetchWithSessionAuth.mockResolvedValueOnce(json({ success: true, data: pagina(1) }))
    const { result, rerender } = renderHook(
      ({ tipo }: { tipo: 'todos' | 'emergencial' }) => useGmudList({ limit: 20, offset: 0, tipo }),
      { wrapper: wrapper(), initialProps: { tipo: 'todos' as 'todos' | 'emergencial' } },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items[0]?.protocol).toBe(1)

    const espera = pendente()
    fetchWithSessionAuth.mockReturnValueOnce(espera.promise)
    rerender({ tipo: 'emergencial' })
    expect(result.current.data?.items[0]?.protocol).toBe(1)
    expect(result.current.isPlaceholderData).toBe(true)
    expect(result.current.isLoading).toBe(false)

    espera.liberar(json({ success: true, data: pagina(2) }))
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false))
    expect(result.current.data?.items[0]?.protocol).toBe(2)
  })
})
