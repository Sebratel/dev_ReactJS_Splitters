import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { fetchMassivaRoutesFromLocalDb } from '@/features/massiva/api/fetchMassivaRoutesFromLocalDb'
import { emptyEscopoRede, formatEscopoRede, type GmudEscopoRede } from '@/features/gmud/model/gmudEscopoRede'
import { buildEscopoRedeOptions, pruneEscopoRede, routesForSite } from '@/features/gmud/lib/gmudEscopoRedeOptions'

const LABEL = 'block text-xs font-semibold text-on-surface-variant'
const SELECT =
  'mt-1 w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50'

function CheckList<T extends string | number>({
  items,
  selected,
  onToggle,
}: {
  items: { value: T; label: string }[]
  selected: T[]
  onToggle: (value: T) => void
}) {
  return (
    <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-neutral-200 p-2 dark:border-white/10">
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {items.map((item) => (
          <label key={String(item.value)} className="flex items-center gap-2 text-sm text-on-surface">
            <input type="checkbox" className="size-4 accent-primary" checked={selected.includes(item.value)} onChange={() => onToggle(item.value)} />
            <span className="truncate">{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

/**
 * Afunilamento opcional da GMUD dentro do POP/Site: ponto de acesso → slot → PON → splitter.
 * Mesmo catálogo de rotas da massiva. Sem escolha, a GMUD vale para o site inteiro.
 */
export function GmudEscopoRedeField({
  popSite,
  value,
  onChange,
}: {
  popSite: string
  value: GmudEscopoRede
  onChange: (next: GmudEscopoRede) => void
}) {
  const site = popSite.trim()
  const routesQuery = useQuery({
    queryKey: ['massiva', 'routes'],
    queryFn: () => fetchMassivaRoutesFromLocalDb(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: site.length >= 2,
  })

  const siteRows = useMemo(() => routesForSite(routesQuery.data ?? [], site), [routesQuery.data, site])
  const options = useMemo(() => buildEscopoRedeOptions(siteRows, value), [siteRows, value])

  const update = (next: GmudEscopoRede) => onChange(pruneEscopoRede(next, buildEscopoRedeOptions(siteRows, next)))

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((i) => i !== item) : [...list, item])

  let body: React.ReactNode
  if (site.length < 2) {
    body = <p className="text-xs text-on-surface-variant">Informe o POP/Site para poder afunilar por ponto de acesso, slot, PON e splitter.</p>
  } else if (routesQuery.isLoading) {
    body = (
      <p className="flex items-center gap-2 text-xs text-on-surface-variant">
        <Loader2 size={14} className="animate-spin" /> Carregando pontos de acesso do site…
      </p>
    )
  } else if (routesQuery.isError) {
    body = <p className="text-xs text-red-600 dark:text-red-400">Não foi possível carregar as rotas da rede. A GMUD valerá para o site inteiro.</p>
  } else if (siteRows.length === 0) {
    body = (
      <p className="text-xs text-on-surface-variant">
        Não há rotas cadastradas para o site “{site}”. A GMUD valerá para o site inteiro.
      </p>
    )
  } else {
    body = (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
          <span className={LABEL}>Ponto de acesso</span>
          <select
            className={SELECT}
            value={value.apCode}
            onChange={(e) => {
              const ap = options.aps.find((a) => a.code === e.target.value)
              update(ap ? { ...emptyEscopoRede(), apCode: ap.code, apTitle: ap.title } : emptyEscopoRede())
            }}
          >
            <option value="">Todos os pontos de acesso do site</option>
            {options.aps.map((a) => (
              <option key={a.code} value={a.code}>{a.title}</option>
            ))}
          </select>
        </label>

        <label>
          <span className={LABEL}>Slot</span>
          <select
            className={SELECT}
            value={value.slot ?? ''}
            disabled={value.apCode === ''}
            onChange={(e) => update({ ...value, slot: e.target.value === '' ? null : Number(e.target.value), ports: [] })}
          >
            <option value="">Todos os slots</option>
            {options.slots.map((s) => (
              <option key={s} value={s}>Slot {s}</option>
            ))}
          </select>
        </label>

        {value.slot !== null ? (
          <div className="sm:col-span-2">
            <span className={LABEL}>PON (marque uma ou mais; vazio = todas do slot)</span>
            <CheckList
              items={options.ports.map((p) => ({ value: p, label: `PON ${p}` }))}
              selected={value.ports}
              onToggle={(p) => update({ ...value, ports: toggle(value.ports, p) })}
            />
          </div>
        ) : null}

        {value.apCode !== '' ? (
          <div className="sm:col-span-2">
            <span className={LABEL}>Splitter (marque um ou mais; vazio = todos)</span>
            <CheckList
              items={options.splitters.map((s) => ({ value: s.code, label: s.title }))}
              selected={value.splitters.map((s) => s.code)}
              onToggle={(code) => {
                const exists = value.splitters.some((s) => s.code === code)
                const found = options.splitters.find((s) => s.code === code)
                update({
                  ...value,
                  splitters: exists ? value.splitters.filter((s) => s.code !== code) : found ? [...value.splitters, found] : value.splitters,
                })
              }}
            />
          </div>
        ) : null}
      </div>
    )
  }

  const summary = formatEscopoRede(value)

  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-surface-container-lowest p-4 dark:border-white/10 sm:col-span-2 sm:p-5">
      <p className="text-sm font-bold text-on-surface">Abrangência na rede (opcional)</p>
      <p className="mb-3 mt-0.5 text-xs text-on-surface-variant">
        Afunile a GMUD por ponto de acesso, slot, PON e splitter. Sem escolha, vale para o POP/Site inteiro e todos os clientes corporativos dele são avisados.
      </p>
      {body}
      {summary !== '' ? (
        <p className="mt-3 text-xs text-on-surface">
          <span className="font-semibold">Abrangência escolhida:</span> {summary}
        </p>
      ) : null}
    </div>
  )
}
