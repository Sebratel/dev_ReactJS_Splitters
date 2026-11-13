import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { searchGmudClientesElleven, type GmudClienteElleven } from '@/features/gmud/api/gmudClientesElleven'
import {
  GMUD_CLIENTES_SEM_SPLITTER_MAX,
  GMUD_CLIENTE_SEM_SPLITTER_TIPOS,
  type GmudClienteSemSplitter,
} from '@/features/gmud/model/gmudClientesSemSplitter'
import { GMUD_CLIENTES_MANUAIS_MAX } from '@/features/gmud/model/gmudForm'
import { cn } from '@/shared/lib/utils'

const FIELD =
  'w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30'

function podeBuscar(q: string): boolean {
  const t = q.trim()
  return /^\d+$/.test(t) ? t.length >= 1 : t.length >= 3
}

/**
 * Clientes corporativos que não estão em splitter (ponto a ponto, fibra apagada): busca no Elleven por nome,
 * contrato ou usuário e escolhe. Entram nos afetados pelo contrato, como os clientes da abrangência.
 */
export function GmudClientesSemSplitterField({
  value,
  onChange,
  observacao,
  onObservacao,
}: {
  value: GmudClienteSemSplitter[]
  onChange: (next: GmudClienteSemSplitter[]) => void
  observacao: string
  onObservacao: (next: string) => void
}) {
  const [termo, setTermo] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(termo.trim()), 350)
    return () => window.clearTimeout(t)
  }, [termo])

  const query = useQuery({
    queryKey: ['gmud', 'clientes-elleven', debounced],
    queryFn: () => searchGmudClientesElleven(debounced),
    enabled: podeBuscar(debounced),
    staleTime: 60_000,
    retry: false,
  })

  const escolhidos = new Set(value.map((c) => c.contractId))
  const cheio = value.length >= GMUD_CLIENTES_SEM_SPLITTER_MAX
  const adicionar = (c: GmudClienteElleven) => {
    if (escolhidos.has(c.contractId) || cheio) return
    onChange([...value, { contractId: c.contractId, nome: c.nome, pppoe: c.pppoe, tipo: c.tipoSugerido }])
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-surface-container-lowest px-2.5 py-1.5 dark:border-white/10">
          <Search size={14} className="text-on-surface-variant" aria-hidden />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar cliente no Elleven por nome, contrato ou usuário"
            aria-label="Buscar cliente corporativo no Elleven"
            className="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none"
          />
          {query.isFetching ? <Loader2 size={14} className="animate-spin text-on-surface-variant" aria-hidden /> : null}
        </div>

        {podeBuscar(debounced) ? (
          <div className="mt-1.5 max-h-56 overflow-auto rounded-lg border border-neutral-200 dark:border-white/10">
            {query.isError ? (
              <p className="p-3 text-xs text-red-600 dark:text-red-400">
                {query.error instanceof Error ? query.error.message : 'Não foi possível buscar agora.'}
              </p>
            ) : query.isLoading ? (
              <p className="p-3 text-xs text-on-surface-variant">Buscando…</p>
            ) : (query.data ?? []).length === 0 ? (
              <p className="p-3 text-xs text-on-surface-variant">Nenhum cliente corporativo encontrado.</p>
            ) : (
              <ul className="divide-y divide-neutral-200/60 dark:divide-white/5">
                {(query.data ?? []).map((c) => {
                  const ja = escolhidos.has(c.contractId)
                  return (
                    <li key={c.contractId}>
                      <button
                        type="button"
                        disabled={ja || cheio}
                        onClick={() => adicionar(c)}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Plus size={14} className="mt-0.5 shrink-0 text-on-surface-variant" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-on-surface">{c.nome}</span>
                          <span className="block truncate text-xs text-on-surface-variant">
                            Contrato {c.contractId}
                            {c.pontoAcesso ? ` · ${c.pontoAcesso}` : ''}
                            {c.produtos[0] ? ` · ${c.produtos[0]}` : ''}
                          </span>
                          <span className="mt-0.5 flex flex-wrap gap-1">
                            {c.emSplitter ? (
                              <span className="rounded-full bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant" title="Já está numa porta de splitter: entra pela abrangência se a rota o alcançar.">
                                em splitter
                              </span>
                            ) : null}
                            {c.pppoe === '' ? (
                              <span className="rounded-full bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">sem conexão (só contrato)</span>
                            ) : null}
                            {ja ? <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-on-surface">já escolhido</span> : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : termo.trim() !== '' ? (
          <p className="mt-1 text-[11px] text-on-surface-variant">Digite ao menos 3 letras, ou o número do contrato.</p>
        ) : null}
      </div>

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-2.5 text-center text-xs text-on-surface-variant dark:border-white/15">
          Nenhum cliente escolhido.
        </p>
      ) : (
        <ul className="space-y-1.5" aria-label="Clientes escolhidos">
          {value.map((c) => (
            <li key={c.contractId} className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200/90 px-3 py-2 dark:border-white/10">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-on-surface">{c.nome || 'Cliente'}</span>
                <span className="block text-xs text-on-surface-variant">Contrato {c.contractId}{c.pppoe ? ` · ${c.pppoe}` : ''}</span>
              </span>
              <div role="radiogroup" aria-label={`Tipo de ${c.nome || 'cliente'}`} className="flex rounded-lg bg-surface-container-low p-0.5 ring-1 ring-neutral-200/70 dark:ring-white/10">
                {GMUD_CLIENTE_SEM_SPLITTER_TIPOS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={c.tipo === t.value}
                    onClick={() => onChange(value.map((x) => (x.contractId === c.contractId ? { ...x, tipo: t.value } : x)))}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-semibold transition',
                      c.tipo === t.value ? 'bg-primary/25 text-on-surface ring-1 ring-primary' : 'text-on-surface-variant hover:text-on-surface',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.contractId !== c.contractId))}
                className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-error"
                aria-label={`Remover ${c.nome || 'cliente'}`}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {cheio ? <p className="text-xs text-on-surface-variant">Limite de {GMUD_CLIENTES_SEM_SPLITTER_MAX} clientes por GMUD.</p> : null}
      <textarea
        className={cn(FIELD, 'min-h-[64px]')}
        aria-label="Observações sobre esses clientes"
        placeholder="Observações (opcional): quem avisar, circuito, contato…"
        value={observacao}
        maxLength={GMUD_CLIENTES_MANUAIS_MAX}
        onChange={(e) => onObservacao(e.target.value)}
      />
    </div>
  )
}
