import { useMemo, useState } from 'react'
import { Building2, Home, Loader2, Search, Users, X } from 'lucide-react'
import { useEscapeKey } from '@/features/gmud/hooks/useEscapeKey'
import { useGmudImpactedClients } from '@/features/gmud/hooks/useGmudClients'

const PAGINA = 100

type Aba = 'residenciais' | 'corporativos'
type Escopo = { popSite: string; escopoRotas: unknown[]; clientesSemSplitter: unknown[] }

const fmt = (n: number) => n.toLocaleString('pt-BR')
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Popup no centro da tela com os clientes que a GMUD vai impactar, separados em residenciais e
 * corporativos. Só consulta o servidor enquanto está aberto.
 */
export function GmudClientesImpactadosModal({ escopo, onClose }: { escopo: Escopo; onClose: () => void }) {
  useEscapeKey(onClose)
  const { data, isLoading, isError } = useGmudImpactedClients(escopo, true)
  const [aba, setAba] = useState<Aba>('residenciais')
  const [busca, setBusca] = useState('')
  const [visiveis, setVisiveis] = useState(PAGINA)

  const grupos = useMemo(() => {
    const clientes = data?.clientes ?? []
    return {
      residenciais: clientes.filter((c) => !c.corporativo),
      corporativos: clientes.filter((c) => c.corporativo),
    }
  }, [data])

  const filtrados = useMemo(() => {
    const q = norm(busca.trim())
    const base = grupos[aba]
    if (q === '') return base
    return base.filter((c) => norm(c.nome).includes(q) || String(c.contractId).includes(q) || norm(c.pontoAcesso).includes(q))
  }, [grupos, aba, busca])

  const trocarAba = (a: Aba) => {
    setAba(a)
    setVisiveis(PAGINA)
  }
  const falhou = isError || Boolean(data?.erro)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Clientes impactados">
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-surface-container-lowest shadow-xl dark:border-white/10">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200/70 p-4 dark:border-white/10">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
              <Users size={15} className="text-primary" aria-hidden /> Clientes impactados
            </p>
            <p className="mt-0.5 truncate text-xs text-on-surface-variant">
              POP/Site <span className="font-mono">{escopo.popSite.trim()}</span>
              {data?.pronto ? <> · {fmt(data.total)} no total</> : null}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-low" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <p className="flex items-center gap-2 p-6 text-sm text-on-surface-variant" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden /> Buscando os clientes…
          </p>
        ) : falhou ? (
          <p role="alert" className="p-6 text-sm text-error">
            Não foi possível listar os clientes agora{data?.erro ? ` — ${data.erro}` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200/70 p-3 dark:border-white/10">
              <div role="tablist" aria-label="Tipo de cliente" className="flex gap-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={aba === 'residenciais'}
                  onClick={() => trocarAba('residenciais')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${aba === 'residenciais' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}
                >
                  <Home size={13} aria-hidden /> Residenciais · {fmt(grupos.residenciais.length)}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={aba === 'corporativos'}
                  onClick={() => trocarAba('corporativos')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${aba === 'corporativos' ? 'bg-error text-on-error' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}
                >
                  <Building2 size={13} aria-hidden /> Corporativos · {fmt(grupos.corporativos.length)}
                </button>
              </div>
              <label className="relative ml-auto min-w-[10rem] flex-1 sm:max-w-[16rem]">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" aria-hidden />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value)
                    setVisiveis(PAGINA)
                  }}
                  placeholder="Buscar nome, contrato ou ponto"
                  aria-label="Buscar cliente"
                  className="w-full rounded-lg border border-neutral-200 bg-surface-container-lowest py-1.5 pl-8 pr-2 text-xs text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-white/10"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filtrados.length === 0 ? (
                <p className="p-6 text-center text-sm text-on-surface-variant">
                  {busca.trim() !== '' ? 'Nenhum cliente encontrado para essa busca.' : `Nenhum cliente ${aba === 'corporativos' ? 'corporativo' : 'residencial'} neste escopo.`}
                </p>
              ) : (
                <ul className="divide-y divide-neutral-200/60 dark:divide-white/10">
                  {filtrados.slice(0, visiveis).map((c) => (
                    <li key={c.contractId} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <span className="min-w-0 truncate font-medium text-on-surface">{c.nome || 'Sem nome'}</span>
                      <span className="flex shrink-0 items-center gap-3 text-[11px] text-on-surface-variant">
                        {c.pontoAcesso ? <span className="hidden max-w-[10rem] truncate sm:inline">{c.pontoAcesso}</span> : null}
                        <span className="font-mono">#{c.contractId}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {filtrados.length > visiveis ? (
                <div className="p-3 text-center">
                  <button
                    type="button"
                    onClick={() => setVisiveis((v) => v + PAGINA)}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-low dark:border-white/10"
                  >
                    Mostrar mais ({fmt(filtrados.length - visiveis)} restantes)
                  </button>
                </div>
              ) : null}
            </div>
            {data?.truncado ? (
              <p className="border-t border-neutral-200/70 px-4 py-2 text-[11px] text-on-surface-variant dark:border-white/10">
                Lista limitada pelo tamanho; o total acima considera todos os clientes.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
