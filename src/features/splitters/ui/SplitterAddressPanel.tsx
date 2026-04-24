import type { GeocodedAddress } from '@/features/splitters/model/geocodedAddress'
import { MapPin } from 'lucide-react'

type SplitterAddressPanelProps = {
  address: GeocodedAddress
}

function formatLines(address: GeocodedAddress): string[] {
  const line1 = [address.street, address.neighborhood].filter(Boolean).join(' · ')
  const line2 = [address.city, address.state].filter(Boolean).join(' / ')
  const lines = [line1, line2, address.postalCode].filter(
    (l) => l != null && String(l).trim() !== '',
  )
  return lines.map((l) => String(l))
}

export function SplitterAddressPanel({ address }: SplitterAddressPanelProps) {
  const lines = formatLines(address)

  return (
    <section
      className="h-full rounded-2xl border border-outline-variant bg-white p-4 shadow-sm"
      aria-labelledby="splitter-address-geo-heading"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.08] text-primary">
          <MapPin size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Geocoding
          </p>
          <h2
            id="splitter-address-geo-heading"
            className="mt-0.5 text-base font-semibold tracking-tight text-on-surface"
          >
            Endereço resolvido
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-on-surface-variant/70">
            Via coordenadas (OSM / proxy); pode divergir do cadastro do splitter.
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-1 border-t border-outline-variant/40 pt-3 text-sm leading-snug text-on-surface">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </section>
  )
}
