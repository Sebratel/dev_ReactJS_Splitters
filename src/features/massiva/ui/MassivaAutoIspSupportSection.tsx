import type { AutoIspEvent } from '@/features/autoisp/model/autoIsp.types'
import type { ResolvedAutoIspRoute } from '@/features/autoisp/model/topology.types'
import { AutoIspSuggestions } from '@/features/autoisp/ui/AutoIspSuggestions'
import { applyAutoIspEventToOpenDraft } from '@/features/massiva/lib/applyAutoIspEventToOpenDraft'
import { useMassivaLocalPreview } from '@/features/massiva/hooks/useMassivaLocalPreview'

export function MassivaAutoIspSupportSection() {
  const { connections, setConnections } =
    useMassivaLocalPreview()

  const handleApplyFromAutoIsp = (
    event: AutoIspEvent,
    route: ResolvedAutoIspRoute | null,
  ) => {
    applyAutoIspEventToOpenDraft(event)
    if (route) {
      setConnections([
        {
          apId: route.ap,
          apLabel: route.ap,
          slot: route.slot,
          porta: route.port,
          splitters:
            route.splitterCode == null
              ? []
              : [{ id: route.splitterCode, label: route.splitterCode }],
        },
      ])
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-100/90 bg-gradient-to-br from-sky-50/80 to-white px-4 py-3 text-sm leading-relaxed text-neutral-700 shadow-sm ring-1 ring-sky-100/40">
        <p>
          Clique em{' '}
          <strong className="font-semibold text-sky-950">Aplicar na abertura</strong> para preencher o formulário (relato,
          origem, horários, afetados) e a rota: de preferência os{' '}
          <strong className="font-semibold text-neutral-900">PPPoE</strong> do evento são buscados na base de conexões
          para definir AP, slot, PON e splitter; se faltar match, usa-se o{' '}
          <code className="rounded-md bg-white/80 px-1.5 py-0.5 text-xs font-medium text-neutral-800 ring-1 ring-neutral-200/80">
            ponlink
          </code>
          . O solicitante é o seu perfil; a descrição técnica sincroniza sozinha.
        </p>
      </div>
      <AutoIspSuggestions
        connections={connections}
        onApplyFromAutoIsp={handleApplyFromAutoIsp}
      />
    </div>
  )
}
