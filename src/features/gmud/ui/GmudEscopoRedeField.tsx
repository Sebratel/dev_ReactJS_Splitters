import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Loader2, Plus, Trash2 } from 'lucide-react'
import { fetchMassivaRoutesFromLocalDb } from '@/features/massiva/api/fetchMassivaRoutesFromLocalDb'
import {
  emptyEscopoRede,
  escopoRotaKey,
  formatEscopoRede,
  hasEscopoRede,
  normalizeEscopoRede,
  type GmudEscopoRede,
} from '@/features/gmud/model/gmudEscopoRede'
import { buildEscopoRedeOptions, pruneEscopoRede, routesForSite } from '@/features/gmud/lib/gmudEscopoRedeOptions'
import { cn } from '@/shared/lib/utils'

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
 * Abrangência opcional da GMUD dentro do POP/Site, em várias rotas (ponto de acesso → slot → PON → splitter),
 * como na massiva: monta uma rota, adiciona à lista e repete. Sem nenhuma rota, vale o site inteiro.
 */
export function GmudEscopoRedeField({
  popSite,
  value,
  onChange,
}: {
  popSite: string
  value: GmudEscopoRede[]
  onChange: (next: GmudEscopoRede[]) => void
}) {
  const site = popSite.trim()
  const routesQuery = useQuery({
    queryKey: ['massiva', 'routes'],
    queryFn: () => fetchMassivaRoutesFromLocalDb(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: site.length >= 2,
  })

  const [editor, setEditor] = useState<GmudEscopoRede>(emptyEscopoRede())
  const [editando, setEditando] = useState(-1)

  const siteRows = useMemo(() => routesForSite(routesQuery.data ?? [], site), [routesQuery.data, site])
  const options = useMemo(() => buildEscopoRedeOptions(siteRows, editor), [siteRows, editor])

  const update = (next: GmudEscopoRede) => setEditor(pruneEscopoRede(next, buildEscopoRedeOptions(siteRows, next)))
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((i) => i !== item) : [...list, item])

  const podeAdicionar = hasEscopoRede(editor)
  const adicionar = () => {
    const rota = normalizeEscopoRede(editor)
    if (!rota) return
    if (editando >= 0) {
      onChange(value.map((r, i) => (i === editando ? rota : r)))
    } else if (!value.some((r) => escopoRotaKey(r) === escopoRotaKey(rota))) {
      onChange([...value, rota])
    }
    setEditor(emptyEscopoRede())
    setEditando(-1)
  }
  const editar = (i: number) => {
    const rota = value[i]
    if (!rota) return
    setEditor(rota)
    setEditando(i)
  }
  const remover = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i))
    if (editando === i) {
      setEditor(emptyEscopoRede())
      setEditando(-1)
    } else if (editando > i) {
      setEditando(editando - 1)
    }
  }

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
      <div className="rounded-xl border border-neutral-200/90 bg-surface-container-low/40 p-3 dark:border-white/10">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span className={LABEL}>Ponto de acesso</span>
            <select
              className={SELECT}
              value={editor.apCode}
              onChange={(e) => {
                const ap = options.aps.find((a) => a.code === e.target.value)
                update(ap ? { ...emptyEscopoRede(), apCode: ap.code, apTitle: ap.title } : emptyEscopoRede())
              }}
            >
              <option value="">Escolher…</option>
              {options.aps.map((a) => (
                <option key={a.code} value={a.code}>{a.title}</option>
              ))}
            </select>
          </label>

          <label>
            <span className={LABEL}>Slot</span>
            <select
              className={SELECT}
              value={editor.slot ?? ''}
              disabled={editor.apCode === ''}
              onChange={(e) => update({ ...editor, slot: e.target.value === '' ? null : Number(e.target.value), ports: [] })}
            >
              <option value="">Todos os slots</option>
              {options.slots.map((s) => (
                <option key={s} value={s}>Slot {s}</option>
              ))}
            </select>
          </label>

          {editor.slot !== null ? (
            <div className="sm:col-span-2">
              <span className={LABEL}>PON (marque uma ou mais; vazio = todas do slot)</span>
              <CheckList
                items={options.ports.map((p) => ({ value: p, label: `PON ${p}` }))}
                selected={editor.ports}
                onToggle={(p) => update({ ...editor, ports: toggle(editor.ports, p) })}
              />
            </div>
          ) : null}

          {editor.apCode !== '' ? (
            <div className="sm:col-span-2">
              <span className={LABEL}>Splitter (opcional; marque um ou mais, vazio = todos)</span>
              <CheckList
                items={options.splitters.map((s) => ({ value: s.code, label: s.title }))}
                selected={editor.splitters.map((s) => s.code)}
                onToggle={(code) => {
                  const exists = editor.splitters.some((s) => s.code === code)
                  const found = options.splitters.find((s) => s.code === code)
                  update({
                    ...editor,
                    splitters: exists ? editor.splitters.filter((s) => s.code !== code) : found ? [...editor.splitters, found] : editor.splitters,
                  })
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs text-on-surface-variant">
            {podeAdicionar ? `Rota atual: ${formatEscopoRede(editor)}` : 'Escolha um ponto de acesso para montar uma rota.'}
          </p>
          {editando >= 0 ? (
            <button
              type="button"
              onClick={() => {
                setEditor(emptyEscopoRede())
                setEditando(-1)
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface-variant ring-1 ring-neutral-200/80 hover:bg-surface-container-low dark:ring-white/10"
            >
              Cancelar edição
            </button>
          ) : null}
          <button
            type="button"
            onClick={adicionar}
            disabled={!podeAdicionar}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {editando >= 0 ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
            {editando >= 0 ? 'Salvar alteração' : 'Adicionar rota'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-surface-container-lowest p-4 dark:border-white/10 sm:col-span-2 sm:p-5">
      <p className="text-sm font-bold text-on-surface">Abrangência na rede (opcional)</p>
      <p className="mb-3 mt-0.5 text-xs text-on-surface-variant">
        Monte uma rota e clique em Adicionar; repita para outras OLTs ou placas. Sem nenhuma rota, vale para o POP/Site inteiro e todos os clientes corporativos dele são avisados.
      </p>
      {body}

      <div className="mt-4">
        <div className="mb-1.5 flex items-center gap-2">
          <p className="text-xs font-bold text-on-surface">Abrangência escolhida</p>
          <span className="rounded-full bg-surface-container-low px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
            {value.length} rota{value.length === 1 ? '' : 's'}
          </span>
        </div>
        {value.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-3 text-center text-xs text-on-surface-variant dark:border-white/15">
            Nenhuma rota: a GMUD vale para o site inteiro.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {value.map((r, i) => (
              <li
                key={escopoRotaKey(r)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                  editando === i ? 'border-primary bg-primary/10' : 'border-neutral-200/90 dark:border-white/10',
                )}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-[11px] font-bold text-on-surface-variant" aria-hidden>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 break-words text-on-surface">{formatEscopoRede(r)}</span>
                <button type="button" onClick={() => editar(i)} className="shrink-0 text-xs font-semibold text-on-surface underline-offset-2 hover:underline">
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => remover(i)}
                  className="shrink-0 rounded-md p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-error"
                  aria-label={`Remover rota ${i + 1}`}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
