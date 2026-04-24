/**
 * Estrutura bruta retornada pelo endpoint /auth/session do Hub.
 * Paridade com AppSessionUser.fromHubSession do Flutter.
 */
export interface HubSessionPayload {
  email: string
  name?: string
  /** Lista de strings de permissão (ex: ['massiva_view', 'massiva_open']) */
  permissions?: string[] | string
  isAdmin?: boolean
  /** 
   * No Hub, 'profile' e 'team' são frequentemente usados como as roles 
   * primárias do usuário na organização. 
   */
  profile?: string | string[]
  team?: string | string[]
}
