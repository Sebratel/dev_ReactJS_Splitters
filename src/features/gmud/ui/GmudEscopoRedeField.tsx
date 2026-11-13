import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronRight, Loader2, Plus, Search, Trash2 } from 'lucide-react'
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

const CHIP_OFF = 'border-neutral-300 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low dark:border-white/15'
const CHIP_ON = 'border-primary bg-primary/20 font-semibold text-on-surface'

function Chip({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn('rounded-lg border text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50', on ? CHIP_ON : CHIP_OFF, className)}
    >
      {children}
    </button>
  )
}

/**
 * Abrangência opcional da GMUD dentro do POP/Site, em várias rotas (ponto de acesso → slot → PON → splitter),
 * como na massiva: as rotas já escolhidas ficam no topo; abaixo, o editor monta a próxima. Sem rotas, vale o site inteiro.
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
  const [splitterAberto, setSplitterAberto] = useState(false)
  const [busca, setBusca] = useState('')

  const siteRows = useMemo(() => routesForSite(routesQuery.data ?? [], site), [routesQuery.data, site])
  const options = useMemo(() => buildEscopoRedeOptions(siteRows, editor), [siteRows, editor])

  const update = (next: GmudEscopoRede) => setEditor(pruneEscopoRede(next, buildEscopoRedeOptions(siteRows, next)))
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((i) => i !== item) : [...list, item])

  const limparEditor = () => {
    setEditor(emptyEscopoRede())
    setEditando(-1)
    setSplitterAberto(false)
    setBusca('')
  }
  const podeAdicionar = hasEscopoRede(editor)
  const adicionar = () => {
    const rota = normalizeEscopoRede(editor)
    if (!rota) return
    if (editando >= 0) {
      onChange(value.map((r, i) => (i === editando ? rota : r)))
    } else if (!value.some((r) => escopoRotaKey(r) === escopoRotaKey(rota))) {
      onChange([...value, rota])
    }
    limparEditor()
  }
  const editar = (i: number) => {
    const rota = value[i]
    if (!rota) return
    setEditor(rota)
    setEditando(i)
    setSplitterAberto(rota.splitters.length > 0)
  }
  const remover = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i))
    if (editando === i) limparEditor()
    else if (editando > i) setEditando(editando - 1)
  }

  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const grupos = options.splitterGroups
    .map((g) => ({ ...g, items: g.items.filter((s) => termo === '' || s.title.toLocaleLowerCase('pt-BR').includes(termo)) }))
    .filter((g) => g.items.length > 0)

  const caminhoSlot = editor.apCode === '' ? '' : editor.slot === null ? 'todos os slots' : `Slot ${editor.slot}`
  const caminhoPon =
    editor.slot === null ? '' : editor.ports.length === 0 ? 'todas as PONs' : `${editor.ports.length > 1 ? 'PONs' : 'PON'} ${editor.ports.join(', ')}`

  let editorUi: React.ReactNode
  if (site.length < 2) {
    editorUi = <p className="text-xs text-on-surface-variant">Informe o POP/Site para poder afunilar por ponto de acesso, slot, PON e splitter.</p>
  } else if (routesQuery.isLoading) {
    editorUi = (
      <p className="flex items-center gap-2 text-xs text-on-surface-variant">
        <Loader2 size={14} className="animate-spin" /> Carregando pontos de acesso do site…
      </p>
    )
  } else if (routesQuery.isError) {
    editorUi = <p className="text-xs text-red-600 dark:text-red-400">Não foi possível carregar as rotas da rede. A GMUD valerá para o site inteiro.</p>
  } else if (siteRows.length === 0) {
    editorUi = <p className="text-xs text-on-surface-variant">Não há rotas cadastradas para o site “{site}”. A GMUD valerá para o site inteiro.</p>
  } else {
    editorUi = (
      <div className="rounded-xl border border-neutral-200/90 bg-surface-container-low/40 p-3 dark:border-white/10">
        <label className="block">
          <span className={LABEL}>Ponto de acesso (OLT)</span>
          <select
            className={SELECT}
            value={editor.apCode}
            onChange={(e) => {
              const ap = options.aps.find((a) => a.code === e.target.value)
              update(ap ? { ...emptyEscopoRede(), apCode: ap.code, apTitle: ap.title } : emptyEscopoRede())
              setSplitterAberto(false)
              setBusca('')
            }}
          >
            <option value="">Escolher…</option>
            {options.aps.map((a) => (
              <option key={a.code} value={a.code}>{a.title}</option>
            ))}
          </select>
        </label>

        {editor.apCode !== '' ? (
          <>
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant" aria-label="Caminho da rota">
              <span>Caminho:</span>
              <span className="rounded-full border border-primary bg-primary/20 px-2.5 py-0.5 font-semibold text-on-surface">{editor.apTitle}</span>
              <ChevronRight size={12} aria-hidden />
              <span className="rounded-full border border-primary bg-primary/20 px-2.5 py-0.5 font-semibold text-on-surface">{caminhoSlot}</span>
              {caminhoPon !== '' ? (
                <>
                  <ChevronRight size={12} aria-hidden />
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-0.5',
                      editor.ports.length > 0 ? 'border-primary bg-primary/20 font-semibold text-on-surface' : 'border-neutral-300 dark:border-white/15',
                    )}
                  >
                    {caminhoPon}
                  </span>
                </>
              ) : null}
            </p>

            <div className="mt-3">
              <span className={LABEL}>Slot <span className="font-normal">(um por rota; para outro slot, adicione outra rota)</span></span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Chip on={editor.slot === null} onClick={() => update({ ...editor, slot: null, ports: [] })} className="px-3 py-1.5">
                  Todos os slots
                </Chip>
                {options.slots.map((s) => (
                  <Chip key={s} on={editor.slot === s} onClick={() => update({ ...editor, slot: s, ports: [] })} className="px-3 py-1.5">
                    Slot {s}
                  </Chip>
                ))}
              </div>
            </div>

            {editor.slot !== null ? (
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={LABEL}>PONs</span>
                  <button
                    type="button"
                    onClick={() => update({ ...editor, ports: [] })}
                    className="rounded-lg border border-neutral-300 px-2.5 py-0.5 text-xs font-semibold text-on-surface hover:bg-surface-container-low dark:border-white/15"
                  >
                    Todas do slot
                  </button>
                  {editor.ports.length > 0 ? (
                    <button type="button" onClick={() => update({ ...editor, ports: [], splitters: [] })} className="text-xs font-semibold text-on-surface-variant underline-offset-2 hover:underline">
                      Limpar
                    </button>
                  ) : null}
                  <span className="flex-1" />
                  <span className="text-xs text-on-surface-variant">
                    {editor.ports.length > 0 ? `${editor.ports.length} de ${options.ports.length} marcadas` : `nenhuma marcada = todas as ${options.ports.length}`}
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                  {options.ports.map((p) => (
                    <Chip key={p} on={editor.ports.includes(p)} onClick={() => update({ ...editor, ports: toggle(editor.ports, p) })} className="py-1.5 text-center">
                      {p}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-3 border-t border-dashed border-neutral-300 pt-3 dark:border-white/15">
              <button
                type="button"
                aria-expanded={splitterAberto}
                onClick={() => setSplitterAberto((v) => !v)}
                className="flex items-center gap-1.5 text-sm text-on-surface"
              >
                {splitterAberto ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                <span className="font-semibold">Refinar por splitter</span>
                <span className="text-on-surface-variant">(opcional)</span>
                {editor.splitters.length > 0 ? (
                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                    · {editor.splitters.length} marcado{editor.splitters.length === 1 ? '' : 's'}
                  </span>
                ) : null}
              </button>
              {splitterAberto ? (
                <div className="mt-2">
                  <div className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-surface-container-lowest px-2.5 py-1.5 dark:border-white/15">
                    <Search size={14} className="text-on-surface-variant" aria-hidden />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar splitter, ex.: 422"
                      aria-label="Buscar splitter"
                      className="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none"
                    />
                  </div>
                  <div className="mt-2 max-h-52 overflow-auto rounded-lg border border-neutral-200 p-2 dark:border-white/10">
                    {grupos.length === 0 ? (
                      <p className="text-xs text-on-surface-variant">Nenhum splitter encontrado.</p>
                    ) : (
                      grupos.map((g) => (
                        <div key={g.label} className="mb-2 last:mb-0">
                          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{g.label}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {g.items.map((s) => {
                              const on = editor.splitters.some((x) => x.code === s.code)
                              return (
                                <Chip
                                  key={s.code}
                                  on={on}
                                  onClick={() =>
                                    update({
                                      ...editor,
                                      splitters: on ? editor.splitters.filter((x) => x.code !== s.code) : [...editor.splitters, s],
                                    })
                                  }
                                  className="px-2.5 py-1 text-xs"
                                >
                                  {s.title}
                                </Chip>
                              )
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-200/70 pt-3 dark:border-white/10">
          <p className="min-w-0 flex-1 text-xs text-on-surface-variant">
            {podeAdicionar ? (
              <>
                <span className="font-semibold text-on-surface">Rota atual:</span> {formatEscopoRede(editor)}
              </>
            ) : (
              'Escolha um ponto de acesso para montar uma rota.'
            )}
          </p>
          {editando >= 0 ? (
            <button
              type="button"
              onClick={limparEditor}
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
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-on-surface">Abrangência na rede (opcional)</p>
        <span className="flex-1" />
        <span className="rounded-full bg-surface-container-low px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
          {value.length} rota{value.length === 1 ? '' : 's'}
        </span>
      </div>
      <p className="mb-3 mt-0.5 text-xs text-on-surface-variant">
        Monte uma rota e clique em Adicionar; repita para outras OLTs ou placas. Sem nenhuma rota, vale para o POP/Site inteiro e todos os clientes corporativos dele são avisados.
      </p>

      {value.length === 0 ? (
        <p className="mb-3 rounded-lg border border-dashed border-neutral-300 px-3 py-3 text-center text-xs text-on-surface-variant dark:border-white/15">
          Nenhuma rota: a GMUD vale para o site inteiro.
        </p>
      ) : (
        <ul className="mb-3 space-y-1.5" aria-label="Abrangência escolhida">
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

      {editorUi}
    </div>
  )
}
