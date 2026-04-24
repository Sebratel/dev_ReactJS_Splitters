import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/** Paridade chave `auth:` / `user:` em `_collectClientesForAp` / `_buildLocalPreview`. */
export function massivaClientDedupeKey(cliente: SplitterCliente): string {
  if (cliente.authenticationId > 0) {
    return `auth:${cliente.authenticationId}`
  }
  return `user:${cliente.user.trim().toLowerCase()}`
}
