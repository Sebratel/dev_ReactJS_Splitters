import { MassivaMonitorScreen } from '@/features/massiva/ui/MassivaMonitorScreen'

/**
 * Ponto de entrada do painel de parede (CGR/COR) — rota isolada, fora do chrome padrão
 * do app (sem sidebar/menu), pensada pra ficar fixa num monitor físico em tela cheia.
 */
export function MassivaMonitorPage() {
  return <MassivaMonitorScreen />
}
