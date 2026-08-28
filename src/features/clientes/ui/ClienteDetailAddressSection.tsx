import type { ClienteDetail } from '@/features/clientes/model/clienteDetail'
import { MapPin } from 'lucide-react'

type ClienteDetailAddressSectionProps = {
  address: NonNullable<ClienteDetail['address']>
}

export function ClienteDetailAddressSection({
  address,
}: ClienteDetailAddressSectionProps) {
  const cityLine = [address.city, address.state]
    .filter((part) => part.trim() !== '')
    .join(' — ')

  return (
    <section
      className="h-full rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm md:p-5"
      aria-labelledby="cliente-detail-address-heading"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08] text-primary">
          <MapPin size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Localização
          </p>
          <h2
            id="cliente-detail-address-heading"
            className="mt-0.5 text-base font-semibold tracking-tight text-on-surface"
          >
            Endereço
          </h2>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Logradouro
          </dt>
          <dd className="mt-1 font-semibold leading-snug text-on-surface">
            {address.street}, {address.number}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Bairro
          </dt>
          <dd className="mt-1 font-semibold text-on-surface">{address.neighborhood}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Cidade
          </dt>
          <dd className="mt-1 font-semibold text-on-surface">{cityLine || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            CEP
          </dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-on-surface">
            {address.postalCode}
          </dd>
        </div>
        {address.complement ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              Complemento
            </dt>
            <dd className="mt-1 font-semibold text-on-surface">{address.complement}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}
