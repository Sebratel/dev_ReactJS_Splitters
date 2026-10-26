import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type GmudFlowchartOrigin = 'ai' | 'manual' | 'imported'
export type GmudFlowchartReviewStatus = 'draft' | 'reviewed'

export type GmudFlowchart = {
  id: number
  voalleProtocol: number
  mermaidSource: string
  version: number
  origin: GmudFlowchartOrigin
  reviewStatus: GmudFlowchartReviewStatus
  aiModel: string | null
  aiWarnings: string[]
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

async function parse<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    const message = (result && typeof result.message === 'string' && result.message) || fallback
    const error = new Error(message) as Error & { statusCode?: number }
    error.statusCode = response.status
    throw error
  }
  return result.data as T
}

export async function fetchGmudFlowchart(protocol: number): Promise<GmudFlowchart | null> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/${protocol}/flowchart`)
  const data = await parse<GmudFlowchart | null>(response, 'Falha ao carregar o fluxograma.')
  return data
}

export async function generateGmudFlowchartWithAI(
  protocol: number,
  description: string,
  gmudContext?: string,
): Promise<{ flowchart: GmudFlowchart; warnings: string[] }> {
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/gmud/${protocol}/flowchart/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, gmudContext: gmudContext ?? '' }),
    },
  )
  return parse<{ flowchart: GmudFlowchart; warnings: string[] }>(response, 'Falha ao gerar o fluxograma com IA.')
}

export async function saveGmudFlowchart(
  protocol: number,
  mermaidSource: string,
  options?: { origin?: GmudFlowchartOrigin; reviewStatus?: GmudFlowchartReviewStatus },
): Promise<GmudFlowchart> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/${protocol}/flowchart`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mermaidSource,
      origin: options?.origin ?? 'manual',
      reviewStatus: options?.reviewStatus ?? 'draft',
    }),
  })
  return parse<GmudFlowchart>(response, 'Falha ao salvar o fluxograma.')
}

export async function deleteGmudFlowchart(protocol: number): Promise<void> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/${protocol}/flowchart`, {
    method: 'DELETE',
  })
  await parse<unknown>(response, 'Falha ao remover o fluxograma.')
}

export type AssistType = 'checklist' | 'risks' | 'summary'

export async function assistGmudFlowchart(
  protocol: number,
  type: AssistType,
  description: string,
  gmudContext?: string,
): Promise<{ result: Record<string, unknown>; model: string; type: AssistType; generatedByAI: true }> {
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/gmud/${protocol}/flowchart/assist`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, description, gmudContext: gmudContext ?? '' }),
    },
  )
  return parse(response, 'Falha na assistência de IA.')
}
