import type { Olt } from '@/features/splitters/model/olt'
import { RadioTower } from 'lucide-react'

type SplitterOltPanelProps = {
  olt: Olt
}

/**
 * Dados da OLT para operação (sem mapa). Lat/lng ficam para etapa de mapa.
 */
export function SplitterOltPanel({ olt }: SplitterOltPanelProps) {
  const locationLine = [olt.street, olt.streetNumber, olt.neighborhood, olt.city, olt.uf]
    .filter(Boolean)
    .join(', ')

  return (
    <section
      className="h-full rounded-2xl border border-outline-variant bg-white p-4 shadow-sm"
      aria-labelledby="splitter-olt-heading"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-secondary/25 bg-secondary/[0.08] text-secondary">
          <RadioTower size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Concentrador
          </p>
          <h2
            id="splitter-olt-heading"
            className="mt-0.5 text-base font-semibold tracking-tight text-on-surface"
          >
            OLT
          </h2>
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold text-on-surface">{olt.title || olt.code}</p>
      <p className="mt-0.5 font-mono text-xs text-on-surface-variant/55">{olt.code}</p>

      <dl className="mt-3 grid gap-3 border-t border-outline-variant/40 pt-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
            IP
          </dt>
          <dd className="mt-1 font-mono font-medium text-on-surface">{olt.ip || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
            Estado
          </dt>
          <dd className="mt-1 font-medium text-on-surface">{olt.active ? 'Ativa' : 'Inativa'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
            Quantidade de slots
          </dt>
          <dd className="mt-1 font-medium tabular-nums text-on-surface">{olt.slotsNumber}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
            Portas
          </dt>
          <dd className="mt-1 font-medium text-on-surface">
            {olt.portsNumber} <span className="text-on-surface-variant/55">(1ª: {olt.portsFirstNumber})</span>
          </dd>
        </div>
        {olt.integrationCodeMap ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
              Mapa de integração
            </dt>
            <dd className="mt-1 font-mono text-xs text-on-surface-variant">{olt.integrationCodeMap}</dd>
          </div>
        ) : null}
        {locationLine ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
              Localização (cadastro)
            </dt>
            <dd className="mt-1 text-on-surface-variant">
              {locationLine}
              {olt.postalCode ? ` · CEP ${olt.postalCode}` : null}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}
