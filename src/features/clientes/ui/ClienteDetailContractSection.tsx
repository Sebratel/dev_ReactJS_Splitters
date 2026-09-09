import type { ClienteDetail } from '@/features/clientes/model/clienteDetail'
import { FileText } from 'lucide-react'

type ClienteDetailContractSectionProps = {
  contract: NonNullable<ClienteDetail['contract']>
}

export function ClienteDetailContractSection({
  contract,
}: ClienteDetailContractSectionProps) {
  return (
    <section
      className="h-full rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm md:p-5"
      aria-labelledby="cliente-detail-contract-heading"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-secondary/25 bg-secondary/[0.08] text-secondary">
          <FileText size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Contratual
          </p>
          <h2
            id="cliente-detail-contract-heading"
            className="mt-0.5 text-base font-semibold tracking-tight text-on-surface"
          >
            Contrato
          </h2>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            ID
          </dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-on-surface">
            {contract.id || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Status
          </dt>
          <dd className="mt-1 font-semibold text-on-surface">
            {contract.statusDescription || (contract.status > 0 ? String(contract.status) : '—')}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Etapa
          </dt>
          <dd className="mt-1 font-semibold text-on-surface">
            {contract.stageDescription || (contract.stage > 0 ? String(contract.stage) : '—')}
          </dd>
        </div>
      </dl>
    </section>
  )
}
