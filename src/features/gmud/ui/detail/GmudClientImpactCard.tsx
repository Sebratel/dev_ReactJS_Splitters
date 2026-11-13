import { Building2, Loader2, Users } from 'lucide-react'
import { useGmudClientImpact } from '@/features/gmud/hooks/useGmudClients'
import { describeGmudClientImpact } from '@/features/gmud/lib/describeGmudClientImpact'

const CARD = 'rounded-xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest'

/**
 * Clientes impactados pela GMUD (só rede externa). Corporativos em vermelho. Antes da inclusão é uma
 * estimativa pelo escopo; depois, o que de fato entrou em alerta (e quem já estava em outro evento).
 */
export function GmudClientImpactCard({ protocol }: { protocol: number }) {
  const { data, isLoading, isError } = useGmudClientImpact(protocol)

  if (isError) return null
  if (isLoading) {
    return (
      <div className={`${CARD} flex items-center gap-2 px-4 py-3 text-xs text-on-surface-variant`}>
        <Loader2 size={14} className="animate-spin" /> Calculando clientes impactados…
      </div>
    )
  }
  if (!data || !data.applicable) return null

  const total = data.total ?? 0
  const corporativos = data.corporativos ?? 0

  return (
    <section className={`${CARD} p-4`} aria-label="Clientes impactados">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-on-surface-variant" aria-hidden />
          <h3 className="text-sm font-bold text-on-surface">Clientes impactados</h3>
          {data.source === 'estimativa' ? (
            <span className="rounded-full bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              estimativa
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="text-2xl font-bold tabular-nums text-on-surface">{total.toLocaleString('pt-BR')}</p>
          <p className="text-[11px] text-on-surface-variant">clientes no escopo</p>
        </div>
        <div>
          <p
            className={`flex items-center gap-1 text-2xl font-bold tabular-nums ${
              corporativos > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-on-surface-variant'
            }`}
          >
            {corporativos > 0 ? <Building2 size={18} aria-hidden /> : null}
            {corporativos.toLocaleString('pt-BR')}
          </p>
          <p className={`text-[11px] ${corporativos > 0 ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-on-surface-variant'}`}>
            corporativos
          </p>
        </div>
        {(data.deForaPorOutroEvento ?? 0) > 0 ? (
          <div>
            <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {(data.deForaPorOutroEvento ?? 0).toLocaleString('pt-BR')}
            </p>
            <p className="text-[11px] text-on-surface-variant">já estavam em outro evento</p>
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-on-surface-variant">{describeGmudClientImpact(data)}</p>
    </section>
  )
}
