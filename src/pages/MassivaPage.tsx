import { MassivaPage as MassivaOperacionalView } from '@/features/massiva/ui/MassivaPage'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { isFirebaseAuthConfigured } from '@/shared/config/env'

/**
 * Rota índice do módulo de massivas (view operacional).
 * Renderizada dentro de `MassivaLayoutPage` — o cabeçalho e container
 * externo já estão no layout pai; aqui vai direto para o conteúdo.
 */
export function MassivaPage() {
  const canOpenMassiva = useAccessAuthStore((s) => s.hasPermission('canOpenMassiva'))

  return (
    <MassivaOperacionalView
      canOpenMassiva={isFirebaseAuthConfigured() ? canOpenMassiva : true}
    />
  )
}
