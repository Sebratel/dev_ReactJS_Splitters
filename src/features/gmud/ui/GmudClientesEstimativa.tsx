import { useEffect, useState } from 'react'
import { Loader2, Users } from 'lucide-react'
import { useGmudClientImpactEstimate } from '@/features/gmud/hooks/useGmudClients'

const DEBOUNCE_MS = 600

type Escopo = { popSite: string; escopoRotas: unknown[]; clientesSemSplitter: unknown[] }

/** Espera a pessoa parar de mexer no escopo antes de recalcular (evita uma consulta por clique). */
function useEscopoAssentado(escopo: Escopo): Escopo {
  const chave = JSON.stringify(escopo)
  const [assentado, setAssentado] = useState(escopo)
  useEffect(() => {
    const id = window.setTimeout(() => setAssentado(JSON.parse(chave) as Escopo), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [chave])
  return assentado
}

/**
 * Quantos clientes a GMUD vai impactar, calculado ao vivo conforme o escopo é escolhido (POP/Site,
 * afunilamento e clientes ponto a ponto). Só informa: nunca bloqueia o envio do formulário.
 */
export function GmudClientesEstimativa(props: Escopo) {
  const escopo = useEscopoAssentado(props)
  const { data, isFetching, isError } = useGmudClientImpactEstimate(escopo)
  const recalculando = isFetching || JSON.stringify(escopo) !== JSON.stringify(props)

  if (props.popSite.trim() === '') return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-neutral-200/90 bg-surface-container-lowest px-4 py-3 text-sm dark:border-white/10"
    >
      <Users size={16} className="text-on-surface-variant" aria-hidden />
      <span className="font-bold text-on-surface">Clientes impactados</span>
      {isError || data?.erro ? (
        <span className="text-xs text-on-surface-variant">
          Não foi possível estimar agora{data?.erro ? ` — ${data.erro}` : ''}.
        </span>
      ) : data?.pronto ? (
        <>
          <span className="text-base font-extrabold tabular-nums text-on-surface">{(data.total ?? 0).toLocaleString('pt-BR')}</span>
          {(data.corporativos ?? 0) > 0 ? (
            <span className="rounded-full bg-error/10 px-2 py-0.5 text-[11px] font-semibold text-error">
              {(data.corporativos ?? 0).toLocaleString('pt-BR')} corporativo(s)
            </span>
          ) : null}
          <span className="text-[11px] text-on-surface-variant">estimativa pelo escopo escolhido</span>
        </>
      ) : (
        <span className="text-xs text-on-surface-variant">Calculando…</span>
      )}
      {recalculando ? <Loader2 size={14} className="animate-spin text-on-surface-variant" aria-label="Atualizando" /> : null}
    </div>
  )
}
