import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Building2, ListChecks, Loader2, Users } from 'lucide-react'
import { useGmudClientImpactEstimate } from '@/features/gmud/hooks/useGmudClients'
import { GmudClientesImpactadosModal } from '@/features/gmud/ui/GmudClientesImpactadosModal'

const DEBOUNCE_MS = 600
const COUNT_UP_MS = 700

type Escopo = { popSite: string; escopoRotas: unknown[]; clientesSemSplitter: unknown[] }

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')

/** Espera a pessoa parar de mexer no escopo antes de recalcular (evita uma consulta por clique). */
function useEscopoAssentado(escopo: Escopo): Escopo {
  const chave = JSON.stringify(escopo)
  const [assentado, setAssentado] = useState(escopo)
  useEffect(() => {
    const id = window.setTimeout(() => setAssentado(JSON.parse(chave) as Escopo), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [chave])
  return assentado
}

/** Número que "corre" até o novo valor. Com "reduzir movimento" no sistema, troca direto. */
function useContagemAnimada(alvo: number): number {
  const [valor, setValor] = useState(alvo)
  const atual = useRef(alvo)
  useEffect(() => {
    const reduzir = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduzir || atual.current === alvo) {
      atual.current = alvo
      setValor(alvo)
      return
    }
    const de = atual.current
    let inicio: number | null = null
    let quadro = 0
    const passo = (ts: number) => {
      if (inicio === null) inicio = ts
      const p = Math.min(1, (ts - inicio) / COUNT_UP_MS)
      const v = de + (alvo - de) * (1 - Math.pow(1 - p, 3))
      atual.current = v
      setValor(v)
      if (p < 1) quadro = window.requestAnimationFrame(passo)
    }
    quadro = window.requestAnimationFrame(passo)
    return () => window.cancelAnimationFrame(quadro)
  }, [alvo])
  return valor
}

/**
 * Quantos clientes a GMUD vai impactar, calculado ao vivo conforme o escopo é escolhido (POP/Site,
 * afunilamento e clientes ponto a ponto). Mostra o total (animado), o peso dos corporativos e avisa
 * quando passa do limite do envio aos afetados. Só informa: nunca bloqueia o envio do formulário.
 */
export function GmudClientesEstimativa(props: Escopo) {
  const escopo = useEscopoAssentado(props)
  const { data, isFetching, isError } = useGmudClientImpactEstimate(escopo)
  const total = data?.pronto ? (data.total ?? 0) : 0
  const corporativos = data?.pronto ? (data.corporativos ?? 0) : 0
  const limite = data?.limite ?? 0
  const animado = useContagemAnimada(total)
  const [verLista, setVerLista] = useState(false)

  if (props.popSite.trim() === '') return null

  const recalculando = isFetching || JSON.stringify(escopo) !== JSON.stringify(props)
  const falhou = isError || Boolean(data?.erro)
  const acimaDoLimite = Boolean(data?.pronto) && limite > 0 && total > limite
  const pctCorp = total > 0 ? (corporativos / total) * 100 : 0

  return (
    <section
      aria-label="Clientes impactados"
      className="rounded-xl border border-neutral-200/90 bg-surface-container-lowest px-4 py-3 dark:border-white/10"
    >
      <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
          <Users size={20} />
        </div>
        <div>
          <p className="text-xs font-semibold text-on-surface-variant">Clientes impactados</p>
          {falhou ? (
            <p className="text-xs text-on-surface-variant">
              Não foi possível estimar agora{data?.erro ? ` — ${data.erro}` : ''}.
            </p>
          ) : data?.pronto ? (
            <p className="flex items-center gap-2">
              <span className="text-3xl font-extrabold leading-none tabular-nums text-on-surface">{fmt(animado)}</span>
              {total > 0 ? (
                <button
                  type="button"
                  onClick={() => setVerLista(true)}
                  className="rounded-lg p-1.5 text-primary transition hover:bg-primary/10"
                  aria-label="Ver clientes impactados"
                  title="Ver clientes impactados"
                >
                  <ListChecks size={18} aria-hidden />
                </button>
              ) : null}
            </p>
          ) : (
            <p className="text-xs text-on-surface-variant">Calculando…</p>
          )}
        </div>
        {data?.pronto && corporativos > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 motion-safe:animate-pulse">
            <Building2 size={12} aria-hidden /> {fmt(corporativos)} {corporativos === 1 ? 'corporativo' : 'corporativos'}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2 text-[11px] text-on-surface-variant">
          {recalculando ? <Loader2 size={14} className="animate-spin" aria-label="Atualizando" /> : null}
          estimativa pelo escopo
        </span>
      </div>

      {data?.pronto && total > 0 ? (
        <div className="mt-3">
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-container-low" aria-hidden>
            <div className="h-full bg-primary/70 transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${100 - pctCorp}%` }} />
            <div className="h-full bg-red-500 transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${corporativos > 0 ? Math.max(pctCorp, 2) : 0}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-on-surface-variant">
            <span>Residenciais · {fmt(total - corporativos)}</span>
            <span>Corporativos · {fmt(corporativos)}</span>
          </div>
        </div>
      ) : null}

      {acimaDoLimite ? (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Acima de {fmt(limite)} clientes a GMUD não é enviada ao banco de usuários afetados. Afunile o escopo por
            ponto de acesso, slot, PON ou splitter.
          </span>
        </p>
      ) : null}

      {verLista ? <GmudClientesImpactadosModal escopo={escopo} onClose={() => setVerLista(false)} /> : null}
    </section>
  )
}
