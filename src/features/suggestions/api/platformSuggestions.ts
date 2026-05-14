import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { firebaseAuth } from '@/shared/config/firebase'
import { env } from '@/shared/config/env'

export type PlatformSuggestionVoteType = 'like' | 'dislike'
export type PlatformSuggestionStatus = 'open' | 'planned' | 'in_progress' | 'done' | 'rejected'

export type PlatformSuggestionUserSummary = {
  uid: string
  email: string
  name: string
  photoURL: string | null
}

export type PlatformSuggestionComment = {
  id: number
  suggestionId: number
  author: PlatformSuggestionUserSummary
  message: string
  createdAt: string | null
  updatedAt: string | null
}

export type PlatformSuggestion = {
  id: number
  title: string
  description: string
  sector: string
  category: string | null
  status: PlatformSuggestionStatus
  authorUid: string
  authorEmail: string
  authorName: string
  authorPhotoURL: string | null
  likesCount: number
  dislikesCount: number
  commentsCount: number
  score: number
  viewerVote: PlatformSuggestionVoteType | null
  supporters: PlatformSuggestionUserSummary[]
  comments: PlatformSuggestionComment[]
  createdAt: string | null
  updatedAt: string | null
}

function toCleanString(value: unknown): string {
  return String(value ?? '').trim()
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeVoteType(value: unknown): PlatformSuggestionVoteType | null {
  const raw = toCleanString(value).toLowerCase()
  if (raw === 'like') return 'like'
  if (raw === 'dislike') return 'dislike'
  return null
}

function normalizeStatus(value: unknown): PlatformSuggestionStatus {
  const raw = toCleanString(value).toLowerCase()
  if (raw === 'planned') return 'planned'
  if (raw === 'in_progress') return 'in_progress'
  if (raw === 'done') return 'done'
  if (raw === 'rejected') return 'rejected'
  return 'open'
}

function normalizeUserSummary(raw: unknown): PlatformSuggestionUserSummary | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const uid = toCleanString(row.uid)
  const email = toCleanString(row.email).toLowerCase()
  const name = toCleanString(row.name)
  if (!uid && !email && !name) return null
  return {
    uid,
    email,
    name,
    photoURL: toCleanString(row.photoURL) || null,
  }
}

function normalizeComment(raw: unknown): PlatformSuggestionComment | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = Math.trunc(toFiniteNumber(row.id, Number.NaN))
  const suggestionId = Math.trunc(toFiniteNumber(row.suggestionId, Number.NaN))
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(suggestionId) || suggestionId <= 0) {
    return null
  }
  const author = normalizeUserSummary(row.author)
  if (!author) return null
  return {
    id,
    suggestionId,
    author,
    message: toCleanString(row.message),
    createdAt: toCleanString(row.createdAt) || null,
    updatedAt: toCleanString(row.updatedAt) || null,
  }
}

function normalizeSuggestion(raw: unknown): PlatformSuggestion | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = Math.trunc(toFiniteNumber(row.id, Number.NaN))
  if (!Number.isFinite(id) || id <= 0) return null

  const supporters = Array.isArray(row.supporters)
    ? row.supporters
        .map((item) => normalizeUserSummary(item))
        .filter((item): item is PlatformSuggestionUserSummary => item != null)
    : []
  const comments = Array.isArray(row.comments)
    ? row.comments
        .map((item) => normalizeComment(item))
        .filter((item): item is PlatformSuggestionComment => item != null)
    : []

  return {
    id,
    title: toCleanString(row.title),
    description: toCleanString(row.description),
    sector: toCleanString(row.sector),
    category: toCleanString(row.category) || null,
    status: normalizeStatus(row.status),
    authorUid: toCleanString(row.authorUid),
    authorEmail: toCleanString(row.authorEmail).toLowerCase(),
    authorName: toCleanString(row.authorName),
    authorPhotoURL: toCleanString(row.authorPhotoURL) || null,
    likesCount: Math.max(0, Math.trunc(toFiniteNumber(row.likesCount))),
    dislikesCount: Math.max(0, Math.trunc(toFiniteNumber(row.dislikesCount))),
    commentsCount: Math.max(
      comments.length,
      Math.trunc(toFiniteNumber(row.commentsCount)),
    ),
    score: Math.trunc(toFiniteNumber(row.score)),
    viewerVote: normalizeVoteType(row.viewerVote),
    supporters,
    comments,
    createdAt: toCleanString(row.createdAt) || null,
    updatedAt: toCleanString(row.updatedAt) || null,
  }
}

async function buildLocalBffHeaders(): Promise<Headers> {
  const headers = new Headers({
    'Content-Type': 'application/json;charset=UTF-8',
    Accept: 'application/json',
  })

  try {
    const firebaseToken = await firebaseAuth?.currentUser?.getIdToken()
    if (typeof firebaseToken === 'string' && firebaseToken.trim() !== '') {
      headers.set('Authorization', `Bearer ${firebaseToken.trim()}`)
    }
  } catch {
    // fallback para sessão/oidc já aplicada em fetchWithSessionAuth
  }

  return headers
}

async function requestSuggestionsApi<T>(
  path: string,
  init?: RequestInit,
  fallbackMessage?: string,
): Promise<T> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}${path}`, {
    ...init,
    headers: init?.headers ?? (await buildLocalBffHeaders()),
  })

  const payload = await response.json().catch(() => null)
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}

  if (!response.ok || root.success !== true) {
    throw new Error(toCleanString(root.message) || fallbackMessage || `HTTP ${response.status}`)
  }

  return root.data as T
}

function normalizeSuggestionResponse(row: unknown, fallbackMessage: string): PlatformSuggestion {
  const suggestion = normalizeSuggestion(row)
  if (!suggestion) throw new Error(fallbackMessage)
  return suggestion
}

export async function fetchPlatformSuggestions(): Promise<PlatformSuggestion[]> {
  const rows = await requestSuggestionsApi<unknown[]>(
    '/api/platform-suggestions',
    {
      method: 'GET',
      headers: await buildLocalBffHeaders(),
    },
    'Falha ao carregar sugestoes da plataforma.',
  )

  return Array.isArray(rows)
    ? rows
        .map((row) => normalizeSuggestion(row))
        .filter((row): row is PlatformSuggestion => row != null)
    : []
}

export async function createPlatformSuggestion(input: {
  title: string
  description: string
  sector: string
  category?: string
}): Promise<PlatformSuggestion> {
  const row = await requestSuggestionsApi<unknown>(
    '/api/platform-suggestions',
    {
      method: 'POST',
      headers: await buildLocalBffHeaders(),
      body: JSON.stringify(input),
    },
    'Falha ao criar sugestao da plataforma.',
  )
  return normalizeSuggestionResponse(row, 'Resposta invalida ao criar a sugestao.')
}

export async function votePlatformSuggestion(input: {
  suggestionId: number
  voteType: PlatformSuggestionVoteType | 'none'
}): Promise<PlatformSuggestion> {
  const row = await requestSuggestionsApi<unknown>(
    `/api/platform-suggestions/${input.suggestionId}/vote`,
    {
      method: 'POST',
      headers: await buildLocalBffHeaders(),
      body: JSON.stringify({ voteType: input.voteType }),
    },
    'Falha ao registrar voto na sugestao.',
  )
  return normalizeSuggestionResponse(row, 'Resposta invalida ao registrar o voto.')
}

export async function commentPlatformSuggestion(input: {
  suggestionId: number
  message: string
}): Promise<PlatformSuggestion> {
  const row = await requestSuggestionsApi<unknown>(
    `/api/platform-suggestions/${input.suggestionId}/comments`,
    {
      method: 'POST',
      headers: await buildLocalBffHeaders(),
      body: JSON.stringify({ message: input.message }),
    },
    'Falha ao registrar comentario na sugestao.',
  )
  return normalizeSuggestionResponse(row, 'Resposta invalida ao comentar a sugestao.')
}

export async function updatePlatformSuggestionStatus(input: {
  suggestionId: number
  status: PlatformSuggestionStatus
}): Promise<PlatformSuggestion> {
  const row = await requestSuggestionsApi<unknown>(
    `/api/platform-suggestions/${input.suggestionId}/status`,
    {
      method: 'PATCH',
      headers: await buildLocalBffHeaders(),
      body: JSON.stringify({ status: input.status }),
    },
    'Falha ao atualizar o status da sugestao.',
  )
  return normalizeSuggestionResponse(row, 'Resposta invalida ao atualizar o status da sugestao.')
}
