import { MassivaScreen } from '@/features/massiva/ui/MassivaScreen'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { isFirebaseAuthConfigured } from '@/shared/config/env'

export function MassivaPage() {
  const canOpenMassiva = useAccessAuthStore((s) => s.hasPermission('canOpenMassiva'))

  return (
    <MassivaScreen
      canOpenMassiva={isFirebaseAuthConfigured() ? canOpenMassiva : true}
    />
  )
}
