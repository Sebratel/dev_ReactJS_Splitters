/**
 * "Link pendente": quando o usuário clica em "Abrir massiva vinculada" numa GMUD,
 * guardamos o protocolo da GMUD aqui e navegamos pro fluxo de massiva. Ao abrir a
 * massiva com sucesso, o hook de abertura consome isto e cria o vínculo automático.
 * sessionStorage (por aba) — some ao fechar a aba.
 */
const KEY = 'gmud_pending_link'

export function setPendingGmudLink(gmudProtocol: number): void {
  try {
    sessionStorage.setItem(KEY, String(gmudProtocol))
  } catch {
    // ignore
  }
}

export function getPendingGmudLink(): number | null {
  try {
    const v = sessionStorage.getItem(KEY)
    const n = v ? Number(v) : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function clearPendingGmudLink(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
