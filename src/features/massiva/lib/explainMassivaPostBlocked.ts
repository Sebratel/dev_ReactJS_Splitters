import type { MassivaOpenReadinessView } from '@/features/massiva/model/massivaOpenReadiness'

/**
 * Texto curto para o operador entender por que o POST ainda não está liberado.
 */
export function explainMassivaPostBlocked(
  readiness: MassivaOpenReadinessView,
): string | null {
  if (readiness.status === 'ready-to-open') return null

  switch (readiness.status) {
    case 'blocked-preparation':
      return 'Finalize a rota acima (AP, slot, porta e splitters) até o resumo ficar “preparado”.'
    case 'missing-session':
      if (readiness.reason === 'token') {
        return 'Sem credencial de sessão neste host. Use login pelo Hub ou ambiente local com perfil válido.'
      }
      if (readiness.reason === 'email') {
        return 'O perfil precisa de e-mail para resolver personId no BFF.'
      }
      return 'Perfil de sessão incompleto.'
    case 'no-permission':
      return 'Seu usuário não tem permissão para abrir massiva (canOpenMassiva).'
    case 'resolving-person-id':
      return 'Aguardando personId no BFF…'
    case 'person-id-error':
      return 'Falha ao obter personId. Use “Tentar novamente” no bloco de erro acima.'
    case 'person-id-invalid':
      return 'personId inválido. Verifique sessão ou o endpoint de funcionário no BFF.'
    case 'missing-gateway-config':
      return 'Em produção é obrigatório definir VITE_MASSIVA_OPEN_PATH no build. Em npm run dev o app já assume /api/v1/massivas/salvar-massiva-via-api se a variável estiver vazia; confira também VITE_BFF_BASE_URL e reinicie o Vite após mudar .env.'
    case 'missing-assignment':
      return readiness.issues.join(' ')
    default:
      return 'Ainda não é possível enviar a abertura.'
  }
}
