import type {
  SplittersAccessRequestModuleId,
  SplittersPermissionSet,
} from '@/features/access/model/access.types'

/** Nomes de telas (não papéis como “administrador”). */
export const ACCESS_REQUEST_MODULE_LABEL: Record<SplittersAccessRequestModuleId, string> = {
  massiva_view: 'Massivas',
  massiva_open: 'Massivas — abrir ocorrências',
  intelligence: 'Inteligência',
  admin: 'Gestão de usuários',
}

/** Telas que podem ser pedidas por utilizador (gestão de utilizadores fica só para admins). */
const ORDER: SplittersAccessRequestModuleId[] = ['massiva_view', 'massiva_open', 'intelligence']

/** Linha auxiliar por opção (subtítulo). */
export const ACCESS_REQUEST_MODULE_HINT: Partial<Record<SplittersAccessRequestModuleId, string>> = {
  massiva_view: 'Tela de listagem e acompanhamento',
  massiva_open: 'Abrir ou registrar chamados nesta área',
  intelligence: 'Mapas e painéis de inteligência',
  admin: 'Tela de cadastro e permissões de acesso',
}

export type AccessRequestModuleOption = {
  id: SplittersAccessRequestModuleId
  label: string
  hint?: string
}

/** Telas / áreas que o utilizador ainda não pode abrir. */
export function missingAccessRequestModuleOptions(
  permissions: SplittersPermissionSet,
): AccessRequestModuleOption[] {
  const candidates: Partial<Record<SplittersAccessRequestModuleId, true>> = {}
  if (!permissions.canViewMassiva) candidates.massiva_view = true
  if (!permissions.canOpenMassiva) candidates.massiva_open = true
  if (!permissions.canViewIntelligence) candidates.intelligence = true
  return ORDER.filter((id) => candidates[id]).map((id) => ({
    id,
    label: ACCESS_REQUEST_MODULE_LABEL[id],
    hint: ACCESS_REQUEST_MODULE_HINT[id],
  }))
}

export function labelForRequestedModule(id: string): string {
  if (id in ACCESS_REQUEST_MODULE_LABEL) {
    return ACCESS_REQUEST_MODULE_LABEL[id as SplittersAccessRequestModuleId]
  }
  return id
}
