import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, Plus, X } from 'lucide-react'
import {
  ABERTURA_OPCOES,
  CAMPOS,
  ORIGEM_OPCOES,
  SITUACAO_OPCOES,
  TIPO_OPCOES,
  alternar,
  etiquetasDosFiltros,
  limparFiltros,
  removerFiltro,
  temFiltros,
  type GmudCampoFiltro,
  type GmudPainelFiltros,
} from '@/features/gmud/lib/gmudPainelFiltros'
import { shortRequesterName } from '@/features/gmud/lib/gmudRequester'
import { cn } from '@/shared/lib/utils'

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white'
const ITEM =
  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-on-surface transition-colors hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white'

type Opcao = { valor: string; label: string; marcada: boolean }

/** Caixa de seleção (ou de opção única) desenhada: o estado real fica no aria-checked do item. */
function Marca({ marcada, unica }: { marcada: boolean; unica: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center border',
        unica ? 'rounded-full' : 'rounded',
        marcada ? 'border-neutral-900 bg-primary text-neutral-900' : 'border-neutral-400 dark:border-white/40',
      )}
    >
      {marcada ? <Check size={11} strokeWidth={3.5} /> : null}
    </span>
  )
}

/**
 * Construtor de filtros do painel de GMUDs: o botão "+ Filtro" abre um menu (Situação, Abertura, Tipo,
 * Origem, Solicitante) e cada campo abre as opções com caixas de seleção (Abertura é seleção única).
 * Os filtros ativos aparecem como etiquetas "Situação é um de …": clicar no texto reabre as opções e o X tira.
 * Teclado: setas andam pelos itens, Enter/Espaço marcam, seta para a esquerda volta e Esc fecha.
 */
export function GmudFiltroConstrutor({
  filtros,
  onChange,
  solicitantes,
  solicitantesCarregando = false,
  onAbrirSolicitantes,
}: {
  filtros: GmudPainelFiltros
  onChange: (next: GmudPainelFiltros) => void
  /** Nomes disponíveis para o filtro "Solicitante". */
  solicitantes: string[]
  solicitantesCarregando?: boolean
  /** Avisa que o filtro de solicitante foi aberto (para buscar os nomes só quando preciso). */
  onAbrirSolicitantes?: () => void
}) {
  const menuId = useId()
  const [aberto, setAberto] = useState<null | 'campos' | GmudCampoFiltro>(null)
  const [busca, setBusca] = useState('')
  const caixaRef = useRef<HTMLDivElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const abrir = (alvo: 'campos' | GmudCampoFiltro) => {
    setBusca('')
    setAberto(alvo)
    if (alvo === 'solicitante') onAbrirSolicitantes?.()
  }
  const fechar = (devolverFoco = true) => {
    setAberto(null)
    if (devolverFoco) botaoRef.current?.focus()
  }

  // Ao abrir (ou trocar de campo), o foco vai para o primeiro item — ou para a busca, no solicitante.
  useEffect(() => {
    if (aberto === null) return
    const alvo = menuRef.current?.querySelector<HTMLElement>('input') ?? menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')
    alvo?.focus()
  }, [aberto])

  // Fecha ao clicar fora.
  useEffect(() => {
    if (aberto === null) return
    const fora = (e: MouseEvent) => {
      if (!caixaRef.current?.contains(e.target as Node)) setAberto(null)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  const mudar = (next: Partial<GmudPainelFiltros>) => onChange({ ...filtros, ...next, pagina: 0 })

  const opcoes = (campo: GmudCampoFiltro): Opcao[] => {
    if (campo === 'situacao') return SITUACAO_OPCOES.map((o) => ({ valor: o.key, label: o.label, marcada: filtros.situacao.includes(o.key) }))
    if (campo === 'abertura') return ABERTURA_OPCOES.map((o) => ({ valor: String(o.key), label: o.label, marcada: filtros.abertura === o.key }))
    if (campo === 'tipo') return TIPO_OPCOES.map((o) => ({ valor: o.key, label: o.label, marcada: filtros.tipo.includes(o.key) }))
    if (campo === 'origem') return ORIGEM_OPCOES.map((o) => ({ valor: o.key, label: o.label, marcada: filtros.origem.includes(o.key) }))
    // Solicitante: os já escolhidos sempre aparecem, mesmo que a lista ainda não tenha chegado.
    const nomes = [...new Set([...filtros.solicitante, ...solicitantes])]
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return nomes
      .filter((n) => termo === '' || n.toLocaleLowerCase('pt-BR').includes(termo))
      .slice(0, 80)
      .map((n) => ({ valor: n, label: shortRequesterName(n), marcada: filtros.solicitante.includes(n) }))
  }

  const escolher = (campo: GmudCampoFiltro, valor: string) => {
    // Liga/desliga o valor mantendo a ordem das opções.
    if (campo === 'situacao') mudar({ situacao: SITUACAO_OPCOES.map((o) => o.key).filter((k) => (k === valor ? !filtros.situacao.includes(k) : filtros.situacao.includes(k))) })
    else if (campo === 'abertura') mudar({ abertura: ABERTURA_OPCOES.find((o) => String(o.key) === valor && filtros.abertura !== o.key)?.key ?? null })
    else if (campo === 'tipo') mudar({ tipo: TIPO_OPCOES.map((o) => o.key).filter((k) => (k === valor ? !filtros.tipo.includes(k) : filtros.tipo.includes(k))) })
    else if (campo === 'origem') mudar({ origem: ORIGEM_OPCOES.map((o) => o.key).filter((k) => (k === valor ? !filtros.origem.includes(k) : filtros.origem.includes(k))) })
    else mudar({ solicitante: alternar(filtros.solicitante, valor) })
  }

  const noTeclado = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      fechar()
      return
    }
    const naBusca = e.target instanceof HTMLInputElement
    if (e.key === 'ArrowLeft' && aberto !== 'campos' && !naBusca) {
      e.preventDefault()
      abrir('campos')
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) || (naBusca && (e.key === 'Home' || e.key === 'End'))) return
    const itens = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])
    if (itens.length === 0) return
    e.preventDefault()
    const atual = itens.indexOf(document.activeElement as HTMLElement)
    const proximo =
      e.key === 'Home' ? 0 : e.key === 'End' ? itens.length - 1 : e.key === 'ArrowDown' ? (atual + 1) % itens.length : atual <= 0 ? itens.length - 1 : atual - 1
    itens[proximo]?.focus()
  }

  const etiquetas = etiquetasDosFiltros(filtros)
  const campoAberto = aberto !== null && aberto !== 'campos' ? aberto : null
  const lista = campoAberto ? opcoes(campoAberto) : []
  const unica = campoAberto === 'abertura'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div ref={caixaRef} className="relative">
          <button
            ref={botaoRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={aberto !== null}
            aria-controls={aberto !== null ? menuId : undefined}
            onClick={() => (aberto === null ? abrir('campos') : fechar(false))}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-neutral-400 px-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low dark:border-white/40',
              FOCO,
            )}
          >
            <Plus size={15} aria-hidden /> Filtro
          </button>

          {aberto !== null ? (
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={campoAberto ? `Opções de ${CAMPOS.find((c) => c.key === campoAberto)?.label}` : 'Adicionar filtro'}
              onKeyDown={noTeclado}
              className="gmud-fade absolute left-0 top-full z-40 mt-1 w-[min(18rem,calc(100vw-3rem))] rounded-xl border border-neutral-300 bg-surface-container-lowest p-1.5 shadow-xl dark:border-white/20"
            >
              {campoAberto === null ? (
                CAMPOS.map((c) => {
                  const ativa = etiquetas.find((e) => e.campo === c.key)
                  return (
                    <button key={c.key} type="button" role="menuitem" aria-haspopup="menu" onClick={() => abrir(c.key)} className={ITEM}>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{c.label}</span>
                        {ativa ? <span className="block truncate text-xs text-on-surface-variant">{ativa.texto}</span> : null}
                      </span>
                      <ChevronRight size={15} aria-hidden className="shrink-0 text-on-surface-variant" />
                    </button>
                  )
                })
              ) : (
                <>
                  <button type="button" role="menuitem" onClick={() => abrir('campos')} className={cn(ITEM, 'font-semibold')}>
                    <ArrowLeft size={15} aria-hidden className="shrink-0" />
                    {CAMPOS.find((c) => c.key === campoAberto)?.label}
                  </button>
                  {campoAberto === 'solicitante' ? (
                    <input
                      type="search"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar solicitante…"
                      aria-label="Buscar solicitante"
                      className="my-1 h-9 w-full rounded-lg border border-neutral-300 bg-surface-container-lowest px-2.5 text-sm text-on-surface outline-none focus:border-neutral-900 dark:border-white/20 dark:focus:border-white"
                    />
                  ) : null}
                  <div className="max-h-64 overflow-y-auto">
                    {lista.map((o) => (
                      <button
                        key={o.valor}
                        type="button"
                        role={unica ? 'menuitemradio' : 'menuitemcheckbox'}
                        aria-checked={o.marcada}
                        title={campoAberto === 'solicitante' ? o.valor : undefined}
                        onClick={() => escolher(campoAberto, o.valor)}
                        className={ITEM}
                      >
                        <Marca marcada={o.marcada} unica={unica} />
                        <span className="min-w-0 truncate">{o.label}</span>
                      </button>
                    ))}
                    {lista.length === 0 ? (
                      <p className="px-2.5 py-2 text-sm text-on-surface-variant">
                        {campoAberto === 'solicitante' && solicitantesCarregando ? 'Carregando solicitantes…' : 'Nenhuma opção encontrada.'}
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        {etiquetas.map((e) => (
          <span key={e.id} className="inline-flex max-w-full items-center rounded-full border border-neutral-300 bg-surface-container-low text-xs text-on-surface dark:border-white/20">
            {e.campo ? (
              <button
                type="button"
                onClick={() => abrir(e.campo as GmudCampoFiltro)}
                title="Mudar as opções deste filtro"
                className={cn('min-w-0 truncate rounded-l-full py-1 pl-3 pr-1.5 transition-colors hover:bg-neutral-900/5 dark:hover:bg-white/10', FOCO)}
              >
                <span className="font-semibold">{e.rotulo}</span> {e.texto}
              </button>
            ) : (
              <span className="min-w-0 truncate py-1 pl-3 pr-1.5">
                <span className="font-semibold">{e.rotulo}</span> {e.texto}
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(removerFiltro(filtros, e.id))}
              aria-label={`Remover filtro ${e.rotulo}`}
              className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-neutral-900/10 hover:text-on-surface dark:hover:bg-white/15', FOCO)}
            >
              <X size={13} aria-hidden />
            </button>
          </span>
        ))}

        {temFiltros(filtros) ? (
          <button
            type="button"
            onClick={() => onChange(limparFiltros(filtros))}
            className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-on-surface underline-offset-2 hover:underline', FOCO)}
          >
            Limpar filtros
          </button>
        ) : null}
      </div>
      {etiquetas.length === 0 ? <p className="text-xs text-on-surface-variant">Nenhum filtro aplicado. Use “+ Filtro” para refinar a lista.</p> : null}
    </div>
  )
}
