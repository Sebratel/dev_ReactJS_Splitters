import { Sparkles } from 'lucide-react'
import { MassivaPage } from '@/features/massiva/ui/MassivaPage'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'

type MassivaScreenProps = {
  canOpenMassiva?: boolean
}

export function MassivaScreen({ canOpenMassiva = true }: MassivaScreenProps) {
  return (
    <div className="mx-auto max-w-[1720px] space-y-5 animate-in fade-in px-4 pb-8 pt-0 duration-500 xl:px-8">
      <AppPageHeader
        icon={Sparkles}
        badge="Centro de operação"
        title="Operação de Massivas"
        description="Fluxo guiado de abertura com preview de rota, formulário e apoio do AutoISP — tudo organizado em painéis claros."
        primaryAction={{ to: '/splitters', label: 'Voltar aos Splitters' }}
      />

      <MassivaPage canOpenMassiva={canOpenMassiva} />
    </div>
  )
}
