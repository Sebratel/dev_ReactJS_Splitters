import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useGmudPainelContagens, useGmudPainelLista, useGmudSolicitantes, type GmudPainelContagens } from '@/features/gmud/api/gmudPainel'
import {
  ABAS,
  canceladasOcultas,
  limparFiltros,
  parametrosDaApi,
  temFiltros,
  type GmudAba,
  type GmudPainelFiltros,
} from '@/features/gmud/lib/gmudPainelFiltros'
import type { GmudListItem, GmudSortKey } from '@/features/gmud/model/gmud'
import { GmudFiltroConstrutor } from '@/features/gmud/ui/GmudFiltroConstrutor'
import { GmudListTable } from '@/features/gmud/ui/GmudListTable'
import { GmudBusy } from '@/features/gmud/ui/GmudTransitions'
import { cn } from '@/shared/lib/utils'

const PAGE_SIZE = 20
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white'
const n = (v: number) => v.toLocaleString('pt-BR')

/** Abas rápidas do painel, cada uma com a contagem considerando os filtros ativos. */
export function GmudPainelAbas({ aba, contagens, onChange }: { aba: GmudAba; contagens: GmudPainelContagens | undefined; onChange: (aba: GmudAba) => void }) {
  return (
    <div role="group" aria-label="Atalhos da lista" className="flex flex-wrap gap-1">
      {ABAS.map((a) => {
        const ativa = aba === a.key
        const total = contagens?.[a.key]
        return (
          <button
            key={a.key}
            type="button"
            aria-pressed={ativa}
            onClick={() => onChange(a.key)}
            className={cn(
              'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors',
              FOCO,
              ativa ? 'bg-primary text-neutral-900' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
            )}
          >
            {a.label}
            <span
              className={cn(
                'min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold tabular-nums',
                ativa ? 'bg-neutral-900 text-white' : 'bg-surface-container-low text-on-surface ring-1 ring-neutral-300 dark:ring-white/20',
              )}
            >
              {total === undefined ? '–' : n(total)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Rodapé das canceladas: quantas estão ocultas, com o atalho para mostrar/ocultar. */
export function GmudCanceladasRodape({ filtros, canceladas, onChange }: { filtros: GmudPainelFiltros; canceladas: number | undefined; onChange: (next: GmudPainelFiltros) => void }) {
  const LINK = cn('font-semibold text-on-surface underline underline-offset-2 hover:no-underline', FOCO)
  // Pedindo a situação "Cancelada" elas já aparecem pelo filtro: o atalho não se aplica.
  if (filtros.situacao.includes('cancelada')) return null
  if (canceladasOcultas(filtros)) {
    if (!canceladas) return null
    return (
      <p className="text-xs text-on-surface-variant">
        {n(canceladas)} cancelada{canceladas === 1 ? '' : 's'} oculta{canceladas === 1 ? '' : 's'} ·{' '}
        <button type="button" onClick={() => onChange({ ...filtros, mostrarCanceladas: true, pagina: 0 })} className={LINK}>
          mostrar
        </button>
      </p>
    )
  }
  return (
    <p className="text-xs text-on-surface-variant">
      Mostrando as canceladas{canceladas ? ` (${n(canceladas)})` : ''} ·{' '}
      <button type="button" onClick={() => onChange({ ...filtros, mostrarCanceladas: false, pagina: 0 })} className={LINK}>
        ocultar
      </button>
    </p>
  )
}

/**
 * Cartão do painel de GMUDs: abas com contagem, busca, construtor de filtros, tabela, paginação e o rodapé
 * das canceladas. O estado dos filtros vem de fora (mora na URL); aqui só se lê e se pede a mudança.
 */
export function GmudPainelLista({
  filtros,
  onChange,
  canApprove,
  onLink,
  onApprove,
}: {
  filtros: GmudPainelFiltros
  /** `substituir` troca a entrada do histórico em vez de criar outra (usado pela busca enquanto se digita). */
  onChange: (next: GmudPainelFiltros, opts?: { substituir?: boolean }) => void
  canApprove: boolean
  onLink: (g: GmudListItem) => void
  onApprove: (g: GmudListItem) => void
}) {
  const api = parametrosDaApi(filtros)
  const { data, isLoading, isError, error, isPlaceholderData } = useGmudPainelLista({ api, limit: PAGE_SIZE, offset: filtros.pagina * PAGE_SIZE, sort: filtros.sort })
  const contagens = useGmudPainelContagens(api).data
  const [querSolicitantes, setQuerSolicitantes] = useState(false)
  const solicitantesQuery = useGmudSolicitantes(querSolicitantes)

  // Busca com espera de 400 ms; o campo acompanha a URL quando ela muda por fora (voltar do navegador, limpar).
  const [busca, setBusca] = useState(filtros.q)
  useEffect(() => {
    setBusca((atual) => (atual.trim() === filtros.q ? atual : filtros.q))
  }, [filtros.q])
  useEffect(() => {
    if (busca.trim() === filtros.q) return
    const t = window.setTimeout(() => onChange({ ...filtros, q: busca.trim(), pagina: 0 }, { substituir: true }), 400)
    return () => window.clearTimeout(t)
    // `filtros` e `onChange` mudam a cada render; a espera só deve recomeçar quando o texto muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca])

  const total = data?.total ?? 0
  const items = data?.items ?? []
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstShown = total === 0 ? 0 : filtros.pagina * PAGE_SIZE + 1
  const lastShown = Math.min(total, filtros.pagina * PAGE_SIZE + items.length)
  const filtrado = temFiltros(filtros) || filtros.aba !== 'todas'

  // Clique na mesma coluna inverte a direção; em outra coluna começa pela ordem mais útil
  // (datas e protocolo: mais recentes primeiro; textos: A→Z).
  const ordenar = (key: GmudSortKey) =>
    onChange({
      ...filtros,
      pagina: 0,
      sort:
        filtros.sort.key === key
          ? { key, dir: filtros.sort.dir === 'asc' ? 'desc' : 'asc' }
          : { key, dir: key === 'solicitante' || key === 'status' || key === 'prazo' ? 'asc' : 'desc' },
    })
  const PAGINA = cn('inline-flex size-8 items-center justify-center rounded-md text-on-surface ring-1 ring-neutral-300 transition hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40 dark:ring-white/20', FOCO)

  return (
    <>
      <div className="space-y-3 border-b border-neutral-200/80 p-3 dark:border-white/15 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <GmudPainelAbas aba={filtros.aba} contagens={contagens} onChange={(aba) => onChange({ ...filtros, aba, pagina: 0 })} />
          <p className="text-xs text-on-surface-variant" aria-live="polite">
            {n(total)} protocolo{total === 1 ? '' : 's'}
            {filtrado ? ' (filtrado)' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <div className="relative w-full sm:w-72">
            <Search size={15} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar protocolo, título ou solicitante…"
              aria-label="Buscar GMUD"
              className="h-9 w-full rounded-lg border border-neutral-300 bg-surface-container-lowest pl-8 pr-2.5 text-sm text-on-surface outline-none focus:border-neutral-900 dark:border-white/20 dark:focus:border-white"
            />
          </div>
          <div className="min-w-0 flex-1">
            <GmudFiltroConstrutor
              filtros={filtros}
              onChange={onChange}
              solicitantes={solicitantesQuery.data ?? []}
              solicitantesCarregando={solicitantesQuery.isLoading}
              onAbrirSolicitantes={() => setQuerSolicitantes(true)}
            />
          </div>
        </div>
      </div>

      {/* Trocar filtro/ordem/página mantém a lista anterior, esmaecida, até a nova chegar. */}
      <GmudBusy busy={isPlaceholderData} enter key={isLoading ? 'carregando' : 'conteudo'}>
        {isLoading ? (
          <p className="py-10 text-center text-sm text-on-surface-variant">Carregando GMUDs…</p>
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error instanceof Error ? error.message : 'Falha ao carregar as GMUDs.'}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-on-surface">{filtrado ? 'Nenhuma GMUD com esses filtros' : 'Nenhuma GMUD encontrada'}</p>
            {temFiltros(filtros) ? (
              <button
                type="button"
                onClick={() => onChange(limparFiltros(filtros))}
                className={cn('mt-3 rounded-lg px-3 py-1.5 text-sm font-semibold text-on-surface ring-1 ring-neutral-300 transition-colors hover:bg-surface-container-low dark:ring-white/20', FOCO)}
              >
                Limpar filtros
              </button>
            ) : null}
          </div>
        ) : (
          <GmudListTable items={items} canApprove={canApprove} onLink={onLink} onApprove={onApprove} sort={filtros.sort} onSort={ordenar} />
        )}
      </GmudBusy>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-neutral-200/80 px-4 py-2.5 dark:border-white/15">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {total > 0 ? (
            <span className="text-xs text-on-surface-variant">
              {firstShown}–{lastShown} de {n(total)}
            </span>
          ) : null}
          <GmudCanceladasRodape filtros={filtros} canceladas={contagens?.canceladas} onChange={onChange} />
        </div>
        {pageCount > 1 ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onChange({ ...filtros, pagina: Math.max(0, filtros.pagina - 1) })} disabled={filtros.pagina === 0} className={PAGINA} aria-label="Página anterior">
              <ChevronLeft size={16} aria-hidden />
            </button>
            <span className="px-1 text-xs font-semibold tabular-nums text-on-surface">
              {filtros.pagina + 1}/{pageCount}
            </span>
            <button
              type="button"
              onClick={() => onChange({ ...filtros, pagina: Math.min(pageCount - 1, filtros.pagina + 1) })}
              disabled={filtros.pagina >= pageCount - 1}
              className={PAGINA}
              aria-label="Próxima página"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </>
  )
}
