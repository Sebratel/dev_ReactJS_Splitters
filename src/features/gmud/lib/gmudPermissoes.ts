import type { SplittersPermissionSet } from '@/features/access/model/access.types'

type PermissoesPreAprovada = Pick<SplittersPermissionSet, 'isAdmin' | 'canOpenGmudPreAprovada'>

/**
 * Pré-aprovada não passa por aprovação nenhuma, então só abre quem recebeu essa permissão (ou é admin).
 * O servidor confere de novo na criação (server/lib/gmudPreAprovada.js); aqui é só para a tela.
 */
export function podeAbrirGmudPreAprovada(permissoes: PermissoesPreAprovada | null | undefined): boolean {
  return permissoes?.isAdmin === true || permissoes?.canOpenGmudPreAprovada === true
}

export const MSG_SEM_PERMISSAO_PRE_APROVADA =
  'Você não tem permissão para abrir GMUD pré-aprovada. Peça a um administrador.'
