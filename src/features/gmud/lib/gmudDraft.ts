import type { GmudFormState, GmudSistemasExternosData, GmudSistemasInternosData } from '@/features/gmud/model/gmudForm'

/** Rascunho do formulário de nova GMUD, guardado só neste navegador. */
export type GmudDraft = {
  v: 1
  savedAt: string
  etapa: number
  maxEtapa: number
  form: GmudFormState
  si: GmudSistemasInternosData
  se: GmudSistemasExternosData
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function gmudDraftKey(email: string): string {
  return `gmud:rascunho:v1:${email.trim().toLowerCase()}`
}

export function saveGmudDraft(storage: StorageLike, key: string, draft: Omit<GmudDraft, 'v' | 'savedAt'>, now = new Date()): void {
  try {
    storage.setItem(key, JSON.stringify({ ...draft, v: 1, savedAt: now.toISOString() } satisfies GmudDraft))
  } catch {
    // armazenamento cheio ou bloqueado: o rascunho é só uma conveniência
  }
}

export function clearGmudDraft(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    // ignora
  }
}

/**
 * Lê o rascunho e o mistura com os valores padrão (campos novos que não existiam quando foi salvo).
 * Devolve null se não houver, se estiver corrompido ou se for de outra versão.
 */
export function loadGmudDraft(
  storage: StorageLike,
  key: string,
  defaults: { form: GmudFormState; si: GmudSistemasInternosData; se: GmudSistemasExternosData },
): GmudDraft | null {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GmudDraft> | null
    if (!parsed || parsed.v !== 1 || typeof parsed.form !== 'object' || parsed.form === null) return null
    const etapa = Number.isInteger(parsed.etapa) ? Math.min(Math.max(parsed.etapa as number, 0), 4) : 0
    const maxEtapa = Number.isInteger(parsed.maxEtapa) ? Math.min(Math.max(parsed.maxEtapa as number, etapa), 4) : etapa
    return {
      v: 1,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date(0).toISOString(),
      etapa,
      maxEtapa,
      form: { ...defaults.form, ...parsed.form },
      si: { ...defaults.si, ...(parsed.si ?? {}) },
      se: { ...defaults.se, ...(parsed.se ?? {}) },
    }
  } catch {
    return null
  }
}

/** Há algo digitado que valha a pena guardar? Evita gravar rascunho de formulário em branco. */
export function draftHasContent(form: GmudFormState, defaults: GmudFormState): boolean {
  return JSON.stringify({ ...form, solicitanteEmail: '', solicitanteNome: '' }) !== JSON.stringify({ ...defaults, solicitanteEmail: '', solicitanteNome: '' })
}
