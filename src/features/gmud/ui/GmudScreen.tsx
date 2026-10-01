import { ClipboardList } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import { cn } from '@/shared/lib/utils'

const CARD =
  'rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest p-6'

/**
 * Módulo GMUD — Gestão de Mudança de Rede.
 * Espelha o fluxo atual (Elleven + Google Form + Looker) numa tela só:
 * abrir GMUD, acompanhar no painel e aprovar no Comitê.
 *
 * Esta é a estrutura inicial (scaffold). As seções são preenchidas em etapas:
 * painel (lista do Voalle) → abertura → aprovação → vínculo com massiva.
 */
export function GmudScreen() {
  return (
    <div className="mx-auto min-w-0 max-w-[1480px] space-y-4">
      <AppPageHeader
        badge="Gestão de Mudança de Rede"
        title="GMUD"
        description="Requisição, acompanhamento e aprovação de mudanças de rede — integrado ao Elleven."
        icon={ClipboardList}
        primaryAction={{ to: '/', label: 'Voltar ao painel' }}
      />

      <div className={cn(CARD, 'text-sm text-on-surface-variant')}>
        <p className="font-semibold text-on-surface">Painel de GMUDs</p>
        <p className="mt-1">
          Em construção — o painel vai listar as GMUDs (do Voalle) com filtros e status, a
          abertura de nova GMUD e a fila de aprovação do Comitê.
        </p>
      </div>
    </div>
  )
}
