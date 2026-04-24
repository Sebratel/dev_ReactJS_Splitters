import { create } from 'zustand'

interface AutoIspState {
  token: string | null
  /** Momento em que o token deixa de ser aceito localmente (renovar antes, com margem). Epoch ms. */
  tokenExpiresAtMs: number | null
  setAuthSession: (token: string, tokenExpiresAtMs: number | null) => void
  clearToken: () => void
}

/**
 * Store dedicada ao ciclo de vida da autenticação com o serviço AutoISP.
 * Persiste apenas em memória; expiração vem de `expires_in` no request_token ou fallback.
 */
export const useAutoIspStore = create<AutoIspState>((set) => ({
  token: null,
  tokenExpiresAtMs: null,
  setAuthSession: (token, tokenExpiresAtMs) => set({ token, tokenExpiresAtMs }),
  clearToken: () => set({ token: null, tokenExpiresAtMs: null }),
}))
