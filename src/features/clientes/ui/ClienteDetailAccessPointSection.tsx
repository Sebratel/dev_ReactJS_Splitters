import type { ClienteDetail } from '@/features/clientes/model/clienteDetail'
import { Router } from 'lucide-react'

type ClienteDetailAccessPointSectionProps = {
  accessPoint: NonNullable<ClienteDetail['accessPoint']>
}

export function ClienteDetailAccessPointSection({
  accessPoint,
}: ClienteDetailAccessPointSectionProps) {
  return (
    <section
      className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm md:p-5"
      aria-labelledby="cliente-detail-ap-heading"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-tertiary/20 bg-tertiary/[0.08] text-tertiary">
          <Router size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Rede
          </p>
          <h2
            id="cliente-detail-ap-heading"
            className="mt-0.5 text-base font-semibold tracking-tight text-on-surface"
          >
            Ponto de acesso
          </h2>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            OLT
          </dt>
          <dd className="mt-1 font-semibold leading-snug text-on-surface">
            {accessPoint.title || accessPoint.code || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Slot
          </dt>
          <dd className="mt-1 font-semibold tabular-nums text-on-surface">{accessPoint.slotOlt}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            PON
          </dt>
          <dd className="mt-1 font-semibold tabular-nums text-on-surface">{accessPoint.portOlt}</dd>
        </div>
      </dl>
    </section>
  )
}
