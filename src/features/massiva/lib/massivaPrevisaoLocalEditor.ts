import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

const STORAGE_KEY = 'massiva-previsao-encerramento-editor-v1'

type Store = Record<string, { name: string; at: number; closeTimeMs?: number }>

function readStore(): Store {
  if (typeof localStorage === 'undefined') return {}
  try {
    const t = localStorage.getItem(STORAGE_KEY)
    if (t == null || t === '') return {}
    const o = JSON.parse(t) as unknown
    if (o === null || typeof o !== 'object' || Array.isArray(o)) return {}
    return o as Store
  } catch {
    return {}
  }
}

function writeStore(s: Store): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // quota / privado
  }
}

const CLOSE_MATCH_MS = 2 * 60 * 1000

/**
 * Após *Salvar previsão* grata nome (se houver) e a data/hora enviada — para a UI
 * explicitar «Ajustado para …» e reconhecer o ajuste no browser após refetch.
 */
export function recordMassivaPrevisaoEncerramentoEdit(
  protocol: number,
  input: { closeAt: Date; editorName?: string | null },
): void {
  if (protocol <= 0) return
  if (Number.isNaN(input.closeAt.getTime())) return
  const s = readStore()
  const key = String(protocol)
  const prev = s[key]
  const nextName = (() => {
    if (input.editorName != null && input.editorName.trim() !== '') {
      return input.editorName.trim()
    }
    if (prev != null && typeof prev.name === 'string' && prev.name.trim() !== '') {
      return prev.name.trim()
    }
    return ''
  })()
  s[key] = { name: nextName, at: Date.now(), closeTimeMs: input.closeAt.getTime() }
  writeStore(s)
}

export function getMassivaPrevisaoLastEditor(protocol: number): string | null {
  if (protocol <= 0) return null
  const s = readStore()
  const e = s[String(protocol)]
  if (e == null || typeof e.name !== 'string' || e.name.trim() === '') return null
  return e.name.trim()
}

/** O último *Salvar* neste browser bate com o fim de prazo do ticket (após listagem BFF). */
export function localPrevisaoCloseMatchesTicket(ticket: MassivaTicket): boolean {
  if (ticket.protocol <= 0) return false
  if (ticket.expectedCloseAt == null || Number.isNaN(ticket.expectedCloseAt.getTime())) {
    return false
  }
  const e = readStore()[String(ticket.protocol)]
  if (e == null || typeof e.closeTimeMs !== 'number') return false
  return (
    Math.abs(ticket.expectedCloseAt.getTime() - e.closeTimeMs) <= CLOSE_MATCH_MS
  )
}

/**
 * *Salvar previsão* neste browser gravou outro fim de prazo do que a listagem ainda devolve
 * (refetch atrasado ou BFF ainda a devolver a data antiga).
 */
export function localPrevisaoPendingOverServer(ticket: MassivaTicket): boolean {
  if (ticket.protocol <= 0) return false
  const e = readStore()[String(ticket.protocol)]
  if (e == null || typeof e.closeTimeMs !== 'number') return false
  const localT = e.closeTimeMs
  const server = ticket.expectedCloseAt
  if (server == null || Number.isNaN(server.getTime())) {
    return true
  }
  return Math.abs(server.getTime() - localT) > CLOSE_MATCH_MS
}

/**
 * Data/hora a mostrar para fim de prazo: se o último *Salvar* local não bate com o BFF,
 * usa a data do *Salvar* até a listagem alinhar.
 */
export function resolveExpectedCloseAtForDisplay(ticket: MassivaTicket): Date | null {
  if (ticket.protocol <= 0) {
    return ticket.expectedCloseAt
  }
  const e = readStore()[String(ticket.protocol)]
  if (e == null || typeof e.closeTimeMs !== 'number') {
    return ticket.expectedCloseAt
  }
  const local = new Date(e.closeTimeMs)
  if (Number.isNaN(local.getTime())) {
    return ticket.expectedCloseAt
  }
  const server = ticket.expectedCloseAt
  if (server == null || Number.isNaN(server.getTime())) {
    return local
  }
  if (Math.abs(server.getTime() - local.getTime()) <= CLOSE_MATCH_MS) {
    return server
  }
  return local
}

type PrevisaoAjustadaExplicataParams = {
  matchesSla: boolean
  hasValidProjection: boolean
  /** `resolveExpectedCloseAtForDisplay(ticket)` (não use só o campo cru do BFF). */
  effectiveCloseAt: Date | null
}

/**
 * Exibir a legenda **Ajustado para {data/hora}** (editado na API, nesta app, ou
 * diferente da projeção abertura+ETR).
 */
export function isPrevisaoEncerramentoAjustadaExplicata(
  ticket: MassivaTicket,
  p: PrevisaoAjustadaExplicataParams,
): boolean {
  if (localPrevisaoPendingOverServer(ticket)) {
    return true
  }
  if (
    p.effectiveCloseAt == null ||
    Number.isNaN(p.effectiveCloseAt.getTime())
  ) {
    return false
  }
  if (ticket.previsaoEncerramentoAtualizadaPor?.trim() !== '') {
    return true
  }
  if (localPrevisaoCloseMatchesTicket(ticket)) {
    return true
  }
  if (p.hasValidProjection && !p.matchesSla) {
    return true
  }
  return false
}

/** BFF, se expuser o campo, tem prioridade; senão, último *Guardar* com login (nesta app / browser). */
export function resolvePrevisaoEncerramentoEditorDisplay(
  ticket: MassivaTicket,
): string | null {
  const fromApi = ticket.previsaoEncerramentoAtualizadaPor?.trim() ?? ''
  if (fromApi !== '') return fromApi
  return getMassivaPrevisaoLastEditor(ticket.protocol)
}
