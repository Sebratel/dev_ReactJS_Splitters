import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { firebaseAuth } from '@/shared/config/firebase'
import { env } from '@/shared/config/env'

export type IsaPromptConfigSection = {
  key: string
  label: string
  description: string
  value: string
  defaultValue: string
}

export type IsaPromptConfig = {
  source: string
  version: number | null
  updatedAt: string | null
  updatedByUid: string | null
  updatedByEmail: string | null
  responseFormatNote: string
  previewPrompt: string
  sections: IsaPromptConfigSection[]
}

function toCleanString(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeSection(raw: unknown): IsaPromptConfigSection | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const key = toCleanString(row.key)
  if (key === '') return null
  return {
    key,
    label: toCleanString(row.label) || key,
    description: toCleanString(row.description),
    value: String(row.value ?? ''),
    defaultValue: String(row.defaultValue ?? ''),
  }
}

function normalizeConfig(raw: unknown): IsaPromptConfig {
  const payload = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const sections = Array.isArray(payload.sections)
    ? payload.sections
        .map((item) => normalizeSection(item))
        .filter((item): item is IsaPromptConfigSection => item != null)
    : []

  return {
    source: toCleanString(payload.source) || 'fallback',
    version:
      typeof payload.version === 'number' && Number.isFinite(payload.version)
        ? Math.round(payload.version)
        : null,
    updatedAt: toCleanString(payload.updatedAt) || null,
    updatedByUid: toCleanString(payload.updatedByUid) || null,
    updatedByEmail: toCleanString(payload.updatedByEmail) || null,
    responseFormatNote: String(payload.responseFormatNote ?? ''),
    previewPrompt: String(payload.previewPrompt ?? ''),
    sections,
  }
}

async function unwrapIsaPromptConfigResponse(
  path: string,
  method: 'GET' | 'PUT',
  body?: unknown,
): Promise<IsaPromptConfig> {
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
    // Se falhar, cai no fetchWithSessionAuth para usar o token de sessão existente.
  }

  const response = await fetchWithSessionAuth(`${env.localBffUrl}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const root =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
    throw new Error(
      toCleanString(root.message) || `HTTP ${response.status} ao consultar configuracao da ISA.`,
    )
  }

  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  if (root.success !== true) {
    throw new Error(toCleanString(root.message) || 'Falha ao carregar configuracao da ISA.')
  }

  return normalizeConfig(root.data)
}

export async function fetchIsaPromptConfig(): Promise<IsaPromptConfig> {
  return unwrapIsaPromptConfigResponse('/api/admin/isa-config', 'GET')
}

export async function updateIsaPromptConfig(input: {
  sections: Record<string, string>
}): Promise<IsaPromptConfig> {
  return unwrapIsaPromptConfigResponse('/api/admin/isa-config', 'PUT', {
    sections: input.sections,
  })
}

export async function restoreIsaPromptConfigFallback(): Promise<IsaPromptConfig> {
  return unwrapIsaPromptConfigResponse('/api/admin/isa-config', 'PUT', {
    resetToDefault: true,
  })
}

export function composeIsaPromptPreviewFromSections(
  sections: Array<Pick<IsaPromptConfigSection, 'value'>>,
  responseFormatNote: string,
): string {
  return [
    ...sections.map((section) => String(section.value ?? '').trim()).filter((value) => value !== ''),
    toCleanString(responseFormatNote),
  ]
    .filter((value) => value !== '')
    .join('\n\n')
    .trim()
}
